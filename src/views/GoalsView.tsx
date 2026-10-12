import React, { useState, useEffect, useRef } from 'react';
import {
  Target, Plus, TrendingUp, ShieldCheck, Flame, Trash2,
  Zap, Check, GitBranch, Layers, ChevronRight, ChevronDown,
  CornerDownRight, CheckCircle2, Edit2, Link2, ListTree,
  ArrowRight, Sparkles, FolderTree, Info, CheckSquare, X,
  BarChart2
} from 'lucide-react';
import {
  Goal, Milestone, Strategy, KPI, Mission, MentorRule,
  MentorQuote, CapitalStrategy, MentorProfile, FinanceAccount,
  Task, Habit, HabitLog, Routine, WorkProject, LearningItem, Skill,
  ReminderItem, Note, JournalEntry,
  FinanceTransaction, Loan, Investment, SavingsPlan, Liability, Asset
} from '../types';
import { storage, generateUUID } from '../lib/storage';
import { ConfirmModal } from '../components/ConfirmModal';
import { ProjectTimelinePlan, computeItemDelay } from '../components/ProjectTimelinePlan';
import { SlideTabs } from '../components/SlideTabs';
import {
  computeGoalAggregateBreakdown,
  GoalProgressBreakdown,
  syncGoalProgressFromMilestones,
  syncGoalProgressDirect,
  syncGoalProgressFromTasks,
  recalculateGoalAggregateProgress
} from '../lib/goalTaskSync';

/**
 * Fresh, High-Performance Linked Progress Breakdown Widget
 * Shows clean real-time proportional percentage contribution without clutter.
 */
function GoalLinkedBreakdownWidget({
  goal,
  breakdown,
  isExpanded,
  onToggleExpand,
  onQuickToggleTask,
  onQuickToggleMilestone,
  onAdjustManualProgress,
}: {
  goal: Goal;
  breakdown: GoalProgressBreakdown;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onQuickToggleTask?: (taskId: string) => Promise<void>;
  onQuickToggleMilestone?: (milestoneId: string) => Promise<void>;
  onAdjustManualProgress?: (delta: number) => void;
}) {
  const hasItems = breakdown.hasLinkedItems;

  return (
    <div className="space-y-2">
      {/* Real-Time Status & Progress Metrics Header */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs min-w-0">
        {/* Left: Progress percentage + contextual stats */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
          <span className="font-mono text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums shrink-0 whitespace-nowrap">
            {goal.progress}%
          </span>
          <span className="text-slate-300 dark:text-slate-700 shrink-0">·</span>
          {hasItems ? (
            <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
              <span className="hidden sm:inline">
                {breakdown.completedItems} of {breakdown.totalItems} linked items completed
              </span>
              <span className="sm:hidden">
                {breakdown.completedItems}/{breakdown.totalItems} linked
              </span>
              <span className="text-slate-400 dark:text-slate-500 ml-1 hidden md:inline">
                (~{breakdown.items[0]?.weightPercent || 0}% wt)
              </span>
            </span>
          ) : (
            <span className="text-[11px] sm:text-xs text-slate-400 font-normal shrink-0">
              Direct Progress
            </span>
          )}
        </div>

        {/* Right: Actions (Manual Stepper or Breakdown Toggle) */}
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {!hasItems && onAdjustManualProgress && (
            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onAdjustManualProgress(-10)}
                className="h-5 w-5 sm:h-6 sm:w-6 rounded border border-slate-200 text-xs font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors flex items-center justify-center cursor-pointer"
                title="Decrease 10%"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => onAdjustManualProgress(10)}
                className="h-5 w-5 sm:h-6 sm:w-6 rounded border border-slate-200 text-xs font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors flex items-center justify-center cursor-pointer"
                title="Increase 10%"
              >
                +
              </button>
            </div>
          )}

          {hasItems && (
            <button
              type="button"
              onClick={onToggleExpand}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-medium transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                isExpanded
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 dark:text-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700/80'
              }`}
              title={isExpanded ? 'Hide details' : 'View linked progress breakdown'}
            >
              <Layers className="h-3 w-3 shrink-0" />
              <span>{isExpanded ? 'Hide' : `Linked (${breakdown.totalItems})`}</span>
              <ChevronDown className={`h-3 w-3 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar Track */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800/90">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            goal.progress >= 100
              ? 'bg-emerald-500'
              : 'bg-indigo-600 dark:bg-indigo-500'
          }`}
          style={{ width: `${Math.max(0, Math.min(100, goal.progress))}%` }}
        />
      </div>

      {/* Expanded Linked Breakdown Drawer */}
      {isExpanded && hasItems && (
        <div className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/60 space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-200/60 pb-2 dark:border-slate-800/60">
            <div>
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                Progress Contribution Breakdown
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {breakdown.totalItems} linked items contribute ~{breakdown.items[0]?.weightPercent || 0}% each to real-time progress.
              </p>
            </div>
            <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
              {breakdown.completedItems}/{breakdown.totalItems} Complete
            </span>
          </div>

          {/* Category Summary Badges */}
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {breakdown.categories.tasks.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-slate-600 shadow-2xs border border-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                Tasks: {breakdown.categories.tasks.completedCount}/{breakdown.categories.tasks.count}
              </span>
            )}
            {breakdown.categories.milestones.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-slate-600 shadow-2xs border border-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                Milestones: {breakdown.categories.milestones.completedCount}/{breakdown.categories.milestones.count}
              </span>
            )}
            {breakdown.categories.habits.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-slate-600 shadow-2xs border border-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                Habits: {breakdown.categories.habits.completedCount}/{breakdown.categories.habits.count}
              </span>
            )}
            {breakdown.categories.routines.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-slate-600 shadow-2xs border border-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                Routines: {breakdown.categories.routines.completedCount}/{breakdown.categories.routines.count}
              </span>
            )}
            {breakdown.categories.projects.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-slate-600 shadow-2xs border border-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                Projects: {breakdown.categories.projects.completedCount}/{breakdown.categories.projects.count}
              </span>
            )}
            {breakdown.categories.learning.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-slate-600 shadow-2xs border border-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                Learning: {breakdown.categories.learning.completedCount}/{breakdown.categories.learning.count}
              </span>
            )}
            {breakdown.categories.skills.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-slate-600 shadow-2xs border border-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                Skills: {breakdown.categories.skills.completedCount}/{breakdown.categories.skills.count}
              </span>
            )}
            {breakdown.categories.notes.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-slate-600 shadow-2xs border border-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                Notebooks: {breakdown.categories.notes.completedCount}/{breakdown.categories.notes.count}
              </span>
            )}
            {breakdown.categories.journal.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-slate-600 shadow-2xs border border-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                Journal: {breakdown.categories.journal.completedCount}/{breakdown.categories.journal.count}
              </span>
            )}
            {breakdown.categories.childGoals.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-slate-600 shadow-2xs border border-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                Sub-Goals: {breakdown.categories.childGoals.completedCount}/{breakdown.categories.childGoals.count}
              </span>
            )}
          </div>

          {/* Itemized List */}
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {breakdown.items.map(item => (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/70 bg-white p-2 text-xs dark:border-slate-800 dark:bg-slate-800/80 transition-colors hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {item.type === 'task' && onQuickToggleTask ? (
                    <button
                      type="button"
                      onClick={() => onQuickToggleTask(item.id)}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] font-bold transition-all cursor-pointer ${
                        item.isCompleted
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-300 bg-white hover:border-indigo-500 dark:border-slate-600 dark:bg-slate-800'
                      }`}
                      title={item.isCompleted ? 'Mark Task Incomplete' : 'Complete Task (Instant Reflection)'}
                    >
                      {item.isCompleted && '✓'}
                    </button>
                  ) : item.type === 'milestone' && onQuickToggleMilestone ? (
                    <button
                      type="button"
                      onClick={() => onQuickToggleMilestone(item.id)}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] font-bold transition-all cursor-pointer ${
                        item.isCompleted
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-300 bg-white hover:border-indigo-500 dark:border-slate-600 dark:bg-slate-800'
                      }`}
                      title={item.isCompleted ? 'Mark Milestone Pending' : 'Reach Milestone (Instant Reflection)'}
                    >
                      {item.isCompleted && '✓'}
                    </button>
                  ) : (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] text-slate-400 dark:bg-slate-800">
                      •
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider shrink-0">
                        {item.typeLabel}
                      </span>
                      <span className={`truncate font-medium min-w-0 ${item.isCompleted ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                        {item.title}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-slate-400 font-mono">
                    ~{item.weightPercent}%
                  </span>
                  <span className={`font-mono text-[11px] font-semibold rounded px-1.5 py-0.2 ${
                    item.progress >= 100
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : item.progress > 0
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {item.progress}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface GoalsViewProps {
  goals: Goal[];
  milestones?: Milestone[];
  strategies?: Strategy[];
  kpis?: KPI[];
  missions?: Mission[];
  mentorRules?: MentorRule[];
  mentorQuotes?: MentorQuote[];
  capitalStrategies?: CapitalStrategy[];
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
  workProjects?: WorkProject[];
  learningItems?: LearningItem[];
  skills?: Skill[];
  notes?: Note[];
  journal?: JournalEntry[];
  reminders?: ReminderItem[];
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
}

export const GoalsView: React.FC<GoalsViewProps> = ({
  goals,
  milestones = [],
  strategies = [],
  kpis = [],
  missions = [],
  mentorRules = [],
  mentorQuotes = [],
  capitalStrategies = [],
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
  workProjects = [],
  learningItems = [],
  skills = [],
  notes = [],
  journal = [],
  reminders = [],
  onRefresh,
  onSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'goals' | 'timeline' | 'strategies' | 'milestones' | 'kpis' | 'missions' | 'mentor'>('goals');

  // Hierarchy form state
  const [goalTitle, setGoalTitle] = useState('');
  const [goalCategory, setGoalCategory] = useState('Career');
  const [targetDate, setTargetDate] = useState('');
  const [goalProgress, setGoalProgress] = useState(0);
  const [goalDescription, setGoalDescription] = useState('');
  const [goalLevel, setGoalLevel] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [goalParentId, setGoalParentId] = useState<string>('');

  // Hierarchy viewing state
  const [goalViewMode, setGoalViewMode] = useState<'tree' | 'flat'>('tree');
  const [collapsedGoalIds, setCollapsedGoalIds] = useState<Record<string, boolean>>({});
  const [expandedBreakdownGoalIds, setExpandedBreakdownGoalIds] = useState<Record<string, boolean>>({});
  const [levelFilter, setLevelFilter] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const toggleBreakdown = (id: string) => {
    setExpandedBreakdownGoalIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleQuickToggleTask = async (taskId: string) => {
    const allT = tasks.length > 0 ? tasks : await storage.getAll<Task>('tasks');
    const task = allT.find(t => t.id === taskId);
    if (!task) return;
    const nextDone = !task.done;
    const updated: Task = {
      ...task,
      done: nextDone,
      status: nextDone ? 'done' : 'open',
      updatedAt: Date.now()
    };
    await storage.put('tasks', updated);
    if (task.goalId) {
      const res = await syncGoalProgressFromTasks(task.goalId, task.id, nextDone);
      if (res.targetGoal) {
        onSuccess(
          nextDone
            ? `✓ Task complete! Goal "${res.targetGoal.title}" progress updated to ${res.targetGoal.progress}%`
            : `Task opened. Goal "${res.targetGoal.title}" progress adjusted to ${res.targetGoal.progress}%`
        );
      }
    }
    onRefresh();
  };

  const handleQuickToggleMilestone = async (milestoneId: string) => {
    const m = milestones.find(item => item.id === milestoneId);
    if (!m) return;
    await handleToggleMilestoneStatus(m);
  };

  const goalFormRef = useRef<HTMLDivElement>(null);

  // Helper to determine effective level of any goal (5 Branches: Main 1 -> Sub 2 -> Micro 3 -> Nano 4 -> Atomic 5)
  const getGoalLevel = (g: Goal): 1 | 2 | 3 | 4 | 5 => {
    if (g.level && g.level >= 1 && g.level <= 5) return g.level as 1 | 2 | 3 | 4 | 5;
    if (!g.parentId) return 1;
    let depth = 1;
    let currParentId: string | undefined = g.parentId || undefined;
    const visited = new Set<string>([g.id]);
    while (currParentId && !visited.has(currParentId) && depth < 5) {
      visited.add(currParentId);
      const parent = goals.find(p => p.id === currParentId);
      if (!parent) break;
      depth++;
      currParentId = parent.parentId || undefined;
    }
    return Math.min(5, Math.max(1, depth)) as 1 | 2 | 3 | 4 | 5;
  };

  const mainGoals = goals.filter(g => getGoalLevel(g) === 1);
  const subGoals = goals.filter(g => getGoalLevel(g) === 2);
  const microGoals = goals.filter(g => getGoalLevel(g) === 3);
  const nanoGoals = goals.filter(g => getGoalLevel(g) === 4);
  const atomicGoals = goals.filter(g => getGoalLevel(g) === 5);

  const getChildrenOf = (parentId: string) => {
    return goals.filter(g => g.parentId === parentId);
  };

  const getSubGoalsOf = (mainGoalId: string) => {
    return goals.filter(g => g.parentId === mainGoalId);
  };

  const getMicroGoalsOf = (subGoalId: string) => {
    return goals.filter(g => g.parentId === subGoalId);
  };

  const getNanoGoalsOf = (microGoalId: string) => {
    return goals.filter(g => g.parentId === microGoalId);
  };

  const getAtomicGoalsOf = (nanoGoalId: string) => {
    return goals.filter(g => g.parentId === nanoGoalId);
  };

  const toggleCollapse = (id: string) => {
    setCollapsedGoalIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const startAddChildGoal = (parentGoal: Goal, targetLevel?: 1 | 2 | 3 | 4 | 5) => {
    const parentLvl = getGoalLevel(parentGoal);
    const nextLvl = (targetLevel || Math.min(5, parentLvl + 1)) as 1 | 2 | 3 | 4 | 5;
    setGoalLevel(nextLvl);
    setGoalParentId(parentGoal.id);
    setGoalCategory(parentGoal.category || 'Career');
    if (parentGoal.targetDate) setTargetDate(parentGoal.targetDate);
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

  // Mentor Strategy state
  const [mentorMission, setMentorMission] = useState(mentor?.mission || '');
  const [survivalReserve, setSurvivalReserve] = useState(mentor?.survivalReserve || 100000);
  const [emergencyReserve, setEmergencyReserve] = useState(mentor?.emergencyReserve || 50000);
  const [dailyBurn, setDailyBurn] = useState(mentor?.dailyBurn || 800);
  const [savingGoal, setSavingGoal] = useState(mentor?.savingGoalAmount || 500000);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<{ store: string; id: string; name: string } | null>(null);

  // Auto-sync dropdowns when goals asynchronously load
  useEffect(() => {
    if (goals.length > 0) {
      if (!stratGoalId || !goals.some(g => g.id === stratGoalId)) {
        setStratGoalId(goals[0].id);
      }
      if (!msGoalId || !goals.some(g => g.id === msGoalId)) {
        setMsGoalId(goals[0].id);
      }
      if (!kpiGoalId || !goals.some(g => g.id === kpiGoalId)) {
        setKpiGoalId(goals[0].id);
      }
    }
  }, [goals, stratGoalId, msGoalId, kpiGoalId]);

  // Keep mentor state synced with prop
  useEffect(() => {
    if (mentor) {
      if (mentor.mission !== undefined) setMentorMission(mentor.mission);
      if (mentor.survivalReserve !== undefined) setSurvivalReserve(mentor.survivalReserve);
      if (mentor.emergencyReserve !== undefined) setEmergencyReserve(mentor.emergencyReserve);
      if (mentor.dailyBurn !== undefined) setDailyBurn(mentor.dailyBurn);
      if (mentor.savingGoalAmount !== undefined) setSavingGoal(mentor.savingGoalAmount);
    }
  }, [mentor]);

  const liquidCash = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  const totalReserves = Number(survivalReserve) + Number(emergencyReserve);
  const runwayDays = dailyBurn > 0 ? Math.floor(liquidCash / dailyBurn) : 0;
  const runwayMonths = (runwayDays / 30).toFixed(1);

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;

    const now = Date.now();
    const parentGoal = goalParentId ? goals.find(g => g.id === goalParentId) : null;

    // Detect level based on parent and user selection
    let effectiveLevel: 1 | 2 | 3 | 4 | 5 = goalLevel;
    if (goalParentId && parentGoal) {
      const pLvl = getGoalLevel(parentGoal);
      effectiveLevel = Math.min(5, Math.max(goalLevel, pLvl + 1)) as 1 | 2 | 3 | 4 | 5;
    } else {
      effectiveLevel = 1;
    }

    const newGoalId = generateUUID();
    const newGoal: Goal = {
      id: newGoalId,
      title: goalTitle.trim(),
      category: goalCategory || parentGoal?.category || 'Career',
      targetDate: targetDate || parentGoal?.targetDate || undefined,
      description: goalDescription.trim() || undefined,
      progress: goalProgress,
      status: goalProgress >= 100 ? 'completed' : 'active',
      parentId: goalParentId || null,
      level: effectiveLevel,
      autoRollupProgress: true,
      createdAt: now,
      updatedAt: now
    };

    await storage.put('goals', newGoal);

    // Rollup parent progress automatically using unified aggregate engine
    if (goalParentId) {
      await recalculateGoalAggregateProgress(goalParentId);
    }

    const levelToastNames: Record<number, string> = {
      1: '🎯 Strategic Main Goal (Level 1) registered',
      2: `🔹 Sub Goal (Level 2) linked to "${parentGoal?.title}"`,
      3: `▫️ Micro Goal (Level 3) linked to "${parentGoal?.title}"`,
      4: `🔸 Nano Goal (Level 4) linked to "${parentGoal?.title}"`,
      5: `⚡ Atomic Goal (Level 5) linked to "${parentGoal?.title}"`
    };

    onSuccess(levelToastNames[effectiveLevel] || 'Goal registered successfully');

    setGoalTitle('');
    setGoalDescription('');
    setGoalProgress(0);
    onRefresh();
  };

  const handleAddStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stratTitle.trim()) return;

    const targetGoal = stratGoalId || goals[0]?.id || '';
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
    onSuccess('⚡ Strategy initiative created');
    setStratTitle('');
    setStratAction('');
    onRefresh();
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msTitle.trim()) return;

    const targetGoal = msGoalId || goals[0]?.id || '';
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
    if (targetGoal) {
      const res = await syncGoalProgressFromMilestones(targetGoal);
      onSuccess(`✓ Milestone added! Goal "${res.targetGoal?.title || ''}" progress updated to ${res.targetGoal?.progress || 0}%`);
    } else {
      onSuccess('Milestone added');
    }
    setMsTitle('');
    setMsDueDate('');
    onRefresh();
  };

  const handleAddKPI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kpiName.trim()) return;

    const targetGoal = kpiGoalId || goals[0]?.id || '';
    const k: KPI = {
      id: generateUUID(),
      goalId: targetGoal || undefined,
      name: kpiName.trim(),
      target: Number(kpiTarget) || 0,
      current: Number(kpiCurrent) || 0,
      unit: kpiUnit.trim() || 'units',
      status: 'tracking',
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
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await storage.put('missions', m);
    onSuccess('Mission declared');
    setMissionTitle('');
    setMissionTarget('');
    onRefresh();
  };

  // Real-Time Aggregate Progress Engine (Proportional Reflection across 3 tiers)
  const handleProgressChange = async (targetGoal: Goal, newProgressOrDelta: number, isDirect = false) => {
    const calculatedProgress = isDirect
      ? Math.max(0, Math.min(100, newProgressOrDelta))
      : Math.max(0, Math.min(100, targetGoal.progress + newProgressOrDelta));

    await syncGoalProgressDirect(targetGoal.id, calculatedProgress);
    onRefresh();
  };

  const handleSaveEditedGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoal || !editingGoal.title.trim()) return;

    await storage.put('goals', {
      ...editingGoal,
      title: editingGoal.title.trim(),
      updatedAt: Date.now()
    });

    if (editingGoal.parentId) {
      await recalculateGoalAggregateProgress(editingGoal.parentId);
    } else {
      await recalculateGoalAggregateProgress(editingGoal.id);
    }

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

  const handleToggleStrategyStatus = async (s: Strategy) => {
    const nextStatus = s.status === 'executed' ? 'active' : s.status === 'active' ? 'in-progress' : 'executed';
    const updated: Strategy = {
      ...s,
      status: nextStatus,
      updatedAt: Date.now()
    };
    await storage.put('strategies', updated);
    onSuccess(`Strategy status: ${nextStatus}`);
    onRefresh();
  };

  const handleAdjustKPI = async (k: KPI, delta: number) => {
    const updated: KPI = {
      ...k,
      current: Math.max(0, Number(k.current || 0) + delta),
      updatedAt: Date.now()
    };
    await storage.put('kpis', updated);
    onRefresh();
  };

  const handleSaveMentor = async (e: React.FormEvent) => {
    e.preventDefault();
    const appSettings = (await storage.getSingleton<any>('appSettings')) || {};
    const updatedMentor: MentorProfile = {
      mission: mentorMission,
      survivalReserve: Number(survivalReserve),
      emergencyReserve: Number(emergencyReserve),
      dailyBurn: Number(dailyBurn),
      monthlyBurn: Number(dailyBurn) * 30,
      savingGoalAmount: Number(savingGoal),
      updatedAt: Date.now()
    };
    appSettings.mentor = updatedMentor;
    await storage.setSingleton('appSettings', appSettings);
    onSuccess('Mentor strategy & capital allocation saved');
    onRefresh();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.store === 'milestones') {
      const ms = milestones.find(m => m.id === deleteTarget.id);
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
          toDeleteIds.add(child.id);
          findDescendants(child.id);
        });
      };
      findDescendants(deleteTarget.id);

      for (const id of toDeleteIds) {
        await storage.delete('goals', id);
      }

      // If deleted goal had a parent, recalculate parent progress
      const deletedGoal = goals.find(g => g.id === deleteTarget.id);
      if (deletedGoal?.parentId && !toDeleteIds.has(deletedGoal.parentId)) {
        await recalculateGoalAggregateProgress(deletedGoal.parentId);
      }
      onSuccess(`✓ Removed "${deleteTarget.name}" and linked sub-goals`);
      setDeleteTarget(null);
      onRefresh();
      return;
    }

    await storage.delete(deleteTarget.store, deleteTarget.id);
    onSuccess(`✓ Removed "${deleteTarget.name}"`);
    setDeleteTarget(null);
    onRefresh();
  };

  const getGoalTitleById = (id?: string) => {
    if (!id) return 'Independent';
    const g = goals.find(goal => goal.id === id);
    if (!g) return 'Strategic Objective';
    const lvl = getGoalLevel(g);
    const prefix =
      lvl === 1 ? '🎯 ' :
      lvl === 2 ? '  ↳ 🔹 ' :
      lvl === 3 ? '    ↳ ▫️ ' :
      lvl === 4 ? '      ↳ 🔸 ' :
      '        ↳ ⚡ ';
    return `${prefix}${g.title}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
          Goals & Strategy
        </h1>
      </div>

      {/* Capital Position Dashboard */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* Card 1: Liquid Capital */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Liquid Capital</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">
            ₹{liquidCash.toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            Across {accounts.length} liquid accounts
          </div>
        </div>

        {/* Card 2: Survival Runway */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Survival Runway</span>
            <Flame className="h-4 w-4 text-amber-500 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400 tabular-nums truncate">
            {runwayDays} Days
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            ~{runwayMonths} months at current burn
          </div>
        </div>

        {/* Card 3: Reserves Goal */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Reserves Goal</span>
            <Target className="h-4 w-4 text-indigo-500 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">
            ₹{totalReserves.toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            Survival + Emergency fund
          </div>
        </div>

        {/* Card 4: Daily Burn Rate */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Daily Burn Rate</span>
            <TrendingUp className="h-4 w-4 text-rose-500 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-rose-600 dark:text-rose-400 tabular-nums truncate">
            ₹{Number(dailyBurn).toLocaleString('en-IN')}/d
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            ₹{(Number(dailyBurn) * 30).toLocaleString('en-IN')}/mo
          </div>
        </div>
      </div>

      {/* Delayed Tasks Alert Banner in GoalsView */}
      {(() => {
        const delayedTasksCount = tasks.filter(t => !t.done && computeItemDelay(t).isDelayed).length;
        const delayedProjectsCount = workProjects.filter(p => p.status !== 'Completed' && computeItemDelay({ ...p, dueAt: p.due }).isDelayed).length;
        const delayedRoutinesCount = routines.filter(r => computeItemDelay(r).isDelayed).length;
        const totalDelays = delayedTasksCount + delayedProjectsCount + delayedRoutinesCount;

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
                    {totalDelays} {totalDelays === 1 ? 'item is delayed' : 'items are delayed'} across Deliverables, Routines, and Tasks!
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {delayedTasksCount} tasks, {delayedProjectsCount} projects, {delayedRoutinesCount} routines behind schedule. Open timeline for Task Genesis & Alarms.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('timeline')}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-500 active:scale-95 transition-all cursor-pointer shrink-0"
              >
                <span>Open Project Timeline & Alarms</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          );
        }
        return null;
      })()}

      {/* Tabs navigation for Goals sub-features (Full-Width Responsive Slide Tab) */}
      <div className="w-full pb-2 border-b border-slate-200 dark:border-slate-800">
        <SlideTabs
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as any)}
          tabs={(() => {
            const delayedTasksCount = tasks.filter(t => !t.done && computeItemDelay(t).isDelayed).length;
            const delayedProjectsCount = workProjects.filter(p => p.status !== 'Completed' && computeItemDelay({ ...p, dueAt: p.due }).isDelayed).length;
            const delayedRoutinesCount = routines.filter(r => computeItemDelay(r).isDelayed).length;
            const totalDelays = delayedTasksCount + delayedProjectsCount + delayedRoutinesCount;

            return [
              {
                id: 'timeline',
                label: totalDelays > 0 ? `📅 Timeline (⚠️ ${totalDelays})` : '📅 Timeline & Plan',
                shortLabel: '📅 Timeline'
              },
              { id: 'goals', label: `Strategic Goals (${goals.length})`, shortLabel: `Goals (${goals.length})` },
              { id: 'strategies', label: `Strategies (${strategies.length})`, shortLabel: `Strategies (${strategies.length})` },
              { id: 'milestones', label: `Milestones (${milestones.length})`, shortLabel: `Milestones (${milestones.length})` },
              { id: 'kpis', label: `KPIs (${kpis.length})`, shortLabel: `KPIs (${kpis.length})` },
              { id: 'missions', label: `Missions (${missions.length})`, shortLabel: `Missions (${missions.length})` },
              { id: 'mentor', label: 'Mentor & Reserves', shortLabel: 'Mentor' }
            ];
          })()}
        />
      </div>

      {/* Tab 0: Project Timeline & Delay Alarms */}
      {activeTab === 'timeline' && (
        <ProjectTimelinePlan
          goals={goals}
          milestones={milestones}
          tasks={tasks}
          workProjects={workProjects}
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
          onRefresh={onRefresh}
          onSuccess={onSuccess}
        />
      )}

      {/* Tab 1: Strategic Goals with 3-Tier Hierarchy & Linked Progress */}
      {activeTab === 'goals' && (
        <div className="space-y-6">
          <div className="flex flex-col gap-6 w-full">
            {/* Add Goal Form (Single Column - Upper) */}
            <div ref={goalFormRef} className="w-full flex flex-col">
              <div className="flex-1 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
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
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                    Tier {goalLevel} of 5
                  </span>
                </div>

                <form onSubmit={handleAddGoal} className="mt-4 space-y-3.5">
                  {/* Goal Level Selector (5 Branches) */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                      Hierarchy Level (5 Branches)
                    </label>
                    <div className="grid grid-cols-5 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setGoalLevel(1);
                          setGoalParentId('');
                        }}
                        className={`rounded-xl px-1 py-2 text-center text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                          goalLevel === 1
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                        title="Main Goal (Level 1)"
                      >
                        🎯 Main
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setGoalLevel(2);
                          if (!goalParentId && mainGoals.length > 0) {
                            setGoalParentId(mainGoals[0].id);
                          }
                        }}
                        className={`rounded-xl px-1 py-2 text-center text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                          goalLevel === 2
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                        title="Sub Goal (Level 2)"
                      >
                        🔹 Sub
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setGoalLevel(3);
                          if (subGoals.length > 0 && !subGoals.some(s => s.id === goalParentId)) {
                            setGoalParentId(subGoals[0].id);
                          } else if (!goalParentId && mainGoals.length > 0) {
                            setGoalParentId(mainGoals[0].id);
                          }
                        }}
                        className={`rounded-xl px-1 py-2 text-center text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                          goalLevel === 3
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                        title="Micro Goal (Level 3)"
                      >
                        ▫️ Micro
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setGoalLevel(4);
                          if (microGoals.length > 0 && !microGoals.some(m => m.id === goalParentId)) {
                            setGoalParentId(microGoals[0].id);
                          } else if (subGoals.length > 0) {
                            setGoalParentId(subGoals[0].id);
                          }
                        }}
                        className={`rounded-xl px-1 py-2 text-center text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                          goalLevel === 4
                            ? 'bg-sky-600 text-white shadow-xs'
                            : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                        title="Nano Goal (Level 4)"
                      >
                        🔸 Nano
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setGoalLevel(5);
                          if (nanoGoals.length > 0 && !nanoGoals.some(n => n.id === goalParentId)) {
                            setGoalParentId(nanoGoals[0].id);
                          } else if (microGoals.length > 0) {
                            setGoalParentId(microGoals[0].id);
                          }
                        }}
                        className={`rounded-xl px-1 py-2 text-center text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                          goalLevel === 5
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                        title="Atomic Goal (Level 5)"
                      >
                        ⚡ Atomic
                      </button>
                    </div>
                  </div>

                  {/* Parent Selector for Levels 2, 3, 4, 5 */}
                  {goalLevel > 1 && (() => {
                    const parentChoices =
                      goalLevel === 2
                        ? mainGoals
                        : goalLevel === 3
                        ? [...subGoals, ...mainGoals]
                        : goalLevel === 4
                        ? [...microGoals, ...subGoals, ...mainGoals]
                        : [...nanoGoals, ...microGoals, ...subGoals, ...mainGoals];

                    const themeConfig = ({
                      2: {
                        border: 'border-emerald-200/80 dark:border-emerald-900/60',
                        bg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
                        text: 'text-emerald-800 dark:text-emerald-300',
                        input: 'border-emerald-300 dark:border-emerald-700'
                      },
                      3: {
                        border: 'border-amber-200/80 dark:border-amber-900/60',
                        bg: 'bg-amber-50/50 dark:bg-amber-950/20',
                        text: 'text-amber-800 dark:text-amber-300',
                        input: 'border-amber-300 dark:border-amber-700'
                      },
                      4: {
                        border: 'border-sky-200/80 dark:border-sky-900/60',
                        bg: 'bg-sky-50/50 dark:bg-sky-950/20',
                        text: 'text-sky-800 dark:text-sky-300',
                        input: 'border-sky-300 dark:border-sky-700'
                      },
                      5: {
                        border: 'border-purple-200/80 dark:border-purple-900/60',
                        bg: 'bg-purple-50/50 dark:bg-purple-950/20',
                        text: 'text-purple-800 dark:text-purple-300',
                        input: 'border-purple-300 dark:border-purple-700'
                      }
                    } as Record<number, { border: string; bg: string; text: string; input: string }>)[goalLevel] || {
                      border: 'border-slate-200/80 dark:border-slate-800',
                      bg: 'bg-slate-50/50 dark:bg-slate-900/20',
                      text: 'text-slate-800 dark:text-slate-300',
                      input: 'border-slate-300 dark:border-slate-700'
                    };

                    return (
                      <div className={`rounded-xl border ${themeConfig.border} ${themeConfig.bg} p-2.5`}>
                        <label className={`block text-[11px] font-bold ${themeConfig.text}`}>
                          Link to Parent Goal (Level {goalLevel - 1} or higher) *
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
                              const prefix =
                                lvl === 1 ? '🎯 L1 Main: ' :
                                lvl === 2 ? '  ↳ 🔹 L2 Sub: ' :
                                lvl === 3 ? '    ↳ ▫️ L3 Micro: ' :
                                '      ↳ 🔸 L4 Nano: ';
                              return (
                                <option key={p.id} value={p.id}>
                                  {prefix}{p.title} ({p.progress}%)
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
                      placeholder={
                        goalLevel === 1
                          ? 'e.g. Build ₹1M Liquid Runway, Launch SaaS Product'
                          : goalLevel === 2
                          ? 'e.g. Master Backend Architecture, Save First ₹200k'
                          : goalLevel === 3
                          ? 'e.g. Complete Postgres Indexing, Automate Monthly SIP'
                          : goalLevel === 4
                          ? 'e.g. Benchmark Query Index Plans, Configure Netbanking Auto-Debit'
                          : 'e.g. Run EXPLAIN ANALYZE on users table, Authorize bank mandate'
                      }
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
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
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        Target Date
                      </label>
                      <input
                        type="date"
                        value={targetDate}
                        onChange={e => setTargetDate(e.target.value)}
                        className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                      placeholder="Outline specific milestones or conditions to mark this complete..."
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
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={goalProgress}
                        onChange={e => setGoalProgress(Number(e.target.value))}
                        className={`mt-1.5 h-2 w-full cursor-pointer ${
                          goalLevel === 3
                            ? 'accent-amber-600'
                            : goalLevel === 4
                            ? 'accent-sky-600'
                            : 'accent-purple-600'
                        }`}
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    className={`w-full rounded-xl py-2.5 text-xs font-semibold text-white shadow-sm transition-all cursor-pointer ${
                      goalLevel === 1
                        ? 'bg-indigo-600 hover:bg-indigo-500'
                        : goalLevel === 2
                        ? 'bg-emerald-600 hover:bg-emerald-500'
                        : goalLevel === 3
                        ? 'bg-amber-600 hover:bg-amber-500'
                        : goalLevel === 4
                        ? 'bg-sky-600 hover:bg-sky-500'
                        : 'bg-purple-600 hover:bg-purple-500'
                    }`}
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
            </div>

            {/* Strategic Goals Portfolio (Single Column - Lower) */}
            <div className="w-full flex flex-col">
              <div className="flex-1 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <div className="space-y-3 border-b border-slate-100 pb-3.5 dark:border-slate-800">
                  {/* Top Row: Title on Left, Hierarchy Counts on Right (Full Width) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 w-full">
                    <div className="flex items-center gap-2 min-w-0">
                      <Target className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        Strategic Goals Portfolio ({goals.length})
                      </h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 rounded-xl bg-slate-50 px-2.5 sm:px-3 py-1 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-[11px] sm:text-xs">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">{mainGoals.length} Main</span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{subGoals.length} Sub</span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">{microGoals.length} Micro</span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="font-semibold text-sky-600 dark:text-sky-400 whitespace-nowrap">{nanoGoals.length} Nano</span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="font-semibold text-purple-600 dark:text-purple-400 whitespace-nowrap">{atomicGoals.length} Atomic</span>
                    </div>
                  </div>

                  {/* Bottom Row: Tree/Flat Toggle + Level Filter Stretched Full Width End-to-End */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 w-full">
                    {/* Tree View / Flat View Toggle (4 cols) */}
                    <div className="sm:col-span-4 grid grid-cols-2 rounded-xl border border-slate-200/80 bg-slate-100/80 p-1 text-xs dark:border-slate-700 dark:bg-slate-800 w-full">
                      <button
                        type="button"
                        onClick={() => setGoalViewMode('tree')}
                        className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 font-semibold transition-all cursor-pointer whitespace-nowrap w-full ${
                          goalViewMode === 'tree'
                            ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        }`}
                      >
                        <FolderTree className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                        <span>Tree</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setGoalViewMode('flat')}
                        className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 font-semibold transition-all cursor-pointer whitespace-nowrap w-full ${
                          goalViewMode === 'flat'
                            ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        }`}
                      >
                        <ListTree className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                        <span>Flat</span>
                      </button>
                    </div>

                    {/* Level Filter: All | Main | Sub | Micro | Nano | Atomic (8 cols) */}
                    <div className="sm:col-span-8 grid grid-cols-6 gap-0.5 sm:gap-1 rounded-xl border border-slate-200/80 bg-slate-100/80 p-1 dark:border-slate-700 dark:bg-slate-800 text-xs w-full">
                      {(['all', '1', '2', '3', '4', '5'] as const).map(lvl => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setLevelFilter(lvl)}
                          className={`flex items-center justify-center rounded-lg px-1 sm:px-1.5 py-1.5 text-[10px] sm:text-xs font-semibold transition-all cursor-pointer truncate w-full text-center ${
                            levelFilter === lvl
                              ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
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
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  {goals.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      No strategic goals created yet. Use the form to register your first Main Goal.
                    </div>
                  ) : goalViewMode === 'tree' ? (
                    /* 3-TIER HIERARCHY TREE VIEW */
                    mainGoals
                      .filter(m => levelFilter === 'all' || levelFilter === '1')
                      .map(mainGoal => {
                        const childSubGoals = getSubGoalsOf(mainGoal.id);
                        const isMainCollapsed = Boolean(collapsedGoalIds[mainGoal.id]);
                        const totalDescendantMicro = childSubGoals.reduce(
                          (acc, s) => acc + getMicroGoalsOf(s.id).length,
                          0
                        );

                        return (
                          <div
                            key={mainGoal.id}
                            className="group rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-5 shadow-xs hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-slate-700 transition-all space-y-3 min-w-0"
                          >
                            {/* LEVEL 1: MAIN GOAL HEADER */}
                            <div className="space-y-1.5 min-w-0">
                              <div className="flex flex-wrap items-center justify-between gap-y-1.5 gap-x-2 min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 min-w-0">
                                  <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/50 shrink-0 whitespace-nowrap">
                                    <Target className="h-3 w-3 shrink-0" />
                                    Main Goal
                                  </span>
                                  <span className="text-slate-300 dark:text-slate-700 shrink-0">·</span>
                                  <span className="font-medium text-slate-700 dark:text-slate-300 shrink-0 whitespace-nowrap">
                                    {mainGoal.category || 'General'}
                                  </span>
                                  {mainGoal.targetDate && (
                                    <>
                                      <span className="text-slate-300 dark:text-slate-700 shrink-0">·</span>
                                      <span className="shrink-0 whitespace-nowrap text-[11px] sm:text-xs">Target {mainGoal.targetDate}</span>
                                    </>
                                  )}
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
                                </div>
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

                            {/* MAIN GOAL LINKED PROGRESS BAR & REAL-TIME BREAKDOWN */}
                            <GoalLinkedBreakdownWidget
                              goal={mainGoal}
                              breakdown={computeGoalAggregateBreakdown(mainGoal.id, {
                                goals,
                                tasks,
                                milestones,
                                habits,
                                habitLogs,
                                routines,
                                workProjects,
                                learningItems,
                                skills,
                                notes,
                                journal
                              })}
                              isExpanded={Boolean(expandedBreakdownGoalIds[mainGoal.id])}
                              onToggleExpand={() => toggleBreakdown(mainGoal.id)}
                              onQuickToggleTask={handleQuickToggleTask}
                              onQuickToggleMilestone={handleQuickToggleMilestone}
                              onAdjustManualProgress={(delta) => handleProgressChange(mainGoal, delta)}
                            />

                            {/* SUB-GOALS ACCORDION TRIGGER */}
                            {childSubGoals.length > 0 && (
                              <div className="flex flex-wrap items-center justify-between gap-1 pt-2 pb-0.5 border-t border-slate-100 dark:border-slate-800/80 min-w-0">
                                <button
                                  type="button"
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
                              <div className="ml-1 sm:ml-3 pl-2 sm:pl-3.5 border-l-2 border-indigo-200 dark:border-indigo-900/50 space-y-2.5 pt-1 min-w-0">
                                {childSubGoals.map(subGoal => {
                                  const childMicroGoals = getMicroGoalsOf(subGoal.id);

                                  return (
                                    <div
                                      key={subGoal.id}
                                      className="rounded-xl border border-emerald-200/70 bg-emerald-50/20 p-2.5 sm:p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/15 space-y-2.5 transition-all min-w-0 shadow-2xs hover:border-emerald-300 dark:hover:border-emerald-800"
                                    >
                                      {/* Sub Goal Header */}
                                      <div className="space-y-1 min-w-0">
                                        <div className="flex flex-wrap items-center justify-between gap-y-1.5 gap-x-2 min-w-0">
                                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 min-w-0">
                                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50 shrink-0 whitespace-nowrap">
                                              Sub Goal
                                            </span>
                                            {subGoal.targetDate && (
                                              <>
                                                <span className="text-slate-300 dark:text-slate-700 shrink-0">·</span>
                                                <span className="shrink-0 whitespace-nowrap text-[11px] sm:text-xs">Due {subGoal.targetDate}</span>
                                              </>
                                            )}
                                          </div>

                                          <div className="flex items-center gap-1 shrink-0 ml-auto">
                                            <button
                                              type="button"
                                              onClick={() => startAddNestedGoal(subGoal)}
                                              className="inline-flex items-center gap-1 rounded-md border border-emerald-200/80 bg-emerald-50/70 px-2 py-0.5 text-[11px] sm:text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/80 dark:bg-emerald-950/50 dark:text-emerald-300 cursor-pointer transition-colors shrink-0 whitespace-nowrap"
                                              title="Add Level 3 Micro Goal"
                                            >
                                              <Plus className="h-3 w-3 shrink-0" />
                                              <span>Micro Goal</span>
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
                                          </div>
                                        </div>

                                        <h4 className="w-full text-xs sm:text-sm font-semibold text-slate-900 dark:text-white leading-snug break-words">
                                          {subGoal.title}
                                        </h4>
                                      </div>

                                      {/* Sub Goal Linked Progress Bar & Breakdown */}
                                      <GoalLinkedBreakdownWidget
                                        goal={subGoal}
                                        breakdown={computeGoalAggregateBreakdown(subGoal.id, {
                                          goals,
                                          tasks,
                                          milestones,
                                          habits,
                                          habitLogs,
                                          routines,
                                          workProjects,
                                          learningItems,
                                          skills,
                                          notes,
                                          journal
                                        })}
                                        isExpanded={Boolean(expandedBreakdownGoalIds[subGoal.id])}
                                        onToggleExpand={() => toggleBreakdown(subGoal.id)}
                                        onQuickToggleTask={handleQuickToggleTask}
                                        onQuickToggleMilestone={handleQuickToggleMilestone}
                                        onAdjustManualProgress={(delta) => handleProgressChange(subGoal, delta)}
                                      />

                                      {/* LEVEL 3: MICRO GOALS CONTAINER */}
                                      {childMicroGoals.length > 0 && (
                                        <div className="ml-1 sm:ml-2.5 pl-2 sm:pl-3 border-l-2 border-emerald-200 dark:border-emerald-900/50 space-y-2 pt-1 min-w-0">
                                          <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-slate-400 pb-0.5 min-w-0">
                                            <span className="font-semibold text-slate-600 dark:text-slate-300 text-[10px] sm:text-[11px] uppercase tracking-wider shrink-0 whitespace-nowrap">
                                              Micro Goals ({childMicroGoals.length})
                                            </span>
                                            <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap ml-auto">Auto-rolls up</span>
                                          </div>

                                          {childMicroGoals.map(microGoal => {
                                            const childNanoGoals = getNanoGoalsOf(microGoal.id);
                                            const isMicroCollapsed = Boolean(collapsedGoalIds[microGoal.id]);
                                            const microBreakdown = computeGoalAggregateBreakdown(microGoal.id, {
                                              goals,
                                              tasks,
                                              milestones,
                                              habits,
                                              habitLogs,
                                              routines,
                                              workProjects,
                                              learningItems,
                                              skills,
                                              notes,
                                              journal
                                            });

                                            return (
                                              <div
                                                key={microGoal.id}
                                                className="rounded-lg border border-amber-200/70 bg-amber-50/20 p-2 sm:p-3 dark:border-amber-900/40 dark:bg-amber-950/15 space-y-2 transition-all min-w-0 shadow-2xs hover:border-amber-300 dark:hover:border-amber-800"
                                              >
                                                {/* Micro Goal Header */}
                                                <div className="space-y-1 min-w-0">
                                                  <div className="flex flex-wrap items-center justify-between gap-y-1.5 gap-x-2 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 min-w-0">
                                                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/50 shrink-0 whitespace-nowrap">
                                                        Micro Goal
                                                      </span>
                                                      {microGoal.targetDate && (
                                                        <>
                                                          <span className="text-slate-300 dark:text-slate-700 shrink-0">·</span>
                                                          <span className="shrink-0 whitespace-nowrap text-[11px] sm:text-xs">Due {microGoal.targetDate}</span>
                                                        </>
                                                      )}
                                                    </div>

                                                    <div className="flex items-center gap-1 shrink-0 ml-auto">
                                                      <button
                                                        type="button"
                                                        onClick={() => startAddChildGoal(microGoal, 4)}
                                                        className="inline-flex items-center gap-1 rounded-md border border-sky-200/80 bg-sky-50/70 px-2 py-0.5 text-[11px] sm:text-xs font-semibold text-sky-700 hover:bg-sky-100 dark:border-sky-800/80 dark:bg-sky-950/50 dark:text-sky-300 cursor-pointer transition-colors shrink-0 whitespace-nowrap"
                                                        title="Add Level 4 Nano Goal"
                                                      >
                                                        <Plus className="h-3 w-3 shrink-0" />
                                                        <span>Nano Goal</span>
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
                                                  onAdjustManualProgress={(delta) => handleProgressChange(microGoal, delta)}
                                                />

                                                {/* LEVEL 4: NANO GOALS ACCORDION */}
                                                {childNanoGoals.length > 0 && (
                                                  <div className="pt-1 border-t border-amber-200/50 dark:border-amber-900/30">
                                                    <button
                                                      type="button"
                                                      onClick={() => toggleCollapse(microGoal.id)}
                                                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer py-0.5 shrink-0"
                                                    >
                                                      <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${isMicroCollapsed ? '-rotate-90' : ''}`} />
                                                      <span>Nano Goals ({childNanoGoals.length})</span>
                                                    </button>

                                                    {!isMicroCollapsed && (
                                                      <div className="ml-1 sm:ml-2 pl-1.5 sm:pl-2.5 border-l-2 border-amber-200 dark:border-amber-900/50 space-y-1.5 pt-1.5 min-w-0">
                                                        {childNanoGoals.map(nanoGoal => {
                                                          const childAtomicGoals = getAtomicGoalsOf(nanoGoal.id);
                                                          const isNanoCollapsed = Boolean(collapsedGoalIds[nanoGoal.id]);
                                                          const nanoBreakdown = computeGoalAggregateBreakdown(nanoGoal.id, {
                                                            goals,
                                                            tasks,
                                                            milestones,
                                                            habits,
                                                            habitLogs,
                                                            routines,
                                                            workProjects,
                                                            learningItems,
                                                            skills,
                                                            notes,
                                                            journal
                                                          });

                                                          return (
                                                            <div
                                                              key={nanoGoal.id}
                                                              className="rounded-lg border border-sky-200/70 bg-sky-50/20 p-2 sm:p-2.5 dark:border-sky-900/40 dark:bg-sky-950/15 space-y-1.5 transition-all min-w-0 shadow-2xs hover:border-sky-300 dark:hover:border-sky-800"
                                                            >
                                                              {/* Nano Goal Header */}
                                                              <div className="space-y-1 min-w-0">
                                                                <div className="flex flex-wrap items-center justify-between gap-y-1.5 gap-x-2 min-w-0">
                                                                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 min-w-0">
                                                                    <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/50 shrink-0 whitespace-nowrap">
                                                                      Nano Goal
                                                                    </span>
                                                                    {nanoGoal.targetDate && (
                                                                      <>
                                                                        <span className="text-slate-300 dark:text-slate-700 shrink-0">·</span>
                                                                        <span className="shrink-0 whitespace-nowrap text-[11px] sm:text-xs">Due {nanoGoal.targetDate}</span>
                                                                      </>
                                                                    )}
                                                                  </div>

                                                                  <div className="flex items-center gap-1 shrink-0 ml-auto">
                                                                    <button
                                                                      type="button"
                                                                      onClick={() => startAddChildGoal(nanoGoal, 5)}
                                                                      className="inline-flex items-center gap-1 rounded-md border border-purple-200/80 bg-purple-50/70 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-semibold text-purple-700 hover:bg-purple-100 dark:border-purple-800/80 dark:bg-purple-950/50 dark:text-purple-300 cursor-pointer transition-colors shrink-0 whitespace-nowrap"
                                                                      title="Add Level 5 Atomic Goal"
                                                                    >
                                                                      <Plus className="h-3 w-3 shrink-0" />
                                                                      <span>Atomic Goal</span>
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
                                                                onAdjustManualProgress={(delta) => handleProgressChange(nanoGoal, delta)}
                                                              />

                                                              {/* LEVEL 5: ATOMIC GOALS CONTAINER */}
                                                              {childAtomicGoals.length > 0 && (
                                                                <div className="pt-1 border-t border-sky-200/50 dark:border-sky-900/30">
                                                                  <button
                                                                    type="button"
                                                                    onClick={() => toggleCollapse(nanoGoal.id)}
                                                                    className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer py-0.5 shrink-0"
                                                                  >
                                                                    <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform duration-200 shrink-0 ${isNanoCollapsed ? '-rotate-90' : ''}`} />
                                                                    <span>Atomic Goals ({childAtomicGoals.length})</span>
                                                                  </button>

                                                                  {!isNanoCollapsed && (
                                                                    <div className="ml-1 sm:ml-2 pl-1.5 sm:pl-2 border-l-2 border-sky-200 dark:border-sky-900/50 space-y-1 pt-1 min-w-0">
                                                                      {childAtomicGoals.map(atomicGoal => {
                                                                        const atomicBreakdown = computeGoalAggregateBreakdown(atomicGoal.id, {
                                                                          goals,
                                                                          tasks,
                                                                          milestones,
                                                                          habits,
                                                                          habitLogs,
                                                                          routines,
                                                                          workProjects,
                                                                          learningItems,
                                                                          skills,
                                                                          notes,
                                                                          journal
                                                                        });

                                                                        return (
                                                                          <div
                                                                            key={atomicGoal.id}
                                                                            className="group flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-md border border-purple-200/70 bg-purple-50/20 p-2 sm:p-2.5 text-xs dark:border-purple-900/40 dark:bg-purple-950/15 shadow-2xs hover:border-purple-300 dark:hover:border-purple-700 transition-all min-w-0"
                                                                          >
                                                                            <div className="flex items-start sm:items-center gap-2 min-w-0 w-full sm:flex-1">
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
                                                                                    ? 'border-purple-600 bg-purple-600 text-white'
                                                                                    : 'border-slate-300 bg-white text-transparent hover:border-purple-500 dark:border-slate-600 dark:bg-slate-800'
                                                                                }`}
                                                                                title={atomicGoal.progress >= 100 ? 'Mark Incomplete' : 'Mark Complete (100%)'}
                                                                              >
                                                                                ✓
                                                                              </button>
                                                                              <div className="min-w-0 flex-1">
                                                                                <div
                                                                                  className={`text-xs font-semibold leading-snug break-words ${
                                                                                    atomicGoal.progress >= 100
                                                                                      ? 'line-through text-slate-400 dark:text-slate-500 font-medium'
                                                                                      : 'text-slate-900 dark:text-slate-100'
                                                                                  }`}
                                                                                >
                                                                                  <span className="text-purple-600 dark:text-purple-400 font-bold mr-1 shrink-0">⚡</span>
                                                                                  {atomicGoal.title}
                                                                                </div>
                                                                                {atomicGoal.targetDate && (
                                                                                  <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                                                                                    Due {atomicGoal.targetDate}
                                                                                  </span>
                                                                                )}
                                                                              </div>
                                                                            </div>

                                                                            <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0 w-full sm:w-auto pt-1.5 sm:pt-0 border-t border-purple-200/50 sm:border-t-0 dark:border-purple-900/40">
                                                                              {atomicBreakdown.hasLinkedItems ? (
                                                                                <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-purple-600 dark:text-purple-400 shrink-0 whitespace-nowrap">
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
                                                                              <div className="flex items-center gap-1 shrink-0 ml-auto sm:ml-0">
                                                                                <button
                                                                                  type="button"
                                                                                  onClick={() => setEditingGoal(atomicGoal)}
                                                                                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md cursor-pointer shrink-0 hover:bg-purple-100/60 dark:hover:bg-purple-900/40"
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
                                                                              </div>
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
                      })
                  ) : (
                    /* FLAT LIST VIEW */
                    goals
                      .filter(g => levelFilter === 'all' || String(getGoalLevel(g)) === levelFilter)
                      .map(g => {
                        const lvl = getGoalLevel(g);
                        const parent = g.parentId ? goals.find(p => p.id === g.parentId) : null;

                        return (
                          <div
                            key={g.id}
                            className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-xs transition-all hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 space-y-3"
                          >
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                  <span
                                    className={`text-[11px] font-bold uppercase tracking-wider ${
                                      lvl === 1
                                        ? 'text-indigo-600 dark:text-indigo-400'
                                        : lvl === 2
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : lvl === 3
                                        ? 'text-amber-600 dark:text-amber-400'
                                        : lvl === 4
                                        ? 'text-sky-600 dark:text-sky-400'
                                        : 'text-purple-600 dark:text-purple-400'
                                    }`}
                                  >
                                    {lvl === 1
                                      ? '🎯 Main Goal'
                                      : lvl === 2
                                      ? '🔹 Sub Goal'
                                      : lvl === 3
                                      ? '▫️ Micro Goal'
                                      : lvl === 4
                                      ? '🔸 Nano Goal'
                                      : '⚡ Atomic Goal'}
                                  </span>
                                  {parent && (
                                    <>
                                      <span className="text-slate-300 dark:text-slate-700">·</span>
                                      <span className="text-slate-400 truncate max-w-[200px]">
                                        Parent: {parent.title}
                                      </span>
                                    </>
                                  )}
                                  <span className="text-slate-300 dark:text-slate-700">·</span>
                                  <span className="font-medium text-slate-700 dark:text-slate-300">
                                    {g.category || 'General'}
                                  </span>
                                  {g.targetDate && (
                                    <>
                                      <span className="text-slate-300 dark:text-slate-700">·</span>
                                      <span>Target {g.targetDate}</span>
                                    </>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 shrink-0 ml-auto">
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
                                </div>
                              </div>

                              <div className="w-full text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                                {g.title}
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                              <GoalLinkedBreakdownWidget
                                goal={g}
                                breakdown={computeGoalAggregateBreakdown(g.id, {
                                  goals,
                                  tasks,
                                  milestones,
                                  habits,
                                  habitLogs,
                                  routines,
                                  workProjects,
                                  learningItems,
                                  skills,
                                  notes,
                                  journal
                                })}
                                isExpanded={Boolean(expandedBreakdownGoalIds[g.id])}
                                onToggleExpand={() => toggleBreakdown(g.id)}
                                onQuickToggleTask={handleQuickToggleTask}
                                onQuickToggleMilestone={handleQuickToggleMilestone}
                                onAdjustManualProgress={(delta) => handleProgressChange(g, delta)}
                              />
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Strategies & Tactics (New & Fully Implemented!) */}
      {activeTab === 'strategies' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Add Strategy Form (5 cols) */}
          <div className="lg:col-span-5 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <span>Declare Tactical Strategy</span>
            </h2>

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
                  placeholder="e.g. Daily Deep Work Blocks, Asymmetric Leverage"
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
                  placeholder="Specify the exact operating tactics and execution plan..."
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Initiative Status
                </label>
                <select
                  value={stratStatus}
                  onChange={e => setStratStatus(e.target.value as any)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="active">Active Execution</option>
                  <option value="in-progress">In-Progress</option>
                  <option value="executed">Executed / Mastered</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 cursor-pointer"
              >
                + Commit Tactical Strategy
              </button>
            </form>
          </div>

          {/* Strategies List (7 cols) */}
          <div className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800 flex justify-between items-center">
              <span>Operational Strategies ({strategies.length})</span>
              <span className="text-[10px] text-slate-400 font-normal">Click status pill to cycle</span>
            </h2>

            <div className="mt-4 space-y-3">
              {strategies.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No strategies defined yet. Connect a tactic to your strategic goals.
                </div>
              ) : (
                [...strategies].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(s => (
                  <div key={s.id} className="rounded-2xl border border-slate-100 p-4 text-xs dark:border-slate-800 group transition-all hover:border-slate-200 dark:hover:border-slate-700 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
                        Goal: {getGoalTitleById(s.goalId)}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleStrategyStatus(s)}
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize cursor-pointer transition-colors ${
                            s.status === 'executed'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : s.status === 'in-progress'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                          }`}
                        >
                          {s.status}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ store: 'strategies', id: s.id, name: s.title })}
                          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all p-1"
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
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Milestones */}
      {activeTab === 'milestones' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Add Milestone to Strategic Goal
            </h2>
            <form onSubmit={handleAddMilestone} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Milestone Title</label>
                <input
                  type="text"
                  required
                  value={msTitle}
                  onChange={e => setMsTitle(e.target.value)}
                  placeholder="e.g. Complete Phase 1 MVP, Save First 20%"
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
                <input
                  type="date"
                  value={msDueDate}
                  onChange={e => setMsDueDate(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 cursor-pointer"
              >
                + Register Milestone
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Milestones Overview ({milestones.length})
            </h2>
            <div className="mt-4 space-y-2.5">
              {milestones.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">No milestones yet.</div>
              ) : (
                [...milestones].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '') || (b.createdAt || 0) - (a.createdAt || 0)).map(m => (
                  <div key={m.id} className="rounded-2xl border border-slate-100 p-3.5 text-xs dark:border-slate-800 flex justify-between items-center gap-3 group">
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
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                          <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{getGoalTitleById(m.goalId)}</span>
                          <span>·</span>
                          <span>Due: {m.dueDate || 'Ongoing'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold ${
                        m.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400'
                      }`}>
                        {m.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ store: 'milestones', id: m.id, name: m.title })}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all p-1"
                        title="Delete milestone"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: KPIs */}
      {activeTab === 'kpis' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Register Quantitative KPI
            </h2>
            <form onSubmit={handleAddKPI} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">KPI Metric Name</label>
                <input
                  type="text"
                  required
                  value={kpiName}
                  onChange={e => setKpiName(e.target.value)}
                  placeholder="e.g. Monthly Recurring Revenue, Coding Hours"
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
                    value={kpiTarget}
                    onChange={e => setKpiTarget(e.target.value)}
                    placeholder="10000"
                    className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Current</label>
                  <input
                    type="number"
                    value={kpiCurrent}
                    onChange={e => setKpiCurrent(e.target.value)}
                    placeholder="6500"
                    className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Unit</label>
                  <input
                    type="text"
                    value={kpiUnit}
                    onChange={e => setKpiUnit(e.target.value)}
                    placeholder="₹, reps, hrs"
                    className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 cursor-pointer"
              >
                + Save Metric Tracking
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Tracked Metrics ({kpis.length})
            </h2>
            <div className="mt-4 space-y-3">
              {kpis.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">No KPIs registered yet.</div>
              ) : (
                [...kpis].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(k => {
                  const target = Number(k.target) || 1;
                  const current = Number(k.current) || 0;
                  const pct = Math.min(100, (current / target) * 100);
                  return (
                    <div key={k.id} className="w-full rounded-2xl border border-slate-100 p-4 text-xs dark:border-slate-800 group">
                      <div className="flex justify-between items-start gap-2">
                        <div className="w-full flex-1 font-bold text-slate-900 dark:text-white text-sm leading-snug">
                          {k.name}
                        </div>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ store: 'kpis', id: k.id, name: k.name })}
                          className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 p-1"
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

                        {/* Quick adjustments */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleAdjustKPI(k, -1)}
                            className="h-5 w-5 rounded bg-slate-100 text-[10px] font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdjustKPI(k, 1)}
                            className="h-5 w-5 rounded bg-slate-100 text-[10px] font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Missions */}
      {activeTab === 'missions' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Declare Mission / Monthly Focus
            </h2>
            <form onSubmit={handleAddMission} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Mission Title</label>
                <input
                  type="text"
                  required
                  value={missionTitle}
                  onChange={e => setMissionTitle(e.target.value)}
                  placeholder="e.g. Launch AI Studio Applet to Production"
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
                    placeholder="e.g. October 2026"
                    className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Key Target</label>
                  <input
                    type="text"
                    value={missionTarget}
                    onChange={e => setMissionTarget(e.target.value)}
                    placeholder="100% test coverage"
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
                  placeholder="Daily core routine execution"
                  className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 cursor-pointer"
              >
                + Launch Mission
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Active Missions ({missions.length})
            </h2>
            <div className="mt-4 space-y-3">
              {missions.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">No active missions declared.</div>
              ) : (
                [...missions].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(m => (
                  <div key={m.id} className="rounded-2xl border border-slate-100 p-4 text-xs dark:border-slate-800 group">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{m.title}</div>
                        <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">{m.period}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ store: 'missions', id: m.id, name: m.title })}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Mentor & Reserves */}
      {activeTab === 'mentor' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 max-w-2xl">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
            Mentor Strategy & Capital Preservation
          </h2>

          <form onSubmit={handleSaveMentor} className="mt-4 space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Core Life Mission / Principle
              </label>
              <textarea
                rows={2}
                value={mentorMission}
                onChange={e => setMentorMission(e.target.value)}
                placeholder="Uncompromising discipline, strategic focus, and financial independence."
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Survival Reserve (₹)
                </label>
                <input
                  type="number"
                  value={survivalReserve}
                  onChange={e => setSurvivalReserve(Number(e.target.value))}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Daily Burn Rate (₹)
                </label>
                <input
                  type="number"
                  value={dailyBurn}
                  onChange={e => setDailyBurn(Number(e.target.value))}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Emergency Fund (₹)
                </label>
                <input
                  type="number"
                  value={emergencyReserve}
                  onChange={e => setEmergencyReserve(Number(e.target.value))}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Annual Savings Goal (₹)
                </label>
                <input
                  type="number"
                  value={savingGoal}
                  onChange={e => setSavingGoal(Number(e.target.value))}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 cursor-pointer"
            >
              Save Strategy & Allocation
            </button>
          </form>
        </div>
      )}

      {/* EDIT GOAL MODAL */}
      {editingGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-indigo-600" />
                <span>Edit Goal Details</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingGoal(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
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
                  <input
                    type="date"
                    value={editingGoal.targetDate || ''}
                    onChange={e => setEditingGoal({ ...editingGoal, targetDate: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Confirm Removal"
        message={deleteTarget ? `Are you sure you want to remove "${deleteTarget.name}"?` : ''}
        cloudNotice="Google Drive Cloud Sync: Deleting this goal/milestone removes it from your Google Drive backup automatically."
        confirmText="Remove"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
