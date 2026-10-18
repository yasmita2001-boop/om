import React from 'react';
import { Link2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface LinkModeOption {
  value: string;
  label: string;
  icon?: LucideIcon;
}

interface LinkModeSelectorProps {
  value: string;
  options: LinkModeOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}

export const LinkModeSelector: React.FC<LinkModeSelectorProps> = ({
  value,
  options,
  onChange,
  ariaLabel,
  className = ''
}) => (
  <div
    role="group"
    aria-label={ariaLabel}
    className={`inline-flex max-w-full shrink-0 items-center gap-0.5 rounded-lg border border-slate-200/80 bg-slate-100/90 p-0.5 dark:border-slate-700/80 dark:bg-slate-800/90 ${className}`}
  >
    {options.map(option => {
      const Icon = option.icon || (option.value === 'manual' ? undefined : Link2);
      const isSelected = value === option.value;

      return (
        <button
          key={option.value}
          type="button"
          aria-pressed={isSelected}
          onClick={() => onChange(option.value)}
          className={`inline-flex min-h-7 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-semibold transition-colors cursor-pointer ${
            isSelected
              ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-900 dark:text-indigo-300'
              : 'text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white'
          }`}
        >
          {Icon && <Icon aria-hidden="true" className="h-3 w-3 shrink-0" />}
          <span>{option.label}</span>
        </button>
      );
    })}
  </div>
);
