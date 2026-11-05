import React from 'react';
import { BookOpen, Calculator, FileText } from 'lucide-react';
import { HeaderDropdown } from './HeaderDropdown';

interface NotesJournalSwitcherProps {
  activeModule: 'notes' | 'journal' | 'calculator';
  noteCount: number;
  journalCount: number;
  onSelectAction: (action: 'note' | 'reflection' | 'note-filters' | 'journal-timeline' | 'calculator') => void;
}

export const NotesJournalSwitcher: React.FC<NotesJournalSwitcherProps> = ({
  activeModule,
  noteCount,
  journalCount,
  onSelectAction
}) => {
  const isNotes = activeModule === 'notes';
  const isJournal = activeModule === 'journal';
  const SelectedIcon = isNotes ? FileText : isJournal ? BookOpen : Calculator;

  const selectAction = (
    action: 'note' | 'reflection' | 'note-filters' | 'journal-timeline' | 'calculator',
    closeMenu: () => void
  ) => {
    onSelectAction(action);
    closeMenu();
  };

  return (
    <HeaderDropdown
      label={isNotes ? 'Memo' : isJournal ? 'Daily Journal' : 'Calculator'}
      menuLabel="Memo submenu"
      icon={<SelectedIcon className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" />}
    >
      {closeMenu => (
        <>
          <button
            type="button"
            role="menuitem"
            aria-current={isNotes ? 'page' : undefined}
            onClick={() => selectAction('note', closeMenu)}
            className={`mt-1.5 flex w-full min-w-0 items-center gap-2 border-b-2 px-2 py-2 text-left text-sm font-semibold text-slate-700 dark:text-slate-200 ${
              isNotes
                ? 'border-amber-300'
                : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate">Memos ({noteCount})</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => selectAction('note-filters', closeMenu)}
            className="w-full border-b border-slate-200 px-2 py-3 text-left text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Search &amp; Filters
          </button>

          <button
            type="button"
            role="menuitem"
            aria-current={isJournal ? 'page' : undefined}
            onClick={() => selectAction('reflection', closeMenu)}
            className={`flex w-full min-w-0 items-center gap-2 border-b-2 px-2 py-2 text-left text-sm font-semibold text-slate-700 dark:text-slate-200 ${
              isJournal
                ? 'border-amber-300'
                : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <BookOpen className="h-4 w-4 shrink-0" />
            <span className="truncate">Daily Journal ({journalCount})</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => selectAction('journal-timeline', closeMenu)}
            className="w-full px-2 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Journal Timeline ({journalCount})
          </button>

          <button
            type="button"
            role="menuitem"
            aria-current={activeModule === 'calculator' ? 'page' : undefined}
            onClick={() => selectAction('calculator', closeMenu)}
            className={`flex w-full items-center gap-2 border-t-2 px-2 py-2 text-left text-sm font-semibold text-slate-700 dark:text-slate-200 ${
              activeModule === 'calculator'
                ? 'border-amber-300'
                : 'border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'
            }`}
          >
            <Calculator className="h-4 w-4 shrink-0" />
            Calculator
          </button>
        </>
      )}
    </HeaderDropdown>
  );
};
