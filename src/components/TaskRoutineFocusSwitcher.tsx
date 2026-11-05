import React from 'react';
import { Bell, CheckSquare, Music, Repeat, Sparkles, Target } from 'lucide-react';
import { HeaderDropdown } from './HeaderDropdown';

export type WorkAreaSection =
  | 'tasks-roster'
  | 'tasks-daily'
  | 'routine'
  | 'routine-habits'
  | 'routine-genesis'
  | 'routine-habit-genesis'
  | 'focus-timer'
  | 'focus-alarms'
  | 'focus-ringtones';

interface TaskRoutineFocusSwitcherProps {
  activeSection: WorkAreaSection;
  taskCount: number;
  onSelectSection: (section: WorkAreaSection) => void;
  onOpenTaskGenesis?: () => void;
  onOpenAlarmClock?: () => void;
}

const defaultSections: {
  id: WorkAreaSection;
  label: string;
  Icon: typeof CheckSquare;
}[] = [
  { id: 'tasks-roster', label: 'Task Roster', Icon: CheckSquare },
  { id: 'tasks-daily', label: 'Daily Command Target', Icon: Target },
  { id: 'focus-timer', label: 'Deep Work Sprint', Icon: Sparkles },
  { id: 'focus-alarms', label: 'Alarm Clock', Icon: Bell },
  { id: 'focus-ringtones', label: 'Ringtone Studio', Icon: Music }
];

const routineSection = { id: 'routine', label: 'Routine', Icon: Repeat } satisfies (typeof defaultSections)[number];
const habitSection = { id: 'routine-habits', label: 'Habit', Icon: Repeat } satisfies (typeof defaultSections)[number];

export const TaskRoutineFocusSwitcher: React.FC<TaskRoutineFocusSwitcherProps> = ({
  activeSection,
  taskCount,
  onSelectSection,
  onOpenTaskGenesis,
  onOpenAlarmClock
}) => {
  const allSections = [...defaultSections, routineSection, habitSection];
  const activeItem = allSections.find(section => section.id === activeSection) || defaultSections[0];
  const ActiveIcon = activeItem.Icon;
  const menuLabel = 'Tasks, routines and focus submenu';

  const renderSection = ({ id, label, Icon }: (typeof allSections)[number], closeMenu: () => void) => {
    const isActive = activeSection === id;
    return (
      <button
        key={id}
        type="button"
        role="menuitem"
        aria-current={isActive ? 'page' : undefined}
        onClick={() => {
          onSelectSection(id);
          if (id === 'tasks-roster' && onOpenTaskGenesis) {
            onOpenTaskGenesis();
          }
          if (id === 'focus-alarms' && onOpenAlarmClock) {
            onOpenAlarmClock();
          }
          closeMenu();
        }}
        className={`flex w-full min-w-0 items-center gap-2 border-b-2 px-2 py-2 text-left text-sm font-semibold text-slate-700 dark:text-slate-200 ${
          isActive
            ? 'border-b-amber-300'
            : 'border-b-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{id === 'tasks-roster' ? `${label} (${taskCount})` : label}</span>
      </button>
    );
  };

  return (
    <HeaderDropdown
      label={activeSection === 'tasks-roster' ? `${activeItem.label} (${taskCount})` : activeItem.label}
      menuLabel={menuLabel}
      icon={<ActiveIcon className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" />}
    >
      {closeMenu => (
        <div className="task-area-dropdown">
          {renderSection(defaultSections[0], closeMenu)}
          {renderSection(defaultSections[1], closeMenu)}
          <div className="border-t border-slate-200 dark:border-slate-700">
            {renderSection(routineSection, closeMenu)}
          </div>
          <div className="border-t border-slate-200 dark:border-slate-700">
            {renderSection(habitSection, closeMenu)}
          </div>
          {defaultSections.slice(2).map(section => renderSection(section, closeMenu))}
        </div>
      )}
    </HeaderDropdown>
  );
};
