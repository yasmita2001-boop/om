import {StrictMode, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {GlobalErrorBoundary} from './components/GlobalErrorBoundary.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register the PWA service worker after the first paint so it never competes
// with startup work. Guarded: unsupported/blocked browsers must still open the app.
const startSW = () => {
  try {
    let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;
    updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        const shouldUpdate = window.confirm(
          'A new version is ready. Save any unsaved work before updating. Reload now?'
        );
        if (shouldUpdate) void updateSW?.(true);
      },
    });
  } catch (e) {
    console.warn('SW register skipped', e);
  }
};
if (document.readyState === 'complete') startSW();
else window.addEventListener('load', startSW, { once: true });

function InitialLockScreenHandoff() {
  useEffect(() => {
    const initialScreen = document.getElementById('app-initial-lock-screen');
    const root = document.getElementById('root');
    if (!initialScreen || !root) return;

    let observer: MutationObserver | undefined;
    const finishHandoff = () => {
      if (!root.firstElementChild) return;
      if (!initialScreen.isConnected) {
        observer?.disconnect();
        return;
      }

      observer?.disconnect();
      const pendingAction = initialScreen.dataset.pendingAction;
      initialScreen.remove();
      if (pendingAction === 'google' || pendingAction === 'guest') {
        requestAnimationFrame(() => {
          document.querySelector<HTMLButtonElement>(`button[data-lock-action="${pendingAction}"]`)?.click();
        });
      }
    };

    finishHandoff();
    if (initialScreen.isConnected) {
      observer = new MutationObserver(finishHandoff);
      observer.observe(root, { childList: true });
    }
  }, []);
  return null;
}

function StorageUnavailableScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 text-slate-900 dark:bg-[#0B0F19] dark:text-slate-100">
      <section className="w-full max-w-lg space-y-4 rounded-2xl border border-amber-200 bg-white p-6 shadow-sm dark:border-amber-900/60 dark:bg-slate-900">
        <h1 className="text-lg font-bold">Browser storage is unavailable</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Om-LifeOS stores your data locally with IndexedDB, which this browser or
          context is blocking. Your existing data has not been touched.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600 dark:text-slate-300">
          <li>Leave private/incognito mode and reopen the app.</li>
          <li>Allow site data and third-party storage for this site.</li>
          <li>If storage is full, free some space and reload.</li>
        </ul>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg border border-amber-700/30 bg-amber-700/10 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-700/15 dark:text-amber-200"
        >
          Reload after enabling storage
        </button>
      </section>
    </div>
  );
}

const rootElement = document.getElementById('root')!;
const root = createRoot(rootElement);

if (typeof indexedDB === 'undefined') {
  document.getElementById('app-initial-lock-screen')?.remove();
  root.render(<StorageUnavailableScreen />);
} else {
  root.render(
    <StrictMode>
      <>
        <GlobalErrorBoundary>
          <App />
        </GlobalErrorBoundary>
        <InitialLockScreenHandoff />
      </>
    </StrictMode>,
  );
}