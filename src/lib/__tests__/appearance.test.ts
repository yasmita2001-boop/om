import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyAppearance,
  APPEARANCE_PRESETS,
  DEFAULT_APPEARANCE,
  omitDeviceAppearanceSettings,
  normalizeAppearance
} from '../appearance';

describe('appearance preferences', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('style');
    document.documentElement.classList.remove('dark');
    delete document.documentElement.dataset.wallpaperId;
    delete document.documentElement.dataset.wallpaperCustom;
    delete document.documentElement.dataset.wallpaperTransparent;
    delete document.documentElement.dataset.eyeComfort;
  });

  it('normalizes invalid values and clamps background controls', () => {
    const appearance = normalizeAppearance({
      presetId: 'unknown',
      colorMode: 'auto' as never,
      accentColor: 'bad',
      positionX: 140,
      positionY: -10,
      zoom: 300,
      overlay: 95,
      foregroundTransparency: 105,
      foregroundBrightness: 180,
      foregroundContrast: 200,
      backgroundBrightness: 200,
      backgroundContrast: 0,
      textClarity: -10,
      blur: -2
    });

    expect(appearance).toMatchObject({
      presetId: 'sanctuary',
      colorMode: DEFAULT_APPEARANCE.colorMode,
      accentColor: '#b88648',
      positionX: 100,
      positionY: 0,
      zoom: 150,
      overlay: 70,
      foregroundTransparency: 100,
      foregroundBrightness: 100,
      foregroundContrast: 150,
      backgroundBrightness: 150,
      backgroundContrast: 50,
      textClarity: 0,
      blur: 0
    });
  });

  it('allows the background to be dimmed fully', () => {
    const appearance = normalizeAppearance({ backgroundBrightness: 0 });

    expect(appearance.backgroundBrightness).toBe(0);
    expect(normalizeAppearance({ backgroundBrightness: -1 }).backgroundBrightness).toBe(0);
  });

  it('allows the foreground to be dimmed independently', () => {
    const appearance = normalizeAppearance({ foregroundBrightness: 0 });

    expect(appearance.foregroundBrightness).toBe(55);
    expect(normalizeAppearance({ foregroundBrightness: 54 }).foregroundBrightness).toBe(55);
    expect(normalizeAppearance({ foregroundBrightness: 101 }).foregroundBrightness).toBe(100);
  });

  it('clamps foreground contrast and applies it independently of wallpaper contrast', () => {
    const appearance = applyAppearance({
      ...DEFAULT_APPEARANCE,
      foregroundContrast: 125,
      backgroundContrast: 80
    });

    expect(appearance.foregroundContrast).toBe(125);
    expect(document.documentElement.style.getPropertyValue('--om-foreground-contrast')).toBe('1.25');
    expect(document.documentElement.dataset.foregroundContrast).toBe('true');
    expect(document.documentElement.style.getPropertyValue('--om-wallpaper-contrast')).toBe('80%');
    expect(normalizeAppearance({ foregroundContrast: 151 }).foregroundContrast).toBe(150);
    expect(normalizeAppearance({ foregroundContrast: 49 }).foregroundContrast).toBe(50);
  });

  it('accepts a bounded image data URL as a custom background', () => {
    const appearance = normalizeAppearance({
      backgroundId: 'custom',
      backgroundImage: 'data:image/jpeg;base64,ZmFrZQ=='
    });

    expect(appearance.backgroundId).toBe('custom');
    expect(appearance.backgroundImage).toBe('data:image/jpeg;base64,ZmFrZQ==');
  });

  it('rejects unsafe or oversized custom background values', () => {
    const appearance = normalizeAppearance({
      backgroundId: 'custom',
      backgroundImage: `https://example.com/image.jpg`
    });

    expect(appearance.backgroundId).toBe('sanctuary');
    expect(appearance.backgroundImage).toBe('');
  });

  it('accepts high-resolution custom backgrounds within the expanded size limit', () => {
    const backgroundImage = `data:image/jpeg;base64,${'a'.repeat(1_400_000)}`;
    const appearance = normalizeAppearance({ backgroundId: 'custom', backgroundImage });

    expect(appearance.backgroundId).toBe('custom');
    expect(appearance.backgroundImage).toBe(backgroundImage);
  });

  it('accepts a stored original-image asset as a custom background', () => {
    const backgroundImage = 'idb-background:123e4567-e89b-12d3-a456-426614174000';
    const appearance = normalizeAppearance({ backgroundId: 'custom', backgroundImage });

    expect(appearance.backgroundId).toBe('custom');
    expect(appearance.backgroundImage).toBe(backgroundImage);
  });

  it('keeps device appearance out of portable workspace settings', () => {
    const settings = omitDeviceAppearanceSettings({
      profileId: 'google-user',
      appearance: DEFAULT_APPEARANCE,
      themeMode: 'dark',
      accentColor: '#b88648',
      notificationsEnabled: true
    });

    expect(settings).toEqual({
      profileId: 'google-user',
      notificationsEnabled: true
    });
  });

  it('applies the theme colors and wallpaper controls to document styles', () => {
    const applied = applyAppearance({
      ...DEFAULT_APPEARANCE,
      backgroundId: 'custom',
      backgroundImage: 'data:image/jpeg;base64,ZmFrZQ==',
      accentColor: '#2563eb',
      positionX: 35,
      positionY: 70,
      zoom: 120,
      overlay: 30,
      foregroundTransparency: 45,
      foregroundBrightness: 55,
      foregroundContrast: 125,
      backgroundBrightness: 120,
      backgroundContrast: 130,
      textClarity: 60,
      blur: 4
    });

    expect(applied.accentColor).toBe('#2563eb');
    expect(document.documentElement.style.getPropertyValue('--color-brand')).toBe('#2563eb');
    expect(document.documentElement.style.getPropertyValue('--om-wallpaper-position')).toBe('35% 70%');
    expect(document.documentElement.style.getPropertyValue('--om-wallpaper-zoom')).toBe('1.2');
    expect(document.documentElement.style.getPropertyValue('--om-wallpaper-overlay')).toBe('0.3');
    expect(document.documentElement.style.getPropertyValue('--om-wallpaper-blur')).toBe('4px');
    expect(document.documentElement.style.getPropertyValue('--om-wallpaper-brightness')).toBe('120%');
    expect(document.documentElement.style.getPropertyValue('--om-wallpaper-contrast')).toBe('130%');
    expect(document.documentElement.style.getPropertyValue('--om-foreground-dim-alpha')).toBe('0.45');
    expect(document.documentElement.style.getPropertyValue('--om-preset-background')).toBe('#eee5d9');
    expect(document.documentElement.style.getPropertyValue('--om-text-outline-alpha')).toBe('39%');
    expect(document.documentElement.style.getPropertyValue('--om-card-alpha')).toBe('52.8%');
    expect(document.documentElement.style.getPropertyValue('--om-card-border-alpha')).toBe('13.7%');
    expect(document.documentElement.style.getPropertyValue('--om-card-blur')).toBe('8.8px');
    expect(document.documentElement.dataset.wallpaperCustom).toBe('true');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('uses the coordinated preset tint for surfaces even with a custom wallpaper', () => {
    const ocean = APPEARANCE_PRESETS.find(preset => preset.id === 'ocean')!;
    applyAppearance({
      ...DEFAULT_APPEARANCE,
      presetId: ocean.id,
      backgroundId: 'custom',
      backgroundImage: 'data:image/jpeg;base64,ZmFrZQ==',
      accentColor: ocean.accentColor
    });

    expect(document.documentElement.style.getPropertyValue('--om-preset-background')).toBe(ocean.backgroundColor);
  });

  it('applies low-distraction light and dark eye-comfort themes', () => {
    const light = APPEARANCE_PRESETS.find(preset => preset.id === 'comfort-light')!;
    const dark = APPEARANCE_PRESETS.find(preset => preset.id === 'comfort-dark')!;

    applyAppearance({
      ...DEFAULT_APPEARANCE,
      presetId: light.id,
      backgroundId: light.id,
      colorMode: light.colorMode,
      accentColor: light.accentColor
    });
    expect(document.documentElement.dataset.eyeComfort).toBe('true');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.getPropertyValue('--om-wallpaper-image')).toContain('linear-gradient');

    applyAppearance({
      ...DEFAULT_APPEARANCE,
      presetId: dark.id,
      backgroundId: dark.id,
      colorMode: dark.colorMode,
      accentColor: dark.accentColor
    });
    expect(document.documentElement.dataset.eyeComfort).toBe('true');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    applyAppearance(DEFAULT_APPEARANCE);
    expect(document.documentElement.dataset.eyeComfort).toBe('false');
  });

  it('makes the document transparent when transparent custom wallpaper is enabled', () => {
    applyAppearance({
      ...DEFAULT_APPEARANCE,
      backgroundId: 'custom',
      backgroundImage: 'data:image/jpeg;base64,ZmFrZQ==',
      transparentBackground: true
    });

    expect(document.documentElement.dataset.wallpaperTransparent).toBe('true');
    expect(document.documentElement.style.backgroundColor).toBe('transparent');
    expect(document.documentElement.style.getPropertyValue('--om-wallpaper-overlay')).toBe('0');
  });

  it('keeps foreground surfaces readable while showing the wallpaper at maximum transparency', () => {
    applyAppearance({
      ...DEFAULT_APPEARANCE,
      foregroundTransparency: 100
    });

    expect(document.documentElement.style.getPropertyValue('--om-card-alpha')).toBe('0%');
    expect(document.documentElement.style.getPropertyValue('--om-card-soft-alpha')).toBe('0%');
    expect(document.documentElement.style.getPropertyValue('--om-card-border-alpha')).toBe('6%');
    expect(document.documentElement.style.getPropertyValue('--om-card-shadow-alpha')).toBe('0%');
    expect(document.documentElement.style.getPropertyValue('--om-card-blur')).toBe('0px');
    expect(document.documentElement.style.getPropertyValue('--om-foreground-transparency')).toBe('100%');
    expect(document.documentElement.style.getPropertyValue('--om-text-outline-alpha')).toBe('0%');
  });

  it('uses the preset wallpaper while a stored custom image is unavailable', () => {
    applyAppearance({
      ...DEFAULT_APPEARANCE,
      backgroundId: 'custom',
      backgroundImage: 'idb-background:123e4567-e89b-12d3-a456-426614174000'
    });

    expect(document.documentElement.style.getPropertyValue('--om-wallpaper-image')).not.toContain('idb-background:');
  });
});
