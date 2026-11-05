import { afterEach, describe, expect, it } from 'vitest';
import { getCurrencySymbol, setActiveCurrencySymbol } from '../currencyDisplay';
import { getToolConfig } from '../calculatorConfig';

afterEach(() => {
  setActiveCurrencySymbol('NPR');
});

describe('currency display preference', () => {
  it('defaults to NPR for existing profiles', () => {
    setActiveCurrencySymbol(undefined);
    expect(getCurrencySymbol()).toBe('NPR');
  });

  it('uses a selected display symbol without changing other values', () => {
    const storedAmount = 1250;
    setActiveCurrencySymbol('₹');

    expect(getCurrencySymbol()).toBe('₹');
    expect(storedAmount).toBe(1250);
  });

  it('accepts a user-defined currency symbol', () => {
    setActiveCurrencySymbol('invalid');
    expect(getCurrencySymbol()).toBe('invalid');
  });

  it('falls back to NPR for invalid custom values', () => {
    setActiveCurrencySymbol('   ');
    expect(getCurrencySymbol()).toBe('NPR');
    setActiveCurrencySymbol('NPR\n');
    expect(getCurrencySymbol()).toBe('NPR');
  });

  it('does not alter the calculator currency converter', () => {
    const calculate = getToolConfig('Currency').calculate;
    const expected = calculate('100', '', '', '', 'USD', 'NPR');

    setActiveCurrencySymbol('€');

    expect(calculate('100', '', '', '', 'USD', 'NPR')).toBe(expected);
  });
});
