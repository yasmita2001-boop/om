import { getCurrencySymbol } from '../lib/currencyDisplay';
import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare, Target, Repeat, DollarSign, Check,
  ArrowUpRight, ArrowDownRight,
  Bell, ArrowRight, BookOpen, BookHeart,
  Timer, Heart, Archive
} from 'lucide-react';
import {
  Task, Goal, Habit, HabitLog, FinanceTransaction,
  NavModule, ReminderItem, FinanceAccount, Asset, Liability,
  Loan, Investment, InvestmentActivity, SavingsPlan
} from '../types';
import { getLocalDateString } from '../lib/dateUtils';
import { ThemeIcon } from '../components/ThemeIcon';
import { getDashboardTaskGroups } from '../lib/dashboardTaskGroups';
import { getFinancialPosition } from '../lib/financeCalculations';

interface DashboardViewProps {
  tasks: Task[];
  goals: Goal[];
  habits: Habit[];
  habitLogs: HabitLog[];
  finance: FinanceTransaction[];
  accounts?: FinanceAccount[];
  assets?: Asset[];
  liabilities?: Liability[];
  loans?: Loan[];
  investments?: Investment[];
  investmentActivities?: InvestmentActivity[];
  savingsPlans?: SavingsPlan[];
  reminders?: ReminderItem[];
  loading?: boolean;
  onNavigate: (module: NavModule) => void;
  onToggleTask: (id: string) => void;
  onLogHabit: (habitId: string, occurrence?: number | 'all') => void;
  onOpenQuickCapture: (type?: string) => void;
}

const SkeletonPulse: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700 ${className}`} />
);

const DashboardSkeleton: React.FC = () => (
  <div className="dashboard-view space-y-4">
    <SkeletonPulse className="h-20 w-full rounded-2xl" />
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-7">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 dark:border-slate-800">
            <SkeletonPulse className="h-8 w-8 rounded-xl" />
            <SkeletonPulse className="h-5 w-28" />
          </div>
          <div className="mt-3 space-y-2">
            {[1, 2, 3].map(i => <SkeletonPulse key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 dark:border-slate-800">
            <SkeletonPulse className="h-8 w-8 rounded-xl" />
            <SkeletonPulse className="h-5 w-20" />
          </div>
          <div className="mt-3 space-y-3">
            {[1, 2].map(i => <SkeletonPulse key={i} className="h-10 w-full" />)}
          </div>
        </div>
      </div>
      <div className="space-y-4 lg:col-span-5">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 dark:border-slate-800">
            <SkeletonPulse className="h-8 w-8 rounded-xl" />
            <SkeletonPulse className="h-5 w-20" />
          </div>
          <div className="mt-3 space-y-2">
            {[1, 2, 3].map(i => <SkeletonPulse key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        </div>
        <SkeletonPulse className="h-48 w-full rounded-2xl" />
      </div>
    </div>
  </div>
);

const calculateFinances = (finance: FinanceTransaction[]) => {
  let income = 0;
  let expense = 0;
  let investment = 0;
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
      savingsDeposits += amt;
    } else if (f.type === 'savingsWithdrawal') {
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
  const totalInflow = income + loanReceived + savingsWithdrawals + loanRecovered + adjustmentCredits;
  const totalOutflow = expense + investment + savingsDeposits + loanRepay + loanGiven + adjustmentDebits;
  return { totalInflow, totalOutflow };
};

const getFinanceOutflowAmount = (transaction: FinanceTransaction) => {
  if (transaction.ledgerOnly) return 0;
  const amount = Math.max(0, Number(transaction.amount) || 0);
  if (
    transaction.type === 'expense' ||
    transaction.type === 'investment' ||
    transaction.type === 'savings' ||
    transaction.type === 'repayment' ||
    transaction.type === 'loanGiven' ||
    transaction.type === 'transfer' ||
    (transaction.type === 'adjustment' && transaction.adjustmentDirection !== 'credit')
  ) return amount;
  return 0;
};

const getFinanceInflowAmount = (transaction: FinanceTransaction) => {
  if (transaction.ledgerOnly) return 0;
  const amount = Math.max(0, Number(transaction.amount) || 0);
  if (transaction.type === 'loanReceipt') {
    return (Number(transaction.principal) || 0) + (Number(transaction.interest) || 0);
  }
  if (
    transaction.type === 'income' ||
    transaction.type === 'loan' ||
    transaction.type === 'savingsWithdrawal' ||
    (transaction.type === 'adjustment' && transaction.adjustmentDirection === 'credit')
  ) return amount;
  if (transaction.type === 'transfer') return amount;
  return 0;
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
  accounts = [],
  assets = [],
  liabilities = [],
  loans = [],
  investments = [],
  investmentActivities = [],
  savingsPlans = [],
  reminders = [],
  loading = false,
  onNavigate,
  onToggleTask,
  onLogHabit,
  onOpenQuickCapture,
}) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const scheduleAtMidnight = () => {
      const tomorrow = new Date();
      tomorrow.setHours(24, 0, 0, 0);
      const ms = tomorrow.getTime() - Date.now();
      // Guard against negative/zero from clock drift; floor at 1 s
      return window.setTimeout(() => {
        setNow(new Date());
        timerId = scheduleAtMidnight();
      }, Math.max(ms, 1_000));
    };
    let timerId = scheduleAtMidnight();
    return () => window.clearTimeout(timerId);
  }, []);

  const today = getLocalDateString(now);

  const { dueToday, overdue, inbox, upcoming } = useMemo(
    () => getDashboardTaskGroups(tasks, today),
    [tasks, today]
  );
  const maxOverdueShown = 5;
  const shownOverdue = overdue.slice(0, maxOverdueShown);
  const hiddenOverdueCount = overdue.length - shownOverdue.length;
  const upcomingTasks = upcoming;
  const inboxTasks = inbox;
  const hasTaskContent = dueToday.length > 0 || overdue.length > 0 || inboxTasks.length > 0 || upcomingTasks.length > 0;
  const activeGoals = goals.filter(goal => !goal.status || goal.status === 'active');
  const financialPosition = getFinancialPosition({
    accounts,
    assets,
    liabilities,
    loans,
    investments,
    investmentActivities,
    savingsPlans
  });

  const monthFinance = useMemo(
    () => finance.filter(transaction => transaction.date?.startsWith(today.slice(0, 7))),
    [finance, today]
  );
  const { totalInflow, totalOutflow } = useMemo(
    () => calculateFinances(monthFinance),
    [monthFinance]
  );
  const weeklyFinance = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      const daysSinceMonday = (date.getDay() + 6) % 7;
      date.setDate(date.getDate() - daysSinceMonday + index);
      const dateKey = getLocalDateString(date);
      return {
        date: dateKey,
        label: date.toLocaleDateString(undefined, { weekday: 'short' }),
        isFuture: dateKey > today,
        inflow: 0,
        spending: 0
      };
    });
    const amountsByDate = new Map(days.map(day => [day.date, { inflow: 0, spending: 0 }]));
    finance.forEach(transaction => {
      if (transaction.date > today) return;
      const amounts = amountsByDate.get(transaction.date);
      if (!amounts) return;
      amounts.inflow += getFinanceInflowAmount(transaction);
      amounts.spending += getFinanceOutflowAmount(transaction);
    });
    return days.map(day => ({
      ...day,
      ...(amountsByDate.get(day.date) || { inflow: 0, spending: 0 })
    }));
  }, [finance, now, today]);
  const weeklyFinanceMax = Math.max(...weeklyFinance.flatMap(day => [day.inflow, day.spending]), 0);
  const weeklyInflowTotal = weeklyFinance.reduce((sum, day) => sum + day.inflow, 0);
  const weeklySpendingTotal = weeklyFinance.reduce((sum, day) => sum + day.spending, 0);
  const formatCompactAmount = (amount: number) => amount === 0
    ? '–'
    : new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(amount);

  const todayHabitLogs = useMemo(() => getTodayHabitLogs(habitLogs, today), [habitLogs, today]);
  const habitProgress = useMemo(
    () => new Map(habits.map(habit => [habit.id, getHabitProgress(habit, todayHabitLogs)])),
    [habits, todayHabitLogs]
  );
  const activeReminders = useMemo(() => getActiveReminders(reminders), [reminders]);

  if (loading) return <DashboardSkeleton />;

  const renderTaskRow = (task: Task) => {
    const taskDay = (task.dueAt || task.date || '').slice(0, 10);
    const isOverdue = Boolean(task.dueAt && taskDay < today);
    const isInboxTask = !task.dueAt && (!taskDay || taskDay < today);
    return (
      <div
        key={task.id}
        className="dashboard-item-row flex items-center justify-between rounded-xl border border-slate-100 p-3 transition-all hover:bg-slate-50/80 hover:border-slate-200 dark:border-slate-800/60 dark:hover:bg-slate-800/40"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <button
            type="button"
            role="checkbox"
            aria-checked={task.done}
            onClick={() => onToggleTask(task.id)}
            aria-label={`Mark ${task.title} as ${task.done ? 'incomplete' : 'complete'}`}
            className={`dashboard-task-toggle flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all hover:border-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${task.done ? 'border-indigo-500 bg-indigo-600 dark:border-indigo-500' : 'border-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 dark:border-slate-600'}`}
          >
            {task.done && <Check className="h-4 w-4 text-white" />}
          </button>
          <div className="min-w-0">
            <div className="dashboard-item-title truncate text-sm font-semibold text-slate-900 dark:text-white">
              {task.title}
            </div>
            <div className="dashboard-item-meta mt-0.5 flex items-center gap-2 text-xs text-slate-400">
              <span className="capitalize font-medium">{task.domain}</span>
              <span>·</span>
              <span className={isOverdue || task.priority === 'High' ? 'font-bold text-rose-500' : ''}>
                {isOverdue ? 'Overdue' : `${task.priority} Priority`}
              </span>
              {taskDay || isInboxTask ? (
                <>
                  <span>·</span>
                  <span>{isInboxTask ? 'Inbox' : isOverdue ? `Was due ${taskDay}` : `Due ${taskDay}`}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const moduleShortcuts: { module: NavModule; icon: React.FC<{ className?: string }>; label: string }[] = [
    { module: 'notes', icon: BookOpen, label: 'Notes' },
    { module: 'journal', icon: BookHeart, label: 'Journal' },
    { module: 'focus', icon: Timer, label: 'Capture' },
    { module: 'health', icon: Heart, label: 'Life' },
    { module: 'things', icon: Archive, label: 'Vault' },
  ];

  const quickActionShortcuts = [
    { label: 'Set a goal', type: 'goal' as const, icon: Target },
    { label: 'Add a task', type: 'task' as const, icon: CheckSquare },
    { label: 'Track finances', type: 'finance' as const, icon: DollarSign },
  ];

  const renderModuleShortcut = (s: typeof moduleShortcuts[number]) => (
    <button
      key={s.module}
      type="button"
      onClick={() => s.module === 'focus' ? onOpenQuickCapture('focus') : onNavigate(s.module)}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200/60 bg-white p-3 transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5 dark:border-slate-800/60 dark:bg-slate-900 cursor-pointer"
    >
      <div className="theme-icon-chip flex h-8 w-8 items-center justify-center rounded-lg">
        <s.icon className="h-4 w-4" />
      </div>
      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{s.label}</span>
    </button>
  );

  return (
    <div className="dashboard-view space-y-4">
      {(accounts.length > 0 || assets.length > 0 || liabilities.length > 0 ||
        loans.length > 0 || investments.length > 0 || savingsPlans.length > 0) && (
        <button
          type="button"
          onClick={() => onNavigate('finance')}
          className="dashboard-panel flex w-full items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-card transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-indigo-300 dark:border-slate-800/80 dark:bg-slate-900 dark:hover:border-indigo-700"
        >
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Estimated net worth</div>
            <div className="mt-1 text-xl font-black tabular-nums text-slate-900 dark:text-white">
              {getCurrencySymbol()} {financialPosition.netWorth.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="text-right text-xs text-slate-400">
            <div>Assets {getCurrencySymbol()} {financialPosition.totalAssets.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div>Debt {getCurrencySymbol()} {financialPosition.totalLiabilities.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          </div>
        </button>
      )}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {moduleShortcuts.filter(s => s.module === 'focus').map(renderModuleShortcut)}
        {quickActionShortcuts.map(item => (
          <button
            key={item.type}
            type="button"
            onClick={() => {
              if (item.type === 'finance') onNavigate('finance');
              else if (item.type === 'task') onNavigate('tasks');
              else if (item.type === 'goal') onNavigate('goals');
            }}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200/60 bg-white p-3 transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5 dark:border-slate-800/60 dark:bg-slate-900 cursor-pointer"
          >
            <div className="theme-icon-chip flex h-8 w-8 items-center justify-center rounded-lg">
              <item.icon className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{item.label}</span>
          </button>
        ))}
        {moduleShortcuts.filter(s => s.module !== 'focus').map(renderModuleShortcut)}
      </div>

      {/* Keep empty modules off the daily view; their full features remain in navigation. */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className={`space-y-4 ${habits.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
        {hasTaskContent ? (
        <section className="dashboard-panel flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-card transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="dashboard-section-icon flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                <CheckSquare className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Today's plan
                </h2>
                <span className="text-xs text-slate-400 font-medium">
                  {dueToday.length} due today · {overdue.length} overdue
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('tasks')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 flex items-center gap-1 cursor-pointer"
            >
              <span>All tasks</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {dueToday.length === 0 && overdue.length === 0
              ? <p className="text-sm text-slate-500 dark:text-slate-400">No tasks due today.</p>
              : <>
                  {dueToday.map(renderTaskRow)}
                  {shownOverdue.length > 0 && (dueToday.length > 0 ? (
                    <div className="border-t border-slate-100 pt-2 dark:border-slate-800">
                      <h3 className="mb-2 text-xs font-bold text-rose-600 dark:text-rose-400">Overdue · {overdue.length}</h3>
                      <div className="space-y-2">{shownOverdue.map(renderTaskRow)}</div>
                      {hiddenOverdueCount > 0 && (
                        <button type="button" onClick={() => onNavigate('tasks')} className="mt-2 text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:text-slate-400 cursor-pointer">
                          +{hiddenOverdueCount} more overdue
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {shownOverdue.map(renderTaskRow)}
                      {hiddenOverdueCount > 0 && (
                        <button type="button" onClick={() => onNavigate('tasks')} className="mt-1 text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:text-slate-400 cursor-pointer">
                          +{hiddenOverdueCount} more overdue
                        </button>
                      )}
                    </>
                  ))}
                </>}
          </div>
          {inboxTasks.length > 0 && <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">Inbox · {inboxTasks.length}</h3>
            </div>
            <div className="space-y-2">
              {inboxTasks.slice(0, 3).map(renderTaskRow)}
            </div>
          </div>}
          {upcomingTasks.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">Coming up</h3>
              </div>
              <div className="space-y-2">
                {upcomingTasks.slice(0, 3).map(renderTaskRow)}
              </div>
            </div>
          )}
        </section>
        ) : (
          <div className="dashboard-clear-state flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Nothing due today</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Your day is clear.</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('tasks')}
              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-300 cursor-pointer"
            >
              All tasks
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {activeGoals.length > 0 && <section className="dashboard-panel rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-card transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="dashboard-section-icon flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400"><Target className="h-4.5 w-4.5" /></div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">Goals</h2>
            </div>
            <button type="button" onClick={() => onNavigate('goals')} className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 flex items-center gap-1 cursor-pointer">View all <ArrowRight className="h-3.5 w-3.5" /></button>
          </div>
          <div className="mt-3 space-y-3">
            {activeGoals.slice(0, 4).map(goal => {
              const deadline = goal.targetDate?.slice(0, 10);
              const daysUntilDeadline = deadline
                ? Math.ceil((new Date(deadline).getTime() - new Date(today).getTime()) / 86_400_000)
                : null;
              const isOverdue = daysUntilDeadline !== null && daysUntilDeadline < 0;
              const isUrgent = daysUntilDeadline !== null && daysUntilDeadline >= 0 && daysUntilDeadline <= 7;
              return (
              <div key={goal.id} className="dashboard-goal-row space-y-1.5">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="dashboard-item-title font-semibold text-slate-900 dark:text-white truncate pr-2">
                    {goal.title}
                    {isOverdue && <span className="ml-1.5 text-[10px] font-bold text-rose-500">OVERDUE</span>}
                    {isUrgent && <span className="ml-1.5 text-[10px] font-bold text-amber-500">{daysUntilDeadline === 0 ? 'DUE TODAY' : `${daysUntilDeadline}d left`}</span>}
                  </span>
                  <span className="font-mono text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{Math.round(Number(goal.progress) || 0)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className={`h-full rounded-full transition-all duration-300 ${isOverdue ? 'bg-gradient-to-r from-rose-500 to-rose-600' : 'bg-gradient-to-r from-indigo-500 to-indigo-600'}`} style={{ width: `${Math.max(0, Math.min(100, Number(goal.progress) || 0))}%` }} />
                </div>
                {deadline && (
                  <div className={`text-[10px] ${isOverdue ? 'text-rose-500' : isUrgent ? 'text-amber-500' : 'text-slate-400'}`}>
                    Target: {deadline}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </section>}
        {activeReminders.length > 0 && <section className="dashboard-panel rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-card transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="dashboard-section-icon flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400"><Bell className="h-4.5 w-4.5" /></div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">Active Reminders</h2>
            </div>
            <button type="button" onClick={() => onOpenQuickCapture('reminder')} className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 cursor-pointer">+ Add Reminder</button>
          </div>
          <div className="mt-3 space-y-2">
            {activeReminders.map(rem => {
              const isAlarm = rem.alarmEnabled !== false;
              const timePart = rem.dueAt && rem.dueAt.includes('T') ? rem.dueAt.split('T')[1].slice(0, 5) : '';
              const datePart = rem.dueAt && rem.dueAt.includes('T') ? rem.dueAt.split('T')[0] : (rem.dueAt || '');
              const linkedModule: NavModule | null =
                rem.linkedType === 'task' ? 'tasks'
                : rem.linkedType === 'goal' ? 'goals'
                : rem.linkedType === 'habit' ? 'routine'
                : rem.linkedType === 'finance' ? 'finance'
                : null;
              const rowClass = `dashboard-item-row flex w-full items-center justify-between rounded-xl border border-slate-100 p-3 text-sm dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all text-left${linkedModule ? ' cursor-pointer' : ''}`;
              const rowContent = <>
                <div className="flex items-center gap-2.5 truncate pr-2">
                  <ThemeIcon name={isAlarm ? 'alarm' : 'target'} className="h-4 w-4" />
                  <div className="truncate">
                    <span className="dashboard-item-title font-semibold text-slate-900 dark:text-white block truncate">{rem.title}</span>
                    <span className="dashboard-item-meta text-xs text-slate-400">
                      {datePart} {timePart && `at ${timePart}`}
                      {linkedModule && <span className="ml-1.5 text-indigo-500 dark:text-indigo-400">→ {rem.linkedType}</span>}
                    </span>
                  </div>
                </div>
                {isAlarm && <span className="dashboard-status-label shrink-0 text-xs font-semibold text-indigo-600 dark:text-indigo-400">Alarm Active</span>}
              </>;
              return linkedModule
                ? <button key={rem.id} type="button" onClick={() => onNavigate(linkedModule)} className={rowClass}>{rowContent}</button>
                : <div key={rem.id} className={rowClass}>{rowContent}</div>;
            })}
          </div>
        </section>}
        </div>

        {(habits.length > 0 || finance.length > 0) && <div className={`space-y-4 ${habits.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
        {habits.length > 0 &&
        <section className="dashboard-panel rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-card transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="dashboard-section-icon flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                <Repeat className="h-4.5 w-4.5" />
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Habits
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('routine')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 flex items-center gap-1 cursor-pointer"
            >
              <span>View all</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3 space-y-2">
              {habits.slice(0, 5).map(habit => {
                const progress = habitProgress.get(habit.id) || { target: 1, complete: 0, occurrences: new Set<number>() };
                const isDone = progress.complete >= progress.target;
                const hasAllLog = todayHabitLogs.some(log => log.habitId === habit.id && log.occurrence === 'all');
                const nextOccurrence = isDone
                  ? hasAllLog ? 'all' : [...progress.occurrences].sort((a, b) => b - a)[0] ?? progress.target - 1
                  : Array.from({ length: progress.target }, (_, index) => index).find(index => !progress.occurrences.has(index)) ?? 0;
                return (
                  <div
                    key={habit.id}
                    className="dashboard-item-row flex items-center justify-between rounded-xl border border-slate-100 p-3 transition-all hover:bg-slate-50/80 dark:border-slate-800/60 dark:hover:bg-slate-800/40"
                  >
                    <div>
                      <div className="dashboard-item-title text-sm font-semibold text-slate-900 dark:text-white">{habit.name}</div>
                      <div className="dashboard-item-meta text-xs text-slate-400 mt-0.5">
                        {habit.frequency || 'Daily'} · {progress.complete}/{progress.target} today
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onLogHabit(habit.id, nextOccurrence)}
                      className={`dashboard-flat-action rounded-lg px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                        isDone
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {isDone ? '✓ Done · Undo' : 'Log next'}
                    </button>
                  </div>
                );
              })}
              {habits.length > 5 && (
                <button
                  type="button"
                  onClick={() => onNavigate('routine')}
                  className="mt-1 w-full text-center text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 cursor-pointer py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  +{habits.length - 5} more habits
                </button>
              )}
          </div>
        </section>}
        {finance.length > 0 && <section className="dashboard-panel rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-card transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="dashboard-section-icon flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <DollarSign className="h-4.5 w-4.5" />
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">Money this month</h2>
            </div>
            <button type="button" onClick={() => onNavigate('finance')} className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 flex items-center gap-1 cursor-pointer">
              <span>Ledger</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="dashboard-weekly-chart mt-4" role="group" aria-label="Weekly inflow and outflow chart">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Inflow & outflow · this week</span>
              <span className="text-[10px] text-slate-400">{weeklyFinance[0].date.slice(5)} – {weeklyFinance[6].date.slice(5)}</span>
            </div>
            <div className="mb-2 flex items-center gap-4 text-[10px] text-slate-400">
              <span className="flex items-center gap-1.5"><span className="dashboard-weekly-legend dashboard-weekly-legend-income" />Inflow</span>
              <span className="flex items-center gap-1.5"><span className="dashboard-weekly-legend dashboard-weekly-legend-spending" />Outflow</span>
            </div>
            <div className="-mx-1 overflow-x-auto px-1">
            <div className="grid min-w-[320px] grid-cols-7 items-end gap-1.5 sm:gap-2">
              {weeklyFinance.map(day => {
                const inflowHeight = !day.isFuture && weeklyFinanceMax > 0 ? Math.round((day.inflow / weeklyFinanceMax) * 44) : 0;
                const spendingHeight = !day.isFuture && weeklyFinanceMax > 0 ? Math.round((day.spending / weeklyFinanceMax) * 44) : 0;
                return (
                  <div key={day.date} className={`dashboard-weekly-day flex min-w-0 flex-col items-center justify-end gap-1.5${day.isFuture ? ' is-future' : ''}`} title={day.isFuture ? `${day.label}, ${day.date}: upcoming; no actuals yet` : `${day.label}, ${day.date} — Inflow: ${getCurrencySymbol()} ${day.inflow.toLocaleString()}; Outflow: ${getCurrencySymbol()} ${day.spending.toLocaleString()}`} aria-label={day.isFuture ? `${day.label}: upcoming` : `${day.label}: inflow ${getCurrencySymbol()} ${day.inflow.toLocaleString()}, outflow ${getCurrencySymbol()} ${day.spending.toLocaleString()}`}>
                    <div className="flex h-11 w-full items-end justify-center gap-1">
                      <div className="dashboard-weekly-bar dashboard-weekly-bar-income" style={{ height: `${inflowHeight}px` }} />
                      <div className="dashboard-weekly-bar dashboard-weekly-bar-spending" style={{ height: `${spendingHeight}px` }} />
                    </div>
                    <span className="text-[10px] leading-none text-slate-400">{day.label}</span>
                    <span className="dashboard-weekly-day-values">
                      <span className="income">{day.isFuture ? '–' : formatCompactAmount(day.inflow)}</span>
                      <span className="outflow">{day.isFuture ? '–' : formatCompactAmount(day.spending)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            </div>
            <div className="dashboard-weekly-totals mt-3 grid grid-cols-2 gap-3 border-t border-slate-200/60 pt-2 dark:border-slate-700/60">
              <div><span className="dashboard-weekly-total-label">Inflow</span><strong>{getCurrencySymbol()} {weeklyInflowTotal.toLocaleString()}</strong></div>
              <div><span className="dashboard-weekly-total-label">Outflow</span><strong>{getCurrencySymbol()} {weeklySpendingTotal.toLocaleString()}</strong></div>
            </div>
          </div>

          {totalInflow > 0 || totalOutflow > 0 ? (
            <div className="mt-3 grid grid-cols-1 xl:grid-cols-2 gap-3">
              <div className="min-w-0 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <ArrowDownRight className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span className="min-w-0">Inflow · this month</span>
                </div>
                <div className="mt-1 font-mono text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                  <span className="whitespace-nowrap">{getCurrencySymbol()}</span>{' '}
                  <span className="whitespace-nowrap tabular-nums">{totalInflow.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
              <div className="min-w-0 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                  <span className="min-w-0">Outflow · this month</span>
                </div>
                <div className="mt-1 font-mono text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                  <span className="whitespace-nowrap">{getCurrencySymbol()}</span>{' '}
                  <span className="whitespace-nowrap tabular-nums">{totalOutflow.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-400">No money activity recorded this month.</p>
          )}

          {monthFinance.length > 0 && <div className="mt-4 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Recent activity</div>
            {[...monthFinance].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 3).map(tx => {
              const isInflow = tx.type === 'income' || tx.type === 'loan' || tx.type === 'loanReceipt' ||
                tx.type === 'savingsWithdrawal' ||
                (tx.type === 'adjustment' && tx.adjustmentDirection === 'credit');
              const isTransfer = tx.type === 'transfer';
              const isLedgerOnly = Boolean(tx.ledgerOnly);
              return (
                <div key={tx.id} className="dashboard-transaction-row flex items-center justify-between gap-2 min-w-0 text-sm py-2 border-b border-slate-50 dark:border-slate-800/40 last:border-0">
                  <div className="min-w-0 flex-1 truncate">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{tx.category}</span>
                    {tx.note && <span className="ml-1.5 text-slate-400">({tx.note})</span>}
                  </div>
                  <span className={`shrink-0 font-mono font-bold tabular-nums ${isLedgerOnly ? 'text-slate-500' : isInflow ? (tx.type === 'loan' ? 'text-teal-600 dark:text-teal-400' : 'text-emerald-600') : 'text-slate-900 dark:text-white'}`}>
                    {isLedgerOnly ? '' : isInflow ? '+' : isTransfer ? '⇄ ' : '-'}{getCurrencySymbol()} {Number(tx.amount || 0).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>}
        </section>}
        </div>}
      </div>

    </div>
  );
};

export default DashboardView;
