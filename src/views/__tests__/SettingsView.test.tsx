import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsView } from '../SettingsView';
import { DEFAULT_APPEARANCE } from '../../lib/appearance';
import type { AppState } from '../../types';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock('../../lib/storage', () => ({
  storage: {
    getActiveProfileId: vi.fn(() => 'profile'),
    getStorageEstimate: vi.fn(async () => ({ usage: 100, quota: 1000, percent: 10, level: 'healthy', available: true })),
    calculateProfileStorageStats: vi.fn(async () => ({ totalBytes: 100 })),
    getSingleton: vi.fn(async () => ({ profileId: 'profile' })),
    setSingleton: vi.fn(),
    getAll: vi.fn(async () => []),
    put: vi.fn()
  },
  purgeAllDefaultDataPermanently: vi.fn(),
  performHardAppReset: vi.fn(),
  cleanOrphanedCacheAndTrash: vi.fn()
}));

vi.mock('../../components/AppearanceCustomizer', () => ({
  AppearanceCustomizer: () => <section data-testid="appearance-customizer" />
}));

vi.mock('../RecycleBinView', () => ({
  RecycleBinView: () => <section data-testid="settings-recycle-bin" />
}));

vi.mock('../../components/UniversalDataManagerCard', () => ({
  UniversalDataManagerCard: () => <section data-testid="settings-data-manager" />
}));

vi.mock('../../components/ConfirmModal', () => ({
  ConfirmModal: () => null
}));

type SettingsProps = ComponentProps<typeof SettingsView>;

const props: SettingsProps = {
  settings: { profileId: 'profile', currencySymbol: 'NPR' } as AppState,
  onRefresh: vi.fn(),
  onSuccess: vi.fn(),
  onError: vi.fn(),
  theme: 'light',
  onToggleTheme: vi.fn(),
  appearance: DEFAULT_APPEARANCE,
  onApplyAppearance: vi.fn(async () => undefined),
  wallpaperVideoMuted: false,
  onToggleWallpaperVideoSound: vi.fn()
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('Settings card layouts', () => {
  it('uses the shared card surface for system settings and opens appearance from the submenu', async () => {
    await act(async () => root.render(<SettingsView {...props} />));

    const systemGrid = container.querySelector('.settings-system-grid')!;
    const cards = [...systemGrid.querySelectorAll('.settings-card')];
    expect(cards).toHaveLength(1);
    for (const card of cards) {
      expect(card.className).toContain('rounded-2xl');
      expect(card.className).toContain('bg-white');
      expect(card.className).toContain('shadow-card');
      expect(card.className).not.toContain('border-dashed');
    }
    expect(cards[0].querySelector('h2')?.textContent).toBe('Storage Usage');
    expect(cards[0].querySelector('[aria-label="Currency display symbol"]')).not.toBeNull();
    expect(cards[0].textContent).toContain('Currency display symbol');
    expect(cards[0].querySelector('[aria-label="Currency display symbol"]')?.className).toContain('settings-flat-select');

    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Settings submenu"]')!.click());
    const sectionOptions = [...container.querySelectorAll<HTMLButtonElement>('[data-settings-section]')];
    expect(sectionOptions.map(option => option.textContent?.trim())).toEqual([
      'System & Appearance',
      'Data & Backups',
      'Appearance'
    ]);
    await act(async () => sectionOptions[2].click());

    expect(container.querySelector('[data-testid="appearance-customizer"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="appearance-customizer"]')?.parentElement?.className).toContain('md:col-span-2');
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Settings submenu"]')?.textContent).toContain('Appearance');
  });

  it('keeps backup and maintenance cards in their separate Settings tab', async () => {
    await act(async () => root.render(<SettingsView {...props} />));

    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Settings submenu"]')!.click());
    expect([...container.querySelectorAll<HTMLButtonElement>('[data-settings-section]')].map(option => option.textContent?.trim())).toEqual([
      'System & Appearance',
      'Data & Backups',
      'Appearance'
    ]);
    await act(async () => container.querySelector<HTMLButtonElement>('[data-settings-section="exports"]')!.click());

    expect(container.querySelector('.settings-system-grid')).toBeNull();
    expect(container.querySelector('[data-testid="settings-data-manager"]')).not.toBeNull();
    expect(container.textContent).toContain('Danger Zone');
  });
});
