import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar, Clock, AlertTriangle, Bell, BellRing, CheckCircle2,
  Circle, Play, ChevronRight, ChevronDown, Filter, Search,
  ArrowRight, Sparkles, Layers, Flame, ShieldAlert, RotateCcw,
  Check, Plus, X, Volume2, Target, Flag, AlertCircle, Compass,
  Briefcase, BookOpen, Award, Repeat, Zap, Edit3, Landmark,
  DollarSign, TrendingUp, ArrowUpRight, ShieldCheck
} from 'lucide-react';
import {
  Goal, Milestone, Task, ReminderItem, TaskPriority,
  WorkProject, LearningItem, Skill, Routine, Habit, HabitLog,
  FinanceTransaction, Loan, Investment, SavingsPlan, Liability, Asset
} from '../types';
import { storage, generateUUID } from '../lib/storage';
import { SlideTabs } from './SlideTabs';
import { alarmService } from '../lib/alarmService';
import { alarmAudio, BUILTIN_RINGTONES, useRingtoneOptions, getDefaultRingtoneId } from '../lib/alarmAudio';
import {
  syncGoalProgressFromTasks,
  syncGoalProgressFromProjects,
  syncGoalProgressFromLearning,
  syncGoalProgressFromSkills,
  syncGoalProgressFromRoutines,
  syncGoalProgressFromHabits
} from '../lib/goalTaskSync';

export interface ProjectTimelinePlanProps {
  goals: Goal[];
  milestones?: Milestone[];
  tasks?: Task[];
  workProjects?: WorkProject[];
  learningItems?: LearningItem[];
  skills?: Skill[];
  routines?: Routine[];
  habits?: Habit[];
  habitLogs?: HabitLog[];
  reminders?: ReminderItem[];
  transactions?: FinanceTransaction[];
  loans?: Loan[];
  investments?: Investment[];
  savingsPlans?: SavingsPlan[];
  liabilities?: Liability[];
  assets?: Asset[];
  initialStream?: TimelineStream;
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
}

export interface DelayInfo {
  isDelayed: boolean;
  delayDays: number;
  delayHours: number;
  severity: 'critical' | 'moderate' | 'mild' | 'none';
  label: string;
  isDueToday: boolean;
  isUpcoming: boolean;
  remainingDays: number;
}

export type TimelineStream = 'all' | 'projects' | 'learning' | 'skills' | 'routines' | 'tasks' | 'finance';

/**
 * Universal delay calculator for any date-bounded or time-bounded item
 */
export function computeItemDelay(item: {
  dueAt?: string;
  date?: string;
  dueDate?: string;
  targetDate?: string;
  scheduledAt?: string;
  due?: string;
  startTime?: string;
  endTime?: string;
  done?: boolean;
  status?: string;
  progress?: number;
  completedDate?: string | null;
  completedDates?: string[];
}): DelayInfo {
  const isDone = item.done === true || item.status === 'done' || item.status === 'completed' || item.status === 'Completed' || (item.progress !== undefined && item.progress >= 100);
  if (isDone) {
    return {
      isDelayed: false,
      delayDays: 0,
      delayHours: 0,
      severity: 'none',
      label: 'Completed',
      isDueToday: false,
      isUpcoming: false,
      remainingDays: 0
    };
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  // Check Routine delay for today
  if (item.startTime || item.endTime) {
    const isDoneToday = item.completedDate === todayStr || (item.completedDates && item.completedDates.includes(todayStr));
    if (isDoneToday) {
      return {
        isDelayed: false,
        delayDays: 0,
        delayHours: 0,
        severity: 'none',
        label: 'Done Today',
        isDueToday: true,
        isUpcoming: false,
        remainingDays: 0
      };
    }
    const now = new Date();
    const currentH = String(now.getHours()).padStart(2, '0');
    const currentM = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentH}:${currentM}`;
    const targetEnd = item.endTime || item.startTime || '23:59';

    if (currentTimeStr > targetEnd) {
      return {
        isDelayed: true,
        delayDays: 0,
        delayHours: 1,
        severity: 'moderate',
        label: 'Missed Today Block',
        isDueToday: true,
        isUpcoming: false,
        remainingDays: 0
      };
    } else {
      return {
        isDelayed: false,
        delayDays: 0,
        delayHours: 0,
        severity: 'none',
        label: `Scheduled ${item.startTime || ''}`,
        isDueToday: true,
        isUpcoming: true,
        remainingDays: 0
      };
    }
  }

  const rawDate = item.dueAt || item.date || item.dueDate || item.targetDate || item.due || item.scheduledAt;
  if (!rawDate) {
    return {
      isDelayed: false,
      delayDays: 0,
      delayHours: 0,
      severity: 'none',
      label: 'No Deadline',
      isDueToday: false,
      isUpcoming: false,
      remainingDays: 0
    };
  }

  const cleanStr = rawDate.includes('T') ? rawDate : `${rawDate}T23:59:59`;
  const dueDate = new Date(cleanStr);
  if (isNaN(dueDate.getTime())) {
    return {
      isDelayed: false,
      delayDays: 0,
      delayHours: 0,
      severity: 'none',
      label: 'Invalid Date',
      isDueToday: false,
      isUpcoming: false,
      remainingDays: 0
    };
  }

  const now = new Date();
  const diffMs = now.getTime() - dueDate.getTime();

  if (diffMs > 0) {
    const delayHours = Math.floor(diffMs / (1000 * 60 * 60));
    const delayDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    let severity: 'critical' | 'moderate' | 'mild' = 'mild';
    if (delayDays >= 3) severity = 'critical';
    else if (delayDays >= 1) severity = 'moderate';

    const label = delayDays > 0 ? `${delayDays}d overdue` : `${Math.max(1, delayHours)}h overdue`;
    return {
      isDelayed: true,
      delayDays,
      delayHours,
      severity,
      label,
      isDueToday: false,
      isUpcoming: false,
      remainingDays: 0
    };
  } else {
    const remainingMs = Math.abs(diffMs);
    const remainingDays = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
    const isDueToday = remainingDays === 0;

    return {
      isDelayed: false,
      delayDays: 0,
      delayHours: 0,
      severity: 'none',
      label: isDueToday ? 'Due Today' : `In ${remainingDays}d`,
      isDueToday,
      isUpcoming: !isDueToday,
      remainingDays
    };
  }
}

export const ProjectTimelinePlan: React.FC<ProjectTimelinePlanProps> = ({
  goals,
  milestones = [],
  tasks = [],
  workProjects = [],
  learningItems = [],
  skills = [],
  routines = [],
  habits = [],
  habitLogs = [],
  reminders = [],
  transactions = [],
  loans = [],
  investments = [],
  savingsPlans = [],
  liabilities = [],
  assets = [],
  initialStream,
  onRefresh,
  onSuccess
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const { ringtoneOptions, defaultRingtone } = useRingtoneOptions();

  // Views & Filters
  const [viewMode, setViewMode] = useState<'gantt' | 'hierarchy' | 'radar'>('gantt');
  const [activeStream, setActiveStream] = useState<TimelineStream>(initialStream || 'all');
  const [selectedGoalId, setSelectedGoalId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'delayed' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Finance stream states
  const [financeGoalLevelFilter, setFinanceGoalLevelFilter] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [financeOnlyLinked, setFinanceOnlyLinked] = useState<boolean>(false);
  const [expandedFinanceGoalId, setExpandedFinanceGoalId] = useState<string | null>(null);

  // Alarm modal state
  const [alarmTargetItem, setAlarmTargetItem] = useState<{
    id: string;
    title: string;
    type: 'task' | 'project' | 'learning' | 'skill' | 'routine' | 'habit';
    dueAt?: string;
  } | null>(null);
  const [alarmCustomTime, setAlarmCustomTime] = useState<string>('');
  const [alarmRingtone, setAlarmRingtone] = useState<string>(() => getDefaultRingtoneId());

  // Task Genesis Modal State (spawns task from any entity with deadline & alarm)
  const [genesisModal, setGenesisModal] = useState<{
    isOpen: boolean;
    sourceType: 'manual' | 'project' | 'learning' | 'skill' | 'routine' | 'habit';
    sourceId?: string;
    title: string;
    priority: TaskPriority;
    dueAt: string;
    goalId: string;
    armAlarm: boolean;
    ringtone: string;
    alarmTime: string;
  }>({
    isOpen: false,
    sourceType: 'manual',
    title: '',
    priority: 'High',
    dueAt: today,
    goalId: goals[0]?.id || '',
    armAlarm: true,
    ringtone: getDefaultRingtoneId(),
    alarmTime: '09:00'
  });

  // Map reminders by linkedId for instant lookup
  const reminderMap = useMemo(() => {
    const map = new Map<string, ReminderItem>();
    reminders.forEach(r => {
      if (r.linkedId && r.status === 'open') {
        map.set(r.linkedId, r);
      }
    });
    return map;
  }, [reminders]);

  // Goal Financial Metrics & Capital Allocation Computations
  const getGoalFinancialMetrics = (goalId: string) => {
    let goalIncome = 0;
    let goalExpense = 0;
    const goalTxs = transactions.filter(t => t.goalId === goalId);
    goalTxs.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') goalIncome += amt;
      else if (t.type === 'expense') goalExpense += amt;
    });

    const goalInvestments = investments.filter(i => i.goalId === goalId);
    const goalInvestmentsTotal = goalInvestments.reduce((sum, i) => sum + (Number(i.currentValue || i.amount) || 0), 0);

    const goalLoans = loans.filter(l => l.goalId === goalId);
    const goalLoansTotal = goalLoans.reduce((sum, l) => sum + (Number(l.outstanding) || 0), 0);

    const goalLiabilities = liabilities.filter(l => l.goalId === goalId);
    const goalLiabilitiesTotal = goalLiabilities.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

    const goalSavings = savingsPlans.filter(s => s.goalId === goalId);
    const goalSavingsTotal = goalSavings.reduce((sum, s) => sum + (Number(s.currentAmount) || 0), 0);

    const goalAssets = assets.filter(a => a.goalId === goalId);
    const goalAssetsTotal = goalAssets.reduce((sum, a) => sum + (Number(a.value) || 0), 0);

    const netCashFlow = goalIncome - goalExpense;
    const totalDebt = goalLoansTotal + goalLiabilitiesTotal;
    const hasAnyLink = goalTxs.length > 0 || goalInvestments.length > 0 || goalLoans.length > 0 || goalLiabilities.length > 0 || goalSavings.length > 0 || goalAssets.length > 0;

    return {
      txs: goalTxs,
      income: goalIncome,
      expense: goalExpense,
      netCashFlow,
      investments: goalInvestments,
      investmentsTotal: goalInvestmentsTotal,
      loans: goalLoans,
      loansTotal: goalLoansTotal,
      liabilities: goalLiabilities,
      liabilitiesTotal: goalLiabilitiesTotal,
      totalDebt,
      savings: goalSavings,
      savingsTotal: goalSavingsTotal,
      assets: goalAssets,
      assetsTotal: goalAssetsTotal,
      hasAnyLink
    };
  };

  const financiallyLinkedGoals = useMemo(() => {
    return goals.filter(g => getGoalFinancialMetrics(g.id).hasAnyLink);
  }, [goals, transactions, investments, loans, liabilities, savingsPlans, assets]);

  const totalFinanceIncome = useMemo(() => {
    return transactions.filter(t => t.goalId && t.type === 'income').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [transactions]);

  const totalFinanceExpense = useMemo(() => {
    return transactions.filter(t => t.goalId && t.type === 'expense').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [transactions]);

  const totalFinanceInvestments = useMemo(() => {
    return investments.filter(i => i.goalId).reduce((sum, i) => sum + (Number(i.currentValue || i.amount) || 0), 0);
  }, [investments]);

  const totalFinanceDebt = useMemo(() => {
    const loanD = loans.filter(l => l.goalId).reduce((sum, l) => sum + (Number(l.outstanding) || 0), 0);
    const liabD = liabilities.filter(li => li.goalId).reduce((sum, li) => sum + (Number(li.amount) || 0), 0);
    return loanD + liabD;
  }, [loans, liabilities]);

  const filteredFinanceGoals = useMemo(() => {
    return goals.filter(g => {
      if (selectedGoalId !== 'all' && g.id !== selectedGoalId) return false;
      if (financeGoalLevelFilter !== 'all' && String(g.level || 1) !== financeGoalLevelFilter) return false;
      if (financeOnlyLinked && !getGoalFinancialMetrics(g.id).hasAnyLink) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = `${g.title} ${g.category || ''} ${g.description || ''}`.toLowerCase();
        if (!match.includes(q)) return false;
      }
      return true;
    });
  }, [goals, selectedGoalId, financeGoalLevelFilter, financeOnlyLinked, searchQuery, transactions, investments, loans, liabilities, savingsPlans, assets]);

  const getGoalLevelMeta = (level?: number) => {
    switch (level) {
      case 2:
        return {
          name: 'Sub Goal',
          icon: '🔹',
          badgeStyle: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
        };
      case 3:
        return {
          name: 'Micro Goal',
          icon: '▫️',
          badgeStyle: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300'
        };
      case 4:
        return {
          name: 'Nano Goal',
          icon: '🔸',
          badgeStyle: 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-300'
        };
      case 5:
        return {
          name: 'Atomic Goal',
          icon: '⚡',
          badgeStyle: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
        };
      default:
        return {
          name: 'Main Goal',
          icon: '🎯',
          badgeStyle: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300'
        };
    }
  };

  // Compute Delays across ALL streams
  const annotatedTasks = useMemo(() => {
    return tasks.map(t => ({
      ...t,
      streamType: 'task' as const,
      delay: computeItemDelay(t),
      goal: goals.find(g => g.id === t.goalId),
      hasActiveAlarm: Boolean(reminderMap.get(t.id)?.alarmEnabled),
      reminder: reminderMap.get(t.id)
    }));
  }, [tasks, goals, reminderMap]);

  const annotatedProjects = useMemo(() => {
    return workProjects.map(p => ({
      ...p,
      streamType: 'project' as const,
      delay: computeItemDelay({ ...p, dueAt: p.due }),
      goal: goals.find(g => g.id === p.goalId),
      hasActiveAlarm: Boolean(reminderMap.get(p.id)?.alarmEnabled),
      reminder: reminderMap.get(p.id)
    }));
  }, [workProjects, goals, reminderMap]);

  const annotatedLearning = useMemo(() => {
    return learningItems.map(l => ({
      ...l,
      streamType: 'learning' as const,
      delay: computeItemDelay(l),
      goal: goals.find(g => g.id === l.goalId),
      hasActiveAlarm: Boolean(reminderMap.get(l.id)?.alarmEnabled),
      reminder: reminderMap.get(l.id)
    }));
  }, [learningItems, goals, reminderMap]);

  const annotatedSkills = useMemo(() => {
    return skills.map(s => ({
      ...s,
      streamType: 'skill' as const,
      delay: computeItemDelay({ ...s, targetDate: s.targetDate, dueAt: s.targetDate, progress: s.progress }),
      goal: goals.find(g => g.id === s.goalId),
      hasActiveAlarm: Boolean(reminderMap.get(s.id)?.alarmEnabled),
      reminder: reminderMap.get(s.id)
    }));
  }, [skills, goals, reminderMap]);

  const annotatedRoutines = useMemo(() => {
    return routines.map(r => ({
      ...r,
      streamType: 'routine' as const,
      delay: computeItemDelay(r),
      goal: goals.find(g => g.id === r.goalId),
      hasActiveAlarm: Boolean(reminderMap.get(r.id)?.alarmEnabled),
      reminder: reminderMap.get(r.id)
    }));
  }, [routines, goals, reminderMap]);

  // Combined Delayed Items across ALL entities
  const delayedTasks = useMemo(() => annotatedTasks.filter(t => t.delay.isDelayed && !t.done), [annotatedTasks]);
  const delayedProjects = useMemo(() => annotatedProjects.filter(p => p.delay.isDelayed && p.status !== 'Completed'), [annotatedProjects]);
  const delayedRoutines = useMemo(() => annotatedRoutines.filter(r => r.delay.isDelayed), [annotatedRoutines]);
  const delayedLearning = useMemo(() => annotatedLearning.filter(l => l.delay.isDelayed && l.progress < 100), [annotatedLearning]);
  const delayedSkills = useMemo(() => annotatedSkills.filter(s => s.delay.isDelayed && (s.progress || 0) < 100), [annotatedSkills]);

  const totalDelayedAllCount = delayedTasks.length + delayedProjects.length + delayedRoutines.length + delayedLearning.length + delayedSkills.length;
  const totalItemsAllCount = tasks.length + workProjects.length + learningItems.length + skills.length + routines.length;
  const onTimeHealthRate = totalItemsAllCount > 0
    ? Math.max(0, Math.round(((totalItemsAllCount - totalDelayedAllCount) / totalItemsAllCount) * 100))
    : 100;

  // Instant Alarm Trigger (immediate sound & modal alert)
  const handleTriggerAlarmNow = (title: string, subtitle?: string, id?: string) => {
    alarmService.triggerAlarm({
      id: id || generateUUID(),
      type: 'reminder',
      title: `🚨 DELAY ALERT: ${title}`,
      subtitle: subtitle || 'Overdue beyond planned schedule! Time to execute now.',
      timeStr: 'NOW',
      ringtone: 'digital_pulse'
    });
    onSuccess(`🚨 Urgent alarm ringing for "${title}"!`);
  };

  // Schedule Reminder Alarm for any item
  const handleScheduleAlarm = async (targetId: string, title: string, targetDateStr: string, chosenRingtone: string = 'digital_pulse') => {
    const reminderId = generateUUID();
    const newReminder: ReminderItem = {
      id: reminderId,
      title: `⏰ Urgent Alarm: ${title}`,
      dueAt: targetDateStr,
      repeatRule: 'none',
      status: 'open',
      linkedId: targetId,
      alarmEnabled: true,
      ringtone: chosenRingtone,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await storage.put('reminders', newReminder);
    setAlarmTargetItem(null);
    onSuccess(`🔔 Alarm scheduled for "${title}" at ${targetDateStr.replace('T', ' ')}`);
    onRefresh();
  };

  // Open Universal Task Genesis Dialog
  const handleOpenTaskGenesis = (source: {
    type: 'manual' | 'project' | 'learning' | 'skill' | 'routine' | 'habit';
    id?: string;
    title: string;
    goalId?: string | null;
    due?: string;
  }) => {
    let defaultTitle = source.title;
    if (source.type === 'project') defaultTitle = `Deliverable: ${source.title}`;
    else if (source.type === 'learning') defaultTitle = `Study Session: ${source.title}`;
    else if (source.type === 'skill') defaultTitle = `Practice Drill: ${source.title}`;
    else if (source.type === 'routine') defaultTitle = `Execute Routine: ${source.title}`;
    else if (source.type === 'habit') defaultTitle = `Daily Practice: ${source.title}`;

    setGenesisModal({
      isOpen: true,
      sourceType: source.type,
      sourceId: source.id,
      title: defaultTitle,
      priority: 'High',
      dueAt: source.due || today,
      goalId: source.goalId || goals[0]?.id || '',
      armAlarm: true,
      ringtone: defaultRingtone,
      alarmTime: '09:00'
    });
  };

  // Save Genesis Task + Alarm
  const handleSaveGenesisTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genesisModal.title.trim()) return;

    const taskId = generateUUID();
    const newTask: Task = {
      id: taskId,
      title: genesisModal.title.trim(),
      domain: genesisModal.sourceType === 'routine' || genesisModal.sourceType === 'habit' ? 'health' : 'work',
      priority: genesisModal.priority,
      dueAt: genesisModal.dueAt,
      date: genesisModal.dueAt,
      goalId: genesisModal.goalId || null,
      projectId: genesisModal.sourceType === 'project' ? genesisModal.sourceId : null,
      done: false,
      status: 'open',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await storage.put('tasks', newTask);

    // Rollup goal progress
    if (genesisModal.goalId) {
      await syncGoalProgressFromTasks(genesisModal.goalId, taskId, false);
    }

    // Schedule audio alarm if requested
    if (genesisModal.armAlarm) {
      const alarmDueAtStr = `${genesisModal.dueAt}T${genesisModal.alarmTime}`;
      const rem: ReminderItem = {
        id: generateUUID(),
        title: `⏰ Task Genesis Alarm: ${newTask.title}`,
        dueAt: alarmDueAtStr,
        repeatRule: 'none',
        status: 'open',
        linkedType: 'task',
        linkedId: taskId,
        alarmEnabled: true,
        ringtone: genesisModal.ringtone,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await storage.put('reminders', rem);
    }

    setGenesisModal(prev => ({ ...prev, isOpen: false }));
    onSuccess(`⚡ Task Genesis complete! "${newTask.title}" added to pipeline with reminder alarm.`);
    onRefresh();
  };

  // Batch Arm Alarms for All Delayed Items across projects & tasks
  const handleArmAlarmsForAllDelayed = async () => {
    if (totalDelayedAllCount === 0) {
      onSuccess('No delayed items found! Entire operating plan is on track.');
      return;
    }

    let armed = 0;
    const nowTime = Date.now();

    // 1. Delayed Tasks
    for (let i = 0; i < delayedTasks.length; i++) {
      const task = delayedTasks[i];
      if (reminderMap.has(task.id)) continue;
      const targetTime = new Date(nowTime + (5 + armed * 2) * 60 * 1000);
      const str = targetTime.toISOString().slice(0, 16);
      await storage.put('reminders', {
        id: generateUUID(),
        title: `⏰ Delayed Task: ${task.title}`,
        dueAt: str,
        repeatRule: 'none',
        status: 'open',
        linkedId: task.id,
        alarmEnabled: true,
        ringtone: 'digital_pulse',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      armed++;
    }

    // 2. Delayed Projects
    for (const proj of delayedProjects) {
      if (reminderMap.has(proj.id)) continue;
      const targetTime = new Date(nowTime + (5 + armed * 2) * 60 * 1000);
      const str = targetTime.toISOString().slice(0, 16);
      await storage.put('reminders', {
        id: generateUUID(),
        title: `⏰ Delayed Project: ${proj.name}`,
        dueAt: str,
        repeatRule: 'none',
        status: 'open',
        linkedId: proj.id,
        alarmEnabled: true,
        ringtone: 'classic_clock',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      armed++;
    }

    // 3. Delayed Routines
    for (const rt of delayedRoutines) {
      if (reminderMap.has(rt.id)) continue;
      const targetTime = new Date(nowTime + (5 + armed * 2) * 60 * 1000);
      const str = targetTime.toISOString().slice(0, 16);
      await storage.put('reminders', {
        id: generateUUID(),
        title: `⏰ Missed Routine: ${rt.name}`,
        dueAt: str,
        repeatRule: 'none',
        status: 'open',
        linkedId: rt.id,
        alarmEnabled: true,
        ringtone: 'zen_bell',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      armed++;
    }

    // 4. Delayed Learning Tracks
    for (const learn of delayedLearning) {
      if (reminderMap.has(learn.id)) continue;
      const targetTime = new Date(nowTime + (5 + armed * 2) * 60 * 1000);
      const str = targetTime.toISOString().slice(0, 16);
      await storage.put('reminders', {
        id: generateUUID(),
        title: `⏰ Delayed Study: ${learn.title}`,
        dueAt: str,
        repeatRule: 'none',
        status: 'open',
        linkedId: learn.id,
        alarmEnabled: true,
        ringtone: 'morning_chime',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      armed++;
    }

    // 5. Delayed Skills
    for (const sk of delayedSkills) {
      if (reminderMap.has(sk.id)) continue;
      const targetTime = new Date(nowTime + (5 + armed * 2) * 60 * 1000);
      const str = targetTime.toISOString().slice(0, 16);
      await storage.put('reminders', {
        id: generateUUID(),
        title: `⏰ Skill Practice Delay: ${sk.name}`,
        dueAt: str,
        repeatRule: 'none',
        status: 'open',
        linkedId: sk.id,
        alarmEnabled: true,
        ringtone: 'zen_bell',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      armed++;
    }

    onSuccess(`🔔 Armed reminder alarms for ${armed} delayed items across projects, learning, skills & routines!`);
    onRefresh();
  };

  // Quick Complete Actions
  const handleCompleteTask = async (task: Task) => {
    const updated: Task = { ...task, done: true, status: 'done', updatedAt: Date.now() };
    await storage.put('tasks', updated);
    if (task.goalId) await syncGoalProgressFromTasks(task.goalId, task.id, true);
    onSuccess(`✓ Task completed: "${task.title}"`);
    onRefresh();
  };

  const handleToggleProject = async (proj: WorkProject) => {
    const isCompleted = proj.status === 'Completed';
    const nextStatus = isCompleted ? 'Active' : 'Completed';
    const nextProg = isCompleted ? 35 : 100;
    const updated = { ...proj, status: nextStatus, progress: nextProg, updatedAt: Date.now() };
    await storage.put('workProjects', updated);
    if (proj.goalId) await syncGoalProgressFromProjects(proj.goalId);
    onSuccess(nextStatus === 'Completed' ? `✓ Project Deliverable completed: "${proj.name}"` : `Project set to active`);
    onRefresh();
  };

  const handleCompleteRoutineToday = async (routine: Routine) => {
    const dates = routine.completedDates || [];
    const nextDates = dates.includes(today) ? dates.filter(d => d !== today) : [...dates, today];
    const isDone = nextDates.includes(today);
    const updated = {
      ...routine,
      completedDate: isDone ? today : null,
      completedDates: nextDates,
      updatedAt: Date.now()
    };
    await storage.put('routines', updated);
    if (routine.goalId) await syncGoalProgressFromRoutines(routine.goalId);
    onSuccess(isDone ? `✓ Routine "${routine.name}" marked complete for today!` : `Routine unchecked`);
    onRefresh();
  };

  // Timeline Date calculations for Gantt View
  const timelineRange = useMemo(() => {
    const t = new Date();
    const days = [];
    for (let i = -4; i <= 16; i++) {
      const d = new Date(t);
      d.setDate(t.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      days.push({
        dateStr,
        dayNum: d.getDate(),
        dayName: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
        isToday: i === 0,
        isWeekend: d.getDay() === 0 || d.getDay() === 6
      });
    }
    return days;
  }, []);

  return (
    <div className="space-y-5">
      {/* 1. EXECUTIVE METRICS DASHBOARD */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* Card 1: Project Health Score */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Overall Health</span>
            <Target className="h-4 w-4 text-amber-500 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">
            {onTimeHealthRate}%
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            {onTimeHealthRate >= 80 ? 'On Track · Optimal' : 'Needs attention'}
          </div>
        </div>

        {/* Card 2: Total Delayed Items */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Total Delays</span>
            <AlertTriangle className={`h-4 w-4 shrink-0 ${totalDelayedAllCount > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
          </div>
          <div className={`mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums truncate ${totalDelayedAllCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
            {totalDelayedAllCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            {totalDelayedAllCount > 0
              ? `${delayedTasks.length} tasks · ${delayedProjects.length} projects · ${delayedRoutines.length} routines`
              : '0 tasks · 0 projects · 0 routines'}
          </div>
        </div>

        {/* Card 3: Active Deliverables */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Active Deliverables</span>
            <Briefcase className="h-4 w-4 text-emerald-500 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">
            {workProjects.length + learningItems.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            {workProjects.length} projects · {skills.length} skills
          </div>
        </div>

        {/* Card 4: Armed Alarms Count */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Armed Alarms</span>
            <BellRing className="h-4 w-4 text-amber-500 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">
            {reminderMap.size}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            Background synthesizer active
          </div>
        </div>
      </div>

      {/* 2. URGENT DELAY ACTION BANNER */}
      {totalDelayedAllCount > 0 && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-rose-500/40 bg-gradient-to-r from-rose-500/15 via-rose-500/10 to-amber-500/15 p-4 sm:p-5 dark:border-rose-500/30">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                <span>Time-Delay Detected</span>
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {totalDelayedAllCount} items delayed across Tasks, Projects, and Daily Routines!
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Inhe time se execute karne ke liye Task Genesis se action unit banayein ya reminder alarm arm karein.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const firstDelayed = delayedTasks[0] || delayedProjects[0] || delayedRoutines[0];
                  if (firstDelayed) {
                    handleTriggerAlarmNow((firstDelayed as any).title || (firstDelayed as any).name);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-500 active:scale-95 transition-all cursor-pointer"
              >
                <BellRing className="h-4 w-4 animate-bounce" />
                <span>🚨 Ring Urgent Alarm</span>
              </button>

              <button
                type="button"
                onClick={handleArmAlarmsForAllDelayed}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3.5 py-2 text-xs font-bold text-rose-700 shadow-sm hover:bg-rose-50 active:scale-95 transition-all cursor-pointer dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-slate-800"
              >
                <Bell className="h-4 w-4" />
                <span>Arm Alarms for All ({totalDelayedAllCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('radar')}
                className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 cursor-pointer"
              >
                <span>Delay Radar</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MULTI-STREAM ARCHITECTURE NAVIGATOR (Full-Width Responsive for Mobile, Tab & Desktop) */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 w-full">
        {/* Stream Tabs (Full-Width Responsive Slide Tab) */}
        <div className="w-full">
          <SlideTabs
            activeId={activeStream}
            onChange={(id) => setActiveStream(id as any)}
            tabs={[
              { id: 'all', label: 'All Streams', shortLabel: 'All', icon: Layers, badge: totalItemsAllCount },
              { id: 'projects', label: 'Work Projects', shortLabel: 'Projects', icon: Briefcase, badge: workProjects.length, delayed: delayedProjects.length },
              { id: 'learning', label: 'Learning Tracks', shortLabel: 'Learning', icon: BookOpen, badge: learningItems.length, delayed: delayedLearning.length },
              { id: 'skills', label: 'Skill Trees', shortLabel: 'Skills', icon: Award, badge: skills.length },
              { id: 'routines', label: 'Routines & Habits', shortLabel: 'Routines', icon: Repeat, badge: routines.length + habits.length, delayed: delayedRoutines.length },
              { id: 'tasks', label: 'Tasks & Planner', shortLabel: 'Tasks', icon: CheckCircle2, badge: tasks.length, delayed: delayedTasks.length },
              { id: 'finance', label: 'Goal Financial Portfolio', shortLabel: 'Financials', icon: Landmark, badge: financiallyLinkedGoals.length || goals.length }
            ]}
          />
        </div>

        {/* View Mode & Sub-filters + Task Genesis (Fully responsive across Mobile, Tab, Laptop & Desktop) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 border-t border-slate-100 pt-3 dark:border-slate-800 w-full">
          {/* Task Genesis Trigger */}
          <button
            type="button"
            onClick={() => handleOpenTaskGenesis({ type: 'manual', title: '' })}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-purple-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:opacity-95 active:scale-95 transition-all cursor-pointer shrink-0 whitespace-nowrap"
            title="Deploy Task Genesis Unit"
          >
            <Zap className="h-3.5 w-3.5 text-amber-200 shrink-0" />
            <span>⚡ Task Genesis Unit</span>
          </button>
          {activeStream === 'finance' ? (
            /* Sub-filters when Goal Financial Portfolio is selected */
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 w-full">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Search className="h-4 w-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search goals by title or category..."
                  className="w-full bg-transparent text-xs text-slate-900 dark:text-white outline-none placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
                <select
                  value={financeGoalLevelFilter}
                  onChange={e => setFinanceGoalLevelFilter(e.target.value as any)}
                  className="h-8 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value="all">All 5 Branches</option>
                  <option value="1">🎯 Main Goals (Level 1)</option>
                  <option value="2">🔹 Sub Goals (Level 2)</option>
                  <option value="3">▫️ Micro Goals (Level 3)</option>
                  <option value="4">🔸 Nano Goals (Level 4)</option>
                  <option value="5">⚡ Atomic Goals (Level 5)</option>
                </select>

                <button
                  type="button"
                  onClick={() => setFinanceOnlyLinked(prev => !prev)}
                  className={`h-8 rounded-xl px-2.5 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    financeOnlyLinked
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {financeOnlyLinked ? '🔗 Linked Only' : 'Show All Goals'}
                </button>
              </div>
            </div>
          ) : (
            /* Standard View Mode Switcher for Gantt, Operating Plan & Delay Radar */
            <>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl dark:bg-slate-800 overflow-x-auto no-scrollbar shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('gantt')}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    viewMode === 'gantt' ? 'bg-white text-indigo-600 shadow-2xs dark:bg-slate-900 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  <Calendar className="h-3 w-3" />
                  <span>Gantt Roadmap</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('hierarchy')}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    viewMode === 'hierarchy' ? 'bg-white text-indigo-600 shadow-2xs dark:bg-slate-900 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  <Layers className="h-3 w-3" />
                  <span>Operating Plan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('radar')}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    viewMode === 'radar' ? 'bg-white text-rose-600 shadow-2xs dark:bg-slate-900 dark:text-rose-400' : 'text-slate-500 hover:text-rose-600 dark:text-slate-400'
                  }`}
                >
                  <ShieldAlert className="h-3 w-3" />
                  <span>Delay Radar</span>
                </button>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <select
                  value={selectedGoalId}
                  onChange={e => setSelectedGoalId(e.target.value)}
                  className="h-8 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value="all">All Goals ({goals.length})</option>
                  {goals.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.title} ({g.progress}%)
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as any)}
                  className="h-8 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="delayed">⚠️ Delayed Only</option>
                  <option value="pending">In Progress / Pending</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 4. GOAL FINANCIAL PORTFOLIO & CAPITAL STREAM (Active when Goal Financial Portfolio stream tab is selected) */}
      {activeStream === 'finance' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Top KPI Cards for Strategic Goal Financial Alignment */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tracked Goals</span>
              <div className="mt-1 font-mono text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                {financiallyLinkedGoals.length} <span className="text-xs font-normal text-slate-400">/ {goals.length}</span>
              </div>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">With Financial Links</span>
            </div>

            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 shadow-2xs dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Goal Income</span>
              <div className="mt-1 font-mono text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                ₹{totalFinanceIncome.toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Earned across goals</span>
            </div>

            <div className="rounded-2xl border border-rose-200/80 bg-rose-50/40 p-3.5 shadow-2xs dark:border-rose-900/60 dark:bg-rose-950/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">Goal Expenses</span>
              <div className="mt-1 font-mono text-xl sm:text-2xl font-extrabold text-rose-600 dark:text-rose-400">
                ₹{totalFinanceExpense.toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">Spent on goal executions</span>
            </div>

            <div className="rounded-2xl border border-blue-200/80 bg-blue-50/40 p-3.5 shadow-2xs dark:border-blue-900/60 dark:bg-blue-950/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Investments</span>
              <div className="mt-1 font-mono text-xl sm:text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                ₹{totalFinanceInvestments.toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Assets backing goals</span>
            </div>

            <div className="rounded-2xl border border-purple-200/80 bg-purple-50/40 p-3.5 shadow-2xs dark:border-purple-900/60 dark:bg-purple-950/20 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">Goal Debt & Loans</span>
              <div className="mt-1 font-mono text-xl sm:text-2xl font-extrabold text-purple-600 dark:text-purple-400">
                ₹{totalFinanceDebt.toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">Liabilities allocated</span>
            </div>
          </div>

          {/* Goal Financial Cards */}
          <div className="space-y-3">
            {filteredFinanceGoals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900 space-y-2">
                <Landmark className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-700" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Goals Found</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {financeOnlyLinked
                    ? 'None of the filtered goals currently have linked transactions, loans or investments. Switch to "Show All Goals" to view all targets.'
                    : 'Try clearing your search query or branch level filter.'}
                </p>
              </div>
            ) : (
              filteredFinanceGoals.map(goal => {
                const metrics = getGoalFinancialMetrics(goal.id);
                const isExpanded = expandedFinanceGoalId === goal.id;
                const levelMeta = getGoalLevelMeta(goal.level);

                return (
                  <div
                    key={goal.id}
                    className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3 transition-all"
                  >
                    {/* Goal Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold border ${levelMeta.badgeStyle}`}>
                          {levelMeta.icon} {levelMeta.name}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {goal.title}
                        </h4>
                        <span className="text-[11px] text-slate-400 shrink-0 font-medium hidden xs:inline">
                          ({goal.category || 'General'})
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-24 sm:w-28 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              goal.progress >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                            }`}
                            style={{ width: `${goal.progress}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                          {goal.progress}%
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedFinanceGoalId(isExpanded ? null : goal.id)}
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40 cursor-pointer transition-colors"
                        >
                          <span>{isExpanded ? 'Hide Details' : 'View Ledger'}</span>
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {/* Goal Financial Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                      <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/80">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Income</div>
                        <div className="font-mono text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-300 truncate">
                          ₹{metrics.income.toLocaleString('en-IN')}
                        </div>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/80">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Expenses</div>
                        <div className="font-mono text-xs sm:text-sm font-bold text-rose-700 dark:text-rose-300 truncate">
                          ₹{metrics.expense.toLocaleString('en-IN')}
                        </div>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/80">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Net Flow</div>
                        <div className={`font-mono text-xs sm:text-sm font-bold truncate ${
                          metrics.netCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          ₹{metrics.netCashFlow.toLocaleString('en-IN')}
                        </div>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/80">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Investments</div>
                        <div className="font-mono text-xs sm:text-sm font-bold text-blue-700 dark:text-blue-300 truncate">
                          ₹{metrics.investmentsTotal.toLocaleString('en-IN')}
                        </div>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/80">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Debt & Loans</div>
                        <div className="font-mono text-xs sm:text-sm font-bold text-purple-700 dark:text-purple-300 truncate">
                          ₹{metrics.totalDebt.toLocaleString('en-IN')}
                        </div>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/80">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Savings Target</div>
                        <div className="font-mono text-xs sm:text-sm font-bold text-amber-700 dark:text-amber-300 truncate">
                          ₹{metrics.savingsTotal.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Ledger & Asset Breakdown */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 pt-3 dark:border-slate-800 space-y-3 animate-in fade-in duration-150">
                        {/* Transactions Table */}
                        {metrics.txs.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              Linked Transactions ({metrics.txs.length})
                            </span>
                            <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800 max-h-48 overflow-y-auto">
                              {metrics.txs.map(t => (
                                <div key={t.id} className="flex items-center justify-between p-2 text-xs">
                                  <div className="min-w-0 pr-2">
                                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                                      {t.category} {t.note ? `· ${t.note}` : ''}
                                    </span>
                                    <span className="text-[10px] text-slate-400">{t.date} · {t.type}</span>
                                  </div>
                                  <span className={`font-mono font-bold shrink-0 ${
                                    t.type === 'income' ? 'text-emerald-600' : 'text-slate-900 dark:text-white'
                                  }`}>
                                    {t.type === 'income' ? '+' : '-'}₹{t.amount.toLocaleString('en-IN')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Loans & Liabilities */}
                        {(metrics.loans.length > 0 || metrics.liabilities.length > 0) && (
                          <div className="space-y-1.5">
                            <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                              Linked Loans & Debt
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {metrics.loans.map(l => (
                                <div key={l.id} className="rounded-xl border border-purple-200 bg-purple-50/40 p-2 text-xs dark:border-purple-900 dark:bg-purple-950/20">
                                  <div className="font-bold text-slate-900 dark:text-white">{l.name} (Loan)</div>
                                  <div className="font-mono text-purple-700 dark:text-purple-300 font-bold">
                                    Outstanding: ₹{Number(l.outstanding).toLocaleString('en-IN')}
                                  </div>
                                </div>
                              ))}
                              {metrics.liabilities.map(li => (
                                <div key={li.id} className="rounded-xl border border-rose-200 bg-rose-50/40 p-2 text-xs dark:border-rose-900 dark:bg-rose-950/20">
                                  <div className="font-bold text-slate-900 dark:text-white">{li.name} (Liability)</div>
                                  <div className="font-mono text-rose-700 dark:text-rose-300 font-bold">
                                    Amount: ₹{Number(li.amount).toLocaleString('en-IN')}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Investments */}
                        {metrics.investments.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                              Linked Investments & Assets ({metrics.investments.length})
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {metrics.investments.map(i => (
                                <div key={i.id} className="rounded-xl border border-blue-200 bg-blue-50/40 p-2 text-xs dark:border-blue-900 dark:bg-blue-950/20">
                                  <div className="font-bold text-slate-900 dark:text-white">{i.name}</div>
                                  <div className="font-mono text-blue-700 dark:text-blue-300 font-bold">
                                    Current Value: ₹{Number(i.currentValue || i.amount).toLocaleString('en-IN')}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {!metrics.hasAnyLink && (
                          <div className="text-center py-3 text-xs text-slate-400">
                            No financial items linked yet. In Finance & Ledger, toggle "[🔗 Link Goal]" when adding transactions, loans or investments to connect them to this goal!
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 4. GANTT ROADMAP VIEW ACROSS ALL STREAMS */}
      {viewMode === 'gantt' && activeStream !== 'finance' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span className="font-semibold text-slate-900 dark:text-white">
                Multi-Stream Execution Schedule
              </span>
              <span className="text-slate-400">· Projects, Learning, Routines & Tasks</span>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                <span>Delayed / Overdue</span>
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                <span>On Track</span>
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Completed</span>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <div className="min-w-[850px]">
              {/* Day Header Row */}
              <div className="grid grid-cols-[280px_repeat(21,1fr)] border-b border-slate-200 bg-slate-100/50 text-center text-[10px] font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <div className="p-2 text-left pl-4 font-semibold text-slate-700 dark:text-slate-300">
                  Item / Stream / Genesis
                </div>
                {timelineRange.map(d => (
                  <div
                    key={d.dateStr}
                    className={`p-1.5 border-l border-slate-200/60 dark:border-slate-800/60 ${
                      d.isToday ? 'bg-rose-500 text-white font-black dark:bg-rose-600' : d.isWeekend ? 'bg-slate-200/40 dark:bg-slate-800/80' : ''
                    }`}
                  >
                    <div>{d.dayName}</div>
                    <div className="text-[11px]">{d.dayNum}</div>
                  </div>
                ))}
              </div>

              {/* Rows Grouped by Goal */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {(selectedGoalId === 'all' ? goals : goals.filter(g => g.id === selectedGoalId)).map(goal => {
                  const goalTasks = annotatedTasks.filter(t => t.goalId === goal.id);
                  const goalProjects = annotatedProjects.filter(p => p.goalId === goal.id);
                  const goalLearning = annotatedLearning.filter(l => l.goalId === goal.id);
                  const goalRoutines = annotatedRoutines.filter(r => r.goalId === goal.id);

                  return (
                    <div key={goal.id} className="space-y-1">
                      {/* Goal Bar */}
                      <div className="grid grid-cols-[280px_repeat(21,1fr)] items-center bg-slate-50/70 p-2 hover:bg-slate-100/60 dark:bg-slate-900/60 dark:hover:bg-slate-800/50 transition-colors">
                        <div className="pr-3 pl-3 flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Target className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {goal.title}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Target: {goal.targetDate || 'Ongoing'} · <span className="font-semibold text-indigo-600 dark:text-indigo-400">{goal.progress}%</span>
                            </div>
                          </div>
                        </div>

                        <div className="col-span-21 px-2">
                          <div className="h-3.5 w-full rounded-md bg-slate-200/80 dark:bg-slate-800 relative overflow-hidden flex items-center">
                            <div
                              className={`h-full transition-all rounded-md ${
                                goal.progress >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                              }`}
                              style={{ width: `${goal.progress}%` }}
                            />
                            <span className="absolute left-2 text-[9px] font-bold text-white drop-shadow-xs">
                              {goal.progress}% Goal Progress
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Work Projects under this Goal */}
                      {(activeStream === 'all' || activeStream === 'projects') && goalProjects.map(proj => {
                        const isProjDelayed = proj.delay.isDelayed && proj.status !== 'Completed';
                        return (
                          <div key={proj.id} className={`grid grid-cols-[280px_repeat(21,1fr)] items-center py-1.5 text-xs ${isProjDelayed ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''}`}>
                            <div className="pl-6 pr-2 flex items-center justify-between">
                              <div className="flex items-center gap-1.5 truncate">
                                <Briefcase className="h-3 w-3 text-emerald-600 shrink-0" />
                                <span className={`truncate ${isProjDelayed ? 'font-bold text-rose-700 dark:text-rose-300' : 'text-slate-800 dark:text-slate-200'}`}>
                                  {proj.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenTaskGenesis({ type: 'project', id: proj.id, title: proj.name, goalId: proj.goalId, due: proj.due })}
                                  className="rounded bg-indigo-50 px-1 text-[9px] font-bold text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 cursor-pointer"
                                  title="Task Genesis from Project"
                                >
                                  + Task
                                </button>
                                {isProjDelayed && (
                                  <button
                                    type="button"
                                    onClick={() => handleTriggerAlarmNow(proj.name, 'Project deliverable is past due!', proj.id)}
                                    className="rounded bg-rose-600 p-0.5 text-white cursor-pointer"
                                    title="Ring Urgent Alarm"
                                  >
                                    <BellRing className="h-2.5 w-2.5 animate-bounce" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="col-span-21 relative flex items-center h-6">
                              {timelineRange.map(d => {
                                const isDue = proj.due === d.dateStr;
                                return (
                                  <div key={d.dateStr} className={`h-full flex-1 border-l border-slate-100 dark:border-slate-800/40 flex items-center justify-center ${d.isToday ? 'bg-rose-500/10' : ''}`}>
                                    {isDue && (
                                      <div className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold shadow-xs whitespace-nowrap z-10 ${
                                        proj.status === 'Completed' ? 'bg-emerald-500 text-white' : isProjDelayed ? 'bg-rose-600 text-white animate-pulse' : 'bg-emerald-600 text-white'
                                      }`}>
                                        <Briefcase className="h-2.5 w-2.5" />
                                        <span>{proj.name}</span>
                                        {isProjDelayed && <span>({proj.delay.label})</span>}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}

                      {/* Learning Tracks under this Goal */}
                      {(activeStream === 'all' || activeStream === 'learning') && goalLearning.map(learn => (
                        <div key={learn.id} className="grid grid-cols-[280px_repeat(21,1fr)] items-center py-1 text-xs">
                          <div className="pl-6 pr-2 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 truncate">
                              <BookOpen className="h-3 w-3 text-purple-600 shrink-0" />
                              <span className="truncate text-slate-700 dark:text-slate-300">
                                {learn.title} ({learn.progress}%)
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenTaskGenesis({ type: 'learning', id: learn.id, title: learn.title, goalId: learn.goalId })}
                              className="rounded bg-purple-50 px-1 text-[9px] font-bold text-purple-600 hover:bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300 cursor-pointer"
                              title="Generate Study Task"
                            >
                              + Task
                            </button>
                          </div>
                          <div className="col-span-21 px-2">
                            <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div className="h-full rounded bg-purple-500" style={{ width: `${learn.progress}%` }} />
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Routines under this Goal */}
                      {(activeStream === 'all' || activeStream === 'routines') && goalRoutines.map(rt => {
                        const isRtDelayed = rt.delay.isDelayed;
                        return (
                          <div key={rt.id} className={`grid grid-cols-[280px_repeat(21,1fr)] items-center py-1 text-xs ${isRtDelayed ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''}`}>
                            <div className="pl-6 pr-2 flex items-center justify-between">
                              <div className="flex items-center gap-1.5 truncate">
                                <Repeat className="h-3 w-3 text-amber-500 shrink-0" />
                                <span className={`truncate ${isRtDelayed ? 'font-bold text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                  {rt.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleCompleteRoutineToday(rt)}
                                  className="text-[9px] font-bold text-emerald-600 hover:underline cursor-pointer"
                                >
                                  {rt.completedDates?.includes(today) ? '✓ Done Today' : 'Mark Done'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenTaskGenesis({ type: 'routine', id: rt.id, title: rt.name, goalId: rt.goalId })}
                                  className="rounded bg-amber-50 px-1 text-[9px] font-bold text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 cursor-pointer"
                                  title="Task Genesis from Routine"
                                >
                                  + Task
                                </button>
                              </div>
                            </div>
                            <div className="col-span-21 px-2 text-[10px] text-slate-400">
                              Time block: {rt.startTime || '07:00'} - {rt.endTime || '08:00'} {isRtDelayed && <span className="text-rose-600 font-bold ml-2">(⚠️ Missed Today Block)</span>}
                            </div>
                          </div>
                        );
                      })}

                      {/* Tasks under this Goal */}
                      {(activeStream === 'all' || activeStream === 'tasks') && goalTasks.map(task => {
                        const isTaskDelayed = task.delay.isDelayed && !task.done;
                        const taskDateStr = (task.dueAt || task.date || '').slice(0, 10);

                        return (
                          <div
                            key={task.id}
                            className={`grid grid-cols-[280px_repeat(21,1fr)] items-center py-1.5 transition-colors ${
                              isTaskDelayed ? 'bg-rose-50/50 hover:bg-rose-100/60 dark:bg-rose-950/20' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                            }`}
                          >
                            <div className="pl-9 pr-2 flex items-center justify-between">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => handleCompleteTask(task)}
                                  className="text-slate-400 hover:text-emerald-600 cursor-pointer shrink-0"
                                >
                                  {task.done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Circle className="h-3.5 w-3.5" />}
                                </button>
                                <span className={`text-xs truncate ${task.done ? 'line-through text-slate-400' : isTaskDelayed ? 'font-bold text-rose-700 dark:text-rose-300' : 'font-medium text-slate-800 dark:text-slate-200'}`}>
                                  {task.title}
                                </span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0 ml-1">
                                {isTaskDelayed && (
                                  <button
                                    type="button"
                                    onClick={() => handleTriggerAlarmNow(task.title, task.delay.label, task.id)}
                                    className="rounded bg-rose-600 p-1 text-white hover:bg-rose-500 cursor-pointer"
                                    title="Ring Urgent Alarm"
                                  >
                                    <BellRing className="h-2.5 w-2.5 animate-bounce" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAlarmTargetItem({ id: task.id, title: task.title, type: 'task', dueAt: task.dueAt });
                                    setAlarmCustomTime(task.dueAt || new Date().toISOString().slice(0, 16));
                                  }}
                                  className={`rounded p-1 cursor-pointer ${task.hasActiveAlarm ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300' : 'text-slate-400 hover:text-slate-700'}`}
                                  title="Schedule Alarm"
                                >
                                  <Bell className="h-3 w-3" />
                                </button>
                              </div>
                            </div>

                            <div className="col-span-21 relative flex items-center h-6">
                              {timelineRange.map(d => {
                                const isTaskDay = taskDateStr === d.dateStr;
                                return (
                                  <div key={d.dateStr} className={`h-full flex-1 border-l border-slate-100 dark:border-slate-800/40 flex items-center justify-center ${d.isToday ? 'bg-rose-500/10' : ''}`}>
                                    {isTaskDay && (
                                      <div className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold shadow-xs whitespace-nowrap z-10 ${
                                        task.done ? 'bg-emerald-500 text-white' : isTaskDelayed ? 'bg-rose-600 text-white ring-2 ring-rose-400 animate-pulse' : 'bg-indigo-600 text-white'
                                      }`}>
                                        <span>{task.title}</span>
                                        {isTaskDelayed && <span>({task.delay.label})</span>}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. OPERATING PLAN HIERARCHY (Projects, Learning, Routines & Tasks) */}
      {viewMode === 'hierarchy' && activeStream !== 'finance' && (
        <div className="space-y-4">
          {/* Projects Section */}
          {(activeStream === 'all' || activeStream === 'projects') && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Deliverables & Project Genesis ({workProjects.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenTaskGenesis({ type: 'project', title: '' })}
                  className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                >
                  + Project Task Genesis
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {annotatedProjects.map(proj => (
                  <div
                    key={proj.id}
                    className={`rounded-xl border p-3 text-xs transition-all ${
                      proj.delay.isDelayed && proj.status !== 'Completed'
                        ? 'border-rose-300 bg-rose-50/50 dark:border-rose-900/60 dark:bg-rose-950/20'
                        : 'border-slate-200/80 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold text-slate-900 dark:text-white truncate">{proj.name}</span>
                          {proj.delay.isDelayed && proj.status !== 'Completed' && (
                            <span className="rounded bg-rose-600 px-1.5 py-0.2 text-[9px] font-black text-white uppercase animate-pulse shrink-0">
                              {proj.delay.label}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Client: {proj.client || 'Internal'} · Due: {proj.due || 'No date'}
                        </div>
                        {proj.goal && (
                          <div className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 mt-1 truncate">
                            Goal: {proj.goal.title} ({proj.goal.progress}%)
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-auto">
                        <button
                          type="button"
                          onClick={() => handleOpenTaskGenesis({ type: 'project', id: proj.id, title: proj.name, goalId: proj.goalId, due: proj.due })}
                          className="rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 cursor-pointer"
                          title="Generate action task"
                        >
                          ⚡ Genesis Task
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleProject(proj)}
                          className={`rounded-lg px-2 py-1 text-[10px] font-bold cursor-pointer ${
                            proj.status === 'Completed' ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {proj.status === 'Completed' ? '✓ Done' : 'Complete'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Routine & Habits Section */}
          {(activeStream === 'all' || activeStream === 'routines') && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Routine & Habits Architecture ({routines.length} routines, {habits.length} habits)
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {annotatedRoutines.map(rt => {
                  const isDoneToday = rt.completedDates?.includes(today);
                  const isDelayed = rt.delay.isDelayed;

                  return (
                    <div
                      key={rt.id}
                      className={`rounded-xl border p-3 text-xs transition-all ${
                        isDelayed
                          ? 'border-rose-300 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-950/20'
                          : 'border-slate-200/80 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/70'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold text-slate-900 dark:text-white truncate">{rt.name}</span>
                            {isDelayed && (
                              <span className="rounded bg-rose-600 px-1.5 py-0.2 text-[9px] font-black text-white uppercase animate-pulse shrink-0">
                                Overdue Today
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Window: {rt.startTime || '07:00'} - {rt.endTime || '08:00'} ({rt.frequency})
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 ml-auto">
                          <button
                            type="button"
                            onClick={() => handleOpenTaskGenesis({ type: 'routine', id: rt.id, title: rt.name, goalId: rt.goalId })}
                            className="rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 cursor-pointer"
                            title="Task Genesis from Routine"
                          >
                            ⚡ Task Genesis
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCompleteRoutineToday(rt)}
                            className={`rounded-lg px-2 py-1 text-[10px] font-bold cursor-pointer ${
                              isDoneToday ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {isDoneToday ? '✓ Done Today' : 'Execute'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tasks Section */}
          {(activeStream === 'all' || activeStream === 'tasks') && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Action Units & Tasks ({annotatedTasks.length})
                  </h3>
                </div>
              </div>

              <div className="space-y-2">
                {annotatedTasks.map(task => {
                  const isDelayed = task.delay.isDelayed && !task.done;
                  return (
                    <div
                      key={task.id}
                      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border p-3 text-xs transition-all ${
                        isDelayed ? 'border-rose-400 bg-rose-50/50 dark:border-rose-900/60 dark:bg-rose-950/20' : 'border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-800/70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button type="button" onClick={() => handleCompleteTask(task)} className="cursor-pointer">
                          {task.done ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-slate-400" />}
                        </button>
                        <span className={`font-semibold truncate ${task.done ? 'line-through text-slate-400' : isDelayed ? 'text-rose-700 dark:text-rose-300 font-bold' : 'text-slate-900 dark:text-white'}`}>
                          {task.title}
                        </span>
                        {isDelayed && (
                          <span className="rounded bg-rose-600 px-1.5 py-0.2 text-[9px] font-black text-white uppercase animate-pulse shrink-0">
                            {task.delay.label}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-slate-400">Due: {task.dueAt || task.date}</span>
                        {isDelayed && (
                          <button
                            type="button"
                            onClick={() => handleTriggerAlarmNow(task.title, task.delay.label, task.id)}
                            className="rounded-lg bg-rose-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-2xs hover:bg-rose-500 cursor-pointer"
                          >
                            🚨 Ring Alarm
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. DELAY RADAR (RADAR MODE) */}
      {viewMode === 'radar' && activeStream !== 'finance' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-rose-300/80 bg-rose-50/50 p-4 dark:border-rose-900/60 dark:bg-rose-950/20">
            <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-600" />
              <span>Full Cross-System Delay Radar & Bottleneck Audit</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
              Active delays detected across Work Deliverables ({delayedProjects.length}), Daily Routines ({delayedRoutines.length}), and Tasks ({delayedTasks.length}).
            </p>
          </div>

          {totalDelayedAllCount === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-8 text-center dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <h4 className="mt-2 text-base font-bold text-emerald-900 dark:text-emerald-200">
                Zero Delays Detected!
              </h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                All projects, learning tracks, routine blocks, and tasks are strictly on schedule.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Delayed Learning Tracks */}
              {delayedLearning.map(learn => (
                <div key={learn.id} className="rounded-2xl border-2 border-rose-400/80 bg-white p-4 shadow-sm dark:border-rose-900/70 dark:bg-slate-900 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-950 dark:text-amber-400 uppercase">
                        Learning Track · {learn.delay.label}
                      </span>
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                        {learn.title}
                      </h4>
                      <p className="text-xs text-slate-500">Progress: {learn.progress}%</p>
                    </div>
                    {learn.targetDate && (
                      <span className="text-xs font-bold text-rose-600">Target: {learn.targetDate}</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleTriggerAlarmNow(learn.title, 'Learning track study session delayed!', learn.id)}
                      className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500 cursor-pointer"
                    >
                      🚨 Ring Urgent Alarm
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenTaskGenesis({ type: 'learning', id: learn.id, title: learn.title, goalId: learn.goalId, due: learn.targetDate })}
                      className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 cursor-pointer"
                    >
                      ⚡ Task Genesis
                    </button>
                  </div>
                </div>
              ))}

              {/* Delayed Skills */}
              {delayedSkills.map(sk => (
                <div key={sk.id} className="rounded-2xl border-2 border-rose-400/80 bg-white p-4 shadow-sm dark:border-rose-900/70 dark:bg-slate-900 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] font-black text-purple-800 dark:bg-purple-950 dark:text-purple-400 uppercase">
                        Skill Mastery · {sk.delay.label}
                      </span>
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                        {sk.name} ({sk.level} → {sk.targetLevel})
                      </h4>
                    </div>
                    {sk.targetDate && (
                      <span className="text-xs font-bold text-rose-600">Target: {sk.targetDate}</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleTriggerAlarmNow(sk.name, 'Skill practice drill overdue!', sk.id)}
                      className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500 cursor-pointer"
                    >
                      🚨 Ring Urgent Alarm
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenTaskGenesis({ type: 'skill', id: sk.id, title: sk.name, goalId: sk.goalId, due: sk.targetDate })}
                      className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 cursor-pointer"
                    >
                      ⚡ Task Genesis
                    </button>
                  </div>
                </div>
              ))}

              {/* Delayed Routines */}
              {delayedRoutines.map(rt => (
                <div key={rt.id} className="rounded-2xl border-2 border-rose-400/80 bg-white p-4 shadow-sm dark:border-rose-900/70 dark:bg-slate-900 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700 dark:bg-rose-950 dark:text-rose-400 uppercase">
                        Routine Block · {rt.delay.label}
                      </span>
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                        {rt.name} ({rt.startTime} - {rt.endTime})
                      </h4>
                    </div>
                    <span className="text-xs font-bold text-rose-600">Window: {rt.startTime}</span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleTriggerAlarmNow(rt.name, 'Scheduled routine time missed!', rt.id)}
                      className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500 cursor-pointer"
                    >
                      🚨 Ring Urgent Alarm
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenTaskGenesis({ type: 'routine', id: rt.id, title: rt.name, goalId: rt.goalId })}
                      className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 cursor-pointer"
                    >
                      ⚡ Task Genesis
                    </button>
                  </div>
                </div>
              ))}

              {/* Delayed Deliverables */}
              {delayedProjects.map(proj => (
                <div key={proj.id} className="rounded-2xl border-2 border-rose-400/80 bg-white p-4 shadow-sm dark:border-rose-900/70 dark:bg-slate-900 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700 dark:bg-rose-950 dark:text-rose-400 uppercase">
                        Project Deliverable · {proj.delay.label}
                      </span>
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                        {proj.name}
                      </h4>
                    </div>
                    <span className="text-xs font-bold text-rose-600">Due: {proj.due}</span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleTriggerAlarmNow(proj.name, 'Project is delayed!', proj.id)}
                      className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500 cursor-pointer"
                    >
                      🚨 Ring Urgent Alarm
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenTaskGenesis({ type: 'project', id: proj.id, title: proj.name, goalId: proj.goalId, due: proj.due })}
                      className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 cursor-pointer"
                    >
                      ⚡ Task Genesis
                    </button>
                  </div>
                </div>
              ))}

              {/* Delayed Tasks */}
              {delayedTasks.map(task => (
                <div key={task.id} className="rounded-2xl border-2 border-rose-400/80 bg-white p-4 shadow-sm dark:border-rose-900/70 dark:bg-slate-900 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700 dark:bg-rose-950 dark:text-rose-400 uppercase">
                        Action Task · {task.delay.label}
                      </span>
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                        {task.title}
                      </h4>
                    </div>
                    <span className="text-xs font-bold text-rose-600">Due: {task.dueAt || task.date}</span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleTriggerAlarmNow(task.title, task.delay.label, task.id)}
                      className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500 cursor-pointer"
                    >
                      🚨 Ring Urgent Alarm
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCompleteTask(task)}
                      className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
                    >
                      ✓ Mark Done
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 7. UNIVERSAL TASK GENESIS MODAL (From Any Project, Learning Track, Routine, or Habit) */}
      {genesisModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-black text-xs">
                  ⚡
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Task Genesis: Action Unit Deployment
                  </h3>
                  <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                    Source: {genesisModal.sourceType}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGenesisModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGenesisTask} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Task Title / Action Statement *
                </label>
                <input
                  type="text"
                  required
                  value={genesisModal.title}
                  onChange={e => setGenesisModal({ ...genesisModal, title: e.target.value })}
                  placeholder="Concrete executable action..."
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Priority
                  </label>
                  <select
                    value={genesisModal.priority}
                    onChange={e => setGenesisModal({ ...genesisModal, priority: e.target.value as any })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="High">High (Immediate)</option>
                    <option value="Medium">Medium (Balanced)</option>
                    <option value="Low">Low (Backlog)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Target Execution Date
                  </label>
                  <input
                    type="date"
                    required
                    value={genesisModal.dueAt}
                    onChange={e => setGenesisModal({ ...genesisModal, dueAt: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Link Target Goal (Progress will auto-rollup)
                </label>
                <select
                  value={genesisModal.goalId}
                  onChange={e => setGenesisModal({ ...genesisModal, goalId: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">-- No Direct Goal Link --</option>
                  {goals.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.title} ({g.progress}%)
                    </option>
                  ))}
                </select>
              </div>

              {/* REMINDER ALARM CONTROLS */}
              <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/50 p-3.5 space-y-2.5 dark:border-indigo-900/60 dark:bg-indigo-950/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BellRing className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Arm Audio Reminder Alarm
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={genesisModal.armAlarm}
                    onChange={e => setGenesisModal({ ...genesisModal, armAlarm: e.target.checked })}
                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>

                {genesisModal.armAlarm && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400">
                        Alarm Time on Due Date
                      </label>
                      <input
                        type="time"
                        value={genesisModal.alarmTime}
                        onChange={e => setGenesisModal({ ...genesisModal, alarmTime: e.target.value })}
                        className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400">
                        Alarm Ringtone
                      </label>
                      <select
                        value={genesisModal.ringtone}
                        onChange={e => setGenesisModal({ ...genesisModal, ringtone: e.target.value })}
                        className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        {ringtoneOptions.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setGenesisModal(prev => ({ ...prev, isOpen: false }))}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-extrabold text-white shadow-xs hover:bg-indigo-500 cursor-pointer"
                >
                  Deploy Task Genesis
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. SINGLE ALARM SETTER MODAL */}
      {alarmTargetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <BellRing className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Set Reminder Alarm
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAlarmTargetItem(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <span className="text-xs text-slate-400 font-medium">Item:</span>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {alarmTargetItem.title}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Alarm Date & Time:
              </label>
              <input
                type="datetime-local"
                value={alarmCustomTime}
                onChange={e => setAlarmCustomTime(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Ringtone Sound:
              </label>
              <select
                value={alarmRingtone}
                onChange={e => setAlarmRingtone(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {ringtoneOptions.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAlarmTargetItem(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (alarmTargetItem && alarmCustomTime) {
                    handleScheduleAlarm(alarmTargetItem.id, alarmTargetItem.title, alarmCustomTime, alarmRingtone);
                  }
                }}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 cursor-pointer"
              >
                Set Alarm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
