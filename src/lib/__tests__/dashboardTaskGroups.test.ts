import { describe, expect, it } from 'vitest';
import type { Task } from '../../types';
import { getDashboardTaskGroups } from '../dashboardTaskGroups';

const makeTask = (id: string, values: Partial<Task> = {}): Task => ({
  id,
  title: id,
  domain: 'personal',
  priority: 'Medium',
  done: false,
  status: 'open',
  createdAt: 1,
  updatedAt: 1,
  ...values
});

describe('dashboard task groups', () => {
  it('separates overdue, today, inbox, and upcoming tasks without including completed tasks', () => {
    const groups = getDashboardTaskGroups([
      makeTask('overdue', { dueAt: '2026-11-02' }),
      makeTask('today', { dueAt: '2026-11-03T18:00' }),
      makeTask('today-by-date', { date: '2026-11-03' }),
      makeTask('inbox'),
      makeTask('legacy-undated', { date: '2026-11-01' }),
      makeTask('upcoming', { dueAt: '2026-11-05' }),
      makeTask('completed', { dueAt: '2026-11-03', done: true, status: 'done' })
    ], '2026-11-03');

    expect(groups.overdue.map(task => task.id)).toEqual(['overdue']);
    expect(groups.dueToday.map(task => task.id)).toEqual(['today', 'today-by-date']);
    expect(groups.inbox.map(task => task.id)).toEqual(['inbox', 'legacy-undated']);
    expect(groups.upcoming.map(task => task.id)).toEqual(['upcoming']);
    expect(groups.openTasks).not.toContainEqual(expect.objectContaining({ id: 'completed' }));
  });

  it('orders upcoming tasks by date before priority', () => {
    const groups = getDashboardTaskGroups([
      makeTask('later-high', { dueAt: '2026-11-06', priority: 'High' }),
      makeTask('sooner-low', { dueAt: '2026-11-04', priority: 'Low' })
    ], '2026-11-03');

    expect(groups.upcoming.map(task => task.id)).toEqual(['sooner-low', 'later-high']);
  });
});
