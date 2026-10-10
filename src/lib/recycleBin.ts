/**
 * recycleBin.ts
 *
 * Consolidated Recycle Bin & Soft-Delete Management Engine.
 * - Single source of truth for active vs soft-deleted records.
 * - Handles moving to/from recycle bin and permanent hard purge.
 * - Ensures deleted items are never exported, synced, or resurrected.
 */

import { SYSTEM_METADATA_STORES } from './db';

/**
 * Strict active record predicate.
 * Returns true ONLY if the item is a genuine, active user record.
 */
export function isRecordActive(item: any): boolean {
  if (!item || typeof item !== 'object') return false;

  // Soft-deleted in recycle bin
  if (item.inRecycleBin === true || item.inRecycleBin === 'true') return false;

  // Explicitly marked deleted
  if (item.isDeleted === true || item.isDeleted === 'true' || item.deleted === true) return false;

  // Has deletion timestamp
  if (item.deletedAt !== undefined && item.deletedAt !== null && item.deletedAt !== '' && item.deletedAt !== false && item.deletedAt !== 0) {
    return false;
  }

  // Status flags indicating deleted / trashed state
  if (item.status === 'deleted' || item.status === 'trashed') return false;

  // Record must have an ID (or be a valid singleton config)
  if (!item.id && !item.theme && !item.profiles) return false;

  return true;
}

/**
 * Checks whether an item is soft-deleted or marked for deletion in any schema.
 */
export function isRecordDeleted(item: any): boolean {
  return !isRecordActive(item);
}

/**
 * Filters an array of records to include strictly active records.
 */
export function filterActiveRecords<T = any>(records: T[]): T[] {
  if (!Array.isArray(records)) return [];
  return records.filter(isRecordActive);
}

/**
 * Filters a workspace dictionary of store arrays, retaining only active items.
 */
export function sanitizeWorkspaceEntities(
  entities: Record<string, any[]>
): { clean: Record<string, any[]>; activeCount: number; purgedCount: number } {
  const clean: Record<string, any[]> = {};
  let activeCount = 0;
  let purgedCount = 0;

  for (const [storeName, items] of Object.entries(entities || {})) {
    if (SYSTEM_METADATA_STORES.has(storeName)) {
      if (Array.isArray(items)) purgedCount += items.length;
      continue;
    }
    if (Array.isArray(items)) {
      const active = filterActiveRecords(items);
      clean[storeName] = active;
      activeCount += active.length;
      purgedCount += items.length - active.length;
    }
  }

  return { clean, activeCount, purgedCount };
}

/**
 * Permanently empties the Recycle Bin and hard-deletes any soft-deleted records
 * lingering inside active IndexedDB entity tables.
 */
export async function permanentlyEmptyRecycleBin(
  db: IDBDatabase,
  entityStores: string[] = [],
  profileId?: string
): Promise<{
  success: boolean;
  hardDeletedFromStores: number;
  recycleBinPurged: number;
  totalPurged: number;
}> {
  if (!db) {
    throw new Error('IndexedDB database connection is required.');
  }

  const storesToPurge = new Map<string, string[]>();
  let totalLingeringSoftDeleted = 0;

  const storesToScan = (entityStores && entityStores.length > 0)
    ? entityStores
    : Array.from(db.objectStoreNames).filter(
        name => name !== 'recycleBin' && name !== 'tombstones' && name !== 'profileSecurity'
      );

  // 1. Scan stores for soft-deleted records
  for (const storeName of storesToScan) {
    if (!db.objectStoreNames.contains(storeName)) continue;

    try {
      const records = await new Promise<any[]>((resolve) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });

      const idsToDelete: string[] = [];
      for (const item of records) {
        if (!item || !item.id) continue;
        if (profileId && item.profileId && item.profileId !== profileId) continue;

        if (isRecordDeleted(item)) {
          idsToDelete.push(item.id);
        }
      }

      if (idsToDelete.length > 0) {
        storesToPurge.set(storeName, idsToDelete);
        totalLingeringSoftDeleted += idsToDelete.length;
      }
    } catch {}
  }

  // 2. Perform hard delete in readwrite transactions
  let hardDeletedCount = 0;
  for (const [storeName, ids] of storesToPurge.entries()) {
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(storeName, 'readwrite');
        const os = tx.objectStore(storeName);
        for (const id of ids) {
          try {
            os.delete(id);
            hardDeletedCount++;
          } catch {}
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {}
  }

  // 3. Clear recycleBin store
  let recycleBinPurged = 0;
  if (db.objectStoreNames.contains('recycleBin')) {
    try {
      recycleBinPurged = await new Promise<number>((resolve) => {
        const tx = db.transaction('recycleBin', 'readwrite');
        const os = tx.objectStore('recycleBin');
        const cntReq = os.count();
        cntReq.onsuccess = () => {
          const count = cntReq.result || 0;
          os.clear();
          tx.oncomplete = () => resolve(count);
          tx.onerror = () => resolve(0);
        };
        cntReq.onerror = () => resolve(0);
      });
    } catch {}
  }

  // 4. Clear tombstones store
  if (db.objectStoreNames.contains('tombstones')) {
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction('tombstones', 'readwrite');
        tx.objectStore('tombstones').clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {}
  }

  return {
    success: true,
    hardDeletedFromStores: hardDeletedCount,
    recycleBinPurged,
    totalPurged: hardDeletedCount + recycleBinPurged
  };
}
