import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

/**
 * Quiet empty state used across list views; the parent section owns the surface.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  hint,
  action,
  compact = false
}) => (
  <div
    className={`om-empty-state om-enter flex w-full flex-col items-center justify-center text-center ${
      compact ? 'px-4 py-3' : 'px-6 py-10'
    }`}
  >
    {Icon && (
      <span className={`om-empty-state-icon flex items-center justify-center ${
        compact ? 'mb-2 h-8 w-8 rounded-lg' : 'mb-3 h-10 w-10 rounded-xl'
      }`}>
        <Icon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
      </span>
    )}
    <p className="text-sm font-semibold text-ink">{title}</p>
    {hint && <p className="mt-1 max-w-xs text-xs text-ink-muted">{hint}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);