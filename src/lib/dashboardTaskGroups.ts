import type { Task } from '../types';

const getTaskDay = (task: Task) => (task.dueAt || task.date || '').slice(0, 10);

const sortTasks = (tasks: Task[]) => {
  const priorityWeight = { High: 3, Medium: 2, Low: 1 };
  return [...tasks].sort((a, b) => {
    const dayDifference = getTaskDay(a).localeCompare(getTaskDay(b));
    if (dayDifference !== 0) return dayDifference;

    const priorityDifference = priorityWeight[b.priority] - priorityWeight[a.priority];
    if (priorityDifference !== 0) return priorityDifference;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
};

export const getDashboardTaskGroups = (tasks: Task[], today: string) => {
  const openTasks = sortTasks(tasks.filter(task => !task.done));
  const dueToday = openTasks.filter(task => getTaskDay(task) === today);
  const overdue = openTasks.filter(task => Boolean(task.dueAt && getTaskDay(task) < today));
  const upcoming = openTasks.filter(task => getTaskDay(task) > today);
  const inbox = openTasks.filter(task =>
    !getTaskDay(task) || (!task.dueAt && getTaskDay(task) < today)
  );

  return { openTasks, dueToday, overdue, inbox, upcoming };
};
