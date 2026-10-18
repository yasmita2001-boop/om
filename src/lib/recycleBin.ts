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

  const storesToScan = (entityStores && entityStores.length > 0)
    ? entityStores
    : Array.from(db.objectStoreNames).filter(
        name => name !== 'recycleBin' && name !== 'tombstones'
      );
  const belongsToProfile = (item: any) => {
    if (!profileId) return true;
    const isGuest = profileId === 'om-master-profile' || profileId === 'default';
    if (!item?.profileId) return isGuest;
    return isGuest
      ? item.profileId === 'om-master-profile' || item.profileId === 'default'
      : item.profileId === profileId;
  };

  // 1. Scan stores for soft-deleted records
  for (const storeName of storesToScan) {
    if (!db.objectStoreNames.contains(storeName)) continue;

    const records = await new Promise<any[]>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error || new Error(`Failed to scan ${storeName} for deleted records.`));
      tx.onerror = () => reject(tx.error || new Error(`Failed to scan ${storeName} for deleted records.`));
    });

    const idsToDelete: string[] = [];
    for (const item of records) {
      if (!item || !item.id) continue;
      if (!belongsToProfile(item)) continue;

      if (isRecordDeleted(item)) {
        idsToDelete.push(item.id);
      }
    }

    if (idsToDelete.length > 0) {
      storesToPurge.set(storeName, idsToDelete);
    }
  }

  // 2. Perform hard delete in readwrite transactions
  let hardDeletedCount = 0;
  for (const [storeName, ids] of storesToPurge.entries()) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const os = tx.objectStore(storeName);
      for (const id of ids) os.delete(id);
      tx.oncomplete = () => {
        hardDeletedCount += ids.length;
        resolve();
      };
      tx.onerror = () => reject(tx.error || new Error(`Failed to permanently delete records from ${storeName}.`));
      tx.onabort = () => reject(tx.error || new Error(`Permanent deletion from ${storeName} was aborted.`));
    });
  }

  // 3. Remove only this workspace's recycle-bin entries
  let recycleBinPurged = 0;
  if (db.objectStoreNames.contains('recycleBin')) {
    recycleBinPurged = await new Promise<number>((resolve, reject) => {
        const tx = db.transaction('recycleBin', 'readwrite');
        const os = tx.objectStore('recycleBin');
        let count = 0;
        const req = os.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) return;
          if (belongsToProfile(cursor.value)) {
            cursor.delete();
            count++;
          }
          cursor.continue();
        };
        tx.oncomplete = () => resolve(count);
        tx.onerror = () => reject(tx.error || new Error('Failed to permanently empty the Recycle Bin.'));
        tx.onabort = () => reject(tx.error || new Error('Emptying the Recycle Bin was aborted.'));
      });
  }

  // 4. Mark all tombstones as permanentlyDeleted: true so they can NEVER be re-uploaded or resurrected
  if (db.objectStoreNames.contains('tombstones')) {
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('tombstones', 'readwrite');
        const os = tx.objectStore('tombstones');
        const req = os.getAll();
        req.onsuccess = () => {
          const tombstones = req.result || [];
          for (const tomb of tombstones) {
            if (belongsToProfile(tomb)) {
              const { contentSignature: _contentSignature, ...minimalTombstone } = tomb;
              os.put({ ...minimalTombstone, permanentlyDeleted: true, purgedAt: Date.now() });
            }
          }
        };
        req.onerror = () => reject(req.error || new Error('Failed to read permanent-deletion records.'));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('Failed to update permanent-deletion records.'));
        tx.onabort = () => reject(tx.error || new Error('Updating permanent-deletion records was aborted.'));
      });
  }

  return {
    success: true,
    hardDeletedFromStores: hardDeletedCount,
    recycleBinPurged,
    totalPurged: hardDeletedCount + recycleBinPurged
  };
}
