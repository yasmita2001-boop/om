import React, { useState, useEffect, useCallback } from 'react';
import {
  Cloud, CloudUpload, CloudDownload, RefreshCw, Trash2,
  ExternalLink, CheckCircle2, AlertCircle, X, Shield,
  Clock, HardDrive, LogOut, UserCheck, Database, ArrowRight
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  googleSignIn,
  googleSignOut,
  getAccessToken,
  findPrimaryBackup,
  listDriveBackups,
  uploadBackupToDrive,
  downloadBackupFromDrive,
  deleteBackupFromDrive,
  getDriveAccountInfo,
  DriveBackupFile,
  DriveQuotaInfo
} from '../lib/googleDriveService';
import { GoogleSignInButton } from './GoogleSignInButton';
import { storage } from '../lib/storage';

interface GoogleDriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onDataRestored?: () => void;
  onToast: (msg: string) => void;
}

export const GoogleDriveSyncModal: React.FC<GoogleDriveSyncModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onDataRestored,
  onToast
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [driveBackups, setDriveBackups] = useState<DriveBackupFile[]>([]);
  const [primaryBackup, setPrimaryBackup] = useState<DriveBackupFile | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<DriveQuotaInfo | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    return localStorage.getItem('om_last_drive_sync_time');
  });

  // Snapshot toggle
  const [createSnapshotCopy, setCreateSnapshotCopy] = useState(false);

  // Destructive Confirmation States
  const [confirmRestoreData, setConfirmRestoreData] = useState<{
    file: DriveBackupFile;
    parsedSummary: {
      tasks: number;
      goals: number;
      notes: number;
      journal: number;
      finance: number;
      habits: number;
      exportedAt?: string;
    };
    rawJson: string;
  } | null>(null);

  const [confirmDeleteFile, setConfirmDeleteFile] = useState<DriveBackupFile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDriveData = useCallback(async (activeToken: string) => {
    try {
      setErrorMessage(null);
      const [primary, allBackups, accountInfo] = await Promise.all([
        findPrimaryBackup(activeToken).catch((err) => {
          if (err?.message?.includes('insufficient') || err?.message?.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')) {
            throw new Error('Drive permission not yet granted. Please click "Grant Drive Permission" below.');
          }
          return null;
        }),
        listDriveBackups(activeToken).catch(() => []),
        getDriveAccountInfo(activeToken).catch(() => ({ quota: {}, user: {} }))
      ]);

      setPrimaryBackup(primary);
      setDriveBackups(allBackups);
      if (accountInfo?.quota) setQuotaInfo(accountInfo.quota);
    } catch (err: any) {
      console.warn('Drive query notice:', err);
      if (err?.message?.includes('insufficient') || err?.message?.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')) {
        setErrorMessage('Google Drive permission is not yet approved. Please click "Grant Drive Permission" to enable sync.');
      } else {
        setErrorMessage(err?.message || 'Failed to communicate with Google Drive');
      }
    }
  }, []);

  // Update token and load drive data when modal opens or user changes
  useEffect(() => {
    if (!isOpen) return;

    getAccessToken().then(tok => {
      setToken(tok);
      if (tok) {
        loadDriveData(tok);
      }
    });
  }, [isOpen, currentUser, loadDriveData]);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    setIsLoadingAuth(true);
    setErrorMessage(null);
    try {
      const result = await googleSignIn();
      if (!result) {
        // User closed the popup or cancelled
        return;
      }
      setToken(result.accessToken);
      onToast(`Signed in as ${result.user.email || 'Google User'}`);
      await loadDriveData(result.accessToken);
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        setErrorMessage(err.message || 'Google Sign-In failed');
        onToast('Google Sign-In failed');
      }
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await googleSignOut();
      setToken(null);
      setPrimaryBackup(null);
      setDriveBackups([]);
      onToast('Signed out of Google Account');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to sign out');
    }
  };

  // Perform full upload/backup to Google Drive
  const handleBackupToDrive = async () => {
    let currentToken = token;
    if (!currentToken) {
      try {
        const res = await googleSignIn();
        if (!res) return;
        currentToken = res.accessToken;
        setToken(res.accessToken);
      } catch {
        return;
      }
    }

    setIsSyncing(true);
    setErrorMessage(null);
    try {
      const fullBackupJson = await storage.exportFullBackup();
      const updatedFile = await uploadBackupToDrive(currentToken, fullBackupJson, createSnapshotCopy);
      setPrimaryBackup(updatedFile);
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSyncTime(nowStr);
      localStorage.setItem('om_last_drive_sync_time', nowStr);
      await loadDriveData(currentToken);
      onToast('Saved and synced full backup to Google Drive!');
    } catch (err: any) {
      console.error('Sync error:', err);
      setErrorMessage(err.message || 'Failed to upload backup to Google Drive');
      onToast('Backup failed. Check permissions.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Initiate Restore with Preview Inspection & Explicit Confirmation
  const handleInitiateRestore = async (file: DriveBackupFile) => {
    let currentToken = token;
    if (!currentToken) {
      try {
        const res = await googleSignIn();
        if (!res) return;
        currentToken = res.accessToken;
        setToken(res.accessToken);
      } catch {
        return;
      }
    }

    setIsRestoring(true);
    setErrorMessage(null);
    try {
      const rawText = await downloadBackupFromDrive(currentToken, file.id);
      const parsed = JSON.parse(rawText);
      const data = parsed.data || parsed;

      const summary = {
        tasks: Array.isArray(data.tasks) ? data.tasks.length : 0,
        goals: Array.isArray(data.goals) ? data.goals.length : 0,
        notes: Array.isArray(data.notes) ? data.notes.length : 0,
        journal: Array.isArray(data.journal) ? data.journal.length : 0,
        finance: Array.isArray(data.finance) ? data.finance.length : 0,
        habits: Array.isArray(data.habits) ? data.habits.length : 0,
        exportedAt: parsed.exportedAt || file.modifiedTime
      };

      setConfirmRestoreData({
        file,
        parsedSummary: summary,
        rawJson: rawText
      });
    } catch (err: any) {
      setErrorMessage('Failed to read or parse backup file from Google Drive: ' + err.message);
      onToast('Failed to read backup from Drive');
    } finally {
      setIsRestoring(false);
    }
  };

  // Execute Confirmed Restore
  const handleExecuteRestore = async () => {
    if (!confirmRestoreData) return;
    try {
      const count = await storage.importFullBackup(confirmRestoreData.rawJson);
      onToast(`Restored ${count} records from Google Drive backup!`);
      setConfirmRestoreData(null);
      if (onDataRestored) onDataRestored();
      onClose();
    } catch (err: any) {
      setErrorMessage('Restore failed: ' + err.message);
      onToast('Restore failed');
    }
  };

  // Execute Confirmed Delete from Drive
  const handleExecuteDelete = async () => {
    if (!confirmDeleteFile || !token) return;
    try {
      await deleteBackupFromDrive(token, confirmDeleteFile.id);
      onToast(`Deleted "${confirmDeleteFile.name}" from Google Drive`);
      setConfirmDeleteFile(null);
      await loadDriveData(token);
    } catch (err: any) {
      setErrorMessage('Failed to delete file: ' + err.message);
      onToast('Deletion failed');
    }
  };

  const formatFileSize = (bytesStr?: string) => {
    if (!bytesStr) return 'Unknown size';
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes)) return bytesStr;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 text-slate-900 dark:text-slate-100 space-y-6">
        
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
              <Cloud className="h-6 w-6 stroke-[2]" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Google Drive Cloud Sync
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  Master Auth
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Sign in with any Google account to sync all your tasks, notes, goals, and finances securely.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Alert if any */}
        {errorMessage && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div className="space-y-0.5">
                <span className="font-bold">Google Drive Permission Required</span>
                <p className="text-[11px] text-amber-800 dark:text-amber-300">
                  {errorMessage}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                type="button"
                onClick={handleSignIn}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 text-xs shadow-xs cursor-pointer active:scale-98 transition-all"
              >
                Grant Drive Access
              </button>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-amber-700 hover:text-amber-900 dark:text-amber-400 text-xs font-semibold px-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Zone 1: Account Status & Sign In */}
        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-850/60 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Google Account Identity
            </span>
            {currentUser && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Connected
              </span>
            )}
          </div>

          {!currentUser ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Connect Your Google Account
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
                  Connect to your real Google Drive to keep an encrypted sovereign backup and restore across any browser or mobile device.
                </p>
              </div>
              <GoogleSignInButton
                onClick={handleSignIn}
                isLoading={isLoadingAuth}
                label="Sign in with Google"
                className="shrink-0"
              />
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
              <div className="flex items-center gap-3">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'Google Account'}
                    className="h-11 w-11 rounded-full border-2 border-indigo-200 dark:border-indigo-800 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 font-bold text-white text-base">
                    {(currentUser.displayName || currentUser.email || 'G').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    {currentUser.displayName || 'Google User'}
                    <UserCheck className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {currentUser.email}
                  </div>
                  {lastSyncTime && (
                    <div className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5">
                      <Clock className="h-3 w-3" />
                      <span>Last sync: today at {lastSyncTime}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={isLoadingAuth}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer transition-colors"
                  title="Switch to another Google Account"
                >
                  Switch Account
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/60 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300 cursor-pointer transition-colors"
                  title="Sign out from Google"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Disconnect</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Zone 2: Sync Actions (Push & Pull) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Backup to Drive Action Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4.5 dark:border-slate-800 dark:bg-slate-850/40 space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <CloudUpload className="h-5 w-5" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Push / Backup to Google Drive
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Save an atomic snapshot of your entire LifeOS (tasks, routines, habits, notes, finances) directly into your Google Drive.
              </p>
              
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createSnapshotCopy}
                  onChange={e => setCreateSnapshotCopy(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                />
                <span>Also save timestamped snapshot</span>
              </label>
            </div>

            <button
              type="button"
              onClick={handleBackupToDrive}
              disabled={isSyncing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 p-3 text-xs font-bold text-white shadow-sm cursor-pointer transition-all disabled:opacity-60"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Saving to Google Drive...</span>
                </>
              ) : (
                <>
                  <CloudUpload className="h-4 w-4" />
                  <span>{primaryBackup ? 'Update Google Drive Backup' : 'Save Backup to Drive'}</span>
                </>
              )}
            </button>
          </div>

          {/* Restore from Drive Action Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4.5 dark:border-slate-800 dark:bg-slate-850/40 space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CloudDownload className="h-5 w-5" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Pull / Restore from Google Drive
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Retrieve your latest cloud backup and restore your workspace. You will see a detailed summary before any changes are made.
              </p>

              {primaryBackup && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5 pt-1">
                  <div>Latest Cloud File: <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{primaryBackup.name}</span></div>
                  <div>Updated: <span className="font-semibold">{new Date(primaryBackup.modifiedTime).toLocaleString()}</span> ({formatFileSize(primaryBackup.size)})</div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => primaryBackup && handleInitiateRestore(primaryBackup)}
              disabled={!primaryBackup || isRestoring}
              className={`flex w-full items-center justify-center gap-2 rounded-xl p-3 text-xs font-bold transition-all ${
                primaryBackup
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer active:scale-98'
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed'
              }`}
            >
              {isRestoring ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Inspecting Drive File...</span>
                </>
              ) : (
                <>
                  <CloudDownload className="h-4 w-4" />
                  <span>{primaryBackup ? 'Restore from Cloud Backup' : 'No Backup on Drive Yet'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Zone 3: Google Drive Backups & Snapshots List */}
        {driveBackups.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4.5 dark:border-slate-800 dark:bg-slate-850/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-indigo-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Drive Backup Files ({driveBackups.length})
                </h4>
              </div>
              <button
                type="button"
                onClick={() => token && loadDriveData(token)}
                className="text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-semibold cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
              {driveBackups.map(file => (
                <div key={file.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                      {file.name}
                      {file.id === primaryBackup?.id && (
                        <span className="rounded bg-indigo-100 dark:bg-indigo-950 px-1.5 py-0.2 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>{new Date(file.modifiedTime).toLocaleDateString()} {new Date(file.modifiedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>•</span>
                      <span>{formatFileSize(file.size)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {file.webViewLink && (
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        title="Open in Google Drive"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleInitiateRestore(file)}
                      className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 cursor-pointer"
                      title="Restore this version"
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteFile(file)}
                      className="rounded-lg p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      title="Delete from Google Drive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Security & Sovereignty footnote */}
        <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
          <Shield className="h-4 w-4 text-indigo-500 shrink-0" />
          <span>
            Om-LifeOS only accesses files created specifically by this app inside your Google Drive. Your private documents are never touched.
          </span>
        </div>

      </div>

      {/* ======================================================== */}
      {/* MANDATORY CONFIRMATION DIALOG: RESTORE DESTRUCTIVE ACTION */}
      {/* ======================================================== */}
      {confirmRestoreData && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-100">
          <div className="w-full max-w-md rounded-3xl border border-amber-200 bg-white p-6 shadow-2xl dark:border-amber-900/60 dark:bg-slate-900 space-y-4">
            <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-6 w-6 stroke-[2.2]" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Confirm Restore from Google Drive?
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Restoring this backup will replace current local records with the data from Google Drive.
            </p>

            {/* Item Breakdown Summary */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/60 text-xs space-y-2">
              <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Database className="h-4 w-4 text-indigo-500" />
                Payload Content:
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                <div>• Tasks: <span className="font-bold text-slate-900 dark:text-slate-200">{confirmRestoreData.parsedSummary.tasks}</span></div>
                <div>• Goals: <span className="font-bold text-slate-900 dark:text-slate-200">{confirmRestoreData.parsedSummary.goals}</span></div>
                <div>• Notes: <span className="font-bold text-slate-900 dark:text-slate-200">{confirmRestoreData.parsedSummary.notes}</span></div>
                <div>• Journal: <span className="font-bold text-slate-900 dark:text-slate-200">{confirmRestoreData.parsedSummary.journal}</span></div>
                <div>• Habits: <span className="font-bold text-slate-900 dark:text-slate-200">{confirmRestoreData.parsedSummary.habits}</span></div>
                <div>• Finances: <span className="font-bold text-slate-900 dark:text-slate-200">{confirmRestoreData.parsedSummary.finance}</span></div>
              </div>
              {confirmRestoreData.parsedSummary.exportedAt && (
                <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700">
                  Backup Timestamp: {new Date(confirmRestoreData.parsedSummary.exportedAt).toLocaleString()}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRestoreData(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                className="flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-sm cursor-pointer"
              >
                <span>Yes, Overwrite & Restore</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MANDATORY CONFIRMATION DIALOG: DELETE FROM GOOGLE DRIVE   */}
      {/* ======================================================== */}
      {confirmDeleteFile && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-100">
          <div className="w-full max-w-sm rounded-3xl border border-rose-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <Trash2 className="h-5 w-5" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Delete from Google Drive?
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-slate-900 dark:text-white">"{confirmDeleteFile.name}"</span> from your Google Drive? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteFile(null)}
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 shadow-xs cursor-pointer"
              >
                Delete File
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
