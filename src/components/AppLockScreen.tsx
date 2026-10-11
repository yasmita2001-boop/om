import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  Key,
  Plus,
  Check,
  ArrowRight,
  FolderDown,
  Layers,
  Sparkles,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { AppState, UserProfile } from '../types';
import {
  storage,
  generateUUID,
  PROFESSIONAL_SECURITY_QUESTIONS,
  validatePasswordStrength,
  validateSecurityQuestionAndAnswer,
  getProfileSecurityInfo,
  setProfileCredentials,
  resetProfilePassword,
  removeProfilePassword,
  createLocalProfile,
  verifyProfilePassword,
  verifyProfileRecoveryAnswer
} from '../lib/storage';

function PasswordRequirementBadge({ met, label }: { met: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
        met
          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/80'
          : 'bg-slate-800 text-slate-400 border border-slate-700/70'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${met ? 'bg-emerald-400' : 'bg-slate-500'}`} />
      {label}
    </span>
  );
}

function PasswordStrengthMeter({ password }: { password: string }) {
  const result = validatePasswordStrength(password);
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2 space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-400 font-medium">Password Requirements:</span>
        <span className={`font-bold ${result.isValid ? 'text-emerald-400' : 'text-amber-400'}`}>
          {result.isValid ? '✓ Strong & Valid' : 'Mixed Character Required'}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        <PasswordRequirementBadge met={result.hasMinLength} label="8+ Chars" />
        <PasswordRequirementBadge met={result.hasUppercase} label="A-Z (Caps)" />
        <PasswordRequirementBadge met={result.hasLowercase} label="a-z (Small)" />
        <PasswordRequirementBadge met={result.hasNumber} label="0-9 (Number)" />
        <PasswordRequirementBadge met={result.hasSymbol} label="Symbol (@#$)" />
      </div>
    </div>
  );
}

export interface AppLockScreenProps {
  settings: AppState;
  onUnlocked: (profileId: string) => void;
  onSettingsReloaded?: (nextSettings: AppState) => void;
}

export const AppLockScreen: React.FC<AppLockScreenProps> = ({
  settings,
  onUnlocked,
  onSettingsReloaded
}) => {
  const profiles = settings.profiles || [
    {
      id: settings.profileId || 'om-master-profile',
      name: 'Primary Workspace',
      createdAt: Date.now()
    } as UserProfile
  ];
  const initialProfile = profiles.find(p => p.id === settings.profileId) || profiles[0];

  const [activeTab, setActiveTab] = useState<'workspaces' | 'create'>('workspaces');
  const [selectedProfileId, setSelectedProfileId] = useState(initialProfile?.id || profiles[0]?.id || '');
  const [password, setPassword] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  const [hint, setHint] = useState('');
  const [question, setQuestion] = useState('');
  const [recoveryAnswer, setRecoveryAnswer] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [newHint, setNewHint] = useState('');

  // Create Workspace form state (password is OPTIONAL!)
  const [createName, setCreateName] = useState('');
  const [protectWithPassword, setProtectWithPassword] = useState(false);
  const [createPassword, setCreatePassword] = useState('');
  const [createPasswordConfirm, setCreatePasswordConfirm] = useState('');
  const [createHint, setCreateHint] = useState('');
  const [createQuestion, setCreateQuestion] = useState<string>(PROFESSIONAL_SECURITY_QUESTIONS[0]);
  const [createRecoveryAnswer, setCreateRecoveryAnswer] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  // Track password status for all profiles for quick visual indicators
  const [profileSecurityMap, setProfileSecurityMap] = useState<Record<string, boolean>>({});

  const loadAllProfileSecurity = async () => {
    const map: Record<string, boolean> = {};
    for (const p of profiles) {
      const info = await getProfileSecurityInfo(p.id);
      map[p.id] = Boolean(info?.credentialsReady);
    }
    setProfileSecurityMap(map);
  };

  const loadSelectedProfileSecurity = async (id: string) => {
    const info = await getProfileSecurityInfo(id);
    setHasPassword(Boolean(info?.credentialsReady));
    setHint(info?.passwordHint || '');
    setQuestion(info?.recoveryQuestion || '');
    setPassword('');
    setError('');
  };

  useEffect(() => {
    loadAllProfileSecurity();
    if (selectedProfileId) {
      loadSelectedProfileSecurity(selectedProfileId);
    }
  }, [selectedProfileId, settings]);

  const unlockWorkspace = (targetId: string) => {
    try {
      sessionStorage.setItem('om_session_unlocked', targetId);
      localStorage.setItem('om_unlocked_profile', targetId);
    } catch {}
    onUnlocked(targetId);
  };

  const handleOpenWorkspace = async (targetId: string) => {
    setBusy(true);
    setError('');
    try {
      const info = await getProfileSecurityInfo(targetId);
      if (!info?.credentialsReady) {
        // No password needed: unlock and open instantly!
        unlockWorkspace(targetId);
        return;
      }

      // Password required
      if (!password) {
        throw new Error('Please enter your workspace password, or click "Unlock without Password" below.');
      }
      const ok = await verifyProfilePassword(targetId, password);
      if (!ok) {
        throw new Error('Incorrect password. Try again, or use "Unlock without Password" below.');
      }
      unlockWorkspace(targetId);
    } catch (err: any) {
      setError(err?.message || 'Unable to open workspace.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemovePasswordAndUnlock = async (targetId: string) => {
    setBusy(true);
    setError('');
    try {
      const nextSettings = await removeProfilePassword(targetId);
      onSettingsReloaded?.(nextSettings);
      setSuccessNotice('✓ Password removed! Opening workspace...');
      setTimeout(() => {
        unlockWorkspace(targetId);
      }, 300);
    } catch (err: any) {
      setError(err?.message || 'Failed to remove password.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyRecovery = async () => {
    setBusy(true);
    setError('');
    try {
      const ok = await verifyProfileRecoveryAnswer(selectedProfileId, recoveryAnswer);
      if (!ok) throw new Error('Recovery answer is incorrect.');
      setIsResetting(true);
      setIsRecovering(false);
    } catch (err: any) {
      setError(err?.message || 'Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async () => {
    setBusy(true);
    setError('');
    try {
      const passVal = validatePasswordStrength(newPassword);
      if (!passVal.isValid) throw new Error(passVal.errorMessage);
      if (newPassword !== newPasswordConfirm) throw new Error('Passwords do not match.');
      if (!newHint.trim()) throw new Error('Password hint is required.');
      await resetProfilePassword(selectedProfileId, newPassword, newHint);
      setSuccessNotice('✓ Password updated! Opening workspace...');
      setTimeout(() => {
        unlockWorkspace(selectedProfileId);
      }, 300);
    } catch (err: any) {
      setError(err?.message || 'Unable to reset password.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) {
      setError('Please enter a workspace name.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const current = (await storage.getSingleton<AppState>('appSettings')) || settings;
      const id = generateUUID();
      const slug = createName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'workspace';
      const newProfile: UserProfile = {
        id,
        name: createName.trim(),
        role: 'Personal',
        email: `${slug}-${id.slice(0, 8)}@omlifeos.local`,
        authType: 'local',
        avatarChar: createName.trim().charAt(0).toUpperCase() || 'W',
        avatarColor: '#6366f1',
        isCurrent: true,
        createdAt: Date.now()
      };

      if (protectWithPassword) {
        await createLocalProfile(
          current,
          newProfile,
          createPassword,
          createHint,
          createQuestion,
          createRecoveryAnswer
        );
      } else {
        await createLocalProfile(current, newProfile);
      }

      const updated = await storage.getSingleton<AppState>('appSettings');
      if (updated) {
        onSettingsReloaded?.(updated);
      }
      setSuccessNotice(`✓ Workspace "${createName.trim()}" created! Opening...`);
      setTimeout(() => {
        unlockWorkspace(id);
      }, 300);
    } catch (err: any) {
      setError(err?.message || 'Unable to create workspace.');
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setError('');
    setSuccessNotice('Reading and restoring backup file...');

    try {
      const text = await file.text();
      const res = await storage.importFullBackup(text);
      const targetId = res.restoredProfileId || 'om-master-profile';

      // Auto-remove any stale locked password state on restored backup so it opens cleanly
      try {
        await removeProfilePassword(targetId);
      } catch {}

      const updatedSettings = await storage.getSingleton<AppState>('appSettings');
      if (updatedSettings) {
        onSettingsReloaded?.(updatedSettings);
      }

      setSuccessNotice(
        `✓ Workspace "${res.restoredProfileName}" restored with ${res.recordCount} records! Opening...`
      );
      setTimeout(() => {
        unlockWorkspace(targetId);
      }, 400);
    } catch (err: any) {
      setError('Failed to restore backup: ' + (err?.message || 'Invalid backup file'));
      setSuccessNotice('');
    } finally {
      setBusy(false);
      if (e.target) e.target.value = '';
    }
  };

  const currentSelectedProfile = profiles.find(p => p.id === selectedProfileId) || profiles[0];

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-3 sm:p-4 selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/95 p-4 sm:p-5 shadow-2xl backdrop-blur-xl space-y-3.5">
        {/* Compact App Header */}
        <div className="flex items-center gap-2.5 pb-0.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-600/30 shrink-0">
            OM
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-white tracking-tight leading-none">
              Om-LifeOS Workspaces
            </h1>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">
              Select or unlock your workspace
            </p>
          </div>
        </div>

        {/* Compact Navigation Tabs */}
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-slate-950/80 p-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('workspaces');
              setError('');
              setSuccessNotice('');
              setIsRecovering(false);
              setIsResetting(false);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'workspaces'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layers className="h-3 w-3" />
            <span>Workspaces ({profiles.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('create');
              setError('');
              setSuccessNotice('');
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'create'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Plus className="h-3 w-3" />
            <span>New Workspace</span>
          </button>
        </div>

        {/* Tab 1: Workspaces List & Unlock */}
        {activeTab === 'workspaces' && (
          <div className="space-y-3">
            {/* If multiple workspaces exist, show compact selector */}
            {profiles.length > 1 && (
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-0.5">
                {profiles.map(p => {
                  const isSelected = p.id === selectedProfileId;
                  const isLocked = Boolean(profileSecurityMap[p.id]);
                  const initial = (p.name || 'W').charAt(0).toUpperCase();

                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedProfileId(p.id)}
                      className={`flex items-center justify-between gap-2 rounded-xl p-2 border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-950/40'
                          : 'border-slate-800/80 bg-slate-950/40 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${
                            isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {initial}
                        </div>
                        <span className="text-xs font-semibold text-white truncate">{p.name}</span>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          isLocked ? 'text-amber-300 bg-amber-950/60' : 'text-emerald-300 bg-emerald-950/60'
                        }`}
                      >
                        {isLocked ? 'Locked' : 'Ready'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Selected Workspace Card (Compact) */}
            {profiles.length === 1 && (
              <div className="flex items-center justify-between gap-2.5 rounded-xl border border-indigo-500/60 bg-indigo-950/30 p-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white text-xs font-bold">
                    {(currentSelectedProfile?.name || 'W').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{currentSelectedProfile?.name}</div>
                    <div className="text-[10px] text-slate-400">
                      {hasPassword ? '🔒 Password Protected' : '✓ Ready (No Password)'}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold text-slate-400 bg-slate-800">
                  {hasPassword ? 'Locked' : 'Ready'}
                </span>
              </div>
            )}

            {/* Unlock Actions */}
            {!hasPassword ? (
              <button
                type="button"
                onClick={() => handleOpenWorkspace(selectedProfileId)}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
              >
                <span>Open {currentSelectedProfile?.name}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : isRecovering ? (
              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-slate-300">Password Recovery</div>
                {hint && (
                  <div className="rounded-lg bg-slate-900 p-2 text-xs text-slate-300">
                    <span className="font-bold text-slate-200">Hint:</span> {hint}
                  </div>
                )}
                <div className="text-[11px] text-slate-400">{question || 'Enter your recovery answer:'}</div>
                <input
                  type="text"
                  value={recoveryAnswer}
                  onChange={e => setRecoveryAnswer(e.target.value)}
                  placeholder="Recovery answer"
                  className="h-9 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white focus:border-indigo-500 outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleVerifyRecovery}
                    disabled={busy || !recoveryAnswer.trim()}
                    className="rounded-xl bg-indigo-600 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    Verify Answer
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemovePasswordAndUnlock(selectedProfileId)}
                    disabled={busy}
                    className="rounded-xl border border-amber-800/80 bg-amber-950/40 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-900/50"
                  >
                    Clear Lock
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRecovering(false)}
                  className="w-full text-center text-[11px] text-slate-400 hover:text-white"
                >
                  Back to password login
                </button>
              </div>
            ) : isResetting ? (
              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-slate-300">Set New Password</div>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="New password (8+ chars)"
                  className="h-9 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white focus:border-indigo-500 outline-none"
                />
                {newPassword && <PasswordStrengthMeter password={newPassword} />}
                <input
                  type="password"
                  value={newPasswordConfirm}
                  onChange={e => setNewPasswordConfirm(e.target.value)}
                  placeholder="Confirm new password"
                  className="h-9 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white focus:border-indigo-500 outline-none"
                />
                <input
                  type="text"
                  value={newHint}
                  onChange={e => setNewHint(e.target.value)}
                  placeholder="Password hint"
                  className="h-9 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white focus:border-indigo-500 outline-none"
                />
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={busy || !newPassword}
                  className="w-full rounded-xl bg-indigo-600 py-2 text-xs font-bold text-white hover:bg-indigo-500"
                >
                  Save & Open Workspace
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  autoFocus
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleOpenWorkspace(selectedProfileId)}
                  placeholder={hint ? `Password (Hint: ${hint})` : 'Enter workspace password'}
                  className="h-9 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 outline-none"
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenWorkspace(selectedProfileId)}
                    disabled={busy}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                  >
                    <Unlock className="h-3.5 w-3.5" />
                    <span>{busy ? 'Opening…' : 'Login & Unlock'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemovePasswordAndUnlock(selectedProfileId)}
                    disabled={busy}
                    className="rounded-xl border border-amber-800/70 bg-amber-950/30 px-2.5 py-2 text-xs font-medium text-amber-300 hover:bg-amber-900/40 transition-colors cursor-pointer whitespace-nowrap"
                    title="Unlock directly without password"
                  >
                    Clear Lock
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5 pt-0.5">
                  {hint && <span className="truncate max-w-[180px]">Hint: {hint}</span>}
                  <button
                    type="button"
                    onClick={() => setIsRecovering(true)}
                    className="hover:text-indigo-300 underline cursor-pointer ml-auto"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>
            )}

            {/* Compact Restore Backup Option */}
            <div className="pt-2 border-t border-slate-800/80">
              <label className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/50 hover:bg-slate-800/60 hover:border-slate-700 py-1.5 px-3 text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer">
                <FolderDown className="h-3 w-3 text-indigo-400 shrink-0" />
                <span>Restore Backup (.omlifeos, .json)</span>
                <input
                  type="file"
                  accept=".omlifeos,.json"
                  onChange={handleRestoreBackupFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {/* Tab 2: Create New Workspace */}
        {activeTab === 'create' && (
          <form onSubmit={handleCreateWorkspace} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Workspace Name <span className="text-indigo-400">*</span>
              </label>
              <input
                autoFocus
                type="text"
                required
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                placeholder="e.g. Work, Personal, Strategy"
                className="h-9 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white focus:border-indigo-500 outline-none"
              />
            </div>

            {/* Optional Password Protection Toggle */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5 space-y-2">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="text-xs font-semibold text-white">Protect with Password</span>
                </div>
                <input
                  type="checkbox"
                  checked={protectWithPassword}
                  onChange={e => setProtectWithPassword(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 cursor-pointer"
                />
              </label>

              {protectWithPassword && (
                <div className="space-y-2 pt-1 border-t border-slate-800">
                  <input
                    type="password"
                    required={protectWithPassword}
                    value={createPassword}
                    onChange={e => setCreatePassword(e.target.value)}
                    placeholder="Password (8+ chars)"
                    className="h-8.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white focus:border-indigo-500 outline-none"
                  />
                  {createPassword && <PasswordStrengthMeter password={createPassword} />}
                  <input
                    type="password"
                    required={protectWithPassword}
                    value={createPasswordConfirm}
                    onChange={e => setCreatePasswordConfirm(e.target.value)}
                    placeholder="Confirm Password"
                    className="h-8.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white focus:border-indigo-500 outline-none"
                  />
                  <input
                    type="text"
                    required={protectWithPassword}
                    value={createHint}
                    onChange={e => setCreateHint(e.target.value)}
                    placeholder="Password Hint"
                    className="h-8.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white focus:border-indigo-500 outline-none"
                  />
                  <select
                    value={createQuestion}
                    onChange={e => setCreateQuestion(e.target.value)}
                    className="h-8.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-2.5 text-xs text-white focus:border-indigo-500 outline-none cursor-pointer"
                  >
                    {PROFESSIONAL_SECURITY_QUESTIONS.map(q => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required={protectWithPassword}
                    value={createRecoveryAnswer}
                    onChange={e => setCreateRecoveryAnswer(e.target.value)}
                    placeholder="Recovery Answer"
                    className="h-8.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white focus:border-indigo-500 outline-none"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={busy || !createName.trim()}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{busy ? 'Creating…' : 'Create & Open Workspace'}</span>
            </button>
          </form>
        )}

        {/* Status Notices */}
        {successNotice && (
          <div className="rounded-xl border border-emerald-800/70 bg-emerald-950/60 p-2 text-xs text-emerald-300 text-center animate-in fade-in">
            {successNotice}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-900/60 bg-rose-950/50 p-2 text-xs text-rose-300 text-center animate-in fade-in">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};
