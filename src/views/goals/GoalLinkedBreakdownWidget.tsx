import { Goal } from '../../types';
import { GoalProgressBreakdown } from '../../lib/goalTaskSync';
import { Layers, ChevronDown } from 'lucide-react';
import { ThemeIcon } from '../../components/ThemeIcon';
import { goalItemIcons } from './goalHelpers';

export function GoalLinkedBreakdownWidget({
  goal,
  breakdown,
  isExpanded,
  onToggleExpand,
  onQuickToggleTask,
  onQuickToggleMilestone,
  onQuickToggleAppointment,
  onQuickToggleMeeting,
  onAdjustManualProgress,
}: {
  goal: Goal;
  breakdown: GoalProgressBreakdown;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onQuickToggleTask?: (taskId: string) => Promise<void>;
  onQuickToggleMilestone?: (milestoneId: string) => Promise<void>;
  onQuickToggleAppointment?: (appointmentId: string) => Promise<void>;
  onQuickToggleMeeting?: (meetingId: string) => Promise<void>;
  onAdjustManualProgress?: (delta: number) => void;
}) {
  const hasItems = breakdown.hasLinkedItems;
  const hasProgressItems = breakdown.progressItemCount > 0;
  const displayProgress = hasProgressItems ? breakdown.totalPercent : goal.progress;
  const averageItemWeight = hasProgressItems && breakdown.actionableCount > 0
    ? Number((100 / breakdown.actionableCount).toFixed(1))
    : 0;
  const formatProgressCount = (count: number) => Number(count.toFixed(1)).toString();

  return (
    <div className="space-y-2">
      {/* Real-Time Status & Progress Metrics Header */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs min-w-0">
        {/* Left: Progress percentage + contextual stats */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
          <span className="font-mono text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums shrink-0 whitespace-nowrap">
            {displayProgress}%
          </span>
          <span className="text-slate-300 dark:text-slate-700 shrink-0">·</span>
          {hasItems ? (
            <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
              <span className="hidden sm:inline">
                {hasProgressItems
                  ? `${formatProgressCount(breakdown.completedItems)} of ${formatProgressCount(breakdown.progressItemCount)} progress items complete · ${breakdown.totalItems} linked`
                  : `${breakdown.totalItems} reference links · manual progress`}
              </span>
              <span className="sm:hidden">
                {hasProgressItems
                  ? `${formatProgressCount(breakdown.completedItems)}/${formatProgressCount(breakdown.progressItemCount)} progress`
                  : `${breakdown.totalItems} references`}
              </span>
            </span>
          ) : (
            <span className="text-[11px] sm:text-xs text-slate-400 font-normal shrink-0">
              Direct Progress
            </span>
          )}
        </div>

        {/* Right: Actions (Manual Stepper or Breakdown Toggle) */}
        <div className="flex flex-wrap items-center gap-1 shrink-0 ml-auto">
          {!hasProgressItems && onAdjustManualProgress && (
            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onAdjustManualProgress(-10)}
                className="h-5 w-5 sm:h-6 sm:w-6 rounded border border-slate-200 text-xs font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors flex items-center justify-center cursor-pointer"
                title="Decrease 10%"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => onAdjustManualProgress(10)}
                className="h-5 w-5 sm:h-6 sm:w-6 rounded border border-slate-200 text-xs font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors flex items-center justify-center cursor-pointer"
                title="Increase 10%"
              >
                +
              </button>
            </div>
          )}

          {hasItems && (
            <button
              type="button"
              onClick={onToggleExpand}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-medium transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                isExpanded
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 dark:text-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700/80'
              }`}
              title={isExpanded ? 'Hide details' : 'View linked progress breakdown'}
            >
              <Layers className="h-3 w-3 shrink-0" />
              <span>{isExpanded ? 'Hide' : `Linked (${breakdown.totalItems})`}</span>
              <ChevronDown className={`h-3 w-3 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar Track */}
      <div className="goal-progress-track h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800/90">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            displayProgress >= 100
              ? 'bg-emerald-500'
              : 'bg-indigo-600 dark:bg-indigo-500'
          }`}
          style={{ width: `${Math.max(0, Math.min(100, displayProgress))}%` }}
        />
      </div>

      {/* Expanded Linked Breakdown Drawer */}
      {isExpanded && hasItems && (
        <div className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/60 space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-200/60 pb-2 dark:border-slate-800/60">
            <div>
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                Progress Contribution Breakdown
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {hasProgressItems
                  ? `${breakdown.actionableCount} progress-driving items contribute about ${averageItemWeight}% each. ${breakdown.totalItems - breakdown.actionableCount} reference links do not change progress.`
                  : `${breakdown.totalItems} linked reference items are visible here but do not change Goal progress.`}
              </p>
            </div>
            <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
              {hasProgressItems
                ? `${formatProgressCount(breakdown.completedItems)}/${formatProgressCount(breakdown.progressItemCount)} Progress`
                : 'Reference only'}
            </span>
          </div>

          {/* Category Summary Badges */}
          <div className="goal-category-badges flex flex-wrap gap-1.5 text-[11px]">
            {breakdown.categories.tasks?.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-slate-600 shadow-2xs border border-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                Tasks: {formatProgressCount(breakdown.categories.tasks.completedCount)}/{formatProgressCount(breakdown.categories.tasks.count)}
              </span>
            )}
            {breakdown.categories.milestones?.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-slate-600 shadow-2xs border border-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                Milestones: {formatProgressCount(breakdown.categories.milestones.completedCount)}/{formatProgressCount(breakdown.categories.milestones.count)}
              </span>
            )}
            {breakdown.categories.habits?.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-slate-600 shadow-2xs border border-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                Habits: {formatProgressCount(breakdown.categories.habits.completedCount)}/{formatProgressCount(breakdown.categories.habits.count)}
              </span>
            )}
            {breakdown.categories.routines?.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-slate-600 shadow-2xs border border-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                Routines: {formatProgressCount(breakdown.categories.routines.completedCount)}/{formatProgressCount(breakdown.categories.routines.count)}
              </span>
            )}
            {breakdown.categories.learning?.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-slate-600 shadow-2xs border border-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                Learning: {formatProgressCount(breakdown.categories.learning.completedCount)}/{formatProgressCount(breakdown.categories.learning.count)}
              </span>
            )}
            {breakdown.categories.skills?.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-slate-600 shadow-2xs border border-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                Skills: {formatProgressCount(breakdown.categories.skills.completedCount)}/{formatProgressCount(breakdown.categories.skills.count)}
              </span>
            )}
            {breakdown.categories.notes?.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-slate-600 shadow-2xs border border-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                Notebooks: {formatProgressCount(breakdown.categories.notes.completedCount)}/{formatProgressCount(breakdown.categories.notes.count)}
              </span>
            )}
            {breakdown.categories.journal?.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-slate-600 shadow-2xs border border-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                Journal: {formatProgressCount(breakdown.categories.journal.completedCount)}/{formatProgressCount(breakdown.categories.journal.count)}
              </span>
            )}
            {breakdown.categories.childGoals?.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-slate-600 shadow-2xs border border-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                Sub-Goals: {formatProgressCount(breakdown.categories.childGoals.completedCount)}/{formatProgressCount(breakdown.categories.childGoals.count)}
              </span>
            )}
            {breakdown.categories.savingsPlans?.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-emerald-700 shadow-2xs border border-emerald-200/70 dark:bg-slate-800 dark:text-emerald-400 dark:border-emerald-800/60">
                Savings: {formatProgressCount(breakdown.categories.savingsPlans.completedCount)}/{formatProgressCount(breakdown.categories.savingsPlans.count)}
              </span>
            )}
            {breakdown.categories.loans?.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-rose-700 shadow-2xs border border-rose-200/70 dark:bg-slate-800 dark:text-rose-400 dark:border-rose-800/60">
                Loans: {formatProgressCount(breakdown.categories.loans.completedCount)}/{formatProgressCount(breakdown.categories.loans.count)}
              </span>
            )}
            {breakdown.categories.investments?.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-blue-700 shadow-2xs border border-blue-200/70 dark:bg-slate-800 dark:text-blue-400 dark:border-blue-800/60">
                Investments: {formatProgressCount(breakdown.categories.investments.completedCount)}/{formatProgressCount(breakdown.categories.investments.count)}
              </span>
            )}
            {breakdown.categories.assets?.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-amber-700 shadow-2xs border border-amber-200/70 dark:bg-slate-800 dark:text-amber-400 dark:border-amber-800/60">
                Assets: {formatProgressCount(breakdown.categories.assets.completedCount)}/{formatProgressCount(breakdown.categories.assets.count)}
              </span>
            )}
            {breakdown.categories.liabilities?.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-orange-700 shadow-2xs border border-orange-200/70 dark:bg-slate-800 dark:text-orange-400 dark:border-orange-800/60">
                Liabilities: {formatProgressCount(breakdown.categories.liabilities.completedCount)}/{formatProgressCount(breakdown.categories.liabilities.count)}
              </span>
            )}
            {breakdown.categories.transactions?.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-teal-700 shadow-2xs border border-teal-200/70 dark:bg-slate-800 dark:text-teal-400 dark:border-teal-800/60">
                Ledger: {formatProgressCount(breakdown.categories.transactions.completedCount)}/{formatProgressCount(breakdown.categories.transactions.count)}
              </span>
            )}
            {breakdown.categories.appointments?.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-pink-700 shadow-2xs border border-pink-200/70 dark:bg-slate-800 dark:text-pink-400 dark:border-pink-800/60">
                Appointments: {formatProgressCount(breakdown.categories.appointments.completedCount)}/{formatProgressCount(breakdown.categories.appointments.count)}
              </span>
            )}
            {breakdown.categories.healthNotes?.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-slate-700 shadow-2xs border border-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                Health Notes: {formatProgressCount(breakdown.categories.healthNotes.completedCount)}/{formatProgressCount(breakdown.categories.healthNotes.count)}
              </span>
            )}
            {breakdown.categories.meetings?.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-violet-700 shadow-2xs border border-violet-200/70 dark:bg-slate-800 dark:text-violet-400 dark:border-violet-800/60">
                Meetings: {formatProgressCount(breakdown.categories.meetings.completedCount)}/{formatProgressCount(breakdown.categories.meetings.count)}
              </span>
            )}
            {breakdown.categories.practices?.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-emerald-600 shadow-2xs border border-emerald-200/70 dark:bg-slate-800 dark:text-emerald-400 dark:border-emerald-800/60">
                Practices: {formatProgressCount(breakdown.categories.practices.completedCount)}/{formatProgressCount(breakdown.categories.practices.count)}
              </span>
            )}
            {breakdown.categories.focusSessions?.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-amber-500 shadow-2xs border border-amber-200/70 dark:bg-slate-800 dark:text-amber-400 dark:border-amber-800/60">
                Focus: {formatProgressCount(breakdown.categories.focusSessions.completedCount)}/{formatProgressCount(breakdown.categories.focusSessions.count)}
              </span>
            )}
            {breakdown.categories.reminders?.count > 0 && (
              <span className="rounded-md bg-white px-2 py-0.5 font-medium text-rose-500 shadow-2xs border border-rose-200/70 dark:bg-slate-800 dark:text-rose-400 dark:border-rose-800/60">
                Reminders: {formatProgressCount(breakdown.categories.reminders.completedCount)}/{formatProgressCount(breakdown.categories.reminders.count)}
              </span>
            )}
          </div>

          {/* Itemized List */}
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {breakdown.items.map(item => (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/70 bg-white p-2 text-xs dark:border-slate-800 dark:bg-slate-800/80 transition-colors hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {item.type === 'task' && onQuickToggleTask && !item.isAggregate ? (
                    <button
                      type="button"
                      onClick={() => onQuickToggleTask(item.id)}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] font-bold transition-all cursor-pointer ${
                        item.isCompleted
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-300 bg-white hover:border-indigo-500 dark:border-slate-600 dark:bg-slate-800'
                      }`}
                      title={item.isCompleted ? 'Mark Task Incomplete' : 'Complete Task (Instant Reflection)'}
                    >
                      {item.isCompleted && '✓'}
                    </button>
                  ) : item.type === 'milestone' && onQuickToggleMilestone ? (
                    <button
                      type="button"
                      onClick={() => onQuickToggleMilestone(item.id)}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] font-bold transition-all cursor-pointer ${
                        item.isCompleted
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-300 bg-white hover:border-indigo-500 dark:border-slate-600 dark:bg-slate-800'
                      }`}
                      title={item.isCompleted ? 'Mark Milestone Pending' : 'Reach Milestone (Instant Reflection)'}
                    >
                      {item.isCompleted && '✓'}
                    </button>
                  ) : item.type === 'appointment' && onQuickToggleAppointment ? (
                    <button
                      type="button"
                      onClick={() => onQuickToggleAppointment(item.id)}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] font-bold transition-all cursor-pointer ${
                        item.isCompleted
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-300 bg-white hover:border-pink-500 dark:border-slate-600 dark:bg-slate-800'
                      }`}
                      title={item.isCompleted ? 'Mark Checkup Scheduled' : 'Mark Checkup Attended (Instant Reflection)'}
                    >
                      {item.isCompleted && '✓'}
                    </button>
                  ) : item.type === 'meeting' && onQuickToggleMeeting ? (
                    <button
                      type="button"
                      onClick={() => onQuickToggleMeeting(item.id)}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] font-bold transition-all cursor-pointer ${
                        item.isCompleted
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-300 bg-white hover:border-violet-500 dark:border-slate-600 dark:bg-slate-800'
                      }`}
                      title={item.isCompleted ? 'Mark Meeting Scheduled' : 'Mark Meeting Completed (Instant Reflection)'}
                    >
                      {item.isCompleted && '✓'}
                    </button>
                  ) : (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] text-slate-400 dark:bg-slate-800">
                      •
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-400 tracking-wider shrink-0">
                        <ThemeIcon name={goalItemIcons[item.type]} className="h-3 w-3" />
                        {item.typeLabel}
                      </span>
                      <span className={`truncate font-medium min-w-0 ${item.isCompleted ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                        {item.title}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {item.isAggregate && item.progressWeight
                      ? `~${averageItemWeight}% each`
                      : item.weightPercent > 0 ? `~${item.weightPercent}%` : 'Reference'}
                  </span>
                  <span className={`font-mono text-[11px] font-semibold rounded px-1.5 py-0.5 ${
                    item.progress >= 100
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : item.progress > 0
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {Number.isInteger(item.progress) ? item.progress : item.progress.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
