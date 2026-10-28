import { describe, it, expect, vi } from 'vitest';

vi.mock('../storage', () => ({
  storage: {
    getSingleton: vi.fn(async () => ({})),
    setSingleton: vi.fn(async () => undefined),
    list: vi.fn(async () => []),
  },
}));

import {
  resolveTaskGoalId,
  resolveHabitGoalId,
} from '../goalTaskSync';

const sources = {
  workProjects: [
    { id: 'p1', goalId: 'goal-project' },
    { id: 'p2', goalId: undefined },
  ],
  routines: [{ id: 'r1', goalId: 'goal-routine' }],
  skills: [{ id: 's1', goalId: 'goal-skill' }],
  learningItems: [{ id: 'l1', goalId: 'goal-learning' }],
} as any;

describe('resolveTaskGoalId', () => {
  it('prefers a direct goalId', () => {
    const task = { id: 't1', goalId: 'goal-direct', projectId: 'p1' } as any;
    expect(resolveTaskGoalId(task, sources)).toBe('goal-direct');
  });

  it('falls back through project, routine, skill, then learning', () => {
    expect(resolveTaskGoalId({ id: 't2', projectId: 'p1' } as any, sources)).toBe('goal-project');
    expect(resolveTaskGoalId({ id: 't3', routineId: 'r1' } as any, sources)).toBe('goal-routine');
    expect(resolveTaskGoalId({ id: 't4', skillId: 's1' } as any, sources)).toBe('goal-skill');
    expect(resolveTaskGoalId({ id: 't5', learningId: 'l1' } as any, sources)).toBe('goal-learning');
  });

  it('ignores links whose parent has no goalId', () => {
    expect(resolveTaskGoalId({ id: 't6', projectId: 'p2' } as any, sources)).toBeUndefined();
    expect(resolveTaskGoalId({ id: 't7' } as any, sources)).toBeUndefined();
  });
});

describe('resolveHabitGoalId', () => {
  const routines = [{ id: 'r1', goalId: 'goal-routine' }] as any;

  it('ignores legacy direct goalIds', () => {
    expect(resolveHabitGoalId({ id: 'h1', goalId: 'own' } as any, routines)).toBeUndefined();
  });

  it('falls back to routineId then linkedRoutineId', () => {
    expect(resolveHabitGoalId({ id: 'h2', routineId: 'r1' } as any, routines)).toBe('goal-routine');
    expect(resolveHabitGoalId({ id: 'h3', linkedRoutineId: 'r1' } as any, routines)).toBe('goal-routine');
  });

  it('returns undefined without any link', () => {
    expect(resolveHabitGoalId({ id: 'h4' } as any, routines)).toBeUndefined();
  });
});