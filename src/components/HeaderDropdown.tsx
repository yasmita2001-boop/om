import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface HeaderDropdownProps {
  label: ReactNode;
  menuLabel: string;
  icon: ReactNode;
  children: (closeMenu: () => void) => ReactNode;
  wrapperClassName?: string;
  triggerClassName?: string;
  menuClassName?: string;
}

export const HeaderDropdown: React.FC<HeaderDropdownProps> = ({
  label,
  menuLabel,
  icon,
  children,
  wrapperClassName = 'relative ml-auto min-w-0 max-w-full',
  triggerClassName,
  menuClassName
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !dropdownRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const closeMenu = () => setIsOpen(false);

  return (
    <div ref={dropdownRef} className={wrapperClassName}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={menuLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(open => !open)}
        className={triggerClassName || 'header-dropdown-trigger flex h-10 min-w-0 max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-900'}
      >
        {icon}
        <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div
          role="menu"
          aria-label={`${menuLabel} options`}
          className={menuClassName || 'absolute right-0 z-50 mt-2 max-h-[70vh] w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-slate-300 bg-white p-2 shadow-card dark:border-slate-600 dark:bg-slate-900'}
        >
          {children(closeMenu)}
        </div>
      )}
    </div>
  );
};
