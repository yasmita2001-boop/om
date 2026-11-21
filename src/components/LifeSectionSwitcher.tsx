import React from 'react';
import { Briefcase, Heart, Sparkles, Users } from 'lucide-react';
import { HeaderDropdown } from './HeaderDropdown';
import { useT } from '../contexts/I18nContext';

export type LifeSection = 'health' | 'people' | 'spiritual' | 'work';

interface LifeSectionSwitcherProps {
  activeSection: LifeSection;
  onSelectSection: (section: LifeSection) => void;
}

export const LifeSectionSwitcher: React.FC<LifeSectionSwitcherProps> = ({ activeSection, onSelectSection }) => {
  const { t } = useT();
  const sections = [
    { id: 'health', label: t('nav.life'), Icon: Heart },
    { id: 'people', label: t('nav.people'), Icon: Users },
    { id: 'spiritual', label: t('nav.spiritual'), Icon: Sparkles },
    { id: 'work', label: t('nav.work'), Icon: Briefcase },
  ] as const;
  const selected = sections.find(section => section.id === activeSection) ?? sections[0];
  const SelectedIcon = selected.Icon;

  return (
    <HeaderDropdown
      label={selected.label}
      menuLabel="Life sections"
      icon={<SelectedIcon className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" />}
    >
      {closeMenu => sections.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          role="menuitem"
          aria-current={activeSection === id ? 'page' : undefined}
          onClick={() => {
            onSelectSection(id);
            closeMenu();
          }}
          className={`flex w-full min-w-0 items-center gap-2 border-b-2 px-2 py-2 text-left text-sm font-semibold text-slate-700 dark:text-slate-200 ${
            activeSection === id
              ? 'border-amber-300'
              : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </button>
      ))}
    </HeaderDropdown>
  );
};
