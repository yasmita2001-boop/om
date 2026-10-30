import React from 'react';
import { Link2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface LinkModeOption {
  value: string;
  label: string;
  icon?: LucideIcon | null;
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
}) => {
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value));
  const selectedOption = options[selectedIndex];

  if (options.length === 2 && selectedOption) {
    const nextOption = options[(selectedIndex + 1) % options.length];
    const Icon = selectedOption.icon === null
      ? undefined
      : selectedOption.icon || (selectedOption.value === 'manual' ? undefined : Link2);

    return (
      <button
        type="button"
        role="switch"
        aria-label={ariaLabel}
        aria-checked={selectedIndex === 0}
        title={`Switch to ${nextOption.label}`}
        onClick={() => onChange(nextOption.value)}
        className={`sanctuary-mode-toggle inline-flex min-h-7 shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold text-amber-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:text-amber-300 ${className}`}
      >
        {Icon && <Icon aria-hidden="true" className="h-3 w-3 shrink-0" />}
        <span>{selectedOption.label}</span>
        <span aria-hidden="true" className="relative h-4 w-7 shrink-0 rounded-full bg-slate-300 transition-colors dark:bg-slate-700">
          <span className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${selectedIndex === 0 ? 'translate-x-3' : 'translate-x-0'}`} />
        </span>
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`inline-flex max-w-full shrink-0 items-center gap-2 ${className}`}
    >
      {options.map(option => {
        const Icon = option.icon === null
          ? undefined
          : option.icon || (option.value === 'manual' ? undefined : Link2);
        const isSelected = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(option.value)}
            className={`inline-flex min-h-7 shrink-0 items-center justify-center gap-1 whitespace-nowrap border-b-0 border-transparent px-2 py-1 text-[10px] font-semibold transition-colors cursor-pointer ${
              isSelected
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-amber-800 hover:border-amber-500 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
            }`}
          >
            {Icon && <Icon aria-hidden="true" className="h-3 w-3 shrink-0" />}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};
