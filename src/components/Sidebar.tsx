import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, CheckSquare, Repeat, Target, Timer, FileText,
  BookOpen, Calculator, DollarSign, Heart, Briefcase, Users,
  Compass, Folder, Settings, X, Lock, HardDrive, RefreshCw, Check, AlertCircle, Trash2, ExternalLink
} from 'lucide-react';
import { NavModule } from '../types';
import {
  FolderSyncStatus,
  getFolderSyncState,
  pickAndConnectFolder,
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
  onLockApp?: () => void;
  onToast?: (msg: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
  openTasksCount,
  remindersCount,
  recycleBinCount = 0,
  onLockApp,
  onToast,
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

  const navItems: { id: NavModule; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'goals', label: 'Goals & Strategy', icon: <Target className="h-4 w-4" /> },
    { id: 'tasks', label: 'Tasks & Planner', icon: <CheckSquare className="h-4 w-4" />, badge: openTasksCount },
    { id: 'routine', label: 'Routine & Habits Architecture', icon: <Repeat className="h-4 w-4" /> },
    { id: 'focus', label: 'Focus (Deep Work)', icon: <Timer className="h-4 w-4" /> },
    { id: 'notes', label: 'Notes & Notebooks', icon: <FileText className="h-4 w-4" /> },
    { id: 'journal', label: 'Daily Journal', icon: <BookOpen className="h-4 w-4" /> },
    { id: 'calculator', label: 'Calculator & Tools', icon: <Calculator className="h-4 w-4" /> },
    { id: 'finance', label: 'Finance & Ledger', icon: <DollarSign className="h-4 w-4" />, badge: 0 },
    { id: 'health', label: 'Health & Wellness', icon: <Heart className="h-4 w-4" /> },
    { id: 'work', label: 'Work, Projects & Skill Trees', icon: <Briefcase className="h-4 w-4" /> },
    { id: 'people', label: 'People & Relations', icon: <Users className="h-4 w-4" /> },
    { id: 'spiritual', label: 'Values & Spiritual', icon: <Compass className="h-4 w-4" /> },
    { id: 'things', label: 'Things & Documents', icon: <Folder className="h-4 w-4" /> },
    { id: 'settings', label: 'Settings & Sync', icon: <Settings className="h-4 w-4" />, badge: remindersCount }
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

      {/* Iframe Browser Security Guidance Modal */}
      {isIframeNoticeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 shrink-0">
                <HardDrive className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Connect Computer Folder
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Browser security allows selecting a real local computer folder only in a full browser tab (embedded preview iframes are restricted by Chrome/Edge).
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-900 dark:border-indigo-950/80 dark:bg-indigo-950/30 dark:text-indigo-300">
              Open the app in its own tab, click <strong>Connect PC Folder</strong>, and choose your folder. Files will save directly to your disk!
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsIframeNoticeOpen(false)}
                className="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close
              </button>
              <a
                href={typeof window !== 'undefined' ? window.location.href : '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsIframeNoticeOpen(false)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-2xs transition-colors cursor-pointer"
              >
                <span>Open Full Tab</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
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
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`transition-colors ${
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
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold tabular-nums ${
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

        {/* BOTTOM CONTROLS (Folder Sync & Lock Workspace) */}
        <div className="border-t border-slate-100 p-3 dark:border-slate-800/80 space-y-2">
          {/* Direct Computer Folder Sync Button (Compact, exactly matching Lock Workspace) */}
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

          {/* Lock Workspace */}
          {onLockApp && (
            <button
              type="button"
              onClick={() => {
                onLockApp();
                onCloseMobile();
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50/70 py-1.5 px-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60 transition-colors cursor-pointer"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Lock Workspace</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
