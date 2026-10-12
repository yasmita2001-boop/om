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

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { storage } from './storage';
import { ENTITY_STORES, DB_VERSION } from './db';
import {
  sanitizeWorkspacePayload,
  calculateChecksum,
  UniversalDataManager
} from './universalDataManager';
import { AppState } from '../types';

export const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file'
];

export const BACKUP_FILE_NAME = 'om-lifeos-backup.omlifeos';

// Initialize Firebase App instance safely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

// Provider setup
const provider = new GoogleAuthProvider();
for (const scope of DRIVE_SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({
  prompt: 'select_account'
});

export interface GoogleUser {
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  uid?: string;
}

export interface GoogleDriveBackupInfo {
  fileId: string;
  name: string;
  modifiedTime: string;
  sizeBytes?: number;
  recordCount?: number;
}

export interface GoogleSyncState {
  isSignedIn: boolean;
  user: GoogleUser | null;
  lastSyncedAt: number | null;
  isSyncing: boolean;
  autoSyncEnabled: boolean;
  backupInfo: GoogleDriveBackupInfo | null;
  error: string | null;
}

const LOCAL_STORAGE_LAST_SYNC_KEY = 'om_gdrive_last_synced_at';
const LOCAL_STORAGE_AUTO_SYNC_KEY = 'om_gdrive_auto_sync_enabled';

// In-memory token cache (strictly memory-only as per security guidelines)
let inMemoryAccessToken: string | null = null;
let currentGoogleUser: GoogleUser | null = null;
let isSigningIn = false;

/**
 * Initialize Google Auth State listener.
 */
export function initGoogleAuth(
  onStateChange: (user: GoogleUser | null, token: string | null) => void
): () => void {
  return onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
    if (fbUser && inMemoryAccessToken) {
      currentGoogleUser = {
        email: fbUser.email,
        displayName: fbUser.displayName,
        photoURL: fbUser.photoURL,
        uid: fbUser.uid
      };
      onStateChange(currentGoogleUser, inMemoryAccessToken);
    } else {
      if (!isSigningIn) {
        inMemoryAccessToken = null;
        currentGoogleUser = null;
      }
      onStateChange(null, null);
    }
  });
}

/**
 * Sign in with Google Popup.
 */
export async function signInWithGoogle(): Promise<{ user: GoogleUser; accessToken: string }> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve access token from Google Sign-In.');
    }

    inMemoryAccessToken = credential.accessToken;
    currentGoogleUser = {
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
      uid: result.user.uid
    };

    return {
      user: currentGoogleUser,
      accessToken: inMemoryAccessToken
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
  } finally {
    isSigningIn = false;
  }
}

/**
 * Sign out from Google.
 */
export async function signOutGoogle(): Promise<void> {
  try {
    await signOut(auth);
  } catch {}
  inMemoryAccessToken = null;
  currentGoogleUser = null;
}

/**
 * Get current in-memory access token.
 */
export function getGoogleAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function getCurrentGoogleUser(): GoogleUser | null {
  return currentGoogleUser;
}

/**
 * Retrieve saved metadata timestamp.
 */
export function getSavedLastSyncedAt(): number | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_LAST_SYNC_KEY);
    return raw ? parseInt(raw, 10) : null;
  } catch {
    return null;
  }
}

export function setSavedLastSyncedAt(timestamp: number): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_LAST_SYNC_KEY, timestamp.toString());
  } catch {}
}

export function isAutoSyncEnabled(): boolean {
  try {
    return localStorage.getItem(LOCAL_STORAGE_AUTO_SYNC_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setAutoSyncEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_AUTO_SYNC_KEY, enabled ? 'true' : 'false');
  } catch {}
}

/**
 * Search Google Drive for existing Om-LifeOS backup file.
 */
export async function findDriveBackupFile(accessToken: string): Promise<GoogleDriveBackupInfo | null> {
  try {
    const query = encodeURIComponent(`name = '${BACKUP_FILE_NAME}' and trashed = false`);
    const fields = encodeURIComponent('files(id, name, modifiedTime, size, description)');
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&spaces=drive`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!res.ok) {
      if (res.status === 401) {
        inMemoryAccessToken = null;
        throw new Error('Google Drive session expired. Please sign in again.');
      }
      return null;
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
  } catch (err: any) {
    console.warn('Could not locate Google Drive backup file:', err);
    return null;
  }
}

/**
 * Build clean workspace snapshot for Google Drive upload.
 * Strictly guarantees that any soft-deleted, trashed, or permanently deleted records
 * (tracked in tombstones with permanentlyDeleted: true) are 100% EXCLUDED and NEVER uploaded.
 */
export async function buildCleanWorkspaceSnapshot(userEmail?: string | null): Promise<{
  payloadJson: string;
  totalActiveCount: number;
  purgedCount: number;
  checksum: string;
}> {
  // Read local tombstones to ensure permanently deleted records are blocked forever
  const permanentlyDeletedKeys = new Set<string>();
  try {
    const db = await storage.open();
    if (db.objectStoreNames.contains('tombstones')) {
      await new Promise<void>((resolve) => {
        const tx = db.transaction('tombstones', 'readonly');
        const req = tx.objectStore('tombstones').getAll();
        req.onsuccess = () => {
          (req.result || []).forEach((t: any) => {
            if (t.permanentlyDeleted) {
              if (t.id) permanentlyDeletedKeys.add(t.id);
              if (t.recordId) permanentlyDeletedKeys.add(t.recordId);
              if (t.storeName && t.recordId) permanentlyDeletedKeys.add(`${t.storeName}:${t.recordId}`);
            }
          });
          resolve();
        };
        req.onerror = () => resolve();
      });
    }
  } catch {}

  const rawData: Record<string, any[]> = {};
  for (const storeName of ENTITY_STORES) {
    try {
      const items = await storage.getAll(storeName as any);
      if (Array.isArray(items) && items.length > 0) {
        // Exclude any item that is in tombstones
        const filteredItems = items.filter((it: any) => {
          if (!it || !it.id) return false;
          if (permanentlyDeletedKeys.has(it.id)) return false;
          if (permanentlyDeletedKeys.has(`${storeName}:${it.id}`)) return false;
          return true;
        });
        if (filteredItems.length > 0) {
          rawData[storeName] = filteredItems;
        }
      }
    } catch (err) {
      console.warn(`Could not read store ${storeName} for Drive sync:`, err);
    }
  }

  const { cleanData, totalActiveCount, purgedCount } = sanitizeWorkspacePayload(rawData);

  const settingsData = await storage.getSingleton<AppState>('appSettings');
  const safeSettings = settingsData ? { ...settingsData } : null;

  const activeProfileId = storage.getActiveProfileId() || settingsData?.profileId || 'default';
  const activeProfileName = settingsData?.profiles?.find(p => p.id === activeProfileId)?.name || 'Om-LifeOS';

  const timestampIso = new Date().toISOString();
  const payload = {
    app: 'Om-LifeOS',
    format: 'om-lifeos-universal-v1',
    version: '4.8.4',
    schemaVersion: DB_VERSION,
    syncedAt: timestampIso,
    syncedBy: userEmail || 'google-user',
    workspaceId: activeProfileId,
    workspaceName: activeProfileName,
    totalActiveRecords: totalActiveCount,
    excludedDeletedRecords: purgedCount,
    data: cleanData,
    entities: cleanData,
    settings: safeSettings
  };

  const baseJson = JSON.stringify(payload, null, 2);
  const checksum = calculateChecksum(baseJson);
  const fullBundle = {
    ...payload,
    checksum
  };

  return {
    payloadJson: JSON.stringify(fullBundle, null, 2),
    totalActiveCount,
    purgedCount,
    checksum
  };
}

/**
 * Upload or Update backup snapshot to Google Drive.
 */
export async function syncToGoogleDrive(accessToken: string, user?: GoogleUser | null): Promise<{
  success: boolean;
  activeRecordsCount: number;
  purgedRecordsCount: number;
  backupInfo?: GoogleDriveBackupInfo;
  error?: string;
}> {
  try {
    const { payloadJson, totalActiveCount, purgedCount } = await buildCleanWorkspaceSnapshot(user?.email);

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
      throw new Error(`Google Drive API error (${response.status}): ${errText}`);
    }

    const savedFile = await response.json();
    const now = Date.now();
    setSavedLastSyncedAt(now);

    const backupInfo: GoogleDriveBackupInfo = {
      fileId: savedFile.id,
      name: savedFile.name,
      modifiedTime: new Date(now).toISOString(),
      recordCount: totalActiveCount
    };

    return {
      success: true,
      activeRecordsCount: totalActiveCount,
      purgedRecordsCount: purgedCount,
      backupInfo
    };
  } catch (err: any) {
    console.error('Error syncing to Google Drive:', err);
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
  targetProfileName: string
): Promise<{
  success: boolean;
  restoredRecordCount: number;
  storesRestored: number;
  error?: string;
}> {
  try {
    const backupFile = await findDriveBackupFile(accessToken);
    if (!backupFile) {
      throw new Error('No Om-LifeOS backup file found in your Google Drive.');
    }

    const backupContent = await fetchDriveBackupData(accessToken, backupFile.fileId);

    const dataManager = UniversalDataManager.getInstance();
    const validation = await dataManager.validateImport(backupContent, targetProfileId);

    if (!validation.valid) {
      throw new Error(validation.error || 'The backup file in Google Drive could not be validated.');
    }

    const restoreResult = await dataManager.restoreValidatedData(validation, {
      mode: 'replace_workspace',
      targetProfileId,
      targetProfileName
    });

    if (!restoreResult.success) {
      throw new Error(restoreResult.error || 'Failed to apply Google Drive backup data.');
    }

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
 * Automatically syncs the updated clean workspace to Google Drive after a permanent deletion,
 * ensuring the deleted records and files are completely removed from Google Drive as well
 * and can never be re-uploaded.
 */
export async function syncToGoogleDriveAfterPermanentDelete(): Promise<{
  syncedToDrive: boolean;
  activeCount?: number;
  message?: string;
}> {
  const token = inMemoryAccessToken || getGoogleAccessToken();
  if (!token) {
    return { syncedToDrive: false };
  }

  try {
    const res = await syncToGoogleDrive(token, currentGoogleUser);
    if (res.success) {
      return {
        syncedToDrive: true,
        activeCount: res.activeRecordsCount,
        message: 'Google Drive backup updated (permanently deleted records removed from Drive).'
      };
    }
  } catch (err: any) {
    console.warn('Auto-sync to Google Drive after delete failed:', err);
  }

  return { syncedToDrive: false };
}

