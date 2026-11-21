import React, { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, X } from 'lucide-react';
import { NavModule } from '../types';
import { OmLogoMark } from './OmLogoMark';
import { PRIMARY_NAV, resolveSelectedNav } from '../lib/navConfig';

interface MobileBottomNavProps {
  activeModule: NavModule;
  onNavigate: (module: NavModule) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeModule,
  onNavigate,
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMoreOpen) return;

    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMoreOpen(false);
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
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
      moreButtonRef.current?.focus();
    };
  }, [isMoreOpen]);

  const primaryTabs = PRIMARY_NAV.slice(0, 3).map(item => ({
    ...item,
    label: item.id === 'dashboard' ? 'Home' : item.label,
    icon: <item.Icon className="h-4 w-4" />
  }));

  // This launcher lists parent modules only. Child sections are selected inside
  // their parent screen: Tasks (Routines/Focus), Memo (Journal/Calculator).
  const secondaryModules = PRIMARY_NAV.slice(3).map(item => ({
    ...item,
    icon: <item.Icon className="h-4 w-4 text-indigo-500" />
  }));

  const selectedNavModule = resolveSelectedNav(activeModule);
  const isMoreActive = PRIMARY_NAV.slice(3).some(item => item.id === selectedNavModule);

  const handleSelect = (id: NavModule) => {
    onNavigate(id);
    setIsMoreOpen(false);
  };

  return (
    <>
      {/* Mobile Drawer / Quick Launcher Sheet */}
      {isMoreOpen && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end bg-slate-950/70 backdrop-blur-sm lg:hidden animate-in fade-in duration-200">
          <div
            className="flex-1"
            onClick={() => setIsMoreOpen(false)}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Modules"
            className="sanctuary-mobile-module-sheet relative isolate w-full rounded-t-3xl border-t border-slate-200 bg-white px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl dark:border-white/10 dark:bg-[#111827] animate-in slide-in-from-bottom duration-250 max-h-[80dvh] overflow-y-auto"
          >
            <div className="sanctuary-mobile-module-sheet-header flex w-full items-center justify-between border-b border-slate-100 pb-3 dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <OmLogoMark className="h-8 w-7" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Modules</h3>
                </div>
              </div>
              <button
                type="button"
                ref={closeButtonRef}
                onClick={() => setIsMoreOpen(false)}
                aria-label="Close modules menu"
                className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-4">
              {secondaryModules.map(mod => {
                const isActive = selectedNavModule === mod.id;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => handleSelect(mod.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`sanctuary-mobile-module-option flex items-start gap-2.5 p-3 text-left transition-colors cursor-pointer ${
                      isActive
                          ? 'text-indigo-700 dark:text-indigo-300 [&_svg]:text-indigo-700 dark:[&_svg]:text-indigo-300'
                          : 'text-indigo-800 hover:text-indigo-950 dark:text-indigo-300 dark:hover:text-indigo-200'
                    }`}
                  >
                    <div className={`mt-0.5 shrink-0 ${isActive ? 'text-indigo-700 dark:text-indigo-300' : ''}`}>
                      {mod.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate">{mod.label}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom Bar */}
      <nav className="sanctuary-mobile-bottom-nav fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-slate-200/80 bg-white px-1 dark:border-white/[0.08] dark:bg-[#0B0F19] lg:hidden transition-colors">
        {primaryTabs.map(tab => {
          const isActive = selectedNavModule === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex h-14 flex-1 flex-col items-center justify-center gap-1 py-1.5 px-1 transition-colors cursor-pointer ${
                isActive
                  ? 'font-bold text-indigo-700 dark:text-indigo-300 [&_svg]:text-indigo-700 dark:[&_svg]:text-indigo-300'
                  : 'text-indigo-800 hover:text-indigo-950 dark:text-indigo-300 dark:hover:text-indigo-200 font-medium'
              }`}
            >
              <div>
                {tab.icon}
              </div>
              <span className="text-[10px] tracking-normal leading-tight">{tab.label}</span>
            </button>
          );
        })}

        {/* More Launcher Button */}
        <button
          type="button"
          ref={moreButtonRef}
          onClick={() => setIsMoreOpen(true)}
          className={`flex h-14 flex-1 flex-col items-center justify-center gap-1 py-1.5 px-1 transition-colors cursor-pointer ${
            isMoreActive
            ? 'font-bold text-indigo-700 dark:text-indigo-300 [&_svg]:text-indigo-700 dark:[&_svg]:text-indigo-300'
            : 'text-indigo-800 hover:text-indigo-950 dark:text-indigo-300 dark:hover:text-indigo-200 font-medium'
          }`}
          aria-label="More modules"
          aria-current={isMoreActive ? 'page' : undefined}
        >
          <div>
            <MoreHorizontal className="h-4 w-4" />
          </div>
          <span className="text-[10px] tracking-normal leading-tight">More</span>
        </button>
      </nav>
    </>
  );
};
