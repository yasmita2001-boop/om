import React, { useEffect, useRef, useState } from 'react';
import { Check, Film, ImagePlus, RotateCcw, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import {
  APPEARANCE_PRESETS,
  AppearanceColorMode,
  AppearancePreferences,
  applyAppearance,
  DEFAULT_APPEARANCE,
  normalizeAppearance,
  storeOriginalBackgroundImage,
  storeBackgroundVideo
} from '../lib/appearance';

interface AppearanceCustomizerProps {
  value: AppearancePreferences;
  onApply: (value: AppearancePreferences) => Promise<void>;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  wallpaperVideoMuted: boolean;
  onToggleWallpaperVideoSound: () => void;
}

const ACCENT_PRESETS = [
  { name: 'Sanctuary Amber', hex: '#b88648' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Cobalt', hex: '#2563eb' },
  { name: 'Sky', hex: '#0284c7' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Forest', hex: '#15803d' },
  { name: 'Lime', hex: '#84cc16' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Crimson', hex: '#e11d48' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Fuchsia', hex: '#d946ef' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Slate', hex: '#475569' }
];

const isValidHex = (value: string) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());

export const AppearanceCustomizer: React.FC<AppearanceCustomizerProps> = ({
  value,
  onApply,
  onSuccess,
  onError,
  wallpaperVideoMuted,
  onToggleWallpaperVideoSound
}) => {
  const [draft, setDraft] = useState(() => normalizeAppearance(value));
  const [isCustomThemeEditorOpen, setIsCustomThemeEditorOpen] = useState(
    () => normalizeAppearance(value).presetId === 'custom'
  );
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const committedAppearance = useRef(normalizeAppearance(value));

  useEffect(() => {
    const saved = normalizeAppearance(value);
    committedAppearance.current = saved;
    setDraft(saved);
  }, [value]);

  useEffect(() => {
    applyAppearance(draft);
  }, [draft]);

  useEffect(() => () => {
    applyAppearance(committedAppearance.current);
  }, []);

  const updateDraft = (updates: Partial<AppearancePreferences>) => {
    setDraft(current => normalizeAppearance({ ...current, ...updates }));
  };

  const commitSlider = (key: keyof AppearancePreferences, value: number) => {
    const next = normalizeAppearance({ ...draft, [key]: value });
    setDraft(next);
    void handleApply(next);
  };

  const handleApply = async (next = draft) => {
    if (!isValidHex(next.accentColor)
      || (next.presetId === 'custom' && [
        next.customThemeBackgroundColor,
        next.customThemeSurfaceColor,
        next.customThemeTextColor,
        next.customThemeBorderColor
      ].some(color => !isValidHex(color)))) {
      onError('Enter valid HEX colors, for example #B88648.');
      return;
    }
    const normalized = normalizeAppearance(next);
    committedAppearance.current = normalized;
    setIsSaving(true);
    try {
      await onApply(normalized);
      onSuccess('Appearance saved.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not save appearance settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    const reset = normalizeAppearance(DEFAULT_APPEARANCE);
    setDraft(reset);
    void handleApply(reset);
  };

  const handleBackgroundSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const isVideo = file.type.startsWith('video/') || file.name.toLowerCase().endsWith('.mp4');
      const backgroundImage = isVideo
        ? await storeBackgroundVideo(file)
        : await storeOriginalBackgroundImage(file);
      updateDraft({ backgroundId: 'custom', backgroundImage, backgroundIsVideo: isVideo });
      onSuccess('Custom background ready to preview. Apply to save.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not use that image as a background.');
    }
  };

  const canApply = !isSaving
    && isValidHex(draft.accentColor)
    && (draft.presetId !== 'custom' || [
      draft.customThemeBackgroundColor,
      draft.customThemeSurfaceColor,
      draft.customThemeTextColor,
      draft.customThemeBorderColor
    ].every(isValidHex));

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Personalize your workspace</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Coordinated colors, background and display settings.
          </p>
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,1fr)]">
        <div className="space-y-5">
          <div className="space-y-2.5">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Coordinated themes</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {APPEARANCE_PRESETS.map(preset => {
                const selected = draft.presetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      const isEyeComfort = preset.id === 'comfort-light' || preset.id === 'comfort-dark';
                      updateDraft({
                        presetId: preset.id,
                        backgroundId: preset.id,
                        backgroundImage: '',
                        backgroundIsVideo: false,
                        accentColor: preset.accentColor,
                        colorMode: preset.colorMode,
                        ...(isEyeComfort ? {
                          transparentBackground: false,
                          foregroundTransparency: 0,
                          foregroundBrightness: 100,
                          foregroundContrast: 100,
                          backgroundBrightness: 100,
                          backgroundContrast: 100,
                          textClarity: 0,
                          positionX: 50,
                          positionY: 50,
                          zoom: 100,
                          overlay: 0,
                          blur: 0
                        } : {})
                      });
                      setIsCustomThemeEditorOpen(false);
                    }}
                    className={`overflow-hidden rounded-xl border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      selected
                        ? 'border-indigo-500 ring-1 ring-indigo-500 dark:border-indigo-400'
                        : 'border-slate-200 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500'
                    }`}
                  >
                    <span className="block h-12" style={{ background: preset.preview }} />
                    <span className="flex items-center justify-between gap-1 px-2.5 py-2">
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold text-slate-800 dark:text-slate-100">{preset.name}</span>
                        <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">{preset.description}</span>
                      </span>
                      {selected && <Check className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" />}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                aria-pressed={draft.presetId === 'custom'}
                aria-expanded={isCustomThemeEditorOpen}
                onClick={() => {
                  if (draft.presetId !== 'custom') {
                    updateDraft({ presetId: 'custom' });
                    setIsCustomThemeEditorOpen(true);
                    return;
                  }
                  setIsCustomThemeEditorOpen(open => !open);
                }}
                className={`overflow-hidden rounded-xl border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  draft.presetId === 'custom'
                    ? 'border-indigo-500 ring-1 ring-indigo-500 dark:border-indigo-400'
                    : 'border-slate-200 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500'
                }`}
              >
                <span
                  className="block h-12"
                  style={{ background: `linear-gradient(135deg, ${draft.customThemeBackgroundColor}, ${draft.accentColor})` }}
                />
                <span className="flex items-center justify-between gap-1 px-2.5 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-slate-800 dark:text-slate-100">Custom</span>
                    <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">Your colors, your workspace</span>
                  </span>
                  {draft.presetId === 'custom' && <Check className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" />}
                </span>
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Color mode</span>
              <select
                value={draft.colorMode}
                onChange={event => updateDraft({ colorMode: event.target.value as AppearanceColorMode })}
                aria-label="Color mode"
                className="w-full rounded-lg border border-dashed border-slate-300 bg-transparent px-3 py-2 text-center text-sm font-semibold text-slate-700 hover:border-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:text-slate-200 dark:hover:border-indigo-500"
              >
                <option value="system">System preference</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>

            <div className="space-y-1.5">
              <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Custom background</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/mp4,.mp4"
                onChange={event => void handleBackgroundSelected(event)}
                className="sr-only"
                aria-label="Upload a custom background image or MP4 video"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-400 hover:text-indigo-700 dark:border-slate-700 dark:text-slate-200 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
                >
                  {draft.backgroundIsVideo
                    ? <Film className="h-4 w-4 shrink-0" />
                    : <ImagePlus className="h-4 w-4 shrink-0" />}
                  <span className="truncate">
                    {draft.backgroundId === 'custom'
                      ? `Choose another ${draft.backgroundIsVideo ? 'video' : 'image'}`
                      : 'Upload image or MP4'}
                  </span>
                </button>
                {draft.backgroundIsVideo && (
                  <button
                    type="button"
                    onClick={onToggleWallpaperVideoSound}
                    className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-400 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:text-slate-200 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
                    aria-label={wallpaperVideoMuted ? 'Turn wallpaper video sound on' : 'Mute wallpaper video'}
                    aria-pressed={!wallpaperVideoMuted}
                    title={wallpaperVideoMuted ? 'Turn video sound on' : 'Mute video'}
                  >
                    {wallpaperVideoMuted
                      ? <VolumeX className="h-4 w-4" aria-hidden="true" />
                      : <Volume2 className="h-4 w-4" aria-hidden="true" />}
                    <span>{wallpaperVideoMuted ? 'Sound off' : 'Sound on'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Accent color</div>
            <div className="grid grid-cols-4 items-center gap-1">
              {ACCENT_PRESETS.map(preset => {
                const selected = draft.accentColor.toLowerCase() === preset.hex;
                return (
                  <button
                    key={preset.hex}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => updateDraft({ accentColor: preset.hex })}
                    className={`flex min-w-0 items-center gap-1.5 rounded-lg border px-1.5 py-1.5 text-left text-[11px] font-semibold ${
                      selected
                        ? 'border-indigo-500 bg-indigo-50 text-slate-800 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-white'
                        : 'border-transparent text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                    title={`${preset.name} (${preset.hex})`}
                  >
                    <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: preset.hex }} />
                    <span className="truncate">{preset.name}</span>
                  </button>
                );
              })}
              <div className="col-span-3 flex min-w-0 items-center gap-1.5">
                <label className="shrink-0 text-[11px] text-slate-600 dark:text-slate-300" htmlFor="custom-accent-color">
                  Custom HEX
                </label>
                <input
                  type="color"
                  value={isValidHex(draft.accentColor) ? draft.accentColor : '#b88648'}
                  onChange={event => updateDraft({ accentColor: event.target.value })}
                  aria-label="Choose custom accent color"
                  className="h-8 w-8 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <input
                  id="custom-accent-color"
                  type="text"
                  value={draft.accentColor}
                  onChange={event => setDraft(current => ({ ...current, accentColor: event.target.value }))}
                  placeholder="#B88648"
                  aria-invalid={!isValidHex(draft.accentColor)}
                  className="h-8 min-w-0 w-24 rounded-md border border-slate-200 bg-slate-50 px-2 font-mono text-xs uppercase text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                {!isValidHex(draft.accentColor) && <span className="text-[11px] text-rose-600">Enter a valid HEX color.</span>}
              </div>
            </div>
          </div>
          {draft.presetId === 'custom' && isCustomThemeEditorOpen && (
            <div className="space-y-3">
              <div>
                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Custom theme colors</span>
                <span className="mt-0.5 block text-[10px] text-slate-500 dark:text-slate-400">
                  Choose the main colors used throughout the workspace. Changes preview live.
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  ['Page background', 'customThemeBackgroundColor'],
                  ['Cards & surfaces', 'customThemeSurfaceColor'],
                  ['Text', 'customThemeTextColor'],
                  ['Borders', 'customThemeBorderColor']
                ] as const).map(([label, key]) => (
                  <label key={key} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-dashed border-slate-300 bg-transparent px-2.5 py-2 dark:border-slate-700">
                    <span className="min-w-0 text-[11px] font-semibold text-slate-700 dark:text-slate-200">{label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      <input
                        type="color"
                        value={isValidHex(draft[key]) ? draft[key] : DEFAULT_APPEARANCE[key]}
                        onChange={event => updateDraft({ [key]: event.target.value })}
                        aria-label={`Choose custom ${label.toLowerCase()} color`}
                        className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
                      />
                      <input
                        type="text"
                        value={draft[key]}
                        onChange={event => setDraft(current => ({ ...current, [key]: event.target.value }))}
                        placeholder={DEFAULT_APPEARANCE[key]}
                        aria-label={`Custom ${label.toLowerCase()} HEX`}
                        aria-invalid={!isValidHex(draft[key])}
                        className="h-8 w-[5.5rem] rounded-none border-0 bg-transparent px-1.5 font-mono text-[11px] uppercase text-slate-900 shadow-none focus-visible:outline-none dark:text-white"
                      />
                    </span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void handleApply()}
                disabled={!canApply}
                className="w-full rounded-lg border border-dashed border-slate-300 bg-transparent px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-indigo-400 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
              >
                {isSaving ? 'Saving…' : 'Save custom theme'}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
            <SlidersHorizontal className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
            Background controls
          </div>
          {draft.backgroundId === 'custom' && (
            <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <span>Transparent background</span>
              <input
                type="checkbox"
                checked={draft.transparentBackground}
                onChange={event => {
                  const checked = event.target.checked;
                  const next = normalizeAppearance({
                    ...draft,
                    transparentBackground: checked,
                    overlay: checked ? 0 : Math.max(draft.overlay, 10)
                  });
                  setDraft(next);
                  void handleApply(next);
                }}
                className="h-4 w-4 accent-indigo-600"
                aria-label="Use transparent background"
              />
            </label>
          )}
          {([
            ['Horizontal position', 'positionX', 0, 100, '%'],
            ['Vertical position', 'positionY', 0, 100, '%'],
            ['Zoom', 'zoom', 100, 150, '%'],
            ['Foreground transparency', 'foregroundTransparency', 0, 100, '%'],
            ['Foreground brightness', 'foregroundBrightness', 55, 100, '%'],
            ['Foreground contrast', 'foregroundContrast', 50, 150, '%'],
            ['Background brightness', 'backgroundBrightness', 0, 150, '%'],
            ['Background contrast', 'backgroundContrast', 50, 150, '%'],
            ['Foreground sharpness', 'textClarity', 0, 100, '%'],
            ['Dark overlay', 'overlay', 0, 70, '%'],
            ['Blur', 'blur', 0, 12, 'px']
          ] as const).map(([label, key, min, max, unit]) => {
            if (key === 'overlay' && draft.transparentBackground) return null;
            return (
              <label key={key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
                <span className="text-xs text-slate-600 dark:text-slate-300">{label}</span>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{draft[key]}{unit}</span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={key === 'blur' ? 1 : key === 'zoom' ? 2 : 1}
                  value={draft[key]}
                  onChange={event => updateDraft({ [key]: Number(event.target.value) })}
                  onPointerUp={event => commitSlider(key, Number(event.currentTarget.value))}
                  onKeyUp={event => commitSlider(key, Number(event.currentTarget.value))}
                  className="col-span-2 w-full accent-indigo-600"
                  aria-label={label}
                />
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <button
          type="button"
          onClick={handleReset}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset default
        </button>
        <button
          type="button"
          onClick={() => void handleApply()}
          disabled={!canApply}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Apply appearance'}
        </button>
      </div>
    </section>
  );
};
