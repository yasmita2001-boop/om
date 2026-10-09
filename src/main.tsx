import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { applyAccentTheme, getSavedAccentTheme } from './lib/themeEngine';
import { registerSW } from 'virtual:pwa-register';

// Register PWA service worker quietly behind the scenes (zero UI impact)
registerSW({ immediate: true });

// Initialize accent theme on app startup
applyAccentTheme(getSavedAccentTheme());

createRoot(document.getElementById('root')!).render(<App />);
