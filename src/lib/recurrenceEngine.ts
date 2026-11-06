/**
 * recurrenceEngine.ts - Recurring task engine for Om-LifeOS
 */

import { Task, RecurrenceConfig } from '../types';
import { generateUUID } from './storage';

export function calculateNextOccurrence(currentDate: string, config: RecurrenceConfig): string | null {
  if (!isValidRecurrenceConfig(config)) return null;
  const date = parseCalendarDate(currentDate);
  if (!date) return null;
  const currentDateOnly = date.toISOString().slice(0, 10);
  if (shouldEndRecurrence(config, currentDateOnly)) return null;

  let nextDate = new Date(date);
  switch (config.frequency) {
    case 'daily':
      nextDate.setUTCDate(nextDate.getUTCDate() + config.interval);
      break;
    case 'weekly':
      nextDate = config.weekDays?.length
        ? getNextWeekDay(nextDate, config.weekDays, config.interval)
        : new Date(nextDate.getTime() + config.interval * 7 * 86400000);
      break;
    case 'monthly':
      nextDate = addCalendarMonths(nextDate, config.interval, config.monthDay || nextDate.getUTCDate());
      break;
    case 'yearly':
      nextDate = addCalendarYears(nextDate, config.interval);
      break;
    default:
      return null;
  }
  const nextDateOnly = nextDate.toISOString().slice(0, 10);
  if (config.endType === 'by_date' && config.endByDate && nextDateOnly > config.endByDate) return null;
  return nextDateOnly;
}

function parseCalendarDate(value: string): Date | null {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly.map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
      ? parsed
      : null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? null
    : new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function shouldEndRecurrence(config: RecurrenceConfig, currentDate: string): boolean {
  if (config.endType === 'never') return false;
  if (config.endType === 'after' && config.endAfterOccurrences) {
    return (config.occurrenceCount || 0) >= config.endAfterOccurrences;
  }
  return config.endType === 'by_date' && Boolean(config.endByDate) && currentDate >= config.endByDate!;
}

function getNextWeekDay(fromDate: Date, weekDays: number[], intervalWeeks: number): Date {
  const selectedDays = new Set(weekDays);
  const mondayOffset = (fromDate.getUTCDay() + 6) % 7;
  const weekStart = Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate() - mondayOffset);
  for (let offset = 1; offset <= intervalWeeks * 7 + 7; offset++) {
    const candidate = new Date(fromDate.getTime() + offset * 86400000);
    const weekIndex = Math.floor((candidate.getTime() - weekStart) / (7 * 86400000));
    if (weekIndex % intervalWeeks === 0 && selectedDays.has(candidate.getUTCDay())) return candidate;
  }
  return new Date(fromDate.getTime() + intervalWeeks * 7 * 86400000);
}

function addCalendarMonths(date: Date, months: number, targetDay: number): Date {
  const monthIndex = date.getUTCMonth() + months;
  const targetYear = date.getUTCFullYear() + Math.floor(monthIndex / 12);
  const targetMonth = monthIndex % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(targetDay, lastDay)));
}

function addCalendarYears(date: Date, years: number): Date {
  const targetYear = date.getUTCFullYear() + years;
  const targetMonth = date.getUTCMonth();
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(date.getUTCDate(), lastDay)));
}

export function generateNextRecurringTask(parentTask: Task): Task | null {
  if (!parentTask.recurringConfig) return null;
  const config = parentTask.recurringConfig;
  const baseDate = config.lastGeneratedDate || parentTask.date || parentTask.dueAt || new Date().toISOString().split('T')[0];
  const nextDate = calculateNextOccurrence(baseDate, config);
  if (!nextDate) return null;
  return {
    ...parentTask,
    id: generateUUID(),
    date: nextDate,
    dueAt: nextDate,
    done: false,
    status: 'open',
    isRecurringChild: true,
    recurringParentId: parentTask.id,
    recurringConfig: undefined,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export function updateRecurrenceTracking(parentTask: Task, generatedDate: string): RecurrenceConfig | undefined {
  if (!parentTask.recurringConfig) return undefined;
  return {
    ...parentTask.recurringConfig,
    lastGeneratedDate: generatedDate,
    occurrenceCount: (parentTask.recurringConfig.occurrenceCount || 0) + 1
  };
}

export function getRecurrenceDescription(config: RecurrenceConfig): string {
  const { frequency, interval, endType, endAfterOccurrences, endByDate, weekDays } = config;
  let desc = '';
  if (interval === 1) {
    desc = frequency.charAt(0).toUpperCase() + frequency.slice(1);
  } else {
    const unit = frequency === 'daily' ? 'days' : frequency === 'weekly' ? 'weeks' : frequency === 'monthly' ? 'months' : 'years';
    desc = `Every ${interval} ${unit}`;
  }
  if (frequency === 'weekly' && weekDays && weekDays.length > 0) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    desc += ` on ${weekDays.map(d => dayNames[d]).join(', ')}`;
  }
  if (endType === 'after' && endAfterOccurrences) {
    desc += `, ${endAfterOccurrences} times`;
  } else if (endType === 'by_date' && endByDate) {
    desc += ', until ' + new Date(endByDate + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }
  return desc;
}

export function isRecurringParent(task: Task): boolean {
  return !!(task.recurringConfig && !task.isRecurringChild);
}

export function isRecurringChild(task: Task): boolean {
  return task.isRecurringChild === true;
}

export function getUpcomingOccurrences(task: Task, count: number = 5): string[] {
  if (!task.recurringConfig) return [];
  const dates: string[] = [];
  let currentDate = task.date || task.dueAt || new Date().toISOString().split('T')[0];
  let config = { ...task.recurringConfig };
  for (let i = 0; i < count; i++) {
    const nextDate = calculateNextOccurrence(currentDate, config);
    if (!nextDate) break;
    dates.push(nextDate);
    currentDate = nextDate;
    config.occurrenceCount = (config.occurrenceCount || 0) + 1;
  }
  return dates;
}

export function createDefaultRecurrenceConfig(): RecurrenceConfig {
  return { frequency: 'daily', interval: 1, endType: 'never', occurrenceCount: 0 };
}

export function isValidRecurrenceConfig(config: RecurrenceConfig): boolean {
  if (!Number.isInteger(config.interval) || config.interval < 1) return false;
  if (!['daily', 'weekly', 'monthly', 'yearly'].includes(config.frequency)) return false;
  if (!['never', 'after', 'by_date'].includes(config.endType)) return false;
  if (config.endType === 'after' && (!Number.isInteger(config.endAfterOccurrences) || !config.endAfterOccurrences || config.endAfterOccurrences < 1)) return false;
  if (config.endType === 'by_date' && (!config.endByDate || !/^\d{4}-\d{2}-\d{2}$/.test(config.endByDate) || !parseCalendarDate(config.endByDate))) return false;
  if (config.frequency === 'weekly' && config.weekDays && (!config.weekDays.length || config.weekDays.some(day => !Number.isInteger(day) || day < 0 || day > 6))) return false;
  if (config.monthDay !== undefined && (!Number.isInteger(config.monthDay) || config.monthDay < 1 || config.monthDay > 31)) return false;
  return true;
}
