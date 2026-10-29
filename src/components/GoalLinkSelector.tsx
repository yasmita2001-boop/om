import React from 'react';
import { Target } from 'lucide-react';
import { Goal } from '../types';
import { LinkModeSelector } from './LinkModeSelector';
import { GoalPicker } from './GoalPicker';

interface GoalLinkSelectorProps {
  goals?: Goal[];
  mode: 'manual' | 'link';
  goalId: string;
  onModeChange: (mode: 'manual' | 'link') => void;
  onGoalChange: (goalId: string) => void;
  label?: string;
  className?: string;
}

export const GoalLinkSelector: React.FC<GoalLinkSelectorProps> = ({
  goals = [],
  mode,
  goalId,
  onModeChange,
  onGoalChange,
  label = 'Goal Link',
  className = ''
}) => {
  const selectedGoal = goals.find(g => g.id === goalId);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Header bar matching TasksView & FinanceView: Label on Left, Compact Toggle on Right */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate min-w-0">
          {label}
        </label>
        {/* Mode Selector: Link Goal vs Manual (Exact TasksView pill styling) */}
        <LinkModeSelector
          value={mode}
          ariaLabel={`${label} mode`}
          options={[{ value: 'link', label: 'Link Goal' }, { value: 'manual', label: 'Manual' }]}
          onChange={nextMode => {
            if (nextMode === 'link') {
              onModeChange('link');
              if (goals.length > 0 && !goalId) onGoalChange(goals[0].id);
              return;
            }
            onModeChange('manual');
            onGoalChange('');
          }}
        />
      </div>

      {/* Target Goal Dropdown when Link Goal is active (Matching TasksView) */}
      {mode === 'link' && (
        <div className="space-y-1.5 rounded-xl border border-indigo-200/80 bg-indigo-50/60 p-2.5 dark:border-indigo-900/60 dark:bg-indigo-950/30 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
              <Target className="h-3 w-3" />
              <span>Select Target Goal to Link *</span>
            </span>
            {selectedGoal && (
              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                {selectedGoal.progress}% Done
              </span>
            )}
          </div>
          <GoalPicker
            goals={goals}
            value={goalId}
            onChange={onGoalChange}
            placeholder="-- Choose Goal --"
            className="h-8.5 w-full rounded-lg border border-indigo-300 bg-white px-2.5 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-indigo-700 dark:bg-slate-900 dark:text-white cursor-pointer"
          />
          {selectedGoal && (
            <span className="block text-[10px] text-indigo-700 dark:text-indigo-300">
              ⚡ Linked to goal "{selectedGoal.title}" ({selectedGoal.progress}% progress)
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export const GoalBadge: React.FC<{
  goalId?: string | null;
  goals?: Goal[];
  className?: string;
}> = ({ goalId, goals = [], className = '' }) => {
  if (!goalId) return null;
  const goal = goals.find(g => g.id === goalId);
  const title = goal?.title || 'Linked Goal';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50 ${className}`}
      title={goal ? `${goal.title} (${goal.category || 'Goal'} - ${goal.progress}%)` : 'Linked Goal'}
    >
      <Target className="h-3 w-3 shrink-0" />
      <span className="truncate max-w-[150px]">{title}</span>
    </span>
  );
};
