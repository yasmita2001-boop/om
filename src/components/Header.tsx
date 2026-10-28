import React, { useState, useEffect } from 'react';
import { Search, Plus, Zap, Moon, Sun, Calendar, ChevronDown, Clock, Sparkles } from 'lucide-react';
import { NavModule } from '../types';
import { adToBs, getTodayIso } from '../lib/nepaliDate';
import { PWAInstallButton } from './PWAInstallButton';
import { soundEngine } from '../lib/soundEngine';
import { OmLogoMark } from './OmLogoMark';

interface HeaderProps {
  activeModule: NavModule;
  onNavigate: (module: NavModule) => void;
  onOpenQuickCapture: (initialType?: string) => void;
  onOpenSearch: () => void;
  onOpenBsModal: () => void;
  onOpenVoiceStudio: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  environmentEnabled: boolean;
  onToggleEnvironment: () => void;
  onOpenMobileMenu: () => void;
  onShowToast?: (msg: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNavigate,
  onOpenQuickCapture,
  onOpenSearch,
  onOpenBsModal,
  onOpenVoiceStudio,
  theme,
  onToggleTheme,
  environmentEnabled,
  onToggleEnvironment,
  onOpenMobileMenu
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
    hour12: !is24Hour
  });

  return (
    <header className="command-bar sticky top-0 z-30 flex h-14 sm:h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-2 sm:px-3 lg:px-6 shadow-[0_2px_12px_rgb(15_23_42/0.035)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#0B0F19]/95 dark:shadow-black/10 gap-1 sm:gap-1.5 lg:gap-3">
      {/* Zone 1: Left - Brand Identity & Nepali BS / Gregorian AD Date (Date is placed where search was) */}
      <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 shrink-0 select-none">
        {/* Mobile & Tablet Hamburger Drawer Trigger */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="flex h-9 w-9 items-center justify-center text-indigo-700 hover:text-indigo-950 dark:text-indigo-300 dark:hover:text-indigo-200 lg:hidden cursor-pointer shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label="Open Navigation Menu"
        >
          <span className="text-lg leading-none">☰</span>
        </button>

        {/* Brand Logo & Wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-1.5 sm:gap-2.5 text-left focus:outline-none group cursor-pointer shrink-0"
          title="Om-LifeOS Dashboard"
        >
          <OmLogoMark className="h-9 w-8 sm:h-10 sm:w-9 group-hover:scale-105 transition-transform shrink-0" />
          <span className="brand-wordmark hidden md:flex md:flex-col text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
            <span>Om-LifeOS</span>
            <small>Plan · Focus · Manifest</small>
          </span>
        </button>

        {/* Date Display (Desktop & Tablet: Full or Semi-full Ribbon) */}
        <button
          type="button"
          onClick={onOpenBsModal}
          className="header-date-chip hidden md:inline-flex items-center gap-2 px-2.5 lg:px-3 py-1.5 transition-colors shrink-0 cursor-pointer group h-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          title={`Nepal Bikram Sambat: ${bsDateInfo.bsIso} | Gregorian: ${bsDateInfo.adIso}. Click for converter.`}
          aria-label="Nepal Bikram Sambat and Gregorian AD Calendar Converter"
        >
          <Calendar className="header-chip-icon h-4 w-4 shrink-0 group-hover:scale-105 transition-transform" />
          <div className="flex min-w-0 flex-col items-start leading-tight">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-bold tracking-tight">
              <span className="header-chip-label rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide">
                BS
              </span>
              <span>{bsDateInfo.bsFormattedNe || bsDateInfo.bsIso}</span>
            </span>
            <span className="header-chip-subtitle mt-0.5 flex items-center gap-1 text-[9px] font-medium">
              <span className="font-bold uppercase tracking-wide">AD</span>
              <span>{bsDateInfo.adIso}</span>
            </span>
          </div>
        </button>

        {/* Date Display (Mobile: Compact Badge) */}
        <button
          type="button"
          onClick={onOpenBsModal}
          className="header-date-chip header-date-chip--compact inline-flex md:hidden items-center gap-1 px-1.5 transition-colors shrink-0 cursor-pointer h-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          title={`Nepal BS: ${bsDateInfo.bsIso} | AD: ${bsDateInfo.adIso} (Click to open converter)`}
          aria-label="Nepal Bikram Sambat Date Converter"
        >
          <Calendar className="header-chip-icon h-3.5 w-3.5 shrink-0" />
          <span className="header-chip-label hidden min-[400px]:inline rounded px-1 py-0.5 text-[10px] font-bold uppercase leading-none">
            BS
          </span>
          <span className="header-chip-value font-mono text-[10px] font-semibold hidden min-[400px]:inline">
            {bsDateInfo.bsIso ? bsDateInfo.bsIso.slice(8) : ''}
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
          className="hidden lg:flex h-9 w-full max-w-md xl:max-w-xl items-center gap-2 px-3 text-xs sm:text-sm text-indigo-800 transition-colors hover:text-indigo-950 dark:text-indigo-300 dark:hover:text-indigo-200 cursor-pointer group overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
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
          className="header-clock-chip flex h-9 items-center gap-1 sm:gap-2 px-1 sm:px-2.5 text-left transition-colors shrink-0 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          title={`Live System Clock (${is24Hour ? '24h' : '12h'} - Click to toggle)`}
          aria-label={`Current time ${formattedTimeFull}. Toggle 12/24 hour time format`}
        >
          <Clock className="header-chip-icon hidden min-[360px]:block h-3.5 w-3.5 shrink-0" />
          <span className="header-chip-value inline md:hidden font-mono text-[9px] min-[360px]:text-[10px] font-bold tracking-tight tabular-nums whitespace-nowrap">
            {formattedTimeCompact}
          </span>
          <span className="header-chip-value hidden font-mono text-[11px] md:inline md:text-sm font-bold tracking-tight tabular-nums whitespace-nowrap">
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
            <ChevronDown className="h-3 w-3 shrink-0" />
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
                <button
                  type="button"
                  onClick={() => { onOpenQuickCapture('task'); setIsActionsOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <span className="text-emerald-500">✓</span> Add New Task
                </button>
                <button
                  type="button"
                  onClick={() => { onOpenQuickCapture('note'); setIsActionsOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <span className="text-amber-500">📝</span> Quick Note
                </button>
                <button
                  type="button"
                  onClick={() => { onOpenQuickCapture('expense'); setIsActionsOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <span className="text-emerald-500">💰</span> Log Expense
                </button>
                <button
                  type="button"
                  onClick={() => { onNavigate('focus'); setIsActionsOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <span className="text-indigo-500">⏱</span> Start Focus Block
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
                    <span className="text-indigo-500">🎙️</span>
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
