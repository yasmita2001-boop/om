import { CALC_UNIT_FACTORS } from './calculatorEngine';

const RATES_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_KEY = 'om-currency-rates-v1';
const FALLBACK_RATES = CALC_UNIT_FACTORS.Currency;

interface CachedCurrencyRates {
  rates: Record<string, number>;
  updatedAt: number;
  nextUpdateAt: number;
}

interface AvailableCurrencyRates {
  rates: Record<string, number>;
  updatedAt: number;
  nextUpdateAt: number;
  source: 'reference' | 'cached';
}

export type CurrencyRateData = AvailableCurrencyRates
  | { rates: Record<string, number>; updatedAt: null; nextUpdateAt: null; source: 'offline' };

let memoryCache: CachedCurrencyRates | null = null;
let pendingRequest: Promise<CurrencyRateData> | null = null;

const hasSupportedRates = (rates: unknown): rates is Record<string, number> => {
  if (!rates || typeof rates !== 'object') return false;
  return Object.keys(FALLBACK_RATES).every((currency) => {
    const rate = (rates as Record<string, unknown>)[currency];
    return typeof rate === 'number' && Number.isFinite(rate) && rate > 0;
  });
};

const isValidCache = (value: unknown): value is CachedCurrencyRates => {
  if (!value || typeof value !== 'object') return false;
  const cached = value as Partial<CachedCurrencyRates>;
  return hasSupportedRates(cached.rates)
    && typeof cached.updatedAt === 'number'
    && Number.isFinite(cached.updatedAt)
    && typeof cached.nextUpdateAt === 'number'
    && Number.isFinite(cached.nextUpdateAt);
};

const readStoredRates = (): CachedCurrencyRates | null => {
  try {
    const stored = window.localStorage.getItem(CACHE_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    return isValidCache(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const storeRates = (rates: CachedCurrencyRates): void => {
  memoryCache = rates;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(rates));
  } catch {
    // Keep the in-memory copy if browser storage is unavailable.
  }
};

const toRateData = (rates: CachedCurrencyRates, source: AvailableCurrencyRates['source']): AvailableCurrencyRates => ({
  rates: rates.rates,
  updatedAt: rates.updatedAt,
  nextUpdateAt: rates.nextUpdateAt,
  source
});

export const getCurrencyRates = async (): Promise<CurrencyRateData> => {
  const now = Date.now();
  const cached = memoryCache || (typeof window !== 'undefined' ? readStoredRates() : null);

  if (cached && cached.nextUpdateAt > now) {
    memoryCache = cached;
    return toRateData(cached, 'reference');
  }

  if (pendingRequest) return pendingRequest;

  pendingRequest = (async () => {
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8000);
      let response: Response;
      try {
        response = await fetch(RATES_URL, { signal: controller.signal, cache: 'no-store' });
      } finally {
        window.clearTimeout(timeout);
      }

      if (!response.ok) throw new Error(`Currency rate request failed (${response.status})`);
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== 'object') throw new Error('Invalid currency rate response');

      const data = payload as {
        result?: unknown;
        base_code?: unknown;
        rates?: unknown;
        time_last_update_unix?: unknown;
        time_next_update_unix?: unknown;
      };
      if (data.result !== 'success' || data.base_code !== 'USD' || !hasSupportedRates(data.rates)
        || typeof data.time_last_update_unix !== 'number'
        || !Number.isFinite(data.time_last_update_unix)
        || typeof data.time_next_update_unix !== 'number'
        || !Number.isFinite(data.time_next_update_unix)) {
        throw new Error('Invalid currency rate response');
      }

      const latestRates: CachedCurrencyRates = {
        rates: data.rates,
        updatedAt: data.time_last_update_unix * 1000,
        nextUpdateAt: data.time_next_update_unix * 1000
      };
      storeRates(latestRates);
      return toRateData(latestRates, 'reference');
    } catch {
      if (cached) {
        memoryCache = cached;
        return toRateData(cached, 'cached');
      }
      return { rates: FALLBACK_RATES, updatedAt: null, nextUpdateAt: null, source: 'offline' };
    } finally {
      pendingRequest = null;
    }
  })();

  return pendingRequest;
};
