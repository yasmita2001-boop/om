import { describe, expect, it } from 'vitest';
import { estimateRemainingInvestmentValue, getFinancialPosition } from '../financeCalculations';

describe('estimateRemainingInvestmentValue', () => {
  it('updates a partial sale without tracked units proportionally to remaining cost basis', () => {
    expect(estimateRemainingInvestmentValue(1500, 1000, 400, 0, 0, 600)).toBe(900);
  });
  it('uses the actual sale price when units are tracked', () => {
    expect(estimateRemainingInvestmentValue(1200, 800, 200, 8, 2, 300)).toBe(900);
  });
  it('supports unit-tracked positions with zero cost basis', () => {
    expect(estimateRemainingInvestmentValue(1200, 0, 0, 4, 1, 300)).toBe(900);
  });

  it('values a complete sale at zero', () => {
    expect(estimateRemainingInvestmentValue(1500, 1000, 1000, 0, 0, 1200)).toBe(0);
  });
});

describe('financial position', () => {
  it('includes cash, investments, savings, receivables, assets, and every debt source', () => {
    const position = getFinancialPosition({
      accounts: [{ id: 'cash', name: 'Cash', type: 'cash', balance: 100, openingBalance: 100 }],
      assets: [
        { id: 'active', name: 'Active asset', value: 200 },
        { id: 'disposed', name: 'Disposed asset', value: 500, status: 'disposed' }
      ],
      liabilities: [{ id: 'manual-debt', name: 'Manual debt', amount: 50 }],
      loans: [
        { id: 'borrowed', name: 'Borrowed', principal: 400, rate: 0, tenure: 1, dueDay: 1, outstanding: 400, createdAt: 1 },
        { id: 'lent', name: 'Lent', principal: 250, rate: 0, tenure: 1, dueDay: 1, outstanding: 250, direction: 'lent', createdAt: 1 }
      ],
      investments: [{
        id: 'investment',
        name: 'Investment',
        amount: 1000,
        currentValue: 900,
        date: '2026-01-01',
        createdAt: 1,
        updatedAt: 1
      }],
      investmentActivities: [],
      savingsPlans: [{
        id: 'savings',
        name: 'Savings',
        currentAmount: 300,
        targetAmount: 0,
        durationMonths: 12,
        createdAt: 1
      }]
    });

    expect(position).toMatchObject({
      liquidCash: 100,
      investmentValue: 900,
      totalSavings: 300,
      manualAssetsValue: 200,
      totalLoanReceivables: 250,
      totalLoanLiabilities: 400,
      manualLiabilitiesValue: 50,
      totalAssets: 1750,
      totalLiabilities: 450,
      netWorth: 1300
    });
  });
});
