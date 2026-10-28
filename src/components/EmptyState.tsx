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
 * Illustrated empty state used across list views (display system, Phase 3).
 * Token-driven: follows light/dark and the active accent automatically.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  hint,
  action,
  compact = false
}) => (
  <div
    className={`om-enter flex flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-card/60 text-center ${
      compact ? 'px-4 py-8' : 'px-6 py-12'
    }`}
  >
    {Icon && (
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100/80 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
        <Icon className="h-5 w-5" />
      </span>
    )}
    <p className="text-sm font-semibold text-ink">{title}</p>
    {hint && <p className="mt-1 max-w-xs text-xs text-ink-muted">{hint}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);