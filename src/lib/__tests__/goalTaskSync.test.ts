import { beforeEach, describe, it, expect, vi } from 'vitest';

const storageMock = vi.hoisted(() => ({
  getSingleton: vi.fn(async () => ({})),
  setSingleton: vi.fn(async () => undefined),
  list: vi.fn(async () => []),
  getAll: vi.fn(async (_store: string) => [] as unknown[]),
  put: vi.fn(async (_store: string, _item: unknown) => undefined)
}));

vi.mock('../storage', () => ({ storage: storageMock }));

import {
  computeGoalAggregateBreakdown,
  resolveTaskGoalId,
  resolveHabitGoalId,
  recalculateGoalAggregateProgress,
  syncGoalProgressDirect
} from '../goalTaskSync';

const sources = {
  routines: [{ id: 'r1', goalId: 'goal-routine' }],
  skills: [{ id: 's1', goalId: 'goal-skill' }],
  learningItems: [{ id: 'l1', goalId: 'goal-learning' }],
} as any;

describe('resolveTaskGoalId', () => {
  it('prefers a direct goalId', () => {
    const task = { id: 't1', goalId: 'goal-direct', routineId: 'r1' } as any;
    expect(resolveTaskGoalId(task, sources)).toBe('goal-direct');
  });
  it('falls back through routine, skill, then learning', () => {
    expect(resolveTaskGoalId({ id: 't3', routineId: 'r1' } as any, sources)).toBe('goal-routine');
    expect(resolveTaskGoalId({ id: 't4', skillId: 's1' } as any, sources)).toBe('goal-skill');
    expect(resolveTaskGoalId({ id: 't5', learningId: 'l1' } as any, sources)).toBe('goal-learning');
  });
  it('returns undefined without a resolvable link', () => {
    expect(resolveTaskGoalId({ id: 't7' } as any, sources)).toBeUndefined();
  });
});

describe('resolveHabitGoalId', () => {
  const routines = [{ id: 'r1', goalId: 'goal-routine' }] as any;
  it('resolves an explicit Goal link before a routine link', () => {
    expect(resolveHabitGoalId({ id: 'h1', goalId: 'own', routineId: 'r1' } as any, routines)).toBe('own');
  });

  it('falls back to routineId then linkedRoutineId', () => {
    expect(resolveHabitGoalId({ id: 'h2', routineId: 'r1' } as any, routines)).toBe('goal-routine');
    expect(resolveHabitGoalId({ id: 'h3', linkedRoutineId: 'r1' } as any, routines)).toBe('goal-routine');
  });
  it('returns undefined without any link', () => {
    expect(resolveHabitGoalId({ id: 'h4' } as any, routines)).toBeUndefined();
  });
});

describe('goal progress status and links', () => {
  beforeEach(() => {
    storageMock.getAll.mockImplementation(async store => {
      if (store === 'goals') return [{ id: 'paused-goal', title: 'Paused goal', progress: 10, manualProgress: 10, status: 'paused', createdAt: 1, updatedAt: 1 }];
      if (store === 'tasks') return [{ id: 'task', title: 'Linked task', goalId: 'paused-goal', status: 'open', done: false, createdAt: 1, updatedAt: 1 }];
      return [];
    });
    storageMock.put.mockClear();
  });
  it('preserves paused while linked work is in progress', async () => {
    const result = await recalculateGoalAggregateProgress('paused-goal', { updatedTaskId: 'task', updatedTaskStatus: 'in-progress' });
    expect(result.targetGoal).toMatchObject({ status: 'paused', progress: 50 });
    expect(storageMock.put).toHaveBeenCalledWith('goals', expect.objectContaining({ status: 'paused', progress: 50 }));
  });
  it('completes a paused goal when linked work reaches 100 percent', async () => {
    const result = await recalculateGoalAggregateProgress('paused-goal', { updatedTaskId: 'task', updatedTaskDone: true });
    expect(result.targetGoal).toMatchObject({ status: 'completed', progress: 100 });
  });
  it('preserves paused when manual progress is adjusted', async () => {
    storageMock.getAll.mockImplementation(async store => store === 'goals'
      ? [{ id: 'paused-goal', title: 'Paused goal', progress: 10, manualProgress: 10, status: 'paused', createdAt: 1, updatedAt: 1 }]
      : []);
    const result = await syncGoalProgressDirect('paused-goal', 25);
    expect(result.targetGoal).toMatchObject({ status: 'paused', progress: 25, manualProgress: 25 });
  });
  it('restores manual progress after the last linked item is removed', async () => {
    let goal: any = { id: 'goal', title: 'Goal', progress: 10, manualProgress: 10, status: 'active', createdAt: 1, updatedAt: 1 };
    let tasks: any[] = [{ id: 'task', title: 'Linked task', goalId: 'goal', status: 'done', done: true, createdAt: 1, updatedAt: 1 }];
    storageMock.getAll.mockImplementation(async store => store === 'goals' ? [goal] : store === 'tasks' ? tasks : []);
    storageMock.put.mockImplementation(async (store, item) => { if (store === 'goals') goal = item; });
    const linked = await recalculateGoalAggregateProgress('goal');
    expect(linked.targetGoal).toMatchObject({ progress: 100, manualProgress: 10 });
    tasks = [];
    const unlinked = await recalculateGoalAggregateProgress('goal');
    expect(unlinked.targetGoal).toMatchObject({ progress: 10, manualProgress: 10, status: 'active' });
  });

  it('counts completed tasks linked through their routine in goal progress', async () => {
    const createdAt = Date.parse('2026-11-08T12:00:00');
    storageMock.getAll.mockImplementation(async store => {
      if (store === 'goals') return [{
        id: 'goal-routine', title: 'Routine goal', progress: 0, status: 'active',
        date: '2026-11-08', targetDate: '2026-11-08', createdAt, updatedAt: createdAt
      }];
      if (store === 'tasks') return [{
        id: 'task', title: 'Routine task', routineId: 'r1', date: '2026-11-08',
        status: 'open', done: false, createdAt, updatedAt: createdAt
      }];
      if (store === 'routines') return [{
        id: 'r1', name: 'Routine', goalId: 'goal-routine', frequency: 'daily',
        active: true, createdAt, updatedAt: createdAt
      }];
      return [];
    });

    const task = { id: 'task', title: 'Routine task', routineId: 'r1', status: 'open', done: false, createdAt, updatedAt: createdAt } as any;
    const linkedGoalId = resolveTaskGoalId(task, { routines: sources.routines, skills: [], learningItems: [] });
    const result = await recalculateGoalAggregateProgress(linkedGoalId!, { updatedTaskId: 'task', updatedTaskDone: true });

    expect(result.targetGoal).toMatchObject({ id: 'goal-routine', progress: 50, status: 'active' });
    expect(result.breakdown).toMatchObject({ completedItems: 1, progressItemCount: 2 });
    expect(result.breakdown?.items.find(item => item.type === 'task')).toMatchObject({
      id: 'task',
      isCompleted: true,
      progress: 100
    });
  });

  it('uses the full finite recurrence schedule as the Goal task denominator', () => {
    const recurringConfig = {
      frequency: 'daily' as const,
      interval: 1,
      endType: 'by_date' as const,
      endByDate: '2026-11-30',
      occurrenceCount: 1,
      lastGeneratedDate: '2026-11-09'
    };
    const rootTask = {
      id: 'daily-root',
      title: '20 sentences',
      goalId: 'goal',
      dueAt: '2026-11-08',
      date: '2026-11-08',
      recurringConfig,
      done: true,
      status: 'done'
    };
    const nextTask = {
      id: 'daily-next',
      title: '20 sentences',
      goalId: 'goal',
      dueAt: '2026-11-09',
      date: '2026-11-09',
      recurringParentId: 'daily-root',
      isRecurringChild: true,
      recurringConfig,
      done: false,
      status: 'open'
    };

    const breakdown = computeGoalAggregateBreakdown('goal', {
      goals: [{ id: 'goal', title: 'Speaking', progress: 33, status: 'active' }],
      tasks: [rootTask, nextTask]
    } as any);

    expect(breakdown).toMatchObject({
      totalPercent: 4.3,
      completedItems: 1,
      progressItemCount: 23
    });
    expect(breakdown.categories.tasks).toMatchObject({
      count: 23,
      completedCount: 1,
      avgPercent: 4
    });
    expect(breakdown.items.find(item => item.type === 'task')).toMatchObject({
      id: 'daily-root',
      title: '20 sentences (1/23 occurrences)',
      progress: expect.closeTo(100 / 23, 3),
      isAggregate: true
    });
  });

  it('rolls up descendant occurrence weights and displays non-zero fractional progress', () => {
    const goals = [
      { id: 'ram', title: 'Ram', progress: 0, level: 1, createdAt: 1, updatedAt: 1 },
      { id: 'inner', title: 'Inner', progress: 3, parentId: 'ram', level: 2, createdAt: 1, updatedAt: 1 }
    ];
    const tasks = [
      ...Array.from({ length: 25 }, (_, index) => ({
        id: `ram-task-${index}`,
        title: `Ram task ${index}`,
        goalId: 'ram',
        status: 'open',
        done: false,
        createdAt: 1,
        updatedAt: 1
      })),
      ...Array.from({ length: 79 }, (_, index) => ({
        id: `inner-task-${index}`,
        title: `Inner task ${index}`,
        goalId: 'inner',
        status: index < 2 ? 'done' : 'open',
        done: index < 2,
        createdAt: 1,
        updatedAt: 1
      }))
    ];
    const data = { goals, tasks } as any;

    const parentBreakdown = computeGoalAggregateBreakdown('ram', data);
    const childBreakdown = computeGoalAggregateBreakdown('inner', data);

    expect(parentBreakdown).toMatchObject({
      totalItems: 104,
      completedItems: 2,
      progressItemCount: 104,
      progressPoints: 200,
      totalPercent: 1.9
    });
    expect(childBreakdown).toMatchObject({
      totalItems: 79,
      completedItems: 2,
      progressItemCount: 79,
      progressPoints: 200,
      totalPercent: 2.5
    });
  });

  it('does not count an extra recurrence beyond a finite occurrence limit', () => {
    const breakdown = computeGoalAggregateBreakdown('goal', {
      goals: [{ id: 'goal', title: 'Goal', progress: 0, createdAt: 1, updatedAt: 1 }],
      tasks: [{
        id: 'finite-series',
        title: 'Finite series',
        goalId: 'goal',
        date: '2026-11-08',
        done: false,
        status: 'open',
        recurringConfig: {
          frequency: 'yearly',
          interval: 1,
          endType: 'after',
          endAfterOccurrences: 2
        },
        createdAt: 1,
        updatedAt: 1
      }]
    } as any);

    expect(breakdown.progressItemCount).toBe(2);
    expect(breakdown.items.find(item => item.type === 'task')).toMatchObject({
      title: 'Finite series (0/2 occurrences)',
      itemCount: 2
    });
  });

  it('includes completed generated occurrences even when only the recurring root is Goal-linked', () => {
    const recurringConfig = {
      frequency: 'daily' as const,
      interval: 1,
      endType: 'by_date' as const,
      endByDate: '2026-11-09',
      occurrenceCount: 1
    };
    const rootTask = {
      id: 'linked-root',
      title: 'Daily practice',
      goalId: 'goal',
      date: '2026-11-08',
      dueAt: '2026-11-08',
      recurringConfig,
      done: false,
      status: 'open'
    };
    const generatedChild = {
      id: 'generated-child',
      title: 'Daily practice',
      date: '2026-11-09',
      dueAt: '2026-11-09',
      recurringParentId: 'linked-root',
      isRecurringChild: true,
      done: true,
      status: 'done'
    };

    const breakdown = computeGoalAggregateBreakdown('goal', {
      goals: [{ id: 'goal', title: 'Goal', progress: 0 }],
      tasks: [rootTask, generatedChild]
    } as any);

    expect(breakdown).toMatchObject({
      progressItemCount: 2,
      completedItems: 1,
      totalPercent: 50
    });
    expect(breakdown.items.find(item => item.type === 'task')).toMatchObject({
      title: 'Daily practice (1/2 occurrences)',
      progressWeight: 2,
      completedCount: 1
    });
  });

  it('uses lifecycle routine and habit occurrences as Goal weights', () => {
    const createdAt = Date.parse('2026-11-08T12:00:00');
    const breakdown = computeGoalAggregateBreakdown('goal', {
      goals: [{
        id: 'goal',
        title: 'Daily practice',
        progress: 0,
        date: '2026-11-08',
        targetDate: '2026-11-10',
        createdAt,
        updatedAt: createdAt
      }],
      tasks: [],
      routines: [{
        id: 'routine',
        name: 'Routine',
        frequency: 'daily',
        category: 'work',
        active: true,
        goalId: 'goal',
        completedDates: ['2026-11-08'],
        createdAt,
        updatedAt: createdAt
      }],
      habits: [{
        id: 'habit',
        name: 'Habit',
        frequency: 'daily',
        timesPerDay: 2,
        goalId: 'goal',
        createdAt,
        updatedAt: createdAt
      }],
      habitLogs: [
        { id: 'habit-1', habitId: 'habit', date: '2026-11-08', occurrence: 0, createdAt },
        { id: 'habit-2', habitId: 'habit', date: '2026-11-08', occurrence: 1, createdAt }
      ]
    } as any);

    expect(breakdown).toMatchObject({
      totalItems: 9,
      completedItems: 3,
      progressItemCount: 9,
      totalPercent: 33.3
    });
    expect(breakdown.items.find(item => item.type === 'routine')).toMatchObject({
      title: 'Routine (1/3 occurrences)',
      progressWeight: 3,
      completedCount: 1
    });
    expect(breakdown.items.find(item => item.type === 'habit')).toMatchObject({
      title: 'Habit (2/6 occurrences)',
      progressWeight: 6,
      completedCount: 2
    });
  });
});
