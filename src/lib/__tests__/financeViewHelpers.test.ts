import { describe, expect, it } from 'vitest';
import {
  addLoanPaymentPeriod,
  calculateTransactionAmount,
  getFixedDepositValue,
  getLoanInstallment,
  getLoanPeriodsPerYear,
  getSavingsMaturityDate
} from '../financeViewHelpers';

describe('finance view helpers', () => {
  it('calculates safe transaction expressions and rejects unsupported input', () => {
    expect(calculateTransactionAmount('10 + 5 * 2')).toBe(20);
    expect(calculateTransactionAmount('')).toBeNull();
    expect(calculateTransactionAmount('1 + alert(1)')).toBeNull();
  });

  it('preserves end-of-month dates for savings and loan schedules', () => {
    expect(getSavingsMaturityDate('2026-01-31', 1)).toBe('2026-02-28');
    expect(addLoanPaymentPeriod('2026-01-31', 'monthly', 1)).toBe('2026-02-28');
    expect(addLoanPaymentPeriod('2026-01-31', 'weekly', 1)).toBe('2026-02-07');
  });

  it('calculates repayment periods and zero-interest installments', () => {
    expect(getLoanPeriodsPerYear('weekly')).toBe(52);
    expect(getLoanInstallment(1200, 0, 12)).toBe(100);
    expect(getLoanInstallment(0, 5, 12)).toBe(0);
  });

  it('keeps fixed-deposit value at principal when the term has not started', () => {
    const result = getFixedDepositValue({
      id: 'test',
      name: 'Test deposit',
      currentAmount: 1000,
      targetAmount: 0,
      durationMonths: 12,
      annualInterestRate: 10,
      interestMethod: 'simple',
      startDate: '2026-01-01',
      maturityDate: '2027-01-01',
      createdAt: 0,
      updatedAt: 0
    }, '2025-01-01');

    expect(result).toMatchObject({
      currentValue: 1000,
      maturityDate: '2027-01-01'
    });
    expect(result.maturityValue).toBeGreaterThan(1000);
  });
});
