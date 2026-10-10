import React, { useState, useEffect, useCallback } from 'react';
import {
  Cloud, CloudUpload, CloudDownload, Shield, Lock,
  LogOut, RefreshCw, CheckCircle2, Clock, Check, AlertCircle, UserCheck
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  signInWithGoogle,
  switchGoogleAccount,
  disconnectGoogleAccount,
  initGoogleAuth,
  findLatestBackupOnDrive,
  uploadBackupToDrive,
  downloadBackupFromDrive,
  getLastSyncTime,
  formatSyncTimestamp,
  GoogleDriveFileInfo
} from '../lib/googleDriveSyncService';
import { UniversalDataManager } from '../lib/universalDataManager';
import { storage } from '../lib/storage';
import { ConfirmModal } from './ConfirmModal';

interface GoogleDriveSyncCardProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onRefresh: () => void;
}

export const GoogleDriveSyncCard: React.FC<GoogleDriveSyncCardProps> = ({
  onSuccess,
  onError,
  onRefresh,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(false);
  const [isPushing, setIsPushing] = useState<boolean>(false);
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [isCheckingDrive, setIsCheckingDrive] = useState<boolean>(false);
  const [alsoTimestamped, setAlsoTimestamped] = useState<boolean>(false);
  const [latestDriveBackup, setLatestDriveBackup] = useState<GoogleDriveFileInfo | null>(null);
  const [lastSyncDisplay, setLastSyncDisplay] = useState<string>(formatSyncTimestamp(getLastSyncTime()));

  // Confirmation modal state for restore
  const [pendingRestorePayload, setPendingRestorePayload] = useState<any | null>(null);
  const [restoreStatsSummary, setRestoreStatsSummary] = useState<string>('');
  const [isConfirmRestoreOpen, setIsConfirmRestoreOpen] = useState<boolean>(false);

  // Check Drive for existing backup
  const checkDriveBackup = useCallback(async () => {
    if (!hasToken) return;
    setIsCheckingDrive(true);
    try {
      const file = await findLatestBackupOnDrive();
      setLatestDriveBackup(file);
    } catch (err: any) {
      console.warn('[GoogleDrive] Check backup warning:', err);
    } finally {
      setIsCheckingDrive(false);
    }
  }, [hasToken]);

  useEffect(() => {
    // Ensure UniversalDataManager is linked to storage
    UniversalDataManager.getInstance().registerStorageEngine(storage);

    const unsubscribe = initGoogleAuth((user, tokenAvailable) => {
      setCurrentUser(user);
      setHasToken(tokenAvailable);
      if (user && tokenAvailable) {
        checkDriveBackup();
      }
    });

    return () => unsubscribe();
  }, [checkDriveBackup]);

  // Sign In
  const handleSignIn = async () => {
    setIsLoadingAuth(true);
    try {
      const result = await signInWithGoogle();
      setCurrentUser(result.user);
      setHasToken(true);
      onSuccess(`Signed in as ${result.user.displayName || result.user.email}`);
      checkDriveBackup();
    } catch (err: any) {
      console.error('[GoogleAuth] Sign-in error:', err);
      onError(err.message || 'Google sign-in could not be completed.');
    } finally {
      setIsLoadingAuth(false);
    }
  };

  // Switch Account
  const handleSwitchAccount = async () => {
    setIsLoadingAuth(true);
    try {
      const result = await switchGoogleAccount();
      setCurrentUser(result.user);
      setHasToken(true);
      setLatestDriveBackup(null);
      onSuccess(`Switched to ${result.user.displayName || result.user.email}`);
      checkDriveBackup();
    } catch (err: any) {
      console.error('[GoogleAuth] Switch error:', err);
      onError(err.message || 'Could not switch Google account.');
    } finally {
      setIsLoadingAuth(false);
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    try {
      await disconnectGoogleAccount();
      setCurrentUser(null);
      setHasToken(false);
      setLatestDriveBackup(null);
      onSuccess('Disconnected Google account.');
    } catch (err: any) {
      onError(err.message || 'Error disconnecting account.');
    }
  };

  // Push / Save Backup to Google Drive
  const handlePushBackup = async () => {
    if (!hasToken) {
      onError('Please sign in with Google first.');
      return;
    }

    setIsPushing(true);
    try {
      const udm = UniversalDataManager.getInstance();
      const activeProfileId = storage.getActiveProfileId();
      const extracted = await udm.extractCanonicalWorkspaceData({
        profileId: activeProfileId,
        includeFullMedia: true
      });

      const backupObject = {
        app: 'Om-LifeOS',
        version: '5.0.0',
        schemaVersion: 1,
        format: 'om-lifeos-universal-v1',
        exportedAt: new Date().toISOString(),
        workspaceId: activeProfileId,
        workspaceName: 'Primary Workspace',
        totalRecords: extracted.totalActiveCount,
        data: extracted.cleanData,
        summary: extracted.summary
      };

      const jsonPayload = JSON.stringify(backupObject, null, 2);

      const result = await uploadBackupToDrive(jsonPayload, {
        alsoSaveTimestamped: alsoTimestamped
      });

      setLatestDriveBackup(result.primaryFile);
      setLastSyncDisplay(formatSyncTimestamp(new Date().toISOString()));

      const msg = alsoTimestamped
        ? `Workspace backup & timestamped snapshot saved to Google Drive (${extracted.totalActiveCount} records).`
        : `Workspace backup saved to Google Drive (${extracted.totalActiveCount} records).`;

      onSuccess(msg);
    } catch (err: any) {
      console.error('[GoogleDrive] Backup error:', err);
      onError(err.message || 'Failed to backup workspace to Google Drive.');
    } finally {
      setIsPushing(false);
    }
  };

  // Pull / Retrieve from Google Drive (Phase 1: Fetch & Preview)
  const handlePullBackup = async () => {
    if (!hasToken) {
      onError('Please sign in with Google first.');
      return;
    }

    if (!latestDriveBackup) {
      onError('No backup file found on Google Drive.');
      return;
    }

    setIsPulling(true);
    try {
      const payloadString = await downloadBackupFromDrive(latestDriveBackup.id);
      const udm = UniversalDataManager.getInstance();
      const validation = await udm.validateImport(payloadString, storage.getActiveProfileId());

      if (!validation.valid || !validation.cleanData) {
        throw new Error(validation.error || 'The backup file on Google Drive is invalid or corrupted.');
      }

      setPendingRestorePayload(validation);
      const storeCounts = Object.entries(validation.storeBreakdown || {})
        .map(([k, v]) => `${k}: ${v}`)
        .slice(0, 8)
        .join(', ');

      setRestoreStatsSummary(
        `${validation.totalActiveRecords} records across ${validation.storesCount} modules (${storeCounts}...)`
      );
      setIsConfirmRestoreOpen(true);
    } catch (err: any) {
      console.error('[GoogleDrive] Pull error:', err);
      onError(err.message || 'Failed to download or parse backup from Google Drive.');
    } finally {
      setIsPulling(false);
    }
  };

  // Pull / Retrieve from Google Drive (Phase 2: Confirmed Execution)
  const handleConfirmRestore = async () => {
    if (!pendingRestorePayload) return;
    setIsPulling(true);
    setIsConfirmRestoreOpen(false);

    try {
      const udm = UniversalDataManager.getInstance();
      const activeProfileId = storage.getActiveProfileId();

      const result = await udm.restoreValidatedData(pendingRestorePayload, {
        mode: 'replace_workspace',
        targetProfileId: activeProfileId,
        targetProfileName: 'Primary Workspace'
      });

      if (!result.success) {
        throw new Error(result.error || 'Restore pipeline encountered an unexpected error.');
      }

      setLastSyncDisplay(formatSyncTimestamp(new Date().toISOString()));
      onSuccess(`Successfully restored ${result.restoredRecordCount} records from Google Drive.`);
      onRefresh();
    } catch (err: any) {
      console.error('[GoogleDrive] Restore execution error:', err);
      onError(err.message || 'Failed to apply restore from Google Drive.');
    } finally {
      setIsPulling(false);
      setPendingRestorePayload(null);
    }
  };

  // =========================================================================
  // VIEW A: NOT CONNECTED (Screen 1 matching screenshot)
  // =========================================================================
  if (!currentUser || !hasToken) {
    return (
      <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-all">
        {/* Om Logo & App Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
            <span className="text-lg font-bold">ॐ</span>
          </div>
          <h2 className="mt-2.5 text-base font-bold text-slate-900 dark:text-white">
            Om-LifeOS Cloud Sync
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Google Drive Sovereign Workspace Backup
          </p>
        </div>

        {/* Official Styled Sign in with Google Button */}
        <div className="mt-4 flex flex-col items-center">
          <button
            type="button"
            disabled={isLoadingAuth}
            onClick={handleSignIn}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-[0.99] transition-all cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-750 disabled:opacity-60"
          >
            {isLoadingAuth ? (
              <RefreshCw className="h-4 w-4 animate-spin text-indigo-600" />
            ) : (
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>{isLoadingAuth ? 'Connecting Google Account...' : 'Sign in with Google'}</span>
          </button>

          <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500 text-center">
            Requires Google OAuth permission to connect and sync with Google Drive.
          </p>
        </div>

        {/* Bottom Divider */}
        <div className="mt-4 border-t border-slate-100 pt-3.5 dark:border-slate-800">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="flex flex-col items-center gap-1">
              <Lock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">OAuth 2.0</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Cloud className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">Drive Sync</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Shield className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">Zero Local Mock</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW B: CONNECTED (Screen 2 matching screenshot)
  // =========================================================================
  const displayName = currentUser.displayName || 'Google Workspace User';
  const displayEmail = currentUser.email || '';
  const firstLetter = (displayName || displayEmail || 'U').charAt(0).toUpperCase();

  return (
    <div className="w-full">
      {/* Main Google Drive Cloud Sync Card */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-all">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
            <Cloud className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Google Drive Cloud Sync
              </h2>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                Master Auth
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sign in with any Google account to sync all your tasks, notes, goals, and finances securely.
            </p>
          </div>
        </div>

        {/* Section: GOOGLE ACCOUNT IDENTITY */}
        <div className="mt-5 space-y-2.5">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <span>Google Account Identity</span>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800 normal-case">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Connected
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            {/* User Info on Left */}
            <div className="flex items-center gap-3.5 min-w-0">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={displayName}
                  className="h-11 w-11 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-2xs"
                />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 font-bold text-white shadow-2xs">
                  {firstLetter}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {displayName}
                  </span>
                  <UserCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                  {displayEmail}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>Last sync: {lastSyncDisplay}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons on Right */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isLoadingAuth}
                onClick={handleSwitchAccount}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-[0.99] transition-all cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 disabled:opacity-50"
              >
                Switch Account
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3.5 py-2 text-xs font-medium text-red-600 shadow-2xs hover:bg-red-50 active:scale-[0.99] transition-all cursor-pointer dark:border-red-900/60 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>
        </div>

        {/* Two Action Cards Grid */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Push / Backup to Google Drive */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-slate-800 dark:bg-slate-850 shadow-2xs">
            <div>
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <CloudUpload className="h-5 w-5" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Push / Backup to Google Drive
                </h3>
              </div>

              <label className="mt-3.5 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={alsoTimestamped}
                  onChange={e => setAlsoTimestamped(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Also save timestamped snapshot</span>
              </label>
            </div>

            <div className="mt-5">
              <button
                type="button"
                disabled={isPushing}
                onClick={handlePushBackup}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60"
              >
                {isPushing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <CloudUpload className="h-4 w-4" />
                )}
                <span>{isPushing ? 'Uploading to Drive...' : 'Save Backup to Drive'}</span>
              </button>
            </div>
          </div>

          {/* Card 2: Pull / Restore from Google Drive */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-slate-850 dark:bg-slate-850 shadow-2xs">
            <div>
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CloudDownload className="h-5 w-5" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Pull / Restore from Google Drive
                </h3>
              </div>

              {latestDriveBackup && (
                <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Cloud file ready:</span>{' '}
                  {latestDriveBackup.name} {latestDriveBackup.modifiedTime ? `(${new Date(latestDriveBackup.modifiedTime).toLocaleDateString()})` : ''}
                </div>
              )}
            </div>

            <div className="mt-5">
              {latestDriveBackup ? (
                <button
                  type="button"
                  disabled={isPulling}
                  onClick={handlePullBackup}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60"
                >
                  {isPulling ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <CloudDownload className="h-4 w-4" />
                  )}
                  <span>{isPulling ? 'Retrieving from Drive...' : 'Restore Backup from Drive'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isCheckingDrive}
                  onClick={checkDriveBackup}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-750"
                  title="Click to re-scan Google Drive"
                >
                  {isCheckingDrive ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Cloud className="h-4 w-4" />
                  )}
                  <span>{isCheckingDrive ? 'Checking Drive...' : 'No Backup on Drive Yet (Click to Check)'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Privacy Note Footer */}
        <div className="mt-6 flex items-start gap-2 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Shield className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
          <span>
            Om-LifeOS only accesses files created specifically by this app inside your Google Drive.
            Your private documents are never touched.
          </span>
        </div>
      </div>

      {/* Confirmation Modal Before Applying Restore (per Skill Security Requirements) */}
      <ConfirmModal
        isOpen={isConfirmRestoreOpen}
        title="Restore Workspace from Google Drive?"
        message={`Are you sure you want to restore this cloud backup into your active workspace? This will atomically update your current workspace data with the contents from Google Drive: ${restoreStatsSummary}.`}
        confirmText="Confirm & Restore Workspace"
        cancelText="Cancel"
        isDanger={false}
        onConfirm={handleConfirmRestore}
        onCancel={() => {
          setIsConfirmRestoreOpen(false);
          setPendingRestorePayload(null);
        }}
      />
    </div>
  );
};
