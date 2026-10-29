import { describe, expect, it } from 'vitest';
import { Goal } from '../../types';
import { getGoalHierarchyLevel, sortGoalsHierarchically } from '../goalHierarchy';

const createGoal = (id: string, parentId?: string, order?: number): Goal => ({
  id,
  title: id,
  parentId,
  order,
  progress: 0,
  createdAt: 0,
  updatedAt: 0
});

describe('goal hierarchy ordering', () => {
  it('orders goals by parent hierarchy and sibling order', () => {
    const goals = [
      createGoal('atomic', 'nano'),
      createGoal('sub-b', 'main-b'),
      createGoal('nano', 'micro'),
      createGoal('main-b', undefined, 2),
      createGoal('micro', 'sub-a'),
      createGoal('main-a', undefined, 1),
      createGoal('sub-a', 'main-a'),
      createGoal('atomic-b', 'nano-b'),
      createGoal('micro-b', 'sub-b'),
      createGoal('nano-b', 'micro-b')
    ];

    expect(sortGoalsHierarchically(goals).map(goal => goal.id)).toEqual([
      'main-a', 'sub-a', 'micro', 'nano', 'atomic',
      'main-b', 'sub-b', 'micro-b', 'nano-b', 'atomic-b'
    ]);
  });

  it('derives the level from the parent chain', () => {
    const goals = [
      createGoal('main'),
      createGoal('sub', 'main'),
      createGoal('micro', 'sub'),
      createGoal('nano', 'micro'),
      createGoal('atomic', 'nano')
    ];
    const goalsById = new Map(goals.map(goal => [goal.id, goal]));

    expect(getGoalHierarchyLevel(goals[4], goalsById)).toBe(5);
  });
});
