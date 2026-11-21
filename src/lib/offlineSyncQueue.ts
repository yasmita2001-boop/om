const DB_NAME = 'om-offline-sync';
const STORE_NAME = 'pending';
const SYNC_TAG = 'om-drive-sync';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function queueSync(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({
        id: 'pending-sync',
        queuedAt: Date.now()
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();

    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const reg = await navigator.serviceWorker.ready;
      await (reg as any).sync.register(SYNC_TAG);
    }
  } catch {
    // BackgroundSync not available — online listener handles it
  }
}

export async function hasPendingSyncs(): Promise<boolean> {
  try {
    const db = await openDb();
    const result = await new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get('pending-sync');
      req.onsuccess = () => resolve(!!req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch {
    return false;
  }
}

export async function clearPendingSync(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete('pending-sync');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {}
}

export async function processPendingSync(): Promise<boolean> {
  if (!navigator.onLine) return false;
  const pending = await hasPendingSyncs();
  if (!pending) return false;

  try {
    const { getGoogleAccessToken, syncToGoogleDrive } = await import('./googleDriveSync');
    const token = getGoogleAccessToken();
    if (!token) return false;

    const result = await syncToGoogleDrive(token);
    if (result.success) {
      await clearPendingSync();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

let listenerAttached = false;

export function initOfflineSyncListener(): void {
  if (listenerAttached || typeof window === 'undefined') return;
  listenerAttached = true;

  window.addEventListener('online', () => {
    void processPendingSync();
  });
}
