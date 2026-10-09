// Google Workspace & Google Drive Integration for Om-LifeOS
// Handles Google OAuth authentication via Firebase Auth and direct Google Drive v3 REST API operations.

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Target Scope configured in OAuth
export const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

// Initialize Firebase App singleton safely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Configure Google Auth Provider
const provider = new GoogleAuthProvider();
SCOPES.forEach(scope => provider.addScope(scope));
// Force consent prompt so Google always asks the user for the Drive permission checkbox
provider.setCustomParameters({
  prompt: 'consent select_account'
});

// In-memory access token cache (NEVER persisted to localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Subscribers for auth state changes
const authSubscribers = new Set<(user: User | null, token: string | null) => void>();

export function subscribeAuth(callback: (user: User | null, token: string | null) => void): () => void {
  authSubscribers.add(callback);
  callback(auth.currentUser, cachedAccessToken);
  return () => authSubscribers.delete(callback);
}

function notifyAuthSubscribers(user: User | null, token: string | null) {
  authSubscribers.forEach(cb => {
    try {
      cb(user, token);
    } catch (err) {
      console.error('Error in auth subscriber', err);
    }
  });
}

/**
 * Initialize Google Auth state listener. Call this on application startup.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
        notifyAuthSubscribers(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Token not available in memory after fresh reload; user can trigger sign-in with prompt
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
        notifyAuthSubscribers(user, null);
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
      notifyAuthSubscribers(null, null);
    }
  });
};

/**
 * Prompt Google Sign-In with popup.
 * Allows user to log in with any real Google account.
 * Returns credentials or null if user closed the popup/cancelled.
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google OAuth access token.');
    }
    cachedAccessToken = credential.accessToken;
    notifyAuthSubscribers(result.user, cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    // If the user closed the popup window or request was cancelled, return null cleanly without error
    if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
      return null;
    }
    console.warn('Google Sign-In notification:', error?.message || error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Retrieve active cached access token.
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Sign out from Google account and flush in-memory tokens.
 */
export const googleSignOut = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
  notifyAuthSubscribers(null, null);
};

// ==========================================
// Google Drive v3 REST API Integration
// ==========================================

export interface DriveBackupFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
  createdTime?: string;
  webViewLink?: string;
}

export interface DriveQuotaInfo {
  limit?: string;
  usage?: string;
  usageInDrive?: string;
}

export interface DriveUserInfo {
  displayName?: string;
  emailAddress?: string;
  photoLink?: string;
}

const PRIMARY_BACKUP_NAME = 'om-lifeos-backup.json';

/**
 * Fetch information about the user's Google Drive account (storage quota, user details)
 * Fails gracefully if scope is restricted to drive.file.
 */
export async function getDriveAccountInfo(token: string): Promise<{ quota: DriveQuotaInfo; user: DriveUserInfo }> {
  try {
    const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota,user', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      return { quota: {}, user: {} };
    }

    const data = await res.json();
    return {
      quota: data.storageQuota || {},
      user: data.user || {}
    };
  } catch {
    return { quota: {}, user: {} };
  }
}

/**
 * Find the primary Om-LifeOS backup file in Google Drive.
 */
export async function findPrimaryBackup(token: string): Promise<DriveBackupFile | null> {
  const query = encodeURIComponent(`name = '${PRIMARY_BACKUP_NAME}' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,size,modifiedTime,createdTime,webViewLink)`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to query Google Drive files (${res.status}): ${errText}`);
  }

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0] as DriveBackupFile;
  }
  return null;
}

/**
 * List all Om-LifeOS backup files stored in Google Drive (including snapshots).
 */
export async function listDriveBackups(token: string): Promise<DriveBackupFile[]> {
  const query = encodeURIComponent(`name contains 'om-lifeos' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,size,modifiedTime,createdTime,webViewLink)&orderBy=modifiedTime desc`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to list Google Drive backups (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return (data.files || []) as DriveBackupFile[];
}

/**
 * Upload or update the full sovereign backup in Google Drive.
 * Uses multipart upload for new files or media patch for existing ones.
 */
export async function uploadBackupToDrive(
  token: string,
  jsonString: string,
  createSnapshot = false
): Promise<DriveBackupFile> {
  const existing = await findPrimaryBackup(token);
  const now = new Date();

  // If createSnapshot is requested, save a timestamped copy as well
  if (createSnapshot) {
    const snapshotName = `om-lifeos-snapshot-${now.toISOString().slice(0, 10)}-${now.getHours()}${now.getMinutes()}.json`;
    await createDriveFile(token, snapshotName, jsonString, 'Om-LifeOS Sovereign Snapshot');
  }

  if (existing) {
    // Update existing primary backup file content
    const patchUrl = `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`;
    const res = await fetch(patchUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: jsonString
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to update Drive backup (${res.status}): ${errText}`);
    }

    const updated = await res.json();
    return {
      ...existing,
      ...updated,
      modifiedTime: new Date().toISOString()
    };
  } else {
    // Create new primary backup file
    return await createDriveFile(
      token,
      PRIMARY_BACKUP_NAME,
      jsonString,
      'Om-LifeOS Executive Sovereign Cloud Backup'
    );
  }
}

/**
 * Create a new file in Google Drive via Multipart upload.
 */
async function createDriveFile(
  token: string,
  fileName: string,
  content: string,
  description: string
): Promise<DriveBackupFile> {
  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    description
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
    content +
    closeDelimiter;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,createdTime,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create file in Google Drive (${res.status}): ${errText}`);
  }

  return await res.json();
}

/**
 * Download raw backup JSON string from Google Drive.
 */
export async function downloadBackupFromDrive(token: string, fileId: string): Promise<string> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to download backup from Google Drive (${res.status}): ${errText}`);
  }

  return await res.text();
}

/**
 * Delete a backup file from Google Drive.
 * (MANDATORY: Must only be invoked after explicit user confirmation dialog).
 */
export async function deleteBackupFromDrive(token: string, fileId: string): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok && res.status !== 404) {
    const errText = await res.text();
    throw new Error(`Failed to delete backup from Google Drive (${res.status}): ${errText}`);
  }
}
