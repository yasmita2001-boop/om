import React from 'react';
import {
  CheckSquare, Target, Repeat, DollarSign,
  ArrowRight, ArrowUpRight, ArrowDownRight,
  Sparkles, CheckCircle2, Circle, Clock, FileText, BookOpen, Plus, Star
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  Task, Goal, Routine, Habit, HabitLog, FinanceTransaction,
  FinanceAccount, Note, JournalEntry, NavModule, DailyPlanner
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
  onNavigate: (module: NavModule) => void;
  onToggleTask: (id: string) => void;
  onLogHabit: (habitId: string, occurrence?: number) => void;
  onOpenQuickCapture: (type?: string) => void;
  onUpdatePlannerProgress: (progress: number) => void;
  onTogglePlannerPoint: (pointId: string) => void;
  currentUser?: User | null;
  onOpenDriveSync?: () => void;
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
  onNavigate,
  onToggleTask,
  onLogHabit,
  onOpenQuickCapture,
  onUpdatePlannerProgress,
  onTogglePlannerPoint,
  currentUser,
  onOpenDriveSync
}) => {
  const today = new Date().toISOString().slice(0, 10);

  // Filter tasks
  const openTasks = tasks.filter(t => !t.done);
  const todayTasks = openTasks.filter(t => t.dueAt === today || t.date === today);
  const priorityTasks = [...openTasks].sort((a, b) => {
    const pWeight = { High: 3, Medium: 2, Low: 1 };
    return (pWeight[b.priority] || 0) - (pWeight[a.priority] || 0);
  }).slice(0, 5);

  // Financial calculations
  let income = 0;
  let expense = 0;
  finance.forEach(f => {
    const amt = Number(f.amount) || 0;
    if (f.type === 'income') income += amt;
    else if (f.type === 'expense') expense += amt;
  });
  const netCashFlow = income - expense;
  const liquidCash = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

  // Habits today
  const todayHabitLogs = habitLogs.filter(l => l.date === today);
  const completedHabitsToday = habits.filter(h =>
    todayHabitLogs.some(l => l.habitId === h.id)
  ).length;

  const plannerPoints = dailyPlanner?.points || [];
  const completedPoints = plannerPoints.filter(p => p.done).length;
  const alignmentProgress = dailyPlanner?.progress ?? 0;

  const recentNotes = [...notes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
  }).slice(0, 3);

  const recentJournal = [...journal].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);

  return (
    <div className="space-y-6">
      {/* 1. Hero Executive Command Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-5 sm:p-7 shadow-sm border border-slate-800">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="max-w-2xl space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-indigo-400 text-xs font-semibold tracking-wider uppercase">
              <Sparkles className="h-4 w-4" />
              <span>Daily Command Center</span>
              {dailyPlanner?.mood && (
                <span className="rounded-lg bg-indigo-500/20 border border-indigo-400/30 px-2 py-0.5 text-[10px] text-indigo-200">
                  State: {dailyPlanner.mood}
                </span>
              )}
            </div>

            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white leading-snug">
              {dailyPlanner?.target || 'Execute with sovereign clarity, relentless focus, and measured compounding.'}
            </h1>

            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-slate-300">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="font-mono font-bold text-white tabular-nums">{todayTasks.length}</span>
                <span>due today</span>
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="font-mono font-bold text-white tabular-nums">{completedHabitsToday}/{habits.length || 0}</span>
                <span>habits checked</span>
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="font-mono font-bold text-emerald-400 tabular-nums">₹{liquidCash.toLocaleString('en-IN')}</span>
                <span>liquid reserve</span>
              </span>
            </div>
          </div>

          {/* Daily Alignment Score & Quick Capture Triggers */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0 bg-slate-800/70 border border-slate-700/70 rounded-2xl p-3.5 sm:min-w-[240px]">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-300">Daily Alignment</span>
                <span className="font-mono font-bold text-indigo-400">{alignmentProgress}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={alignmentProgress}
                onChange={e => onUpdatePlannerProgress(Number(e.target.value))}
                className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                title="Adjust Daily Execution Alignment"
              />
            </div>
            <div className="flex items-center gap-1.5 pt-1 border-t border-slate-700/60">
              <button
                type="button"
                onClick={() => onOpenQuickCapture('task')}
                className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors cursor-pointer"
              >
                <Plus className="h-3 w-3" /> Task
              </button>
              <button
                type="button"
                onClick={() => onOpenQuickCapture('note')}
                className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-slate-700 hover:bg-slate-600 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 transition-colors cursor-pointer"
              >
                <Plus className="h-3 w-3" /> Note
              </button>
              <button
                type="button"
                onClick={() => onOpenQuickCapture('expense')}
                className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-slate-700 hover:bg-slate-600 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 transition-colors cursor-pointer"
              >
                <Plus className="h-3 w-3" /> Ledger
              </button>
            </div>
          </div>
        </div>

        {/* Ambient subtle light glow */}
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* 2. Four High-Impact Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div
          onClick={() => onNavigate('tasks')}
          className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer min-w-0"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider truncate">Open Tasks</span>
            <CheckSquare className="h-4 w-4 text-emerald-500 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {openTasks.length}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-medium truncate">
            {todayTasks.length} scheduled for today
          </div>
        </div>

        <div
          onClick={() => onNavigate('goals')}
          className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer min-w-0"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider truncate">Strategic Goals</span>
            <Target className="h-4 w-4 text-indigo-500 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {goals.length}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-medium truncate">
            Active compounding vectors
          </div>
        </div>

        <div
          onClick={() => onNavigate('routine')}
          className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer min-w-0"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider truncate">Habits Today</span>
            <Repeat className="h-4 w-4 text-amber-500 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {completedHabitsToday}/{habits.length || 0}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-medium truncate">
            {habits.length > 0 ? Math.round((completedHabitsToday / habits.length) * 100) : 0}% completed today
          </div>
        </div>

        <div
          onClick={() => onNavigate('finance')}
          className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer min-w-0"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider truncate">Net Flow</span>
            <DollarSign className="h-4 w-4 text-emerald-600 shrink-0" />
          </div>
          <div className={`mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tabular-nums ${netCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            ₹{netCashFlow.toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-medium truncate">
            Liquid Reserve: ₹{liquidCash.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* 3. Daily Execution Checklist + Daily Checkpoints */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="lg:col-span-7 flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-emerald-500" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Today's Action Priorities
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('tasks')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3.5 space-y-2 flex-1">
            {priorityTasks.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                All scheduled priorities completed for today. Capture new targets anytime.
              </div>
            ) : (
              priorityTasks.map(task => {
                const linkedGoal = task.goalId ? goals.find(g => g.id === task.goalId) : undefined;
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 p-3 transition-colors hover:bg-slate-50/80 dark:border-slate-800/60 dark:hover:bg-slate-800/40"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <button
                        type="button"
                        onClick={() => onToggleTask(task.id)}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition-all cursor-pointer ${
                          task.done
                            ? 'border-emerald-600 bg-emerald-600 text-white shadow-2xs'
                            : 'border-slate-300 hover:border-indigo-500 dark:border-slate-600'
                        }`}
                      >
                        {task.done && '✓'}
                      </button>
                      <div className="min-w-0">
                        <div className={`truncate text-xs font-semibold ${task.done ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                          {task.title}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                          <span className="capitalize">{task.domain}</span>
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
                          {linkedGoal && (
                            <>
                              <span>·</span>
                              <span className="text-indigo-600 dark:text-indigo-400 font-semibold truncate max-w-[140px]">
                                🎯 {linkedGoal.title}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {plannerPoints.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                <span>Victory Checkpoints</span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {completedPoints}/{plannerPoints.length} Completed
                </span>
              </div>
              <div className="space-y-1.5">
                {plannerPoints.map(pt => (
                  <div
                    key={pt.id}
                    onClick={() => onTogglePlannerPoint(pt.id)}
                    className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    {pt.done ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-slate-300 dark:text-slate-600 shrink-0" />
                    )}
                    <span className={pt.done ? 'line-through text-slate-400' : ''}>
                      {pt.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Daily Routine Blocks & Habits (5 cols) */}
        <section className="lg:col-span-5 flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-500" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Routines & Habit Compounding
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('routine')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 flex items-center gap-1 cursor-pointer"
            >
              <span>Routines</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3.5 space-y-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Schedule Blocks
            </div>
            {routines.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                No active routines created yet.
              </div>
            ) : (
              routines.slice(0, 3).map(r => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-xl bg-slate-50/80 p-3 dark:bg-slate-850/50 text-xs border border-slate-100 dark:border-slate-800"
                >
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">{r.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      {r.startTime} {r.endTime ? `– ${r.endTime}` : ''}
                    </div>
                  </div>
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold capitalize">
                    {r.category.replace('_', ' ')}
                  </span>
                </div>
              ))
            )}

            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 pt-2">
              Atomic Habits
            </div>
            {habits.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                No habits configured yet.
              </div>
            ) : (
              habits.slice(0, 4).map(h => {
                const isDone = todayHabitLogs.some(l => l.habitId === h.id);
                return (
                  <div
                    key={h.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 p-2.5 dark:border-slate-800 text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate block">
                        {h.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {h.streak || 0} day streak
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onLogHabit(h.id)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                        isDone
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {isDone ? '✓ Logged' : 'Log'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* 4. Strategic Goals & Financial Overview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="lg:col-span-6 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-indigo-500" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Strategic Goals Portfolio
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
            {goals.slice(0, 3).map(goal => (
              <div key={goal.id} className="space-y-1.5">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="font-semibold text-slate-900 dark:text-white truncate pr-2">
                    {goal.title}
                  </span>
                  <span className="font-mono text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                    {goal.progress}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                    style={{ width: `${Math.max(0, Math.min(100, goal.progress))}%` }}
                  />
                </div>
                {goal.targetDate && (
                  <div className="text-[10px] text-slate-400 font-mono">
                    Target: {goal.targetDate}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-6 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Cash Flow & Treasury
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
            <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <ArrowDownRight className="h-3.5 w-3.5 text-emerald-600" />
                <span>Inflow</span>
              </div>
              <div className="mt-1 font-mono text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                ₹{income.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <ArrowUpRight className="h-3.5 w-3.5 text-rose-600" />
                <span>Outflow</span>
              </div>
              <div className="mt-1 font-mono text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                ₹{expense.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Recent Transactions
            </div>
            {finance.slice(0, 3).map(tx => (
              <div
                key={tx.id}
                className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 dark:border-slate-800/40 last:border-0"
              >
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{tx.category}</span>
                  {tx.note && <span className="ml-1.5 text-slate-400 truncate">({tx.note})</span>}
                </div>
                <span className={`font-mono font-bold tabular-nums ${tx.type === 'income' ? 'text-emerald-600' : 'text-slate-900 dark:text-white'}`}>
                  {tx.type === 'income' ? '+' : '-'} ₹{tx.amount.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 5. Knowledge Vault & Daily Reflections Snapshot */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="lg:col-span-6 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Knowledge Vault Highlights
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('notes')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 flex items-center gap-1 cursor-pointer"
            >
              <span>Vault ({notes.length})</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-3.5 space-y-2.5">
            {recentNotes.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">No notes in vault yet.</div>
            ) : (
              recentNotes.map(n => (
                <div
                  key={n.id}
                  onClick={() => onNavigate('notes')}
                  className="rounded-xl border border-slate-100 p-3 hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {n.pinned && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />}
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{n.title}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 shrink-0">{n.category}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                    {n.body}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="lg:col-span-6 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-500" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Recent Journal Reflections
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('journal')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 flex items-center gap-1 cursor-pointer"
            >
              <span>Journal ({journal.length})</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-3.5 space-y-2.5">
            {recentJournal.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">No reflections recorded yet.</div>
            ) : (
              recentJournal.map(j => (
                <div
                  key={j.id}
                  onClick={() => onNavigate('journal')}
                  className="rounded-xl border border-slate-100 p-3 hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{j.title}</span>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">{j.date} · {j.mood}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                    {j.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
