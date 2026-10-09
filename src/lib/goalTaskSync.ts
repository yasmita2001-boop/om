// Real-Time Goal Progress Synchronization & Hierarchy Rollup Engine
import { storage } from './storage';
import { Goal, Task, Habit, HabitLog, Routine } from '../types';

export interface GoalItemBreakdown {
  id: string;
  type: 'task' | 'habit' | 'routine' | 'child_goal';
  title: string;
  isCompleted: boolean;
  weight: number;
}

export interface GoalProgressSummary {
  goalId: string;
  title: string;
  totalItems: number;
  completedItems: number;
  progressPercent: number;
  items: GoalItemBreakdown[];
}

export async function recalculateGoalProgress(goalId: string): Promise<Goal | null> {
  const allGoals = await storage.getAll<Goal>('goals');
  const target = allGoals.find(g => g.id === goalId);
  if (!target) return null;

  const [allTasks, allHabits, allRoutines, allLogs] = await Promise.all([
    storage.getAll<Task>('tasks'),
    storage.getAll<Habit>('habits'),
    storage.getAll<Routine>('routines'),
    storage.getAll<HabitLog>('habitLogs')
  ]);

  const today = new Date().toISOString().slice(0, 10);

  // 1. Linked tasks
  const linkedTasks = allTasks.filter(t => t.goalId === goalId);
  // 2. Linked habits
  const linkedHabits = allHabits.filter(h => h.goalId === goalId);
  // 3. Linked routines
  const linkedRoutines = allRoutines.filter(r => r.goalId === goalId);
  // 4. Linked sub-goals
  const childGoals = allGoals.filter(g => g.parentId === goalId);

  const totalLinked = linkedTasks.length + linkedHabits.length + linkedRoutines.length + childGoals.length;

  if (totalLinked === 0) {
    // Keep manual progress
    return target;
  }

  let completedCount = 0;
  linkedTasks.forEach(t => { if (t.done || t.status === 'done') completedCount++; });
  linkedHabits.forEach(h => { if (allLogs.some(l => l.habitId === h.id && l.date === today)) completedCount++; });
  linkedRoutines.forEach(r => { if (r.completedDate === today) completedCount++; });
  childGoals.forEach(cg => { if (cg.progress >= 100) completedCount++; });

  const calculatedPercent = Math.round((completedCount / totalLinked) * 100);

  const updated: Goal = {
    ...target,
    progress: calculatedPercent,
    status: calculatedPercent >= 100 ? 'completed' : 'active',
    updatedAt: Date.now()
  };

  await storage.put('goals', updated);

  // If this goal has a parent, recursively roll up!
  if (updated.parentId) {
    await recalculateGoalProgress(updated.parentId);
  }

  return updated;
}
