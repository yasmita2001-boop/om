import sanctuaryEnvironmentUrl from '../assets/sanctuary-environment.svg';
import { applyAccent } from './accentTheme';

export type AppearanceColorMode = 'light' | 'dark' | 'system';

export interface AppearancePreferences {
  presetId: string;
  colorMode: AppearanceColorMode;
  accentColor: string;
  backgroundId: string;
  backgroundImage: string;
  transparentBackground: boolean;
  foregroundTransparency: number;
  foregroundBrightness: number;
  foregroundContrast: number;
  backgroundBrightness: number;
  backgroundContrast: number;
  textClarity: number;
  positionX: number;
  positionY: number;
  zoom: number;
  overlay: number;
  blur: number;
}

export const APPEARANCE_PRESETS = [
  {
    id: 'sanctuary',
    name: 'Sanctuary',
    description: 'Warm and grounded',
    accentColor: '#b88648',
    colorMode: 'light' as const,
    backgroundColor: '#eee5d9',
    backgroundImage: `url("${sanctuaryEnvironmentUrl}")`,
    preview: 'linear-gradient(135deg, #f3eadc, #c8a77a)'
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Clear and calm',
    accentColor: '#0e7490',
    colorMode: 'light' as const,
    backgroundColor: '#dceef2',
    backgroundImage: 'linear-gradient(135deg, #c5e7ee 0%, #7db8c9 52%, #397f97 100%)',
    preview: 'linear-gradient(135deg, #c5e7ee, #397f97)'
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Natural and balanced',
    accentColor: '#15803d',
    colorMode: 'light' as const,
    backgroundColor: '#e3eadc',
    backgroundImage: 'linear-gradient(135deg, #dce8cf 0%, #86a878 52%, #4c7357 100%)',
    preview: 'linear-gradient(135deg, #dce8cf, #4c7357)'
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Soft and expressive',
    accentColor: '#e11d48',
    colorMode: 'light' as const,
    backgroundColor: '#f1ded6',
    backgroundImage: 'linear-gradient(135deg, #f8d8ae 0%, #e99b88 52%, #9d6077 100%)',
    preview: 'linear-gradient(135deg, #f8d8ae, #9d6077)'
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Focused and low-light',
    accentColor: '#818cf8',
    colorMode: 'dark' as const,
    backgroundColor: '#111827',
    backgroundImage: 'linear-gradient(135deg, #263a63 0%, #202947 48%, #111827 100%)',
    preview: 'linear-gradient(135deg, #263a63, #111827)'
  },
  {
    id: 'comfort-light',
    name: 'Eye Comfort Light',
    description: 'Soft, low-distraction light',
    accentColor: '#8b7557',
    colorMode: 'light' as const,
    backgroundColor: '#eeeae1',
    backgroundImage: 'linear-gradient(135deg, #f1eee6 0%, #ece9e0 55%, #e8e5dc 100%)',
    preview: 'linear-gradient(135deg, #f1eee6, #e8e5dc)'
  },
  {
    id: 'comfort-dark',
    name: 'Eye Comfort Dark',
    description: 'Soft, low-glare dark',
    accentColor: '#a99a78',
    colorMode: 'dark' as const,
    backgroundColor: '#191b20',
    backgroundImage: 'linear-gradient(135deg, #22252b 0%, #1b1e23 55%, #17191e 100%)',
    preview: 'linear-gradient(135deg, #22252b, #17191e)'
  }
] as const;

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  presetId: 'sanctuary',
  colorMode: 'dark',
  accentColor: '#b88648',
  backgroundId: 'sanctuary',
  backgroundImage: '',
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
};

const HEX_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const IMAGE_DATA_PATTERN = /^data:image\/(?:jpeg|webp|png);base64,[a-z0-9+/]+=*$/i;
const MAX_BACKGROUND_DATA_URL_LENGTH = 1_500_000;
const BACKGROUND_ASSET_PREFIX = 'idb-background:';
const BACKGROUND_DATABASE_NAME = 'om-appearance-assets';
const BACKGROUND_STORE_NAME = 'backgrounds';
const MAX_BACKGROUND_FILE_SIZE = 12 * 1024 * 1024;
const backgroundObjectUrls = new Map<string, string>();

const isStoredBackgroundAsset = (value: string): boolean =>
  /^idb-background:[a-z0-9-]+$/i.test(value);

function openBackgroundDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BACKGROUND_DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(BACKGROUND_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open image storage.'));
  });
}

const clamp = (value: unknown, min: number, max: number, fallback: number): number => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

export function normalizeAppearance(value?: Partial<AppearancePreferences> | null): AppearancePreferences {
  const preset = APPEARANCE_PRESETS.find(item => item.id === value?.presetId) || APPEARANCE_PRESETS[0];
  const colorMode = value?.colorMode === 'light' || value?.colorMode === 'dark' || value?.colorMode === 'system'
    ? value.colorMode
    : DEFAULT_APPEARANCE.colorMode;
  const rawAccent = typeof value?.accentColor === 'string' ? value.accentColor.trim() : '';
  const accentColor = HEX_PATTERN.test(rawAccent)
    ? rawAccent.length === 4
      ? `#${rawAccent[1]}${rawAccent[1]}${rawAccent[2]}${rawAccent[2]}${rawAccent[3]}${rawAccent[3]}`.toLowerCase()
      : rawAccent.toLowerCase()
    : preset.accentColor;
  const backgroundId = value?.backgroundId === 'custom'
    && typeof value.backgroundImage === 'string'
    && ((IMAGE_DATA_PATTERN.test(value.backgroundImage)
      && value.backgroundImage.length <= MAX_BACKGROUND_DATA_URL_LENGTH)
      || isStoredBackgroundAsset(value.backgroundImage))
    ? 'custom'
    : APPEARANCE_PRESETS.some(item => item.id === value?.backgroundId)
      ? value!.backgroundId!
      : preset.id;
  const backgroundImage = backgroundId === 'custom' && typeof value?.backgroundImage === 'string'
    ? value.backgroundImage
    : '';
  const transparentBackground = Boolean(value?.transparentBackground);

  return {
    presetId: preset.id,
    colorMode,
    accentColor,
    backgroundId,
    backgroundImage,
    transparentBackground,
    foregroundTransparency: clamp(value?.foregroundTransparency, 0, 100, DEFAULT_APPEARANCE.foregroundTransparency),
    foregroundBrightness: clamp(value?.foregroundBrightness, 55, 100, DEFAULT_APPEARANCE.foregroundBrightness),
    foregroundContrast: clamp(value?.foregroundContrast, 50, 150, DEFAULT_APPEARANCE.foregroundContrast),
    backgroundBrightness: clamp(value?.backgroundBrightness, 0, 150, DEFAULT_APPEARANCE.backgroundBrightness),
    backgroundContrast: clamp(value?.backgroundContrast, 50, 150, DEFAULT_APPEARANCE.backgroundContrast),
    textClarity: clamp(value?.textClarity, 0, 100, DEFAULT_APPEARANCE.textClarity),
    positionX: clamp(value?.positionX, 0, 100, DEFAULT_APPEARANCE.positionX),
    positionY: clamp(value?.positionY, 0, 100, DEFAULT_APPEARANCE.positionY),
    zoom: clamp(value?.zoom, 100, 150, DEFAULT_APPEARANCE.zoom),
    overlay: clamp(value?.overlay, 0, 70, DEFAULT_APPEARANCE.overlay),
    blur: clamp(value?.blur, 0, 12, DEFAULT_APPEARANCE.blur)
  };
}

export function getEffectiveColorMode(mode: AppearanceColorMode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyAppearance(value: Partial<AppearancePreferences>): AppearancePreferences {
  const appearance = normalizeAppearance(value);
  const root = document.documentElement;
  const preset = APPEARANCE_PRESETS.find(item => item.id === appearance.backgroundId) || APPEARANCE_PRESETS[0];
  const coordinatedPreset = APPEARANCE_PRESETS.find(item => item.id === appearance.presetId) || APPEARANCE_PRESETS[0];
  const effectiveColorMode = getEffectiveColorMode(appearance.colorMode);
  const isEyeComfort = appearance.presetId === 'comfort-light' || appearance.presetId === 'comfort-dark';
  const isTransparentBackground = appearance.transparentBackground && appearance.backgroundId === 'custom';

  applyAccent(appearance.accentColor);
  root.classList.toggle('dark', effectiveColorMode === 'dark');
  root.setAttribute('data-lifeos-mode', effectiveColorMode);
  root.dataset.wallpaperTransparent = String(isTransparentBackground);
  root.style.backgroundColor = isTransparentBackground ? 'transparent' : effectiveColorMode === 'dark' ? '#0B0F19' : '#F8FAFC';
  const customImageUrl = appearance.backgroundId === 'custom'
    ? backgroundObjectUrls.get(appearance.backgroundImage)
      || (IMAGE_DATA_PATTERN.test(appearance.backgroundImage) ? appearance.backgroundImage : '')
    : '';
  root.style.setProperty('--om-wallpaper-image', appearance.backgroundId === 'custom' && customImageUrl
    ? `url("${customImageUrl}")`
    : preset.backgroundImage);
  root.style.setProperty('--om-wallpaper-color', isTransparentBackground ? 'transparent' : preset.backgroundColor);
  root.style.setProperty('--om-preset-background', coordinatedPreset.backgroundColor);
  root.style.setProperty('--om-wallpaper-position', `${appearance.positionX}% ${appearance.positionY}%`);
  root.style.setProperty('--om-wallpaper-zoom', String(appearance.zoom / 100));
  root.style.setProperty('--om-wallpaper-overlay', String(isTransparentBackground ? 0 : appearance.overlay / 100));
  root.style.setProperty('--om-wallpaper-blur', `${appearance.blur}px`);
  root.style.setProperty('--om-wallpaper-brightness', `${appearance.backgroundBrightness}%`);
  root.style.setProperty('--om-wallpaper-contrast', `${appearance.backgroundContrast}%`);
  root.style.setProperty('--om-foreground-dim-alpha', String((100 - appearance.foregroundBrightness) / 100));
  root.style.setProperty('--om-foreground-contrast', String(appearance.foregroundContrast / 100));
  const opacity = (100 - appearance.foregroundTransparency) / 100;
  root.style.setProperty('--om-card-alpha', `${Number((96 * opacity).toFixed(1))}%`);
  root.style.setProperty('--om-card-soft-alpha', `${Number((90 * opacity).toFixed(1))}%`);
  root.style.setProperty('--om-card-border-alpha', `${Number((6 + 14 * opacity).toFixed(1))}%`);
  root.style.setProperty('--om-card-shadow-alpha', `${Number((18 * opacity).toFixed(1))}%`);
  root.style.setProperty('--om-card-inset-alpha', `${Number((30 * opacity).toFixed(1))}%`);
  root.style.setProperty('--om-card-blur', `${16 * (100 - appearance.foregroundTransparency) / 100}px`);
  root.style.setProperty('--om-foreground-transparency', `${appearance.foregroundTransparency}%`);
  root.style.setProperty('--om-text-outline-alpha', `${Number((appearance.textClarity * 0.65).toFixed(1))}%`);
  root.style.removeProperty('--om-text-shadow-alpha');
  root.dataset.foregroundContrast = String(appearance.foregroundContrast !== 100);
  root.dataset.wallpaperId = appearance.backgroundId;
  root.dataset.wallpaperCustom = String(appearance.backgroundId === 'custom');
  root.dataset.eyeComfort = String(isEyeComfort);
  return appearance;
}

export function readSavedAppearance(): AppearancePreferences {
  try {
    const saved = localStorage.getItem('om_appearance');
    if (saved) return normalizeAppearance(JSON.parse(saved) as Partial<AppearancePreferences>);
    const savedTheme = localStorage.getItem('om_theme');
    return normalizeAppearance({
      ...DEFAULT_APPEARANCE,
      colorMode: savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : DEFAULT_APPEARANCE.colorMode
    });
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function hasSavedAppearance(): boolean {
  try {
    return localStorage.getItem('om_appearance') !== null;
  } catch {
    return false;
  }
}

export function omitDeviceAppearanceSettings<T extends {
  appearance?: unknown;
  themeMode?: unknown;
  accentColor?: unknown;
}>(settings: T): Omit<T, 'appearance' | 'themeMode' | 'accentColor'> {
  const { appearance: _appearance, themeMode: _themeMode, accentColor: _accentColor, ...portableSettings } = settings;
  return portableSettings;
}

export function saveLocalAppearance(value: AppearancePreferences): void {
  try {
    localStorage.setItem('om_appearance', JSON.stringify(value));
  } catch (error) {
    console.error('Could not save appearance preferences to this device.', error);
    throw new Error('Appearance could not be saved in this browser. Check available storage and try again.');
  }
}

export async function storeOriginalBackgroundImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file to use as your background.');
  }
  if (file.size > MAX_BACKGROUND_FILE_SIZE) {
    throw new Error('Choose an image smaller than 12 MB.');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('This image could not be opened by your browser. Try a JPG, PNG, or WebP image.');
  }

  try {
    if (bitmap.width < 1 || bitmap.height < 1) {
      throw new Error('This image has invalid dimensions. Choose a different image.');
    }

    const assetId = `${BACKGROUND_ASSET_PREFIX}${crypto.randomUUID()}`;
    const database = await openBackgroundDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(BACKGROUND_STORE_NAME, 'readwrite');
        transaction.objectStore(BACKGROUND_STORE_NAME).put(file, assetId);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error('Could not save the original image.'));
        transaction.onabort = () => reject(transaction.error || new Error('Could not save the original image.'));
      });
    } finally {
      database.close();
    }

    backgroundObjectUrls.set(assetId, URL.createObjectURL(file));
    return assetId;
  } finally {
    bitmap.close();
  }
}

export async function restoreBackgroundImage(assetId: string): Promise<void> {
  if (!isStoredBackgroundAsset(assetId) || backgroundObjectUrls.has(assetId)) return;

  const database = await openBackgroundDatabase();
  let image: Blob | undefined;
  try {
    image = await new Promise<Blob | undefined>((resolve, reject) => {
      const request = database.transaction(BACKGROUND_STORE_NAME, 'readonly')
        .objectStore(BACKGROUND_STORE_NAME)
        .get(assetId);
      request.onsuccess = () => resolve(request.result as Blob | undefined);
      request.onerror = () => reject(request.error || new Error('Could not load the saved background image.'));
    });
  } finally {
    database.close();
  }

  if (!image) throw new Error('The saved background image is no longer available on this device.');
  backgroundObjectUrls.set(assetId, URL.createObjectURL(image));
}
