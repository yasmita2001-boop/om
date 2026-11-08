import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTaskCompletionEffects, calculateNextOccurrence } from '../recurrenceEngine';
import type { RecurrenceConfig, Task } from '../../types';

const recurrenceStorageMock = vi.hoisted(() => {
  const records: Record<string, Array<{
    id: string;
    dueAt?: string;
    recurringParentId?: string;
    done?: boolean;
    status?: string;
  }>> = {
    tasks: [],
    reminders: []
  };
  return {
    records,
    getAll: vi.fn(async (store: string) => records[store] || []),
    put: vi.fn(async (store: string, item: {
      id: string;
      dueAt?: string;
      recurringParentId?: string;
      done?: boolean;
      status?: string;
    }) => {
      const items = records[store] || (records[store] = []);
      const index = items.findIndex(record => record.id === item.id);
      if (index >= 0) items[index] = item;
      else items.push(item);
      return item;
    })
  };
});

vi.mock('../storage', () => ({
  storage: recurrenceStorageMock,
  generateUUID: vi.fn(() => 'generated-checklist-id')
}));

const config = (overrides: Partial<RecurrenceConfig> = {}): RecurrenceConfig => ({
  frequency: 'daily',
  interval: 1,
  endType: 'never',
  ...overrides,
});

const recurringTask = (): Task => ({
  id: 'task-parent',
  title: 'Daily practice',
  domain: 'work',
  priority: 'Medium',
  dueAt: '2026-11-09',
  date: '2026-11-09',
  done: false,
  status: 'open',
  recurringConfig: config(),
  createdAt: 1,
  updatedAt: 1
});

beforeEach(() => {
  recurrenceStorageMock.records.tasks.length = 0;
  recurrenceStorageMock.records.reminders.length = 0;
  recurrenceStorageMock.getAll.mockClear();
  recurrenceStorageMock.put.mockClear();
});

describe('calculateNextOccurrence', () => {
  it('includes a selected weekday that falls on the next day and respects weekly intervals afterward', () => {
    const everyOtherTuesday = config({ frequency: 'weekly', interval: 2, weekDays: [2] });
    expect(calculateNextOccurrence('2026-03-02', everyOtherTuesday)).toBe('2026-03-03');
    expect(calculateNextOccurrence('2026-03-03', everyOtherTuesday)).toBe('2026-03-17');
  });

  it('clamps a monthly recurrence to the last day of shorter months', () => {
    expect(calculateNextOccurrence('2026-01-31', config({ frequency: 'monthly' }))).toBe('2026-02-28');
  });

  it('clamps leap-day yearly recurrences in non-leap years', () => {
    expect(calculateNextOccurrence('2024-02-29', config({ frequency: 'yearly' }))).toBe('2025-02-28');
  });

  it('does not generate an occurrence beyond the configured end date', () => {
    expect(calculateNextOccurrence('2026-10-25', config({
      frequency: 'weekly',
      interval: 1,
      weekDays: [0],
      endType: 'by_date',
      endByDate: '2026-10-31',
    }))).toBeNull();
  });

  it('rejects invalid calendar dates instead of throwing', () => {
    expect(calculateNextOccurrence('2026-02-30', config())).toBeNull();
  });
});

describe('applyTaskCompletionEffects', () => {
  it('creates only one occurrence when the same task is completed concurrently', async () => {
    const parent = recurringTask();
    recurrenceStorageMock.records.tasks.push(parent);

    await Promise.all([
      applyTaskCompletionEffects(parent, true),
      applyTaskCompletionEffects(parent, true)
    ]);

    const occurrences = recurrenceStorageMock.records.tasks.filter(task => task.recurringParentId === parent.id);
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].dueAt).toBe('2026-11-10');
  });

  it('does not recreate an occurrence for the same date after it has been completed', async () => {
    const parent = recurringTask();
    recurrenceStorageMock.records.tasks.push(parent);

    const firstOccurrence = await applyTaskCompletionEffects(parent, true);
    expect(firstOccurrence).not.toBeNull();
    recurrenceStorageMock.records.tasks = recurrenceStorageMock.records.tasks.map(task =>
      task.id === firstOccurrence!.id ? { ...task, done: true, status: 'done' } : task
    );

    await expect(applyTaskCompletionEffects(parent, true)).resolves.toBeNull();

    const occurrences = recurrenceStorageMock.records.tasks.filter(task => task.recurringParentId === parent.id);
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].done).toBe(true);
  });
});
