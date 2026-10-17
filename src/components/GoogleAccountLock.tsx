import React, { useState } from 'react';
import { LockKeyhole, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { signInWithGoogleAccount } from '../lib/googleDriveSync';

interface GoogleAccountLockProps {
  onUnlock: () => void;
}

export const GoogleAccountLock: React.FC<GoogleAccountLockProps> = ({ onUnlock }) => {
  const isOnline = useOnlineStatus();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    setIsSigningIn(true);
    try {
      await signInWithGoogleAccount();
      onUnlock();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google account verification failed.');
    } finally {
      setIsSigningIn(false);
    }
  };

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

        <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-500">
          Google may remember your signed-in session and skip asking for your password.
        </p>
      </section>
    </main>
  );
};
