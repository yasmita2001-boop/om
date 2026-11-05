import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Search, Plus, Zap, Moon, Sun, Calendar, ChevronDown, Clock, Sparkles, Mic, LayoutDashboard, CheckSquare, Target, FileText, DollarSign, Heart, Folder, Settings } from 'lucide-react';
import { NavModule } from '../types';
import { adToBs, getTodayIso } from '../lib/nepaliDate';
import { PWAInstallButton } from './PWAInstallButton';
import { soundEngine } from '../lib/soundEngine';
import { OmLogoMark } from './OmLogoMark';
import type { GoogleDriveSyncDropdownProps } from './GoogleDriveSyncDropdown';
import { HeaderDropdown } from './HeaderDropdown';

const GoogleDriveSyncDropdown = lazy(() =>
  import('./GoogleDriveSyncDropdown').then(module => ({ default: module.GoogleDriveSyncDropdown }))
);

interface HeaderProps {
  activeModule: NavModule;
  onNavigate: (module: NavModule) => void;
  openTasksCount: number;
  remindersCount: number;
  onOpenQuickCapture: (initialType?: string) => void;
  onOpenSearch: () => void;
  onOpenBsModal: () => void;
  onOpenVoiceStudio: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  environmentEnabled: boolean;
  onToggleEnvironment: () => void;
  onShowToast?: (msg: string) => void;
  workspaceProfileId?: string;
  googleUser?: GoogleDriveSyncDropdownProps['authenticatedUser'];
  onGoogleAccountChange?: GoogleDriveSyncDropdownProps['onAccountChanged'];
  onDataRestored?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeModule,
  onNavigate,
  openTasksCount,
  remindersCount,
  onOpenQuickCapture,
  onOpenSearch,
  onOpenBsModal,
  onOpenVoiceStudio,
  theme,
  onToggleTheme,
  environmentEnabled,
  onToggleEnvironment,
  onShowToast,
  workspaceProfileId,
  googleUser,
  onGoogleAccountChange,
  onDataRestored
}) => {
  const [bsDateInfo, setBsDateInfo] = useState(() => {
    const adIso = getTodayIso();
    try {
      const bs = adToBs(adIso);
      return {
        bsIso: bs.iso,
        bsFormattedNe: bs.formattedNe,
        adIso
      };
    } catch (error) {
      console.error('Failed to initialize the Nepali date in the header.', error);
      return { bsIso: '', bsFormattedNe: '', adIso };
    }
  });
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [is24Hour, setIs24Hour] = useState(false);

  // Live Clock interval
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute BS and AD dates
  useEffect(() => {
    const updateDate = () => {
      const todayIso = getTodayIso();
      if (todayIso === bsDateInfo.adIso) return;
      try {
        const bs = adToBs(todayIso);
        setBsDateInfo({
          bsIso: bs.iso,
          bsFormattedNe: bs.formattedNe,
          adIso: todayIso
        });
      } catch (error) {
        console.error('Failed to refresh the Nepali date in the header.', error);
        setBsDateInfo({ bsIso: '', bsFormattedNe: '', adIso: todayIso });
      }
    };
    const timer = setInterval(updateDate, 60_000);
    return () => clearInterval(timer);
  }, [bsDateInfo.adIso]);

  useEffect(() => {
    if (!isActionsOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsActionsOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActionsOpen]);

  const formattedTimeFull = currentTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: !is24Hour
  });
  const formattedTimeCompact = currentTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: !is24Hour
  });
  const compactHour = is24Hour
    ? currentTime.getHours()
    : currentTime.getHours() % 12 || 12;
  const formattedTimeTiny = `${compactHour}:${String(currentTime.getMinutes()).padStart(2, '0')}:${String(currentTime.getSeconds()).padStart(2, '0')}`;
  const formattedDateCompact = [
    String(currentTime.getDate()).padStart(2, '0'),
    String(currentTime.getMonth() + 1).padStart(2, '0'),
    String(currentTime.getFullYear()).slice(-2)
  ].join('-');
  const [bsYear = '', bsMonth = '', bsDay = ''] = bsDateInfo.bsIso.split('-');
  const formattedBsDate = bsYear && bsMonth && bsDay
    ? `${bsDay}-${bsMonth}-${bsYear.slice(-2)}`
    : '';

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
  const selectedNavModule: NavModule = activeModule === 'journal'
    ? 'notes'
    : activeModule === 'routine' || activeModule === 'focus'
      ? 'tasks'
      : activeModule === 'people' || activeModule === 'spiritual' || activeModule === 'work'
        ? 'health'
        : activeModule === 'calculator'
          ? 'notes'
          : activeModule === 'recycle_bin'
            ? 'settings'
            : activeModule;
  return (
    <header className="command-bar sticky top-0 z-30 flex h-12 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-2 sm:px-3 lg:px-6 shadow-[0_2px_12px_rgb(15_23_42/0.035)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#0B0F19]/95 dark:shadow-black/10 gap-1 sm:gap-1.5 lg:gap-3">
      {/* Zone 1: Left - Brand Identity & Nepali BS / Gregorian AD Date (Date is placed where search was) */}
      <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 shrink-0 select-none">
        <HeaderDropdown
          label={(
            <span className="brand-wordmark hidden md:flex md:flex-col whitespace-nowrap text-left text-sm font-bold tracking-tight text-slate-900 dark:text-white sm:text-base">
              <span>Om-LifeOS</span>
              <small style={{ fontSize: '10px', lineHeight: '16px' }}>Plan · Focus · Manifest</small>
            </span>
          )}
          menuLabel="Om-LifeOS main navigation"
          icon={<OmLogoMark className="h-8 w-7 shrink-0 transition-transform group-hover:scale-105 sm:h-9 sm:w-8" />}
          wrapperClassName="relative min-w-0 max-w-full shrink-0 select-none"
          triggerClassName="header-dropdown-trigger group flex h-9 max-w-full items-center gap-1.5 rounded-lg border border-transparent bg-transparent px-1 text-left transition-colors hover:bg-slate-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-slate-800/70 sm:gap-2"
          menuClassName="absolute left-0 right-auto z-50 mt-2 max-h-[calc(100dvh-8.5rem)] w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-slate-300 bg-white p-2 shadow-card dark:border-slate-600 dark:bg-slate-900 md:max-h-[70vh]"
        >
          {closeMenu => navItems.map(item => {
            const isActive = selectedNavModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  onNavigate(item.id);
                  closeMenu();
                }}
                className={`flex w-full min-w-0 items-center justify-between gap-3 border-b-2 px-2 py-2 text-left text-sm ${
                  isActive
                    ? 'border-amber-300 font-semibold text-slate-900 dark:text-white'
                    : 'border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
                {Boolean(item.badge && item.badge > 0) && (
                  <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">{item.badge}</span>
                )}
              </button>
            );
          })}
        </HeaderDropdown>

        {/* Date Display (Desktop & Tablet: Full or Semi-full Ribbon) */}
        <button
          type="button"
          onClick={onOpenBsModal}
          className="header-date-chip hidden md:inline-flex items-center gap-2 px-2.5 lg:px-3 py-1.5 transition-colors shrink-0 cursor-pointer group h-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          title={`Nepal Bikram Sambat: ${bsDateInfo.bsIso}. Click for converter.`}
          aria-label="Nepal Bikram Sambat Calendar Converter"
        >
          <Calendar className="header-chip-icon h-4 w-4 shrink-0 group-hover:scale-105 transition-transform" />
          <div className="flex min-w-0 flex-col items-start leading-tight">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-bold tracking-tight">
              <span className="header-chip-label rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide">
                BS
              </span>
              <span>{bsDateInfo.bsFormattedNe || bsDateInfo.bsIso}</span>
            </span>
          </div>
        </button>

        {/* Date Display (Mobile: Compact Badge) */}
        <button
          type="button"
          onClick={onOpenBsModal}
          className="header-date-chip header-date-chip--compact inline-flex md:hidden items-center gap-1 px-1.5 transition-colors shrink-0 cursor-pointer h-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          title={`Nepal BS: ${bsDateInfo.bsIso} (Click to open converter)`}
          aria-label="Nepal Bikram Sambat Date Converter"
        >
          <Calendar className="header-chip-icon hidden min-[350px]:block h-3.5 w-3.5 shrink-0" />
          <span className="header-chip-value min-[400px]:hidden font-semibold text-[9px] tracking-tight whitespace-nowrap">
            {formattedDateCompact}
          </span>
          <span className="header-chip-value font-mono text-[10px] font-semibold hidden min-[400px]:inline">
            {formattedBsDate}
          </span>
        </button>
      </div>

      {/* Zone 2: Middle - Search (Mobile & Tablet < 1024px: Crisp Icon Button, Laptop/Desktop >= 1024px: Full Search Bar) */}
      <div className="flex items-center justify-center shrink-0 lg:flex-1 lg:min-w-0 lg:px-6">
        {/* Mobile & Tablet Search Icon Button (< 1024px) */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex lg:hidden h-9 w-9 items-center justify-center text-indigo-700 hover:text-indigo-950 dark:text-indigo-300 dark:hover:text-indigo-200 cursor-pointer shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label="Global Search"
          title="Global Search (⌘K / Ctrl+K)"
        >
          <Search className="h-4 w-4 shrink-0" />
        </button>

        {/* Laptop & Desktop Search Bar (>= 1024px) */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="hidden lg:flex h-9 w-full max-w-sm items-center gap-2 px-3 text-xs sm:text-sm text-indigo-800 transition-colors hover:text-indigo-950 dark:text-indigo-300 dark:hover:text-indigo-200 cursor-pointer group overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label="Global Search (Press to search)"
          title="Global Search (⌘K / Ctrl+K)"
        >
          <Search className="h-4 w-4 shrink-0 text-indigo-700 dark:text-indigo-300 transition-colors" />
          <span className="truncate hidden xl:inline">Search notes, tasks, finance, goals...</span>
          <span className="truncate inline xl:hidden">Search notes, tasks...</span>
          <kbd className="ml-auto hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-medium text-indigo-700/70 dark:text-indigo-300/70 shrink-0">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Zone 3: Right - Consolidated Action Strip (Clock, Quick Capture, Fast Actions, Workspace, Theme) */}
      <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2 shrink-0 select-none">
        {/* Live Digital Clock Widget - Always displays prominent time */}
        <button
          type="button"
          onClick={() => setIs24Hour(prev => !prev)}
          className="header-clock-chip flex h-9 items-center gap-1 sm:gap-2 px-0.5 min-[400px]:px-1 sm:px-2.5 text-left transition-colors shrink-0 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          title={`Live System Clock (${is24Hour ? '24h' : '12h'} - Click to toggle)`}
          aria-label={`Current time ${formattedTimeFull}. Toggle 12/24 hour time format`}
        >
          <Clock className="header-chip-icon hidden min-[360px]:block h-3.5 w-3.5 shrink-0" />
          <span className="header-chip-value min-[350px]:hidden inline md:hidden text-[9px] font-semibold tracking-tight [font-variant-numeric:tabular-nums] whitespace-nowrap">
            {formattedTimeTiny}
          </span>
          <span className="header-chip-value hidden min-[350px]:inline md:hidden text-[9px] min-[360px]:text-[10px] font-semibold tracking-tight [font-variant-numeric:tabular-nums] whitespace-nowrap">
            {formattedTimeCompact}
          </span>
          <span className="header-chip-value hidden text-[11px] md:inline md:text-sm font-semibold tracking-tight [font-variant-numeric:tabular-nums] whitespace-nowrap">
            {formattedTimeFull}
          </span>
        </button>

        {/* Quick Command Menu Dropdown (Actions) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsActionsOpen(!isActionsOpen)}
            className="flex h-9 items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 text-xs font-medium text-indigo-700 transition-colors hover:text-indigo-950 dark:text-indigo-300 dark:hover:text-indigo-200 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Quick Actions"
            title="Fast Action Shortcuts"
          >
            <Zap className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <span className="hidden md:inline">Actions</span>
            <ChevronDown className="hidden min-[350px]:block h-3 w-3 shrink-0" />
          </button>

          {isActionsOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsActionsOpen(false)} />
              <div className="sanctuary-menu-surface absolute right-0 top-full z-50 mt-1.5 w-56 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95">
                <button
                  type="button"
                  onClick={() => { onOpenQuickCapture(); setIsActionsOpen(false); }}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-950 dark:text-indigo-300 dark:hover:text-indigo-200 cursor-pointer mb-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Quick Capture
                </button>

                {/* Voice Studio Action inside Dropdown */}
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.play('tap');
                    onOpenVoiceStudio();
                    setIsActionsOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer border-t border-slate-100 dark:border-slate-800/80 mt-1 pt-2"
                >
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4 text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
                    <span className="font-semibold text-slate-900 dark:text-slate-100">Voice Studio</span>
                  </div>
                  <div className="flex items-center gap-0.5 h-3 px-1" aria-hidden="true">
                    <span className="w-0.5 rounded-full bg-indigo-500 wave-bar-1" />
                    <span className="w-0.5 rounded-full bg-indigo-600 dark:bg-indigo-400 wave-bar-2" />
                    <span className="w-0.5 rounded-full bg-indigo-500 wave-bar-3" />
                    <span className="w-0.5 rounded-full bg-indigo-600 dark:bg-indigo-400 wave-bar-4" />
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onToggleEnvironment();
                    setIsActionsOpen(false);
                  }}
                  aria-pressed={environmentEnabled}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Sparkles className={`h-3.5 w-3.5 ${environmentEnabled ? 'text-indigo-500' : 'text-slate-400'}`} />
                  {environmentEnabled ? 'Disable sanctuary environment' : 'Enable sanctuary environment'}
                </button>
                <div className="border-t border-slate-100 dark:border-slate-800/80 mt-1 pt-2">
                  <Suspense fallback={<div className="h-10 rounded-xl bg-slate-100/70 dark:bg-slate-800/50" aria-hidden="true" />}>
                    <GoogleDriveSyncDropdown
                      workspaceProfileId={workspaceProfileId || 'om-master-profile'}
                      authenticatedUser={googleUser ?? null}
                      onToast={onShowToast}
                      onAccountChanged={onGoogleAccountChange}
                      onDataRestored={() => {
                        setIsActionsOpen(false);
                        onDataRestored?.();
                      }}
                    />
                  </Suspense>
                </div>
              </div>
            </>
          )}
        </div>

        {/* PWA Install Button (Windows & Android instant install, iOS instructions) */}
        <PWAInstallButton />

        {/* Theme Toggle Button with Tactile Sound */}
        <button
          type="button"
          onClick={() => {
            soundEngine.play('switchToggle');
            onToggleTheme();
          }}
          className="flex h-9 w-9 items-center justify-center text-indigo-700 transition-colors hover:text-indigo-950 dark:text-indigo-300 dark:hover:text-indigo-200 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle Dark/Light Mode"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
        </button>
      </div>
    </header>
  );
};
