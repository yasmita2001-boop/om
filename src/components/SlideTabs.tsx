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

    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, tabs]);

  // Auto-scroll active tab into view smoothly
  useEffect(() => {
    if (activeTabRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const target = activeTabRef.current;

      const targetLeft = target.offsetLeft;
      const targetWidth = target.offsetWidth;
      const containerWidth = container.clientWidth;
      const currentScroll = container.scrollLeft;

      if (targetLeft < currentScroll || targetLeft + targetWidth > currentScroll + containerWidth) {
        container.scrollTo({
          left: targetLeft - (containerWidth / 2) + (targetWidth / 2),
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
    <div className={`relative flex items-center w-full gap-1.5 ${containerClassName}`}>
      {/* Left Scroll Trigger Button */}
      {showArrows && canScrollLeft && (
        <button
          type="button"
          onClick={() => handleScroll('left')}
          aria-label="Slide tabs left"
          className="absolute left-0 z-10 flex h-8 w-8 items-center justify-center rounded-xl bg-white/95 text-slate-700 shadow-md ring-1 ring-slate-200 backdrop-blur-sm transition-all hover:bg-slate-100 hover:scale-105 active:scale-95 dark:bg-slate-900/95 dark:text-slate-200 dark:ring-slate-700 cursor-pointer shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      {/* Main Horizontal Slide Scroll Area */}
      <div
        ref={scrollRef}
        className={`flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth w-full py-1 ${className}`}
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
              className={`flex shrink-0 lg:flex-1 items-center justify-center gap-1.5 sm:gap-2 rounded-xl font-semibold tracking-normal transition-all cursor-pointer whitespace-nowrap min-w-fit select-none ${
                isSmall
                  ? 'px-2.5 sm:px-3 py-1.5 text-xs'
                  : 'px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm'
              } ${
                isSelected
                  ? 'bg-amber-500 text-white shadow-xs font-bold ring-1 ring-amber-400'
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
                      ? 'bg-amber-600/60 text-white'
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
          className="absolute right-0 z-10 flex h-8 w-8 items-center justify-center rounded-xl bg-white/95 text-slate-700 shadow-md ring-1 ring-slate-200 backdrop-blur-sm transition-all hover:bg-slate-100 hover:scale-105 active:scale-95 dark:bg-slate-900/95 dark:text-slate-200 dark:ring-slate-700 cursor-pointer shrink-0"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Optional Extra Right Element (e.g. Action Button) */}
      {extraRight && <div className="shrink-0 ml-1">{extraRight}</div>}
    </div>
  );
};
