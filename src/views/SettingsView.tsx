import React, { useState, useEffect } from 'react';
import {
  Download, Database, Trash2, Users,
  Palette, ChevronDown, Layers, Plus, RefreshCw
} from 'lucide-react';
import {
  storage,
  generateUUID, createLocalProfile, PROFESSIONAL_SECURITY_QUESTIONS,
  validatePasswordStrength, validateSecurityQuestionAndAnswer,
  purgeAllDefaultDataPermanently, performHardAppReset, cleanOrphanedCacheAndTrash
} from '../lib/storage';
import { AppState, UserProfile } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { UniversalDataManagerCard } from '../components/UniversalDataManagerCard';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { SlideTabs } from '../components/SlideTabs';
import { RecycleBinView } from './RecycleBinView';

interface SettingsViewProps {
  settings?: AppState;
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onSelectProfile?: (id: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onRefresh,
  onSuccess,
  onError,
  theme,
  onToggleTheme,
  onSelectProfile,
}) => {
  const [activeTab, setActiveTab] = useState<'system' | 'workspaces' | 'exports'>('system');
  const [newProfileName, setNewProfileName] = useState('');
  const [protectWithPassword, setProtectWithPassword] = useState(false);
  const [newProfilePassword, setNewProfilePassword] = useState('');
  const [newProfilePasswordConfirm, setNewProfilePasswordConfirm] = useState('');
  const [newProfileHint, setNewProfileHint] = useState('');
  const [newProfileRecoveryQuestion, setNewProfileRecoveryQuestion] = useState<string>(PROFESSIONAL_SECURITY_QUESTIONS[0]);
  const [newProfileRecoveryAnswer, setNewProfileRecoveryAnswer] = useState('');
  const [storageStats, setStorageStats] = useState<{
    usage: number;
    quota: number;
    percent: number;
    level: string;
    available?: boolean;
  }>({ usage: 0, quota: 0, percent: 0, level: 'healthy', available: false });
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isPurgeDefaultOpen, setIsPurgeDefaultOpen] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [accentColor, setAccentColor] = useState<string>(settings?.accentColor || '#6366f1');
  const [isAccentDropdownOpen, setIsAccentDropdownOpen] = useState(false);

  useEffect(() => {
    if (settings?.accentColor) {
      setAccentColor(settings.accentColor);
    }
  }, [settings?.accentColor]);


  useEffect(() => {
    storage.getStorageEstimate().then(setStorageStats);
  }, []);

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;

    const appSettings = await storage.getSingleton<AppState>('appSettings') || {
      profileId: 'default',
      profiles: [],
      themeMode: 'light',
      accentColor: '#5d57c9',
      notificationsEnabled: true,
      noteCategories: ['General'],
      calcFavorites: []
    };

    const id = generateUUID();
    const newProfile: UserProfile = {
      id,
      name: newProfileName.trim(),
      email: `${newProfileName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'user'}-${id.slice(0, 8)}@omlifeos.local`,
      authType: 'local',
      createdAt: Date.now()
    };

    try {
      if (protectWithPassword) {
        const passVal = validatePasswordStrength(newProfilePassword);
        if (!passVal.isValid) {
          onError(passVal.errorMessage || 'Password must meet all complexity requirements.');
          return;
        }
        if (newProfilePassword !== newProfilePasswordConfirm) {
          onError('Password and Confirm Password do not match.');
          return;
        }
        const qaVal = validateSecurityQuestionAndAnswer(newProfileRecoveryQuestion, newProfileRecoveryAnswer, newProfilePassword);
        if (!qaVal.isValid) {
          onError(qaVal.errorMessage || 'Please provide a valid recovery answer.');
          return;
        }
        if (!newProfileHint.trim()) {
          onError('Password hint is required.');
          return;
        }
        if (newProfileHint.toLowerCase().includes(newProfilePassword.toLowerCase())) {
          onError('Password hint cannot contain the password itself.');
          return;
        }

        await createLocalProfile(appSettings, newProfile, newProfilePassword, newProfileHint, newProfileRecoveryQuestion, newProfileRecoveryAnswer);
      } else {
        await createLocalProfile(appSettings, newProfile);
      }

      onSuccess(`Workspace profile "${newProfileName}" created successfully`);
      setNewProfileName('');
      setProtectWithPassword(false);
      setNewProfilePassword('');
      setNewProfilePasswordConfirm('');
      setNewProfileHint('');
      setNewProfileRecoveryQuestion(PROFESSIONAL_SECURITY_QUESTIONS[0]);
      setNewProfileRecoveryAnswer('');
      onRefresh();
    } catch (err: any) {
      onError(err?.message || 'Unable to create workspace profile.');
    }
  };

  const handleSwitchProfile = async (id: string) => {
    if (onSelectProfile) {
      onSelectProfile(id);
      return;
    }
    const appSettings = await storage.getSingleton<AppState>('appSettings') || {
      profileId: 'default',
      profiles: [],
      themeMode: 'light',
      accentColor: '#5d57c9',
      notificationsEnabled: true,
      noteCategories: ['General'],
      calcFavorites: []
    };
    appSettings.profileId = id;
    await storage.setSingleton('appSettings', appSettings);
    storage.setActiveProfile(id);
    onSuccess('Workspace profile switched');
    onRefresh();
  };

  const handleRunIntegrityAudit = async () => {
    setIsAuditing(true);
    let totalChecked = 0;
    let issues = 0;
    let repaired = 0;

    try {
      const tasks = await storage.getAll<any>('tasks');
      const goals = await storage.getAll<any>('goals');
      const accounts = await storage.getAll<any>('financeAccounts');
      const finance = await storage.getAll<any>('finance');

      totalChecked += tasks.length + goals.length + accounts.length + finance.length;

      const goalIds = new Set(goals.map(g => g.id));
      for (const t of tasks) {
        if (t.goalId && !goalIds.has(t.goalId)) {
          issues++;
          t.goalId = null;
          await storage.put('tasks', t);
          repaired++;
        }
      }

      const acctIds = new Set(accounts.map(a => a.id));
      for (const f of finance) {
        if (f.accountId && !acctIds.has(f.accountId)) {
          issues++;
        }
      }

      const newStats = await storage.getStorageEstimate();
      setStorageStats(newStats);

      onSuccess(`Integrity check: ${totalChecked} checked, ${issues} anomalies found, ${repaired} repaired`);
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
    onSuccess('Wiping all IndexedDB databases, Cache Storage, and Service Workers...');
    await performHardAppReset();
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
        ? `✓ Cleaned ${parts.join(' & ')}. Active data & Recycle Bin are intact!`
        : '✓ Cache & temporary storage are completely clean. Active data is intact!';
      onSuccess(msg);
      const newStats = await storage.getStorageEstimate();
      setStorageStats(newStats);
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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
          Settings & Preferences
        </h1>
      </div>

      {/* Settings Navigation Tabs (Full Width Responsive Slide Tab) */}
      <div className="w-full pb-2 border-b border-slate-200 dark:border-slate-800">
        <SlideTabs
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as any)}
          tabs={[
            {
              id: 'system',
              label: 'System & Appearance',
              shortLabel: 'System',
              icon: Palette,
              badge: null
            },
            {
              id: 'workspaces',
              label: 'Workspaces',
              shortLabel: 'Workspaces',
              icon: Users,
              badge: `${settings?.profiles?.length || 1}`
            },
            {
              id: 'exports',
              label: 'Data & Backups',
              shortLabel: 'Backups',
              icon: Download,
              badge: null
            }
          ]}
        />
      </div>

      {/* Tab: System & Appearance */}
      {activeTab === 'system' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Progressive Web App Browser Install Card */}
          <div className="lg:col-span-12">
            <PWAInstallButton variant="card" />
          </div>

          {/* Appearance Card (6 cols) */}
          <div className="lg:col-span-6 flex flex-col">
            <div className="flex-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-5 flex flex-col justify-between">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                <Palette className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Appearance & Theme</h2>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-[140px]">
                  <div className="text-xs font-bold text-slate-900 dark:text-white whitespace-nowrap">Color Mode</div>
                </div>
              <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs dark:border-slate-700 dark:bg-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={theme === 'dark' ? onToggleTheme : undefined}
                  className={`rounded-lg px-3 py-1 font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    theme === 'light' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
                  }`}
                >
                  ☀ Light
                </button>
                <button
                  type="button"
                  onClick={theme === 'light' ? onToggleTheme : undefined}
                  className={`rounded-lg px-3 py-1 font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    theme === 'dark' ? 'bg-slate-700 shadow-sm text-white' : 'text-slate-500'
                  }`}
                >
                  ☾ Dark
                </button>
              </div>
            </div>

            {/* Accent Theme Colors Dropdown */}
            <div className="border-t border-slate-100 pt-4 dark:border-slate-800 relative">
              {(() => {
                const ACCENT_PRESETS = [
                  { name: 'Indigo', hex: '#6366f1' },
                  { name: 'Cobalt', hex: '#2563eb' },
                  { name: 'Sky', hex: '#0284c7' },
                  { name: 'Cyan', hex: '#06b6d4' },
                  { name: 'Teal', hex: '#0d9488' },
                  { name: 'Emerald', hex: '#10b981' },
                  { name: 'Forest', hex: '#15803d' },
                  { name: 'Lime', hex: '#84cc16' },
                  { name: 'Amber', hex: '#f59e0b' },
                  { name: 'Orange', hex: '#f97316' },
                  { name: 'Crimson', hex: '#e11d48' },
                  { name: 'Rose', hex: '#f43f5e' },
                  { name: 'Fuchsia', hex: '#d946ef' },
                  { name: 'Purple', hex: '#a855f7' },
                  { name: 'Violet', hex: '#8b5cf6' },
                  { name: 'Slate', hex: '#475569' }
                ];
                const activePreset = ACCENT_PRESETS.find(
                  p => p.hex.toLowerCase() === accentColor.toLowerCase()
                );

                return (
                  <>
                    <div className="flex items-center justify-between gap-2.5 sm:gap-3">
                      <div className="shrink-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white shrink-0">Accent Theme Highlight</div>
                      </div>

                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => setIsAccentDropdownOpen(prev => !prev)}
                          className="flex items-center gap-1.5 sm:gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-all whitespace-nowrap"
                        >
                          <span
                            className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full border border-white/40 shadow-2xs shrink-0"
                            style={{ backgroundColor: accentColor }}
                          />
                          <span>{activePreset ? activePreset.name : 'Custom'}</span>
                          <span
                            className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold text-white hidden xs:inline-block sm:inline-block"
                            style={{ backgroundColor: accentColor }}
                          >
                            {accentColor.toUpperCase()}
                          </span>
                          <ChevronDown
                            className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-150 ${
                              isAccentDropdownOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        {isAccentDropdownOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setIsAccentDropdownOpen(false)}
                            />
                            <div className="absolute right-0 top-full z-50 mt-2 w-72 sm:w-80 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                  Select Accent Theme
                                </span>
                                <span
                                  className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold text-white shadow-2xs"
                                  style={{ backgroundColor: accentColor }}
                                >
                                  {accentColor.toUpperCase()}
                                </span>
                              </div>

                              {/* 16 Curated Designer Swatches Grid inside Dropdown */}
                              <div className="grid grid-cols-4 gap-1.5 max-h-56 overflow-y-auto pr-0.5">
                                {ACCENT_PRESETS.map(acc => {
                                  const isSelected = accentColor.toLowerCase() === acc.hex.toLowerCase();
                                  return (
                                    <button
                                      key={acc.name}
                                      type="button"
                                      onClick={async () => {
                                        setAccentColor(acc.hex);
                                        document.documentElement.style.setProperty('--color-brand', acc.hex);
                                        const appSettings = await storage.getSingleton<any>('appSettings') || {};
                                        appSettings.accentColor = acc.hex;
                                        await storage.setSingleton('appSettings', appSettings);
                                        onSuccess(`${acc.name} theme accent applied`);
                                        setIsAccentDropdownOpen(false);
                                        onRefresh();
                                      }}
                                      className={`group flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-left transition-colors cursor-pointer border ${
                                        isSelected
                                          ? 'border-slate-300 bg-slate-100/90 dark:border-slate-600 dark:bg-slate-800'
                                          : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'
                                      }`}
                                      title={`${acc.name} (${acc.hex})`}
                                    >
                                      <span
                                        className="h-4 w-4 rounded-full shrink-0 flex items-center justify-center text-white text-[9px] font-bold shadow-2xs"
                                        style={{ backgroundColor: acc.hex }}
                                      >
                                        {isSelected ? '✓' : ''}
                                      </span>
                                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate">
                                        {acc.name}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Custom Hex Accent Row inside Dropdown */}
                              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">Custom:</span>
                                  <label className="relative flex items-center justify-center cursor-pointer">
                                    <input
                                      type="color"
                                      value={accentColor.startsWith('#') ? accentColor : '#6366f1'}
                                      onChange={async (e) => {
                                        const newHex = e.target.value;
                                        setAccentColor(newHex);
                                        document.documentElement.style.setProperty('--color-brand', newHex);
                                        const appSettings = await storage.getSingleton<any>('appSettings') || {};
                                        appSettings.accentColor = newHex;
                                        await storage.setSingleton('appSettings', appSettings);
                                      }}
                                      className="h-6 w-6 rounded-lg border-0 p-0 cursor-pointer overflow-hidden opacity-0 absolute inset-0"
                                      title="Choose custom hex color"
                                    />
                                    <span
                                      className="h-6 w-6 rounded-lg border border-slate-300 dark:border-slate-600 shadow-2xs block transition-transform hover:scale-110"
                                      style={{ backgroundColor: accentColor }}
                                    />
                                  </label>
                                  <input
                                    type="text"
                                    value={accentColor}
                                    onChange={async (e) => {
                                      const newHex = e.target.value;
                                      setAccentColor(newHex);
                                      if (/^#[0-9A-Fa-f]{6}$/.test(newHex)) {
                                        document.documentElement.style.setProperty('--color-brand', newHex);
                                        const appSettings = await storage.getSingleton<any>('appSettings') || {};
                                        appSettings.accentColor = newHex;
                                        await storage.setSingleton('appSettings', appSettings);
                                      }
                                    }}
                                    placeholder="#6366F1"
                                    className="h-6 w-20 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 font-mono text-[11px] uppercase text-slate-900 dark:text-white"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const defaultHex = '#6366f1';
                                    setAccentColor(defaultHex);
                                    document.documentElement.style.setProperty('--color-brand', defaultHex);
                                    const appSettings = await storage.getSingleton<any>('appSettings') || {};
                                    appSettings.accentColor = defaultHex;
                                    await storage.setSingleton('appSettings', appSettings);
                                    onSuccess('Default Indigo accent restored');
                                    setIsAccentDropdownOpen(false);
                                    onRefresh();
                                  }}
                                  className="text-[11px] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium cursor-pointer whitespace-nowrap"
                                >
                                  Reset Default
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>


          </div>
        </div>

          {/* Storage Telemetry & Quota (6 cols) */}
          <div className="lg:col-span-6 flex flex-col">
            <div className="flex-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-5 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <Database className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">Storage Health & Quota</h2>
                </div>

                <button
                  type="button"
                  disabled={isAuditing}
                  onClick={handleRunIntegrityAudit}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer shrink-0 whitespace-nowrap shadow-2xs transition-all active:scale-98"
                  title="Run database integrity check and storage refresh"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
                  <span>Run Audit</span>
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Local Browser Storage Quota</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {storageStats.quota > 0 ? `${storageStats.percent.toFixed(2)}% used` : 'Unknown'}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full ${storageStats.level === 'critical' ? 'bg-rose-500' : storageStats.level === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, Math.max(storageStats.quota > 0 ? 0.5 : 0, storageStats.percent))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>{(storageStats.usage / (1024 * 1024)).toFixed(2)} MB stored locally</span>
                  <span>
                    {storageStats.quota > 0
                      ? storageStats.quota >= 1024 * 1024 * 1024
                        ? `${(storageStats.quota / (1024 * 1024 * 1024)).toFixed(2)} GB browser quota`
                        : `${(storageStats.quota / (1024 * 1024)).toFixed(0)} MB browser quota`
                      : 'Browser quota unavailable'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recycle Bin & Deletion Guard (Positioned at the end of System & Appearance) */}
          <div className="lg:col-span-12" id="system-recycle-bin-section">
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

      {/* Tab: Workspaces */}
      {activeTab === 'workspaces' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 min-w-0">
          {/* Left Column: Active Workspaces */}
          <div className="lg:col-span-6 space-y-6 min-w-0">
            {/* Active Workspace Selector */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 min-w-0">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      Active Workspaces
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Isolated environments & local databases
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {(settings?.profiles || []).length} Total
                </span>
              </div>

              <div className="mt-4 space-y-2.5">
                {(settings?.profiles || []).map(p => {
                  const isCurrent = p.id === settings?.profileId;
                  const initial = (p.name || 'W').charAt(0).toUpperCase();
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between gap-3 rounded-2xl p-3.5 sm:p-4 border transition-all ${
                        isCurrent
                          ? 'border-indigo-500/80 bg-indigo-50/40 shadow-xs dark:border-indigo-500/40 dark:bg-indigo-950/30'
                          : 'border-slate-100 bg-slate-50/40 hover:bg-white hover:border-slate-200 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:bg-slate-850'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold text-xs ${
                            isCurrent
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {p.name}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                            Created {new Date(p.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {isCurrent ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-semibold text-white shadow-xs">
                          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                          Current
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSwitchProfile(p.id)}
                          className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500/60 dark:hover:text-indigo-300 cursor-pointer transition-colors"
                        >
                          Switch
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Create New Workspace Form */}
          <div className="lg:col-span-6 space-y-6 min-w-0">
            <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 min-w-0">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5 dark:border-slate-800">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Create New Workspace
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Add an isolated profile with protected credentials
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateProfile} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Workspace Name <span className="text-indigo-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newProfileName}
                    onChange={e => setNewProfileName(e.target.value)}
                    placeholder="e.g. Venture Operations, Family, Personal"
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-hidden"
                  />
                </div>

                {/* Optional Password Protection Checkbox */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-850/60 space-y-2.5">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Protect with Password (Optional)
                    </span>
                    <input
                      type="checkbox"
                      checked={protectWithPassword}
                      onChange={e => setProtectWithPassword(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 bg-white text-indigo-600 focus:ring-0 dark:border-slate-600 dark:bg-slate-700 cursor-pointer"
                    />
                  </label>

                  {!protectWithPassword && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Password is off. You can switch and access this workspace instantly with one click.
                    </p>
                  )}

                  {protectWithPassword && (
                    <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                            Password
                          </label>
                          <input
                            type="password"
                            required={protectWithPassword}
                            value={newProfilePassword}
                            onChange={e => setNewProfilePassword(e.target.value)}
                            placeholder="Min 8 chars, 1 num & symbol"
                            className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                            Confirm Password
                          </label>
                          <input
                            type="password"
                            required={protectWithPassword}
                            value={newProfilePasswordConfirm}
                            onChange={e => setNewProfilePasswordConfirm(e.target.value)}
                            placeholder="Repeat password"
                            className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-hidden"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          Password Hint / Clue
                        </label>
                        <input
                          type="text"
                          required={protectWithPassword}
                          value={newProfileHint}
                          onChange={e => setNewProfileHint(e.target.value)}
                          placeholder="Hint or reminder (cannot contain the password)"
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          Security Recovery Question
                        </label>
                        <select
                          value={newProfileRecoveryQuestion}
                          onChange={e => setNewProfileRecoveryQuestion(e.target.value)}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer focus:outline-hidden"
                        >
                          {PROFESSIONAL_SECURITY_QUESTIONS.map(q => (
                            <option key={q} value={q}>{q}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          Confidential Recovery Answer
                        </label>
                        <input
                          type="text"
                          required={protectWithPassword}
                          value={newProfileRecoveryAnswer}
                          onChange={e => setNewProfileRecoveryAnswer(e.target.value)}
                          placeholder="Min 3 characters"
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-hidden"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 active:scale-[0.99] transition-all shadow-xs cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Workspace</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Universal Data Manager, Backups & System Maintenance */}
      {activeTab === 'exports' && (
        <div className="space-y-4 min-w-0">
          {/* Section 1: Universal Data Manager (Export & Import) */}
          <UniversalDataManagerCard
            profileId={settings?.profileId || settings?.profiles?.[0]?.id || 'om-master-profile'}
            profileName={settings?.profiles?.find(p => p.id === settings?.profileId)?.name || settings?.profiles?.[0]?.name || 'Primary Workspace'}
            onSuccess={onSuccess}
            onError={onError}
            onRefreshData={onRefresh}
          />

          {/* Section 2: Danger Zone & System Maintenance (Compact) */}
          <div className="rounded-2xl border border-rose-200/90 bg-rose-50/30 p-4 sm:p-4.5 dark:border-rose-950/70 dark:bg-rose-950/15 shadow-xs min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 shadow-2xs hover:bg-amber-50 hover:text-amber-900 dark:border-amber-900/60 dark:bg-slate-800 dark:text-amber-300 dark:hover:bg-amber-950/40 cursor-pointer transition-all active:scale-98 disabled:opacity-50"
                title="Safely remove browser cache and orphaned temporary files without deleting active data or recycle bin items"
              >
                <RefreshCw className={`h-3 w-3 text-amber-600 dark:text-amber-400 ${isCleaningCache ? 'animate-spin' : ''}`} />
                <span>{isCleaningCache ? 'Cleaning…' : 'Clear Cache & Temp Files'}</span>
              </button>

              <button
                type="button"
                onClick={handlePurgeDefaultData}
                className="flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-2xs hover:bg-rose-50 hover:text-rose-900 dark:border-rose-900/60 dark:bg-slate-800 dark:text-rose-300 dark:hover:bg-rose-950/40 cursor-pointer transition-all active:scale-98"
                title="Permanently delete all default/seed records and sources"
              >
                <Trash2 className="h-3 w-3 text-rose-600 dark:text-rose-400" />
                <span>Purge Default Data</span>
              </button>

              <button
                type="button"
                onClick={handleResetData}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-rose-500 cursor-pointer transition-all active:scale-98"
              >
                <Trash2 className="h-3 w-3" />
                <span>Reset Database</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLEAR CACHE CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={isCleanCacheOpen}
        title="Clear Cache & Temporary Files?"
        message="This will wipe browser Cache Storage, Service Worker offline caches, and orphaned media files. Your active workspace data and Recycle Bin items will remain 100% safe and intact."
        confirmText="Yes, Clear Cache"
        cancelText="Cancel"
        isDanger={false}
        onConfirm={handleConfirmCleanCache}
        onCancel={() => setIsCleanCacheOpen(false)}
      />

      {/* DANGER RESET CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        title="Reset Entire Database?"
        message="DANGER: This will permanently delete all tasks, notes, habits, routines, journals, and financial records from your local storage. This action cannot be undone."
        confirmText="Yes, Clear Everything"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={handleConfirmReset}
        onCancel={() => setIsResetConfirmOpen(false)}
      />

      {/* PURGE DEFAULT CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={isPurgeDefaultOpen}
        title="Permanently Delete All Default Data?"
        message="This will scan all database tables and permanently remove any default/seed tasks, routines, habits, goals, notes, and alarms. Any records you personally created will be safely preserved."
        confirmText="Permanently Delete Default Data"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={handleConfirmPurgeDefault}
        onCancel={() => setIsPurgeDefaultOpen(false)}
      />
    </div>
  );
};
