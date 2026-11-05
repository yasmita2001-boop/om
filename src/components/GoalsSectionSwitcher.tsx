import React from 'react';
import { Flame, FolderTree, Layers, ShieldCheck, Target, TrendingUp, Zap } from 'lucide-react';
import { HeaderDropdown } from './HeaderDropdown';

export type GoalsSection = 'goals' | 'timeline' | 'strategies' | 'milestones' | 'kpis' | 'missions' | 'mentor';

type CountedGoalsSection = Exclude<GoalsSection, 'timeline' | 'mentor'>;

interface GoalsSectionSwitcherProps {
  activeSection: GoalsSection;
  counts: Record<CountedGoalsSection, number>;
  delayedCount: number;
  onSelectSection: (section: GoalsSection) => void;
}

const sections = [
  { id: 'timeline', label: 'Timeline & Plan', Icon: FolderTree },
  { id: 'goals', label: 'Strategic Goals', Icon: Target },
  { id: 'strategies', label: 'Strategies', Icon: Zap },
  { id: 'milestones', label: 'Milestones', Icon: Layers },
  { id: 'kpis', label: 'KPIs', Icon: TrendingUp },
  { id: 'missions', label: 'Missions', Icon: Flame },
  { id: 'mentor', label: 'Mentor & Reserves', Icon: ShieldCheck }
] as const;

export const GoalsSectionSwitcher: React.FC<GoalsSectionSwitcherProps> = ({
  activeSection,
  counts,
  delayedCount,
  onSelectSection
}) => {
  const selectedSection = sections.find(section => section.id === activeSection) || sections[1];
  const SelectedIcon = selectedSection.Icon;

  return (
    <HeaderDropdown
      label={(
        <>
          {selectedSection.label}
          {activeSection === 'timeline' && delayedCount > 0 && (
            <span className="ml-1 shrink-0 text-xs font-bold text-rose-600 dark:text-rose-400">
              {delayedCount} delayed
            </span>
          )}
        </>
      )}
      menuLabel="Goals submenu"
      icon={<SelectedIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" />}
    >
      {closeMenu => sections.map(section => {
        const Icon = section.Icon;
        const isActive = activeSection === section.id;
        const optionLabel = `${section.label}${section.id === 'timeline'
          ? delayedCount > 0 ? ` (${delayedCount} delayed)` : ''
          : section.id === 'mentor' ? '' : ` (${counts[section.id]})`}`;
        return (
          <button
            key={section.id}
            type="button"
            role="menuitem"
            aria-current={isActive ? 'page' : undefined}
            data-goals-section={section.id}
            onClick={() => {
              onSelectSection(section.id);
              closeMenu();
            }}
            className={`flex w-full min-w-0 items-center gap-2 border-b-2 px-2 py-2 text-left text-sm font-semibold text-slate-700 dark:text-slate-200 ${
              isActive ? 'border-amber-300' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{optionLabel}</span>
          </button>
        );
      })}
    </HeaderDropdown>
  );
};
