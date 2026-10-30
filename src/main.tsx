import {StrictMode, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {GlobalErrorBoundary} from './components/GlobalErrorBoundary.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register the PWA service worker after the first paint so it never competes
// with startup work. Guarded: unsupported/blocked browsers must still open the app.
const startSW = () => { try { registerSW({ immediate: true }); } catch (e) { console.warn('SW register skipped', e); } };
if (document.readyState === 'complete') startSW();
else window.addEventListener('load', startSW, { once: true });

function InitialLockScreenHandoff() {
  useEffect(() => {
    const initialScreen = document.getElementById('app-initial-lock-screen');
    const pendingAction = initialScreen?.dataset.pendingAction;
    initialScreen?.remove();

    if (pendingAction === 'google' || pendingAction === 'guest') {
      requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>(`button[data-lock-action="${pendingAction}"]`)?.click();
      });
    }
  }, []);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <>
      <GlobalErrorBoundary>
        <App />
      </GlobalErrorBoundary>
      <InitialLockScreenHandoff />
    </>
  </StrictMode>,
);
