import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare, Target, Repeat, DollarSign,
  ArrowUpRight, ArrowDownRight, Sparkles,
  BookOpen, Bell, ArrowRight, Plus
} from 'lucide-react';
import {
  Task, Goal, Routine, Habit, HabitLog, FinanceTransaction,
  FinanceAccount, Note, JournalEntry, NavModule, DailyPlanner,
  ReminderItem, AchievementItem
} from '../types';
import { getLocalDateString } from '../lib/dateUtils';
import { OmLogoMark } from '../components/OmLogoMark';
import { EmptyState } from '../components/EmptyState';
import { ThemeIcon } from '../components/ThemeIcon';

interface DashboardViewProps {
  tasks: Task[];
  goals: Goal[];
  routines: Routine[];
  habits: Habit[];
  habitLogs: HabitLog[];
  finance: FinanceTransaction[];
  accounts: FinanceAccount[];
  notes: Note[];
  journal: JournalEntry[];
  dailyPlanner?: DailyPlanner;
  reminders?: ReminderItem[];
  achievements?: AchievementItem[];
  onNavigate: (module: NavModule) => void;
  onToggleTask: (id: string) => void;
  onLogHabit: (habitId: string, occurrence?: number | 'all') => void;
  onOpenQuickCapture: (type?: string) => void;
}

const sortTasks = (tasks: Task[]) => {
  const priorityWeight: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
  return [...tasks]
    .filter(t => !t.done)
    .sort((a, b) => {
      if (a.dueAt && b.dueAt) {
        const d = a.dueAt.localeCompare(b.dueAt);
        if (d !== 0) return d;
      } else if (a.dueAt) return -1;
      else if (b.dueAt) return 1;
      const pA = priorityWeight[a.priority] || 0;
      const pB = priorityWeight[b.priority] || 0;
      if (pA !== pB) return pB - pA;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
};

const calculateFinances = (finance: FinanceTransaction[]) => {
  let income = 0;
  let expense = 0;
  let investment = 0;
  let savingsFlow = 0;
  let savingsDeposits = 0;
  let savingsWithdrawals = 0;
  let loanRepay = 0;
  let loanReceived = 0;
  let loanGiven = 0;
  let loanRecovered = 0;
  let adjustmentCredits = 0;
  let adjustmentDebits = 0;
  finance.forEach(f => {
    const amt = Number(f.amount) || 0;
    if (f.ledgerOnly) return;
    if (f.type === 'income') income += amt;
    else if (f.type === 'expense') expense += amt;
    else if (f.type === 'investment') investment += amt;
    else if (f.type === 'savings') {
      savingsFlow += amt;
      savingsDeposits += amt;
    } else if (f.type === 'savingsWithdrawal') {
      savingsFlow -= amt;
      savingsWithdrawals += amt;
    }
    else if (f.type === 'repayment') loanRepay += amt;
    else if (f.type === 'loan') loanReceived += amt;
    else if (f.type === 'loanGiven') loanGiven += amt;
    else if (f.type === 'loanReceipt') {
      loanRecovered += Number(f.principal) || 0;
      income += Number(f.interest) || 0;
    } else if (f.type === 'adjustment') {
      if (f.adjustmentDirection === 'credit') adjustmentCredits += amt;
      else adjustmentDebits += amt;
    }
  });
  const operatingCashFlow = income - expense;
  const netCashFlow = operatingCashFlow - investment - savingsFlow - loanRepay + loanReceived - loanGiven + loanRecovered + adjustmentCredits - adjustmentDebits;
  const totalInflow = income + loanReceived + savingsWithdrawals + loanRecovered + adjustmentCredits;
  const totalOutflow = expense + investment + savingsDeposits + loanRepay + loanGiven + adjustmentDebits;
  return { totalInflow, totalOutflow, netCashFlow };
};

const getTodayHabitLogs = (habitLogs: HabitLog[], today: string) => {
  return habitLogs.filter(l => l.date === today);
};

const getHabitProgress = (habit: Habit, logs: HabitLog[]) => {
  const target = Math.max(1, Number(habit.timesPerDay) || 1);
  const occurrences = new Set(
    logs
      .flatMap(log => log.habitId === habit.id && typeof log.occurrence === 'number' ? [log.occurrence] : [])
  );
  const complete = logs.some(log => log.habitId === habit.id && log.occurrence === 'all')
    ? target
    : Math.min(target, occurrences.size);

  return { target, complete, occurrences };
};

const getActiveReminders = (reminders: ReminderItem[]) => {
  return [...reminders]
    .filter(r => r.status !== 'done')
    .sort((a, b) => (a.dueAt || '').localeCompare(b.dueAt || '') || (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 5);
};

const DashboardView: React.FC<DashboardViewProps> = ({
  tasks,
  goals,
  habits,
  habitLogs,
  finance,
  accounts,
  dailyPlanner,
  reminders = [],
  onNavigate,
  onToggleTask,
  onLogHabit,
  onOpenQuickCapture,
}) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const today = getLocalDateString(now);

  const sortedTasks = useMemo(() => sortTasks(tasks), [tasks]);
  const openTasks = sortedTasks;
  const todayTasks = sortedTasks.filter(t => (t.dueAt === today || t.date === today));
  const overdueTasks = sortedTasks.filter(t => Boolean(t.dueAt && t.dueAt < today));
  const dashboardTasks = [
    ...overdueTasks,
    ...todayTasks.filter(task => !overdueTasks.some(overdue => overdue.id === task.id)),
    ...openTasks.filter(task => !task.dueAt && (!task.date || task.date < today))
  ].slice(0, 5);
  const upcomingTaskCount = openTasks.filter(task => task.dueAt && task.dueAt > today).length;
  const activeGoals = goals.filter(goal => !goal.status || goal.status === 'active');

  const { totalInflow, totalOutflow, netCashFlow } = useMemo(() => calculateFinances(finance), [finance]);

  const liquidCash = useMemo(() => accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0), [accounts]);

  const todayHabitLogs = useMemo(() => getTodayHabitLogs(habitLogs, today), [habitLogs, today]);
  const habitProgress = useMemo(
    () => new Map(habits.map(habit => [habit.id, getHabitProgress(habit, todayHabitLogs)])),
    [habits, todayHabitLogs]
  );
  const completedHabitCount = habits.filter(habit => {
    const progress = habitProgress.get(habit.id);
    return progress && progress.complete >= progress.target;
  }).length;

  const activeReminders = useMemo(() => getActiveReminders(reminders), [reminders]);

  const currentHour = now.getHours();
  const timeGreeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="dashboard-view space-y-4 sm:space-y-5">
      <div className="dashboard-hero flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white/80 p-4 sm:p-5 backdrop-blur-xl shadow-2xs dark:border-white/[0.08] dark:bg-[#070A12]/80">
        <div className="flex items-center gap-3">
          <OmLogoMark className="h-[3.4rem] w-11 shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {timeGreeting}
              </h1>
            </div>
            <p className="mt-1 font-display text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Build the life you love
            </p>
            <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">
              Small steps every day. Big dreams tomorrow.
            </p>
            <p className="mt-1.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
              {dailyPlanner?.date === today && dailyPlanner.target
                ? dailyPlanner.target
                : `${todayTasks.length} priorities today · ${activeGoals.length} active goals`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onOpenQuickCapture('task')}
          className="inline-flex min-h-10 items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-amber-700 transition-colors hover:text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:text-amber-300 dark:hover:text-amber-200 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Quick capture
        </button>
      </div>

      {/* 4 Essential Metric Cards */}
      <div className="metric-summary-grid grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-raised dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Open Tasks</span>
            <CheckSquare className="h-4 w-4 text-emerald-500 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">
            {openTasks.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            {todayTasks.length} due today · {overdueTasks.length} overdue
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-raised dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Goals</span>
            <Target className="h-4 w-4 text-indigo-500 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">
            {activeGoals.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            Active trajectories
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-raised dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Habits Today</span>
            <Repeat className="h-4 w-4 text-amber-500 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">
            {completedHabitCount}/{habits.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            Completed today
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-raised dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Net Flow</span>
            <DollarSign className="h-4 w-4 text-emerald-600 shrink-0" />
          </div>
          <div className={`mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums truncate ${netCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            NPR {netCashFlow.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            Ledger · Cash NPR {liquidCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Grid: Tasks & Planner + Habits (independent columns - no void stretching) */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Left column (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
        {/* Today's Tasks & Execution Checkpoints (7 cols) */}
        <section className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                <CheckSquare className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Today's Priority Tasks & Planner
                </h2>
                <span className="text-[11px] text-slate-400 font-medium">
                  {todayTasks.length} due today · {overdueTasks.length} overdue · {dailyPlanner?.date === today ? dailyPlanner.points.filter(p => p.done).length : 0} checkpoints completed
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('tasks')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 flex items-center gap-1 cursor-pointer"
            >
              <span>Full Planner</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-4 space-y-2.5">
            {dashboardTasks.length === 0 ? (
              <EmptyState
                icon={CheckSquare}
                compact
                title={upcomingTaskCount ? 'Nothing due today' : 'All caught up'}
                hint={upcomingTaskCount
                  ? `${upcomingTaskCount} upcoming task${upcomingTaskCount === 1 ? '' : 's'} scheduled - you are ahead of the day.`
                  : 'Capture a priority anytime with Quick Capture.'}
              />
            ) : (
              dashboardTasks.map(task => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-100 p-3.5 transition-all hover:bg-slate-50/80 hover:border-slate-200 dark:border-slate-800/60 dark:hover:bg-slate-800/40"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => onToggleTask(task.id)}
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition-all cursor-pointer ${
                        task.done
                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                          : 'border-slate-300 hover:border-indigo-500 dark:border-slate-600'
                      }`}
                    >
                      {task.done && '✓'}
                    </button>
                    <div className="min-w-0">
                      <div className={`truncate text-xs font-semibold ${task.done ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                        {task.title}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="capitalize font-medium">{task.domain}</span>
                        <span>·</span>
                        <span className={task.dueAt && task.dueAt < today ? 'font-bold text-rose-500' : task.priority === 'High' ? 'font-bold text-rose-500' : ''}>
                          {task.dueAt && task.dueAt < today ? 'Overdue' : `${task.priority} Priority`}
                        </span>
                        {task.dueAt && task.dueAt >= today && (
                          <>
                            <span>·</span>
                            <span>Due {task.dueAt}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
        </div>

        {/* Right column (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
        {/* Habit Consistency & Rituals (5 cols) */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                <Repeat className="h-4.5 w-4.5" />
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Habit Tracking
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('routine')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 flex items-center gap-1 cursor-pointer"
            >
              <span>Habits</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-4 space-y-2.5">
            {habits.length === 0 ? (
              <EmptyState
                icon={Repeat}
                compact
                title="No habits configured"
                hint="Define recurring rituals in Routine to see them here."
              />
            ) : (
              habits.slice(0, 5).map(habit => {
                const progress = habitProgress.get(habit.id) || { target: 1, complete: 0, occurrences: new Set<number>() };
                const isDone = progress.complete >= progress.target;
                const hasAllLog = todayHabitLogs.some(log => log.habitId === habit.id && log.occurrence === 'all');
                const nextOccurrence = isDone
                  ? hasAllLog ? 'all' : [...progress.occurrences].sort((a, b) => b - a)[0] ?? progress.target - 1
                  : Array.from({ length: progress.target }, (_, index) => index).find(index => !progress.occurrences.has(index)) ?? 0;
                return (
                  <div
                    key={habit.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 p-3.5 dark:border-slate-800/60"
                  >
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">{habit.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {habit.frequency || 'Daily'} · {progress.complete}/{progress.target} today
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onLogHabit(habit.id, nextOccurrence)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
                        isDone
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {isDone ? '✓ Done · Undo' : 'Log next'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>
        </div>
      </div>

            {/* Grid: Financial Flow Overview + Strategic Goals (independent column stacks) */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Left column (6 cols): goals flows into reminders */}
        <div className="space-y-6 lg:col-span-6">
{/* Strategic Goals (6 cols) */}
        <section className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                <Target className="h-4.5 w-4.5" />
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Strategic Goals & Trajectory
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('goals')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 flex items-center gap-1 cursor-pointer"
            >
              <span>Goals</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {activeGoals.length === 0 ? (
              <EmptyState
                icon={Target}
                compact
                title="No active goals yet"
                hint="Create or activate a goal to track its trajectory here."
              />
            ) : activeGoals.slice(0, 4).map(goal => (
              <div key={goal.id} className="space-y-1.5">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="font-semibold text-slate-900 dark:text-white truncate pr-2">{goal.title}</span>
                  <span className="font-mono text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                    {Math.round(Number(goal.progress) || 0)}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-300"
                    style={{ width: `${Math.max(0, Math.min(100, Number(goal.progress) || 0))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
{/* Reminders (6 cols) */}
        <section className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
                <Bell className="h-4.5 w-4.5" />
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">Active Reminders</h2>
            </div>
            <button
              type="button"
              onClick={() => onOpenQuickCapture('reminder')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 cursor-pointer"
            >
              + Add Reminder
            </button>
          </div>

          <div className="mt-4 space-y-2.5">
            {activeReminders.length === 0 ? (
              <EmptyState icon={Bell} compact title="All clear" hint="No reminders waiting on you right now." />
            ) : (
              activeReminders.map(rem => {
                const isAlarm = rem.alarmEnabled !== false;
                const timePart = rem.dueAt && rem.dueAt.includes('T') ? rem.dueAt.split('T')[1].slice(0, 5) : '';
                const datePart = rem.dueAt && rem.dueAt.includes('T') ? rem.dueAt.split('T')[0] : (rem.dueAt || '');
                return (
                  <div key={rem.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-xs sm:text-sm dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                    <div className="flex items-center gap-2.5 truncate pr-2">
                      <ThemeIcon name={isAlarm ? 'alarm' : 'target'} className="h-4 w-4" />
                      <div className="truncate">
                        <span className="font-semibold text-slate-900 dark:text-white block truncate">{rem.title}</span>
                        <span className="text-[11px] text-slate-400">
                          {datePart} {timePart && `at ${timePart}`}
                        </span>
                      </div>
                    </div>
                    {isAlarm && (
                      <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                        Alarm Active
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
        </div>

        {/* Right column (6 cols): cashflow flows into quick capture */}
        <div className="space-y-6 lg:col-span-6">
{/* Financial Flow & Cashflow Overview (6 cols) */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <DollarSign className="h-4.5 w-4.5" />
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Cashflow Breakdown
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('finance')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 flex items-center gap-1 cursor-pointer"
            >
              <span>Ledger</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="min-w-0 rounded-xl border-2 border-dashed border-slate-200 p-3.5 dark:border-slate-800">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <ArrowDownRight className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span className="min-w-0">Inflow · all time</span>
              </div>
              <div className="mt-1 font-mono text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                <span className="whitespace-nowrap">NPR</span>{' '}
                <span className="whitespace-nowrap tabular-nums">{totalInflow.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>

            <div className="min-w-0 rounded-xl border-2 border-dashed border-slate-200 p-3.5 dark:border-slate-800">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                <span className="min-w-0">Outflow · all time</span>
              </div>
              <div className="mt-1 font-mono text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                <span className="whitespace-nowrap">NPR</span>{' '}
                <span className="whitespace-nowrap tabular-nums">{totalOutflow.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </div>

          {/* Quick Transaction stream */}
          <div className="mt-4 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Recent Activity
            </div>
            {finance.length === 0 ? (
              <EmptyState
                icon={DollarSign}
                compact
                title="No transactions yet"
                hint="Recent ledger activity will appear here."
              />
            ) : [...finance].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 3).map(tx => {
              const isInflow = tx.type === 'income' || tx.type === 'loan' || tx.type === 'loanReceipt' ||
                tx.type === 'savingsWithdrawal' ||
                (tx.type === 'adjustment' && tx.adjustmentDirection === 'credit');
              const isTransfer = tx.type === 'transfer';
              const isLedgerOnly = Boolean(tx.ledgerOnly);
              return (
              <div
                key={tx.id}
                className="flex items-center justify-between gap-2 min-w-0 text-xs sm:text-sm py-1.5 border-b border-slate-50 dark:border-slate-800/40 last:border-0"
              >
                <div className="min-w-0 flex-1 truncate">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{tx.category}</span>
                  {tx.note && <span className="ml-1.5 text-slate-400">({tx.note})</span>}
                </div>
                <span className={`shrink-0 font-mono font-bold tabular-nums ${isLedgerOnly ? 'text-slate-500' : isInflow ? (tx.type === 'loan' ? 'text-teal-600 dark:text-teal-400' : 'text-emerald-600') : 'text-slate-900 dark:text-white'}`}>
                  {isLedgerOnly ? '' : isInflow ? '+' : isTransfer ? '⇄ ' : '-'}NPR {Number(tx.amount || 0).toLocaleString('en-IN')}
                </span>
              </div>
              );
            })}
          </div>
        </section>
{/* Quick Capture Panel (6 cols) */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-bold">
              <ThemeIcon name="zap" className="h-4 w-4" />
            </div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Instant Quick Capture Routing
            </h2>
          </div>

          <div className="mt-4 grid grid-cols-2 xl:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => onOpenQuickCapture('task')}
              className="min-w-0 rounded-xl border-2 border-dashed border-slate-200 p-3 text-left transition-colors hover:border-amber-400 dark:border-slate-800 dark:hover:border-amber-700 cursor-pointer"
            >
              <CheckSquare className="h-4 w-4 text-emerald-500 mb-1" />
              <div className="text-xs font-bold text-slate-900 dark:text-white">Task</div>
              <div className="break-words text-[10px] text-slate-400">To Planner</div>
            </button>

            <button
              type="button"
              onClick={() => onOpenQuickCapture('note')}
              className="min-w-0 rounded-xl border-2 border-dashed border-slate-200 p-3 text-left transition-colors hover:border-amber-400 dark:border-slate-800 dark:hover:border-amber-700 cursor-pointer"
            >
              <BookOpen className="h-4 w-4 text-amber-500 mb-1" />
              <div className="text-xs font-bold text-slate-900 dark:text-white">Note</div>
              <div className="break-words text-[10px] text-slate-400">To Notebooks</div>
            </button>

            <button
              type="button"
              onClick={() => onOpenQuickCapture('journal')}
              className="min-w-0 rounded-xl border-2 border-dashed border-slate-200 p-3 text-left transition-colors hover:border-amber-400 dark:border-slate-800 dark:hover:border-amber-700 cursor-pointer"
            >
              <Sparkles className="h-4 w-4 text-blue-500 mb-1" />
              <div className="text-xs font-bold text-slate-900 dark:text-white">Journal</div>
              <div className="break-words text-[10px] text-slate-400">Reflection</div>
            </button>

            <button
              type="button"
              onClick={() => onOpenQuickCapture('expense')}
              className="min-w-0 rounded-xl border-2 border-dashed border-slate-200 p-3 text-left transition-colors hover:border-amber-400 dark:border-slate-800 dark:hover:border-amber-700 cursor-pointer"
            >
              <DollarSign className="h-4 w-4 text-emerald-600 mb-1" />
              <div className="text-xs font-bold text-slate-900 dark:text-white">Expense</div>
              <div className="break-words text-[10px] text-slate-400">To Ledger</div>
            </button>
          </div>
        </section>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
