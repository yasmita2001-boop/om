import { describe, expect, it } from 'vitest';
import {
  getGoalHierarchyPeriodProgress,
  getGoalPeriodProgress,
  type GoalPeriodProgressInput
} from '../goalPeriodProgress';

const createdAt = Date.parse('2026-11-08T12:00:00');
const goal: GoalPeriodProgressInput['goal'] = {
  id: 'goal',
  title: 'Quarter plan',
  date: '2026-11-08',
  targetDate: '2026-11-30',
  progress: 0,
  createdAt,
  updatedAt: createdAt
};

const emptyInput: GoalPeriodProgressInput = {
  goal,
  childGoals: [],
  tasks: [],
  allTasks: [],
  milestones: [],
  learningItems: [],
  skills: [],
  routines: [],
  habits: [],
  habitLogs: [],
  appointments: [],
  meetings: [],
  savingsPlans: [],
  loans: [],
  investments: [],
  reminders: []
};

describe('getGoalPeriodProgress', () => {
  it('combines actual completion and partial progress across linked menu items', () => {
    const progress = getGoalPeriodProgress({
      ...emptyInput,
      childGoals: [{ ...goal, id: 'child', targetDate: '2026-11-09', progress: 25 }],
      milestones: [{
        id: 'milestone', goalId: goal.id, title: 'Milestone', dueDate: '2026-11-09',
        progress: 50, status: 'in-progress', createdAt, updatedAt: createdAt
      }],
      learningItems: [{
        id: 'learning', title: 'Course', type: 'course', progress: 25,
        targetDate: '2026-11-10', goalId: goal.id, createdAt, updatedAt: createdAt
      }],
      skills: [{
        id: 'skill', name: 'Skill', progress: 50, targetDate: '2026-11-10',
        goalId: goal.id, createdAt, updatedAt: createdAt
      }],
      routines: [{
        id: 'routine', name: 'Routine', frequency: 'daily', category: 'work', active: true,
        goalId: goal.id, completedDates: ['2026-11-08'], createdAt, updatedAt: createdAt
      }],
      habits: [{
        id: 'habit', name: 'Habit', frequency: 'Daily', timesPerDay: 2,
        goalId: goal.id, createdAt, updatedAt: createdAt
      }],
      habitLogs: [
        { id: 'habit-1', key: 'habit|2026-11-08|0', habitId: 'habit', date: '2026-11-08', occurrence: 0, createdAt },
        { id: 'habit-2', key: 'habit|2026-11-09|all', habitId: 'habit', date: '2026-11-09', occurrence: 'all', createdAt }
      ],
      appointments: [{
        id: 'appointment', date: '2026-11-08', title: 'Appointment',
        status: 'completed', completed: true, goalId: goal.id, createdAt, updatedAt: createdAt
      }],
      meetings: [{
        id: 'meeting', date: '2026-11-09', title: 'Meeting',
        status: 'scheduled', completed: false, goalId: goal.id, createdAt, updatedAt: createdAt
      }],
      savingsPlans: [{
        id: 'savings', name: 'Savings', currentAmount: 50, targetAmount: 100,
        durationMonths: 1, maturityDate: '2026-11-10', goalId: goal.id, createdAt, updatedAt: createdAt
      }],
      loans: [{
        id: 'loan', name: 'Loan', principal: 100, rate: 0, tenure: 1, dueDay: 1,
        outstanding: 25, maturityDate: '2026-11-10', goalId: goal.id, createdAt, updatedAt: createdAt
      }],
      investments: [{
        id: 'investment', name: 'Investment', amount: 100, currentValue: 150,
        date: '2026-11-09', goalId: goal.id, createdAt, updatedAt: createdAt
      }],
      reminders: [{
        id: 'reminder', title: 'Reminder', dueAt: '2026-11-08', repeatRule: 'none',
        status: 'done', linkedType: 'goal', linkedId: goal.id, createdAt, updatedAt: createdAt
      }]
    }, '2026-11-08', '2026-11-10', 'monthly');

    expect(progress.total).toBe(19);
    expect(progress.completed).toBeCloseTo(9.75);
  });

  it('uses routine and habit schedules rather than only counting completed records', () => {
    const progress = getGoalPeriodProgress({
      ...emptyInput,
      routines: [{
        id: 'routine', name: 'Weekday routine', frequency: 'weekdays', category: 'work',
        active: true, goalId: goal.id, completedDates: ['2026-11-09'], createdAt, updatedAt: createdAt
      }],
      habits: [{
        id: 'habit', name: 'Weekly habit', frequency: 'Weekly', timesPerDay: 1,
        goalId: goal.id, createdAt, updatedAt: createdAt
      }],
      habitLogs: [{
        id: 'habit-log', key: 'habit|2026-11-08|0', habitId: 'habit',
        date: '2026-11-08', occurrence: 0, createdAt
      }]
    }, '2026-11-08', '2026-11-15', 'daily');

    expect(progress).toEqual({ total: 7, completed: 2 });
  });

  it('includes undated linked items in lifecycle progress but not an unrelated short period', () => {
    const input: GoalPeriodProgressInput = {
      ...emptyInput,
      learningItems: [{
        id: 'learning', title: 'Course', type: 'course', progress: 60,
        goalId: goal.id, createdAt, updatedAt: createdAt
      }]
    };

    expect(getGoalPeriodProgress(input, '2026-12-01', '2026-12-31', 'monthly'))
      .toEqual({ total: 0, completed: 0 });
    expect(getGoalPeriodProgress(input, '2026-01-01', '2026-12-31', 'lifecycle'))
      .toEqual({ total: 1, completed: 0.6 });
  });

  it('excludes scheduled work outside the Goal lifecycle bounds', () => {
    const progress = getGoalPeriodProgress({
      ...emptyInput,
      appointments: [{
        id: 'outside-goal',
        date: '2026-12-01',
        title: 'After target',
        status: 'scheduled',
        completed: false,
        goalId: goal.id,
        createdAt,
        updatedAt: createdAt
      }]
    }, '2026-11-08', '2026-11-30', 'lifecycle');

    expect(progress).toEqual({ total: 0, completed: 0 });
  });

  it('uses a linked item due date instead of its creation or edit date', () => {
    const progress = getGoalPeriodProgress({
      ...emptyInput,
      learningItems: [{
        id: 'future-course',
        title: 'Future course',
        type: 'course',
        progress: 0,
        targetDate: '2026-11-09',
        goalId: goal.id,
        createdAt,
        updatedAt: createdAt
      }]
    }, '2026-11-08', '2026-11-08', 'single_day');

    expect(progress).toEqual({ total: 0, completed: 0 });
  });
});

describe('getGoalHierarchyPeriodProgress', () => {
  it('aggregates a parent and descendant work once without averaging percentages', () => {
    const child: GoalPeriodProgressInput['goal'] = {
      ...goal,
      id: 'child',
      parentId: goal.id,
      date: '2026-01-01',
      targetDate: '2026-12-31'
    };
    const progress = getGoalHierarchyPeriodProgress({
      ...emptyInput,
      allGoals: [goal, child],
      appointments: [
        {
          id: 'parent-pending', date: '2026-11-08', title: 'Parent work',
          status: 'scheduled', completed: false, goalId: goal.id, createdAt, updatedAt: createdAt
        },
        {
          id: 'child-complete-1', date: '2026-11-08', title: 'Child work 1',
          status: 'completed', completed: true, goalId: child.id, createdAt, updatedAt: createdAt
        },
        {
          id: 'child-complete-2', date: '2026-11-09', title: 'Child work 2',
          status: 'completed', completed: true, goalId: child.id, createdAt, updatedAt: createdAt
        },
        {
          id: 'child-pending', date: '2026-11-10', title: 'Child work 3',
          status: 'scheduled', completed: false, goalId: child.id, createdAt, updatedAt: createdAt
        }
      ]
    }, '2026-11-01', '2026-11-30', 'monthly');

    expect(progress).toEqual({ total: 4, completed: 2 });
  });

  it('uses a child Goal manual progress only when its subtree has no linked work', () => {
    const child: GoalPeriodProgressInput['goal'] = {
      ...goal,
      id: 'child',
      parentId: goal.id,
      date: '2026-11-01',
      targetDate: '2026-11-30',
      progress: 50
    };
    const progress = getGoalHierarchyPeriodProgress({
      ...emptyInput,
      allGoals: [goal, child]
    }, '2026-11-01', '2026-11-30', 'monthly');

    expect(progress).toEqual({ total: 1, completed: 0.5 });
  });

  it('does not count a descendant twice when it is also linked to an ancestor', () => {
    const child: GoalPeriodProgressInput['goal'] = {
      ...goal,
      id: 'child',
      parentId: goal.id,
      date: '2026-01-01',
      targetDate: '2026-12-31'
    };
    const grandchild: GoalPeriodProgressInput['goal'] = {
      ...child,
      id: 'grandchild',
      parentId: child.id,
      parentIds: [goal.id]
    };
    const progress = getGoalHierarchyPeriodProgress({
      ...emptyInput,
      allGoals: [goal, child, grandchild],
      appointments: [{
        id: 'grandchild-work',
        date: '2026-11-08',
        title: 'Grandchild work',
        status: 'completed',
        completed: true,
        goalId: grandchild.id,
        createdAt,
        updatedAt: createdAt
      }]
    }, '2026-11-08', '2026-11-08', 'single_day');

    expect(progress).toEqual({ total: 1, completed: 1 });
  });

  it('does not count linked work outside the selected month', () => {
    const child: GoalPeriodProgressInput['goal'] = {
      ...goal,
      id: 'child',
      parentId: goal.id,
      date: '2026-11-01',
      targetDate: '2026-11-30'
    };
    const progress = getGoalHierarchyPeriodProgress({
      ...emptyInput,
      allGoals: [goal, child],
      appointments: [
        {
          id: 'completed-november', date: '2026-11-08', title: 'November work',
          status: 'completed', completed: true, goalId: goal.id, createdAt, updatedAt: createdAt
        },
        {
          id: 'pending-december', date: '2026-12-08', title: 'December work',
          status: 'scheduled', completed: false, goalId: child.id, createdAt, updatedAt: createdAt
        }
      ]
    }, '2026-11-01', '2026-11-30', 'monthly');

    expect(progress).toEqual({ total: 1, completed: 1 });
  });

  it('resolves tasks and habits linked through their Goal-linked routine', () => {
    const progress = getGoalHierarchyPeriodProgress({
      ...emptyInput,
      allGoals: [goal],
      tasks: [{
        id: 'routine-task',
        title: 'Routine task',
        domain: 'work',
        priority: 'Medium',
        routineId: 'routine',
        date: '2026-11-08',
        done: true,
        status: 'done',
        createdAt,
        updatedAt: createdAt
      }],
      allTasks: [{
        id: 'routine-task',
        title: 'Routine task',
        domain: 'work',
        priority: 'Medium',
        routineId: 'routine',
        date: '2026-11-08',
        done: true,
        status: 'done',
        createdAt,
        updatedAt: createdAt
      }],
      routines: [{
        id: 'routine',
        name: 'Routine',
        frequency: 'daily',
        category: 'work',
        active: true,
        goalId: goal.id,
        completedDates: ['2026-11-08'],
        createdAt,
        updatedAt: createdAt
      }],
      habits: [{
        id: 'habit',
        name: 'Habit',
        frequency: 'daily',
        timesPerDay: 2,
        routineId: 'routine',
        createdAt,
        updatedAt: createdAt
      }],
      habitLogs: [{
        id: 'habit-log',
        key: 'habit|2026-11-08|all',
        habitId: 'habit',
        date: '2026-11-08',
        occurrence: 'all',
        createdAt
      }]
    }, '2026-11-08', '2026-11-10', 'lifecycle');

    expect(progress).toEqual({ total: 10, completed: 4 });
  });
});
