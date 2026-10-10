/**
 * db.ts
 *
 * Core IndexedDB initialization, store schemas, version upgrades, and migrations.
 * Preserves all 54 canonical entity stores, singletons, system stores, and legacy indices.
 */

export const DB_NAME = 'om-lifeos-canonical-v4';
export const DB_VERSION = 6;

export const ENTITY_STORES = [
  'tasks', 'routines', 'habits', 'habitLogs', 'goals', 'milestones', 'strategies',
  'kpis', 'missions', 'mentorRules', 'mentorQuotes', 'capitalStrategy', 'capital',
  'capitalRecords', 'focus', 'notes', 'journal', 'finance', 'financeAccounts',
  'loans', 'loanPayments', 'investments', 'savingsPlans', 'assets', 'liabilities',
  'financialGoals', 'healthMeasurements', 'healthActivities', 'sleepRecords', 'waterRecords',
  'nutritionRecords', 'healthAppointments', 'healthNotes', 'workProjects',
  'workResponsibilities', 'learningItems', 'skills', 'courses', 'learningProgress',
  'meetings', 'people', 'relationships', 'interactions', 'importantDates',
  'relationshipReminders', 'values', 'principles', 'spiritualPractices',
  'commitments', 'things', 'documents', 'documentCollections', 'warranties',
  'receipts', 'certificates', 'importantRecords', 'reminders', 'notifications',
  'achievements', 'calcHistory', 'attachments'
];

export const SINGLETON_STORES = ['appSettings', 'healthProfile', 'profileSecurity'];
export const SYSTEM_STORES = ['tombstones', 'appliedBundles', 'recycleBin'];

export const TRANSIENT_RECYCLE_SKIP_STORES = new Set(['habitLogs', 'notifications']);

export const SYSTEM_METADATA_STORES = new Set([
  'recycleBin',
  'tombstones',
  'appliedBundles',
  'profileSecurity',
  'syncChanges'
]);

export const STORE_LABELS: Record<string, { label: string; module: string }> = {
  tasks: { label: 'Task', module: 'Tasks & Planner' },
  routines: { label: 'Daily Routine', module: 'Routines & Habits' },
  habits: { label: 'Habit', module: 'Routines & Habits' },
  habitLogs: { label: 'Habit Log', module: 'Routines & Habits' },
  goals: { label: 'Strategic Goal', module: 'Goals & Strategy' },
  milestones: { label: 'Milestone', module: 'Goals & Strategy' },
  strategies: { label: 'Strategy', module: 'Goals & Strategy' },
  kpis: { label: 'KPI Metric', module: 'Goals & Strategy' },
  missions: { label: 'Mission', module: 'Goals & Strategy' },
  focus: { label: 'Focus Session', module: 'Focus (Deep Work)' },
  notes: { label: 'Note', module: 'Notes & Notebooks' },
  journal: { label: 'Journal Entry', module: 'Daily Journal' },
  finance: { label: 'Transaction', module: 'Finance & Ledger' },
  financeAccounts: { label: 'Bank / Cash Account', module: 'Finance & Ledger' },
  loans: { label: 'Loan Record', module: 'Finance & Ledger' },
  loanPayments: { label: 'Loan Payment', module: 'Finance & Ledger' },
  investments: { label: 'Investment', module: 'Finance & Ledger' },
  savingsPlans: { label: 'Savings Plan', module: 'Finance & Ledger' },
  assets: { label: 'Asset', module: 'Finance & Ledger' },
  liabilities: { label: 'Liability', module: 'Finance & Ledger' },
  financialGoals: { label: 'Financial Goal', module: 'Finance & Ledger' },
  healthMeasurements: { label: 'Health Measurement', module: 'Health & Wellness' },
  sleepRecords: { label: 'Sleep Record', module: 'Health & Wellness' },
  waterRecords: { label: 'Water Log', module: 'Health & Wellness' },
  nutritionRecords: { label: 'Nutrition Log', module: 'Health & Wellness' },
  healthAppointments: { label: 'Medical Appointment', module: 'Health & Wellness' },
  healthNotes: { label: 'Health Note', module: 'Health & Wellness' },
  workProjects: { label: 'Work Project', module: 'Work & Skill Trees' },
  workResponsibilities: { label: 'Work Responsibility', module: 'Work & Skill Trees' },
  learningItems: { label: 'Learning Item', module: 'Work & Skill Trees' },
  skills: { label: 'Skill Tree', module: 'Work & Skill Trees' },
  courses: { label: 'Course', module: 'Work & Skill Trees' },
  meetings: { label: 'Meeting', module: 'Work & Skill Trees' },
  people: { label: 'Contact / Person', module: 'People & Relations' },
  interactions: { label: 'Interaction Log', module: 'People & Relations' },
  values: { label: 'Core Value', module: 'Values & Spiritual' },
  spiritualPractices: { label: 'Spiritual Practice', module: 'Values & Spiritual' },
  commitments: { label: 'Commitment', module: 'Values & Spiritual' },
  things: { label: 'Inventory Item', module: 'Things & Documents' },
  documents: { label: 'Document', module: 'Things & Documents' },
  warranties: { label: 'Warranty', module: 'Things & Documents' },
  receipts: { label: 'Receipt', module: 'Things & Documents' },
  certificates: { label: 'Certificate', module: 'Things & Documents' },
  importantRecords: { label: 'Important Record', module: 'Things & Documents' },
  reminders: { label: 'Reminder', module: 'Tasks & Planner' },
  calcHistory: { label: 'Calculation', module: 'Calculator & Tools' },
  attachments: { label: 'Attachment', module: 'Things & Documents' }
};

export interface DeletionTombstone {
  id: string; // `${storeName}:${recordId}`
  storeName: string;
  recordId: string;
  profileId: string;
  deletedAt: number;
  permanentlyDeleted?: boolean;
  contentSignature?: string;
}

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

export function parseTimestampMs(val: any): number {
  if (!val) return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (typeof val === 'string') {
    const asNum = Number(val);
    if (Number.isFinite(asNum)) return asNum;
    const parsed = Date.parse(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function computeRecordSignature(storeName: string, item: any): string | undefined {
  if (!item || typeof item !== 'object') return undefined;
  const primaryText = String(
    item.title || item.name || item.text || item.label || item.metric || item.question || item.note || ''
  ).trim().toLowerCase();
  const createdOrDate = String(item.createdAt || item.date || item.dueAt || item.startDate || '').trim();
  const amountOrVal = item.amount !== undefined
    ? String(item.amount)
    : item.balance !== undefined
      ? String(item.balance)
      : '';
  if (!primaryText && !amountOrVal) return undefined;
  return `${storeName}|${primaryText}|${createdOrDate}|${amountOrVal}`;
}

export function describeDeletedRecord(storeName: string, item: any): {
  title: string;
  subtitle: string;
  moduleLabel: string;
  storeLabel: string;
} {
  const meta = STORE_LABELS[storeName] || { label: storeName, module: 'Workspace' };
  let title = 'Untitled Item';
  let subtitle = '';

  if (item && typeof item === 'object') {
    title = (
      item.title ||
      item.name ||
      item.text ||
      item.label ||
      item.metric ||
      item.question ||
      item.note ||
      item.filename ||
      item.accountName ||
      item.subject ||
      item.id ||
      'Untitled Item'
    ).toString();

    if (item.category) subtitle = `Category: ${item.category}`;
    else if (item.domain) subtitle = `Domain: ${item.domain}`;
    else if (item.amount !== undefined) subtitle = `Amount: ₹${item.amount}`;
    else if (item.date) subtitle = `Date: ${item.date}`;
    else if (item.type) subtitle = `Type: ${item.type}`;
    else if (item.priority) subtitle = `Priority: ${item.priority}`;
  }

  return {
    title,
    subtitle,
    moduleLabel: meta.module,
    storeLabel: meta.label
  };
}

/**
 * Creates schema stores and indexes in an atomic upgrade transaction.
 */
export function createDatabaseSchema(db: IDBDatabase): void {
  for (const storeName of ENTITY_STORES) {
    if (!db.objectStoreNames.contains(storeName)) {
      const store = db.createObjectStore(storeName, { keyPath: 'id' });
      try {
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('profileId', 'profileId', { unique: false });
      } catch {}
    }
  }

  for (const storeName of SINGLETON_STORES) {
    if (!db.objectStoreNames.contains(storeName)) {
      db.createObjectStore(storeName, { keyPath: 'id' });
    }
  }

  for (const storeName of SYSTEM_STORES) {
    if (!db.objectStoreNames.contains(storeName)) {
      const store = db.createObjectStore(storeName, { keyPath: 'id' });
      try {
        store.createIndex('recordId', 'recordId', { unique: false });
        store.createIndex('storeName', 'storeName', { unique: false });
        store.createIndex('profileId', 'profileId', { unique: false });
        store.createIndex('deletedAt', 'deletedAt', { unique: false });
      } catch {}
    }
  }
}
