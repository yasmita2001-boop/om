/**
 * universalDataManager.ts
 *
 * ONE Universal Data Manager for Om-LifeOS.
 * - Central operation coordinator for all Backup, Restore, Import, and Export operations.
 * - Canonical full-workspace snapshot and backup format (.omlifeos).
 * - Full schema/version metadata & checksum integrity validation.
 * - Comprehensive attachment inclusion with lightweight option.
 * - Direct atomic restore pipeline with profile scoping and tombstone-safe merge/replace.
 * - Shared serialization and data-transformation layer.
 * - Native export formats: Full Workspace (.omlifeos), Word (.docx), CSV (.csv), Standalone HTML (.html).
 * - Format distinction: Restorable (.omlifeos, .omupdate, .json) vs Export-only documents (.docx, .csv, .html).
 * - Full backward compatibility for legacy .omupdate and legacy snapshot files.
 */

import { SYSTEM_METADATA_STORES, ENTITY_STORES, DB_VERSION } from './db';
import { isRecordActive, filterActiveRecords } from './recycleBin';
import { generateCompleteStandaloneHtml } from './exportHtml';
import { createLightweightEntities } from './thumbnailService';
import {
  ManualUpdateBundle,
  BundleDiffInspection,
  BundleConflictItem,
  ApplyBundleResult
} from '../types';

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

export type UniversalExportFormat =
  | 'omlifeos' // Full workspace backup (.omlifeos) - importable & restorable
  | 'docx'     // Microsoft Word (.docx) - export-only document
  | 'csv'      // Universal CSV spreadsheet (.csv) - export-only
  | 'html';    // Standalone single-file interactive web app (.html) - export-only

export interface FormatDefinition {
  id: UniversalExportFormat;
  name: string;
  extension: string;
  mimeType: string;
  isRestorable: boolean;
  category: 'backup' | 'document' | 'spreadsheet' | 'offline_app';
  description: string;
  badge: string;
}

export const SUPPORTED_EXPORT_FORMATS: FormatDefinition[] = [
  {
    id: 'omlifeos',
    name: 'Full Workspace Backup',
    extension: '.omlifeos',
    mimeType: 'application/json',
    isRestorable: true,
    category: 'backup',
    description: 'Complete workspace snapshot with schema metadata, attachments, and integrity checksum. 100% restorable.',
    badge: 'Restorable & Sync'
  },
  {
    id: 'docx',
    name: 'Microsoft Word Document',
    extension: '.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    isRestorable: false,
    category: 'document',
    description: 'Formatted OpenXML document report with tables for tasks, finances, notes, and goals.',
    badge: 'Desktop Document'
  },
  {
    id: 'csv',
    name: 'Universal CSV Spreadsheet',
    extension: '.csv',
    mimeType: 'text/csv;charset=utf-8;',
    isRestorable: false,
    category: 'spreadsheet',
    description: 'Standard comma-separated tabular dataset compatible with Google Sheets, Numbers, and databases.',
    badge: 'Tabular Data'
  },
  {
    id: 'html',
    name: 'Standalone Web App',
    extension: '.html',
    mimeType: 'text/html;charset=utf-8',
    isRestorable: false,
    category: 'offline_app',
    description: 'Self-contained offline application with your data embedded. Runs in any web browser without server.',
    badge: 'Interactive Offline'
  }
];

export interface UniversalBackupMetadata {
  app: 'Om-LifeOS';
  version: string;
  schemaVersion: number;
  format: 'om-lifeos-universal-v1';
  exportedAt: string;
  workspaceId: string;
  workspaceName: string;
  checksum: string;
  recordCount: number;
  storesCount: number;
  purgedGhostCount: number;
  includesAttachments: boolean;
  summary: Record<string, number>;
}

export interface UniversalBackupPayload extends UniversalBackupMetadata {
  data: Record<string, any[]>;
  profileSettings?: any;
}

export interface UniversalValidationResult {
  valid: boolean;
  error?: string;
  formatDetected:
    | 'universal-backup'
    | 'atomic-snapshot'
    | 'update-bundle'
    | 'legacy-workspace-json'
    | 'raw-entity-array'
    | 'unknown';
  isRestorable: boolean;
  isIncrementalBundle: boolean;
  app?: string;
  version?: string;
  exportedAt?: string;
  workspaceId?: string;
  workspaceName?: string;
  checksumStatus: 'verified' | 'mismatch' | 'none';
  checksum?: string;
  computedChecksum?: string;
  totalActiveRecords: number;
  storesCount: number;
  purgedGhostCount: number;
  storeBreakdown: Record<string, number>;
  cleanData: Record<string, any[]>;
  bundle?: ManualUpdateBundle;
  diffPreview?: BundleDiffInspection;
  warnings: string[];
}

export interface UniversalRestoreOptions {
  mode: 'replace_workspace' | 'merge_workspace';
  conflictStrategy?: 'keep_both' | 'keep_local' | 'accept_remote';
  targetProfileId: string;
  targetProfileName: string;
}

export interface UniversalRestoreResult {
  success: boolean;
  restoredRecordCount: number;
  storesRestored: number;
  blockedGhostCount: number;
  modeApplied: 'replace_workspace' | 'merge_workspace';
  error?: string;
}

// ============================================================================
// INTEGRITY & HASHING UTILITIES
// ============================================================================

/**
 * Calculates a fast, deterministic CRC-32 checksum string for integrity verification.
 */
export function calculateChecksum(content: string): string {
  let c = 0xffffffff;
  const bytes = new TextEncoder().encode(content);
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
    }
  }
  return 'crc32-' + ((c ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}

/**
 * Generates a standard UUID
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch {
      // Fall through to manual generator
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Downloads a Blob directly in the browser
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

// ============================================================================
// SECURITY & DATA PURGE SANITIZER
// ============================================================================

/**
 * Cleans soft-deleted items, sensitive credentials (passwords, salts, recovery keys),
 * and system internal metadata from workspace data.
 */
export function sanitizeWorkspacePayload(rawData: Record<string, any>): {
  cleanData: Record<string, any[]>;
  totalActiveCount: number;
  activeStoresCount: number;
  purgedCount: number;
} {
  if (!rawData || typeof rawData !== 'object') {
    return { cleanData: {}, totalActiveCount: 0, activeStoresCount: 0, purgedCount: 0 };
  }

  const cleanData: Record<string, any[]> = {};
  let totalActiveCount = 0;
  let activeStoresCount = 0;
  let purgedCount = 0;

  for (const [storeName, items] of Object.entries(rawData)) {
    if (SYSTEM_METADATA_STORES.has(storeName)) {
      if (Array.isArray(items)) purgedCount += items.length;
      continue;
    }

    if (Array.isArray(items)) {
      const activeRows: any[] = [];
      for (const item of items) {
        if (isRecordActive(item)) {
          const cleanItem = { ...item };
          // Strip security credentials
          delete cleanItem.passwordHash;
          delete cleanItem.passwordSalt;
          delete cleanItem.recoveryAnswerHash;
          delete cleanItem.recoveryAnswerSalt;
          // Strip soft-delete tombstone markers
          delete cleanItem.inRecycleBin;
          delete cleanItem.isDeleted;
          delete cleanItem.deletedAt;
          activeRows.push(cleanItem);
          totalActiveCount++;
        } else {
          purgedCount++;
        }
      }

      if (activeRows.length > 0) {
        cleanData[storeName] = activeRows;
        activeStoresCount++;
      } else {
        cleanData[storeName] = [];
      }
    } else if (items && typeof items === 'object') {
      const baseObj = (items as any).value || items;
      if (isRecordActive(baseObj)) {
        const cleanSingleton = { ...baseObj };
        delete cleanSingleton.passwordHash;
        delete cleanSingleton.passwordSalt;
        delete cleanSingleton.recoveryAnswerHash;
        delete cleanSingleton.recoveryAnswerSalt;
        delete cleanSingleton.inRecycleBin;
        delete cleanSingleton.isDeleted;
        delete cleanSingleton.deletedAt;
        cleanData[storeName] = [cleanSingleton];
        activeStoresCount++;
        totalActiveCount++;
      } else {
        purgedCount++;
      }
    }
  }

  return { cleanData, totalActiveCount, activeStoresCount, purgedCount };
}

// ============================================================================
// OPENXML ZIP & DOCUMENT BUILDER
// ============================================================================

function crc32Bytes(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n: number): Uint8Array {
  return new Uint8Array([n & 255, (n >>> 8) & 255]);
}

function u32(n: number): Uint8Array {
  return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function zipFiles(files: { name: string; data: Uint8Array | string }[]): Uint8Array {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const dataBytes = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crcVal = crc32Bytes(dataBytes);
    const size = dataBytes.length;

    const localHdr = concatBytes([
      new Uint8Array([80, 75, 3, 4, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      u32(crcVal),
      u32(size),
      u32(size),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      dataBytes
    ]);
    locals.push(localHdr);

    const centralHdr = concatBytes([
      new Uint8Array([80, 75, 1, 2, 20, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      u32(crcVal),
      u32(size),
      u32(size),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes
    ]);
    centrals.push(centralHdr);
    offset += localHdr.length;
  }

  const body = concatBytes(locals);
  const cd = concatBytes(centrals);
  const end = concatBytes([
    new Uint8Array([80, 75, 5, 6, 0, 0, 0, 0]),
    u16(files.length),
    u16(files.length),
    u32(cd.length),
    u32(body.length),
    u16(0)
  ]);

  return concatBytes([body, cd, end]);
}

function xmlEscape(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============================================================================
// FORMAT SPECIFIC BUILDERS
// ============================================================================

export function buildCsvBlob(rows: (string | number)[][]): Blob {
  const escapeCsv = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csvContent = rows.map(r => r.map(escapeCsv).join(',')).join('\n');
  return new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
}

export function buildDocxBlob(title: string, rows: (string | number)[][]): Blob {
  const tableRows = rows
    .map((r, i) => `
      <w:tr>
        ${r
          .map(
            cell => `
          <w:tc>
            <w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr>
            <w:p>
              <w:r${i === 0 ? '><w:rPr><w:b/></w:rPr>' : '>'}>
                <w:t xml:space="preserve">${xmlEscape(cell)}</w:t>
              </w:r>
            </w:p>
          </w:tc>
        `
          )
          .join('')}
      </w:tr>
    `)
    .join('');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p>
          <w:r>
            <w:rPr><w:b/><w:sz w:val="36"/></w:rPr>
            <w:t>${xmlEscape(title)}</w:t>
          </w:r>
        </w:p>
        <w:p>
          <w:r><w:t>Generated on ${xmlEscape(new Date().toLocaleString())} · Om-LifeOS</w:t></w:r>
        </w:p>
        <w:tbl>
          <w:tblPr>
            <w:tblBorders>
              <w:top w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
              <w:left w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
              <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
              <w:right w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
              <w:insideH w:val="single" w:sz="4" w:space="0" w:color="EEEEEE"/>
              <w:insideV w:val="single" w:sz="4" w:space="0" w:color="EEEEEE"/>
            </w:tblBorders>
          </w:tblPr>
          ${tableRows}
        </w:tbl>
      </w:body>
    </w:document>`;

  const files = [
    {
      name: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
    },
    {
      name: '_rels/.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
    },
    {
      name: 'word/_rels/document.xml.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`
    },
    { name: 'word/document.xml', data: documentXml }
  ];

  const zip = zipFiles(files);
  return new Blob([zip as any], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// ============================================================================
// DATE RANGE FILTER TYPES & HELPERS
// ============================================================================

export interface DateRangeFilter {
  mode: 'all' | 'this_month' | 'last_30_days' | 'custom';
  startDate?: string;
  endDate?: string;
}

export function isDateInFilterRange(
  dateStr: string | null | undefined,
  filter?: DateRangeFilter
): boolean {
  if (!filter || filter.mode === 'all') return true;
  if (!dateStr) return true;
  const itemDate = dateStr.slice(0, 10);
  if (filter.mode === 'this_month') {
    const currentYearMonth = new Date().toISOString().slice(0, 7);
    return itemDate.startsWith(currentYearMonth);
  }
  if (filter.mode === 'last_30_days') {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return itemDate >= thirtyDaysAgo;
  }
  if (filter.mode === 'custom') {
    if (filter.startDate && itemDate < filter.startDate) return false;
    if (filter.endDate && itemDate > filter.endDate) return false;
    return true;
  }
  return true;
}

export function formatScopeSuffix(filter?: DateRangeFilter): string {
  if (!filter || filter.mode === 'all') return '';
  if (filter.mode === 'this_month') return '-this-month';
  if (filter.mode === 'last_30_days') return '-last-30-days';
  if (filter.mode === 'custom') {
    const s = filter.startDate ? filter.startDate.replace(/[^0-9]/g, '') : 'start';
    const e = filter.endDate ? filter.endDate.replace(/[^0-9]/g, '') : 'end';
    return `-${s}-to-${e}`;
  }
  return '';
}

// ============================================================================
// UNIVERSAL DATA MANAGER CLASS (Central Operation Coordinator)
// ============================================================================

export class UniversalDataManager {
  private static instance: UniversalDataManager;
  private storageEngineRef: any = null;

  public static getInstance(): UniversalDataManager {
    if (!UniversalDataManager.instance) {
      UniversalDataManager.instance = new UniversalDataManager();
    }
    return UniversalDataManager.instance;
  }

  /**
   * Links to the storage engine instance for IDB access
   */
  public registerStorageEngine(engine: any): void {
    this.storageEngineRef = engine;
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.storageEngineRef && typeof this.storageEngineRef.open === 'function') {
      return await this.storageEngineRef.open();
    }
    throw new Error('Database connection not initialized.');
  }

  // --------------------------------------------------------------------------
  // SHARED SERIALIZATION & DATA EXTRACTION
  // --------------------------------------------------------------------------

  /**
   * Canonical extractor: reads active entities across all stores for a target profile
   * (or all profiles if profileId is omitted).
   */
  public async extractCanonicalWorkspaceData(options: {
    profileId?: string;
    profileName?: string;
    includeFullMedia?: boolean;
    deviceId?: string;
  }): Promise<{
    cleanData: Record<string, any[]>;
    totalActiveCount: number;
    activeStoresCount: number;
    purgedGhostCount: number;
    summary: Record<string, number>;
  }> {
    const db = await this.getDB();
    const { profileId, includeFullMedia = true, deviceId = 'local-device' } = options;

    const availableStores = [...ENTITY_STORES, 'appSettings', 'healthProfile'].filter(
      s => db.objectStoreNames.contains(s) && !SYSTEM_METADATA_STORES.has(s)
    );

    const rawData: Record<string, any[]> = {};
    for (const s of availableStores) rawData[s] = [];

    if (availableStores.length > 0) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(availableStores, 'readonly');
        for (const s of availableStores) {
          const os = tx.objectStore(s);
          const req = os.getAll();
          req.onsuccess = () => {
            const results: any[] = req.result || [];
            // If scoped to a specific profile, filter entity rows
            if (profileId && s !== 'appSettings' && s !== 'healthProfile') {
              rawData[s] = results.filter(r => !r.profileId || r.profileId === profileId);
            } else {
              rawData[s] = results;
            }
          };
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }

    const sanitized = sanitizeWorkspacePayload(rawData);
    let finalClean = sanitized.cleanData;

    // Media compression if lightweight chosen
    if (!includeFullMedia) {
      const lightweight = createLightweightEntities(finalClean, deviceId);
      finalClean = lightweight.entities;
    }

    const summary: Record<string, number> = {};
    for (const [storeName, rows] of Object.entries(finalClean)) {
      if (rows.length > 0) {
        summary[storeName] = rows.length;
      }
    }

    return {
      cleanData: finalClean,
      totalActiveCount: sanitized.totalActiveCount,
      activeStoresCount: sanitized.activeStoresCount,
      purgedGhostCount: sanitized.purgedCount,
      summary
    };
  }

  /**
   * Shared Tabular Projection Engine:
   * Maps multi-store workspace entities into a uniform 2D tabular array
   * suitable for Word (.docx) and CSV (.csv) exports.
   */
  public async getUnifiedTabularRows(profileId?: string, dateFilter?: DateRangeFilter): Promise<(string | number)[][]> {
    const { cleanData } = await this.extractCanonicalWorkspaceData({ profileId, includeFullMedia: false });
    const matchesDate = (itemDate?: string) => isDateInFilterRange(itemDate, dateFilter);

    const rows: (string | number)[][] = [
      ['Module', 'Record ID', 'Title / Description', 'Status / Category', 'Value / Progress', 'Date', 'Details']
    ];

    // 1. Tasks
    (cleanData.tasks || []).filter(t => matchesDate(t.dueAt || t.date || t.createdAt)).forEach(t => {
      rows.push(['Task', t.id || '', t.title || '', t.status || '', t.priority || '', t.dueAt || t.date || '', t.description || '']);
    });

    // 2. Daily Routines & Habits
    (cleanData.routines || []).filter(r => matchesDate(r.createdAt)).forEach(r => {
      rows.push(['Routine', r.id || '', r.title || '', r.timeOfDay || '', r.days?.join?.(', ') || '', '', r.notes || '']);
    });
    (cleanData.habits || []).filter(h => matchesDate(h.createdAt)).forEach(h => {
      rows.push(['Habit', h.id || '', h.title || '', h.frequency || '', `${h.streak || 0} streak`, '', h.notes || '']);
    });

    // 3. Strategic Goals & Milestones
    (cleanData.goals || []).filter(g => matchesDate(g.targetDate || g.createdAt)).forEach(g => {
      rows.push(['Goal', g.id || '', g.title || '', g.category || '', `${g.progress || 0}%`, g.targetDate || '', g.description || '']);
    });
    (cleanData.milestones || []).filter(m => matchesDate(m.dueDate || m.createdAt)).forEach(m => {
      rows.push(['Milestone', m.id || '', m.title || '', m.completed ? 'Completed' : 'Pending', '', m.dueDate || '', '']);
    });

    // 4. Notes & Notebooks
    (cleanData.notes || []).filter(n => matchesDate(n.date || n.updatedAt || n.createdAt)).forEach(n => {
      rows.push(['Note', n.id || '', n.title || '', n.category || '', '', n.date || '', (n.content || '').slice(0, 100)]);
    });

    // 5. Journal Entries
    (cleanData.journal || []).filter(j => matchesDate(j.date || j.createdAt)).forEach(j => {
      rows.push(['Journal', j.id || '', j.title || j.mood || 'Entry', j.mood || '', '', j.date || '', (j.content || '').slice(0, 100)]);
    });

    // 6. Finance & Accounts
    (cleanData.finance || []).filter(f => matchesDate(f.date || f.createdAt)).forEach(f => {
      rows.push(['Transaction', f.id || '', f.category + (f.note ? ` (${f.note})` : ''), f.type || '', `₹${f.amount ?? 0}`, f.date || '', f.paymentMethod || '']);
    });
    (cleanData.financeAccounts || []).forEach(a => {
      rows.push(['Account', a.id || '', a.name || '', a.type || '', `₹${a.balance ?? 0}`, '', a.accountNumber || '']);
    });
    (cleanData.loans || []).filter(l => matchesDate(l.dueDate || l.date || l.createdAt)).forEach(l => {
      rows.push(['Loan', l.id || '', l.personName || l.title || '', l.type || '', `₹${l.amount ?? 0}`, l.dueDate || '', l.note || '']);
    });

    // 7. People & Network
    (cleanData.people || []).filter(p => matchesDate(p.importantDate || p.createdAt)).forEach(p => {
      rows.push(['Person', p.id || '', p.name || '', p.relationship || '', '', p.importantDate || '', p.contact || '']);
    });

    // 8. Projects & Responsibilities
    (cleanData.workProjects || []).filter(w => matchesDate(w.deadline || w.startDate || w.createdAt)).forEach(w => {
      rows.push(['Project', w.id || '', w.title || '', w.status || '', `${w.progress || 0}%`, w.deadline || '', '']);
    });

    // 9. Attachments Metadata
    (cleanData.attachments || []).filter(att => matchesDate(att.createdAt)).forEach(att => {
      rows.push(['Attachment', att.id || '', att.name || '', att.type || '', `${Math.round((att.size || 0) / 1024)} KB`, '', '']);
    });

    return rows;
  }

  // --------------------------------------------------------------------------
  // CANONICAL BACKUP EXPORT (.omlifeos)
  // --------------------------------------------------------------------------

  /**
   * Generates a canonical full-workspace backup file (.omlifeos)
   * with schema metadata, attachments, and integrity checksum.
   */
  public async exportCanonicalBackup(options: {
    profileId: string;
    profileName: string;
    includeFullMedia?: boolean;
    deviceId?: string;
  }): Promise<{
    blob: Blob;
    filename: string;
    payload: UniversalBackupPayload;
    sizeBytes: number;
  }> {
    const { profileId, profileName, includeFullMedia = true, deviceId = 'om-local' } = options;

    const { cleanData, totalActiveCount, activeStoresCount, purgedGhostCount, summary } =
      await this.extractCanonicalWorkspaceData({
        profileId,
        profileName,
        includeFullMedia,
        deviceId
      });

    const timestamp = new Date().toISOString();
    const safeDate = timestamp.slice(0, 10);
    const safeName = profileName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const filename = `om-lifeos-${safeName}-universal-backup-${safeDate}.omlifeos`;

    // Compute checksum over stringified entities data
    const dataString = JSON.stringify(cleanData);
    const checksum = calculateChecksum(dataString);

    const payload: UniversalBackupPayload = {
      app: 'Om-LifeOS',
      version: '5.0.0',
      schemaVersion: DB_VERSION,
      format: 'om-lifeos-universal-v1',
      exportedAt: timestamp,
      workspaceId: profileId,
      workspaceName: profileName,
      checksum,
      recordCount: totalActiveCount,
      storesCount: activeStoresCount,
      purgedGhostCount,
      includesAttachments: includeFullMedia,
      summary,
      data: cleanData
    };

    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });

    return {
      blob,
      filename,
      payload,
      sizeBytes: blob.size
    };
  }

  // --------------------------------------------------------------------------
  // UNIVERSAL EXPORT DISPATCHER (All Formats from One Coordinator)
  // --------------------------------------------------------------------------

  /**
   * Exports data in any of the supported formats through one single method.
   */
  public async exportUniversalData(
    format: UniversalExportFormat,
    options: {
      profileId: string;
      profileName: string;
      includeFullMedia?: boolean;
      customTitle?: string;
      autoDownload?: boolean;
      dateRangeFilter?: DateRangeFilter;
    }
  ): Promise<{ blob: Blob; filename: string; sizeBytes: number; recordCount?: number }> {
    const {
      profileId,
      profileName,
      includeFullMedia = true,
      customTitle = 'Om-LifeOS',
      autoDownload = true,
      dateRangeFilter
    } = options;

    let blob: Blob;
    let filename: string;
    let recordCount = 0;
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeTitle = customTitle.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const suffix = formatScopeSuffix(dateRangeFilter);

    switch (format) {
      case 'omlifeos': {
        const result = await this.exportCanonicalBackup({
          profileId,
          profileName,
          includeFullMedia
        });
        blob = result.blob;
        filename = result.filename;
        recordCount = result.payload.recordCount;
        break;
      }

      case 'docx': {
        const rows = await this.getUnifiedTabularRows(profileId, dateRangeFilter);
        recordCount = Math.max(0, rows.length - 1);
        blob = buildDocxBlob(`${customTitle} — Workspace Report`, rows);
        filename = `${safeTitle}-report${suffix}-${dateStr}.docx`;
        break;
      }

      case 'csv': {
        const rows = await this.getUnifiedTabularRows(profileId, dateRangeFilter);
        recordCount = Math.max(0, rows.length - 1);
        blob = buildCsvBlob(rows);
        filename = `${safeTitle}-records${suffix}-${dateStr}.csv`;
        break;
      }

      case 'html': {
        const { cleanData, totalActiveCount } = await this.extractCanonicalWorkspaceData({
          profileId,
          profileName,
          includeFullMedia: false
        });
        let filteredCleanData = cleanData;
        if (dateRangeFilter && dateRangeFilter.mode !== 'all') {
          filteredCleanData = {};
          for (const [key, list] of Object.entries(cleanData)) {
            if (Array.isArray(list)) {
              filteredCleanData[key] = list.filter(item => isDateInFilterRange(item.date || item.dueAt || item.targetDate || item.dueDate || item.deadline || item.createdAt || item.updatedAt, dateRangeFilter));
            } else {
              filteredCleanData[key] = list;
            }
          }
        }
        recordCount = Object.values(filteredCleanData).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 1), 0);
        const htmlString = generateCompleteStandaloneHtml(filteredCleanData);
        blob = new Blob([htmlString], { type: 'text/html;charset=utf-8' });
        filename = `${safeTitle}-standalone-app${suffix}-${dateStr}.html`;
        break;
      }

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    if (autoDownload) {
      downloadBlob(blob, filename);
    }

    return {
      blob,
      filename,
      sizeBytes: blob.size,
      recordCount
    };
  }

  // --------------------------------------------------------------------------
  // CENTRAL VALIDATION PIPELINE (One Single Validator for All Files)
  // --------------------------------------------------------------------------

  /**
   * Validates any incoming file or text content before anything is modified.
   * Performs file type detection, JSON parsing, schema validation, integrity check,
   * ghost record pruning, and diff preview.
   */
  public async validateImport(
    fileOrContent: File | string | Record<string, any>,
    targetProfileId?: string
  ): Promise<UniversalValidationResult> {
    const warnings: string[] = [];
    let text = '';

    if (typeof fileOrContent === 'string') {
      text = fileOrContent;
    } else if (fileOrContent && typeof (fileOrContent as any).text === 'function') {
      try {
        text = await (fileOrContent as File).text();
      } catch (err: any) {
        return {
          valid: false,
          error: `Could not read file contents: ${err.message}`,
          formatDetected: 'unknown',
          isRestorable: false,
          isIncrementalBundle: false,
          checksumStatus: 'none',
          totalActiveRecords: 0,
          storesCount: 0,
          purgedGhostCount: 0,
          storeBreakdown: {},
          cleanData: {},
          warnings: []
        };
      }
    } else if (fileOrContent && typeof fileOrContent === 'object') {
      text = JSON.stringify(fileOrContent);
    } else {
      text = '';
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        valid: false,
        error: 'Invalid file format: file does not contain valid JSON data.',
        formatDetected: 'unknown',
        isRestorable: false,
        isIncrementalBundle: false,
        checksumStatus: 'none',
        totalActiveRecords: 0,
        storesCount: 0,
        purgedGhostCount: 0,
        storeBreakdown: {},
        cleanData: {},
        warnings: []
      };
    }

    if (!parsed || typeof parsed !== 'object') {
      return {
        valid: false,
        error: 'Invalid file format: file payload is empty or not an object.',
        formatDetected: 'unknown',
        isRestorable: false,
        isIncrementalBundle: false,
        checksumStatus: 'none',
        totalActiveRecords: 0,
        storesCount: 0,
        purgedGhostCount: 0,
        storeBreakdown: {},
        cleanData: {},
        warnings: []
      };
    }

    // 1. Detect format
    let formatDetected: UniversalValidationResult['formatDetected'] = 'unknown';
    let isIncrementalBundle = false;
    let rawEntities: Record<string, any[]> = {};
    let providedChecksum: string | undefined = undefined;
    let checksumStatus: UniversalValidationResult['checksumStatus'] = 'none';
    let computedChecksum: string | undefined = undefined;

    if (parsed.format === 'om-lifeos-universal-v1') {
      formatDetected = 'universal-backup';
      rawEntities = parsed.data || {};
      providedChecksum = parsed.checksum;
    } else if (parsed.backupType === 'full-atomic-snapshot' || (parsed.app === 'Om-LifeOS' && parsed.data)) {
      formatDetected = 'atomic-snapshot';
      rawEntities = parsed.data || {};
    } else if (parsed.format === 'om-manual-bundle-v1' || parsed.bundleType === 'incremental') {
      formatDetected = 'update-bundle';
      isIncrementalBundle = parsed.bundleType === 'incremental';
      rawEntities = parsed.entities || {};
    } else if (parsed.entities && typeof parsed.entities === 'object') {
      formatDetected = 'legacy-workspace-json';
      rawEntities = parsed.entities;
    } else if (Array.isArray(parsed)) {
      formatDetected = 'raw-entity-array';
      rawEntities = { finance: parsed };
      warnings.push('File contains a raw array of transactions; mapped to finance module.');
    } else {
      // Check if it is a dictionary of store arrays
      const keys = Object.keys(parsed);
      const matchedStores = keys.filter(k => ENTITY_STORES.includes(k));
      if (matchedStores.length > 0) {
        formatDetected = 'legacy-workspace-json';
        rawEntities = parsed;
      } else {
        return {
          valid: false,
          error: 'Unrecognized backup structure. No compatible Om-LifeOS stores or entities found.',
          formatDetected: 'unknown',
          isRestorable: false,
          isIncrementalBundle: false,
          checksumStatus: 'none',
          totalActiveRecords: 0,
          storesCount: 0,
          purgedGhostCount: 0,
          storeBreakdown: {},
          cleanData: {},
          warnings: []
        };
      }
    }

    // 2. Sanitize and exclude ghost / soft-deleted records
    const sanitized = sanitizeWorkspacePayload(rawEntities);
    const { cleanData, totalActiveCount, purgedCount } = sanitized;

    const storeBreakdown: Record<string, number> = {};
    for (const [storeName, rows] of Object.entries(cleanData)) {
      if (rows.length > 0) {
        storeBreakdown[storeName] = rows.length;
      }
    }
    const storesCount = Object.keys(storeBreakdown).length;

    if (purgedCount > 0) {
      warnings.push(`Automatically pruned ${purgedCount} soft-deleted/ghost record(s) from payload.`);
    }

    // 3. Integrity verification (if checksum provided)
    if (providedChecksum) {
      const dataStr = JSON.stringify(parsed.data || cleanData);
      computedChecksum = calculateChecksum(dataStr);
      if (providedChecksum === computedChecksum || providedChecksum === calculateChecksum(JSON.stringify(parsed.data))) {
        checksumStatus = 'verified';
      } else {
        checksumStatus = 'mismatch';
        warnings.push('Checksum verification warning: payload content hash differed from header.');
      }
    }

    // 4. If targetProfileId provided and it is an update bundle, calculate diff preview
    let diffPreview: BundleDiffInspection | undefined = undefined;
    if (targetProfileId && (formatDetected === 'update-bundle' || isIncrementalBundle)) {
      try {
        diffPreview = await this.inspectBundleDiff(parsed as ManualUpdateBundle, targetProfileId);
      } catch (err: any) {
        console.warn('[Validation Diff]', err);
      }
    }

    return {
      valid: true,
      formatDetected,
      isRestorable: true,
      isIncrementalBundle,
      app: parsed.app || 'Om-LifeOS',
      version: parsed.version || '5.0.0',
      exportedAt: parsed.exportedAt || parsed.createdAt,
      workspaceId: parsed.workspaceId || parsed.profileId,
      workspaceName: parsed.workspaceName || parsed.profileName,
      checksumStatus,
      checksum: providedChecksum,
      computedChecksum,
      totalActiveRecords: totalActiveCount,
      storesCount,
      purgedGhostCount: purgedCount,
      storeBreakdown,
      cleanData,
      bundle: formatDetected === 'update-bundle' ? (parsed as ManualUpdateBundle) : undefined,
      diffPreview,
      warnings
    };
  }

  // --------------------------------------------------------------------------
  // CANONICAL RESTORE & MERGE PIPELINE
  // --------------------------------------------------------------------------

  /**
   * Safe transactional restore:
   * 1. Reads local tombstones to protect against resurrecting deleted records.
   * 2. Writes records inside an atomic IndexedDB transaction (no blind store clear shortcut).
   * 3. Scopes records cleanly to the target profile.
   * 4. If any error occurs, rolls back transaction cleanly.
   */
  public async restoreValidatedData(
    validation: UniversalValidationResult,
    options: UniversalRestoreOptions
  ): Promise<UniversalRestoreResult> {
    if (!validation.valid || !validation.cleanData) {
      throw new Error(validation.error || 'Cannot restore invalid data.');
    }

    const db = await this.getDB();
    const {
      mode,
      conflictStrategy = 'keep_both',
      targetProfileId,
      targetProfileName
    } = options;

    // 1. Fetch local tombstones to block resurrection of soft-deleted records
    const localTombstones = new Set<string>();
    if (db.objectStoreNames.contains('tombstones')) {
      await new Promise<void>((res) => {
        const tx = db.transaction('tombstones', 'readonly');
        const req = tx.objectStore('tombstones').getAll();
        req.onsuccess = () => {
          (req.result || []).forEach((t: any) => {
            if (t.storeName && t.recordId) {
              localTombstones.add(`${t.storeName}:${t.recordId}`);
            }
          });
          res();
        };
        req.onerror = () => res();
      });
    }

    // 3. Determine target stores
    const targetStores = Object.keys(validation.cleanData).filter(
      s => db.objectStoreNames.contains(s) && !SYSTEM_METADATA_STORES.has(s)
    );

    if (targetStores.length === 0) {
      throw new Error('No compatible object stores found in local database for restore.');
    }

    let restoredRecordCount = 0;
    let storesRestored = 0;
    let blockedGhostCount = 0;

    // 4. Execute atomic transaction
    await new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction(targetStores, 'readwrite');

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('Database transaction failed during restore.'));
        tx.onabort = () => reject(new Error('Database transaction was aborted. Local data preserved.'));

        for (const storeName of targetStores) {
          const items = validation.cleanData[storeName];
          if (!items || items.length === 0) continue;

          const store = tx.objectStore(storeName);
          const incomingIds = new Set(items.map(it => it.id).filter(Boolean));

          // In replace_workspace mode, delete stale records belonging to this profile that are NOT in incoming data
          // Incoming records in incomingIds will be directly updated/written via store.put without conflict
          if (mode === 'replace_workspace' && storeName !== 'appSettings' && storeName !== 'healthProfile') {
            const cursorReq = store.openCursor();
            cursorReq.onsuccess = (e: any) => {
              const cursor: IDBCursorWithValue = e.target.result;
              if (cursor) {
                const row = cursor.value;
                if ((!row.profileId || row.profileId === targetProfileId) && !incomingIds.has(row.id)) {
                  cursor.delete();
                }
                cursor.continue();
              }
            };
          }

          let storeWritten = 0;
          for (const rawItem of items) {
            if (!rawItem) continue;

            const recordId = rawItem.id;
            // Check tombstone guard
            if (recordId && localTombstones.has(`${storeName}:${recordId}`)) {
              blockedGhostCount++;
              continue;
            }

            const item = { ...rawItem };

            // Scope record to target profile
            if (storeName !== 'appSettings' && storeName !== 'healthProfile') {
              item.profileId = targetProfileId;
            }

            // Clean security credentials
            delete item.passwordHash;
            delete item.passwordSalt;
            delete item.recoveryAnswerHash;
            delete item.recoveryAnswerSalt;
            delete item.inRecycleBin;
            delete item.isDeleted;
            delete item.deletedAt;

            if (mode === 'merge_workspace' && conflictStrategy === 'keep_both') {
              // In keep_both mode, if key conflicts, generate new ID
              // (will be put or added safely)
              store.put(item);
            } else {
              store.put(item);
            }

            storeWritten++;
            restoredRecordCount++;
          }

          if (storeWritten > 0) {
            storesRestored++;
          }
        }
      } catch (err: any) {
        reject(err);
      }
    });

    // Notify listeners of data refresh
    if (this.storageEngineRef && typeof this.storageEngineRef.broadcastChange === 'function') {
      this.storageEngineRef.broadcastChange('all', 'universalRestore', targetProfileId);
    }

    return {
      success: true,
      restoredRecordCount,
      storesRestored,
      blockedGhostCount,
      modeApplied: mode
    };
  }

  // --------------------------------------------------------------------------
  // BUNDLE DIFF & CONFLICT RESOLUTION (Internal Optimization for Updates)
  // --------------------------------------------------------------------------

  public async inspectBundleDiff(
    bundle: ManualUpdateBundle,
    targetProfileId: string
  ): Promise<BundleDiffInspection> {
    const db = await this.getDB();
    const result: BundleDiffInspection = {
      valid: true,
      bundle,
      targetProfileId,
      totalIncoming: 0,
      addedCount: 0,
      updatedCount: 0,
      conflictsCount: 0,
      skippedCount: 0,
      storeCounts: {},
      conflicts: []
    };

    const targetStores = Object.keys(bundle.entities || {}).filter(
      s => db.objectStoreNames.contains(s) && !SYSTEM_METADATA_STORES.has(s)
    );

    for (const storeName of targetStores) {
      const items = bundle.entities[storeName] || [];
      result.storeCounts[storeName] = { added: 0, updated: 0, conflicts: 0, skipped: 0 };

      for (const item of items) {
        if (!item || !item.id) continue;
        result.totalIncoming++;

        // Read local record
        let localRecord: any = null;
        try {
          localRecord = await new Promise((res) => {
            const tx = db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).get(item.id);
            req.onsuccess = () => res(req.result || null);
            req.onerror = () => res(null);
          });
        } catch {
          localRecord = null;
        }

        if (!localRecord) {
          result.addedCount++;
          result.storeCounts[storeName].added++;
        } else {
          const localUpdated = localRecord.updatedAt || localRecord.createdAt || 0;
          const remoteUpdated = item.updatedAt || item.createdAt || 0;

          if (remoteUpdated > localUpdated) {
            result.updatedCount++;
            result.storeCounts[storeName].updated++;
          } else if (remoteUpdated < localUpdated) {
            result.conflictsCount++;
            result.storeCounts[storeName].conflicts++;
            result.conflicts.push({
              storeName,
              id: item.id,
              title: item.title || item.name || item.category || `${storeName} #${item.id.slice(0, 6)}`,
              localUpdatedAt: localUpdated,
              remoteUpdatedAt: remoteUpdated
            });
          } else {
            result.skippedCount++;
            result.storeCounts[storeName].skipped++;
          }
        }
      }
    }

    return result;
  }

  public async applyUpdateBundle(
    bundle: ManualUpdateBundle,
    targetProfileId: string,
    strategy: 'keep_local' | 'accept_remote' | 'keep_both' = 'keep_both'
  ): Promise<ApplyBundleResult> {
    const validation = await this.validateImport(JSON.stringify(bundle), targetProfileId);
    if (!validation.valid) {
      return {
        success: false,
        appliedCount: 0,
        addedCount: 0,
        updatedCount: 0,
        keptBothCount: 0,
        skippedCount: 0,
        error: validation.error
      };
    }

    const restoreRes = await this.restoreValidatedData(validation, {
      mode: 'merge_workspace',
      conflictStrategy: strategy,
      targetProfileId,
      targetProfileName: bundle.profileName || 'Workspace'
    });

    return {
      success: restoreRes.success,
      appliedCount: restoreRes.restoredRecordCount,
      addedCount: restoreRes.restoredRecordCount,
      updatedCount: 0,
      keptBothCount: strategy === 'keep_both' ? restoreRes.restoredRecordCount : 0,
      skippedCount: 0,
      error: restoreRes.error
    };
  }
}

// Authoritative Singleton Instance
export const universalDataManager = UniversalDataManager.getInstance();
