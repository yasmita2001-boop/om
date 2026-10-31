/**
 * Accent color system.
 *
 * Accent-family Tailwind palettes are re-pointed to `--color-brand` inside index.css,
 * so existing module controls follow the active theme without changing every call site.
 */
const DEFAULT_ACCENT = '#e5c777';
const LEGACY_DEFAULT_ACCENT = '#6366f1';
const USER_SELECTED_ACCENT_KEY = 'om_accent_user_selected';
const HEX_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export const DEFAULT_ACCENT_HEX = DEFAULT_ACCENT;

const normalizeHex = (value?: string | null): string => {
  if (!value) return DEFAULT_ACCENT;
  let hex = value.trim();
  if (!HEX_PATTERN.test(hex)) return DEFAULT_ACCENT;
  if (hex.length === 4) {
    hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  return hex.toLowerCase();
};

export const resolveSavedAccent = (value?: string | null): string => {
  const hex = normalizeHex(value);
  if (hex !== LEGACY_DEFAULT_ACCENT) return hex;
  try {
    return localStorage.getItem(USER_SELECTED_ACCENT_KEY) === 'true' ? hex : DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
};

export const rememberAccentChoice = (userSelected: boolean): void => {
  try {
    if (userSelected) {
      localStorage.setItem(USER_SELECTED_ACCENT_KEY, 'true');
    } else {
      localStorage.removeItem(USER_SELECTED_ACCENT_KEY);
    }
  } catch {
    // The chosen accent still applies for this session when storage is unavailable.
  }
};

/** Relative sRGB luminance, used to pick readable text on top of the accent. */
const luminanceOf = (hex: string): number => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/**
 * Applies the accent to the document and remembers it so the pre-paint script in
 * index.html can restore it before React mounts (no accent flash on reload).
 */
export const applyAccent = (value?: string | null): string => {
  const hex = normalizeHex(value);
  const root = document.documentElement;
  root.style.setProperty('--color-brand', hex);
  // Very light accents (lime, amber) need dark text on primary buttons for contrast.
  root.style.setProperty('--om-on-accent', luminanceOf(hex) > 0.45 ? '#1e293b' : '#ffffff');
  try {
    localStorage.setItem('om_accent', hex);
  } catch {
    /* storage unavailable (private mode) - accent still applies for this session */
  }
  return hex;
};

/** Restores the saved accent on boot. Safe to call more than once. */
export const restoreSavedAccent = (): void => {
  try {
    applyAccent(resolveSavedAccent(localStorage.getItem('om_accent') || DEFAULT_ACCENT));
  } catch {
    applyAccent(DEFAULT_ACCENT);
  }
};