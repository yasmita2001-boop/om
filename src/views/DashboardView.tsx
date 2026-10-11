import React from 'react';
import {
  CheckSquare, Target, Repeat, DollarSign,
  ArrowUpRight, ArrowDownRight, Sparkles,
  BookOpen, Bell, ArrowRight
} from 'lucide-react';
import {
  Task, Goal, Routine, Habit, HabitLog, FinanceTransaction,
  FinanceAccount, Note, JournalEntry, NavModule, DailyPlanner,
  ReminderItem, AchievementItem
} from '../types';

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
  currentProfileName?: string;
  onNavigate: (module: NavModule) => void;
  onToggleTask: (id: string) => void;
  onLogHabit: (habitId: string, occurrence?: number) => void;
  onOpenQuickCapture: (type?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  tasks,
  goals,
  routines,
  habits,
  habitLogs,
  finance,
  accounts,
  notes,
  journal,
  dailyPlanner,
  reminders = [],
  achievements = [],
  onNavigate,
  onToggleTask,
  onLogHabit,
  onOpenQuickCapture,
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const priorityWeight: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
  const sortedTasks = [...tasks]
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
  const openTasks = sortedTasks;
  const todayTasks = sortedTasks.filter(t => (t.dueAt === today || t.date === today));

  // Financial calculations
  let income = 0;
  let expense = 0;
  let investment = 0;
  let savingsFlow = 0;
  let loanRepay = 0;
  let loanReceived = 0;
  finance.forEach(f => {
    const amt = Number(f.amount) || 0;
    if (f.type === 'income') income += amt;
    else if (f.type === 'expense') expense += amt;
    else if (f.type === 'investment') investment += amt;
    else if (f.type === 'savings') savingsFlow += amt;
    else if (f.type === 'repayment') loanRepay += amt;
    else if (f.type === 'loan') loanReceived += amt;
  });

  const operatingCashFlow = income - expense;
  const netCashFlow = operatingCashFlow - investment - savingsFlow - loanRepay + loanReceived;
  const liquidCash = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  const todayHabitLogs = habitLogs.filter(l => l.date === today);
  const activeReminders = [...reminders]
    .filter(r => r.status !== 'done')
    .sort((a, b) => (a.dueAt || '').localeCompare(b.dueAt || '') || (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Executive Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 p-5 sm:p-6 lg:p-7 text-white shadow-md border border-indigo-800/30">
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2 text-indigo-300 text-[11px] font-semibold tracking-wider uppercase">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-500/20 text-indigo-300 text-xs font-serif font-bold">ॐ</span>
            <span>Om-LifeOS Command Center</span>
          </div>
          <h1 className="mt-2.5 text-base sm:text-lg md:text-xl lg:text-2xl font-bold tracking-tight text-white leading-snug">
            Life can change your path, but never let it change who you become
          </h1>
          {dailyPlanner?.target && (
            <p className="mt-1.5 text-xs sm:text-sm text-slate-300/80 leading-relaxed">
              {dailyPlanner.target}
            </p>
          )}
        </div>

        {/* Subtle ambient lighting */}
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* 4 Essential Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Open Tasks</span>
            <CheckSquare className="h-4 w-4 text-emerald-500 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">
            {openTasks.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            {todayTasks.length} scheduled today
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Goals</span>
            <Target className="h-4 w-4 text-indigo-500 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">
            {goals.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            Active trajectories
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Habits Today</span>
            <Repeat className="h-4 w-4 text-amber-500 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">
            {todayHabitLogs.length}/{habits.length || 0}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            Logged for today
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Net Flow</span>
            <DollarSign className="h-4 w-4 text-emerald-600 shrink-0" />
          </div>
          <div className={`mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums truncate ${netCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            ₹{netCashFlow.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            Liquid: ₹{liquidCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Grid: Tasks & Planner + Habits */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Today's Tasks & Execution Checkpoints (7 cols) */}
        <section className="lg:col-span-7 flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
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
                  {todayTasks.length} pending for today · {dailyPlanner?.points?.filter(p => p.done).length || 0} checkpoints completed
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
            {todayTasks.length === 0 && openTasks.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                All scheduled tasks completed. Capture new priorities anytime.
              </div>
            ) : (
              [...todayTasks, ...openTasks.filter(t => !todayTasks.some(tt => tt.id === t.id))].slice(0, 5).map(task => (
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
                        <span className={task.priority === 'High' ? 'font-bold text-rose-500' : ''}>
                          {task.priority} Priority
                        </span>
                        {task.dueAt && (
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

        {/* Habit Consistency & Rituals (5 cols) */}
        <section className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
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
              <div className="py-12 text-center text-xs text-slate-400">
                No habits configured. Define recurring rituals in Routine.
              </div>
            ) : (
              habits.slice(0, 5).map(habit => {
                const isDone = todayHabitLogs.some(l => l.habitId === habit.id);
                return (
                  <div
                    key={habit.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 p-3.5 dark:border-slate-800/60"
                  >
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">{habit.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {habit.frequency || 'Daily'} · {habit.timesPerDay || 1}x daily
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onLogHabit(habit.id)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
                        isDone
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {isDone ? '✓ Logged' : 'Log Habit'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Grid: Financial Flow Overview + Strategic Goals */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Strategic Goals (6 cols) */}
        <section className="lg:col-span-6 flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
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
            {goals.slice(0, 4).map(goal => (
              <div key={goal.id} className="space-y-1.5">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="font-semibold text-slate-900 dark:text-white truncate pr-2">{goal.title}</span>
                  <span className="font-mono text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                    {goal.progress}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-300"
                    style={{ width: `${Math.max(0, Math.min(100, goal.progress))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Financial Flow & Cashflow Overview (6 cols) */}
        <section className="lg:col-span-6 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
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
            <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <ArrowDownRight className="h-3.5 w-3.5 text-emerald-600" />
                <span>Operating Inflow</span>
              </div>
              <div className="mt-1 font-mono text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                ₹{income.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <ArrowUpRight className="h-3.5 w-3.5 text-rose-600" />
                <span>Operating Outflow</span>
              </div>
              <div className="mt-1 font-mono text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                ₹{expense.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>

          {/* Quick Transaction stream */}
          <div className="mt-4 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Recent Activity
            </div>
            {[...finance].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 3).map(tx => (
              <div
                key={tx.id}
                className="flex items-center justify-between text-xs sm:text-sm py-1.5 border-b border-slate-50 dark:border-slate-800/40 last:border-0"
              >
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{tx.category}</span>
                  {tx.note && <span className="ml-1.5 text-slate-400 truncate">({tx.note})</span>}
                </div>
                <span className={`font-mono font-bold tabular-nums ${tx.type === 'income' ? 'text-emerald-600' : 'text-slate-900 dark:text-white'}`}>
                  {tx.type === 'income' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Grid: Active Reminders + Achievements */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Reminders (6 cols) */}
        <section className="lg:col-span-6 flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
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
              <div className="py-8 text-center text-xs text-slate-400">
                No pending reminders. All clear!
              </div>
            ) : (
              activeReminders.map(rem => {
                const isAlarm = rem.alarmEnabled !== false;
                const timePart = rem.dueAt && rem.dueAt.includes('T') ? rem.dueAt.split('T')[1].slice(0, 5) : '';
                const datePart = rem.dueAt && rem.dueAt.includes('T') ? rem.dueAt.split('T')[0] : (rem.dueAt || '');
                return (
                  <div key={rem.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-xs sm:text-sm dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                    <div className="flex items-center gap-2.5 truncate pr-2">
                      <span className="text-base shrink-0">{isAlarm ? '⏰' : '📌'}</span>
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

        {/* Quick Capture Panel (6 cols) */}
        <section className="lg:col-span-6 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-bold">
              ⚡
            </div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Instant Quick Capture Routing
            </h2>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => onOpenQuickCapture('task')}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-left transition-all hover:bg-indigo-50 hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-800 cursor-pointer"
            >
              <CheckSquare className="h-4 w-4 text-emerald-500 mb-1" />
              <div className="text-xs font-bold text-slate-900 dark:text-white">Task</div>
              <div className="text-[10px] text-slate-400">To Planner</div>
            </button>

            <button
              type="button"
              onClick={() => onOpenQuickCapture('note')}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-left transition-all hover:bg-indigo-50 hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-800 cursor-pointer"
            >
              <BookOpen className="h-4 w-4 text-amber-500 mb-1" />
              <div className="text-xs font-bold text-slate-900 dark:text-white">Note</div>
              <div className="text-[10px] text-slate-400">To Notebooks</div>
            </button>

            <button
              type="button"
              onClick={() => onOpenQuickCapture('journal')}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-left transition-all hover:bg-indigo-50 hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-800 cursor-pointer"
            >
              <Sparkles className="h-4 w-4 text-blue-500 mb-1" />
              <div className="text-xs font-bold text-slate-900 dark:text-white">Journal</div>
              <div className="text-[10px] text-slate-400">Reflection</div>
            </button>

            <button
              type="button"
              onClick={() => onOpenQuickCapture('expense')}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-left transition-all hover:bg-indigo-50 hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-800 cursor-pointer"
            >
              <DollarSign className="h-4 w-4 text-emerald-600 mb-1" />
              <div className="text-xs font-bold text-slate-900 dark:text-white">Expense</div>
              <div className="text-[10px] text-slate-400">To Ledger</div>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
