import React, { useState } from 'react';
import { ShieldCheck, Cloud, Lock, Sparkles, AlertCircle } from 'lucide-react';
import { googleSignIn } from '../lib/googleDriveService';
import { GoogleSignInButton } from './GoogleSignInButton';
import { User } from 'firebase/auth';

interface GoogleAuthGateProps {
  onSignInSuccess: (user: User) => void;
}

export const GoogleAuthGate: React.FC<GoogleAuthGateProps> = ({ onSignInSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await googleSignIn();
      if (res && res.user) {
        onSignInSuccess(res.user);
      }
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        setErrorMessage(err?.message || 'Google Sign-In failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[#F8FAFC] dark:bg-[#0B0F19] transition-colors relative overflow-hidden">
      {/* Subtle ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900 shadow-2xl p-6 sm:p-8 space-y-6 text-center">
        {/* Brand Icon & Heading */}
        <div className="flex flex-col items-center space-y-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 font-serif font-extrabold text-white text-2xl shadow-lg shadow-indigo-600/30">
            ॐ
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Om-LifeOS
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Executive Life & Workspace Operating System
            </p>
          </div>
        </div>

        {/* Info Card */}
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 text-left dark:border-indigo-950/60 dark:bg-indigo-950/30 space-y-3">
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-semibold text-xs">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>Genuine Google Authentication</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Sign in with your personal or workspace Google account to unlock your dashboard, daily planner, finance ledger, and automatic Google Drive cloud backup.
          </p>
        </div>

        {/* Error notification if any */}
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-left text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* Primary Google Sign-In Action */}
        <div className="pt-2 flex flex-col items-center space-y-3">
          <GoogleSignInButton
            onClick={handleSignIn}
            isLoading={isLoading}
            label="Sign in with Google"
            className="w-full justify-center shadow-md hover:shadow-lg py-2.5"
          />
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Requires Google OAuth permission to connect and sync with Google Drive.
          </p>
        </div>

        {/* Trust Badges */}
        <div className="border-t border-slate-100 pt-5 dark:border-slate-800 grid grid-cols-3 gap-2 text-center">
          <div className="flex flex-col items-center space-y-1">
            <Lock className="h-4 w-4 text-emerald-500" />
            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">OAuth 2.0</span>
          </div>
          <div className="flex flex-col items-center space-y-1">
            <Cloud className="h-4 w-4 text-indigo-500" />
            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Drive Sync</span>
          </div>
          <div className="flex flex-col items-center space-y-1">
            <ShieldCheck className="h-4 w-4 text-blue-500" />
            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Zero Local Mock</span>
          </div>
        </div>
      </div>
    </div>
  );
};
