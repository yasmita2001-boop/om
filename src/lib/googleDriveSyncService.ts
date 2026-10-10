import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Ensure Firebase is initialized once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const createGoogleProvider = (selectAccount = false) => {
  const provider = new GoogleAuthProvider();
  SCOPES.forEach(scope => provider.addScope(scope));
  if (selectAccount) {
    provider.setCustomParameters({ prompt: 'select_account' });
  }
  return provider;
};

// In-memory cache for OAuth access token (per security requirements)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export interface GoogleDriveFileInfo {
  id: string;
  name: string;
  size?: string;
  modifiedTime?: string;
}

export interface GoogleAuthProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

const LAST_SYNC_KEY = 'om_lifeos_last_gdrive_sync';

export function getLastSyncTime(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

export function setLastSyncTime(dateStr: string): void {
  try {
    localStorage.setItem(LAST_SYNC_KEY, dateStr);
  } catch {}
}

export function formatSyncTimestamp(isoOrDateString?: string | null): string {
  if (!isoOrDateString) return 'Never synced';
  try {
    const d = new Date(isoOrDateString);
    if (isNaN(d.getTime())) return isoOrDateString;
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return `today at ${timeStr}`;
    }
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
  } catch {
    return 'Recently';
  }
}

/**
 * Initializes the auth listener to monitor sign-in state.
 */
export function initGoogleAuth(
  onStateChange: (user: User | null, hasToken: boolean) => void
): () => void {
  return onAuthStateChanged(auth, user => {
    if (!user) {
      cachedAccessToken = null;
    }
    onStateChange(user, !!cachedAccessToken);
  });
}

/**
 * Gets cached access token
 */
export function getGoogleAccessToken(): string | null {
  return cachedAccessToken;
}

/**
 * Genuine Google Sign In
 */
export async function signInWithGoogle(): Promise<{ user: User; accessToken: string }> {
  try {
    isSigningIn = true;
    const provider = createGoogleProvider(false);
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Could not obtain Google Drive OAuth access token.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

/**
 * Switch Google Account (forces account selector)
 */
export async function switchGoogleAccount(): Promise<{ user: User; accessToken: string }> {
  try {
    isSigningIn = true;
    const provider = createGoogleProvider(true);
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Could not obtain Google Drive OAuth access token.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

/**
 * Disconnect Google Account
 */
export async function disconnectGoogleAccount(): Promise<void> {
  await firebaseSignOut(auth);
  cachedAccessToken = null;
}

/**
 * Find the latest Om-LifeOS workspace backup file on Google Drive
 */
export async function findLatestBackupOnDrive(): Promise<GoogleDriveFileInfo | null> {
  if (!cachedAccessToken) {
    throw new Error('Not connected to Google Account. Please sign in first.');
  }

  const query = encodeURIComponent("name = 'om-lifeos-workspace-backup.json' and trashed = false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,size,modifiedTime)&spaces=drive&orderBy=modifiedTime desc`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${cachedAccessToken}`
    }
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Drive search failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0];
  }
  return null;
}

/**
 * Push / Upload workspace backup directly to Google Drive
 */
export async function uploadBackupToDrive(
  jsonPayload: string,
  options: { alsoSaveTimestamped?: boolean } = {}
): Promise<{ primaryFile: GoogleDriveFileInfo; timestampedFile?: GoogleDriveFileInfo }> {
  if (!cachedAccessToken) {
    throw new Error('Google Drive access token unavailable. Please sign in again.');
  }

  const existingFile = await findLatestBackupOnDrive();
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: 'om-lifeos-workspace-backup.json',
    mimeType: 'application/json',
    description: 'Om-LifeOS Sovereign Executive Workspace Cloud Backup'
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    jsonPayload +
    closeDelimiter;

  let uploadUrl: string;
  let method: string;

  if (existingFile) {
    uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart&fields=id,name,size,modifiedTime`;
    method = 'PATCH';
  } else {
    uploadUrl = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,modifiedTime`;
    method = 'POST';
  }

  const res = await fetch(uploadUrl, {
    method,
    headers: {
      Authorization: `Bearer ${cachedAccessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to save backup to Google Drive (${res.status}): ${errorText}`);
  }

  const primaryFile = (await res.json()) as GoogleDriveFileInfo;

  let timestampedFile: GoogleDriveFileInfo | undefined;

  if (options.alsoSaveTimestamped) {
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[:.]/g, '-');
    const tsMetadata = {
      name: `om-lifeos-backup-${dateStamp}.json`,
      mimeType: 'application/json',
      description: `Om-LifeOS Timestamped Snapshot (${now.toLocaleString()})`
    };

    const tsRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(tsMetadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      jsonPayload +
      closeDelimiter;

    const tsRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,modifiedTime',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cachedAccessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: tsRequestBody
      }
    );

    if (tsRes.ok) {
      timestampedFile = (await tsRes.json()) as GoogleDriveFileInfo;
    }
  }

  setLastSyncTime(new Date().toISOString());

  return { primaryFile, timestampedFile };
}

/**
 * Pull / Download backup file payload from Google Drive
 */
export async function downloadBackupFromDrive(fileId: string): Promise<string> {
  if (!cachedAccessToken) {
    throw new Error('Not connected to Google Account. Please sign in first.');
  }

  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${cachedAccessToken}`
    }
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to download backup from Google Drive (${res.status}): ${errorText}`);
  }

  return await res.text();
}
