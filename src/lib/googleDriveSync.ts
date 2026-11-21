/**
 * googleDriveSync.ts
 *
 * Sovereign Google Sign-in and Google Drive Cloud Sync Service for Om-LifeOS.
 * - Authenticates using Firebase Auth with GoogleAuthProvider
 * - Uses least-privilege Google Drive scope: https://www.googleapis.com/auth/drive.file
 * - Access token is cached strictly in-memory (never in localStorage/sessionStorage)
 * - Backs up sanitized active workspace data (0 trashed/purged records) to Google Drive
 * - Provides full restore capability with checksum and schema integrity validation
 * - Supports manual 1-click sync and auto-sync
 */

import firebaseConfig from '../../firebase-applet-config.json';
import { storage } from './storage';
import { ENTITY_STORES, DB_VERSION } from './db';
import {
  sanitizeWorkspacePayload,
  calculateChecksum,
  UniversalDataManager
} from './universalDataManager';
import { AppState, HealthProfile } from '../types';
import { omitDeviceAppearanceSettings } from './appearance';

export const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file'
];

export const BACKUP_FILE_NAME = 'om-lifeos-backup.omlifeos';

type FirebaseServices = {
  auth: import('firebase/auth').Auth;
  GoogleAuthProvider: typeof import('firebase/auth').GoogleAuthProvider;
  signInWithPopup: typeof import('firebase/auth').signInWithPopup;
  signOut: typeof import('firebase/auth').signOut;
};

let firebaseServicesPromise: Promise<FirebaseServices> | null = null;
function getFirebaseServices(): Promise<FirebaseServices> {
  if (!firebaseServicesPromise) {
    firebaseServicesPromise = Promise.all([
      import('firebase/app'),
      import('firebase/auth')
    ]).then(([appModule, authModule]) => {
      const app = appModule.getApps().length === 0
        ? appModule.initializeApp(firebaseConfig)
        : appModule.getApps()[0];
      return {
        auth: authModule.getAuth(app),
        GoogleAuthProvider: authModule.GoogleAuthProvider,
        signInWithPopup: authModule.signInWithPopup,
        signOut: authModule.signOut
      };
    }).catch(err => {
      firebaseServicesPromise = null;
      throw err;
    });
  }
  return firebaseServicesPromise;
}

export interface GoogleUser {
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  uid?: string;
}

export function getGoogleWorkspaceProfileId(user: GoogleUser): string {
  if (!user.uid) throw new Error('Google account identity is unavailable. Please sign in again.');
  return `google-${user.uid}`;
}

export interface GoogleDriveBackupInfo {
  fileId: string;
  name: string;
  modifiedTime: string;
  sizeBytes?: number;
  recordCount?: number;
}

async function createDatedBackupCopy(accessToken: string, fileId: string): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/copy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `om-lifeos-backup-${stamp}.omlifeos` })
  });
  if (!response.ok) throw new Error(`Drive backup version could not be created (${response.status}).`);
}

async function mergeRestoreData(entities: Record<string, any[]>, profileId: string) {
  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const storesAffected = new Set<string>();
  for (const storeName of ENTITY_STORES) {
    const incoming = entities?.[storeName];
    if (!Array.isArray(incoming) || incoming.length === 0) continue;
    const local = await storage.getAll<any>(storeName, profileId);
    const localById = new Map(local.map(item => [item.id, item]));
    for (const item of incoming) {
      if (!item?.id) { skippedCount++; continue; }
      const existing = localById.get(item.id);
      if (!existing) {
        await storage.put(storeName, item);
        addedCount++;
        storesAffected.add(storeName);
      } else if ((item.updatedAt || item.createdAt || 0) > (existing.updatedAt || existing.createdAt || 0)) {
        await storage.put(storeName, { ...existing, ...item, profileId });
        updatedCount++;
        storesAffected.add(storeName);
      } else skippedCount++;
    }
  }
  return { addedCount, updatedCount, skippedCount, storesAffected: storesAffected.size };
}

const LOCAL_STORAGE_LAST_SYNC_KEY = 'om_gdrive_last_synced_at';
const LOCAL_STORAGE_AUTO_SYNC_KEY = 'om_gdrive_auto_sync_enabled';
const getProfileStorageKey = (key: string, profileId = storage.getActiveProfileId()) => `${key}:${profileId}`;
const getPendingBackupPurgeKey = (profileId = storage.getActiveProfileId()) => `om_gdrive_backup_purge_pending:${profileId}`;

function getPendingBackupPurge(profileId: string): boolean {
  return localStorage.getItem(getPendingBackupPurgeKey(profileId)) === 'true';
}

function setPendingBackupPurge(profileId: string, pending: boolean): void {
  const key = getPendingBackupPurgeKey(profileId);
  if (pending) localStorage.setItem(key, 'true');
  else localStorage.removeItem(key);
}

// In-memory token cache (strictly memory-only as per security guidelines)
let inMemoryAccessToken: string | null = null;
let currentGoogleUser: GoogleUser | null = null;
let tokenObtainedAt: number = 0;

/** Max token age in ms before we consider it expired (50 min of 60 min lifetime). */
const TOKEN_MAX_AGE_MS = 50 * 60 * 1000;

/**
 * Returns true if the in-memory access token is likely expired.
 * Google OAuth access tokens last ~60 min; we use a 50-min safety window.
 */
export function isAccessTokenExpired(): boolean {
  if (!inMemoryAccessToken || !tokenObtainedAt) return true;
  return Date.now() - tokenObtainedAt > TOKEN_MAX_AGE_MS;
}

/**
 * Attempt to refresh the access token by re-authenticating with the existing
 * Firebase Auth session. If the user is still signed in, this uses
 * reauthenticateWithPopup to get a fresh Google OAuth access token.
 * Returns the new token or null if re-auth is required.
 */
export async function refreshAccessToken(): Promise<string | null> {
  try {
    const { auth, GoogleAuthProvider, signInWithPopup } = await getFirebaseServices();
    const user = auth.currentUser;
    if (!user) return null;

    const provider = new GoogleAuthProvider();
    for (const scope of DRIVE_SCOPES) provider.addScope(scope);
    // Use signInWithPopup with existing user's account hint for smoother re-auth
    provider.setCustomParameters({ login_hint: user.email || '' });
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (!credential?.accessToken) return null;

    inMemoryAccessToken = credential.accessToken;
    tokenObtainedAt = Date.now();
    currentGoogleUser = {
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
      uid: result.user.uid
    };
    return inMemoryAccessToken;
  } catch {
    return null;
  }
}

/**
 * Get a valid access token, refreshing if expired.
 * Returns the token or throws if re-authentication is required.
 */
export async function ensureFreshAccessToken(): Promise<string> {
  if (inMemoryAccessToken && !isAccessTokenExpired()) {
    return inMemoryAccessToken;
  }
  // Token is expired or missing — try to refresh
  const fresh = await refreshAccessToken();
  if (fresh) return fresh;
  // Refresh failed — clear state and require full sign-in
  inMemoryAccessToken = null;
  tokenObtainedAt = 0;
  throw new Error('Google Drive session expired. Please sign in again to continue syncing.');
}

/**
 * Sign in with Google Popup.
 */
export async function signInWithGoogle(): Promise<{ user: GoogleUser; accessToken: string }> {
  try {
    const { auth, GoogleAuthProvider, signInWithPopup } = await getFirebaseServices();
    const provider = new GoogleAuthProvider();
    for (const scope of DRIVE_SCOPES) provider.addScope(scope);
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve access token from Google Sign-In.');
    }

    const accessToken: string = credential.accessToken;
    inMemoryAccessToken = accessToken;
    tokenObtainedAt = Date.now();
    currentGoogleUser = {
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
      uid: result.user.uid
    };

    return {
      user: currentGoogleUser,
      accessToken
    };
  } catch (error: any) {
    console.error('Google Sign-in failed:', error);
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-In window was closed.');
    }
    if (error.code === 'auth/cancelled-popup-request') {
      throw new Error('Another sign-in request is in progress.');
    }
    throw new Error(error.message || 'Google Sign-In failed.');
  }
}

/**
 * Sign out from Google.
 */
export async function signOutGoogle(): Promise<void> {
  const { auth, signOut } = await getFirebaseServices();
  await signOut(auth);
  inMemoryAccessToken = null;
  tokenObtainedAt = 0;
  currentGoogleUser = null;
}

/**
 * Get current in-memory access token.
 */
export function getGoogleAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function clearGoogleSession(): void {
  inMemoryAccessToken = null;
  tokenObtainedAt = 0;
  currentGoogleUser = null;
}

/**
 * Retrieve saved metadata timestamp.
 */
export function getSavedLastSyncedAt(profileId = storage.getActiveProfileId()): number | null {
  try {
    const raw = localStorage.getItem(getProfileStorageKey(LOCAL_STORAGE_LAST_SYNC_KEY, profileId)) ||
      ((profileId === 'om-master-profile' || profileId === 'default')
        ? localStorage.getItem(LOCAL_STORAGE_LAST_SYNC_KEY)
        : null);
    return raw ? parseInt(raw, 10) : null;
  } catch {
    return null;
  }
}

export function setSavedLastSyncedAt(timestamp: number, profileId = storage.getActiveProfileId()): void {
  try {
    localStorage.setItem(getProfileStorageKey(LOCAL_STORAGE_LAST_SYNC_KEY, profileId), timestamp.toString());
  } catch {}
}

export function isAutoSyncEnabled(profileId = storage.getActiveProfileId()): boolean {
  try {
    const scopedValue = localStorage.getItem(getProfileStorageKey(LOCAL_STORAGE_AUTO_SYNC_KEY, profileId));
    if (scopedValue !== null) return scopedValue === 'true';
    return (profileId === 'om-master-profile' || profileId === 'default') &&
      localStorage.getItem(LOCAL_STORAGE_AUTO_SYNC_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setAutoSyncEnabled(enabled: boolean, profileId = storage.getActiveProfileId()): void {
  try {
    localStorage.setItem(getProfileStorageKey(LOCAL_STORAGE_AUTO_SYNC_KEY, profileId), enabled ? 'true' : 'false');
  } catch {}
}

/**
 * Search Google Drive for the most recently modified active Om-LifeOS backup.
 */
export async function findDriveBackupFile(accessToken: string): Promise<GoogleDriveBackupInfo | null> {
  try {
    const params = new URLSearchParams({
      q: `name = '${BACKUP_FILE_NAME}' and trashed = false`,
      fields: 'files(id,name,modifiedTime,size,description)',
      spaces: 'drive',
      orderBy: 'modifiedTime desc',
      pageSize: '10'
    });
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      if (res.status === 401) {
        inMemoryAccessToken = null;
        throw new Error('Google Drive session expired. Please sign in again.');
      }
      throw new Error(`Could not check Google Drive backup (${res.status}): ${await res.text()}`);
    }

    const data = await res.json();
    if (data.files && data.files.length > 0) {
      const file = data.files[0];
      return {
        fileId: file.id,
        name: file.name,
        modifiedTime: file.modifiedTime,
        sizeBytes: file.size ? parseInt(file.size, 10) : undefined
      };
    }
    return null;
  } catch (err) {
    console.warn('Could not locate Google Drive backup file:', err);
    throw err;
  }
}

async function deleteAllDriveBackupFiles(accessToken: string): Promise<number> {
  const files = new Map<string, { id: string }>();

  for (const trashed of [false, true]) {
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({
        q: `name = '${BACKUP_FILE_NAME}' and trashed = ${trashed}`,
        fields: 'nextPageToken,files(id)',
        spaces: 'drive',
        pageSize: '100'
      });
      if (pageToken) params.set('pageToken', pageToken);

      const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!response.ok) {
        if (response.status === 401) {
          inMemoryAccessToken = null;
          throw new Error('Google Drive session expired. Please sign in again.');
        }
        throw new Error(`Could not list old Google Drive backups (${response.status}): ${await response.text()}`);
      }
      const result = await response.json();
      for (const file of result.files || []) files.set(file.id, file);
      pageToken = result.nextPageToken;
    } while (pageToken);
  }

  for (const file of files.values()) {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok && response.status !== 404) {
      if (response.status === 401) {
        inMemoryAccessToken = null;
        throw new Error('Google Drive session expired. Please sign in again.');
      }
      throw new Error(`Could not permanently delete old Google Drive backup ${file.id} (${response.status}): ${await response.text()}`);
    }
  }

  return files.size;
}

/**
 * Build clean workspace snapshot for Google Drive upload.
 * Strictly guarantees that any soft-deleted, trashed, or permanently deleted records
 * (tracked in tombstones with permanentlyDeleted: true) are 100% EXCLUDED and NEVER uploaded.
 */
export async function buildCleanWorkspaceSnapshot(userEmail?: string | null, accountUid?: string): Promise<{
  payloadJson: string;
  totalActiveCount: number;
  purgedCount: number;
  checksum: string;
}> {
  // Read this workspace's tombstones to ensure permanently deleted records stay excluded.
  const permanentlyDeletedKeys = new Set<string>();
  const db = await storage.open();
  const activeProfileId = storage.getActiveProfileId();
  const isGuest = activeProfileId === 'om-master-profile' || activeProfileId === 'default';
  if (db.objectStoreNames.contains('tombstones')) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('tombstones', 'readonly');
      const req = tx.objectStore('tombstones').getAll();
      req.onsuccess = () => {
        (req.result || []).forEach((t: any) => {
        const belongsToProfile = t.profileId === activeProfileId ||
          (isGuest && (!t.profileId || t.profileId === 'om-master-profile' || t.profileId === 'default'));
        if (t.permanentlyDeleted && belongsToProfile) {
            if (t.id) permanentlyDeletedKeys.add(t.id);
            if (t.recordId) permanentlyDeletedKeys.add(t.recordId);
            if (t.storeName && t.recordId) permanentlyDeletedKeys.add(`${t.storeName}:${t.recordId}`);
          }
        });
        resolve();
      };
      req.onerror = () => reject(req.error || new Error('Failed to read deletion history.'));
      tx.onerror = () => reject(tx.error || new Error('Failed to read deletion history.'));
    });
  }

  const canonical = await UniversalDataManager.getInstance().extractCanonicalWorkspaceData({
    profileId: activeProfileId,
    includeFullMedia: true
  });
  let tombstoneExcludedCount = 0;
  const rawData: Record<string, any[]> = Object.fromEntries(
    ENTITY_STORES.map(storeName => [
      storeName,
      (canonical.cleanData[storeName] || []).filter((it: any) => {
        if (!it || !it.id) return false;
        if (permanentlyDeletedKeys.has(it.id) || permanentlyDeletedKeys.has(`${storeName}:${it.id}`)) {
          tombstoneExcludedCount++;
          return false;
        }
        return true;
      })
    ])
  );
  const healthProfile = await storage.getSingleton<HealthProfile>('healthProfile', activeProfileId);
  rawData.healthProfile = healthProfile
    ? [{ id: `root:${activeProfileId}`, value: healthProfile, profileId: activeProfileId }]
    : [];

  const { cleanData, totalActiveCount } = sanitizeWorkspacePayload(rawData);
  const purgedCount = canonical.purgedGhostCount + tombstoneExcludedCount;

  const settingsData = await storage.getSingleton<AppState>('appSettings', activeProfileId);
  const safeSettings = settingsData ? omitDeviceAppearanceSettings(settingsData) : null;

  const workspaceId = activeProfileId || settingsData?.profileId || 'default';
  const activeProfileName = settingsData?.profiles?.find(p => p.id === workspaceId)?.name || 'Om-LifeOS';

  const timestampIso = new Date().toISOString();
  const payload = {
    app: 'Om-LifeOS',
    format: 'om-lifeos-universal-v1',
    version: '5.0.0',
    schemaVersion: DB_VERSION,
    syncedAt: timestampIso,
    syncedBy: userEmail || 'google-user',
    workspaceId,
    accountUid: accountUid || undefined,
    workspaceName: activeProfileName,
    totalActiveRecords: totalActiveCount,
    excludedDeletedRecords: purgedCount,
    data: cleanData,
    settings: safeSettings
  };

  const checksum = calculateChecksum(JSON.stringify(cleanData));
  const fullBundle = {
    ...payload,
    checksum
  };

  return {
    payloadJson: JSON.stringify(fullBundle),
    totalActiveCount,
    purgedCount,
    checksum
  };
}

/**
 * Upload or Update backup snapshot to Google Drive.
 */
export async function syncToGoogleDrive(
  accessToken: string,
  user?: GoogleUser | null,
  onProgress?: (percent: number, stage: string) => void
): Promise<{
  success: boolean;
  activeRecordsCount: number;
  purgedRecordsCount: number;
  deletedDriveBackupFiles?: number;
  backupInfo?: GoogleDriveBackupInfo;
  error?: string;
}> {
  try {
    if (!user) throw new Error('Sign in to a Google account before syncing a workspace.');
    const expectedProfileId = getGoogleWorkspaceProfileId(user);
    if (storage.getActiveProfileId() !== expectedProfileId) {
      throw new Error('The active workspace does not belong to this Google account.');
    }
    onProgress?.(10, 'preparing data');
    let deletedDriveBackupFiles = 0;
    if (getPendingBackupPurge(expectedProfileId)) {
      deletedDriveBackupFiles = await deleteAllDriveBackupFiles(accessToken);
    }
    const { payloadJson, totalActiveCount, purgedCount } = await buildCleanWorkspaceSnapshot(user.email, user.uid);

    onProgress?.(30, 'uploading');
    const existingFile = await findDriveBackupFile(accessToken);

    const metadata = {
      name: BACKUP_FILE_NAME,
      mimeType: 'application/json',
      description: `Om-LifeOS Sovereign Backup • ${totalActiveCount} active records • Synced ${new Date().toLocaleString()}`
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      payloadJson +
      closeDelimiter;

    // --- Fix #8: Versioned backups — copy old backup with date suffix before overwriting ---
    if (existingFile) {
      try {
        await createDatedBackupCopy(accessToken, existingFile.fileId);
      } catch (err) {
        console.warn('[GoogleDriveSync] Failed to create dated backup copy:', err);
        // Non-fatal: proceed with overwrite even if copy fails
      }
    }

    onProgress?.(50, 'uploading');

    let response: Response;

    if (existingFile) {
      response = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existingFile.fileId}?uploadType=multipart`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: multipartRequestBody
        }
      );
    } else {
      response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: multipartRequestBody
        }
      );
    }

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 401) {
        inMemoryAccessToken = null;
        throw new Error('Google Drive session expired. Please sign in again.');
      }
      throw new Error(`Google Drive API error (${response.status}): ${errText}`);
    }

    onProgress?.(90, 'finalizing');
    const savedFile = await response.json();
    if (!savedFile.id || !savedFile.name) {
      throw new Error('Google Drive did not confirm creation of the clean backup.');
    }
    if (getPendingBackupPurge(expectedProfileId)) {
      setPendingBackupPurge(expectedProfileId, false);
    }
    const now = Date.now();
    setSavedLastSyncedAt(now, expectedProfileId);

    const backupInfo: GoogleDriveBackupInfo = {
      fileId: savedFile.id,
      name: savedFile.name,
      modifiedTime: new Date(now).toISOString(),
      recordCount: totalActiveCount
    };

    onProgress?.(100, 'complete');

    return {
      success: true,
      activeRecordsCount: totalActiveCount,
      purgedRecordsCount: purgedCount,
      deletedDriveBackupFiles,
      backupInfo
    };
  } catch (err: any) {
    console.error('Error syncing to Google Drive:', err);
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      import('./offlineSyncQueue').then(m => m.queueSync()).catch(() => {});
    }
    return {
      success: false,
      activeRecordsCount: 0,
      purgedRecordsCount: 0,
      error: err.message || 'Failed to sync with Google Drive.'
    };
  }
}

/**
 * Fetch backup data from Google Drive.
 */
export async function fetchDriveBackupData(accessToken: string, fileId: string): Promise<any> {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      inMemoryAccessToken = null;
      throw new Error('Google Drive session expired. Please sign in again.');
    }
    throw new Error(`Failed to download backup file: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Restore workspace from Google Drive backup.
 */
export async function restoreFromGoogleDrive(
  accessToken: string,
  targetProfileId: string,
  targetProfileName: string,
  user: GoogleUser,
  options?: {
    merge?: boolean;
    onProgress?: (percent: number, stage: string) => void;
  }
): Promise<{
  success: boolean;
  restoredRecordCount: number;
  storesRestored: number;
  mergedCount?: number;
  skippedCount?: number;
  error?: string;
}> {
  const onProgress = options?.onProgress;
  const merge = options?.merge ?? false;

  try {
    if (targetProfileId !== getGoogleWorkspaceProfileId(user)) {
      throw new Error('The active workspace does not belong to this Google account.');
    }
    onProgress?.(10, 'preparing data');
    const backupFile = await findDriveBackupFile(accessToken);
    if (!backupFile) {
      throw new Error('No Om-LifeOS backup file found in your Google Drive.');
    }

    onProgress?.(30, 'downloading');
    const backupContent = await fetchDriveBackupData(accessToken, backupFile.fileId);
    if (backupContent.accountUid) {
      if (backupContent.accountUid !== user.uid) {
        throw new Error('This Google Drive backup belongs to a different Google account.');
      }
    } else if (!user.email || String(backupContent.syncedBy || '').toLowerCase() !== user.email.toLowerCase()) {
      throw new Error('This legacy Google Drive backup cannot be verified for the signed-in account.');
    }

    onProgress?.(50, 'validating');
    const dataManager = UniversalDataManager.getInstance();
    const validation = await dataManager.validateImport(backupContent, targetProfileId);

    if (!validation.valid) {
      throw new Error(validation.error || 'The backup file in Google Drive could not be validated.');
    }

    onProgress?.(70, 'restoring');

    // --- Fix #6: Merge restore — when merge=true, compare records instead of full replace ---
    if (merge && validation.bundle?.entities) {
      const mergeResult = await mergeRestoreData(validation.bundle.entities, targetProfileId);
      onProgress?.(100, 'complete');
      return {
        success: true,
        restoredRecordCount: mergeResult.addedCount + mergeResult.updatedCount,
        storesRestored: mergeResult.storesAffected,
        mergedCount: mergeResult.updatedCount,
        skippedCount: mergeResult.skippedCount
      };
    }

    const restoreResult = await dataManager.restoreValidatedData(validation, {
      mode: 'replace_workspace',
      targetProfileId,
      targetProfileName
    });

    if (!restoreResult.success) {
      throw new Error(restoreResult.error || 'Failed to apply Google Drive backup data.');
    }

    onProgress?.(100, 'complete');

    return {
      success: true,
      restoredRecordCount: restoreResult.restoredRecordCount,
      storesRestored: restoreResult.storesRestored
    };
  } catch (err: any) {
    console.error('Failed to restore from Google Drive:', err);
    return {
      success: false,
      restoredRecordCount: 0,
      storesRestored: 0,
      error: err.message || 'Failed to restore backup from Google Drive.'
    };
  }
}

/**
 * Pushes a fresh clean workspace to Google Drive after permanent deletion, even if background
 * Auto-Sync is disabled. Tombstones keep the records excluded from later syncs.
 */
export async function syncToGoogleDriveAfterPermanentDelete(): Promise<{
  syncedToDrive: boolean;
  activeCount?: number;
  message?: string;
}> {
  const profileId = storage.getActiveProfileId();
  if (!profileId.startsWith('google-')) {
    return { syncedToDrive: false, message: 'This guest workspace has no Google Drive backup; the local deletion is permanent.' };
  }

  try {
    setPendingBackupPurge(profileId, true);
  } catch (err) {
    return {
      syncedToDrive: false,
      message: `Local deletion is complete, but the Drive-revision purge could not be queued: ${err instanceof Error ? err.message : 'browser storage error'}. Keep this workspace open and retry after reconnecting.`
    };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { syncedToDrive: false, message: 'Offline; the Drive backup and its revisions remain until reconnect. Purge is queued for the next successful sync.' };
  }

  const token = inMemoryAccessToken || getGoogleAccessToken();
  if (!token) {
    return { syncedToDrive: false, message: 'Google Drive is not connected; the old backup revisions remain until reconnect. Purge is queued for the next successful sync.' };
  }

  try {
    if (!currentGoogleUser || getGoogleWorkspaceProfileId(currentGoogleUser) !== profileId) {
      return { syncedToDrive: false, message: 'The signed-in Google account does not match this workspace; Drive purge is queued until the correct account reconnects.' };
    }
    const res = await syncToGoogleDrive(token, currentGoogleUser);
    if (res.success) {
      return {
        syncedToDrive: true,
        activeCount: res.activeRecordsCount,
        message: `Permanently deleted ${res.deletedDriveBackupFiles || 0} previous backup file(s) and their Drive revisions, then created a clean backup.`
      };
    }
    return {
      syncedToDrive: false,
      message: res.error || 'The local deletion succeeded, but the Google Drive backup was not updated.'
    };
  } catch (err: any) {
    console.warn('Auto-sync to Google Drive after delete failed:', err);
    return {
      syncedToDrive: false,
      message: err?.message || 'The local deletion succeeded, but the Google Drive backup was not updated.'
    };
  }
}
