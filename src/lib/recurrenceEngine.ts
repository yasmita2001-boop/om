/**
 * recurrenceEngine.ts - Recurring task engine for Om-LifeOS
 */

import { Task, RecurrenceConfig } from '../types';
import { generateUUID } from './storage';

export function calculateNextOccurrence(currentDate: string, config: RecurrenceConfig): string | null {
  const date = new Date(currentDate);
  if (shouldEndRecurrence(config, date)) return null;
  
  let nextDate = new Date(date);
  
  switch (config.frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + config.interval);
      break;
    case 'weekly':
      if (config.weekDays && config.weekDays.length > 0) {
        nextDate = getNextWeekDay(nextDate, config.weekDays, config.interval);
      } else {
        nextDate.setDate(nextDate.getDate() + (7 * config.interval));
      }
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + config.interval);
      if (config.monthDay) {
        nextDate.setDate(Math.min(config.monthDay, getLastDayOfMonth(nextDate)));
      }
      break;
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + config.interval);
      break;
    default:
      return null;
  }
  
  return nextDate.toISOString().split('T')[0];
}

function shouldEndRecurrence(config: RecurrenceConfig, currentDate: Date): boolean {
  if (config.endType === 'never') return false;
  if (config.endType === 'after' && config.endAfterOccurrences) {
    return (config.occurrenceCount || 0) >= config.endAfterOccurrences;
  }
  if (config.endType === 'by_date' && config.endByDate) {
    return currentDate >= new Date(config.endByDate);
  }
  return false;
}

function getNextWeekDay(fromDate: Date, weekDays: number[], intervalWeeks: number): Date {
  const result = new Date(fromDate);
  result.setDate(result.getDate() + 1);
  const sortedDays = [...weekDays].sort((a, b) => a - b);
  const currentDay = result.getDay();
  const nextDayInWeek = sortedDays.find(day => day > currentDay);
  if (nextDayInWeek !== undefined) {
    result.setDate(result.getDate() + (nextDayInWeek - currentDay));
  } else {
    const daysToAdd = (7 - currentDay) + sortedDays[0] + (7 * (intervalWeeks - 1));
    result.setDate(result.getDate() + daysToAdd);
  }
  return result;
}

function getLastDayOfMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
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
    desc += `, until ${new Date(endByDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
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
  if (config.interval < 1) return false;
  if (config.endType === 'after' && (!config.endAfterOccurrences || config.endAfterOccurrences < 1)) return false;
  if (config.endType === 'by_date' && !config.endByDate) return false;
  if (config.frequency === 'weekly' && config.weekDays && config.weekDays.length === 0) return false;
  return true;
}
