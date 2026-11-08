import { getCurrencySymbol } from './currencyDisplay';
import { storage } from './storage';
import { getLocalDateString } from './dateUtils';
import { calculateNextOccurrence, isValidRecurrenceConfig } from './recurrenceEngine';
import { getGoalPeriodProgress, type GoalPeriodProgressInput } from './goalPeriodProgress';
import {
  Goal,
  Task,
  Milestone,
  Habit,
  HabitLog,
  Routine,
  LearningItem,
  Skill,
  Note,
  JournalEntry,
  FinanceTransaction,
  Loan,
  Investment,
  SavingsPlan,
  Asset,
  Liability,
  HealthAppointment,
  HealthNote,
  Meeting,
  SpiritualPractice,
  FocusSession,
  ReminderItem,
} from '../types';

export type GoalItemType =
  | 'goal'
  | 'task'
  | 'milestone'
  | 'habit'
  | 'routine'
  | 'learning'
  | 'skill'
  | 'note'
  | 'journal'
  | 'savingsPlan'
  | 'loan'
  | 'investment'
  | 'asset'
  | 'liability'
  | 'transaction'
  | 'appointment'
  | 'healthNote'
  | 'meeting'
  | 'practice'
  | 'focusSession'
  | 'reminder';

export interface GoalItemDetail {
  id: string;
  type: GoalItemType;
  typeLabel: string;
  title: string;
  progress: number;
  weightPercent: number; // e.g. 10% if 10 items
  isCompleted: boolean;
  isAggregate?: boolean;
  progressWeight?: number;
  itemCount?: number;
  completedCount?: number;
}

export interface GoalCategorySummary {
  count: number;
  completedCount: number;
  avgPercent: number;
}

export interface GoalProgressBreakdown {
  goalId: string;
  goalTitle: string;
  totalItems: number;
  completedItems: number;
  progressItemCount: number;
  progressPoints: number;
  totalPercent: number;
  hasLinkedItems: boolean;
  categories: {
    childGoals: GoalCategorySummary;
    tasks: GoalCategorySummary;
    milestones: GoalCategorySummary;
    habits: GoalCategorySummary;
    routines: GoalCategorySummary;
    learning: GoalCategorySummary;
    skills: GoalCategorySummary;
    notes: GoalCategorySummary;
    journal: GoalCategorySummary;
    savingsPlans: GoalCategorySummary;
    loans: GoalCategorySummary;
    investments: GoalCategorySummary;
    assets: GoalCategorySummary;
    liabilities: GoalCategorySummary;
    transactions: GoalCategorySummary;
    appointments: GoalCategorySummary;
    healthNotes: GoalCategorySummary;
    meetings: GoalCategorySummary;
    practices: GoalCategorySummary;
    focusSessions: GoalCategorySummary;
    reminders: GoalCategorySummary;
  };
  items: GoalItemDetail[];
}

export interface RecalcOverrides {
  updatedTaskId?: string;
  updatedTaskDone?: boolean;
  updatedTaskStatus?: 'open' | 'in-progress' | 'done';
  updatedMilestoneId?: string;
  updatedMilestoneStatus?: string;
  updatedMilestoneProgress?: number;
  updatedRoutineId?: string;
  isRoutineDoneToday?: boolean;
  updatedLearningId?: string;
  updatedLearningProgress?: number;
  updatedSkillId?: string;
  updatedSkillLevelOrProgress?: string | number;
  updatedReminderId?: string;
  updatedReminderDone?: boolean;
  updatedAppointmentId?: string;
  updatedAppointmentStatus?: 'scheduled' | 'completed' | 'cancelled';
  updatedAppointmentCompleted?: boolean;
  updatedMeetingId?: string;
  updatedMeetingStatus?: 'scheduled' | 'completed' | 'cancelled';
  updatedMeetingCompleted?: boolean;
}

export interface GoalRelatedData {
  goals: Goal[];
  tasks: Task[];
  milestones?: Milestone[];
  habits?: Habit[];
  habitLogs?: HabitLog[];
  routines?: Routine[];
  learningItems?: LearningItem[];
  skills?: Skill[];
  notes?: Note[];
  journal?: JournalEntry[];
  savingsPlans?: SavingsPlan[];
  loans?: Loan[];
  investments?: Investment[];
  assets?: Asset[];
  liabilities?: Liability[];
  transactions?: FinanceTransaction[];
  appointments?: HealthAppointment[];
  healthNotes?: HealthNote[];
  meetings?: Meeting[];
  practices?: SpiritualPractice[];
  focusSessions?: FocusSession[];
  reminders?: ReminderItem[];
}

export type GoalResolutionSources = Pick<GoalRelatedData, 'learningItems' | 'skills' | 'routines'>;

export function createTaskGoalResolver(sources: GoalResolutionSources): (task: Task) => string | undefined {
  const routines = new Map((sources.routines || []).filter(item => item.goalId).map(item => [item.id, item.goalId!]));
  const skills = new Map((sources.skills || []).filter(item => item.goalId).map(item => [item.id, item.goalId!]));
  const learning = new Map((sources.learningItems || []).filter(item => item.goalId).map(item => [item.id, item.goalId!]));
  return task => task.goalId ||
      (task.routineId ? routines.get(task.routineId) : undefined) ||
      (task.skillId ? skills.get(task.skillId) : undefined) ||
      (task.learningId ? learning.get(task.learningId) : undefined);
}

export function resolveTaskGoalId(task: Task, sources: GoalResolutionSources): string | undefined {
  return createTaskGoalResolver(sources)(task);
}

interface GoalTaskProgressItem {
  id: string;
  title: string;
  progress: number;
  isCompleted: boolean;
  progressWeight?: number;
  itemCount?: number;
  completedCount?: number;
  isAggregate?: boolean;
}

function getTaskOccurrenceDate(task: Task): string | undefined {
  const date = task.dueAt || task.date;
  return date ? date.slice(0, 10) : undefined;
}

function getTaskSeriesRoot(task: Task, tasksById: Map<string, Task>): Task {
  let current = task;
  const visited = new Set<string>();
  while (current.recurringParentId && !visited.has(current.id)) {
    visited.add(current.id);
    const parent = tasksById.get(current.recurringParentId);
    if (!parent) break;
    current = parent;
  }
  return current;
}

function getFiniteRecurrenceDates(startDate: string, config: NonNullable<Task['recurringConfig']>): string[] {
  const firstDate = startDate.slice(0, 10);
  if (!isValidRecurrenceConfig(config) || config.endType === 'never') return [];

  const scheduleConfig = { ...config, occurrenceCount: 1, lastGeneratedDate: undefined };
  const dates = [firstDate];
  let currentDate = firstDate;
  while (true) {
    const nextDate = calculateNextOccurrence(currentDate, scheduleConfig);
    if (!nextDate) break;
    dates.push(nextDate);
    currentDate = nextDate;
    if (scheduleConfig.endType === 'after') {
      scheduleConfig.occurrenceCount = (scheduleConfig.occurrenceCount || 0) + 1;
    }
  }
  return dates;
}

function getGoalTaskProgressItems(linkedTasks: Task[], allTasks: Task[]): GoalTaskProgressItem[] {
  const tasksById = new Map(allTasks.map(task => [task.id, task]));
  const rootsById = new Map<string, Task>();
  for (const task of linkedTasks) {
    const root = getTaskSeriesRoot(task, tasksById);
    rootsById.set(root.id, root);
  }
  const seriesByRootId = new Map<string, { root: Task; tasks: Task[] }>();
  for (const task of allTasks) {
    const root = getTaskSeriesRoot(task, tasksById);
    if (!rootsById.has(root.id)) continue;
    const series = seriesByRootId.get(root.id) || { root: rootsById.get(root.id)!, tasks: [] };
    series.tasks.push(task);
    seriesByRootId.set(root.id, series);
  }

  const progressItems: GoalTaskProgressItem[] = [];
  for (const { root, tasks: seriesTasks } of seriesByRootId.values()) {
    const recurrenceConfig = root.recurringConfig || seriesTasks.find(task => task.recurringConfig)?.recurringConfig;
    if (!recurrenceConfig) {
      for (const task of seriesTasks) {
        const isCompleted = Boolean(task.done || task.status === 'done');
        progressItems.push({
          id: task.id,
          title: task.title,
          progress: isCompleted ? 100 : task.status === 'in-progress' ? 50 : 0,
          isCompleted
        });
      }
      continue;
    }

    const tasksByDate = new Map<string, Task[]>();
    for (const task of seriesTasks) {
      const date = getTaskOccurrenceDate(task);
      if (!date) continue;
      const sameDateTasks = tasksByDate.get(date) || [];
      sameDateTasks.push(task);
      tasksByDate.set(date, sameDateTasks);
    }

    const startDate = getTaskOccurrenceDate(root) || getTaskOccurrenceDate(seriesTasks[0]);
    const scheduledDates = recurrenceConfig.endType !== 'never' && startDate
      ? getFiniteRecurrenceDates(startDate, recurrenceConfig)
      : [];
    const occurrenceDates = scheduledDates.length > 0
      ? scheduledDates
      : Array.from(tasksByDate.keys()).sort();
    if (occurrenceDates.length === 0) continue;

    let completedCount = 0;
    let progressPoints = 0;
    for (const date of occurrenceDates) {
      const occurrenceTasks = tasksByDate.get(date) || [];
      const isCompleted = occurrenceTasks.some(task => task.done || task.status === 'done');
      const isInProgress = !isCompleted && occurrenceTasks.some(task => task.status === 'in-progress');
      if (isCompleted) completedCount++;
      progressPoints += isCompleted ? 100 : isInProgress ? 50 : 0;
    }

    const occurrenceCount = occurrenceDates.length;
    progressItems.push({
      id: root.id,
      title: `${root.title} (${completedCount}/${occurrenceCount} occurrences)`,
      progress: progressPoints / occurrenceCount,
      isCompleted: completedCount === occurrenceCount,
      progressWeight: occurrenceCount,
      itemCount: occurrenceCount,
      completedCount,
      isAggregate: true
    });
  }
  return progressItems;
}

function getGoalPeriodInput(goal: Goal, data: GoalRelatedData): GoalPeriodProgressInput {
  const routines = data.routines || [];
  const learningItems = data.learningItems || [];
  const skills = data.skills || [];
  const tasks = data.tasks.filter(task =>
    resolveTaskGoalId(task, { routines, skills, learningItems }) === goal.id
  );
  const habitResolver = createHabitGoalResolver(routines);
  return {
    goal,
    childGoals: [],
    tasks,
    allTasks: data.tasks,
    milestones: (data.milestones || []).filter(item => item.goalId === goal.id),
    learningItems: learningItems.filter(item => item.goalId === goal.id),
    skills: skills.filter(item => item.goalId === goal.id),
    routines: routines.filter(item => item.goalId === goal.id),
    habits: (data.habits || []).filter(item => habitResolver(item) === goal.id),
    habitLogs: data.habitLogs || [],
    appointments: (data.appointments || []).filter(item => item.goalId === goal.id),
    meetings: (data.meetings || []).filter(item => item.goalId === goal.id),
    savingsPlans: (data.savingsPlans || []).filter(item => item.goalId === goal.id),
    loans: (data.loans || []).filter(item => item.goalId === goal.id),
    investments: (data.investments || []).filter(item => item.goalId === goal.id),
    reminders: (data.reminders || []).filter(item => item.linkedType === 'goal' && item.linkedId === goal.id)
  };
}

function getGoalPeriodRange(input: GoalPeriodProgressInput): { start: string; end: string } {
  const goal = input.goal;
  const taskById = new Map(input.allTasks.map(task => [task.id, task]));
  const taskSeriesRoots = input.tasks.filter(task =>
    getTaskSeriesRoot(task, taskById).id === task.id
  );
  const start = goal.date?.slice(0, 10) ||
    (goal.createdAt ? getLocalDateString(new Date(goal.createdAt)) : undefined);
  const datedItems = [
    ...input.tasks.map(task => getTaskOccurrenceDate(task)),
    ...input.tasks.map(task => task.recurringConfig?.endByDate),
    ...taskSeriesRoots.flatMap(task => {
      const startDate = getTaskOccurrenceDate(task);
      if (!startDate || !task.recurringConfig || task.recurringConfig.endType === 'never') return [];
      const dates = getFiniteRecurrenceDates(startDate, task.recurringConfig);
      return dates.length > 0 ? [dates[dates.length - 1]] : [];
    }),
    ...input.milestones.map(item => item.dueDate),
    ...input.learningItems.map(item => item.targetDate),
    ...input.skills.map(item => item.targetDate),
    ...input.routines.map(item => item.createdAt ? getLocalDateString(new Date(item.createdAt)) : undefined),
    ...input.habits.map(item => item.createdAt ? getLocalDateString(new Date(item.createdAt)) : undefined),
    ...input.appointments.map(item => item.date),
    ...input.meetings.map(item => item.date),
    ...input.savingsPlans.flatMap(item => [item.startDate, item.maturityDate]),
    ...input.loans.flatMap(item => [item.startDate, item.firstPaymentDate, item.maturityDate]),
    ...input.investments.map(item => item.date),
    ...input.reminders.map(item => item.dueAt)
  ].filter((date): date is string => Boolean(date)).map(date => date.slice(0, 10));
  const periodStart = start || datedItems.reduce((earliest, date) => date < earliest ? date : earliest, getLocalDateString());
  const targetEnd = goal.targetDate?.slice(0, 10);
  const periodEnd = targetEnd || datedItems.reduce(
    (latest, date) => date > latest ? date : latest,
    getLocalDateString()
  );
  return { start: periodStart, end: periodEnd < periodStart ? periodStart : periodEnd };
}

function getSingleLinkedProgressInput(
  base: GoalPeriodProgressInput,
  item: Pick<GoalItemDetail, 'id' | 'type'>,
  data: GoalRelatedData
): GoalPeriodProgressInput {
  const single: GoalPeriodProgressInput = {
    ...base,
    childGoals: [],
    tasks: [],
    milestones: [],
    learningItems: [],
    skills: [],
    routines: [],
    habits: [],
    appointments: [],
    meetings: [],
    savingsPlans: [],
    loans: [],
    investments: [],
    reminders: []
  };
  switch (item.type) {
    case 'task': {
      const task = data.tasks.find(candidate => candidate.id === item.id);
      if (task) single.tasks = [task];
      break;
    }
    case 'milestone':
      single.milestones = (data.milestones || []).filter(candidate => candidate.id === item.id);
      break;
    case 'learning':
      single.learningItems = (data.learningItems || []).filter(candidate => candidate.id === item.id);
      break;
    case 'skill':
      single.skills = (data.skills || []).filter(candidate => candidate.id === item.id);
      break;
    case 'routine':
      single.routines = (data.routines || []).filter(candidate => candidate.id === item.id);
      break;
    case 'habit':
      single.habits = (data.habits || []).filter(candidate => candidate.id === item.id);
      break;
    case 'appointment':
      single.appointments = (data.appointments || []).filter(candidate => candidate.id === item.id);
      break;
    case 'meeting':
      single.meetings = (data.meetings || []).filter(candidate => candidate.id === item.id);
      break;
    case 'savingsPlan':
      single.savingsPlans = (data.savingsPlans || []).filter(candidate => candidate.id === item.id);
      break;
    case 'loan':
      single.loans = (data.loans || []).filter(candidate => candidate.id === item.id);
      break;
    case 'investment':
      single.investments = (data.investments || []).filter(candidate => candidate.id === item.id);
      break;
    case 'reminder':
      single.reminders = (data.reminders || []).filter(candidate => candidate.id === item.id);
      break;
  }
  return single;
}


export function createHabitGoalResolver(routines: Routine[]): (habit: Habit) => string | undefined {
  const routineGoals = new Map(routines.filter(routine => routine.goalId).map(routine => [routine.id, routine.goalId!]));
  return habit => {
    if (habit.goalId) return habit.goalId;
    const linkedRoutineId = habit.routineId || habit.linkedRoutineId;
    return linkedRoutineId ? routineGoals.get(linkedRoutineId) : undefined;
  };
}

export function resolveHabitGoalId(habit: Habit, routines: Routine[]): string | undefined {
  return createHabitGoalResolver(routines)(habit);
}

/**
 * Synchronously computes comprehensive aggregate breakdown for a given goal
 * from all provided data arrays in memory across all supported linked modules.
 */
export function computeGoalAggregateBreakdown(
  goalId: string,
  data: GoalRelatedData
): GoalProgressBreakdown {
  return computeGoalAggregateBreakdownInternal(goalId, data, new Set());
}

function computeGoalAggregateBreakdownInternal(
  goalId: string,
  data: GoalRelatedData,
  visitedGoals: Set<string>
): GoalProgressBreakdown {
  const goal = data.goals.find(g => g.id === goalId);
  const goalTitle = goal?.title || 'Goal';
  visitedGoals.add(goalId);
  const today = getLocalDateString();

  const milestones = data.milestones || [];
  const habits = data.habits || [];
  const habitLogs = data.habitLogs || [];
  const routines = data.routines || [];
  const learning = data.learningItems || [];
  const skills = data.skills || [];
  const notes = data.notes || [];
  const journal = data.journal || [];

  const savingsPlans = data.savingsPlans || [];
  const loans = data.loans || [];
  const investments = data.investments || [];
  const assets = data.assets || [];
  const liabilities = data.liabilities || [];
  const transactions = data.transactions || [];

  const appointments = data.appointments || [];
  const healthNotes = data.healthNotes || [];

  const meetings = data.meetings || [];

  const practices = data.practices || [];
  const focusSessions = data.focusSessions || [];
  const reminders = data.reminders || [];
  const taskGoalId = createTaskGoalResolver({
    routines,
    skills,
    learningItems: learning
  });
  const habitGoalId = createHabitGoalResolver(routines);

  // Filter linked items
  const childGoals = Array.from(new Map(
    data.goals
      .filter(g => g.parentId === goalId || g.parentIds?.includes(goalId))
      .map(child => [child.id, child])
  ).values());
  const tasks = data.tasks.filter(t => taskGoalId(t) === goalId);
  const linkedMilestones = milestones.filter(m => m.goalId === goalId);
  const linkedHabits = habits.filter(h => habitGoalId(h) === goalId);
  const linkedRoutines = routines.filter(r => r.goalId === goalId);
  const linkedLearning = learning.filter(l => l.goalId === goalId);
  const linkedSkills = skills.filter(s => s.goalId === goalId);
  const linkedNotes = notes.filter(n => n.goalId === goalId);
  const linkedJournal = journal.filter(j => j.goalId === goalId);

  const linkedSavingsPlans = savingsPlans.filter(s => s.goalId === goalId);
  const linkedLoans = loans.filter(l => l.goalId === goalId);
  const linkedInvestments = investments.filter(i => i.goalId === goalId);
  const linkedAssets = assets.filter(a => a.goalId === goalId);
  const linkedLiabilities = liabilities.filter(l => l.goalId === goalId);
  const linkedTransactions = transactions.filter(t => t.goalId === goalId);

  const linkedAppointments = appointments.filter(a => a.goalId === goalId && a.status !== 'cancelled');
  const linkedHealthNotes = healthNotes.filter(n => n.goalId === goalId);

  const linkedMeetings = meetings.filter(m => m.goalId === goalId && m.status !== 'cancelled');

  const linkedPractices = practices.filter(p => p.goalId === goalId);

  const linkedFocusSessions = focusSessions.filter(f => f.goalId === goalId);
  const linkedReminders = reminders.filter(r => r.linkedType === 'goal' && r.linkedId === goalId);

  const rawItems: Array<{
    id: string;
    type: GoalItemDetail['type'];
    typeLabel: string;
    title: string;
    progress: number;
    isCompleted: boolean;
    progressWeight?: number;
    itemCount?: number;
    completedCount?: number;
    isAggregate?: boolean;
  }> = [];

  // 1. Child Goals
  childGoals.forEach(c => {
    if (visitedGoals.has(c.id)) return;
    const childBreakdown = computeGoalAggregateBreakdownInternal(c.id, data, visitedGoals);
    const hasChildProgressItems = childBreakdown.progressItemCount > 0;
    const prog = hasChildProgressItems
      ? childBreakdown.progressPoints / childBreakdown.progressItemCount
      : Math.max(0, Math.min(100, Number(c.progress) || 0));
    const progressWeight = hasChildProgressItems ? childBreakdown.progressItemCount : 1;
    const typeLabel =
      c.level === 5 ? 'Atomic Goal' :
      c.level === 4 ? 'Nano Goal' :
      c.level === 3 ? 'Micro Goal' :
      c.level === 2 ? 'Sub Goal' : 'Main Goal';
    rawItems.push({
      id: c.id,
      type: 'goal',
      typeLabel,
      title: c.title,
      progress: prog,
      isCompleted: childBreakdown.completedItems >= progressWeight,
      progressWeight,
      itemCount: hasChildProgressItems ? childBreakdown.totalItems : 1,
      completedCount: hasChildProgressItems
        ? childBreakdown.completedItems
        : prog >= 100 ? 1 : 0,
      isAggregate: hasChildProgressItems
    });
  });

  // 2. Tasks
  getGoalTaskProgressItems(tasks, data.tasks).forEach(task => {
    rawItems.push({
      id: task.id,
      type: 'task',
      typeLabel: 'Task',
      title: task.title,
      progress: task.progress,
      isCompleted: task.isCompleted,
      progressWeight: task.progressWeight,
      itemCount: task.itemCount,
      completedCount: task.completedCount,
      isAggregate: task.isAggregate
    });
  });

  // 3. Milestones
  linkedMilestones.forEach(m => {
    const isDone = m.status === 'completed';
    const prog = isDone ? 100 : Math.max(0, Math.min(100, Math.round(Number(m.progress) || 0)));
    rawItems.push({
      id: m.id,
      type: 'milestone',
      typeLabel: 'Milestone',
      title: m.title,
      progress: prog,
      isCompleted: isDone || prog >= 100
    });
  });

  // 4. Habits (Evaluated based on 30-day consistency window)
  linkedHabits.forEach(h => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoIso = getLocalDateString(thirtyDaysAgo);
    const recentLogs = habitLogs.filter(l => l.habitId === h.id && l.date >= thirtyDaysAgoIso && l.date <= today);
    const uniqueDays = new Set(recentLogs.map(l => l.date)).size;
    const isDoneToday = h.doneDate === today || habitLogs.some(l => l.habitId === h.id && l.date === today);
    const effectiveDays = isDoneToday && uniqueDays === 0 ? 1 : uniqueDays;
    const prog = Math.min(100, Math.round((effectiveDays / 30) * 100));
    rawItems.push({
      id: h.id,
      type: 'habit',
      typeLabel: 'Habit Ritual',
      title: `${h.name} (${effectiveDays}/30d consistency${isDoneToday ? ' · ✓ Done Today' : ''})`,
      progress: prog,
      isCompleted: prog >= 90
    });
  });

  // 5. Routines (Evaluated based on 30-day consistency window)
  linkedRoutines.forEach(r => {
    const isDoneToday = Boolean(r.completedDate === today || (r.completedDates && r.completedDates.includes(today)));
    const dates = Array.from(new Set([...(r.completedDates || []), ...(r.completedDate ? [r.completedDate] : [])]));
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoIso = getLocalDateString(thirtyDaysAgo);
    const recentDays = dates.filter(d => d >= thirtyDaysAgoIso && d <= today).length;
    const effectiveDays = isDoneToday && recentDays === 0 ? 1 : recentDays;
    const prog = Math.min(100, Math.round((effectiveDays / 30) * 100));
    rawItems.push({
      id: r.id,
      type: 'routine',
      typeLabel: 'Routine Block',
      title: `${r.name} (${effectiveDays}/30d consistency${isDoneToday ? ' · ✓ Done Today' : ''})`,
      progress: prog,
      isCompleted: prog >= 90
    });
  });

  // 6. Learning Items
  linkedLearning.forEach(l => {
    const prog = Math.max(0, Math.min(100, Math.round(Number(l.progress) || 0)));
    rawItems.push({
      id: l.id,
      type: 'learning',
      typeLabel: 'Learning Track',
      title: l.title,
      progress: prog,
      isCompleted: prog >= 100
    });
  });

  // 8. Skills
  linkedSkills.forEach(s => {
    let prog = 0;
    if (typeof s.progress === 'number' && !isNaN(s.progress)) {
      prog = s.progress;
    } else {
      const lvl = (s.level || '').toLowerCase();
      if (lvl.includes('master') || lvl.includes('expert')) prog = 100;
      else if (lvl.includes('advance')) prog = 75;
      else if (lvl.includes('inter')) prog = 50;
      else prog = 25;
    }
    prog = Math.max(0, Math.min(100, Math.round(prog)));
    rawItems.push({
      id: s.id,
      type: 'skill',
      typeLabel: 'Competency',
      title: s.name,
      progress: prog,
      isCompleted: prog >= 100
    });
  });

  // 9. Notebooks & Knowledge Vault (Reference Vault)
  linkedNotes.forEach(n => {
    rawItems.push({
      id: n.id,
      type: 'note',
      typeLabel: 'Knowledge Vault',
      title: n.title,
      progress: 0,
      isCompleted: false
    });
  });

  // 10. Daily Journal & Philosophical Reflections (Reference Reflection)
  linkedJournal.forEach(j => {
    rawItems.push({
      id: j.id,
      type: 'journal',
      typeLabel: 'Journal Reflection',
      title: j.title,
      progress: 0,
      isCompleted: false
    });
  });

  // 11. Savings Plans
  linkedSavingsPlans.forEach(s => {
    const target = Number(s.targetAmount) || 0;
    const current = Number(s.currentAmount) || 0;
    const prog = target > 0 ? Math.max(0, Math.min(100, Math.round((current / target) * 100))) : 0;
    rawItems.push({
      id: s.id,
      type: 'savingsPlan',
      typeLabel: 'Savings Goal',
      title: `${s.name} (${getCurrencySymbol()} ${current.toLocaleString()} / ${getCurrencySymbol()} ${target.toLocaleString()})`,
      progress: prog,
      isCompleted: prog >= 100
    });
  });

  // 12. Loans & Debt Clearances
  linkedLoans.forEach(l => {
    const principal = Number(l.principal) || 0;
    const outstanding = Number(l.outstanding) || 0;
    const repaid = principal > 0 ? Math.max(0, principal - outstanding) : 0;
    const prog = principal > 0 ? Math.max(0, Math.min(100, Math.round((repaid / principal) * 100))) : 0;
    rawItems.push({
      id: l.id,
      type: 'loan',
      typeLabel: 'Loan Repayment',
      title: `${l.name} (Paid: ${getCurrencySymbol()} ${repaid.toLocaleString()})`,
      progress: prog,
      isCompleted: principal > 0 && (outstanding <= 0 || prog >= 100)
    });
  });

  // 13. Investments & Portfolios
  linkedInvestments.forEach(i => {
    const amt = Number(i.amount) || 0;
    const val = Number(i.currentValue) || 0;
    const prog = amt > 0 ? Math.max(0, Math.min(100, Math.round((val / amt) * 100))) : 0;
    rawItems.push({
      id: i.id,
      type: 'investment',
      typeLabel: 'Investment',
      title: `${i.name} (${getCurrencySymbol()} ${val.toLocaleString()})`,
      progress: prog,
      isCompleted: amt > 0 && val >= amt
    });
  });

  // 14. Capital Assets
  linkedAssets.forEach(a => {
    rawItems.push({
      id: a.id,
      type: 'asset',
      typeLabel: 'Asset Holding',
      title: `${a.name} (${getCurrencySymbol()} ${(Number(a.value) || 0).toLocaleString()})`,
      progress: 100,
      isCompleted: true
    });
  });

  // 15. Liabilities
  linkedLiabilities.forEach(l => {
    const amt = Number(l.amount) || 0;
    const prog = amt <= 0 ? 100 : 50;
    rawItems.push({
      id: l.id,
      type: 'liability',
      typeLabel: 'Liability Item',
      title: `${l.name} (${getCurrencySymbol()} ${amt.toLocaleString()})`,
      progress: prog,
      isCompleted: amt <= 0
    });
  });

  // 16. Finance Transactions (Deposits / Allocations)
  linkedTransactions.forEach(t => {
    rawItems.push({
      id: t.id,
      type: 'transaction',
      typeLabel: 'Ledger Entry',
      title: `${t.category || t.type}: ${getCurrencySymbol()} ${(Number(t.amount) || 0).toLocaleString()} (${t.date})`,
      progress: 0,
      isCompleted: false
    });
  });

  // 17. Health Appointments (Scheduled vs Attended/Completed)
  linkedAppointments.forEach(a => {
    const isDone = Boolean((a as any).completed === true || (a as any).status === 'completed');
    rawItems.push({
      id: a.id,
      type: 'appointment',
      typeLabel: 'Medical Appointment',
      title: `${a.title} (${a.date})`,
      progress: isDone ? 100 : 0,
      isCompleted: isDone
    });
  });

  // 18. Health Clinical Notes
  linkedHealthNotes.forEach(n => {
    rawItems.push({
      id: n.id,
      type: 'healthNote',
      typeLabel: 'Health Clinical Note',
      title: `${(n.text || '').slice(0, 35)}... (${n.date})`,
      progress: 0,
      isCompleted: false
    });
  });

  // 19. Meetings & Strategic Syncs (Scheduled vs Completed)
  linkedMeetings.forEach(m => {
    const isDone = Boolean((m as any).completed === true || (m as any).status === 'completed');
    rawItems.push({
      id: m.id,
      type: 'meeting',
      typeLabel: 'Strategic Meeting',
      title: `${m.title} (${m.date})`,
      progress: isDone ? 100 : 0,
      isCompleted: isDone
    });
  });

  // Spiritual Practices
  linkedPractices.forEach(p => {
    rawItems.push({
      id: p.id,
      type: 'practice',
      typeLabel: 'Spiritual Practice',
      title: p.name,
      progress: 0,
      isCompleted: false
    });
  });

  // Focus Sessions (Deep Work Session Log)
  linkedFocusSessions.forEach(f => {
    const mins = f.minutes || Math.round((f.durationSeconds || 0) / 60);
    rawItems.push({
      id: f.id,
      type: 'focusSession',
      typeLabel: 'Deep Work Session',
      title: `${f.label || 'Focus'} (${mins}m on ${f.date})`,
      progress: 0,
      isCompleted: false
    });
  });

  // Reminders
  linkedReminders.forEach(r => {
    const isDone = r.status === 'done';
    rawItems.push({
      id: r.id,
      type: 'reminder',
      typeLabel: 'Goal Reminder',
      title: `${r.title} (${r.dueAt})`,
      progress: isDone ? 100 : 0,
      isCompleted: isDone
    });
  });

  const progressGoal = goal || {
    id: goalId,
    title: goalTitle,
    progress: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  const periodInput = getGoalPeriodInput(progressGoal, data);
  const periodRange = getGoalPeriodRange(periodInput);
  for (const item of rawItems) {
    if (item.type === 'goal') continue;
    const itemProgress = getGoalPeriodProgress(
      getSingleLinkedProgressInput(periodInput, item as GoalItemDetail, data),
      periodRange.start,
      periodRange.end,
      'lifecycle'
    );
    item.progressWeight = itemProgress.total;
    item.itemCount = itemProgress.total;
    item.completedCount = itemProgress.completed;
    item.progress = itemProgress.total > 0
      ? itemProgress.completed / itemProgress.total * 100
      : 0;
    item.isCompleted = itemProgress.total > 0 && itemProgress.completed >= itemProgress.total;
    item.isAggregate = itemProgress.total > 1;
    if (item.type === 'routine') {
      const routine = periodInput.routines.find(candidate => candidate.id === item.id);
      if (routine) item.title = `${routine.name} (${itemProgress.completed}/${itemProgress.total} occurrences)`;
    } else if (item.type === 'habit') {
      const habit = periodInput.habits.find(candidate => candidate.id === item.id);
      if (habit) item.title = `${habit.name} (${itemProgress.completed}/${itemProgress.total} occurrences)`;
    }
  }

  // Pure actionable types that legitimately count towards Goal completion rate
  // Excludes informational notes, contacts, interactions, capital assets, transactions, vitals & focus logs
  const actionableTypes = new Set<GoalItemType>([
    'goal',
    'task',
    'milestone',
    'habit',
    'routine',
    'learning',
    'skill',
    'savingsPlan',
    'loan',
    'investment',
    'appointment',
    'meeting',
    'reminder'
  ]);

  const actionableItems = rawItems.filter(i =>
    actionableTypes.has(i.type) && i.progressWeight !== 0
  );
  const totalItems = rawItems.reduce((sum, item) => sum + (item.itemCount || 1), 0);
  const actionableWeight = actionableItems.reduce((sum, item) => sum + (item.progressWeight ?? 1), 0);
  const weightPerItem = actionableWeight > 0
    ? Number((100 / actionableWeight).toFixed(1))
    : 0;

  const items: GoalItemDetail[] = rawItems.map(item => ({
    ...item,
    weightPercent: actionableTypes.has(item.type)
      ? Number((weightPerItem * (item.progressWeight ?? 1)).toFixed(1))
      : 0
  }));

  const completedItems = items.reduce((sum, item) => {
    if (!actionableTypes.has(item.type)) return sum;
    return sum + (item.completedCount ?? (item.isCompleted ? 1 : 0));
  }, 0);

  const calcCategory = (type: GoalItemDetail['type']): GoalCategorySummary => {
    const matched = items.filter(i => i.type === type);
    const count = matched.reduce((sum, item) => sum + (item.itemCount || 1), 0);
    const completedCount = matched.reduce((sum, item) => sum + (item.completedCount ?? (item.isCompleted ? 1 : 0)), 0);
    const categoryWeight = matched.reduce((sum, item) => sum + (item.progressWeight ?? 1), 0);
    const avgPercent = categoryWeight > 0
      ? Math.round(matched.reduce((sum, item) => sum + item.progress * (item.progressWeight ?? 1), 0) / categoryWeight)
      : 0;
    return { count, completedCount, avgPercent };
  };

  const progressPoints = actionableItems.reduce(
    (sum, item) => sum + item.progress * (item.progressWeight ?? 1),
    0
  );
  const totalPercent = actionableWeight > 0
    ? Math.max(0, Math.min(100, Math.round((progressPoints / actionableWeight) * 10) / 10))
    : Math.max(0, Math.min(100, Math.round(Number(goal?.progress) || 0)));

  return {
    goalId,
    goalTitle,
    totalItems,
    completedItems,
    progressItemCount: actionableWeight,
    progressPoints,
    totalPercent,
    hasLinkedItems: totalItems > 0,
    categories: {
      childGoals: calcCategory('goal'),
      tasks: calcCategory('task'),
      milestones: calcCategory('milestone'),
      habits: calcCategory('habit'),
      routines: calcCategory('routine'),
      learning: calcCategory('learning'),
      skills: calcCategory('skill'),
      notes: calcCategory('note'),
      journal: calcCategory('journal'),
      savingsPlans: calcCategory('savingsPlan'),
      loans: calcCategory('loan'),
      investments: calcCategory('investment'),
      assets: calcCategory('asset'),
      liabilities: calcCategory('liability'),
      transactions: calcCategory('transaction'),
      appointments: calcCategory('appointment'),
      healthNotes: calcCategory('healthNote'),
      meetings: calcCategory('meeting'),
      practices: calcCategory('practice'),
      focusSessions: calcCategory('focusSession'),
      reminders: calcCategory('reminder')
    },
    items
  };
}

/**
 * Loads every store that can feed goal progress in a single batch. Callers that
 * recalculate many goals can share one snapshot instead of re-reading all stores
 * per goal (which made `recalculateAllGoalsProgress` O(N²) on I/O).
 */
async function loadGoalRecalcData(): Promise<Required<GoalRelatedData>> {
  const [
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
    transactions,
    loans,
    investments,
    savingsPlans,
    assets,
    liabilities,
    appointments,
    healthNotes,
    meetings,
    practices,
    focusSessions,
    reminders
  ] = await Promise.all([
    storage.getAll<Goal>('goals'),
    storage.getAll<Task>('tasks'),
    storage.getAll<Milestone>('milestones'),
    storage.getAll<Habit>('habits'),
    storage.getAll<HabitLog>('habitLogs'),
    storage.getAll<Routine>('routines'),
    storage.getAll<LearningItem>('learningItems'),
    storage.getAll<Skill>('skills'),
    storage.getAll<Note>('notes'),
    storage.getAll<JournalEntry>('journal'),
    storage.getAll<FinanceTransaction>('finance'),
    storage.getAll<Loan>('loans'),
    storage.getAll<Investment>('investments'),
    storage.getAll<SavingsPlan>('savingsPlans'),
    storage.getAll<Asset>('assets'),
    storage.getAll<Liability>('liabilities'),
    storage.getAll<HealthAppointment>('healthAppointments'),
    storage.getAll<HealthNote>('healthNotes'),
    storage.getAll<Meeting>('meetings'),
    storage.getAll<SpiritualPractice>('spiritualPractices'),
    storage.getAll<FocusSession>('focus'),
    storage.getAll<ReminderItem>('reminders')
  ]);

  return {
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
    transactions,
    loans,
    investments,
    savingsPlans,
    assets,
    liabilities,
    appointments,
    healthNotes,
    meetings,
    practices,
    focusSessions,
    reminders
  };
}

/**
 * Recomputes one goal from an already-loaded data snapshot and persists it.
 * The shared `goalMap` lets callers see progress updates made earlier in the
 * same batch (children must be processed before parents).
 */
async function computeAndPersistGoal(
  goalId: string,
  goalMap: Map<string, Goal>,
  data: GoalRelatedData
): Promise<{ goal: Goal; breakdown: GoalProgressBreakdown } | null> {
  const current = goalMap.get(goalId);
  if (!current) return null;

  const breakdown = computeGoalAggregateBreakdown(goalId, {
    ...data,
    goals: Array.from(goalMap.values())
  });

  const manualProgress = Math.max(0, Math.min(100, Math.round(Number(current.manualProgress ?? current.progress) || 0)));
  const newProgress = breakdown.progressItemCount > 0 ? breakdown.totalPercent : manualProgress;
  const updated: Goal = {
    ...current,
    manualProgress,
    progress: newProgress,
    status: newProgress >= 100 ? 'completed' : current.status === 'paused' ? 'paused' : 'active',
    updatedAt: Date.now()
  };

  goalMap.set(current.id, updated);
  await storage.put('goals', updated);
  return { goal: updated, breakdown };
}

/**
 * MASTER AGGREGATE RECALCULATION ENGINE
 * Calculates proportional, real-time aggregate progress across linked item categories
 * linked to a Goal (Tasks, Milestones, Habits, Routines, Learning Tracks, Skills, Notes, Journal,
 * Savings Plans, Loans, Investments, Assets, Liabilities, Transactions, Medical Appointments, Clinical Notes,
 * Meetings, Practices, Focus, Reminders).
 * Recursively rolls up progress through the 5-Tier Hierarchy (Atomic 5 -> Nano 4 -> Micro 3 -> Sub 2 -> Main 1).
 */
export async function recalculateGoalAggregateProgress(
  goalId: string,
  overrides?: RecalcOverrides
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  if (!goalId) return { updatedGoals: [] };

  const loaded = await loadGoalRecalcData();
  const allGoals = loaded.goals;
  const targetGoal = allGoals.find(g => g.id === goalId);
  if (!targetGoal) return { updatedGoals: [] };

  const {
    tasks: loadedTasks,
    milestones: loadedMilestones,
    habits: loadedHabits,
    habitLogs: loadedHabitLogs,
    routines: loadedRoutines,
    learningItems: loadedLearning,
    skills: loadedSkills,
    notes: loadedNotes,
    journal: loadedJournal,
    transactions: loadedTransactions,
    loans: loadedLoans,
    investments: loadedInvestments,
    savingsPlans: loadedSavingsPlans,
    assets: loadedAssets,
    liabilities: loadedLiabilities,
    appointments: loadedAppointments,
    healthNotes: loadedHealthNotes,
    meetings: loadedMeetings,
    practices: loadedPractices,
    focusSessions: loadedFocus,
    reminders: loadedReminders
  } = loaded;

  let allTasks = loadedTasks;
  let allMilestones = loadedMilestones;
  let allHabits = loadedHabits;
  const allHabitLogs = loadedHabitLogs;
  let allRoutines = loadedRoutines;
  let allLearning = loadedLearning;
  let allSkills = loadedSkills;
  const allNotes = loadedNotes;
  const allJournal = loadedJournal;
  let allReminders = loadedReminders;
  let allAppointments = loadedAppointments;
  let allMeetings = loadedMeetings;

  // Apply in-flight overrides if provided
  if (overrides) {
    if (overrides.updatedTaskId) {
      allTasks = allTasks.map(t =>
        t.id === overrides.updatedTaskId
          ? {
              ...t,
              done: overrides.updatedTaskDone !== undefined ? overrides.updatedTaskDone : t.done,
              status: overrides.updatedTaskStatus ?? (
                overrides.updatedTaskDone !== undefined
                  ? overrides.updatedTaskDone ? 'done' : 'open'
                  : t.status
              )
            }
          : t
      );
    }

    if (overrides.updatedMilestoneId) {
      allMilestones = allMilestones.map(m =>
        m.id === overrides.updatedMilestoneId
          ? {
              ...m,
              status: overrides.updatedMilestoneStatus !== undefined ? overrides.updatedMilestoneStatus : m.status,
              progress: overrides.updatedMilestoneProgress !== undefined ? overrides.updatedMilestoneProgress : m.progress
            }
          : m
      );
    }

    if (overrides.updatedRoutineId) {
      const today = getLocalDateString();
      allRoutines = allRoutines.map(r => {
        if (r.id !== overrides.updatedRoutineId) return r;
        const prevDates = r.completedDates || [];
        const nextDates = overrides.isRoutineDoneToday
          ? Array.from(new Set([...prevDates, today]))
          : prevDates.filter(d => d !== today);
        return {
          ...r,
          completedDate: overrides.isRoutineDoneToday ? today : null,
          completedDates: nextDates
        };
      });
    }

    if (overrides.updatedLearningId) {
      allLearning = allLearning.map(l =>
        l.id === overrides.updatedLearningId
          ? {
              ...l,
              progress: overrides.updatedLearningProgress !== undefined ? overrides.updatedLearningProgress : l.progress
            }
          : l
      );
    }

    if (overrides.updatedSkillId) {
      allSkills = allSkills.map(s => {
        if (s.id !== overrides.updatedSkillId) return s;
        if (typeof overrides.updatedSkillLevelOrProgress === 'number') {
          return { ...s, progress: overrides.updatedSkillLevelOrProgress };
        }
        if (typeof overrides.updatedSkillLevelOrProgress === 'string') {
          const lvl = overrides.updatedSkillLevelOrProgress;
          return {
            ...s,
            level: lvl,
            progress: lvl.toLowerCase().includes('master') ? 100 : lvl.toLowerCase().includes('advance') ? 75 : lvl.toLowerCase().includes('inter') ? 50 : 25
          };
        }
        return s;
      });
    }

    if (overrides.updatedReminderId) {
      allReminders = allReminders.map(r =>
        r.id === overrides.updatedReminderId
          ? {
              ...r,
              status: overrides.updatedReminderDone ? 'done' : 'open'
            }
          : r
      );
    }

    if (overrides.updatedAppointmentId) {
      allAppointments = allAppointments.map(a =>
        a.id === overrides.updatedAppointmentId
          ? {
              ...a,
              status: overrides.updatedAppointmentStatus !== undefined ? overrides.updatedAppointmentStatus : a.status,
              completed: overrides.updatedAppointmentCompleted !== undefined ? overrides.updatedAppointmentCompleted : a.completed
            }
          : a
      );
    }

    if (overrides.updatedMeetingId) {
      allMeetings = allMeetings.map(m =>
        m.id === overrides.updatedMeetingId
          ? {
              ...m,
              status: overrides.updatedMeetingStatus !== undefined ? overrides.updatedMeetingStatus : m.status,
              completed: overrides.updatedMeetingCompleted !== undefined ? overrides.updatedMeetingCompleted : m.completed
            }
          : m
      );
    }
  }

  // Work with a mutable clone map of goals
  const goalMap = new Map<string, Goal>();
  allGoals.forEach(g => goalMap.set(g.id, { ...g }));

  const snapshot: GoalRelatedData = {
    goals: allGoals,
    tasks: allTasks,
    milestones: allMilestones,
    habits: allHabits,
    habitLogs: allHabitLogs,
    routines: allRoutines,
    learningItems: allLearning,
    skills: allSkills,
    notes: allNotes,
    journal: allJournal,
    savingsPlans: loadedSavingsPlans,
    loans: loadedLoans,
    investments: loadedInvestments,
    assets: loadedAssets,
    liabilities: loadedLiabilities,
    transactions: loadedTransactions,
    appointments: allAppointments,
    healthNotes: loadedHealthNotes,
    meetings: allMeetings,
    practices: loadedPractices,
    focusSessions: loadedFocus,
    reminders: allReminders
  };

  // Helper to recompute and persist a single goal based on goalMap and all linked stores
  const recomputeSingleGoal = (currentGoalId: string) =>
    computeAndPersistGoal(currentGoalId, goalMap, snapshot);

  // 1. Recalculate target goal
  const targetResult = await recomputeSingleGoal(goalId);
  if (!targetResult) return { updatedGoals: [] };

  const updatedGoalsList: Goal[] = [targetResult.goal];

  // 2. Recursively rollup up the hierarchy (Level 5 -> Level 4 -> Level 3 -> Level 2 -> Level 1)
  const allParentIds = new Set<string>();
  if (targetResult.goal.parentId) allParentIds.add(targetResult.goal.parentId);
  (targetResult.goal.parentIds || []).forEach(p => { if (p) allParentIds.add(p); });

  const visitedParents = new Set<string>([targetResult.goal.id]);
  const parentQueue = Array.from(allParentIds);
  while (parentQueue.length > 0) {
    const pId = parentQueue.shift()!;
    if (visitedParents.has(pId)) continue;
    visitedParents.add(pId);
    const parentResult = await recomputeSingleGoal(pId);
    if (!parentResult) continue;
    updatedGoalsList.push(parentResult.goal);
    if (parentResult.goal.parentId && !visitedParents.has(parentResult.goal.parentId)) {
      parentQueue.push(parentResult.goal.parentId);
    }
    (parentResult.goal.parentIds || []).forEach(p => {
      if (p && !visitedParents.has(p)) parentQueue.push(p);
    });
  }

  return {
    updatedGoals: updatedGoalsList,
    targetGoal: targetResult.goal,
    breakdown: targetResult.breakdown
  };
}

/**
 * Recalculate linked goal progress from tasks
 */
export async function syncGoalProgressFromTasks(
  goalId: string,
  updatedTaskId?: string,
  updatedTaskDone?: boolean,
  updatedTaskStatus?: 'open' | 'in-progress' | 'done'
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedTaskId,
    updatedTaskDone,
    updatedTaskStatus
  });
}

/**
 * Recalculate linked goal progress from milestones
 */
export async function syncGoalProgressFromMilestones(
  goalId: string,
  updatedMilestoneId?: string,
  updatedMilestoneProgress?: number,
  updatedMilestoneStatus?: string
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedMilestoneId,
    updatedMilestoneProgress,
    updatedMilestoneStatus
  });
}

/**
 * Recalculate linked goal progress from habits
 */
export async function syncGoalProgressFromHabits(
  goalId: string
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId);
}

/**
 * Recalculate linked goal progress from learning tracks
 */
export async function syncGoalProgressFromLearning(
  goalId: string,
  updatedItemId?: string,
  updatedProgress?: number
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedLearningId: updatedItemId,
    updatedLearningProgress: updatedProgress
  });
}

/**
 * Recalculate linked goal progress from skill trees
 */
export async function syncGoalProgressFromSkills(
  goalId: string,
  updatedSkillId?: string,
  updatedLevelOrProgress?: string | number
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedSkillId,
    updatedSkillLevelOrProgress: updatedLevelOrProgress
  });
}

/**
 * Recalculate linked goal progress from routine blocks
 */
export async function syncGoalProgressFromRoutines(
  goalId: string,
  updatedRoutineId?: string,
  isDoneToday?: boolean
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedRoutineId,
    isRoutineDoneToday: isDoneToday
  });
}

/**
 * Recalculate linked goal progress from Notebooks & Knowledge Vault notes
 */
export async function syncGoalProgressFromNotes(
  goalId: string
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId);
}

/**
 * Recalculate linked goal progress from Daily Journal & Philosophical Reflections
 */
export async function syncGoalProgressFromJournal(
  goalId: string
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId);
}

/**
 * Recalculate linked goal progress from Finance (Transactions, Loans, Investments, Savings Plans, Assets, Liabilities)
 */
export async function syncGoalProgressFromFinance(
  goalId: string
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId);
}

/**
 * Recalculate linked goal progress from retained Health Goal links (Appointments and Clinical Notes)
 */
export async function syncGoalProgressFromHealth(
  goalId: string
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId);
}

/**
 * Recalculate linked goal progress from Health Appointments
 */
export async function syncGoalProgressFromAppointments(
  goalId: string,
  updatedAppointmentId?: string,
  updatedAppointmentCompleted?: boolean,
  updatedAppointmentStatus?: 'scheduled' | 'completed' | 'cancelled'
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedAppointmentId,
    updatedAppointmentCompleted,
    updatedAppointmentStatus
  });
}

/**
 * Recalculate linked goal progress from Strategic Meetings
 */
export async function syncGoalProgressFromMeetings(
  goalId: string,
  updatedMeetingId?: string,
  updatedMeetingCompleted?: boolean,
  updatedMeetingStatus?: 'scheduled' | 'completed' | 'cancelled'
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedMeetingId,
    updatedMeetingCompleted,
    updatedMeetingStatus
  });
}

/**
 * Recalculate linked goal progress from Daily Practices
 */
export async function syncGoalProgressFromPractices(
  goalId: string
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId);
}

/**
 * Recalculate linked goal progress from Deep Work Focus Sessions
 */
export async function syncGoalProgressFromFocus(
  goalId: string
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId);
}

/**
 * Recalculate linked goal progress from Reminders
 */
export async function syncGoalProgressFromReminders(
  goalId: string,
  updatedReminderId?: string,
  updatedReminderDone?: boolean
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedReminderId,
    updatedReminderDone
  });
}

/**
 * Directly adjust or set a goal's manual progress (0-100) when it has no auto-linked items,
 * and roll up the 5-Tier Hierarchy.
 */
export async function syncGoalProgressDirect(
  goalId: string,
  progress: number
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal }> {
  if (!goalId) return { updatedGoals: [] };

  const allGoals = await storage.getAll<Goal>('goals');
  const targetGoal = allGoals.find(g => g.id === goalId);
  if (!targetGoal) return { updatedGoals: [] };

  const clampedProgress = Math.max(0, Math.min(100, Math.round(progress)));

  const goalMap = new Map<string, Goal>();
  allGoals.forEach(g => goalMap.set(g.id, { ...g }));

  const updatedTarget: Goal = {
    ...targetGoal,
    manualProgress: clampedProgress,
    progress: clampedProgress,
    status: clampedProgress >= 100 ? 'completed' : targetGoal.status === 'paused' ? 'paused' : 'active',
    updatedAt: Date.now()
  };
  goalMap.set(targetGoal.id, updatedTarget);
  await storage.put('goals', updatedTarget);

  const updatedGoalsList: Goal[] = [updatedTarget];

  // Rollup hierarchy. A goal can contribute to several parents (parentIds), so walk every
  // parent chain instead of only the primary parentId.
  const pendingParentIds: string[] = [];
  const enqueueParents = (goal: Goal) => {
    if (goal.parentId) pendingParentIds.push(goal.parentId);
    (goal.parentIds || []).forEach(id => { if (id) pendingParentIds.push(id); });
  };
  enqueueParents(targetGoal);

  const visited = new Set<string>([targetGoal.id]);
  while (pendingParentIds.length > 0) {
    const parentId = pendingParentIds.shift();
    if (!parentId || visited.has(parentId)) continue;
    visited.add(parentId);
    if (!goalMap.has(parentId)) continue;

    const res = await recalculateGoalAggregateProgress(parentId);
    if (res.targetGoal) {
      updatedGoalsList.push(res.targetGoal);
      goalMap.set(res.targetGoal.id, res.targetGoal);
      enqueueParents(res.targetGoal);
    }
  }

  return { updatedGoals: updatedGoalsList, targetGoal: updatedTarget };
}

/**
 * RECALCULATE ALL GOALS IN SYSTEM (Bottom-Up Order: Level 5 -> Level 4 -> Level 3 -> Level 2 -> Level 1)
 * Used on initial app mount or after bulk imports to ensure 100% accurate aggregate reflection.
 */
export async function recalculateAllGoalsProgress(): Promise<Goal[]> {
  // One shared snapshot for every goal: previously each goal re-read all 22 stores.
  const data = await loadGoalRecalcData();
  const allGoals = data.goals;
  if (allGoals.length === 0) return [];

  // Derive depth from the parent chain rather than the stored `level`, which can drift when a
  // goal is re-parented. Deepest goals must be recalculated first so parents see fresh children.
  const byId = new Map(allGoals.map(g => [g.id, g]));
  const depthOf = (goal: Goal): number => {
    let depth = 1;
    let currentParentId = goal.parentId;
    const seen = new Set<string>([goal.id]);
    while (currentParentId && !seen.has(currentParentId)) {
      const parent = byId.get(currentParentId);
      if (!parent) break;
      seen.add(currentParentId);
      depth++;
      currentParentId = parent.parentId;
    }
    return depth;
  };

  const orderedDeepestFirst = [...allGoals].sort((a, b) => depthOf(b) - depthOf(a));
  const goalMap = new Map<string, Goal>(allGoals.map(g => [g.id, { ...g }]));

  for (const g of orderedDeepestFirst) {
    await computeAndPersistGoal(g.id, goalMap, data);
  }

  return storage.getAll<Goal>('goals');
}
