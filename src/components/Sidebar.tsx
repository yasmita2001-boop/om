import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, CheckSquare, Repeat, Target, Timer, FileText,
  BookOpen, Calculator, DollarSign, Heart, Briefcase, Users,
  Compass, Folder, Settings, X, HardDrive, RefreshCw, Check, AlertCircle, Trash2, ExternalLink
} from 'lucide-react';
import { NavModule } from '../types';
import { GoogleDriveSyncDropdown } from './GoogleDriveSyncDropdown';
import {
  FolderSyncStatus,
  getFolderSyncState,
  pickAndConnectFolder,
  connectDirectPcSync,
  executeSyncNow,
  disconnectFolderSync
} from '../lib/computerFolderSync';

interface SidebarProps {
  activeModule: NavModule;
  onNavigate: (module: NavModule) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  openTasksCount: number;
  remindersCount: number;
  recycleBinCount?: number;
  onToast?: (msg: string) => void;
  onDataRestored?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
  openTasksCount,
  remindersCount,
  recycleBinCount = 0,
  onToast,
  onDataRestored,
}) => {
  const [syncState, setSyncState] = useState<FolderSyncStatus>({
    isSupported: true,
    isConnected: false,
    folderName: null,
    lastSyncedAt: null,
    isSyncing: false,
    lastRecordCount: null,
    error: null
  });
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [justSynced, setJustSynced] = useState(false);
  const [isIframeNoticeOpen, setIsIframeNoticeOpen] = useState(false);

  useEffect(() => {
    getFolderSyncState().then(setSyncState);
  }, []);

  const handleConnectFolder = async () => {
    setSyncFeedback(null);
    const res = await pickAndConnectFolder();
    if (res.requiresFullTab) {
      setIsIframeNoticeOpen(true);
      return;
    }
    if (res.success) {
      const updated = await getFolderSyncState();
      setSyncState(updated);
      const msg = `Connected to "${res.folderName}". Click "Sync Now" to backup.`;
      setSyncFeedback({ type: 'success', message: msg });
      onToast?.(msg);
      setTimeout(() => setSyncFeedback(null), 4000);
    } else if (res.error && res.error !== 'Folder selection was cancelled.') {
      setSyncFeedback({ type: 'error', message: res.error });
      onToast?.(res.error);
      setTimeout(() => setSyncFeedback(null), 5000);
    }
  };

  const handleActivateDirectSync = async () => {
    const res = await connectDirectPcSync('PC Folder (Direct Sync)');
    if (res.success) {
      const updated = await getFolderSyncState();
      setSyncState(updated);
      setIsIframeNoticeOpen(false);
      const msg = '✓ PC Folder connected! "Sync Now" dabayein to backup karein.';
      setSyncFeedback({ type: 'success', message: msg });
      onToast?.(msg);
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  const handleOpenInNewTab = () => {
    try {
      window.open(window.location.href, '_blank');
      setIsIframeNoticeOpen(false);
    } catch {
      // fallback
    }
  };

  const handleSyncNow = async () => {
    setSyncFeedback(null);
    setSyncState(prev => ({ ...prev, isSyncing: true }));
    try {
      const res = await executeSyncNow();
      if (res.success) {
        const updated = await getFolderSyncState();
        setSyncState(updated);
        setJustSynced(true);
        setTimeout(() => setJustSynced(false), 2500);
        const msg = `✓ Synced ${res.activeRecordsCount} active items (0 trashed records)`;
        setSyncFeedback({ type: 'success', message: msg });
        onToast?.(msg);
        setTimeout(() => setSyncFeedback(null), 4000);
      } else {
        setSyncState(prev => ({ ...prev, isSyncing: false }));
        setSyncFeedback({ type: 'error', message: res.error || 'Sync failed' });
        onToast?.(res.error || 'Sync failed');
        setTimeout(() => setSyncFeedback(null), 5000);
      }
    } catch (err: any) {
      setSyncState(prev => ({ ...prev, isSyncing: false }));
      const errMsg = err?.message || 'Sync failed';
      setSyncFeedback({ type: 'error', message: errMsg });
      onToast?.(errMsg);
      setTimeout(() => setSyncFeedback(null), 5000);
    }
  };

  const handleDisconnect = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await disconnectFolderSync();
    const updated = await getFolderSyncState();
    setSyncState(updated);
    setSyncFeedback(null);
    onToast?.('Local folder disconnected');
  };

  const formatLastSynced = (timestamp: number | null) => {
    if (!timestamp) return 'Not synced yet';
    const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

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

        {/* BOTTOM CONTROLS (Folder Sync & Cloud Backups) */}
        <div className="border-t border-slate-100 p-3 dark:border-slate-800/80 space-y-2">
          {/* Google Sign-in & Google Drive Sync Dropdown Menu */}
          <GoogleDriveSyncDropdown
            onToast={onToast}
            onDataRestored={() => {
              onCloseMobile();
              onDataRestored?.();
            }}
          />

          {/* Direct Computer Folder Sync Button */}
          {!syncState.isConnected ? (
            <button
              type="button"
              onClick={handleConnectFolder}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 py-1.5 px-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
              title="Connect a local computer folder to store sovereign backups"
            >
              <HardDrive className="h-3.5 w-3.5" />
              <span>Connect PC Folder</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={syncState.isSyncing}
                onClick={handleSyncNow}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 py-1.5 px-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer disabled:opacity-60 min-w-0"
                title={`Folder: ${syncState.folderName || 'Connected'} • Click to sync now`}
              >
                <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${syncState.isSyncing ? 'animate-spin' : ''}`} />
                <span className="truncate">
                  {syncState.isSyncing ? 'Syncing...' : justSynced ? '✓ Synced' : 'Sync Now'}
                </span>
                {syncState.folderName && !syncState.isSyncing && !justSynced && (
                  <span className="text-[10px] font-normal text-indigo-500/80 dark:text-indigo-400/80 truncate max-w-[75px]">
                    ({syncState.folderName})
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                className="flex h-[29px] w-[29px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                title="Disconnect folder"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Browser Iframe / Standalone Folder Sync Connection Modal */}
      {isIframeNoticeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                  <HardDrive className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Connect Computer Folder
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Direct PC Backup & Sync Setup
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsIframeNoticeOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Info note */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 leading-relaxed">
              <strong>Browser Preview Note:</strong> Browser security rules iframe preview ke andar native folder dialog ko block karte hain. Niche diye gaye aasan options se ise use kar sakte hain:
            </div>

            {/* Options */}
            <div className="space-y-3">
              {/* Option 1: Direct 1-Click Sync */}
              <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/50 p-3.5 dark:border-indigo-900/50 dark:bg-indigo-950/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">1</span>
                    Direct PC Sync Connect Karein (Recommended)
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    Instant Ready
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
                  Abhi direct connect ho jayega. Jab bhi aap <strong>"Sync Now"</strong> dabayenge, bina kisi rukawat ke sanitized local backup (0 deleted / 0 trashed records) direct aapke computer me save hoga.
                </p>
                <button
                  type="button"
                  onClick={handleActivateDirectSync}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2 px-3 text-xs font-semibold text-white hover:bg-indigo-700 shadow-xs transition-colors cursor-pointer"
                >
                  <HardDrive className="h-4 w-4" />
                  <span>Connect Direct PC Sync Now</span>
                </button>
              </div>

              {/* Option 2: Full Tab Native Folder Picker */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-500 text-[10px] font-bold text-white">2</span>
                    Naye Tab Me Kholein (Specific Folder Picker)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                  Agar aap hard drive par koi specific folder (jaise <code>D:\LifeOS-Backup</code>) browse karke choose karna chahte hain, toh app ko standalone tab me kholein.
                </p>
                <button
                  type="button"
                  onClick={handleOpenInNewTab}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white py-2 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Open in Full Tab / Window ↗</span>
                </button>
              </div>
            </div>

            {/* Desktop App Note */}
            <p className="text-[10px] text-center text-slate-400 dark:text-slate-500">
              💡 <strong>Windows .exe</strong> desktop app me native Windows folder dialog direct bina kisi warning ke open hota hai.
            </p>
          </div>
        </div>
      )}
    </>
  );
};
