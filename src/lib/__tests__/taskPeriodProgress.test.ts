import { describe, expect, it, vi } from 'vitest';

vi.mock('../storage', () => ({
  storage: {
    getAll: vi.fn(async () => []),
    put: vi.fn(async () => undefined)
  },
  generateUUID: vi.fn(() => 'task-id')
}));

import { getTaskPeriodProgress, hasFullYearGoalHorizon } from '../taskPeriodProgress';
import type { Task } from '../../types';

const recurringTasks: Task[] = [
  {
    id: 'daily-root',
    title: 'Daily practice',
    domain: 'work',
    priority: 'Medium',
    goalId: 'goal',
    date: '2026-11-08',
    dueAt: '2026-11-08',
    done: true,
    status: 'done',
    recurringConfig: {
      frequency: 'daily',
      interval: 1,
      endType: 'by_date',
      endByDate: '2026-11-30'
    },
    createdAt: 1,
    updatedAt: 1
  },
  {
    id: 'nov-9',
    title: 'Daily practice',
    domain: 'work',
    priority: 'Medium',
    goalId: 'goal',
    date: '2026-11-09',
    dueAt: '2026-11-09',
    done: false,
    status: 'open',
    isRecurringChild: true,
    recurringParentId: 'daily-root',
    createdAt: 2,
    updatedAt: 2
  }
];

describe('getTaskPeriodProgress', () => {
  it('shows only the selected day as 1/1', () => {
    expect(getTaskPeriodProgress(recurringTasks, recurringTasks, '2026-11-08', '2026-11-08', 'single_day'))
      .toEqual({ total: 1, completed: 1 });
  });

  it('counts only scheduled daily occurrences in the selected week', () => {
    expect(getTaskPeriodProgress(recurringTasks, recurringTasks, '2026-11-02', '2026-11-08', 'daily'))
      .toEqual({ total: 1, completed: 1 });
  });

  it('limits month and year denominators to scheduled occurrences within the task lifetime', () => {
    expect(getTaskPeriodProgress(recurringTasks, recurringTasks, '2026-11-01', '2026-11-30', 'monthly'))
      .toEqual({ total: 23, completed: 1 });
    expect(getTaskPeriodProgress(recurringTasks, recurringTasks, '2026-01-01', '2026-12-31', 'yearly'))
      .toEqual({ total: 23, completed: 1 });
  });

  it('uses the finite recurrence schedule for the lifecycle denominator', () => {
    expect(getTaskPeriodProgress(recurringTasks, recurringTasks, '2026-01-01', '2026-12-31', 'lifecycle'))
      .toEqual({ total: 23, completed: 1 });
  });

  it('caps an open-ended recurrence to the Goal end date in yearly views', () => {
    const openEndedTasks = recurringTasks.map((task, index) => ({
      ...task,
      recurringConfig: index === 0
        ? { frequency: 'daily' as const, interval: 1, endType: 'never' as const }
        : undefined
    }));

    expect(getTaskPeriodProgress(openEndedTasks, openEndedTasks, '2026-01-01', '2026-12-31', 'yearly', '2027-01-31'))
      .toEqual({ total: 54, completed: 1 });
    expect(getTaskPeriodProgress(openEndedTasks, openEndedTasks, '2027-01-01', '2027-12-31', 'yearly', '2027-01-31'))
      .toEqual({ total: 31, completed: 0 });
  });

  it('counts configured finite occurrences once and includes generated children without Goal links', () => {
    const root: Task = {
      id: 'finite-root',
      title: 'Finite daily task',
      domain: 'work',
      priority: 'Medium',
      goalId: 'goal',
      date: '2026-11-08',
      done: true,
      status: 'done',
      recurringConfig: {
        frequency: 'daily',
        interval: 1,
        endType: 'after',
        endAfterOccurrences: 2
      },
      createdAt: 1,
      updatedAt: 1
    };
    const child: Task = {
      ...root,
      id: 'finite-child',
      goalId: undefined,
      date: '2026-11-09',
      done: false,
      status: 'open',
      recurringConfig: undefined,
      isRecurringChild: true,
      recurringParentId: root.id,
      createdAt: 2,
      updatedAt: 2
    };

    expect(getTaskPeriodProgress([root], [root, child], '2026-11-08', '2026-11-30', 'monthly'))
      .toEqual({ total: 2, completed: 1 });
  });

  it('counts a yearly recurrence once in each selected year', () => {
    const root: Task = {
      id: 'yearly-root',
      title: 'Annual review',
      domain: 'work',
      priority: 'Medium',
      goalId: 'goal',
      date: '2026-11-08',
      done: true,
      status: 'done',
      recurringConfig: {
        frequency: 'yearly',
        interval: 1,
        endType: 'never'
      },
      createdAt: 1,
      updatedAt: 1
    };
    const nextYear: Task = {
      ...root,
      id: 'yearly-2027',
      goalId: undefined,
      date: '2027-11-08',
      done: false,
      status: 'open',
      recurringConfig: undefined,
      isRecurringChild: true,
      recurringParentId: root.id,
      createdAt: 2,
      updatedAt: 2
    };

    expect(getTaskPeriodProgress([root], [root, nextYear], '2026-01-01', '2026-12-31', 'yearly'))
      .toEqual({ total: 1, completed: 1 });
    expect(getTaskPeriodProgress([root], [root, nextYear], '2027-01-01', '2027-12-31', 'yearly'))
      .toEqual({ total: 1, completed: 0 });
  });
});

describe('hasFullYearGoalHorizon', () => {
  it('does not expose yearly mode for a three-month Goal', () => {
    const goal = {
      id: 'goal',
      title: 'Three month plan',
      createdAt: Date.parse('2026-11-08T12:00:00'),
      targetDate: '2027-01-31',
      progress: 0,
      updatedAt: 1
    };
    expect(hasFullYearGoalHorizon([goal], recurringTasks)).toBe(false);
  });

  it('exposes yearly mode when the selected Goal spans a full year', () => {
    const goal = {
      id: 'goal',
      title: 'Year plan',
      createdAt: Date.parse('2026-11-08T12:00:00'),
      targetDate: '2027-11-08',
      progress: 0,
      updatedAt: 1
    };
    expect(hasFullYearGoalHorizon([goal], recurringTasks)).toBe(true);
  });
});
