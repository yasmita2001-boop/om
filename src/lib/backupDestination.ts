interface BackupWritable {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
}

export interface BackupDirectoryHandle {
  readonly name: string;
  getFileHandle(name: string, options: { create: boolean }): Promise<{
    createWritable(): Promise<BackupWritable>;
  }>;
  queryPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>;
}

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: (options: { mode: 'readwrite' }) => Promise<BackupDirectoryHandle>;
}

const DATABASE_NAME = 'omlifeos-backup-destination';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'backup-directory';

export function isBackupFolderSelectionSupported(): boolean {
  return typeof window !== 'undefined' &&
    typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function' &&
    typeof indexedDB !== 'undefined';
}

function openHandleDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open backup destination storage.'));
  });
}

export async function getSavedBackupDirectory(): Promise<BackupDirectoryHandle | null> {
  if (typeof indexedDB === 'undefined') return null;
  const db = await openHandleDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(HANDLE_KEY);
      request.onsuccess = () => {
        const handle = request.result as Partial<BackupDirectoryHandle> | undefined;
        if (handle && typeof handle.getFileHandle !== 'function') {
          store.delete(HANDLE_KEY);
          resolve(null);
          return;
        }
        resolve((handle as BackupDirectoryHandle | undefined) || null);
      };
      request.onerror = () => reject(request.error || new Error('Could not read the saved backup folder.'));
    });
  } finally {
    db.close();
  }
}

export async function chooseBackupDirectory(): Promise<BackupDirectoryHandle | null> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) return null;
  return picker.call(window, { mode: 'readwrite' });
}

export async function saveBackupDirectory(handle: BackupDirectoryHandle): Promise<void> {
  const db = await openHandleDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readwrite')
        .objectStore(STORE_NAME)
        .put(handle, HANDLE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('Could not save the selected backup folder.'));
    });
  } finally {
    db.close();
  }
}

export async function createBackupWritable(
  handle: BackupDirectoryHandle
): Promise<BackupWritable> {
  const options = { mode: 'readwrite' as const };
  if (handle.queryPermission && handle.requestPermission) {
    let permission = await handle.queryPermission(options);
    if (permission !== 'granted') {
      permission = await handle.requestPermission(options);
    }
    if (permission !== 'granted') {
      throw new Error('Write permission denied. Click “Change folder” and select the backup folder again.');
    }
  }

  const fileHandle = await handle.getFileHandle('Om-LifeOS-Backup.omlifeos', { create: true });
  return fileHandle.createWritable();
}

export async function writeBackupToWritable(writable: BackupWritable, blob: Blob): Promise<void> {
  try {
    await writable.write(blob);
    await writable.close();
  } catch (error) {
    await writable.abort?.();
    throw error;
  }
}

export async function abortBackupWritable(writable: BackupWritable): Promise<void> {
  await writable.abort?.();
}
