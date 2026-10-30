import React, { useId, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

interface ProgressiveActionsProps {
  children: React.ReactNode;
  className?: string;
  label: string;
}

export function ProgressiveActions({ children, className = '', label }: ProgressiveActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();

  return (
    <div
      className={`progressive-actions ${className}`.trim()}
      data-open={isOpen}
      onClick={event => event.stopPropagation()}
    >
      <button
        type="button"
        className="progressive-actions__trigger"
        aria-label={label}
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen(open => !open)}
        onKeyDown={event => {
          if (event.key === 'Escape') setIsOpen(false);
        }}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      <div
        id={contentId}
        className="progressive-actions__content"
        aria-hidden={!isOpen}
        inert={!isOpen}
        onClickCapture={event => {
          if (event.target instanceof Element && event.target.closest('button')) {
            setIsOpen(false);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
