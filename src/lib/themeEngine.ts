// Dynamic Accent Color & Theme Engine for Om-LifeOS

export interface AccentPreset {
  id: string;
  name: string;
  hex: string;
  primary: string;
  hover: string;
  soft: string;
  palette: Record<string, string>;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  {
    id: 'indigo',
    name: 'Executive Indigo',
    hex: '#6366f1',
    primary: '#6366f1',
    hover: '#4f46e5',
    soft: 'rgba(99, 102, 241, 0.12)',
    palette: {
      50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8',
      500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81', 950: '#1e1b4b'
    }
  },
  {
    id: 'emerald',
    name: 'Sovereign Emerald',
    hex: '#10b981',
    primary: '#10b981',
    hover: '#059669',
    soft: 'rgba(16, 185, 129, 0.12)',
    palette: {
      50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399',
      500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b', 950: '#022c22'
    }
  },
  {
    id: 'violet',
    name: 'Deep Focus Violet',
    hex: '#8b5cf6',
    primary: '#8b5cf6',
    hover: '#7c3aed',
    soft: 'rgba(139, 92, 246, 0.12)',
    palette: {
      50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa',
      500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95', 950: '#2e1065'
    }
  },
  {
    id: 'amber',
    name: 'Solar Gold',
    hex: '#f59e0b',
    primary: '#f59e0b',
    hover: '#d97706',
    soft: 'rgba(245, 158, 11, 0.12)',
    palette: {
      50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24',
      500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f', 950: '#451a03'
    }
  },
  {
    id: 'rose',
    name: 'Crimson Pulse',
    hex: '#f43f5e',
    primary: '#f43f5e',
    hover: '#e11d48',
    soft: 'rgba(244, 63, 94, 0.12)',
    palette: {
      50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185',
      500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337', 950: '#4c0519'
    }
  },
  {
    id: 'cyan',
    name: 'Cyber Cyan',
    hex: '#06b6d4',
    primary: '#06b6d4',
    hover: '#0891b2',
    soft: 'rgba(6, 182, 212, 0.12)',
    palette: {
      50: '#ecfeff', 100: '#cffafe', 200: '#a5f3fc', 300: '#67e8f9', 400: '#22d3ee',
      500: '#06b6d4', 600: '#0891b2', 700: '#0e7490', 800: '#155e75', 900: '#164e63', 950: '#083344'
    }
  },
  {
    id: 'blue',
    name: 'Royal Cobalt',
    hex: '#2563eb',
    primary: '#2563eb',
    hover: '#1d4ed8',
    soft: 'rgba(37, 99, 235, 0.12)',
    palette: {
      50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa',
      500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a', 950: '#172554'
    }
  }
];

export const ACCENT_THEMES = ACCENT_PRESETS;

export function applyAccentTheme(themeIdOrHex: string): void {
  const q = (themeIdOrHex || '').toLowerCase();
  const theme = ACCENT_PRESETS.find(t => t.id === q || t.hex.toLowerCase() === q) || ACCENT_PRESETS[0];
  const root = document.documentElement;
  root.style.setProperty('--color-brand', theme.primary);
  root.style.setProperty('--color-brand-hover', theme.hover);
  root.style.setProperty('--color-brand-soft', theme.soft);
  Object.entries(theme.palette).forEach(([shade, hex]) => {
    root.style.setProperty(`--color-brand-${shade}`, hex);
  });
  try {
    localStorage.setItem('om_accent_theme', theme.hex);
  } catch {}
}

export function getSavedAccentTheme(): string {
  try {
    return localStorage.getItem('om_accent_theme') || '#6366f1';
  } catch {
    return '#6366f1';
  }
}
