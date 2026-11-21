import React, { useState, useRef, useEffect } from 'react';
import { LockKeyhole, RefreshCw, ShieldCheck, WifiOff, KeyRound, ArrowLeft } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { signInWithGoogle } from '../lib/googleDriveSync';

const PIN_HASH_KEY = 'om_lock_pin_hash';

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hasSavedPin(): boolean {
  return Boolean(localStorage.getItem(PIN_HASH_KEY));
}

interface GoogleAccountLockProps {
  onUnlock: () => void;
}

type PinMode = 'none' | 'enter' | 'setup' | 'confirm';

export const GoogleAccountLock: React.FC<GoogleAccountLockProps> = ({ onUnlock }) => {
  const isOnline = useOnlineStatus();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinMode, setPinMode] = useState<PinMode>('none');
  const [pin, setPin] = useState('');
  const [setupPin, setSetupPin] = useState('');
  const [pinError, setPinError] = useState('');
  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pinMode !== 'none') {
      setTimeout(() => pinInputRef.current?.focus(), 50);
    }
  }, [pinMode]);

  const handleSignIn = async () => {
    setError(null);
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
      onUnlock();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google account verification failed.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');

    if (pinMode === 'setup') {
      if (pin.length < 4 || pin.length > 6) {
        setPinError('PIN must be 4-6 digits.');
        return;
      }
      setSetupPin(pin);
      setPin('');
      setPinMode('confirm');
      return;
    }

    if (pinMode === 'confirm') {
      if (pin !== setupPin) {
        setPinError('PINs do not match. Try again.');
        setPin('');
        setPinMode('setup');
        setSetupPin('');
        return;
      }
      const digest = await hashPin(pin);
      localStorage.setItem(PIN_HASH_KEY, digest);
      onUnlock();
      return;
    }

    if (pinMode === 'enter') {
      const stored = localStorage.getItem(PIN_HASH_KEY);
      const digest = await hashPin(pin);
      if (digest === stored) {
        onUnlock();
      } else {
        setPinError('Incorrect PIN.');
        setPin('');
      }
    }
  };

  const openPinMode = () => {
    setPin('');
    setSetupPin('');
    setPinError('');
    setPinMode(hasSavedPin() ? 'enter' : 'setup');
  };

  const backToMain = () => {
    setPinMode('none');
    setPin('');
    setSetupPin('');
    setPinError('');
  };

  const pinLabel =
    pinMode === 'setup' ? 'Create a PIN (4-6 digits)' :
    pinMode === 'confirm' ? 'Confirm your PIN' :
    'Enter your PIN';

  if (pinMode !== 'none') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 dark:bg-[#0B0F19]">
        <section className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            <KeyRound className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{pinLabel}</h1>

          {pinError && (
            <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-left text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {pinError}
            </p>
          )}

          <form onSubmit={handlePinSubmit} className="mt-5">
            <input
              ref={pinInputRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              minLength={4}
              autoComplete="off"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-center text-lg font-mono tracking-[0.35em] text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <button
              type="submit"
              disabled={pin.length < 4}
              className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pinMode === 'setup' ? 'Next' : pinMode === 'confirm' ? 'Set PIN & Unlock' : 'Unlock'}
            </button>
          </form>

          <button
            type="button"
            onClick={backToMain}
            className="mt-4 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Google sign-in
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 dark:bg-[#0B0F19]">
      <section className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
          <LockKeyhole className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Om LifeOS is locked</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Sign in with your Google account to unlock this app. Google verification needs an internet connection.
        </p>

        {!isOnline && (
          <div role="status" className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
            You are offline. Connect to the internet to unlock the app.
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-left text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSignIn}
          disabled={!isOnline || isSigningIn}
          className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSigningIn ? (
            <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          )}
          {isSigningIn ? 'Verifying with Google…' : 'Continue with Google'}
        </button>

        <button
          type="button"
          onClick={openPinMode}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <KeyRound className="h-3.5 w-3.5" />
          {hasSavedPin() ? 'Use PIN instead' : 'Set up a PIN'}
        </button>

        <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-500">
          Google may remember your signed-in session and skip asking for your password.
        </p>
      </section>
    </main>
  );
};
