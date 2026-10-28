import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FormDisclosureProps {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** When true the toggle sits inside the panel header row as a quiet ghost control (default). */
  floating?: boolean;
  header?: React.ReactNode;
}

interface FormDisclosureToggleProps {
  label: string;
  openLabel?: string;
  compactLabel?: string;
  compactOpenLabel?: string;
  isOpen: boolean;
  onToggle: () => void;
  icon?: React.ReactNode;
  controls?: string;
}

export const FormDisclosureToggle: React.FC<FormDisclosureToggleProps> = ({
  label,
  openLabel = label,
  compactLabel,
  compactOpenLabel,
  isOpen,
  onToggle,
  icon,
  controls
}) => (
  <button
    type="button"
    aria-expanded={isOpen}
    aria-controls={controls}
    onClick={onToggle}
    className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 border-b-0 border-transparent px-2 py-1 text-[11px] font-semibold transition-colors ${
      isOpen
      ? 'text-indigo-700 dark:text-indigo-300'
      : 'text-indigo-800 hover:border-indigo-500 hover:text-indigo-950 dark:text-indigo-300 dark:hover:text-indigo-200'
    }`}
  >
    {icon}
    <span className={compactLabel ? 'hidden md:inline' : undefined}>
      {isOpen ? openLabel : label}
    </span>
    {compactLabel && <span className="md:hidden">{isOpen ? (compactOpenLabel || openLabel) : compactLabel}</span>}
    <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
  </button>
);

export const FormDisclosure: React.FC<FormDisclosureProps> = ({
  label,
  children,
  defaultOpen = false,
  floating = true,
  header
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    if (defaultOpen) setIsOpen(true);
  }, [defaultOpen]);

  return (
    <details
      open={isOpen}
      onToggle={event => setIsOpen(event.currentTarget.open)}
      className="group relative mt-0"
    >
      <summary
        className={
          header
            ? 'flex w-full cursor-pointer list-none items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800 [&::-webkit-details-marker]:hidden'
            : floating
            ? 'absolute -top-10 right-0 z-10 flex cursor-pointer list-none items-center gap-1.5 border-b-0 border-transparent px-2 py-2 text-xs font-semibold text-indigo-800 transition-colors hover:border-indigo-500 hover:text-indigo-950 dark:text-indigo-300 dark:hover:text-indigo-200 [&::-webkit-details-marker]:hidden'
            : 'ml-auto flex w-fit cursor-pointer list-none items-center gap-2 border-b-0 border-transparent px-2 py-2 text-xs font-semibold text-indigo-800 transition-colors hover:border-indigo-500 hover:text-indigo-950 dark:text-indigo-300 dark:hover:text-indigo-200 [&::-webkit-details-marker]:hidden'
        }
      >
        {header && <span className="min-w-0">{header}</span>}
        <span className={header
          ? 'flex shrink-0 items-center gap-1 py-1 text-[10px] font-semibold text-indigo-800 transition-colors group-hover:text-indigo-950 dark:text-indigo-300 dark:group-hover:text-indigo-200'
          : undefined}
        >
          <span>{label}</span>
          <ChevronDown className={header
            ? 'h-3 w-3 shrink-0 transition-transform group-open:rotate-180'
            : 'h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180'}
          />
        </span>
      </summary>
      {children}
    </details>
  );
};