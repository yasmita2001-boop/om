import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FormDisclosureProps {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export const FormDisclosure: React.FC<FormDisclosureProps> = ({
  label,
  children,
  defaultOpen = false
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
      <summary className="absolute -top-10 right-0 z-10 inline-flex cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-700 dark:hover:text-indigo-300 [&::-webkit-details-marker]:hidden">
        <span>{label}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      {children}
    </details>
  );
};
