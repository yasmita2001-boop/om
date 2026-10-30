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
          className="flex h-8 w-8 shrink-0 items-center justify-center text-indigo-800 transition-colors hover:text-indigo-950 active:scale-95 dark:text-indigo-300 dark:hover:text-indigo-200"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      {/* Main Horizontal Slide Scroll Area */}
      <div
        ref={scrollRef}
        className={`flex min-w-0 flex-1 items-center gap-3 overflow-x-auto no-scrollbar scroll-smooth py-1 ${className}`}
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
              className={`relative flex shrink-0 items-center justify-center gap-1.5 sm:gap-2 border-b-0 border-transparent font-semibold tracking-normal transition-colors cursor-pointer whitespace-nowrap min-w-fit select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${
                isSmall
                  ? 'px-1.5 sm:px-2 py-1.5 text-xs'
                  : 'px-2 sm:px-2.5 py-2 text-xs'
              } ${
                isSelected
                  ? 'text-indigo-700 font-bold dark:text-indigo-300 [&_svg]:text-indigo-700 dark:[&_svg]:text-indigo-300'
                  : 'text-indigo-800 hover:text-indigo-950 dark:text-indigo-300 dark:hover:text-indigo-200'
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
                  className={`text-[10px] font-black uppercase shrink-0 ${
                    isSelected ? 'text-rose-700 dark:text-rose-300 animate-pulse' : 'text-rose-600 dark:text-rose-400 animate-pulse'
                  }`}
                >
                  {tab.delayed}
                </span>
              )}

              {/* Regular Badge */}
              {!hasDelayed && tab.badge !== undefined && tab.badge !== null && (
                <span
                  className={`text-[10px] font-bold shrink-0 ${
                    isSelected
                      ? 'text-indigo-700 dark:text-indigo-300'
                      : 'text-slate-500 dark:text-slate-400'
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
          className="flex h-8 w-8 shrink-0 items-center justify-center text-indigo-800 transition-colors hover:text-indigo-950 active:scale-95 dark:text-indigo-300 dark:hover:text-indigo-200"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Optional Extra Right Element (e.g. Action Button) */}
      {extraRight && <div className="ml-1 shrink-0">{extraRight}</div>}
    </div>
  );
};
