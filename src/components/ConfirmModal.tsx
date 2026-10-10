import React from 'react';
import { AlertTriangle, Trash2, X, Cloud } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  cloudNotice?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  isDanger = true,
  cloudNotice,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                isDanger
                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
                  : 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
              }`}
            >
              {isDanger ? <Trash2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          {message}
        </p>

        {cloudNotice && (
          <div className="mt-3.5 flex items-center gap-2 rounded-2xl bg-indigo-50/80 p-2.5 text-[11px] leading-snug font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60">
            <Cloud className="h-4 w-4 shrink-0 text-indigo-500" />
            <span>{cloudNotice}</span>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-500'
                : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
