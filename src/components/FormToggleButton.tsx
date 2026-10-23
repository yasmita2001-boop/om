import React from 'react';
import { ChevronDown, Plus } from 'lucide-react';

interface FormToggleButtonProps {
  label: string;
  open: boolean;
  onClick: () => void;
  colorClassName?: string;
}

export const FormToggleButton: React.FC<FormToggleButtonProps> = ({
  label,
  open,
  onClick,
  colorClassName = 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-300 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/70'
}) => (
  <button
    type="button"
    aria-expanded={open}
    onClick={onClick}
    className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold shadow-xs transition-colors ${colorClassName}`}
  >
    <Plus className="h-3.5 w-3.5" />
    <span>{open ? 'Close Form' : label}</span>
    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
  </button>
);
