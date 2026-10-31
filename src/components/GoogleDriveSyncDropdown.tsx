import React, { useState, useEffect, useRef } from 'react';
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  RefreshCw,
  LogOut,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  User as UserIcon
} from 'lucide-react';
import {
  signInWithGoogle,
  signOutGoogle,
  clearGoogleSession,
  syncToGoogleDrive,
  restoreFromGoogleDrive,
  findDriveBackupFile,
  getGoogleAccessToken,
  getSavedLastSyncedAt,
  isAutoSyncEnabled,
  setAutoSyncEnabled,
  GoogleUser,
  GoogleDriveBackupInfo
} from '../lib/googleDriveSync';
import { storage } from '../lib/storage';
import { AppState } from '../types';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export interface GoogleDriveSyncDropdownProps {
  workspaceProfileId: string;
  authenticatedUser: GoogleUser | null;
  onToast?: (message: string) => void;
  onDataRestored?: () => void;
  onAccountChanged?: (user: GoogleUser | null) => void | Promise<void>;
}

export const GoogleDriveSyncDropdown: React.FC<GoogleDriveSyncDropdownProps> = ({
  workspaceProfileId,
  authenticatedUser,
  onToast,
  onDataRestored,
  onAccountChanged
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(() => getSavedLastSyncedAt(workspaceProfileId));
  const [autoSync, setAutoSync] = useState<boolean>(() => isAutoSyncEnabled(workspaceProfileId));
  const [backupInfo, setBackupInfo] = useState<GoogleDriveBackupInfo | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const isOnline = useOnlineStatus();

  const dropdownRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);
  const pendingAutoSyncRef = useRef(false);
  const autoSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleAutoSyncRef = useRef<() => void>(() => {});
  const pendingKey = (profileId: string) => `om_gdrive_pending:${profileId}`;
  const hasPendingSync = (profileId: string) => {
    try {
      return localStorage.getItem(pendingKey(profileId)) === 'true';
    } catch {
      return false;
    }
  };
  const setPendingSync = (profileId: string, pending: boolean) => {
    try {
      if (pending) localStorage.setItem(pendingKey(profileId), 'true');
      else localStorage.removeItem(pendingKey(profileId));
    } catch {}
  };

  useEffect(() => {
    setUser(authenticatedUser);
    setAccessToken(authenticatedUser ? getGoogleAccessToken() : null);
    if (!authenticatedUser) setBackupInfo(null);
  }, [authenticatedUser]);

  useEffect(() => {
    setLastSyncedAt(getSavedLastSyncedAt(workspaceProfileId));
    setAutoSync(isAutoSyncEnabled(workspaceProfileId));
    setBackupInfo(null);
    pendingAutoSyncRef.current = hasPendingSync(workspaceProfileId);
  }, [workspaceProfileId]);

  useEffect(() => {
    if (isOnline || !user) return;
    clearGoogleSession();
    setUser(null);
    setAccessToken(null);
    setBackupInfo(null);
    pendingAutoSyncRef.current = hasPendingSync(workspaceProfileId);
    onToast?.('Offline mode opened the separate guest workspace.');
    void onAccountChanged?.(null);
  }, [isOnline, user, onAccountChanged, onToast]);

  const clearExpiredSession = async (message: string) => {
    if (message.includes('Google Drive session expired')) {
      clearGoogleSession();
      setUser(null);
      setAccessToken(null);
      pendingAutoSyncRef.current = false;
      await onAccountChanged?.(null);
    }
  };

  const executeSync = async (token: string, syncUser: GoogleUser | null) => {
    if (syncingRef.current) return;
    const syncProfileId = storage.getActiveProfileId();
    syncingRef.current = true;
    setIsSyncing(true);
    setStatusMsg({ type: 'info', text: 'Syncing workspace to Google Drive...' });
    try {
      const result = await syncToGoogleDrive(token, syncUser);
      if (!result.success) {
        throw new Error(result.error || 'Failed to sync with Google Drive.');
      }

      const now = Date.now();
      pendingAutoSyncRef.current = false;
      setPendingSync(syncProfileId, false);
      if (storage.getActiveProfileId() === syncProfileId && workspaceProfileId === syncProfileId) {
        setLastSyncedAt(now);
        setBackupInfo(result.backupInfo || null);
        const successText = `✓ Synced ${result.activeRecordsCount} active records to Google Drive!`;
        setStatusMsg({ type: 'success', text: successText });
        onToast?.(successText);
      }
    } catch (err) {
      const errText = err instanceof Error ? err.message : 'Sync error occurred';
      const stillOnSyncWorkspace =
        storage.getActiveProfileId() === syncProfileId && workspaceProfileId === syncProfileId;
      if (stillOnSyncWorkspace) {
        await clearExpiredSession(errText);
        setStatusMsg({ type: 'error', text: errText });
        onToast?.(errText);
      }
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
      if (pendingAutoSyncRef.current && navigator.onLine) {
        scheduleAutoSyncRef.current();
      }
    }
  };

  useEffect(() => {
    if (!user || !accessToken || !autoSync) return;

    let active = true;
    const schedule = () => {
      if (autoSyncTimerRef.current) clearTimeout(autoSyncTimerRef.current);
      autoSyncTimerRef.current = setTimeout(() => {
        autoSyncTimerRef.current = null;
        if (!active || !pendingAutoSyncRef.current || !navigator.onLine || syncingRef.current) return;
        pendingAutoSyncRef.current = false;
        void executeSync(accessToken, user);
      }, 1200);
    };
    scheduleAutoSyncRef.current = schedule;

    const unsubscribe = storage.subscribe(() => {
      pendingAutoSyncRef.current = true;
      setPendingSync(workspaceProfileId, true);
      schedule();
    });

    const flushPending = () => {
      pendingAutoSyncRef.current = true;
      setPendingSync(workspaceProfileId, true);
      schedule();
    };
    window.addEventListener('online', flushPending);
    if (pendingAutoSyncRef.current) schedule();

    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener('online', flushPending);
      if (autoSyncTimerRef.current) clearTimeout(autoSyncTimerRef.current);
      autoSyncTimerRef.current = null;
      scheduleAutoSyncRef.current = () => {};
    };
  }, [user, accessToken, autoSync, workspaceProfileId]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSignIn = async () => {
    if (!isOnline) {
      setStatusMsg({ type: 'error', text: 'Connect to the internet to sign in to Google Drive.' });
      return;
    }
    setIsSigningIn(true);
    setStatusMsg(null);
    try {
      const res = await signInWithGoogle();
      setUser(res.user);
      setAccessToken(res.accessToken);
      await onAccountChanged?.(res.user);
      if (autoSync) {
        pendingAutoSyncRef.current = true;
        setPendingSync(storage.getActiveProfileId(), true);
      }
      const msg = `Signed in as ${res.user.email || 'Google User'}`;
      setStatusMsg({ type: 'success', text: msg });
      onToast?.(msg);

      // Check existing backup
      const info = await findDriveBackupFile(res.accessToken);
      setBackupInfo(info);
    } catch (err: any) {
      console.error('Sign-in error:', err);
      const errMsg = err?.message || 'Failed to sign in with Google';
      await clearExpiredSession(errMsg);
      setStatusMsg({ type: 'error', text: errMsg });
      onToast?.(errMsg);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutGoogle();
      setUser(null);
      setAccessToken(null);
      pendingAutoSyncRef.current = hasPendingSync(workspaceProfileId);
      setBackupInfo(null);
      setStatusMsg(null);
      setIsOpen(false);
      await onAccountChanged?.(null);
      onToast?.('Signed out of Google Account');
    } catch (err: any) {
      onToast?.(err?.message || 'Error signing out');
    }
  };

  const handleSyncNow = async () => {
    if (!isOnline) {
      onToast?.('You are offline. Changes are saved locally and can sync when you reconnect.');
      return;
    }
    let token = accessToken || getGoogleAccessToken();
    let syncUser = user;
    if (!token) {
      try {
        const res = await signInWithGoogle();
        token = res.accessToken;
        syncUser = res.user;
        setUser(res.user);
        setAccessToken(token);
        await onAccountChanged?.(res.user);
        if (autoSync) {
          pendingAutoSyncRef.current = true;
          setPendingSync(storage.getActiveProfileId(), true);
        }
      } catch (err: any) {
        onToast?.('Please sign in to sync with Google Drive.');
        return;
      }
    }

    await executeSync(token, syncUser);
  };

  const handleInitiateRestore = async () => {
    if (!isOnline) {
      onToast?.('Connect to the internet to restore from Google Drive.');
      return;
    }
    let token = accessToken || getGoogleAccessToken();
    if (!token) {
      try {
        const res = await signInWithGoogle();
        token = res.accessToken;
        setUser(res.user);
        setAccessToken(token);
        await onAccountChanged?.(res.user);
      } catch (err: any) {
        onToast?.('Please sign in to access Google Drive backup.');
        return;
      }
    }

    try {
      const info = await findDriveBackupFile(token);
      setBackupInfo(info);
      if (!info) {
        onToast?.('No Om-LifeOS backup found in your Google Drive yet.');
        return;
      }
      setShowRestoreConfirm(true);
    } catch (err: any) {
      const message = err?.message || 'Could not check Google Drive backup.';
      await clearExpiredSession(message);
      onToast?.(message);
    }
  };

  const handleConfirmRestore = async () => {
    setShowRestoreConfirm(false);
    let token = accessToken || getGoogleAccessToken();
    if (!token) {
      onToast?.('Authentication required.');
      return;
    }

    setIsRestoring(true);
    setStatusMsg({ type: 'info', text: 'Restoring workspace from Google Drive...' });

    try {
      const settingsData = await storage.getSingleton<AppState>('appSettings');
      const activeProfileId = storage.getActiveProfileId() || settingsData?.profileId || 'default';
      const activeProfileName = settingsData?.profiles?.find(p => p.id === activeProfileId)?.name || 'Om-LifeOS';

      if (!user) throw new Error('Sign in to a Google account before restoring a workspace.');
      const res = await restoreFromGoogleDrive(token, activeProfileId, activeProfileName, user);
      if (res.success) {
        const successText = `✓ Restored ${res.restoredRecordCount} records from Google Drive!`;
        setStatusMsg({ type: 'success', text: successText });
        onToast?.(successText);
        setIsOpen(false);
        onDataRestored?.();
      } else {
        const errText = res.error || 'Failed to restore from Google Drive.';
        await clearExpiredSession(errText);
        setStatusMsg({ type: 'error', text: errText });
        onToast?.(errText);
      }
    } catch (err: any) {
      const errText = err?.message || 'Failed to restore backup.';
      await clearExpiredSession(errText);
      setStatusMsg({ type: 'error', text: errText });
      onToast?.(errText);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleToggleAutoSync = (enabled: boolean) => {
    setAutoSync(enabled);
    setAutoSyncEnabled(enabled, workspaceProfileId);
    if (enabled) {
      pendingAutoSyncRef.current = true;
      setPendingSync(workspaceProfileId, true);
      scheduleAutoSyncRef.current();
    }
    onToast?.(enabled ? 'Google Drive Auto-Sync enabled' : 'Google Drive Auto-Sync disabled');
  };

  const formatTimeAgo = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Google account workspace and Drive controls */}
      {!user ? (
        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          className={`sanctuary-drive-trigger flex w-full items-center justify-between gap-1.5 py-1.5 px-2 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
            isOpen
              ? 'text-amber-700 dark:text-amber-300'
              : 'text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
          }`}
          title="Sign in with Google & Google Drive Sync"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            {/* Google G Multi-Color Icon */}
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.27 21.36 7.34 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.97 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.27 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span className="truncate">Google Drive Sync</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </div>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          className={`sanctuary-drive-trigger flex w-full items-center justify-between gap-1.5 py-1.5 px-2 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
            isOpen
              ? 'text-amber-700 dark:text-amber-300'
              : 'text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
          }`}
          title={`Google Account: ${user.email} • Click to open Google Drive options`}
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="h-4 w-4 rounded-full object-cover shrink-0 ring-1 ring-emerald-500/50"
              />
            ) : (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white uppercase">
                {user.email ? user.email[0] : 'G'}
              </span>
            )}
            <span className="truncate text-[11px] font-medium text-slate-800 dark:text-slate-200">
              {user.displayName || user.email?.split('@')[0] || 'Google User'}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isSyncing ? (
              <RefreshCw className="h-3 w-3 text-indigo-600 animate-spin dark:text-indigo-400" />
            ) : (
              <span
                className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-400/20"
                title="Google Drive Connected"
              />
            )}
            {isOpen ? <ChevronDown className="h-3 w-3 text-slate-400" /> : <ChevronUp className="h-3 w-3 text-slate-400" />}
          </div>
        </button>
      )}

      {/* DROPDOWN MENU PANEL (Opens Upward cleanly) */}
      {isOpen && (
        <div className="sanctuary-drive-panel absolute bottom-full left-0 right-0 mb-1.5 z-50 rounded-xl border border-slate-200/90 bg-white p-3 shadow-xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900 space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
          {/* Header */}
          <div className="flex min-w-0 items-center justify-between gap-1 border-b border-slate-100 pb-2 dark:border-slate-800">
          <div className="flex min-w-0 items-center gap-1">
              <Cloud className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="whitespace-nowrap text-[10px] font-bold text-slate-900 dark:text-white">
                Google Drive Sync
              </span>
            </div>
            {user && (
            <span className="shrink-0 whitespace-nowrap rounded-full bg-emerald-50 px-1 py-0.5 text-[8px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Connected
              </span>
            )}
          </div>

          {/* SIGNED-OUT STATE: Show official Google Sign-In button */}
          {!user ? (
            <div className="space-y-2.5 py-1">
              {/* Official Google Material Style Button */}
              <button
                type="button"
                onClick={handleSignIn}
                disabled={isSigningIn || !isOnline}
                className="sanctuary-drive-signin w-full flex items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white py-2 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:shadow-xs active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 transition-all cursor-pointer disabled:opacity-60"
              >
                {isSigningIn ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-indigo-600" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.27 21.36 7.34 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.97 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.27 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                    <span>Sign in with Google</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 pt-0.5">
                <ShieldCheck className="h-3 w-3 shrink-0 text-emerald-500" />
                <span>{isOnline ? 'Only this Google account workspace is opened after sign-in' : 'Offline: continue in the separate guest workspace'}</span>
              </div>
            </div>
          ) : (
            /* SIGNED-IN STATE: Full Drive Controls */
            <div className="space-y-2.5">
              {/* User Profile Card */}
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="h-7 w-7 rounded-full object-cover shrink-0 ring-1 ring-slate-300 dark:ring-slate-700"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white shrink-0">
                    {user.email ? user.email[0].toUpperCase() : <UserIcon className="h-3.5 w-3.5" />}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 truncate dark:text-white">
                    {user.displayName || 'Google Account'}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate dark:text-slate-400">
                    {user.email}
                  </div>
                </div>
              </div>

              {/* Status & Timestamp */}
              <div className="rounded-lg bg-indigo-50/50 p-2 text-[11px] text-indigo-950 dark:bg-indigo-950/30 dark:text-indigo-200 border border-indigo-100/80 dark:border-indigo-900/40 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-500 dark:text-slate-400">Last Synced:</span>
                  <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                    {formatTimeAgo(lastSyncedAt)}
                  </span>
                </div>
                {backupInfo && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500 dark:text-slate-400">Drive Backup:</span>
                    <span className="text-slate-700 dark:text-slate-300 font-mono">
                      {backupInfo.name}
                    </span>
                  </div>
                )}
                {!isOnline && (
                  <p className="border-t border-indigo-100 pt-1 text-[10px] text-amber-700 dark:border-indigo-900 dark:text-amber-300">
                    Offline: edits stay on this device and sync when you reconnect.
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid min-w-0 grid-cols-2 gap-1.5 pt-0.5">
                {/* Sync Now */}
                <button
                  type="button"
                  disabled={isSyncing || !isOnline}
                  onClick={handleSyncNow}
                  className="flex min-w-0 items-center justify-center gap-1 rounded-lg bg-indigo-600 px-1 py-1.5 text-[10px] font-semibold text-white hover:bg-indigo-500 active:scale-95 shadow-2xs transition-all cursor-pointer disabled:opacity-60"
                  title="Upload latest active workspace records to Google Drive"
                >
                  <CloudUpload className={`h-3 w-3 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span className="whitespace-nowrap">{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                </button>

                {/* Restore from Drive */}
                <button
                  type="button"
                  disabled={isRestoring || isSyncing || !isOnline}
                  onClick={handleInitiateRestore}
                  className="flex min-w-0 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-1 py-1.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 transition-all cursor-pointer disabled:opacity-60"
                  title="Download and restore backup from Google Drive"
                >
                  <CloudDownload className={`h-3 w-3 shrink-0 ${isRestoring ? 'animate-spin' : ''}`} />
                  <span className="whitespace-nowrap">{isRestoring ? 'Restoring...' : 'Restore'}</span>
                </button>
              </div>

              {/* Auto Sync Toggle */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800 text-[11px]">
                <span className="whitespace-nowrap text-[10px] text-slate-600 dark:text-slate-400">Auto-Sync on changes</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSync}
                    onChange={e => handleToggleAutoSync(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-7 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Sign Out Row */}
              <div className="min-w-0 border-t border-slate-100 pt-2 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  disabled={isSyncing || isRestoring}
                  onClick={handleSignOut}
                  className="w-full min-w-0 flex items-center justify-center gap-1.5 whitespace-nowrap text-[10px] font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 py-1 rounded-md transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <LogOut className="h-3 w-3" />
                  <span className="whitespace-nowrap">Sign Out & Switch to Guest</span>
                </button>
              </div>
            </div>
          )}

          {/* Feedback message banner */}
          {statusMsg && (
            <div
              className={`rounded-lg p-2 text-[10px] leading-snug flex items-start gap-1.5 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : statusMsg.type === 'error'
                  ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  : 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600 mt-0.5" />
              ) : statusMsg.type === 'error' ? (
                <AlertCircle className="h-3 w-3 shrink-0 text-rose-600 mt-0.5" />
              ) : (
                <RefreshCw className="h-3 w-3 shrink-0 text-indigo-600 animate-spin mt-0.5" />
              )}
              <span className="flex-1 break-words">{statusMsg.text}</span>
            </div>
          )}
        </div>
      )}

      {/* RESTORE CONFIRMATION MODAL */}
      {showRestoreConfirm && (
        <div className="sanctuary-drive-confirm-overlay fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-3 backdrop-blur-xs sm:p-4">
          <div
            className="sanctuary-glass-dialog my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:max-h-[calc(100dvh-2rem)] sm:p-6 animate-in fade-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="restore-confirm-title"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                <CloudDownload className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 id="restore-confirm-title" className="text-base font-bold leading-snug text-slate-900 dark:text-white">
                  Restore backup?
                </h3>
                {backupInfo?.modifiedTime && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Google Drive backup · {new Date(backupInfo.modifiedTime).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Unsynced workspace changes may be overwritten.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowRestoreConfirm(false)}
                className="min-h-11 w-full min-w-0 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 sm:flex-1 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                className="flex min-h-10 w-full min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-2xs transition-colors hover:bg-indigo-500 sm:flex-1 cursor-pointer"
              >
                <span>Backup</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
