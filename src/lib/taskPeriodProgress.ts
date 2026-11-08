import type { Goal, RecurrenceConfig, Task } from '../types';
import { calculateNextOccurrence, isValidRecurrenceConfig } from './recurrenceEngine';
import { getLocalDateString } from './dateUtils';

export type TaskPeriodGranularity = 'single_day' | 'daily' | 'monthly' | 'yearly' | 'lifecycle';

export interface TaskPeriodProgress {
  total: number;
  completed: number;
}

function getTaskDate(task: Task): string | undefined {
  const date = task.dueAt || task.date;
  return date ? date.slice(0, 10) : undefined;
}

function getSeriesRoot(task: Task, taskById: Map<string, Task>): Task {
  let current = task;
  const visited = new Set<string>();
  while (current.recurringParentId && !visited.has(current.id)) {
    visited.add(current.id);
    const parent = taskById.get(current.recurringParentId);
    if (!parent) break;
    current = parent;
  }
  return current;
}

export function hasFullYearGoalHorizon(goals: Goal[], tasks: Task[], selectedGoalId = 'all'): boolean {
  const scopedGoals = selectedGoalId === 'all'
    ? goals
    : goals.filter(goal => goal.id === selectedGoalId);
  const taskByGoal = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.goalId) continue;
    const linked = taskByGoal.get(task.goalId) || [];
    linked.push(task);
    taskByGoal.set(task.goalId, linked);
  }

  return scopedGoals.some(goal => {
    const linkedTasks = taskByGoal.get(goal.id) || [];
    const starts = [
      goal.date?.slice(0, 10),
      goal.createdAt ? new Date(goal.createdAt).toISOString().slice(0, 10) : undefined,
      ...linkedTasks.map(getTaskDate)
    ].filter((date): date is string => Boolean(date)).sort();
    const ends = (goal.targetDate
      ? [goal.targetDate.slice(0, 10)]
      : [
          ...linkedTasks.map(task => task.recurringConfig?.endByDate),
          ...linkedTasks.map(getTaskDate)
        ]
    ).filter((date): date is string => Boolean(date)).sort();
    if (starts.length === 0 || ends.length === 0) return true;

    const start = new Date(`${starts[0]}T00:00:00`);
    const end = new Date(`${ends[ends.length - 1]}T00:00:00`);
    return end.getTime() - start.getTime() >= 365 * 86_400_000;
  });
}

function getExpectedDates(
  root: Task,
  config: RecurrenceConfig,
  periodStart: string,
  periodEnd: string,
  scheduleEndDate?: string
): string[] {
  const start = getTaskDate(root);
  const end = scheduleEndDate && scheduleEndDate < periodEnd ? scheduleEndDate : periodEnd;
  if (!start || !isValidRecurrenceConfig(config) || start > end) return [];
  const dates: string[] = [];
  const scheduleConfig = { ...config, occurrenceCount: 1, lastGeneratedDate: undefined };
  let current = start;

  if (current >= periodStart && current <= end) dates.push(current);
  for (let count = 0; count < 100_000; count++) {
    const next = calculateNextOccurrence(current, scheduleConfig);
    if (!next || next > end) break;
    if (scheduleConfig.endType === 'after') {
      scheduleConfig.occurrenceCount = (scheduleConfig.occurrenceCount || 0) + 1;
    }
    if (next >= periodStart) dates.push(next);
    current = next;
  }
  return dates;
}

export function getTaskPeriodProgress(
  periodTasks: Task[],
  allTasks: Task[],
  periodStart: string,
  periodEnd: string,
  granularity: TaskPeriodGranularity,
  scheduleEndDate?: string
): TaskPeriodProgress {
  const taskById = new Map(allTasks.map(task => [task.id, task]));
  const includedRootIds = new Set(periodTasks.map(task => getSeriesRoot(task, taskById).id));
  const relevantTasks = allTasks.filter(task => includedRootIds.has(getSeriesRoot(task, taskById).id));
  const seriesByRootId = new Map<string, { root: Task; tasks: Task[] }>();
  for (const task of relevantTasks) {
    const root = getSeriesRoot(task, taskById);
    const series = seriesByRootId.get(root.id) || { root, tasks: [] };
    series.tasks.push(task);
    seriesByRootId.set(root.id, series);
  }

  let total = 0;
  let completed = 0;
  for (const { root, tasks: seriesTasks } of seriesByRootId.values()) {
    const recurrence = root.recurringConfig || seriesTasks.find(task => task.recurringConfig)?.recurringConfig;
    if (!recurrence) {
      for (const task of seriesTasks) {
        const date = getTaskDate(task) || (
          granularity === 'lifecycle' && task.createdAt
            ? getLocalDateString(new Date(task.createdAt))
            : undefined
        );
        if (!date || date < periodStart || date > periodEnd) continue;
        total++;
        if (task.done || task.status === 'done') completed++;
        else if (task.status === 'in-progress') completed += 0.5;
      }
      continue;
    }

    const expectedDates = recurrence.endType === 'never' && granularity === 'lifecycle' && !scheduleEndDate
      ? Array.from(new Set(seriesTasks.map(getTaskDate).filter((date): date is string =>
          Boolean(date && date >= periodStart && date <= periodEnd)
        ))).sort()
      : getExpectedDates(root, recurrence, periodStart, periodEnd, scheduleEndDate);
    if (expectedDates.length === 0) continue;
    const occurrenceCount = expectedDates.length;
    total += occurrenceCount;

    const tasksByDate = new Map<string, Task[]>();
    for (const task of seriesTasks) {
      const date = getTaskDate(task);
      if (!date || date < periodStart || date > periodEnd) continue;
      const sameDayTasks = tasksByDate.get(date) || [];
      sameDayTasks.push(task);
      tasksByDate.set(date, sameDayTasks);
    }
    for (const date of expectedDates) {
      const occurrenceTasks = tasksByDate.get(date) || [];
      if (occurrenceTasks.some(task => task.done || task.status === 'done')) completed++;
      else if (occurrenceTasks.some(task => task.status === 'in-progress')) completed += 0.5;
    }
  }

  return { total, completed };
}
