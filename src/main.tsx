import {StrictMode} from 'react';
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
);

// Warm the most-used screens during idle time so tab switches feel instant.
const idle: (cb: () => void) => void =
  (window as any).requestIdleCallback ? (cb) => (window as any).requestIdleCallback(cb, { timeout: 4000 }) : (cb) => setTimeout(cb, 2000);
idle(() => {
  const conn = (navigator as any).connection;
  if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''))) return; // respect data saver
  import('./views/TasksView.tsx').catch(() => {});
  import('./views/RoutineView.tsx').catch(() => {});
  import('./views/GoalsView.tsx').catch(() => {});
});
