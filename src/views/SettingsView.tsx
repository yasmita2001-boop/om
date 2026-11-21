import React, { useState, useEffect, useCallback } from 'react';
import {
  Download, Database, Trash2,
  Palette, RefreshCw, DollarSign,
  Volume2, Globe, Bell, Clock, Keyboard, ChevronDown, ChevronUp, Shield
} from 'lucide-react';
import {
  storage,
  purgeAllDefaultDataPermanently, performHardAppReset, cleanOrphanedCacheAndTrash
} from '../lib/storage';
import { AppState } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { UniversalDataManagerCard } from '../components/UniversalDataManagerCard';
import { RecycleBinView } from './RecycleBinView';
import { soundEngine } from '../lib/soundEngine';
import { AppearanceCustomizer } from '../components/AppearanceCustomizer';
import { AppearancePreferences } from '../lib/appearance';
import { formatBytes } from '../lib/thumbnailService';
import { HeaderDropdown } from '../components/HeaderDropdown';
import { CURRENCY_SYMBOLS, getCurrencySymbol, isCurrencySymbol } from '../lib/currencyDisplay';
import { changeLocale, type Locale } from '../lib/i18n';
import { ThemedDateTimeInput } from '../components/ThemedDateTimeInput';

const LOCALE_OPTIONS = [
  { value: 'en' as const, label: 'English' },
  { value: 'hi' as const, label: 'हिन्दी' },
  { value: 'ne' as const, label: 'नेपाली' },
];

const DATE_FORMAT_OPTIONS = [
  { value: 'DD/MM/YYYY' as const, label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY' as const, label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD' as const, label: 'YYYY-MM-DD' },
];

const KEYBOARD_SHORTCUTS = [
  { keys: 'Ctrl + K', action: 'Global Search' },
  { keys: 'Ctrl + /', action: 'Quick Capture' },
];

const settingsSections = [
  { id: 'system', label: 'System', icon: Database },
  { id: 'exports', label: 'Data & Backups', icon: Download },
  { id: 'appearance', label: 'Coordinated themes', icon: Palette }
] as const;

interface SettingsViewProps {
  settings?: AppState;
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  appearance: AppearancePreferences;
  onApplyAppearance: (value: AppearancePreferences) => Promise<void>;
  wallpaperVideoMuted: boolean;
  onToggleWallpaperVideoSound: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onRefresh,
  onSuccess,
  onError,
  appearance,
  onApplyAppearance,
  wallpaperVideoMuted,
  onToggleWallpaperVideoSound
}) => {
  const [activeTab, setActiveTab] = useState<'system' | 'exports' | 'appearance'>('system');
  const [storageStats, setStorageStats] = useState<{
    usage: number;
    quota: number;
    percent: number;
    level: string;
    available?: boolean;
    profileUsage: number;
  }>({ usage: 0, quota: 0, percent: 0, level: 'healthy', available: false, profileUsage: 0 });
  const [isLoadingStorageStats, setIsLoadingStorageStats] = useState(true);
  const [storageStatsError, setStorageStatsError] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isPurgeDefaultOpen, setIsPurgeDefaultOpen] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [integrityAuditResult, setIntegrityAuditResult] = useState<{
    checked: number;
    issues: number;
    repaired: number;
  } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(() => soundEngine.isSoundEnabled());
  const [hapticEnabled, setHapticEnabled] = useState(() => soundEngine.isHapticEnabled());
  const [soundVolume, setSoundVolume] = useState(() => Math.round(soundEngine.getVolume() * 100));
  const [customCurrencySymbol, setCustomCurrencySymbol] = useState(() =>
    settings?.currencySymbol && !CURRENCY_SYMBOLS.includes(settings.currencySymbol as typeof CURRENCY_SYMBOLS[number])
      ? settings.currencySymbol
      : ''
  );
  const [isCustomCurrencySelected, setIsCustomCurrencySelected] = useState(() =>
    Boolean(settings?.currencySymbol && !CURRENCY_SYMBOLS.includes(settings.currencySymbol as typeof CURRENCY_SYMBOLS[number]))
  );
  const [shortcutsExpanded, setShortcutsExpanded] = useState(false);
  const [attachmentPassphrase, setAttachmentPassphrase] = useState('');
  const [isUpdatingAttachmentEncryption, setIsUpdatingAttachmentEncryption] = useState(false);
  const [isAttachmentEncryptionUnlocked, setIsAttachmentEncryptionUnlocked] = useState(storage.isAttachmentEncryptionUnlocked());
  const selectedSettingsSection = settingsSections.find(section => section.id === activeTab) ?? settingsSections[0];
  const SelectedSettingsSectionIcon = selectedSettingsSection.icon;

  useEffect(() => {
    const isCustom = Boolean(settings?.currencySymbol
      && !CURRENCY_SYMBOLS.includes(settings.currencySymbol as typeof CURRENCY_SYMBOLS[number]));
    setCustomCurrencySymbol(isCustom ? settings?.currencySymbol || '' : '');
    setIsCustomCurrencySelected(isCustom);
  }, [settings?.currencySymbol]);

  useEffect(() => {
    const handleEncryptionState = (event: Event) => {
      const detail = (event as CustomEvent<{ unlocked: boolean }>).detail;
      setIsAttachmentEncryptionUnlocked(Boolean(detail?.unlocked));
    };
    window.addEventListener('om-attachment-encryption-state', handleEncryptionState);
    return () => window.removeEventListener('om-attachment-encryption-state', handleEncryptionState);
  }, []);

  const profileId = settings?.profileId || storage.getActiveProfileId();
  const updateLocale = async (locale: Locale) => {
    try {
      const appSettings = await storage.getSingleton<AppState>('appSettings') || settings;
      if (!appSettings) throw new Error('App settings are unavailable.');
      await storage.setSingleton('appSettings', { ...appSettings, locale }, profileId);
      changeLocale(locale);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not save language setting.');
    }
  };
  const saveCustomCurrencySymbol = async () => {
    const currencySymbol = customCurrencySymbol.trim();
    if (!isCurrencySymbol(currencySymbol)) {
      onError('Enter a currency symbol of 1–12 characters without control characters.');
      return;
    }
    try {
      const appSettings = await storage.getSingleton<AppState>('appSettings') || settings;
      if (!appSettings) throw new Error('App settings are unavailable.');
      await storage.setSingleton('appSettings', { ...appSettings, currencySymbol }, profileId);
      onRefresh();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not save the currency display symbol.');
    }
  };
  const updateAppSetting = async (patch: Partial<AppState>) => {
    try {
      const appSettings = await storage.getSingleton<AppState>('appSettings') || settings;
      if (!appSettings) throw new Error('App settings are unavailable.');
      await storage.setSingleton('appSettings', { ...appSettings, ...patch }, profileId);
      onRefresh();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not save setting.');
    }
  };

  const updateAttachmentEncryption = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!attachmentPassphrase) return;
    setIsUpdatingAttachmentEncryption(true);
    try {
      if (settings?.attachmentEncryption?.enabled) {
        await storage.unlockAttachmentEncryption(attachmentPassphrase);
        setIsAttachmentEncryptionUnlocked(true);
        onSuccess('Encrypted attachments unlocked.');
      } else {
        await storage.enableAttachmentEncryption(attachmentPassphrase);
        setIsAttachmentEncryptionUnlocked(true);
        onSuccess('Vault attachments are encrypted.');
        await onRefresh();
      }
      setAttachmentPassphrase('');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not update attachment encryption.');
    } finally {
      setIsUpdatingAttachmentEncryption(false);
    }
  };

  const lockAttachmentEncryption = () => {
    storage.lockAttachmentEncryption();
    setIsAttachmentEncryptionUnlocked(false);
    setAttachmentPassphrase('');
    onSuccess('Vault attachments locked.');
  };

  const loadStorageStats = useCallback(async () => {
    setIsLoadingStorageStats(true);
    try {
      const [estimate, profileStats] = await Promise.all([
        storage.getStorageEstimate(),
        storage.calculateProfileStorageStats(profileId)
      ]);
      setStorageStats({ ...estimate, profileUsage: profileStats.totalBytes });
      setStorageStatsError(null);
    } catch (error) {
      setStorageStatsError(error instanceof Error ? error.message : 'Storage statistics could not be loaded.');
    } finally {
      setIsLoadingStorageStats(false);
    }
  }, [profileId]);

  useEffect(() => {
    void loadStorageStats();
  }, [loadStorageStats]);

  const handleRunIntegrityAudit = async () => {
    setIsAuditing(true);
    let totalChecked = 0;
    let issues = 0;
    let repaired = 0;

    try {
      const result = await storage.performIntegrityAudit(profileId);
      totalChecked = result.checked;
      issues = result.issues;
      repaired = result.repaired;
      setIntegrityAuditResult({ checked: totalChecked, issues, repaired });

      await loadStorageStats();

      onSuccess(`Integrity audit: ${totalChecked} records checked across all stores, ${issues} broken links found, ${repaired} repaired`);
    } catch {
      onError('Integrity audit failed');
    } finally {
      setIsAuditing(false);
    }
  };

  const handleResetData = () => {
    setIsResetConfirmOpen(true);
  };

  const handleConfirmReset = async () => {
    setIsResetConfirmOpen(false);
    try {
      await performHardAppReset();
    } catch (e: any) {
      onError(`Database reset failed: ${e?.message || 'Unexpected storage error.'}`);
    }
  };

  const [isCleanCacheOpen, setIsCleanCacheOpen] = useState(false);
  const [isCleaningCache, setIsCleaningCache] = useState(false);

  const handleCleanCache = () => {
    setIsCleanCacheOpen(true);
  };

  const handleConfirmCleanCache = async () => {
    setIsCleanCacheOpen(false);
    setIsCleaningCache(true);
    try {
      const res = await cleanOrphanedCacheAndTrash({
        emptyRecycleBinFirst: false, // Keep un-purged recycle bin items intact for restore
        profileId: settings?.profileId
      });
      const parts = [];
      if (res.clearedCacheKeys > 0) parts.push(`${res.clearedCacheKeys} browser cache buckets`);
      if (res.purgedOrphanedAttachments > 0) parts.push(`${res.purgedOrphanedAttachments} orphaned media files`);
      const msg = parts.length > 0
        ? `✓ Cleaned ${parts.join(' & ')}. Active records & restorable Recycle Bin items are intact.`
        : '✓ No browser caches or orphaned temporary files remained. Active data is intact.';
      onSuccess(msg);
      await loadStorageStats();
      onRefresh();
    } catch (e: any) {
      onError('Cache cleaning failed: ' + e?.message);
    } finally {
      setIsCleaningCache(false);
    }
  };

  const handlePurgeDefaultData = () => {
    setIsPurgeDefaultOpen(true);
  };

  const handleConfirmPurgeDefault = async () => {
    setIsPurgeDefaultOpen(false);
    try {
      const res = await purgeAllDefaultDataPermanently();
      onSuccess(`✓ All default data & sources permanently deleted (${res.purgedCount} default records removed).`);
      onRefresh();
    } catch (e: any) {
      onError('Failed to purge default data: ' + e?.message);
    }
  };

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
          Settings & Preferences
        </h1>
        <HeaderDropdown
          label={selectedSettingsSection.label}
          menuLabel="Settings submenu"
          icon={<SelectedSettingsSectionIcon className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" />}
        >
          {closeMenu => settingsSections.map(section => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                type="button"
                role="menuitem"
                aria-current={activeTab === section.id ? 'page' : undefined}
                data-settings-section={section.id}
                onClick={() => {
                  setActiveTab(section.id);
                  closeMenu();
                }}
                className={`flex w-full min-w-0 items-center gap-2 border-b-2 px-2 py-2 text-left text-sm font-semibold text-slate-700 dark:text-slate-200 ${
                  activeTab === section.id ? 'border-amber-300' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{section.label}</span>
              </button>
            );
          })}
        </HeaderDropdown>
      </div>

      {activeTab !== 'exports' && (
        <div className="settings-system-grid grid min-w-0 items-start gap-4 md:grid-cols-2">
          {activeTab === 'appearance' && (
            <div className="w-full md:col-span-2">
              <AppearanceCustomizer
                value={appearance}
                onApply={onApplyAppearance}
                onSuccess={onSuccess}
                onError={onError}
                wallpaperVideoMuted={wallpaperVideoMuted}
                onToggleWallpaperVideoSound={onToggleWallpaperVideoSound}
              />
            </div>
          )}
          <div className={activeTab === 'system' ? 'space-y-4' : 'hidden'}>
          <section className="settings-card rounded-2xl border border-slate-200/80 bg-white p-4 text-slate-900 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" />
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Storage Usage</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isAuditing}
                    onClick={handleRunIntegrityAudit}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-indigo-200 cursor-pointer disabled:opacity-50"
                    title="Integrity audit"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
                    <span>Run Integrity Audit</span>
                  </button>
                  <button
                    type="button"
                    disabled={isLoadingStorageStats}
                    onClick={() => void loadStorageStats()}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-indigo-200 cursor-pointer disabled:opacity-50"
                    title="Refresh"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoadingStorageStats ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <div className="min-w-0">
                  <span className="text-slate-500 dark:text-slate-400">Profile </span>
                  <span className="font-bold text-slate-900 dark:text-white">{isLoadingStorageStats ? '…' : storageStatsError ? 'N/A' : formatBytes(storageStats.profileUsage)}</span>
                </div>
                <div className="min-w-0">
                  <span className="text-slate-500 dark:text-slate-400">Browser </span>
                  <span className="font-bold text-slate-900 dark:text-white">{storageStats.available ? `${formatBytes(storageStats.usage)} / ${storageStats.quota > 0 ? formatBytes(storageStats.quota) : '?'}` : 'N/A'}</span>
                </div>
              </div>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-amber-100/70 dark:bg-amber-950/50">
                <div
                  className={`h-full ${storageStats.level === 'critical' ? 'bg-rose-500' : storageStats.level === 'warning' ? 'bg-amber-500' : 'bg-amber-600 dark:bg-amber-400'}`}
                  style={{ width: `${Math.min(100, Math.max(storageStats.quota > 0 ? 0.5 : 0, storageStats.percent))}%` }}
                />
              </div>
              {integrityAuditResult && (
                <div className={`mt-1.5 rounded-lg border px-2 py-1 text-[11px] ${integrityAuditResult.issues > integrityAuditResult.repaired ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200' : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200'}`} role="status">
                  {integrityAuditResult.checked.toLocaleString()} checked · {integrityAuditResult.issues.toLocaleString()} issues · {integrityAuditResult.repaired.toLocaleString()} fixed
                </div>
              )}
              {storageStatsError && (
                <p role="status" className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
                  {storageStatsError}
                </p>
              )}
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <DollarSign className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                Currency display symbol
              </h2>
              <select
                aria-label="Currency display symbol"
                value={isCustomCurrencySelected
                  || !CURRENCY_SYMBOLS.includes((settings?.currencySymbol || getCurrencySymbol()) as typeof CURRENCY_SYMBOLS[number])
                  ? 'custom'
                  : settings?.currencySymbol || getCurrencySymbol()}
                onChange={async event => {
                  const currencySymbol = event.target.value;
                  if (currencySymbol === 'custom') {
                    setIsCustomCurrencySelected(true);
                    return;
                  }
                  setIsCustomCurrencySelected(false);
                  try {
                    const appSettings = await storage.getSingleton<AppState>('appSettings') || settings;
                    if (!appSettings) throw new Error('App settings are unavailable.');
                    await storage.setSingleton('appSettings', { ...appSettings, currencySymbol }, profileId);
                    onRefresh();
                  } catch (error) {
                    onError(error instanceof Error ? error.message : 'Could not save the currency display symbol.');
                  }
                }}
                className="settings-flat-select h-9 rounded-none border-0 border-b border-slate-300 bg-transparent px-2 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:text-white"
              >
                {CURRENCY_SYMBOLS.map(symbol => (
                  <option key={symbol} value={symbol}>{symbol}</option>
                ))}
                <option value="custom">Custom</option>
              </select>
              </div>
              {isCustomCurrencySelected && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    aria-label="Custom currency symbol"
                    value={customCurrencySymbol}
                    maxLength={12}
                    onChange={event => setCustomCurrencySymbol(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void saveCustomCurrencySymbol();
                      }
                    }}

                    className="min-h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => void saveCustomCurrencySymbol()}
                    className="min-h-9 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Language + Date & Time Format — single card */}
          <section className="settings-card rounded-2xl border border-slate-200/80 bg-white p-4 text-slate-900 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Language & Format</h2>
              </div>
              <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                {LOCALE_OPTIONS.find(o => o.value === (settings?.locale || 'en'))?.label || 'English'}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Language</label>
                <select
                  aria-label="Language"
                  value={settings?.locale || 'en'}
                  onChange={e => void updateLocale(e.target.value as Locale)}
                  className="settings-flat-select mt-1 h-9 w-full rounded-none border-0 border-b border-slate-300 bg-transparent px-2 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:text-white"
                >
                  {LOCALE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Date Format</label>
                <select
                  aria-label="Date format"
                  value={settings?.dateFormat || 'DD/MM/YYYY'}
                  onChange={e => void updateAppSetting({ dateFormat: e.target.value as AppState['dateFormat'] })}
                  className="settings-flat-select mt-1 h-9 w-full rounded-none border-0 border-b border-slate-300 bg-transparent px-2 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:text-white"
                >
                  {DATE_FORMAT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Time Format</label>
                <select
                  aria-label="Time format"
                  value={settings?.timeFormat || '12h'}
                  onChange={e => void updateAppSetting({ timeFormat: e.target.value as AppState['timeFormat'] })}
                  className="settings-flat-select mt-1 h-9 w-full rounded-none border-0 border-b border-slate-300 bg-transparent px-2 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:text-white"
                >
                  <option value="12h">12-hour</option>
                  <option value="24h">24-hour</option>
                </select>
              </div>
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShortcutsExpanded(prev => !prev)}
                className="flex w-full items-center justify-between gap-2 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Keyboard className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Keyboard Shortcuts</h2>
                </div>
                {shortcutsExpanded ? (
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
              </button>
              {shortcutsExpanded && (
                <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                  {KEYBOARD_SHORTCUTS.map(shortcut => (
                    <div key={shortcut.keys} className="flex items-center justify-between gap-3 py-1">
                      <span className="text-xs text-slate-600 dark:text-slate-300">{shortcut.action}</span>
                      <kbd className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-mono font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {shortcut.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          </div>
      <div className={activeTab === 'system' ? 'w-full min-w-0 space-y-4' : 'hidden'}>
        <section className="settings-card rounded-2xl border border-slate-200/80 bg-white p-4 text-slate-900 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-5">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <Volume2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    Sound & Haptics
                  </h2>
                </div>
              </div>
              <div className="mt-2 space-y-2">
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  <div className="flex min-w-0 items-center justify-between gap-2 px-1 py-1">
                    <div className="text-[11px] font-bold leading-tight text-slate-900 dark:text-white">
                      Sound Effects
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-label="Sound Effects"
                      aria-checked={soundEnabled}
                      onClick={() => {
                        const next = !soundEnabled;
                        setSoundEnabled(next);
                        soundEngine.setSoundEnabled(next);
                        if (next) onSuccess('Sound enabled');
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-start overflow-hidden rounded-full border-0 p-0 transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                        soundEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                      style={{ position: 'relative', display: 'inline-flex', width: 36, height: 20, padding: 0, border: 0, borderRadius: 9999, overflow: 'hidden', backgroundColor: soundEnabled ? '#4f46e5' : '#64748b', backgroundImage: 'none', isolation: 'isolate' }}
                    >
                      <span
                        className="pointer-events-none"
                        style={{ position: 'absolute', left: 2, top: 2, display: 'block', width: 16, height: 16, borderRadius: 9999, background: '#fff', zIndex: 10, pointerEvents: 'none', transform: `translateX(${soundEnabled ? '16px' : '0px'})`, transition: 'transform 200ms ease-in-out', boxShadow: '0 1px 3px rgba(0,0,0,.35)' }}
                      />
                    </button>
                  </div>

                  {soundEngine.isHapticSupported() && (
                  <div className="flex min-w-0 items-center justify-between gap-2 px-1 py-1">
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold leading-tight text-slate-900 dark:text-white">
                        Haptic Vibration
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-label="Haptic Vibration"
                      aria-checked={hapticEnabled}
                      onClick={() => {
                        const next = !hapticEnabled;
                        setHapticEnabled(next);
                        soundEngine.setHapticEnabled(next);
                        if (next) onSuccess('Haptic feedback enabled');
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-start overflow-hidden rounded-full border-0 p-0 transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                        hapticEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                      style={{ position: 'relative', display: 'inline-flex', width: 36, height: 20, padding: 0, border: 0, borderRadius: 9999, overflow: 'hidden', backgroundColor: hapticEnabled ? '#4f46e5' : '#64748b', backgroundImage: 'none', isolation: 'isolate' }}
                    >
                      <span
                        className="pointer-events-none"
                        style={{ position: 'absolute', left: 2, top: 2, display: 'block', width: 16, height: 16, borderRadius: 9999, background: '#fff', zIndex: 10, pointerEvents: 'none', transform: `translateX(${hapticEnabled ? '16px' : '0px'})`, transition: 'transform 200ms ease-in-out', boxShadow: '0 1px 3px rgba(0,0,0,.35)' }}
                      />
                    </button>
                  </div>
                  )}
                </div>

                <div className="flex items-center gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">Volume</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={soundVolume}
                    disabled={!soundEnabled}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setSoundVolume(val);
                      soundEngine.setVolume(val / 100);
                    }}
                    onPointerUp={() => soundEngine.play('tap')}
                    className="flex-1 accent-indigo-600 cursor-pointer disabled:opacity-40"
                  />
                  <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-bold shrink-0 w-7 text-right">{soundVolume}%</span>
                </div>
                <div className="flex items-center justify-between gap-1 border-t border-slate-100 pt-2 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider shrink-0">Preview</span>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => soundEngine.play('taskComplete')} className="px-2 py-1 text-[10px] font-semibold text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200 cursor-pointer transition-colors">Task</button>
                    <button type="button" onClick={() => soundEngine.play('habitComplete')} className="px-2 py-1 text-[10px] font-semibold text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200 cursor-pointer transition-colors">Habit</button>
                    <button type="button" onClick={() => soundEngine.play('calcKey')} className="px-2 py-1 text-[10px] font-semibold text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200 cursor-pointer transition-colors">Key</button>
                    <button type="button" onClick={() => soundEngine.play('successChime')} className="px-2 py-1 text-[10px] font-semibold text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200 cursor-pointer transition-colors">Success</button>
                  </div>
                </div>
              </div>
        </section>

        <section className="settings-card rounded-2xl border border-slate-200/80 bg-white p-4 text-slate-900 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-5">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Notifications</h2>
            </div>
            <button
              type="button"
              role="switch"
              aria-label="Enable Notifications"
              aria-checked={settings?.notificationsEnabled ?? true}
              onClick={() => void updateAppSetting({ notificationsEnabled: !(settings?.notificationsEnabled ?? true) })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-start overflow-hidden rounded-full border-0 p-0 transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                (settings?.notificationsEnabled ?? true) ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
              style={{ position: 'relative', display: 'inline-flex', width: 36, height: 20, padding: 0, border: 0, borderRadius: 9999, overflow: 'hidden', backgroundColor: (settings?.notificationsEnabled ?? true) ? '#4f46e5' : '#64748b', backgroundImage: 'none', isolation: 'isolate' }}
            >
              <span
                className="pointer-events-none"
                style={{ position: 'absolute', left: 2, top: 2, display: 'block', width: 16, height: 16, borderRadius: 9999, background: '#fff', zIndex: 10, pointerEvents: 'none', transform: `translateX(${(settings?.notificationsEnabled ?? true) ? '16px' : '0px'})`, transition: 'transform 200ms ease-in-out', boxShadow: '0 1px 3px rgba(0,0,0,.35)' }}
              />
            </button>
          </div>
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">Quiet Hours</span>
              <div className="flex flex-1 items-center gap-2 min-w-0">
                <ThemedDateTimeInput
                  type="time"
                  aria-label="Quiet hours start"
                  value={settings?.quietHoursStart || '22:00'}
                  onChange={e => void updateAppSetting({ quietHoursStart: e.target.value })}
                  className="h-8 flex-1 min-w-0 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <span className="text-[10px] text-slate-400 shrink-0">–</span>
                <ThemedDateTimeInput
                  type="time"
                  aria-label="Quiet hours end"
                  value={settings?.quietHoursEnd || '07:00'}
                  onChange={e => void updateAppSetting({ quietHoursEnd: e.target.value })}
                  className="h-8 flex-1 min-w-0 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="border-t border-slate-100 pt-2 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-300" />
                  <span className="text-[11px] font-bold text-slate-900 dark:text-white">File Encryption</span>
                </div>
                {settings?.attachmentEncryption?.enabled && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${storage.isAttachmentEncryptionUnlocked() ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'}`}>
                    {storage.isAttachmentEncryptionUnlocked() ? 'Unlocked' : 'Locked'}
                  </span>
                )}
              </div>
              <form onSubmit={updateAttachmentEncryption}>
                <div className="flex items-center gap-2">
                  {settings?.attachmentEncryption?.enabled && isAttachmentEncryptionUnlocked ? (
                    <button type="button" onClick={lockAttachmentEncryption} disabled={isUpdatingAttachmentEncryption} className="h-8 rounded-lg border border-amber-300 px-3 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/30">Lock</button>
                  ) : (
                    <>
                      <input type="password" autoComplete="current-password" minLength={settings?.attachmentEncryption?.enabled ? undefined : 10} required value={attachmentPassphrase} onChange={e => setAttachmentPassphrase(e.target.value)} placeholder={settings?.attachmentEncryption?.enabled ? 'Passphrase' : 'Create passphrase (10+ chars)'} aria-label="Attachment encryption passphrase" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" style={{height: 36}} />
                      <button type="submit" disabled={isUpdatingAttachmentEncryption} className="shrink-0 rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-50" style={{height: 36, minHeight: 'unset', background: '#4f46e5', border: 'none', borderRadius: 8, padding: '0 12px', fontSize: 12, fontWeight: 600, color: '#fff'}}>{isUpdatingAttachmentEncryption ? '…' : settings?.attachmentEncryption?.enabled ? 'Unlock' : 'Enable'}</button>
                    </>
                  )}
                </div>
              </form>
            </div>
          </div>
        </section>
          </div>

          <div id="system-recycle-bin-section" className={activeTab === 'system' ? 'md:col-span-2' : 'hidden'}>
            <RecycleBinView
              profileId={settings?.profileId || settings?.profiles?.[0]?.id || 'om-master-profile'}
              onRefresh={onRefresh}
              onSuccess={onSuccess}
              onError={onError}
              isEmbedded={true}
            />
          </div>
        </div>
      )}

      {activeTab === 'exports' && (
        <div className="space-y-4 min-w-0">
          <UniversalDataManagerCard
            profileId={settings?.profileId || 'om-master-profile'}
            profileName="Om-LifeOS"
            onSuccess={onSuccess}
            onError={onError}
            onRefreshData={onRefresh}
          />

          <div className="rounded-2xl border border-rose-200/90 bg-rose-50/30 p-4 sm:p-4.5 dark:border-rose-950/70 dark:bg-rose-950/15 shadow-card min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-bold text-rose-700 dark:text-rose-400">Danger Zone</h2>
                <span className="text-[10px] font-semibold text-rose-600/80 dark:text-rose-400/80 rounded bg-rose-100/70 dark:bg-rose-950/60 px-1.5 py-0.5">
                  Irreversible
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isCleaningCache}
                onClick={handleCleanCache}
                className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200 cursor-pointer transition-colors disabled:opacity-50"
                title="Clear cache"
              >
                <RefreshCw className={`h-3 w-3 text-amber-600 dark:text-amber-400 ${isCleaningCache ? 'animate-spin' : ''}`} />
                <span>{isCleaningCache ? 'Cleaning…' : 'Clear Cache & Temp Files'}</span>
              </button>

              <button
                type="button"
                onClick={handlePurgeDefaultData}
                className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-rose-700 hover:text-rose-900 dark:text-rose-300 dark:hover:text-rose-200 cursor-pointer transition-colors"
                title="Purge defaults"
              >
                <Trash2 className="h-3 w-3 text-rose-600 dark:text-rose-400" />
                <span>Purge Default Data</span>
              </button>

              <button
                type="button"
                onClick={handleResetData}
                className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-rose-700 hover:text-rose-900 dark:text-rose-300 dark:hover:text-rose-200 cursor-pointer transition-colors"
                title="Reset everything"
              >
                <Trash2 className="h-3 w-3" />
                <span>Factory Reset App</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={isCleanCacheOpen}
        title="Clear Cache?"
        message="Removes cached files and orphaned media. Your data and Recycle Bin stay intact."
        confirmText="Yes, Clear Cache"
        cancelText="Cancel"
        isDanger={false}
        onConfirm={handleConfirmCleanCache}
        onCancel={() => setIsCleanCacheOpen(false)}
      />

      <ConfirmModal
        isOpen={isResetConfirmOpen}
        title="Factory Reset?"
        message="Permanently deletes all local data and reloads with fresh defaults. Export a backup first. Cloud backups are not affected."
        confirmText="Yes, Factory Reset"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={handleConfirmReset}
        onCancel={() => setIsResetConfirmOpen(false)}
      />

      <ConfirmModal
        isOpen={isPurgeDefaultOpen}
        title="Delete Default Data?"
        message="Removes all seed/default records. Your personally created data stays safe."
        confirmText="Delete Defaults"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={handleConfirmPurgeDefault}
        onCancel={() => setIsPurgeDefaultOpen(false)}
      />
    </div>
  );
};
