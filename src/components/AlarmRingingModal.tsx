import React, { useEffect } from 'react';
import { Bell, Clock, Volume2, RotateCcw, Check } from 'lucide-react';
import { TriggeredAlarmData, BUILTIN_RINGTONES } from '../lib/audioSynthesizer';

interface AlarmRingingModalProps {
  alarm: TriggeredAlarmData | null;
  onDismiss: () => void;
  onSnooze: (minutes?: number) => void;
}

export const AlarmRingingModal: React.FC<AlarmRingingModalProps> = ({
  alarm,
  onDismiss,
  onSnooze
}) => {
  useEffect(() => {
    if (!alarm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      } else if (e.key === ' ') {
        e.preventDefault();
        onSnooze(5);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [alarm, onDismiss, onSnooze]);

  if (!alarm) return null;

  const ringtoneMeta = BUILTIN_RINGTONES.find(r => r.id === alarm.ringtone) || {
    name: 'Zen Temple Bell'
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border-2 border-indigo-500/50 bg-white p-7 text-center shadow-2xl dark:border-indigo-500/40 dark:bg-slate-900">
        {/* Ambient Glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-44 w-44 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />

        {/* Ringing Bell Icon Animation */}
        <div className="relative mx-auto my-3 flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-600/40 animate-bounce">
            <Bell className="h-7 w-7" />
          </div>
        </div>

        {/* Alarm Banner & Title */}
        <div className="mt-2 space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-[11px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
            <span>Alarm Ringing</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white pt-2 leading-tight">
            {alarm.title}
          </h2>
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 pt-1">
            <Clock className="h-3.5 w-3.5 text-indigo-500" />
            <span>Time: {alarm.timeStr}</span>
          </div>
          {alarm.subtitle && (
            <p className="text-xs text-slate-400 max-w-xs mx-auto pt-0.5 truncate">
              {alarm.subtitle}
            </p>
          )}
        </div>

        {/* Audio Ringtone Indicator */}
        <div className="my-4 flex items-center justify-center gap-2 rounded-xl bg-slate-100/80 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
          <Volume2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
          <span>Tone: <strong>{ringtoneMeta.name}</strong></span>
        </div>

        {/* Snooze & Dismiss Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => onSnooze(5)}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-amber-300 bg-amber-50 py-2.5 text-xs font-bold text-amber-800 shadow-xs hover:bg-amber-100 active:scale-95 transition-all dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Snooze (+5m)</span>
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 transition-all cursor-pointer"
          >
            <Check className="h-3.5 w-3.5 stroke-[3]" />
            <span>Dismiss</span>
          </button>
        </div>

        <p className="mt-3 text-[10px] text-slate-400">
          Press <kbd className="rounded border border-slate-300 px-1 py-0.5 font-mono text-[9px] dark:border-slate-700">ESC</kbd> to dismiss or <kbd className="rounded border border-slate-300 px-1 py-0.5 font-mono text-[9px] dark:border-slate-700">Space</kbd> to snooze.
        </p>
      </div>
    </div>
  );
};
