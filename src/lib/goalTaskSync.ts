import { storage } from './storage';
import {
  Goal,
  Task,
  Milestone,
  Habit,
  HabitLog,
  Routine,
  WorkProject,
  LearningItem,
  Skill,
  Note,
  JournalEntry
} from '../types';

export interface GoalItemDetail {
  id: string;
  type: 'goal' | 'task' | 'milestone' | 'habit' | 'routine' | 'project' | 'learning' | 'skill' | 'note' | 'journal';
  typeLabel: string;
  title: string;
  progress: number;
  weightPercent: number; // e.g. 25% if 4 items
  isCompleted: boolean;
}

export interface GoalCategorySummary {
  count: number;
  completedCount: number;
  avgPercent: number;
}

export interface GoalProgressBreakdown {
  goalId: string;
  goalTitle: string;
  totalItems: number;
  completedItems: number;
  totalPercent: number;
  hasLinkedItems: boolean;
  categories: {
    childGoals: GoalCategorySummary;
    tasks: GoalCategorySummary;
    milestones: GoalCategorySummary;
    habits: GoalCategorySummary;
    routines: GoalCategorySummary;
    projects: GoalCategorySummary;
    learning: GoalCategorySummary;
    skills: GoalCategorySummary;
    notes: GoalCategorySummary;
    journal: GoalCategorySummary;
  };
  items: GoalItemDetail[];
}

export interface RecalcOverrides {
  updatedTaskId?: string;
  updatedTaskDone?: boolean;
  updatedMilestoneId?: string;
  updatedMilestoneStatus?: string;
  updatedMilestoneProgress?: number;
  updatedHabitId?: string;
  updatedRoutineId?: string;
  isRoutineDoneToday?: boolean;
  updatedProjectId?: string;
  updatedProjectStatus?: string;
  updatedProjectProgress?: number;
  updatedLearningId?: string;
  updatedLearningProgress?: number;
  updatedSkillId?: string;
  updatedSkillLevelOrProgress?: string | number;
  updatedNoteId?: string;
  updatedJournalId?: string;
  directChildGoalId?: string;
  directChildGoalProgress?: number;
}

/**
 * Synchronously computes comprehensive aggregate breakdown for a given goal
 * from all provided data arrays in memory.
 */
export function computeGoalAggregateBreakdown(
  goalId: string,
  data: {
    goals: Goal[];
    tasks: Task[];
    milestones?: Milestone[];
    habits?: Habit[];
    habitLogs?: HabitLog[];
    routines?: Routine[];
    workProjects?: WorkProject[];
    learningItems?: LearningItem[];
    skills?: Skill[];
    notes?: Note[];
    journal?: JournalEntry[];
  }
): GoalProgressBreakdown {
  const goal = data.goals.find(g => g.id === goalId);
  const goalTitle = goal?.title || 'Goal';
  const today = new Date().toISOString().slice(0, 10);

  const milestones = data.milestones || [];
  const habits = data.habits || [];
  const habitLogs = data.habitLogs || [];
  const routines = data.routines || [];
  const projects = data.workProjects || [];
  const learning = data.learningItems || [];
  const skills = data.skills || [];
  const notes = data.notes || [];
  const journal = data.journal || [];

  // 1. Child Sub-goals / Micro-goals
  const childGoals = data.goals.filter(g => g.parentId === goalId);
  // 2. Tasks
  const tasks = data.tasks.filter(t => t.goalId === goalId);
  // 3. Milestones
  const linkedMilestones = milestones.filter(m => m.goalId === goalId);
  // 4. Habits
  const linkedHabits = habits.filter(h => h.goalId === goalId);
  // 5. Routines
  const linkedRoutines = routines.filter(r => r.goalId === goalId);
  // 6. Work Projects
  const linkedProjects = projects.filter(p => p.goalId === goalId);
  // 7. Learning Items
  const linkedLearning = learning.filter(l => l.goalId === goalId);
  // 8. Skill Trees
  const linkedSkills = skills.filter(s => s.goalId === goalId);
  // 9. Notebooks & Knowledge Vault
  const linkedNotes = notes.filter(n => n.goalId === goalId);
  // 10. Daily Journal & Philosophical Reflections
  const linkedJournal = journal.filter(j => j.goalId === goalId);

  const rawItems: Array<{
    id: string;
    type: GoalItemDetail['type'];
    typeLabel: string;
    title: string;
    progress: number;
    isCompleted: boolean;
  }> = [];

  // Child Goals
  childGoals.forEach(c => {
    const prog = Math.max(0, Math.min(100, Math.round(Number(c.progress) || 0)));
    const typeLabel =
      c.level === 5 ? '⚡ Atomic Goal' :
      c.level === 4 ? '🔸 Nano Goal' :
      c.level === 3 ? '▫️ Micro Goal' :
      c.level === 2 ? '🔹 Sub Goal' : '🎯 Main Goal';
    rawItems.push({
      id: c.id,
      type: 'goal',
      typeLabel,
      title: c.title,
      progress: prog,
      isCompleted: prog >= 100
    });
  });

  // Tasks
  tasks.forEach(t => {
    const isDone = Boolean(t.done || t.status === 'done');
    const prog = isDone ? 100 : t.status === 'in-progress' ? 50 : 0;
    rawItems.push({
      id: t.id,
      type: 'task',
      typeLabel: '📋 Task',
      title: t.title,
      progress: prog,
      isCompleted: isDone
    });
  });

  // Milestones
  linkedMilestones.forEach(m => {
    const isDone = m.status === 'completed';
    const prog = isDone ? 100 : Math.max(0, Math.min(100, Math.round(Number(m.progress) || 0)));
    rawItems.push({
      id: m.id,
      type: 'milestone',
      typeLabel: '🏁 Milestone',
      title: m.title,
      progress: prog,
      isCompleted: isDone || prog >= 100
    });
  });

  // Habits
  linkedHabits.forEach(h => {
    const isDone = habitLogs.some(l => l.habitId === h.id && l.date === today);
    rawItems.push({
      id: h.id,
      type: 'habit',
      typeLabel: '🔁 Habit Ritual',
      title: h.name,
      progress: isDone ? 100 : 0,
      isCompleted: isDone
    });
  });

  // Routines
  linkedRoutines.forEach(r => {
    const isDone = Boolean(r.completedDate === today || (r.completedDates && r.completedDates.includes(today)));
    rawItems.push({
      id: r.id,
      type: 'routine',
      typeLabel: '⏱️ Routine Block',
      title: r.name,
      progress: isDone ? 100 : 0,
      isCompleted: isDone
    });
  });

  // Projects
  linkedProjects.forEach(p => {
    let prog = 0;
    if (p.status === 'Completed') prog = 100;
    else if (p.progress !== undefined && p.progress !== null) prog = Number(p.progress) || 0;
    else if (p.status === 'In Review') prog = 80;
    else if (p.status === 'Active') prog = 40;
    else prog = 20;

    prog = Math.max(0, Math.min(100, Math.round(prog)));
    rawItems.push({
      id: p.id,
      type: 'project',
      typeLabel: '📂 Deliverable',
      title: p.name,
      progress: prog,
      isCompleted: prog >= 100 || p.status === 'Completed'
    });
  });

  // Learning Items
  linkedLearning.forEach(l => {
    const prog = Math.max(0, Math.min(100, Math.round(Number(l.progress) || 0)));
    rawItems.push({
      id: l.id,
      type: 'learning',
      typeLabel: '📚 Learning Track',
      title: l.title,
      progress: prog,
      isCompleted: prog >= 100
    });
  });

  // Skills
  linkedSkills.forEach(s => {
    let prog = 0;
    if (typeof s.progress === 'number' && !isNaN(s.progress)) {
      prog = s.progress;
    } else {
      const lvl = (s.level || '').toLowerCase();
      if (lvl.includes('master') || lvl.includes('expert')) prog = 100;
      else if (lvl.includes('advance')) prog = 75;
      else if (lvl.includes('inter')) prog = 50;
      else prog = 25;
    }
    prog = Math.max(0, Math.min(100, Math.round(prog)));
    rawItems.push({
      id: s.id,
      type: 'skill',
      typeLabel: '🏆 Competency',
      title: s.name,
      progress: prog,
      isCompleted: prog >= 100
    });
  });

  // Notebooks & Knowledge Vault
  linkedNotes.forEach(n => {
    rawItems.push({
      id: n.id,
      type: 'note',
      typeLabel: '📓 Knowledge Vault',
      title: n.title,
      progress: 100,
      isCompleted: true
    });
  });

  // Daily Journal & Philosophical Reflections
  linkedJournal.forEach(j => {
    rawItems.push({
      id: j.id,
      type: 'journal',
      typeLabel: '📖 Journal Reflection',
      title: j.title,
      progress: 100,
      isCompleted: true
    });
  });

  const totalItems = rawItems.length;
  const weightPerItem = totalItems > 0 ? Number((100 / totalItems).toFixed(1)) : 0;

  const items: GoalItemDetail[] = rawItems.map(item => ({
    ...item,
    weightPercent: weightPerItem
  }));

  const completedItems = items.filter(i => i.isCompleted).length;

  const calcCategory = (type: GoalItemDetail['type']): GoalCategorySummary => {
    const matched = items.filter(i => i.type === type);
    const count = matched.length;
    const completedCount = matched.filter(i => i.isCompleted).length;
    const avgPercent = count > 0 ? Math.round(matched.reduce((acc, i) => acc + i.progress, 0) / count) : 0;
    return { count, completedCount, avgPercent };
  };

  const totalPercent = totalItems > 0
    ? Math.max(0, Math.min(100, Math.round(items.reduce((acc, i) => acc + i.progress, 0) / totalItems)))
    : Math.max(0, Math.min(100, Math.round(Number(goal?.progress) || 0)));

  return {
    goalId,
    goalTitle,
    totalItems,
    completedItems,
    totalPercent,
    hasLinkedItems: totalItems > 0,
    categories: {
      childGoals: calcCategory('goal'),
      tasks: calcCategory('task'),
      milestones: calcCategory('milestone'),
      habits: calcCategory('habit'),
      routines: calcCategory('routine'),
      projects: calcCategory('project'),
      learning: calcCategory('learning'),
      skills: calcCategory('skill'),
      notes: calcCategory('note'),
      journal: calcCategory('journal')
    },
    items
  };
}

/**
 * MASTER AGGREGATE RECALCULATION ENGINE
 * Calculates proportional, real-time aggregate progress across all items
 * linked to a Goal (Tasks, Milestones, Habits, Routines, Projects, Learning Tracks, Skills, Notes, Journal, Sub-goals).
 * Recursively rolls up progress through the 3-Tier Hierarchy (Level 3 -> Level 2 -> Level 1).
 */
export async function recalculateGoalAggregateProgress(
  goalId: string,
  overrides?: RecalcOverrides
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  if (!goalId) return { updatedGoals: [] };

  const allGoals = await storage.getAll<Goal>('goals');
  const targetGoal = allGoals.find(g => g.id === goalId);
  if (!targetGoal) return { updatedGoals: [] };

  let allTasks = await storage.getAll<Task>('tasks');
  let allMilestones = await storage.getAll<Milestone>('milestones');
  let allHabits = await storage.getAll<Habit>('habits');
  let allHabitLogs = await storage.getAll<HabitLog>('habitLogs');
  let allRoutines = await storage.getAll<Routine>('routines');
  let allProjects = await storage.getAll<WorkProject>('workProjects');
  let allLearning = await storage.getAll<LearningItem>('learningItems');
  let allSkills = await storage.getAll<Skill>('skills');
  let allNotes = await storage.getAll<Note>('notes');
  let allJournal = await storage.getAll<JournalEntry>('journal');

  // Apply in-flight overrides if provided
  if (overrides) {
    if (overrides.updatedTaskId) {
      allTasks = allTasks.map(t =>
        t.id === overrides.updatedTaskId
          ? {
              ...t,
              done: overrides.updatedTaskDone !== undefined ? overrides.updatedTaskDone : t.done,
              status: overrides.updatedTaskDone ? 'done' : 'open'
            }
          : t
      );
    }

    if (overrides.updatedMilestoneId) {
      allMilestones = allMilestones.map(m =>
        m.id === overrides.updatedMilestoneId
          ? {
              ...m,
              status: overrides.updatedMilestoneStatus !== undefined ? overrides.updatedMilestoneStatus : m.status,
              progress: overrides.updatedMilestoneProgress !== undefined ? overrides.updatedMilestoneProgress : m.progress
            }
          : m
      );
    }

    if (overrides.updatedRoutineId) {
      const today = new Date().toISOString().slice(0, 10);
      allRoutines = allRoutines.map(r =>
        r.id === overrides.updatedRoutineId
          ? { ...r, completedDate: overrides.isRoutineDoneToday ? today : null }
          : r
      );
    }

    if (overrides.updatedProjectId) {
      allProjects = allProjects.map(p =>
        p.id === overrides.updatedProjectId
          ? {
              ...p,
              status: overrides.updatedProjectStatus !== undefined ? overrides.updatedProjectStatus : p.status,
              progress: overrides.updatedProjectProgress !== undefined ? overrides.updatedProjectProgress : p.progress
            }
          : p
      );
    }

    if (overrides.updatedLearningId) {
      allLearning = allLearning.map(l =>
        l.id === overrides.updatedLearningId
          ? {
              ...l,
              progress: overrides.updatedLearningProgress !== undefined ? overrides.updatedLearningProgress : l.progress
            }
          : l
      );
    }

    if (overrides.updatedSkillId) {
      allSkills = allSkills.map(s => {
        if (s.id !== overrides.updatedSkillId) return s;
        if (typeof overrides.updatedSkillLevelOrProgress === 'number') {
          return { ...s, progress: overrides.updatedSkillLevelOrProgress };
        }
        if (typeof overrides.updatedSkillLevelOrProgress === 'string') {
          const lvl = overrides.updatedSkillLevelOrProgress;
          return {
            ...s,
            level: lvl,
            progress: lvl.toLowerCase().includes('master') ? 100 : lvl.toLowerCase().includes('advance') ? 75 : lvl.toLowerCase().includes('inter') ? 50 : 25
          };
        }
        return s;
      });
    }
  }

  // Work with a mutable clone map of goals
  const goalMap = new Map<string, Goal>();
  allGoals.forEach(g => goalMap.set(g.id, { ...g }));

  // Helper to recompute and persist a single goal based on goalMap and linked stores
  const recomputeSingleGoal = async (currentGoalId: string): Promise<{ goal: Goal; breakdown: GoalProgressBreakdown } | null> => {
    const current = goalMap.get(currentGoalId);
    if (!current) return null;

    const currentGoalsArray = Array.from(goalMap.values());
    const breakdown = computeGoalAggregateBreakdown(currentGoalId, {
      goals: currentGoalsArray,
      tasks: allTasks,
      milestones: allMilestones,
      habits: allHabits,
      habitLogs: allHabitLogs,
      routines: allRoutines,
      workProjects: allProjects,
      learningItems: allLearning,
      skills: allSkills,
      notes: allNotes,
      journal: allJournal
    });

    const newProgress = breakdown.hasLinkedItems ? breakdown.totalPercent : (current.progress || 0);
    const updated: Goal = {
      ...current,
      progress: newProgress,
      status: newProgress >= 100 ? 'completed' : 'active',
      updatedAt: Date.now()
    };

    goalMap.set(current.id, updated);
    await storage.put('goals', updated);
    return { goal: updated, breakdown };
  };

  // 1. Recalculate target goal
  const targetResult = await recomputeSingleGoal(goalId);
  if (!targetResult) return { updatedGoals: [] };

  const updatedGoalsList: Goal[] = [targetResult.goal];

  // 2. Recursively rollup up the 3-Tier Hierarchy
  // If targetGoal was a Level 3 Micro-Goal, it recalculates its Level 2 Sub-Goal parent,
  // which in turn recalculates its Level 1 Main Goal parent!
  let currentParentId = targetResult.goal.parentId;
  while (currentParentId) {
    const parentResult = await recomputeSingleGoal(currentParentId);
    if (!parentResult) break;
    updatedGoalsList.push(parentResult.goal);
    currentParentId = parentResult.goal.parentId;
  }

  return {
    updatedGoals: updatedGoalsList,
    targetGoal: targetResult.goal,
    breakdown: targetResult.breakdown
  };
}

/**
 * Recalculate linked goal progress from tasks
 */
export async function syncGoalProgressFromTasks(
  goalId: string,
  updatedTaskId?: string,
  updatedTaskDone?: boolean
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedTaskId,
    updatedTaskDone
  });
}

/**
 * Recalculate linked goal progress from milestones
 */
export async function syncGoalProgressFromMilestones(
  goalId: string,
  updatedMilestoneId?: string,
  updatedMilestoneProgress?: number,
  updatedMilestoneStatus?: string
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedMilestoneId,
    updatedMilestoneProgress,
    updatedMilestoneStatus
  });
}

/**
 * Recalculate linked goal progress from habits
 */
export async function syncGoalProgressFromHabits(
  goalId: string,
  updatedHabitId?: string
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedHabitId
  });
}

/**
 * Recalculate linked goal progress from work projects
 */
export async function syncGoalProgressFromProjects(
  goalId: string,
  updatedProjectId?: string,
  updatedProjectStatus?: string,
  updatedProjectProgress?: number
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedProjectId,
    updatedProjectStatus,
    updatedProjectProgress
  });
}

/**
 * Recalculate linked goal progress from learning tracks
 */
export async function syncGoalProgressFromLearning(
  goalId: string,
  updatedItemId?: string,
  updatedProgress?: number
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedLearningId: updatedItemId,
    updatedLearningProgress: updatedProgress
  });
}

/**
 * Recalculate linked goal progress from skill trees
 */
export async function syncGoalProgressFromSkills(
  goalId: string,
  updatedSkillId?: string,
  updatedLevelOrProgress?: string | number
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedSkillId,
    updatedSkillLevelOrProgress: updatedLevelOrProgress
  });
}

/**
 * Recalculate linked goal progress from routine blocks
 */
export async function syncGoalProgressFromRoutines(
  goalId: string,
  updatedRoutineId?: string,
  isDoneToday?: boolean
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedRoutineId,
    isRoutineDoneToday: isDoneToday
  });
}

/**
 * Recalculate linked goal progress from Notebooks & Knowledge Vault notes
 */
export async function syncGoalProgressFromNotes(
  goalId: string,
  updatedNoteId?: string
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedNoteId
  });
}

/**
 * Recalculate linked goal progress from Daily Journal & Philosophical Reflections
 */
export async function syncGoalProgressFromJournal(
  goalId: string,
  updatedJournalId?: string
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedJournalId
  });
}

/**
 * Directly adjust or set a goal's manual progress (0-100) when it has no auto-linked items,
 * and roll up the 3-Tier Hierarchy.
 */
export async function syncGoalProgressDirect(
  goalId: string,
  progress: number
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal }> {
  if (!goalId) return { updatedGoals: [] };

  const allGoals = await storage.getAll<Goal>('goals');
  const targetGoal = allGoals.find(g => g.id === goalId);
  if (!targetGoal) return { updatedGoals: [] };

  const clampedProgress = Math.max(0, Math.min(100, Math.round(progress)));

  const goalMap = new Map<string, Goal>();
  allGoals.forEach(g => goalMap.set(g.id, { ...g }));

  const updatedTarget: Goal = {
    ...targetGoal,
    progress: clampedProgress,
    status: clampedProgress >= 100 ? 'completed' : 'active',
    updatedAt: Date.now()
  };
  goalMap.set(targetGoal.id, updatedTarget);
  await storage.put('goals', updatedTarget);

  const updatedGoalsList: Goal[] = [updatedTarget];

  // Rollup hierarchy
  let currentParentId = targetGoal.parentId;
  while (currentParentId) {
    const parentGoal = goalMap.get(currentParentId);
    if (!parentGoal) break;

    // Recalculate parent taking into account all its children & linked items
    const res = await recalculateGoalAggregateProgress(parentGoal.id);
    if (res.targetGoal) {
      updatedGoalsList.push(res.targetGoal);
      currentParentId = res.targetGoal.parentId;
    } else {
      break;
    }
  }

  return { updatedGoals: updatedGoalsList, targetGoal: updatedTarget };
}

/**
 * RECALCULATE ALL GOALS IN SYSTEM (Bottom-Up Order: Level 5 -> Level 4 -> Level 3 -> Level 2 -> Level 1)
 * Used on initial app mount or after bulk imports to ensure 100% accurate aggregate reflection.
 */
export async function recalculateAllGoalsProgress(): Promise<Goal[]> {
  const allGoals = await storage.getAll<Goal>('goals');
  if (allGoals.length === 0) return [];

  // Group goals into Level 5, Level 4, Level 3, Level 2, Level 1
  const level5 = allGoals.filter(g => g.level === 5);
  const level4 = allGoals.filter(g => g.level === 4);
  const level3 = allGoals.filter(g => g.level === 3);
  const level2 = allGoals.filter(g => g.level === 2);
  const level1 = allGoals.filter(g => !g.level || g.level === 1 || !g.parentId);

  // Recalculate bottom-up
  for (const g of level5) {
    await recalculateGoalAggregateProgress(g.id);
  }
  for (const g of level4) {
    await recalculateGoalAggregateProgress(g.id);
  }
  for (const g of level3) {
    await recalculateGoalAggregateProgress(g.id);
  }
  for (const g of level2) {
    await recalculateGoalAggregateProgress(g.id);
  }
  for (const g of level1) {
    await recalculateGoalAggregateProgress(g.id);
  }

  return storage.getAll<Goal>('goals');
}
