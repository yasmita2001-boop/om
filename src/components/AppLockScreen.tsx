import React, { useState, useEffect } from 'react';
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
  const profiles = settings.profiles || [];
  const initialProfile = profiles.find(p => p.id === settings.profileId) || profiles[0];
  const [profileId, setProfileId] = useState(initialProfile?.id || '');
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'setup' | 'recovery' | 'reset'>('login');
  const [hint, setHint] = useState('');
  const [question, setQuestion] = useState('');
  const [recoveryAnswer, setRecoveryAnswer] = useState('');
  const [recoveryIdentity, setRecoveryIdentity] = useState('');
  const [recoveryProfileId, setRecoveryProfileId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [newHint, setNewHint] = useState('');
  const [newQuestion, setNewQuestion] = useState<string>(PROFESSIONAL_SECURITY_QUESTIONS[0]);
  const [newRecoveryAnswer, setNewRecoveryAnswer] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [helpMode, setHelpMode] = useState<'choose' | 'username' | 'password'>('choose');
  const [lockNotice, setLockNotice] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createPasswordConfirm, setCreatePasswordConfirm] = useState('');
  const [createHint, setCreateHint] = useState('');
  const [createQuestion, setCreateQuestion] = useState<string>(PROFESSIONAL_SECURITY_QUESTIONS[0]);
  const [createRecoveryAnswer, setCreateRecoveryAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const resolveProfile = (value: string) => {
    const needle = value.trim().toLowerCase();
    return profiles.find(p =>
      p.id === value ||
      p.name.trim().toLowerCase() === needle ||
      (p.email || '').trim().toLowerCase() === needle
    ) || profiles.find(p => p.id === profileId);
  };

  const loadProfileSecurity = async (id: string) => {
    const info = await getProfileSecurityInfo(id);
    setHint(info?.passwordHint || '');
    setQuestion(info?.recoveryQuestion || '');
    return info;
  };

  useEffect(() => {
    let cancelled = false;
    const loadInitial = async () => {
      if (!profileId) return;
      const info = await getProfileSecurityInfo(profileId);
      if (cancelled) return;
      if (info?.credentialsReady) {
        setHint(info.passwordHint || '');
        setQuestion(info.recoveryQuestion || '');
        setIdentity((profiles.find(p => p.id === profileId) || initialProfile)?.name || '');
        setMode('login');
        return;
      }
      for (const p of profiles) {
        if (p.id === profileId) continue;
        const otherInfo = await getProfileSecurityInfo(p.id);
        if (cancelled) return;
        if (otherInfo?.credentialsReady) {
          setProfileId(p.id);
          setIdentity(p.name);
          setHint(otherInfo.passwordHint || '');
          setQuestion(otherInfo.recoveryQuestion || '');
          setMode('login');
          return;
        }
      }
      setHint(info?.passwordHint || '');
      setQuestion(info?.recoveryQuestion || '');
      setIdentity((profiles.find(p => p.id === profileId) || initialProfile)?.name || '');
      setMode('setup');
    };
    loadInitial().catch(err => { if (!cancelled) setError(err?.message || 'Unable to load profile security settings.'); });
    return () => { cancelled = true; };
  }, []);

  const resetTransient = () => {
    setPassword('');
    setRecoveryAnswer('');
    setNewPassword('');
    setNewPasswordConfirm('');
    setNewHint('');
    setNewQuestion('');
    setNewRecoveryAnswer('');
    setError('');
  };

  const login = async () => {
    const profile = resolveProfile(identity);
    if (!profile) throw new Error('Username / Profile not found.');
    const info = await loadProfileSecurity(profile.id);
    setProfileId(profile.id);
    if (!info?.credentialsReady) {
      setMode('setup');
      throw new Error('This profile needs its one-time password setup first.');
    }
    const ok = await verifyProfilePassword(profile.id, password);
    if (!ok) throw new Error('Incorrect password.');
    onUnlocked(profile.id);
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') {
        await login();
        return;
      }
      if (mode === 'setup') {
        const profile = profiles.find(p => p.id === profileId) || resolveProfile(identity);
        if (!profile) throw new Error('Profile not found.');
        const passVal = validatePasswordStrength(newPassword);
        if (!passVal.isValid) throw new Error(passVal.errorMessage);
        if (newPassword !== newPasswordConfirm) throw new Error('Password and Confirm Password do not match.');
        const qaVal = validateSecurityQuestionAndAnswer(newQuestion, newRecoveryAnswer, newPassword);
        if (!qaVal.isValid) throw new Error(qaVal.errorMessage);
        if (!newHint.trim()) throw new Error('Password hint is required.');
        if (newHint.toLowerCase().includes(newPassword.toLowerCase())) {
          throw new Error('Password hint cannot contain the password itself.');
        }
        await setProfileCredentials(profile.id, newPassword, newHint, newQuestion, newRecoveryAnswer);
        onUnlocked(profile.id);
        return;
      }
      if (mode === 'recovery') {
        const profile = profiles.find(p => p.id === recoveryProfileId);
        if (!profile) throw new Error('Profile not found.');
        const ok = await verifyProfileRecoveryAnswer(profile.id, recoveryAnswer);
        if (!ok) throw new Error('Recovery answer is incorrect.');
        setMode('reset');
        setRecoveryAnswer('');
        return;
      }
      if (mode === 'reset') {
        const profile = profiles.find(p => p.id === recoveryProfileId);
        if (!profile) throw new Error('Profile not found.');
        const passVal = validatePasswordStrength(newPassword);
        if (!passVal.isValid) throw new Error(passVal.errorMessage);
        if (newPassword !== newPasswordConfirm) throw new Error('Password and Confirm Password do not match.');
        if (!newHint.trim()) throw new Error('Password hint is required.');
        if (newHint.toLowerCase().includes(newPassword.toLowerCase())) {
          throw new Error('Password hint cannot contain the password itself.');
        }
        await resetProfilePassword(profile.id, newPassword, newHint);
        onUnlocked(profile.id);
      }
    } catch (e: any) {
      setError(e?.message || 'Unable to continue.');
    } finally {
      setBusy(false);
    }
  };

  const startForgotPassword = () => {
    resetTransient();
    setShowHelp(true);
    setHelpMode('password');
    setMode('login');
  };

  const continueForgotPassword = async () => {
    setBusy(true);
    setError('');
    try {
      const profile = resolveProfile(recoveryIdentity);
      if (!profile) throw new Error('Username / Profile not found.');
      const info = await loadProfileSecurity(profile.id);
      if (!info?.credentialsReady) throw new Error('This profile has not completed password setup yet.');
      setRecoveryProfileId(profile.id);
      setMode('recovery');
    } catch (e: any) {
      setError(e?.message || 'Unable to start password recovery.');
    } finally {
      setBusy(false);
    }
  };

  const startCreate = () => {
    resetTransient();
    setShowCreate(true);
    setShowHelp(false);
    setMode('login');
  };

  const createProfile = async () => {
    setBusy(true);
    setError('');
    try {
      if (!createName.trim()) throw new Error('Profile name / User ID is required.');
      const passVal = validatePasswordStrength(createPassword);
      if (!passVal.isValid) throw new Error(passVal.errorMessage);
      if (createPassword !== createPasswordConfirm) throw new Error('Password and Confirm Password do not match.');
      const qaVal = validateSecurityQuestionAndAnswer(createQuestion, createRecoveryAnswer, createPassword);
      if (!qaVal.isValid) throw new Error(qaVal.errorMessage);
      if (!createHint.trim()) throw new Error('Password hint is required.');
      if (createHint.toLowerCase().includes(createPassword.toLowerCase())) {
        throw new Error('Password hint cannot contain the password itself.');
      }
      const current = (await storage.getSingleton<AppState>('appSettings')) || settings;
      const existingMatch = (current.profiles || []).find(
        p => p.name.trim().toLowerCase() === createName.trim().toLowerCase() ||
             (p.email || '').trim().toLowerCase() === createName.trim().toLowerCase()
      );
      if (existingMatch) {
        const existingInfo = await getProfileSecurityInfo(existingMatch.id);
        if (!existingInfo?.credentialsReady) {
          await setProfileCredentials(existingMatch.id, createPassword, createHint, createQuestion, createRecoveryAnswer);
          setCreateName(''); setCreatePassword(''); setCreatePasswordConfirm(''); setCreateHint(''); setCreateQuestion(PROFESSIONAL_SECURITY_QUESTIONS[0]); setCreateRecoveryAnswer('');
          setShowCreate(false);
          setProfileId(existingMatch.id);
          setIdentity(existingMatch.name);
          onUnlocked(existingMatch.id);
          return;
        }
      }
      const id = generateUUID();
      const slug = createName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
      const newProfile: UserProfile = {
        id,
        name: createName.trim(),
        role: 'Local Profile',
        email: `${slug}-${id.slice(0, 8)}@omlifeos.local`,
        authType: 'local' as const,
        avatarChar: createName.trim().charAt(0).toUpperCase(),
        avatarColor: '#5d57c9',
        isCurrent: false,
        createdAt: Date.now()
      };
      await createLocalProfile(current, newProfile, createPassword, createHint, createQuestion, createRecoveryAnswer);
      setCreateName(''); setCreatePassword(''); setCreatePasswordConfirm(''); setCreateHint(''); setCreateQuestion(PROFESSIONAL_SECURITY_QUESTIONS[0]); setCreateRecoveryAnswer('');
      setShowCreate(false);
      setProfileId(newProfile.id);
      setIdentity(newProfile.name);
      onUnlocked(newProfile.id);
    } catch (e: any) {
      setError(e?.message || 'Unable to create local profile.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white text-xl font-black">OM</div>
          <h1 className="text-xl font-bold text-white">
            {mode === 'setup' ? 'Set Master Password' : showCreate ? 'Create Profile' : 'User Login'}
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            {mode === 'setup'
              ? 'Secure your local workspace with a private password'
              : showCreate
                ? 'Create a new local profile workspace'
                : 'Local sovereign profile access'}
          </p>
        </div>

        {/* Side-by-side Login and Create/Setup tabs */}
        <div className="mb-5 grid grid-cols-2 gap-1.5 rounded-2xl border border-slate-800 bg-slate-950/80 p-1.5">
          <button
            type="button"
            onClick={() => {
              resetTransient();
              setShowCreate(false);
              setShowHelp(false);
              setMode('login');
            }}
            className={`rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer ${
              mode === 'login' && !showCreate
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              resetTransient();
              setShowHelp(false);
              setShowCreate(true);
              setMode('login');
            }}
            className={`rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer ${
              showCreate || mode === 'setup'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Create / Set Password
          </button>
        </div>

        {mode === 'login' && !showCreate && (
          <>
            {profiles.length > 1 && (
              <div className="mb-3 text-left">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Select Profile</label>
                <select
                  value={profileId}
                  onChange={e => {
                    const selected = profiles.find(p => p.id === e.target.value);
                    if (selected) {
                      setProfileId(selected.id);
                      setIdentity(selected.name);
                    }
                  }}
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 text-xs text-white outline-none cursor-pointer"
                >
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-3">
              <input
                autoFocus={!identity}
                type="text"
                value={identity}
                onChange={e => setIdentity(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder="Username / Email Id"
                className="h-11 w-full rounded-full border border-slate-700 bg-slate-800 px-5 text-sm text-white outline-none focus:border-indigo-500"
              />
              <input
                autoFocus={!!identity}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder="Password"
                className="h-11 w-full rounded-full border border-slate-700 bg-slate-800 px-5 text-sm text-white outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="w-full rounded-full bg-indigo-600 py-3 text-sm font-bold text-white disabled:opacity-50 hover:bg-indigo-500 transition-colors cursor-pointer"
              >
                {busy ? 'Checking…' : 'Login & Unlock'}
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => { setShowHelp(v => !v); setHelpMode('choose'); setError(''); }}
                className="w-full text-xs font-semibold text-slate-400 hover:text-white hover:underline cursor-pointer"
              >
                Forgot Username / Password?
              </button>
              <label className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-800/70 bg-indigo-950/40 px-3 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-900/50 transition-colors cursor-pointer text-center">
                <span>📁 Restore from Backup File (.omlifeos)</span>
                <input
                  type="file"
                  accept=".omlifeos,.json"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const text = await file.text();
                      await storage.importFullBackup(text);
                      setLockNotice('✓ Backup restored successfully! All data and profiles loaded.');
                      setError('');
                      const updatedSettings = await storage.getSingleton<AppState>('appSettings');
                      if (updatedSettings) {
                        onSettingsReloaded?.(updatedSettings);
                        const nextProf = updatedSettings.profiles?.find(p => p.id === updatedSettings.profileId) || updatedSettings.profiles?.[0];
                        if (nextProf) {
                          setProfileId(nextProf.id);
                          setIdentity(nextProf.name);
                        }
                      }
                    } catch (err: any) {
                      setError('Failed to restore backup: ' + (err?.message || 'Invalid backup file'));
                    }
                  }}
                  className="hidden"
                />
              </label>
            </div>

            {lockNotice && (
              <div className="mt-3 rounded-xl border border-emerald-800/70 bg-emerald-950/50 p-2.5 text-xs text-emerald-300 text-center">
                {lockNotice}
              </div>
            )}
            {showHelp && (
              <div className="mt-3 rounded-2xl border border-slate-700 bg-slate-800/70 p-3 space-y-2">
                {helpMode === 'choose' && (
                  <div className="grid grid-cols-1 gap-2">
                    <button type="button" onClick={() => setHelpMode('username')} className="rounded-xl border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200">Forgot Username</button>
                    <button type="button" onClick={startForgotPassword} className="rounded-xl border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200">Forgot Password</button>
                    <button type="button" onClick={startCreate} className="rounded-xl border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200">Create Local Profile</button>
                  </div>
                )}
                {helpMode === 'username' && (
                  <div>
                    <div className="mb-2 text-xs text-slate-300">Your local profiles:</div>
                    <div className="space-y-1">
                      {profiles.map(p => <div key={p.id} className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white">{p.name}</div>)}
                    </div>
                  </div>
                )}
                {helpMode === 'password' && (
                  <div className="space-y-2">
                    <input type="text" value={recoveryIdentity} onChange={e => setRecoveryIdentity(e.target.value)} placeholder="Username / Email Id" className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white" />
                    <button type="button" onClick={continueForgotPassword} disabled={busy} className="w-full rounded-xl bg-indigo-600 py-2 text-xs font-bold text-white">Continue</button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {mode === 'setup' && (
          <>
            <div className="mb-3 text-sm font-semibold text-white">Create security credentials for {profiles.find(p => p.id === profileId)?.name || identity}</div>
            <div className="space-y-2.5">
              <div>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Create Strong Password"
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm text-white focus:border-indigo-500 outline-none"
                />
                {newPassword && <div className="mt-1.5"><PasswordStrengthMeter password={newPassword} /></div>}
              </div>
              <input
                type="password"
                value={newPasswordConfirm}
                onChange={e => setNewPasswordConfirm(e.target.value)}
                placeholder="Confirm Password"
                className="h-11 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm text-white focus:border-indigo-500 outline-none"
              />
              <input
                type="text"
                value={newHint}
                onChange={e => setNewHint(e.target.value)}
                placeholder="Password Hint / Clue (cannot contain password)"
                className="h-11 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm text-white focus:border-indigo-500 outline-none"
              />

              <div className="space-y-1 pt-1">
                <label className="block text-[11px] font-semibold text-slate-300">Security Recovery Question</label>
                <select
                  value={newQuestion}
                  onChange={e => setNewQuestion(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 text-xs text-white focus:border-indigo-500 outline-none cursor-pointer"
                >
                  {PROFESSIONAL_SECURITY_QUESTIONS.map(q => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
              </div>

              <input
                type="text"
                value={newRecoveryAnswer}
                onChange={e => setNewRecoveryAnswer(e.target.value)}
                placeholder="Your Confidential Recovery Answer (min 3 chars)"
                className="h-11 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm text-white focus:border-indigo-500 outline-none"
              />
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="mt-4 w-full rounded-full bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50 transition-all cursor-pointer shadow-md"
            >
              {busy ? 'Saving Credentials…' : 'Save Credentials & Open App'}
            </button>
          </>
        )}

        {mode === 'recovery' && (
          <>
            <div className="mb-2 text-sm font-semibold text-white">Password Recovery</div>
            <div className="mb-3 rounded-xl bg-slate-800 p-3 text-xs text-slate-300"><span className="font-bold text-slate-200">Hint:</span> {hint || 'No hint was saved.'}</div>
            <div className="mb-2 text-xs font-semibold text-slate-300">{question || 'Recovery question not configured.'}</div>
            <input autoFocus type="text" value={recoveryAnswer} onChange={e => setRecoveryAnswer(e.target.value)} placeholder="Recovery Answer" className="mb-3 h-11 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm text-white" />
            <button type="button" onClick={submit} disabled={busy} className="w-full rounded-full bg-indigo-600 py-3 text-sm font-bold text-white">Verify Recovery Answer</button>
            <button type="button" onClick={() => { setMode('login'); setShowHelp(true); setHelpMode('password'); resetTransient(); }} className="mt-3 w-full text-xs text-slate-400 hover:text-white">Back to login</button>
          </>
        )}

        {mode === 'reset' && (
          <>
            <div className="mb-3 text-sm font-semibold text-white">Set a New Password</div>
            <div className="space-y-2.5">
              <div>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="New Password (Min 8 chars, Mixed Case, Num & Symbol)"
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm text-white focus:border-indigo-500 outline-none"
                />
                {newPassword && <div className="mt-1.5"><PasswordStrengthMeter password={newPassword} /></div>}
              </div>
              <input
                type="password"
                value={newPasswordConfirm}
                onChange={e => setNewPasswordConfirm(e.target.value)}
                placeholder="Confirm New Password"
                className="h-11 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm text-white focus:border-indigo-500 outline-none"
              />
              <input
                type="text"
                value={newHint}
                onChange={e => setNewHint(e.target.value)}
                placeholder="New Password Hint (cannot contain password)"
                className="h-11 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm text-white focus:border-indigo-500 outline-none"
              />
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="mt-4 w-full rounded-full bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50 transition-all cursor-pointer shadow-md"
            >
              {busy ? 'Resetting…' : 'Reset Password & Open App'}
            </button>
          </>
        )}

        {showCreate && (
          <div className="space-y-2.5">
            <div className="mb-2 text-sm font-semibold text-white">Create Local Profile</div>
            <input
              type="text"
              value={createName}
              onChange={e => setCreateName(e.target.value)}
              placeholder="Profile Name (e.g. Yash, Operations)"
              className="h-11 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm text-white focus:border-indigo-500 outline-none"
            />
            <div>
              <input
                type="password"
                value={createPassword}
                onChange={e => setCreatePassword(e.target.value)}
                placeholder="Password (Min 8 chars, Mixed Case, Num & Symbol)"
                className="h-11 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm text-white focus:border-indigo-500 outline-none"
              />
              {createPassword && <div className="mt-1.5"><PasswordStrengthMeter password={createPassword} /></div>}
            </div>
            <input
              type="password"
              value={createPasswordConfirm}
              onChange={e => setCreatePasswordConfirm(e.target.value)}
              placeholder="Confirm Password"
              className="h-11 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm text-white focus:border-indigo-500 outline-none"
            />
            <input
              type="text"
              value={createHint}
              onChange={e => setCreateHint(e.target.value)}
              placeholder="Password Hint / Clue (cannot contain password)"
              className="h-11 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm text-white focus:border-indigo-500 outline-none"
            />

            <div className="space-y-1 pt-1">
              <label className="block text-[11px] font-semibold text-slate-300">Security Recovery Question</label>
              <select
                value={createQuestion}
                onChange={e => setCreateQuestion(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 text-xs text-white focus:border-indigo-500 outline-none cursor-pointer"
              >
                {PROFESSIONAL_SECURITY_QUESTIONS.map(q => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>

            <input
              type="text"
              value={createRecoveryAnswer}
              onChange={e => setCreateRecoveryAnswer(e.target.value)}
              placeholder="Your Confidential Recovery Answer (min 3 chars)"
              className="h-11 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm text-white focus:border-indigo-500 outline-none"
            />
            <button
              type="button"
              onClick={createProfile}
              disabled={busy}
              className="mt-3 w-full rounded-full bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50 transition-all cursor-pointer shadow-md"
            >
              {busy ? 'Creating…' : 'Create Profile & Open App'}
            </button>
            <button
              type="button"
              onClick={() => { setShowCreate(false); setError(''); }}
              className="w-full py-2 text-xs text-slate-400 hover:text-white"
            >
              Back to login
            </button>
          </div>
        )}

        {error && <div className="mt-4 rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-xs text-red-300">{error}</div>}
      </div>
    </div>
  );
};
