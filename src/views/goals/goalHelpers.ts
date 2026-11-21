import { Goal } from '../../types';
import { GoalItemType } from '../../lib/goalTaskSync';
import { type ThemeIconName } from '../../components/ThemeIcon';

export const goalItemIcons: Record<GoalItemType, ThemeIconName> = {
  goal: 'mainGoal',
  task: 'target',
  milestone: 'target',
  habit: 'repeat',
  routine: 'calendar',
  learning: 'book',
  skill: 'star',
  note: 'note',
  journal: 'journal',
  savingsPlan: 'savings',
  loan: 'loan',
  investment: 'portfolio',
  asset: 'wallet',
  liability: 'alert',
  transaction: 'wallet',
  appointment: 'calendar',
  healthNote: 'bottle',
  meeting: 'user',
  practice: 'prayer',
  focusSession: 'focus',
  reminder: 'bell'
};

export type GoalLevel = 1 | 2 | 3 | 4 | 5;
export const MAX_GOAL_LEVEL: GoalLevel = 5;

const extractRawGoalSequenceNumber = (normalized: string): number | null => {
  const hierarchicalPrefix = normalized.match(/^(?:#|no\.?\s*)?(\d+(?:\.\d+)+)[\.\)\:\-\s]/i);
  if (hierarchicalPrefix) {
    const parts = hierarchicalPrefix[1].split('.');
    const num = parseInt(parts[parts.length - 1], 10);
    if (!Number.isNaN(num)) return num;
  }

  const ordinalMatch = normalized.match(/^(\d+)(?:st|nd|rd|th)\b/i);
  if (ordinalMatch) {
    const num = parseInt(ordinalMatch[1], 10);
    if (!Number.isNaN(num)) return num;
  }

  const prefixWordMatch = normalized.match(/^(?:#|no\.?\s*|step\s*|goal\s*|sub\s*goal\s*|part\s*|phase\s*)?\[?\(?(\d+)[\.\)\:\-\]\}\s]/i);
  if (prefixWordMatch) {
    const num = parseInt(prefixWordMatch[1], 10);
    if (!Number.isNaN(num)) return num;
  }

  const leadMatch = normalized.match(/^\[?\(?(\d+)\]?\)?(?:\s|$)/);
  if (leadMatch) {
    const num = parseInt(leadMatch[1], 10);
    if (!Number.isNaN(num)) return num;
  }

  const romanMatch = normalized.match(/^(i|ii|iii|iv|v|vi|vii|viii|ix|x)[\.\)\:\-\s]/i);
  if (romanMatch) {
    const romanMap: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
    const r = romanMatch[1].toLowerCase();
    if (romanMap[r]) return romanMap[r];
  }

  const suffixOrdinalMatch = normalized.match(/(?:^|\s)(\d+)(?:st|nd|rd|th)$/i);
  if (suffixOrdinalMatch) {
    const num = parseInt(suffixOrdinalMatch[1], 10);
    if (!Number.isNaN(num)) return num;
  }

  const suffixMatch = normalized.match(/(?:^|[\s\-\:\(\[\#])(\d+)\)?\]?$/);
  if (suffixMatch) {
    const num = parseInt(suffixMatch[1], 10);
    if (!Number.isNaN(num)) return num;
  }

  return null;
};

export const extractGoalSequenceNumber = (title: string): number | null => {
  if (!title) return null;
  const normalized = title.trim().replace(/[०-९]/g, d => String(d.charCodeAt(0) - 2406));
  const rawNumber = extractRawGoalSequenceNumber(normalized);
  if (rawNumber === null) return null;
  return rawNumber >= 1 && rawNumber <= 999 ? rawNumber : null;
};

export const sortGoals = (list: Goal[]) => {
  return [...list].sort((a, b) => {
    const ordA = a.order;
    const ordB = b.order;
    if (ordA !== undefined && ordB !== undefined && ordA !== null && ordB !== null) {
      if (ordA !== ordB) return ordA - ordB;
    } else if (ordA !== undefined && ordA !== null) {
      return -1;
    } else if (ordB !== undefined && ordB !== null) {
      return 1;
    }

    const numA = extractGoalSequenceNumber(a.title);
    const numB = extractGoalSequenceNumber(b.title);
    if (numA !== null && numB !== null && numA !== numB) return numA - numB;
    if (numA !== null && numB === null) return -1;
    if (numB !== null && numA === null) return 1;

    return (a.createdAt || 0) - (b.createdAt || 0);
  });
};

export const computeGoalLevel = (goal: Goal, byId: Map<string, Goal>): GoalLevel => {
  let depth = 1;
  let currParentId: string | undefined = goal.parentId || undefined;
  const visited = new Set<string>([goal.id]);
  while (currParentId && !visited.has(currParentId) && depth < MAX_GOAL_LEVEL) {
    visited.add(currParentId);
    const parent = byId.get(currParentId);
    if (!parent) return 1;
    depth++;
    currParentId = parent.parentId || undefined;
  }
  if (currParentId && visited.has(currParentId)) return 1;
  return depth as GoalLevel;
};

export const getSubtreeHeight = (goalId: string, allGoals: Goal[]): number => {
  let height = 0;
  const walk = (parentId: string, depth: number) => {
    for (const child of allGoals) {
      if (child.parentId !== parentId) continue;
      const nextDepth = depth + 1;
      if (nextDepth > height) height = nextDepth;
      walk(child.id, nextDepth);
    }
  };
  walk(goalId, 0);
  return height;
};
