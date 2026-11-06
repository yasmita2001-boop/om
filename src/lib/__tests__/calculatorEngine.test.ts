import { afterEach, describe, expect, it, vi } from 'vitest';
import { CALCULATOR_CATALOG, CalculatorEngine } from '../calculatorEngine';
import { ALL_TOOL_CONFIGS } from '../calculatorConfig';

const calculator = new CalculatorEngine();

describe('calculator catalog', () => {
  it('has a calculation config for every listed tool', () => {
    for (const tools of Object.values(CALCULATOR_CATALOG)) {
      for (const tool of tools) expect(ALL_TOOL_CONFIGS[tool]?.name).toBe(tool);
    }
  });
});

describe('calculator date calculations', () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
  it('treats a date-only countdown target as today through that calendar day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 6, 13, 30));
    expect(calculator.countdown('2026-11-06')).toBe('Today');
    expect(calculator.countdown('2026-11-07')).toBe('1 days remaining');
  });
  it('counts age by calendar days rather than elapsed 24-hour periods', () => {
    const asOf = new Date(2026, 2, 9, 12);
    expect(calculator.age('2026-03-07', asOf)).toContain('(Total: 2 days lived)');
  });
  it('rejects discounts above 100 percent', () => {
    expect(calculator.discount(100, 100)).toContain('Final Price: NPR 0.00');
    expect(() => calculator.discount(100, 101)).toThrow('Discount percentage must be from 0 to 100');
  });
  it('preserves zero macro ratios and requires a complete split', () => {
    expect(ALL_TOOL_CONFIGS.Macros.calculate('2200', '0', '40', '60')).toContain('Protein: 0g (0%)');
    expect(() => calculator.macros(2200, 40, 40, 40)).toThrow('Macro ratios must add up to 100%');
  });
  it('rejects body-fat measurements that make the logarithm invalid', () => {
    expect(() => calculator.bodyFat('male', 35, 38, 175)).toThrow('Waist circumference must be greater than neck circumference');
    expect(() => calculator.bodyFat('female', 30, 45, 160, 10)).toThrow('Waist plus hip must be greater than neck circumference');
  });
  it('formats the requested time zone instead of reapplying the device time zone', () => {
    const timeFormat = vi.spyOn(Date.prototype, 'toLocaleTimeString');
    const dateFormat = vi.spyOn(Date.prototype, 'toLocaleDateString');
    calculator.timeZoneOffset(0);
    expect(timeFormat).toHaveBeenCalledWith([], expect.objectContaining({ timeZone: 'UTC' }));
    expect(dateFormat).toHaveBeenCalledWith([], expect.objectContaining({ timeZone: 'UTC' }));
  });
});
