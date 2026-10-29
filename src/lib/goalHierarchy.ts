import { Goal } from '../types';

const compareGoals = (a: Goal, b: Goal): number => {
  if (a.order != null && b.order != null && a.order !== b.order) return a.order - b.order;
  if (a.order != null && b.order == null) return -1;
  if (a.order == null && b.order != null) return 1;
  return (a.createdAt || 0) - (b.createdAt || 0) || a.title.localeCompare(b.title);
};

export const getGoalHierarchyLevel = (goal: Goal, goalsById: Map<string, Goal>): number => {
  let level = 1;
  let parentId = goal.parentId || undefined;
  const visited = new Set([goal.id]);

  while (parentId && level < 5 && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = goalsById.get(parentId);
    if (!parent) break;
    level++;
    parentId = parent.parentId || undefined;
  }

  return level;
};

export const sortGoalsHierarchically = (goals: Goal[]): Goal[] => {
  const goalsById = new Map(goals.map(goal => [goal.id, goal]));
  const childrenByParent = new Map<string, Goal[]>();
  const roots: Goal[] = [];

  goals.forEach(goal => {
    const parentId = goal.parentId;
    if (parentId && goalsById.has(parentId)) {
      const children = childrenByParent.get(parentId) || [];
      children.push(goal);
      childrenByParent.set(parentId, children);
    } else {
      roots.push(goal);
    }
  });

  const ordered: Goal[] = [];
  const visited = new Set<string>();
  const walk = (goal: Goal) => {
    if (visited.has(goal.id)) return;
    visited.add(goal.id);
    ordered.push(goal);
    (childrenByParent.get(goal.id) || []).sort(compareGoals).forEach(walk);
  };

  roots.sort(compareGoals).forEach(walk);
  [...goals].sort(compareGoals).forEach(walk);
  return ordered;
};
