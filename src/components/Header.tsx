import React, { useState, useEffect } from 'react';
import {
  Search, Plus, Moon, Sun, Users, Calendar,
  Clock, Check, ChevronDown, Menu, LogOut
} from 'lucide-react';
import { User } from 'firebase/auth';
import { NavModule, UserProfile } from '../types';
import { adToBs, getTodayIso } from '../lib/nepaliDate';

interface HeaderProps {
  activeModule: NavModule;
  onNavigate: (module: NavModule) => void;
  onOpenQuickCapture: (initialType?: string) => void;
  onOpenSearch: () => void;
  onOpenBsModal: () => void;
  onOpenDriveSyncModal: () => void;
  currentUser: User | null;
  onSignOut?: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  profiles: UserProfile[];
  currentProfileId: string;
  onSelectProfile: (id: string) => void;
  onOpenMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNavigate,
  onOpenQuickCapture,
  onOpenSearch,
  onOpenBsModal,
  onOpenDriveSyncModal,
  currentUser,
  onSignOut,
  theme,
  onToggleTheme,
  profiles,
  currentProfileId,
  onSelectProfile,
  onOpenMobileMenu
}) => {
  const [bsDateInfo, setBsDateInfo] = useState(() => {
    try {
      const today = getTodayIso();
      const bs = adToBs(today);
      return {
        bsIso: bs.iso,
        bsEn: bs.formattedEn,
        bsNe: bs.formattedNe,
        dayNameEn: bs.dayNameEn,
        dayNameNe: bs.dayNameNe,
        adIso: today
      };
    } catch {
      return {
        bsIso: '',
        bsEn: '',
        bsNe: '',
        dayNameEn: '',
        dayNameNe: '',
        adIso: ''
      };
    }
  });
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  // Live Clock interval
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute live BS and AD dates
  useEffect(() => {
    try {
      const today = getTodayIso();
      const bs = adToBs(today);
      setBsDateInfo({
        bsIso: bs.iso,
        bsEn: bs.formattedEn,
        bsNe: bs.formattedNe,
        dayNameEn: bs.dayNameEn,
        dayNameNe: bs.dayNameNe,
        adIso: today
      });
    } catch (err) {
      console.error('Error computing BS date', err);
    }
  }, []);

  const currentProfile = profiles.find(p => p.id === currentProfileId) || profiles[0];
  const timeFormatted = currentTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  return (
    <header className="sticky top-0 z-30 flex h-14 sm:h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-2 sm:px-4 lg:px-6 backdrop-blur-md dark:border-slate-800/80 dark:bg-[#0B0F19]/95 transition-colors gap-1.5 sm:gap-2.5">
      {/* Zone 1: Brand, Drawer Trigger & Unified Responsive Date Badge */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Mobile & Tablet Hamburger Drawer Trigger */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden cursor-pointer shrink-0 transition-colors"
          aria-label="Open Navigation Menu"
          title="Open Menu"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>

        {/* Brand Logo & Wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-1.5 sm:gap-2 text-left focus:outline-none cursor-pointer group shrink-0"
          title="Om-LifeOS Dashboard"
        >
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-indigo-600 font-serif font-extrabold text-white text-base shadow-xs group-hover:bg-indigo-500 transition-colors shrink-0">
            ॐ
          </div>
          <span className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap hidden sm:inline">
            Om-LifeOS
          </span>
        </button>

        {/* Unified Bikram Sambat Nepali Date Badge - Intelligently responsive across mobile, tablet, and desktop */}
        <button
          type="button"
          onClick={onOpenBsModal}
          className="flex items-center gap-1 sm:gap-1.5 rounded-xl border border-slate-200/90 bg-slate-50/80 px-2 sm:px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-400 hover:bg-white dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer shrink-0"
          title={`Bikram Sambat: ${bsDateInfo.bsEn} (${bsDateInfo.dayNameNe}) | AD: ${bsDateInfo.adIso} (Click to open Calendar Converter)`}
        >
          <Calendar className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="rounded bg-indigo-100/90 dark:bg-indigo-950/80 px-1 py-0.2 text-[9px] sm:text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase">
            BS
          </span>
          {/* Mobile phone: month-day (e.g. 06-23) */}
          <span className="font-mono text-[11px] font-bold text-slate-900 dark:text-slate-100 sm:hidden">
            {bsDateInfo.bsIso ? bsDateInfo.bsIso.slice(5) : ''}
          </span>
          {/* Tablet & Desktop: weekday (e.g. Fri) + full BS year-month-day */}
          <span className="font-mono text-[11px] font-bold text-slate-900 dark:text-slate-100 hidden sm:inline">
            {bsDateInfo.dayNameEn ? `${bsDateInfo.dayNameEn.slice(0, 3)}, ` : ''}{bsDateInfo.bsIso}
          </span>
          {/* Wide Desktop: also show AD date */}
          <span className="text-slate-300 dark:text-slate-600 font-normal hidden xl:inline">|</span>
          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 hidden xl:inline">
            {bsDateInfo.adIso}
          </span>
        </button>
      </div>

      {/* Zone 2: Global Search Bar - Fluidly adaptable across mobile, tablet, and desktop */}
      <div className="flex items-center justify-center flex-1 min-w-0 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg px-1 sm:px-2">
        {/* Full Interactive Search Trigger on Tablet and Desktop (sm+) */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="hidden sm:flex h-9 w-full items-center gap-2 rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 text-xs text-slate-400 hover:border-indigo-400 hover:bg-white hover:text-slate-600 dark:border-slate-800 dark:bg-slate-850/60 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:text-slate-400 cursor-pointer transition-all group overflow-hidden"
          title="Search tasks, goals, notes, ledger... (Cmd+K / Ctrl+K)"
        >
          <Search className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
          <span className="truncate hidden lg:inline">Search tasks, goals, notes, ledger...</span>
          <span className="truncate lg:hidden">Search...</span>
          <kbd className="ml-auto hidden xl:inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-900">
            ⌘K
          </kbd>
        </button>

        {/* Compact Responsive Search Pill on Mobile (<sm) */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="sm:hidden flex h-9 w-full max-w-[130px] items-center gap-1.5 rounded-xl border border-slate-200/90 bg-slate-50/80 px-2.5 text-xs text-slate-400 hover:border-indigo-400 hover:bg-white dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400 cursor-pointer transition-colors"
          title="Search (Cmd+K / Ctrl+K)"
          aria-label="Search"
        >
          <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className="text-[11px] font-medium truncate">Search</span>
        </button>
      </div>

      {/* Zone 3: Quick Action, Drive Sync, Workspace & Theme Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 shrink-0">
        {/* Live Clock Widget - Large Desktop Only */}
        <div
          className="hidden 2xl:flex h-9 items-center gap-1.5 rounded-xl border border-slate-200/90 bg-slate-50/80 px-2.5 font-mono text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 shrink-0"
          title="Live System Time"
        >
          <Clock className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
          <span className="tabular-nums">{timeFormatted}</span>
        </div>

        {/* Quick Capture Primary CTA - Compact icon on mobile/tablet, full button on desktop */}
        <button
          type="button"
          onClick={() => onOpenQuickCapture()}
          className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 px-2.5 sm:px-3 text-xs font-semibold text-white shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
          title="Quick capture a new task, note, or entry"
          aria-label="Quick Capture"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span className="hidden md:inline">Capture</span>
        </button>

        {/* Workspace Profile Switcher - Compact on Tablet (sm+), full on Desktop (lg+) */}
        <div className="relative hidden sm:block">
          <button
            type="button"
            onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 sm:px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 cursor-pointer transition-colors shrink-0"
            title={`Active Workspace: ${currentProfile?.name || 'Primary'}`}
          >
            <Users className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <span className="hidden lg:inline font-semibold max-w-[80px] truncate text-xs">
              {currentProfile?.name || 'Workspace'}
            </span>
            <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
          </button>

          {isProfileDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsProfileDropdownOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-1.5 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95">
                {currentUser && (
                  <div className="px-2.5 py-2 mb-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
                    {currentUser.photoURL ? (
                      <img
                        src={currentUser.photoURL}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover shrink-0 ring-1 ring-emerald-500/30"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {(currentUser.displayName?.[0] || currentUser.email?.[0] || 'G').toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {currentUser.displayName || 'Google Account'}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {currentUser.email}
                      </div>
                    </div>
                  </div>
                )}

                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Account Workspaces
                </div>
                <div className="space-y-1 my-1">
                  {profiles.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onSelectProfile(p.id);
                        setIsProfileDropdownOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
                        p.id === currentProfileId
                          ? 'bg-indigo-50 font-semibold text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="truncate">{p.name}</span>
                      {p.id === currentProfileId && (
                        <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="border-t border-slate-100 pt-1.5 dark:border-slate-800 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate('settings');
                      setIsProfileDropdownOpen(false);
                    }}
                    className="flex w-full items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-semibold cursor-pointer"
                  >
                    Manage Workspaces
                  </button>

                  {onSignOut && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        onSignOut();
                      }}
                      className="flex w-full items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold cursor-pointer transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5 shrink-0" />
                      <span>Sign Out</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer transition-colors shrink-0"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle Dark/Light Mode"
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4 text-amber-400" />
          ) : (
            <Moon className="h-4 w-4 text-slate-700" />
          )}
        </button>
      </div>
    </header>
  );
};
