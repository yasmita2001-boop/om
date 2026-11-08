import type {
  Goal,
  Habit,
  HabitLog,
  HealthAppointment,
  LearningItem,
  Loan,
  Meeting,
  Milestone,
  ReminderItem,
  Routine,
  SavingsPlan,
  Skill,
  Task,
  Investment
} from '../types';
import { getLocalDateString } from './dateUtils';
import { getTaskPeriodProgress, type TaskPeriodGranularity } from './taskPeriodProgress';

export interface GoalPeriodProgressInput {
  goal: Goal;
  childGoals: Goal[];
  allGoals?: Goal[];
  tasks: Task[];
  allTasks: Task[];
  milestones: Milestone[];
  learningItems: LearningItem[];
  skills: Skill[];
  routines: Routine[];
  habits: Habit[];
  habitLogs: HabitLog[];
  appointments: HealthAppointment[];
  meetings: Meeting[];
  savingsPlans: SavingsPlan[];
  loans: Loan[];
  investments: Investment[];
  reminders: ReminderItem[];
}

export interface GoalPeriodProgress {
  total: number;
  completed: number;
}

function clampProgress(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function dateFromTimestamp(timestamp?: number): string | undefined {
  return timestamp && Number.isFinite(timestamp)
    ? getLocalDateString(new Date(timestamp))
    : undefined;
}

function itemDates(
  updatedAt: number | undefined,
  targetDate: string | undefined,
  createdAt: number | undefined
): string[] {
  const scheduledDate = targetDate?.slice(0, 10);
  if (scheduledDate) return [scheduledDate];
  return [dateFromTimestamp(updatedAt), dateFromTimestamp(createdAt)]
    .filter((date): date is string => Boolean(date));
}

function addProgressItem(
  result: GoalPeriodProgress,
  dates: string | (string | undefined)[] | undefined,
  progress: number,
  periodStart: string,
  periodEnd: string
): void {
  const dateCandidates = (Array.isArray(dates) ? dates : [dates])
    .filter((date): date is string => Boolean(date))
    .map(date => date.slice(0, 10));
  if (!dateCandidates.some(date => date >= periodStart && date <= periodEnd)) return;
  result.total += 1;
  result.completed += clampProgress(progress) / 100;
}

function getScheduledDates(
  frequencyValue: string,
  start: string,
  end: string,
  anchorDate = start
): string[] {
  if (!start || !end || start > end) return [];
  const frequency = frequencyValue.toLowerCase();
  const weekdays = new Set(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']);
  const anchor = new Date(`${anchorDate}T00:00:00`);
  const dates: string[] = [];

  for (let current = new Date(`${start}T00:00:00`);
    getLocalDateString(current) <= end;
    current.setDate(current.getDate() + 1)) {
    const currentDate = getLocalDateString(current);
    const day = current.getDay();
    const matches =
      frequency === 'daily' ||
      (frequency === 'weekdays' && day >= 1 && day <= 5) ||
      (weekdays.has(frequency) && day === ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(frequency)) ||
      (frequency === 'weekly' && day === anchor.getDay()) ||
      (frequency === 'monthly' && current.getDate() === Math.min(anchor.getDate(), new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate()));
    if (matches) dates.push(currentDate);
  }
  return dates;
}

function addRoutineProgress(
  result: GoalPeriodProgress,
  routine: Routine,
  periodStart: string,
  periodEnd: string,
  goalEndDate: string | undefined,
  completedDates: string[]
): void {
  const start = dateFromTimestamp(routine.createdAt) || periodStart;
  const scheduledEnd = goalEndDate && goalEndDate < periodEnd ? goalEndDate : periodEnd;
  const inactiveDate = !routine.active ? dateFromTimestamp(routine.updatedAt) : undefined;
  const end = inactiveDate && inactiveDate < scheduledEnd ? inactiveDate : scheduledEnd;
  const scheduleStart = start < periodStart ? periodStart : start;
  const dates = getScheduledDates(routine.frequency || 'daily', scheduleStart, end, start);
  const completed = new Set(completedDates);
  for (const date of dates) {
    result.total += 1;
    if (completed.has(date)) result.completed += 1;
  }
}

function addHabitProgress(
  result: GoalPeriodProgress,
  habit: Habit,
  habitLogs: HabitLog[],
  periodStart: string,
  periodEnd: string,
  goalEndDate: string | undefined
): void {
  const start = dateFromTimestamp(habit.createdAt) || periodStart;
  const end = goalEndDate && goalEndDate < periodEnd ? goalEndDate : periodEnd;
  const scheduleStart = start < periodStart ? periodStart : start;
  const dates = getScheduledDates(habit.frequency || 'daily', scheduleStart, end, start);
  const occurrencesPerDay = Math.max(1, Math.floor(Number(habit.timesPerDay) || 1));
  const logsByDate = new Map<string, Set<number | 'all'>>();
  for (const log of habitLogs) {
    if (log.habitId !== habit.id || log.date < scheduleStart || log.date > end) continue;
    const occurrences = logsByDate.get(log.date) || new Set<number | 'all'>();
    occurrences.add(log.occurrence);
    logsByDate.set(log.date, occurrences);
  }
  for (const date of dates) {
    const dayLogs = logsByDate.get(date) || new Set<number | 'all'>();
    const completed = dayLogs.has('all') || (habit.doneDate === date && dayLogs.size === 0)
      ? occurrencesPerDay
      : Math.min(occurrencesPerDay, dayLogs.size);
    result.total += occurrencesPerDay;
    result.completed += completed;
  }
}

export function getGoalPeriodProgress(
  input: GoalPeriodProgressInput,
  periodStart: string,
  periodEnd: string,
  granularity: TaskPeriodGranularity
): GoalPeriodProgress {
  const result = { total: 0, completed: 0 };
  const goalEndDate = input.goal.targetDate?.slice(0, 10);

  const taskProgress = getTaskPeriodProgress(
    input.tasks,
    input.allTasks,
    periodStart,
    periodEnd,
    granularity,
    goalEndDate
  );
  result.total += taskProgress.total;
  result.completed += taskProgress.completed;

  for (const child of input.childGoals) {
    addProgressItem(
      result,
      itemDates(child.updatedAt, child.targetDate || child.date, child.createdAt),
      child.progress,
      periodStart,
      periodEnd
    );
  }
  for (const milestone of input.milestones) {
    addProgressItem(
      result,
      milestone.dueDate || dateFromTimestamp(milestone.updatedAt),
      milestone.status === 'completed' ? 100 : milestone.progress,
      periodStart,
      periodEnd
    );
  }
  for (const item of input.learningItems) {
    addProgressItem(
      result,
      itemDates(item.updatedAt, item.targetDate, item.createdAt),
      item.progress,
      periodStart,
      periodEnd
    );
  }
  for (const skill of input.skills) {
    const levelProgress = skill.progress ?? (
      /master|expert/i.test(skill.level || '') ? 100 :
      /advance/i.test(skill.level || '') ? 75 :
      /inter/i.test(skill.level || '') ? 50 : 25
    );
    addProgressItem(
      result,
      itemDates(skill.updatedAt, skill.targetDate, skill.createdAt),
      levelProgress,
      periodStart,
      periodEnd
    );
  }
  for (const routine of input.routines) {
    const completedDates = Array.from(new Set([
      ...(routine.completedDates || []),
      ...(routine.completedDate ? [routine.completedDate] : [])
    ]));
    addRoutineProgress(result, routine, periodStart, periodEnd, goalEndDate, completedDates);
  }
  for (const habit of input.habits) {
    addHabitProgress(result, habit, input.habitLogs, periodStart, periodEnd, goalEndDate);
  }
  for (const appointment of input.appointments) {
    if (appointment.status === 'cancelled') continue;
    addProgressItem(
      result,
      appointment.date,
      appointment.completed || appointment.status === 'completed' ? 100 : 0,
      periodStart,
      periodEnd
    );
  }
  for (const meeting of input.meetings) {
    if (meeting.status === 'cancelled') continue;
    addProgressItem(
      result,
      meeting.date,
      meeting.completed || meeting.status === 'completed' ? 100 : 0,
      periodStart,
      periodEnd
    );
  }
  for (const plan of input.savingsPlans) {
    const target = Number(plan.targetAmount) || 0;
    const progress = target > 0 ? (Number(plan.currentAmount) || 0) / target * 100 : 0;
    addProgressItem(
      result,
      itemDates(plan.updatedAt, plan.maturityDate, plan.createdAt),
      progress,
      periodStart,
      periodEnd
    );
  }
  for (const loan of input.loans) {
    const principal = Number(loan.principal) || 0;
    const progress = principal > 0 ? (principal - (Number(loan.outstanding) || 0)) / principal * 100 : 0;
    addProgressItem(
      result,
      itemDates(loan.updatedAt, loan.maturityDate, loan.createdAt),
      loan.status === 'closed' ? 100 : progress,
      periodStart,
      periodEnd
    );
  }
  for (const investment of input.investments) {
    const principal = Number(investment.amount) || 0;
    const progress = principal > 0 ? (Number(investment.currentValue) || 0) / principal * 100 : 0;
    addProgressItem(
      result,
      itemDates(investment.updatedAt, investment.date, investment.createdAt),
      progress,
      periodStart,
      periodEnd
    );
  }
  for (const reminder of input.reminders) {
    addProgressItem(
      result,
      reminder.dueAt,
      reminder.status === 'done' ? 100 : 0,
      periodStart,
      periodEnd
    );
  }

  return result;
}

export function getGoalHierarchyPeriodProgress(
  input: GoalPeriodProgressInput,
  periodStart: string,
  periodEnd: string,
  granularity: TaskPeriodGranularity
): GoalPeriodProgress {
  if (!input.allGoals) {
    return getGoalPeriodProgress(input, periodStart, periodEnd, granularity);
  }

  const goalById = new Map(input.allGoals.map(goal => [goal.id, goal]));
  goalById.set(input.goal.id, input.goal);
  const childrenByParentId = new Map<string, Goal[]>();
  for (const goal of input.allGoals) {
    const parentIds = new Set([goal.parentId, ...(goal.parentIds || [])].filter((id): id is string => Boolean(id)));
    for (const parentId of parentIds) {
      const children = childrenByParentId.get(parentId) || [];
      children.push(goal);
      childrenByParentId.set(parentId, children);
    }
  }

  const taskGoalId = (task: Task): string | undefined =>
    task.goalId ||
    (task.routineId ? input.routines.find(item => item.id === task.routineId)?.goalId || undefined : undefined) ||
    (task.skillId ? input.skills.find(item => item.id === task.skillId)?.goalId || undefined : undefined) ||
    (task.learningId ? input.learningItems.find(item => item.id === task.learningId)?.goalId || undefined : undefined);
  const habitGoalId = (habit: Habit): string | undefined =>
    habit.goalId ||
    ([habit.routineId, habit.linkedRoutineId].find(Boolean)
      ? input.routines.find(item => item.id === (habit.routineId || habit.linkedRoutineId))?.goalId || undefined
      : undefined);

  const hasLinkedItems = (goalId: string): boolean =>
    input.tasks.some(item => taskGoalId(item) === goalId) ||
    input.milestones.some(item => item.goalId === goalId) ||
    input.learningItems.some(item => item.goalId === goalId) ||
    input.skills.some(item => item.goalId === goalId) ||
    input.routines.some(item => item.goalId === goalId) ||
    input.habits.some(item => habitGoalId(item) === goalId) ||
    input.appointments.some(item => item.goalId === goalId) ||
    input.meetings.some(item => item.goalId === goalId) ||
    input.savingsPlans.some(item => item.goalId === goalId) ||
    input.loans.some(item => item.goalId === goalId) ||
    input.investments.some(item => item.goalId === goalId) ||
    input.reminders.some(item => item.linkedType === 'goal' && item.linkedId === goalId);

  const aggregate = (goal: Goal, visited: Set<string>): GoalPeriodProgress => {
    if (visited.has(goal.id)) return { total: 0, completed: 0 };
    visited.add(goal.id);
    const directInput: GoalPeriodProgressInput = {
      ...input,
      goal,
      childGoals: [],
      tasks: input.tasks.filter(item => taskGoalId(item) === goal.id),
      milestones: input.milestones.filter(item => item.goalId === goal.id),
      learningItems: input.learningItems.filter(item => item.goalId === goal.id),
      skills: input.skills.filter(item => item.goalId === goal.id),
      routines: input.routines.filter(item => item.goalId === goal.id),
      habits: input.habits.filter(item => habitGoalId(item) === goal.id),
      appointments: input.appointments.filter(item => item.goalId === goal.id),
      meetings: input.meetings.filter(item => item.goalId === goal.id),
      savingsPlans: input.savingsPlans.filter(item => item.goalId === goal.id),
      loans: input.loans.filter(item => item.goalId === goal.id),
      investments: input.investments.filter(item => item.goalId === goal.id),
      reminders: input.reminders.filter(item => item.linkedType === 'goal' && item.linkedId === goal.id)
    };
    const goalStart = goal.date?.slice(0, 10) ||
      (goal.createdAt ? dateFromTimestamp(goal.createdAt) : undefined);
    const goalEnd = goal.targetDate?.slice(0, 10);
    const effectiveStart = goalStart && goalStart > periodStart ? goalStart : periodStart;
    const effectiveEnd = goalEnd && goalEnd < periodEnd ? goalEnd : periodEnd;
    const result = effectiveStart <= effectiveEnd
      ? getGoalPeriodProgress(directInput, effectiveStart, effectiveEnd, granularity)
      : { total: 0, completed: 0 };

    for (const child of childrenByParentId.get(goal.id) || []) {
      const childProgress = aggregate(child, visited);
      result.total += childProgress.total;
      result.completed += childProgress.completed;
    }

    const subtreeHasLinkedItems = (candidate: Goal, seen: Set<string>): boolean => {
      if (seen.has(candidate.id)) return false;
      if (hasLinkedItems(candidate.id)) return true;
      const nextSeen = new Set(seen).add(candidate.id);
      return (childrenByParentId.get(candidate.id) || []).some(child => subtreeHasLinkedItems(child, nextSeen));
    };
    if (result.total === 0 && !subtreeHasLinkedItems(goal, new Set())) {
      addProgressItem(
        result,
        itemDates(goal.updatedAt, goal.targetDate || goal.date, goal.createdAt),
        goal.progress,
        periodStart,
        periodEnd
      );
    }

    return result;
  };

  return aggregate(input.goal, new Set());
}
