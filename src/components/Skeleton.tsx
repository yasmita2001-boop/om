import React from 'react';

/** Shimmering placeholder bar (token-driven, respects prefers-reduced-motion). */
export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div aria-hidden="true" className={`om-skeleton ${className}`} />
);

/** Page-level loading skeleton shown while lazy view chunks load. */
export const ViewSkeleton: React.FC = () => (
  <div role="status" aria-live="polite" className="mx-auto w-full max-w-5xl space-y-5 px-1 py-2">
    <div className="flex items-center justify-between gap-3">
      <Skeleton className="h-8 w-44" />
      <Skeleton className="h-8 w-28 rounded-xl" />
    </div>
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {[0, 1, 2, 3].map(i => (
        <Skeleton key={i} className="h-28 rounded-2xl" />
      ))}
    </div>
    <Skeleton className="h-40 rounded-2xl" />
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Skeleton className="h-32 rounded-2xl" />
      <Skeleton className="h-32 rounded-2xl" />
    </div>
    <span className="sr-only">Loading</span>
  </div>
);