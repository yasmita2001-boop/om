import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, LucideIcon } from 'lucide-react';

export interface SlideTabItem {
  id: string;
  label: string;
  shortLabel?: string;
  icon?: LucideIcon | React.ComponentType<{ className?: string }> | React.ReactNode;
  badge?: string | number | null;
  delayed?: number | null;
  badgeColor?: string;
}

interface SlideTabsProps {
  tabs: SlideTabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  containerClassName?: string;
  showArrows?: boolean;
  extraRight?: React.ReactNode;
  size?: 'sm' | 'md';
}

export const SlideTabs: React.FC<SlideTabsProps> = ({
  tabs,
  activeId,
  onChange,
  className = '',
  containerClassName = '',
  showArrows = true,
  extraRight,
  size = 'md'
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll position to display left/right navigation arrows
  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    const resizeObserver = new ResizeObserver(checkScroll);
    resizeObserver.observe(el);
    Array.from(el.children).forEach(child => resizeObserver.observe(child));

    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
      resizeObserver.disconnect();
    };
  }, [checkScroll, tabs.length]);

  // Auto-scroll active tab into view smoothly
  useEffect(() => {
    if (activeTabRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const target = activeTabRef.current;
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const leftOverflow = targetRect.left - containerRect.left;
      const rightOverflow = targetRect.right - containerRect.right;

      if (leftOverflow < 0 || rightOverflow > 0) {
        container.scrollTo({
          left: container.scrollLeft + (leftOverflow < 0 ? leftOverflow : rightOverflow),
          behavior: 'smooth'
        });
      }
    }
  }, [activeId]);

  const handleScroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const offset = direction === 'left' ? -260 : 260;
    el.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const isSmall = size === 'sm';

  return (
    <div className={`flex min-w-0 w-full items-center gap-1.5 ${containerClassName}`}>
      {/* Left Scroll Trigger Button */}
      {showArrows && canScrollLeft && (
        <button
          type="button"
          onClick={() => handleScroll('left')}
          aria-label="Slide tabs left"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-2xs transition-colors hover:bg-slate-50 hover:text-slate-900 active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      {/* Main Horizontal Slide Scroll Area */}
      <div
        ref={scrollRef}
        className={`flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-1 ${className}`}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {tabs.map(tab => {
          const isSelected = activeId === tab.id;
          const hasDelayed = Boolean(tab.delayed && tab.delayed > 0);

          // Render icon safely
          let iconElement: React.ReactNode = null;
          if (tab.icon) {
            if (React.isValidElement(tab.icon)) {
              iconElement = tab.icon;
            } else {
              const IconComp = tab.icon as React.ComponentType<{ className?: string }>;
              iconElement = <IconComp className={isSmall ? "h-3.5 w-3.5 shrink-0" : "h-4 w-4 shrink-0"} />;
            }
          }

          return (
            <button
              key={tab.id}
              ref={isSelected ? activeTabRef : null}
              type="button"
              onClick={() => onChange(tab.id)}
              aria-current={isSelected ? 'page' : undefined}
              className={`flex shrink-0 items-center justify-center gap-1.5 sm:gap-2 rounded-lg font-semibold tracking-normal transition-colors cursor-pointer whitespace-nowrap min-w-fit select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${
                isSmall
                  ? 'px-2.5 sm:px-3 py-1.5 text-xs'
                  : 'px-3 sm:px-3.5 py-2 text-xs sm:text-sm'
              } ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-sm font-bold hover:bg-indigo-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/80'
              }`}
            >
              {iconElement}
              <span className="truncate">
                {tab.shortLabel ? (
                  <>
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.shortLabel}</span>
                  </>
                ) : (
                  tab.label
                )}
              </span>

              {/* Delayed Badge */}
              {hasDelayed && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[9px] font-black uppercase shrink-0 ${
                    isSelected ? 'bg-rose-700 text-white animate-pulse' : 'bg-rose-600 text-white animate-pulse'
                  }`}
                >
                  {tab.delayed}
                </span>
              )}

              {/* Regular Badge */}
              {!hasDelayed && tab.badge !== undefined && tab.badge !== null && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[9px] sm:text-[10px] font-bold shrink-0 ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : tab.badgeColor || 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Right Scroll Trigger Button */}
      {showArrows && canScrollRight && (
        <button
          type="button"
          onClick={() => handleScroll('right')}
          aria-label="Slide tabs right"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-2xs transition-colors hover:bg-slate-50 hover:text-slate-900 active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Optional Extra Right Element (e.g. Action Button) */}
      {extraRight && <div className="ml-1 shrink-0">{extraRight}</div>}
    </div>
  );
};
