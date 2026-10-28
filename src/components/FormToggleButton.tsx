import React from 'react';
import { ChevronDown, Plus } from 'lucide-react';

interface FormToggleButtonProps {
  label: string;
  open: boolean;
  onClick: () => void;
}

export const FormToggleButton: React.FC<FormToggleButtonProps> = ({
  label,
  open,
  onClick
}) => (
  <button
    type="button"
    aria-expanded={open}
    onClick={onClick}
    className={`inline-flex shrink-0 items-center gap-1.5 border-b-0 border-transparent px-2 py-2 text-xs font-semibold transition-colors cursor-pointer ${
      open
        ? 'text-indigo-700 dark:text-indigo-300'
        : 'text-indigo-800 hover:border-indigo-500 hover:text-indigo-950 dark:text-indigo-300 dark:hover:text-indigo-200'
    }`}
  >
    <Plus className="h-3.5 w-3.5" />
    <span>{open ? 'Close Form' : label}</span>
    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
  </button>
);
