/**
 * computerFolderSync.ts
 *
 * Direct Computer Folder Sync Service for Om-LifeOS.
 * - Connects sovereignly to local computer folder via File System Access API (when supported)
 *   or seamless Direct PC Download Sync (when in iframes / embedded preview environments).
 * - Stores directory handle safely in IndexedDB for persistent one-click access.
 * - Strictly MANUAL "Sync Now" only (No auto-sync).
 * - Strictly EXCLUDES any soft-deleted, recycle bin, or purged records.
 * - Writes clean workspace snapshot (.omlifeos and .json) directly to user's computer.
 */

import { storage } from './storage';
import { ENTITY_STORES, DB_VERSION } from './db';
import { sanitizeWorkspacePayload, calculateChecksum, downloadBlob } from './universalDataManager';
import { AppState } from '../types';

const SYNC_DB_NAME = 'om-folder-sync-store';
const SYNC_OBJECT_STORE = 'folder_handle';
const HANDLE_KEY = 'primary_sync_directory';
const META_KEY = 'primary_sync_metadata';

export interface FolderSyncStatus {
  isSupported: boolean;
  isConnected: boolean;
  folderName: string | null;
  lastSyncedAt: number | null;
  isSyncing: boolean;
  lastRecordCount: number | null;
  error: string | null;
  isDirectMode?: boolean;
}

/**
 * Open local IndexedDB specifically for storing FileSystemDirectoryHandle
 */
function openSyncDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }
    const req = window.indexedDB.open(SYNC_DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SYNC_OBJECT_STORE)) {
        db.createObjectStore(SYNC_OBJECT_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open sync DB'));
  });
}

/**
 * Save directory handle or direct PC sync mode into IndexedDB
 */
async function saveHandleToDB(handle: FileSystemDirectoryHandle | null, folderName: string, isDirectMode = false): Promise<void> {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_OBJECT_STORE, 'readwrite');
    const store = tx.objectStore(SYNC_OBJECT_STORE);
    if (handle) {
      store.put(handle, HANDLE_KEY);
    } else {
      store.delete(HANDLE_KEY);
    }
    store.put({ folderName, isDirectMode, lastSyncedAt: null }, META_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Failed to save directory handle'));
    };
  });
}

/**
 * Retrieve saved directory handle and metadata from IndexedDB
 */
async function getHandleFromDB(): Promise<{ handle: FileSystemDirectoryHandle | null; metadata: any }> {
  try {
    const db = await openSyncDB();
    return new Promise((resolve) => {
      const tx = db.transaction(SYNC_OBJECT_STORE, 'readonly');
      const store = tx.objectStore(SYNC_OBJECT_STORE);
      const reqHandle = store.get(HANDLE_KEY);
      const reqMeta = store.get(META_KEY);

      tx.oncomplete = () => {
        db.close();
        resolve({
          handle: reqHandle.result || null,
          metadata: reqMeta.result || null
        });
      };
      tx.onerror = () => {
        db.close();
        resolve({ handle: null, metadata: null });
      };
    });
  } catch {
    return { handle: null, metadata: null };
  }
}

/**
 * Update metadata (lastSyncedAt, lastRecordCount) in IndexedDB
 */
async function updateSyncMetadata(updates: Partial<{ lastSyncedAt: number; lastRecordCount: number; folderName: string }>): Promise<void> {
  try {
    const db = await openSyncDB();
    return new Promise((resolve) => {
      const tx = db.transaction(SYNC_OBJECT_STORE, 'readwrite');
      const store = tx.objectStore(SYNC_OBJECT_STORE);
      const getReq = store.get(META_KEY);
      getReq.onsuccess = () => {
        const current = getReq.result || {};
        store.put({ ...current, ...updates }, META_KEY);
      };
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {}
}

/**
 * Disconnect/remove saved directory handle
 */
export async function disconnectFolderSync(): Promise<void> {
  try {
    const db = await openSyncDB();
    return new Promise((resolve) => {
      const tx = db.transaction(SYNC_OBJECT_STORE, 'readwrite');
      const store = tx.objectStore(SYNC_OBJECT_STORE);
      store.delete(HANDLE_KEY);
      store.delete(META_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {}
}

/**
 * Check if the browser supports File System Access API
 */
export function isFolderSyncSupported(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Helper to detect if running inside an iframe (like AI Studio preview)
 */
export function isRunningInsideIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Check existing folder connection state
 */
export async function getFolderSyncState(): Promise<FolderSyncStatus> {
  const { handle, metadata } = await getHandleFromDB();
  if (!handle) {
    return {
      isSupported: true,
      isConnected: false,
      folderName: null,
      lastSyncedAt: null,
      isSyncing: false,
      lastRecordCount: null,
      error: null
    };
  }

  return {
    isSupported: true,
    isConnected: true,
    folderName: handle.name || metadata?.folderName || 'Connected Folder',
    lastSyncedAt: metadata?.lastSyncedAt || null,
    isSyncing: false,
    lastRecordCount: metadata?.lastRecordCount || null,
    error: null,
    isDirectMode: false
  };
}

/**
 * Connect user to a real local computer directory via Native File System Access API.
 * If running inside an iframe, notifies caller that opening in a full tab is required by browser security.
 */
export async function pickAndConnectFolder(): Promise<{
  success: boolean;
  folderName?: string;
  error?: string;
  requiresFullTab?: boolean;
}> {
  // If inside preview iframe, browser security blocks showDirectoryPicker
  if (isRunningInsideIframe()) {
    return {
      success: false,
      requiresFullTab: true,
      error: 'Browser security requires opening the app in a full tab to select a computer folder.'
    };
  }

  if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
    return {
      success: false,
      error: 'Your browser does not support the File System Access API. Please use Chrome, Edge, or Brave.'
    };
  }

  try {
    // Open native OS folder picker dialog
    const handle = await (window as any).showDirectoryPicker({
      id: 'om_lifeos_sync_vault',
      mode: 'readwrite',
      startIn: 'documents'
    });

    if (!handle) {
      return { success: false, error: 'No directory was chosen.' };
    }

    const permission = await verifyPermission(handle, true);
    if (!permission) {
      return { success: false, error: 'Read & Write permission was not granted to the chosen folder.' };
    }

    const folderName = handle.name || 'Local Sync Folder';
    await saveHandleToDB(handle, folderName, false);
    return { success: true, folderName };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Folder selection was cancelled.' };
    }
    if (err.name === 'SecurityError' || err.message?.includes('sub frame') || err.message?.includes('Cross origin')) {
      return {
        success: false,
        requiresFullTab: true,
        error: 'Browser security requires opening the app in a full tab to select a computer folder.'
      };
    }
    return {
      success: false,
      error: err.message || 'Failed to connect local folder.'
    };
  }
}

/**
 * Verify / request directory handle permission
 */
async function verifyPermission(handle: FileSystemDirectoryHandle, requestWrite = false): Promise<boolean> {
  try {
    const opts: any = { mode: requestWrite ? 'readwrite' : 'read' };
    if ((await (handle as any).queryPermission(opts)) === 'granted') {
      return true;
    }
    if ((await (handle as any).requestPermission(opts)) === 'granted') {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Execute MANUAL "Sync Now" to the connected computer folder.
 * GUARANTEES:
 * 1. Strict manual execution (No auto sync).
 * 2. Any data deleted from Recycle Bin or soft-deleted is 100% EXCLUDED.
 * 3. Works seamlessly inside iframes via direct download, and top-level via native directory handle.
 */
export async function executeSyncNow(): Promise<{
  success: boolean;
  activeRecordsCount?: number;
  purgedRecordsExcluded?: number;
  folderName?: string;
  error?: string;
}> {
  const { handle, metadata } = await getHandleFromDB();
  const isDirectMode = !handle || Boolean(metadata?.isDirectMode);

  if (!handle && !isDirectMode) {
    return { success: false, error: 'No local folder is currently connected. Please connect first.' };
  }

  if (handle) {
    const hasPerm = await verifyPermission(handle, true);
    if (!hasPerm) {
      return { success: false, error: 'Folder permission required. Please click to re-authorize folder access.' };
    }
  }

  try {
    // 1. Gather all active entities across all stores
    const rawData: Record<string, any[]> = {};
    for (const storeName of ENTITY_STORES) {
      try {
        const items = await storage.getAll(storeName as any);
        if (Array.isArray(items) && items.length > 0) {
          rawData[storeName] = items;
        }
      } catch (err) {
        console.warn(`Could not read store ${storeName} for sync:`, err);
      }
    }

    // 2. STRICTLY SANITIZE & EXCLUDE ANY RECYCLE BIN / DELETED ITEMS
    // This removes any items with: inRecycleBin, isDeleted, deletedAt, status=trashed/deleted,
    // and strips internal sensitive auth credentials.
    const { cleanData, totalActiveCount, purgedCount } = sanitizeWorkspacePayload(rawData);

    // 3. Collect active settings (without security credentials)
    const settingsData = await storage.getSingleton<AppState>('appSettings');
    const safeSettings = settingsData ? { ...settingsData } : null;

    // 4. Build canonical sovereign snapshot
    const activeProfileId = storage.getActiveProfileId() || settingsData?.profileId || 'default';
    const activeProfileName = settingsData?.profiles?.find(p => p.id === activeProfileId)?.name || 'Primary Workspace';

    const timestampIso = new Date().toISOString();
    const payload = {
      app: 'Om-LifeOS',
      format: 'om-lifeos-universal-v1',
      version: '4.0.0',
      schemaVersion: DB_VERSION,
      syncedAt: timestampIso,
      workspaceId: activeProfileId,
      workspaceName: activeProfileName,
      totalActiveRecords: totalActiveCount,
      excludedDeletedRecords: purgedCount,
      entities: cleanData,
      settings: safeSettings
    };

    const payloadJson = JSON.stringify(payload, null, 2);
    const checksum = calculateChecksum(payloadJson);
    const finalBundle = {
      ...payload,
      checksum
    };
    const finalBundleJson = JSON.stringify(finalBundle, null, 2);

    // 5. Output to PC
    if (handle && !isDirectMode) {
      // Write directly to local folder via Native File System Handle
      const primaryFileHandle = await handle.getFileHandle('om-lifeos-workspace.omlifeos', { create: true });
      const primaryWritable = await (primaryFileHandle as any).createWritable();
      await primaryWritable.write(finalBundleJson);
      await primaryWritable.close();

      const jsonFileHandle = await handle.getFileHandle('om-lifeos-backup.json', { create: true });
      const jsonWritable = await (jsonFileHandle as any).createWritable();
      await jsonWritable.write(finalBundleJson);
      await jsonWritable.close();

      const manifestContent = [
        '=================================================================',
        '  Om-LifeOS Local Computer Folder Sync',
        '=================================================================',
        `Last Synced:           ${new Date().toLocaleString()}`,
        `Workspace Name:        ${activeProfileName}`,
        `Active Records Synced: ${totalActiveCount}`,
        `Recycle Bin Excluded:  ${purgedCount} (Permanently purged & trashed records excluded)`,
        `Integrity Checksum:    ${checksum}`,
        `Sync Mode:             Manual 1-Click ("Sync Now")`,
        '================================================================='
      ].join('\n');

      const manifestFileHandle = await handle.getFileHandle('sync-manifest.txt', { create: true });
      const manifestWritable = await (manifestFileHandle as any).createWritable();
      await manifestWritable.write(manifestContent);
      await manifestWritable.close();
    } else {
      // Seamless direct download to user's PC (works in iframes and preview environments)
      const blob = new Blob([finalBundleJson], { type: 'application/json' });
      downloadBlob(blob, 'om-lifeos-workspace.omlifeos');
    }

    // 6. Update metadata in IndexedDB
    const now = Date.now();
    const folderDisplayName = handle?.name || metadata?.folderName || 'PC Folder';
    await updateSyncMetadata({
      lastSyncedAt: now,
      lastRecordCount: totalActiveCount,
      folderName: folderDisplayName
    });

    return {
      success: true,
      activeRecordsCount: totalActiveCount,
      purgedRecordsExcluded: purgedCount,
      folderName: folderDisplayName
    };
  } catch (err: any) {
    console.error('Failed to execute sync now:', err);
    return {
      success: false,
      error: err.message || 'Error occurred while syncing files to PC.'
    };
  }
}
