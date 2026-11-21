/**
 * Shared color theme palettes used by both NotesView and JournalView.
 * Each palette defines card styling, a timeline dot color, and a spine color.
 *
 * To add a new theme, add an entry here — both views pick it up automatically.
 */

export interface NoteThemePalette {
  label: string;
  swatch: string;
  cardClass: string;
  dotClass: string;
  spineClass: string;
}

/** Build the palette map. `customColor` is the current custom-color hex value (needed for the "custom" entry). */
export const buildThemePalettes = (customColor: string): Record<string, NoteThemePalette> => ({
  slate: {
    label: 'Default',
    swatch: '#94a3b8',
    cardClass: 'bg-white border-slate-200/90 dark:bg-slate-900/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700',
    dotClass: 'bg-slate-400',
    spineClass: 'bg-slate-400 dark:bg-slate-600'
  },
  red: {
    label: 'Ruby Red',
    swatch: '#ef4444',
    cardClass: 'bg-red-50/50 border-red-200/70 dark:bg-red-950/20 dark:border-red-800/40 hover:border-red-300 dark:hover:border-red-700/60',
    dotClass: 'bg-red-500',
    spineClass: 'bg-red-500'
  },
  amber: {
    label: 'Warm Amber',
    swatch: '#f59e0b',
    cardClass: 'bg-amber-50/50 border-amber-200/70 dark:bg-amber-950/20 dark:border-amber-800/40 hover:border-amber-300 dark:hover:border-amber-700/60',
    dotClass: 'bg-amber-500',
    spineClass: 'bg-amber-500'
  },
  emerald: {
    label: 'Sage Emerald',
    swatch: '#10b981',
    cardClass: 'bg-emerald-50/50 border-emerald-200/70 dark:bg-emerald-950/20 dark:border-emerald-800/40 hover:border-emerald-300 dark:hover:border-emerald-700/60',
    dotClass: 'bg-emerald-500',
    spineClass: 'bg-emerald-500'
  },
  indigo: {
    label: 'Midnight Indigo',
    swatch: '#6366f1',
    cardClass: 'bg-indigo-50/50 border-indigo-200/70 dark:bg-indigo-950/20 dark:border-indigo-800/40 hover:border-indigo-300 dark:hover:border-indigo-700/60',
    dotClass: 'bg-indigo-500',
    spineClass: 'bg-indigo-500'
  },
  violet: {
    label: 'Royal Violet',
    swatch: '#8b5cf6',
    cardClass: 'bg-purple-50/50 border-purple-200/70 dark:bg-purple-950/20 dark:border-purple-800/40 hover:border-purple-300 dark:hover:border-purple-700/60',
    dotClass: 'bg-purple-500',
    spineClass: 'bg-purple-500'
  },
  custom: {
    label: 'Custom Color',
    swatch: customColor,
    cardClass: 'bg-white border-slate-200/90 dark:bg-slate-900/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700',
    dotClass: 'bg-slate-400',
    spineClass: 'bg-slate-400 dark:bg-slate-600'
  }
});

/** Resolve a stored color value (theme key, hex string, or legacy class name) to a palette entry. */
export const resolveTheme = (
  palettes: Record<string, NoteThemePalette>,
  colorVal?: string
): NoteThemePalette => {
  if (!colorVal) return palettes.slate;
  if (colorVal.startsWith('#')) return { ...palettes.custom, swatch: colorVal, label: 'Custom Color' };
  if (palettes[colorVal]) return palettes[colorVal];
  // Legacy fallbacks for older stored values
  if (colorVal.includes('amber') || colorVal.includes('fef9c3')) return palettes.amber;
  if (colorVal.includes('emerald') || colorVal.includes('green') || colorVal.includes('f0fdf4')) return palettes.emerald;
  if (colorVal.includes('sky') || colorVal.includes('blue')) return palettes.indigo;
  if (colorVal.includes('violet') || colorVal.includes('purple') || colorVal.includes('f5f3ff')) return palettes.violet;
  if (colorVal.includes('rose') || colorVal.includes('pink')) return palettes.red;
  return palettes.slate;
};

/** The palette keys shown in the swatch picker UI (excludes "custom" — that's shown separately). */
export const THEME_SWATCH_KEYS = ['slate', 'red', 'amber', 'emerald', 'indigo', 'violet'] as const;
