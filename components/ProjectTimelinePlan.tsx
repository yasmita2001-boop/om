import { ThemedDateTimeInput } from './ThemedDateTimeInput';
import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar, AlertTriangle, Bell, BellRing, CheckCircle2,
  Circle, ChevronLeft, ChevronRight, ChevronDown, Search,
  Layers, ShieldAlert,
  Check, X, Target, Flag, Briefcase, BookOpen, Award, Repeat,
  Zap, Landmark, TrendingUp,
  CalendarClock, Eye, EyeOff, Stethoscope, Users
} from 'lucide-react';
import {
  Goal, Milestone, Task, ReminderItem, TaskPriority,
  WorkProject, LearningItem, Skill, Routine, Habit, HabitLog,
  FinanceTransaction, Loan, Investment, SavingsPlan, Liability, Asset,
  HealthAppointment, Meeting, Note, JournalEntry,
  SpiritualPractice, Commitment, Person
} from '../types';
import { storage, generateUUID } from '../lib/storage';
import { getLocalDateString } from '../lib/dateUtils';
import { SlideTabs } from './SlideTabs';
import { GoalTierIcon, ThemeIcon, type ThemeIconName } from './ThemeIcon';
import { alarmService } from '../lib/alarmService';
import { useRingtoneOptions } from '../lib/alarmAudio';
import {
  createHabitGoalResolver,
  createTaskGoalResolver,
  resolveTaskGoalId,
  resolveHabitGoalId,
  syncGoalProgressFromTasks,
  syncGoalProgressFromMilestones,
  syncGoalProgressFromRoutines,
  syncGoalProgressFromHabits,
  syncGoalProgressFromAppointments,
  syncGoalProgressFromMeetings
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
  appointments?: HealthAppointment[];
  meetings?: Meeting[];
  notes?: Note[];
  journal?: JournalEntry[];
  practices?: SpiritualPractice[];
  commitments?: Commitment[];
  people?: Person[];
  initialStream?: TimelineStream;
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
}

export type TimelineStream =
  | 'all'
  | 'milestones'
  | 'projects'
  | 'learning'
  | 'skills'
  | 'routines'
  | 'tasks'
  | 'finance';

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

// ==========================================
// 1. ROBUST LOCAL TIMEZONE HELPERS (ZERO UTC SKEW)
// ==========================================
export function getLocalTodayStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalTimeStr(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function getLocalDateTimeStr(offsetMinutes: number = 0): string {
  const d = new Date(Date.now() + offsetMinutes * 60 * 1000);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${h}:${m}`;
}

export function addDaysToDateStr(dateStr: string | undefined, days: number): string {
  const base = dateStr ? new Date(`${dateStr.slice(0, 10)}T00:00:00`) : new Date();
  if (isNaN(base.getTime())) return getLocalTodayStr();
  base.setDate(base.getDate() + days);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, '0');
  const day = String(base.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function computeTimeSlotPosition(
  startTimeStr?: string,
  endTimeStr?: string,
  isSingleDay: boolean = false
): { leftPct: number; widthPct: number } | null {
  if (!isSingleDay || !startTimeStr) return null;

  const parseMins = (t: string) => {
    const parts = t.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
  };

  const dayStartMins = 6 * 60; // 06:00 = 360
  const dayEndMins = 24 * 60;  // 24:00 = 1440
  const totalDayMins = dayEndMins - dayStartMins; // 1080

  const startMins = parseMins(startTimeStr);
  let endMins = endTimeStr ? parseMins(endTimeStr) : startMins + 60;
  if (endMins <= startMins) endMins = startMins + 45;

  const clampedStart = Math.max(dayStartMins, Math.min(dayEndMins, startMins));
  const clampedEnd = Math.max(clampedStart + 15, Math.min(dayEndMins, endMins));

  const leftPct = ((clampedStart - dayStartMins) / totalDayMins) * 100;
  const widthPct = Math.max(2.5, ((clampedEnd - clampedStart) / totalDayMins) * 100);

  return { leftPct, widthPct };
}

// ==========================================
// 2. UNIVERSAL DELAY COMPUTATION
// ==========================================
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
  const isDone =
    item.done === true ||
    item.status === 'done' ||
    item.status === 'completed' ||
    item.status === 'Completed' ||
    item.status === 'executed' ||
    (item.progress !== undefined && item.progress >= 100);

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

  const todayStr = getLocalTodayStr();
  const now = new Date();

  // Routines & Habits with daily time windows
  if (item.startTime || item.endTime) {
    const isDoneToday =
      item.completedDate === todayStr ||
      (item.completedDates && item.completedDates.includes(todayStr));

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

  // Parse local date cleanly
  const datePortion = rawDate.slice(0, 10);
  const isTimeIncluded = rawDate.includes('T');
  const targetDate = new Date(isTimeIncluded ? rawDate : `${datePortion}T23:59:59`);

  if (isNaN(targetDate.getTime())) {
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

  const diffMs = now.getTime() - targetDate.getTime();

  if (diffMs > 0) {
    const delayHours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));
    const delayDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    let severity: 'critical' | 'moderate' | 'mild' = 'mild';
    if (delayDays >= 3) severity = 'critical';
    else if (delayDays >= 1) severity = 'moderate';

    const label = delayDays > 0 ? `${delayDays}d overdue` : `${delayHours}h overdue`;
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
    const isDueToday = datePortion === todayStr;

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

// 5-Tier Goal Metadata Helper
export function getGoalTierBadge(level?: number): { name: string; icon: ThemeIconName; badgeStyle: string } {
  switch (level) {
    case 2:
      return {
        name: 'Sub Goal',
        icon: 'subGoal',
        badgeStyle: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
      };
    case 3:
      return {
        name: 'Micro Goal',
        icon: 'microGoal',
        badgeStyle: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300'
      };
    case 4:
      return {
        name: 'Nano Goal',
        icon: 'nanoGoal',
        badgeStyle: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300'
      };
    case 5:
      return {
        name: 'Atomic Goal',
        icon: 'zap',
        badgeStyle: 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-300'
      };
    default:
      return {
        name: 'Main Goal',
        icon: 'mainGoal',
        badgeStyle: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300'
      };
  }
}

// ==========================================
// 3. MAIN COMPONENT: ProjectTimelinePlan
// ==========================================
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
  appointments = [],
  meetings = [],
  people = [],
  initialStream,
  onRefresh,
  onSuccess
}) => {
  const today = getLocalTodayStr();
  const { ringtoneOptions, defaultRingtone } = useRingtoneOptions();

  // Navigation & View Modes
  const [viewMode, setViewMode] = useState<'gantt' | 'hierarchy' | 'radar'>('gantt');
  const [timelineGranularity, setTimelineGranularity] = useState<'single_day' | 'daily' | 'monthly' | 'yearly' | 'lifecycle'>('daily');
  const [timelineOffset, setTimelineOffset] = useState<number>(0);
  const [activeStream, setActiveStream] = useState<TimelineStream>(initialStream || 'all');
  const [selectedGoalId, setSelectedGoalId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'delayed' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [radarSeverityFilter, setRadarSeverityFilter] = useState<'all' | 'critical' | 'moderate' | 'mild'>('all');

  // Hierarchy UI Toggles
  const [expandedGoalIds, setExpandedGoalIds] = useState<Record<string, boolean>>({});
  const [isStandaloneExpanded, setIsStandaloneExpanded] = useState<boolean>(true);
  const [isStandaloneFinanceExpanded, setIsStandaloneFinanceExpanded] = useState<boolean>(true);
  const [isStandalonePeopleExpanded, setIsStandalonePeopleExpanded] = useState<boolean>(true);
  const [isMobileCompactView, setIsMobileCompactView] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
  );

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 639px)');
    const updateCompactView = () => setIsMobileCompactView(mobileQuery.matches);
    mobileQuery.addEventListener('change', updateCompactView);
    return () => mobileQuery.removeEventListener('change', updateCompactView);
  }, []);

  // Quick Reschedule Popover State
  const [rescheduleTarget, setRescheduleTarget] = useState<{
    id: string;
    type: 'task' | 'milestone' | 'project' | 'learning' | 'skill';
    title: string;
    currentDate?: string;
  } | null>(null);

  // Task Genesis Modal State
  const [genesisModal, setGenesisModal] = useState<{
    isOpen: boolean;
    sourceType: 'manual' | 'milestone' | 'project' | 'learning' | 'skill' | 'routine' | 'habit';
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
    ringtone: defaultRingtone,
    alarmTime: '09:00'
  });

  // Reminders Map for instant lookup
  const reminderMap = useMemo(() => {
    const map = new Map<string, ReminderItem>();
    reminders.forEach(r => {
      if (r.linkedId && r.status === 'open') {
        map.set(r.linkedId, r);
      }
    });
    return map;
  }, [reminders]);

  // Goal Fast Map
  const goalMap = useMemo(() => {
    const map = new Map<string, Goal>();
    goals.forEach(g => map.set(g.id, g));
    return map;
  }, [goals]);

  // ----------------------------------------------------
  // ANNOTATED STREAMS (WITH UNIVERSAL DELAY & REMINDER)
  // ----------------------------------------------------
  const annotatedTasks = useMemo(() => {
    const resolveGoalId = createTaskGoalResolver({ workProjects, routines, skills, learningItems });
    return tasks.map(t => {
      const resolvedGoalId = resolveGoalId(t);

      return {
        ...t,
        goalId: resolvedGoalId,
        streamType: 'task' as const,
        delay: computeItemDelay(t),
        goal: resolvedGoalId ? goalMap.get(resolvedGoalId) : undefined,
        hasActiveAlarm: Boolean(reminderMap.get(t.id)?.alarmEnabled),
        reminder: reminderMap.get(t.id)
      };
    });
  }, [tasks, workProjects, routines, skills, learningItems, goalMap, reminderMap]);

  const annotatedMilestones = useMemo(() => {
    return milestones.map(m => ({
      ...m,
      streamType: 'milestone' as const,
      delay: computeItemDelay({ dueDate: m.dueDate, status: m.status, progress: m.progress }),
      goal: m.goalId ? goalMap.get(m.goalId) : undefined,
      hasActiveAlarm: Boolean(reminderMap.get(m.id)?.alarmEnabled),
      reminder: reminderMap.get(m.id)
    }));
  }, [milestones, goalMap, reminderMap]);

  const annotatedProjects = useMemo(() => {
    return workProjects.map(p => ({
      ...p,
      streamType: 'project' as const,
      delay: computeItemDelay({ ...p, dueAt: p.due }),
      goal: p.goalId ? goalMap.get(p.goalId) : undefined,
      hasActiveAlarm: Boolean(reminderMap.get(p.id)?.alarmEnabled),
      reminder: reminderMap.get(p.id)
    }));
  }, [workProjects, goalMap, reminderMap]);

  const annotatedLearning = useMemo(() => {
    return learningItems.map(l => ({
      ...l,
      streamType: 'learning' as const,
      delay: computeItemDelay(l),
      goal: l.goalId ? goalMap.get(l.goalId) : undefined,
      hasActiveAlarm: Boolean(reminderMap.get(l.id)?.alarmEnabled),
      reminder: reminderMap.get(l.id)
    }));
  }, [learningItems, goalMap, reminderMap]);

  const annotatedSkills = useMemo(() => {
    return skills.map(s => ({
      ...s,
      streamType: 'skill' as const,
      delay: computeItemDelay({ targetDate: s.targetDate, progress: s.progress }),
      goal: s.goalId ? goalMap.get(s.goalId) : undefined,
      hasActiveAlarm: Boolean(reminderMap.get(s.id)?.alarmEnabled),
      reminder: reminderMap.get(s.id)
    }));
  }, [skills, goalMap, reminderMap]);

  const annotatedRoutines = useMemo(() => {
    return routines.map(r => ({
      ...r,
      streamType: 'routine' as const,
      delay: computeItemDelay(r),
      goal: r.goalId ? goalMap.get(r.goalId) : undefined,
      hasActiveAlarm: Boolean(reminderMap.get(r.id)?.alarmEnabled),
      reminder: reminderMap.get(r.id)
    }));
  }, [routines, goalMap, reminderMap]);

  const annotatedHabits = useMemo(() => {
    const resolveGoalId = createHabitGoalResolver(routines);
    return habits.map(h => {
      const resolvedGoalId = resolveGoalId(h);
      const todayLogs = habitLogs.filter(log => log.habitId === h.id && log.date === today);
      const hasQuickLog = todayLogs.some(log => log.key === `${h.id}|${today}|0`);
      const isDoneToday = h.doneDate === today || todayLogs.length > 0;
      const delay: DelayInfo = isDoneToday
        ? { isDelayed: false, delayDays: 0, delayHours: 0, severity: 'none', label: 'Done Today', isDueToday: true, isUpcoming: false, remainingDays: 0 }
        : { isDelayed: false, delayDays: 0, delayHours: 0, severity: 'none', label: 'Daily Habit', isDueToday: true, isUpcoming: true, remainingDays: 0 };
      return {
        ...h,
        goalId: resolvedGoalId,
        streamType: 'habit' as const,
        delay,
        goal: resolvedGoalId ? goalMap.get(resolvedGoalId) : undefined,
        isDoneToday,
        hasQuickLog
      };
    });
  }, [habits, habitLogs, routines, goalMap, today]);

  const annotatedAppointments = useMemo(() => {
    return appointments.filter(a => a.status !== 'cancelled').map(a => {
      const isComp = Boolean(a.completed || a.status === 'completed');
      return {
        ...a,
        streamType: 'appointment' as const,
        delay: isComp
          ? { isDelayed: false, delayDays: 0, delayHours: 0, severity: 'none', label: 'Completed', isDueToday: false, isUpcoming: false, remainingDays: 0 }
          : computeItemDelay({ dueAt: a.date }),
        goal: a.goalId ? goalMap.get(a.goalId) : undefined,
        hasActiveAlarm: Boolean(reminderMap.get(a.id)?.alarmEnabled),
        reminder: reminderMap.get(a.id)
      };
    });
  }, [appointments, goalMap, reminderMap]);

  const annotatedMeetings = useMemo(() => {
    return meetings.filter(m => m.status !== 'cancelled').map(m => {
      const isComp = Boolean(m.completed || m.status === 'completed');
      return {
        ...m,
        streamType: 'meeting' as const,
        delay: isComp
          ? { isDelayed: false, delayDays: 0, delayHours: 0, severity: 'none', label: 'Completed', isDueToday: false, isUpcoming: false, remainingDays: 0 }
          : computeItemDelay({ dueAt: m.date }),
        goal: m.goalId ? goalMap.get(m.goalId) : undefined,
        hasActiveAlarm: Boolean(reminderMap.get(m.id)?.alarmEnabled),
        reminder: reminderMap.get(m.id)
      };
    });
  }, [meetings, goalMap, reminderMap]);

  // Annotated Financial Streams (Savings Plans, Loans, Investments)
  const annotatedSavings = useMemo(() => {
    return savingsPlans.map(sp => {
      const prog = sp.targetAmount > 0 ? Math.min(100, Math.round(((Number(sp.currentAmount) || 0) / Number(sp.targetAmount)) * 100)) : 0;
      const spStart = (sp as any).startDate || (sp.createdAt ? getLocalDateString(new Date(sp.createdAt)) : today);
      const spTarget = (sp as any).targetDate || (sp.durationMonths && sp.createdAt ? addDaysToDateStr(getLocalDateString(new Date(sp.createdAt)), sp.durationMonths * 30) : addDaysToDateStr(spStart, 90));
      return {
        ...sp,
        streamType: 'savings' as const,
        progress: prog,
        startDate: spStart,
        targetDate: spTarget,
        delay: computeItemDelay({ targetDate: spTarget, progress: prog }),
        goal: sp.goalId ? goalMap.get(sp.goalId) : undefined,
        hasActiveAlarm: Boolean(reminderMap.get(sp.id)?.alarmEnabled),
        reminder: reminderMap.get(sp.id)
      };
    });
  }, [savingsPlans, goalMap, reminderMap, today]);

  const annotatedLoans = useMemo(() => {
    return loans.map(loan => {
      const loanPrincipal = Number((loan as any).principal ?? (loan as any).amount) || 0;
      const loanOutstanding = Number((loan as any).outstanding) || 0;
      const loanPaid = Number((loan as any).paidAmount) || (loanPrincipal ? Math.max(0, loanPrincipal - loanOutstanding) : 0);
      const prog = loanPrincipal > 0 ? Math.min(100, Math.round((loanPaid / loanPrincipal) * 100)) : 0;
      const isPaid = prog >= 100;
      const loanStart = (loan as any).startDate || (loan.createdAt ? getLocalDateString(new Date(loan.createdAt)) : today);
      const loanTarget = (loan as any).targetDate || ((loan as any).tenure ? addDaysToDateStr(loanStart, (loan as any).tenure * 30) : addDaysToDateStr(loanStart, 365));
      return {
        ...loan,
        streamType: 'loan' as const,
        principal: loanPrincipal,
        outstanding: loanOutstanding,
        paid: loanPaid,
        progress: prog,
        isPaid,
        startDate: loanStart,
        targetDate: loanTarget,
        delay: computeItemDelay({ targetDate: loanTarget, progress: prog }),
        goal: loan.goalId ? goalMap.get(loan.goalId) : undefined,
        hasActiveAlarm: Boolean(reminderMap.get(loan.id)?.alarmEnabled),
        reminder: reminderMap.get(loan.id)
      };
    });
  }, [loans, goalMap, reminderMap, today]);

  const annotatedInvestments = useMemo(() => {
    return investments.map(inv => {
      const invStart = (inv as any).startDate || inv.date || (inv.createdAt ? getLocalDateString(new Date(inv.createdAt)) : today);
      const invTarget = (inv as any).targetDate || (inv as any).maturityDate || (inv as any).horizonDate || addDaysToDateStr(invStart, 180);
      const currentVal = Number(inv.currentValue ?? inv.amount) || 0;
      const initialAmt = Number(inv.amount) || 0;
      const gain = currentVal - initialAmt;
      const gainPct = initialAmt > 0 ? Math.round((gain / initialAmt) * 100) : 0;
      return {
        ...inv,
        streamType: 'investment' as const,
        currentVal,
        initialAmt,
        gain,
        gainPct,
        startDate: invStart,
        targetDate: invTarget,
        delay: computeItemDelay({ targetDate: invTarget, progress: 100 }),
        goal: inv.goalId ? goalMap.get(inv.goalId) : undefined,
        hasActiveAlarm: Boolean(reminderMap.get(inv.id)?.alarmEnabled),
        reminder: reminderMap.get(inv.id)
      };
    });
  }, [investments, goalMap, reminderMap, today]);

  // Combined Delay Sets (Accurate & Complete)
  const delayedTasks = useMemo(() => annotatedTasks.filter(t => t.delay.isDelayed && !t.done), [annotatedTasks]);
  const delayedMilestones = useMemo(() => annotatedMilestones.filter(m => m.delay.isDelayed && m.status !== 'completed' && m.progress < 100), [annotatedMilestones]);
  const delayedProjects = useMemo(() => annotatedProjects.filter(p => p.delay.isDelayed && p.status !== 'Completed'), [annotatedProjects]);
  const delayedLearning = useMemo(() => annotatedLearning.filter(l => l.delay.isDelayed && l.progress < 100), [annotatedLearning]);
  const delayedSkills = useMemo(() => annotatedSkills.filter(s => s.delay.isDelayed && (s.progress || 0) < 100), [annotatedSkills]);
  const delayedRoutines = useMemo(() => annotatedRoutines.filter(r => r.delay.isDelayed), [annotatedRoutines]);
  const delayedAppointments = useMemo(() => annotatedAppointments.filter(a => !a.completed && a.status !== 'completed' && a.delay.isDelayed), [annotatedAppointments]);
  const delayedMeetings = useMemo(() => annotatedMeetings.filter(m => !m.completed && m.status !== 'completed' && m.delay.isDelayed), [annotatedMeetings]);
  const delayedSavings = useMemo(() => annotatedSavings.filter(s => s.delay.isDelayed && s.progress < 100), [annotatedSavings]);
  const delayedLoans = useMemo(() => annotatedLoans.filter(l => l.delay.isDelayed && !l.isPaid), [annotatedLoans]);

  const totalDelayedAllCount =
    delayedTasks.length +
    delayedMilestones.length +
    delayedProjects.length +
    delayedLearning.length +
    delayedSkills.length +
    delayedRoutines.length +
    delayedAppointments.length +
    delayedMeetings.length +
    delayedSavings.length +
    delayedLoans.length;

  const totalItemsAllCount =
    tasks.length +
    milestones.length +
    workProjects.length +
    learningItems.length +
    skills.length +
    routines.length +
    habits.length +
    annotatedAppointments.length +
    annotatedMeetings.length +
    savingsPlans.length +
    loans.length +
    investments.length;

  const onTimeHealthRate = totalItemsAllCount > 0
    ? Math.max(0, Math.round(((totalItemsAllCount - totalDelayedAllCount) / totalItemsAllCount) * 100))
    : 100;

  // ----------------------------------------------------
  // FILTERED COLLECTIONS FOR SEARCH & STATUS
  // ----------------------------------------------------
  const filterBySearchAndStatus = <T,>(
    items: T[],
    isCompletedFn: (item: T) => boolean
  ): T[] => {
    return items.filter(item => {
      const isComp = isCompletedFn(item);
      const anyItem = item as any;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = ((anyItem.title || anyItem.name || '')).toLowerCase().includes(q);
        const goalMatch = (anyItem.goal?.title || '').toLowerCase().includes(q);
        if (!titleMatch && !goalMatch) return false;
      }
      if (statusFilter === 'delayed') return anyItem.delay?.isDelayed && !isComp;
      if (statusFilter === 'pending') return !isComp && !anyItem.delay?.isDelayed;
      if (statusFilter === 'completed') return isComp;
      return true;
    });
  };

  const filteredTasks = useMemo(() => filterBySearchAndStatus(annotatedTasks, t => Boolean(t.done)), [annotatedTasks, searchQuery, statusFilter]);
  const filteredMilestones = useMemo(() => filterBySearchAndStatus(annotatedMilestones, m => m.status === 'completed' || m.progress >= 100), [annotatedMilestones, searchQuery, statusFilter]);
  const filteredProjects = useMemo(() => filterBySearchAndStatus(annotatedProjects, p => p.status === 'Completed'), [annotatedProjects, searchQuery, statusFilter]);
  const filteredLearning = useMemo(() => filterBySearchAndStatus(annotatedLearning, l => l.progress >= 100), [annotatedLearning, searchQuery, statusFilter]);
  const filteredSkills = useMemo(() => filterBySearchAndStatus(annotatedSkills, s => (s.progress || 0) >= 100), [annotatedSkills, searchQuery, statusFilter]);
  const filteredRoutines = useMemo(() => filterBySearchAndStatus(annotatedRoutines, r => Boolean(r.completedDates?.includes(today))), [annotatedRoutines, searchQuery, statusFilter, today]);
  const filteredHabits = useMemo(() => filterBySearchAndStatus(annotatedHabits, h => h.isDoneToday), [annotatedHabits, searchQuery, statusFilter]);
  const filteredAppointments = useMemo(() => filterBySearchAndStatus(annotatedAppointments, a => Boolean(a.completed || a.status === 'completed')), [annotatedAppointments, searchQuery, statusFilter]);
  const filteredMeetings = useMemo(() => filterBySearchAndStatus(annotatedMeetings, m => Boolean(m.completed || m.status === 'completed')), [annotatedMeetings, searchQuery, statusFilter]);
  const filteredSavings = useMemo(() => filterBySearchAndStatus(annotatedSavings, s => s.progress >= 100), [annotatedSavings, searchQuery, statusFilter]);
  const filteredLoans = useMemo(() => filterBySearchAndStatus(annotatedLoans, l => Boolean(l.isPaid)), [annotatedLoans, searchQuery, statusFilter]);
  const filteredInvestments = useMemo(() => filterBySearchAndStatus(annotatedInvestments, () => false), [annotatedInvestments, searchQuery, statusFilter]);

  // Standalone Tasks (Operational / General tasks without goalId)
  const standaloneTasks = useMemo(() => {
    return filteredTasks.filter(t => !t.goalId);
  }, [filteredTasks]);

  // Standalone Financial Items (Savings, Loans, Investments without goalId)
  const standaloneSavings = useMemo(() => filteredSavings.filter(s => !s.goalId), [filteredSavings]);
  const standaloneLoans = useMemo(() => filteredLoans.filter(l => !l.goalId), [filteredLoans]);
  const standaloneInvestments = useMemo(() => filteredInvestments.filter(i => !i.goalId), [filteredInvestments]);

  // Contacts with Important Dates
  const standalonePeople = useMemo(() => {
    return people.filter(p => Boolean(p.importantDate));
  }, [people]);

  // Fast Goal-Item Pre-Indexation (O(1) lookup during render with Direct Goal Association)
  // Strict hierarchy separation: Child goal items ONLY render in the child goal's own stream, never duplicating into parent goal streams!
  const goalItemIndex = useMemo(() => {
    const map = new Map<string, {
      tasks: typeof filteredTasks;
      milestones: typeof filteredMilestones;
      projects: typeof filteredProjects;
      learning: typeof filteredLearning;
      skills: typeof filteredSkills;
      routines: typeof filteredRoutines;
      habits: typeof filteredHabits;
      appointments: typeof filteredAppointments;
      meetings: typeof filteredMeetings;
      savingsPlans: typeof filteredSavings;
      loans: typeof filteredLoans;
      investments: typeof filteredInvestments;
    }>();

    goals.forEach(g => {
      map.set(g.id, {
        tasks: [],
        milestones: [],
        projects: [],
        learning: [],
        skills: [],
        routines: [],
        habits: [],
        appointments: [],
        meetings: [],
        savingsPlans: [],
        loans: [],
        investments: []
      });
    });

    // Direct Goal Association: No duplicates between parent and child goals
    filteredTasks.forEach(t => {
      if (t.goalId && map.has(t.goalId)) {
        map.get(t.goalId)!.tasks.push(t);
      }
    });

    filteredMilestones.forEach(m => {
      if (m.goalId && map.has(m.goalId)) {
        map.get(m.goalId)!.milestones.push(m);
      }
    });

    filteredProjects.forEach(p => {
      if (p.goalId && map.has(p.goalId)) {
        map.get(p.goalId)!.projects.push(p);
      }
    });

    filteredLearning.forEach(l => {
      if (l.goalId && map.has(l.goalId)) {
        map.get(l.goalId)!.learning.push(l);
      }
    });

    filteredSkills.forEach(s => {
      if (s.goalId && map.has(s.goalId)) {
        map.get(s.goalId)!.skills.push(s);
      }
    });

    filteredRoutines.forEach(r => {
      if (r.goalId && map.has(r.goalId)) {
        map.get(r.goalId)!.routines.push(r);
      }
    });

    filteredHabits.forEach(h => {
      if (h.goalId && map.has(h.goalId)) {
        map.get(h.goalId)!.habits.push(h);
      }
    });

    filteredAppointments.forEach(a => {
      if (a.goalId && map.has(a.goalId)) {
        map.get(a.goalId)!.appointments.push(a);
      }
    });

    filteredMeetings.forEach(m => {
      if (m.goalId && map.has(m.goalId)) {
        map.get(m.goalId)!.meetings.push(m);
      }
    });

    filteredSavings.forEach(s => {
      if (s.goalId && map.has(s.goalId)) {
        map.get(s.goalId)!.savingsPlans.push(s);
      }
    });

    filteredLoans.forEach(l => {
      if (l.goalId && map.has(l.goalId)) {
        map.get(l.goalId)!.loans.push(l);
      }
    });

    filteredInvestments.forEach(inv => {
      if (inv.goalId && map.has(inv.goalId)) {
        map.get(inv.goalId)!.investments.push(inv);
      }
    });

    return map;
  }, [
    goals,
    filteredTasks,
    filteredMilestones,
    filteredProjects,
    filteredLearning,
    filteredSkills,
    filteredRoutines,
    filteredHabits,
    filteredAppointments,
    filteredMeetings,
    filteredSavings,
    filteredLoans,
    filteredInvestments
  ]);

  // Hierarchical Goal Sorting (5-Tiers tree order)
  const hierarchicalGoals = useMemo(() => {
    const result: Goal[] = [];
    const added = new Set<string>();

    const appendBranch = (parentId: string | null, depth: number) => {
      const children = goals.filter(g => (g.parentId || null) === parentId);
      children.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      for (const child of children) {
        if (!added.has(child.id)) {
          added.add(child.id);
          result.push(child);
          if (depth < 5) appendBranch(child.id, depth + 1);
        }
      }
    };

    appendBranch(null, 1);
    // Append any orphaned goals
    goals.forEach(g => {
      if (!added.has(g.id)) {
        added.add(g.id);
        result.push(g);
      }
    });

    return result;
  }, [goals]);

  // ----------------------------------------------------
  // MULTI-GRANULARITY TIMELINE CALCULATION
  // ----------------------------------------------------
  const timelineData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const todayStr = getLocalTodayStr();

    let minYear = currentYear;
    let maxYear = currentYear + 2;
    goals.forEach(g => {
      if (g.targetDate) {
        const yr = parseInt(g.targetDate.slice(0, 4), 10);
        if (!isNaN(yr)) {
          if (yr > maxYear) maxYear = yr;
          if (yr < minYear) minYear = Math.max(2020, yr);
        }
      }
    });
    if (timelineGranularity === 'single_day') {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + timelineOffset);
      const yyyy = targetDate.getFullYear();
      const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
      const dd = String(targetDate.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const isToday = dateStr === todayStr;

      const timeSlots = [
        { id: 'morning', label: '06:00 – 09:00', subLabel: 'Early Focus', startH: 6, endH: 9 },
        { id: 'focus', label: '09:00 – 12:00', subLabel: 'Peak Output', startH: 9, endH: 12 },
        { id: 'midday', label: '12:00 – 15:00', subLabel: 'Midday Block', startH: 12, endH: 15 },
        { id: 'afternoon', label: '15:00 – 18:00', subLabel: 'Execution Zone', startH: 15, endH: 18 },
        { id: 'evening', label: '18:00 – 21:00', subLabel: 'Evening Review', startH: 18, endH: 21 },
        { id: 'night', label: '21:00 – 24:00', subLabel: 'Night Wrap', startH: 21, endH: 24 }
      ];

      const cols = timeSlots.map(slot => ({
        id: `${dateStr}-${slot.id}`,
        label: slot.label,
        subLabel: slot.subLabel,
        dateStr,
        startIso: dateStr,
        endIso: dateStr,
        isToday,
        isWeekend: targetDate.getDay() === 0 || targetDate.getDay() === 6,
        startHour: slot.startH,
        endHour: slot.endH
      }));

      const dayName = targetDate.toLocaleDateString('en-US', { weekday: 'long' });
      const dayDisplay = targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const title = `${dayName}, ${dayDisplay}${isToday ? ' (Today)' : ''}`;

      return { cols, title, minYear, maxYear, singleDateStr: dateStr, isSingleDay: true, periodStartIso: dateStr, periodEndIso: dateStr };
    }

    if (timelineGranularity === 'daily') {
      const baseDate = new Date(now);
      // Anchor to Monday of the week
      const dayOfWeek = baseDate.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const mondayDate = new Date(baseDate);
      mondayDate.setDate(baseDate.getDate() + diffToMonday + timelineOffset * 7);

      const cols = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(mondayDate);
        d.setDate(mondayDate.getDate() + i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const offsetFromToday = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        cols.push({
          id: dateStr,
          label: d.toLocaleDateString('en-US', { weekday: 'short' }), // Mon, Tue, Wed, Thu, Fri, Sat, Sun
          subLabel: String(d.getDate()),
          dateStr,
          startIso: dateStr,
          endIso: dateStr,
          isToday: dateStr === todayStr,
          isWeekend: d.getDay() === 0 || d.getDay() === 6,
          offsetFromToday
        });
      }

      const firstCol = cols[0];
      const lastCol = cols[cols.length - 1];
      const title = `Week of ${new Date(firstCol.dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(lastCol.dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

      return { cols, title, minYear, maxYear, singleDateStr: undefined, isSingleDay: false, periodStartIso: firstCol.dateStr, periodEndIso: lastCol.dateStr };
    }

    if (timelineGranularity === 'monthly') {
      const targetYear = currentYear + timelineOffset;
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const cols = monthNames.map((name, idx) => {
        const mStr = String(idx + 1).padStart(2, '0');
        const startIso = `${targetYear}-${mStr}-01`;
        const lastDay = new Date(targetYear, idx + 1, 0).getDate();
        const endIso = `${targetYear}-${mStr}-${String(lastDay).padStart(2, '0')}`;
        const isCurrentMonth = targetYear === currentYear && idx === currentMonth;

        const quarters = ['Q1', 'Q1', 'Q1', 'Q2', 'Q2', 'Q2', 'Q3', 'Q3', 'Q3', 'Q4', 'Q4', 'Q4'];
        return {
          id: `${targetYear}-${mStr}`,
          label: name,
          subLabel: quarters[idx],
          dateStr: `${targetYear}-${mStr}-01`,
          startIso,
          endIso,
          isToday: isCurrentMonth,
          isWeekend: false
        };
      });

      const title = `Monthly View · ${targetYear}`;
      return { cols, title, minYear, maxYear, singleDateStr: undefined, isSingleDay: false, periodStartIso: `${targetYear}-01-01`, periodEndIso: `${targetYear}-12-31` };
    }

    if (timelineGranularity === 'yearly') {
      const baseYear = currentYear + timelineOffset * 5;
      const startYear = Math.max(2022, baseYear - 2);
      const endYear = Math.max(startYear + 8, Math.max(baseYear + 7, maxYear));

      const cols = [];
      for (let yr = startYear; yr <= endYear; yr++) {
        cols.push({
          id: `year-${yr}`,
          label: String(yr),
          subLabel: yr === currentYear ? 'Current' : yr === maxYear ? 'Target' : undefined,
          dateStr: `${yr}-01-01`,
          startIso: `${yr}-01-01`,
          endIso: `${yr}-12-31`,
          isToday: yr === currentYear,
          isWeekend: false
        });
      }

      const title = `Yearly Horizons (${startYear} – ${endYear})`;
      return { cols, title, minYear, maxYear, singleDateStr: undefined, isSingleDay: false, periodStartIso: `${startYear}-01-01`, periodEndIso: `${endYear}-12-31` };
    }

    // Lifecycle
    const startYr = Math.min(2024, minYear, currentYear);
    const endYr = Math.max(currentYear + 5, maxYear);
    const cols = [];
    for (let yr = startYr; yr <= endYr; yr++) {
      cols.push({
        id: `lifecycle-${yr}`,
        label: String(yr),
        subLabel: yr === currentYear ? 'Today' : yr === endYr ? 'Target' : undefined,
        dateStr: `${yr}-01-01`,
        startIso: `${yr}-01-01`,
        endIso: `${yr}-12-31`,
        isToday: yr === currentYear,
        isWeekend: false
      });
    }
    const title = `Full Project Lifecycle (${startYr} – ${endYr})`;
    return { cols, title, minYear, maxYear, singleDateStr: undefined, isSingleDay: false, periodStartIso: `${startYr}-01-01`, periodEndIso: `${endYr}-12-31` };
  }, [timelineGranularity, timelineOffset, goals]);

  // ----------------------------------------------------
  // DYNAMIC PERIOD-AWARE METRICS (RESPONDS TO TIME WINDOW)
  // ----------------------------------------------------
  const periodMetrics = useMemo(() => {
    const start = timelineData.periodStartIso || today;
    const end = timelineData.periodEndIso || today;

    const inPeriod = (dateStr?: string) => {
      if (!dateStr) return false;
      const d = dateStr.slice(0, 10);
      return d >= start && d <= end;
    };

    // Filter items within this period
    const pTasks = annotatedTasks.filter(t => inPeriod(t.dueAt || t.date));
    const pMilestones = annotatedMilestones.filter(m => inPeriod(m.dueDate));
    const pProjects = annotatedProjects.filter(p => inPeriod(p.due));
    const pLearning = annotatedLearning.filter(l => inPeriod(l.targetDate));
    const pSkills = annotatedSkills.filter(s => inPeriod(s.targetDate));
    const pAppointments = annotatedAppointments.filter(a => inPeriod(a.date));
    const pMeetings = annotatedMeetings.filter(m => inPeriod(m.date));

    const totalPeriodItems = pTasks.length + pMilestones.length + pProjects.length + pLearning.length + pSkills.length + pAppointments.length + pMeetings.length;

    const completedPeriodItems =
      pTasks.filter(t => Boolean(t.done)).length +
      pMilestones.filter(m => m.status === 'completed' || m.progress >= 100).length +
      pProjects.filter(p => p.status === 'Completed').length +
      pLearning.filter(l => l.progress >= 100).length +
      pSkills.filter(s => (s.progress || 0) >= 100).length +
      pAppointments.filter(a => Boolean(a.completed || a.status === 'completed')).length +
      pMeetings.filter(m => Boolean(m.completed || m.status === 'completed')).length;

    const delayedPeriodItems =
      pTasks.filter(t => !t.done && t.delay.isDelayed).length +
      pMilestones.filter(m => m.status !== 'completed' && m.delay.isDelayed).length +
      pProjects.filter(p => p.status !== 'Completed' && p.delay.isDelayed).length +
      pLearning.filter(l => l.progress < 100 && l.delay.isDelayed).length +
      pSkills.filter(s => (s.progress || 0) < 100 && s.delay.isDelayed).length +
      pAppointments.filter(a => !a.completed && a.status !== 'completed' && a.delay.isDelayed).length +
      pMeetings.filter(m => !m.completed && m.status !== 'completed' && m.delay.isDelayed).length;

    const periodRate = totalPeriodItems > 0
      ? Math.round((completedPeriodItems / totalPeriodItems) * 100)
      : (timelineGranularity === 'single_day' ? 100 : onTimeHealthRate);

    const periodLabel =
      timelineGranularity === 'single_day' ? 'Daily Execution Health' :
      timelineGranularity === 'daily' ? 'Weekly Sprint Health' :
      timelineGranularity === 'monthly' ? 'Monthly Execution Health' :
      timelineGranularity === 'yearly' ? 'Yearly Horizons Health' :
      'Lifecycle Execution Health';

    return {
      start,
      end,
      periodLabel,
      totalPeriodItems,
      completedPeriodItems,
      delayedPeriodItems,
      periodRate
    };
  }, [
    timelineData,
    annotatedTasks,
    annotatedMilestones,
    annotatedProjects,
    annotatedLearning,
    annotatedSkills,
    annotatedAppointments,
    annotatedMeetings,
    timelineGranularity,
    onTimeHealthRate,
    today
  ]);

  // Dual-Layer Span Calculator: Maps Start and Target dates onto timeline columns
  const computeSpan = (
    startDateStr: string | undefined,
    targetDateStr: string | undefined,
    cols: any[],
    isSinglePoint: boolean = false,
    startTimeStr?: string,
    endTimeStr?: string
  ) => {
    if (!startDateStr && !targetDateStr) {
      return { inWindow: false, leftPct: 0, widthPct: 0, isPast: false, isFuture: false, isUnscheduled: true, isSinglePoint };
    }

    const itemStart = startDateStr ? startDateStr.slice(0, 10) : (targetDateStr ? targetDateStr.slice(0, 10) : today);
    const itemEnd = targetDateStr ? targetDateStr.slice(0, 10) : itemStart;

    if (!cols || cols.length === 0) {
      return { inWindow: false, leftPct: 0, widthPct: 0, isPast: false, isFuture: false, isSinglePoint };
    }

    if (timelineGranularity === 'single_day') {
      const singleDate = cols[0]?.dateStr;
      const inDay = itemStart <= singleDate && itemEnd >= singleDate;
      if (!inDay) {
        return {
          inWindow: false,
          leftPct: 0,
          widthPct: 0,
          isPast: itemEnd < singleDate,
          isFuture: itemStart > singleDate,
          isSinglePoint
        };
      }

      // If item has a specific scheduled time (e.g. 11:06 - 13:04), compute precise slot position:
      if (startTimeStr) {
        const timePos = computeTimeSlotPosition(startTimeStr, endTimeStr, true);
        if (timePos) {
          return {
            inWindow: true,
            leftPct: timePos.leftPct,
            widthPct: timePos.widthPct,
            isPast: false,
            isFuture: false,
            isSinglePoint: Boolean(isSinglePoint || !endTimeStr),
            itemStart,
            itemEnd
          };
        }
      }

      return {
        inWindow: true,
        leftPct: 0,
        widthPct: 100,
        isPast: false,
        isFuture: false,
        isSinglePoint,
        itemStart,
        itemEnd
      };
    }

    const winStart = cols[0].startIso;
    const winEnd = cols[cols.length - 1].endIso;

    if (itemEnd < winStart) {
      return { inWindow: false, isPast: true, isFuture: false, leftPct: 0, widthPct: 0, isSinglePoint };
    }
    if (itemStart > winEnd) {
      return { inWindow: false, isPast: false, isFuture: true, leftPct: 100, widthPct: 0, isSinglePoint };
    }

    let startColIdx = 0;
    for (let i = 0; i < cols.length; i++) {
      if (itemStart <= cols[i].endIso) {
        startColIdx = i;
        break;
      }
    }

    let endColIdx = cols.length - 1;
    for (let i = cols.length - 1; i >= 0; i--) {
      if (itemEnd >= cols[i].startIso) {
        endColIdx = i;
        break;
      }
    }

    if (startColIdx > endColIdx) startColIdx = endColIdx;

    const totalCols = cols.length;
    const leftPct = (startColIdx / totalCols) * 100;

    // Single-day tasks/milestones in Yearly/Lifecycle view should NOT stretch across 365 days
    let widthPct: number;
    if (isSinglePoint || (timelineGranularity !== 'daily' && itemStart === itemEnd)) {
      widthPct = Math.max(1.5, (1 / totalCols) * 60); // Clean compact point marker width
    } else {
      widthPct = Math.max(2, ((endColIdx - startColIdx + 1) / totalCols) * 100);
    }

    return {
      inWindow: true,
      leftPct,
      widthPct,
      startColIdx,
      endColIdx,
      isPast: false,
      isFuture: false,
      isSinglePoint: isSinglePoint || (itemStart === itemEnd),
      itemStart,
      itemEnd
    };
  };

  // ----------------------------------------------------
  // ACTION HANDLERS: COMPLETION, RESCHEDULE, ALARMS
  // ----------------------------------------------------
  const handleToggleTask = async (task: Task) => {
    const nextDone = !(task.done || task.status === 'done');
    const updated: Task = { ...task, done: nextDone, status: nextDone ? 'done' : 'open', updatedAt: Date.now() };
    await storage.put('tasks', updated);
    const linkedGoalId = resolveTaskGoalId(task, { workProjects, routines, skills, learningItems });
    if (linkedGoalId) await syncGoalProgressFromTasks(linkedGoalId, task.id, nextDone, nextDone ? 'done' : 'open');
    onSuccess(nextDone ? `✓ Completed: "${task.title}"` : `Task set to active: "${task.title}"`);
    onRefresh();
  };

  const handleToggleMilestone = async (m: Milestone) => {
    const isComp = m.status === 'completed' || m.progress >= 100;
    const nextStatus = isComp ? 'pending' : 'completed';
    const nextProgress = isComp ? 0 : 100;
    const updated: Milestone = { ...m, status: nextStatus, progress: nextProgress, updatedAt: Date.now() };
    await storage.put('milestones', updated);
    if (m.goalId) await syncGoalProgressFromMilestones(m.goalId, m.id, nextProgress, nextStatus);
    onSuccess(nextStatus === 'completed' ? `✓ Milestone reached: "${m.title}"` : `Milestone marked pending: "${m.title}"`);
    onRefresh();
  };

  const handleToggleRoutineToday = async (rt: Routine) => {
    const dates = rt.completedDates || [];
    const nextDates = dates.includes(today) ? dates.filter(d => d !== today) : [...dates, today];
    const isDone = nextDates.includes(today);
    const updated: Routine = {
      ...rt,
      completedDate: isDone ? today : null,
      completedDates: nextDates,
      updatedAt: Date.now()
    };
    await storage.put('routines', updated);
    if (rt.goalId) await syncGoalProgressFromRoutines(rt.goalId);
    onSuccess(isDone ? `✓ Routine "${rt.name}" completed for today!` : `Routine unchecked`);
    onRefresh();
  };

  const handleToggleHabitToday = async (habit: Habit) => {
    const todayLogs = habitLogs.filter(log => log.habitId === habit.id && log.date === today);
    const quickLogKey = `${habit.id}|${today}|0`;
    const quickLog = todayLogs.find(log => log.key === quickLogKey);
    const updatedHabit = { ...habit, doneDate: null, updatedAt: Date.now() };
    let removed = false;

    if (quickLog) {
      await storage.delete('habitLogs', quickLog.id);
      await storage.put('habits', updatedHabit);
      removed = true;
    } else if (todayLogs.length === 0 && habit.doneDate === today) {
      await storage.put('habits', updatedHabit);
      removed = true;
    } else {
      const newLog: HabitLog = {
        id: generateUUID(),
        key: quickLogKey,
        habitId: habit.id,
        date: today,
        occurrence: 0,
        createdAt: Date.now()
      };
      await storage.atomicPutMany([
        { storeName: 'habits', item: updatedHabit },
        { storeName: 'habitLogs', item: newLog }
      ]);
    }

    const linkedGoalId = resolveHabitGoalId(habit, routines);
    if (linkedGoalId) await syncGoalProgressFromHabits(linkedGoalId);
    onSuccess(removed ? `Habit "${habit.name}" reset` : `✓ Habit "${habit.name}" logged for today!`);
    onRefresh();
  };

  const handleToggleAppointment = async (app: HealthAppointment) => {
    const isComp = Boolean(app.completed || app.status === 'completed');
    const nextCompleted = !isComp;
    const nextStatus: 'scheduled' | 'completed' = nextCompleted ? 'completed' : 'scheduled';
    const updated: HealthAppointment = {
      ...app,
      completed: nextCompleted,
      status: nextStatus,
      updatedAt: Date.now()
    };
    await storage.put('healthAppointments', updated);
    if (app.goalId) {
      await syncGoalProgressFromAppointments(app.goalId, app.id, nextCompleted, nextStatus);
    }
    onSuccess(nextCompleted ? `✓ Attended checkup: "${app.title}"` : `Checkup marked scheduled: "${app.title}"`);
    onRefresh();
  };

  const handleToggleMeeting = async (mtg: Meeting) => {
    const isComp = Boolean(mtg.completed || mtg.status === 'completed');
    const nextCompleted = !isComp;
    const nextStatus: 'scheduled' | 'completed' = nextCompleted ? 'completed' : 'scheduled';
    const updated: Meeting = {
      ...mtg,
      completed: nextCompleted,
      status: nextStatus,
      updatedAt: Date.now()
    };
    await storage.put('meetings', updated);
    if (mtg.goalId) {
      await syncGoalProgressFromMeetings(mtg.goalId, mtg.id, nextCompleted, nextStatus);
    }
    onSuccess(nextCompleted ? `✓ Meeting completed: "${mtg.title}"` : `Meeting marked scheduled: "${mtg.title}"`);
    onRefresh();
  };

  // Quick Reschedule (Postpone / Snooze +1d, +3d, +7d)
  const handleQuickReschedule = async (
    type: 'task' | 'milestone' | 'project' | 'learning' | 'skill',
    id: string,
    daysToAdd: number
  ) => {
    const newDateStr = addDaysToDateStr(today, daysToAdd);

    if (type === 'task') {
      const t = tasks.find(x => x.id === id);
      if (t) {
        const updated: Task = { ...t, dueAt: newDateStr, date: newDateStr, updatedAt: Date.now() };
        await storage.put('tasks', updated);
        onSuccess(`Rescheduled task "${t.title}" to ${newDateStr}`);
      }
    } else if (type === 'milestone') {
      const m = milestones.find(x => x.id === id);
      if (m) {
        const updated: Milestone = { ...m, dueDate: newDateStr, updatedAt: Date.now() };
        await storage.put('milestones', updated);
        onSuccess(`Rescheduled milestone "${m.title}" to ${newDateStr}`);
      }
    } else if (type === 'project') {
      const p = workProjects.find(x => x.id === id);
      if (p) {
        const updated: WorkProject = { ...p, due: newDateStr, updatedAt: Date.now() };
        await storage.put('workProjects', updated);
        onSuccess(`Rescheduled project "${p.name}" to ${newDateStr}`);
      }
    } else if (type === 'learning') {
      const l = learningItems.find(x => x.id === id);
      if (l) {
        const updated: LearningItem = { ...l, targetDate: newDateStr, updatedAt: Date.now() };
        await storage.put('learningItems', updated);
        onSuccess(`Rescheduled study target "${l.title}" to ${newDateStr}`);
      }
    } else if (type === 'skill') {
      const s = skills.find(x => x.id === id);
      if (s) {
        const updated: Skill = { ...s, targetDate: newDateStr };
        await storage.put('skills', updated);
        onSuccess(`Rescheduled skill drill "${s.name}" to ${newDateStr}`);
      }
    }

    setRescheduleTarget(null);
    onRefresh();
  };

  // Audio Alarms
  const handleTriggerAlarmNow = (title: string, subtitle?: string, id?: string) => {
    alarmService.triggerAlarm({
      id: id || generateUUID(),
      type: 'reminder',
      title: `OVERDUE ALERT: ${title}`,
      subtitle: subtitle || 'Item is past its scheduled deadline. Immediate execution required.',
      timeStr: 'NOW',
      ringtone: 'digital_pulse'
    });
    onSuccess(`Urgent alarm sounding for "${title}"!`);
  };

  const handleArmAlarmsForAllDelayed = async () => {
    if (totalDelayedAllCount === 0) {
      onSuccess('All operating streams are strictly on schedule. Zero delays!');
      return;
    }

    let armed = 0;
    const armItem = async (title: string, linkedId: string, ringtone: string = 'digital_pulse') => {
      if (reminderMap.has(linkedId)) return;
      const targetTimeStr = getLocalDateTimeStr(5 + armed * 2);
      await storage.put('reminders', {
        id: generateUUID(),
        title: `Urgent Alarm: ${title}`,
        dueAt: targetTimeStr,
        repeatRule: 'none',
        status: 'open',
        linkedId,
        alarmEnabled: true,
        ringtone,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      armed++;
    };

    for (const t of delayedTasks) await armItem(t.title, t.id, 'digital_pulse');
    for (const m of delayedMilestones) await armItem(m.title, m.id, 'classic_clock');
    for (const p of delayedProjects) await armItem(p.name, p.id, 'classic_clock');
    for (const l of delayedLearning) await armItem(l.title, l.id, 'morning_chime');
    for (const s of delayedSkills) await armItem(s.name, s.id, 'zen_bell');
    for (const r of delayedRoutines) await armItem(r.name, r.id, 'zen_bell');

    onSuccess(`Armed reminder alarms for ${armed} delayed items across all streams!`);
    onRefresh();
  };

  // Universal Task Genesis Modal
  const handleOpenTaskGenesis = (source: {
    type: 'manual' | 'milestone' | 'project' | 'learning' | 'skill' | 'routine' | 'habit';
    id?: string;
    title: string;
    goalId?: string | null;
    due?: string;
  }) => {
    let defaultTitle = source.title;
    if (source.type === 'milestone') defaultTitle = `Action for Milestone: ${source.title}`;
    else if (source.type === 'project') defaultTitle = `Deliverable Step: ${source.title}`;
    else if (source.type === 'learning') defaultTitle = `Study Session: ${source.title}`;
    else if (source.type === 'skill') defaultTitle = `Skill Practice Drill: ${source.title}`;
    else if (source.type === 'routine') defaultTitle = `Execute Routine: ${source.title}`;
    else if (source.type === 'habit') defaultTitle = `Habit Drill: ${source.title}`;

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
      learningId: genesisModal.sourceType === 'learning' ? genesisModal.sourceId : null,
      skillId: genesisModal.sourceType === 'skill' ? genesisModal.sourceId : null,
      routineId: genesisModal.sourceType === 'routine' ? genesisModal.sourceId : null,
      habitId: genesisModal.sourceType === 'habit' ? genesisModal.sourceId : null,
      done: false,
      status: 'open',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await storage.put('tasks', newTask);

    if (genesisModal.goalId) {
      await syncGoalProgressFromTasks(genesisModal.goalId, taskId, false);
    }

    if (genesisModal.armAlarm) {
      const alarmDueAtStr = `${genesisModal.dueAt}T${genesisModal.alarmTime}`;
      const rem: ReminderItem = {
        id: generateUUID(),
        title: `Action Alarm: ${newTask.title}`,
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
    onSuccess(`Task Genesis complete: "${newTask.title}" added to active planner!`);
    onRefresh();
  };

  // ----------------------------------------------------
  // GOAL FINANCIAL PORTFOLIO COMPUTATION
  // ----------------------------------------------------
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
    const goalInvestmentsTotal = goalInvestments.reduce((sum, i) => sum + (Number(i.currentValue ?? i.amount) || 0), 0);
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

  return (
    <div className="space-y-5">
      {/* 1. EXECUTIVE METRICS DASHBOARD */}
      <div className="metric-summary-grid grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* Card 1: Time-Period Aware Execution Health */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">
              {periodMetrics.periodLabel}
            </span>
            <Target className="h-4 w-4 text-slate-400 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">
            {periodMetrics.periodRate}%
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            {periodMetrics.totalPeriodItems > 0
              ? `${periodMetrics.completedPeriodItems}/${periodMetrics.totalPeriodItems} done`
              : 'No items'}
          </div>
        </div>

        {/* Card 2: Period Overdue Bottlenecks */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">
              {timelineGranularity === 'daily' ? 'This Week Overdue' : timelineGranularity === 'single_day' ? 'Today Overdue' : 'Period Overdue'}
            </span>
            <AlertTriangle className="h-4 w-4 text-slate-400 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">
            {periodMetrics.delayedPeriodItems}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            {totalDelayedAllCount > 0
              ? `${totalDelayedAllCount} total overdue`
              : 'All streams clear'}
          </div>
        </div>

        {/* Card 3: Strategic Deliverables */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Work & Skills</span>
            <Briefcase className="h-4 w-4 text-slate-400 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">
            {workProjects.length + skills.length + learningItems.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            {workProjects.length} projects · {skills.length} skills · {learningItems.length} tracks
          </div>
        </div>

        {/* Card 4: Armed Audio Alarms */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Armed Alarms</span>
            <BellRing className="h-4 w-4 text-slate-400 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">
            {reminderMap.size}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            Active alarms
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
                <span>Critical Bottlenecks Active</span>
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {totalDelayedAllCount} items delayed across Deliverables, Milestones, Routines & Tasks!
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Execute directly, snooze / reschedule (+1d, +3d, +7d) or arm audio reminder alarms.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const firstDelayed =
                    delayedTasks[0] ||
                    delayedProjects[0] ||
                    delayedMilestones[0] ||
                    delayedRoutines[0];
                  if (firstDelayed) {
                    handleTriggerAlarmNow((firstDelayed as any).title || (firstDelayed as any).name);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-500 active:scale-95 transition-all cursor-pointer"
              >
                <BellRing className="h-4 w-4 animate-bounce" />
                <span>Ring Urgent Alarm</span>
              </button>

              <button
                type="button"
                onClick={handleArmAlarmsForAllDelayed}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3.5 py-2 text-xs font-bold text-rose-700 shadow-sm hover:bg-rose-50 active:scale-95 transition-all cursor-pointer dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-slate-800"
              >
                <Bell className="h-4 w-4" />
                <span>Arm Alarms ({totalDelayedAllCount})</span>
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

      {/* 3. MULTI-STREAM ARCHITECTURE NAVIGATOR */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 w-full">
        {/* Stream Tabs with Milestones, Skills, Habits & Finance */}
        <div className="w-full">
          <SlideTabs
            activeId={activeStream}
            onChange={id => setActiveStream(id as any)}
            tabs={[
              { id: 'all', label: 'All Streams', shortLabel: 'All', icon: Layers, badge: totalItemsAllCount },
              { id: 'milestones', label: 'Milestones', shortLabel: 'Milestones', icon: Flag, badge: milestones.length, delayed: delayedMilestones.length },
              { id: 'projects', label: 'Work Projects', shortLabel: 'Projects', icon: Briefcase, badge: workProjects.length, delayed: delayedProjects.length },
              { id: 'learning', label: 'Learning Tracks', shortLabel: 'Learning', icon: BookOpen, badge: learningItems.length, delayed: delayedLearning.length },
              { id: 'skills', label: 'Skill Trees', shortLabel: 'Skills', icon: Award, badge: skills.length, delayed: delayedSkills.length },
              { id: 'routines', label: 'Routines & Habits', shortLabel: 'Routines', icon: Repeat, badge: routines.length + habits.length, delayed: delayedRoutines.length },
              { id: 'tasks', label: 'Tasks & Planner', shortLabel: 'Tasks', icon: CheckCircle2, badge: tasks.length, delayed: delayedTasks.length },
              { id: 'finance', label: 'Finance Stream', shortLabel: 'Finance', icon: Landmark, badge: savingsPlans.length + loans.length + investments.length, delayed: delayedSavings.length + delayedLoans.length }
            ]}
          />
        </div>

        {/* View Mode & Sub-filters + Task Genesis + Mobile Compact Toggle */}
        <div className="flex min-w-0 w-full flex-wrap items-center gap-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
          {/* Left Actions: Task Genesis & Mobile Sidebar Toggle */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenTaskGenesis({ type: 'manual', title: '' })}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 active:scale-95 transition-all cursor-pointer shrink-0 whitespace-nowrap"
              title="Deploy Task Genesis Unit"
            >
              <Zap className="h-3.5 w-3.5 shrink-0" />
              <span>Task Genesis</span>
            </button>

            {/* Mobile Column Compact Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileCompactView(prev => !prev)}
              className="sm:hidden inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
              title="Toggle Compact Left Column for Mobile"
            >
              {isMobileCompactView ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              <span>{isMobileCompactView ? 'Wide' : 'Compact'}</span>
            </button>
          </div>

          {/* View Mode Switcher (Gantt, Operating Plan, Delay Radar) */}
          <div className="flex min-w-0 max-w-full flex-1 basis-[20rem] items-center gap-3 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setViewMode('gantt')}
              className={`flex items-center gap-1 border-b-0 border-transparent px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'gantt' ? 'text-amber-700 dark:text-amber-300' : 'text-amber-800 hover:border-amber-500 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
              }`}
            >
              <Calendar className="h-3 w-3" />
              <span>Timeline</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('hierarchy')}
              className={`flex items-center gap-1 border-b-0 border-transparent px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'hierarchy' ? 'text-amber-700 dark:text-amber-300' : 'text-amber-800 hover:border-amber-500 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
              }`}
            >
              <Layers className="h-3 w-3" />
              <span>Plan</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('radar')}
              className={`flex items-center gap-1 border-b-0 border-transparent px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'radar' ? 'text-amber-700 dark:text-amber-300' : 'text-amber-800 hover:border-amber-500 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
              }`}
            >
              <ShieldAlert className="h-3 w-3" />
              <span>Delays ({totalDelayedAllCount})</span>
            </button>
          </div>

          {/* Search & Filters */}
          <div className="flex min-w-0 flex-1 basis-[22rem] flex-wrap items-center gap-2">
          <div className="flex min-w-28 flex-1 basis-36 items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50/40 px-2.5 py-1 text-xs dark:border-amber-900/60 dark:bg-slate-800">
              <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search plan..."
                className="w-24 min-w-0 flex-1 bg-transparent text-xs text-slate-900 outline-none placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-amber-500 dark:text-white dark:placeholder:text-slate-400 sm:flex-none sm:w-32"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <select
              value={selectedGoalId}
              onChange={e => setSelectedGoalId(e.target.value)}
              className="h-8 min-w-28 max-w-full flex-1 basis-28 rounded-xl border border-amber-200 bg-amber-50/40 px-2.5 text-xs font-medium text-slate-700 focus:border-amber-500 focus:outline-none dark:border-amber-900/60 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-amber-500 cursor-pointer"
            >
              <option value="all">Goals ({goals.length})</option>
              {hierarchicalGoals.map(g => (
                <option key={g.id} value={g.id}>
                  <GoalTierIcon level={g.level} /> {g.title}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="h-8 min-w-28 max-w-full flex-1 basis-28 rounded-xl border border-amber-200 bg-amber-50/40 px-2.5 text-xs font-medium text-slate-700 focus:border-amber-500 focus:outline-none dark:border-amber-900/60 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-amber-500 cursor-pointer"
            >
              <option value="all">Status</option>
              <option value="delayed">Overdue ({totalDelayedAllCount})</option>
              <option value="pending">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. GANTT ROADMAP VIEW ACROSS ALL STREAMS (INCLUDING FINANCE) */}
      {viewMode === 'gantt' && (
        <div className="space-y-4">
          {/* Top Financial Portfolio Overview when Finance stream is active */}
          {activeStream === 'finance' && (
            <div className="metric-summary-grid grid grid-cols-2 sm:grid-cols-4 gap-3 animate-in fade-in duration-200">
              <div className="rounded-xl border-2 border-dashed border-slate-200 p-3.5 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tracked Goals</span>
                <div className="mt-1 font-mono text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                  {financiallyLinkedGoals.length} <span className="text-xs font-normal text-slate-400">/ {goals.length}</span>
                </div>
              </div>

              <div className="rounded-xl border-2 border-dashed border-slate-200 p-3.5 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Linked Income</span>
                <div className="mt-1 font-mono text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  ₹{transactions.filter(t => t.goalId && t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0).toLocaleString('en-IN')}
                </div>
              </div>

              <div className="rounded-xl border-2 border-dashed border-slate-200 p-3.5 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">Linked Expenses</span>
                <div className="mt-1 font-mono text-xl sm:text-2xl font-extrabold text-rose-600 dark:text-rose-400">
                  ₹{transactions.filter(t => t.goalId && t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0).toLocaleString('en-IN')}
                </div>
              </div>

              <div className="rounded-xl border-2 border-dashed border-slate-200 p-3.5 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Investments</span>
                <div className="mt-1 font-mono text-xl sm:text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                  ₹{investments.filter(i => i.goalId).reduce((s, i) => s + (Number(i.currentValue ?? i.amount) || 0), 0).toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-[var(--om-line)] bg-card shadow-sm">
            {/* Header Bar */}
            <div className="flex flex-col justify-between gap-2 border-b border-[var(--om-line)] bg-card-soft px-4 py-2.5 text-xs text-ink-soft sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                <span className="truncate font-semibold text-ink">
                  Multi-Stream Execution Schedule
                </span>
                <span className="hidden text-ink-muted md:inline">· 5-Branch Hierarchy, Milestones, Projects, Learning, Skills & Routines</span>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  <span>Delayed</span>
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="h-2 w-2 rounded-full bg-amber-600" />
                  <span>Planned Span</span>
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Completed</span>
                </span>
              </div>
            </div>

            {/* Granularity Switcher & Period Controls */}
            <div className="flex flex-col justify-between gap-2 border-b border-[var(--om-line)] bg-card-soft px-4 py-2 sm:flex-row sm:items-center">
              <div className="timeline-granularity-tabs flex w-full max-w-full min-w-0 flex-wrap items-center gap-1 sm:w-auto sm:flex-1">
                {([
                  ['single_day', 'Day'],
                  ['daily', 'Week'],
                  ['monthly', 'Monthly'],
                  ['yearly', 'Yearly'],
                  ['lifecycle', 'Lifecycle']
                ] as const).map(([granularity, label], index) => (
                  <React.Fragment key={granularity}>
                    {index > 0 && <span aria-hidden="true" className="px-0.5 text-amber-400/80 dark:text-amber-700">·</span>}
                    <button
                      type="button"
                      aria-pressed={timelineGranularity === granularity}
                      onClick={() => { setTimelineGranularity(granularity); setTimelineOffset(0); }}
                      className={`timeline-granularity-tab px-1.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap sm:text-xs ${
                        timelineGranularity === granularity
                          ? 'text-amber-800 dark:text-amber-200'
                          : 'text-amber-700 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-100'
                      }`}
                    >
                      {label}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              <div className="flex w-full min-w-0 max-w-full flex-wrap items-center gap-1.5 sm:ml-auto sm:w-auto">
                <button
                  type="button"
                  onClick={() => setTimelineOffset(prev => prev - 1)}
                  className="p-1 text-amber-800 transition-colors hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200 cursor-pointer"
                  title="Previous Window"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setTimelineOffset(0)}
                  className={`rounded-full border border-amber-300/80 px-2.5 py-0.5 text-xs font-semibold transition-colors cursor-pointer dark:border-amber-800 ${
                    timelineOffset === 0
                      ? 'bg-card-soft text-amber-900 dark:text-amber-200'
                      : 'bg-transparent text-amber-800 hover:bg-card-soft dark:text-amber-300 dark:hover:bg-card-soft'
                  }`}
                >
                  {timelineGranularity === 'single_day' ? 'Today' : 'Current'}
                </button>
                <button
                  type="button"
                  onClick={() => setTimelineOffset(prev => prev + 1)}
                  className="p-1 text-amber-800 transition-colors hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200 cursor-pointer"
                  title="Next Window"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-0 flex-1 basis-24 truncate text-right font-mono text-xs font-bold text-ink sm:ml-1">
                  {timelineData.title}
                </span>
              </div>
            </div>

            {/* Quick Financial KPIs bar when in Finance stream */}
            {activeStream === 'finance' && (
              <div className="grid grid-cols-2 gap-2 border-b border-[var(--om-line)] p-2.5 sm:grid-cols-4">
                <div className="rounded-xl border border-[var(--om-line)] bg-card-soft p-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-ink-muted">Tracked Goals</span>
                  <div className="font-mono text-base font-extrabold text-ink">
                    {financiallyLinkedGoals.length} <span className="text-[10px] font-normal text-ink-muted">/ {goals.length}</span>
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--om-line)] bg-card-soft p-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Savings Target</span>
                  <div className="font-mono text-base font-extrabold text-emerald-700 dark:text-emerald-400">
                    ₹{savingsPlans.reduce((s, sp) => s + (Number(sp.targetAmount) || 0), 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--om-line)] bg-card-soft p-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">Active Debt / Loans</span>
                  <div className="font-mono text-base font-extrabold text-rose-700 dark:text-rose-400">
                    ₹{loans.reduce((s, l) => s + (Number((l as any).principal ?? (l as any).amount) || 0), 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--om-line)] bg-card-soft p-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Investments Val</span>
                  <div className="font-mono text-base font-extrabold text-amber-700 dark:text-amber-300">
                    ₹{investments.reduce((s, i) => s + (Number(i.currentValue ?? i.amount) || 0), 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            )}

            {/* Timeline Table Body */}
            <div className="overflow-x-auto no-scrollbar">
              <div className="min-w-[720px] sm:min-w-[850px]">
                <div className="flex border-b border-[var(--om-line)] bg-card-soft text-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  <div className={`${isMobileCompactView ? 'w-[140px]' : 'w-[260px] sm:w-[280px]'} sticky left-0 z-30 shrink-0 border-r border-[var(--om-line)] bg-card-soft p-2 pl-3 text-left font-semibold text-slate-700 transition-all dark:text-slate-300 sm:pl-4`}>
                    {isMobileCompactView ? 'WORKSTREAM' : 'PROJECT WORKSTREAM'}
                  </div>
                  <div
                    className="grid flex-1"
                    style={{ gridTemplateColumns: `repeat(${timelineData.cols.length}, minmax(0, 1fr))` }}
                  >
                    {timelineData.cols.map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          if (timelineGranularity === 'daily' && (c as any).offsetFromToday !== undefined) {
                            setTimelineGranularity('single_day');
                            setTimelineOffset((c as any).offsetFromToday);
                          }
                        }}
                        className={`border-l border-[var(--om-line)] p-1.5 transition-colors ${
                          timelineGranularity === 'daily' ? 'cursor-pointer hover:bg-amber-100/70 dark:hover:bg-amber-950/40' : ''
                        } ${
                          c.isToday
                            ? 'bg-[#b88648] font-black text-white dark:bg-[#9b713b]'
                            : 'bg-card-soft text-slate-500 dark:text-slate-400'
                        }`}
                        title={timelineGranularity === 'daily' ? `Click to open Single Day focus for ${c.dateStr}` : undefined}
                      >
                        <div className="truncate">{c.label}</div>
                        {c.subLabel && <div className="truncate text-[11px]">{c.subLabel}</div>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rows Grouped by Hierarchical Goals */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60">

                {(selectedGoalId === 'all' ? hierarchicalGoals : hierarchicalGoals.filter(g => g.id === selectedGoalId))
                  .map(goal => {
                    const indexed = goalItemIndex.get(goal.id);
                    const goalTasks = indexed?.tasks || [];
                    const goalMilestones = indexed?.milestones || [];
                    const goalProjects = indexed?.projects || [];
                    const goalLearning = indexed?.learning || [];
                    const goalSkills = indexed?.skills || [];
                    const goalRoutines = indexed?.routines || [];
                    const goalHabits = indexed?.habits || [];
                    const goalAppointments = indexed?.appointments || [];
                    const goalMeetings = indexed?.meetings || [];
                    const goalSavings = indexed?.savingsPlans || [];
                    const goalLoans = indexed?.loans || [];
                    const goalInvestments = indexed?.investments || [];
                    const childGoalCount = goals.filter(child =>
                      child.parentId === goal.id || child.parentIds?.includes(goal.id)
                    ).length;

                    const isGoalExpanded = expandedGoalIds[goal.id] !== false;
                    const totalGoalItems =
                      childGoalCount +
                      goalMilestones.length +
                      goalProjects.length +
                      goalLearning.length +
                      goalSkills.length +
                      goalRoutines.length +
                      goalHabits.length +
                      goalTasks.length +
                      goalAppointments.length +
                      goalMeetings.length +
                      goalSavings.length +
                      goalLoans.length +
                      goalInvestments.length;

                    // Stream Filter check
                    if (activeStream === 'milestones' && goalMilestones.length === 0) return null;
                    if (activeStream === 'projects' && goalProjects.length === 0) return null;
                    if (activeStream === 'learning' && goalLearning.length === 0) return null;
                    if (activeStream === 'skills' && goalSkills.length === 0) return null;
                    if (activeStream === 'routines' && goalRoutines.length === 0 && goalHabits.length === 0) return null;
                    if (activeStream === 'tasks' && goalTasks.length === 0) return null;
                    if (activeStream === 'finance' && goalSavings.length === 0 && goalLoans.length === 0 && goalInvestments.length === 0) return null;

                    // Dynamic period items calculation for this goal
                    const pStart = timelineData.periodStartIso || '';
                    const pEnd = timelineData.periodEndIso || '';
                    const periodGoalItems =
                      goalTasks.filter(t => {
                        const d = (t.dueAt || t.date || '').slice(0, 10);
                        return Boolean(d && pStart && pEnd && d >= pStart && d <= pEnd);
                      }).length +
                      goalMilestones.filter(m => {
                        const d = (m.dueDate || '').slice(0, 10);
                        return Boolean(d && pStart && pEnd && d >= pStart && d <= pEnd);
                      }).length +
                      goalAppointments.filter(a => {
                        const d = (a.date || '').slice(0, 10);
                        return Boolean(d && pStart && pEnd && d >= pStart && d <= pEnd);
                      }).length +
                      goalMeetings.filter(m => {
                        const d = (m.date || '').slice(0, 10);
                        return Boolean(d && pStart && pEnd && d >= pStart && d <= pEnd);
                      }).length;

                    const periodGoalDone =
                      goalTasks.filter(t => {
                        const d = (t.dueAt || t.date || '').slice(0, 10);
                        return Boolean(t.done && d && pStart && pEnd && d >= pStart && d <= pEnd);
                      }).length +
                      goalMilestones.filter(m => {
                        const d = (m.dueDate || '').slice(0, 10);
                        return Boolean((m.status === 'completed' || m.progress >= 100) && d && pStart && pEnd && d >= pStart && d <= pEnd);
                      }).length +
                      goalAppointments.filter(a => {
                        const d = (a.date || '').slice(0, 10);
                        const isDone = Boolean(a.completed || a.status === 'completed');
                        return Boolean(isDone && d && pStart && pEnd && d >= pStart && d <= pEnd);
                      }).length +
                      goalMeetings.filter(m => {
                        const d = (m.date || '').slice(0, 10);
                        const isDone = Boolean(m.completed || m.status === 'completed');
                        return Boolean(isDone && d && pStart && pEnd && d >= pStart && d <= pEnd);
                      }).length;

                    const windowLabel =
                      timelineGranularity === 'single_day' ? 'Today' :
                      timelineGranularity === 'daily' ? 'This Week' :
                      timelineGranularity === 'monthly' ? 'This Month' :
                      timelineGranularity === 'yearly' ? 'Yearly' : 'Lifecycle';

                    const periodGoalRate = periodGoalItems > 0
                      ? Math.round((periodGoalDone / periodGoalItems) * 100)
                      : null;

                    const goalStart = goal.createdAt ? getLocalDateString(new Date(goal.createdAt)) : undefined;
                    const goalSpan = computeSpan(goalStart, goal.targetDate, timelineData.cols);
                    const tierMeta = getGoalTierBadge(goal.level);
                    const indentPx = (goal.level ? (goal.level - 1) : 0) * 12;

                    return (
                      <div key={goal.id} className="space-y-0.5">
                        {/* Goal Row */}
                        <div className="flex items-center bg-slate-50/70 hover:bg-slate-100/60 dark:bg-slate-900/60 dark:hover:bg-slate-800/50 transition-colors">
                          {/* Sticky Left Goal Summary */}
                          <div
                            className={`${isMobileCompactView ? 'w-[140px]' : 'w-[260px] sm:w-[280px]'} shrink-0 p-2 pr-3 pl-3 flex items-center justify-between sticky left-0 z-20 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-r border-slate-200/80 dark:border-slate-800/80 transition-all`}
                            style={{ paddingLeft: `${Math.max(12, 12 + indentPx)}px` }}
                          >
                            <div className="min-w-0 flex items-center gap-1.5 flex-1">
                              <button
                                type="button"
                                onClick={() => setExpandedGoalIds(prev => ({ ...prev, [goal.id]: prev[goal.id] === undefined ? false : !prev[goal.id] }))}
                                className="p-1 -ml-1 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                                title={isGoalExpanded ? 'Collapse' : 'Expand'}
                              >
                                {isGoalExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                                )}
                              </button>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1">
                                  <ThemeIcon name={tierMeta.icon} className="h-3 w-3" />
                                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                    {goal.title}
                                  </span>
                                  <span
                                    className="text-[10px] text-slate-400 shrink-0 font-mono"
                                    title={`${totalGoalItems} linked timeline items, including ${childGoalCount} subgoals`}
                                  >
                                    ({totalGoalItems} linked)
                                  </span>
                                </div>
                                {!isMobileCompactView && (
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                    {activeStream === 'finance' ? (
                                      <div className="flex items-center gap-1 font-mono text-emerald-700 dark:text-emerald-400">
                                        <span className="inline-flex items-center gap-1 font-bold"><ThemeIcon name="savings" className="h-3 w-3" /> Savings: {goalSavings.length}</span>
                                        <span>·</span>
                                        <span className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400"><ThemeIcon name="loan" className="h-3 w-3" /> Loans: {goalLoans.length}</span>
                                        <span>·</span>
                                        <span className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400"><ThemeIcon name="portfolio" className="h-3 w-3" /> Inv: {goalInvestments.length}</span>
                                      </div>
                                    ) : periodGoalRate !== null ? (
                                      <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded font-mono">
                                        {windowLabel}: {periodGoalRate}% ({periodGoalDone}/{periodGoalItems})
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">
                                        {windowLabel}: 0 tasks
                                      </span>
                                    )}
                                    <span>·</span>
                                    <span
                                      className="font-bold text-indigo-600 dark:text-indigo-400 font-mono"
                                      title={totalGoalItems === 0
                                        ? 'No linked timeline items or subgoals are shown here. Progress may be manually set or based on linked data outside this timeline.'
                                        : 'Progress is based on linked work items and subgoals.'}
                                    >
                                      {totalGoalItems === 0 ? 'Manual progress' : 'Overall'}: {goal.progress}%
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right Timeline Canvas */}
                          <div className="flex-1 relative h-8 flex items-center min-w-0">
                            {/* Grid Guide Lines */}
                            <div
                              className="absolute inset-0 grid pointer-events-none"
                              style={{ gridTemplateColumns: `repeat(${timelineData.cols.length}, minmax(0, 1fr))` }}
                            >
                              {timelineData.cols.map(c => (
                                <div
                                  key={c.id}
                                  className={`h-full border-l border-slate-200/40 dark:border-slate-800/40 ${
                                    c.isToday ? 'bg-indigo-500/5 dark:bg-indigo-400/10' : ''
                                  }`}
                                />
                              ))}
                            </div>

                            {/* Goal Progress Bar on Canvas */}
                            {goalSpan.inWindow ? (
                              <div
                                className="absolute top-1/2 -translate-y-1/2 h-6 sm:h-7 rounded-xl border border-indigo-200/90 bg-indigo-50/70 dark:border-indigo-800/80 dark:bg-indigo-950/40 overflow-hidden flex items-center shadow-2xs z-10"
                                style={{
                                  left: `${goalSpan.leftPct}%`,
                                  width: `${goalSpan.widthPct}%`
                                }}
                                title={`Goal: ${goal.title}\nPlanned: ${goalStart || 'Genesis'} → ${goal.targetDate || 'Ongoing'}\nProgress: ${goal.progress}%\nWindow Pace: ${periodGoalRate !== null ? `${periodGoalRate}% (${periodGoalDone}/${periodGoalItems})` : 'No items'}`}
                              >
                                <div
                                  className={`h-full transition-all duration-300 rounded-lg ${
                                    goal.progress >= 100 ? 'bg-emerald-500' : 'bg-indigo-600 dark:bg-indigo-500'
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(0, goal.progress))}%` }}
                                />
                                <div className="absolute inset-0 flex items-center justify-between px-2 text-[10px] font-bold pointer-events-none min-w-0">
                                  <div className="flex items-center gap-1.5 truncate">
                                    {/* Prominent Window Pace Badge / Finance Portfolio Badge */}
                                    {activeStream === 'finance' ? (
                                      <span className="font-mono text-white px-1.5 py-0.5 rounded bg-emerald-600 shadow-xs flex items-center gap-1 text-[9px]">
                                        <span>Portfolio:</span>
                                        <span>₹{goalSavings.reduce((s, sp) => s + (Number(sp.currentAmount) || 0), 0).toLocaleString('en-IN')} saved</span>
                                        {goalLoans.length > 0 && <span className="opacity-90">· ₹{goalLoans.reduce((s, l) => s + (Number((l as any).outstanding) || 0), 0).toLocaleString('en-IN')} debt</span>}
                                      </span>
                                    ) : periodGoalRate !== null ? (
                                      <span className="font-mono text-white px-1.5 py-0.5 rounded bg-emerald-600 shadow-xs flex items-center gap-1 text-[9px]">
                                        <span className="opacity-90">{windowLabel}:</span>
                                        <span>{periodGoalRate}%</span>
                                        <span className="opacity-75 font-normal">({periodGoalDone}/{periodGoalItems})</span>
                                      </span>
                                    ) : null}

                                    {/* Overall Destination Progress */}
                                    <span
                                      className="font-mono text-white px-1.5 py-0.5 rounded bg-black/40 shadow-xs text-[9px]"
                                      title={totalGoalItems === 0
                                        ? 'No linked timeline items or subgoals are shown here. Progress may be manually set or based on linked data outside this timeline.'
                                        : 'Progress is based on linked work items and subgoals.'}
                                    >
                                      {totalGoalItems === 0 ? 'Manual' : 'Overall'}: {goal.progress}%
                                    </span>

                                    <span className="text-slate-800 dark:text-slate-100 truncate hidden sm:inline drop-shadow-xs font-semibold">
                                      {goal.title}
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-slate-600 dark:text-slate-300 font-mono hidden md:inline font-semibold">
                                    {goal.targetDate || 'Ongoing'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="absolute top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-medium px-3 italic z-10">
                                {goalSpan.isFuture ? `Target ${goal.targetDate || 'future'}` : `Target: ${goal.targetDate || 'Ongoing'}`} ({goal.progress}%)
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Expandable Child Items */}
                        {isGoalExpanded && (
                          <div className="divide-y divide-slate-100/60 dark:divide-slate-800/40">
                            {/* 1. MILESTONES STREAM */}
                            {(activeStream === 'all' || activeStream === 'milestones') &&
                              goalMilestones.map(ms => {
                                const isDelayed = ms.delay.isDelayed && ms.status !== 'completed' && ms.progress < 100;
                                const isComp = ms.status === 'completed' || ms.progress >= 100;
                                const msSpan = computeSpan(ms.dueDate, ms.dueDate, timelineData.cols, true);

                                return (
                                  <div
                                    key={ms.id}
                                    className={`flex items-center py-1.5 text-xs transition-colors ${
                                      isDelayed ? 'bg-rose-50/50 dark:bg-rose-950/20' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                                    }`}
                                  >
                                    <div className={`${isMobileCompactView ? 'w-[140px]' : 'w-[260px] sm:w-[280px]'} shrink-0 pl-6 pr-2 flex items-center justify-between sticky left-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-r border-slate-200/80 dark:border-slate-800/80`}>
                                      <div className="flex items-center gap-1.5 truncate">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleMilestone(ms)}
                                          className="text-amber-500 hover:text-amber-600 cursor-pointer shrink-0"
                                        >
                                          {isComp ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Flag className="h-3.5 w-3.5 text-amber-500" />}
                                        </button>
                                        <span className={`truncate ${isComp ? 'line-through text-slate-400' : isDelayed ? 'font-bold text-rose-700 dark:text-rose-300' : 'font-medium text-slate-800 dark:text-slate-200'}`}>
                                          {ms.title}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0 ml-1">
                                        <button
                                          type="button"
                                          onClick={() => setRescheduleTarget({ id: ms.id, type: 'milestone', title: ms.title, currentDate: ms.dueDate })}
                                          className="rounded bg-slate-100 hover:bg-slate-200 px-1 text-[9px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                                          title="Quick Reschedule / Snooze"
                                        >
                                          +1d
                                        </button>
                                        {isDelayed && (
                                          <button
                                            type="button"
                                            onClick={() => handleTriggerAlarmNow(ms.title, ms.delay.label, ms.id)}
                                            className="rounded bg-rose-600 p-0.5 text-white hover:bg-rose-500 cursor-pointer"
                                            title="Ring Urgent Alarm"
                                          >
                                            <BellRing className="h-2.5 w-2.5 animate-bounce" />
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex-1 relative h-6 flex items-center min-w-0">
                                      {msSpan.inWindow ? (
                                        <div
                                          className="absolute top-1/2 -translate-y-1/2 z-10 pointer-events-auto"
                                          style={{ left: `${msSpan.leftPct}%`, transform: 'translateX(2px)' }}
                                        >
                                          <div
                                            onClick={() => handleToggleMilestone(ms)}
                                            className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] font-bold shadow-xs whitespace-nowrap cursor-pointer border ${
                                              isComp
                                                ? 'bg-emerald-500 text-white border-emerald-600'
                                                : isDelayed
                                                ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-400/50 animate-pulse'
                                                : 'bg-white text-amber-700 border-amber-300 dark:bg-slate-800 dark:text-amber-300'
                                            }`}
                                            title={`Milestone: ${ms.title} · Due ${ms.dueDate || 'No Date'}`}
                                          >
                                            <Flag className="h-2.5 w-2.5 shrink-0" />
                                            <span className="truncate max-w-[140px]">{ms.title}</span>
                                            <span className="text-[9px] opacity-75 font-mono">{isComp ? '✓' : ms.dueDate?.slice(5)}</span>
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 italic pl-3 z-10">Due {ms.dueDate || 'No date'}</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                            {/* 2. WORK PROJECTS STREAM */}
                            {(activeStream === 'all' || activeStream === 'projects') &&
                              goalProjects.map(proj => {
                                const isDelayed = proj.delay.isDelayed && proj.status !== 'Completed';
                                const isComp = proj.status === 'Completed';
                                const projStart = proj.createdAt ? getLocalDateString(new Date(proj.createdAt)) : undefined;
                                const projSpan = computeSpan(projStart, proj.due, timelineData.cols);

                                return (
                                  <div
                                    key={proj.id}
                                    className={`flex items-center py-1.5 text-xs transition-colors ${
                                      isDelayed ? 'bg-rose-50/50 dark:bg-rose-950/20' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                                    }`}
                                  >
                                    <div className={`${isMobileCompactView ? 'w-[140px]' : 'w-[260px] sm:w-[280px]'} shrink-0 pl-6 pr-2 flex items-center justify-between sticky left-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-r border-slate-200/80 dark:border-slate-800/80`}>
                                      <div className="flex items-center gap-1.5 truncate">
                                        <Briefcase className="h-3 w-3 text-emerald-600 shrink-0" />
                                        <span className={`truncate ${isDelayed ? 'font-bold text-rose-700 dark:text-rose-300' : 'text-slate-800 dark:text-slate-200'}`}>
                                          {proj.name}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0 ml-1">
                                        <button
                                          type="button"
                                          onClick={() => handleOpenTaskGenesis({ type: 'project', id: proj.id, title: proj.name, goalId: proj.goalId, due: proj.due })}
                                          className="rounded bg-indigo-50 px-1 text-[9px] font-bold text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 cursor-pointer"
                                          title="Spawn Action Task"
                                        >
                                          + Task
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setRescheduleTarget({ id: proj.id, type: 'project', title: proj.name, currentDate: proj.due })}
                                          className="rounded bg-slate-100 hover:bg-slate-200 px-1 text-[9px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                                          title="Quick Reschedule / Snooze"
                                        >
                                          +1d
                                        </button>
                                      </div>
                                    </div>

                                    <div className="flex-1 relative h-6 flex items-center min-w-0">
                                      {projSpan.inWindow ? (
                                        <div
                                          className="absolute top-1/2 -translate-y-1/2 h-5 rounded-lg border border-emerald-300 bg-emerald-50/90 dark:border-emerald-800 dark:bg-emerald-950/40 overflow-hidden flex items-center z-10 shadow-2xs"
                                          style={{ left: `${projSpan.leftPct}%`, width: `${projSpan.widthPct}%` }}
                                        >
                                          <div
                                            className={`h-full rounded-md ${isComp ? 'bg-emerald-500' : isDelayed ? 'bg-rose-600' : 'bg-emerald-600'}`}
                                            style={{ width: `${isComp ? 100 : proj.progress || 35}%` }}
                                          />
                                          <span className="absolute left-1.5 text-[9px] font-bold text-slate-800 dark:text-slate-100 truncate">
                                            {proj.name} ({isComp ? '100%' : `${proj.progress || 35}%`})
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 italic pl-3 z-10">Due {proj.due || 'Ongoing'}</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                            {/* 3. LEARNING TRACKS STREAM */}
                            {(activeStream === 'all' || activeStream === 'learning') &&
                              goalLearning.map(learn => {
                                const isDelayed = learn.delay.isDelayed && learn.progress < 100;
                                const learnSpan = computeSpan(undefined, learn.targetDate, timelineData.cols);

                                return (
                                  <div
                                    key={learn.id}
                                    className={`flex items-center py-1.5 text-xs transition-colors ${
                                      isDelayed ? 'bg-rose-50/50 dark:bg-rose-950/20' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                                    }`}
                                  >
                                    <div className={`${isMobileCompactView ? 'w-[140px]' : 'w-[260px] sm:w-[280px]'} shrink-0 pl-6 pr-2 flex items-center justify-between sticky left-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-r border-slate-200/80 dark:border-slate-800/80`}>
                                      <div className="flex items-center gap-1.5 truncate">
                                        <BookOpen className="h-3 w-3 text-purple-600 shrink-0" />
                                        <span className={`truncate ${isDelayed ? 'font-bold text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                          {learn.title} ({learn.progress}%)
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenTaskGenesis({ type: 'learning', id: learn.id, title: learn.title, goalId: learn.goalId, due: learn.targetDate })}
                                        className="rounded bg-purple-50 px-1 text-[9px] font-bold text-purple-600 hover:bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300 cursor-pointer shrink-0"
                                      >
                                        + Task
                                      </button>
                                    </div>

                                    <div className="flex-1 relative h-5 flex items-center min-w-0">
                                      {learnSpan.inWindow ? (
                                        <div
                                          className="absolute top-1/2 -translate-y-1/2 h-4 rounded border border-purple-200 bg-purple-50/80 dark:border-purple-800 dark:bg-purple-950/40 overflow-hidden flex items-center z-10"
                                          style={{ left: `${learnSpan.leftPct}%`, width: `${learnSpan.widthPct}%` }}
                                        >
                                          <div className="h-full rounded bg-purple-500" style={{ width: `${learn.progress}%` }} />
                                          <span className="absolute left-1.5 text-[9px] font-bold text-slate-800 dark:text-slate-100 truncate">
                                            {learn.title} · {learn.progress}%
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 italic pl-3 z-10">Target {learn.targetDate || 'No date'}</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                            {/* 4. SKILL TREES STREAM (NEWLY RENDERED & FULLY INTEGRATED) */}
                            {(activeStream === 'all' || activeStream === 'skills') &&
                              goalSkills.map(sk => {
                                const isDelayed = sk.delay.isDelayed && (sk.progress || 0) < 100;
                                const skillSpan = computeSpan(undefined, sk.targetDate, timelineData.cols);

                                return (
                                  <div
                                    key={sk.id}
                                    className={`flex items-center py-1.5 text-xs transition-colors ${
                                      isDelayed ? 'bg-rose-50/50 dark:bg-rose-950/20' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                                    }`}
                                  >
                                    <div className={`${isMobileCompactView ? 'w-[140px]' : 'w-[260px] sm:w-[280px]'} shrink-0 pl-6 pr-2 flex items-center justify-between sticky left-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-r border-slate-200/80 dark:border-slate-800/80`}>
                                      <div className="flex items-center gap-1.5 truncate">
                                        <Award className="h-3 w-3 text-amber-500 shrink-0" />
                                        <span className={`truncate ${isDelayed ? 'font-bold text-rose-700 dark:text-rose-300' : 'text-slate-800 dark:text-slate-200'}`}>
                                          {sk.name} ({sk.progress || 0}%)
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenTaskGenesis({ type: 'skill', id: sk.id, title: sk.name, goalId: sk.goalId, due: sk.targetDate })}
                                        className="rounded bg-amber-50 px-1 text-[9px] font-bold text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 cursor-pointer shrink-0"
                                      >
                                        + Drill
                                      </button>
                                    </div>

                                    <div className="flex-1 relative h-5 flex items-center min-w-0">
                                      {skillSpan.inWindow ? (
                                        <div
                                          className="absolute top-1/2 -translate-y-1/2 h-4 rounded border border-amber-300 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/40 overflow-hidden flex items-center z-10"
                                          style={{ left: `${skillSpan.leftPct}%`, width: `${skillSpan.widthPct}%` }}
                                        >
                                          <div className="h-full rounded bg-amber-500" style={{ width: `${sk.progress || 25}%` }} />
                                          <span className="absolute left-1.5 text-[9px] font-bold text-slate-800 dark:text-slate-100 truncate">
                                            {sk.name} · {sk.level || 'Novice'} → {sk.targetLevel || 'Master'}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 italic pl-3 z-10">Target {sk.targetDate || 'Continuous'}</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                            {/* 5. ROUTINES STREAM */}
                            {(activeStream === 'all' || activeStream === 'routines') &&
                              goalRoutines.map(rt => {
                                const isDoneToday = rt.completedDates?.includes(today);
                                const isDelayed = rt.delay.isDelayed;

                                return (
                                  <div
                                    key={rt.id}
                                    className={`flex items-center py-1 text-xs transition-colors ${
                                      isDelayed ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                                    }`}
                                  >
                                    <div className={`${isMobileCompactView ? 'w-[140px]' : 'w-[260px] sm:w-[280px]'} shrink-0 pl-6 pr-2 flex items-center justify-between sticky left-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-r border-slate-200/80 dark:border-slate-800/80`}>
                                      <div className="flex items-center gap-1.5 truncate">
                                        <Repeat className="h-3 w-3 text-amber-500 shrink-0" />
                                        <span className={`truncate ${isDelayed ? 'font-bold text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                          {rt.name}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleRoutineToday(rt)}
                                        className="text-[9px] font-bold text-emerald-600 hover:underline cursor-pointer shrink-0"
                                      >
                                        {isDoneToday ? '✓ Done' : 'Execute'}
                                      </button>
                                    </div>

                                    <div className="flex-1 relative h-6 flex items-center min-w-0">
                                      {timelineGranularity === 'single_day' ? (
                                        (() => {
                                          const timePos = computeTimeSlotPosition(rt.startTime, rt.endTime, true);
                                          if (!timePos) {
                                            return (
                                              <span className="text-[10px] text-slate-400 pl-3 z-10">Daily routine block</span>
                                            );
                                          }
                                          return (
                                            <div
                                              className="absolute top-1/2 -translate-y-1/2 z-10 pointer-events-auto cursor-pointer"
                                              style={{ left: `${timePos.leftPct}%`, width: `${Math.max(8, timePos.widthPct)}%` }}
                                              onClick={() => handleToggleRoutineToday(rt)}
                                              title={`Routine: ${rt.name} (${rt.startTime || ''} – ${rt.endTime || ''}) · Click to toggle done`}
                                            >
                                              <div className={`h-5.5 rounded-lg border px-2 flex items-center justify-between text-[10px] font-bold shadow-xs whitespace-nowrap overflow-hidden transition-transform hover:scale-102 ${
                                                isDoneToday
                                                  ? 'bg-emerald-500 text-white border-emerald-600'
                                                  : isDelayed
                                                  ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-400/50 animate-pulse'
                                                  : 'bg-amber-100/90 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700'
                                              }`}>
                                                <div className="flex items-center gap-1 truncate">
                                                  <Repeat className="h-3 w-3 shrink-0 opacity-80" />
                                                  <span className="truncate">{rt.name}</span>
                                                </div>
                                                <span className="font-mono text-[9px] ml-1 opacity-90 shrink-0">
                                                  {isDoneToday ? '✓ Done' : `${rt.startTime || ''}–${rt.endTime || ''}`}
                                                </span>
                                              </div>
                                            </div>
                                          );
                                        })()
                                      ) : timelineGranularity === 'daily' ? (
                                        <div className="absolute inset-0 grid pointer-events-auto" style={{ gridTemplateColumns: `repeat(${timelineData.cols.length}, minmax(0, 1fr))` }}>
                                          {timelineData.cols.map(c => {
                                            const isDone = rt.completedDates?.includes(c.dateStr);
                                            return (
                                              <div key={c.id} className="h-full flex items-center justify-center">
                                                {isDone ? (
                                                  <span className="h-3.5 w-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px] font-bold shadow-2xs">✓</span>
                                                ) : c.isToday ? (
                                                  <button
                                                    type="button"
                                                    onClick={() => handleToggleRoutineToday(rt)}
                                                    className="h-3.5 w-3.5 rounded-full border border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 flex items-center justify-center text-[9px] cursor-pointer"
                                                  >
                                                    +
                                                  </button>
                                                ) : null}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 pl-3 z-10">{rt.startTime ? `${rt.startTime} - ${rt.endTime || ''}` : 'Daily block'}</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                            {/* 6. HABITS STREAM (NEWLY RENDERED) */}
                            {(activeStream === 'all' || activeStream === 'routines') &&
                              goalHabits.map(hb => (
                                <div key={hb.id} className="flex items-center py-1 text-xs">
                                  <div className={`${isMobileCompactView ? 'w-[140px]' : 'w-[260px] sm:w-[280px]'} shrink-0 pl-6 pr-2 flex items-center justify-between sticky left-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-r border-slate-200/80 dark:border-slate-800/80`}>
                                    <div className="flex items-center gap-1.5 truncate">
                                      <Zap className="h-3 w-3 text-orange-500 shrink-0" />
                                      <span className="truncate text-slate-700 dark:text-slate-300">{hb.name}</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleHabitToday(hb)}
                                      className="text-[9px] font-bold text-orange-600 hover:underline cursor-pointer shrink-0"
                                    >
                                      {hb.hasQuickLog ? '✓ Done' : hb.isDoneToday ? '+ Log' : 'Log'}
                                    </button>
                                  </div>
                                  <div className="flex-1 px-3 text-[10px] text-slate-400">
                                    {hb.frequency} · {hb.isDoneToday ? '✓ Completed today' : 'Scheduled daily habit'}
                                  </div>
                                </div>
                              ))}

                            {/* 7. TASKS STREAM (MAPPED ACCURATELY) */}
                            {(activeStream === 'all' || activeStream === 'tasks') &&
                              goalTasks.map(task => {
                                const isDelayed = task.delay.isDelayed && !task.done;
                                const taskDateStr = (task.dueAt || task.date || '').slice(0, 10);
                                const taskSpan = computeSpan(taskDateStr, taskDateStr, timelineData.cols, true);

                                return (
                                  <div
                                    key={task.id}
                                    className={`flex items-center py-1.5 text-xs transition-colors ${
                                      isDelayed ? 'bg-rose-50/50 dark:bg-rose-950/20' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                                    }`}
                                  >
                                    <div className={`${isMobileCompactView ? 'w-[140px]' : 'w-[260px] sm:w-[280px]'} shrink-0 pl-8 pr-2 flex items-center justify-between sticky left-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-r border-slate-200/80 dark:border-slate-800/80`}>
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleTask(task)}
                                          className="text-slate-400 hover:text-emerald-600 cursor-pointer shrink-0"
                                        >
                                          {task.done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Circle className="h-3.5 w-3.5" />}
                                        </button>
                                        <span className={`text-xs truncate ${task.done ? 'line-through text-slate-400' : isDelayed ? 'font-bold text-rose-700 dark:text-rose-300' : 'font-medium text-slate-800 dark:text-slate-200'}`}>
                                          {task.title}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0 ml-1">
                                        <button
                                          type="button"
                                          onClick={() => setRescheduleTarget({ id: task.id, type: 'task', title: task.title, currentDate: task.dueAt || task.date })}
                                          className="rounded bg-slate-100 hover:bg-slate-200 px-1 text-[9px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                                          title="Quick Reschedule / Snooze (+1d, +3d, +7d)"
                                        >
                                          +1d
                                        </button>
                                        {isDelayed && (
                                          <button
                                            type="button"
                                            onClick={() => handleTriggerAlarmNow(task.title, task.delay.label, task.id)}
                                            className="rounded bg-rose-600 p-0.5 text-white hover:bg-rose-500 cursor-pointer"
                                            title="Ring Urgent Alarm"
                                          >
                                            <BellRing className="h-2.5 w-2.5 animate-bounce" />
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex-1 relative h-6 flex items-center min-w-0">
                                      {taskSpan.inWindow ? (
                                        <div
                                          className="absolute top-1/2 -translate-y-1/2 z-10 pointer-events-auto"
                                          style={{ left: `${taskSpan.leftPct}%`, transform: 'translateX(2px)' }}
                                        >
                                          <div
                                            onClick={() => handleToggleTask(task)}
                                            className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] font-bold shadow-xs whitespace-nowrap cursor-pointer transition-transform hover:scale-102 border ${
                                              task.done
                                                ? 'bg-emerald-500 text-white border-emerald-600'
                                                : isDelayed
                                                ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-400/50 animate-pulse'
                                                : 'bg-white text-indigo-700 border-indigo-200 dark:bg-slate-800 dark:text-indigo-300'
                                            }`}
                                            title={`${task.title} · Due ${taskDateStr || 'Today'}`}
                                          >
                                            {task.done ? <Check className="h-3 w-3 shrink-0 text-white" /> : <Circle className="h-2.5 w-2.5 shrink-0 opacity-70" />}
                                            <span className="truncate max-w-[130px] sm:max-w-[200px]">{task.title}</span>
                                            <span className="text-[9px] opacity-75 font-mono ml-0.5">
                                              {task.done ? '✓' : taskDateStr ? taskDateStr.slice(5) : 'Today'}
                                            </span>
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 italic pl-3 z-10">
                                          {task.dueAt ? `Due ${task.dueAt.slice(0, 10)}` : 'No date'}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                            {/* 7. HEALTH APPOINTMENTS & MEDICAL SCHEDULES */}
                            {(activeStream === 'all' || activeStream === 'tasks') &&
                              goalAppointments.map(app => {
                                const isComp = Boolean(app.completed || app.status === 'completed');
                                const isDelayed = app.delay.isDelayed && !isComp;
                                const appSpan = computeSpan(app.date, app.date, timelineData.cols, true);

                                return (
                                  <div
                                    key={app.id}
                                    className={`flex items-center py-1.5 text-xs transition-colors ${
                                      isDelayed ? 'bg-rose-50/50 dark:bg-rose-950/20' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                                    }`}
                                  >
                                    <div className={`${isMobileCompactView ? 'w-[140px]' : 'w-[260px] sm:w-[280px]'} shrink-0 pl-8 pr-2 flex items-center justify-between sticky left-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-r border-slate-200/80 dark:border-slate-800/80`}>
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleAppointment(app)}
                                          className="text-slate-400 hover:text-emerald-600 cursor-pointer shrink-0"
                                          title={isComp ? 'Mark as Scheduled / Upcoming' : 'Mark as Attended / Completed'}
                                        >
                                          {isComp ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Circle className="h-3.5 w-3.5" />}
                                        </button>
                                        <Stethoscope className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                                        <span className={`text-xs truncate ${isComp ? 'line-through text-slate-400' : isDelayed ? 'font-bold text-rose-700 dark:text-rose-300' : 'font-medium text-slate-800 dark:text-slate-200'}`}>
                                          {app.title}
                                        </span>
                                      </div>
                                      <span className="text-[9px] text-slate-400 font-mono shrink-0">{app.doctor || 'Health'}</span>
                                    </div>

                                    <div className="flex-1 relative h-6 flex items-center min-w-0">
                                      {appSpan.inWindow ? (
                                        <div
                                          className="absolute top-1/2 -translate-y-1/2 z-10 pointer-events-auto"
                                          style={{ left: `${appSpan.leftPct}%`, transform: 'translateX(2px)' }}
                                        >
                                          <div
                                            onClick={() => handleToggleAppointment(app)}
                                            className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold shadow-xs whitespace-nowrap cursor-pointer border ${
                                              isComp
                                                ? 'bg-emerald-500 text-white border-emerald-600'
                                                : isDelayed
                                                ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-400/50 animate-pulse'
                                                : 'bg-white text-rose-700 border-rose-200 dark:bg-slate-800 dark:text-rose-300'
                                            }`}
                                            title={`Appointment: ${app.title} · ${app.date || 'No Date'} · Click to ${isComp ? 'mark scheduled' : 'mark attended'}`}
                                          >
                                            {isComp ? <Check className="h-3 w-3 shrink-0 text-white" /> : <Stethoscope className="h-2.5 w-2.5 shrink-0" />}
                                            <span className="truncate max-w-[140px]">{app.title}</span>
                                            <span className="text-[9px] opacity-75 font-mono">{isComp ? '✓ Attended' : app.date?.slice(5)}</span>
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 italic pl-3 z-10">{app.date ? `Date: ${app.date}` : 'No date'}</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                            {/* 8. MEETINGS & SESSIONS */}
                            {(activeStream === 'all' || activeStream === 'tasks') &&
                              goalMeetings.map(mtg => {
                                const isComp = Boolean(mtg.completed || mtg.status === 'completed');
                                const isDelayed = mtg.delay.isDelayed && !isComp;
                                const mtgSpan = computeSpan(mtg.date, mtg.date, timelineData.cols, true);

                                return (
                                  <div
                                    key={mtg.id}
                                    className={`flex items-center py-1.5 text-xs transition-colors ${
                                      isDelayed ? 'bg-rose-50/50 dark:bg-rose-950/20' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                                    }`}
                                  >
                                    <div className={`${isMobileCompactView ? 'w-[140px]' : 'w-[260px] sm:w-[280px]'} shrink-0 pl-8 pr-2 flex items-center justify-between sticky left-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-r border-slate-200/80 dark:border-slate-800/80`}>
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleMeeting(mtg)}
                                          className="text-slate-400 hover:text-emerald-600 cursor-pointer shrink-0"
                                          title={isComp ? 'Mark as Scheduled' : 'Mark as Completed / Attended'}
                                        >
                                          {isComp ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Circle className="h-3.5 w-3.5" />}
                                        </button>
                                        <Users className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
                                        <span className={`text-xs truncate ${isComp ? 'line-through text-slate-400' : isDelayed ? 'font-bold text-rose-700 dark:text-rose-300' : 'font-medium text-slate-800 dark:text-slate-200'}`}>
                                          {mtg.title}
                                        </span>
                                      </div>
                                      <span className="text-[9px] text-slate-400 font-mono shrink-0">{mtg.date?.slice(5)}</span>
                                    </div>

                                    <div className="flex-1 relative h-6 flex items-center min-w-0">
                                      {mtgSpan.inWindow ? (
                                        <div
                                          className="absolute top-1/2 -translate-y-1/2 z-10 pointer-events-auto"
                                          style={{ left: `${mtgSpan.leftPct}%`, transform: 'translateX(2px)' }}
                                        >
                                          <div
                                            onClick={() => handleToggleMeeting(mtg)}
                                            className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold shadow-xs whitespace-nowrap cursor-pointer border ${
                                              isComp
                                                ? 'bg-emerald-500 text-white border-emerald-600'
                                                : isDelayed
                                                ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-400/50 animate-pulse'
                                                : 'bg-white text-cyan-700 border-cyan-200 dark:bg-slate-800 dark:text-cyan-300'
                                            }`}
                                            title={`Meeting: ${mtg.title} · ${mtg.date || 'No Date'} · Click to ${isComp ? 'mark scheduled' : 'mark completed'}`}
                                          >
                                            {isComp ? <Check className="h-3 w-3 shrink-0 text-white" /> : <Users className="h-2.5 w-2.5 shrink-0" />}
                                            <span className="truncate max-w-[140px]">{mtg.title}</span>
                                            <span className="text-[9px] opacity-75 font-mono">{isComp ? '✓ Done' : mtg.date?.slice(5)}</span>
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 italic pl-3 z-10">{mtg.date ? `Date: ${mtg.date}` : 'No date'}</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                            {/* 9. SAVINGS PLANS STREAM */}
                            {(activeStream === 'all' || activeStream === 'finance') &&
                              goalSavings.map(sp => {
                                const prog = sp.progress ?? (sp.targetAmount > 0 ? Math.min(100, Math.round(((Number(sp.currentAmount) || 0) / Number(sp.targetAmount)) * 100)) : 0);
                                const spStart = sp.startDate || (sp as any).startDate || (sp.createdAt ? getLocalDateString(new Date(sp.createdAt)) : today);
                                const spTarget = sp.targetDate || (sp as any).targetDate || (sp.durationMonths && sp.createdAt ? addDaysToDateStr(getLocalDateString(new Date(sp.createdAt)), sp.durationMonths * 30) : addDaysToDateStr(spStart, 90));
                                const spSpan = computeSpan(spStart, spTarget, timelineData.cols);
                                const isDelayed = sp.delay?.isDelayed && prog < 100;

                                return (
                                  <div
                                    key={sp.id}
                                    className="flex items-center py-1.5 text-xs transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                                  >
                                    <div className={`${isMobileCompactView ? 'w-[140px]' : 'w-[260px] sm:w-[280px]'} shrink-0 pl-8 pr-2 flex items-center justify-between sticky left-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-r border-slate-200/80 dark:border-slate-800/80`}>
                                      <div className="flex items-center gap-1.5 truncate">
                                        <Landmark className={`h-3 w-3 shrink-0 ${isDelayed ? 'text-rose-500' : 'text-emerald-600'}`} />
                                        <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                                          <><ThemeIcon name="savings" className="h-3.5 w-3.5" /> {sp.name}</>
                                        </span>
                                      </div>
                                      <span className={`text-[10px] font-mono font-bold shrink-0 ml-1 ${isDelayed ? 'text-rose-600' : 'text-emerald-600'}`}>
                                        {prog}%
                                      </span>
                                    </div>

                                    <div className="flex-1 relative h-6 flex items-center min-w-0">
                                      {spSpan.inWindow ? (
                                        <div
                                          className={`absolute top-1/2 -translate-y-1/2 h-5 rounded-lg border overflow-hidden flex items-center z-10 shadow-2xs ${
                                            isDelayed
                                              ? 'border-rose-300 bg-rose-50/90 dark:border-rose-800 dark:bg-rose-950/40'
                                              : 'border-emerald-300 bg-emerald-50/90 dark:border-emerald-800 dark:bg-emerald-950/40'
                                          }`}
                                          style={{ left: `${spSpan.leftPct}%`, width: `${Math.max(6, spSpan.widthPct)}%` }}
                                          title={`Savings Plan: ${sp.name}\nTarget: ₹${(sp.targetAmount || 0).toLocaleString('en-IN')}\nCurrent: ₹${(sp.currentAmount || 0).toLocaleString('en-IN')} (${prog}%)\nTime Horizon: ${spStart} → ${spTarget}\nStatus: ${isDelayed ? 'Behind Schedule' : prog >= 100 ? 'Target Reached' : 'On Track'}`}
                                        >
                                          <div
                                            className={`h-full rounded-md transition-all ${isDelayed ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                            style={{ width: `${prog}%` }}
                                          />
                                          <span className="absolute left-1.5 text-[9px] font-bold text-slate-800 dark:text-slate-100 truncate pr-1">
                                            ₹{(sp.currentAmount || 0).toLocaleString('en-IN')} / ₹{(sp.targetAmount || 0).toLocaleString('en-IN')} ({prog}%)
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 italic pl-3 z-10">Target: {spTarget || 'Ongoing'}</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                            {/* 10. LOANS & DEBT CLEARANCE STREAM */}
                            {(activeStream === 'all' || activeStream === 'finance') &&
                              goalLoans.map(loan => {
                                const loanPrincipal = loan.principal ?? (Number((loan as any).principal ?? (loan as any).amount) || 0);
                                const loanOutstanding = loan.outstanding ?? (Number((loan as any).outstanding) || 0);
                                const loanPaid = loan.paid ?? (Number((loan as any).paidAmount) || (loanPrincipal ? Math.max(0, loanPrincipal - loanOutstanding) : 0));
                                const prog = loan.progress ?? (loanPrincipal > 0 ? Math.min(100, Math.round((loanPaid / loanPrincipal) * 100)) : 0);
                                const isPaid = loan.isPaid ?? (prog >= 100);
                                const loanStart = loan.startDate || (loan as any).startDate || (loan.createdAt ? getLocalDateString(new Date(loan.createdAt)) : today);
                                const loanTarget = loan.targetDate || (loan as any).targetDate || ((loan as any).tenure ? addDaysToDateStr(loanStart, (loan as any).tenure * 30) : addDaysToDateStr(loanStart, 365));
                                const loanSpan = computeSpan(loanStart, loanTarget, timelineData.cols);
                                const isDelayed = loan.delay?.isDelayed && !isPaid;

                                return (
                                  <div
                                    key={loan.id}
                                    className="flex items-center py-1.5 text-xs transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                                  >
                                    <div className={`${isMobileCompactView ? 'w-[140px]' : 'w-[260px] sm:w-[280px]'} shrink-0 pl-8 pr-2 flex items-center justify-between sticky left-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-r border-slate-200/80 dark:border-slate-800/80`}>
                                      <div className="flex items-center gap-1.5 truncate">
                                        <ShieldAlert className={`h-3 w-3 shrink-0 ${isPaid ? 'text-emerald-500' : isDelayed ? 'text-rose-600' : 'text-amber-500'}`} />
                                        <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                                          <><ThemeIcon name="loan" className="h-3.5 w-3.5" /> {(loan as any).lender || loan.name || 'Loan'}</>
                                        </span>
                                      </div>
                                      <span className={`text-[10px] font-mono font-bold shrink-0 ml-1 ${isPaid ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {prog}% Paid
                                      </span>
                                    </div>

                                    <div className="flex-1 relative h-6 flex items-center min-w-0">
                                      {loanSpan.inWindow ? (
                                        <div
                                          className={`absolute top-1/2 -translate-y-1/2 h-5 rounded-lg border overflow-hidden flex items-center z-10 shadow-2xs ${
                                            isPaid
                                              ? 'border-emerald-300 bg-emerald-50/90 dark:border-emerald-800 dark:bg-emerald-950/40'
                                              : 'border-rose-300 bg-rose-50/90 dark:border-rose-800 dark:bg-rose-950/40'
                                          }`}
                                          style={{ left: `${loanSpan.leftPct}%`, width: `${Math.max(6, loanSpan.widthPct)}%` }}
                                          title={`Loan: ${(loan as any).lender || loan.name}\nPrincipal: ₹${loanPrincipal.toLocaleString('en-IN')}\nPaid: ₹${loanPaid.toLocaleString('en-IN')} (${prog}%)\nOutstanding: ₹${loanOutstanding.toLocaleString('en-IN')}\nTenure: ${loanStart} → ${loanTarget}\nStatus: ${isPaid ? 'Cleared' : isDelayed ? 'Payment Overdue' : 'Active Repayment'}`}
                                        >
                                          <div className={`h-full rounded-md transition-all ${isPaid ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${prog}%` }} />
                                          <span className="absolute left-1.5 text-[9px] font-bold text-slate-800 dark:text-slate-100 truncate pr-1">
                                            ₹{loanPaid.toLocaleString('en-IN')} / ₹{loanPrincipal.toLocaleString('en-IN')} ({prog}%)
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 italic pl-3 z-10">Matures: {loanTarget || 'Open'}</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                            {/* 11. INVESTMENTS STREAM */}
                            {(activeStream === 'all' || activeStream === 'finance') &&
                              goalInvestments.map(inv => {
                                const invStart = inv.startDate || (inv as any).startDate || inv.date || (inv.createdAt ? getLocalDateString(new Date(inv.createdAt)) : today);
                                const invTarget = inv.targetDate || (inv as any).targetDate || (inv as any).maturityDate || (inv as any).horizonDate || addDaysToDateStr(invStart, 180);
                                const currentVal = inv.currentVal ?? (Number(inv.currentValue ?? inv.amount) || 0);
                                const initialAmt = inv.initialAmt ?? (Number(inv.amount) || 0);
                                const invGain = inv.gain ?? (currentVal - initialAmt);
                                const invGainPct = inv.gainPct ?? (initialAmt > 0 ? Math.round((invGain / initialAmt) * 100) : 0);
                                const invSpan = computeSpan(invStart, invTarget, timelineData.cols);
                                const valProg = initialAmt > 0 ? Math.min(100, Math.round((currentVal / initialAmt) * 100)) : 100;

                                return (
                                  <div
                                    key={inv.id}
                                    className="flex items-center py-1.5 text-xs transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                                  >
                                    <div className={`${isMobileCompactView ? 'w-[140px]' : 'w-[260px] sm:w-[280px]'} shrink-0 pl-8 pr-2 flex items-center justify-between sticky left-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-r border-slate-200/80 dark:border-slate-800/80`}>
                                      <div className="flex items-center gap-1.5 truncate">
                                        <TrendingUp className="h-3 w-3 text-blue-600 shrink-0" />
                                        <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                                          <><ThemeIcon name="portfolio" className="h-3.5 w-3.5" /> {inv.name}</>
                                        </span>
                                      </div>
                                      <span className="text-[10px] font-mono font-bold text-blue-600 shrink-0 ml-1">
                                        ₹{currentVal.toLocaleString('en-IN')}
                                      </span>
                                    </div>

                                    <div className="flex-1 relative h-6 flex items-center min-w-0">
                                      {invSpan.inWindow ? (
                                        <div
                                          className="absolute top-1/2 -translate-y-1/2 h-5 rounded-lg border border-blue-300 bg-blue-50/90 dark:border-blue-800 dark:bg-blue-950/40 overflow-hidden flex items-center z-10 shadow-2xs"
                                          style={{ left: `${invSpan.leftPct}%`, width: `${Math.max(6, invSpan.widthPct)}%` }}
                                          title={`Investment: ${inv.name}\nInvested: ₹${initialAmt.toLocaleString('en-IN')}\nCurrent Value: ₹${currentVal.toLocaleString('en-IN')} (${invGain >= 0 ? `+₹${invGain.toLocaleString('en-IN')} (+${invGainPct}%)` : `-₹${Math.abs(invGain).toLocaleString('en-IN')} (${invGainPct}%)`})\nHorizon: ${invStart} → ${invTarget}`}
                                        >
                                          <div className="h-full rounded-md bg-blue-500/80 transition-all" style={{ width: `${Math.min(100, valProg)}%` }} />
                                          <span className="absolute left-1.5 text-[9px] font-bold text-blue-950 dark:text-blue-100 truncate pr-1">
                                            {inv.name} · ₹{currentVal.toLocaleString('en-IN')} {invGainPct !== 0 ? `(${invGainPct >= 0 ? '+' : ''}${invGainPct}%)` : ''}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 italic pl-3 z-10">Horizon: {invTarget || 'Ongoing'}</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                {/* STANDALONE & GENERAL ACTION TASKS ROW */}
                {(activeStream === 'all' || activeStream === 'tasks') && standaloneTasks.length > 0 && (
                  <div className="space-y-0.5 border-t-2 border-slate-200/90 dark:border-slate-800">
                    <div className="flex items-center bg-slate-100/80 hover:bg-slate-200/60 dark:bg-slate-800/80 dark:hover:bg-slate-800 transition-colors">
                      <div className={`${isMobileCompactView ? 'w-[140px]' : 'w-[260px] sm:w-[280px]'} shrink-0 p-2 pr-3 pl-3 flex items-center justify-between sticky left-0 z-20 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-xs border-r border-slate-200/80 dark:border-slate-800/80`}>
                        <div className="min-w-0 flex items-center gap-1.5 flex-1">
                          <button
                            type="button"
                            onClick={() => setIsStandaloneExpanded(prev => !prev)}
                            className="p-1 -ml-1 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
                            title={isStandaloneExpanded ? 'Collapse' : 'Expand'}
                          >
                            {isStandaloneExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <ThemeIcon name="zap" className="h-3 w-3 shrink-0" />
                              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                Operational & Action Tasks
                              </span>
                              <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                                ({standaloneTasks.length})
                              </span>
                            </div>
                            {!isMobileCompactView && (
                              <div className="text-[10px] text-slate-400 truncate">
                                Tasks Menu & Quick Capture · <span className="font-semibold text-emerald-600 dark:text-emerald-400">{standaloneTasks.filter(t => t.done).length}/{standaloneTasks.length} Done</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 relative h-8 flex items-center min-w-0 px-3 text-[10px] font-semibold text-slate-400 italic">
                        {standaloneTasks.filter(t => t.done).length} of {standaloneTasks.length} operational tasks completed
                      </div>
                    </div>

                    {isStandaloneExpanded && (
                      <div className="divide-y divide-slate-100/60 dark:divide-slate-800/40">
                        {standaloneTasks.map(task => {
                          const isDelayed = task.delay.isDelayed && !task.done;
                          const taskDateStr = task.dueAt ? task.dueAt.slice(0, 10) : (task.date ? task.date.slice(0, 10) : undefined);
                          const taskSpan = computeSpan(taskDateStr, taskDateStr, timelineData.cols, true);

                          return (
                            <div
                              key={task.id}
                              className={`flex items-center py-1.5 text-xs transition-colors ${
                                isDelayed ? 'bg-rose-50/50 dark:bg-rose-950/20' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                              }`}
                            >
                              <div className={`${isMobileCompactView ? 'w-[140px]' : 'w-[260px] sm:w-[280px]'} shrink-0 pl-6 pr-2 flex items-center justify-between sticky left-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-r border-slate-200/80 dark:border-slate-800/80`}>
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleTask(task)}
                                    className="text-slate-400 hover:text-emerald-600 cursor-pointer shrink-0"
                                  >
                                    {task.done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Circle className="h-3.5 w-3.5" />}
                                  </button>
                                  <span className={`text-xs truncate ${task.done ? 'line-through text-slate-400' : isDelayed ? 'font-bold text-rose-700 dark:text-rose-300' : 'font-medium text-slate-800 dark:text-slate-200'}`}>
                                    {task.title}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0 ml-1">
                                  <button
                                    type="button"
                                    onClick={() => setRescheduleTarget({ id: task.id, type: 'task', title: task.title, currentDate: task.dueAt || task.date })}
                                    className="rounded bg-slate-100 hover:bg-slate-200 px-1 text-[9px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                                    title="Quick Reschedule / Snooze (+1d, +3d, +7d)"
                                  >
                                    +1d
                                  </button>
                                  {isDelayed && (
                                    <button
                                      type="button"
                                      onClick={() => handleTriggerAlarmNow(task.title, task.delay.label, task.id)}
                                      className="rounded bg-rose-600 p-0.5 text-white hover:bg-rose-500 cursor-pointer"
                                      title="Ring Urgent Alarm"
                                    >
                                      <BellRing className="h-2.5 w-2.5 animate-bounce" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="flex-1 relative h-6 flex items-center min-w-0">
                                {taskSpan.inWindow ? (
                                  <div
                                    className="absolute top-1/2 -translate-y-1/2 z-10 pointer-events-auto"
                                    style={{ left: `${taskSpan.leftPct}%`, transform: 'translateX(2px)' }}
                                  >
                                    <div
                                      onClick={() => handleToggleTask(task)}
                                      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] font-bold shadow-xs whitespace-nowrap cursor-pointer border ${
                                        task.done
                                          ? 'bg-emerald-500 text-white border-emerald-600'
                                          : isDelayed
                                          ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-400/50 animate-pulse'
                                          : 'bg-white text-indigo-700 border-indigo-200 dark:bg-slate-800 dark:text-indigo-300'
                                      }`}
                                      title={`${task.title} · Due ${taskDateStr || 'Today'}`}
                                    >
                                      {task.done ? <Check className="h-3 w-3 shrink-0 text-white" /> : <Circle className="h-2.5 w-2.5 shrink-0 opacity-70" />}
                                      <span className="truncate max-w-[130px] sm:max-w-[200px]">{task.title}</span>
                                      <span className="text-[9px] opacity-75 font-mono ml-0.5">
                                        {task.done ? '✓' : taskDateStr ? taskDateStr.slice(5) : 'Today'}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic pl-3 z-10">
                                    {task.dueAt ? `Due ${task.dueAt.slice(0, 10)}` : 'No date'}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* STANDALONE FINANCIAL COMMITMENTS (SAVINGS, LOANS, INVESTMENTS WITHOUT GOAL ID) */}
                {(activeStream === 'all' || activeStream === 'finance') &&
                  (standaloneSavings.length > 0 || standaloneLoans.length > 0 || standaloneInvestments.length > 0) && (
                  <div className="space-y-0.5 border-t-2 border-emerald-200/90 dark:border-emerald-950">
                    <div className="flex items-center bg-emerald-50/70 hover:bg-emerald-100/60 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 transition-colors">
                      <div className={`${isMobileCompactView ? 'w-[140px]' : 'w-[260px] sm:w-[280px]'} shrink-0 p-2 pr-3 pl-3 flex items-center justify-between sticky left-0 z-20 bg-emerald-50/95 dark:bg-emerald-950/95 backdrop-blur-xs border-r border-slate-200/80 dark:border-slate-800/80`}>
                        <div className="min-w-0 flex items-center gap-1.5 flex-1">
                          <button
                            type="button"
                            onClick={() => setIsStandaloneFinanceExpanded(prev => !prev)}
                            className="p-1 -ml-1 text-emerald-700 hover:text-emerald-900 dark:hover:text-emerald-200 rounded hover:bg-emerald-200/60 dark:hover:bg-emerald-900/40 transition-colors cursor-pointer shrink-0"
                            title={isStandaloneFinanceExpanded ? 'Collapse' : 'Expand'}
                          >
                            {isStandaloneFinanceExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-emerald-400" />
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <Landmark className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 truncate">
                                Standalone Finance
                              </span>
                              <span className="text-[10px] text-emerald-600 shrink-0 font-mono">
                                ({standaloneSavings.length + standaloneLoans.length + standaloneInvestments.length})
                              </span>
                            </div>
                            {!isMobileCompactView && (
                              <div className="text-[10px] text-emerald-700 dark:text-emerald-400 truncate">
                                Savings · Loans · Investments
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 relative h-8 flex items-center min-w-0 px-3 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 italic">
                        {standaloneSavings.length} savings · {standaloneLoans.length} loans · {standaloneInvestments.length} investments
                      </div>
                    </div>

                    {isStandaloneFinanceExpanded && (
                      <div className="divide-y divide-slate-100/60 dark:divide-slate-800/40">
                        {/* Standalone Savings */}
                        {standaloneSavings.map(sp => {
                          const prog = sp.progress ?? (sp.targetAmount > 0 ? Math.min(100, Math.round(((Number(sp.currentAmount) || 0) / Number(sp.targetAmount)) * 100)) : 0);
                          const spStart = sp.startDate || (sp as any).startDate || (sp.createdAt ? getLocalDateString(new Date(sp.createdAt)) : today);
                          const spTarget = sp.targetDate || (sp as any).targetDate || (sp.durationMonths && sp.createdAt ? addDaysToDateStr(getLocalDateString(new Date(sp.createdAt)), sp.durationMonths * 30) : addDaysToDateStr(spStart, 90));
                          const spSpan = computeSpan(spStart, spTarget, timelineData.cols);
                          const isDelayed = sp.delay?.isDelayed && prog < 100;
                          return (
                            <div key={sp.id} className="flex items-center py-1.5 text-xs transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                              <div className={`${isMobileCompactView ? 'w-[140px]' : 'w-[260px] sm:w-[280px]'} shrink-0 pl-6 pr-2 flex items-center justify-between sticky left-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-r border-slate-200/80 dark:border-slate-800/80`}>
                                <div className="flex items-center gap-1.5 truncate">
                                  <Landmark className={`h-3 w-3 shrink-0 ${isDelayed ? 'text-rose-500' : 'text-emerald-600'}`} />
                                  <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                                    <><ThemeIcon name="savings" className="h-3.5 w-3.5" /> {sp.name}</>
                                  </span>
                                </div>
                                <span className={`text-[10px] font-mono font-bold shrink-0 ml-1 ${isDelayed ? 'text-rose-600' : 'text-emerald-600'}`}>
                                  {prog}%
                                </span>
                              </div>
                              <div className="flex-1 relative h-6 flex items-center min-w-0">
                                {spSpan.inWindow ? (
                                  <div
                                    className={`absolute top-1/2 -translate-y-1/2 h-5 rounded-lg border overflow-hidden flex items-center z-10 shadow-2xs ${
                                      isDelayed
                                        ? 'border-rose-300 bg-rose-50/90 dark:border-rose-800 dark:bg-rose-950/40'
                                        : 'border-emerald-300 bg-emerald-50/90 dark:border-emerald-800 dark:bg-emerald-950/40'
                                    }`}
                                    style={{ left: `${spSpan.leftPct}%`, width: `${Math.max(6, spSpan.widthPct)}%` }}
                                    title={`Savings Plan: ${sp.name}\nTarget: ₹${(sp.targetAmount || 0).toLocaleString('en-IN')}\nCurrent: ₹${(sp.currentAmount || 0).toLocaleString('en-IN')} (${prog}%)\nTime Horizon: ${spStart} → ${spTarget}\nStatus: ${isDelayed ? 'Behind Schedule' : prog >= 100 ? 'Target Reached' : 'On Track'}`}
                                  >
                                    <div className={`h-full rounded-md transition-all ${isDelayed ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${prog}%` }} />
                                    <span className="absolute left-1.5 text-[9px] font-bold text-slate-800 dark:text-slate-100 truncate pr-1">
                                      ₹{(sp.currentAmount || 0).toLocaleString('en-IN')} / ₹{(sp.targetAmount || 0).toLocaleString('en-IN')} ({prog}%)
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic pl-3 z-10">Target {spTarget || 'Ongoing'}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Standalone Loans */}
                        {standaloneLoans.map(loan => {
                          const loanPrincipal = loan.principal ?? (Number((loan as any).principal ?? (loan as any).amount) || 0);
                          const loanOutstanding = loan.outstanding ?? (Number((loan as any).outstanding) || 0);
                          const loanPaid = loan.paid ?? (Number((loan as any).paidAmount) || (loanPrincipal ? Math.max(0, loanPrincipal - loanOutstanding) : 0));
                          const prog = loan.progress ?? (loanPrincipal > 0 ? Math.min(100, Math.round((loanPaid / loanPrincipal) * 100)) : 0);
                          const isPaid = loan.isPaid ?? (prog >= 100);
                          const loanStart = loan.startDate || (loan as any).startDate || (loan.createdAt ? getLocalDateString(new Date(loan.createdAt)) : today);
                          const loanTarget = loan.targetDate || (loan as any).targetDate || ((loan as any).tenure ? addDaysToDateStr(loanStart, (loan as any).tenure * 30) : addDaysToDateStr(loanStart, 365));
                          const loanSpan = computeSpan(loanStart, loanTarget, timelineData.cols);
                          const isDelayed = loan.delay?.isDelayed && !isPaid;
                          return (
                            <div key={loan.id} className="flex items-center py-1.5 text-xs transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                              <div className={`${isMobileCompactView ? 'w-[140px]' : 'w-[260px] sm:w-[280px]'} shrink-0 pl-6 pr-2 flex items-center justify-between sticky left-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-r border-slate-200/80 dark:border-slate-800/80`}>
                                <div className="flex items-center gap-1.5 truncate">
                                  <ShieldAlert className={`h-3 w-3 shrink-0 ${isPaid ? 'text-emerald-500' : isDelayed ? 'text-rose-600' : 'text-amber-500'}`} />
                                  <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                                    <><ThemeIcon name="loan" className="h-3.5 w-3.5" /> {(loan as any).lender || loan.name || 'Loan'}</>
                                  </span>
                                </div>
                                <span className={`text-[10px] font-mono font-bold shrink-0 ml-1 ${isPaid ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {prog}% Paid
                                </span>
                              </div>
                              <div className="flex-1 relative h-6 flex items-center min-w-0">
                                {loanSpan.inWindow ? (
                                  <div
                                    className={`absolute top-1/2 -translate-y-1/2 h-5 rounded-lg border overflow-hidden flex items-center z-10 shadow-2xs ${
                                      isPaid
                                        ? 'border-emerald-300 bg-emerald-50/90 dark:border-emerald-800 dark:bg-emerald-950/40'
                                        : 'border-rose-300 bg-rose-50/90 dark:border-rose-800 dark:bg-rose-950/40'
                                    }`}
                                    style={{ left: `${loanSpan.leftPct}%`, width: `${Math.max(6, loanSpan.widthPct)}%` }}
                                    title={`Loan: ${(loan as any).lender || loan.name}\nPrincipal: ₹${loanPrincipal.toLocaleString('en-IN')}\nPaid: ₹${loanPaid.toLocaleString('en-IN')} (${prog}%)\nOutstanding: ₹${loanOutstanding.toLocaleString('en-IN')}\nTenure: ${loanStart} → ${loanTarget}\nStatus: ${isPaid ? 'Cleared' : isDelayed ? 'Payment Overdue' : 'Active Repayment'}`}
                                  >
                                    <div className={`h-full rounded-md transition-all ${isPaid ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${prog}%` }} />
                                    <span className="absolute left-1.5 text-[9px] font-bold text-slate-800 dark:text-slate-100 truncate pr-1">
                                      ₹{loanPaid.toLocaleString('en-IN')} / ₹{loanPrincipal.toLocaleString('en-IN')} ({prog}%)
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic pl-3 z-10">Matures {loanTarget || 'Open'}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Standalone Investments */}
                        {standaloneInvestments.map(inv => {
                          const invStart = inv.startDate || (inv as any).startDate || inv.date || (inv.createdAt ? getLocalDateString(new Date(inv.createdAt)) : today);
                          const invTarget = inv.targetDate || (inv as any).targetDate || (inv as any).maturityDate || (inv as any).horizonDate || addDaysToDateStr(invStart, 180);
                          const currentVal = inv.currentVal ?? (Number(inv.currentValue ?? inv.amount) || 0);
                          const initialAmt = inv.initialAmt ?? (Number(inv.amount) || 0);
                          const invGain = inv.gain ?? (currentVal - initialAmt);
                          const invGainPct = inv.gainPct ?? (initialAmt > 0 ? Math.round((invGain / initialAmt) * 100) : 0);
                          const invSpan = computeSpan(invStart, invTarget, timelineData.cols);
                          const valProg = initialAmt > 0 ? Math.min(100, Math.round((currentVal / initialAmt) * 100)) : 100;
                          return (
                            <div key={inv.id} className="flex items-center py-1.5 text-xs transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                              <div className={`${isMobileCompactView ? 'w-[140px]' : 'w-[260px] sm:w-[280px]'} shrink-0 pl-6 pr-2 flex items-center justify-between sticky left-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-r border-slate-200/80 dark:border-slate-800/80`}>
                                <div className="flex items-center gap-1.5 truncate">
                                  <TrendingUp className="h-3 w-3 text-blue-600 shrink-0" />
                                  <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                                    <><ThemeIcon name="portfolio" className="h-3.5 w-3.5" /> {inv.name}</>
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono font-bold text-blue-600 shrink-0 ml-1">
                                  ₹{currentVal.toLocaleString('en-IN')}
                                </span>
                              </div>
                              <div className="flex-1 relative h-6 flex items-center min-w-0">
                                {invSpan.inWindow ? (
                                  <div
                                    className="absolute top-1/2 -translate-y-1/2 h-5 rounded-lg border border-blue-300 bg-blue-50/90 dark:border-blue-800 dark:bg-blue-950/40 overflow-hidden flex items-center z-10 shadow-2xs"
                                    style={{ left: `${invSpan.leftPct}%`, width: `${Math.max(6, invSpan.widthPct)}%` }}
                                    title={`Investment: ${inv.name}\nInvested: ₹${initialAmt.toLocaleString('en-IN')}\nCurrent Value: ₹${currentVal.toLocaleString('en-IN')} (${invGain >= 0 ? `+₹${invGain.toLocaleString('en-IN')} (+${invGainPct}%)` : `-₹${Math.abs(invGain).toLocaleString('en-IN')} (${invGainPct}%)`})\nHorizon: ${invStart} → ${invTarget}`}
                                  >
                                    <div className="h-full rounded-md bg-blue-500/80 transition-all" style={{ width: `${Math.min(100, valProg)}%` }} />
                                    <span className="absolute left-1.5 text-[9px] font-bold text-blue-950 dark:text-blue-100 truncate pr-1">
                                      {inv.name} · ₹{currentVal.toLocaleString('en-IN')} {invGainPct !== 0 ? `(${invGainPct >= 0 ? '+' : ''}${invGainPct}%)` : ''}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic pl-3 z-10">Horizon {invTarget || 'Ongoing'}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* STANDALONE CONTACTS & IMPORTANT DATES */}
                {(activeStream === 'all' || activeStream === 'tasks') && standalonePeople.length > 0 && (
                  <div className="space-y-0.5 border-t-2 border-indigo-200/90 dark:border-indigo-950">
                    <div className="flex items-center bg-indigo-50/70 hover:bg-indigo-100/60 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60 transition-colors">
                      <div className={`${isMobileCompactView ? 'w-[140px]' : 'w-[260px] sm:w-[280px]'} shrink-0 p-2 pr-3 pl-3 flex items-center justify-between sticky left-0 z-20 bg-indigo-50/95 dark:bg-indigo-950/95 backdrop-blur-xs border-r border-slate-200/80 dark:border-slate-800/80`}>
                        <div className="min-w-0 flex items-center gap-1.5 flex-1">
                          <button
                            type="button"
                            onClick={() => setIsStandalonePeopleExpanded(prev => !prev)}
                            className="p-1 -ml-1 text-indigo-700 hover:text-indigo-900 dark:hover:text-indigo-200 rounded hover:bg-indigo-200/60 dark:hover:bg-indigo-900/40 transition-colors cursor-pointer shrink-0"
                            title={isStandalonePeopleExpanded ? 'Collapse' : 'Expand'}
                          >
                            {isStandalonePeopleExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-indigo-400" />
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                              <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 truncate">
                                Contact Milestones & Dates
                              </span>
                              <span className="text-[10px] text-indigo-600 shrink-0 font-mono">
                                ({standalonePeople.length})
                              </span>
                            </div>
                            {!isMobileCompactView && (
                              <div className="text-[10px] text-indigo-700 dark:text-indigo-400 truncate">
                                Birthdays, Anniversaries & Relationship Dates
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 relative h-8 flex items-center min-w-0 px-3 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 italic">
                        {standalonePeople.length} milestone dates tracked from People & Relationships
                      </div>
                    </div>

                    {isStandalonePeopleExpanded && (
                      <div className="divide-y divide-slate-100/60 dark:divide-slate-800/40">
                        {standalonePeople.map(person => {
                          const pSpan = computeSpan(person.importantDate, person.importantDate, timelineData.cols, true);
                          return (
                            <div key={person.id} className="flex items-center py-1.5 text-xs transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                              <div className={`${isMobileCompactView ? 'w-[140px]' : 'w-[260px] sm:w-[280px]'} shrink-0 pl-6 pr-2 flex items-center justify-between sticky left-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-r border-slate-200/80 dark:border-slate-800/80`}>
                                <div className="flex items-center gap-1.5 truncate">
                                  <Calendar className="h-3 w-3 text-indigo-500 shrink-0" />
                                  <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                                    <><ThemeIcon name="celebrate" className="h-3.5 w-3.5" /> {person.name}</>
                                  </span>
                                </div>
                                <span className="text-[9px] font-mono text-indigo-600 shrink-0 ml-1">
                                  {person.relationship}
                                </span>
                              </div>
                              <div className="flex-1 relative h-6 flex items-center min-w-0">
                                {pSpan.inWindow ? (
                                  <div
                                    className="absolute top-1/2 -translate-y-1/2 z-10 pointer-events-auto"
                                    style={{ left: `${pSpan.leftPct}%`, transform: 'translateX(2px)' }}
                                  >
                                    <div
                                      className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold shadow-xs whitespace-nowrap border bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-800"
                                      title={`${person.name} (${person.relationship}): ${person.importantDate}`}
                                    >
                                      <span className="inline-flex items-center gap-1"><ThemeIcon name="celebrate" className="h-3 w-3" /> {person.name}</span>
                                      <span className="text-[9px] opacity-75 font-mono">({person.importantDate?.slice(5)})</span>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic pl-3 z-10">Date: {person.importantDate}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* EMPTY STATE FOR FINANCE STREAM WHEN NOTHING HAS BEEN ADDED */}
                {activeStream === 'finance' &&
                  !hierarchicalGoals.some(g => {
                    const idx = goalItemIndex.get(g.id);
                    return (idx?.savingsPlans.length || 0) > 0 || (idx?.loans.length || 0) > 0 || (idx?.investments.length || 0) > 0;
                  }) &&
                  standaloneSavings.length === 0 && standaloneLoans.length === 0 && standaloneInvestments.length === 0 && (
                    <div className="py-12 px-6 text-center">
                      <div className="inline-flex p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 mb-3">
                        <Landmark className="h-6 w-6" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        No Financial Roadmaps Linked Yet
                      </h4>
                      <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                        Savings targets, loan clearance timelines, and investment maturity horizons will render on this Gantt roadmap once added in the Finance & Ledger module.
                      </p>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* 5. EXECUTIVE OPERATING PLAN (HIERARCHY VIEW) */}
      {viewMode === 'hierarchy' && activeStream !== 'finance' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-600" />
              <span>Full Strategic Lineage: Goals ➔ Milestones ➔ Deliverables ➔ Action Units</span>
            </h3>
          </div>

          <div className="space-y-3">
            {hierarchicalGoals.map(goal => {
              const indexed = goalItemIndex.get(goal.id);
              const gMilestones = indexed?.milestones || [];
              const gProjects = indexed?.projects || [];
              const gTasks = indexed?.tasks || [];
              const gSavings = indexed?.savingsPlans || [];
              const gLoans = indexed?.loans || [];
              const gInvestments = indexed?.investments || [];
              const tier = getGoalTierBadge(goal.level);

              return (
                <div
                  key={goal.id}
                  className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold border ${tier.badgeStyle}`}>
                        <ThemeIcon name={tier.icon} className="h-3 w-3" /> {tier.name}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {goal.title}
                      </h4>
                      <span className="text-xs text-slate-400 font-mono">({goal.progress}%)</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenTaskGenesis({ type: 'manual', goalId: goal.id, title: '' })}
                        className="rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 cursor-pointer"
                      >
                        + Task Genesis
                      </button>
                    </div>
                  </div>

                  {/* Milestones in Operating Plan */}
                  {gMilestones.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                        Milestones ({gMilestones.length})
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {gMilestones.map(m => (
                          <div key={m.id} className="rounded-xl border border-amber-200/60 bg-amber-50/30 p-2 text-xs flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <Flag className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{m.title}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">Due {m.dueDate || 'Ongoing'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Projects & Deliverables */}
                  {gProjects.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                        Deliverables & Projects ({gProjects.length})
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {gProjects.map(p => (
                          <div key={p.id} className="rounded-xl border border-emerald-200/60 bg-emerald-50/30 p-2 text-xs flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <Briefcase className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{p.name}</span>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-600 font-mono shrink-0 ml-2">{p.progress || 35}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Financial Stream in Operating Plan */}
                  {(gSavings.length > 0 || gLoans.length > 0 || gInvestments.length > 0) && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                        Finance ({gSavings.length + gLoans.length + gInvestments.length})
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {gSavings.map(s => (
                          <div key={s.id} className="rounded-xl border border-emerald-200/60 bg-emerald-50/30 p-2 text-xs flex items-center justify-between">
                            <div className="flex items-center gap-1.5 truncate">
                              <Landmark className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200 truncate"><ThemeIcon name="savings" className="h-3.5 w-3.5" /> {s.name}</span>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-600 font-mono shrink-0 ml-1">{s.progress}%</span>
                          </div>
                        ))}
                        {gLoans.map(l => (
                          <div key={l.id} className="rounded-xl border border-rose-200/60 bg-rose-50/30 p-2 text-xs flex items-center justify-between">
                            <div className="flex items-center gap-1.5 truncate">
                              <ShieldAlert className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                              <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200 truncate"><ThemeIcon name="loan" className="h-3.5 w-3.5" /> {(l as any).lender || l.name}</span>
                            </div>
                            <span className="text-[10px] font-bold text-rose-600 font-mono shrink-0 ml-1">{l.progress}% paid</span>
                          </div>
                        ))}
                        {gInvestments.map(inv => (
                          <div key={inv.id} className="rounded-xl border border-blue-200/60 bg-blue-50/30 p-2 text-xs flex items-center justify-between">
                            <div className="flex items-center gap-1.5 truncate">
                              <TrendingUp className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                              <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200 truncate"><ThemeIcon name="portfolio" className="h-3.5 w-3.5" /> {inv.name}</span>
                            </div>
                            <span className="text-[10px] font-bold text-blue-600 font-mono shrink-0 ml-1">₹{(inv.currentVal || 0).toLocaleString('en-IN')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tasks */}
                  {gTasks.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                        Tasks & Execution Units ({gTasks.length})
                      </span>
                      <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800 max-h-36 overflow-y-auto">
                        {gTasks.map(t => (
                          <div key={t.id} className="flex items-center justify-between p-2 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <button type="button" onClick={() => handleToggleTask(t)} className="cursor-pointer">
                                {t.done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Circle className="h-3.5 w-3.5 text-slate-400" />}
                              </button>
                              <span className={`truncate ${t.done ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                {t.title}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">{t.dueAt ? t.dueAt.slice(5, 10) : 'Today'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Standalone Operational Tasks in Operating Plan */}
            {standaloneTasks.length > 0 && (
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      <ThemeIcon name="zap" className="h-3 w-3" /> Operational
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      Operational & Action Tasks
                    </h4>
                    <span className="text-xs text-slate-400 font-mono">({standaloneTasks.filter(t => t.done).length}/{standaloneTasks.length} Done)</span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800 max-h-48 overflow-y-auto">
                  {standaloneTasks.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <button type="button" onClick={() => handleToggleTask(t)} className="cursor-pointer">
                          {t.done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Circle className="h-3.5 w-3.5 text-slate-400" />}
                        </button>
                        <span className={`truncate ${t.done ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                          {t.title}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">{t.dueAt ? t.dueAt.slice(5, 10) : 'Today'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Standalone Financial Commitments in Operating Plan */}
            {(standaloneSavings.length > 0 || standaloneLoans.length > 0 || standaloneInvestments.length > 0) && (
              <div className="rounded-2xl border border-emerald-200/90 bg-white p-4 shadow-2xs dark:border-emerald-950 dark:bg-slate-900 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 pb-2.5 dark:border-emerald-900/60">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      <ThemeIcon name="portfolio" className="h-3 w-3" /> Portfolio
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      Standalone Finance
                    </h4>
                    <span className="text-xs text-emerald-600 font-mono font-bold">({standaloneSavings.length} savings · {standaloneLoans.length} loans · {standaloneInvestments.length} inv)</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {standaloneSavings.map(s => (
                    <div key={s.id} className="rounded-xl border border-emerald-200/60 bg-emerald-50/30 p-2 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-1.5 truncate">
                        <Landmark className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200 truncate"><ThemeIcon name="savings" className="h-3.5 w-3.5" /> {s.name}</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 font-mono shrink-0 ml-1">{s.progress}%</span>
                    </div>
                  ))}
                  {standaloneLoans.map(l => (
                    <div key={l.id} className="rounded-xl border border-rose-200/60 bg-rose-50/30 p-2 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-1.5 truncate">
                        <ShieldAlert className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200 truncate"><ThemeIcon name="loan" className="h-3.5 w-3.5" /> {(l as any).lender || l.name}</span>
                      </div>
                      <span className="text-[10px] font-bold text-rose-600 font-mono shrink-0 ml-1">{l.progress}% paid</span>
                    </div>
                  ))}
                  {standaloneInvestments.map(inv => (
                    <div key={inv.id} className="rounded-xl border border-blue-200/60 bg-blue-50/30 p-2 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-1.5 truncate">
                        <TrendingUp className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200 truncate"><ThemeIcon name="portfolio" className="h-3.5 w-3.5" /> {inv.name}</span>
                      </div>
                      <span className="text-[10px] font-bold text-blue-600 font-mono shrink-0 ml-1">₹{(inv.currentVal || 0).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. DELAY RADAR (ACCURATE CROSS-STREAM BOTTLENECKS) */}
      {viewMode === 'radar' && activeStream !== 'finance' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-rose-300/80 bg-rose-50/50 p-4 dark:border-rose-900/60 dark:bg-rose-950/20">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-rose-600" />
                  <span>Full Cross-System Delay Radar & Bottleneck Audit</span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  Active bottlenecks across Milestones ({delayedMilestones.length}), Projects ({delayedProjects.length}), Learning ({delayedLearning.length}), Skills ({delayedSkills.length}), Routines ({delayedRoutines.length}), Tasks ({delayedTasks.length}), Savings ({delayedSavings.length}), and Debt ({delayedLoans.length}).
                </p>
              </div>

              {/* Severity Filter */}
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setRadarSeverityFilter('all')}
                  className={`border-b-0 border-transparent px-2 py-1 text-xs font-semibold cursor-pointer ${
                    radarSeverityFilter === 'all' ? 'text-amber-700 dark:text-amber-300' : 'text-amber-800 hover:border-amber-500 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
                  }`}
                >
                  All ({totalDelayedAllCount})
                </button>
                <button
                  type="button"
                  onClick={() => setRadarSeverityFilter('critical')}
                  className={`border-b-0 border-transparent px-2 py-1 text-xs font-semibold cursor-pointer ${
                    radarSeverityFilter === 'critical' ? 'text-amber-700 dark:text-amber-300' : 'text-amber-800 hover:border-amber-500 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
                  }`}
                >
                  Critical (&gt;3d)
                </button>
              </div>
            </div>
          </div>

          {totalDelayedAllCount === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-8 text-center dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <h4 className="mt-2 text-base font-bold text-emerald-900 dark:text-emerald-200">
                Zero Delays Detected!
              </h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                Every milestone, deliverable, routine, and action task is running on schedule.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Delayed Tasks */}
              {delayedTasks
                .filter(t => radarSeverityFilter === 'all' || t.delay.severity === radarSeverityFilter)
                .map(task => (
                  <div key={task.id} className="rounded-2xl border-2 border-rose-400/80 bg-white p-4 shadow-sm dark:border-rose-900/70 dark:bg-slate-900 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700 dark:bg-rose-950 dark:text-rose-400 uppercase">
                          Action Task · {task.delay.label}
                        </span>
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                          {task.title}
                        </h4>
                        {task.goal && <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">Goal: {task.goal.title}</p>}
                      </div>
                      <span className="text-xs font-bold text-rose-600 shrink-0">Due: {task.dueAt || task.date}</span>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleTriggerAlarmNow(task.title, task.delay.label, task.id)}
                          className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500 cursor-pointer"
                        >
                          Alarm
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickReschedule('task', task.id, 1)}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          +1d Snooze
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleTask(task)}
                        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
                      >
                        ✓ Mark Done
                      </button>
                    </div>
                  </div>
                ))}

              {/* Delayed Milestones */}
              {delayedMilestones
                .filter(m => radarSeverityFilter === 'all' || m.delay.severity === radarSeverityFilter)
                .map(m => (
                  <div key={m.id} className="rounded-2xl border-2 border-rose-400/80 bg-white p-4 shadow-sm dark:border-rose-900/70 dark:bg-slate-900 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-950 dark:text-amber-400 uppercase">
                          Strategic Milestone · {m.delay.label}
                        </span>
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                          {m.title}
                        </h4>
                        {m.goal && <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">Goal: {m.goal.title}</p>}
                      </div>
                      <span className="text-xs font-bold text-rose-600 shrink-0">Due: {m.dueDate}</span>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleTriggerAlarmNow(m.title, m.delay.label, m.id)}
                          className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500 cursor-pointer"
                        >
                          Alarm
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickReschedule('milestone', m.id, 3)}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          +3d Snooze
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleMilestone(m)}
                        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
                      >
                        ✓ Reached
                      </button>
                    </div>
                  </div>
                ))}

              {/* Delayed Projects */}
              {delayedProjects
                .filter(p => radarSeverityFilter === 'all' || p.delay.severity === radarSeverityFilter)
                .map(proj => (
                  <div key={proj.id} className="rounded-2xl border-2 border-rose-400/80 bg-white p-4 shadow-sm dark:border-rose-900/70 dark:bg-slate-900 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700 dark:bg-rose-950 dark:text-rose-400 uppercase">
                          Deliverable · {proj.delay.label}
                        </span>
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                          {proj.name}
                        </h4>
                      </div>
                      <span className="text-xs font-bold text-rose-600 shrink-0">Due: {proj.due}</span>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleTriggerAlarmNow(proj.name, 'Project deliverable past due!', proj.id)}
                        className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500 cursor-pointer"
                      >
                        Ring Alarm
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenTaskGenesis({ type: 'project', id: proj.id, title: proj.name, goalId: proj.goalId, due: proj.due })}
                        className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 cursor-pointer"
                      >
                        <ThemeIcon name="zap" className="mr-1 inline h-3 w-3" /> Task Genesis
                      </button>
                    </div>
                  </div>
                ))}

              {/* Delayed Savings Targets */}
              {delayedSavings
                .filter(s => radarSeverityFilter === 'all' || s.delay.severity === radarSeverityFilter)
                .map(sp => (
                  <div key={sp.id} className="rounded-2xl border-2 border-rose-400/80 bg-white p-4 shadow-sm dark:border-rose-900/70 dark:bg-slate-900 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 uppercase">
                          Savings Target Behind · {sp.delay.label}
                        </span>
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                          <><ThemeIcon name="savings" className="h-3.5 w-3.5" /> {sp.name}</>
                        </h4>
                        {sp.goal && <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">Goal: {sp.goal.title}</p>}
                      </div>
                      <span className="text-xs font-bold text-rose-600 shrink-0">Target: {sp.targetDate}</span>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300">
                      Progress: ₹{(sp.currentAmount || 0).toLocaleString('en-IN')} / ₹{(sp.targetAmount || 0).toLocaleString('en-IN')} ({sp.progress}%)
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleTriggerAlarmNow(sp.name, `Savings target behind: ${sp.delay.label}`, sp.id)}
                        className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500 cursor-pointer"
                      >
                        Ring Alarm
                      </button>
                    </div>
                  </div>
                ))}

              {/* Delayed / Overdue Loans */}
              {delayedLoans
                .filter(l => radarSeverityFilter === 'all' || l.delay.severity === radarSeverityFilter)
                .map(loan => (
                  <div key={loan.id} className="rounded-2xl border-2 border-rose-400/80 bg-white p-4 shadow-sm dark:border-rose-900/70 dark:bg-slate-900 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700 dark:bg-rose-950 dark:text-rose-400 uppercase">
                          Debt Clearance Overdue · {loan.delay.label}
                        </span>
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                          <><ThemeIcon name="loan" className="h-3.5 w-3.5" /> {(loan as any).lender || loan.name}</>
                        </h4>
                        {loan.goal && <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">Goal: {loan.goal.title}</p>}
                      </div>
                      <span className="text-xs font-bold text-rose-600 shrink-0">Due: {loan.targetDate}</span>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300">
                      Paid: ₹{(loan.paid || 0).toLocaleString('en-IN')} / ₹{(loan.principal || 0).toLocaleString('en-IN')} ({loan.progress}% · Outstanding: ₹{(loan.outstanding || 0).toLocaleString('en-IN')})
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleTriggerAlarmNow((loan as any).lender || loan.name, `Debt clearance overdue: ${loan.delay.label}`, loan.id)}
                        className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500 cursor-pointer"
                      >
                        Ring Alarm
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* 7. GOAL FINANCIAL PORTFOLIO & TIMELINE */}
      {activeStream === 'finance' && viewMode !== 'gantt' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="metric-summary-grid grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border-2 border-dashed border-slate-200 p-3.5 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tracked Goals</span>
              <div className="mt-1 font-mono text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                {financiallyLinkedGoals.length} <span className="text-xs font-normal text-slate-400">/ {goals.length}</span>
              </div>
            </div>

            <div className="rounded-xl border-2 border-dashed border-slate-200 p-3.5 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Linked Income</span>
              <div className="mt-1 font-mono text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                ₹{transactions.filter(t => t.goalId && t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0).toLocaleString('en-IN')}
              </div>
            </div>

            <div className="rounded-xl border-2 border-dashed border-slate-200 p-3.5 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">Linked Expenses</span>
              <div className="mt-1 font-mono text-xl sm:text-2xl font-extrabold text-rose-600 dark:text-rose-400">
                ₹{transactions.filter(t => t.goalId && t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0).toLocaleString('en-IN')}
              </div>
            </div>

            <div className="rounded-xl border-2 border-dashed border-slate-200 p-3.5 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Investments</span>
              <div className="mt-1 font-mono text-xl sm:text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                ₹{investments.filter(i => i.goalId).reduce((s, i) => s + (Number(i.currentValue ?? i.amount) || 0), 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {goals.map(goal => {
              const metrics = getGoalFinancialMetrics(goal.id);
              const tier = getGoalTierBadge(goal.level);

              return (
                <div key={goal.id} className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold border ${tier.badgeStyle}`}>
                        <ThemeIcon name={tier.icon} className="h-3 w-3" /> {tier.name}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{goal.title}</h4>
                      <span className="text-xs text-slate-400">({goal.category || 'General'})</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">{goal.progress}% Complete</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/80">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Net Flow</div>
                      <div className="font-mono text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                        ₹{metrics.netCashFlow.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/80">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Investments</div>
                      <div className="font-mono text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                        ₹{metrics.investmentsTotal.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/80">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Total Debt</div>
                      <div className="font-mono text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                        ₹{metrics.totalDebt.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/80">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Savings Target</div>
                      <div className="font-mono text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                        ₹{metrics.savingsTotal.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 8. UNIVERSAL TASK GENESIS MODAL */}
      {genesisModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-black text-xs">
                  <Zap className="h-4 w-4 text-white" />
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
                  <ThemedDateTimeInput
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

              {/* Reminder Controls */}
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
                      <ThemedDateTimeInput
                        type="time"
                        value={genesisModal.alarmTime}
                        onChange={e => setGenesisModal({ ...genesisModal, alarmTime: e.target.value })}
                        className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400">
                        Ringtone
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

      {/* 9. QUICK RESCHEDULE / SNOOZE MODAL */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4 text-indigo-600" />
                <span>Quick Reschedule</span>
              </h3>
              <button
                type="button"
                onClick={() => setRescheduleTarget(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                {rescheduleTarget.title}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Current: {rescheduleTarget.currentDate || 'No date set'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickReschedule(rescheduleTarget.type, rescheduleTarget.id, 1)}
                className="rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
              >
                +1 Day
              </button>
              <button
                type="button"
                onClick={() => handleQuickReschedule(rescheduleTarget.type, rescheduleTarget.id, 3)}
                className="rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
              >
                +3 Days
              </button>
              <button
                type="button"
                onClick={() => handleQuickReschedule(rescheduleTarget.type, rescheduleTarget.id, 7)}
                className="rounded-xl border border-indigo-200 bg-indigo-50 py-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 cursor-pointer"
              >
                +1 Week
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
