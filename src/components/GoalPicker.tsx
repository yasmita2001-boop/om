import React, { useMemo, useState } from 'react';
import { Goal } from '../types';
import { getGoalHierarchyLevel, sortGoalsHierarchically } from '../lib/goalHierarchy';
import { ThemeIcon } from './ThemeIcon';

const goalLevels = [
  { level: 1, label: 'Main', icon: 'mainGoal' },
  { level: 2, label: 'Sub', icon: 'subGoal' },
  { level: 3, label: 'Micro', icon: 'microGoal' },
  { level: 4, label: 'Nano', icon: 'nanoGoal' },
  { level: 5, label: 'Atomic', icon: 'zap' }
] as const;

interface GoalPickerProps {
  goals: Goal[];
  value: string;
  onChange: (goalId: string) => void;
  className?: string;
}

export const GoalPicker: React.FC<GoalPickerProps> = ({
  goals,
  value,
  onChange,
  className = '',
}) => {
  const [activeLevel, setActiveLevel] = useState<number | 'all'>('all');
  const sortedGoals = useMemo(() => sortGoalsHierarchically(goals), [goals]);
  const goalsById = useMemo(() => new Map(goals.map(goal => [goal.id, goal])), [goals]);
  const selectedGoal = goalsById.get(value);
  const selectedLevel = selectedGoal ? getGoalHierarchyLevel(selectedGoal, goalsById) : null;
  const filteredGoals = activeLevel === 'all'
    ? sortedGoals
    : sortedGoals.filter(goal => getGoalHierarchyLevel(goal, goalsById) === activeLevel);

  return (
    <div className="space-y-1.5">
      <div
        role="group"
        aria-label="Filter goals by level"
        className="goal-level-tabs flex flex-wrap items-center"
      >
        <button
          type="button"
          aria-pressed={activeLevel === 'all'}
          onClick={() => setActiveLevel('all')}
          className="goal-level-tab"
        >
          All
        </button>
        {goalLevels.map(({ level, label, icon }) => (
          <button
            key={level}
            type="button"
            aria-pressed={activeLevel === level}
            onClick={() => setActiveLevel(level)}
            className="goal-level-tab"
          >
            <ThemeIcon name={icon} className="h-3 w-3" /> {label}
          </button>
        ))}
      </div>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        aria-label="Choose a goal"
        className={className}
      >
        <option value="" />
        {selectedGoal && selectedLevel !== null && selectedLevel !== activeLevel && activeLevel !== 'all' && (
          <option value={selectedGoal.id}>
            Current selection - {goalLevels[selectedLevel - 1].label}: {selectedGoal.title} ({selectedGoal.progress}%)
          </option>
        )}
        {filteredGoals.map(goal => {
          const level = getGoalHierarchyLevel(goal, goalsById);
          const levelInfo = goalLevels[level - 1];
          return (
            <option key={goal.id} value={goal.id}>
              {levelInfo.label}: {goal.title} ({goal.progress}%)
            </option>
          );
        })}
      </select>
    </div>
  );
};
