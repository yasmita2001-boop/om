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
  resolveTaskGoalId,
  resolveHabitGoalId,
  recalculateGoalAggregateProgress,
  syncGoalProgressDirect,
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
});
