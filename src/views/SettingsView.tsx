import React, { useState, useRef, useEffect } from 'react';
import {
  Settings, Download, Upload, Trash2, Edit3,
  Palette, Users, ShieldCheck, Check, Cloud, RefreshCw,
  ExternalLink, UserCheck, Shield
} from 'lucide-react';
import { User } from 'firebase/auth';
import { AppState, UserProfile } from '../types';
import { storage, generateUUID } from '../lib/storage';
import { ACCENT_PRESETS, applyAccentTheme, getSavedAccentTheme } from '../lib/themeEngine';

interface SettingsViewProps {
  settings?: AppState;
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onSelectProfile: (id: string) => void;
  currentUser?: User | null;
  onSignOut?: () => void;
  onOpenDriveSyncModal?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onRefresh,
  onSuccess,
  theme,
  onToggleTheme,
  onSelectProfile,
  currentUser,
  onSignOut,
  onOpenDriveSyncModal
}) => {
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [newProfileName, setNewProfileName] = useState('');
  const [accentColor, setAccentColor] = useState(() => settings?.accentColor || getSavedAccentTheme());
  const [isExporting, setIsExporting] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings?.accentColor) {
      setAccentColor(settings.accentColor);
    }
  }, [settings?.accentColor]);

  const handleApplyAccent = async (hex: string) => {
    setAccentColor(hex);
    applyAccentTheme(hex);
    const current = settings || (await storage.getSingleton<any>('appSettings')) || {};
    await storage.setSingleton('appSettings', { ...current, accentColor: hex });
    onSuccess('Theme accent updated');
    onRefresh();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim() || !settings) return;
    const cleanName = newProfileName.trim();

    if (editingProfileId) {
      const updatedProfiles = settings.profiles.map(p =>
        p.id === editingProfileId
          ? {
              ...p,
              name: cleanName,
              email: `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}@omlifeos.local`,
              avatarChar: cleanName.charAt(0).toUpperCase()
            }
          : p
      );
      await storage.setSingleton('appSettings', { ...settings, profiles: updatedProfiles });
      onSuccess(`Workspace profile "${cleanName}" updated`);
      setEditingProfileId(null);
    } else {
      const newProfile: UserProfile = {
        id: generateUUID(),
        name: cleanName,
        email: `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}@omlifeos.local`,
        role: 'Member',
        avatarChar: cleanName.charAt(0).toUpperCase(),
        avatarColor: accentColor,
        createdAt: Date.now()
      };
      await storage.setSingleton('appSettings', { ...settings, profiles: [...settings.profiles, newProfile] });
      onSuccess(`Workspace profile "${cleanName}" created`);
    }

    setNewProfileName('');
    onRefresh();
  };

  const handleEditProfile = (p: UserProfile) => {
    setEditingProfileId(p.id);
    setNewProfileName(p.name);
  };

  const handleDeleteProfile = async (id: string) => {
    if (!settings || settings.profiles.length <= 1) {
      onSuccess('Cannot delete the only active workspace profile');
      return;
    }
    const remaining = settings.profiles.filter(p => p.id !== id);
    const nextActiveId = settings.profileId === id ? remaining[0].id : settings.profileId;
    await storage.setSingleton('appSettings', {
      ...settings,
      profileId: nextActiveId,
      profiles: remaining
    });
    if (editingProfileId === id) {
      setEditingProfileId(null);
      setNewProfileName('');
    }
    onSuccess('Workspace profile deleted');
    onRefresh();
  };

  const handleDownloadBackup = async () => {
    setIsExporting(true);
    try {
      const json = await storage.exportFullBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `om-lifeos-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onSuccess('Full workspace backup downloaded (.json)');
    } catch {
      onSuccess('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const count = await storage.importFullBackup(text);
      onSuccess(`Successfully restored ${count} records from backup!`);
      onRefresh();
    } catch {
      onSuccess('Error: Failed to parse backup file.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleHardReset = async () => {
    setIsResetConfirmOpen(false);
    await storage.clearAllData();
    onSuccess('Database cleared. Reloading with clean state...');
    setTimeout(() => window.location.reload(), 1000);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            Settings, Profiles & Sovereignty
          </h1>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Local-first sovereignty, theme appearance, multi-user profiles, and complete JSON backups.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Appearance & Accent Palette (6 cols) */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <Palette className="h-4 w-4 text-indigo-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Appearance & Aesthetics</h2>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Color Mode</div>
              <div className="text-[11px] text-slate-400">Current: {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</div>
            </div>
            <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={theme === 'dark' ? onToggleTheme : undefined}
                className={`rounded-lg px-3 py-1 font-semibold transition-all cursor-pointer ${
                  theme === 'light' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
                }`}
              >
                Light
              </button>
              <button
                type="button"
                onClick={theme === 'light' ? onToggleTheme : undefined}
                className={`rounded-lg px-3 py-1 font-semibold transition-all cursor-pointer ${
                  theme === 'dark' ? 'bg-slate-700 shadow-xs text-white' : 'text-slate-500'
                }`}
              >
                Dark
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-900 dark:text-white">Accent Theme Highlight</label>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {ACCENT_PRESETS.find(a => a.hex.toLowerCase() === accentColor.toLowerCase())?.name || 'Active'}
              </span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {ACCENT_PRESETS.map(acc => {
                const isSelected = accentColor.toLowerCase() === acc.hex.toLowerCase();
                return (
                  <button
                    key={acc.name}
                    type="button"
                    onClick={() => handleApplyAccent(acc.hex)}
                    className={`h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                      isSelected ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-slate-100 scale-105 border-transparent shadow-xs' : 'border-slate-200 dark:border-slate-700 hover:scale-105'
                    }`}
                    style={{ backgroundColor: acc.hex }}
                    title={acc.name}
                  >
                    {isSelected && <Check className="h-4 w-4 text-white stroke-[3] drop-shadow-xs" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Multi-Profile Workspaces (6 cols) */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Workspaces & Profiles</h2>
            </div>
            {editingProfileId && (
              <button
                type="button"
                onClick={() => { setEditingProfileId(null); setNewProfileName(''); }}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div className="space-y-2">
            {(settings?.profiles || []).map(p => {
              const isCurrent = p.id === settings?.profileId;
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                    isCurrent ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30' : 'border-slate-100 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {p.photoURL ? (
                      <img
                        src={p.photoURL}
                        alt=""
                        className="h-8 w-8 rounded-lg object-cover shrink-0 ring-1 ring-slate-200 dark:ring-slate-700"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0"
                        style={{ backgroundColor: p.avatarColor || '#6366f1' }}
                      >
                        {p.avatarChar || 'G'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white text-xs truncate flex items-center gap-1.5">
                        <span>{p.name}</span>
                        {currentUser && (currentUser.uid === p.id || currentUser.email === p.email) && (
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.2 rounded font-semibold">
                            Google Verified
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{p.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isCurrent ? (
                      <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-bold text-white">Active</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelectProfile(p.id)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                      >
                        Switch
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleEditProfile(p)}
                      className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                      title="Edit profile"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    {(settings?.profiles.length || 0) > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteProfile(p.id)}
                        className="p-1 text-slate-400 hover:text-rose-500 rounded cursor-pointer"
                        title="Delete profile"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleSaveProfile} className="pt-2 border-t border-slate-100 dark:border-slate-800 flex gap-2">
            <input
              type="text"
              required
              placeholder={editingProfileId ? 'Rename Workspace Profile...' : 'New Workspace Name...'}
              value={newProfileName}
              onChange={e => setNewProfileName(e.target.value)}
              className="flex-1 h-9 rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <button
              type="submit"
              className="px-3.5 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-500 cursor-pointer"
            >
              {editingProfileId ? 'Update' : '+ Create'}
            </button>
          </form>
        </div>

        {/* Google Drive Cloud Synchronization Card */}
        <div className="lg:col-span-12 rounded-2xl border border-indigo-200/90 bg-indigo-50/40 p-5 sm:p-6 shadow-xs dark:border-indigo-900/50 dark:bg-indigo-950/20 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100 pb-3.5 dark:border-indigo-900/40">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
                <Cloud className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Google Drive Cloud Synchronization
                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    Live
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Connect any Google account to sync, backup, and restore your LifeOS database directly into your personal Google Drive.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenDriveSyncModal}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white px-4 py-2.5 text-xs font-bold shadow-xs cursor-pointer transition-all shrink-0"
            >
              <Cloud className="h-4 w-4" />
              <span>{currentUser ? 'Manage Google Drive Sync' : 'Sign in & Connect Google Drive'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-indigo-100 bg-white/90 p-3.5 dark:border-indigo-900/30 dark:bg-slate-900/80">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Google Account</div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 truncate flex items-center gap-1.5">
                {currentUser ? (
                  <>
                    <UserCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span className="truncate">{currentUser.email || currentUser.displayName}</span>
                  </>
                ) : (
                  <span className="text-slate-400 font-normal">Not Connected</span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-indigo-100 bg-white/90 p-3.5 dark:border-indigo-900/30 dark:bg-slate-900/80">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Backup Storage</div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                <span>Private Google Drive Folder</span>
              </div>
            </div>

            <div className="rounded-xl border border-indigo-100 bg-white/90 p-3.5 dark:border-indigo-900/30 dark:bg-slate-900/80">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Sync Sovereignty</div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Zero Server Storage · Direct v3 REST</span>
              </div>
            </div>
          </div>
        </div>

        {/* Data Sovereignty & Backup Management */}
        <div className="lg:col-span-12 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Data Sovereignty, Atomic Export & Restore
            </h2>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-3xl">
            Om-LifeOS stores 100% of your records locally inside your browser's IndexedDB. You can export complete atomic backups anytime or restore from a previously downloaded JSON snapshot.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <button
              type="button"
              onClick={handleDownloadBackup}
              disabled={isExporting}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white p-3 text-xs font-bold shadow-xs cursor-pointer active:scale-98 transition-all"
            >
              <Download className="h-4 w-4" />
              <span>{isExporting ? 'Exporting...' : 'Export Full JSON Backup'}</span>
            </button>

            <label className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 text-slate-700 dark:text-slate-200 p-3 text-xs font-bold cursor-pointer transition-all">
              <Upload className="h-4 w-4" />
              <span>Restore from Backup File</span>
              <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
            </label>

            <button
              type="button"
              onClick={() => setIsResetConfirmOpen(true)}
              className="flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 p-3 text-xs font-bold cursor-pointer transition-all"
            >
              <Trash2 className="h-4 w-4" />
              <span>Clear & Reset Database</span>
            </button>
          </div>
        </div>
      </div>

      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="w-full max-w-sm rounded-3xl border border-rose-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <Trash2 className="h-5 w-5" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Clear All Data?</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              This will permanently delete all tasks, notes, habits, journals, and financial records from this device.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleHardReset}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 shadow-xs cursor-pointer"
              >
                Yes, Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
