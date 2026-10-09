import React from 'react';
import {
  LayoutDashboard, CheckSquare, Repeat, Target, Timer,
  FileText, BookOpen, DollarSign, Heart, Calculator,
  Settings, X, ShieldCheck, Cloud
} from 'lucide-react';
import { User } from 'firebase/auth';
import { NavModule } from '../types';

interface SidebarProps {
  activeModule: NavModule;
  onNavigate: (module: NavModule) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  openTasksCount: number;
  onOpenDriveSync?: () => void;
  currentUser?: User | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
  openTasksCount,
  onOpenDriveSync,
  currentUser
}) => {
  const navItems: { id: NavModule; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: 'Command Center', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'goals', label: 'Goals & Strategy', icon: <Target className="h-4 w-4" /> },
    { id: 'tasks', label: 'Tasks & Planner', icon: <CheckSquare className="h-4 w-4" />, badge: openTasksCount },
    { id: 'routine', label: 'Routine & Habits', icon: <Repeat className="h-4 w-4" /> },
    { id: 'focus', label: 'Focus & Deep Work', icon: <Timer className="h-4 w-4" /> },
    { id: 'notes', label: 'Notebooks & Vault', icon: <FileText className="h-4 w-4" /> },
    { id: 'journal', label: 'Daily Journal', icon: <BookOpen className="h-4 w-4" /> },
    { id: 'finance', label: 'Finance & Ledger', icon: <DollarSign className="h-4 w-4" /> },
    { id: 'health', label: 'Health & Vitals', icon: <Heart className="h-4 w-4" /> },
    { id: 'calculator', label: 'Calculators', icon: <Calculator className="h-4 w-4" /> },
    { id: 'settings', label: 'Settings & Backups', icon: <Settings className="h-4 w-4" /> }
  ];

  const handleSelect = (id: NavModule) => {
    onNavigate(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Main Sidebar Component */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-slate-200/80 bg-white/95 backdrop-blur-md transition-transform duration-200 ease-in-out dark:border-slate-800/80 dark:bg-[#0B0F19]/95 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:shrink-0 lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile Header Title */}
        <div className="flex h-14 items-center justify-between border-b border-slate-100 px-4 dark:border-slate-800 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 font-serif font-bold text-white text-xs">
              ॐ
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-white">Om-LifeOS</span>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <nav className="space-y-0.5">
            {navItems.map(item => {
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-600 shadow-2xs dark:bg-indigo-950/50 dark:text-indigo-400'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`transition-colors shrink-0 ${
                        isActive
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </div>

                  {Boolean(item.badge && item.badge > 0) && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums shrink-0 ${
                        isActive
                          ? 'bg-indigo-200 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
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

        {/* Google Drive Cloud Sync Shortcut */}
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={() => {
              if (onOpenDriveSync) onOpenDriveSync();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800 px-2.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2">
              <Cloud className="h-4 w-4 text-indigo-500" />
              <span>Google Drive Sync</span>
            </div>
            {currentUser ? (
              <span className="flex h-2 w-2 rounded-full bg-emerald-500" title="Connected" />
            ) : (
              <span className="text-[10px] text-slate-400 font-normal">Connect</span>
            )}
          </button>
        </div>

        {/* Footer info: Local Sovereignty indicator */}
        <div className="border-t border-slate-100 p-3 text-center dark:border-slate-800">
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span>Local-First Sovereign</span>
          </div>
          <p className="mt-0.5 font-mono text-[9px] text-slate-400 dark:text-slate-500">
            100% Offline · Zero Telemetry
          </p>
        </div>
      </aside>
    </>
  );
};
