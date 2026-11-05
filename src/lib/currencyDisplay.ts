export const CURRENCY_SYMBOLS = ['NPR', '₹', '$', '€', '£', '¥'] as const;

export type CurrencySymbol = string;

const DEFAULT_CURRENCY_SYMBOL: CurrencySymbol = 'NPR';
let activeCurrencySymbol: CurrencySymbol = DEFAULT_CURRENCY_SYMBOL;

export function isCurrencySymbol(value: string): value is CurrencySymbol {
  return value.trim().length > 0
    && value.trim().length <= 12
    && !/[\u0000-\u001f\u007f]/.test(value);
}

export function setActiveCurrencySymbol(value: unknown): void {
  activeCurrencySymbol = typeof value === 'string' && isCurrencySymbol(value)
    ? value.trim()
    : DEFAULT_CURRENCY_SYMBOL;
}

export function getCurrencySymbol(): CurrencySymbol {
  return activeCurrencySymbol;
}
