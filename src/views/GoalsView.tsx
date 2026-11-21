import { getCurrencySymbol } from '../lib/currencyDisplay';
import { ThemedDateTimeInput } from '../components/ThemedDateTimeInput';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Target, Plus, Trash2,
  Zap, Check, ChevronDown,
  Edit2, ListTree,
  ArrowRight, FolderTree, X,
  ArrowUp, ArrowDown, Unlink,
  Search, Download, Undo2, GripVertical, CheckSquare
} from 'lucide-react';
import {
  Goal, Milestone, Strategy, KPI, Mission, MentorProfile, FinanceAccount,
  Task, Habit, HabitLog, Routine, LearningItem, Skill,
  ReminderItem, Note, JournalEntry,
  FinanceTransaction, Loan, Investment, SavingsPlan, Liability, Asset,
  HealthAppointment, HealthNote, HealthProfile, Meeting, Person,
  SpiritualPractice, FocusSession, NavModule, ThingItem, DocumentItem, WarrantyItem, ReceiptItem, CertificateItem, ImportantRecordItem
} from '../types';
import { storage, generateUUID } from '../lib/storage';
import { ConfirmModal } from '../components/ConfirmModal';
import { TimelinePlan, computeItemDelay } from '../components/TimelinePlan';
import { GoalsSectionSwitcher, type GoalsSection } from '../components/GoalsSectionSwitcher';
import { ProgressiveActions } from '../components/ProgressiveActions';
import { FormDisclosure, FormDisclosureToggle } from '../components/FormDisclosure';
import { EmptyState } from '../components/EmptyState';
import {
  computeGoalAggregateBreakdown,
  GoalProgressBreakdown,
  resolveTaskGoalId,
  syncGoalProgressFromMilestones,
  syncGoalProgressDirect,
  syncGoalProgressFromTasks,
  syncGoalProgressFromAppointments,
  syncGoalProgressFromMeetings,
  recalculateGoalAggregateProgress
} from '../lib/goalTaskSync';
import { getLocalDateString } from '../lib/dateUtils';
import { GoalLinkedBreakdownWidget } from './goals/GoalLinkedBreakdownWidget';
import { GoalLevel, MAX_GOAL_LEVEL, sortGoals, computeGoalLevel, getSubtreeHeight } from './goals/goalHelpers';


type GoalsTab = GoalsSection;
type EditableGoalRecord =
  | { type: 'strategy'; item: Strategy }
  | { type: 'milestone'; item: Milestone }
  | { type: 'kpi'; item: KPI }
  | { type: 'mission'; item: Mission };

interface GoalsViewProps {
  goals: Goal[];
  milestones?: Milestone[];
  strategies?: Strategy[];
  kpis?: KPI[];
  missions?: Mission[];
  mentor?: MentorProfile;
  accounts: FinanceAccount[];
  transactions?: FinanceTransaction[];
  loans?: Loan[];
  investments?: Investment[];
  savingsPlans?: SavingsPlan[];
  liabilities?: Liability[];
  assets?: Asset[];
  tasks?: Task[];
  habits?: Habit[];
  habitLogs?: HabitLog[];
  routines?: Routine[];
  learningItems?: LearningItem[];
  skills?: Skill[];
  notes?: Note[];
  journal?: JournalEntry[];
  reminders?: ReminderItem[];
  appointments?: HealthAppointment[];
  healthNotes?: HealthNote[];
  meetings?: Meeting[];
  people?: Person[];
  practices?: SpiritualPractice[];
  focusSessions?: FocusSession[];
  healthProfile?: HealthProfile;
  things?: ThingItem[];
  documents?: DocumentItem[];
  warranties?: WarrantyItem[];
  receipts?: ReceiptItem[];
  certificates?: CertificateItem[];
  importantRecords?: ImportantRecordItem[];
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
  onNavigate?: (module: NavModule) => void;
}

export const GoalsView: React.FC<GoalsViewProps> = ({
  goals,
  milestones = [],
  strategies = [],
  kpis = [],
  missions = [],
  mentor,
  accounts,
  transactions = [],
  loans = [],
  investments = [],
  savingsPlans = [],
  liabilities = [],
  assets = [],
  tasks = [],
  habits = [],
  habitLogs = [],
  routines = [],
  learningItems = [],
  skills = [],
  notes = [],
  journal = [],
  reminders = [],
  appointments = [],
  healthNotes = [],
  meetings = [],
  people = [],
  practices = [],
  focusSessions = [],
  healthProfile,
  things = [],
  documents = [],
  warranties = [],
  receipts = [],
  certificates = [],
  importantRecords = [],
  onRefresh,
  onSuccess,
  onNavigate
}) => {
  const goalData = useMemo(() => ({
    goals,
    tasks,
    milestones,
    habits,
    habitLogs,
    routines,
    learningItems,
    skills,
    notes,
    journal,
    savingsPlans,
    loans,
    investments,
    assets,
    liabilities,
    transactions,
    appointments,
    healthNotes,
    meetings,
    practices,
    focusSessions,
    reminders
  }), [
    goals, tasks, milestones, habits, habitLogs, routines, learningItems,
    skills, notes, journal, savingsPlans, loans, investments, assets, liabilities,
    transactions, appointments, healthNotes, meetings, practices,
    focusSessions, reminders
  ]);

  // Lazy per-goal breakdown cache: recomputes only when the underlying data changes,
  // instead of on every render (e.g. each keystroke in a form).
  const breakdownCache = useMemo(() => new Map<string, GoalProgressBreakdown>(), [goalData]);

  const getGoalBreakdown = (targetGoalId: string): GoalProgressBreakdown => {
    const cached = breakdownCache.get(targetGoalId);
    if (cached) return cached;
    const computed = computeGoalAggregateBreakdown(targetGoalId, goalData);
    breakdownCache.set(targetGoalId, computed);
    return computed;
  };

  const [activeTab, setActiveTab] = useState<GoalsTab>('goals');
  const [formError, setFormError] = useState<string | null>(null);

  // Hierarchy form state
  const [goalTitle, setGoalTitle] = useState('');
  const [goalCategory, setGoalCategory] = useState('Career');
  const [targetDate, setTargetDate] = useState('');
  const [goalProgress, setGoalProgress] = useState(0);
  const [goalDescription, setGoalDescription] = useState('');
  const [goalLevel, setGoalLevel] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [goalParentId, setGoalParentId] = useState<string>('');
  const [goalOrder, setGoalOrder] = useState<string>('');
  const [goalFormOpen, setGoalFormOpen] = useState(true);

  // Hierarchy viewing state
  const [goalViewMode, setGoalViewMode] = useState<'tree' | 'flat'>('tree');
  const [collapsedGoalIds, setCollapsedGoalIds] = useState<Record<string, boolean>>({});
  const [expandedBreakdownGoalIds, setExpandedBreakdownGoalIds] = useState<Record<string, boolean>>({});
  const [levelFilter, setLevelFilter] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  // Text search filter
  const [searchQuery, setSearchQuery] = useState('');
  // Status filter (all | active | completed)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  // Bulk selection
  const [selectedGoalIds, setSelectedGoalIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  // Undo delete
  const [undoStack, setUndoStack] = useState<Array<{ goals: Goal[]; label: string; timer: ReturnType<typeof setTimeout> }>>([]);
  // Drag reorder
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const reportError = (message: string) => setFormError(message);

  // Local error surface: validation/storage failures must not look like success toasts.
  useEffect(() => {
    if (!formError) return;
    const timer = window.setTimeout(() => setFormError(null), 6000);
    return () => window.clearTimeout(timer);
  }, [formError]);

  // Guards against double-submits / double-clicks on the same item.
  const pendingRef = useRef<Set<string>>(new Set());
  // Serializes manual progress writes per goal so rapid +/- clicks are not lost.
  const progressQueueRef = useRef<Map<string, Promise<void>>>(new Map());

  const withPending = async (key: string, action: () => Promise<void>) => {
    if (pendingRef.current.has(key)) return;
    pendingRef.current.add(key);
    try {
      await action();
    } catch (error) {
      console.error(error);
      reportError('Could not save your change. Please try again.');
    } finally {
      pendingRef.current.delete(key);
    }
  };

  const toggleBreakdown = (id: string) => {
    setExpandedBreakdownGoalIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleQuickToggleTask = (taskId: string) => withPending(`task:${taskId}`, async () => {
    const task = await storage.get<Task>('tasks', taskId);
    if (!task) {
      reportError('That task no longer exists. Refresh the page and try again.');
      return;
    }
    const nextDone = !task.done;
    const updated: Task = {
      ...task,
      done: nextDone,
      status: nextDone ? 'done' : 'open',
      updatedAt: Date.now()
    };
    await storage.put('tasks', updated);
    const linkedGoalId = resolveTaskGoalId(updated, { routines, skills, learningItems });
    if (linkedGoalId) {
      const res = await syncGoalProgressFromTasks(linkedGoalId, updated.id, nextDone);
      if (res.targetGoal) {
        onSuccess(
          nextDone
            ? `✓ Task complete! Goal "${res.targetGoal.title}" progress updated to ${res.targetGoal.progress}%`
            : `Task opened. Goal "${res.targetGoal.title}" progress adjusted to ${res.targetGoal.progress}%`
        );
      }
    }
    onRefresh();
  });

  const handleQuickToggleMilestone = (milestoneId: string) => withPending(`milestone:${milestoneId}`, async () => {
    const milestone = await storage.get<Milestone>('milestones', milestoneId);
    if (!milestone) {
      reportError('That milestone no longer exists. Refresh the page and try again.');
      return;
    }
    await handleToggleMilestoneStatus(milestone);
  });

  const handleQuickToggleAppointment = (appointmentId: string) => withPending(`appointment:${appointmentId}`, async () => {
    const appt = await storage.get<HealthAppointment>('healthAppointments', appointmentId);
    if (!appt) {
      reportError('That appointment no longer exists. Refresh the page and try again.');
      return;
    }
    const isComp = Boolean(appt.completed || appt.status === 'completed');
    const nextCompleted = !isComp;
    const nextStatus: 'scheduled' | 'completed' = nextCompleted ? 'completed' : 'scheduled';
    const updated: HealthAppointment = {
      ...appt,
      completed: nextCompleted,
      status: nextStatus,
      updatedAt: Date.now()
    };
    await storage.put('healthAppointments', updated);
    if (appt.goalId) {
      const res = await syncGoalProgressFromAppointments(appt.goalId, appt.id, nextCompleted, nextStatus);
      if (res.targetGoal) {
        onSuccess(
          nextCompleted
            ? `✓ Checkup attended! Goal "${res.targetGoal.title}" progress updated to ${res.targetGoal.progress}%`
            : `Checkup marked scheduled. Goal "${res.targetGoal.title}" progress adjusted to ${res.targetGoal.progress}%`
        );
      }
    }
    onRefresh();
  });

  const handleQuickToggleMeeting = (meetingId: string) => withPending(`meeting:${meetingId}`, async () => {
    const meet = await storage.get<Meeting>('meetings', meetingId);
    if (!meet) {
      reportError('That meeting no longer exists. Refresh the page and try again.');
      return;
    }
    const isComp = Boolean(meet.completed || meet.status === 'completed');
    const nextCompleted = !isComp;
    const nextStatus: 'scheduled' | 'completed' = nextCompleted ? 'completed' : 'scheduled';
    const updated: Meeting = {
      ...meet,
      completed: nextCompleted,
      status: nextStatus,
      updatedAt: Date.now()
    };
    await storage.put('meetings', updated);
    if (meet.goalId) {
      const res = await syncGoalProgressFromMeetings(meet.goalId, meet.id, nextCompleted, nextStatus);
      if (res.targetGoal) {
        onSuccess(
          nextCompleted
            ? `✓ Meeting attended! Goal "${res.targetGoal.title}" progress updated to ${res.targetGoal.progress}%`
            : `Meeting marked scheduled. Goal "${res.targetGoal.title}" progress adjusted to ${res.targetGoal.progress}%`
        );
      }
    }
    onRefresh();
  });

  const goalFormRef = useRef<HTMLDivElement>(null);
  const previousGoalFormState = useRef({ isOpen: goalFormOpen, tab: activeTab });

  useEffect(() => {
    const previous = previousGoalFormState.current;
    previousGoalFormState.current = { isOpen: goalFormOpen, tab: activeTab };
    // Keep the header dropdown visible on entry and section changes; only scroll
    // when opening the form from the portfolio or a child-goal action below it.
    if (!goalFormOpen || activeTab !== 'goals' || previous.isOpen || previous.tab !== 'goals') return;
    goalFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [goalFormOpen, activeTab]);

  const goalsById = useMemo(() => new Map(goals.map(goal => [goal.id, goal])), [goals]);

  // Hierarchy depth follows the direct parent relationship, not a potentially stale saved level.
  const levelByGoalId = useMemo(() => {
    const levels = new Map<string, GoalLevel>();
    goals.forEach(goal => levels.set(goal.id, computeGoalLevel(goal, goalsById)));
    return levels;
  }, [goals, goalsById]);

  // Memoized depth for persisted goals, live walk for unsaved copies (e.g. the goal being edited).
  const getGoalLevel = (g: Goal): GoalLevel => {
    const cached = levelByGoalId.get(g.id);
    if (cached && goalsById.get(g.id)?.parentId === g.parentId) return cached;
    return computeGoalLevel(g, goalsById);
  };

  const { hierarchySequenceById, flatHierarchyGoals } = useMemo(() => {
    const sequenceById = new Map<string, string>();
    const flat: Goal[] = [];
    const visited = new Set<string>();
    const walk = (goal: Goal, sequence: string) => {
      if (visited.has(goal.id)) return;
      visited.add(goal.id);
      sequenceById.set(goal.id, sequence);
      flat.push(goal);
      sortGoals(goals.filter(child => child.parentId === goal.id))
        .forEach((child, index) => walk(child, `${sequence}.${index + 1}`));
    };
    const roots = sortGoals(goals.filter(goal => !goal.parentId || !goalsById.has(goal.parentId)));
    roots.forEach((goal, index) => walk(goal, String(index + 1)));
    sortGoals(goals.filter(goal => !visited.has(goal.id)))
      .forEach((goal, index) => walk(goal, String(roots.length + index + 1)));
    return { hierarchySequenceById: sequenceById, flatHierarchyGoals: flat };
  }, [goals, goalsById]);

  const mainGoals = useMemo(() => sortGoals(goals.filter(g => levelByGoalId.get(g.id) === 1)), [goals, levelByGoalId]);
  const subGoals = useMemo(() => sortGoals(goals.filter(g => levelByGoalId.get(g.id) === 2)), [goals, levelByGoalId]);
  const microGoals = useMemo(() => sortGoals(goals.filter(g => levelByGoalId.get(g.id) === 3)), [goals, levelByGoalId]);
  const nanoGoals = useMemo(() => sortGoals(goals.filter(g => levelByGoalId.get(g.id) === 4)), [goals, levelByGoalId]);
  const atomicGoals = useMemo(() => sortGoals(goals.filter(g => levelByGoalId.get(g.id) === 5)), [goals, levelByGoalId]);

  // Delayed-item counters are needed by both the tab badge and the alert banner; compute once.
  const delayCounts = useMemo(() => ({
    tasks: tasks.filter(t => !t.done && computeItemDelay(t).isDelayed).length,
    milestones: milestones.filter(m => m.status !== 'completed' && (m.progress || 0) < 100 && computeItemDelay({ dueDate: m.dueDate, status: m.status, progress: m.progress }).isDelayed).length,
    routines: routines.filter(r => computeItemDelay(r).isDelayed).length
  }), [tasks, milestones, routines]);

  const totalDelays = delayCounts.tasks + delayCounts.milestones + delayCounts.routines;
  const selectGoalLevel = (level: 1 | 2 | 3 | 4 | 5) => {
    setGoalLevel(level);
    if (level === 1) {
      setGoalParentId('');
      return;
    }
    const eligibleParents = sortGoals(goals.filter(goal => getGoalLevel(goal) === level - 1));
    setGoalParentId(current => eligibleParents.some(goal => goal.id === current)
      ? current
      : eligibleParents[0]?.id || '');
  };

  const editingDescendantIds = useMemo(() => {
    if (!editingGoal) return new Set<string>();
    const descendants = new Set<string>();
    const pending = [editingGoal.id];
    while (pending.length > 0) {
      const parentId = pending.pop()!;
      for (const child of goals) {
        if (child.parentId === parentId && !descendants.has(child.id)) {
          descendants.add(child.id);
          pending.push(child.id);
        }
      }
    }
    return descendants;
  }, [editingGoal, goals]);

  // A level is only reachable when at least one eligible parent exists at level - 1.
  const eligibleParentCountForLevel = (level: GoalLevel): number => {
    if (level === 1) return 1;
    if (!editingGoal) return 0;
    return goals.filter(g =>
      g.id !== editingGoal.id &&
      !editingDescendantIds.has(g.id) &&
      getGoalLevel(g) === level - 1
    ).length;
  };

  // Close the edit modal with Escape as well as the close button.
  useEffect(() => {
    if (!editingGoal) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEditingGoal(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingGoal]);

  const getSubGoalsOf = (mainGoalId: string) => {
    return sortGoals(goals.filter(g => g.parentId === mainGoalId));
  };

  const getMicroGoalsOf = (subGoalId: string) => {
    return sortGoals(goals.filter(g => g.parentId === subGoalId));
  };

  const getNanoGoalsOf = (microGoalId: string) => {
    return sortGoals(goals.filter(g => g.parentId === microGoalId));
  };

  const getAtomicGoalsOf = (nanoGoalId: string) => {
    return sortGoals(goals.filter(g => g.parentId === nanoGoalId));
  };

  /** Collect all descendant IDs of a goal (recursive children). */
  const getDescendantIds = (goalId: string): string[] => {
    const result: string[] = [];
    const walk = (parentId: string) => {
      for (const child of goals) {
        if (child.parentId === parentId && !result.includes(child.id)) {
          result.push(child.id);
          walk(child.id);
        }
      }
    };
    walk(goalId);
    return result;
  };

  /** Apply search query and status filter to a list of goals. */
  const filterGoals = (list: Goal[]): Goal[] => {
    let filtered = list;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(g => g.title.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q) || g.category?.toLowerCase().includes(q));
    }
    if (statusFilter === 'active') {
      filtered = filtered.filter(g => g.progress < 100 && g.status !== 'completed');
    } else if (statusFilter === 'completed') {
      filtered = filtered.filter(g => g.progress >= 100 || g.status === 'completed');
    }
    return filtered;
  };

  /** Check if a goal or any of its descendants match the active filters. */
  const goalTreeMatchesFilter = (goalId: string): boolean => {
    const goal = goalsById.get(goalId);
    if (!goal) return false;
    if (filterGoals([goal]).length > 0) return true;
    return goals.filter(g => g.parentId === goalId).some(child => goalTreeMatchesFilter(child.id));
  };

  // Drag-and-drop handlers for sibling reordering
  const handleDragStart = (e: React.DragEvent, goalId: string) => {
    setDragSourceId(goalId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', goalId);
  };
  const handleDragOver = (e: React.DragEvent, goalId: string) => {
    if (!dragSourceId || dragSourceId === goalId) return;
    const source = goalsById.get(dragSourceId);
    const target = goalsById.get(goalId);
    if (!source || !target) return;
    // Only allow drag within same parent group
    if ((source.parentId || null) !== (target.parentId || null)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(goalId);
  };
  const handleDrop = async (e: React.DragEvent, targetGoalId: string) => {
    e.preventDefault();
    if (!dragSourceId || dragSourceId === targetGoalId) { setDragSourceId(null); setDragOverId(null); return; }
    const source = goalsById.get(dragSourceId);
    const target = goalsById.get(targetGoalId);
    if (!source || !target || (source.parentId || null) !== (target.parentId || null)) { setDragSourceId(null); setDragOverId(null); return; }
    const siblings = source.parentId
      ? goals.filter(g => g.parentId === source.parentId)
      : goals.filter(g => !g.parentId || !goalsById.has(g.parentId));
    const sorted = sortGoals(siblings);
    const sourceIdx = sorted.findIndex(g => g.id === dragSourceId);
    const targetIdx = sorted.findIndex(g => g.id === targetGoalId);
    if (sourceIdx === -1 || targetIdx === -1) { setDragSourceId(null); setDragOverId(null); return; }
    const reordered = [...sorted];
    const [moved] = reordered.splice(sourceIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    const stamp = Date.now();
    await storage.bulkPut('goals', reordered.map((g, idx) => ({ ...g, order: idx, updatedAt: stamp })));
    setDragSourceId(null);
    setDragOverId(null);
    onRefresh();
  };
  const handleDragEnd = () => { setDragSourceId(null); setDragOverId(null); };

  // Bulk action handlers
  const toggleBulkSelect = (goalId: string) => {
    setSelectedGoalIds(prev => {
      const next = new Set(prev);
      if (next.has(goalId)) next.delete(goalId); else next.add(goalId);
      return next;
    });
  };
  const handleBulkDelete = async () => {
    if (selectedGoalIds.size === 0) return;
    const toDelete = [...selectedGoalIds];
    // Snapshot for undo
    const deletedGoals = goals.filter(g => toDelete.some(id => id === g.id || getDescendantIds(id).includes(g.id)));
    const allDeleteIds = new Set<string>();
    for (const id of toDelete) {
      allDeleteIds.add(id);
      getDescendantIds(id).forEach(d => allDeleteIds.add(d));
    }
    await Promise.all([...allDeleteIds].map(id => storage.delete('goals', id)));
    const timer = setTimeout(() => {
      setUndoStack(prev => prev.filter(entry => entry.goals !== deletedGoals));
    }, 15000);
    setUndoStack(prev => [...prev, { goals: deletedGoals, label: `${toDelete.length} goals`, timer }]);
    onSuccess(`Removed ${toDelete.length} selected goal(s) and ${allDeleteIds.size - toDelete.length} descendants`);
    exitBulkMode();
    onRefresh();
  };
  const exitBulkMode = () => { setBulkMode(false); setSelectedGoalIds(new Set()); };

  // Export goals to JSON
  const handleExportJSON = () => {
    const data = goals.map(g => ({
      title: g.title, level: getGoalLevel(g), category: g.category, progress: g.progress,
      targetDate: g.targetDate, status: g.status, description: g.description,
      parent: g.parentId ? goalsById.get(g.parentId)?.title : undefined
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'goals-export.json'; a.click();
    URL.revokeObjectURL(url);
  };
  // Export goals to CSV
  const handleExportCSV = () => {
    const headers = ['Title', 'Level', 'Category', 'Progress', 'Target Date', 'Status', 'Parent'];
    const rows = goals.map(g => [
      `"${(g.title || '').replace(/"/g, '""')}"`,
      String(getGoalLevel(g)),
      g.category || '',
      String(g.progress),
      g.targetDate || '',
      g.status || 'active',
      g.parentId ? `"${(goalsById.get(g.parentId)?.title || '').replace(/"/g, '""')}"` : ''
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'goals-export.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Undo delete: restore goals from undo stack
  const handleUndoDelete = (index: number) => {
    const entry = undoStack[index];
    if (!entry) return;
    clearTimeout(entry.timer);
    Promise.all(entry.goals.map(g => storage.put('goals', g))).then(() => {
      setUndoStack(prev => prev.filter((_, i) => i !== index));
      onSuccess(`Restored ${entry.goals.length} goal(s)`);
      onRefresh();
    }).catch(() => onSuccess('⚠ Restore failed. Try refreshing.'));
  };

  const handleMoveGoalOrder = async (targetGoal: Goal, direction: 'up' | 'down') => {
    const siblings = targetGoal.parentId
      ? goals.filter(g => g.parentId === targetGoal.parentId)
      : goals.filter(g => !g.parentId || !goalsById.has(g.parentId));

    const sorted = sortGoals(siblings);
    const index = sorted.findIndex(g => g.id === targetGoal.id);
    if (index === -1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sorted.length) return;

    // Never mutate props: build copies with a stable 0..n-1 order, then swap the two rows.
    const reordered = sorted.map((item, idx) => ({ ...item, order: idx }));
    const currentOrder = reordered[index].order ?? index;
    reordered[index].order = reordered[swapIndex].order ?? swapIndex;
    reordered[swapIndex].order = currentOrder;
    const stamp = Date.now();
    const payload = reordered.map(item => ({ ...item, updatedAt: stamp }));

    await storage.bulkPut('goals', payload);
    onRefresh();
  };

  const handleUnlinkGoal = async (g: Goal) => {
    const oldParentId = g.parentId;
    const updated: Goal = {
      ...g,
      parentId: null,
      parentIds: (g.parentIds || []).filter(p => p !== oldParentId),
      level: 1,
      updatedAt: Date.now()
    };
    await storage.put('goals', updated);
    if (oldParentId) {
      await recalculateGoalAggregateProgress(oldParentId);
    }
    await recalculateGoalAggregateProgress(updated.id);
    onSuccess(`"${g.title}" unlinked`);
    onRefresh();
  };

  const toggleCollapse = (id: string) => {
    setCollapsedGoalIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const startAddChildGoal = (parentGoal: Goal, targetLevel?: 1 | 2 | 3 | 4 | 5) => {
    const parentLvl = getGoalLevel(parentGoal);
    if (parentLvl >= MAX_GOAL_LEVEL) {
      reportError(`"${parentGoal.title}" is an Atomic (Level 5) goal - the hierarchy stops at 5 levels.`);
      return;
    }
    // The level is always parent depth + 1, even if the clicked button asked for another tier.
    const nextLvl = Math.min(targetLevel || parentLvl + 1, parentLvl + 1) as GoalLevel;
    setGoalLevel(nextLvl);
    setGoalParentId(parentGoal.id);
    setGoalCategory(parentGoal.category || 'Career');
    if (parentGoal.targetDate) setTargetDate(parentGoal.targetDate);
    setGoalFormOpen(true);
    goalFormRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const startAddSubGoal = (parentGoal: Goal) => {
    startAddChildGoal(parentGoal, 2);
  };

  const startAddNestedGoal = (subGoal: Goal) => {
    startAddChildGoal(subGoal, 3);
  };

  // New Strategy form (Previously Missing!)
  const [stratTitle, setStratTitle] = useState('');
  const [stratGoalId, setStratGoalId] = useState(goals[0]?.id || '');
  const [stratAction, setStratAction] = useState('');
  const [stratStatus, setStratStatus] = useState<'active' | 'in-progress' | 'executed'>('active');

  // New Milestone form
  const [msTitle, setMsTitle] = useState('');
  const [msGoalId, setMsGoalId] = useState(goals[0]?.id || '');
  const [msDueDate, setMsDueDate] = useState('');

  // New KPI form
  const [kpiName, setKpiName] = useState('');
  const [kpiGoalId, setKpiGoalId] = useState(goals[0]?.id || '');
  const [kpiTarget, setKpiTarget] = useState('');
  const [kpiCurrent, setKpiCurrent] = useState('');
  const [kpiUnit, setKpiUnit] = useState('');

  // New Mission form
  const [missionTitle, setMissionTitle] = useState('');
  const [missionPeriod, setMissionPeriod] = useState('Q4 Focus');
  const [missionTarget, setMissionTarget] = useState('');
  const [missionAction, setMissionAction] = useState('Daily core routine execution');
  const [missionGoalId, setMissionGoalId] = useState('');
  const [missionStartDate, setMissionStartDate] = useState('');
  const [missionEndDate, setMissionEndDate] = useState('');
  const [missionStatus, setMissionStatus] = useState<Mission['status']>('active');
  const [strategyTaskDrafts, setStrategyTaskDrafts] = useState<Record<string, string>>({});

  const [editingRecord, setEditingRecord] = useState<EditableGoalRecord | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<{ store: string; id: string; name: string } | null>(null);

  // Auto-sync dropdowns when goals asynchronously load
  useEffect(() => {
    if (goals.length === 0) return;
    const defaultGoalId = sortGoals(goals)[0].id;
    if (!stratGoalId || !goals.some(g => g.id === stratGoalId)) {
      setStratGoalId(defaultGoalId);
    }
    if (!msGoalId || !goals.some(g => g.id === msGoalId)) {
      setMsGoalId(defaultGoalId);
    }
    if (!kpiGoalId || !goals.some(g => g.id === kpiGoalId)) {
      setKpiGoalId(defaultGoalId);
    }
  }, [goals, stratGoalId, msGoalId, kpiGoalId]);

  const liquidCash = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  // Dashboard reflects the *saved* mentor profile, not unsaved form edits.
  const savedSurvivalReserve = Number(mentor?.survivalReserve ?? 0) || 0;
  const savedEmergencyReserve = Number(mentor?.emergencyReserve ?? 0) || 0;
  const savedDailyBurn = Number(mentor?.dailyBurn ?? 0) || 0;
  const totalReserves = savedSurvivalReserve + savedEmergencyReserve;
  const hasReserveTargets = mentor?.survivalReserve !== undefined && mentor?.emergencyReserve !== undefined;
  const hasSavedDailyBurn = mentor?.dailyBurn !== undefined;
  const hasRunwayEstimate = hasSavedDailyBurn && savedDailyBurn > 0;
  const runwayDays = savedDailyBurn > 0 ? Math.max(0, Math.floor(liquidCash / savedDailyBurn)) : 0;
  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;
  const todayDate = getLocalDateString();
  const netSavingsThisYear = transactions
    .filter(transaction => transaction.date >= yearStart && transaction.date <= todayDate && !transaction.ledgerOnly && (transaction.type === 'savings' || transaction.type === 'savingsWithdrawal'))
    .reduce((sum, transaction) => sum + (transaction.type === 'savings' ? Number(transaction.amount) || 0 : -(Number(transaction.amount) || 0)), 0);
  const annualSavingsTarget = Math.max(0, Number(mentor?.savingGoalAmount) || 0);
  const annualSavingsProgress = annualSavingsTarget > 0
    ? Math.max(0, Math.min(100, Math.round((netSavingsThisYear / annualSavingsTarget) * 100)))
    : 0;

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) {
      reportError('Enter a goal title before saving.');
      return;
    }

    // Validate target date is not in the past
    if (targetDate) {
      const today = getLocalDateString();
      if (targetDate < today) {
        reportError('Target date cannot be in the past. Please choose a future date.');
        return;
      }
    }

    const now = Date.now();
    const parentGoal = goalParentId ? goals.find(g => g.id === goalParentId) : null;

    if (goalLevel > 1 && !parentGoal) {
      reportError(`Select a Level ${goalLevel - 1} parent goal before saving a Level ${goalLevel} goal.`);
      return;
    }

    // Level is always derived from the chosen parent, never trusted from stale form state.
    let effectiveLevel: GoalLevel = 1;
    if (parentGoal) {
      const parentLevel = getGoalLevel(parentGoal);
      if (parentLevel >= MAX_GOAL_LEVEL) {
        reportError(`"${parentGoal.title}" is already an Atomic (Level 5) goal, so it cannot have child goals.`);
        return;
      }
      effectiveLevel = (parentLevel + 1) as GoalLevel;
    }

    // Only an explicitly entered order is persisted. Deriving it from the title used to turn
    // trailing year-like numbers ("Launch MVP 2027") into sibling order 2027.
    const parsedOrder = goalOrder.trim() !== '' && Number.isFinite(Number(goalOrder))
      ? Number(goalOrder)
      : undefined;

    const newGoalId = generateUUID();
    const newGoal: Goal = {
      id: newGoalId,
      title: goalTitle.trim(),
      category: goalCategory || parentGoal?.category || 'Career',
      targetDate: targetDate || parentGoal?.targetDate || undefined,
      description: goalDescription.trim() || undefined,
      progress: goalProgress,
      manualProgress: goalProgress,
      status: goalProgress >= 100 ? 'completed' : 'active',
      parentId: parentGoal?.id || null,
      level: effectiveLevel,
      order: parsedOrder,
      createdAt: now,
      updatedAt: now
    };

    await storage.put('goals', newGoal);

    // Rollup parent progress automatically using unified aggregate engine
    if (goalParentId) {
      await recalculateGoalAggregateProgress(goalParentId);
    }

    const levelToastNames: Record<number, string> = {
      1: 'Strategic Main Goal (Level 1) registered',
      2: `Sub Goal (Level 2) linked to "${parentGoal?.title}"`,
      3: `Micro Goal (Level 3) linked to "${parentGoal?.title}"`,
      4: `Nano Goal (Level 4) linked to "${parentGoal?.title}"`,
      5: `Atomic Goal (Level 5) linked to "${parentGoal?.title}"`
    };

    onSuccess(levelToastNames[effectiveLevel] || 'Goal registered successfully');

    setGoalTitle('');
    setGoalDescription('');
    setGoalOrder('');
    setGoalProgress(0);
    setGoalParentId('');
    setGoalLevel(1);
    setGoalCategory('Career');
    setTargetDate('');
    setGoalFormOpen(false);
    onRefresh();
  };

  const handleAddStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stratTitle.trim()) return;

    if (goals.length === 0) {
      reportError('Create a strategic goal first - a strategy must belong to a goal.');
      return;
    }
    const targetGoal = stratGoalId || sortGoals(goals)[0].id;
    const newStrategy: Strategy = {
      id: generateUUID(),
      goalId: targetGoal,
      title: stratTitle.trim(),
      action: stratAction.trim() || 'Execute tactical roadmap',
      status: stratStatus,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await storage.put('strategies', newStrategy);
    onSuccess('Strategy initiative created');
    setStratTitle('');
    setStratAction('');
    onRefresh();
  };

  const handleAddStrategyTask = async (strategy: Strategy) => {
    const taskTitle = (strategyTaskDrafts[strategy.id] || '').trim();
    if (!taskTitle) return;
    const now = Date.now();
    const task: Task = {
      id: generateUUID(),
      title: taskTitle,
      domain: 'work',
      priority: 'Medium',
      goalId: strategy.goalId,
      strategyId: strategy.id,
      done: false,
      status: 'open',
      createdAt: now,
      updatedAt: now
    };
    await storage.put('tasks', task);
    setStrategyTaskDrafts(previous => ({ ...previous, [strategy.id]: '' }));
    if (strategy.goalId) await syncGoalProgressFromTasks(strategy.goalId);
    onSuccess('Execution task linked to strategy and Goal');
    onRefresh();
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msTitle.trim()) return;

    if (goals.length === 0) {
      reportError('Create a strategic goal first - a milestone must belong to a goal.');
      return;
    }
    const targetGoal = msGoalId || sortGoals(goals)[0].id;
    const ms: Milestone = {
      id: generateUUID(),
      goalId: targetGoal,
      title: msTitle.trim(),
      dueDate: msDueDate || undefined,
      progress: 0,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await storage.put('milestones', ms);
    const res = await syncGoalProgressFromMilestones(targetGoal);
    onSuccess(`✓ Milestone added! Goal "${res.targetGoal?.title || ''}" progress updated to ${res.targetGoal?.progress || 0}%`);
    setMsTitle('');
    setMsDueDate('');
    onRefresh();
  };

  const handleAddKPI = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = Number(kpiTarget);
    const current = kpiCurrent.trim() === '' ? 0 : Number(kpiCurrent);
    if (!kpiName.trim() || !Number.isFinite(target) || target <= 0 || !Number.isFinite(current) || current < 0) {
      reportError('Enter a KPI name, a target greater than zero, and current progress of zero or more.');
      return;
    }

    const targetGoal = kpiGoalId || sortGoals(goals)[0]?.id || '';
    const k: KPI = {
      id: generateUUID(),
      goalId: targetGoal || undefined,
      name: kpiName.trim(),
      target,
      current,
      unit: kpiUnit.trim() || 'units',
      status: 'tracking',
      history: [{ value: current, recordedAt: Date.now() }],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await storage.put('kpis', k);
    onSuccess('KPI metric registered');
    setKpiName('');
    setKpiTarget('');
    setKpiCurrent('');
    setKpiUnit('');
    onRefresh();
  };

  const handleAddMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!missionTitle.trim()) return;

    const m: Mission = {
      id: generateUUID(),
      title: missionTitle.trim(),
      period: missionPeriod,
      target: missionTarget.trim(),
      action: missionAction.trim() || 'Execute daily core routine',
      status: missionStatus,
      goalId: missionGoalId || undefined,
      startDate: missionStartDate || undefined,
      endDate: missionEndDate || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await storage.put('missions', m);
    onSuccess('Mission declared');
    setMissionTitle('');
    setMissionTarget('');
    setMissionGoalId('');
    setMissionStartDate('');
    setMissionEndDate('');
    setMissionStatus('active');
    onRefresh();
  };

  const handleUpdateMissionStatus = async (mission: Mission, status: Mission['status']) => {
    await storage.put('missions', { ...mission, status, updatedAt: Date.now() });
    onRefresh();
  };

  // Real-Time Aggregate Progress Engine (Proportional Reflection across 3 tiers)
  // Writes are queued per goal and based on the freshest stored value, so rapid +/- clicks
  // accumulate instead of overwriting each other with a stale base value.
  const handleProgressChange = (targetGoal: Goal, newProgressOrDelta: number, isDirect = false) => {
    const goalId = targetGoal.id;
    const previous = progressQueueRef.current.get(goalId) ?? Promise.resolve();
    const next = previous.then(async () => {
      const fresh = await storage.get<Goal>('goals', goalId);
      if (!fresh) {
        reportError('That goal no longer exists. Refresh the page and try again.');
        return;
      }
      if (isDirect) {
        const linked = computeGoalAggregateBreakdown(goalId, goalData).progressItemCount;
        if (linked > 0) {
          reportError('This goal\'s progress is calculated from its linked items, so it cannot be set manually. Complete the linked items instead.');
          return;
        }
      }
      const base = Number(fresh.progress) || 0;
      const calculatedProgress = isDirect
        ? Math.max(0, Math.min(100, newProgressOrDelta))
        : Math.max(0, Math.min(100, base + newProgressOrDelta));
      await syncGoalProgressDirect(goalId, calculatedProgress);
      onRefresh();
    });
    progressQueueRef.current.set(goalId, next.catch(() => undefined));
    return next;
  };

  const handleSaveEditedGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoal || !editingGoal.title.trim()) return;

    // Warn about past target date but don't block the save — the user may be editing other fields
    if (editingGoal.targetDate) {
      const today = getLocalDateString();
      if (editingGoal.targetDate < today) {
        // Only block if the date was *just changed* to a past date (not an existing past date)
        const originalGoal = goals.find(g => g.id === editingGoal.id);
        if (originalGoal?.targetDate !== editingGoal.targetDate) {
          reportError('Target date cannot be in the past. Please choose a future date.');
          return;
        }
      }
    }

    const originalGoal = goals.find(g => g.id === editingGoal.id);
    const parentGoal = editingGoal.parentId ? goalsById.get(editingGoal.parentId) : null;
    const newParentId = parentGoal?.id ?? null;
    const effectiveLevel: GoalLevel = parentGoal
      ? Math.min(MAX_GOAL_LEVEL, getGoalLevel(parentGoal) + 1) as GoalLevel
      : 1;

    if (effectiveLevel >= MAX_GOAL_LEVEL && getSubtreeHeight(editingGoal.id, goals) > 0) {
      reportError('An Atomic (Level 5) goal cannot have child goals. Choose a higher-level parent first.');
      return;
    }

    const hasOrder = editingGoal.order !== undefined
      && editingGoal.order !== null
      && String(editingGoal.order).trim() !== ''
      && Number.isFinite(Number(editingGoal.order));

    // Merge over the freshest stored record so a background refresh is not clobbered by the
    // snapshot captured when the modal opened.
    const fresh = await storage.get<Goal>('goals', editingGoal.id);
    const base = fresh ?? originalGoal ?? editingGoal;
    const oldParentId = base.parentId ?? null;

    await storage.put('goals', {
      ...base,
      title: editingGoal.title.trim(),
      category: editingGoal.category,
      targetDate: editingGoal.targetDate || undefined,
      description: editingGoal.description || undefined,
      level: effectiveLevel,
      parentId: newParentId,
      // Drop the previous primary parent from the multi-parent list so the goal no longer
      // rolls up into a branch it was moved out of.
      parentIds: (base.parentIds || []).filter(id => id !== oldParentId),
      order: hasOrder ? Number(editingGoal.order) : undefined,
      updatedAt: Date.now()
    });

    if (oldParentId && oldParentId !== newParentId) {
      await recalculateGoalAggregateProgress(oldParentId);
    }
    if (newParentId) {
      await recalculateGoalAggregateProgress(newParentId);
    }
    await recalculateGoalAggregateProgress(editingGoal.id);

    setEditingGoal(null);
    onSuccess('✓ Goal updated');
    onRefresh();
  };

  const handleToggleMilestoneStatus = async (m: Milestone) => {
    const nextStatus = m.status === 'completed' ? 'pending' : 'completed';
    const nextProgress = nextStatus === 'completed' ? 100 : 0;
    const updated: Milestone = {
      ...m,
      status: nextStatus,
      progress: nextProgress,
      updatedAt: Date.now()
    };
    await storage.put('milestones', updated);
    if (m.goalId) {
      const res = await syncGoalProgressFromMilestones(m.goalId, m.id, nextProgress, nextStatus);
      if (res.targetGoal) {
        onSuccess(
          nextStatus === 'completed'
            ? `✓ Milestone reached! Goal "${res.targetGoal.title}" progress updated to ${res.targetGoal.progress}%`
            : `Milestone marked pending. Goal "${res.targetGoal.title}" progress adjusted to ${res.targetGoal.progress}%`
        );
      } else {
        onSuccess(nextStatus === 'completed' ? '✓ Milestone reached!' : 'Milestone marked pending');
      }
    } else {
      onSuccess(nextStatus === 'completed' ? '✓ Milestone reached!' : 'Milestone marked pending');
    }
    onRefresh();
  };

  const handleAdjustKPI = async (k: KPI, delta: number) => {
    const current = Math.max(0, Number(k.current || 0) + delta);
    const recordedAt = Date.now();
    const updated: KPI = {
      ...k,
      current,
      history: [...(k.history || [{ value: Number(k.current) || 0, recordedAt: k.updatedAt || k.createdAt }]), { value: current, recordedAt }],
      updatedAt: recordedAt
    };
    await storage.put('kpis', updated);
    onRefresh();
  };

  const handleSaveEditedRecord = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingRecord) return;

    const { type, item } = editingRecord;
    if (type !== 'kpi' && !item.title.trim()) {
      reportError('Enter a title before saving.');
      return;
    }

    if (type === 'strategy') {
      const fresh = await storage.get<Strategy>('strategies', item.id);
      if (!fresh) {
        reportError('This strategy no longer exists. Refresh the page and try again.');
        return;
      }
      await storage.put('strategies', {
        ...fresh,
        goalId: item.goalId,
        title: item.title.trim(),
        action: item.action.trim(),
        updatedAt: Date.now()
      });
      const linkedTasks = tasks.filter(task => task.strategyId === fresh.id && task.goalId !== item.goalId);
      if (linkedTasks.length > 0) {
        await storage.bulkPut('tasks', linkedTasks.map(task => ({ ...task, goalId: item.goalId || null, updatedAt: Date.now() })));
        const affectedGoals = new Set(linkedTasks.map(task => task.goalId).filter((goalId): goalId is string => Boolean(goalId)));
        if (item.goalId) affectedGoals.add(item.goalId);
        for (const goalId of affectedGoals) await syncGoalProgressFromTasks(goalId);
      }
    } else if (type === 'milestone') {
      const fresh = await storage.get<Milestone>('milestones', item.id);
      if (!fresh) {
        reportError('This milestone no longer exists. Refresh the page and try again.');
        return;
      }
      await storage.put('milestones', {
        ...fresh,
        goalId: item.goalId,
        title: item.title.trim(),
        dueDate: item.dueDate || undefined,
        updatedAt: Date.now()
      });
      if (fresh.goalId !== item.goalId) {
        if (fresh.goalId) await syncGoalProgressFromMilestones(fresh.goalId);
        if (item.goalId) await syncGoalProgressFromMilestones(item.goalId);
      }
    } else if (type === 'kpi') {
      const target = Number(item.target);
      const current = Number(item.current);
      if (!item.name.trim() || !Number.isFinite(target) || target <= 0 || !Number.isFinite(current) || current < 0) {
        reportError('Enter a KPI name, a target greater than zero, and current progress of zero or more.');
        return;
      }
      const fresh = await storage.get<KPI>('kpis', item.id);
      if (!fresh) {
        reportError('This KPI no longer exists. Refresh the page and try again.');
        return;
      }
      await storage.put('kpis', {
        ...fresh,
        goalId: item.goalId || undefined,
        name: item.name.trim(),
        target,
        current,
        history: current === fresh.current
          ? fresh.history
          : [...(fresh.history || [{ value: Number(fresh.current) || 0, recordedAt: fresh.updatedAt || fresh.createdAt }]), { value: current, recordedAt: Date.now() }],
        unit: item.unit.trim() || 'units',
        updatedAt: Date.now()
      });
    } else {
      const fresh = await storage.get<Mission>('missions', item.id);
      if (!fresh) {
        reportError('This mission no longer exists. Refresh the page and try again.');
        return;
      }
      await storage.put('missions', {
        ...fresh,
        title: item.title.trim(),
        period: item.period.trim(),
        target: item.target.trim(),
        action: item.action.trim(),
        goalId: item.goalId || undefined,
        startDate: item.startDate || undefined,
        endDate: item.endDate || undefined,
        status: item.status,
        updatedAt: Date.now()
      });
      const linkedTasks = tasks.filter(task => task.missionId === fresh.id && task.goalId !== (item.goalId || null));
      if (linkedTasks.length > 0) {
        await storage.bulkPut('tasks', linkedTasks.map(task => ({ ...task, goalId: item.goalId || null, updatedAt: Date.now() })));
        const affectedGoals = new Set(linkedTasks.map(task => task.goalId).filter((goalId): goalId is string => Boolean(goalId)));
        if (item.goalId) affectedGoals.add(item.goalId);
        for (const goalId of affectedGoals) await syncGoalProgressFromTasks(goalId);
      }
    }

    setEditingRecord(null);
    onSuccess(`${type === 'kpi' ? 'KPI' : type[0].toUpperCase() + type.slice(1)} updated`);
    onRefresh();
  };

  const clearMissionFromSavedPlannerArchives = (missionId: string): boolean => {
    const profileId = storage.getActiveProfileId();
    const keys = [`om-saved-command-targets:${profileId}`, ...(profileId === 'om-master-profile' ? ['om-saved-command-targets'] : [])];
    try {
      const updates: Array<[string, string]> = [];
      for (const key of keys) {
        const stored = localStorage.getItem(key);
        if (!stored) continue;
        const records: unknown = JSON.parse(stored);
        if (!Array.isArray(records)) throw new Error(`Invalid saved-target archive at ${key}`);
        let changed = false;
        const cleaned = records.map((record: unknown) => {
          if (typeof record !== 'object' || record === null || !('raw' in record)) return record;
          const raw = record.raw;
          if (typeof raw !== 'object' || raw === null || !('missionId' in raw) || raw.missionId !== missionId) return record;
          changed = true;
          return { ...record, raw: { ...raw, missionId: undefined } };
        });
        if (changed) updates.push([key, JSON.stringify(cleaned)]);
      }
      for (const [key, value] of updates) localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error('Failed to clear deleted Mission from saved planner archives', error);
      return false;
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    let missionArchiveCleanupFailed = false;

    if (deleteTarget.store === 'milestones') {
      const ms = await storage.get<Milestone>('milestones', deleteTarget.id);
      await storage.delete('milestones', deleteTarget.id);
      if (ms?.goalId) {
        await syncGoalProgressFromMilestones(ms.goalId);
      }
      onSuccess(`✓ Removed milestone "${deleteTarget.name}" & updated goal progress`);
      setDeleteTarget(null);
      onRefresh();
      return;
    }

    if (deleteTarget.store === 'goals') {
      const toDeleteIds = new Set<string>([deleteTarget.id]);
      const findDescendants = (parentId: string) => {
        goals.filter(g => g.parentId === parentId).forEach(child => {
          // Guard against cyclic parentId data (e.g. from an import).
          if (toDeleteIds.has(child.id)) return;
          toDeleteIds.add(child.id);
          findDescendants(child.id);
        });
      };
      findDescendants(deleteTarget.id);

      // Unlink records that point at the deleted subtree instead of leaving dangling goalIds.
      const orphanMilestones = milestones.filter(m => toDeleteIds.has(m.goalId));
      const orphanStrategies = strategies.filter(s => toDeleteIds.has(s.goalId));
      const orphanMissions = missions.filter(mission => mission.goalId ? toDeleteIds.has(mission.goalId) : false);
      const orphanKpis = kpis.filter(k => k.goalId ? toDeleteIds.has(k.goalId) : false);
      const orphanTasks = tasks.filter(t => t.goalId ? toDeleteIds.has(t.goalId) : false);
      const goalReferenceStores = [
        'routines', 'habits', 'learningItems', 'skills', 'notes', 'journal', 'reminders',
        'healthAppointments', 'healthNotes', 'meetings', 'spiritualPractices', 'focus',
        'finance', 'loans', 'investments', 'savingsPlans', 'assets', 'liabilities',
        'things', 'documents', 'warranties', 'receipts', 'certificates', 'importantRecords'
      ];
      const unlinkStamp = Date.now();
      const orphanReferenceCounts = await Promise.all(goalReferenceStores.map(async store => {
        const records = await storage.getAll<{ id: string; goalId?: string | null; updatedAt?: number }>(store);
        const linkedRecords = records.filter(record => record.goalId && toDeleteIds.has(record.goalId));
        if (linkedRecords.length > 0) {
          await storage.bulkPut(store, linkedRecords.map(record => ({ ...record, goalId: undefined, updatedAt: unlinkStamp })));
        }
        return linkedRecords.length;
      }));
      const healthProfile = await storage.getSingleton<{ goalId?: string | null; updatedAt?: number }>('healthProfile');
      if (healthProfile?.goalId && toDeleteIds.has(healthProfile.goalId)) {
        await storage.setSingleton('healthProfile', { ...healthProfile, goalId: undefined, updatedAt: unlinkStamp });
      }

      await Promise.all([
        orphanMilestones.length > 0
          ? storage.bulkPut('milestones', orphanMilestones.map(m => ({ ...m, goalId: undefined, updatedAt: unlinkStamp })))
          : Promise.resolve(),
        orphanStrategies.length > 0
          ? storage.bulkPut('strategies', orphanStrategies.map(s => ({ ...s, goalId: undefined, updatedAt: unlinkStamp })))
          : Promise.resolve(),
        orphanMissions.length > 0
          ? storage.bulkPut('missions', orphanMissions.map(mission => ({ ...mission, goalId: undefined, updatedAt: unlinkStamp })))
          : Promise.resolve(),
        orphanKpis.length > 0
          ? storage.bulkPut('kpis', orphanKpis.map(k => ({ ...k, goalId: undefined, updatedAt: unlinkStamp })))
          : Promise.resolve(),
        orphanTasks.length > 0
          ? storage.bulkPut('tasks', orphanTasks.map(t => ({ ...t, goalId: undefined, updatedAt: unlinkStamp })))
          : Promise.resolve()
      ]);

      // Snapshot goals for undo before deletion
      const deletedGoals = goals.filter(g => toDeleteIds.has(g.id));

      await Promise.all([...toDeleteIds].map(id => storage.delete('goals', id)));

      // Push to undo stack with 15-second timeout
      const timer = setTimeout(() => {
        setUndoStack(prev => prev.filter(entry => entry.goals !== deletedGoals));
      }, 15000);
      setUndoStack(prev => [...prev, { goals: deletedGoals, label: deleteTarget.name, timer }]);

      // If deleted goal had a parent, recalculate parent progress
      const deletedGoal = goals.find(g => g.id === deleteTarget.id);
      if (deletedGoal?.parentId && !toDeleteIds.has(deletedGoal.parentId)) {
        await recalculateGoalAggregateProgress(deletedGoal.parentId);
      }

      const unlinkedCount = orphanMilestones.length + orphanStrategies.length + orphanMissions.length + orphanKpis.length + orphanTasks.length + orphanReferenceCounts.reduce((sum, count) => sum + count, 0) + (healthProfile?.goalId && toDeleteIds.has(healthProfile.goalId) ? 1 : 0);
      const removedSubGoals = toDeleteIds.size - 1;
      const removedParts = [`"${deleteTarget.name}"`];
      if (removedSubGoals > 0) removedParts.push(`${removedSubGoals} sub-goal(s)`);
      if (unlinkedCount > 0) removedParts.push(`${unlinkedCount} linked item(s) unlinked`);
      onSuccess(`✓ Removed ${removedParts.join(' + ')}`);
      setDeleteTarget(null);
      onRefresh();
      return;
    }

    if (deleteTarget.store === 'strategies' || deleteTarget.store === 'missions') {
      const store = deleteTarget.store;
      const linkedTasks = tasks.filter(task => store === 'strategies' ? task.strategyId === deleteTarget.id : task.missionId === deleteTarget.id);
      if (linkedTasks.length > 0) {
        await storage.bulkPut('tasks', linkedTasks.map(task => ({ ...task, ...(store === 'strategies' ? { strategyId: null } : { missionId: null }), updatedAt: Date.now() })));
      }
      if (store === 'missions') {
        const appSettings = (await storage.getSingleton<Record<string, any>>('appSettings')) || {};
        if (appSettings.dailyPlanner?.missionId === deleteTarget.id) {
          appSettings.dailyPlanner = { ...appSettings.dailyPlanner, missionId: undefined };
          await storage.setSingleton('appSettings', appSettings);
        }
        missionArchiveCleanupFailed = !clearMissionFromSavedPlannerArchives(deleteTarget.id);
      }
    }
    await storage.delete(deleteTarget.store, deleteTarget.id);
    onSuccess(missionArchiveCleanupFailed
      ? `Removed "${deleteTarget.name}", but some saved planner archive links could not be cleared.`
      : `✓ Removed "${deleteTarget.name}"`);
    setDeleteTarget(null);
    onRefresh();
  };

  // Explicit consequence text for the confirmation modal (sub-goals removed, links unlinked).
  const deleteImpact = useMemo(() => {
    if (!deleteTarget) return '';
    if (deleteTarget.store !== 'goals') return 'This action cannot be undone.';
    const ids = new Set<string>([deleteTarget.id, ...getDescendantIds(deleteTarget.id)]);
    const subGoalCount = ids.size - 1;
    const hasDeletedGoalLink = (item: { goalId?: string | null }) => Boolean(item.goalId && ids.has(item.goalId));
    const linkedCount = [
      milestones, strategies, missions, kpis, tasks, habits, routines, learningItems, skills,
      notes, journal, reminders, appointments, healthNotes, meetings, practices, focusSessions,
      transactions, loans, investments, savingsPlans, liabilities, assets,
      things, documents, warranties, receipts, certificates, importantRecords
    ].reduce((total, items) => total + items.filter(item => 'goalId' in item && hasDeletedGoalLink(item)).length, 0) +
      (healthProfile?.goalId && ids.has(healthProfile.goalId) ? 1 : 0);
    const parts: string[] = [];
    if (subGoalCount > 0) parts.push(`${subGoalCount} sub-goal(s) will also be removed`);
    if (linkedCount > 0) parts.push(`${linkedCount} linked item(s) will be unlinked (not deleted)`);
    return parts.length > 0
      ? `${parts.join(' and ')}. This action cannot be undone.`
      : 'This action cannot be undone.';
  }, [deleteTarget, goals, milestones, strategies, missions, kpis, tasks, habits, routines, learningItems, skills, notes, journal, reminders, appointments, healthNotes, meetings, practices, focusSessions, transactions, loans, investments, savingsPlans, liabilities, assets, healthProfile, things, documents, warranties, receipts, certificates, importantRecords]);

  const getGoalTitleById = (id?: string) => {
    if (!id) return 'Independent';
    const g = goals.find(goal => goal.id === id);
    if (!g) return 'Strategic Objective';
    const lvl = getGoalLevel(g);
    const levelLabel = ['Main', 'Sub', 'Micro', 'Nano', 'Atomic'][lvl - 1] || 'Goal';
    return `Level ${lvl} ${levelLabel}: ${g.title}`;
  };

  return (
    <div className="goals-view space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
          Goals & Strategy
        </h1>
        <GoalsSectionSwitcher
          activeSection={activeTab}
          counts={{ goals: goals.length, strategies: strategies.length, milestones: milestones.length, kpis: kpis.length, missions: missions.length }}
          delayedCount={totalDelays}
          onSelectSection={section => {
            setActiveTab(section);
            if (section === 'goals') setGoalFormOpen(true);
          }}
        />
      </div>

      {/* Validation / storage error banner (local, because onSuccess is a success channel) */}
      {formError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
        >
          <span className="min-w-0 break-words">{formError}</span>
          <button
            type="button"
            onClick={() => setFormError(null)}
            aria-label="Dismiss error"
            className="shrink-0 rounded-md p-0.5 text-rose-500 hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-900/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Delayed Tasks Alert Banner in GoalsView */}
      {(() => {
        if (totalDelays > 0 && activeTab !== 'timeline') {
          return (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border-2 border-rose-500/40 bg-gradient-to-r from-rose-500/15 via-rose-500/10 to-amber-500/15 p-4 dark:border-rose-900/60 dark:bg-rose-950/30">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-xs">
                  <span className="h-2.5 w-2.5 rounded-full bg-white animate-ping" />
                </span>
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-600/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                    <span>Cross-System Delay Alert</span>
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                    {totalDelays} {totalDelays === 1 ? 'item is delayed' : 'items are delayed'} across Deliverables, Milestones, Routines, and Tasks!
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {delayCounts.tasks} tasks, {delayCounts.milestones} milestones, and {delayCounts.routines} routines behind schedule. Open timeline for Task Genesis & Alarms.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('timeline')}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-500 active:scale-95 transition-all cursor-pointer shrink-0"
              >
                <span>Open Timeline & Alarms</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          );
        }
        return null;
      })()}


      {/* Tab 0: Timeline & Delay Alarms */}
      {activeTab === 'timeline' && (
        <TimelinePlan
          goals={goals}
          milestones={milestones}
          tasks={tasks}
          learningItems={learningItems}
          skills={skills}
          routines={routines}
          habits={habits}
          habitLogs={habitLogs}
          reminders={reminders}
          transactions={transactions}
          loans={loans}
          investments={investments}
          savingsPlans={savingsPlans}
          liabilities={liabilities}
          assets={assets}
          appointments={appointments}
          meetings={meetings}
          notes={notes}
          journal={journal}
          people={people}
          onRefresh={onRefresh}
          onSuccess={onSuccess}
        />
      )}

      {/* Tab 1: Strategic Goals with 3-Tier Hierarchy & Linked Progress */}
      {activeTab === 'goals' && (
        <div className="space-y-6">
          <div className="goal-entry-layout grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            {goalFormOpen && <div ref={goalFormRef} className={`goal-form-container flex flex-col ${goals.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
              <div className="flex-1 rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <Plus className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                    <h2 className="min-w-0 text-sm font-bold text-slate-900 dark:text-white">
                      {goalLevel === 1
                        ? 'Add Strategic Main Goal (Level 1)'
                        : goalLevel === 2
                        ? 'Add Sub Goal (Level 2)'
                        : goalLevel === 3
                        ? 'Add Micro Goal (Level 3)'
                        : goalLevel === 4
                        ? 'Add Nano Goal (Level 4)'
                        : 'Add Atomic Goal (Level 5)'}
                    </h2>
                  </div>
                  <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                    <span className="sm:hidden">{goalLevel}/5</span>
                    <span className="hidden sm:inline">Tier {goalLevel} of 5</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setGoalFormOpen(false)}
                    aria-label="Close goal form"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleAddGoal} className="mt-4 space-y-3.5">
                  {/* Goal Level Selector (5 Branches) */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                      Hierarchy Level (5 Branches)
                    </label>
                    <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Hierarchy Level">
                      {([
                        [1, 'Main', 'Main Goal (Level 1)'],
                        [2, 'Sub', 'Sub Goal (Level 2)'],
                        [3, 'Micro', 'Micro Goal (Level 3)'],
                        [4, 'Nano', 'Nano Goal (Level 4)'],
                        [5, 'Atomic', 'Atomic Goal (Level 5)']
                      ] as const).map(([lvl, label, title]) => (
                        <button
                          key={lvl}
                          type="button"
                          role="radio"
                          aria-checked={goalLevel === lvl}
                          onClick={() => selectGoalLevel(lvl)}
                          className={`rounded-lg px-1 py-2 text-center text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                            goalLevel === lvl
                              ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-400 dark:bg-indigo-950/60 dark:text-indigo-300 dark:ring-indigo-500'
                              : 'text-slate-600 hover:text-indigo-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-indigo-300 dark:hover:bg-slate-800'
                          }`}
                          title={title}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Parent Selector for Levels 2, 3, 4, 5 */}
                  {goalLevel > 1 && (() => {
                    const parentChoices = sortGoals(goals.filter(g => getGoalLevel(g) === goalLevel - 1));

                    const themeConfig = {
                      border: 'border-indigo-200/80 dark:border-indigo-900/60',
                      bg: 'bg-indigo-50/50 dark:bg-indigo-950/20',
                      text: 'text-indigo-800 dark:text-indigo-300',
                      input: 'border-indigo-300 dark:border-indigo-700'
                    };

                    return (
                      <div className={`rounded-xl border ${themeConfig.border} ${themeConfig.bg} p-2.5`}>
                        <label className={`block text-[11px] font-bold ${themeConfig.text}`}>
                          Link to Parent Goal (Level {goalLevel - 1}) *
                        </label>
                        <select
                          required
                          value={goalParentId}
                          onChange={e => {
                            setGoalParentId(e.target.value);
                            const p = goals.find(g => g.id === e.target.value);
                            if (p?.category) setGoalCategory(p.category);
                          }}
                          className={`mt-1 h-9 w-full rounded-lg border ${themeConfig.input} bg-white px-2.5 text-xs text-slate-900 dark:bg-slate-800 dark:text-white cursor-pointer`}
                        >
                          {parentChoices.length === 0 ? (
                            <option value="">No eligible parent goals found. Please create a higher-level goal first!</option>
                          ) : (
                            parentChoices.map(p => {
                              const lvl = getGoalLevel(p);
                              const prefix = `L${lvl} ${['Main', 'Sub', 'Micro', 'Nano', 'Atomic'][lvl - 1] || 'Goal'}: `;
                              return (
                                <option key={p.id} value={p.id}>
                                  {hierarchySequenceById.get(p.id) || ''} {prefix}{p.title} ({p.progress}%)
                                </option>
                              );
                            })
                          )}
                        </select>
                      </div>
                    );
                  })()}

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {goalLevel === 1
                        ? 'Main Goal Title (Level 1)'
                        : goalLevel === 2
                        ? 'Sub Goal Title (Level 2)'
                        : goalLevel === 3
                        ? 'Micro Goal Title (Level 3)'
                        : goalLevel === 4
                        ? 'Nano Goal Title (Level 4)'
                        : 'Atomic Goal Title (Level 5)'}
                    </label>
                    <input
                      type="text"
                      required
                      value={goalTitle}
                      onChange={e => setGoalTitle(e.target.value)}

                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        Category
                      </label>
                      <select
                        value={goalCategory}
                        onChange={e => setGoalCategory(e.target.value)}
                        className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        <option value="Career">Career & Work</option>
                        <option value="Finance">Finance & Net Worth</option>
                        <option value="Health">Health & Fitness</option>
                        <option value="Learning">Learning & Mastery</option>
                        <option value="Spiritual">Spiritual / Life Alignment</option>
                        <option value="Relationships">Relationships</option>
                        <option value="Creative">Creative</option>
                        <option value="Social">Social</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        Target Date
                      </label>
                      <ThemedDateTimeInput
                        type="date"
                        value={targetDate}
                        onChange={e => setTargetDate(e.target.value)}
                        className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block whitespace-nowrap text-[9px] leading-4 font-semibold text-slate-600 dark:text-slate-300">
                        Order
                      </label>
                      <input
                        type="number"
                        min="1"

                        value={goalOrder}
                        onChange={e => setGoalOrder(e.target.value)}
                        className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        title="Optional position among goals at the same hierarchy level"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Description & Tactical Scope (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={goalDescription}
                      onChange={e => setGoalDescription(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  {goalLevel >= 3 && (
                    <div>
                      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                        <span>Starting Progress</span>
                        <span className="font-mono font-bold">{goalProgress}%</span>
                      </div>
                      <input
                        id="goal-starting-progress"
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={goalProgress}
                        onChange={e => setGoalProgress(Number(e.target.value))}
                        aria-label="Starting Progress"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={goalProgress}
                        aria-valuetext={`${goalProgress}%`}
                        className="mt-1.5 h-2 w-full cursor-pointer accent-indigo-600"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    className="life-form-submit w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-indigo-500 cursor-pointer"
                  >
                    {goalLevel === 1
                      ? 'Save Main Goal (Level 1)'
                      : goalLevel === 2
                      ? 'Save Sub Goal (Level 2)'
                      : goalLevel === 3
                      ? 'Save Micro Goal (Level 3)'
                      : goalLevel === 4
                      ? 'Save Nano Goal (Level 4)'
                      : 'Save Atomic Goal (Level 5)'}
                  </button>
                </form>
              </div>
            </div>}

            {goals.length > 0 && <div className={`flex flex-col ${goalFormOpen ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
              <div className="goal-portfolio-shell flex-1 rounded-2xl border border-slate-200/80 bg-white p-3 sm:p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
                <div className="space-y-3 border-b border-slate-100 pb-3.5 dark:border-slate-800">
                  {/* Top Row: Title on Left, Hierarchy Counts on Right (Full Width) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 w-full">
                    <div className="flex items-center gap-2 min-w-0">
                      <Target className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        Strategic Goals Portfolio ({goals.length})
                      </h2>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
                      <span className="font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">{mainGoals.length} Main</span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">{subGoals.length} Sub</span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">{microGoals.length} Micro</span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">{nanoGoals.length} Nano</span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">{atomicGoals.length} Atomic</span>
                      </div>
                      <FormDisclosureToggle
                        label={goalLevel === 1 ? 'Add Strategic Main Goal' : goalLevel === 2 ? 'Add Sub Goal' : goalLevel === 3 ? 'Add Micro Goal' : goalLevel === 4 ? 'Add Nano Goal' : 'Add Atomic Goal'}
                        openLabel="Close Goal Form"
                        compactLabel="Add Goal"
                        compactOpenLabel="Close"
                        isOpen={goalFormOpen}
                        onToggle={() => setGoalFormOpen(open => !open)}
                        icon={<Plus className="h-3.5 w-3.5" />}
                      />
                    </div>
                  </div>

                  {/* Bottom Row: Tree/Flat Toggle + Level Filter Stretched Full Width End-to-End */}
                  <div className="goal-portfolio-controls flex flex-wrap items-center gap-x-5 gap-y-1 w-full">
                    {/* Tree View / Flat View Toggle (4 cols) */}
                    <div className="flex items-center justify-start gap-2 text-xs" role="radiogroup" aria-label="View mode">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={goalViewMode === 'tree'}
                        onClick={() => setGoalViewMode('tree')}
                        className={`flex items-center justify-center rounded-md px-1.5 py-1.5 font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                          goalViewMode === 'tree'
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                            : 'text-slate-600 hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-300'
                        }`}
                      >
                        <span>Tree</span>
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={goalViewMode === 'flat'}
                        onClick={() => setGoalViewMode('flat')}
                        className={`flex items-center justify-center rounded-md px-1.5 py-1.5 font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                          goalViewMode === 'flat'
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                            : 'text-slate-600 hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-300'
                        }`}
                      >
                        <span>Flat</span>
                      </button>
                    </div>

                    {/* Level Filter: All | Main | Sub | Micro | Nano | Atomic (8 cols) */}
                    <div className="flex items-center justify-start gap-1 overflow-x-auto text-xs" role="radiogroup" aria-label="Filter by level">
                      {(['all', '1', '2', '3', '4', '5'] as const).map(lvl => (
                        <React.Fragment key={lvl}>
                          {lvl !== 'all' && <span aria-hidden="true" className="shrink-0 text-slate-300 dark:text-slate-600">·</span>}
                          <button
                            type="button"
                            role="radio"
                            aria-checked={levelFilter === lvl}
                            onClick={() => {
                              setLevelFilter(lvl);
                              // The tree view only renders Level 1 branches, so a deeper filter
                              // would show an empty tree. Switch to the flat list instead.
                              if (lvl !== 'all' && lvl !== '1') setGoalViewMode('flat');
                            }}
                            className={`shrink-0 rounded-md px-1.5 py-1.5 text-[10px] sm:text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                              levelFilter === lvl
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                                : 'text-slate-600 hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-300'
                            }`}
                          >
                            {lvl === 'all'
                              ? 'All'
                              : lvl === '1'
                              ? 'Main'
                              : lvl === '2'
                              ? 'Sub'
                              : lvl === '3'
                              ? 'Micro'
                              : lvl === '4'
                              ? 'Nano'
                              : 'Atomic'}
                          </button>
                        </React.Fragment>
                      ))}
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-1 text-xs" role="radiogroup" aria-label="Filter by status">
                      {(['all', 'active', 'completed'] as const).map(s => (
                        <button
                          key={s}
                          type="button"
                          role="radio"
                          aria-checked={statusFilter === s}
                          onClick={() => setStatusFilter(s)}
                          className={`shrink-0 rounded-md px-1.5 py-1.5 text-[10px] sm:text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap capitalize ${
                            statusFilter === s
                              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                              : 'text-slate-600 hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-300'
                          }`}
                        >
                          {s === 'all' ? 'All Status' : s}
                        </button>
                      ))}
                    </div>

                    {/* Action buttons: Bulk Select, Export */}
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        type="button"
                        onClick={() => { if (bulkMode) exitBulkMode(); else setBulkMode(true); }}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] sm:text-xs font-semibold transition-colors cursor-pointer ${
                          bulkMode
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                        title="Toggle bulk selection mode"
                      >
                        <CheckSquare className="h-3 w-3" />
                        <span className="hidden sm:inline">{bulkMode ? 'Exit Bulk' : 'Bulk'}</span>
                      </button>
                      <ProgressiveActions label="Export goals">
                        <button
                          type="button"
                          onClick={handleExportJSON}
                          className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer"
                        >
                          <Download className="h-3 w-3" /> Export JSON
                        </button>
                        <button
                          type="button"
                          onClick={handleExportCSV}
                          className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer"
                        >
                          <Download className="h-3 w-3" /> Export CSV
                        </button>
                      </ProgressiveActions>
                    </div>
                  </div>

                  {/* Search input */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search goals by title, description, or category..."
                      aria-label="Search goals"
                      className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        aria-label="Clear search"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Bulk actions toolbar */}
                  {bulkMode && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/50 px-3 py-2 text-xs dark:border-indigo-800 dark:bg-indigo-950/30">
                      <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                        {selectedGoalIds.size} selected
                      </span>
                      <button
                        type="button"
                        disabled={selectedGoalIds.size === 0}
                        onClick={handleBulkDelete}
                        className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" /> Delete Selected
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSelectedGoalIds(new Set(goals.map(g => g.id))); }}
                        className="rounded-md px-2 py-1 font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={exitBulkMode}
                        className="rounded-md px-2 py-1 font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-4">
                  {goals.length === 0 ? (
                    <EmptyState
                      icon={Target}
                      title="No strategic goals yet"
                      hint="Register your first Main Goal with the form above - sub-goals, milestones and progress rollups build from there."
                    />
                  ) : goalViewMode === 'tree' ? (
                    /* 5-TIER HIERARCHY TREE VIEW */
                    <div role="tree" aria-label="Goal hierarchy">
                    {mainGoals.filter(g => (levelFilter === 'all' || levelFilter === '1') && goalTreeMatchesFilter(g.id)).length === 0 && (
                      <EmptyState
                        icon={FolderTree}
                        compact
                        title="No goals match this filter"
                        hint="Switch to Flat view or pick 'All' to see the full portfolio."
                      />
                    )}
                    {mainGoals
                      .filter(g => (levelFilter === 'all' || levelFilter === '1') && goalTreeMatchesFilter(g.id))
                      .map((mainGoal, mainIndex) => {
                        const childSubGoals = getSubGoalsOf(mainGoal.id);
                        const isMainCollapsed = Boolean(collapsedGoalIds[mainGoal.id]);
                        const totalDescendantMicro = childSubGoals.reduce(
                          (acc, s) => acc + getMicroGoalsOf(s.id).length,
                          0
                        );
                        const mainSeqBadge = hierarchySequenceById.get(mainGoal.id) || String(mainIndex + 1);

                        return (
                          <div
                            key={mainGoal.id}
                            role="treeitem"
                            aria-expanded={childSubGoals.length > 0 ? !isMainCollapsed : undefined}
                            aria-label={mainGoal.title}
                            className="goal-tree-card goal-tree-card--main group rounded-2xl border border-slate-200/90 bg-white p-2.5 sm:p-5 shadow-xs hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-slate-700 transition-all space-y-2.5 sm:space-y-3 min-w-0"
                          >
                            {/* LEVEL 1: MAIN GOAL HEADER */}
                            <div className="space-y-1.5 min-w-0">
                              <div className="flex flex-wrap items-center justify-between gap-y-1.5 gap-x-2 min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 min-w-0">
                                  <span className="inline-flex items-center rounded-md bg-indigo-100/90 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-bold text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800/60 shrink-0 whitespace-nowrap">
                                    {mainSeqBadge}
                                  </span>
                                  <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/50 shrink-0 whitespace-nowrap">
                                    <Target className="h-3 w-3 shrink-0" />
                                    Main Goal
                                  </span>
                                  <span className="text-slate-300 dark:text-slate-700 shrink-0">·</span>
                                  <span className="font-medium text-slate-700 dark:text-slate-300 shrink-0 whitespace-nowrap">
                                    {mainGoal.category || 'General'}
                                  </span>
                                  {mainGoal.targetDate && (() => {
                                    const isPastTarget = mainGoal.targetDate < todayDate && mainGoal.progress < 100;
                                    return (
                                    <>
                                      <span className="text-slate-300 dark:text-slate-700 shrink-0">·</span>
                                      <span className={`shrink-0 whitespace-nowrap text-[11px] sm:text-xs ${isPastTarget ? 'text-rose-500 font-bold' : ''}`}>
                                        {isPastTarget ? 'Overdue' : 'Target'} {mainGoal.targetDate}
                                      </span>
                                    </>
                                    );
                                  })()}
                                  <span className="text-slate-300 dark:text-slate-700 shrink-0">·</span>
                                  <span className="inline-flex items-center gap-1 font-medium shrink-0 whitespace-nowrap">
                                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${mainGoal.progress >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                                    <span className={mainGoal.progress >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}>
                                      {mainGoal.progress >= 100 ? 'Completed' : 'Active'}
                                    </span>
                                  </span>
                                </div>

                                {/* Action controls */}
                                <div className="flex items-center gap-1 shrink-0 ml-auto">
                                  <button
                                    type="button"
                                    onClick={() => startAddSubGoal(mainGoal)}
                                    className="inline-flex items-center gap-1 rounded-md border border-indigo-200/80 bg-indigo-50/70 px-2 py-0.5 text-[11px] sm:text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800/80 dark:bg-indigo-950/50 dark:text-indigo-300 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                                    title="Add Level 2 Sub Goal"
                                  >
                                    <Plus className="h-3 w-3 shrink-0" />
                                    <span>Sub Goal</span>
                                  </button>
                                  <ProgressiveActions label={`More actions for ${mainGoal.title}`}>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveGoalOrder(mainGoal, 'up')}
                                    className="p-1 sm:p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer shrink-0"
                                    title="Move Up"
                                  >
                                    <ArrowUp className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveGoalOrder(mainGoal, 'down')}
                                    className="p-1 sm:p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer shrink-0"
                                    title="Move Down"
                                  >
                                    <ArrowDown className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingGoal(mainGoal)}
                                    className="p-1 sm:p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer shrink-0"
                                    title="Edit Main Goal"
                                  >
                                    <Edit2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteTarget({ store: 'goals', id: mainGoal.id, name: mainGoal.title })}
                                    className="p-1 sm:p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors cursor-pointer shrink-0"
                                    title="Delete Main Goal and sub goals"
                                  >
                                    <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                  </button>
                                  </ProgressiveActions>
                              </div>

                              <h3 className="w-full text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug break-words">
                                {mainGoal.title}
                              </h3>

                              {mainGoal.description && (
                                <p className="w-full text-xs text-slate-500 dark:text-slate-400 leading-relaxed break-words">
                                  {mainGoal.description}
                                </p>
                              )}
                              </div>
                            </div>

                            {/* MAIN GOAL LINKED PROGRESS BAR & REAL-TIME BREAKDOWN */}
                            <GoalLinkedBreakdownWidget
                              goal={mainGoal}
                              breakdown={getGoalBreakdown(mainGoal.id)}
                              isExpanded={Boolean(expandedBreakdownGoalIds[mainGoal.id])}
                              onToggleExpand={() => toggleBreakdown(mainGoal.id)}
                              onQuickToggleTask={handleQuickToggleTask}
                              onQuickToggleMilestone={handleQuickToggleMilestone}
                              onQuickToggleAppointment={handleQuickToggleAppointment}
                              onQuickToggleMeeting={handleQuickToggleMeeting}
                              onAdjustManualProgress={(delta) => handleProgressChange(mainGoal, delta)}
                            />

                            {/* SUB-GOALS ACCORDION TRIGGER */}
                            {childSubGoals.length > 0 && (
                              <div className="flex flex-wrap items-center justify-between gap-1 pt-2 pb-0.5 border-t border-slate-100 dark:border-slate-800/80 min-w-0">
                                <button
                                  type="button"
                                  aria-expanded={!isMainCollapsed}
                                  onClick={() => toggleCollapse(mainGoal.id)}
                                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer py-0.5 shrink-0"
                                >
                                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 shrink-0 ${isMainCollapsed ? '-rotate-90' : ''}`} />
                                  <span>Sub Goals ({childSubGoals.length})</span>
                                  {totalDescendantMicro > 0 && (
                                    <span className="text-slate-400 font-normal hidden sm:inline">· {totalDescendantMicro} micro</span>
                                  )}
                                </button>
                                <span className="text-[11px] sm:text-xs text-slate-400 shrink-0 whitespace-nowrap ml-auto">
                                  {childSubGoals.filter(s => s.progress >= 100).length} of {childSubGoals.length} completed
                                </span>
                              </div>
                            )}

                            {/* LEVEL 2: SUB GOALS CONTAINER */}
                            {!isMainCollapsed && childSubGoals.length > 0 && (
                              <div role="group" aria-label="Sub goals" className="ml-0 pl-1 sm:ml-0 sm:pl-1 border-l sm:border-l-2 border-slate-200 dark:border-slate-800 space-y-2 pt-1 min-w-0">
                                {childSubGoals.map((subGoal, subIndex) => {
                                  const childMicroGoals = getMicroGoalsOf(subGoal.id);
                                  const isSubCollapsed = Boolean(collapsedGoalIds[subGoal.id]);
                                  const subSeqBadge = hierarchySequenceById.get(subGoal.id) || `${mainSeqBadge}.${subIndex + 1}`;

                                  return (
                                    <div
                                      key={subGoal.id}
                                      role="treeitem"
                                      aria-expanded={childMicroGoals.length > 0 ? !isSubCollapsed : undefined}
                                      aria-label={subGoal.title}
                                      className="goal-tree-card goal-tree-card--sub rounded-xl border border-slate-200/80 bg-slate-50/50 p-1.5 sm:p-2 dark:border-slate-800 dark:bg-slate-800/30 space-y-2 sm:space-y-2.5 transition-all min-w-0 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700"
                                    >
                                      {/* Sub Goal Header */}
                                      <div className="space-y-1 min-w-0">
                                        <div className="flex flex-wrap items-center justify-between gap-y-1.5 gap-x-2 min-w-0">
                                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 min-w-0">
                                            <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0 whitespace-nowrap">
                                              {subSeqBadge}
                                            </span>
                                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0 whitespace-nowrap">
                                              Sub Goal
                                            </span>
                                            {subGoal.targetDate && (() => {
                                              const isPastSub = subGoal.targetDate < todayDate && subGoal.progress < 100;
                                              return (
                                              <>
                                                <span className="text-slate-300 dark:text-slate-700 shrink-0">·</span>
                                                <span className={`shrink-0 whitespace-nowrap text-[11px] sm:text-xs ${isPastSub ? 'text-rose-500 font-bold' : ''}`}>{isPastSub ? 'Overdue' : 'Due'} {subGoal.targetDate}</span>
                                              </>
                                              );
                                            })()}
                                          </div>

                                          <div className="flex flex-wrap items-center justify-end gap-1 min-w-0 ml-auto">
                                            <button
                                              type="button"
                                              onClick={() => startAddNestedGoal(subGoal)}
                                              className="inline-flex items-center gap-1 rounded-md border border-indigo-200/80 bg-indigo-50/70 px-2 py-0.5 text-[11px] sm:text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800/80 dark:bg-indigo-950/50 dark:text-indigo-300 cursor-pointer transition-colors shrink-0 whitespace-nowrap"
                                              title="Add Level 3 Micro Goal"
                                            >
                                              <Plus className="h-3 w-3 shrink-0" />
                                              <span>Micro Goal</span>
                                            </button>
                                            <ProgressiveActions label={`More actions for ${subGoal.title}`}>
                                            <button
                                              type="button"
                                              onClick={() => handleMoveGoalOrder(subGoal, 'up')}
                                              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-200/50 dark:hover:bg-slate-700 cursor-pointer shrink-0"
                                              title="Move Up"
                                            >
                                              <ArrowUp className="h-3 w-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleMoveGoalOrder(subGoal, 'down')}
                                              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-200/50 dark:hover:bg-slate-700 cursor-pointer shrink-0"
                                              title="Move Down"
                                            >
                                              <ArrowDown className="h-3 w-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleUnlinkGoal(subGoal)}
                                              className="p-1 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-md hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer shrink-0"
                                              title="Unlink to Main Goal"
                                            >
                                              <Unlink className="h-3 w-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setEditingGoal(subGoal)}
                                              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-200/50 dark:hover:bg-slate-700 cursor-pointer shrink-0"
                                              title="Edit Sub Goal"
                                            >
                                              <Edit2 className="h-3 w-3 shrink-0" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setDeleteTarget({ store: 'goals', id: subGoal.id, name: subGoal.title })}
                                              className="p-1 text-slate-400 hover:text-rose-500 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer shrink-0"
                                              title="Delete Sub Goal"
                                            >
                                              <Trash2 className="h-3 w-3 shrink-0" />
                                            </button>
                                            </ProgressiveActions>
                                          </div>
                                        </div>

                                        <h4 className="w-full text-xs sm:text-sm font-semibold text-slate-900 dark:text-white leading-snug break-words">
                                          {subGoal.title}
                                        </h4>
                                      </div>

                                      {/* Sub Goal Linked Progress Bar & Breakdown */}
                                      <GoalLinkedBreakdownWidget
                                        goal={subGoal}
                                        breakdown={getGoalBreakdown(subGoal.id)}
                                        isExpanded={Boolean(expandedBreakdownGoalIds[subGoal.id])}
                                        onToggleExpand={() => toggleBreakdown(subGoal.id)}
                                        onQuickToggleTask={handleQuickToggleTask}
                                        onQuickToggleMilestone={handleQuickToggleMilestone}
                                        onQuickToggleAppointment={handleQuickToggleAppointment}
                                        onQuickToggleMeeting={handleQuickToggleMeeting}
                                        onAdjustManualProgress={(delta) => handleProgressChange(subGoal, delta)}
                                      />

                                      {/* LEVEL 3: MICRO GOALS ACCORDION TRIGGER */}
                                      {childMicroGoals.length > 0 && (
                                        <div className="flex flex-wrap items-center justify-between gap-1 pt-2 pb-0.5 border-t border-slate-200 dark:border-slate-800 min-w-0">
                                          <button
                                            type="button"
                                            aria-expanded={!isSubCollapsed}
                                            onClick={() => toggleCollapse(subGoal.id)}
                                            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer py-0.5 shrink-0"
                                          >
                                            <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${isSubCollapsed ? '-rotate-90' : ''}`} />
                                            <span>Micro Goals ({childMicroGoals.length})</span>
                                          </button>
                                          <span className="text-[11px] sm:text-xs text-slate-400 shrink-0 whitespace-nowrap ml-auto">
                                            {childMicroGoals.filter(m => m.progress >= 100).length} of {childMicroGoals.length} completed
                                          </span>
                                        </div>
                                      )}

                                      {/* LEVEL 3: MICRO GOALS CONTAINER */}
                                      {!isSubCollapsed && childMicroGoals.length > 0 && (
                                        <div role="group" aria-label="Micro goals" className="ml-0 pl-1 sm:ml-0 sm:pl-1 border-l sm:border-l-2 border-slate-200 dark:border-slate-800 space-y-1.5 sm:space-y-2 pt-1 min-w-0">

                                          {childMicroGoals.map((microGoal, microIndex) => {
                                            const microSeqBadge = hierarchySequenceById.get(microGoal.id) || `${subSeqBadge}.${microIndex + 1}`;
                                            const childNanoGoals = getNanoGoalsOf(microGoal.id);
                                            const isMicroCollapsed = Boolean(collapsedGoalIds[microGoal.id]);
                                            const microBreakdown = getGoalBreakdown(microGoal.id);

                                            return (
                                              <div
                                                key={microGoal.id}
                                                role="treeitem"
                                                aria-expanded={childNanoGoals.length > 0 ? !isMicroCollapsed : undefined}
                                                aria-label={microGoal.title}
                                                className="goal-tree-card goal-tree-card--micro rounded-lg border border-slate-200/80 bg-slate-50/50 p-1.5 sm:p-2 dark:border-slate-800 dark:bg-slate-800/30 space-y-1.5 sm:space-y-2 transition-all min-w-0 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700"
                                              >
                                                {/* Micro Goal Header */}
                                                <div className="space-y-1 min-w-0">
                                                  <div className="flex flex-wrap items-center justify-between gap-y-1.5 gap-x-2 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 min-w-0">
                                                      <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0 whitespace-nowrap">
                                                        {microSeqBadge}
                                                      </span>
                                                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0 whitespace-nowrap">
                                                        Micro Goal
                                                      </span>
                                                      {microGoal.targetDate && (() => {
                                                        const isPastMicro = microGoal.targetDate < todayDate && microGoal.progress < 100;
                                                        return (
                                                        <>
                                                          <span className="text-slate-300 dark:text-slate-700 shrink-0">·</span>
                                                          <span className={`shrink-0 whitespace-nowrap text-[11px] sm:text-xs ${isPastMicro ? 'text-rose-500 font-bold' : ''}`}>{isPastMicro ? 'Overdue' : 'Due'} {microGoal.targetDate}</span>
                                                        </>
                                                        );
                                                      })()}
                                                    </div>

                                                    <div className="flex flex-wrap items-center justify-end gap-1 min-w-0 ml-auto">
                                                      <button
                                                        type="button"
                                                        onClick={() => startAddChildGoal(microGoal, 4)}
                                                        className="inline-flex items-center gap-1 rounded-md border border-indigo-200/80 bg-indigo-50/70 px-2 py-0.5 text-[11px] sm:text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800/80 dark:bg-indigo-950/50 dark:text-indigo-300 cursor-pointer transition-colors shrink-0 whitespace-nowrap"
                                                        title="Add Level 4 Nano Goal"
                                                      >
                                                        <Plus className="h-3 w-3 shrink-0" />
                                                        <span>Nano Goal</span>
                                                      </button>
                                                      <ProgressiveActions label={`More actions for ${microGoal.title}`}>
                                                      <button
                                                        type="button"
                                                        onClick={() => handleMoveGoalOrder(microGoal, 'up')}
                                                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-200/50 dark:hover:bg-slate-700 cursor-pointer shrink-0"
                                                        title="Move Up"
                                                      >
                                                        <ArrowUp className="h-3 w-3" />
                                                      </button>
                                                      <button
                                                        type="button"
                                                        onClick={() => handleMoveGoalOrder(microGoal, 'down')}
                                                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-200/50 dark:hover:bg-slate-700 cursor-pointer shrink-0"
                                                        title="Move Down"
                                                      >
                                                        <ArrowDown className="h-3 w-3" />
                                                      </button>
                                                      <button
                                                        type="button"
                                                        onClick={() => handleUnlinkGoal(microGoal)}
                                                        className="p-1 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-md hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer shrink-0"
                                                        title="Unlink to Main Goal"
                                                      >
                                                        <Unlink className="h-3 w-3" />
                                                      </button>
                                                      <button
                                                        type="button"
                                                        onClick={() => setEditingGoal(microGoal)}
                                                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-200/50 dark:hover:bg-slate-700 cursor-pointer shrink-0"
                                                        title="Edit Micro Goal"
                                                      >
                                                        <Edit2 className="h-3 w-3 shrink-0" />
                                                      </button>
                                                      <button
                                                        type="button"
                                                        onClick={() => setDeleteTarget({ store: 'goals', id: microGoal.id, name: microGoal.title })}
                                                        className="p-1 text-slate-400 hover:text-rose-500 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer shrink-0"
                                                        title="Delete Micro Goal"
                                                      >
                                                        <Trash2 className="h-3 w-3 shrink-0" />
                                                      </button>
                                                      </ProgressiveActions>
                                                    </div>
                                                  </div>

                                                  <h5 className="w-full text-xs sm:text-sm font-semibold text-slate-900 dark:text-white leading-snug break-words">
                                                    {microGoal.title}
                                                  </h5>
                                                </div>

                                                {/* Micro Goal Linked Breakdown */}
                                                <GoalLinkedBreakdownWidget
                                                  goal={microGoal}
                                                  breakdown={microBreakdown}
                                                  isExpanded={Boolean(expandedBreakdownGoalIds[microGoal.id])}
                                                  onToggleExpand={() => toggleBreakdown(microGoal.id)}
                                                  onQuickToggleTask={handleQuickToggleTask}
                                                  onQuickToggleMilestone={handleQuickToggleMilestone}
                                                  onQuickToggleAppointment={handleQuickToggleAppointment}
                                                  onQuickToggleMeeting={handleQuickToggleMeeting}
                                                  onAdjustManualProgress={(delta) => handleProgressChange(microGoal, delta)}
                                                />

                                                {/* LEVEL 4: NANO GOALS ACCORDION */}
                                                {childNanoGoals.length > 0 && (
                                                  <div className="pt-1 border-t border-slate-200 dark:border-slate-800">
                                                    <button
                                                      type="button"
                                                      aria-expanded={!isMicroCollapsed}
                                                      onClick={() => toggleCollapse(microGoal.id)}
                                                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer py-0.5 shrink-0"
                                                    >
                                                      <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${isMicroCollapsed ? '-rotate-90' : ''}`} />
                                                      <span>Nano Goals ({childNanoGoals.length})</span>
                                                    </button>

                                                    {!isMicroCollapsed && (
                                                      <div role="group" aria-label="Nano goals" className="ml-0 pl-1 sm:ml-0 sm:pl-1 border-l sm:border-l-2 border-slate-200 dark:border-slate-800 space-y-1 sm:space-y-1.5 pt-1 min-w-0">
                                                        {childNanoGoals.map((nanoGoal, nanoIndex) => {
                                                          const nanoSeqBadge = hierarchySequenceById.get(nanoGoal.id) || `${microSeqBadge}.${nanoIndex + 1}`;
                                                          const childAtomicGoals = getAtomicGoalsOf(nanoGoal.id);
                                                          const isNanoCollapsed = Boolean(collapsedGoalIds[nanoGoal.id]);
                                                          const nanoBreakdown = getGoalBreakdown(nanoGoal.id);

                                                          return (
                                                            <div
                                                              key={nanoGoal.id}
                                                              role="treeitem"
                                                              aria-expanded={childAtomicGoals.length > 0 ? !isNanoCollapsed : undefined}
                                                              aria-label={nanoGoal.title}
                                                              className="goal-tree-card goal-tree-card--nano rounded-lg border border-slate-200/80 bg-slate-50/50 p-1 sm:p-1.5 dark:border-slate-800 dark:bg-slate-800/30 space-y-1 sm:space-y-1.5 transition-all min-w-0 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700"
                                                            >
                                                              {/* Nano Goal Header */}
                                                              <div className="space-y-1 min-w-0">
                                                                <div className="flex flex-wrap items-center justify-between gap-y-1.5 gap-x-2 min-w-0">
                                                                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 min-w-0">
                                                                    <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0 whitespace-nowrap">
                                                                      {nanoSeqBadge}
                                                                    </span>
                                                                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0 whitespace-nowrap">
                                                                      Nano Goal
                                                                    </span>
                                                                    {nanoGoal.targetDate && (() => {
                                                                      const isPastNano = nanoGoal.targetDate < todayDate && nanoGoal.progress < 100;
                                                                      return (
                                                                      <>
                                                                        <span className="text-slate-300 dark:text-slate-700 shrink-0">·</span>
                                                                        <span className={`shrink-0 whitespace-nowrap text-[11px] sm:text-xs ${isPastNano ? 'text-rose-500 font-bold' : ''}`}>{isPastNano ? 'Overdue' : 'Due'} {nanoGoal.targetDate}</span>
                                                                      </>
                                                                      );
                                                                    })()}
                                                                  </div>

                                                                  <div className="flex flex-wrap items-center justify-end gap-1 min-w-0 ml-auto">
                                                                    <button
                                                                      type="button"
                                                                      onClick={() => startAddChildGoal(nanoGoal, 5)}
                                                                      className="inline-flex items-center gap-1 rounded-md border border-indigo-200/80 bg-indigo-50/70 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800/80 dark:bg-indigo-950/50 dark:text-indigo-300 cursor-pointer transition-colors shrink-0 whitespace-nowrap"
                                                                      title="Add Level 5 Atomic Goal"
                                                                    >
                                                                      <Plus className="h-3 w-3 shrink-0" />
                                                                      <span>Atomic Goal</span>
                                                                    </button>
                                                                    <ProgressiveActions label={`More actions for ${nanoGoal.title}`}>
                                                                    <button
                                                                      type="button"
                                                                      onClick={() => handleMoveGoalOrder(nanoGoal, 'up')}
                                                                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-200/50 dark:hover:bg-slate-700 cursor-pointer shrink-0"
                                                                      title="Move Up"
                                                                    >
                                                                      <ArrowUp className="h-3 w-3" />
                                                                    </button>
                                                                    <button
                                                                      type="button"
                                                                      onClick={() => handleMoveGoalOrder(nanoGoal, 'down')}
                                                                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-200/50 dark:hover:bg-slate-700 cursor-pointer shrink-0"
                                                                      title="Move Down"
                                                                    >
                                                                      <ArrowDown className="h-3 w-3" />
                                                                    </button>
                                                                    <button
                                                                      type="button"
                                                                      onClick={() => handleUnlinkGoal(nanoGoal)}
                                                                      className="p-1 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-md hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer shrink-0"
                                                                      title="Unlink to Main Goal"
                                                                    >
                                                                      <Unlink className="h-3 w-3" />
                                                                    </button>
                                                                    <button
                                                                      type="button"
                                                                      onClick={() => setEditingGoal(nanoGoal)}
                                                                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-200/50 dark:hover:bg-slate-700 cursor-pointer shrink-0"
                                                                      title="Edit Nano Goal"
                                                                    >
                                                                      <Edit2 className="h-3 w-3 shrink-0" />
                                                                    </button>
                                                                    <button
                                                                      type="button"
                                                                      onClick={() => setDeleteTarget({ store: 'goals', id: nanoGoal.id, name: nanoGoal.title })}
                                                                      className="p-1 text-slate-400 hover:text-rose-500 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer shrink-0"
                                                                      title="Delete Nano Goal"
                                                                    >
                                                                      <Trash2 className="h-3 w-3 shrink-0" />
                                                                    </button>
                                                                    </ProgressiveActions>
                                                                  </div>
                                                                </div>

                                                                <h6 className="w-full text-xs font-semibold text-slate-900 dark:text-white leading-snug break-words">
                                                                  {nanoGoal.title}
                                                                </h6>
                                                              </div>

                                                              {/* Nano Goal Progress Widget */}
                                                              <GoalLinkedBreakdownWidget
                                                                goal={nanoGoal}
                                                                breakdown={nanoBreakdown}
                                                                isExpanded={Boolean(expandedBreakdownGoalIds[nanoGoal.id])}
                                                                onToggleExpand={() => toggleBreakdown(nanoGoal.id)}
                                                                onQuickToggleTask={handleQuickToggleTask}
                                                                onQuickToggleMilestone={handleQuickToggleMilestone}
                                                                onQuickToggleAppointment={handleQuickToggleAppointment}
                                                                onQuickToggleMeeting={handleQuickToggleMeeting}
                                                                onAdjustManualProgress={(delta) => handleProgressChange(nanoGoal, delta)}
                                                              />

                                                              {/* LEVEL 5: ATOMIC GOALS CONTAINER */}
                                                              {childAtomicGoals.length > 0 && (
                                                                <div className="pt-1 border-t border-slate-200 dark:border-slate-800">
                                                                  <button
                                                                    type="button"
                                                                    aria-expanded={!isNanoCollapsed}
                                                                    onClick={() => toggleCollapse(nanoGoal.id)}
                                                                    className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer py-0.5 shrink-0"
                                                                  >
                                                                    <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform duration-200 shrink-0 ${isNanoCollapsed ? '-rotate-90' : ''}`} />
                                                                    <span>Atomic Goals ({childAtomicGoals.length})</span>
                                                                  </button>

                                                                  {!isNanoCollapsed && (
                                                                    <div role="group" aria-label="Atomic goals" className="ml-0 pl-1 sm:ml-0 sm:pl-1 border-l sm:border-l-2 border-slate-200 dark:border-slate-800 space-y-1 pt-1 min-w-0">
                                                                      {childAtomicGoals.map((atomicGoal, atomicIndex) => {
                                                                        const atomicSeqBadge = hierarchySequenceById.get(atomicGoal.id) || `${nanoSeqBadge}.${atomicIndex + 1}`;
                                                                        const atomicBreakdown = getGoalBreakdown(atomicGoal.id);

                                                                        return (
                                                                          <div
                                                                            key={atomicGoal.id}
                                                                            role="treeitem"
                                                                            aria-label={atomicGoal.title}
                                                                            className="goal-tree-card goal-tree-card--atomic group flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 rounded-md border border-slate-200/80 bg-slate-50/50 p-1 sm:p-1.5 text-xs dark:border-slate-800 dark:bg-slate-800/30 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all min-w-0"
                                                                          >
                                                                            <div className="flex items-start sm:items-center gap-2 min-w-0 w-full sm:flex-1">
                                                                              {/* Manual completion only makes sense for atomic goals with no productive
                                                                                  linked items; otherwise progress is aggregated from those items. */}
                                                                              {atomicBreakdown.progressItemCount === 0 && (
                                                                                <button
                                                                                  type="button"
                                                                                  onClick={() =>
                                                                                    handleProgressChange(
                                                                                      atomicGoal,
                                                                                      atomicGoal.progress >= 100 ? 0 : 100,
                                                                                      true
                                                                                    )
                                                                                  }
                                                                                  className={`mt-0.5 sm:mt-0 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] font-bold transition-all cursor-pointer ${
                                                                                    atomicGoal.progress >= 100
                                                                                      ? 'border-indigo-600 bg-indigo-600 text-white'
                                                                                      : 'border-slate-300 bg-white text-transparent hover:border-indigo-500 dark:border-slate-600 dark:bg-slate-800'
                                                                                  }`}
                                                                                  title={atomicGoal.progress >= 100 ? 'Mark Incomplete' : 'Mark Complete (100%)'}
                                                                                >
                                                                                  ✓
                                                                                </button>
                                                                              )}
                                                                              <div className="min-w-0 flex-1">
                                                                                <div
                                                                                  className={`text-xs font-semibold leading-snug break-words ${
                                                                                    atomicGoal.progress >= 100
                                                                                      ? 'line-through text-slate-400 dark:text-slate-500 font-medium'
                                                                                      : 'text-slate-900 dark:text-slate-100'
                                                                                  }`}
                                                                                >
                                                                                  <span className="inline-flex items-center rounded bg-slate-100 px-1 py-0.5 text-[9px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 mr-1 shrink-0">
                                                                                    {atomicSeqBadge}
                                                                                  </span>
                                                                                  {atomicGoal.title}
                                                                                </div>
                                                                                {atomicGoal.targetDate && (
                                                                                  <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                                                                                    Due {atomicGoal.targetDate}
                                                                                  </span>
                                                                                )}
                                                                              </div>
                                                                            </div>

                                                                            <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0 w-full sm:w-auto pt-1.5 sm:pt-0 border-t border-slate-200 sm:border-t-0 dark:border-slate-800">
                                                                              {atomicBreakdown.progressItemCount > 0 ? (
                                                                                <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-400 shrink-0 whitespace-nowrap">
                                                                                  <span>{atomicGoal.progress}%</span>
                                                                                </span>
                                                                              ) : (
                                                                                <div className="flex items-center gap-0.5 shrink-0">
                                                                                  <button
                                                                                    type="button"
                                                                                    onClick={() => handleProgressChange(atomicGoal, -10)}
                                                                                    className="h-5 w-5 rounded border border-slate-200 text-xs font-bold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer shrink-0"
                                                                                    title="-10%"
                                                                                  >
                                                                                    -
                                                                                  </button>
                                                                                  <span className="font-mono text-xs font-bold w-7 text-center tabular-nums text-slate-800 dark:text-slate-200 shrink-0 whitespace-nowrap">
                                                                                    {atomicGoal.progress}%
                                                                                  </span>
                                                                                  <button
                                                                                    type="button"
                                                                                    onClick={() => handleProgressChange(atomicGoal, 10)}
                                                                                    className="h-5 w-5 rounded border border-slate-200 text-xs font-bold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer shrink-0"
                                                                                    title="+10%"
                                                                                  >
                                                                                    +
                                                                                  </button>
                                                                                </div>
                                                                              )}
                                                                              <ProgressiveActions label={`More actions for ${atomicGoal.title}`} className="shrink-0 ml-auto sm:ml-0">
                                                                                <button
                                                                                  type="button"
                                                                                  onClick={() => handleMoveGoalOrder(atomicGoal, 'up')}
                                                                                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md cursor-pointer shrink-0 hover:bg-slate-100 dark:hover:bg-slate-800"
                                                                                  title="Move Up"
                                                                                >
                                                                                  <ArrowUp className="h-3 w-3" />
                                                                                </button>
                                                                                <button
                                                                                  type="button"
                                                                                  onClick={() => handleMoveGoalOrder(atomicGoal, 'down')}
                                                                                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md cursor-pointer shrink-0 hover:bg-slate-100 dark:hover:bg-slate-800"
                                                                                  title="Move Down"
                                                                                >
                                                                                  <ArrowDown className="h-3 w-3" />
                                                                                </button>
                                                                                <button
                                                                                  type="button"
                                                                                  onClick={() => setEditingGoal(atomicGoal)}
                                                                                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md cursor-pointer shrink-0 hover:bg-slate-100 dark:hover:bg-slate-800"
                                                                                  title="Edit Atomic Goal"
                                                                                >
                                                                                  <Edit2 className="h-3 w-3 shrink-0" />
                                                                                </button>
                                                                                <button
                                                                                  type="button"
                                                                                  onClick={() =>
                                                                                    setDeleteTarget({ store: 'goals', id: atomicGoal.id, name: atomicGoal.title })
                                                                                  }
                                                                                  className="p-1 text-slate-400 hover:text-rose-500 rounded-md cursor-pointer shrink-0 hover:bg-rose-100/60 dark:hover:bg-rose-950/40"
                                                                                  title="Delete Atomic Goal"
                                                                                >
                                                                                  <Trash2 className="h-3 w-3 shrink-0" />
                                                                                </button>
                                                                              </ProgressiveActions>
                                                                            </div>
                                                                          </div>
                                                                        );
                                                                      })}
                                                                    </div>
                                                                  )}
                                                                </div>
                                                              )}
                                                            </div>
                                                          );
                                                        })}
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* FLAT LIST VIEW */
                    <>
                    {filterGoals(flatHierarchyGoals.filter(g => levelFilter === 'all' || String(getGoalLevel(g)) === levelFilter)).length === 0 && (
                      <EmptyState
                        icon={ListTree}
                        compact
                        title="No goals match this filter"
                        hint="Try a different search, level, or status filter."
                      />
                    )}
                    {filterGoals(flatHierarchyGoals
                      .filter(g => levelFilter === 'all' || String(getGoalLevel(g)) === levelFilter))
                      .map(g => {
                        const lvl = getGoalLevel(g);
                        const flatSeqBadge = hierarchySequenceById.get(g.id) || '';
                        const parent = g.parentId ? goalsById.get(g.parentId) : null;

                        return (
                          <div
                            key={g.id}
                            data-record-id={g.id}
                            draggable
                            onDragStart={e => handleDragStart(e, g.id)}
                            onDragOver={e => handleDragOver(e, g.id)}
                            onDrop={e => handleDrop(e, g.id)}
                            onDragEnd={handleDragEnd}
                            className={`rounded-2xl border bg-white p-4.5 shadow-xs transition-all hover:border-slate-300 dark:bg-slate-900 dark:hover:border-slate-700 space-y-3 ${
                              dragOverId === g.id ? 'border-indigo-400 ring-1 ring-indigo-300 dark:border-indigo-500 dark:ring-indigo-600' : 'border-slate-200/80 dark:border-slate-800'
                            }`}
                          >
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                  {bulkMode && (
                                    <button
                                      type="button"
                                      role="checkbox"
                                      aria-checked={selectedGoalIds.has(g.id)}
                                      onClick={() => toggleBulkSelect(g.id)}
                                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] font-bold transition-all cursor-pointer ${
                                        selectedGoalIds.has(g.id)
                                          ? 'border-indigo-600 bg-indigo-600 text-white'
                                          : 'border-slate-300 bg-white text-transparent hover:border-indigo-500 dark:border-slate-600 dark:bg-slate-800'
                                      }`}
                                    >
                                      ✓
                                    </button>
                                  )}
                                  <GripVertical className="h-3 w-3 shrink-0 text-slate-300 cursor-grab dark:text-slate-600" aria-hidden="true" />
                                  <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
                                    {flatSeqBadge}
                                  </span>
                                  <span
                                    className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400"
                                  >
                                    {['Main', 'Sub', 'Micro', 'Nano', 'Atomic'][lvl - 1] || 'Goal'}
                                  </span>
                                  {parent && (
                                    <>
                                      <span className="text-slate-300 dark:text-slate-700">·</span>
                                      <span className="text-slate-400 truncate max-w-[200px]">
                                        Parent: {hierarchySequenceById.get(parent.id)} {parent.title}
                                      </span>
                                    </>
                                  )}
                                  <span className="text-slate-300 dark:text-slate-700">·</span>
                                  <span className="font-medium text-slate-700 dark:text-slate-300">
                                    {g.category || 'General'}
                                  </span>
                                  {g.targetDate && (() => {
                                    const isPastFlat = g.targetDate < todayDate && g.progress < 100;
                                    return (
                                    <>
                                      <span className="text-slate-300 dark:text-slate-700">·</span>
                                      <span className={isPastFlat ? 'text-rose-500 font-bold' : ''}>{isPastFlat ? 'Overdue' : 'Target'} {g.targetDate}</span>
                                    </>
                                    );
                                  })()}
                                </div>

                                <ProgressiveActions label={`More actions for ${g.title}`} className="shrink-0 ml-auto">
                                  <button
                                    type="button"
                                    onClick={() => setEditingGoal(g)}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                    title="Edit Goal"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteTarget({ store: 'goals', id: g.id, name: g.title })}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                    title="Delete Goal"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </ProgressiveActions>
                              </div>

                              <div className="w-full text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                                {g.title}
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                              <GoalLinkedBreakdownWidget
                                goal={g}
                                breakdown={getGoalBreakdown(g.id)}
                                isExpanded={Boolean(expandedBreakdownGoalIds[g.id])}
                                onToggleExpand={() => toggleBreakdown(g.id)}
                                onQuickToggleTask={handleQuickToggleTask}
                                onQuickToggleMilestone={handleQuickToggleMilestone}
                                onQuickToggleAppointment={handleQuickToggleAppointment}
                                onQuickToggleMeeting={handleQuickToggleMeeting}
                                onAdjustManualProgress={(delta) => handleProgressChange(g, delta)}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            </div>}
          </div>
        </div>
      )}

      {/* Tab 2: Strategies & Tactics (New & Fully Implemented!) */}
      {activeTab === 'strategies' && (
        <div className="strategy-entry-layout grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className={`${strategies.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'} rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-card dark:border-slate-800/80 dark:bg-slate-900`}>
            <FormDisclosure
              defaultOpen
              label="Create a strategy"
              header={
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <Zap className="h-4 w-4 shrink-0 text-amber-500" />
                  <span>Declare Tactical Strategy</span>
                </h2>
              }
            >
            <form onSubmit={handleAddStrategy} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Strategy Initiative
                </label>
                <input
                  type="text"
                  required
                  value={stratTitle}
                  onChange={e => setStratTitle(e.target.value)}

                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Linked Strategic Goal
                </label>
                <select
                  value={stratGoalId || (goals[0]?.id ?? '')}
                  onChange={e => setStratGoalId(e.target.value)}
                  disabled={goals.length === 0}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white disabled:opacity-50"
                >
                  {goals.length === 0 ? (
                    <option value="">No strategic goals created yet</option>
                  ) : (
                    goals.map(g => (
                      <option key={g.id} value={g.id}>{g.title}</option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Tactical Action Steps
                </label>
                <textarea
                  rows={3}
                  value={stratAction}
                  onChange={e => setStratAction(e.target.value)}

                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Initiative Status
                </label>
                <select
                  value={stratStatus}
                  onChange={e => setStratStatus(e.target.value as 'active' | 'in-progress' | 'executed')}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="active">Active Execution</option>
                  <option value="in-progress">In-Progress</option>
                  <option value="executed">Executed / Mastered</option>
                </select>
              </div>

              <button
                type="submit"
                className="life-form-submit w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 cursor-pointer"
              >
                + Commit Tactical Strategy
              </button>
            </form>
            </FormDisclosure>
          </div>

          {strategies.length > 0 && (
          <div className="lg:col-span-7 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800 flex justify-between items-center">
              <span>Operational Strategies ({strategies.length})</span>
            </h2>

            <div className="mt-4 space-y-3">
              {[...strategies].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(s => (
                  <div key={s.id} className="rounded-2xl border border-slate-100 p-4 text-xs dark:border-slate-800 group transition-all hover:border-slate-200 dark:hover:border-slate-700 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
                        Goal: {getGoalTitleById(s.goalId)}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditingRecord({ type: 'strategy', item: s })}
                          className="sm:opacity-0 sm:group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-all p-1"
                          title="Edit strategy"
                          aria-label={`Edit strategy ${s.title}`}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <select
                          value={s.status}
                          onChange={async e => {
                            const nextStatus = e.target.value;
                            await storage.put('strategies', { ...s, status: nextStatus, updatedAt: Date.now() });
                            onSuccess(`Strategy status: ${nextStatus}`);
                            onRefresh();
                          }}
                          aria-label={`Status for ${s.title}`}
                          className={`h-6 rounded-full px-2 text-[10px] font-bold cursor-pointer border-none outline-none ${
                            s.status === 'executed'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : s.status === 'in-progress'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                          }`}
                        >
                          <option value="active">Active</option>
                          <option value="in-progress">In Progress</option>
                          <option value="executed">Executed</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ store: 'strategies', id: s.id, name: s.title })}
                          className="sm:opacity-0 sm:group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all p-1"
                          title="Delete strategy"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="w-full font-bold text-slate-900 dark:text-white text-sm leading-snug">
                      {s.title}
                    </div>

                    {s.action && (
                      <div className="w-full rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2.5 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        {s.action}
                      </div>
                    )}
                    <div className="space-y-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Execution tasks: {tasks.filter(task => task.strategyId === s.id && task.done).length}/{tasks.filter(task => task.strategyId === s.id).length} complete</div>
                      <form onSubmit={event => { event.preventDefault(); void handleAddStrategyTask(s); }} className="flex gap-2">
                        <input value={strategyTaskDrafts[s.id] || ''} onChange={event => setStrategyTaskDrafts(previous => ({ ...previous, [s.id]: event.target.value }))} aria-label={`Execution task for ${s.title}`} className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                        <button type="submit" className="rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-500">Add task</button>
                      </form>
                    </div>
                  </div>
                ))}
            </div>
          </div>
          )}
        </div>
      )}

      {/* Tab 3: Milestones */}
      {activeTab === 'milestones' && (
        <div className="milestone-entry-layout grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className={`${milestones.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'} rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-card dark:border-slate-800/80 dark:bg-slate-900`}>
            <FormDisclosure
              defaultOpen
              label="Add a milestone"
              header={
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Add Milestone to Strategic Goal
                </h2>
              }
            >
            <form onSubmit={handleAddMilestone} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Milestone Title</label>
                <input
                  type="text"
                  required
                  value={msTitle}
                  onChange={e => setMsTitle(e.target.value)}

                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Strategic Goal</label>
                <select
                  value={msGoalId || (goals[0]?.id ?? '')}
                  onChange={e => setMsGoalId(e.target.value)}
                  disabled={goals.length === 0}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white disabled:opacity-50"
                >
                  {goals.length === 0 ? (
                    <option value="">No strategic goals created yet</option>
                  ) : (
                    goals.map(g => (
                      <option key={g.id} value={g.id}>{g.title}</option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Target Date</label>
                <ThemedDateTimeInput
                  type="date"
                  value={msDueDate}
                  onChange={e => setMsDueDate(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <button
                type="submit"
                className="life-form-submit w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 cursor-pointer"
              >
                + Register Milestone
              </button>
            </form>
            </FormDisclosure>
          </div>

          {milestones.length > 0 && <div className="lg:col-span-7 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Milestones Overview ({milestones.length})
            </h2>
            <div className="mt-4 space-y-2.5">
              {[...milestones].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '') || (b.createdAt || 0) - (a.createdAt || 0)).map(m => {
                  const msOverdue = m.dueDate && m.dueDate < todayDate && (m.progress || 0) < 100 && m.status !== 'completed';
                  return (
                  <div key={m.id} className={`rounded-2xl border p-3.5 text-xs group space-y-2 ${msOverdue ? 'border-rose-200 bg-rose-50/30 dark:border-rose-900/60 dark:bg-rose-950/20' : 'border-slate-100 dark:border-slate-800'}`}>
                    <div className="flex justify-between items-center gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => handleToggleMilestoneStatus(m)}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                          m.status === 'completed'
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-slate-300 dark:border-slate-600 hover:border-indigo-500'
                        }`}
                      >
                        {m.status === 'completed' && <Check className="h-3.5 w-3.5" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className={`w-full font-bold text-slate-900 dark:text-white leading-snug ${m.status === 'completed' ? 'line-through text-slate-400' : ''}`}>
                          {m.title}
                          {msOverdue && <span className="ml-1.5 text-[10px] font-bold text-rose-500">OVERDUE</span>}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                          <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{getGoalTitleById(m.goalId)}</span>
                          <span>·</span>
                          <span className={msOverdue ? 'text-rose-500 font-semibold' : ''}>Due: {m.dueDate || 'Ongoing'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold ${
                        m.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : msOverdue
                          ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                          : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400'
                      }`}>
                        {m.progress || 0}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingRecord({ type: 'milestone', item: m })}
                        className="opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100 text-slate-400 hover:text-indigo-600 transition-all p-1"
                        title="Edit milestone"
                        aria-label={`Edit milestone ${m.title}`}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ store: 'milestones', id: m.id, name: m.title })}
                        className="opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100 text-slate-300 hover:text-rose-500 transition-all p-1"
                        title="Delete milestone"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    </div>
                    {/* Milestone progress bar */}
                    {m.status !== 'completed' && (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${msOverdue ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${Math.max(0, Math.min(100, m.progress || 0))}%` }} />
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={m.progress || 0}
                          onChange={async e => {
                            const val = Number(e.target.value);
                            const updated = { ...m, progress: val, status: val >= 100 ? 'completed' : 'pending', updatedAt: Date.now() };
                            await storage.put('milestones', updated);
                            if (m.goalId) await syncGoalProgressFromMilestones(m.goalId, m.id, val, updated.status);
                            onRefresh();
                          }}
                          className="h-1.5 w-20 cursor-pointer accent-indigo-600"
                          title={`Progress: ${m.progress || 0}%`}
                        />
                      </div>
                    )}
                  </div>
                  );
                })}
            </div>
          </div>}
        </div>
      )}

      {/* Tab 4: KPIs */}
      {activeTab === 'kpis' && (
        <div className="kpi-entry-layout grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className={`${kpis.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'} rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-card dark:border-slate-800/80 dark:bg-slate-900`}>
            <FormDisclosure
              defaultOpen
              label="Add a KPI"
              header={
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Register Quantitative KPI
                </h2>
              }
            >
            <form onSubmit={handleAddKPI} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">KPI Metric Name</label>
                <input
                  type="text"
                  required
                  value={kpiName}
                  onChange={e => setKpiName(e.target.value)}

                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Associated Goal</label>
                <select
                  value={kpiGoalId || (goals[0]?.id ?? '')}
                  onChange={e => setKpiGoalId(e.target.value)}
                  disabled={goals.length === 0}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white disabled:opacity-50"
                >
                  <option value="">None (Global Metric)</option>
                  {goals.map(g => (
                    <option key={g.id} value={g.id}>{g.title}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Target</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={kpiTarget}
                    onChange={e => setKpiTarget(e.target.value)}

                    className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Current</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={kpiCurrent}
                    onChange={e => setKpiCurrent(e.target.value)}

                    className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Unit</label>
                  <input
                    type="text"
                    value={kpiUnit}
                    onChange={e => setKpiUnit(e.target.value)}

                    className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="life-form-submit w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 cursor-pointer"
              >
                + Save Metric Tracking
              </button>
            </form>
            </FormDisclosure>
          </div>

          {kpis.length > 0 && <div className="lg:col-span-7 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Tracked Metrics ({kpis.length})
            </h2>
            <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">KPIs show measured performance and history; their readings do not change weighted Goal completion.</p>
            <div className="mt-4 space-y-3">
              {[...kpis].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(k => {
                  const target = Number(k.target) || 1;
                  const current = Number(k.current) || 0;
                  const pct = Math.min(100, (current / target) * 100);
                  return (
                    <div key={k.id} className="w-full rounded-2xl border border-slate-100 p-4 text-xs dark:border-slate-800 group">
                      <div className="flex justify-between items-start gap-2">
                        <div className="w-full flex-1 flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm leading-snug">
                          <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                            pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                          }`} title={pct >= 75 ? 'On track' : pct >= 50 ? 'At risk' : 'Off track'} />
                          {k.name}
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditingRecord({ type: 'kpi', item: k })}
                          className="shrink-0 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100 text-slate-400 hover:text-indigo-600 transition-all p-1"
                          title="Edit KPI"
                          aria-label={`Edit KPI ${k.name}`}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ store: 'kpis', id: k.id, name: k.name })}
                          className="shrink-0 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100 text-slate-300 hover:text-rose-500 p-1"
                          title="Delete KPI"
                          aria-label={`Delete KPI ${k.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="mt-2 flex items-baseline justify-between">
                        <div className="flex items-baseline gap-1">
                          <span className="font-mono text-xl font-extrabold text-indigo-600 dark:text-indigo-400">
                            {k.current}
                          </span>
                          <span className="text-[11px] text-slate-400">/ {k.target} {k.unit}</span>
                        </div>

                        {/* Quick adjustments with smart step */}
                        {(() => {
                          const step = target >= 1000 ? 100 : target >= 100 ? 10 : 1;
                          return (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleAdjustKPI(k, -step)}
                                className="h-6 min-w-[1.5rem] rounded bg-slate-100 px-1 text-[10px] font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                                title={`Decrease by ${step}`}
                              >
                                -{step}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdjustKPI(k, step)}
                                className="h-6 min-w-[1.5rem] rounded bg-slate-100 px-1 text-[10px] font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                                title={`Increase by ${step}`}
                              >
                                +{step}
                              </button>
                              <input
                                key={current}
                                type="number"
                                min="0"
                                defaultValue={current}
                                onBlur={e => {
                                  const val = Number(e.target.value);
                                  if (Number.isFinite(val) && val >= 0 && val !== current) {
                                    handleAdjustKPI(k, val - current);
                                  }
                                }}
                                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                className="h-6 w-14 rounded border border-slate-200 bg-white px-1 text-center font-mono text-[10px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                title="Type a value directly"
                              />
                            </div>
                          );
                        })()}
                      </div>

                      {/* KPI Sparkline Chart */}
                      {(() => {
                        const readings = (k.history?.length ? k.history : [{ value: Number(k.current) || 0, recordedAt: k.updatedAt || k.createdAt }]).slice(-10);
                        if (readings.length < 2) return <div className="mt-2 text-[10px] text-slate-400">No trend data yet</div>;
                        const values = readings.map(r => r.value);
                        const minV = Math.min(...values);
                        const maxV = Math.max(...values);
                        const range = maxV - minV || 1;
                        const w = 120;
                        const h = 30;
                        const pad = 2;
                        const points = values.map((v, i) => {
                          const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
                          const y = h - pad - ((v - minV) / range) * (h - 2 * pad);
                          return `${x},${y}`;
                        }).join(' ');
                        const trend = values[values.length - 1] >= values[0];
                        return (
                          <div className="mt-2 flex items-end gap-3">
                            <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-label={`KPI trend: ${values.join(', ')}`}>
                              <polyline
                                points={points}
                                fill="none"
                                stroke={trend ? '#22c55e' : '#f43f5e'}
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              {values.map((v, i) => {
                                const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
                                const y = h - pad - ((v - minV) / range) * (h - 2 * pad);
                                return <circle key={i} cx={x} cy={y} r="1.5" fill={i === values.length - 1 ? (trend ? '#22c55e' : '#f43f5e') : '#94a3b8'} />;
                              })}
                            </svg>
                            <span className="text-[10px] text-slate-400">{readings.length} readings</span>
                          </div>
                        );
                      })()}

                      {/* Progress bar */}
                      <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>}
        </div>
      )}

      {/* Tab 5: Missions */}
      {activeTab === 'missions' && (
        <div className="mission-entry-layout grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className={`${missions.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'} rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-card dark:border-slate-800/80 dark:bg-slate-900`}>
            <FormDisclosure
              defaultOpen
              label="Create a mission"
              header={
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Declare Mission / Monthly Focus
                </h2>
              }
            >
            <form onSubmit={handleAddMission} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Mission Title</label>
                <input
                  type="text"
                  required
                  value={missionTitle}
                  onChange={e => setMissionTitle(e.target.value)}

                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Period</label>
                  <input
                    type="text"
                    value={missionPeriod}
                    onChange={e => setMissionPeriod(e.target.value)}

                    className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Key Target</label>
                  <input
                    type="text"
                    value={missionTarget}
                    onChange={e => setMissionTarget(e.target.value)}

                    className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Action Plan</label>
                <input
                  type="text"
                  value={missionAction}
                  onChange={e => setMissionAction(e.target.value)}

                  className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Associated Goal (optional)
                  <select value={missionGoalId} onChange={event => setMissionGoalId(event.target.value)} className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                    <option value="">None</option>
                    {goals.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                </label>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Status
                  <select value={missionStatus} onChange={event => setMissionStatus(event.target.value as Mission['status'])} className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                    <option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="archived">Archived</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Start date
                  <ThemedDateTimeInput type="date" value={missionStartDate} onChange={event => setMissionStartDate(event.target.value)} className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                </label>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">End date
                  <ThemedDateTimeInput type="date" value={missionEndDate} onChange={event => setMissionEndDate(event.target.value)} className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                </label>
              </div>
              <button
                type="submit"
                className="life-form-submit w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 cursor-pointer"
              >
                + Launch Mission
              </button>
            </form>
            </FormDisclosure>
          </div>

          {missions.length > 0 && (
          <div className="lg:col-span-7 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Active Missions ({missions.length})
            </h2>
            <div className="mt-4 space-y-3">
              {[...missions].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(m => (
                  <div key={m.id} className="rounded-2xl border border-slate-100 p-4 text-xs dark:border-slate-800 group">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{m.title}</div>
                        <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">{m.period}</span>
                        {m.goalId && <div className="text-[10px] text-slate-500 dark:text-slate-400">Goal: {getGoalTitleById(m.goalId)}</div>}
                        {(m.startDate || m.endDate) && <div className="text-[10px] text-slate-400">{m.startDate || 'Start not set'} to {m.endDate || 'End not set'}</div>}
                      </div>
                      <div className="flex items-center gap-1">
                        <select aria-label={`Mission status for ${m.title}`} value={m.status || 'active'} onChange={event => void handleUpdateMissionStatus(m, event.target.value as Mission['status'])} className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-semibold dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                          <option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="archived">Archived</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setEditingRecord({ type: 'mission', item: m })}
                          className="opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100 text-slate-400 hover:text-indigo-600 transition-all p-1"
                          title="Edit mission"
                          aria-label={`Edit mission ${m.title}`}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ store: 'missions', id: m.id, name: m.title })}
                          className="opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100 text-slate-300 hover:text-rose-500 p-1"
                          title="Delete mission"
                          aria-label={`Delete mission ${m.title}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {m.target && (
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Objective: {m.target}
                      </div>
                    )}
                    {m.action && (
                      <div className="mt-1 text-[10px] text-slate-400">
                        Action: {m.action}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
          )}
        </div>
      )}

      {/* Tab 6: Finance Summary */}
      {activeTab === 'mentor' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900" aria-label="Finance reserve summary">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-sm font-bold text-slate-900 dark:text-white">Finance reserve summary</h2><p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Read-only overview. Manage targets, cash flow, savings, and runway in Finance. Runway uses liquid accounts only to avoid overlapping savings balances.</p></div>
            <button type="button" onClick={() => onNavigate?.('finance')} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500">Open Finance - Reserves & Runway</button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div><div className="text-[10px] font-bold uppercase text-slate-500">Liquid accounts</div><div className="mt-1 font-mono text-sm font-bold">{getCurrencySymbol()} {liquidCash.toLocaleString('en-IN')}</div><div className="text-[10px] text-slate-400">{accounts.length} accounts</div></div>
            <div><div className="text-[10px] font-bold uppercase text-slate-500">Liquid balance</div><div className="mt-1 font-mono text-sm font-bold">{getCurrencySymbol()} {liquidCash.toLocaleString('en-IN')}</div><div className="text-[10px] text-slate-400">Finance accounts only</div></div>
            <div><div className="text-[10px] font-bold uppercase text-slate-500">Reserve target</div><div className="mt-1 font-mono text-sm font-bold">{hasReserveTargets ? getCurrencySymbol() + ' ' + totalReserves.toLocaleString('en-IN') : 'Not set'}</div><div className="text-[10px] text-slate-400">Survival + emergency</div></div>
            <div><div className="text-[10px] font-bold uppercase text-slate-500">Runway</div><div className="mt-1 font-mono text-sm font-bold">{hasRunwayEstimate ? runwayDays + ' days' : 'Not set'}</div><div className="text-[10px] text-slate-400">Daily burn {hasSavedDailyBurn ? getCurrencySymbol() + ' ' + savedDailyBurn.toLocaleString('en-IN') : 'not set'}</div></div>
            <div><div className="text-[10px] font-bold uppercase text-slate-500">Annual savings</div><div className="mt-1 font-mono text-sm font-bold">{annualSavingsTarget > 0 ? annualSavingsProgress + '%' : 'Not set'}</div><div className="text-[10px] text-slate-400">Net recorded {getCurrencySymbol()} {netSavingsThisYear.toLocaleString('en-IN')}</div></div>
          </div>
        </section>
      )}

      {/* EDIT GOAL MODAL */}
      {editingGoal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
          onClick={() => setEditingGoal(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-goal-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="space-y-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Edit2 className="h-4 w-4 text-indigo-600" />
                  <span id="edit-goal-title">Edit Goal Details</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingGoal(null)}
                  aria-label="Close edit goal form"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {/* Breadcrumb navigation */}
              {(() => {
                const chain: Goal[] = [];
                let current = editingGoal;
                while (current?.parentId) {
                  const parent = goalsById.get(current.parentId);
                  if (!parent || chain.some(g => g.id === parent.id)) break;
                  chain.unshift(parent);
                  current = parent;
                }
                if (chain.length === 0) return null;
                return (
                  <nav className="flex flex-wrap items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400" aria-label="Goal breadcrumb">
                    {chain.map((g, i) => (
                      <React.Fragment key={g.id}>
                        {i > 0 && <span className="text-slate-300 dark:text-slate-600">/</span>}
                        <button type="button" onClick={() => setEditingGoal(g)} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate max-w-[120px]">{g.title}</button>
                      </React.Fragment>
                    ))}
                    <span className="text-slate-300 dark:text-slate-600">/</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[120px]">{editingGoal.title}</span>
                  </nav>
                );
              })()}
            </div>

            <form onSubmit={handleSaveEditedGoal} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Goal Title
                </label>
                <input
                  type="text"
                  required
                  value={editingGoal.title}
                  onChange={e => setEditingGoal({ ...editingGoal, title: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Hierarchy Level
                  </label>
                  <select
                    value={getGoalLevel(editingGoal)}
                    onChange={e => {
                      const lvl = Number(e.target.value) as GoalLevel;
                      if (lvl > 1 && eligibleParentCountForLevel(lvl) === 0) {
                        reportError(`Create a Level ${lvl - 1} goal first - Level ${lvl} needs a parent.`);
                        return;
                      }
                      const validParents = sortGoals(goals.filter(g =>
                        g.id !== editingGoal.id &&
                        !editingDescendantIds.has(g.id) &&
                        getGoalLevel(g) === lvl - 1
                      ));
                      const currentParent = validParents.find(g => g.id === editingGoal.parentId);
                      setEditingGoal({
                        ...editingGoal,
                        level: lvl,
                        parentId: lvl === 1 ? null : (currentParent || validParents[0])?.id || null
                      });
                    }}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white disabled:opacity-50"
                  >
                    <option value={1}>Level 1: Main Goal</option>
                    <option value={2} disabled={eligibleParentCountForLevel(2) === 0}>Level 2: Sub Goal</option>
                    <option value={3} disabled={eligibleParentCountForLevel(3) === 0}>Level 3: Micro Goal</option>
                    <option value={4} disabled={eligibleParentCountForLevel(4) === 0}>Level 4: Nano Goal</option>
                    <option value={5} disabled={eligibleParentCountForLevel(5) === 0}>Level 5: Atomic Goal</option>
                  </select>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Level is derived from the parent you choose below.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Parent Goal (Branch)
                  </label>
                  <select
                    disabled={getGoalLevel(editingGoal) === 1}
                    required={getGoalLevel(editingGoal) > 1}
                    value={editingGoal.parentId || ''}
                    onChange={e => {
                      const pId = e.target.value || null;
                      const parent = pId ? goalsById.get(pId) : null;
                      setEditingGoal({
                        ...editingGoal,
                        parentId: parent?.id || null,
                        level: parent ? Math.min(5, getGoalLevel(parent) + 1) as 1 | 2 | 3 | 4 | 5 : 1
                      });
                    }}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white disabled:opacity-50"
                  >
                    {getGoalLevel(editingGoal) === 1 && (
                      <option value="">None (Independent Main Goal)</option>
                    )}
                    {sortGoals(goals.filter(g =>
                      g.id !== editingGoal.id &&
                      !editingDescendantIds.has(g.id) &&
                      getGoalLevel(g) === getGoalLevel(editingGoal) - 1
                    )).map(g => (
                        <option key={g.id} value={g.id}>
                          {hierarchySequenceById.get(g.id)} {g.title}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Category
                  </label>
                  <select
                    value={editingGoal.category || 'Career'}
                    onChange={e => setEditingGoal({ ...editingGoal, category: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="Career">Career & Work</option>
                    <option value="Finance">Finance & Net Worth</option>
                    <option value="Health">Health & Fitness</option>
                    <option value="Learning">Learning & Mastery</option>
                    <option value="Spiritual">Spiritual / Life Alignment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Target Date
                  </label>
                  <ThemedDateTimeInput
                    type="date"
                    value={editingGoal.targetDate || ''}
                    onChange={e => setEditingGoal({ ...editingGoal, targetDate: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Sequence Order #
                  </label>
                  <input
                    type="number"
                    min="1"

                    value={editingGoal.order ?? ''}
                    onChange={e => setEditingGoal({ ...editingGoal, order: e.target.value === '' ? undefined : Number(e.target.value) })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    title="Sequence order number (e.g. 1 for 1st, 2 for 2nd)"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Description / Tactical Scope
                </label>
                <textarea
                  rows={2}
                  value={editingGoal.description || ''}
                  onChange={e => setEditingGoal({ ...editingGoal, description: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingGoal(null)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="life-form-submit rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingRecord && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={event => {
            if (event.target === event.currentTarget) setEditingRecord(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-goal-record-title"
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <h2 id="edit-goal-record-title" className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <Edit2 className="h-4 w-4 text-indigo-600" />
                Edit {editingRecord.type === 'kpi' ? 'KPI' : editingRecord.type[0].toUpperCase() + editingRecord.type.slice(1)}
              </h2>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label="Close edit form"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <form onSubmit={handleSaveEditedRecord} className="max-h-[80vh] space-y-4 overflow-y-auto p-5">
              {editingRecord.type === 'strategy' && (
                <>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Strategy title
                    <input
                      autoFocus
                      required
                      value={editingRecord.item.title}
                      onChange={event => setEditingRecord({
                        type: 'strategy',
                        item: { ...editingRecord.item, title: event.target.value }
                      })}
                      className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Linked goal
                    <select
                      value={editingRecord.item.goalId}
                      onChange={event => setEditingRecord({
                        type: 'strategy',
                        item: { ...editingRecord.item, goalId: event.target.value }
                      })}
                      className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      {!goals.some(goal => goal.id === editingRecord.item.goalId) && (
                        <option value={editingRecord.item.goalId}>Current goal</option>
                      )}
                      {goals.map(goal => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Action plan
                    <textarea
                      rows={4}
                      value={editingRecord.item.action}
                      onChange={event => setEditingRecord({
                        type: 'strategy',
                        item: { ...editingRecord.item, action: event.target.value }
                      })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </label>
                </>
              )}
              {editingRecord.type === 'milestone' && (
                <>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Milestone title
                    <input
                      autoFocus
                      required
                      value={editingRecord.item.title}
                      onChange={event => setEditingRecord({
                        type: 'milestone',
                        item: { ...editingRecord.item, title: event.target.value }
                      })}
                      className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Linked goal
                    <select
                      value={editingRecord.item.goalId}
                      onChange={event => setEditingRecord({
                        type: 'milestone',
                        item: { ...editingRecord.item, goalId: event.target.value }
                      })}
                      className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      {!goals.some(goal => goal.id === editingRecord.item.goalId) && (
                        <option value={editingRecord.item.goalId}>Current goal</option>
                      )}
                      {goals.map(goal => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Due date
                    <ThemedDateTimeInput
                      type="date"
                      value={editingRecord.item.dueDate || ''}
                      onChange={event => setEditingRecord({
                        type: 'milestone',
                        item: { ...editingRecord.item, dueDate: event.target.value }
                      })}
                      className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </label>
                </>
              )}
              {editingRecord.type === 'kpi' && (
                <>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    KPI name
                    <input
                      autoFocus
                      required
                      value={editingRecord.item.name}
                      onChange={event => setEditingRecord({
                        type: 'kpi',
                        item: { ...editingRecord.item, name: event.target.value }
                      })}
                      className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Associated goal
                    <select
                      value={editingRecord.item.goalId || ''}
                      onChange={event => setEditingRecord({
                        type: 'kpi',
                        item: { ...editingRecord.item, goalId: event.target.value || undefined }
                      })}
                      className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="">None (Global Metric)</option>
                      {goals.map(goal => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
                    </select>
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Target
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        required
                        value={editingRecord.item.target}
                        onChange={event => setEditingRecord({
                          type: 'kpi',
                          item: { ...editingRecord.item, target: event.target.valueAsNumber }
                        })}
                        className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-2 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Current
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={editingRecord.item.current}
                        onChange={event => setEditingRecord({
                          type: 'kpi',
                          item: { ...editingRecord.item, current: event.target.valueAsNumber }
                        })}
                        className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-2 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Unit
                      <input
                        value={editingRecord.item.unit}
                        onChange={event => setEditingRecord({
                          type: 'kpi',
                          item: { ...editingRecord.item, unit: event.target.value }
                        })}
                        className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </label>
                  </div>
                </>
              )}
              {editingRecord.type === 'mission' && (
                <>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Mission title
                    <input
                      autoFocus
                      required
                      value={editingRecord.item.title}
                      onChange={event => setEditingRecord({
                        type: 'mission',
                        item: { ...editingRecord.item, title: event.target.value }
                      })}
                      className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Period
                      <input
                        value={editingRecord.item.period}
                        onChange={event => setEditingRecord({
                          type: 'mission',
                          item: { ...editingRecord.item, period: event.target.value }
                        })}
                        className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Key target
                      <input
                        value={editingRecord.item.target}
                        onChange={event => setEditingRecord({
                          type: 'mission',
                          item: { ...editingRecord.item, target: event.target.value }
                        })}
                        className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </label>
                  </div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Linked Goal
                    <select value={editingRecord.item.goalId || ''} onChange={event => setEditingRecord({ type: 'mission', item: { ...editingRecord.item, goalId: event.target.value || undefined } })} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                      <option value="">None</option>{goals.map(goal => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
                    </select>
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Status
                      <select value={editingRecord.item.status || 'active'} onChange={event => setEditingRecord({ type: 'mission', item: { ...editingRecord.item, status: event.target.value as Mission['status'] } })} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                        <option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="archived">Archived</option>
                      </select>
                    </label>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Start date
                      <ThemedDateTimeInput type="date" value={editingRecord.item.startDate || ''} onChange={event => setEditingRecord({ type: 'mission', item: { ...editingRecord.item, startDate: event.target.value || undefined } })} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                    </label>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">End date
                      <ThemedDateTimeInput type="date" value={editingRecord.item.endDate || ''} onChange={event => setEditingRecord({ type: 'mission', item: { ...editingRecord.item, endDate: event.target.value || undefined } })} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                    </label>
                  </div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Action plan
                    <textarea
                      rows={3}
                      value={editingRecord.item.action}
                      onChange={event => setEditingRecord({
                        type: 'mission',
                        item: { ...editingRecord.item, action: event.target.value }
                      })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </label>
                </>
              )}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="life-form-submit rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Save changes
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Undo Delete Toast Stack */}
      {undoStack.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" role="status" aria-live="polite">
          {undoStack.map((entry, idx) => (
            <div key={idx} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Deleted &ldquo;{entry.label}&rdquo;
              </span>
              <button
                type="button"
                onClick={() => handleUndoDelete(idx)}
                className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-950/70 cursor-pointer"
              >
                <Undo2 className="h-3 w-3" /> Undo
              </button>
            </div>
          ))}
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Confirm Removal"
        message={deleteTarget ? `Are you sure you want to remove "${deleteTarget.name}"? ${deleteImpact}` : ''}
        cloudNotice="With Google Drive Auto-Sync enabled and online, deleting this goal or milestone updates your Drive backup."
        confirmText="Remove"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
