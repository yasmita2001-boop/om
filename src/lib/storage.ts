/**
 * storage.ts
 *
 * Consolidated Repository & Storage Engine for Om-LifeOS.
 * - Single source of truth for all 54 entity stores, singletons, and system stores.
 * - Logically separated database schema (db.ts), recycle bin & soft deletion (recycleBin.ts), exports (exportManager.ts), and imports (importManager.ts).
 * - Zero duplicate wrapper code, zero redundant patches.
 * - Full backward-compatibility preserved for all existing consumers.
 */

import {
  DB_NAME, DB_VERSION, ENTITY_STORES, SINGLETON_STORES, SYSTEM_STORES,
  TRANSIENT_RECYCLE_SKIP_STORES, SYSTEM_METADATA_STORES, STORE_LABELS,
  DeletionTombstone, generateUUID, parseTimestampMs, computeRecordSignature,
  describeDeletedRecord, createDatabaseSchema
} from './db';

import {
  isRecordActive, isRecordDeleted, filterActiveRecords, permanentlyEmptyRecycleBin
} from './recycleBin';

import {
  universalDataManager,
  UniversalDataManager,
  SUPPORTED_EXPORT_FORMATS,
  UniversalExportFormat,
  UniversalBackupPayload,
  UniversalValidationResult,
  UniversalRestoreOptions,
  UniversalRestoreResult,
  sanitizeWorkspacePayload,
  downloadBlob
} from './universalDataManager';

import {
  AppState, UserProfile, RecycleBinItem, ManualUpdateBundle,
  BundleDiffInspection, ApplyBundleResult, Task, Routine, Habit, Goal, Note
} from '../types';

import { createLightweightEntities, calculatePayloadBreakdown } from './thumbnailService';

const FOCUS_ALARMS_STORAGE_KEY = 'om_focus_alarms_list';

function getProfileStorageKeys(profileId: string): string[] {
  const keys = [`${FOCUS_ALARMS_STORAGE_KEY}:${profileId}`];
  if (profileId === 'om-master-profile' || profileId === 'default') {
    keys.push(FOCUS_ALARMS_STORAGE_KEY);
  }
  return keys;
}

function removeRoutineAlarmCacheEntries(profileId: string, routineIds: Set<string>): void {
  if (typeof localStorage === 'undefined' || routineIds.size === 0) return;
  for (const key of getProfileStorageKeys(profileId)) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    const alarms = JSON.parse(raw);
    if (!Array.isArray(alarms)) throw new Error(`Invalid focus alarm cache format in ${key}.`);
    const cleaned = alarms.filter(alarm => !routineIds.has(alarm?.linkedRoutineId));
    if (cleaned.length !== alarms.length) localStorage.setItem(key, JSON.stringify(cleaned));
  }
}

function pruneOrphanedRoutineAlarmCache(profileId: string, activeRoutineIds: Set<string>): void {
  if (typeof localStorage === 'undefined') return;
  for (const key of getProfileStorageKeys(profileId)) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    const alarms = JSON.parse(raw);
    if (!Array.isArray(alarms)) throw new Error(`Invalid focus alarm cache format in ${key}.`);
    const cleaned = alarms.filter(alarm => !alarm?.linkedRoutineId || activeRoutineIds.has(alarm.linkedRoutineId));
    if (cleaned.length !== alarms.length) localStorage.setItem(key, JSON.stringify(cleaned));
  }
}

// Re-export core constants and types for genuine consumers
export {
  DB_NAME, DB_VERSION, ENTITY_STORES, SINGLETON_STORES, SYSTEM_STORES,
  TRANSIENT_RECYCLE_SKIP_STORES, SYSTEM_METADATA_STORES, STORE_LABELS,
  generateUUID, parseTimestampMs, computeRecordSignature, describeDeletedRecord,
  isRecordActive, isRecordDeleted, filterActiveRecords, permanentlyEmptyRecycleBin,
  sanitizeWorkspacePayload, downloadBlob,
  universalDataManager, UniversalDataManager, SUPPORTED_EXPORT_FORMATS
};
export type {
  DeletionTombstone,
  UniversalExportFormat, UniversalBackupPayload, UniversalValidationResult,
  UniversalRestoreOptions, UniversalRestoreResult
};

class StorageEngine {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private channel: BroadcastChannel | null = null;
  private changeListeners: Set<(store: string, action: string, id?: string) => void> = new Set();
  private profileOwnershipEnsured = new Set<string>();
  public deviceId: string = generateUUID();
  private activeProfileId: string = 'om-master-profile';

  constructor() {
    universalDataManager.registerStorageEngine(this);
    try {
      this.channel = new BroadcastChannel('om-lifeos-cross-tab');
      this.channel.onmessage = (event) => {
        if (event.data && event.data.sourceDevice !== this.deviceId) {
          for (const listener of this.changeListeners) {
            try {
              listener(event.data.store, event.data.action, event.data.id);
            } catch {}
          }
        }
      };
    } catch {}

    try {
      if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
        navigator.storage.persist().catch(() => {});
      }
    } catch {}
  }

  public getChannel(): BroadcastChannel | null {
    return this.channel;
  }

  public close(): void {
    if (this.db) {
      try {
        this.db.close();
      } catch {}
      this.db = null;
      this.dbPromise = null;
    }
  }

  public onStorageChange(listener: (store: string, action: string, id?: string) => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  public subscribe(listener: (store?: string, action?: string, id?: string) => void): () => void {
    const handler = (store: string, action: string, id?: string) => {
      try {
        listener(store, action, id);
      } catch (err) {
        console.warn('[StorageEngine] subscribe listener error:', err);
      }
    };
    this.changeListeners.add(handler);
    return () => {
      this.changeListeners.delete(handler);
    };
  }

  public setActiveProfile(profileId: string | null): void {
    this.activeProfileId = profileId || 'om-master-profile';
  }

  public getActiveProfileId(): string {
    return this.activeProfileId || 'om-master-profile';
  }

  private belongsToProfile(item: any, profileId: string): boolean {
    if (!item?.profileId) {
      return profileId === 'om-master-profile' || profileId === 'default';
    }
    if (profileId === 'om-master-profile' || profileId === 'default') {
      return item.profileId === 'om-master-profile' || item.profileId === 'default';
    }
    return item.profileId === profileId;
  }

  private getScopedSingletonId(storeName: string, profileId = this.getActiveProfileId()): string {
    return SINGLETON_STORES.includes(storeName)
      ? `root:${profileId}`
      : 'root';
  }

  public getAllStoreNames(): string[] {
    if (this.db) {
      return Array.from(this.db.objectStoreNames);
    }
    return Array.from(new Set([...ENTITY_STORES, ...SINGLETON_STORES, ...SYSTEM_STORES]));
  }

  private withActiveProfile<T extends { id: string }>(storeName: string, item: T): T {
    if (SINGLETON_STORES.includes(storeName) || SYSTEM_STORES.includes(storeName)) return item;
    const activeProfileId = this.getActiveProfileId();
    if ((item as any).profileId && !this.belongsToProfile(item, activeProfileId)) {
      throw new Error(`Cannot write a record owned by another workspace into "${storeName}".`);
    }
    const targetProfileId = (item as any).profileId || activeProfileId;
    return { ...(item as any), profileId: targetProfileId } as T;
  }

  public open(): Promise<IDBDatabase> {
    if (this.db) {
      const allRequired = [...ENTITY_STORES, ...SINGLETON_STORES, ...SYSTEM_STORES];
      const hasAll = allRequired.every(name => this.db!.objectStoreNames.contains(name));
      if (hasAll) {
        return Promise.resolve(this.db);
      }
      try { this.db.close(); } catch {}
      this.db = null;
      this.dbPromise = null;
    }

    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        this.dbPromise = null;
        reject(new Error('IndexedDB is not supported in this environment.'));
        return;
      }

      const setupAndResolve = (db: IDBDatabase) => {
        const allRequired = [...ENTITY_STORES, ...SINGLETON_STORES, ...SYSTEM_STORES];
        const missing = allRequired.filter(s => !db.objectStoreNames.contains(s));
        if (missing.length > 0) {
          const nextVersion = (db.version || DB_VERSION) + 1;
          try { db.close(); } catch {}
          const upReq = indexedDB.open(DB_NAME, nextVersion);
          upReq.onupgradeneeded = () => {
            createDatabaseSchema(upReq.result);
          };
          upReq.onsuccess = () => {
            const upgradedDb = upReq.result;
            this.db = upgradedDb;
            upgradedDb.onversionchange = () => {
              try { upgradedDb.close(); } catch {}
              this.db = null;
              this.dbPromise = null;
            };
            upgradedDb.onclose = () => {
              this.db = null;
              this.dbPromise = null;
            };
            resolve(upgradedDb);
          };
          upReq.onerror = () => {
            this.dbPromise = null;
            reject(upReq.error || new Error('Failed to upgrade IndexedDB stores.'));
          };
          return;
        }

        this.db = db;
        db.onversionchange = () => {
          try { db.close(); } catch {}
          this.db = null;
          this.dbPromise = null;
        };
        db.onclose = () => {
          this.db = null;
          this.dbPromise = null;
        };
        resolve(db);
      };

      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onblocked = () => {
        console.warn('[IndexedDB] Database upgrade blocked by open connection.');
      };

      req.onupgradeneeded = () => {
        createDatabaseSchema(req.result);
      };

      req.onsuccess = () => {
        setupAndResolve(req.result);
      };

      req.onerror = () => {
        this.dbPromise = null;
        reject(req.error || new Error('Failed to open IndexedDB database.'));
      };
    });

    return this.dbPromise;
  }

  public broadcastChange(store: string, action: string, id?: string): void {
    for (const listener of this.changeListeners) {
      try {
        listener(store, action, id);
      } catch {}
    }
    try {
      this.channel?.postMessage({
        sourceDevice: this.deviceId,
        store,
        action,
        id,
        timestamp: Date.now()
      });
    } catch {}
  }

  // --------------------------------------------------------------------------
  // REPOSITORY CRUD OPERATIONS
  // --------------------------------------------------------------------------

  public async get<T>(storeName: string, id: string): Promise<T | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(id);
        req.onsuccess = () => {
          const item = req.result;
          if (!item) return resolve(null);
          if (SINGLETON_STORES.includes(storeName)) {
            return resolve(this.belongsToProfile({ profileId: item.profileId }, this.getActiveProfileId()) ? item.value : null);
          }
          if (storeName === 'appliedBundles') {
            return resolve(item);
          }
          if (storeName !== 'recycleBin' && storeName !== 'tombstones' && !isRecordActive(item)) return resolve(null);
          const target = this.activeProfileId || 'om-master-profile';
          if (!this.belongsToProfile(item, target)) return resolve(null);
          resolve(item);
        };
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  public async getAll<T>(storeName: string, profileId?: string): Promise<T[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => {
          const results: T[] = req.result || [];
          if (SINGLETON_STORES.includes(storeName)) {
            const target = profileId || this.activeProfileId || 'om-master-profile';
            const scopedId = `root:${target}`;
            const scoped = results.find((item: any) => item?.id === scopedId);
            const canUseLegacy = !target.startsWith('google-');
            return resolve(scoped ? [scoped] : (canUseLegacy ? results.filter((item: any) => item?.id === 'root') : []));
          }
          if (storeName === 'appliedBundles') {
            return resolve(results);
          }
          const target = profileId || this.activeProfileId || 'om-master-profile';
          const filtered = results.filter((item: any) => {
            if (!item) return false;
            if (storeName !== 'recycleBin' && storeName !== 'tombstones' && !isRecordActive(item)) return false;
            return this.belongsToProfile(item, target);
          });
          resolve(filtered);
        };
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  public async getAllRaw<T>(storeName: string): Promise<T[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  public async getSingleton<T>(storeName: string, profileId = this.getActiveProfileId()): Promise<T | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      try {
        const canUseLegacy = !profileId.startsWith('google-');
        const tx = db.transaction(storeName, canUseLegacy ? 'readwrite' : 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(this.getScopedSingletonId(storeName, profileId));
        let value: T | null = null;
        req.onsuccess = () => {
          const item = req.result;
          if (item) {
            value = item.value;
          } else if (canUseLegacy) {
            const legacyReq = store.get('root');
            legacyReq.onsuccess = () => {
              const legacy = legacyReq.result;
              if (legacy) {
                value = legacy.value;
                store.put({ id: this.getScopedSingletonId(storeName, profileId), value: legacy.value, profileId });
                if (profileId !== 'om-master-profile' && profileId !== 'default') {
                  store.delete('root');
                }
              }
            };
            legacyReq.onerror = () => reject(legacyReq.error);
          }
        };
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => resolve(value);
        tx.onerror = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  public async setSingleton<T>(storeName: string, value: T, profileId = this.getActiveProfileId()): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const id = this.getScopedSingletonId(storeName, profileId);
        const req = store.put({ id, value, profileId });
        req.onsuccess = () => {
          this.broadcastChange(storeName, 'set', id);
          resolve();
        };
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  public async deleteSingleton(storeName: string, profileId = this.getActiveProfileId()): Promise<void> {
    const db = await this.open();
    const id = this.getScopedSingletonId(storeName, profileId);
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).delete(id);
        tx.oncomplete = () => {
          this.broadcastChange(storeName, 'delete', id);
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  public async put<T extends { id: string }>(storeName: string, item: T): Promise<T> {
    const db = await this.open();
    const prepared = this.withActiveProfile(storeName, item);
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(prepared);
        req.onsuccess = () => {
          this.broadcastChange(storeName, 'put', prepared.id);
          resolve(prepared);
        };
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  public async bulkPut<T extends { id: string }>(storeName: string, items: T[]): Promise<void> {
    if (!items.length) return;
    const preparedItems = items.map(item => this.withActiveProfile(storeName, item));
    const db = await this.open();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        for (const item of preparedItems) {
          store.put(item);
        }
        tx.oncomplete = () => {
          this.broadcastChange(storeName, 'bulkPut');
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  public async delete(storeName: string, id: string): Promise<void> {
    if (TRANSIENT_RECYCLE_SKIP_STORES.has(storeName)) {
      return this.hardDelete(storeName, id);
    }
    return this.moveToRecycleBin(storeName, id);
  }

  public async hardDelete(storeName: string, id: string): Promise<void> {
    if ((ENTITY_STORES.includes(storeName) || storeName === 'recycleBin') && !await this.get(storeName, id)) return;
    const db = await this.open();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.delete(id);
        req.onsuccess = () => {
          this.broadcastChange(storeName, 'delete', id);
          resolve();
        };
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  public async clearStore(storeName: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        if (SINGLETON_STORES.includes(storeName)) {
          store.delete(this.getScopedSingletonId(storeName));
        } else if (ENTITY_STORES.includes(storeName) || storeName === 'recycleBin' || storeName === 'tombstones') {
          const req = store.openCursor();
          req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor) return;
            if (this.belongsToProfile(cursor.value, this.getActiveProfileId())) cursor.delete();
            cursor.continue();
          };
        } else {
          store.clear();
        }
        tx.oncomplete = () => {
          this.broadcastChange(storeName, 'clear');
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  public async atomicPutMany(items: { storeName: string; item: any }[]): Promise<void> {
    if (!items.length) return;
    const preparedItems = items.map(({ storeName, item }) => ({
      storeName,
      item: this.withActiveProfile(storeName, item)
    }));
    const db = await this.open();
    const storeNames = Array.from(new Set(preparedItems.map(i => i.storeName)));
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeNames, 'readwrite');
        for (const { storeName, item } of preparedItems) {
          tx.objectStore(storeName).put(item);
        }
        tx.oncomplete = () => {
          for (const s of storeNames) {
            this.broadcastChange(s, 'atomicPutMany');
          }
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  public async ensureProfileOwnership(profileId: string): Promise<void> {
    if (!profileId || this.profileOwnershipEnsured.has(profileId)) return;
    const db = await this.open();
    for (const storeName of [...ENTITY_STORES, 'recycleBin', 'tombstones']) {
      if (!db.objectStoreNames.contains(storeName)) continue;
      const rows = await this.getAllRaw<any>(storeName);
      const unowned = rows.filter(r => r && !r.profileId);
      if (unowned.length > 0) {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          for (const item of unowned) {
            store.put({ ...item, profileId });
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }
    }
    this.profileOwnershipEnsured.add(profileId);
  }

  // --------------------------------------------------------------------------
  // LINKED ENTITY DELETION HELPERS
  // --------------------------------------------------------------------------

  public async deleteFinanceTransactionWithLink(id: string): Promise<void> {
    const tx = await this.get<any>('finance', id);
    if (tx) {
      const amt = Number(tx.amount) || 0;

      // 1. Account Transfer deletion: Reverse both accounts
      if (tx.type === 'transfer') {
        if (tx.fromAccountId) {
          const fromAcct = await this.get<any>('financeAccounts', tx.fromAccountId);
          if (fromAcct) {
            await this.put('financeAccounts', {
              ...fromAcct,
              balance: (Number(fromAcct.balance) || 0) + amt
            });
          }
        }
        if (tx.toAccountId) {
          const toAcct = await this.get<any>('financeAccounts', tx.toAccountId);
          if (toAcct) {
            await this.put('financeAccounts', {
              ...toAcct,
              balance: (Number(toAcct.balance) || 0) - amt
            });
          }
        }
      }
      // 2. Loan Repayment deletion: Refund account, restore loan outstanding principal, clean payment
      else if (tx.type === 'repayment') {
        if (tx.accountId && amt > 0) {
          const acct = await this.get<any>('financeAccounts', tx.accountId);
          if (acct) {
            await this.put('financeAccounts', {
              ...acct,
              balance: (Number(acct.balance) || 0) + amt
            });
          }
        }

        // Restore loan outstanding
        if (tx.linkedLoanId) {
          const loan = await this.get<any>('loans', tx.linkedLoanId);
          if (loan) {
            const principal = Number(tx.principal) || amt;
            await this.put('loans', {
              ...loan,
              outstanding: (Number(loan.outstanding) || 0) + principal
            });
          }
        }

        // Clean up linked loan payment record
        if (tx.linkedLoanPaymentId) {
          try {
            await this.delete('loanPayments', tx.linkedLoanPaymentId);
          } catch {}
        }
      }
      // 3. Regular Expense, Investment, Savings, Income, or Loan Receipt
      else {
        if (tx.accountId && amt > 0) {
          const acct = await this.get<any>('financeAccounts', tx.accountId);
          if (acct) {
            let newBal = Number(acct.balance || 0);
            if (tx.type === 'expense' || tx.type === 'investment' || tx.type === 'savings') {
              newBal += amt;
            } else if (tx.type === 'income' || tx.type === 'loan') {
              newBal -= amt;
            }
            await this.put('financeAccounts', { ...acct, balance: newBal });
          }
        }

        // Clean up linked investment asset if this was an investment transaction
        if (tx.linkedInvestmentId) {
          try {
            await this.delete('investments', tx.linkedInvestmentId);
          } catch {}
        }

        // Adjust linked savings plan current amount if this was a savings contribution
        if (tx.linkedSavingsPlanId) {
          try {
            const sp = await this.get<any>('savingsPlans', tx.linkedSavingsPlanId);
            if (sp) {
              await this.put('savingsPlans', {
                ...sp,
                currentAmount: Math.max(0, (Number(sp.currentAmount) || 0) - amt),
                updatedAt: Date.now()
              });
            }
          } catch {}
        }
      }

      // 4. Unlink receipt if linked
      if (tx.linkedReceiptId) {
        try {
          const receipt = await this.get<any>('receipts', tx.linkedReceiptId);
          if (receipt) {
            await this.put('receipts', {
              ...receipt,
              linkedTransactionId: null,
              linkedExpenseId: null
            });
          }
        } catch {}
      }
    }
    await this.delete('finance', id);
  }

  public async deleteReceiptWithLink(id: string): Promise<void> {
    const receipt = await this.get<any>('receipts', id);
    if (receipt?.linkedExpenseId) {
      try {
        await this.deleteFinanceTransactionWithLink(receipt.linkedExpenseId);
      } catch {}
    }
    await this.delete('receipts', id);
  }

  private async reapplyFinanceTransactionEffect(tx: any): Promise<void> {
    if (!tx) return;
    const amt = Number(tx.amount) || 0;
    if (amt <= 0) return;

    if (tx.type === 'transfer') {
      if (tx.fromAccountId) {
        const fromAcct = await this.get<any>('financeAccounts', tx.fromAccountId);
        if (fromAcct) {
          await this.put('financeAccounts', { ...fromAcct, balance: (Number(fromAcct.balance) || 0) - amt });
        }
      }
      if (tx.toAccountId) {
        const toAcct = await this.get<any>('financeAccounts', tx.toAccountId);
        if (toAcct) {
          await this.put('financeAccounts', { ...toAcct, balance: (Number(toAcct.balance) || 0) + amt });
        }
      }
    } else if (tx.type === 'repayment') {
      if (tx.accountId) {
        const acct = await this.get<any>('financeAccounts', tx.accountId);
        if (acct) {
          await this.put('financeAccounts', { ...acct, balance: (Number(acct.balance) || 0) - amt });
        }
      }
      if (tx.linkedLoanId) {
        const loan = await this.get<any>('loans', tx.linkedLoanId);
        if (loan) {
          const principal = Number(tx.principal) || amt;
          await this.put('loans', { ...loan, outstanding: Math.max(0, (Number(loan.outstanding) || 0) - principal) });
        }
      }
    } else {
      if (tx.accountId) {
        const acct = await this.get<any>('financeAccounts', tx.accountId);
        if (acct) {
          let newBal = Number(acct.balance || 0);
          if (tx.type === 'expense' || tx.type === 'investment' || tx.type === 'savings') {
            newBal -= amt;
          } else if (tx.type === 'income' || tx.type === 'loan') {
            newBal += amt;
          }
          await this.put('financeAccounts', { ...acct, balance: newBal });
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // RECYCLE BIN OPERATIONS
  // --------------------------------------------------------------------------

  public async moveToRecycleBin(storeName: string, id: string): Promise<void> {
    const db = await this.open();
    const item = await this.get<any>(storeName, id);
    if (!item) return;

    const profileId = item.profileId || this.activeProfileId || 'om-master-profile';
    const deletedAt = Date.now();
    const signature = computeRecordSignature(storeName, item);

    const recycleEntry: RecycleBinItem = {
      id: `${storeName}:${id}`,
      storeName,
      recordId: id,
      profileId,
      deletedAt,
      data: item,
      title: describeDeletedRecord(storeName, item).title,
      moduleLabel: describeDeletedRecord(storeName, item).moduleLabel,
      storeLabel: describeDeletedRecord(storeName, item).storeLabel
    };

    const tombstone: DeletionTombstone = {
      id: `${storeName}:${id}`,
      storeName,
      recordId: id,
      profileId,
      deletedAt,
      permanentlyDeleted: false,
      contentSignature: signature
    };

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([storeName, 'recycleBin', 'tombstones'], 'readwrite');
        tx.objectStore(storeName).delete(id);
        tx.objectStore('recycleBin').put(recycleEntry);
        tx.objectStore('tombstones').put(tombstone);
        tx.oncomplete = () => {
          this.broadcastChange(storeName, 'recycle', id);
          this.broadcastChange('recycleBin', 'add', recycleEntry.id);
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  public async restoreFromRecycleBin(storeOrId: string, maybeId?: string): Promise<boolean> {
    const db = await this.open();
    let storeName: string;
    let recordId: string;
    let binKey: string;

    if (maybeId) {
      storeName = storeOrId;
      recordId = maybeId;
      binKey = `${storeName}:${recordId}`;
    } else {
      binKey = storeOrId;
      const parts = storeOrId.split(':');
      storeName = parts[0];
      recordId = parts.slice(1).join(':');
    }

    const recycleItem = await this.get<RecycleBinItem>('recycleBin', binKey);
    if (!recycleItem) return false;

    const restoredData = { ...recycleItem.data };
    delete restoredData.inRecycleBin;
    delete restoredData.isDeleted;
    delete restoredData.deletedAt;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction([storeName, 'recycleBin', 'tombstones'], 'readwrite');
        tx.objectStore(storeName).put(restoredData);
        tx.objectStore('recycleBin').delete(binKey);
        tx.objectStore('tombstones').delete(binKey);
        tx.oncomplete = () => {
          this.broadcastChange(storeName, 'restore', recordId);
          this.broadcastChange('recycleBin', 'delete', binKey);
          if (storeName === 'finance') {
            this.reapplyFinanceTransactionEffect(restoredData).catch(console.error);
          }
          resolve(true);
        };
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  public async permanentlyDeleteFromRecycleBin(binId: string): Promise<boolean> {
    const recycleItem = await this.get<RecycleBinItem>('recycleBin', binId);
    if (!recycleItem) return false;
    const db = await this.open();
    return new Promise((resolve, reject) => {
      try {
        const stores = ['recycleBin', 'tombstones'];
        if (db.objectStoreNames.contains('attachments')) stores.push('attachments');
        const tx = db.transaction(stores, 'readwrite');
        tx.objectStore('recycleBin').delete(binId);
        const tombStore = tx.objectStore('tombstones');
        const req = tombStore.get(binId);
        req.onsuccess = () => {
          const tomb = req.result;
          const storeName = recycleItem.storeName;
          const recordId = recycleItem.recordId;
          if (tomb) {
            const { contentSignature: _contentSignature, ...minimalTombstone } = tomb;
            tombStore.put({ ...minimalTombstone, permanentlyDeleted: true, purgedAt: Date.now() });
          } else {
            tombStore.put({
              id: binId,
              storeName,
              recordId,
              profileId: recycleItem.profileId,
              deletedAt: Date.now(),
              purgedAt: Date.now(),
              permanentlyDeleted: true
            });
          }

          if (stores.includes('attachments')) {
            const attachmentIds = new Set(
              (Array.isArray(recycleItem.data?.attachments) ? recycleItem.data.attachments : [])
                .map((attachment: any) => {
                  if (typeof attachment !== 'string') return attachment?.id;
                  try {
                    return JSON.parse(attachment)?.id;
                  } catch {
                    return undefined;
                  }
                })
                .filter(Boolean)
            );
            const attachmentCursor = tx.objectStore('attachments').openCursor();
            attachmentCursor.onsuccess = () => {
              const cursor = attachmentCursor.result;
              if (!cursor) return;
              const attachment = cursor.value;
              if (
                this.belongsToProfile(attachment, recycleItem.profileId) &&
                (attachment.parentId === recordId || attachmentIds.has(attachment.id))
              ) {
                cursor.delete();
              }
              cursor.continue();
            };
          }
        };
        tx.oncomplete = () => {
          this.broadcastChange('recycleBin', 'delete', binId);
          this.broadcastChange('attachments', 'purge', binId);
          try {
            if (recycleItem.storeName === 'routines') {
              removeRoutineAlarmCacheEntries(recycleItem.profileId, new Set([recycleItem.recordId]));
            }
          } catch (error) {
            reject(new Error(`The record was deleted, but its linked routine alarm cache could not be cleared: ${error instanceof Error ? error.message : 'storage error'}`));
            return;
          }
          resolve(true);
        };
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  public async getRecycleBinItems(profileId?: string): Promise<RecycleBinItem[]> {
    const raw = await this.getAllRaw<RecycleBinItem>('recycleBin');
    const target = profileId || this.activeProfileId || 'om-master-profile';
    return raw.filter(item => item && this.belongsToProfile(item, target));
  }

  public async emptyRecycleBin(profileId?: string): Promise<number> {
    const db = await this.open();
    const target = profileId || this.activeProfileId || 'om-master-profile';
    const res = await permanentlyEmptyRecycleBin(db, ENTITY_STORES, target);
    this.broadcastChange('recycleBin', 'empty');
    return res.totalPurged;
  }

  // --------------------------------------------------------------------------
  // BACKUP & RESTORE PIPELINE
  // --------------------------------------------------------------------------

  public async exportFullAtomicBackup(): Promise<{
    blob: Blob;
    filename: string;
    recordCount: number;
    storesCount: number;
    sizeBytes: number;
  }> {
    const res = await universalDataManager.exportCanonicalBackup({
      profileId: this.activeProfileId,
      profileName: 'Primary Workspace',
      includeFullMedia: true
    });
    return {
      blob: res.blob,
      filename: res.filename,
      recordCount: res.payload.recordCount,
      storesCount: res.payload.storesCount,
      sizeBytes: res.sizeBytes
    };
  }

  public async exportFullBackup(): Promise<Blob> {
    const res = await this.exportFullAtomicBackup();
    return res.blob;
  }

  public async exportManualBackup(options: {
    profileId: string;
    profileName: string;
    includeFullMedia: boolean;
  }): Promise<{ blob: Blob; filename: string; metadata: any }> {
    const res = await universalDataManager.exportCanonicalBackup({
      profileId: options.profileId,
      profileName: options.profileName,
      includeFullMedia: options.includeFullMedia
    });
    return {
      blob: res.blob,
      filename: res.filename,
      metadata: {
        recordCount: res.payload.recordCount,
        includeFullMedia: options.includeFullMedia,
        sizeBytes: res.sizeBytes,
        savedBytes: 0,
        exportedAt: res.payload.exportedAt
      }
    };
  }

  public async inspectUpdateBundle(
    bundleOrJson: any,
    targetProfileId: string
  ): Promise<BundleDiffInspection> {
    const validation = await universalDataManager.validateImport(bundleOrJson, targetProfileId);
    if (!validation.valid || !validation.bundle) {
      return {
        valid: false,
        error: validation.error || 'Invalid file format. File is not an Om-LifeOS update bundle or backup.',
        bundle: {} as any,
        targetProfileId,
        totalIncoming: 0,
        addedCount: 0,
        updatedCount: 0,
        conflictsCount: 0,
        skippedCount: 0,
        storeCounts: {},
        conflicts: []
      };
    }
    return universalDataManager.inspectBundleDiff(validation.bundle, targetProfileId);
  }

  public async applyUpdateBundle(
    bundleOrOptions: any,
    maybeProfileId?: string,
    extraOptions?: any
  ): Promise<ApplyBundleResult> {
    let bundle: ManualUpdateBundle;
    let targetProfileId: string;
    let conflictStrategy: 'keep_local' | 'accept_remote' | 'keep_both' = 'keep_both';

    if (bundleOrOptions && typeof bundleOrOptions === 'object' && bundleOrOptions.bundle) {
      bundle = bundleOrOptions.bundle;
      targetProfileId = bundleOrOptions.targetProfileId || this.activeProfileId;
      conflictStrategy = bundleOrOptions.conflictStrategy || 'keep_both';
    } else {
      bundle = bundleOrOptions;
      targetProfileId = maybeProfileId || this.activeProfileId;
      conflictStrategy = extraOptions?.resolution || extraOptions?.conflictStrategy || 'keep_both';
    }

    return universalDataManager.applyUpdateBundle(bundle, targetProfileId, conflictStrategy);
  }

  public async restoreWorkspaceBackup(
    targetProfileId: string,
    payload: any
  ): Promise<{ success: boolean; restoredCount: number; storesRestored: number; blockedCount: number }> {
    const validation = await universalDataManager.validateImport(payload, targetProfileId);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid backup payload.');
    }
    const res = await universalDataManager.restoreValidatedData(validation, {
      mode: 'replace_workspace',
      targetProfileId,
      targetProfileName: 'Workspace'
    });
    this.broadcastChange('all', 'restoreWorkspaceBackup', targetProfileId);
    return {
      success: res.success,
      restoredCount: res.restoredRecordCount,
      storesRestored: res.storesRestored,
      blockedCount: res.blockedGhostCount
    };
  }

  public async importFullBackup(jsonString: string): Promise<{
    success: boolean;
    recordCount: number;
    storesRestored: number;
    blockedCount: number;
    restoredProfileId: string;
    restoredProfileName: string;
  }> {
    const validation = await universalDataManager.validateImport(jsonString, this.activeProfileId);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid JSON format in backup file.');
    }

    const targetProfileId = validation.workspaceId || this.activeProfileId || 'om-master-profile';
    const targetProfileName = validation.workspaceName || 'Primary Workspace';

    // Ensure this profile exists and is active in appSettings
    let settings = await this.getSingleton<AppState>('appSettings');
    if (!settings) {
      settings = await ensureDefaultProfiles();
    }
    const existingIndex = (settings.profiles || []).findIndex(p => p.id === targetProfileId);
    if (existingIndex >= 0) {
      settings.profiles = settings.profiles.map(p => ({
        ...p,
        isCurrent: p.id === targetProfileId,
        name: p.id === targetProfileId && targetProfileName ? targetProfileName : p.name
      }));
    } else {
      const now = Date.now();
      const newProf: UserProfile = {
        id: targetProfileId,
        name: targetProfileName,
        email: `${targetProfileName.toLowerCase().replace(/[^a-z0-9]/g, '')}@omlifeos.local`,
        role: 'Personal',
        authType: 'local',
        avatarChar: targetProfileName.trim().charAt(0).toUpperCase() || 'W',
        avatarColor: '#6366f1',
        isCurrent: true,
        createdAt: now
      };
      settings.profiles = [...(settings.profiles || []).map(p => ({ ...p, isCurrent: false })), newProf];
    }
    settings.profileId = targetProfileId;
    settings.currentUser = {
      name: targetProfileName,
      email: `${targetProfileName.toLowerCase().replace(/[^a-z0-9]/g, '')}@omlifeos.local`,
      provider: 'local'
    };
    await this.setSingleton('appSettings', settings);
    this.setActiveProfile(targetProfileId);

    const res = await universalDataManager.restoreValidatedData(validation, {
      mode: 'replace_workspace',
      targetProfileId,
      targetProfileName
    });

    this.broadcastChange('all', 'importFullBackup');
    return {
      success: res.success,
      recordCount: res.restoredRecordCount,
      storesRestored: res.storesRestored,
      blockedCount: res.blockedGhostCount,
      restoredProfileId: targetProfileId,
      restoredProfileName: targetProfileName
    };
  }

  public getLastExportCheckpoint(profileId: string): number {
    try {
      const val = localStorage.getItem(`om_export_checkpoint_${profileId}`);
      return val ? parseInt(val, 10) : 0;
    } catch {
      return 0;
    }
  }

  public setLastExportCheckpoint(profileId: string, timestamp: number): void {
    try {
      localStorage.setItem(`om_export_checkpoint_${profileId}`, String(timestamp));
    } catch {}
  }

  public getLastImportTimestamp(profileId: string): number {
    try {
      const val = localStorage.getItem(`om_last_import_at_${profileId}`);
      return val ? parseInt(val, 10) : 0;
    } catch {
      return 0;
    }
  }

  public setLastImportTimestamp(profileId: string, timestamp: number): void {
    try {
      localStorage.setItem(`om_last_import_at_${profileId}`, String(timestamp));
    } catch {}
  }

  public async calculateProfileStorageStats(profileId: string): Promise<{
    recordCount: number;
    textBytes: number;
    mediaBytes: number;
    totalBytes: number;
    attachmentCount: number;
    changedSinceCheckpoint: number;
    lastCheckpoint: number;
  }> {
    const lastCheckpoint = this.getLastExportCheckpoint(profileId);
    const entities: Record<string, any[]> = {};
    let changedSinceCheckpoint = 0;

    for (const storeName of ENTITY_STORES) {
      const allRows = await this.getAllRaw<any>(storeName);
      const profileRows = allRows.filter(r => r && this.belongsToProfile(r, profileId));
      entities[storeName] = profileRows;

      for (const row of profileRows) {
        const itemTime = Math.max(parseTimestampMs(row.updatedAt), parseTimestampMs(row.createdAt));
        if (itemTime > lastCheckpoint) {
          changedSinceCheckpoint++;
        }
      }
    }

    const breakdown = calculatePayloadBreakdown(entities);

    return {
      recordCount: breakdown.recordCount,
      textBytes: breakdown.textBytes,
      mediaBytes: breakdown.mediaBytes,
      totalBytes: breakdown.totalBytes,
      attachmentCount: breakdown.attachmentCount,
      changedSinceCheckpoint,
      lastCheckpoint
    };
  }

  public async getStorageEstimate(): Promise<{
    usage: number;
    quota: number;
    percent: number;
    level: string;
    available?: boolean;
  }> {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        const usage = est.usage || 0;
        const quota = est.quota || 0;
        const percent = quota > 0 ? (usage / quota) * 100 : 0;
        const level = percent > 90 ? 'critical' : percent > 75 ? 'warning' : 'healthy';
        return { usage, quota, percent, level, available: true };
      }
    } catch {}
    return { usage: 0, quota: 0, percent: 0, level: 'healthy', available: false };
  }

  public async performIntegrityAudit(): Promise<{ checked: number; issues: number; repaired: number }> {
    let checked = 0;
    let issues = 0;
    let repaired = 0;

    const [tasks, goals, routines] = await Promise.all([
      this.getAll<any>('tasks'),
      this.getAll<any>('goals'),
      this.getAll<any>('routines')
    ]);

    const goalIds = new Set(goals.map(g => g.id));
    const routineIds = new Set(routines.map(r => r.id));

    for (const t of tasks) {
      checked++;
      let modified = false;
      if (t.goalId && !goalIds.has(t.goalId)) {
        issues++;
        t.goalId = null;
        modified = true;
      }
      if (t.routineId && !routineIds.has(t.routineId)) {
        issues++;
        t.routineId = null;
        modified = true;
      }
      if (modified) {
        await this.put('tasks', t);
        repaired++;
      }
    }

    return { checked, issues, repaired };
  }

  public async auditIntegrity(): Promise<{ checked: number; issues: number; repaired: number }> {
    return this.performIntegrityAudit();
  }

  public async deleteProfileAndSettings(profileId: string, settings: AppState): Promise<void> {
    const db = await this.open();
    for (const storeName of ENTITY_STORES) {
      if (!db.objectStoreNames.contains(storeName)) continue;
      const rows = await this.getAllRaw<any>(storeName);
      const toDelete = rows.filter(r => r && r.profileId === profileId);
      if (toDelete.length > 0) {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          for (const item of toDelete) {
            store.delete(item.id);
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }
    }
    await this.setSingleton('appSettings', settings);
  }
}

export const storage = new StorageEngine();

// --------------------------------------------------------------------------
// WORKSPACE BASELINE DATA & RESET HELPERS
// --------------------------------------------------------------------------

export async function ensureDefaultProfiles(): Promise<AppState> {
  let settings = await storage.getSingleton<AppState>('appSettings');
  const now = Date.now();
  if (!settings) {
    settings = {
      profileId: 'om-master-profile',
      profiles: [
        {
          id: 'om-master-profile',
          name: 'Personal',
          email: 'master@omlifeos.local',
          role: 'Personal',
          authType: 'local',
          avatarChar: 'P',
          avatarColor: '#6366f1',
          isCurrent: true,
          createdAt: now
        }
      ],
      currentUser: {
        name: 'Personal',
        email: 'master@omlifeos.local',
        provider: 'local'
      },
      themeMode: 'light',
      accentColor: '#6366f1',
      notificationsEnabled: true,
      noteCategories: ['General', 'Strategy', 'Projects', 'Finance', 'Ideas'],
      calcFavorites: ['EMI / Loan', 'SIP / Investment', 'Date Difference']
    };
    await storage.setSingleton('appSettings', settings);
  }
  return settings;
}

export async function purgeAllDefaultDataPermanently(): Promise<{ success: boolean; purgedCount: number; storesAffected: string[] }> {
  let totalPurged = 0;
  const affectedStores: string[] = [];
  const profileId = storage.getActiveProfileId();
  const isGuestProfile = profileId === 'om-master-profile' || profileId === 'default';
  const belongsToProfile = (item: any) => item?.profileId === profileId ||
    (isGuestProfile && (!item?.profileId || item.profileId === 'om-master-profile' || item.profileId === 'default'));

  const KNOWN_SEED_TITLES = new Set([
    'define quarterly milestones and high-impact strategy',
    'review emergency fund & capital allocation',
    'evening wind-down & journal reflection',
    'morning clarity & movement',
    'deep work block 1 (high priority focus)',
    'morning meditation (15 min)',
    'drink 3 liters water',
    'build ₹50 lakh sovereign wealth reserve',
    'first principles of life architecture',
    'morning awakening & routine',
    'evening reflection & shutdown'
  ]);

  const isSeedRecord = (item: any): boolean => {
    if (!item || typeof item !== 'object') return false;
    const id = String(item.id || item.originalId || '');
    if (id.startsWith('seed-') || id.startsWith('default-')) return true;

    const title = String(item.title || item.name || item.label || '').toLowerCase().trim();
    if (title && KNOWN_SEED_TITLES.has(title)) return true;

    // Check embedded record in recycle bin or tombstones
    if (item.record && typeof item.record === 'object') {
      const recId = String(item.record.id || '');
      if (recId.startsWith('seed-') || recId.startsWith('default-')) return true;
      const recTitle = String(item.record.title || item.record.name || item.record.label || '').toLowerCase().trim();
      if (recTitle && KNOWN_SEED_TITLES.has(recTitle)) return true;
    }

    return false;
  };

  const db = await storage.open();
  const allStoreNames = Array.from(db.objectStoreNames);

  for (const storeName of allStoreNames) {
    if (storeName === 'appSettings') continue;

    const keysToDelete: IDBValidKey[] = [];
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).openCursor();
      req.onsuccess = (e: any) => {
        const cursor = e.target.result;
        if (cursor) {
          const val = cursor.value;
          const isProfileScoped = ENTITY_STORES.includes(storeName) || storeName === 'recycleBin' || storeName === 'tombstones';
          if ((!isProfileScoped || belongsToProfile(val)) && isSeedRecord(val)) {
            keysToDelete.push(cursor.key);
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => reject(req.error || new Error(`Failed to scan ${storeName}.`));
      tx.onerror = () => reject(tx.error || new Error(`Failed to scan ${storeName}.`));
    });

    if (keysToDelete.length > 0) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        for (const key of keysToDelete) store.delete(key);
        tx.oncomplete = () => {
          totalPurged += keysToDelete.length;
          affectedStores.push(storeName);
          resolve();
        };
        tx.onerror = () => reject(tx.error || new Error(`Failed to remove default records from ${storeName}.`));
        tx.onabort = () => reject(tx.error || new Error(`Removing default records from ${storeName} was aborted.`));
      });
    }
  }

  // Also clean focus alarms in localStorage
  if (typeof localStorage !== 'undefined') {
    const profileId = storage.getActiveProfileId();
    const key = `om_focus_alarms_list:${profileId}`;
    const rawAlarms = localStorage.getItem(key) ||
      (profileId === 'om-master-profile' ? localStorage.getItem('om_focus_alarms_list') : null);
    if (rawAlarms) {
      const parsed = JSON.parse(rawAlarms);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((a: any) => !isSeedRecord(a));
        if (cleaned.length !== parsed.length) {
          totalPurged += (parsed.length - cleaned.length);
          if (!affectedStores.includes('localStorage:focusAlarms')) {
            affectedStores.push('localStorage:focusAlarms');
          }
        }
        localStorage.setItem(key, JSON.stringify(cleaned));
      }
    }
  }

  // Broadcast cross-tab and cross-component update
  storage.broadcastChange('all', 'purgeDefaultData');

  return { success: true, purgedCount: totalPurged, storesAffected: affectedStores };
}

export async function seedInitialDataIfEmpty(): Promise<boolean> {
  const existingSettings = await storage.getSingleton<AppState>('appSettings');
  if (!existingSettings) {
    await ensureDefaultProfiles();
  }
  return false;
}

/**
 * Clears orphaned attachments, temporary files, browser cache storage, and Service Worker caches
 * WITHOUT touching active workspace records or un-purged Recycle Bin items.
 * If emptyRecycleBinFirst is true, it permanently empties the Recycle Bin first, then purges all
 * associated media and browser cache.
 */
export async function cleanOrphanedCacheAndTrash(options?: {
  emptyRecycleBinFirst?: boolean;
  profileId?: string;
  clearBrowserCaches?: boolean;
}): Promise<{
  purgedRecycleCount: number;
  purgedOrphanedAttachments: number;
  clearedCacheKeys: number;
}> {
  let purgedRecycleCount = 0;
  let purgedOrphanedAttachments = 0;
  let clearedCacheKeys = 0;
  const db = await storage.open();
  const profileId = options?.profileId || storage.getActiveProfileId();

  if (options?.emptyRecycleBinFirst) {
    const emptyRes = await permanentlyEmptyRecycleBin(db, ENTITY_STORES, profileId);
    purgedRecycleCount = emptyRes.totalPurged;
  }

  if (db.objectStoreNames.contains('attachments')) {
    const isGuest = profileId === 'om-master-profile' || profileId === 'default';
    const belongsToProfile = (item: any) =>
      item?.profileId === profileId ||
      (isGuest && (!item?.profileId || item.profileId === 'om-master-profile' || item.profileId === 'default'));
    const retainedParentIds = new Set<string>();

    for (const storeName of ENTITY_STORES.filter(name => name !== 'attachments')) {
      if (!db.objectStoreNames.contains(storeName)) continue;
      const records = await storage.getAllRaw<any>(storeName);
      for (const record of records) {
        if (record?.id && belongsToProfile(record) && isRecordActive(record)) {
          retainedParentIds.add(record.id);
        }
      }
    }

    if (!options?.emptyRecycleBinFirst && db.objectStoreNames.contains('recycleBin')) {
      const recycleItems = await storage.getRecycleBinItems(profileId);
      recycleItems.forEach(item => retainedParentIds.add(item.recordId));
    }

    const activeRoutineIds = new Set(
      (await storage.getAllRaw<any>('routines'))
        .filter(item => belongsToProfile(item) && isRecordActive(item))
        .map(item => item.id)
    );
    if (!options?.emptyRecycleBinFirst && db.objectStoreNames.contains('recycleBin')) {
      const recycleItems = await storage.getRecycleBinItems(profileId);
      recycleItems
        .filter(item => item.storeName === 'routines')
        .forEach(item => activeRoutineIds.add(item.recordId));
    }
    pruneOrphanedRoutineAlarmCache(profileId, activeRoutineIds);

    const attachments = (await storage.getAllRaw<any>('attachments')).filter(belongsToProfile);
    const orphanedIds = attachments
      .filter(item => item?.id && (!item.parentId || !retainedParentIds.has(item.parentId)))
      .map(item => item.id);

    if (orphanedIds.length > 0) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('attachments', 'readwrite');
        const store = tx.objectStore('attachments');
        for (const id of orphanedIds) store.delete(id);
        tx.oncomplete = () => {
          purgedOrphanedAttachments = orphanedIds.length;
          resolve();
        };
        tx.onerror = () => reject(tx.error || new Error('Failed to delete orphaned attachment data.'));
        tx.onabort = () => reject(tx.error || new Error('Orphaned attachment cleanup was aborted.'));
      });
    }
  }

  storage.broadcastChange('all', 'cleanCacheAndTrash');

  if (options?.clearBrowserCaches !== false && typeof window !== 'undefined' && 'caches' in window) {
    const cacheNames = await caches.keys();
    for (const cacheName of cacheNames) {
      if (!await caches.delete(cacheName)) {
        throw new Error(`Failed to delete browser cache "${cacheName}".`);
      }
      clearedCacheKeys++;
    }
  }

  return {
    purgedRecycleCount,
    purgedOrphanedAttachments,
    clearedCacheKeys
  };
}

export async function performHardAppReset(): Promise<void> {
  storage.close();

  if (typeof indexedDB !== 'undefined' && indexedDB.deleteDatabase) {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('Failed to delete the local database.'));
      req.onblocked = () => reject(new Error('Close other Om LifeOS tabs, then retry the database reset.'));
    });
  }

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      if (!await registration.unregister()) {
        throw new Error('Failed to unregister a service worker during database reset.');
      }
    }
  }

  if (typeof window !== 'undefined' && 'caches' in window) {
    const cacheNames = await caches.keys();
    for (const cacheName of cacheNames) {
      if (!await caches.delete(cacheName)) {
        throw new Error(`Failed to delete browser cache "${cacheName}" during database reset.`);
      }
    }
  }

  if (typeof localStorage !== 'undefined') {
    const pendingDrivePurges: Array<[string, string]> = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith('om_gdrive_backup_purge_pending:')) {
        const value = localStorage.getItem(key);
        if (value === 'true') pendingDrivePurges.push([key, value]);
      }
    }
    localStorage.clear();
    for (const [key, value] of pendingDrivePurges) localStorage.setItem(key, value);
  }
  if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
  if (typeof window !== 'undefined') window.location.reload();
}
