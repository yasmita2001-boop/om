// Local-First Sovereign Storage Engine for Om-LifeOS
import {
  Task, Routine, Habit, HabitLog, Goal, FocusSession,
  FocusAlarm, Note, JournalEntry, FinanceAccount, FinanceTransaction,
  Loan, Investment, SavingsPlan, HealthMeasurement, SleepRecord,
  WaterRecord, AppState, UserProfile, DailyPlanner
} from '../types';

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const DB_NAME = 'om-lifeos-db-v5';
const DB_VERSION = 2;
const STORE_NAMES = [
  'tasks', 'taskTemplates', 'routines', 'habits', 'habitLogs', 'goals',
  'focus', 'focusAlarms', 'notes', 'journal', 'finance', 'financeAccounts',
  'loans', 'investments', 'savingsPlans', 'healthMeasurements', 'sleepRecords',
  'waterRecords', 'workouts', 'calcHistory', 'dailyPlannerArchive', 'appSettings'
];

class StorageEngine {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private memoryCache: Map<string, Map<string, any>> = new Map();
  private subscribers = new Set<(storeName?: string) => void>();

  constructor() {
    STORE_NAMES.forEach(name => this.memoryCache.set(name, new Map()));
  }

  public subscribe(callback: (storeName?: string) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notify(storeName?: string) {
    this.subscribers.forEach(cb => {
      try {
        cb(storeName);
      } catch {}
    });
  }

  private async openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB not available'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        STORE_NAMES.forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.dbPromise;
  }

  public async getAll<T>(storeName: string): Promise<T[]> {
    try {
      const db = await this.openDB();
      return new Promise<T[]>((resolve) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve(Array.from(this.memoryCache.get(storeName)?.values() || []));
      });
    } catch {
      try {
        const raw = localStorage.getItem(`om_store_${storeName}`);
        if (raw) return JSON.parse(raw);
      } catch {}
      return Array.from(this.memoryCache.get(storeName)?.values() || []);
    }
  }

  public async get<T>(storeName: string, id: string): Promise<T | null> {
    try {
      const db = await this.openDB();
      return new Promise<T | null>((resolve) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      const items = await this.getAll<any>(storeName);
      return items.find(i => i.id === id) || null;
    }
  }

  public async put<T extends { id: string }>(storeName: string, item: T): Promise<T> {
    try {
      const db = await this.openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).put(item);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      try {
        const current = await this.getAll<any>(storeName);
        const idx = current.findIndex(x => x.id === item.id);
        if (idx !== -1) current[idx] = item;
        else current.push(item);
        localStorage.setItem(`om_store_${storeName}`, JSON.stringify(current));
      } catch {}
    }
    this.memoryCache.get(storeName)?.set(item.id, item);
    this.notify(storeName);
    return item;
  }

  public async bulkPut<T extends { id: string }>(storeName: string, items: T[]): Promise<void> {
    if (!items.length) return;
    try {
      const db = await this.openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        items.forEach(it => store.put(it));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      try {
        const current = await this.getAll<any>(storeName);
        const map = new Map(current.map(x => [x.id, x]));
        items.forEach(it => map.set(it.id, it));
        localStorage.setItem(`om_store_${storeName}`, JSON.stringify(Array.from(map.values())));
      } catch {}
    }
    const mem = this.memoryCache.get(storeName);
    items.forEach(it => mem?.set(it.id, it));
    this.notify(storeName);
  }

  public async delete(storeName: string, id: string): Promise<void> {
    try {
      const db = await this.openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      try {
        const current = await this.getAll<any>(storeName);
        localStorage.setItem(`om_store_${storeName}`, JSON.stringify(current.filter(x => x.id !== id)));
      } catch {}
    }
    this.memoryCache.get(storeName)?.delete(id);
    this.notify(storeName);
  }

  public async getSingleton<T>(storeName: string): Promise<T | null> {
    const item = await this.get<{ id: string; value: T }>(storeName, 'root');
    return item ? item.value : null;
  }

  public async setSingleton<T>(storeName: string, value: T): Promise<void> {
    await this.put(storeName, { id: 'root', value } as any);
  }

  public async exportFullBackup(): Promise<string> {
    const allData: Record<string, any> = {};
    for (const name of STORE_NAMES) {
      allData[name] = name === 'appSettings' ? await this.getSingleton(name) : await this.getAll(name);
    }
    return JSON.stringify({
      app: 'Om-LifeOS',
      version: '5.0.0',
      exportedAt: new Date().toISOString(),
      data: allData
    }, null, 2);
  }

  public async importFullBackup(jsonString: string): Promise<number> {
    const parsed = JSON.parse(jsonString);
    const data = parsed.data || parsed;
    let totalImported = 0;
    for (const name of STORE_NAMES) {
      if (data[name]) {
        if (name === 'appSettings') {
          await this.setSingleton(name, data[name]);
          totalImported++;
        } else if (Array.isArray(data[name])) {
          await this.bulkPut(name, data[name]);
          totalImported += data[name].length;
        }
      }
    }
    this.notify();
    return totalImported;
  }

  public async clearAllData(): Promise<void> {
    try {
      const db = await this.openDB();
      const tx = db.transaction(STORE_NAMES, 'readwrite');
      STORE_NAMES.forEach(name => tx.objectStore(name).clear());
      await new Promise<void>(resolve => { tx.oncomplete = () => resolve(); });
    } catch {}
    STORE_NAMES.forEach(name => {
      try { localStorage.removeItem(`om_store_${name}`); } catch {}
      this.memoryCache.get(name)?.clear();
    });
    this.notify();
  }
}

export const storage = new StorageEngine();

import { User } from 'firebase/auth';

export async function purgePrimaryWorkspace(): Promise<void> {
  const existingSettings = await storage.getSingleton<AppState>('appSettings');
  if (existingSettings && existingSettings.profiles) {
    const cleanedProfiles = existingSettings.profiles.filter(
      p => p.id !== 'default' && p.name !== 'Primary Workspace' && p.email !== 'user@omlifeos.local'
    );
    if (cleanedProfiles.length !== existingSettings.profiles.length || existingSettings.profileId === 'default') {
      const updated: AppState = {
        ...existingSettings,
        profileId: cleanedProfiles[0]?.id || '',
        profiles: cleanedProfiles
      };
      await storage.setSingleton('appSettings', updated);
      (storage as any).notify();
    }
  }
}

export async function syncGoogleUserProfile(user: User): Promise<UserProfile> {
  const existingSettings = await storage.getSingleton<AppState>('appSettings') || {
    profileId: '',
    profiles: [],
    themeMode: 'light',
    accentColor: '#6366f1'
  };

  // Strictly filter out any mock/dummy "Primary Workspace" or "user@omlifeos.local"
  const cleanProfiles = (existingSettings.profiles || []).filter(
    p => p.id !== 'default' && p.name !== 'Primary Workspace' && p.email !== 'user@omlifeos.local'
  );

  // Check if this Google user already exists in profiles
  let googleProfile = cleanProfiles.find(p => p.id === user.uid || (user.email && p.email === user.email));
  if (!googleProfile) {
    googleProfile = {
      id: user.uid,
      name: user.displayName || user.email?.split('@')[0] || 'Google Account',
      email: user.email || '',
      role: 'Account Owner',
      avatarChar: (user.displayName?.[0] || user.email?.[0] || 'G').toUpperCase(),
      avatarColor: '#4F46E5',
      photoURL: user.photoURL || undefined,
      createdAt: Date.now()
    };
    cleanProfiles.unshift(googleProfile);
  } else {
    // Update live profile details from Google
    if (user.displayName) googleProfile.name = user.displayName;
    if (user.photoURL) googleProfile.photoURL = user.photoURL;
    if (user.email) googleProfile.email = user.email;
  }

  const updatedSettings: AppState = {
    ...existingSettings,
    profileId: googleProfile.id,
    profiles: cleanProfiles
  };

  await storage.setSingleton('appSettings', updatedSettings);
  (storage as any).notify();
  return googleProfile;
}

export async function purgeAllDefaultDemoData(): Promise<void> {
  const storesToClear = [
    'tasks', 'taskTemplates', 'routines', 'habits', 'habitLogs', 'goals',
    'focus', 'focusAlarms', 'notes', 'journal', 'finance', 'financeAccounts',
    'loans', 'investments', 'savingsPlans', 'healthMeasurements', 'sleepRecords',
    'waterRecords', 'workouts', 'calcHistory', 'dailyPlannerArchive'
  ];

  try {
    const db = await (storage as any).openDB();
    const tx = db.transaction(storesToClear, 'readwrite');
    storesToClear.forEach(name => {
      try { tx.objectStore(name).clear(); } catch {}
    });
    await new Promise<void>(resolve => { tx.oncomplete = () => resolve(); });
  } catch {}

  storesToClear.forEach(name => {
    try { localStorage.removeItem(`om_store_${name}`); } catch {}
    (storage as any).memoryCache?.get(name)?.clear();
  });

  const existingSettings = await storage.getSingleton<AppState>('appSettings');
  const today = new Date().toISOString().slice(0, 10);
  const cleanProfiles = (existingSettings?.profiles || []).filter(
    p => p.id !== 'default' && p.name !== 'Primary Workspace' && p.email !== 'user@omlifeos.local'
  );

  const cleanSettings: AppState = {
    profileId: cleanProfiles[0]?.id || '',
    profiles: cleanProfiles,
    themeMode: existingSettings?.themeMode || 'light',
    accentColor: existingSettings?.accentColor || '#6366f1',
    dailyPlanner: {
      date: today,
      target: '',
      progress: 0,
      points: [],
      wins: [],
      reflection: []
    }
  };
  await storage.setSingleton('appSettings', cleanSettings);
  localStorage.setItem('om_default_data_permanently_cleared', 'true');
  (storage as any).notify();
}

export async function seedInitialDataIfEmpty(): Promise<boolean> {
  // Ensure default mock data is permanently removed and never re-seeded
  const hasBeenPurged = localStorage.getItem('om_default_data_permanently_cleared');
  if (!hasBeenPurged) {
    await purgeAllDefaultDemoData();
    return true;
  }

  // Purge any lingering Primary Workspace from prior state
  await purgePrimaryWorkspace();

  const existingSettings = await storage.getSingleton<AppState>('appSettings');
  if (!existingSettings) {
    const today = new Date().toISOString().slice(0, 10);
    await storage.setSingleton<AppState>('appSettings', {
      profileId: '',
      profiles: [],
      themeMode: 'light',
      accentColor: '#6366f1',
      dailyPlanner: {
        date: today,
        target: '',
        progress: 0,
        points: [],
        wins: [],
        reflection: []
      }
    });
  }
  return false;
}

