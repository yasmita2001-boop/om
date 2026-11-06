import { describe, expect, it } from 'vitest';
import { calculateNextOccurrence } from '../recurrenceEngine';
import type { RecurrenceConfig } from '../../types';

const config = (overrides: Partial<RecurrenceConfig> = {}): RecurrenceConfig => ({
  frequency: 'daily',
  interval: 1,
  endType: 'never',
  ...overrides,
});

describe('calculateNextOccurrence', () => {
  it('includes a selected weekday that falls on the next day and respects weekly intervals afterward', () => {
    const everyOtherTuesday = config({ frequency: 'weekly', interval: 2, weekDays: [2] });
    expect(calculateNextOccurrence('2026-03-02', everyOtherTuesday)).toBe('2026-03-03');
    expect(calculateNextOccurrence('2026-03-03', everyOtherTuesday)).toBe('2026-03-17');
  });

  it('clamps a monthly recurrence to the last day of shorter months', () => {
    expect(calculateNextOccurrence('2026-01-31', config({ frequency: 'monthly' }))).toBe('2026-02-28');
  });

  it('clamps leap-day yearly recurrences in non-leap years', () => {
    expect(calculateNextOccurrence('2024-02-29', config({ frequency: 'yearly' }))).toBe('2025-02-28');
  });

  it('does not generate an occurrence beyond the configured end date', () => {
    expect(calculateNextOccurrence('2026-10-25', config({
      frequency: 'weekly',
      interval: 1,
      weekDays: [0],
      endType: 'by_date',
      endByDate: '2026-10-31',
    }))).toBeNull();
  });

  it('rejects invalid calendar dates instead of throwing', () => {
    expect(calculateNextOccurrence('2026-02-30', config())).toBeNull();
  });
});
