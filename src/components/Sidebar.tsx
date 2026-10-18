import React from 'react';
import {
  LayoutDashboard, CheckSquare, Repeat, Target, Timer, FileText,
  BookOpen, Calculator, DollarSign, Heart, Briefcase, Users,
  Compass, Folder, Settings, X
} from 'lucide-react';
import { NavModule } from '../types';
import { GoogleDriveSyncDropdown, GoogleDriveSyncDropdownProps } from './GoogleDriveSyncDropdown';

interface SidebarProps {
  activeModule: NavModule;
  onNavigate: (module: NavModule) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  openTasksCount: number;
  remindersCount: number;
  onToast?: (msg: string) => void;
  onDataRestored?: () => void;
  workspaceProfileId: string;
  onGoogleAccountChange: GoogleDriveSyncDropdownProps['onAccountChanged'];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
  openTasksCount,
  remindersCount,
  onToast,
  onDataRestored,
  workspaceProfileId,
  onGoogleAccountChange,
}) => {
  type NavGroup = 'home' | 'plan' | 'personal' | 'life' | 'system';
  const navItems: { id: NavModule; label: string; icon: React.ReactNode; group: NavGroup; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, group: 'home' },
    { id: 'goals', label: 'Goals', icon: <Target className="h-4 w-4" />, group: 'plan' },
    { id: 'tasks', label: 'Tasks', icon: <CheckSquare className="h-4 w-4" />, group: 'plan', badge: openTasksCount },
    { id: 'routine', label: 'Routines', icon: <Repeat className="h-4 w-4" />, group: 'plan' },
    { id: 'focus', label: 'Focus', icon: <Timer className="h-4 w-4" />, group: 'plan' },
    { id: 'notes', label: 'Notes', icon: <FileText className="h-4 w-4" />, group: 'personal' },
    { id: 'journal', label: 'Daily Journal', icon: <BookOpen className="h-4 w-4" />, group: 'personal' },
    { id: 'calculator', label: 'Calculator', icon: <Calculator className="h-4 w-4" />, group: 'life' },
    { id: 'finance', label: 'Finance', icon: <DollarSign className="h-4 w-4" />, group: 'life' },
    { id: 'health', label: 'Health', icon: <Heart className="h-4 w-4" />, group: 'life' },
    { id: 'work', label: 'Work & Projects', icon: <Briefcase className="h-4 w-4" />, group: 'life' },
    { id: 'people', label: 'People', icon: <Users className="h-4 w-4" />, group: 'life' },
    { id: 'spiritual', label: 'Values', icon: <Compass className="h-4 w-4" />, group: 'life' },
    { id: 'things', label: 'Things & Assets', icon: <Folder className="h-4 w-4" />, group: 'life' },
    { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" />, group: 'system', badge: remindersCount }
  ];

  const navGroups = [
    { id: 'home', label: 'HOME' },
    { id: 'plan', label: 'PLAN & FOCUS' },
    { id: 'personal', label: 'PERSONAL' },
    { id: 'life', label: 'LIFE AREAS' },
    { id: 'system', label: 'SYSTEM' }
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
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200/80 bg-white/90 backdrop-blur-xl transition-transform duration-200 ease-in-out dark:border-white/[0.08] dark:bg-[#0B0F19]/95 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:shrink-0 lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* App Title & Mobile Close (Only visible on mobile drawer to avoid duplicate Om-LifeOS under Header) */}
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5 dark:border-white/[0.06] lg:hidden">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 font-serif font-bold text-white shadow-sm shadow-indigo-500/30">
              ॐ
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                Om-LifeOS
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <nav aria-label="Main navigation" className="space-y-4">
            {navGroups.map(group => (
              <div key={group.id}>
                <h2 className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {group.label}
                </h2>
                <div className="space-y-0.5">
                {navItems.filter(item => item.group === group.id).map(item => {
                    const isActive = activeModule === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelect(item.id)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-indigo-50 text-indigo-600 shadow-2xs dark:bg-indigo-950/50 dark:text-indigo-400'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={`shrink-0 transition-colors ${
                              isActive
                                ? 'text-indigo-600 dark:text-indigo-400'
                                : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'
                            }`}
                          >
                            {item.icon}
                          </span>
                          <span className="truncate">{item.label}</span>
                        </span>

                        {Boolean(item.badge && item.badge > 0) && (
                          <span
                            className={`ml-2 shrink-0 rounded-full px-1.5 py-0.2 text-[10px] font-semibold tabular-nums ${
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
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Google Drive is the app's only cloud sync destination. */}
        <div className="border-t border-slate-100 p-3 dark:border-slate-800/80 space-y-2">
          <GoogleDriveSyncDropdown
            workspaceProfileId={workspaceProfileId}
            onToast={onToast}
            onAccountChanged={onGoogleAccountChange}
            onDataRestored={() => {
              onCloseMobile();
              onDataRestored?.();
            }}
          />
        </div>
      </aside>
    </>
  );
};
