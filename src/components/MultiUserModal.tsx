import React, { useState } from 'react';
import {
  X, Users, UserPlus, ShieldCheck,
  RefreshCw, Download, Upload
} from 'lucide-react';
import { UserProfile, AppState } from '../types';
import {
  storage, generateUUID, createLocalProfile, deleteLocalProfile,
  PROFESSIONAL_SECURITY_QUESTIONS, validatePasswordStrength, validateSecurityQuestionAndAnswer,
  universalDataManager, UniversalValidationResult
} from '../lib/storage';
import { ConfirmModal } from './ConfirmModal';

interface MultiUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  appSettings?: AppState;
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onSelectProfile?: (id: string) => void;
}

export const MultiUserModal: React.FC<MultiUserModalProps> = ({
  isOpen,
  onClose,
  appSettings,
  onRefresh,
  onSuccess,
  onError,
  onSelectProfile
}) => {
  const [activeTab, setActiveTab] = useState<'profiles' | 'vault'>('profiles');

  // New Profile Form
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileRole, setNewProfileRole] = useState('Family Member');
  const [protectWithPassword, setProtectWithPassword] = useState(false);
  const [newProfilePassword, setNewProfilePassword] = useState('');
  const [newProfilePasswordConfirm, setNewProfilePasswordConfirm] = useState('');
  const [newProfileHint, setNewProfileHint] = useState('');
  const [newProfileRecoveryQuestion, setNewProfileRecoveryQuestion] = useState<string>(PROFESSIONAL_SECURITY_QUESTIONS[0]);
  const [newProfileRecoveryAnswer, setNewProfileRecoveryAnswer] = useState('');

  const [isAuditing, setIsAuditing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [pendingRestoreValidation, setPendingRestoreValidation] = useState<UniversalValidationResult | null>(null);

  if (!isOpen) return null;

  const profiles = appSettings?.profiles || [];
  const currentProfileId = appSettings?.profileId || profiles[0]?.id;
  const currentUser = appSettings?.currentUser;

  const handleSwitchProfile = async (profileId: string) => {
    try {
      if (onSelectProfile) {
        onSelectProfile(profileId);
        onClose();
        return;
      }
      const settings = (await storage.getSingleton<AppState>('appSettings')) || ({} as AppState);
      settings.profileId = profileId;
      if (settings.profiles) {
        settings.profiles = settings.profiles.map(p => ({
          ...p,
          isCurrent: p.id === profileId
        }));
      }
      const switchedProfile = settings.profiles?.find(p => p.id === profileId);
      if (switchedProfile) {
        settings.currentUser = {
          name: switchedProfile.name,
          email: switchedProfile.email,
          provider: switchedProfile.authType || 'local'
        };
      }
      await storage.setSingleton('appSettings', settings);
      storage.setActiveProfile(profileId);
      try {
        sessionStorage.setItem('om_session_unlocked', profileId);
        localStorage.setItem('om_unlocked_profile', profileId);
      } catch {}
      onSuccess(`Switched to workspace: ${switchedProfile?.name || 'Workspace'}`);
      onRefresh();
      onClose();
    } catch (e: any) {
      onError(`Failed to switch profile: ${e.message}`);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;

    try {
      const settings = (await storage.getSingleton<AppState>('appSettings')) || ({} as AppState);
      const now = Date.now();
      const cleanSlug = newProfileName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const colors = ['#7c3aed', '#059669', '#ea580c', '#0284c7', '#db2777', '#4f46e5'];
      const avatarColor = colors[(settings.profiles?.length || 0) % colors.length];
      const avatarChar = newProfileName.trim().charAt(0).toUpperCase();
      const newId = generateUUID();
      const newProf: UserProfile = {
        id: newId,
        name: newProfileName.trim(),
        role: newProfileRole,
        email: `${cleanSlug || 'user'}-${newId.slice(0, 8)}@omlifeos.local`,
        avatarColor,
        avatarChar,
        authType: 'local',
        isCurrent: false,
        createdAt: now
      };

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

        await createLocalProfile(settings, newProf, newProfilePassword, newProfileHint, newProfileRecoveryQuestion, newProfileRecoveryAnswer);
      } else {
        await createLocalProfile(settings, newProf);
      }

      onSuccess(`User profile "${newProfileName}" created successfully`);
      setNewProfileName('');
      setProtectWithPassword(false);
      setNewProfilePassword('');
      setNewProfilePasswordConfirm('');
      setNewProfileHint('');
      setNewProfileRecoveryQuestion(PROFESSIONAL_SECURITY_QUESTIONS[0]);
      setNewProfileRecoveryAnswer('');
      onRefresh();
    } catch (e: any) {
      onError(`Failed to create profile: ${e.message}`);
    }
  };

  const handleDeleteProfile = (profileId: string, profileName: string) => {
    setDeleteTarget({ id: profileId, name: profileName });
  };

  const handleConfirmDeleteProfile = async () => {
    if (!deleteTarget) return;
    const { id, name } = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteLocalProfile(id);
      onSuccess(`Profile "${name}" deleted.`);
      onRefresh();
    } catch (e: any) {
      onError(e.message);
    }
  };


  const handleExportFullBackup = async () => {
    try {
      const activeProfile = profiles.find(p => p.id === currentProfileId);
      const res = await universalDataManager.exportUniversalData('omlifeos', {
        profileId: currentProfileId || 'om-master-profile',
        profileName: activeProfile?.name || 'Primary Workspace',
        includeFullMedia: true
      });
      onSuccess(`✓ 10-Year Long Life vault snapshot (.omlifeos) downloaded (${res.recordCount} records)!`);
    } catch (e: any) {
      onError(`Backup failed: ${e.message}`);
    }
  };

  const handleImportFullBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const validation = await universalDataManager.validateImport(file, currentProfileId);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid file format.');
      }
      setPendingRestoreValidation(validation);
    } catch (err: any) {
      onError(`Validation failed: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestoreValidation) return;
    const validation = pendingRestoreValidation;
    setPendingRestoreValidation(null);

    try {
      const activeProfile = profiles.find(p => p.id === currentProfileId);
      const res = await universalDataManager.restoreValidatedData(validation, {
        mode: 'replace_workspace',
        targetProfileId: currentProfileId || 'om-master-profile',
        targetProfileName: activeProfile?.name || 'Primary Workspace'
      });
      onSuccess(`✓ Restored ${res.restoredRecordCount} record(s) safely!`);
      onRefresh();
    } catch (err: any) {
      onError(`Restore failed: ${err.message}`);
    }
  };

  const handleRunHealthCheck = async () => {
    setIsAuditing(true);
    try {
      const res = await storage.auditIntegrity();
      onSuccess(`Storage healthy: verified ${res.checked} records with 0 corruption.`);
    } catch (e: any) {
      onError(`Health check failed: ${e.message}`);
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm transition-all animate-in fade-in">
      <div className="w-full max-w-md max-h-[92vh] flex flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Top Header - Matches uploaded screenshot */}
        <div className="flex items-start justify-between p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400 shrink-0">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Multi-User Profiles &<br />Vault Backups
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                Shared family spaces, user workspaces & atomic vault snapshots
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-4 pt-2 gap-1 overflow-x-auto whitespace-nowrap shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('profiles')}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'profiles'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            Profiles ({profiles.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('vault')}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'vault'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            10-Yr Vault & Backups
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: PROFILES & WORKSPACES (Exact layout from uploaded image) */}
          {activeTab === 'profiles' && (
            <div className="space-y-4">
              {/* Active User Profiles Count Header */}
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                ACTIVE USER PROFILES ({profiles.length})
              </div>

              {/* Profile Cards */}
              <div className="space-y-2.5">
                {profiles.map(prof => {
                  const isCurrent = prof.id === currentProfileId;
                  const char = prof.avatarChar || prof.name.charAt(0).toUpperCase();
                  const bg = prof.avatarColor || (isCurrent ? '#7c3aed' : '#059669');

                  return (
                    <div
                      key={prof.id}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                        isCurrent
                          ? 'border-indigo-500/80 bg-indigo-50/20 dark:border-indigo-500/60 dark:bg-indigo-950/20 shadow-xs'
                          : 'border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        {/* Avatar Circle with letter inside */}
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white font-bold text-sm shadow-xs"
                          style={{ backgroundColor: bg }}
                        >
                          {char}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                              {prof.name}
                            </span>
                            {isCurrent && (
                              <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                                Active Now
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            <span>{prof.role || 'Member'}</span>
                            <span className="mx-1">·</span>
                            <span className="font-mono">{prof.email || 'local@omlifeos.local'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Action Button */}
                      <div className="shrink-0">
                        {isCurrent ? (
                          <button
                            type="button"
                            disabled
                            className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs cursor-default"
                          >
                            Current
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSwitchProfile(prof.id)}
                            className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all"
                          >
                            Switch
                          </button>
                        )}
                        {profiles.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteProfile(prof.id, prof.name)}
                            className="ml-1 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Create Additional User Profile Box */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-3 mt-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                  <UserPlus className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Create Additional User Profile</span>
                </div>

                <form onSubmit={handleCreateProfile} className="space-y-2.5">
                  <input
                    type="text"
                    required
                    value={newProfileName}
                    onChange={e => setNewProfileName(e.target.value)}
                    placeholder="Profile Name (e.g. Suman, Work Studio)"
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white placeholder:text-slate-400"
                  />

                  <select
                    value={newProfileRole}
                    onChange={e => setNewProfileRole(e.target.value)}
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="Family Member">Family Member</option>
                    <option value="Team Member">Team Member</option>
                    <option value="Personal">Personal</option>
                    <option value="Executive">Executive</option>
                    <option value="Guest / Student">Guest / Student</option>
                  </select>

                  <div className="rounded-xl border border-slate-200 bg-white/70 p-2.5 dark:border-slate-700 dark:bg-slate-800/60 space-y-2">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Protect with Password (Optional)
                      </span>
                      <input
                        type="checkbox"
                        checked={protectWithPassword}
                        onChange={e => setProtectWithPassword(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                    </label>

                    {protectWithPassword && (
                      <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <input
                          type="password"
                          required={protectWithPassword}
                          value={newProfilePassword}
                          onChange={e => setNewProfilePassword(e.target.value)}
                          placeholder="Password (Min 8 chars, 1 num & symbol)"
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                        <input
                          type="password"
                          required={protectWithPassword}
                          value={newProfilePasswordConfirm}
                          onChange={e => setNewProfilePasswordConfirm(e.target.value)}
                          placeholder="Confirm Password"
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                        <input
                          type="text"
                          required={protectWithPassword}
                          value={newProfileHint}
                          onChange={e => setNewProfileHint(e.target.value)}
                          placeholder="Password Hint / Clue"
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                        <div className="space-y-1">
                          <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Security Recovery Question</label>
                          <select
                            value={newProfileRecoveryQuestion}
                            onChange={e => setNewProfileRecoveryQuestion(e.target.value)}
                            className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
                          >
                            {PROFESSIONAL_SECURITY_QUESTIONS.map(q => (
                              <option key={q} value={q}>{q}</option>
                            ))}
                          </select>
                        </div>
                        <input
                          type="text"
                          required={protectWithPassword}
                          value={newProfileRecoveryAnswer}
                          onChange={e => setNewProfileRecoveryAnswer(e.target.value)}
                          placeholder="Confidential Recovery Answer"
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 active:scale-98 transition-all"
                  >
                    + Add User Profile
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: 10-YR VAULT & ATOMIC SNAPSHOTS */}
          {activeTab === 'vault' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      10-Year Durability & Atomic Export
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Export complete vault snapshot to retain data independently of any browser or operating system for decades.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleExportFullBackup}
                    className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 px-3 text-xs font-semibold text-white hover:bg-indigo-500 active:scale-98 transition-all shadow-2xs cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export .omlifeos Vault</span>
                  </button>

                  <label className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer active:scale-98 transition-all shadow-2xs">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Restore Vault File</span>
                    <input
                      type="file"
                      accept=".omlifeos,.json"
                      onChange={handleImportFullBackup}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                  <button
                    type="button"
                    disabled={isAuditing}
                    onClick={handleRunHealthCheck}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isAuditing ? 'animate-spin text-indigo-500' : 'text-slate-500'}`} />
                    <span>Run Database Integrity Self-Healing Audit</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Profile Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete Local Profile?"
        message={`Delete local profile "${deleteTarget?.name}"? Its profile-owned app records will also be permanently deleted from this device.`}
        confirmText="Delete Profile"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={handleConfirmDeleteProfile}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Restore Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(pendingRestoreValidation)}
        title="Confirm Safe Vault Restore"
        message={`Restore ${pendingRestoreValidation?.totalActiveRecords} records from this backup?`}
        confirmText="Execute Safe Restore"
        cancelText="Cancel"
        isDanger={false}
        onConfirm={handleConfirmRestore}
        onCancel={() => setPendingRestoreValidation(null)}
      />
    </div>
  );
};
