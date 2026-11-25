import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CALC_UNIT_FACTORS } from '../calculatorEngine';

const rates = { ...CALC_UNIT_FACTORS.Currency, NPR: 150, INR: 93 };

const response = (now: number) => ({
  result: 'success',
  base_code: 'USD',
  rates,
  time_last_update_unix: Math.floor(now / 1000),
  time_next_update_unix: Math.floor((now + 86_400_000) / 1000)
});

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('currency reference rates', () => {
  it('fetches supported rates and reuses them until the provider update time', async () => {
    const now = Date.now();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response(now)
    });
    vi.stubGlobal('fetch', fetchMock);
    const { getCurrencyRates } = await import('../currencyRates');

    const first = await getCurrencyRates();
    const second = await getCurrencyRates();

    expect(first).toEqual({
      rates,
      updatedAt: Math.floor(now / 1000) * 1000,
      nextUpdateAt: Math.floor((now + 86_400_000) / 1000) * 1000,
      source: 'reference'
    });
    expect(second.source).toBe('reference');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses the clearly marked offline fallback when the rates service is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const { getCurrencyRates } = await import('../currencyRates');

    const result = await getCurrencyRates();

    expect(result.source).toBe('offline');
    expect(result.updatedAt).toBeNull();
    expect(result.rates).toEqual(CALC_UNIT_FACTORS.Currency);
  });
});
