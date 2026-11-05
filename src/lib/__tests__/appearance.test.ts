import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyAppearance,
  APPEARANCE_PRESETS,
  DEFAULT_APPEARANCE,
  omitDeviceAppearanceSettings,
  normalizeAppearance,
  readSavedAppearance
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
    delete document.documentElement.dataset.customTheme;
  });

  it('normalizes invalid values and clamps background controls', () => {
    const appearance = normalizeAppearance({
      presetId: 'unknown',
      colorMode: 'auto' as never,
      accentColor: 'bad',
      customThemeBackgroundColor: 'bad',
      customThemeSurfaceColor: 'bad',
      customThemeTextColor: 'bad',
      customThemeBorderColor: 'bad',
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
      presetId: 'private-cosmos',
      colorMode: DEFAULT_APPEARANCE.colorMode,
      accentColor: '#e5c777',
      customThemeBackgroundColor: DEFAULT_APPEARANCE.customThemeBackgroundColor,
      customThemeSurfaceColor: DEFAULT_APPEARANCE.customThemeSurfaceColor,
      customThemeTextColor: DEFAULT_APPEARANCE.customThemeTextColor,
      customThemeBorderColor: DEFAULT_APPEARANCE.customThemeBorderColor,
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

  it('uses Private Cosmos as the default appearance', () => {
    const appearance = normalizeAppearance();

    expect(DEFAULT_APPEARANCE).toMatchObject({
      presetId: 'private-cosmos',
      backgroundId: 'private-cosmos',
      colorMode: 'dark',
      accentColor: '#e5c777'
    });
    expect(appearance.presetId).toBe('private-cosmos');
    expect(appearance.backgroundId).toBe('private-cosmos');
    applyAppearance(appearance);
    expect(document.documentElement.dataset.appearancePreset).toBe('private-cosmos');
  });

  it('removes retired themes and migrates saved selections to Private Cosmos', () => {
    const retiredThemes = ['ocean', 'forest', 'sunset', 'midnight'];
    expect(APPEARANCE_PRESETS.map(preset => preset.id)).not.toEqual(
      expect.arrayContaining(retiredThemes)
    );

    for (const presetId of retiredThemes) {
      expect(normalizeAppearance({
        ...DEFAULT_APPEARANCE,
        presetId,
        backgroundId: presetId
      })).toMatchObject({
        presetId: 'private-cosmos',
        backgroundId: 'private-cosmos'
      });
    }
  });

  it('migrates the previous Sanctuary default but keeps saved theme choices', () => {
    localStorage.setItem('om_appearance', JSON.stringify({
      presetId: 'sanctuary',
      backgroundId: 'sanctuary',
      colorMode: 'light',
      accentColor: '#b88648',
      backgroundImage: '',
      backgroundIsVideo: false,
      transparentBackground: false,
      foregroundTransparency: 0,
      foregroundBrightness: 100,
      foregroundContrast: 100,
      backgroundBrightness: 100,
      backgroundContrast: 100,
      textClarity: 0,
      positionX: 50,
      positionY: 48,
      zoom: 100,
      overlay: 22,
      blur: 0
    }));

    expect(readSavedAppearance()).toMatchObject({
      presetId: 'private-cosmos',
      backgroundId: 'private-cosmos',
      colorMode: 'dark',
      accentColor: '#e5c777'
    });

    localStorage.setItem('om_appearance', JSON.stringify({
      ...DEFAULT_APPEARANCE,
      presetId: 'sanctuary',
      backgroundId: 'sanctuary',
      colorMode: 'light',
      accentColor: '#b88648',
      overlay: 0
    }));
    expect(readSavedAppearance().presetId).toBe('sanctuary');
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

    expect(appearance.backgroundId).toBe('private-cosmos');
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
    expect(appearance.backgroundIsVideo).toBe(false);
  });

  it('accepts a stored MP4 asset as a custom video background', () => {
    const appearance = normalizeAppearance({
      backgroundId: 'custom',
      backgroundImage: 'idb-background:123e4567-e89b-12d3-a456-426614174000',
      backgroundIsVideo: true
    });

    expect(appearance.backgroundId).toBe('custom');
    expect(appearance.backgroundIsVideo).toBe(true);
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
    expect(document.documentElement.style.getPropertyValue('--om-preset-background')).toBe('#090b17');
    expect(document.documentElement.style.getPropertyValue('--om-text-outline-alpha')).toBe('39%');
    expect(document.documentElement.style.getPropertyValue('--om-card-alpha')).toBe('22%');
    expect(document.documentElement.style.getPropertyValue('--om-card-border-alpha')).toBe('29.1%');
    expect(document.documentElement.style.getPropertyValue('--om-card-blur')).toBe('12.1px');
    expect(document.documentElement.dataset.wallpaperCustom).toBe('true');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('uses the coordinated preset tint for surfaces even with a custom wallpaper', () => {
    const sanctuary = APPEARANCE_PRESETS.find(preset => preset.id === 'sanctuary')!;
    applyAppearance({
      ...DEFAULT_APPEARANCE,
      presetId: sanctuary.id,
      backgroundId: 'custom',
      backgroundImage: 'data:image/jpeg;base64,ZmFrZQ==',
      accentColor: sanctuary.accentColor
    });

    expect(document.documentElement.style.getPropertyValue('--om-preset-background')).toBe(sanctuary.backgroundColor);
  });

  it('uses the selected custom wallpaper with a supported appearance', () => {
    applyAppearance({
      ...DEFAULT_APPEARANCE,
      presetId: 'sanctuary',
      backgroundId: 'custom',
      backgroundImage: 'data:image/jpeg;base64,ZmFrZQ=='
    });

    expect(document.documentElement.style.getPropertyValue('--om-wallpaper-image'))
      .toBe('url("data:image/jpeg;base64,ZmFrZQ==")');
  });

  it('normalizes and applies a custom theme color to the wallpaper and surfaces', () => {
    const appearance = applyAppearance({
      ...DEFAULT_APPEARANCE,
      presetId: 'custom',
      backgroundId: 'sanctuary',
      accentColor: '#123',
      customThemeBackgroundColor: '#abc',
      customThemeSurfaceColor: '#345',
      customThemeTextColor: '#789',
      customThemeBorderColor: '#def'
    });

    expect(appearance).toMatchObject({
      presetId: 'custom',
      backgroundId: 'sanctuary',
      accentColor: '#112233',
      customThemeBackgroundColor: '#aabbcc',
      customThemeSurfaceColor: '#334455',
      customThemeTextColor: '#778899',
      customThemeBorderColor: '#ddeeff'
    });
    expect(document.documentElement.style.getPropertyValue('--color-brand')).toBe('#112233');
    expect(document.documentElement.style.getPropertyValue('--om-preset-background')).toBe('#aabbcc');
    expect(document.documentElement.style.getPropertyValue('--om-custom-surface')).toBe('#334455');
    expect(document.documentElement.style.getPropertyValue('--om-custom-text')).toBe('#778899');
    expect(document.documentElement.style.getPropertyValue('--om-custom-border')).toBe('#ddeeff');
    expect(document.documentElement.style.getPropertyValue('--om-card-base')).toBe('#334455');
    expect(document.documentElement.style.getPropertyValue('--om-line')).toBe('#ddeeff');
    expect(document.documentElement.dataset.customTheme).toBe('true');
    expect(document.documentElement.style.getPropertyValue('--om-wallpaper-color')).toBe('#aabbcc');
    expect(document.documentElement.style.getPropertyValue('--om-wallpaper-image')).toContain('#aabbcc');
  });

  it('keeps an uploaded wallpaper when a custom theme is active', () => {
    applyAppearance({
      ...DEFAULT_APPEARANCE,
      presetId: 'custom',
      backgroundId: 'custom',
      backgroundImage: 'data:image/jpeg;base64,ZmFrZQ==',
      customThemeBackgroundColor: '#123456'
    });

    expect(document.documentElement.style.getPropertyValue('--om-wallpaper-color')).toBe('#eee5d9');
    expect(document.documentElement.style.getPropertyValue('--om-wallpaper-image')).toContain('data:image/jpeg;base64,ZmFrZQ==');
  });

  it('removes custom color tokens when switching back to a coordinated theme', () => {
    applyAppearance({
      ...DEFAULT_APPEARANCE,
      presetId: 'custom',
      customThemeBackgroundColor: '#123456',
      customThemeSurfaceColor: '#234567',
      customThemeTextColor: '#345678',
      customThemeBorderColor: '#456789'
    });

    applyAppearance({ ...DEFAULT_APPEARANCE, presetId: 'sanctuary' });

    expect(document.documentElement.dataset.customTheme).toBe('false');
    expect(document.documentElement.style.getPropertyValue('--om-custom-background')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--om-custom-surface')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--om-custom-text')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--om-custom-border')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--om-card-base')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--om-line')).toBe('');
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

  it('applies the Private Cosmos coordinated theme as a dark orbital wallpaper', () => {
    const preset = APPEARANCE_PRESETS.find(item => item.id === 'private-cosmos')!;
    const appearance = applyAppearance({
      ...DEFAULT_APPEARANCE,
      presetId: preset.id,
      backgroundId: preset.id,
      colorMode: preset.colorMode,
      accentColor: preset.accentColor
    });

    expect(appearance).toMatchObject({
      presetId: 'private-cosmos',
      backgroundId: 'private-cosmos',
      colorMode: 'dark',
      accentColor: '#e5c777'
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.getPropertyValue('--om-wallpaper-color')).toBe('#090b17');
    expect(document.documentElement.style.getPropertyValue('--om-wallpaper-image')).toContain('radial-gradient(ellipse');
    expect(document.documentElement.dataset.eyeComfort).toBe('false');
    expect(document.documentElement.dataset.appearancePreset).toBe('private-cosmos');
    expect(document.documentElement.style.getPropertyValue('--om-card-alpha')).toBe('40%');
    expect(document.documentElement.style.getPropertyValue('--om-card-blur')).toBe('22px');
  });

  it('applies foreground transparency to Sanctuary surfaces', () => {
    applyAppearance({
      ...DEFAULT_APPEARANCE,
      presetId: 'sanctuary',
      backgroundId: 'sanctuary',
      foregroundTransparency: 0
    });

    expect(document.documentElement.dataset.appearancePreset).toBe('sanctuary');
    expect(document.documentElement.style.getPropertyValue('--om-preset-background')).toBe('#eee5d9');
    expect(document.documentElement.style.getPropertyValue('--om-card-alpha')).toBe('100%');
    expect(document.documentElement.style.getPropertyValue('--om-card-soft-alpha')).toBe('100%');
    expect(document.documentElement.style.getPropertyValue('--om-card-blur')).toBe('0px');

    applyAppearance({
      ...DEFAULT_APPEARANCE,
      presetId: 'sanctuary',
      backgroundId: 'sanctuary',
      foregroundTransparency: 50
    });
    expect(document.documentElement.style.getPropertyValue('--om-card-alpha')).toBe('50%');
    expect(document.documentElement.style.getPropertyValue('--om-card-soft-alpha')).toBe('50%');

    applyAppearance({
      ...DEFAULT_APPEARANCE,
      presetId: 'sanctuary',
      backgroundId: 'sanctuary',
      foregroundTransparency: 100
    });
    expect(document.documentElement.style.getPropertyValue('--om-card-alpha')).toBe('0%');
    expect(document.documentElement.style.getPropertyValue('--om-card-soft-alpha')).toBe('0%');
  });

  it('applies background controls and transparency to Private Cosmos surfaces', () => {
    applyAppearance({
      ...DEFAULT_APPEARANCE,
      presetId: 'private-cosmos',
      backgroundId: 'private-cosmos',
      positionX: 24,
      positionY: 72,
      zoom: 132,
      overlay: 46,
      blur: 5,
      backgroundBrightness: 84,
      backgroundContrast: 126,
      foregroundTransparency: 100
    });

    expect(document.documentElement.style.getPropertyValue('--om-wallpaper-position')).toBe('24% 72%');
    expect(document.documentElement.style.getPropertyValue('--om-wallpaper-zoom')).toBe('1.32');
    expect(document.documentElement.style.getPropertyValue('--om-wallpaper-overlay')).toBe('0.46');
    expect(document.documentElement.style.getPropertyValue('--om-wallpaper-blur')).toBe('5px');
    expect(document.documentElement.style.getPropertyValue('--om-wallpaper-brightness')).toBe('84%');
    expect(document.documentElement.style.getPropertyValue('--om-wallpaper-contrast')).toBe('126%');
    expect(document.documentElement.style.getPropertyValue('--om-card-alpha')).toBe('0%');
    expect(document.documentElement.style.getPropertyValue('--om-card-blur')).toBe('0px');
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
      presetId: 'sanctuary',
      backgroundId: 'sanctuary',
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

  it('marks custom video wallpapers so the video layer can render behind the workspace', () => {
    applyAppearance({
      ...DEFAULT_APPEARANCE,
      backgroundId: 'custom',
      backgroundImage: 'idb-background:123e4567-e89b-12d3-a456-426614174000',
      backgroundIsVideo: true
    });

    expect(document.documentElement.dataset.wallpaperVideo).toBe('true');
  });
});
