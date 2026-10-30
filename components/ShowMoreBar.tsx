import React from 'react';

interface ShowMoreBarProps {
  /** How many items are still hidden below the slice point. */
  remaining: number;
  /** Items to reveal per click. */
  step: number;
  onReveal: () => void;
}

/**
 * Progressive-render control for long lists. Rendering thousands of rows at
 * once is the main scroll/interaction jank source; views slice their maps and
 * use this bar to reveal the next slice on demand.
 */
export const ShowMoreBar: React.FC<ShowMoreBarProps> = ({ remaining, step, onReveal }) => (
  <div className="pt-3 pb-1 text-center">
    <button
      type="button"
      onClick={onReveal}
      className="rounded-full border border-line bg-card px-4 py-2 text-xs font-semibold text-ink-soft shadow-card transition-colors hover:bg-card-soft hover:text-ink"
    >
      {`Show ${Math.min(step, remaining)} more · ${remaining} hidden`}
    </button>
  </div>
);