import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  DollarSign, Plus, ArrowUpRight, ArrowUpDown,
  ShieldCheck, Trash2, TrendingUp, Landmark,
  Download, Upload, Paperclip, Receipt, ExternalLink,
  FileText, X, Eye, Link2, Target, ChevronRight, ChevronDown,
  RefreshCw, AlertCircle, Check
} from 'lucide-react';
import {
  FinanceAccount, FinanceTransaction, Loan, LoanPayment,
  Investment, SavingsPlan, Asset, Liability, FinancialGoal,
  ReceiptItem, NavModule, Goal
} from '../types';
import { storage, generateUUID } from '../lib/storage';
import { ConfirmModal } from '../components/ConfirmModal';
import { SlideTabs } from '../components/SlideTabs';

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
  onNavigate?: (module: NavModule) => void;
}

const STANDARD_EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Rent & Housing',
  'Bills & Utilities',
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
  onNavigate
}) => {
  const today = new Date().toISOString().slice(0, 10);
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

  // New Loan Form
  const [loanName, setLoanName] = useState('');
  const [loanPrincipal, setLoanPrincipal] = useState('');
  const [loanRate, setLoanRate] = useState('8.5');
  const [loanTenure, setLoanTenure] = useState('60');

  // Loan Payment Form
  const [payLoanId, setPayLoanId] = useState(loans[0]?.id || '');
  const [payAmount, setPayAmount] = useState('');
  const [payAcctId, setPayAcctId] = useState(accounts[0]?.id || '');

  // New Liability Form (in Loans & Liabilities)
  const [liabName, setLiabName] = useState('');
  const [liabVal, setLiabVal] = useState('');
  const [liabCategory, setLiabCategory] = useState('Credit Card');
  const [liabDueDate, setLiabDueDate] = useState('');

  // New Investment Form
  const [invName, setInvName] = useState('');
  const [invAmount, setInvAmount] = useState('');
  const [invCurrentVal, setInvCurrentVal] = useState('');
  const [invAccountId, setInvAccountId] = useState(accounts[0]?.id || '');

  // New Loan Form Disbursal Account
  const [loanDepositAccountId, setLoanDepositAccountId] = useState(accounts[0]?.id || '');

  // New Savings Form
  const [saveName, setSaveName] = useState('');
  const [saveCurrent, setSaveCurrent] = useState('');
  const [saveTarget, setSaveTarget] = useState('');
  const [saveMonths, setSaveMonths] = useState('12');
  const [saveAccountId, setSaveAccountId] = useState(accounts[0]?.id || '');

  // Savings Deposit / Contribution Modal State
  const [depositTargetPlan, setDepositTargetPlan] = useState<SavingsPlan | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositAccountId, setDepositAccountId] = useState(accounts[0]?.id || '');
  const [depositNote, setDepositNote] = useState('');

  // Asset Form
  const [assetName, setAssetName] = useState('');
  const [assetVal, setAssetVal] = useState('');

  // Transactions Filter
  const [txSearch, setTxSearch] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'expense' | 'income' | 'loan' | 'transfer' | 'repayment' | 'investment' | 'savings'>('all');
  const [txSortOrder, setTxSortOrder] = useState<'desc' | 'asc'>('desc');
  const [dateFilterMode, setDateFilterMode] = useState<'all' | 'this_month' | 'last_30_days' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const currentYearMonth = new Date().toISOString().slice(0, 7);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
      if (!saveAccountId || !accounts.some(a => a.id === saveAccountId)) {
        setSaveAccountId(accounts[0].id);
      }
      if (!depositAccountId || !accounts.some(a => a.id === depositAccountId)) {
        setDepositAccountId(accounts[0].id);
      }
    }
  }, [accounts, txAccount, txToAccount, payAcctId, invAccountId, loanDepositAccountId, saveAccountId, depositAccountId]);

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
    else if (t.type === 'investment') investmentFlow += amt;
    else if (t.type === 'savings') savingsFlow += amt;
    else if (t.type === 'loan') loanReceived += amt;
    else if (t.type === 'repayment') repaymentFlow += amt;
  });

  const operatingCashFlow = income - expense;
  const investingCashFlow = -investmentFlow;
  const financingCashFlow = loanReceived - repaymentFlow;
  const netCashFlow = operatingCashFlow + investingCashFlow - savingsFlow + financingCashFlow;

  const liquidCash = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  const investmentValue = investments.reduce((sum, i) => sum + (Number(i.currentValue) || Number(i.amount) || 0), 0);
  const totalSavings = savingsPlans.reduce((sum, s) => sum + (Number(s.currentAmount) || 0), 0);
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
      if (t.type === 'income' || t.type === 'loan') {
        if (t.accountId === acct.id) {
          credits += amt;
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

    if (acct.openingBalance === undefined && credits === 0 && debits === 0) {
      opening = Number(acct.balance) || 0;
    }

    const calculatedBalance = opening + credits - debits;
    const currentBalance = Number(acct.balance) || 0;
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
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
          {label}
        </label>
        {/* Mode Selector: Link Goal vs Manual */}
        <div className="flex items-center rounded-lg bg-slate-200/80 p-0.5 dark:bg-slate-700/80">
          <button
            type="button"
            onClick={() => setMode('link')}
            className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer ${
              mode === 'link'
                ? 'bg-white text-indigo-600 shadow-2xs dark:bg-slate-900 dark:text-indigo-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Link2 className="h-3 w-3" />
            <span>Link Goal</span>
          </button>
          <button
            type="button"
            onClick={() => { setMode('manual'); setSelectedGoalId(''); }}
            className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer ${
              mode === 'manual'
                ? 'bg-white text-indigo-600 shadow-2xs dark:bg-slate-900 dark:text-indigo-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <span>Manual</span>
          </button>
        </div>
      </div>

      {mode === 'link' && (
        <div className="space-y-1.5 rounded-xl border border-indigo-200/80 bg-indigo-50/60 p-2.5 dark:border-indigo-900/60 dark:bg-indigo-950/30 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
              Select Target Goal (5 Branches) *
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
            <option value="">-- Choose Goal (🎯 Main, 🔹 Sub, ▫️ Micro, 🔸 Nano, ⚡ Atomic) --</option>
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
              ⚡ This financial entry is allocated directly to this goal's cash flow, debt & asset tracking!
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
    const goalInvestmentsTotal = goalInvestments.reduce((sum, i) => sum + (Number(i.currentValue || i.amount) || 0), 0);
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

    let selectedAccount = txAccount || accounts[0]?.id;
    const selectedToAccount = txToAccount || accounts[1]?.id || accounts[0]?.id;
    if (txType === 'transfer') {
      if (!selectedAccount || !selectedToAccount || selectedAccount === selectedToAccount) {
        onSuccess('Select two different accounts for a transfer.');
        return;
      }
      if (!accounts.some(a => a.id === selectedAccount) || !accounts.some(a => a.id === selectedToAccount)) return;
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
        const paid = Math.min(amt, outstanding);
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
      if (txType === 'transfer' && nextFromAccount && nextToAccount) {
        onSuccess(`₹${amt.toLocaleString('en-IN')} transferred from ${nextFromAccount.name} to ${nextToAccount.name}`);
      } else if (txType === 'income') {
        onSuccess(`✓ Income of ₹${amt.toLocaleString('en-IN')} added to account${tx.goalId ? ' & linked to Goal' : ''}`);
      } else if (txType === 'expense') {
        onSuccess(`✓ Expense of ₹${amt.toLocaleString('en-IN')} recorded & deducted${tx.goalId ? ' & linked to Goal' : ''}`);
      } else if (txType === 'loan') {
        onSuccess(`✓ Loan (+₹${amt.toLocaleString('en-IN')}) deposited into ${acct?.name || 'account'} & recorded in ledger!`);
      } else if (txType === 'repayment') {
        onSuccess(`✓ Loan payment of ₹${amt.toLocaleString('en-IN')} deducted & outstanding reduced!`);
      } else if (txType === 'investment') {
        onSuccess(`✓ Investment of ₹${amt.toLocaleString('en-IN')} logged in ledger & portfolio!`);
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
    } catch (err: any) {
      onSuccess(`Transaction could not be committed: ${err?.message || 'database error'}`);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acctName.trim()) return;
    const opening = Number(acctBalance) || 0;
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
    onSuccess(`✓ ₹${p.toLocaleString('en-IN')} deposited into "${acct.name}" & recorded in Ledger!`);
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
    if (amt <= 0) {
      onSuccess('Please enter a payment amount greater than zero.');
      return;
    }

    const outstanding = Number(loan.outstanding) || 0;
    const paid = Math.min(amt, outstanding);
    const monthlyRate = (Number(loan.rate) || 0) / 1200;
    const interest = Math.min(paid, outstanding * monthlyRate);
    const principal = Math.max(0, paid - interest);
    const now = Date.now();
    const operations: Array<{ storeName: string; item: any }> = [];

    const sourceAccountId = payAcctId || accounts[0]?.id;
    if (sourceAccountId) {
      const acct = accounts.find(a => a.id === sourceAccountId);
      if (acct) {
        operations.push({
          storeName: 'financeAccounts',
          item: {
            ...acct,
            balance: (Number(acct.balance) || 0) - paid
          }
        });
      }
    }

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
      note: `${loan.name} (Principal: ₹${principal.toFixed(0)}, Interest: ₹${interest.toFixed(0)})`,
      accountId: sourceAccountId || null,
      goalId: loan.goalId || null,
      linkedLoanId: loan.id,
      linkedLoanPaymentId: paymentId,
      createdAt: now
    };
    operations.push({ storeName: 'finance', item: tx });

    await storage.atomicPutMany(operations);
    onSuccess(`✓ Loan payment logged: Principal ₹${principal.toFixed(0)}, Interest ₹${interest.toFixed(0)}`);
    setPayAmount('');
    onRefresh();
  };

  // Add Liability (Other payables, Credit cards, Personal debts)
  const handleAddLiability = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liabName.trim() || !liabVal) return;
    const l: Liability = {
      id: generateUUID(),
      name: liabName.trim(),
      amount: Number(liabVal) || 0,
      category: liabCategory,
      dueDate: liabDueDate || undefined,
      goalId: liabInputMode === 'link' && liabGoalId ? liabGoalId : null
    };
    await storage.put('liabilities', l);
    onSuccess(`Liability "${liabName}" added${l.goalId ? ' & linked to Goal' : ''}`);
    setLiabName('');
    setLiabVal('');
    setLiabDueDate('');
    setLiabGoalId('');
    setLiabInputMode('manual');
    onRefresh();
  };

  const handleCreateInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(invAmount);
    if (!invName.trim() || amt <= 0) return;

    const invId = generateUUID();
    const inv: Investment = {
      id: invId,
      name: invName.trim(),
      amount: amt,
      currentValue: Number(invCurrentVal) || amt,
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
      goalId: inv.goalId || null,
      linkedInvestmentId: invId,
      createdAt: Date.now()
    };
    operations.push({ storeName: 'finance', item: tx });

    await storage.atomicPutMany(operations);
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
      goalId: inv.goalId || null,
      linkedInvestmentId: inv.id,
      createdAt: now
    };
    operations.push({ storeName: 'finance', item: tx });

    await storage.atomicPutMany(operations);
    onSuccess(`✓ ₹${amt.toLocaleString('en-IN')} logged in ledger for "${inv.name}"!`);
    onRefresh();
  };

  const handleCreateSavings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveName.trim()) return;

    const spId = generateUUID();
    const now = Date.now();
    const initialAmt = Number(saveCurrent) || 0;
    const targetAmt = Number(saveTarget) || 0;

    const sp: SavingsPlan = {
      id: spId,
      name: saveName.trim(),
      currentAmount: initialAmt,
      targetAmount: targetAmt,
      durationMonths: Number(saveMonths) || 12,
      goalId: saveInputMode === 'link' && saveGoalId ? saveGoalId : null,
      createdAt: now,
      updatedAt: now
    };

    const operations: Array<{ storeName: string; item: any }> = [
      { storeName: 'savingsPlans', item: sp }
    ];

    if (saveAccountId && initialAmt > 0) {
      const acct = accounts.find(a => a.id === saveAccountId);
      if (acct) {
        operations.push({
          storeName: 'financeAccounts',
          item: {
            ...acct,
            balance: (Number(acct.balance) || 0) - initialAmt
          }
        });
        const tx: FinanceTransaction = {
          id: generateUUID(),
          type: 'savings',
          amount: initialAmt,
          category: 'Savings Reserve',
          date: today,
          note: `Seed deposit for ${sp.name}`,
          accountId: saveAccountId,
          goalId: sp.goalId || null,
          linkedSavingsPlanId: spId,
          createdAt: now
        };
        operations.push({ storeName: 'finance', item: tx });
      }
    }

    await storage.atomicPutMany(operations);
    onSuccess(`Savings goal registered${saveAccountId && initialAmt > 0 ? ' & initial capital allocated' : ''}`);
    setSaveName('');
    setSaveCurrent('');
    setSaveTarget('');
    setSaveGoalId('');
    setSaveInputMode('manual');
    onRefresh();
  };

  // Contribute / Deposit Funds to an Existing Savings Plan
  const handleDepositToSavings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositTargetPlan) return;
    const amt = Number(depositAmount);
    if (!amt || amt <= 0) return;

    const now = Date.now();
    const updatedPlan: SavingsPlan = {
      ...depositTargetPlan,
      currentAmount: (Number(depositTargetPlan.currentAmount) || 0) + amt,
      updatedAt: now
    };

    const operations: Array<{ storeName: string; item: any }> = [
      { storeName: 'savingsPlans', item: updatedPlan }
    ];

    if (depositAccountId) {
      const acct = accounts.find(a => a.id === depositAccountId);
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
      type: 'savings',
      amount: amt,
      category: 'Savings Contribution',
      date: today,
      note: depositNote.trim() || `Contributed to ${depositTargetPlan.name}`,
      accountId: depositAccountId || null,
      goalId: depositTargetPlan.goalId || null,
      linkedSavingsPlanId: depositTargetPlan.id,
      createdAt: now
    };
    operations.push({ storeName: 'finance', item: tx });

    await storage.atomicPutMany(operations);
    onSuccess(`✓ ₹${amt.toLocaleString('en-IN')} deposited into "${depositTargetPlan.name}" from account`);
    setDepositTargetPlan(null);
    setDepositAmount('');
    setDepositNote('');
    onRefresh();
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetName.trim() || !assetVal) return;
    const a: Asset = {
      id: generateUUID(),
      name: assetName.trim(),
      value: Number(assetVal) || 0,
      goalId: assetInputMode === 'link' && assetGoalId ? assetGoalId : null
    };
    await storage.put('assets', a);
    onSuccess(`Asset "${assetName}" saved to balance sheet${a.goalId ? ' & linked to Goal' : ''}`);
    setAssetName('');
    setAssetVal('');
    setAssetGoalId('');
    setAssetInputMode('manual');
    onRefresh();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.store === 'finance') {
      const tx = transactions.find(t => t.id === deleteTarget.id);
      await storage.deleteFinanceTransactionWithLink(deleteTarget.id);
      if (tx?.type === 'expense' || tx?.type === 'investment') {
        onSuccess(`✓ Removed "${deleteTarget.name}" & refunded account`);
      } else if (tx?.type === 'repayment') {
        onSuccess(`✓ Removed loan payment, refunded account & restored loan principal`);
      } else if (tx?.type === 'transfer') {
        onSuccess(`✓ Removed transfer & reversed both account balances`);
      } else if (tx?.type === 'loan') {
        onSuccess(`✓ Removed loan transaction & adjusted account balance`);
      } else if (tx?.type === 'income') {
        onSuccess(`✓ Removed "${deleteTarget.name}" & adjusted account balance`);
      } else {
        onSuccess(`✓ Removed "${deleteTarget.name}"`);
      }
    } else if (deleteTarget.store === 'investments') {
      const linkedTx = transactions.find(t => t.linkedInvestmentId === deleteTarget.id);
      if (linkedTx) {
        await storage.deleteFinanceTransactionWithLink(linkedTx.id);
      }
      await storage.delete('investments', deleteTarget.id);
      onSuccess(`✓ Removed investment asset "${deleteTarget.name}" & synced ledger`);
    } else {
      await storage.delete(deleteTarget.store, deleteTarget.id);
      onSuccess(`✓ Removed "${deleteTarget.name}"`);
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
    lines.push('"Activity","Direction","Amount (INR)"');
    lines.push(`"Gross Income Received","Inflow",${periodIncome}`);
    lines.push(`"Operating Expenses Paid","Outflow",-${periodExpense}`);
    lines.push(`"Net Operating Cash Flow","Net",${periodOperatingFlow}`);
    lines.push(`"Investments Capital Deployed","Outflow",-${periodInvestmentFlow}`);
    lines.push(`"Dedicated Savings Capital Allocated","Outflow",-${periodSavingsFlow}`);
    lines.push(`"Loans Borrowed / Funds Received","Inflow",${periodLoanReceived}`);
    lines.push(`"Loan Principal & EMI Repayments","Outflow",-${periodRepaymentFlow}`);
    lines.push(`"Net Financing Cash Flow","Net",${periodFinancingFlow}`);
    lines.push(`"Net Period Cash Flow (Ledger Delta)","Total",${periodNetCashFlow}`);
    lines.push('');

    // SECTION 2: TRANSACTIONS LEDGER
    lines.push('"=== TRANSACTIONS LEDGER (FILTERED PERIOD) ==="');
    lines.push('"ID","Date","Type","Category","Amount (INR)","Note","AccountId"');
    filteredTransactions.forEach(t => {
      lines.push([
        t.id,
        t.date,
        t.type,
        `"${(t.category || '').replace(/"/g, '""')}"`,
        t.amount,
        `"${(t.note || '').replace(/"/g, '""')}"`,
        t.accountId || ''
      ].join(','));
    });
    lines.push('');

    // SECTION 3: INVESTMENT PORTFOLIO
    lines.push('"=== INVESTMENT PORTFOLIO ==="');
    lines.push('"ID","Asset Name","Invested Cost (INR)","Current Valuation (INR)","P&L / Gain (INR)","ROI %","Date"');
    investments.forEach(i => {
      const cost = Number(i.amount) || 0;
      const current = Number(i.currentValue || i.amount) || 0;
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
    lines.push('"ID","Plan Name","Current Saved (INR)","Target Amount (INR)","Progress %","Duration Months"');
    savingsPlans.forEach(s => {
      const cur = Number(s.currentAmount) || 0;
      const tgt = Number(s.targetAmount) || 1;
      const pct = Math.min(100, (cur / tgt) * 100).toFixed(1);
      lines.push([
        s.id,
        `"${(s.name || '').replace(/"/g, '""')}"`,
        cur,
        tgt,
        `${pct}%`,
        s.durationMonths || 12
      ].join(','));
    });
    lines.push('');

    // SECTION 5: LOANS & LIABILITIES
    lines.push('"=== ACTIVE LOANS & LIABILITIES ==="');
    lines.push('"ID","Liability Name","Original Principal (INR)","Outstanding Balance (INR)","Interest Rate %","Tenure Months"');
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
    lines.push('"Asset / Liability Component","Sub-Category","Amount (INR)"');
    lines.push(`"Liquid Checking & Cash","Assets",${liquidCash}`);
    lines.push(`"Investment Portfolio Market Value","Assets",${investmentValue}`);
    lines.push(`"Dedicated Savings Reserves","Assets",${totalSavings}`);
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

  // Filter transactions by date range and search/goal (used for dynamic pill counts)
  const dateAndSearchFilteredTxs = sortedTransactions.filter(t => {
    if (txGoalFilter !== 'all') {
      if (txGoalFilter === 'linked' && !t.goalId) return false;
      if (txGoalFilter === 'unlinked' && t.goalId) return false;
      if (txGoalFilter !== 'linked' && txGoalFilter !== 'unlinked' && t.goalId !== txGoalFilter) return false;
    }
    // Date Range Filtering
    if (dateFilterMode === 'this_month') {
      if (!t.date || !t.date.startsWith(currentYearMonth)) return false;
    } else if (dateFilterMode === 'last_30_days') {
      if (!t.date || t.date < thirtyDaysAgo) return false;
    } else if (dateFilterMode === 'custom') {
      if (customStartDate && t.date < customStartDate) return false;
      if (customEndDate && t.date > customEndDate) return false;
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

  // Calculate Scoped Period Cash Flow (matching the active Date Range & search filters)
  let periodIncome = 0;
  let periodExpense = 0;
  let periodInvestmentFlow = 0;
  let periodSavingsFlow = 0;
  let periodLoanReceived = 0;
  let periodRepaymentFlow = 0;

  dateAndSearchFilteredTxs.forEach(t => {
    const amt = Number(t.amount) || 0;
    if (t.type === 'income') periodIncome += amt;
    else if (t.type === 'expense') periodExpense += amt;
    else if (t.type === 'investment') periodInvestmentFlow += amt;
    else if (t.type === 'savings') periodSavingsFlow += amt;
    else if (t.type === 'loan') periodLoanReceived += amt;
    else if (t.type === 'repayment') periodRepaymentFlow += amt;
  });

  const periodOperatingFlow = periodIncome - periodExpense;
  const periodInvestingFlow = -periodInvestmentFlow;
  const periodFinancingFlow = periodLoanReceived - periodRepaymentFlow;
  const periodNetCashFlow = periodOperatingFlow + periodInvestingFlow - periodSavingsFlow + periodFinancingFlow;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            Finance & Ledger
          </h1>
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
            ₹{netWorth.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-medium truncate">
            Assets ₹{totalAssets.toLocaleString('en-IN')} - Debt ₹{totalLiabilities.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-white/[0.08] dark:bg-slate-900 min-w-0">
          <div className="flex items-center justify-between gap-1 text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider truncate">Liquid Cash</span>
            <DollarSign className="h-4 w-4 shrink-0 text-emerald-500" />
          </div>
          <div className="mt-2.5 sm:mt-3 font-mono text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums truncate">
            ₹{liquidCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-medium truncate">Across {accounts.length} bank & cash accounts</div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-white/[0.08] dark:bg-slate-900 min-w-0">
          <div className="flex items-center justify-between gap-1 text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider truncate">Investments</span>
            <TrendingUp className="h-4 w-4 shrink-0 text-blue-500" />
          </div>
          <div className="mt-2.5 sm:mt-3 font-mono text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">
            ₹{investmentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-medium truncate">{investments.length} portfolio assets</div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-white/[0.08] dark:bg-slate-900 min-w-0">
          <div className="flex items-center justify-between gap-1 text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider truncate">Total Debt</span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-rose-500" />
          </div>
          <div className="mt-2.5 sm:mt-3 font-mono text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-rose-600 dark:text-rose-400 tabular-nums truncate">
            ₹{totalLiabilities.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
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
            { id: 'savings', label: `Savings & Goals (${savingsPlans.length})`, shortLabel: `Savings (${savingsPlans.length})`, icon: ShieldCheck },
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
                  <p className="text-[11px] text-slate-400">Direct ledger entry with optional vault receipt & strategic goal sync</p>
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
                'Strategic Goal Link'
              )}

              {/* Amount & Date Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Amount (₹) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs font-semibold text-slate-400">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={txAmount}
                      onChange={e => setTxAmount(e.target.value)}
                      placeholder="0.00"
                      className="h-10 sm:h-10.5 w-full rounded-xl border border-slate-200 pl-7 pr-3 font-mono text-xs sm:text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none transition-all"
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
                        <option key={a.id} value={a.id}>{a.name} (₹{Number(a.balance).toLocaleString('en-IN')})</option>
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
                        <option key={a.id} value={a.id}>{a.name} (₹{Number(a.balance).toLocaleString('en-IN')})</option>
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
                      <span className="text-[10px] text-slate-400 font-normal">Dropdown / Type</span>
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
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      {txType === 'income' ? 'Deposit Into Account (+ Inflow)' : 'Payment / Funding Account (- Outflow)'}
                    </label>
                    <select
                      value={txAccount || accounts[0]?.id || ''}
                      onChange={e => setTxAccount(e.target.value)}
                      className="h-10 sm:h-10.5 w-full rounded-xl border border-slate-200 px-2.5 text-xs sm:text-sm text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none cursor-pointer transition-all"
                    >
                      {accounts.length === 0 ? (
                        <option value="">Default Account (will be auto-created)</option>
                      ) : (
                        accounts.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.name} (₹{Number(a.balance).toLocaleString('en-IN')})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
              )}

              {/* Note / Memo */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Note / Reference (Optional)
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
                            {r.title} {r.amount ? `(₹${r.amount})` : ''} {r.fileName ? '📎' : ''}
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
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">+₹{periodIncome.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                  <span className="text-slate-500">Operating Expenses Paid:</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">-₹{periodExpense.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40 font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Net Operating Flow:</span>
                  <span className={`font-mono font-bold ${periodOperatingFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    ₹{periodOperatingFlow.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* 2. Investing Activities */}
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pt-2">
                  Investing Activities
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40 font-semibold">
                  <span className="text-slate-500">Investments Capital Deployed:</span>
                  <span className="font-mono font-bold text-blue-600">-₹{periodInvestmentFlow.toLocaleString('en-IN')}</span>
                </div>

                {/* 3. Savings Capital Allocation */}
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pt-2">
                  Savings Capital Allocation
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40 font-semibold">
                  <span className="text-slate-500">Dedicated Savings Reserves:</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">-₹{periodSavingsFlow.toLocaleString('en-IN')}</span>
                </div>

                {/* 4. Financing Activities */}
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pt-2">
                  Financing Activities
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                  <span className="text-slate-500">Loans Borrowed / Received:</span>
                  <span className="font-mono font-bold text-teal-600 dark:text-teal-400">+₹{periodLoanReceived.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                  <span className="text-slate-500">Loan Repayments / EMI Paid:</span>
                  <span className="font-mono font-bold text-purple-600 dark:text-purple-400">-₹{periodRepaymentFlow.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40 font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Net Financing Flow:</span>
                  <span className={`font-mono font-bold ${periodFinancingFlow >= 0 ? 'text-teal-600' : 'text-purple-600'}`}>
                    ₹{periodFinancingFlow.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Total Scoped Cash Flow */}
            <div className="mt-4 pt-3 flex justify-between py-1 font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700">
              <span>Net Ledger Delta ({dateFilterMode === 'all' ? 'All-Time' : 'Selected Period'}):</span>
              <span className={`font-mono text-sm ${periodNetCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                ₹{periodNetCashFlow.toLocaleString('en-IN')}
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
                  title="Synchronize and calculate each account balance directly from your ledger transactions history"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>{hasAnyAccountMismatch ? 'Fix Calculations / Reconcile' : 'Reconcile Balances'}</span>
                </button>
              )}
            </div>

            {hasAnyAccountMismatch && (
              <div className="mt-3 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between">
                <span>Discrepancy detected: Click to synchronize account balances with ledger records.</span>
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
                          Ledger expects: ₹{recon.calculatedBalance.toLocaleString('en-IN')}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="font-mono text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                          ₹{Number(a.balance).toLocaleString('en-IN')}
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
                placeholder="Opening ₹"
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
                <span className="text-[10px] text-slate-400 font-normal">Auto-amortizes balance</span>
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
                          {l.name} — Outstanding: ₹{Number(l.outstanding).toLocaleString('en-IN')}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Amount (₹)</label>
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
                        <option key={a.id} value={a.id}>{a.name} (₹{Number(a.balance).toLocaleString('en-IN')})</option>
                      ))}
                    </select>
                  </div>
                </div>
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
                  'Link Loan to Strategic Goal'
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
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Principal (₹)</label>
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
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Deposit Loan Disbursal into Bank / Cash Account (Optional / Recommended)
                  </label>
                  <select
                    value={loanDepositAccountId}
                    onChange={e => setLoanDepositAccountId(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">-- No Account Deposit (External / Direct-to-Vendor Loan) --</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} (Balance: ₹{Number(a.balance).toLocaleString('en-IN')})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Depositing into your account adds the borrowed principal into your bank balance and prevents ledger calculation drift when paying EMIs.
                  </p>
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
                Add Other Liability / Payable
              </h2>
              <form onSubmit={handleAddLiability} className="mt-4 space-y-3">
                {/* Strategic Goal Link Mode Selector */}
                {renderGoalModeToggle(
                  liabInputMode,
                  setLiabInputMode,
                  liabGoalId,
                  setLiabGoalId,
                  undefined,
                  'Link Liability to Strategic Goal'
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
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Amount Due (₹)</label>
                    <input
                      type="number"
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
                  + Register Liability
                </button>
              </form>
            </div>
          </div>

          {/* Right Lists: Active Loans and Other Liabilities */}
          <div className="lg:col-span-7 space-y-6">
            {/* Active Loans List with Amortization */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Active Loans & Amortization ({loans.length})
                </h2>
                <span className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                  Total Debt: ₹{totalLoanLiabilities.toLocaleString('en-IN')}
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
                              Original Principal: ₹{l.principal.toLocaleString('en-IN')}
                            </div>
                          </div>
                          <div className="text-right flex items-start gap-2">
                            <div>
                              <div className="text-[10px] uppercase font-bold text-slate-400">Outstanding</div>
                              <div className="font-mono text-base font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">
                                ₹{Number(l.outstanding).toLocaleString('en-IN')}
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
                                  ₹{Number(l.principal).toLocaleString('en-IN')} is not added to your bank balance or recorded as inflow (+₹{Number(l.principal).toLocaleString('en-IN')}) in Cash Flow.
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
                                      {a.name} (₹{Number(a.balance).toLocaleString('en-IN')})
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
                            <span>Principal (+₹{Number(l.principal).toLocaleString('en-IN')}) deposited into {depositedAccount?.name || 'Bank Account'} & recorded in ledger</span>
                          </div>
                        )}

                        <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60 text-[11px]">
                          <span className="text-slate-500">Calculated Monthly EMI:</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            ₹{emi.toFixed(2)}
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
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Other Liabilities & Short-term Payables ({liabilities.length})
                </h2>
                <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                  Total: ₹{manualLiabilitiesVal.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="mt-4 space-y-2.5">
                {liabilities.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No short-term liabilities recorded.
                  </div>
                ) : (
                  liabilities.map(l => (
                    <div key={l.id} className="rounded-2xl border border-slate-100 p-3.5 text-xs dark:border-slate-800 flex justify-between items-center group">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
                          <span>{l.name}</span>
                          {renderGoalBadge(l.goalId)}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{l.category || 'Payable / Liability'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="font-mono text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                          ₹{Number(l.amount).toLocaleString('en-IN')}
                        </div>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ store: 'liabilities', id: l.id, name: l.name })}
                          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all p-1"
                          title="Settle or delete liability"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
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
                          {p.date} · Principal ₹{p.principal.toFixed(0)} + Interest ₹{p.interest.toFixed(0)}
                        </div>
                      </div>
                      <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{Number(p.amount).toLocaleString('en-IN')}
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
                'Link Investment to Strategic Goal'
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
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Invested Amount (₹)</label>
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
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Current Value (₹)</label>
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
                  Fund From Bank / Cash Account (Optional)
                </label>
                <select
                  value={invAccountId}
                  onChange={e => setInvAccountId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">-- No Account Deduction (External / Existing Asset) --</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} (Balance: ₹{Number(a.balance).toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-slate-400">
                  Selecting an account will automatically deduct the invested capital and record a linked transaction in your ledger.
                </p>
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
                Portfolio: ₹{investmentValue.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {investments.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">No investment assets recorded yet.</div>
              ) : (
                investments.map(i => {
                  const invested = Number(i.amount) || 0;
                  const current = Number(i.currentValue || i.amount) || 0;
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
                            Invested: ₹{invested.toLocaleString('en-IN')} · Date: {i.date}
                          </div>
                        </div>
                        <div className="text-right flex items-start gap-3">
                          <div>
                            <div className="font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                              ₹{current.toLocaleString('en-IN')}
                            </div>
                            <div className={`font-mono text-[11px] font-bold ${gain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {gain >= 0 ? '+' : ''}₹{gain.toLocaleString('en-IN')} ({roiPct.toFixed(1)}%)
                            </div>
                          </div>
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Create Savings Plan
            </h2>
            <form onSubmit={handleCreateSavings} className="mt-4 space-y-3">
              {/* Strategic Goal Link Mode Selector */}
              {renderGoalModeToggle(
                saveInputMode,
                setSaveInputMode,
                saveGoalId,
                setSaveGoalId,
                undefined,
                'Link Savings to Strategic Goal'
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
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Current Amount (₹)</label>
                  <input
                    type="number"
                    value={saveCurrent}
                    onChange={e => setSaveCurrent(e.target.value)}
                    placeholder="25000"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Target Amount (₹)</label>
                  <input
                    type="number"
                    required
                    value={saveTarget}
                    onChange={e => setSaveTarget(e.target.value)}
                    placeholder="100000"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Fund Opening Savings from Bank / Cash Account (Optional)
                </label>
                <select
                  value={saveAccountId}
                  onChange={e => setSaveAccountId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">-- No Account Deduction (Pre-existing Cash / External Reserve) --</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} (Balance: ₹{Number(a.balance).toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-slate-400">
                  If selected and current amount &gt; 0, capital is transferred from your bank balance into this savings reserve.
                </p>
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 cursor-pointer"
              >
                + Register Savings Plan
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Active Savings Targets ({savingsPlans.length})
            </h2>
            <div className="mt-4 space-y-4">
              {savingsPlans.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">No savings plans registered.</div>
              ) : (
                savingsPlans.map(sp => {
                  const target = Number(sp.targetAmount) || 1;
                  const current = Number(sp.currentAmount) || 0;
                  const pct = Math.min(100, (current / target) * 100);
                  return (
                    <div key={sp.id} className="rounded-2xl border border-slate-100 p-4 text-xs dark:border-slate-800 group">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{sp.name}</span>
                          {renderGoalBadge(sp.goalId)}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                            ₹{current.toLocaleString('en-IN')} / ₹{target.toLocaleString('en-IN')} ({pct.toFixed(0)}%)
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setDepositTargetPlan(sp);
                              setDepositAmount('');
                              setDepositNote('');
                            }}
                            className="rounded-lg bg-emerald-50 dark:bg-emerald-950/50 px-2 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors cursor-pointer flex items-center gap-1"
                            title="Contribute / Deposit to this savings target"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Deposit</span>
                          </button>
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
                    </div>
                  );
                })
              )}
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
            <form onSubmit={handleAddAsset} className="mt-4 space-y-3">
              {/* Strategic Goal Link Mode Selector */}
              {renderGoalModeToggle(
                assetInputMode,
                setAssetInputMode,
                assetGoalId,
                setAssetGoalId,
                undefined,
                'Link Asset to Strategic Goal'
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
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Estimated Market Value (₹)</label>
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
                Net Worth: ₹{netWorth.toLocaleString('en-IN')}
              </span>
            </h2>

            <div className="space-y-4 text-xs">
              <div>
                <h3 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] mb-2">
                  Total Assets (₹{totalAssets.toLocaleString('en-IN')})
                </h3>
                <div className="space-y-1.5 pl-2 border-l-2 border-emerald-500">
                  <div className="flex justify-between py-1 text-slate-600 dark:text-slate-400">
                    <span>Liquid Bank & Cash ({accounts.length} accounts):</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">₹{liquidCash.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-600 dark:text-slate-400">
                    <span>Investment Portfolio ({investments.length} holdings):</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">₹{investmentValue.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-600 dark:text-slate-400">
                    <span>Dedicated Savings Reserves ({savingsPlans.length} plans):</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">₹{totalSavings.toLocaleString('en-IN')}</span>
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
                      <span className="font-mono font-bold text-slate-900 dark:text-white">₹{Number(a.value).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <h3 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] mb-2">
                  Total Liabilities (₹{totalLiabilities.toLocaleString('en-IN')})
                </h3>
                <div className="space-y-1.5 pl-2 border-l-2 border-rose-500">
                  <div className="flex justify-between py-1 text-slate-600 dark:text-slate-400">
                    <span>Loan Balances ({loans.length} active):</span>
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400">₹{totalLoanLiabilities.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-600 dark:text-slate-400">
                    <span>Other Liabilities ({liabilities.length} items):</span>
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400">₹{manualLiabilitiesVal.toLocaleString('en-IN')}</span>
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
                { id: 'savings', label: `Savings (${dateAndSearchFilteredTxs.filter(t => t.type === 'savings').length})` }
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
                  <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 text-xs gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
                        <span>{tx.category}</span>
                        {tx.note && <span className="font-normal text-slate-500 dark:text-slate-400">({tx.note})</span>}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                        <span>{tx.date}</span>
                        <span>·</span>
                        <span className="capitalize font-medium">{tx.type}</span>
                        {tx.accountId && (
                          <>
                            <span>·</span>
                            <span className="text-slate-500">{accounts.find(a => a.id === tx.accountId)?.name}</span>
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
                            : tx.type === 'repayment'
                            ? 'text-purple-600 dark:text-purple-400'
                            : 'text-indigo-600 dark:text-indigo-400'
                        }`}>
                          {tx.type === 'income' || tx.type === 'loan' ? '+' : tx.type === 'transfer' ? '⇄ ' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                        </span>
                        <div className="text-[10px] font-medium text-slate-400">
                          {tx.type === 'income' && 'Income Inflow'}
                          {tx.type === 'loan' && 'Borrowing Inflow'}
                          {tx.type === 'expense' && 'Expense Outflow'}
                          {tx.type === 'investment' && 'Capital Deployed'}
                          {tx.type === 'savings' && 'Savings Reserve'}
                          {tx.type === 'repayment' && 'Debt Service'}
                          {tx.type === 'transfer' && 'Internal Transfer'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ store: 'finance', id: tx.id, name: `${tx.category} (₹${tx.amount})` })}
                        className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors cursor-pointer"
                        title="Delete transaction record"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
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
                  Contribute to Savings
                </h3>
                <p className="text-xs text-slate-500">
                  {depositTargetPlan.name} (Current: ₹{Number(depositTargetPlan.currentAmount).toLocaleString('en-IN')})
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
                  Contribution Amount (₹) <span className="text-rose-500">*</span>
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
                  Deduct from Bank / Cash Account
                </label>
                <select
                  value={depositAccountId}
                  onChange={e => setDepositAccountId(e.target.value)}
                  className="mt-1 h-9.5 w-full rounded-xl border border-slate-200 px-2.5 text-xs sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
                >
                  <option value="">-- No Account Deduction (Manual / Cash In Hand) --</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} (Balance: ₹{Number(a.balance).toLocaleString('en-IN')})
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
                  placeholder="Monthly savings, bonus deposit, etc."
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
    </div>
  );
};
