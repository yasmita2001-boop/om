import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  DollarSign, Plus, ArrowUpRight, ArrowUpDown,
  ShieldCheck, Trash2, TrendingUp, Landmark,
  Download, Upload, Paperclip, Receipt, ExternalLink,
  FileText, X, Eye, Link2, Target, ChevronRight, ChevronDown, Pencil,
  RefreshCw, AlertCircle, Check
} from 'lucide-react';
import {
  FinanceAccount, FinanceTransaction, Loan, LoanPayment,
  Investment, SavingsPlan, SavingsProductType, Asset, Liability, FinancialGoal,
  ReceiptItem, NavModule, Goal
} from '../types';
import { storage, generateUUID } from '../lib/storage';
import { getLocalDateString, getLocalMonthString } from '../lib/dateUtils';
import { ConfirmModal } from '../components/ConfirmModal';
import { SlideTabs } from '../components/SlideTabs';
import { LinkModeSelector } from '../components/LinkModeSelector';
import { syncGoalProgressFromFinance } from '../lib/goalTaskSync';

interface FinanceViewProps {
  accounts: FinanceAccount[];
  transactions: FinanceTransaction[];
  loans: Loan[];
  loanPayments?: LoanPayment[];
  investments: Investment[];
  savingsPlans: SavingsPlan[];
  assets?: Asset[];
  liabilities?: Liability[];
  financialGoals?: FinancialGoal[];
  receipts?: ReceiptItem[];
  goals?: Goal[];
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
  onError?: (msg: string) => void;
  onNavigate?: (module: NavModule) => void;
}

const STANDARD_EXPENSE_CATEGORIES = [
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

const STANDARD_INCOME_CATEGORIES = [
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

const getSavingsProductLabel = (productType?: SavingsPlan['productType']) => {
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

const SIMPLE_SAVINGS_PRODUCTS: SavingsProductType[] = [
  'reserve', 'per_transaction', 'daily', 'weekly', 'biweekly', 'monthly',
  'bimonthly', 'quarterly', 'half_yearly', 'yearly', 'custom_period',
  'goal_based', 'emergency', 'round_up', 'all_time'
];

const BANK_SAVINGS_PRODUCTS: SavingsProductType[] = [
  'bank_savings', 'fixed_deposit', 'recurring_deposit', 'remittance',
  'salary_account', 'pension_account', 'call_deposit', 'special_deposit',
  'senior_citizen', 'children_deposit', 'student_savings', 'women_savings',
  'foreign_currency', 'cooperative', 'bond', 'other'
];

const SIMPLE_FREQUENCY_PRODUCTS: Record<string, SavingsProductType> = {
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

const isBankSavingsPlan = (plan: SavingsPlan) =>
  plan.category === 'bank' || BANK_SAVINGS_PRODUCTS.includes(plan.productType || 'reserve');

const getSavingsMaturityDate = (startDate: string, durationMonths: number) => {
  const [year, month, day] = startDate.split('-').map(Number);
  if (!year || !month || !day || !Number.isFinite(durationMonths)) return startDate;
  const targetMonth = new Date(year, month - 1 + durationMonths, 1);
  const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
  targetMonth.setDate(Math.min(day, lastDay));
  return getLocalDateString(targetMonth);
};

const getFixedDepositValue = (plan: SavingsPlan, asOfDate = getLocalDateString()) => {
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

export const FinanceView: React.FC<FinanceViewProps> = ({
  accounts,
  transactions,
  loans,
  loanPayments = [],
  investments,
  savingsPlans,
  assets = [],
  liabilities = [],
  financialGoals = [],
  receipts = [],
  goals = [],
  onRefresh,
  onSuccess,
  onError,
  onNavigate
}) => {
  const today = getLocalDateString();
  const reportError = onError || ((message: string) => onSuccess(`⚠️ ${message}`));
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'accounts' | 'loans' | 'investments' | 'savings' | 'balanceSheet'>('overview');

  // New Transaction Form state
  const [txType, setTxType] = useState<'expense' | 'income' | 'transfer' | 'investment' | 'loan' | 'repayment'>('expense');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState('');
  const [txAccount, setTxAccount] = useState(accounts[0]?.id || '');
  const [txToAccount, setTxToAccount] = useState(accounts[1]?.id || accounts[0]?.id || '');
  const [txRepayLoanId, setTxRepayLoanId] = useState(loans[0]?.id || '');
  const [txNote, setTxNote] = useState('');
  const [txDate, setTxDate] = useState(today);

  // Category Combobox State
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    if (isCategoryDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCategoryDropdownOpen]);

  const categoryList = useMemo(() => {
    return txType === 'income' ? STANDARD_INCOME_CATEGORIES : STANDARD_EXPENSE_CATEGORIES;
  }, [txType]);

  const filteredCategories = useMemo(() => {
    const query = txCategory.trim().toLowerCase();
    return categoryList.filter(cat => !query || cat.toLowerCase().includes(query));
  }, [categoryList, txCategory]);

  // Goal Linking State for all forms
  const [txInputMode, setTxInputMode] = useState<'manual' | 'link'>('manual');
  const [txGoalId, setTxGoalId] = useState('');

  const [loanInputMode, setLoanInputMode] = useState<'manual' | 'link'>('manual');
  const [loanGoalId, setLoanGoalId] = useState('');

  const [liabInputMode, setLiabInputMode] = useState<'manual' | 'link'>('manual');
  const [liabGoalId, setLiabGoalId] = useState('');

  const [invInputMode, setInvInputMode] = useState<'manual' | 'link'>('manual');
  const [invGoalId, setInvGoalId] = useState('');

  const [saveInputMode, setSaveInputMode] = useState<'manual' | 'link'>('manual');
  const [saveGoalId, setSaveGoalId] = useState('');

  const [assetInputMode, setAssetInputMode] = useState<'manual' | 'link'>('manual');
  const [assetGoalId, setAssetGoalId] = useState('');

  // Transactions Filter by Goal
  const [txGoalFilter, setTxGoalFilter] = useState('all');

  // Goal Portfolio Alignment Tab state
  const [goalLevelFilter, setGoalLevelFilter] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [goalSearch, setGoalSearch] = useState('');
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const [onlyFinanciallyLinked, setOnlyFinanciallyLinked] = useState(false);

  // Bill / Receipt Attachment & Things Vault Link state
  const [txAttachedFile, setTxAttachedFile] = useState<{ name: string; size: string; data: string; type: string } | null>(null);
  const [txLinkToReceipt, setTxLinkToReceipt] = useState(false);
  const [txReceiptMode, setTxReceiptMode] = useState<'create_new' | 'link_existing'>('link_existing');
  const [txReceiptTitle, setTxReceiptTitle] = useState('');
  const [txSelectedReceiptId, setTxSelectedReceiptId] = useState('');
  const [previewFile, setPreviewFile] = useState<{ name: string; data: string; type?: string } | null>(null);
  const MAX_RECEIPT_FILE_BYTES = 500 * 1024 * 1024;
  const ALLOWED_RECEIPT_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes < 1024 * 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    return `${(bytes / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TB`;
  };

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleAttachTxFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > MAX_RECEIPT_FILE_BYTES) {
        onSuccess('Receipt attachment must be 500 MB or smaller.');
        return;
      }
      if (!ALLOWED_RECEIPT_TYPES.has(file.type)) {
        onSuccess('Receipt attachment must be PDF, PNG, JPG/JPEG, or WebP.');
        return;
      }
      const dataUrl = await readFileAsDataUrl(file);
      setTxAttachedFile({
        name: file.name,
        size: formatFileSize(file.size),
        data: dataUrl,
        type: file.type
      });
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      if (!txReceiptTitle) setTxReceiptTitle(cleanName);
    } catch (err) {
      console.error('File read error', err);
      onSuccess('Unable to read the selected file.');
    } finally {
      e.target.value = '';
    }
  };

  // New Account Form
  const [acctName, setAcctName] = useState('');
  const [acctType, setAcctType] = useState<'bank' | 'cash' | 'wallet'>('bank');
  const [acctBalance, setAcctBalance] = useState('');
  const [statementAccountId, setStatementAccountId] = useState<string | null>(null);
  const [statementBalance, setStatementBalance] = useState('');

  // New Loan Form
  const [loanName, setLoanName] = useState('');
  const [loanPrincipal, setLoanPrincipal] = useState('');
  const [loanRate, setLoanRate] = useState('8.5');
  const [loanTenure, setLoanTenure] = useState('60');

  // Loan Payment Form
  const [payLoanId, setPayLoanId] = useState(loans[0]?.id || '');
  const [payAmount, setPayAmount] = useState('');
  const [payAcctId, setPayAcctId] = useState(accounts[0]?.id || '');
  const [payPrincipalInput, setPayPrincipalInput] = useState('');
  const [payInterestInput, setPayInterestInput] = useState('');

  // New Liability Form (in Loans & Liabilities)
  const [liabName, setLiabName] = useState('');
  const [liabVal, setLiabVal] = useState('');
  const [liabCategory, setLiabCategory] = useState('Credit Card');
  const [liabDueDate, setLiabDueDate] = useState('');
  const [liabRecordMode, setLiabRecordMode] = useState<'existing' | 'borrowed'>('existing');
  const [liabDepositAccountId, setLiabDepositAccountId] = useState(accounts[0]?.id || '');
  const [liabilityRepaymentId, setLiabilityRepaymentId] = useState<string | null>(null);
  const [liabilityRepaymentAmount, setLiabilityRepaymentAmount] = useState('');
  const [liabilityRepaymentAccountId, setLiabilityRepaymentAccountId] = useState(accounts[0]?.id || '');

  // New Investment Form
  const [invName, setInvName] = useState('');
  const [invAmount, setInvAmount] = useState('');
  const [invCurrentVal, setInvCurrentVal] = useState('');
  const [invAccountId, setInvAccountId] = useState(accounts[0]?.id || '');
  const [editingInvestmentId, setEditingInvestmentId] = useState<string | null>(null);
  const [editingInvestmentValue, setEditingInvestmentValue] = useState('');

  // New Loan Form Disbursal Account
  const [loanDepositAccountId, setLoanDepositAccountId] = useState(accounts[0]?.id || '');

  // New Savings Form
  const [saveName, setSaveName] = useState('');
  const [saveCurrent, setSaveCurrent] = useState('');
  const [saveTarget, setSaveTarget] = useState('');
  const [saveMonths, setSaveMonths] = useState('12');
  const [saveAccountId, setSaveAccountId] = useState(accounts[0]?.id || '');
  const [saveFundingMode, setSaveFundingMode] = useState<'account' | 'already_funded'>('account');
  const [saveProductType, setSaveProductType] = useState<SavingsProductType>('reserve');
  const [saveCategory, setSaveCategory] = useState<'simple' | 'bank'>('simple');
  const [saveFrequency, setSaveFrequency] = useState('monthly');
  const [saveCustomPeriodDays, setSaveCustomPeriodDays] = useState('');
  const [saveContributionAmount, setSaveContributionAmount] = useState('');
  const [saveBankName, setSaveBankName] = useState('');
  const [saveBranchName, setSaveBranchName] = useState('');
  const [saveReference, setSaveReference] = useState('');
  const [saveAnnualInterestRate, setSaveAnnualInterestRate] = useState('8');
  const [saveCompoundingPerYear, setSaveCompoundingPerYear] = useState<'1' | '2' | '4' | '12'>('4');
  const [saveInterestMethod, setSaveInterestMethod] = useState<'compound' | 'simple' | 'bank_manual'>('compound');
  const [saveInterestEffectiveDate, setSaveInterestEffectiveDate] = useState(today);
  const [saveInterestPayoutFrequency, setSaveInterestPayoutFrequency] = useState('at_maturity');
  const [saveTdsRate, setSaveTdsRate] = useState('');
  const [saveServiceCharges, setSaveServiceCharges] = useState('');
  const [savePenalty, setSavePenalty] = useState('');
  const [saveOtherDeductions, setSaveOtherDeductions] = useState('');
  const [saveNotes, setSaveNotes] = useState('');
  const [saveStartDate, setSaveStartDate] = useState(today);
  const [saveMaturityDate, setSaveMaturityDate] = useState('');

  // Savings Deposit / Contribution Modal State
  const [depositTargetPlan, setDepositTargetPlan] = useState<SavingsPlan | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositAccountId, setDepositAccountId] = useState(accounts[0]?.id || '');
  const [depositNote, setDepositNote] = useState('');
  const [withdrawalTargetPlan, setWithdrawalTargetPlan] = useState<SavingsPlan | null>(null);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalIsFinalSettlement, setWithdrawalIsFinalSettlement] = useState(false);
  const [withdrawalInterest, setWithdrawalInterest] = useState('');
  const [withdrawalTds, setWithdrawalTds] = useState('');
  const [withdrawalServiceCharge, setWithdrawalServiceCharge] = useState('');
  const [withdrawalPenalty, setWithdrawalPenalty] = useState('');
  const [withdrawalOtherDeduction, setWithdrawalOtherDeduction] = useState('');
  const [withdrawalAccountId, setWithdrawalAccountId] = useState(accounts[0]?.id || '');
  const [editingSavingsBalanceId, setEditingSavingsBalanceId] = useState<string | null>(null);
  const [editingSavingsBalance, setEditingSavingsBalance] = useState('');
  const [savingsSearch, setSavingsSearch] = useState('');
  const [savingsCategoryFilter, setSavingsCategoryFilter] = useState<'all' | 'simple' | 'bank'>('all');
  const [savingsStatusFilter, setSavingsStatusFilter] = useState<'all' | 'active' | 'closed'>('active');

  // Asset Form
  const [assetName, setAssetName] = useState('');
  const [assetVal, setAssetVal] = useState('');
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editingTransactionAmount, setEditingTransactionAmount] = useState('');
  const [editingTransactionDate, setEditingTransactionDate] = useState('');
  const [editingTransactionCategory, setEditingTransactionCategory] = useState('');
  const [editingTransactionNote, setEditingTransactionNote] = useState('');
  const [editingTransactionAccountId, setEditingTransactionAccountId] = useState('');
  const [editingTransactionToAccountId, setEditingTransactionToAccountId] = useState('');

  // Transactions Filter
  const [txSearch, setTxSearch] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'expense' | 'income' | 'loan' | 'transfer' | 'repayment' | 'investment' | 'savings' | 'savingsWithdrawal' | 'adjustment'>('all');
  const [txSortOrder, setTxSortOrder] = useState<'desc' | 'asc'>('desc');
  const [dateFilterMode, setDateFilterMode] = useState<'all' | 'this_month' | 'last_30_days' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const currentYearMonth = getLocalMonthString();
  const thirtyDaysAgo = getLocalDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    }
    if (isFilterDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterDropdownOpen]);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<{ store: string; id: string; name: string } | null>(null);

  // Auto-synchronize dropdown selections when asynchronous data arrives
  useEffect(() => {
    if (accounts.length > 0) {
      if (!txAccount || !accounts.some(a => a.id === txAccount)) {
        setTxAccount(accounts[0].id);
      }
      if (!txToAccount || !accounts.some(a => a.id === txToAccount)) {
        setTxToAccount(accounts[1]?.id || accounts[0].id);
      }
      if (!payAcctId || !accounts.some(a => a.id === payAcctId)) {
        setPayAcctId(accounts[0].id);
      }
      if (!invAccountId || !accounts.some(a => a.id === invAccountId)) {
        setInvAccountId(accounts[0].id);
      }
      if (!loanDepositAccountId || !accounts.some(a => a.id === loanDepositAccountId)) {
        setLoanDepositAccountId(accounts[0].id);
      }
      if (saveFundingMode === 'account' && (!saveAccountId || !accounts.some(a => a.id === saveAccountId))) {
        setSaveAccountId(accounts[0].id);
      }
      if (!depositAccountId || !accounts.some(a => a.id === depositAccountId)) {
        setDepositAccountId(accounts[0].id);
      }
    }
  }, [accounts, txAccount, txToAccount, payAcctId, invAccountId, loanDepositAccountId, saveAccountId, saveFundingMode, depositAccountId]);

  useEffect(() => {
    if (loans.length > 0) {
      if (!payLoanId || !loans.some(l => l.id === payLoanId)) {
        setPayLoanId(loans[0].id);
      }
    }
  }, [loans, payLoanId]);

  // Core Financial Mathematics
  let income = 0;
  let expense = 0;
  let investmentFlow = 0;
  let savingsFlow = 0;
  let loanReceived = 0;
  let repaymentFlow = 0;

  transactions.forEach(t => {
    const amt = Number(t.amount) || 0;
    if (t.type === 'income') income += amt;
    else if (t.type === 'expense') expense += amt;
    else if (t.type === 'investment' && !t.ledgerOnly) investmentFlow += amt;
    else if (t.type === 'savings' && !t.ledgerOnly) savingsFlow += amt;
    else if (t.type === 'savingsWithdrawal' && !t.ledgerOnly) savingsFlow -= amt;
    else if (t.type === 'loan') loanReceived += amt;
    else if (t.type === 'repayment') repaymentFlow += amt;
  });

  const operatingCashFlow = income - expense;
  const investingCashFlow = -investmentFlow;
  const financingCashFlow = loanReceived - repaymentFlow;
  const netCashFlow = operatingCashFlow + investingCashFlow - savingsFlow + financingCashFlow;

  const liquidCash = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  const investmentValue = investments.reduce((sum, i) => sum + (Number(i.currentValue ?? i.amount) || 0), 0);
  const totalSavings = savingsPlans.reduce((sum, plan) => {
    const balance = plan.productType === 'fixed_deposit'
      ? getFixedDepositValue(plan).currentValue
      : Number(plan.currentAmount) || 0;
    return sum + balance;
  }, 0);
  const savingsTransactions = transactions.filter(transaction => !!transaction.linkedSavingsPlanId);
  const totalSavingsDeposited = savingsTransactions
    .filter(transaction => transaction.type === 'savings' && !transaction.ledgerOnly)
    .reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);
  const totalSavingsInterest = savingsTransactions
    .reduce((sum, transaction) => sum + (Number(transaction.interest) || 0), 0);
  const totalSavingsTds = savingsTransactions
    .reduce((sum, transaction) => sum + (Number(transaction.tds) || 0), 0);
  const totalSavingsCharges = savingsTransactions
    .reduce((sum, transaction) => sum + (Number(transaction.serviceCharge) || 0), 0);
  const totalSavingsPenalty = savingsTransactions
    .reduce((sum, transaction) => sum + (Number(transaction.penalty) || 0), 0);
  const totalSavingsOtherDeductions = savingsTransactions
    .reduce((sum, transaction) => sum + (Number(transaction.otherDeduction) || 0), 0);
  const netSavingsInterest = totalSavingsInterest - totalSavingsTds - totalSavingsCharges -
    totalSavingsPenalty - totalSavingsOtherDeductions;
  const bankSavingsBalance = savingsPlans
    .filter(isBankSavingsPlan)
    .reduce((sum, plan) => sum + (plan.productType === 'fixed_deposit'
      ? getFixedDepositValue(plan).currentValue
      : Number(plan.currentAmount) || 0), 0);
  const activeSavingsPlans = savingsPlans.filter(plan => plan.status !== 'closed');
  const visibleSavingsPlans = savingsPlans
    .filter(plan => {
      const category = isBankSavingsPlan(plan) ? 'bank' : 'simple';
      const status = plan.status === 'closed' ? 'closed' : 'active';
      const query = savingsSearch.trim().toLowerCase();
      const searchable = `${plan.name} ${plan.bankName || ''} ${plan.branchName || ''} ${plan.reference || ''}`.toLowerCase();
      return (savingsCategoryFilter === 'all' || category === savingsCategoryFilter) &&
        (savingsStatusFilter === 'all' || status === savingsStatusFilter) &&
        (!query || searchable.includes(query));
    })
    .sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0));
  const upcomingSavingsMaturities = activeSavingsPlans.filter(plan => {
    const maturityDate = plan.maturityDate || (plan.productType === 'fixed_deposit' && plan.startDate
      ? getSavingsMaturityDate(plan.startDate, Number(plan.durationMonths) || 1)
      : '');
    return !!maturityDate && maturityDate >= today;
  });
  const sumSavingsDepositsSince = (startDate: string) => savingsTransactions
    .filter(transaction => transaction.type === 'savings' && !transaction.ledgerOnly && transaction.date >= startDate)
    .reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);
  const savingsToday = sumSavingsDepositsSince(today);
  const savingsThisMonth = sumSavingsDepositsSince(getLocalMonthString());
  const savingsThisYear = sumSavingsDepositsSince(`${today.slice(0, 4)}-01-01`);
  const fixedDepositPreviewPlan: SavingsPlan | null = saveProductType === 'fixed_deposit'
    ? {
        id: 'preview',
        name: saveName,
        currentAmount: Number(saveCurrent) || 0,
        targetAmount: 0,
        durationMonths: Number(saveMonths) || 1,
        productType: 'fixed_deposit',
        annualInterestRate: Number(saveAnnualInterestRate) || 0,
        interestMethod: saveInterestMethod,
        compoundingPerYear: Number(saveCompoundingPerYear) as 1 | 2 | 4 | 12,
        startDate: saveStartDate,
        maturityDate: saveMaturityDate || undefined,
        createdAt: Date.now()
      }
    : null;
  const fixedDepositPreviewDate = saveMaturityDate || getSavingsMaturityDate(saveStartDate, Number(saveMonths) || 1);
  const fixedDepositCompoundPreview = fixedDepositPreviewPlan
    ? getFixedDepositValue({ ...fixedDepositPreviewPlan, interestMethod: 'compound' }, fixedDepositPreviewDate).maturityValue
    : null;
  const fixedDepositSimplePreview = fixedDepositPreviewPlan
    ? getFixedDepositValue({ ...fixedDepositPreviewPlan, interestMethod: 'simple' }, fixedDepositPreviewDate).maturityValue
    : null;
  const manualAssetsVal = assets.reduce((sum, a) => sum + (Number(a.value) || 0), 0);
  const totalAssets = liquidCash + investmentValue + totalSavings + manualAssetsVal;

  const totalLoanLiabilities = loans.reduce((sum, l) => sum + (Number(l.outstanding) || 0), 0);
  const manualLiabilitiesVal = liabilities.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const totalLiabilities = totalLoanLiabilities + manualLiabilitiesVal;

  const netWorth = totalAssets - totalLiabilities;

  const loanEmi = (p: number, r: number, n: number) => {
    if (!p || !n) return 0;
    const m = r / 1200;
    if (!m) return p / n;
    return (p * m * Math.pow(1 + m, n)) / (Math.pow(1 + m, n) - 1);
  };

  // Account Ledger Balance Reconciliation
  const getAccountReconciliation = (acct: FinanceAccount) => {
    let opening = acct.openingBalance !== undefined ? (Number(acct.openingBalance) || 0) : 0;
    let credits = 0;
    let debits = 0;

    transactions.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income' || t.type === 'loan' || t.type === 'savingsWithdrawal') {
        if (t.accountId === acct.id) {
          credits += amt;
        }
      } else if (t.type === 'adjustment') {
        if (t.accountId === acct.id) {
          if (t.adjustmentDirection === 'credit') credits += amt;
          else debits += amt;
        }
      } else if (t.type === 'expense' || t.type === 'investment' || t.type === 'repayment' || t.type === 'savings') {
        if (t.accountId === acct.id) {
          debits += amt;
        }
      } else if (t.type === 'transfer') {
        if (t.toAccountId === acct.id) credits += amt;
        if (t.fromAccountId === acct.id) debits += amt;
      }
    });

    const currentBalance = Number(acct.balance) || 0;
    if (acct.openingBalance === undefined) {
      opening = currentBalance - credits + debits;
    }

    const calculatedBalance = opening + credits - debits;
    const isMismatch = Math.abs(currentBalance - calculatedBalance) > 0.01;
    return {
      opening,
      credits,
      debits,
      calculatedBalance,
      currentBalance,
      isMismatch,
      difference: calculatedBalance - currentBalance
    };
  };

  const hasAnyAccountMismatch = accounts.some(a => getAccountReconciliation(a).isMismatch);

  const handleReconcileAccounts = async () => {
    for (const a of accounts) {
      const recon = getAccountReconciliation(a);
      await storage.put('financeAccounts', {
        ...a,
        balance: recon.calculatedBalance,
        openingBalance: a.openingBalance !== undefined ? a.openingBalance : recon.opening
      });
    }
    onSuccess(`✓ Reconciled ${accounts.length} accounts! All balances are now 100% synchronized with ledger.`);
    onRefresh();
  };

  const handleRecordStatementBalance = async (account: FinanceAccount) => {
    const actualBalance = Number(statementBalance);
    if (!Number.isFinite(actualBalance) || actualBalance < 0) {
      reportError('Enter a valid statement balance of zero or greater.');
      return;
    }
    const currentBalance = Number(account.balance) || 0;
    const difference = actualBalance - currentBalance;
    if (Math.abs(difference) < 0.01) {
      setStatementAccountId(null);
      setStatementBalance('');
      onSuccess(`"${account.name}" already matches the statement balance.`);
      return;
    }

    const now = Date.now();
    const adjustment: FinanceTransaction = {
      id: generateUUID(),
      type: 'adjustment',
      amount: Math.abs(difference),
      adjustmentDirection: difference > 0 ? 'credit' : 'debit',
      category: 'Bank Statement Adjustment',
      date: today,
      note: 'Manual statement balance reconciliation',
      accountId: account.id,
      createdAt: now
    };
    try {
      await storage.atomicPutMany([
        {
          storeName: 'financeAccounts',
          item: { ...account, balance: actualBalance, updatedAt: now }
        },
        { storeName: 'finance', item: adjustment }
      ]);
    } catch (err) {
      console.error('Unable to reconcile statement balance', err);
      reportError('Statement reconciliation could not be saved. Please try again.');
      return;
    }
    setStatementAccountId(null);
    setStatementBalance('');
    onSuccess(`"${account.name}" matched the statement; the difference was logged in the ledger.`);
    onRefresh();
  };

  const startEditingTransaction = (transaction: FinanceTransaction) => {
    setEditingTransactionId(transaction.id);
    setEditingTransactionAmount(String(transaction.amount));
    setEditingTransactionDate(transaction.date || today);
    setEditingTransactionCategory(transaction.category || '');
    setEditingTransactionNote(transaction.note || '');
    setEditingTransactionAccountId(transaction.accountId || accounts[0]?.id || '');
    setEditingTransactionToAccountId(transaction.toAccountId || accounts[1]?.id || accounts[0]?.id || '');
  };

  const handleSaveTransactionEdit = async (e: React.FormEvent, transaction: FinanceTransaction) => {
    e.preventDefault();
    const amount = Number(editingTransactionAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !editingTransactionDate) {
      reportError('Enter a valid amount and date for this transaction.');
      return;
    }
    const accountBalances = new Map(accounts.map(account => [account.id, Number(account.balance) || 0]));
    const adjust = (accountId: string | null | undefined, delta: number) => {
      if (!accountId || !accountBalances.has(accountId)) return false;
      accountBalances.set(accountId, (accountBalances.get(accountId) || 0) + delta);
      return true;
    };

    if (transaction.type === 'transfer') {
      if (!adjust(transaction.fromAccountId, Number(transaction.amount) || 0) ||
          !adjust(transaction.toAccountId, -(Number(transaction.amount) || 0))) {
        reportError('The original transfer accounts are unavailable; this transaction cannot be edited safely.');
        return;
      }
    } else {
      const reversal = transaction.type === 'expense' ? Number(transaction.amount) : -Number(transaction.amount);
      if (!adjust(transaction.accountId, reversal)) {
        reportError('The original account is unavailable; this transaction cannot be edited safely.');
        return;
      }
    }

    if (transaction.type === 'transfer') {
      if (!editingTransactionAccountId || !editingTransactionToAccountId ||
          editingTransactionAccountId === editingTransactionToAccountId ||
          !accountBalances.has(editingTransactionAccountId) || !accountBalances.has(editingTransactionToAccountId)) {
        reportError('Select two different available accounts for this transfer.');
        return;
      }
      const sourceBalance = accountBalances.get(editingTransactionAccountId) || 0;
      if (amount > sourceBalance) {
        reportError(`Transfer exceeds available balance of NPR ${sourceBalance.toLocaleString('en-IN')}.`);
        return;
      }
      adjust(editingTransactionAccountId, -amount);
      adjust(editingTransactionToAccountId, amount);
    } else {
      if (!editingTransactionAccountId || !accountBalances.has(editingTransactionAccountId)) {
        reportError('Select an available account for this transaction.');
        return;
      }
      const balance = accountBalances.get(editingTransactionAccountId) || 0;
      if (transaction.type === 'expense' && amount > balance) {
        reportError(`Expense exceeds available balance of NPR ${balance.toLocaleString('en-IN')}.`);
        return;
      }
      adjust(editingTransactionAccountId, transaction.type === 'expense' ? -amount : amount);
    }

    const negativeAccount = [...accountBalances.entries()].find(([, balance]) => balance < -0.001);
    if (negativeAccount) {
      const accountName = accounts.find(account => account.id === negativeAccount[0])?.name || 'selected account';
      reportError(`This correction would make "${accountName}" negative. Record the missing funds or choose a different correction.`);
      return;
    }

    const operations: Array<{ storeName: string; item: any }> = [];
    accountBalances.forEach((balance, accountId) => {
      const account = accounts.find(item => item.id === accountId);
      if (account && Math.abs(balance - (Number(account.balance) || 0)) > 0.001) {
        operations.push({ storeName: 'financeAccounts', item: { ...account, balance } });
      }
    });
    operations.push({
      storeName: 'finance',
      item: {
        ...transaction,
        amount,
        date: editingTransactionDate,
        category: transaction.type === 'transfer' ? transaction.category : editingTransactionCategory.trim() || transaction.category,
        note: editingTransactionNote.trim() || undefined,
        accountId: transaction.type === 'transfer' ? undefined : editingTransactionAccountId,
        fromAccountId: transaction.type === 'transfer' ? editingTransactionAccountId : undefined,
        toAccountId: transaction.type === 'transfer' ? editingTransactionToAccountId : undefined,
        updatedAt: Date.now()
      } satisfies FinanceTransaction
    });

    try {
      await storage.atomicPutMany(operations);
    } catch (err) {
      console.error('Unable to update finance transaction', err);
      reportError('Transaction could not be updated. Please try again.');
      return;
    }
    if (transaction.goalId) {
      try {
        await syncGoalProgressFromFinance(transaction.goalId);
      } catch (err) {
        console.error('Transaction updated but linked Goal progress could not be recalculated', err);
        reportError('Transaction was updated, but its linked Goal progress could not be refreshed.');
      }
    }
    setEditingTransactionId(null);
    onSuccess('Transaction updated and account balances adjusted.');
    onRefresh();
  };

  const handleSaveInvestmentValue = async (investment: Investment) => {
    const value = Number(editingInvestmentValue);
    if (!Number.isFinite(value) || value < 0) {
      reportError('Current market value must be zero or greater.');
      return;
    }
    const updated: Investment = { ...investment, currentValue: value, updatedAt: Date.now() };
    await storage.put('investments', updated);
    if (updated.goalId) await syncGoalProgressFromFinance(updated.goalId);
    setEditingInvestmentId(null);
    setEditingInvestmentValue('');
    onSuccess(`Updated "${updated.name}" market value to NPR ${value.toLocaleString('en-IN')}.`);
    onRefresh();
  };

  // Helper to retrieve goal details
  const getGoalInfo = (goalId?: string | null) => {
    if (!goalId) return null;
    return goals.find(g => g.id === goalId) || null;
  };

  // Helper to format goal level badge metadata
  const getGoalLevelLabel = (level?: number) => {
    switch (level) {
      case 5:
        return {
          icon: '⚡',
          name: 'Atomic',
          color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 border-purple-200/80 dark:border-purple-800/60'
        };
      case 4:
        return {
          icon: '🔸',
          name: 'Nano',
          color: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 border-sky-200/80 dark:border-sky-800/60'
        };
      case 3:
        return {
          icon: '▫️',
          name: 'Micro',
          color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-200/80 dark:border-amber-800/60'
        };
      case 2:
        return {
          icon: '🔹',
          name: 'Sub',
          color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200/80 dark:border-emerald-800/60'
        };
      default:
        return {
          icon: '🎯',
          name: 'Main',
          color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200/80 dark:border-indigo-800/60'
        };
    }
  };

  // Render a visual Goal badge on any financial item
  const renderGoalBadge = (goalId?: string | null) => {
    const g = getGoalInfo(goalId);
    if (!g) return null;
    const meta = getGoalLevelLabel(g.level);
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold border ${meta.color} transition-all`}
        title={`Linked to Strategic Goal: ${meta.name} - ${g.title} (${g.progress}% done)`}
      >
        <span>{meta.icon}</span>
        <span className="truncate max-w-[130px]">{g.title}</span>
      </span>
    );
  };

  // Render the Link Goal vs Manual toggle matching image.png & TasksView
  const renderGoalModeToggle = (
    mode: 'manual' | 'link',
    setMode: (m: 'manual' | 'link') => void,
    selectedGoalId: string,
    setSelectedGoalId: (id: string) => void,
    onSelectGoal?: (g: Goal) => void,
    label = 'Strategic Goal Link'
  ) => (
    <div className="space-y-2">
      <div className="flex justify-end">
        <LinkModeSelector
          value={mode}
          ariaLabel={label}
          options={[{ value: 'link', label: 'Link Goal' }, { value: 'manual', label: 'Manual' }]}
          onChange={nextMode => {
            if (nextMode === 'link') setMode('link');
            else {
              setMode('manual');
              setSelectedGoalId('');
            }
          }}
        />
      </div>

      {mode === 'link' && (
        <div className="space-y-1.5 rounded-xl border border-indigo-200/80 bg-indigo-50/60 p-2.5 dark:border-indigo-900/60 dark:bg-indigo-950/30 animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
              Target goal *
            </span>
            {selectedGoalId && (
              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                {goals.find(g => g.id === selectedGoalId)?.progress}% Done
              </span>
            )}
          </div>
          <select
            value={selectedGoalId}
            onChange={e => {
              const val = e.target.value;
              setSelectedGoalId(val);
              const g = goals.find(goal => goal.id === val);
              if (g && onSelectGoal) onSelectGoal(g);
            }}
            className="h-8.5 w-full rounded-lg border border-indigo-300 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-indigo-700 dark:bg-slate-900 dark:text-white cursor-pointer font-medium"
          >
            <option value="">Choose a goal</option>
            {goals.map(g => {
              const meta = getGoalLevelLabel(g.level);
              return (
                <option key={g.id} value={g.id}>
                  {meta.icon} {meta.name}: {g.title} ({g.progress}%)
                </option>
              );
            })}
          </select>
          {selectedGoalId && (
            <span className="block text-[10px] text-indigo-700 dark:text-indigo-300">
              This entry is linked to the selected goal.
            </span>
          )}
        </div>
      )}
    </div>
  );

  // Compute detailed financial metrics for any goal
  const getGoalFinancialMetrics = (goalId: string) => {
    let goalIncome = 0;
    let goalExpense = 0;
    let goalTransfer = 0;
    const goalTxs = transactions.filter(t => t.goalId === goalId);
    goalTxs.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') goalIncome += amt;
      else if (t.type === 'expense') goalExpense += amt;
      else if (t.type === 'transfer') goalTransfer += amt;
    });

    const goalInvestments = investments.filter(i => i.goalId === goalId);
    const goalInvestmentsTotal = goalInvestments.reduce((sum, i) => sum + (Number(i.currentValue ?? i.amount) || 0), 0);
    const goalInvestedCost = goalInvestments.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

    const goalLoans = loans.filter(l => l.goalId === goalId);
    const goalLoansTotal = goalLoans.reduce((sum, l) => sum + (Number(l.outstanding) || 0), 0);

    const goalLiabilities = liabilities.filter(l => l.goalId === goalId);
    const goalLiabilitiesTotal = goalLiabilities.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

    const goalSavings = savingsPlans.filter(s => s.goalId === goalId);
    const goalSavingsCurrent = goalSavings.reduce((sum, s) => sum + (Number(s.currentAmount) || 0), 0);
    const goalSavingsTarget = goalSavings.reduce((sum, s) => sum + (Number(s.targetAmount) || 0), 0);

    const goalAssets = assets.filter(a => a.goalId === goalId);
    const goalAssetsTotal = goalAssets.reduce((sum, a) => sum + (Number(a.value) || 0), 0);

    const netCashFlow = goalIncome - goalExpense;
    const totalDebt = goalLoansTotal + goalLiabilitiesTotal;
    const totalGoalAssets = goalSavingsCurrent + goalInvestmentsTotal + goalAssetsTotal;
    const goalNetWorth = totalGoalAssets - totalDebt;
    const hasAnyLink = goalTxs.length > 0 || goalInvestments.length > 0 || goalLoans.length > 0 || goalLiabilities.length > 0 || goalSavings.length > 0 || goalAssets.length > 0;

    return {
      txs: goalTxs,
      income: goalIncome,
      expense: goalExpense,
      transfer: goalTransfer,
      netCashFlow,
      investments: goalInvestments,
      investmentsTotal: goalInvestmentsTotal,
      investedCost: goalInvestedCost,
      loans: goalLoans,
      loansTotal: goalLoansTotal,
      liabilities: goalLiabilities,
      liabilitiesTotal: goalLiabilitiesTotal,
      totalDebt,
      savings: goalSavings,
      savingsCurrent: goalSavingsCurrent,
      savingsTarget: goalSavingsTarget,
      assets: goalAssets,
      assetsTotal: goalAssetsTotal,
      totalGoalAssets,
      goalNetWorth,
      hasAnyLink
    };
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(txAmount);
    if (!amt || amt <= 0) {
      onSuccess('Please enter a transaction amount greater than 0.');
      return;
    }
    if (txType === 'repayment') {
      const loan = loans.find(item => item.id === (txRepayLoanId || loans[0]?.id));
      const outstanding = Number(loan?.outstanding) || 0;
      if (!loan || outstanding <= 0) {
        reportError('Select a loan with an outstanding balance before recording a repayment.');
        return;
      }
      if (amt > outstanding) {
        reportError(`Payment exceeds the outstanding balance of NPR ${outstanding.toLocaleString('en-IN')}.`);
        return;
      }
    }

    let selectedAccount = txAccount || accounts[0]?.id;
    const selectedToAccount = txToAccount || accounts[1]?.id || accounts[0]?.id;
    if (
      txType === 'repayment' &&
      (!selectedAccount || !accounts.some(account => account.id === selectedAccount))
    ) {
      reportError('Select an available account to record the repayment debit.');
      return;
    }
    if (txType === 'transfer') {
      if (!selectedAccount || !selectedToAccount || selectedAccount === selectedToAccount) {
        onSuccess('Select two different accounts for a transfer.');
        return;
      }
      if (!accounts.some(a => a.id === selectedAccount) || !accounts.some(a => a.id === selectedToAccount)) {
        reportError('One of the selected transfer accounts is no longer available. Refresh the account list and retry.');
        return;
      }
    }

    const now = Date.now();
    const txId = generateUUID();
    let createdOrLinkedReceiptId: string | null = null;
    let finalFileName = txAttachedFile?.name;
    let finalFileData = txAttachedFile?.data;
    let finalFileSize = txAttachedFile?.size;
    let finalFileType = txAttachedFile?.type;
    const operations: Array<{ storeName: string; item: any }> = [];

    if (txLinkToReceipt) {
      if (txReceiptMode !== 'link_existing' || !txSelectedReceiptId) {
        onSuccess('Select an existing Purchase Receipt to create an optional link.');
        return;
      }
      const existingReceipt = receipts.find(r => r.id === txSelectedReceiptId);
      if (!existingReceipt) {
        onSuccess('Selected receipt could not be found.');
        return;
      }
      createdOrLinkedReceiptId = existingReceipt.id;
      operations.push({
        storeName: 'receipts',
        item: txAttachedFile?.data
          ? {
              ...existingReceipt,
              linkedTransactionId: txId,
              fileName: txAttachedFile.name,
              fileData: txAttachedFile.data,
              fileSize: txAttachedFile.size,
              fileType: txAttachedFile.type,
              updatedAt: now
            }
          : { ...existingReceipt, linkedTransactionId: txId, updatedAt: now }
      });
      if (existingReceipt.linkedTransactionId && existingReceipt.linkedTransactionId !== txId) {
        const oldTx = transactions.find(t => t.id === existingReceipt.linkedTransactionId);
        if (oldTx?.linkedReceiptId === existingReceipt.id) {
          operations.push({
            storeName: 'finance',
            item: { ...oldTx, linkedReceiptId: null, updatedAt: now }
          });
        }
      }
    }

    let nextFromAccount: FinanceAccount | undefined;
    let nextToAccount: FinanceAccount | undefined;
    let acct: FinanceAccount | undefined;
    if (txType === 'transfer') {
      const fromAcct = accounts.find(a => a.id === selectedAccount);
      const toAcct = accounts.find(a => a.id === selectedToAccount);
      if (!fromAcct || !toAcct) return;
      const fromBal = Number(fromAcct.balance) || 0;
      const toBal = Number(toAcct.balance) || 0;
      if (amt > fromBal) {
        reportError(`Transfer exceeds the available account balance of NPR ${fromBal.toLocaleString('en-IN')}.`);
        return;
      }
      nextFromAccount = { ...fromAcct, balance: fromBal - amt };
      nextToAccount = { ...toAcct, balance: toBal + amt };
      operations.push({ storeName: 'financeAccounts', item: nextFromAccount });
      operations.push({ storeName: 'financeAccounts', item: nextToAccount });
    } else {
      acct = accounts.find(a => a.id === selectedAccount);
      // If user has no existing accounts, seed an initial account so balance is never lost
      if (!acct && accounts.length === 0) {
        const fallbackAcct: FinanceAccount = {
          id: generateUUID(),
          name: 'Main Bank Account',
          type: 'bank',
          balance: 0,
          openingBalance: 0,
          createdAt: now
        };
        selectedAccount = fallbackAcct.id;
        acct = fallbackAcct;
      }

      if (accounts.length > 0 && (!selectedAccount || !accounts.some(account => account.id === selectedAccount))) {
        reportError('Select an available account before recording this transaction.');
        return;
      }
      if ((txType === 'expense' || txType === 'investment' || txType === 'repayment') &&
          amt > (Number(acct?.balance) || 0)) {
        reportError(`This transaction exceeds the available account balance of NPR ${(Number(acct?.balance) || 0).toLocaleString('en-IN')}.`);
        return;
      }

      if (acct) {
        const currentBal = Number(acct.balance) || 0;
        let nextBalance = currentBal;
        if (txType === 'expense' || txType === 'investment' || txType === 'repayment') nextBalance = currentBal - amt;
        if (txType === 'income' || txType === 'loan') nextBalance = currentBal + amt;
        operations.push({ storeName: 'financeAccounts', item: { ...acct, balance: nextBalance } });
      }
    }

    const tx: FinanceTransaction = txType === 'transfer'
      ? {
          id: txId,
          type: 'transfer',
          amount: amt,
          category: 'Account Transfer',
          date: txDate,
          note: txNote.trim() || undefined,
          fromAccountId: selectedAccount,
          toAccountId: selectedToAccount,
          goalId: txInputMode === 'link' && txGoalId ? txGoalId : null,
          linkedReceiptId: createdOrLinkedReceiptId,
          fileName: finalFileName,
          fileData: finalFileData,
          fileSize: finalFileSize,
          fileType: finalFileType,
          createdAt: now
        }
      : {
          id: txId,
          type: txType,
          amount: amt,
          category: txCategory.trim() || (txType === 'income' ? 'Income' : txType === 'loan' ? 'Loan Disbursement' : txType === 'repayment' ? 'Loan Repayment' : txType === 'investment' ? 'Investment' : 'General Expense'),
          date: txDate,
          note: txNote.trim() || undefined,
          accountId: selectedAccount || null,
          goalId: txInputMode === 'link' && txGoalId ? txGoalId : null,
          linkedReceiptId: createdOrLinkedReceiptId,
          fileName: finalFileName,
          fileData: finalFileData,
          fileSize: finalFileSize,
          fileType: finalFileType,
          createdAt: now
        };

    // If loan is recorded from main form, also register in loans liability & amortization schedule
    if (txType === 'loan') {
      const loanId = generateUUID();
      const newLoan: Loan = {
        id: loanId,
        name: txNote.trim() || txCategory.trim() || 'Borrowed Loan',
        principal: amt,
        rate: 0,
        tenure: 12,
        dueDay: 5,
        outstanding: amt,
        goalId: txInputMode === 'link' && txGoalId ? txGoalId : null,
        createdAt: now
      };
      operations.push({ storeName: 'loans', item: newLoan });
      tx.linkedLoanId = loanId;
    }

    // If repayment is recorded from main form, auto-reduce loan outstanding and create payment receipt
    if (txType === 'repayment') {
      const targetLoan = loans.find(l => l.id === txRepayLoanId) || loans[0];
      if (targetLoan) {
        const outstanding = Number(targetLoan.outstanding) || 0;
        if (outstanding <= 0) {
          reportError('This loan is already fully repaid; no additional payment can be recorded.');
          return;
        }
        if (amt > outstanding) {
          reportError(`Payment exceeds the outstanding balance of NPR ${outstanding.toLocaleString('en-IN')}.`);
          return;
        }
        const paid = amt;
        const monthlyRate = (Number(targetLoan.rate) || 0) / 1200;
        const interest = Math.min(paid, outstanding * monthlyRate);
        const principal = Math.max(0, paid - interest);
        operations.push({
          storeName: 'loans',
          item: {
            ...targetLoan,
            outstanding: Math.max(0, outstanding - principal)
          }
        });
        const paymentId = generateUUID();
        operations.push({
          storeName: 'loanPayments',
          item: {
            id: paymentId,
            loanId: targetLoan.id,
            loanName: targetLoan.name,
            amount: paid,
            principal,
            interest,
            date: txDate,
            accountId: selectedAccount || null,
            createdAt: now
          } as LoanPayment
        });
        tx.linkedLoanId = targetLoan.id;
        tx.linkedLoanPaymentId = paymentId;
        tx.principal = principal;
        tx.interest = interest;
      }
    }

    const goalIdsToRecalculate = new Set<string>();
    if (tx.goalId) goalIdsToRecalculate.add(tx.goalId);
    if (txType === 'repayment') {
      const targetLoan = loans.find(l => l.id === txRepayLoanId) || loans[0];
      if (targetLoan?.goalId) goalIdsToRecalculate.add(targetLoan.goalId);
    }

    // If investment is recorded from main transaction form, also auto-register in investments portfolio for 2-way sync
    if (txType === 'investment') {
      const invId = generateUUID();
      const newInv: Investment = {
        id: invId,
        name: txCategory.trim() || txNote.trim() || 'Investment Holding',
        amount: amt,
        currentValue: amt,
        date: txDate,
        accountId: selectedAccount || null,
        goalId: txInputMode === 'link' && txGoalId ? txGoalId : null,
        createdAt: now,
        updatedAt: now
      };
      operations.push({ storeName: 'investments', item: newInv });
      tx.linkedInvestmentId = invId;
    }

    operations.push({ storeName: 'finance', item: tx });

    try {
      await storage.atomicPutMany(operations);
    } catch (err: any) {
      onSuccess(`Transaction could not be committed: ${err?.message || 'database error'}`);
      return;
    }

    try {
      for (const goalId of goalIdsToRecalculate) {
        await syncGoalProgressFromFinance(goalId);
      }
    } catch (err) {
      console.error('Transaction saved but linked Goal progress could not be recalculated', err);
      onSuccess('Transaction saved, but linked Goal progress could not be refreshed. Refresh the app; do not submit the transaction again.');
      onRefresh();
      return;
    }

    if (txType === 'transfer' && nextFromAccount && nextToAccount) {
      onSuccess(`NPR ${amt.toLocaleString('en-IN')} transferred from ${nextFromAccount.name} to ${nextToAccount.name}`);
    } else if (txType === 'income') {
      onSuccess(`✓ Income of NPR ${amt.toLocaleString('en-IN')} added to account${tx.goalId ? ' & linked to Goal' : ''}`);
    } else if (txType === 'expense') {
      onSuccess(`✓ Expense of NPR ${amt.toLocaleString('en-IN')} recorded & deducted${tx.goalId ? ' & linked to Goal' : ''}`);
    } else if (txType === 'loan') {
      onSuccess(`✓ Loan (+NPR ${amt.toLocaleString('en-IN')}) deposited into ${acct?.name || 'account'} & recorded in ledger!`);
    } else if (txType === 'repayment') {
      onSuccess(`✓ Loan payment of NPR ${amt.toLocaleString('en-IN')} deducted & outstanding reduced!`);
    } else if (txType === 'investment') {
      onSuccess(`✓ Investment of NPR ${amt.toLocaleString('en-IN')} logged in ledger & portfolio!`);
    } else if (createdOrLinkedReceiptId) {
      onSuccess('✓ Transaction recorded & linked with Things Purchase Receipt Vault!');
    } else {
      onSuccess('Transaction committed to ledger');
    }
    setTxAmount('');
    setTxCategory('');
    setTxNote('');
    setTxGoalId('');
    setTxInputMode('manual');
    setTxAttachedFile(null);
    setTxLinkToReceipt(false);
    setTxReceiptMode('link_existing');
    setTxReceiptTitle('');
    setTxSelectedReceiptId('');
    onRefresh();
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const opening = acctBalance.trim() === '' ? 0 : Number(acctBalance);
    if (!acctName.trim() || !Number.isFinite(opening) || opening < 0) {
      reportError('Enter an account name and a valid opening balance of zero or greater.');
      return;
    }
    const newAcct: FinanceAccount = {
      id: generateUUID(),
      name: acctName.trim(),
      type: acctType,
      balance: opening,
      openingBalance: opening,
      createdAt: Date.now()
    };
    await storage.put('financeAccounts', newAcct);
    onSuccess(`Account "${acctName}" created`);
    setAcctName('');
    setAcctBalance('');
    onRefresh();
  };

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = Number(loanPrincipal);
    if (!loanName.trim() || p <= 0) return;

    const loanId = generateUUID();
    const now = Date.now();
    const newLoan: Loan = {
      id: loanId,
      name: loanName.trim(),
      principal: p,
      rate: Number(loanRate) || 0,
      tenure: Number(loanTenure) || 12,
      dueDay: 5,
      outstanding: p,
      goalId: loanInputMode === 'link' && loanGoalId ? loanGoalId : null,
      createdAt: now
    };

    const operations: Array<{ storeName: string; item: any }> = [
      { storeName: 'loans', item: newLoan }
    ];

    if (loanDepositAccountId) {
      const acct = accounts.find(a => a.id === loanDepositAccountId);
      if (acct) {
        operations.push({
          storeName: 'financeAccounts',
          item: {
            ...acct,
            balance: (Number(acct.balance) || 0) + p
          }
        });
        const tx: FinanceTransaction = {
          id: generateUUID(),
          type: 'loan',
          amount: p,
          category: 'Loan Disbursement',
          date: today,
          note: `${newLoan.name} borrowed principal`,
          accountId: loanDepositAccountId,
          goalId: newLoan.goalId || null,
          linkedLoanId: loanId,
          createdAt: now
        };
        operations.push({ storeName: 'finance', item: tx });
      }
    }

    await storage.atomicPutMany(operations);
    if (newLoan.goalId) {
      await syncGoalProgressFromFinance(newLoan.goalId);
    }
    setPayLoanId(newLoan.id);
    onSuccess(`Loan liability registered${loanDepositAccountId ? ' & funds deposited to account' : ''}`);
    setLoanName('');
    setLoanPrincipal('');
    setLoanGoalId('');
    setLoanInputMode('manual');
    onRefresh();
  };

  // Deposit funds for an existing loan into a chosen bank account & log ledger transaction
  const handleDepositExistingLoan = async (loan: Loan, targetAcctId?: string) => {
    if (transactions.some(transaction => transaction.type === 'loan' && transaction.linkedLoanId === loan.id)) {
      reportError('This loan already has a recorded deposit. Add a separate disbursement only if the bank paid out additional funds.');
      return;
    }
    const acctId = targetAcctId || loanDepositAccountId || accounts[0]?.id;
    if (!acctId) {
      onSuccess('Please create a bank account first.');
      return;
    }
    const acct = accounts.find(a => a.id === acctId);
    if (!acct) return;

    const now = Date.now();
    const p = Number(loan.principal) || 0;
    const operations: Array<{ storeName: string; item: any }> = [
      {
        storeName: 'financeAccounts',
        item: {
          ...acct,
          balance: (Number(acct.balance) || 0) + p
        }
      },
      {
        storeName: 'finance',
        item: {
          id: generateUUID(),
          type: 'loan',
          amount: p,
          category: 'Loan Disbursement',
          date: today,
          note: `${loan.name} borrowed principal credited`,
          accountId: acctId,
          goalId: loan.goalId || null,
          linkedLoanId: loan.id,
          createdAt: now
        } as FinanceTransaction
      }
    ];

    await storage.atomicPutMany(operations);
    if (loan.goalId) {
      await syncGoalProgressFromFinance(loan.goalId);
    }
    onSuccess(`✓ NPR ${p.toLocaleString('en-IN')} deposited into "${acct.name}" & recorded in Ledger!`);
    onRefresh();
  };

  const handleRecordLoanPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(payAmount);
    const targetLoanId = payLoanId || loans[0]?.id;
    const loan = loans.find(l => l.id === targetLoanId);
    
    if (!loan) {
      onSuccess('Please select a valid loan from the dropdown.');
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      onSuccess('Please enter a payment amount greater than zero.');
      return;
    }

    const outstanding = Number(loan.outstanding) || 0;
    if (outstanding <= 0) {
      reportError('This loan is already fully repaid; no additional payment can be recorded.');
      return;
    }
    const paid = amt;
    const monthlyRate = (Number(loan.rate) || 0) / 1200;
    const hasPrincipal = payPrincipalInput.trim() !== '';
    const hasInterest = payInterestInput.trim() !== '';
    const estimatedInterest = Math.min(paid, outstanding * monthlyRate);
    const principal = hasPrincipal
      ? Number(payPrincipalInput)
      : paid - (hasInterest ? Number(payInterestInput) : estimatedInterest);
    const interest = hasInterest ? Number(payInterestInput) : paid - principal;
    if (!Number.isFinite(principal) || !Number.isFinite(interest) || principal < 0 || interest < 0 ||
        principal > outstanding || Math.abs(principal + interest - paid) > 0.01) {
      reportError(`Enter a valid principal and interest split totaling NPR ${paid.toLocaleString('en-IN')}; principal cannot exceed the outstanding balance.`);
      return;
    }
    const now = Date.now();
    const operations: Array<{ storeName: string; item: any }> = [];

    const sourceAccountId = payAcctId || accounts[0]?.id;
    const sourceAccount = accounts.find(account => account.id === sourceAccountId);
    if (!sourceAccount) {
      reportError('Select an available account to record the repayment debit.');
      return;
    }
    if (paid > (Number(sourceAccount.balance) || 0)) {
      reportError(`Repayment exceeds the available account balance of NPR ${Number(sourceAccount.balance).toLocaleString('en-IN')}.`);
      return;
    }
    operations.push({
      storeName: 'financeAccounts',
      item: {
        ...sourceAccount,
        balance: (Number(sourceAccount.balance) || 0) - paid
      }
    });

    operations.push({
      storeName: 'loans',
      item: {
        ...loan,
        outstanding: Math.max(0, outstanding - principal)
      }
    });

    const paymentId = generateUUID();
    const payment: LoanPayment = {
      id: paymentId,
      loanId: loan.id,
      loanName: loan.name,
      amount: paid,
      principal,
      interest,
      date: today,
      accountId: sourceAccountId || null,
      createdAt: now
    };
    operations.push({ storeName: 'loanPayments', item: payment });

    const tx: FinanceTransaction = {
      id: generateUUID(),
      type: 'repayment',
      amount: paid,
      principal,
      interest,
      category: 'Loan Repayment',
      date: today,
      note: `${loan.name} (Principal: NPR ${principal.toFixed(0)}, Interest: NPR ${interest.toFixed(0)})`,
      accountId: sourceAccountId || null,
      goalId: loan.goalId || null,
      linkedLoanId: loan.id,
      linkedLoanPaymentId: paymentId,
      createdAt: now
    };
    operations.push({ storeName: 'finance', item: tx });

    await storage.atomicPutMany(operations);
    if (loan.goalId) {
      await syncGoalProgressFromFinance(loan.goalId);
    }
    onSuccess(`✓ Loan payment logged: Principal NPR ${principal.toFixed(0)}, Interest NPR ${interest.toFixed(0)}`);
    setPayAmount('');
    setPayPrincipalInput('');
    setPayInterestInput('');
    onRefresh();
  };

  // Add Liability (Other payables, Credit cards, Personal debts)
  const handleAddLiability = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(liabVal);
    if (!liabName.trim() || !Number.isFinite(amount) || amount <= 0) {
      reportError('Enter a liability name and an amount greater than zero.');
      return;
    }
    const depositAccount = liabRecordMode === 'borrowed'
      ? accounts.find(account => account.id === (liabDepositAccountId || accounts[0]?.id))
      : undefined;
    if (liabRecordMode === 'borrowed' && !depositAccount) {
      reportError('Create or select an account to record where the borrowed money was deposited.');
      return;
    }
    const now = Date.now();
    const l: Liability = {
      id: generateUUID(),
      name: liabName.trim(),
      amount,
      category: liabCategory,
      dueDate: liabDueDate || undefined,
      goalId: liabInputMode === 'link' && liabGoalId ? liabGoalId : null,
      createdAt: now
    };
    const operations: Array<{ storeName: string; item: any }> = [
      { storeName: 'liabilities', item: l }
    ];
    if (depositAccount) {
      operations.push(
        {
          storeName: 'financeAccounts',
          item: { ...depositAccount, balance: (Number(depositAccount.balance) || 0) + amount }
        },
        {
          storeName: 'finance',
          item: {
            id: generateUUID(),
            type: 'loan',
            amount,
            category: 'Liability Borrowing',
            date: today,
            note: `${l.name} borrowed`,
            accountId: depositAccount.id,
            goalId: l.goalId || null,
            linkedLiabilityId: l.id,
            createdAt: now
          } satisfies FinanceTransaction
        }
      );
    }
    try {
      await storage.atomicPutMany(operations);
    } catch (err) {
      console.error('Unable to record liability', err);
      reportError('Liability could not be saved. Please try again.');
      return;
    }
    if (l.goalId) {
      await syncGoalProgressFromFinance(l.goalId);
    }
    onSuccess(liabRecordMode === 'borrowed'
      ? `NPR ${amount.toLocaleString('en-IN')} borrowed into "${depositAccount?.name}" and added to liabilities`
      : `Existing liability "${liabName}" recorded without changing account balance${l.goalId ? ' & linked to Goal' : ''}`);
    setLiabName('');
    setLiabVal('');
    setLiabDueDate('');
    setLiabGoalId('');
    setLiabInputMode('manual');
    setLiabRecordMode('existing');
    onRefresh();
  };

  const handleRepayLiability = async (e: React.FormEvent, liability: Liability) => {
    e.preventDefault();
    const amount = Number(liabilityRepaymentAmount);
    const outstanding = Number(liability.amount) || 0;
    const accountId = liabilityRepaymentAccountId || accounts[0]?.id;
    const account = accounts.find(item => item.id === accountId);
    if (!Number.isFinite(amount) || amount <= 0) {
      reportError('Enter a repayment amount greater than zero.');
      return;
    }
    if (amount > outstanding) {
      reportError(`Repayment exceeds the outstanding liability of NPR ${outstanding.toLocaleString('en-IN')}.`);
      return;
    }
    if (!account) {
      reportError('Select an available account to debit for this repayment.');
      return;
    }
    if (amount > (Number(account.balance) || 0)) {
      reportError(`Repayment exceeds the available account balance of NPR ${Number(account.balance).toLocaleString('en-IN')}.`);
      return;
    }

    const now = Date.now();
    const payment: FinanceTransaction = {
      id: generateUUID(),
      type: 'repayment',
      amount,
      principal: amount,
      interest: 0,
      category: 'Liability Repayment',
      date: today,
      note: liability.name,
      accountId: account.id,
      goalId: liability.goalId || null,
      linkedLiabilityId: liability.id,
      createdAt: now
    };
    try {
      await storage.atomicPutMany([
        {
          storeName: 'financeAccounts',
          item: { ...account, balance: (Number(account.balance) || 0) - amount }
        },
        { storeName: 'liabilities', item: { ...liability, amount: Math.max(0, outstanding - amount) } },
        { storeName: 'finance', item: payment }
      ]);
    } catch (err) {
      console.error('Unable to record liability repayment', err);
      reportError('Liability repayment could not be saved. Please try again.');
      return;
    }
    if (liability.goalId) {
      await syncGoalProgressFromFinance(liability.goalId);
    }
    onSuccess(`NPR ${amount.toLocaleString('en-IN')} repayment deducted from "${account.name}" and liability reduced`);
    setLiabilityRepaymentId(null);
    setLiabilityRepaymentAmount('');
    onRefresh();
  };

  const handleCreateInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(invAmount);
    if (!invName.trim() || !Number.isFinite(amt) || amt <= 0) {
      reportError('Enter an investment name and an amount greater than zero.');
      return;
    }
    if (invCurrentVal.trim() !== '' && (!Number.isFinite(Number(invCurrentVal)) || Number(invCurrentVal) < 0)) {
      reportError('Current market value must be zero or greater.');
      return;
    }

    const invId = generateUUID();
    const inv: Investment = {
      id: invId,
      name: invName.trim(),
      amount: amt,
      currentValue: invCurrentVal.trim() === '' ? amt : Number(invCurrentVal),
      date: today,
      accountId: invAccountId || null,
      goalId: invInputMode === 'link' && invGoalId ? invGoalId : null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const operations: Array<{ storeName: string; item: any }> = [
      { storeName: 'investments', item: inv }
    ];

    if (invAccountId) {
      const acct = accounts.find(a => a.id === invAccountId);
      if (!acct) {
        reportError('The selected source account is unavailable. Refresh and select a valid account.');
        return;
      }
      if (amt > (Number(acct.balance) || 0)) {
        reportError(`Investment exceeds the available account balance of NPR ${Number(acct.balance).toLocaleString('en-IN')}.`);
        return;
      }
      if (acct) {
        operations.push({
          storeName: 'financeAccounts',
          item: {
            ...acct,
            balance: (Number(acct.balance) || 0) - amt
          }
        });
      }
    }

    // Always create a linked ledger transaction of type 'investment' so Sub-tab and Ledger are 100% in sync
    const txId = generateUUID();
    const tx: FinanceTransaction = {
      id: txId,
      type: 'investment',
      amount: amt,
      category: 'Investment Portfolio',
      date: today,
      note: `${invName.trim()} investment`,
      accountId: invAccountId || null,
      ledgerOnly: !invAccountId,
      goalId: inv.goalId || null,
      linkedInvestmentId: invId,
      createdAt: Date.now()
    };
    operations.push({ storeName: 'finance', item: tx });

    await storage.atomicPutMany(operations);
    if (inv.goalId) {
      await syncGoalProgressFromFinance(inv.goalId);
    }
    onSuccess(`✓ Investment added to portfolio & logged in ledger${invAccountId ? ' (debited from account)' : ''}`);
    setInvName('');
    setInvAmount('');
    setInvCurrentVal('');
    setInvGoalId('');
    setInvInputMode('manual');
    onRefresh();
  };

  // Sync an existing investment asset that has no ledger transaction
  const handleSyncExistingInvestment = async (inv: Investment, targetAcctId?: string) => {
    const acctId = targetAcctId || inv.accountId || accounts[0]?.id;
    const amt = Number(inv.amount) || 0;
    const now = Date.now();
    const operations: Array<{ storeName: string; item: any }> = [];

    if (acctId) {
      const acct = accounts.find(a => a.id === acctId);
      if (!acct) {
        reportError('The selected source account is unavailable. Refresh and select a valid account.');
        return;
      }
      if (amt > (Number(acct.balance) || 0)) {
        reportError(`Investment exceeds the available account balance of NPR ${Number(acct.balance).toLocaleString('en-IN')}.`);
        return;
      }
      if (acct) {
        operations.push({
          storeName: 'financeAccounts',
          item: {
            ...acct,
            balance: (Number(acct.balance) || 0) - amt
          }
        });
      }
    }

    const tx: FinanceTransaction = {
      id: generateUUID(),
      type: 'investment',
      amount: amt,
      category: 'Investment Portfolio',
      date: inv.date || today,
      note: `${inv.name} investment recorded in ledger`,
      accountId: acctId || null,
      ledgerOnly: !acctId,
      goalId: inv.goalId || null,
      linkedInvestmentId: inv.id,
      createdAt: now
    };
    operations.push({ storeName: 'finance', item: tx });

    await storage.atomicPutMany(operations);
    if (inv.goalId) {
      await syncGoalProgressFromFinance(inv.goalId);
    }
    onSuccess(`✓ NPR ${amt.toLocaleString('en-IN')} logged in ledger for "${inv.name}"!`);
    onRefresh();
  };

  const handleCreateSavings = async (e: React.FormEvent) => {
    e.preventDefault();
    const initialAmt = saveCurrent.trim() === '' ? 0 : Number(saveCurrent);
    const targetAmt = saveCategory === 'simple' && saveTarget.trim() !== '' ? Number(saveTarget) : 0;
    const annualRate = saveAnnualInterestRate.trim() === '' ? 0 : Number(saveAnnualInterestRate);
    const contribution = saveContributionAmount.trim() === '' ? 0 : Number(saveContributionAmount);
    const customPeriodDays = saveCustomPeriodDays.trim() === '' ? 0 : Number(saveCustomPeriodDays);
    const durationMonths = Number(saveMonths);
    const optionalAmounts = (saveCategory === 'bank'
      ? [saveTdsRate, saveServiceCharges, savePenalty, saveOtherDeductions]
      : [])
      .filter(value => value.trim() !== '')
      .map(Number);
    if (!saveName.trim() || !Number.isFinite(initialAmt) || initialAmt < 0) {
      reportError('Enter a savings name and a starting amount of zero or more.');
      return;
    }
    if (!Number.isFinite(contribution) || contribution < 0 ||
      optionalAmounts.some(value => !Number.isFinite(value) || value < 0) ||
      (saveCategory === 'bank' && (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 100)) ||
      (saveCategory === 'bank' && saveTdsRate.trim() !== '' && Number(saveTdsRate) > 100) ||
      (saveCategory === 'simple' && saveFrequency === 'custom' &&
        (!Number.isInteger(customPeriodDays) || customPeriodDays < 1))) {
      reportError('Enter valid non-negative contribution, rate, tax, fee, and penalty values.');
      return;
    }
    if (saveCategory === 'simple' && saveTarget.trim() !== '' &&
        (!Number.isFinite(targetAmt) || targetAmt < 0)) {
      reportError('Enter a valid savings target of zero or greater.');
      return;
    }
    if (saveCategory === 'bank' && saveProductType === 'recurring_deposit' && contribution <= 0) {
      reportError('Enter the recurring deposit installment amount.');
      return;
    }
    if (saveProductType === 'fixed_deposit' &&
      (!Number.isInteger(durationMonths) || durationMonths < 1 || !saveStartDate ||
        saveStartDate > today || !Number.isFinite(initialAmt) || initialAmt <= 0)) {
      reportError('Enter a positive FD principal, valid interest rate, start date not in the future, and term of at least one month.');
      return;
    }
    if (saveStartDate && saveStartDate > today) {
      reportError('Savings start date cannot be in the future.');
      return;
    }
    if (saveMaturityDate && saveStartDate && saveMaturityDate < saveStartDate) {
      reportError('Maturity date must be on or after the savings start date.');
      return;
    }

    const fundingAccount = initialAmt > 0 && saveFundingMode === 'account' && saveAccountId
      ? accounts.find(account => account.id === saveAccountId)
      : undefined;
    if (initialAmt > 0 && saveFundingMode === 'account' && !fundingAccount) {
      reportError('The selected source account is unavailable. Refresh and select a valid account.');
      return;
    }
    if (fundingAccount && initialAmt > (Number(fundingAccount.balance) || 0)) {
      reportError(`Starting deposit exceeds the selected account balance of NPR ${Number(fundingAccount.balance).toLocaleString('en-IN')}.`);
      return;
    }

    const spId = generateUUID();
    const now = Date.now();
    const basePlan: SavingsPlan = {
      id: spId,
      name: saveName.trim(),
      currentAmount: initialAmt,
      targetAmount: targetAmt,
      durationMonths: saveProductType === 'fixed_deposit' ? durationMonths : (Number(saveMonths) || 12),
      productType: saveProductType,
      category: saveCategory,
      bankName: saveCategory === 'bank' ? saveBankName.trim() || undefined : undefined,
      branchName: saveCategory === 'bank' ? saveBranchName.trim() || undefined : undefined,
      reference: saveReference.trim() || undefined,
      frequency: saveFrequency || undefined,
      customPeriodDays: saveFrequency === 'custom' ? customPeriodDays : undefined,
      contributionAmount: contribution || undefined,
      annualInterestRate: saveCategory === 'bank' && annualRate > 0 ? annualRate : undefined,
      interestEffectiveDate: saveCategory === 'bank' ? saveInterestEffectiveDate || undefined : undefined,
      interestMethod: saveCategory === 'bank' ? saveInterestMethod : undefined,
      compoundingPerYear: saveCategory === 'bank' && saveInterestMethod === 'compound'
        ? Number(saveCompoundingPerYear) as 1 | 2 | 4 | 12
        : undefined,
      interestPayoutFrequency: saveCategory === 'bank' ? saveInterestPayoutFrequency : undefined,
      tdsRate: saveCategory === 'bank' && saveTdsRate.trim() !== '' ? Number(saveTdsRate) : undefined,
      serviceCharges: saveCategory === 'bank' && saveServiceCharges.trim() !== '' ? Number(saveServiceCharges) : undefined,
      penalty: saveCategory === 'bank' && savePenalty.trim() !== '' ? Number(savePenalty) : undefined,
      otherDeductions: saveCategory === 'bank' && saveOtherDeductions.trim() !== '' ? Number(saveOtherDeductions) : undefined,
      startDate: saveStartDate || undefined,
      maturityDate: saveMaturityDate || undefined,
      notes: saveNotes.trim() || undefined,
      goalId: saveInputMode === 'link' && saveGoalId ? saveGoalId : null,
      createdAt: now,
      updatedAt: now
    };
    const sp: SavingsPlan = {
      ...basePlan,
      targetAmount: saveProductType === 'fixed_deposit' ? initialAmt : targetAmt
    };

    const operations: Array<{ storeName: string; item: any }> = [
      { storeName: 'savingsPlans', item: sp }
    ];

    if (fundingAccount) {
      operations.push(
        {
          storeName: 'financeAccounts',
          item: { ...fundingAccount, balance: (Number(fundingAccount.balance) || 0) - initialAmt }
        },
        {
          storeName: 'finance',
          item: {
            id: generateUUID(),
            type: 'savings',
            amount: initialAmt,
            category: getSavingsProductLabel(saveProductType),
            date: saveStartDate || today,
            note: `Opening deposit for ${sp.name}`,
            accountId: fundingAccount.id,
            goalId: sp.goalId || null,
            linkedSavingsPlanId: spId,
            createdAt: now
          } satisfies FinanceTransaction
        }
      );
    }

    try {
      await storage.atomicPutMany(operations);
    } catch (err) {
      console.error('Unable to create savings instrument', err);
      reportError('Savings instrument could not be created. Please try again.');
      return;
    }
    if (sp.goalId) {
      await syncGoalProgressFromFinance(sp.goalId);
    }
    onSuccess(saveProductType === 'fixed_deposit'
      ? 'Fixed deposit recorded.'
      : `${getSavingsProductLabel(saveProductType)} recorded${fundingAccount ? ' and funded from account' : ' as an existing/imported balance'}`);
    setSaveName('');
    setSaveCurrent('');
    setSaveTarget('');
    setSaveAnnualInterestRate('8');
    setSaveCompoundingPerYear('4');
    setSaveInterestMethod('compound');
    setSaveFrequency('monthly');
    setSaveCustomPeriodDays('');
    setSaveContributionAmount('');
    setSaveBankName('');
    setSaveBranchName('');
    setSaveReference('');
    setSaveInterestEffectiveDate(today);
    setSaveInterestPayoutFrequency('at_maturity');
    setSaveTdsRate('');
    setSaveServiceCharges('');
    setSavePenalty('');
    setSaveOtherDeductions('');
    setSaveNotes('');
    setSaveStartDate(today);
    setSaveMaturityDate('');
    setSaveFundingMode('account');
    setSaveGoalId('');
    setSaveInputMode('manual');
    onRefresh();
  };

  // Contribute / Deposit Funds to an Existing Savings Plan
  const handleDepositToSavings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositTargetPlan) return;
    const amt = Number(depositAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      reportError('Enter a deposit amount greater than zero.');
      return;
    }
    if (depositTargetPlan.productType === 'fixed_deposit') {
      reportError('Create a separate fixed-deposit record for each new FD or top-up tranche.');
      return;
    }
    const sourceAccount = accounts.find(account =>
      account.id === (depositAccountId || accounts[0]?.id)
    );
    if (!sourceAccount) {
      reportError('Select an available source account for this deposit.');
      return;
    }
    if (amt > (Number(sourceAccount.balance) || 0)) {
      reportError(`Deposit exceeds the selected account balance of NPR ${Number(sourceAccount.balance).toLocaleString('en-IN')}.`);
      return;
    }

    const now = Date.now();
    const updatedPlan: SavingsPlan = {
      ...depositTargetPlan,
      currentAmount: (Number(depositTargetPlan.currentAmount) || 0) + amt,
      updatedAt: now
    };

    const operations: Array<{ storeName: string; item: any }> = [
      { storeName: 'savingsPlans', item: updatedPlan }
    ];

    operations.push({
      storeName: 'financeAccounts',
      item: { ...sourceAccount, balance: (Number(sourceAccount.balance) || 0) - amt }
    });

    const tx: FinanceTransaction = {
      id: generateUUID(),
      type: 'savings',
      amount: amt,
      category: `${getSavingsProductLabel(depositTargetPlan.productType)} Contribution`,
      date: today,
      note: depositNote.trim() || `Contributed to ${depositTargetPlan.name}`,
      accountId: sourceAccount.id,
      goalId: depositTargetPlan.goalId || null,
      linkedSavingsPlanId: depositTargetPlan.id,
      createdAt: now
    };
    operations.push({ storeName: 'finance', item: tx });

    try {
      await storage.atomicPutMany(operations);
    } catch (err) {
      console.error('Unable to record savings deposit', err);
      reportError('Savings deposit could not be recorded. Please try again.');
      return;
    }
    if (depositTargetPlan.goalId) {
      await syncGoalProgressFromFinance(depositTargetPlan.goalId);
    }
    onSuccess(`✓ NPR ${amt.toLocaleString('en-IN')} moved from "${sourceAccount.name}" into "${depositTargetPlan.name}"`);
    setDepositTargetPlan(null);
    setDepositAmount('');
    setDepositNote('');
    onRefresh();
  };

  const handleWithdrawSavings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawalTargetPlan) return;
    const plan = withdrawalTargetPlan;
    const isFixedDeposit = plan.productType === 'fixed_deposit';
    const principal = Math.max(0, Number(plan.currentAmount) || 0);
    const payout = Number(withdrawalAmount);
    const isFinalSettlement = isFixedDeposit || withdrawalIsFinalSettlement || payout >= principal;
    const principalReduction = isFinalSettlement ? principal : payout;
    const interest = withdrawalInterest.trim() === '' ? 0 : Number(withdrawalInterest);
    const tds = withdrawalTds.trim() === '' ? 0 : Number(withdrawalTds);
    const serviceCharge = withdrawalServiceCharge.trim() === '' ? 0 : Number(withdrawalServiceCharge);
    const penalty = withdrawalPenalty.trim() === '' ? 0 : Number(withdrawalPenalty);
    const otherDeduction = withdrawalOtherDeduction.trim() === '' ? 0 : Number(withdrawalOtherDeduction);
    const expectedSettlement = Math.max(0, principal + interest - tds - serviceCharge - penalty - otherDeduction);
    const account = accounts.find(item => item.id === (withdrawalAccountId || accounts[0]?.id));
    if (!Number.isFinite(payout) || payout <= 0 || principal <= 0) {
      reportError('There is no available savings balance to withdraw.');
      return;
    }
    if ([interest, tds, serviceCharge, penalty, otherDeduction].some(value => !Number.isFinite(value) || value < 0)) {
      reportError('Enter zero or a valid positive amount for each settlement item.');
      return;
    }
    if (!account) {
      reportError('Select an available account to receive the withdrawal.');
      return;
    }

    const now = Date.now();
    const updatedPlan: SavingsPlan = {
      ...plan,
      currentAmount: Math.max(0, principal - principalReduction),
      status: isFinalSettlement ? 'closed' : plan.status || 'active',
      updatedAt: now
    };
    const transaction: FinanceTransaction = {
      id: generateUUID(),
      type: 'savingsWithdrawal',
      amount: payout,
      principal: principalReduction,
      interest: interest || undefined,
      tds: tds || undefined,
      serviceCharge: serviceCharge || undefined,
      penalty: penalty || undefined,
      otherDeduction: otherDeduction || undefined,
      settlementVariance: isBankSavingsPlan(plan) && isFinalSettlement ? payout - expectedSettlement : undefined,
      category: isBankSavingsPlan(plan) && isFinalSettlement
        ? 'Savings Final Settlement'
        : `${getSavingsProductLabel(plan.productType)} Withdrawal`,
      date: today,
      note: `${plan.name}${isBankSavingsPlan(plan) && isFinalSettlement ? ' actual settlement' : ''}`,
      accountId: account.id,
      goalId: plan.goalId || null,
      linkedSavingsPlanId: plan.id,
      createdAt: now
    };
    try {
      await storage.atomicPutMany([
        { storeName: 'savingsPlans', item: updatedPlan },
        { storeName: 'financeAccounts', item: { ...account, balance: (Number(account.balance) || 0) + payout } },
        { storeName: 'finance', item: transaction }
      ]);
    } catch (err) {
      console.error('Unable to record savings withdrawal', err);
      reportError('Savings withdrawal could not be recorded. Please try again.');
      return;
    }
    if (plan.goalId) {
      await syncGoalProgressFromFinance(plan.goalId);
    }
    onSuccess(`NPR ${payout.toLocaleString('en-IN', { maximumFractionDigits: 2 })} payout recorded in "${account.name}"${isFixedDeposit ? ' as the actual bank payout entered' : ''}`);
    setWithdrawalTargetPlan(null);
    setWithdrawalAmount('');
    setWithdrawalIsFinalSettlement(false);
    setWithdrawalInterest('');
    setWithdrawalTds('');
    setWithdrawalServiceCharge('');
    setWithdrawalPenalty('');
    setWithdrawalOtherDeduction('');
    onRefresh();
  };

  const handleSaveSavingsBalance = async (e: React.FormEvent, plan: SavingsPlan) => {
    e.preventDefault();
    const newBalance = Number(editingSavingsBalance);
    if (!Number.isFinite(newBalance) || newBalance < 0) {
      reportError('Enter an actual savings balance of zero or greater.');
      return;
    }
    const previousBalance = Number(plan.currentAmount) || 0;
    const difference = newBalance - previousBalance;
    if (Math.abs(difference) < 0.01) {
      setEditingSavingsBalanceId(null);
      return;
    }
    const amount = Math.abs(difference);
    const now = Date.now();
    const adjustment: FinanceTransaction = {
      id: generateUUID(),
      type: difference > 0 ? 'savings' : 'savingsWithdrawal',
      amount,
      principal: amount,
      category: 'Savings Balance Adjustment',
      date: today,
      note: `Manual actual balance update for ${plan.name}`,
      linkedSavingsPlanId: plan.id,
      ledgerOnly: true,
      createdAt: now
    };
    try {
      await storage.atomicPutMany([
        { storeName: 'savingsPlans', item: { ...plan, currentAmount: newBalance, updatedAt: now } },
        { storeName: 'finance', item: adjustment }
      ]);
    } catch (err) {
      console.error('Unable to update actual savings balance', err);
      reportError('Savings balance could not be updated. Please try again.');
      return;
    }
    setEditingSavingsBalanceId(null);
    onSuccess(`"${plan.name}" actual balance updated to NPR ${newBalance.toLocaleString('en-IN')}.`);
    onRefresh();
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(assetVal);
    if (!assetName.trim() || !Number.isFinite(value) || value <= 0) {
      reportError('Enter an asset name and a market value greater than zero.');
      return;
    }
    const a: Asset = {
      id: generateUUID(),
      name: assetName.trim(),
      value,
      goalId: assetInputMode === 'link' && assetGoalId ? assetGoalId : null
    };
    await storage.put('assets', a);
    if (a.goalId) {
      await syncGoalProgressFromFinance(a.goalId);
    }
    onSuccess(`Asset "${assetName}" saved to balance sheet${a.goalId ? ' & linked to Goal' : ''}`);
    setAssetName('');
    setAssetVal('');
    setAssetGoalId('');
    setAssetInputMode('manual');
    onRefresh();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.store === 'financeAccounts') {
      const account = accounts.find(item => item.id === deleteTarget.id);
      const hasBalance = Math.abs(Number(account?.balance) || 0) > 0.01;
      const hasTransactions = transactions.some(tx =>
        tx.accountId === deleteTarget.id ||
        tx.fromAccountId === deleteTarget.id ||
        tx.toAccountId === deleteTarget.id
      );
      const hasLoanPayments = loanPayments.some(payment => payment.accountId === deleteTarget.id);
      if (hasBalance || hasTransactions || hasLoanPayments) {
        setDeleteTarget(null);
        reportError('This account still has a balance or ledger history. Transfer/reconcile the balance and remove or reassign its linked transactions and repayments before deleting it.');
        return;
      }
    }
    if (deleteTarget.store === 'loans') {
      const hasTransactions = transactions.some(tx => tx.linkedLoanId === deleteTarget.id);
      const hasPayments = loanPayments.some(payment => payment.loanId === deleteTarget.id);
      if (hasTransactions || hasPayments) {
        setDeleteTarget(null);
        reportError('This loan still has linked disbursement or repayment history. Reverse/remove those ledger entries first; the loan was kept to preserve a correct balance sheet.');
        return;
      }
    }
    if (deleteTarget.store === 'liabilities') {
      const hasTransactions = transactions.some(tx => tx.linkedLiabilityId === deleteTarget.id);
      if (hasTransactions) {
        setDeleteTarget(null);
        reportError('This liability has borrowing or repayment history. Remove its linked ledger entries first so account balances and outstanding debt remain accurate.');
        return;
      }
    }
    if (deleteTarget.store === 'savingsPlans') {
      const plan = savingsPlans.find(item => item.id === deleteTarget.id);
      const hasContributions = transactions.some(tx => tx.linkedSavingsPlanId === deleteTarget.id);
      if ((Number(plan?.currentAmount) || 0) > 0.01 || hasContributions) {
        setDeleteTarget(null);
        reportError('This savings plan still holds funds or has ledger contributions. Reverse its linked contribution entries first so the account balance and savings total stay accurate.');
        return;
      }
    }
    let linkedGoalIdToDelete: string | null | undefined = null;
    if (deleteTarget.store === 'finance') {
      const tx = transactions.find(t => t.id === deleteTarget.id);
      if (
        tx?.type === 'savings' &&
        tx.linkedSavingsPlanId &&
        transactions.some(item =>
          item.id !== tx.id &&
          item.type === 'savingsWithdrawal' &&
          item.linkedSavingsPlanId === tx.linkedSavingsPlanId
        )
      ) {
        setDeleteTarget(null);
        reportError('This savings deposit has a linked withdrawal. Remove the withdrawal first so the reserve balance can be reversed correctly.');
        return;
      }
      if (
        tx?.type === 'loan' &&
        tx.linkedLiabilityId &&
        transactions.some(item => item.id !== tx.id && item.linkedLiabilityId === tx.linkedLiabilityId)
      ) {
        setDeleteTarget(null);
        reportError('Remove this liability’s repayment entries first, then remove the original borrowing entry.');
        return;
      }
      if (
        tx?.type === 'loan' &&
        tx.linkedLoanId &&
        (transactions.some(item => item.id !== tx.id && item.linkedLoanId === tx.linkedLoanId) ||
          loanPayments.some(payment => payment.loanId === tx.linkedLoanId))
      ) {
        setDeleteTarget(null);
        reportError('This loan has repayment history. Remove its repayments first, then remove the original disbursement.');
        return;
      }
      linkedGoalIdToDelete = tx?.goalId;
      await storage.deleteFinanceTransactionWithLink(deleteTarget.id);
      if (tx?.type === 'expense' || tx?.type === 'investment') {
        onSuccess(`✓ Removed "${deleteTarget.name}" & refunded account`);
      } else if (tx?.type === 'repayment') {
        onSuccess(`✓ Removed loan payment, refunded account & restored loan principal`);
      } else if (tx?.type === 'transfer') {
        onSuccess(`✓ Removed transfer & reversed both account balances`);
      } else if (tx?.type === 'loan') {
        onSuccess(`✓ Removed loan transaction & adjusted its linked debt and account balance`);
      } else if (tx?.type === 'savingsWithdrawal') {
        onSuccess(`✓ Removed savings withdrawal & reversed its account credit`);
      } else if (tx?.type === 'income') {
        onSuccess(`✓ Removed "${deleteTarget.name}" & adjusted account balance`);
      } else {
        onSuccess(`✓ Removed "${deleteTarget.name}"`);
      }
    } else if (deleteTarget.store === 'investments') {
      const inv = investments.find(i => i.id === deleteTarget.id);
      linkedGoalIdToDelete = inv?.goalId;
      const linkedTx = transactions.find(t => t.linkedInvestmentId === deleteTarget.id);
      if (linkedTx) {
        await storage.deleteFinanceTransactionWithLink(linkedTx.id);
      }
      await storage.delete('investments', deleteTarget.id);
      onSuccess(`✓ Removed investment asset "${deleteTarget.name}" & synced ledger`);
    } else {
      const it: any = await storage.get(deleteTarget.store, deleteTarget.id);
      linkedGoalIdToDelete = it?.goalId;
      await storage.delete(deleteTarget.store, deleteTarget.id);
      onSuccess(`✓ Removed "${deleteTarget.name}"`);
    }
    if (linkedGoalIdToDelete) {
      await syncGoalProgressFromFinance(linkedGoalIdToDelete);
    }
    setDeleteTarget(null);
    onRefresh();
  };

  // Export Comprehensive Multi-Section Financial Statement as CSV
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0 && investments.length === 0 && savingsPlans.length === 0 && loans.length === 0) {
      alert('No financial data available to export');
      return;
    }

    const periodLabel = dateFilterMode === 'all'
      ? 'All Time'
      : dateFilterMode === 'this_month'
      ? `This Month (${currentYearMonth})`
      : dateFilterMode === 'last_30_days'
      ? 'Last 30 Days'
      : `Custom Range (${customStartDate || 'start'} to ${customEndDate || 'end'})`;

    const lines: string[] = [];

    // SECTION 1: HEADER & PERIOD CASH FLOW SUMMARY
    lines.push(`"PROJECT OM — FINANCIAL EXECUTIVE STATEMENT"`);
    lines.push(`"Generated On: ${new Date().toLocaleString('en-IN')}"`);
    lines.push(`"Active Period Scope: ${periodLabel}"`);
    lines.push('');
    lines.push('"=== PERIOD CASH FLOW STATEMENT ==="');
    lines.push('"Activity","Direction","Amount (NPR)"');
    lines.push(`"Gross Income Received","Inflow",${periodIncome}`);
    lines.push(`"Operating Expenses Paid","Outflow",-${periodExpense}`);
    lines.push(`"Loan Interest Paid","Outflow",-${periodInterestExpense}`);
    lines.push(`"Net Operating Cash Flow","Net",${periodOperatingFlow}`);
    lines.push(`"Investments Capital Deployed","Outflow",-${periodInvestmentFlow}`);
    lines.push(`"Net Savings Transfers","Net",-${periodSavingsFlow}`);
    lines.push(`"Loans Borrowed / Funds Received","Inflow",${periodLoanReceived}`);
    lines.push(`"Loan Principal Repaid","Outflow",-${periodRepaymentFlow}`);
    lines.push(`"Statement Adjustments","Net",${periodAdjustmentFlow}`);
    lines.push(`"Net Financing Cash Flow","Net",${periodFinancingFlow}`);
    lines.push(`"Net Period Cash Flow (Ledger Delta)","Total",${periodNetCashFlow}`);
    lines.push('');

    // SECTION 2: TRANSACTIONS LEDGER
    lines.push('"=== TRANSACTIONS LEDGER (FILTERED PERIOD) ==="');
    lines.push('"ID","Date","Type","Category","Amount (NPR)","Principal (NPR)","Interest (NPR)","TDS (NPR)","Service Charge (NPR)","Penalty (NPR)","Other Deduction (NPR)","Settlement Variance (NPR)","Note","AccountId","Adjustment Direction","Ledger Only"');
    filteredTransactions.forEach(t => {
      lines.push([
        t.id,
        t.date,
        t.type,
        `"${(t.category || '').replace(/"/g, '""')}"`,
        t.amount,
        t.principal || '',
        t.interest || '',
        t.tds || '',
        t.serviceCharge || '',
        t.penalty || '',
        t.otherDeduction || '',
        t.settlementVariance ?? '',
        `"${(t.note || '').replace(/"/g, '""')}"`,
        t.accountId || '',
        t.adjustmentDirection || '',
        t.ledgerOnly ? 'Yes' : 'No'
      ].join(','));
    });
    lines.push('');

    // SECTION 3: INVESTMENT PORTFOLIO
    lines.push('"=== INVESTMENT PORTFOLIO ==="');
    lines.push('"ID","Asset Name","Invested Cost (NPR)","Current Valuation (NPR)","P&L / Gain (NPR)","ROI %","Date"');
    investments.forEach(i => {
      const cost = Number(i.amount) || 0;
      const current = Number(i.currentValue ?? i.amount) || 0;
      const gain = current - cost;
      const roi = cost > 0 ? ((gain / cost) * 100).toFixed(2) : '0';
      lines.push([
        i.id,
        `"${(i.name || '').replace(/"/g, '""')}"`,
        cost,
        current,
        gain,
        `${roi}%`,
        i.date || ''
      ].join(','));
    });
    lines.push('');

    // SECTION 4: SAVINGS PLANS & TARGETS
    lines.push('"=== SAVINGS PLANS & FINANCIAL TARGETS ==="');
    lines.push('"ID","Status","Category","Product Type","Plan Name","Bank / Institution","Branch","Safe Reference","Balance / Principal (NPR)","Estimated Current Value (NPR)","Target / Maturity Value (NPR)","Annual Interest %","Interest Method","TDS Rate % (manual)","Service Charges (NPR)","Penalty (NPR)","Other Deductions (NPR)","Frequency","Custom Period Days","Planned Contribution (NPR)","Start Date","Maturity Date","Term Months","Notes"');
    savingsPlans.forEach(s => {
      const cur = Number(s.currentAmount) || 0;
      const isFixedDeposit = s.productType === 'fixed_deposit';
      const valuation = isFixedDeposit ? getFixedDepositValue(s) : null;
      const currentValue = isFixedDeposit ? valuation?.currentValue || 0 : cur;
      const target = isFixedDeposit ? valuation?.maturityValue || 0 : Number(s.targetAmount) || 0;
      lines.push([
        s.id,
        s.status || 'active',
        s.category || (isBankSavingsPlan(s) ? 'bank' : 'simple'),
        getSavingsProductLabel(s.productType),
        `"${(s.name || '').replace(/"/g, '""')}"`,
        `"${(s.bankName || '').replace(/"/g, '""')}"`,
        `"${(s.branchName || '').replace(/"/g, '""')}"`,
        `"${(s.reference || '').replace(/"/g, '""')}"`,
        cur,
        currentValue.toFixed(2),
        target.toFixed(2),
        Number(s.annualInterestRate) || 0,
        s.interestMethod || '',
        s.tdsRate ?? '',
        s.serviceCharges ?? '',
        s.penalty ?? '',
        s.otherDeductions ?? '',
        s.frequency || '',
        s.customPeriodDays ?? '',
        s.contributionAmount ?? '',
        s.startDate || '',
        s.maturityDate || valuation?.maturityDate || '',
        s.durationMonths || 12,
        `"${(s.notes || '').replace(/"/g, '""')}"`
      ].join(','));
    });
    lines.push('');

    // SECTION 5: LOANS & LIABILITIES
    lines.push('"=== ACTIVE LOANS & LIABILITIES ==="');
    lines.push('"ID","Liability Name","Original Principal (NPR)","Outstanding Balance (NPR)","Interest Rate %","Tenure Months"');
    loans.forEach(l => {
      lines.push([
        l.id,
        `"${(l.name || '').replace(/"/g, '""')}"`,
        Number(l.principal) || 0,
        Number(l.outstanding) || 0,
        Number(l.rate) || 0,
        Number(l.tenure) || 12
      ].join(','));
    });
    liabilities.forEach(l => {
      lines.push([
        l.id,
        `"${(l.name || '').replace(/"/g, '""')}" (Manual Liability)`,
        Number(l.amount) || 0,
        Number(l.amount) || 0,
        0,
        0
      ].join(','));
    });
    lines.push('');

    // SECTION 6: SOVEREIGN BALANCE SHEET & NET WORTH
    lines.push('"=== SOVEREIGN BALANCE SHEET & NET WORTH ==="');
    lines.push('"Asset / Liability Component","Sub-Category","Amount (NPR)"');
    lines.push(`"Liquid Checking & Cash","Assets",${liquidCash}`);
    lines.push(`"Investment Portfolio Market Value","Assets",${investmentValue}`);
    lines.push(`"Savings & Term Deposits (estimated current value)","Assets",${totalSavings}`);
    lines.push(`"Physical & Other Assets","Assets",${manualAssetsVal}`);
    lines.push(`"TOTAL SOVEREIGN ASSETS","Total Assets",${totalAssets}`);
    lines.push(`"Active Loans Debt","Liabilities",${totalLoanLiabilities}`);
    lines.push(`"Other Manual Liabilities","Liabilities",${manualLiabilitiesVal}`);
    lines.push(`"TOTAL LIABILITIES","Total Liabilities",${totalLiabilities}`);
    lines.push(`"SOVEREIGN NET WORTH","Net Worth (Assets - Debt)",${netWorth}`);

    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    let fileSuffix = today;
    if (dateFilterMode === 'this_month') {
      fileSuffix = `this-month-${currentYearMonth}`;
    } else if (dateFilterMode === 'last_30_days') {
      fileSuffix = `last-30-days-${today}`;
    } else if (dateFilterMode === 'custom' && (customStartDate || customEndDate)) {
      fileSuffix = `${customStartDate || 'start'}-to-${customEndDate || 'end'}`;
    }
    link.download = `finance-statement-${fileSuffix}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    onSuccess(`Comprehensive statement (${filteredTransactions.length} txs, full balance sheet & portfolio) exported as CSV`);
  };

  const sortedTransactions = [...transactions].sort((a, b) => {
    const dateComp = (b.date || '').localeCompare(a.date || '');
    if (dateComp !== 0) return txSortOrder === 'desc' ? dateComp : -dateComp;
    const timeComp = (b.createdAt || 0) - (a.createdAt || 0);
    return txSortOrder === 'desc' ? timeComp : -timeComp;
  });

  // The cash flow statement follows its date range, not the ledger's search or goal filters.
  const dateFilteredTransactions = sortedTransactions.filter(t => {
    if (dateFilterMode === 'this_month') {
      if (!t.date || !t.date.startsWith(currentYearMonth)) return false;
    } else if (dateFilterMode === 'last_30_days') {
      if (!t.date || t.date < thirtyDaysAgo) return false;
    } else if (dateFilterMode === 'custom') {
      if (customStartDate && t.date < customStartDate) return false;
      if (customEndDate && t.date > customEndDate) return false;
    }
    return true;
  });

  // Search/goal filters are used for transaction list counts and display only.
  const dateAndSearchFilteredTxs = dateFilteredTransactions.filter(t => {
    if (txGoalFilter !== 'all') {
      if (txGoalFilter === 'linked' && !t.goalId) return false;
      if (txGoalFilter === 'unlinked' && t.goalId) return false;
      if (txGoalFilter !== 'linked' && txGoalFilter !== 'unlinked' && t.goalId !== txGoalFilter) return false;
    }
    if (txSearch) {
      const q = txSearch.toLowerCase();
      const goalObj = t.goalId ? goals.find(g => g.id === t.goalId) : null;
      const match = `${t.category} ${t.note || ''} ${t.type} ${t.amount} ${t.date || ''} ${goalObj?.title || ''}`.toLowerCase();
      return match.includes(q);
    }
    return true;
  });

  // Final filtered list including type filter
  const filteredTransactions = dateAndSearchFilteredTxs.filter(t => {
    if (txTypeFilter !== 'all' && t.type !== txTypeFilter) return false;
    return true;
  });

  // Calculate period cash flow from all transactions in the selected date range.
  let periodIncome = 0;
  let periodExpense = 0;
  let periodInvestmentFlow = 0;
  let periodSavingsFlow = 0;
  let periodLoanReceived = 0;
  let periodRepaymentFlow = 0;
  let periodInterestExpense = 0;
  let periodAdjustmentFlow = 0;

  dateFilteredTransactions.forEach(t => {
    const amt = Number(t.amount) || 0;
    if (t.type === 'income') periodIncome += amt;
    else if (t.type === 'expense') periodExpense += amt;
    else if (t.type === 'investment' && !t.ledgerOnly) periodInvestmentFlow += amt;
    else if (t.type === 'savings' && !t.ledgerOnly) periodSavingsFlow += amt;
    else if (t.type === 'savingsWithdrawal' && !t.ledgerOnly) periodSavingsFlow -= amt;
    else if (t.type === 'loan') periodLoanReceived += amt;
    else if (t.type === 'repayment') {
      periodRepaymentFlow += Number(t.principal) || amt;
      periodInterestExpense += Number(t.interest) || 0;
    }
    else if (t.type === 'adjustment') periodAdjustmentFlow += t.adjustmentDirection === 'credit' ? amt : -amt;
  });

  const periodOperatingFlow = periodIncome - periodExpense - periodInterestExpense;
  const periodInvestingFlow = -periodInvestmentFlow;
  const periodFinancingFlow = periodLoanReceived - periodRepaymentFlow;
  const periodNetCashFlow = periodOperatingFlow + periodInvestingFlow - periodSavingsFlow + periodFinancingFlow + periodAdjustmentFlow;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            Finance & Ledger
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Manual NPR bookkeeping. No bank sync; enter statement balances, fees and actual payouts yourself.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 transition-all cursor-pointer"
            title="Export Ledger as CSV"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Financial KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-white/[0.08] dark:bg-slate-900 min-w-0">
          <div className="flex items-center justify-between gap-1 text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider truncate">Net Worth</span>
            <ShieldCheck className="h-4 w-4 shrink-0 text-indigo-500" />
          </div>
          <div className="mt-2.5 sm:mt-3 font-mono text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">
            NPR {netWorth.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-medium truncate">
            Assets NPR {totalAssets.toLocaleString('en-IN')} - Debt NPR {totalLiabilities.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-white/[0.08] dark:bg-slate-900 min-w-0">
          <div className="flex items-center justify-between gap-1 text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider truncate">Liquid Cash</span>
            <DollarSign className="h-4 w-4 shrink-0 text-emerald-500" />
          </div>
          <div className="mt-2.5 sm:mt-3 font-mono text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums truncate">
            NPR {liquidCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-medium truncate">Across {accounts.length} bank & cash accounts</div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-white/[0.08] dark:bg-slate-900 min-w-0">
          <div className="flex items-center justify-between gap-1 text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider truncate">Investments</span>
            <TrendingUp className="h-4 w-4 shrink-0 text-blue-500" />
          </div>
          <div className="mt-2.5 sm:mt-3 font-mono text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">
            NPR {investmentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-medium truncate">{investments.length} portfolio assets</div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-white/[0.08] dark:bg-slate-900 min-w-0">
          <div className="flex items-center justify-between gap-1 text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider truncate">Total Debt</span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-rose-500" />
          </div>
          <div className="mt-2.5 sm:mt-3 font-mono text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-rose-600 dark:text-rose-400 tabular-nums truncate">
            NPR {totalLiabilities.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-medium truncate">
            {loans.length} loans · {liabilities.length} liabilities
          </div>
        </div>
      </div>

      {/* Submenu Tabs (Full Width Responsive Slide Tab) */}
      <div className="w-full pb-2 border-b border-slate-200 dark:border-slate-800">
        <SlideTabs
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as any)}
          tabs={[
            { id: 'overview', label: 'Cash Flow & Accounts', shortLabel: 'Cash Flow', icon: Landmark },
            { id: 'transactions', label: `Transactions (${transactions.length})`, shortLabel: `Txns (${transactions.length})`, icon: ArrowUpDown },
            { id: 'loans', label: `Loans & Debt (${loans.length + liabilities.length})`, shortLabel: `Loans (${loans.length + liabilities.length})`, icon: DollarSign },
            { id: 'investments', label: `Investments (${investments.length})`, shortLabel: `Invest (${investments.length})`, icon: TrendingUp },
            { id: 'savings', label: `Savings & Deposits (${savingsPlans.length})`, shortLabel: `Savings (${savingsPlans.length})`, icon: ShieldCheck },
            { id: 'balanceSheet', label: `Balance Sheet (${assets.length})`, shortLabel: `Sheet (${assets.length})`, icon: FileText }
          ]}
        />
      </div>

      {/* Tab: Overview & Accounts */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Top Left: Record Transaction Form (6 cols) */}
          <div className="lg:col-span-6 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Record Transaction</h2>
                </div>
              </div>
            </div>

            <form onSubmit={handleCreateTransaction} className="mt-4 space-y-4">
              {/* Segmented Transaction Type Selector */}
              <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setTxType('expense')}
                  className={`flex h-9 sm:h-9.5 items-center justify-center rounded-xl font-semibold transition-all cursor-pointer ${
                    txType === 'expense'
                      ? 'bg-white text-rose-600 shadow-xs dark:bg-slate-700 dark:text-rose-400'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('income')}
                  className={`flex h-9 sm:h-9.5 items-center justify-center rounded-xl font-semibold transition-all cursor-pointer ${
                    txType === 'income'
                      ? 'bg-white text-emerald-600 shadow-xs dark:bg-slate-700 dark:text-emerald-400'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Income
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('transfer')}
                  className={`flex h-9 sm:h-9.5 items-center justify-center rounded-xl font-semibold transition-all cursor-pointer ${
                    txType === 'transfer'
                      ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-700 dark:text-indigo-400'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Transfer
                </button>
              </div>

              {/* Strategic Goal Link Mode Selector */}
              {renderGoalModeToggle(
                txInputMode,
                setTxInputMode,
                txGoalId,
                setTxGoalId,
                g => { if (!txCategory) setTxCategory(g.category || g.title); },
                'Strategic goal link options'
              )}

              {/* Amount & Date Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Amount (NPR) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={txAmount}
                      onChange={e => setTxAmount(e.target.value)}
                      placeholder="0.00"
                      className="h-10 sm:h-10.5 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs sm:text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Transaction Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={txDate}
                    onChange={e => setTxDate(e.target.value)}
                    className="h-10 sm:h-10.5 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs sm:text-sm text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none transition-all"
                  />
                </div>
              </div>

              {/* Category & Account Fields */}
              {txType === 'transfer' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      From Account
                    </label>
                    <select
                      value={txAccount || accounts[0]?.id || ''}
                      onChange={e => setTxAccount(e.target.value)}
                      className="h-10 sm:h-10.5 w-full rounded-xl border border-slate-200 px-2.5 text-xs sm:text-sm text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none cursor-pointer transition-all"
                    >
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name} (NPR {Number(a.balance).toLocaleString('en-IN')})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      To Account
                    </label>
                    <select
                      value={txToAccount || accounts[1]?.id || accounts[0]?.id || ''}
                      onChange={e => setTxToAccount(e.target.value)}
                      className="h-10 sm:h-10.5 w-full rounded-xl border border-slate-200 px-2.5 text-xs sm:text-sm text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none cursor-pointer transition-all"
                    >
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name} (NPR {Number(a.balance).toLocaleString('en-IN')})</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div ref={categoryDropdownRef} className="relative space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Category {txType === 'income' ? <span className="text-slate-400 font-normal">(Optional)</span> : <span className="text-rose-500">*</span>}
                      </label>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={txCategory}
                        onChange={e => {
                          setTxCategory(e.target.value);
                          setIsCategoryDropdownOpen(true);
                        }}
                        onFocus={() => setIsCategoryDropdownOpen(true)}
                        placeholder={
                          txType === 'income'
                            ? 'Select or type (Default: Income)'
                            : 'Select or type (e.g. Food, Groceries)'
                        }
                        className="h-10 sm:h-10.5 w-full rounded-xl border border-slate-200 pl-3 pr-16 text-xs sm:text-sm text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none transition-all"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-1.5 gap-0.5">
                        {txCategory && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTxCategory('');
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                            title="Clear"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsCategoryDropdownOpen(prev => !prev)}
                          className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-transform cursor-pointer ${
                            isCategoryDropdownOpen ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''
                          }`}
                          title="Show categories"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Combobox Dropdown Popover */}
                    {isCategoryDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 max-h-56 overflow-y-auto rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800 z-50 animate-in fade-in slide-in-from-top-1">
                        {/* Custom Typing Chip/Action if input doesn't match standard */}
                        {txCategory.trim() &&
                          !categoryList.some(b => b.toLowerCase() === txCategory.trim().toLowerCase()) && (
                            <div className="px-2.5 py-1.5 mb-1.5 bg-indigo-50/80 dark:bg-indigo-950/50 rounded-xl flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-300">
                              <span className="truncate">Use custom: <strong>"{txCategory.trim()}"</strong></span>
                              <button
                                type="button"
                                onClick={() => setIsCategoryDropdownOpen(false)}
                                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 ml-2 cursor-pointer"
                              >
                                Keep
                              </button>
                            </div>
                        )}

                        {/* Standard Categories */}
                        {filteredCategories.length > 0 && (
                          <div className="space-y-0.5">
                            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                              {txType === 'income' ? 'Income Categories' : 'Preset Categories'}
                            </div>
                            {filteredCategories.map(cat => {
                              const isSelected = txCategory.trim().toLowerCase() === cat.toLowerCase();
                              return (
                                <button
                                  key={cat}
                                  type="button"
                                  onClick={() => {
                                    setTxCategory(cat);
                                    setIsCategoryDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-xl text-left transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-indigo-50 font-semibold text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400'
                                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                                  }`}
                                >
                                  <span>{cat}</span>
                                  {isSelected && <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {filteredCategories.length === 0 && (
                          <div className="px-3 py-3 text-center text-xs text-slate-400">
                            No preset matching "{txCategory}". You can type any custom category!
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      {txType === 'income' ? 'Deposit account' : 'Payment account'}
                    </label>
                    <div className="relative min-w-0">
                      <select
                        value={txAccount || accounts[0]?.id || ''}
                        onChange={e => setTxAccount(e.target.value)}
                        className="h-10 sm:h-10.5 min-w-0 w-full appearance-none truncate rounded-xl border border-slate-200 py-0 pl-2.5 pr-8 text-xs sm:text-sm text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none cursor-pointer transition-all"
                      >
                        {accounts.length === 0 ? (
                          <option value="">Default Account (will be auto-created)</option>
                        ) : (
                          accounts.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.name} (NPR {Number(a.balance).toLocaleString('en-IN')})
                            </option>
                          ))
                        )}
                      </select>
                      <ChevronDown
                        aria-hidden="true"
                        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Note / Memo */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Note (optional)
                </label>
                <input
                  type="text"
                  value={txNote}
                  onChange={e => setTxNote(e.target.value)}
                  placeholder="Order ID, vendor details, memo..."
                  className="h-10 sm:h-10.5 w-full rounded-xl border border-slate-200 px-3 text-xs sm:text-sm text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none transition-all"
                />
              </div>

              {/* Compact Document Attach & Vault Sync: Side-by-Side (2 Columns) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                {/* Left: Compact Bill / Receipt Attachment */}
                <div className="h-10 sm:h-10.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 px-2.5 sm:px-3 flex items-center justify-between gap-2 transition-all hover:border-slate-300 dark:hover:border-slate-600">
                  <input
                    type="file"
                    className="hidden"
                    id="tx-form-file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    onChange={handleAttachTxFile}
                  />
                  <label
                    htmlFor="tx-form-file"
                    className="flex flex-1 items-center gap-2 cursor-pointer min-w-0 text-xs sm:text-[13px] font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    title={txAttachedFile ? txAttachedFile.name : 'Attach Bill'}
                  >
                    <Paperclip className="h-4 w-4 text-indigo-500 shrink-0" />
                    <span className="truncate">
                      {txAttachedFile ? txAttachedFile.name : 'Attach Bill'}
                    </span>
                  </label>
                  {txAttachedFile && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewFile({ name: txAttachedFile.name, data: txAttachedFile.data, type: txAttachedFile.type })}
                        className="p-1 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        title="View file"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setTxAttachedFile(null)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Remove file"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Right: Compact Vault Receipt Link */}
                <div className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 px-2.5 sm:px-3 transition-all ${
                  txLinkToReceipt ? 'py-2' : 'h-10 sm:h-10.5 flex items-center'
                }`}>
                  <div className="flex w-full items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => { setTxLinkToReceipt(!txLinkToReceipt); if (!txLinkToReceipt) setTxReceiptMode('link_existing'); }}
                      className="flex items-center gap-2 text-xs sm:text-[13px] font-medium text-slate-700 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer select-none transition-colors"
                    >
                      <Receipt className="h-4 w-4 text-purple-500 shrink-0" />
                      <span>Link Vault Receipt</span>
                    </button>

                    {/* Accessible Toggle Switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={txLinkToReceipt}
                      onClick={() => { setTxLinkToReceipt(!txLinkToReceipt); if (!txLinkToReceipt) setTxReceiptMode('link_existing'); }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        txLinkToReceipt ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                          txLinkToReceipt ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {txLinkToReceipt && (
                    <div className="mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
                      <select
                        value={txSelectedReceiptId}
                        onChange={e => setTxSelectedReceiptId(e.target.value)}
                        className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none cursor-pointer"
                      >
                        <option value="">-- Choose Vault Receipt --</option>
                        {receipts?.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.title} {r.amount ? `(NPR ${r.amount})` : ''} {r.fileName ? '📎' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className={`flex h-11 sm:h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-xs sm:text-sm font-semibold text-white shadow-xs active:scale-[0.99] transition-all cursor-pointer ${
                  txType === 'loan'
                    ? 'bg-teal-600 hover:bg-teal-500'
                    : txType === 'repayment'
                    ? 'bg-purple-600 hover:bg-purple-500'
                    : txType === 'investment'
                    ? 'bg-blue-600 hover:bg-blue-500'
                    : 'bg-indigo-600 hover:bg-indigo-500'
                }`}
              >
                <Plus className="h-4 w-4" />
                <span>
                  {txType === 'loan'
                    ? '+ Deposit Loan to Account & Ledger'
                    : txType === 'repayment'
                    ? '- Record Loan Repayment'
                    : txType === 'investment'
                    ? '+ Deploy Investment to Ledger'
                    : 'Commit Transaction to Ledger'}
                </span>
              </button>
            </form>
          </div>

          {/* Top Right: Operating & Cash Flow Summary (6 cols) */}
          <div className="lg:col-span-6 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800 flex justify-between items-center">
                <span>Cash Flow Statement</span>
                <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md">
                  {dateFilterMode === 'all' ? 'All-Time' : dateFilterMode === 'this_month' ? 'This Month' : dateFilterMode === 'last_30_days' ? 'Last 30 Days' : 'Custom Range'}
                </span>
              </h2>
              <div className="mt-4 space-y-2 text-xs">
                {/* 1. Operating Activities */}
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pt-1">
                  Operating Activities
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                  <span className="text-slate-500">Gross Income Received:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">+NPR {periodIncome.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                  <span className="text-slate-500">Operating Expenses Paid:</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">-NPR {periodExpense.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                  <span className="text-slate-500">Loan Interest Paid:</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">-NPR {periodInterestExpense.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40 font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Net Operating Flow:</span>
                  <span className={`font-mono font-bold ${periodOperatingFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    NPR {periodOperatingFlow.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* 2. Investing Activities */}
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pt-2">
                  Investing Activities
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40 font-semibold">
                  <span className="text-slate-500">Investments Capital Deployed:</span>
                  <span className="font-mono font-bold text-blue-600">-NPR {periodInvestmentFlow.toLocaleString('en-IN')}</span>
                </div>

                {/* 3. Savings Capital Allocation */}
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pt-2">
                  Savings & Deposit Transfers
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40 font-semibold">
                  <span className="text-slate-500">Net moved into savings:</span>
                  <span className={`font-mono font-bold ${periodSavingsFlow > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {periodSavingsFlow > 0 ? '-' : '+'}NPR {Math.abs(periodSavingsFlow).toLocaleString('en-IN')}
                  </span>
                </div>

                {/* 4. Financing Activities */}
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pt-2">
                  Financing Activities
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                  <span className="text-slate-500">Loans Borrowed / Received:</span>
                  <span className="font-mono font-bold text-teal-600 dark:text-teal-400">+NPR {periodLoanReceived.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                  <span className="text-slate-500">Loan Principal Repaid:</span>
                  <span className="font-mono font-bold text-purple-600 dark:text-purple-400">-NPR {periodRepaymentFlow.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40 font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Net Financing Flow:</span>
                  <span className={`font-mono font-bold ${periodFinancingFlow >= 0 ? 'text-teal-600' : 'text-purple-600'}`}>
                    NPR {periodFinancingFlow.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pt-2">
                  Reconciliation
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                  <span className="text-slate-500">Statement adjustments:</span>
                  <span className={`font-mono font-bold ${periodAdjustmentFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {periodAdjustmentFlow >= 0 ? '+' : '-'}NPR {Math.abs(periodAdjustmentFlow).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Total Scoped Cash Flow */}
            <div className="mt-4 pt-3 flex justify-between py-1 font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700">
              <span>Net Ledger Delta ({dateFilterMode === 'all' ? 'All-Time' : 'Selected Period'}):</span>
              <span className={`font-mono text-sm ${periodNetCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                NPR {periodNetCashFlow.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Bottom Full-Width (Single Column): Liquid Accounts Manager (12 cols) */}
          <div className="lg:col-span-12 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Accounts & Wallets ({accounts.length})
                </h2>
              </div>
              {accounts.length > 0 && (
                <button
                  type="button"
                  onClick={handleReconcileAccounts}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                    hasAnyAccountMismatch
                      ? 'border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-600/50 dark:bg-amber-950/40 dark:text-amber-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                  title="Recalculate account balances from all recorded transactions"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>{hasAnyAccountMismatch ? 'Recalculate from ledger' : 'Recheck ledger balances'}</span>
                </button>
              )}
            </div>

            {hasAnyAccountMismatch && (
              <div className="mt-3 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between">
                <span>Account and ledger totals differ. Match each account to its latest statement below, or recalculate from ledger.</span>
                <button
                  type="button"
                  onClick={handleReconcileAccounts}
                  className="font-bold underline ml-2 cursor-pointer"
                >
                  Auto-Fix Now
                </button>
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {accounts.map(a => {
                const recon = getAccountReconciliation(a);
                return (
                  <div key={a.id} className="rounded-2xl border border-slate-100 p-3.5 text-xs dark:border-slate-800 flex justify-between items-center group bg-slate-50/40 dark:bg-slate-800/30 hover:border-indigo-100 dark:hover:border-indigo-900/50 transition-colors">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{a.name}</div>
                      <div className="text-[10px] text-slate-400 capitalize mt-0.5">{a.type} account</div>
                      {recon.isMismatch && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                          Ledger expects: NPR {recon.calculatedBalance.toLocaleString('en-IN')}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setStatementAccountId(statementAccountId === a.id ? null : a.id);
                          setStatementBalance(String(Number(a.balance) || 0));
                        }}
                        className="mt-1 text-[10px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        {statementAccountId === a.id ? 'Cancel statement match' : 'Match statement'}
                      </button>
                      {statementAccountId === a.id && (
                        <form
                          className="mt-2 flex flex-wrap items-center gap-1.5"
                          onSubmit={event => {
                            event.preventDefault();
                            void handleRecordStatementBalance(a);
                          }}
                        >
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            aria-label={`Statement balance for ${a.name}`}
                            value={statementBalance}
                            onChange={event => setStatementBalance(event.target.value)}
                            className="h-7 w-28 rounded-md border border-slate-200 bg-white px-2 font-mono text-[10px] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                          <button type="submit" className="h-7 rounded-md bg-indigo-600 px-2 text-[10px] font-semibold text-white">
                            Save
                          </button>
                        </form>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="font-mono text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                          NPR {Number(a.balance).toLocaleString('en-IN')}
                        </div>
                        {recon.isMismatch && (
                          <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                            Mismatch
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ store: 'financeAccounts', id: a.id, name: a.name })}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all p-1"
                        title="Delete account"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Account Inline Form */}
            <form onSubmit={handleCreateAccount} className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 items-center">
              <input
                type="text"
                required
                placeholder="New Account Name (e.g. HDFC, Cash Vault)"
                value={acctName}
                onChange={e => setAcctName(e.target.value)}
                className="flex-1 min-w-[200px] h-9 rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-indigo-500"
              />
              <select
                value={acctType}
                onChange={e => setAcctType(e.target.value as any)}
                className="h-9 rounded-xl border border-slate-200 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
              >
                <option value="bank">Bank</option>
                <option value="cash">Cash</option>
                <option value="wallet">Wallet</option>
              </select>
              <input
                type="number"
                placeholder="Opening NPR "
                value={acctBalance}
                onChange={e => setAcctBalance(e.target.value)}
                className="w-28 h-9 rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <button
                type="submit"
                className="h-9 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-500 cursor-pointer shadow-xs active:scale-98 transition-all"
              >
                + Add Account
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab: Loans & Liabilities */}
      {activeTab === 'loans' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Forms: Create Loan, Record Payment & Add Liability */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Record EMI / Payment Form */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800 flex items-center justify-between">
                <span>Record Loan EMI / Payment</span>
              </h2>
              <form onSubmit={handleRecordLoanPayment} className="mt-4 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Select Loan ({loans.length} active)
                  </label>
                  <select
                    value={payLoanId || (loans[0]?.id ?? '')}
                    onChange={e => setPayLoanId(e.target.value)}
                    disabled={loans.length === 0}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white disabled:opacity-50"
                  >
                    {loans.length === 0 ? (
                      <option value="">No active loans registered yet</option>
                    ) : (
                      loans.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.name} — Outstanding: NPR {Number(l.outstanding).toLocaleString('en-IN')}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Amount (NPR)</label>
                    <input
                      type="number"
                      required
                      value={payAmount}
                      onChange={e => setPayAmount(e.target.value)}
                      placeholder="EMI amount"
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Pay From Account</label>
                    <select
                      value={payAcctId || (accounts[0]?.id ?? '')}
                      onChange={e => setPayAcctId(e.target.value)}
                      disabled={accounts.length === 0}
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white disabled:opacity-50"
                    >
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name} (NPR {Number(a.balance).toLocaleString('en-IN')})</option>
                      ))}
                    </select>
                  </div>
                </div>
                <details className="rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-800">
                  <summary className="cursor-pointer text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                    Enter bank's principal / interest split (optional)
                  </summary>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="text-[10px] font-medium text-slate-500">
                      Principal (NPR)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={payPrincipalInput}
                        onChange={event => setPayPrincipalInput(event.target.value)}
                        className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </label>
                    <label className="text-[10px] font-medium text-slate-500">
                      Interest (NPR)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={payInterestInput}
                        onChange={event => setPayInterestInput(event.target.value)}
                        className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </label>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">Leave both blank to use the app's estimate.</p>
                </details>
                <button
                  type="submit"
                  disabled={loans.length === 0}
                  className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                >
                  Record Loan Repayment
                </button>
              </form>
            </div>

            {/* Register Loan Liability */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
                Register New Loan
              </h2>
              <form onSubmit={handleCreateLoan} className="mt-4 space-y-3">
                {/* Strategic Goal Link Mode Selector */}
                {renderGoalModeToggle(
                  loanInputMode,
                  setLoanInputMode,
                  loanGoalId,
                  setLoanGoalId,
                  undefined,
                  'Loan goal link options'
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Loan Name</label>
                  <input
                    type="text"
                    required
                    value={loanName}
                    onChange={e => setLoanName(e.target.value)}
                    placeholder="e.g. Home Mortgage, Vehicle Loan, Student Loan"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Principal (NPR)</label>
                    <input
                      type="number"
                      required
                      value={loanPrincipal}
                      onChange={e => setLoanPrincipal(e.target.value)}
                      placeholder="100000"
                      className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Interest %</label>
                    <input
                      type="number"
                      step="0.01"
                      value={loanRate}
                      onChange={e => setLoanRate(e.target.value)}
                      className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Months</label>
                    <input
                      type="number"
                      value={loanTenure}
                      onChange={e => setLoanTenure(e.target.value)}
                      className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs leading-4 font-semibold text-slate-600 dark:text-slate-300">
                    Deposit to account (optional)
                  </label>
                  <select
                    value={loanDepositAccountId}
                    onChange={e => setLoanDepositAccountId(e.target.value)}
                    className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">No account deposit</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} (Balance: NPR {Number(a.balance).toLocaleString('en-IN')})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 cursor-pointer"
                >
                  + Add Loan to Ledger
                </button>
              </form>
            </div>

            {/* Add Other Liabilities & Payables Form */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
                Add Liability
              </h2>
              <form onSubmit={handleAddLiability} className="mt-4 space-y-3">
                {/* Strategic Goal Link Mode Selector */}
                {renderGoalModeToggle(
                  liabInputMode,
                  setLiabInputMode,
                  liabGoalId,
                  setLiabGoalId,
                  undefined,
                  'Liability goal link options'
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">How are you recording this debt?</label>
                  <select
                    value={liabRecordMode}
                    onChange={e => setLiabRecordMode(e.target.value as 'existing' | 'borrowed')}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="existing">Already owed (record balance only)</option>
                    <option value="borrowed">Borrowed now (deposit into account)</option>
                  </select>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {liabRecordMode === 'borrowed'
                      ? 'The account increases and the liability is recorded; this is not income.'
                      : 'Use this for an old debt or a bill already paid/spent; account balances stay unchanged.'}
                  </p>
                </div>
                {liabRecordMode === 'borrowed' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Deposit to account</label>
                    <select
                      required
                      value={liabDepositAccountId || accounts[0]?.id || ''}
                      onChange={e => setLiabDepositAccountId(e.target.value)}
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="" disabled>{accounts.length ? 'Select account' : 'Create an account first'}</option>
                      {accounts.map(account => (
                        <option key={account.id} value={account.id}>{account.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Liability Name</label>
                  <input
                    type="text"
                    required
                    value={liabName}
                    onChange={e => setLiabName(e.target.value)}
                    placeholder="e.g. Credit Card Balance, IOU to Partner, Vendor Dues"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Amount Due (NPR)</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={liabVal}
                      onChange={e => setLiabVal(e.target.value)}
                      placeholder="15000"
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Category</label>
                    <select
                      value={liabCategory}
                      onChange={e => setLiabCategory(e.target.value)}
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="Credit Card">Credit Card</option>
                      <option value="Personal Loan">Personal Loan</option>
                      <option value="Vendor / Invoice">Vendor / Invoice</option>
                      <option value="Taxes Due">Taxes Due</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-slate-900 dark:bg-slate-800 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 dark:hover:bg-slate-700 cursor-pointer"
                >
                {liabRecordMode === 'borrowed' ? '+ Borrow & Record Liability' : '+ Register Existing Liability'}
                </button>
              </form>
            </div>
          </div>

          {/* Right Lists: Active Loans and Other Liabilities */}
          <div className="lg:col-span-7 space-y-6">
            {/* Active Loans List with Amortization */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                <h2 className="min-w-0 text-sm font-bold text-slate-900 dark:text-white">
                  Loans ({loans.length})
                </h2>
                <span className="shrink-0 font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                  Debt NPR {totalLoanLiabilities.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {loans.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    No active loans registered in system.
                  </div>
                ) : (
                  loans.map(l => {
                    const emi = loanEmi(l.principal, l.rate, l.tenure);
                    const linkedDisbursementTx = transactions.find(t => t.linkedLoanId === l.id && t.type === 'loan');
                    const hasLinkedDisbursement = !!linkedDisbursementTx;
                    const depositedAccount = linkedDisbursementTx?.accountId ? accounts.find(a => a.id === linkedDisbursementTx.accountId) : null;
                    return (
                      <div key={l.id} className="rounded-2xl border border-slate-100 p-4 text-xs dark:border-slate-800 transition-all hover:border-slate-200 dark:hover:border-slate-700">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white text-sm flex flex-wrap items-center gap-2">
                              <span>{l.name}</span>
                              {renderGoalBadge(l.goalId)}
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                {l.rate}% p.a. · {l.tenure} mos
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1">
                              Original Principal: NPR {l.principal.toLocaleString('en-IN')}
                            </div>
                          </div>
                          <div className="text-right flex items-start gap-2">
                            <div>
                              <div className="text-[10px] uppercase font-bold text-slate-400">Outstanding</div>
                              <div className="font-mono text-base font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">
                                NPR {Number(l.outstanding).toLocaleString('en-IN')}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ store: 'loans', id: l.id, name: l.name })}
                              className="text-slate-300 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                              title="Delete loan"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Principal Disbursement Status & Action Banner */}
                        {!hasLinkedDisbursement ? (
                          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-xs dark:border-amber-900/60 dark:bg-amber-950/30">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              <div>
                                <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                  <span>Principal Not Yet Deposited in Account</span>
                                </div>
                                <p className="text-[11px] text-amber-700 dark:text-amber-300/90 mt-0.5">
                                  NPR {Number(l.principal).toLocaleString('en-IN')} is not added to your bank balance or recorded as inflow (+NPR {Number(l.principal).toLocaleString('en-IN')}) in Cash Flow.
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <select
                                  id={`loan-deposit-${l.id}`}
                                  defaultValue={accounts[0]?.id || ''}
                                  className="h-8.5 rounded-xl border border-amber-300 bg-white px-2.5 text-xs text-slate-800 dark:border-amber-800 dark:bg-slate-900 dark:text-white outline-none cursor-pointer"
                                >
                                  {accounts.map(a => (
                                    <option key={a.id} value={a.id}>
                                      {a.name} (NPR {Number(a.balance).toLocaleString('en-IN')})
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const sel = (document.getElementById(`loan-deposit-${l.id}`) as HTMLSelectElement)?.value || accounts[0]?.id;
                                    handleDepositExistingLoan(l, sel);
                                  }}
                                  className="h-8.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 font-semibold text-white text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1 shrink-0"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  <span>Deposit to Account</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 px-2.5 py-1 rounded-lg border border-teal-200 dark:border-teal-900/50 w-fit">
                            <Check className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                            <span>Principal (+NPR {Number(l.principal).toLocaleString('en-IN')}) deposited into {depositedAccount?.name || 'Bank Account'} & recorded in ledger</span>
                          </div>
                        )}

                        <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60 text-[11px]">
                          <span className="text-slate-500">Calculated Monthly EMI:</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            NPR {emi.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Other Liabilities List */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                <h2 className="min-w-0 text-sm font-bold text-slate-900 dark:text-white">
                  Other liabilities ({liabilities.length})
                </h2>
                <span className="shrink-0 font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                  Total NPR {manualLiabilitiesVal.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="mt-4 space-y-2.5">
                {liabilities.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No short-term liabilities recorded.
                  </div>
                ) : (
                  liabilities.map(l => (
                    <div key={l.id} className="rounded-2xl border border-slate-100 p-3.5 text-xs dark:border-slate-800 group">
                      <div className="flex justify-between items-center gap-3">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
                            <span>{l.name}</span>
                            {renderGoalBadge(l.goalId)}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{l.category || 'Payable / Liability'}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                            NPR {Number(l.amount).toLocaleString('en-IN')}
                          </div>
                          {Number(l.amount) > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setLiabilityRepaymentId(liabilityRepaymentId === l.id ? null : l.id);
                                setLiabilityRepaymentAmount('');
                              }}
                              className="rounded-lg border border-indigo-200 px-2 py-1 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
                            >
                              {liabilityRepaymentId === l.id ? 'Cancel' : 'Repay'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ store: 'liabilities', id: l.id, name: l.name })}
                            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all p-1"
                            title="Delete liability"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {liabilityRepaymentId === l.id && (
                        <form onSubmit={e => handleRepayLiability(e, l)} className="mt-3 grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 dark:border-slate-800 sm:grid-cols-[1fr_1.5fr_auto]">
                          <input
                            type="number"
                            min="0.01"
                            max={Number(l.amount)}
                            step="0.01"
                            required
                            value={liabilityRepaymentAmount}
                            onChange={e => setLiabilityRepaymentAmount(e.target.value)}
                            placeholder="Repayment NPR "
                            aria-label={`Repayment amount for ${l.name}`}
                            className="h-9 rounded-lg border border-slate-200 px-2.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                          <select
                            required
                            value={liabilityRepaymentAccountId || accounts[0]?.id || ''}
                            onChange={e => setLiabilityRepaymentAccountId(e.target.value)}
                            aria-label={`Pay ${l.name} from account`}
                            className="h-9 rounded-lg border border-slate-200 px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          >
                            <option value="" disabled>{accounts.length ? 'Select account' : 'Create an account first'}</option>
                            {accounts.map(account => (
                              <option key={account.id} value={account.id}>{account.name} · NPR {Number(account.balance).toLocaleString('en-IN')}</option>
                            ))}
                          </select>
                          <button type="submit" className="h-9 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-500">
                            Record payment
                          </button>
                        </form>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Loan Payment History */}
            {loanPayments.length > 0 && (
              <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
                  Recent Repayment Receipts ({loanPayments.length})
                </h2>
                <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto text-xs">
                  {[...loanPayments].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0)).map(p => (
                    <div key={p.id} className="py-2 flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">{p.loanName}</div>
                        <div className="text-[10px] text-slate-400">
                          {p.date} · Principal NPR {p.principal.toFixed(0)} + Interest NPR {p.interest.toFixed(0)}
                        </div>
                      </div>
                      <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        NPR {Number(p.amount).toLocaleString('en-IN')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Investments Portfolio */}
      {activeTab === 'investments' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Add Investment Asset
            </h2>
            <form onSubmit={handleCreateInvestment} className="mt-4 space-y-3">
              {/* Strategic Goal Link Mode Selector */}
              {renderGoalModeToggle(
                invInputMode,
                setInvInputMode,
                invGoalId,
                setInvGoalId,
                undefined,
                'Investment goal link options'
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Asset Name</label>
                <input
                  type="text"
                  required
                  value={invName}
                  onChange={e => setInvName(e.target.value)}
                  placeholder="e.g. Nifty 50 Index, Sovereign Gold, Tech Equity"
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Invested Amount (NPR)</label>
                  <input
                    type="number"
                    required
                    value={invAmount}
                    onChange={e => setInvAmount(e.target.value)}
                    placeholder="100000"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Current Value (NPR)</label>
                  <input
                    type="number"
                    value={invCurrentVal}
                    onChange={e => setInvCurrentVal(e.target.value)}
                    placeholder="115000"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Funding source
                </label>
                <select
                  value={invAccountId}
                  onChange={e => setInvAccountId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">Already invested / imported</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} (Balance: NPR {Number(a.balance).toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 cursor-pointer"
              >
                + Register Investment in Portfolio
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Investment Portfolio ({investments.length})
              </h2>
              <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                Portfolio: NPR {investmentValue.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {investments.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">No investment assets recorded yet.</div>
              ) : (
                investments.map(i => {
                  const invested = Number(i.amount) || 0;
                  const current = Number(i.currentValue ?? i.amount) || 0;
                  const gain = current - invested;
                  const roiPct = invested ? (gain / invested) * 100 : 0;
                  const linkedTx = transactions.find(t => t.linkedInvestmentId === i.id && t.type === 'investment');
                  const hasLinkedTx = !!linkedTx;
                  return (
                    <div key={i.id} className="rounded-2xl border border-slate-100 p-4 text-xs dark:border-slate-800 transition-all hover:border-slate-200 dark:hover:border-slate-700">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-sm flex flex-wrap items-center gap-2">
                            <span>{i.name}</span>
                            {renderGoalBadge(i.goalId)}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Invested: NPR {invested.toLocaleString('en-IN')} · Date: {i.date}
                          </div>
                        </div>
                        <div className="text-right flex items-start gap-3">
                          <div>
                            <div className="font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                              NPR {current.toLocaleString('en-IN')}
                            </div>
                            <div className={`font-mono text-[11px] font-bold ${gain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {gain >= 0 ? '+' : ''}NPR {gain.toLocaleString('en-IN')} ({roiPct.toFixed(1)}%)
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingInvestmentId(i.id);
                              setEditingInvestmentValue(String(i.currentValue ?? i.amount));
                            }}
                            className="text-slate-400 hover:text-indigo-600 transition-colors p-1 cursor-pointer"
                            title="Update current market value"
                            aria-label={`Update market value for ${i.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ store: 'investments', id: i.id, name: i.name })}
                            className="text-slate-300 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                            title="Delete investment"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {editingInvestmentId === i.id && (
                        <form
                          className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/20"
                          onSubmit={e => {
                            e.preventDefault();
                            void handleSaveInvestmentValue(i);
                          }}
                        >
                          <label className="min-w-36 flex-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                            Current market value (NPR)
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              required
                              value={editingInvestmentValue}
                              onChange={e => setEditingInvestmentValue(e.target.value)}
                              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            />
                          </label>
                          <button type="submit" className="h-9 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-500 cursor-pointer">
                            Save value
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingInvestmentId(null)}
                            className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </form>
                      )}

                      {!hasLinkedTx ? (
                        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-[11px]">
                          <span className="text-blue-800 dark:text-blue-300">
                            Asset not recorded in Ledger Transactions (Sub-filter currently shows 0)
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSyncExistingInvestment(i)}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer text-xs shrink-0 self-start sm:self-auto shadow-xs"
                          >
                            + Sync to Ledger
                          </button>
                        </div>
                      ) : (
                        <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-900/50 w-fit">
                          <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Logged in ledger transactions & cash flow</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Savings & Goals */}
      {activeTab === 'savings' && (
        <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {[
            { label: 'Savings Value (FD est.)', value: `NPR ${totalSavings.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, tone: 'text-indigo-600 dark:text-indigo-400' },
            { label: 'Bank Deposits (FD est.)', value: `NPR ${bankSavingsBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, tone: 'text-blue-600 dark:text-blue-400' },
            { label: 'Recorded Deposits', value: `NPR ${totalSavingsDeposited.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, tone: 'text-slate-700 dark:text-slate-200' },
            { label: 'Gross Interest', value: `NPR ${totalSavingsInterest.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, tone: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'TDS Recorded', value: `NPR ${totalSavingsTds.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, tone: 'text-amber-600 dark:text-amber-400' },
            { label: 'Service Charges', value: `NPR ${totalSavingsCharges.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, tone: 'text-rose-600 dark:text-rose-400' },
            { label: 'Penalty / Other', value: `NPR ${(totalSavingsPenalty + totalSavingsOtherDeductions).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, tone: 'text-rose-600 dark:text-rose-400' },
            { label: 'Net Interest', value: `NPR ${netSavingsInterest.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, tone: netSavingsInterest >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400' },
            { label: 'Upcoming Maturity', value: `${upcomingSavingsMaturities.length} plans`, tone: 'text-slate-700 dark:text-slate-200' },
            { label: 'Active Plans', value: `${activeSavingsPlans.length} plans`, tone: 'text-slate-700 dark:text-slate-200' }
          ].map(metric => (
            <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{metric.label}</div>
              <div className={`mt-1 truncate font-mono text-xs font-bold tabular-nums ${metric.tone}`}>{metric.value}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] dark:border-slate-800 dark:bg-slate-900">
          <span className="font-semibold text-slate-500">Recorded deposits</span>
          <span>Today <strong className="font-mono text-slate-800 dark:text-slate-200">NPR {savingsToday.toLocaleString('en-IN')}</strong></span>
          <span>This month <strong className="font-mono text-slate-800 dark:text-slate-200">NPR {savingsThisMonth.toLocaleString('en-IN')}</strong></span>
          <span>This year <strong className="font-mono text-slate-800 dark:text-slate-200">NPR {savingsThisYear.toLocaleString('en-IN')}</strong></span>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Register Savings / Deposit
            </h2>
            <form onSubmit={handleCreateSavings} className="mt-4 space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Savings category</label>
                  <div className="flex rounded-lg border border-slate-200 p-0.5 text-[10px] dark:border-slate-700">
                    {(['simple', 'bank'] as const).map(category => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => {
                          setSaveCategory(category);
                          setSaveProductType(category === 'bank' ? 'bank_savings' : 'reserve');
                        }}
                        className={`rounded-md px-2.5 py-1 font-semibold capitalize transition-colors ${
                          saveCategory === category
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                        }`}
                      >
                        {category === 'simple' ? 'Simple Savings' : 'Bank Deposits'}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Savings type</label>
                <select
                  value={saveProductType}
                  onChange={e => {
                    const product = e.target.value as SavingsProductType;
                    setSaveProductType(product);
                    if (product === 'custom_period') {
                      setSaveFrequency('custom');
                    } else if (['per_transaction', 'daily', 'weekly', 'biweekly', 'monthly', 'bimonthly', 'quarterly', 'half_yearly', 'yearly'].includes(product)) {
                      setSaveFrequency(product);
                    }
                  }}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {(saveCategory === 'simple' ? SIMPLE_SAVINGS_PRODUCTS : BANK_SAVINGS_PRODUCTS).map(product => (
                    <option key={product} value={product}>{getSavingsProductLabel(product)}</option>
                  ))}
                </select>
              </div>
              {saveCategory === 'bank' && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Bank / institution
                    <input
                      type="text"
                      value={saveBankName}
                      onChange={event => setSaveBankName(event.target.value)}
                      placeholder="Bank or cooperative"
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </label>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Branch (optional)
                    <input
                      type="text"
                      value={saveBranchName}
                      onChange={event => setSaveBranchName(event.target.value)}
                      placeholder="Branch name"
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </label>
                  <label className="col-span-2 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Account / certificate reference (optional)
                    <input
                      type="text"
                      value={saveReference}
                      onChange={event => setSaveReference(event.target.value)}
                      placeholder="Use a safe label; avoid full account numbers"
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </label>
                </div>
              )}
              {/* Strategic Goal Link Mode Selector */}
              {renderGoalModeToggle(
                saveInputMode,
                setSaveInputMode,
                saveGoalId,
                setSaveGoalId,
                undefined,
                'Savings goal link options'
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Plan Name</label>
                <input
                  type="text"
                  required
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  placeholder="e.g. New Workstation, Emergency Vault, Travel Fund"
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {saveProductType === 'fixed_deposit' ? 'FD Principal (NPR)' : 'Current Balance (NPR)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={saveCurrent}
                    onChange={e => setSaveCurrent(e.target.value)}
                    placeholder="e.g. 100000"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                {saveCategory === 'simple' ? <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Target (optional, NPR)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={saveTarget}
                    onChange={e => setSaveTarget(e.target.value)}
                    placeholder="100000"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div> : (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Annual interest rate (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      required={saveProductType === 'fixed_deposit'}
                      value={saveAnnualInterestRate}
                      onChange={e => setSaveAnnualInterestRate(e.target.value)}
                      placeholder="Enter bank's stated rate"
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                )}
              </div>
              {saveCategory === 'simple' && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Saving frequency
                    <select
                      value={saveFrequency}
                      onChange={event => {
                        const frequency = event.target.value;
                        setSaveFrequency(frequency);
                        if (SIMPLE_SAVINGS_PRODUCTS.includes(saveProductType) &&
                          ['per_transaction', 'daily', 'weekly', 'biweekly', 'monthly', 'bimonthly', 'quarterly', 'half_yearly', 'yearly', 'custom_period'].includes(saveProductType)) {
                          setSaveProductType(SIMPLE_FREQUENCY_PRODUCTS[frequency] || 'reserve');
                        }
                      }}
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="every_time">Every time / flexible</option>
                      <option value="per_transaction">Per transaction</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Every 2 weeks</option>
                      <option value="monthly">Monthly</option>
                      <option value="bimonthly">Every 2 months</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="half_yearly">Half-yearly</option>
                      <option value="yearly">Yearly</option>
                      <option value="custom">Custom period</option>
                    </select>
                  </label>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Planned contribution (NPR)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={saveContributionAmount}
                      onChange={event => setSaveContributionAmount(event.target.value)}
                      placeholder="Optional"
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </label>
                </div>
              )}
              {saveCategory === 'simple' && saveFrequency === 'custom' && (
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Custom interval (days)
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={saveCustomPeriodDays}
                    onChange={event => setSaveCustomPeriodDays(event.target.value)}
                    placeholder="e.g. 10"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </label>
              )}
              {(saveProductType === 'fixed_deposit' || saveProductType === 'recurring_deposit') && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Term (months)</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={saveMonths}
                        onChange={e => setSaveMonths(e.target.value)}
                        placeholder="60"
                        className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    {saveProductType === 'fixed_deposit' && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Compounds per year</label>
                      <select
                        value={saveCompoundingPerYear}
                        onChange={e => setSaveCompoundingPerYear(e.target.value as '1' | '2' | '4' | '12')}
                        className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        <option value="1">Annually</option>
                        <option value="2">Half-yearly</option>
                        <option value="4">Quarterly</option>
                        <option value="12">Monthly</option>
                      </select>
                    </div>
                    )}
                  </div>
                </>
              )}
              {saveCategory === 'bank' && saveProductType !== 'fixed_deposit' && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Deposit frequency
                    <select
                      value={saveFrequency}
                      onChange={event => setSaveFrequency(event.target.value)}
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="per_transaction">Per transaction</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Every 2 weeks</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="half_yearly">Half-yearly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </label>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Planned installment (NPR)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={saveContributionAmount}
                      onChange={event => setSaveContributionAmount(event.target.value)}
                      placeholder="Optional"
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </label>
                </div>
              )}
              {saveCategory === 'bank' && saveProductType === 'foreign_currency' && (
                <p className="text-[10px] text-amber-700 dark:text-amber-300">
                  Amounts are tracked in NPR. Enter the NPR equivalent; no exchange-rate conversion is applied.
                </p>
              )}
              {saveCategory === 'bank' && (
                <details className="rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
                  <summary className="cursor-pointer text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Interest, tax & charge settings
                  </summary>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                      Interest calculation
                      <select
                        value={saveInterestMethod}
                        onChange={event => setSaveInterestMethod(event.target.value as 'compound' | 'simple' | 'bank_manual')}
                        className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        <option value="bank_manual">Bank-calculated (enter actual)</option>
                        <option value="compound">Compound estimate</option>
                        <option value="simple">Simple-interest comparison</option>
                      </select>
                    </label>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                      Interest paid
                      <select
                        value={saveInterestPayoutFrequency}
                        onChange={event => setSaveInterestPayoutFrequency(event.target.value)}
                        className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        <option value="at_maturity">At maturity</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="half_yearly">Half-yearly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </label>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                      Rate effective from
                      <input
                        type="date"
                        value={saveInterestEffectiveDate}
                        onChange={event => setSaveInterestEffectiveDate(event.target.value)}
                        className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </label>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                      TDS rate (%) (manual)
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={saveTdsRate}
                        onChange={event => setSaveTdsRate(event.target.value)}
                        placeholder="Optional"
                        className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </label>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                      Service charge (NPR)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={saveServiceCharges}
                        onChange={event => setSaveServiceCharges(event.target.value)}
                        placeholder="Optional"
                        className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </label>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                      Penalty / other deduction (NPR)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={savePenalty}
                        onChange={event => setSavePenalty(event.target.value)}
                        placeholder="Optional penalty"
                        className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </label>
                    <label className="col-span-2 block text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                      Other deductions (NPR)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={saveOtherDeductions}
                        onChange={event => setSaveOtherDeductions(event.target.value)}
                        placeholder="Optional"
                        className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </label>
                    <p className="col-span-2 text-[10px] text-slate-400">
                      These are your entered terms only; no Nepal tax rate or bank rule is assumed.
                    </p>
                  </div>
                </details>
              )}
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Start / deposit date
                  <input
                    type="date"
                    value={saveStartDate}
                    onChange={event => setSaveStartDate(event.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </label>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Maturity date (optional)
                  <input
                    type="date"
                    value={saveMaturityDate}
                    onChange={event => setSaveMaturityDate(event.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </label>
              </div>
              {saveProductType === 'fixed_deposit' && Number(saveCurrent) > 0 && (
                <div className="rounded-xl bg-indigo-50 p-3 text-[10px] text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span>Compound scenario <strong>NPR {Number(fixedDepositCompoundPreview || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></span>
                    <span>Simple interest <strong>NPR {Number(fixedDepositSimplePreview || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></span>
                  </div>
                  <div className="mt-1 text-indigo-600 dark:text-indigo-300">
                    Comparison only · {saveMaturityDate || getSavingsMaturityDate(saveStartDate, Number(saveMonths) || 1)} · enter the actual bank settlement when paid
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  {saveCurrent && Number(saveCurrent) > 0 ? 'Source of starting balance' : 'Funding account'}
                </label>
                <select
                  value={saveFundingMode === 'already_funded' ? 'already-funded' : saveAccountId}
                  onChange={e => {
                    if (e.target.value === 'already-funded') {
                      setSaveFundingMode('already_funded');
                    } else {
                      setSaveFundingMode('account');
                      setSaveAccountId(e.target.value);
                    }
                  }}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="already-funded">Already funded</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} · NPR {Number(a.balance).toLocaleString('en-IN')}
                    </option>
                  ))}
                </select>
              </div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Notes (optional)
                <input
                  type="text"
                  value={saveNotes}
                  onChange={event => setSaveNotes(event.target.value)}
                  placeholder="Short note about this savings record"
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 cursor-pointer"
              >
                {`+ Record ${getSavingsProductLabel(saveProductType)}`}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              My Savings ({visibleSavingsPlans.length}{visibleSavingsPlans.length !== savingsPlans.length ? ` / ${savingsPlans.length}` : ''})
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                type="search"
                value={savingsSearch}
                onChange={event => setSavingsSearch(event.target.value)}
                placeholder="Search name, bank or reference"
                className="h-8 rounded-lg border border-slate-200 px-2.5 text-[11px] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <select
                value={savingsCategoryFilter}
                onChange={event => setSavingsCategoryFilter(event.target.value as 'all' | 'simple' | 'bank')}
                className="h-8 rounded-lg border border-slate-200 px-2 text-[11px] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="all">All savings categories</option>
                <option value="simple">Simple savings</option>
                <option value="bank">Bank deposits</option>
              </select>
              <select
                value={savingsStatusFilter}
                onChange={event => setSavingsStatusFilter(event.target.value as 'all' | 'active' | 'closed')}
                className="h-8 rounded-lg border border-slate-200 px-2 text-[11px] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="active">Active plans</option>
                <option value="closed">Closed plans</option>
                <option value="all">All statuses</option>
              </select>
            </div>
            <div className="mt-4 space-y-4">
              {visibleSavingsPlans.length === 0 ? (
                savingsPlans.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">No savings plans registered.</div>
                ) : (
                  <div className="py-12 text-center text-xs text-slate-400">No savings match these filters.</div>
                )
              ) : (
                visibleSavingsPlans.map(sp => {
                  const isFixedDeposit = sp.productType === 'fixed_deposit';
                  const isClosed = sp.status === 'closed';
                  const principal = Number(sp.currentAmount) || 0;
                  const valuation = isFixedDeposit ? getFixedDepositValue(sp) : null;
                  const target = isFixedDeposit ? (valuation?.maturityValue || 0) : (Number(sp.targetAmount) || 0);
                  const current = isFixedDeposit ? (valuation?.currentValue || 0) : principal;
                  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
                  return (
                    <div key={sp.id} className="rounded-2xl border border-slate-100 p-4 text-xs dark:border-slate-800 group">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{sp.name}</span>
                          {renderGoalBadge(sp.goalId)}
                          {isClosed && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">Closed</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                              {isFixedDeposit
                                ? `NPR ${current.toLocaleString('en-IN', { maximumFractionDigits: 2 })} est. / NPR ${target.toLocaleString('en-IN', { maximumFractionDigits: 2 })} at maturity`
                                : `NPR ${current.toLocaleString('en-IN')} · ${getSavingsProductLabel(sp.productType)}${target > 0 ? ` / NPR ${target.toLocaleString('en-IN')} target` : ''}`}
                            </div>
                            {isFixedDeposit && (
                              <div className="text-[10px] text-slate-400">
                                Principal NPR {principal.toLocaleString('en-IN')} · {sp.annualInterestRate}% p.a. · maturity {valuation?.maturityDate}
                              </div>
                            )}
                          </div>
                          {!isFixedDeposit && !isClosed && (
                            <button
                              type="button"
                              onClick={() => {
                                setDepositTargetPlan(sp);
                                setDepositAmount('');
                                setDepositNote('');
                              }}
                              className="rounded-lg bg-emerald-50 dark:bg-emerald-950/50 px-2 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors cursor-pointer flex items-center gap-1"
                              title={`Record a manual contribution to this ${getSavingsProductLabel(sp.productType).toLowerCase()}`}
                            >
                              <Plus className="h-3 w-3" />
                              <span>Deposit</span>
                            </button>
                          )}
                          {!isFixedDeposit && !isClosed && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSavingsBalanceId(editingSavingsBalanceId === sp.id ? null : sp.id);
                                setEditingSavingsBalance(String(principal));
                              }}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                              title="Enter the latest actual balance from your statement"
                            >
                              Update balance
                            </button>
                          )}
                          {current > 0 && !isClosed && (
                            <button
                              type="button"
                              onClick={() => {
                                setWithdrawalTargetPlan(sp);
                                setWithdrawalAmount('');
                                setWithdrawalIsFinalSettlement(isFixedDeposit || isBankSavingsPlan(sp));
                                setWithdrawalInterest('');
                                setWithdrawalTds('');
                                setWithdrawalServiceCharge('');
                                setWithdrawalPenalty('');
                                setWithdrawalOtherDeduction('');
                              }}
                              className="rounded-lg border border-amber-200 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950/40"
                              title="Record actual payout to an account"
                            >
                              Withdraw
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ store: 'savingsPlans', id: sp.id, name: sp.name })}
                            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all p-1"
                            title="Delete savings plan"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {editingSavingsBalanceId === sp.id && !isFixedDeposit && (
                        <form
                          className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/20"
                          onSubmit={event => void handleSaveSavingsBalance(event, sp)}
                        >
                          <label className="min-w-40 flex-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                            Actual balance (NPR)
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              required
                              value={editingSavingsBalance}
                              onChange={event => setEditingSavingsBalance(event.target.value)}
                              className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            />
                          </label>
                          <button type="submit" className="h-8 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white">
                            Save
                          </button>
                          <button type="button" onClick={() => setEditingSavingsBalanceId(null)} className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                            Cancel
                          </button>
                        </form>
                      )}
                      {isFixedDeposit && (
                        <p className="mt-2 text-[10px] text-slate-400">
                          {sp.interestMethod === 'simple' ? 'Simple-interest comparison only.' : 'Compound estimate only.'} Record the bank's actual settlement, TDS and charges when paid.
                        </p>
                      )}
                      {(isBankSavingsPlan(sp) || sp.frequency || sp.bankName) && (
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
                          {sp.bankName && <span>{sp.bankName}{sp.branchName ? ` · ${sp.branchName}` : ''}</span>}
                          {sp.reference && <span>Ref: {sp.reference}</span>}
                          {sp.frequency && <span>Frequency: {sp.frequency.replace(/_/g, ' ')}</span>}
                          {sp.contributionAmount ? <span>Planned: NPR {Number(sp.contributionAmount).toLocaleString('en-IN')}</span> : null}
                          {sp.maturityDate && <span>Matures: {sp.maturityDate}</span>}
                          {sp.annualInterestRate != null && <span>Rate: {sp.annualInterestRate}% p.a.</span>}
                        </div>
                      )}
                      {sp.notes && <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">{sp.notes}</p>}
                      {(() => {
                        const planHistory = savingsTransactions
                          .filter(transaction => transaction.linkedSavingsPlanId === sp.id)
                          .sort((left, right) => right.date.localeCompare(left.date));
                        if (!planHistory.length) return null;
                        return (
                          <details className="mt-3 border-t border-slate-100 pt-2 dark:border-slate-800">
                            <summary className="cursor-pointer text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                              Savings history ({planHistory.length})
                            </summary>
                            <div className="mt-2 space-y-1.5">
                              {planHistory.map(transaction => (
                                <div key={transaction.id} className="flex flex-wrap justify-between gap-x-3 text-[10px]">
                                  <span className="text-slate-500">{transaction.date} · {transaction.category}</span>
                                  <span className="font-mono text-slate-700 dark:text-slate-300">
                                    NPR {Number(transaction.amount).toLocaleString('en-IN')}
                                    {transaction.interest ? ` · interest ${Number(transaction.interest).toLocaleString('en-IN')}` : ''}
                                    {transaction.tds ? ` · TDS ${Number(transaction.tds).toLocaleString('en-IN')}` : ''}
                                    {transaction.serviceCharge ? ` · fee ${Number(transaction.serviceCharge).toLocaleString('en-IN')}` : ''}
                                    {transaction.penalty ? ` · penalty ${Number(transaction.penalty).toLocaleString('en-IN')}` : ''}
                                    {transaction.settlementVariance != null ? ` · variance ${Number(transaction.settlementVariance).toLocaleString('en-IN')}` : ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </details>
                        );
                      })()}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Tab: Assets & Balance Sheet */}
      {activeTab === 'balanceSheet' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Add Asset Form */}
          <div className="lg:col-span-5 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Add Fixed / Physical Asset
            </h2>
            <p className="mt-2 text-[10px] text-slate-400">
              Records a current asset value only; enter any purchase payment separately in the ledger.
            </p>
            <form onSubmit={handleAddAsset} className="mt-4 space-y-3">
              {/* Strategic Goal Link Mode Selector */}
              {renderGoalModeToggle(
                assetInputMode,
                setAssetInputMode,
                assetGoalId,
                setAssetGoalId,
                undefined,
                'Asset goal link options'
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Asset Title</label>
                <input
                  type="text"
                  required
                  value={assetName}
                  onChange={e => setAssetName(e.target.value)}
                  placeholder="e.g. Real Estate Property, Vehicle, Work Equipment"
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Estimated Market Value (NPR)</label>
                <input
                  type="number"
                  required
                  value={assetVal}
                  onChange={e => setAssetVal(e.target.value)}
                  placeholder="500000"
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 cursor-pointer"
              >
                + Register Asset on Balance Sheet
              </button>
            </form>
          </div>

          {/* Full Sovereign Balance Sheet */}
          <div className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800 flex justify-between items-center">
              <span>Sovereign Balance Sheet</span>
              <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                Net Worth: NPR {netWorth.toLocaleString('en-IN')}
              </span>
            </h2>

            <div className="space-y-4 text-xs">
              <div>
                <h3 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] mb-2">
                  Total Assets (NPR {totalAssets.toLocaleString('en-IN')})
                </h3>
                <div className="space-y-1.5 pl-2 border-l-2 border-emerald-500">
                  <div className="flex justify-between py-1 text-slate-600 dark:text-slate-400">
                    <span>Liquid Bank & Cash ({accounts.length} accounts):</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">NPR {liquidCash.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-600 dark:text-slate-400">
                    <span>Investment Portfolio ({investments.length} holdings):</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">NPR {investmentValue.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-600 dark:text-slate-400">
                    <span>Savings & Term Deposits ({savingsPlans.length} items):</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">NPR {totalSavings.toLocaleString('en-IN')}</span>
                  </div>
                  {assets.map(a => (
                    <div key={a.id} className="flex justify-between py-1 text-slate-600 dark:text-slate-400 group">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <span>• {a.name}</span>
                        {renderGoalBadge(a.goalId)}
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ store: 'assets', id: a.id, name: a.name })}
                          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 p-0.5"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">NPR {Number(a.value).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <h3 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] mb-2">
                  Total Liabilities (NPR {totalLiabilities.toLocaleString('en-IN')})
                </h3>
                <div className="space-y-1.5 pl-2 border-l-2 border-rose-500">
                  <div className="flex justify-between py-1 text-slate-600 dark:text-slate-400">
                    <span>Loan Balances ({loans.length} active):</span>
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400">NPR {totalLoanLiabilities.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-600 dark:text-slate-400">
                    <span>Other Liabilities ({liabilities.length} items):</span>
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400">NPR {manualLiabilitiesVal.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Transactions List */}
      {activeTab === 'transactions' && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Ledger Transactions ({filteredTransactions.length})
            </h2>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Search ledger..."
                value={txSearch}
                onChange={e => setTxSearch(e.target.value)}
                className="h-8 w-full sm:w-44 rounded-xl border border-slate-200 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              {/* Filter & Sort Dropdown Menu (Option A) */}
              <div className="relative" ref={filterDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsFilterDropdownOpen(prev => !prev)}
                  className={`flex items-center gap-1.5 h-8 rounded-xl border px-3 text-xs font-semibold cursor-pointer transition-colors ${
                    isFilterDropdownOpen || dateFilterMode !== 'all'
                      ? 'border-indigo-300 bg-indigo-50/80 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                  title="Filter by date and change sort order"
                >
                  <ArrowUpDown className="h-3 w-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>{txSortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {dateFilterMode === 'all'
                      ? 'All Time'
                      : dateFilterMode === 'this_month'
                      ? 'This Month'
                      : dateFilterMode === 'last_30_days'
                      ? 'Last 30 Days'
                      : 'Custom Range'}
                  </span>
                  <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isFilterDropdownOpen && (
                  <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1.5 w-64 max-w-[calc(100vw-2.5rem)] z-30 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-xl dark:border-slate-700 dark:bg-slate-900 animate-in fade-in duration-100">
                    {/* Sort Order Section */}
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Sort Order
                    </div>
                    <div className="space-y-0.5">
                      <button
                        type="button"
                        onClick={() => { setTxSortOrder('desc'); }}
                        className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                          txSortOrder === 'desc'
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span>Newest First</span>
                        {txSortOrder === 'desc' && <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setTxSortOrder('asc'); }}
                        className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                          txSortOrder === 'asc'
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span>Oldest First</span>
                        {txSortOrder === 'asc' && <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />}
                      </button>
                    </div>

                    {/* Divider */}
                    <div className="my-2 border-t border-slate-100 dark:border-slate-800" />

                    {/* Date Range Section */}
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Date Range
                    </div>
                    <div className="space-y-0.5">
                      <button
                        type="button"
                        onClick={() => { setDateFilterMode('all'); }}
                        className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                          dateFilterMode === 'all'
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span>All Time</span>
                        {dateFilterMode === 'all' && <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDateFilterMode('this_month'); }}
                        className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                          dateFilterMode === 'this_month'
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span>This Month</span>
                        {dateFilterMode === 'this_month' && <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDateFilterMode('last_30_days'); }}
                        className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                          dateFilterMode === 'last_30_days'
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span>Last 30 Days</span>
                        {dateFilterMode === 'last_30_days' && <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDateFilterMode('custom'); }}
                        className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                          dateFilterMode === 'custom'
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span>Custom Range</span>
                        {dateFilterMode === 'custom' && <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />}
                      </button>
                    </div>

                    {/* Custom Range Date Pickers */}
                    {dateFilterMode === 'custom' && (
                      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                        <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 px-1">
                          Select Date Span:
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="w-10 text-slate-400 shrink-0">From:</span>
                            <input
                              type="date"
                              value={customStartDate}
                              onChange={e => setCustomStartDate(e.target.value)}
                              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-slate-700 dark:text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="w-10 text-slate-400 shrink-0">To:</span>
                            <input
                              type="date"
                              value={customEndDate}
                              onChange={e => setCustomEndDate(e.target.value)}
                              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-slate-700 dark:text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                        {(customStartDate || customEndDate) && (
                          <div className="flex justify-end pt-0.5">
                            <button
                              type="button"
                              onClick={() => { setCustomStartDate(''); setCustomEndDate(''); }}
                              className="text-[10px] font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 cursor-pointer"
                            >
                              Clear Dates
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 h-8 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Download className="h-3 w-3" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Filter Bar: Type Filter Pills & Active Date Filter Status */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
            {/* Type Filter Pills */}
            <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
              {[
                { id: 'all', label: `All (${dateAndSearchFilteredTxs.length})` },
                { id: 'expense', label: `Expenses (${dateAndSearchFilteredTxs.filter(t => t.type === 'expense').length})` },
                { id: 'income', label: `Income (${dateAndSearchFilteredTxs.filter(t => t.type === 'income').length})` },
                { id: 'loan', label: `Loans (${dateAndSearchFilteredTxs.filter(t => t.type === 'loan').length})` },
                { id: 'transfer', label: `Transfers (${dateAndSearchFilteredTxs.filter(t => t.type === 'transfer').length})` },
                { id: 'repayment', label: `Repayments (${dateAndSearchFilteredTxs.filter(t => t.type === 'repayment').length})` },
                { id: 'investment', label: `Investments (${dateAndSearchFilteredTxs.filter(t => t.type === 'investment').length})` },
                { id: 'savings', label: `Savings deposits (${dateAndSearchFilteredTxs.filter(t => t.type === 'savings').length})` },
                { id: 'savingsWithdrawal', label: `Savings withdrawals (${dateAndSearchFilteredTxs.filter(t => t.type === 'savingsWithdrawal').length})` },
                { id: 'adjustment', label: `Adjustments (${dateAndSearchFilteredTxs.filter(t => t.type === 'adjustment').length})` }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTxTypeFilter(f.id as any)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                    txTypeFilter === f.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Active Date Filter Indicator & Quick Reset if filtered */}
            {dateFilterMode !== 'all' && (
              <div className="flex items-center gap-2 self-start lg:self-auto">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50">
                  <span>Filtered:</span>
                  <span className="font-semibold">
                    {dateFilterMode === 'this_month'
                      ? 'This Month'
                      : dateFilterMode === 'last_30_days'
                      ? 'Last 30 Days'
                      : customStartDate || customEndDate
                      ? `${customStartDate || 'Start'} to ${customEndDate || 'Now'}`
                      : 'Custom Range'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDateFilterMode('all');
                      setCustomStartDate('');
                      setCustomEndDate('');
                    }}
                    className="ml-0.5 rounded-full p-0.5 text-indigo-400 hover:bg-indigo-200 hover:text-indigo-900 dark:hover:bg-indigo-800 dark:hover:text-indigo-100 cursor-pointer"
                    title="Clear date filter"
                  >
                    ✕
                  </button>
                </span>
              </div>
            )}
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/60 max-h-[600px] overflow-y-auto">
            {filteredTransactions.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">
                No transactions match your current search or filter.
              </div>
            ) : (
              filteredTransactions.map(tx => {
                const linkedRec = tx.linkedReceiptId ? receipts.find(r => r.id === tx.linkedReceiptId) : undefined;
                const attachName = tx.fileName;
                const attachData = tx.fileData;
                const attachType = tx.fileType;

                return (
                  <div key={tx.id} className="py-3 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
                        <span>{tx.category}</span>
                        {tx.note && <span className="font-normal text-slate-500 dark:text-slate-400">({tx.note})</span>}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                        <span>{tx.date}</span>
                        <span>·</span>
                        <span className="capitalize font-medium">{tx.type}</span>
                        {tx.type === 'transfer' ? (
                          <>
                            <span>·</span>
                            <span>
                              {accounts.find(account => account.id === tx.fromAccountId)?.name || 'Unknown source'} → {accounts.find(account => account.id === tx.toAccountId)?.name || 'Unknown destination'}
                            </span>
                          </>
                        ) : tx.accountId && (
                          <>
                            <span>·</span>
                            <span className="text-slate-500">{accounts.find(a => a.id === tx.accountId)?.name || 'Unknown account'}</span>
                          </>
                        )}
                      </div>

                      {/* Attachment & Things Vault Link Badges */}
                      {(attachName || tx.linkedReceiptId) && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {attachName && attachData && (
                            <button
                              type="button"
                              onClick={() => setPreviewFile({ name: attachName, data: attachData, type: attachType })}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer transition-colors"
                              title="Click to view attached bill/receipt"
                            >
                              <Paperclip className="h-3 w-3" />
                              <span className="truncate max-w-[160px]">{attachName}</span>
                              <Eye className="h-2.5 w-2.5 opacity-70" />
                            </button>
                          )}

                          {tx.linkedReceiptId && (
                            <button
                              type="button"
                              onClick={() => onNavigate?.('things')}
                              className="inline-flex items-center gap-1 rounded-lg bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:text-purple-300 hover:underline cursor-pointer"
                              title="Open in Things & Document Vault"
                            >
                              <Receipt className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                              <span>Vault Receipt: {linkedRec?.title || 'Linked'}</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <div className="text-right">
                        <span className={`font-mono font-bold tabular-nums text-sm ${
                          tx.type === 'income'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : tx.type === 'loan'
                            ? 'text-teal-600 dark:text-teal-400'
                            : tx.type === 'expense'
                            ? 'text-rose-600 dark:text-rose-400'
                            : tx.type === 'investment'
                            ? 'text-blue-600 dark:text-blue-400'
                            : tx.type === 'savings'
                            ? 'text-amber-600 dark:text-amber-400'
                            : tx.type === 'savingsWithdrawal'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : tx.type === 'repayment'
                            ? 'text-purple-600 dark:text-purple-400'
                            : 'text-indigo-600 dark:text-indigo-400'
                        }`}>
                          {tx.ledgerOnly ? '' : tx.type === 'income' || tx.type === 'loan' || tx.type === 'savingsWithdrawal' || (tx.type === 'adjustment' && tx.adjustmentDirection === 'credit') ? '+' : tx.type === 'transfer' ? '⇄ ' : '-'}NPR {Number(tx.amount || 0).toLocaleString('en-IN')}
                        </span>
                        <div className="text-[10px] font-medium text-slate-400">
                          {tx.type === 'income' && 'Income Inflow'}
                          {tx.type === 'loan' && 'Borrowing Inflow'}
                          {tx.type === 'expense' && 'Expense Outflow'}
                          {tx.type === 'investment' && 'Capital Deployed'}
                          {tx.type === 'savings' && (tx.ledgerOnly ? 'Savings balance increase' : 'Savings deposit')}
                          {tx.type === 'savingsWithdrawal' && (tx.ledgerOnly ? 'Savings balance decrease' : 'Savings Returned to Account')}
                          {tx.type === 'repayment' && 'Debt Service'}
                          {tx.type === 'transfer' && 'Internal Transfer'}
                          {tx.type === 'adjustment' && `Statement ${tx.adjustmentDirection || 'debit'} adjustment`}
                        </div>
                      </div>
                      {(tx.type === 'income' || tx.type === 'expense' || tx.type === 'transfer') && (
                        <button
                          type="button"
                          onClick={() => startEditingTransaction(tx)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                          title="Edit transaction"
                          aria-label={`Edit ${tx.category}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ store: 'finance', id: tx.id, name: `${tx.category} (NPR ${tx.amount})` })}
                        className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors cursor-pointer"
                        title="Delete transaction record"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    </div>
                    {editingTransactionId === tx.id && (
                      <form
                        className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/20 sm:grid-cols-4"
                        onSubmit={event => void handleSaveTransactionEdit(event, tx)}
                      >
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          required
                          aria-label="Transaction amount"
                          value={editingTransactionAmount}
                          onChange={event => setEditingTransactionAmount(event.target.value)}
                          className="h-8 rounded-lg border border-slate-200 bg-white px-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                        <input
                          type="date"
                          required
                          aria-label="Transaction date"
                          value={editingTransactionDate}
                          onChange={event => setEditingTransactionDate(event.target.value)}
                          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                        {tx.type === 'transfer' ? (
                          <>
                            <select
                              aria-label="Transfer from account"
                              value={editingTransactionAccountId}
                              onChange={event => setEditingTransactionAccountId(event.target.value)}
                              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            >
                              {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
                            </select>
                            <select
                              aria-label="Transfer to account"
                              value={editingTransactionToAccountId}
                              onChange={event => setEditingTransactionToAccountId(event.target.value)}
                              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            >
                              {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
                            </select>
                          </>
                        ) : (
                          <>
                            <input
                              type="text"
                              aria-label="Transaction category"
                              value={editingTransactionCategory}
                              onChange={event => setEditingTransactionCategory(event.target.value)}
                              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            />
                            <select
                              aria-label="Transaction account"
                              value={editingTransactionAccountId}
                              onChange={event => setEditingTransactionAccountId(event.target.value)}
                              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            >
                              {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
                            </select>
                          </>
                        )}
                        <input
                          type="text"
                          aria-label="Transaction note"
                          placeholder="Note (optional)"
                          value={editingTransactionNote}
                          onChange={event => setEditingTransactionNote(event.target.value)}
                          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                        <div className="col-span-2 flex justify-end gap-2 sm:col-span-4">
                          <button type="button" onClick={() => setEditingTransactionId(null)} className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                            Cancel
                          </button>
                          <button type="submit" className="h-8 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white">
                            Save
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Confirm Deletion"
        message={deleteTarget ? `Are you sure you want to remove "${deleteTarget.name}"?` : ''}
        confirmText="Remove Record"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* BILL / RECEIPT FILE PREVIEW & DOWNLOAD MODAL */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-md">
                  {previewFile.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto my-4 flex items-center justify-center bg-slate-50 dark:bg-slate-950 rounded-2xl p-4">
              {previewFile.data.startsWith('data:image/') ? (
                <img
                  src={previewFile.data}
                  alt={previewFile.name}
                  className="max-h-[50vh] max-w-full rounded-xl object-contain shadow-xs"
                />
              ) : previewFile.data.startsWith('data:application/pdf') ? (
                <iframe
                  src={previewFile.data}
                  title={previewFile.name}
                  className="w-full h-[50vh] rounded-xl border border-slate-200 dark:border-slate-800"
                />
              ) : (
                <div className="text-center py-10 space-y-3">
                  <FileText className="h-12 w-12 mx-auto text-indigo-500" />
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    File format ready for viewing or saving to device.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
              <a
                href={previewFile.data}
                download={previewFile.name}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download File</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* SAVINGS DEPOSIT / CONTRIBUTION MODAL */}
      {depositTargetPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Record Contribution
                </h3>
                <p className="text-xs text-slate-500">
                  {depositTargetPlan.name} (Current: NPR {Number(depositTargetPlan.currentAmount).toLocaleString('en-IN')})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDepositTargetPlan(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleDepositToSavings} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Deposit Amount (NPR) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  className="mt-1 h-9.5 w-full rounded-xl border border-slate-200 px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Pay from Account
                </label>
                <select
                  required
                  value={depositAccountId}
                  onChange={e => setDepositAccountId(e.target.value)}
                  className="mt-1 h-9.5 w-full rounded-xl border border-slate-200 px-2.5 text-xs sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
                >
                  <option value="" disabled>Select source account</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} (Balance: NPR {Number(a.balance).toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Note / Memo (Optional)
                </label>
                <input
                  type="text"
                  value={depositNote}
                  onChange={e => setDepositNote(e.target.value)}
                  placeholder="Monthly deposit, bonus, etc."
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDepositTargetPlan(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 cursor-pointer"
                >
                  Deposit Funds
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {withdrawalTargetPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Withdraw Savings
                </h3>
                <p className="text-xs text-slate-500">{withdrawalTargetPlan.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setWithdrawalTargetPlan(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleWithdrawSavings} className="mt-4 space-y-3.5">
              {withdrawalTargetPlan.productType === 'fixed_deposit' && (
                <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  {withdrawalTargetPlan.interestMethod === 'simple' ? 'Simple-interest comparison' : 'Compound estimate'}: <strong>NPR {getFixedDepositValue(withdrawalTargetPlan).currentValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>. Enter the actual amount paid by the bank.
                </div>
              )}
              {isBankSavingsPlan(withdrawalTargetPlan) && (
                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={withdrawalIsFinalSettlement}
                      disabled={withdrawalTargetPlan.productType === 'fixed_deposit'}
                      onChange={event => setWithdrawalIsFinalSettlement(event.target.checked)}
                      className="accent-indigo-600"
                    />
                    Close this deposit / record final settlement
                  </label>
                  {withdrawalIsFinalSettlement && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                        Interest received (NPR)
                        <input type="number" min="0" step="0.01" value={withdrawalInterest} onChange={event => setWithdrawalInterest(event.target.value)} placeholder="0" className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                      </label>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                        TDS / tax deducted (NPR)
                        <input type="number" min="0" step="0.01" value={withdrawalTds} onChange={event => setWithdrawalTds(event.target.value)} placeholder="0" className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                      </label>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                        Service charge (NPR)
                        <input type="number" min="0" step="0.01" value={withdrawalServiceCharge} onChange={event => setWithdrawalServiceCharge(event.target.value)} placeholder="0" className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                      </label>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                        Penalty (NPR)
                        <input type="number" min="0" step="0.01" value={withdrawalPenalty} onChange={event => setWithdrawalPenalty(event.target.value)} placeholder="0" className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                      </label>
                      <label className="col-span-2 block text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                        Other deduction (NPR)
                        <input type="number" min="0" step="0.01" value={withdrawalOtherDeduction} onChange={event => setWithdrawalOtherDeduction(event.target.value)} placeholder="0" className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                      </label>
                      <div className="col-span-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        Manual net comparison: NPR {Math.max(
                          0,
                          Number(withdrawalTargetPlan.currentAmount) +
                          (Number(withdrawalInterest) || 0) -
                          (Number(withdrawalTds) || 0) -
                          (Number(withdrawalServiceCharge) || 0) -
                          (Number(withdrawalPenalty) || 0) -
                          (Number(withdrawalOtherDeduction) || 0)
                        ).toLocaleString('en-IN', { maximumFractionDigits: 2 })}. The bank's actual payout below is authoritative.
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Actual payout amount{withdrawalTargetPlan.productType !== 'fixed_deposit' && ` (available NPR ${Number(withdrawalTargetPlan.currentAmount).toLocaleString('en-IN')})`}
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={withdrawalAmount}
                  onChange={e => setWithdrawalAmount(e.target.value)}
                  className="mt-1 h-9.5 w-full rounded-xl border border-slate-200 px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              {isBankSavingsPlan(withdrawalTargetPlan) && withdrawalIsFinalSettlement && Number(withdrawalAmount) > 0 && (
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Actual payout variance vs entered breakdown: <strong className="font-mono">
                    NPR {(Number(withdrawalAmount) - Math.max(
                      0,
                      Number(withdrawalTargetPlan.currentAmount) +
                      (Number(withdrawalInterest) || 0) -
                      (Number(withdrawalTds) || 0) -
                      (Number(withdrawalServiceCharge) || 0) -
                      (Number(withdrawalPenalty) || 0) -
                      (Number(withdrawalOtherDeduction) || 0)
                    )).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </strong>
                </div>
              )}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">Deposit payout to account</label>
                <select
                  required
                  value={withdrawalAccountId || accounts[0]?.id || ''}
                  onChange={e => setWithdrawalAccountId(e.target.value)}
                  className="mt-1 h-9.5 w-full rounded-xl border border-slate-200 px-2.5 text-xs sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="" disabled>{accounts.length ? 'Select destination account' : 'Create an account first'}</option>
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>{account.name}</option>
                  ))}
                </select>
              </div>
              <p className="text-[10px] text-slate-400">
                Withdrawal reduces the tracked savings balance and credits the selected account; it is not recorded as income.
              </p>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setWithdrawalTargetPlan(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500">
                  {isBankSavingsPlan(withdrawalTargetPlan) && withdrawalIsFinalSettlement ? 'Record final settlement' : 'Record withdrawal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
