import { beforeEach, describe, expect, it } from 'vitest';
import { formatDate, formatDateObj, setActiveDateFormat } from '../formatDate';

describe('formatDate', () => {
  beforeEach(() => {
    setActiveDateFormat('DD/MM/YYYY');
  });

  it('defaults to day-first format', () => {
    expect(formatDate('2026-11-16')).toBe('16/11/2026');
  });

  it('supports month-first format', () => {
    setActiveDateFormat('MM/DD/YYYY');
    expect(formatDate('2026-11-16')).toBe('11/16/2026');
  });

  it('supports the ISO format', () => {
    setActiveDateFormat('YYYY-MM-DD');
    expect(formatDate('2026-11-16')).toBe('2026-11-16');
  });

  it('keeps the previous format when the setting is cleared', () => {
    setActiveDateFormat('MM/DD/YYYY');
    setActiveDateFormat(undefined);
    expect(formatDate('2026-11-16')).toBe('11/16/2026');
  });

  it('ignores a timestamp suffix on an ISO date string', () => {
    expect(formatDate('2026-11-16T23:45:00.000Z')).toBe('16/11/2026');
  });

  it('returns empty strings and malformed input untouched', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate('16-11-2026')).toBe('16-11-2026');
  });

  it('formats a Date object using its local calendar day', () => {
    expect(formatDateObj(new Date(2026, 10, 16))).toBe('16/11/2026');
    setActiveDateFormat('MM/DD/YYYY');
    expect(formatDateObj(new Date(2026, 0, 5))).toBe('01/05/2026');
  });
});