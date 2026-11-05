import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { OmLogoMark } from './OmLogoMark';
import {
  LayoutDashboard, CheckSquare, Target, FileText,
  DollarSign, Heart,
  Folder, Settings, X
} from 'lucide-react';
import { NavModule } from '../types';

interface SidebarProps {
  activeModule: NavModule;
  onNavigate: (module: NavModule) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  openTasksCount: number;
  remindersCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
  openTasksCount,
  remindersCount,
}) => {
  const asideRef = useRef<HTMLElement>(null);
  const closeMobileHandlerRef = useRef(onCloseMobile);
  closeMobileHandlerRef.current = onCloseMobile;
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 1023px)').matches
  );

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const updateViewport = () => setIsMobileViewport(media.matches);
    updateViewport();
    media.addEventListener('change', updateViewport);
    return () => media.removeEventListener('change', updateViewport);
  }, []);

  useLayoutEffect(() => {
    if (!isMobileViewport || !isOpenMobile) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMobileHandlerRef.current();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = asideRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!asideRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (isMobileViewport) {
        document.querySelector<HTMLButtonElement>('[aria-label="Open Navigation Menu"]')?.focus();
      }
    };
  }, [isMobileViewport, isOpenMobile]);

  const navItems: { id: NavModule; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'goals', label: 'Goals', icon: <Target className="h-4 w-4" /> },
    { id: 'tasks', label: 'Tasks', icon: <CheckSquare className="h-4 w-4" />, badge: openTasksCount },
    { id: 'notes', label: 'Memo', icon: <FileText className="h-4 w-4" /> },
    { id: 'finance', label: 'Finance', icon: <DollarSign className="h-4 w-4" /> },
    { id: 'health', label: 'Life', icon: <Heart className="h-4 w-4" /> },
    { id: 'things', label: 'Vault', icon: <Folder className="h-4 w-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" />, badge: remindersCount }
  ];

  const handleSelect = (id: NavModule) => {
    onNavigate(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm transition-opacity lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Main Sidebar Component */}
      <aside
        ref={asideRef}
        id="mobile-navigation"
        aria-label="Main navigation"
        aria-hidden={isMobileViewport && !isOpenMobile ? true : undefined}
        inert={isMobileViewport && !isOpenMobile}
        className={`sanctuary-sidebar fixed inset-y-0 left-0 z-50 flex w-40 flex-col border-r border-slate-200/80 bg-white/90 backdrop-blur-xl transition-transform duration-200 ease-in-out dark:border-white/[0.08] dark:bg-[#0B0F19]/95 lg:sticky lg:top-12 lg:h-[calc(100vh-3rem)] lg:shrink-0 lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        } ${
          isMobileViewport && !isOpenMobile ? 'invisible lg:visible' : ''
        }`}
      >
        {/* App Title & Mobile Close (Only visible on mobile drawer to avoid duplicate Om-LifeOS under Header) */}
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5 dark:border-white/[0.06] lg:hidden">
          <div className="flex items-center gap-2.5">
            <OmLogoMark className="h-9 w-8" />
            <div>
              <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                Om-LifeOS
              </span>
            </div>
          </div>
          {isMobileViewport && isOpenMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation menu"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <nav aria-label="Main navigation" className="space-y-0.5">
            {navItems.map(item => {
                    const isActive = activeModule === item.id || (item.id === 'notes' && activeModule === 'journal');
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelect(item.id)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`group flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                          isActive
                            ? 'text-indigo-700 dark:text-indigo-300 [&_svg]:text-indigo-700 dark:[&_svg]:text-indigo-300'
                            : 'text-indigo-800 hover:text-indigo-950 dark:text-indigo-300 dark:hover:text-indigo-200'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={`shrink-0 transition-colors ${
                              isActive
                                ? 'text-indigo-700 dark:text-indigo-300'
                                : 'text-indigo-800 group-hover:text-indigo-950 dark:text-indigo-300 dark:group-hover:text-indigo-200'
                            }`}
                          >
                            {item.icon}
                          </span>
                          <span className="truncate">{item.label}</span>
                        </span>

                        {Boolean(item.badge && item.badge > 0) && (
                          <span
                            className={`ml-2 shrink-0 text-[10px] font-semibold tabular-nums ${
                              isActive
                                ? 'text-indigo-700 dark:text-indigo-300'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
          </nav>
        </div>
      </aside>
    </>
  );
};
