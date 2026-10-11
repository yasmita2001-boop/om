/**
 * storage.ts
 *
 * Consolidated Repository & Storage Engine for Om-LifeOS.
 * - Single source of truth for all 54 entity stores, singletons, and system stores.
 * - Logically separated database schema (db.ts), profile security (profileSecurity.ts),
 *   recycle bin & soft deletion (recycleBin.ts), exports (exportManager.ts), and imports (importManager.ts).
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
  PROFESSIONAL_SECURITY_QUESTIONS, PasswordValidationResult, ProfileCredentialRecord,
  ProfileSecurityStoreRecord, validatePasswordStrength, validateSecurityQuestionAndAnswer,
  bytesToBase64, base64ToBytes, createSalt, deriveCredentialHash
} from './profileSecurity';

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

// Re-export core constants and types for genuine consumers
export {
  DB_NAME, DB_VERSION, ENTITY_STORES, SINGLETON_STORES, SYSTEM_STORES,
  TRANSIENT_RECYCLE_SKIP_STORES, SYSTEM_METADATA_STORES, STORE_LABELS,
  generateUUID, parseTimestampMs, computeRecordSignature, describeDeletedRecord,
  PROFESSIONAL_SECURITY_QUESTIONS, validatePasswordStrength, validateSecurityQuestionAndAnswer,
  isRecordActive, isRecordDeleted, filterActiveRecords, permanentlyEmptyRecycleBin,
  sanitizeWorkspacePayload, downloadBlob,
  universalDataManager, UniversalDataManager, SUPPORTED_EXPORT_FORMATS
};
export type {
  DeletionTombstone, PasswordValidationResult, ProfileCredentialRecord,
  UniversalExportFormat, UniversalBackupPayload, UniversalValidationResult,
  UniversalRestoreOptions, UniversalRestoreResult
};

class StorageEngine {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private channel: BroadcastChannel | null = null;
  private changeListeners: Set<(store: string, action: string, id?: string) => void> = new Set();
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

  public getAllStoreNames(): string[] {
    if (this.db) {
      return Array.from(this.db.objectStoreNames);
    }
    return Array.from(new Set([...ENTITY_STORES, ...SINGLETON_STORES, ...SYSTEM_STORES]));
  }

  private withActiveProfile<T extends { id: string }>(storeName: string, item: T): T {
    if (SINGLETON_STORES.includes(storeName) || SYSTEM_STORES.includes(storeName)) return item;
    const targetProfileId = (item as any).profileId || this.activeProfileId || 'om-master-profile';
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
        if (db.objectStoreNames.contains('tombstones')) {
          try {
            const clrTx = db.transaction('tombstones', 'readwrite');
            clrTx.objectStore('tombstones').clear();
          } catch {}
        }
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
        req.onsuccess = () => resolve(req.result || null);
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
          if (SINGLETON_STORES.includes(storeName) || SYSTEM_STORES.includes(storeName)) {
            return resolve(results);
          }
          const target = profileId || this.activeProfileId || 'om-master-profile';
          const filtered = results.filter((item: any) => {
            if (!item) return false;
            if (!isRecordActive(item)) return false;
            if (!item.profileId || !target) return true;
            if (target === 'om-master-profile' || target === 'default') {
              return item.profileId === 'om-master-profile' || item.profileId === 'default' || !item.profileId;
            }
            return item.profileId === target;
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

  public async getSingleton<T>(storeName: string): Promise<T | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get('root');
        req.onsuccess = () => {
          const item = req.result;
          resolve(item ? item.value : null);
        };
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  public async setSingleton<T>(storeName: string, value: T): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put({ id: 'root', value });
        req.onsuccess = () => {
          this.broadcastChange(storeName, 'set', 'root');
          resolve();
        };
        req.onerror = () => reject(req.error);
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
    const db = await this.open();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        for (const item of items) {
          store.put(this.withActiveProfile(storeName, item));
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
        const req = store.clear();
        req.onsuccess = () => {
          this.broadcastChange(storeName, 'clear');
          resolve();
        };
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  public async atomicPutMany(items: { storeName: string; item: any }[]): Promise<void> {
    if (!items.length) return;
    const db = await this.open();
    const storeNames = Array.from(new Set(items.map(i => i.storeName)));
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeNames, 'readwrite');
        for (const { storeName, item } of items) {
          const prepared = this.withActiveProfile(storeName, item);
          tx.objectStore(storeName).put(prepared);
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
    if (!profileId) return;
    const db = await this.open();
    for (const storeName of ENTITY_STORES) {
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
    const db = await this.open();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(['recycleBin', 'tombstones'], 'readwrite');
        tx.objectStore('recycleBin').delete(binId);
        const tombStore = tx.objectStore('tombstones');
        const req = tombStore.get(binId);
        req.onsuccess = () => {
          const tomb = req.result;
          if (tomb) {
            tombStore.put({ ...tomb, permanentlyDeleted: true });
          }
        };
        tx.oncomplete = () => {
          this.broadcastChange('recycleBin', 'delete', binId);
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
    return raw.filter(item => {
      if (!item) return false;
      if (!item.profileId || !target) return true;
      if (target === 'om-master-profile' || target === 'default') {
        return item.profileId === 'om-master-profile' || item.profileId === 'default' || !item.profileId;
      }
      return item.profileId === target;
    });
  }

  public async emptyRecycleBin(profileId?: string): Promise<number> {
    const db = await this.open();
    const res = await permanentlyEmptyRecycleBin(db, ENTITY_STORES, profileId);
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

    try {
      sessionStorage.setItem('om_session_unlocked', targetProfileId);
      localStorage.setItem('om_unlocked_profile', targetProfileId);
    } catch {}

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
      const profileRows = allRows.filter(r => {
        if (!r) return false;
        if (!r.profileId || !profileId) return true;
        if (profileId === 'om-master-profile' || profileId === 'default') {
          return r.profileId === 'om-master-profile' || r.profileId === 'default' || !r.profileId;
        }
        return r.profileId === profileId;
      });
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

  // --------------------------------------------------------------------------
  // PROFILE CREDENTIAL MANAGEMENT HELPERS
  // --------------------------------------------------------------------------

  public async getProfileSecurityRecord(): Promise<ProfileSecurityStoreRecord> {
    const record = await this.getSingleton<ProfileSecurityStoreRecord>('profileSecurity');
    if (record && typeof record === 'object' && record.profiles) {
      return record;
    }
    return { id: 'root', profiles: {} };
  }

  public async resolveProfileCredentials(profileId: string): Promise<ProfileCredentialRecord | null> {
    const sec = await this.getProfileSecurityRecord();
    return sec.profiles[profileId] || null;
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
// PROFILE SECURITY CONSOLIDATED FUNCTIONS
// --------------------------------------------------------------------------

export async function setProfileCredentials(
  profileId: string,
  password: string,
  passwordHint: string,
  recoveryQuestion: string,
  recoveryAnswer: string
): Promise<void> {
  const passVal = validatePasswordStrength(password);
  if (!passVal.isValid) throw new Error(passVal.errorMessage);
  const qaVal = validateSecurityQuestionAndAnswer(recoveryQuestion, recoveryAnswer, password);
  if (!qaVal.isValid) throw new Error(qaVal.errorMessage);
  if (!passwordHint.trim()) throw new Error('Password hint is required.');
  if (passwordHint.toLowerCase().includes(password.toLowerCase())) {
    throw new Error('Password hint cannot contain the password itself.');
  }

  const settings = await storage.getSingleton<AppState>('appSettings');
  const profile = settings?.profiles?.find(p => p.id === profileId);
  if (!settings || !profile) throw new Error('Profile not found.');

  const passwordSalt = createSalt();
  const recoverySalt = createSalt();
  const credentialRecord: ProfileCredentialRecord = {
    passwordHash: await deriveCredentialHash(password, passwordSalt),
    passwordSalt: bytesToBase64(passwordSalt),
    passwordHint: passwordHint.trim(),
    recoveryQuestion: recoveryQuestion.trim(),
    recoveryAnswerHash: await deriveCredentialHash(recoveryAnswer.trim().toLowerCase(), recoverySalt),
    recoveryAnswerSalt: bytesToBase64(recoverySalt)
  };

  const updatedProfile: UserProfile = {
    ...profile,
    passwordHash: credentialRecord.passwordHash,
    passwordSalt: credentialRecord.passwordSalt,
    passwordHint: credentialRecord.passwordHint,
    recoveryQuestion: credentialRecord.recoveryQuestion,
    recoveryAnswerHash: credentialRecord.recoveryAnswerHash,
    recoveryAnswerSalt: credentialRecord.recoveryAnswerSalt
  };
  const nextSettings: AppState = {
    ...settings,
    profiles: settings.profiles.map(p => p.id === profileId ? updatedProfile : p)
  };

  const security = await storage.getProfileSecurityRecord();
  security.profiles[profileId] = credentialRecord;
  await storage.atomicPutMany([
    { storeName: 'appSettings', item: { id: 'root', value: nextSettings } },
    { storeName: 'profileSecurity', item: { id: 'root', value: security } }
  ]);
}

export async function createLocalProfile(
  settings: AppState,
  profile: UserProfile,
  password?: string,
  passwordHint?: string,
  recoveryQuestion?: string,
  recoveryAnswer?: string
): Promise<void> {
  const hasPassword = Boolean(password && password.trim());
  let credentialRecord: ProfileCredentialRecord | null = null;

  if (hasPassword) {
    const cleanPass = password!.trim();
    const passVal = validatePasswordStrength(cleanPass);
    if (!passVal.isValid) throw new Error(passVal.errorMessage);
    const cleanHint = (passwordHint || '').trim();
    const cleanQ = (recoveryQuestion || PROFESSIONAL_SECURITY_QUESTIONS[0]).trim();
    const cleanA = (recoveryAnswer || '').trim();

    if (!cleanHint) throw new Error('Password hint is required when setting a password.');
    if (cleanHint.toLowerCase().includes(cleanPass.toLowerCase())) {
      throw new Error('Password hint cannot contain the password itself.');
    }
    const qaVal = validateSecurityQuestionAndAnswer(cleanQ, cleanA, cleanPass);
    if (!qaVal.isValid) throw new Error(qaVal.errorMessage);

    const passwordSalt = createSalt();
    const recoverySalt = createSalt();
    credentialRecord = {
      passwordHash: await deriveCredentialHash(cleanPass, passwordSalt),
      passwordSalt: bytesToBase64(passwordSalt),
      passwordHint: cleanHint,
      recoveryQuestion: cleanQ,
      recoveryAnswerHash: await deriveCredentialHash(cleanA.toLowerCase(), recoverySalt),
      recoveryAnswerSalt: bytesToBase64(recoverySalt)
    };
  }

  const credentialedProfile: UserProfile = {
    ...profile,
    authType: 'local',
    isCurrent: true,
    ...(credentialRecord ? {
      passwordHash: credentialRecord.passwordHash,
      passwordSalt: credentialRecord.passwordSalt,
      passwordHint: credentialRecord.passwordHint,
      recoveryQuestion: credentialRecord.recoveryQuestion,
      recoveryAnswerHash: credentialRecord.recoveryAnswerHash,
      recoveryAnswerSalt: credentialRecord.recoveryAnswerSalt
    } : {})
  };
  const nextSettings: AppState = {
    ...settings,
    profileId: credentialedProfile.id,
    profiles: [...(settings.profiles || []).map(p => ({ ...p, isCurrent: false })), credentialedProfile],
    currentUser: { name: credentialedProfile.name, email: credentialedProfile.email, provider: 'local' }
  };
  const atomicItems: { storeName: string; item: any }[] = [
    { storeName: 'appSettings', item: { id: 'root', value: nextSettings } }
  ];
  if (credentialRecord) {
    const security = await storage.getProfileSecurityRecord();
    security.profiles[profile.id] = credentialRecord;
    atomicItems.push({ storeName: 'profileSecurity', item: { id: 'root', value: security } });
  }
  await storage.atomicPutMany(atomicItems);
}

export async function removeProfilePassword(profileId: string): Promise<AppState> {
  const settings = await storage.getSingleton<AppState>('appSettings');
  if (!settings) throw new Error('App settings not found.');
  const profile = settings.profiles?.find(p => p.id === profileId);
  if (!profile) throw new Error('Profile not found.');

  const updatedProfile: UserProfile = { ...profile };
  delete updatedProfile.passwordHash;
  delete updatedProfile.passwordSalt;
  delete updatedProfile.passwordHint;
  delete updatedProfile.recoveryQuestion;
  delete updatedProfile.recoveryAnswerHash;
  delete updatedProfile.recoveryAnswerSalt;

  const nextSettings: AppState = {
    ...settings,
    profiles: (settings.profiles || []).map(p => p.id === profileId ? updatedProfile : p)
  };

  const security = await storage.getProfileSecurityRecord();
  if (security.profiles[profileId]) {
    delete security.profiles[profileId];
  }

  await storage.atomicPutMany([
    { storeName: 'appSettings', item: { id: 'root', value: nextSettings } },
    { storeName: 'profileSecurity', item: { id: 'root', value: security } }
  ]);
  return nextSettings;
}

export async function resetProfilePassword(profileId: string, password: string, passwordHint: string): Promise<void> {
  const passVal = validatePasswordStrength(password);
  if (!passVal.isValid) throw new Error(passVal.errorMessage);
  if (!passwordHint.trim()) throw new Error('Password hint is required.');
  if (passwordHint.toLowerCase().includes(password.toLowerCase())) {
    throw new Error('Password hint cannot contain the password itself.');
  }
  const settings = await storage.getSingleton<AppState>('appSettings');
  const profile = settings?.profiles?.find(p => p.id === profileId);
  if (!settings || !profile) throw new Error('Profile not found.');
  const existing = await storage.resolveProfileCredentials(profileId);
  if (!existing) throw new Error('Profile recovery data is unavailable.');

  const passwordSalt = createSalt();
  const passwordHash = await deriveCredentialHash(password, passwordSalt);
  const updatedProfile: UserProfile = {
    ...profile,
    passwordSalt: bytesToBase64(passwordSalt),
    passwordHash,
    passwordHint: passwordHint.trim()
  };
  const nextSettings: AppState = {
    ...settings,
    profiles: settings.profiles.map(p => p.id === profileId ? updatedProfile : p)
  };
  const security = await storage.getProfileSecurityRecord();
  security.profiles[profileId] = {
    ...existing,
    passwordHash,
    passwordSalt: updatedProfile.passwordSalt!,
    passwordHint: updatedProfile.passwordHint || ''
  };
  await storage.atomicPutMany([
    { storeName: 'appSettings', item: { id: 'root', value: nextSettings } },
    { storeName: 'profileSecurity', item: { id: 'root', value: security } }
  ]);
}

export async function verifyProfilePassword(profileId: string, password: string): Promise<boolean> {
  const record = await storage.resolveProfileCredentials(profileId);
  if (!record?.passwordHash || !record.passwordSalt) return false;
  const candidate = await deriveCredentialHash(password, base64ToBytes(record.passwordSalt));
  return candidate === record.passwordHash;
}

export async function verifyProfileRecoveryAnswer(profileId: string, answer: string): Promise<boolean> {
  const record = await storage.resolveProfileCredentials(profileId);
  if (!record?.recoveryAnswerHash || !record.recoveryAnswerSalt) return false;
  const candidate = await deriveCredentialHash(answer.trim().toLowerCase(), base64ToBytes(record.recoveryAnswerSalt));
  return candidate === record.recoveryAnswerHash;
}

export async function getProfileSecurityInfo(
  profileId: string
): Promise<(Pick<UserProfile, 'passwordHint' | 'recoveryQuestion'> & { credentialsReady: boolean }) | null> {
  const settings = await storage.getSingleton<AppState>('appSettings');
  const profile = settings?.profiles?.find(p => p.id === profileId);
  if (!profile) return null;
  const record = await storage.resolveProfileCredentials(profileId);
  return {
    passwordHint: record?.passwordHint || profile.passwordHint || '',
    recoveryQuestion: record?.recoveryQuestion || profile.recoveryQuestion || '',
    credentialsReady: Boolean(record)
  };
}

export async function deleteLocalProfile(profileId: string): Promise<AppState> {
  const settings = await storage.getSingleton<AppState>('appSettings');
  if (!settings?.profiles?.length) throw new Error('No profiles exist.');
  if (settings.profiles.length <= 1) throw new Error('At least one local profile must remain.');
  const deletingCurrent = settings.profileId === profileId;
  settings.profiles = settings.profiles.filter(p => p.id !== profileId);
  if (!settings.profiles.length) throw new Error('At least one local profile must remain.');
  if (deletingCurrent) {
    const next = settings.profiles[0];
    settings.profileId = next.id;
    settings.profiles = settings.profiles.map(p => ({ ...p, isCurrent: p.id === next.id }));
    settings.currentUser = { name: next.name, email: next.email, provider: 'local' };
  }

  const security = await storage.getProfileSecurityRecord();
  delete security.profiles[profileId];

  await storage.atomicPutMany([
    { storeName: 'appSettings', item: { id: 'root', value: settings } },
    { storeName: 'profileSecurity', item: { id: 'root', value: security } }
  ]);
  return settings;
}

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
          name: 'Primary Workspace',
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
        name: 'Primary Workspace',
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

  try {
    const db = await storage.open();
    const allStoreNames = Array.from(db.objectStoreNames);

    for (const storeName of allStoreNames) {
      if (storeName === 'appSettings' || storeName === 'profileSecurity') {
        continue;
      }

      try {
        const keysToDelete: IDBValidKey[] = [];
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(storeName, 'readonly');
          const st = tx.objectStore(storeName);
          const req = st.openCursor();
          req.onsuccess = (e: any) => {
            const cursor = e.target.result;
            if (cursor) {
              const val = cursor.value;
              if (isSeedRecord(val)) {
                keysToDelete.push(cursor.key);
              }
              cursor.continue();
            } else {
              resolve();
            }
          };
          req.onerror = () => reject(req.error);
        });

        if (keysToDelete.length > 0) {
          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const st = tx.objectStore(storeName);
            for (const key of keysToDelete) {
              st.delete(key);
            }
            tx.oncomplete = () => {
              totalPurged += keysToDelete.length;
              affectedStores.push(storeName);
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          });
        }
      } catch (err) {
        console.warn(`[purgeAllDefaultDataPermanently] Error scanning ${storeName}:`, err);
      }
    }
  } catch (err) {
    console.warn('[purgeAllDefaultDataPermanently] Database connection notice:', err);
  }

  // Also clean focus alarms in localStorage
  try {
    const rawAlarms = localStorage.getItem('om_focus_alarms_list');
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
        localStorage.setItem('om_focus_alarms_list', JSON.stringify(cleaned));
      }
    }
  } catch {}

  // Broadcast cross-tab and cross-component update
  storage.broadcastChange('all', 'purgeDefaultData');

  return { success: true, purgedCount: totalPurged, storesAffected: affectedStores };
}

export async function seedInitialDataIfEmpty(): Promise<boolean> {
  const existingSettings = await storage.getSingleton<AppState>('appSettings');
  if (!existingSettings) {
    await ensureDefaultProfiles();
  }
  // Guarantee zero default or seed records exist in the database or local storage
  await purgeAllDefaultDataPermanently();
  return false;
}

export async function restoreDefaultWorkspaceData(
  _targetProfileId: string = 'om-master-profile'
): Promise<{ success: boolean; restoredCount: number }> {
  // All default data sources have been permanently decommissioned.
  // Performs a clean purge instead of injecting demo data.
  const purgeResult = await purgeAllDefaultDataPermanently();
  return { success: true, restoredCount: 0 };
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
}): Promise<{
  purgedRecycleCount: number;
  purgedOrphanedAttachments: number;
  clearedCacheKeys: number;
}> {
  let purgedRecycleCount = 0;
  let purgedOrphanedAttachments = 0;
  let clearedCacheKeys = 0;

  try {
    const db = await storage.open();

    // 1. If requested, permanently empty Recycle Bin
    if (options?.emptyRecycleBinFirst) {
      const emptyRes = await permanentlyEmptyRecycleBin(db, ENTITY_STORES, options?.profileId);
      purgedRecycleCount = emptyRes.totalPurged;
    }

    // 2. Scan attachments store for orphaned records (where parent record was permanently deleted)
    if (db.objectStoreNames.contains('attachments')) {
      try {
        const allAttachments = await storage.getAllRaw<any>('attachments');
        if (allAttachments.length > 0) {
          // Gather all active record IDs across all entity stores
          const activeEntityIds = new Set<string>();
          for (const sName of ['notes', 'journal', 'things', 'receipts', 'documents', 'tasks', 'finance']) {
            if (db.objectStoreNames.contains(sName)) {
              try {
                const records = await storage.getAllRaw<any>(sName);
                records.forEach(r => {
                  if (r && r.id && !r.inRecycleBin && !r.isDeleted) {
                    activeEntityIds.add(r.id);
                  }
                });
              } catch {}
            }
          }

          // Orphaned attachments have no living parent entity
          const orphanedIds = allAttachments
            .filter(att => att && att.id && att.parentId && !activeEntityIds.has(att.parentId))
            .map(att => att.id);

          if (orphanedIds.length > 0) {
            await new Promise<void>((resolve) => {
              const tx = db.transaction('attachments', 'readwrite');
              const os = tx.objectStore('attachments');
              for (const id of orphanedIds) {
                os.delete(id);
              }
              tx.oncomplete = () => {
                purgedOrphanedAttachments = orphanedIds.length;
                resolve();
              };
              tx.onerror = () => resolve();
            });
          }
        }
      } catch (err) {
        console.warn('[cleanOrphanedCacheAndTrash] Error checking attachments:', err);
      }
    }

    // 3. Purge browser Cache Storage
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const keys = await caches.keys();
        for (const k of keys) {
          await caches.delete(k).catch(() => {});
          clearedCacheKeys++;
        }
      } catch {}
    }

    // 4. Send message to Service Worker to wipe internal caches
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
      try {
        navigator.serviceWorker.controller.postMessage({ action: 'CLEAR_ALL_CACHES' });
      } catch {}
    }

    storage.broadcastChange('all', 'cleanCacheAndTrash');
  } catch (err) {
    console.warn('[cleanOrphanedCacheAndTrash] Error during cleanup:', err);
  }

  return {
    purgedRecycleCount,
    purgedOrphanedAttachments,
    clearedCacheKeys
  };
}

export async function performHardAppReset(): Promise<void> {
  try {
    storage.close();
  } catch {}

  // 1. Notify Service Worker to clear all caches first
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ action: 'CLEAR_ALL_CACHES' });
      }
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister().catch(() => {});
      }
    }
  } catch {}

  // 2. Clear all Cache Storage instances
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      const keys = await caches.keys();
      for (const k of keys) {
        await caches.delete(k).catch(() => {});
      }
    }
  } catch {}

  // 3. Clear IndexedDB directly by clearing object stores before database deletion
  try {
    const dbReq = indexedDB.open(DB_NAME);
    await new Promise<void>((resolve) => {
      dbReq.onsuccess = () => {
        const db = dbReq.result;
        try {
          const storeNames = Array.from(db.objectStoreNames);
          if (storeNames.length > 0) {
            const tx = db.transaction(storeNames, 'readwrite');
            storeNames.forEach(name => {
              try { tx.objectStore(name).clear(); } catch {}
            });
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => {
              db.close();
              resolve();
            };
          } else {
            db.close();
            resolve();
          }
        } catch {
          db.close();
          resolve();
        }
      };
      dbReq.onerror = () => resolve();
    });
  } catch {}

  // 4. Delete the database
  try {
    if (typeof indexedDB !== 'undefined' && indexedDB.deleteDatabase) {
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
        setTimeout(resolve, 800);
      });
    }
  } catch {}

  // 5. Clear localStorage & sessionStorage
  try {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
  } catch {}

  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}
