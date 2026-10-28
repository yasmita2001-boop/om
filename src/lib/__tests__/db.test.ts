import { afterEach, describe, expect, it, vi } from 'vitest';
import { ENTITY_STORES, STORE_LABELS } from '../db';
import { storage } from '../storage';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('database store metadata', () => {
  it('labels every entity store for user-facing recycle-bin details', () => {
    const unlabeledStores = ENTITY_STORES.filter(storeName => !STORE_LABELS[storeName]);

    expect(unlabeledStores).toEqual([]);
  });

  it('declares each entity store only once', () => {
    expect(new Set(ENTITY_STORES).size).toBe(ENTITY_STORES.length);
  });

  it('does not cache a failed open when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);

    await expect(storage.open()).rejects.toThrow('IndexedDB is not supported');
    await expect(storage.open()).rejects.toThrow('IndexedDB is not supported');
  });
});
