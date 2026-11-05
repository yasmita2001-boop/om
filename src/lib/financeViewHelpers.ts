import type { Loan, SavingsPlan, SavingsProductType } from '../types';
import { getLocalDateString } from './dateUtils';
import { calculatorEngine } from './calculatorEngine';

export const STANDARD_EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Rent & Housing',
  'Bills & Utilities',
  'Bank Charges & Fees',
  'Taxes & TDS',
  'Shopping',
  'Travel & Commute',
  'Entertainment',
  'Healthcare & Medical',
  'Education',
  'Personal Care',
  'EMI & Loans',
  'Subscriptions',
  'Home Maintenance',
  'Gifts & Donations',
  'General Expense'
];

export const STANDARD_INCOME_CATEGORIES = [
  'Salary',
  'Freelance / Client Work',
  'Business Income',
  'Investment & Dividends',
  'Rental Income',
  'Interest & Cashback',
  'Gifts & Grants',
  'Bonus / Incentive',
  'Other Income'
];

export const getSavingsProductLabel = (productType?: SavingsPlan['productType']) => {
  switch (productType) {
    case 'fixed_deposit': return 'Fixed Deposit';
    case 'recurring_deposit': return 'Recurring Deposit';
    case 'bank_savings': return 'Bank Savings Account';
    case 'remittance': return 'Remittance Deposit';
    case 'salary_account': return 'Salary Account';
    case 'pension_account': return 'Pension Account';
    case 'call_deposit': return 'Call Deposit';
    case 'special_deposit': return 'Special Deposit Scheme';
    case 'senior_citizen': return 'Senior Citizen Deposit';
    case 'children_deposit': return 'Children / Minor Deposit';
    case 'student_savings': return 'Student Savings';
    case 'women_savings': return 'Women Savings';
    case 'foreign_currency': return 'Foreign Currency Deposit';
    case 'pension': return 'Pension / Retirement';
    case 'cooperative': return 'Cooperative Saving';
    case 'bond': return 'Bond';
    case 'per_transaction': return 'Every-time Savings';
    case 'daily': return 'Daily Savings';
    case 'weekly': return 'Weekly Savings';
    case 'biweekly': return 'Biweekly Savings';
    case 'monthly': return 'Monthly Savings';
    case 'bimonthly': return 'Every 2 Months';
    case 'quarterly': return 'Quarterly Savings';
    case 'half_yearly': return 'Half-yearly Savings';
    case 'yearly': return 'Yearly Savings';
    case 'custom_period': return 'Custom-period Savings';
    case 'goal_based': return 'Goal-based Savings';
    case 'emergency': return 'Emergency Savings';
    case 'round_up': return 'Round-up Savings';
    case 'all_time': return 'All-time Savings';
    case 'other': return 'Other Saving';
    default: return 'Flexible Reserve';
  }
};

export const SIMPLE_SAVINGS_PRODUCTS: SavingsProductType[] = [
  'reserve', 'per_transaction', 'daily', 'weekly', 'biweekly', 'monthly',
  'bimonthly', 'quarterly', 'half_yearly', 'yearly', 'custom_period',
  'goal_based', 'emergency', 'round_up', 'all_time'
];

export const BANK_SAVINGS_PRODUCTS: SavingsProductType[] = [
  'bank_savings', 'fixed_deposit', 'recurring_deposit', 'remittance',
  'salary_account', 'pension_account', 'call_deposit', 'special_deposit',
  'senior_citizen', 'children_deposit', 'student_savings', 'women_savings',
  'foreign_currency', 'cooperative', 'bond', 'other'
];

export const SIMPLE_FREQUENCY_PRODUCTS: Record<string, SavingsProductType> = {
  every_time: 'reserve',
  per_transaction: 'per_transaction',
  daily: 'daily',
  weekly: 'weekly',
  biweekly: 'biweekly',
  monthly: 'monthly',
  bimonthly: 'bimonthly',
  quarterly: 'quarterly',
  half_yearly: 'half_yearly',
  yearly: 'yearly',
  custom: 'custom_period'
};

export const calculateTransactionAmount = (value: string): number | null => {
  const expression = value.trim();
  if (!expression || !/^[\d+\-*/×÷−().%\s]+$/.test(expression)) return null;
  try {
    const result = calculatorEngine.scientific(expression);
    return typeof result === 'number' && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
};

export const isBankSavingsPlan = (plan: SavingsPlan) =>
  plan.category === 'bank' || BANK_SAVINGS_PRODUCTS.includes(plan.productType || 'reserve');

export const LOAN_TYPE_OPTIONS = [
  'Personal Loan', 'Home / Housing Loan', 'Land / Plot Loan', 'Vehicle Loan',
  'Education Loan', 'Business Loan', 'Agriculture Loan', 'SME Loan',
  'Working Capital Loan', 'Gold Loan', 'Loan Against Fixed Deposit',
  'Overdraft (OD)', 'Cash Credit (CC)', 'Credit Card Debt', 'Microfinance Loan',
  'Cooperative Loan', 'Foreign Employment Loan', 'Medical / Emergency Loan',
  'Consumer Loan', 'Personal Borrowing', 'Loan Given to Others', 'Other / Custom'
];

export const PHYSICAL_ASSET_CATEGORIES = [
  { value: 'real_estate', label: 'Property & land' },
  { value: 'vehicle', label: 'Vehicle & transport' },
  { value: 'valuables', label: 'Gold, jewellery & valuables' },
  { value: 'personal', label: 'Personal equipment' },
  { value: 'business', label: 'Business equipment & stock' },
  { value: 'agriculture', label: 'Agriculture & livestock' },
  { value: 'other', label: 'Other physical asset' },
  { value: 'custom', label: 'Custom asset type' }
];

export const addMonthsToDate = (date: string, months: number) => {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day || !Number.isFinite(months)) return date;
  const result = new Date(year, month - 1 + months, 1);
  result.setDate(Math.min(day, new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()));
  return getLocalDateString(result);
};

export const getLoanPeriodsPerYear = (frequency: Loan['repaymentFrequency'] = 'monthly') =>
  frequency === 'weekly' ? 52 : frequency === 'biweekly' ? 26 : frequency === 'quarterly' ? 4 : 12;

export const getLoanInstallment = (
  principal: number,
  annualRate: number,
  termMonths: number,
  method: Loan['interestMethod'] = 'reducing',
  frequency: Loan['repaymentFrequency'] = 'monthly'
) => {
  if (principal <= 0 || termMonths <= 0 || annualRate < 0) return 0;
  const periodsPerYear = getLoanPeriodsPerYear(frequency);
  const periodRate = annualRate / (100 * periodsPerYear);
  const periods = Math.max(1, Math.ceil(termMonths * periodsPerYear / 12));
  if (method === 'flat' || method === 'simple') {
    return (principal + principal * periodRate * periods) / periods;
  }
  if (periodRate === 0) return principal / periods;
  const factor = Math.pow(1 + periodRate, periods);
  return principal * periodRate * factor / (factor - 1);
};

export const addLoanPaymentPeriod = (date: string, frequency: Loan['repaymentFrequency'], count: number) => {
  const result = new Date(`${date}T12:00:00`);
  if (frequency === 'weekly') result.setDate(result.getDate() + 7 * count);
  else if (frequency === 'biweekly') result.setDate(result.getDate() + 14 * count);
  else return addMonthsToDate(date, (frequency === 'quarterly' ? 3 : 1) * count);
  return getLocalDateString(result);
};

export const getSavingsMaturityDate = (startDate: string, durationMonths: number) => {
  const [year, month, day] = startDate.split('-').map(Number);
  if (!year || !month || !day || !Number.isFinite(durationMonths)) return startDate;
  const targetMonth = new Date(year, month - 1 + durationMonths, 1);
  const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
  targetMonth.setDate(Math.min(day, lastDay));
  return getLocalDateString(targetMonth);
};

export const getFixedDepositValue = (plan: SavingsPlan, asOfDate = getLocalDateString()) => {
  const principal = Math.max(0, Number(plan.currentAmount) || 0);
  const annualRate = Math.max(0, Number(plan.annualInterestRate) || 0);
  const compoundingPerYear = Math.max(1, Number(plan.compoundingPerYear) || 4);
  const durationMonths = Math.max(1, Number(plan.durationMonths) || 1);
  const startDate = plan.startDate || getLocalDateString(new Date(plan.createdAt || Date.now()));
  const maturityDate = plan.maturityDate || getSavingsMaturityDate(startDate, durationMonths);
  const toUtcDay = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    return year && month && day ? Date.UTC(year, month - 1, day) : Number.NaN;
  };
  const start = toUtcDay(startDate);
  const maturity = toUtcDay(maturityDate);
  const asOf = toUtcDay(asOfDate);
  if (![start, maturity, asOf].every(Number.isFinite)) {
    return { currentValue: principal, maturityValue: principal, maturityDate: startDate };
  }
  const termDays = Math.max(1, (maturity - start) / 86_400_000);
  const elapsedDays = Math.min(termDays, Math.max(0, (asOf - start) / 86_400_000));
  const elapsedTermFraction = elapsedDays / termDays;
  const termYears = termDays / 365.25;
  const elapsedYears = termYears * elapsedTermFraction;
  if (plan.interestMethod === 'simple') {
    return {
      currentValue: principal * (1 + annualRate / 100 * elapsedYears),
      maturityValue: principal * (1 + annualRate / 100 * termYears),
      maturityDate
    };
  }
  const periods = termYears * compoundingPerYear * elapsedTermFraction;
  const factor = 1 + annualRate / (100 * compoundingPerYear);
  return {
    currentValue: principal * Math.pow(factor, periods),
    maturityValue: principal * Math.pow(factor, termYears * compoundingPerYear),
    maturityDate
  };
};
