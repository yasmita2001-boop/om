import React, { useState } from 'react';
import {
  DollarSign, Landmark, Plus, Trash2, Edit3,
  TrendingUp, Download, ShieldCheck, ArrowUpRight
} from 'lucide-react';
import {
  FinanceAccount, FinanceTransaction, Loan, Investment,
  SavingsPlan, Goal
} from '../types';
import { storage, generateUUID } from '../lib/storage';

interface FinanceViewProps {
  accounts: FinanceAccount[];
  transactions: FinanceTransaction[];
  loans: Loan[];
  investments: Investment[];
  savingsPlans: SavingsPlan[];
  goals: Goal[];
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
}

const INPUT_CLS = 'mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white';
const LABEL_CLS = 'block text-[11px] font-semibold text-slate-600 dark:text-slate-300';

export const FinanceView: React.FC<FinanceViewProps> = ({
  accounts,
  transactions,
  loans,
  investments,
  savingsPlans,
  goals,
  onRefresh,
  onSuccess
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'loans' | 'investments' | 'savings'>('overview');

  // Transaction form states
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [txType, setTxType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState('');
  const [txAccount, setTxAccount] = useState(accounts[0]?.id || '');
  const [txToAccount, setTxToAccount] = useState(accounts[1]?.id || accounts[0]?.id || '');
  const [txNote, setTxNote] = useState('');
  const [txDate, setTxDate] = useState(today);
  const [txGoalId, setTxGoalId] = useState('');

  // Account form states
  const [editingAcctId, setEditingAcctId] = useState<string | null>(null);
  const [acctName, setAcctName] = useState('');
  const [acctType, setAcctType] = useState<'bank' | 'cash' | 'wallet' | 'crypto'>('bank');
  const [acctBalance, setAcctBalance] = useState('');

  // Loan form states
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  const [loanName, setLoanName] = useState('');
  const [loanPrincipal, setLoanPrincipal] = useState('');
  const [loanOutstanding, setLoanOutstanding] = useState('');
  const [loanRate, setLoanRate] = useState('8.5');
  const [loanTenure, setLoanTenure] = useState('60');

  // Investment form states
  const [editingInvId, setEditingInvId] = useState<string | null>(null);
  const [invName, setInvName] = useState('');
  const [invAmount, setInvAmount] = useState('');
  const [invCurrentVal, setInvCurrentVal] = useState('');

  // Savings form states
  const [editingSaveId, setEditingSaveId] = useState<string | null>(null);
  const [saveName, setSaveName] = useState('');
  const [saveCurrent, setSaveCurrent] = useState('');
  const [saveTarget, setSaveTarget] = useState('');

  // Search & filter
  const [searchLedger, setSearchLedger] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income' | 'transfer'>('all');

  // Core Math
  let totalIncome = 0;
  let totalExpense = 0;
  transactions.forEach(t => {
    const amt = Number(t.amount) || 0;
    if (t.type === 'income') totalIncome += amt;
    else if (t.type === 'expense') totalExpense += amt;
  });
  const netCashFlow = totalIncome - totalExpense;
  const liquidCash = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  const totalInvestments = investments.reduce((sum, i) => sum + (Number(i.currentValue) || Number(i.amount) || 0), 0);
  const totalDebt = loans.reduce((sum, l) => sum + (Number(l.outstanding) || 0), 0);
  const netWorth = (liquidCash + totalInvestments) - totalDebt;

  const calcEmi = (p: number, r: number, n: number) => {
    if (!p || !n) return 0;
    const m = r / 1200;
    if (!m) return p / n;
    return (p * m * Math.pow(1 + m, n)) / (Math.pow(1 + m, n) - 1);
  };

  // Helper to apply or reverse account balance delta
  const adjustAccountBalances = async (
    type: 'expense' | 'income' | 'transfer',
    amount: number,
    accountId?: string | null,
    toAccountId?: string | null,
    reverse = false
  ) => {
    const sign = reverse ? -1 : 1;
    if (type === 'transfer') {
      const fromAcct = accounts.find(a => a.id === accountId);
      const toAcct = accounts.find(a => a.id === toAccountId);
      if (fromAcct && toAcct && fromAcct.id !== toAcct.id) {
        await storage.put('financeAccounts', { ...fromAcct, balance: Number(fromAcct.balance) - sign * amount });
        await storage.put('financeAccounts', { ...toAcct, balance: Number(toAcct.balance) + sign * amount });
      }
    } else {
      const acct = accounts.find(a => a.id === accountId);
      if (acct) {
        const delta = type === 'income' ? amount : -amount;
        await storage.put('financeAccounts', { ...acct, balance: Number(acct.balance) + sign * delta });
      }
    }
  };

  const resetTxForm = () => {
    setEditingTxId(null);
    setTxAmount('');
    setTxCategory('');
    setTxNote('');
    setTxDate(today);
    setTxGoalId('');
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(txAmount);
    if (!amt || amt <= 0) return;
    const targetAccountId = txAccount || accounts[0]?.id || null;

    if (txType === 'transfer' && (!targetAccountId || !txToAccount || targetAccountId === txToAccount)) {
      onSuccess('Please select two distinct accounts for transfer');
      return;
    }

    if (editingTxId) {
      const existing = transactions.find(t => t.id === editingTxId);
      if (existing) {
        await adjustAccountBalances(existing.type, Number(existing.amount), existing.accountId, existing.toAccountId, true);
      }
    }

    await adjustAccountBalances(txType, amt, targetAccountId, txType === 'transfer' ? txToAccount : null, false);

    const tx: FinanceTransaction = {
      id: editingTxId || generateUUID(),
      type: txType,
      amount: amt,
      category: txCategory.trim() || (txType === 'income' ? 'Income' : txType === 'transfer' ? 'Transfer' : 'General'),
      date: txDate,
      note: txNote.trim() || undefined,
      accountId: targetAccountId,
      toAccountId: txType === 'transfer' ? txToAccount : null,
      goalId: txGoalId || null,
      createdAt: editingTxId ? (transactions.find(t => t.id === editingTxId)?.createdAt || Date.now()) : Date.now()
    };
    await storage.put('finance', tx);
    onSuccess(editingTxId ? 'Transaction updated' : `Transaction of ₹${amt.toLocaleString('en-IN')} recorded`);
    resetTxForm();
    onRefresh();
  };

  const handleEditTransaction = (tx: FinanceTransaction) => {
    setActiveTab('overview');
    setEditingTxId(tx.id);
    setTxType(tx.type);
    setTxAmount(String(tx.amount));
    setTxCategory(tx.category || '');
    setTxAccount(tx.accountId || accounts[0]?.id || '');
    setTxToAccount(tx.toAccountId || accounts[1]?.id || accounts[0]?.id || '');
    setTxNote(tx.note || '');
    setTxDate(tx.date || today);
    setTxGoalId(tx.goalId || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteTransaction = async (id: string) => {
    const existing = transactions.find(t => t.id === id);
    if (existing) {
      await adjustAccountBalances(existing.type, Number(existing.amount), existing.accountId, existing.toAccountId, true);
    }
    await storage.delete('finance', id);
    if (editingTxId === id) resetTxForm();
    onSuccess('Transaction deleted');
    onRefresh();
  };

  // Accounts CRUD
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acctName.trim()) return;
    const balance = Number(acctBalance) || 0;
    const acct: FinanceAccount = {
      id: editingAcctId || generateUUID(),
      name: acctName.trim(),
      type: acctType,
      balance,
      createdAt: editingAcctId ? (accounts.find(a => a.id === editingAcctId)?.createdAt || Date.now()) : Date.now()
    };
    await storage.put('financeAccounts', acct);
    onSuccess(editingAcctId ? `Account "${acctName}" updated` : `Account "${acctName}" added`);
    setEditingAcctId(null);
    setAcctName('');
    setAcctBalance('');
    onRefresh();
  };

  const handleEditAccount = (a: FinanceAccount) => {
    setEditingAcctId(a.id);
    setAcctName(a.name);
    setAcctType(a.type);
    setAcctBalance(String(a.balance));
  };

  const handleDeleteAccount = async (id: string) => {
    await storage.delete('financeAccounts', id);
    if (editingAcctId === id) {
      setEditingAcctId(null);
      setAcctName('');
      setAcctBalance('');
    }
    onSuccess('Account deleted');
    onRefresh();
  };

  // Loans CRUD
  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = Number(loanPrincipal);
    if (!loanName.trim() || p <= 0) return;
    const out = loanOutstanding !== '' ? Number(loanOutstanding) : p;
    const newLoan: Loan = {
      id: editingLoanId || generateUUID(),
      name: loanName.trim(),
      principal: p,
      rate: Number(loanRate) || 0,
      tenureMonths: Number(loanTenure) || 12,
      outstanding: out,
      createdAt: editingLoanId ? (loans.find(l => l.id === editingLoanId)?.createdAt || Date.now()) : Date.now()
    };
    await storage.put('loans', newLoan);
    onSuccess(editingLoanId ? `Loan "${loanName}" updated` : `Loan "${loanName}" registered`);
    setEditingLoanId(null);
    setLoanName('');
    setLoanPrincipal('');
    setLoanOutstanding('');
    onRefresh();
  };

  const handleEditLoan = (l: Loan) => {
    setEditingLoanId(l.id);
    setLoanName(l.name);
    setLoanPrincipal(String(l.principal));
    setLoanOutstanding(String(l.outstanding));
    setLoanRate(String(l.rate));
    setLoanTenure(String(l.tenureMonths));
  };

  const handleDeleteLoan = async (id: string) => {
    await storage.delete('loans', id);
    if (editingLoanId === id) {
      setEditingLoanId(null);
      setLoanName('');
      setLoanPrincipal('');
      setLoanOutstanding('');
    }
    onSuccess('Loan deleted');
    onRefresh();
  };

  // Investments CRUD
  const handleSaveInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(invAmount);
    if (!invName.trim() || amt <= 0) return;
    const existing = editingInvId ? investments.find(i => i.id === editingInvId) : undefined;
    const newInv: Investment = {
      id: editingInvId || generateUUID(),
      name: invName.trim(),
      amount: amt,
      currentValue: Number(invCurrentVal) || amt,
      date: existing?.date || today,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    await storage.put('investments', newInv);
    onSuccess(editingInvId ? `Holding "${invName}" updated` : `Investment "${invName}" registered`);
    setEditingInvId(null);
    setInvName('');
    setInvAmount('');
    setInvCurrentVal('');
    onRefresh();
  };

  const handleEditInvestment = (i: Investment) => {
    setEditingInvId(i.id);
    setInvName(i.name);
    setInvAmount(String(i.amount));
    setInvCurrentVal(String(i.currentValue || i.amount));
  };

  const handleDeleteInvestment = async (id: string) => {
    await storage.delete('investments', id);
    if (editingInvId === id) {
      setEditingInvId(null);
      setInvName('');
      setInvAmount('');
      setInvCurrentVal('');
    }
    onSuccess('Investment holding deleted');
    onRefresh();
  };

  // Savings Plans CRUD
  const handleSaveSavings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveName.trim()) return;
    const existing = editingSaveId ? savingsPlans.find(s => s.id === editingSaveId) : undefined;
    const newPlan: SavingsPlan = {
      id: editingSaveId || generateUUID(),
      name: saveName.trim(),
      currentAmount: Number(saveCurrent) || 0,
      targetAmount: Number(saveTarget) || 0,
      createdAt: existing?.createdAt || Date.now()
    };
    await storage.put('savingsPlans', newPlan);
    onSuccess(editingSaveId ? `Savings plan "${saveName}" updated` : `Savings goal "${saveName}" registered`);
    setEditingSaveId(null);
    setSaveName('');
    setSaveCurrent('');
    setSaveTarget('');
    onRefresh();
  };

  const handleEditSavings = (sp: SavingsPlan) => {
    setEditingSaveId(sp.id);
    setSaveName(sp.name);
    setSaveCurrent(String(sp.currentAmount));
    setSaveTarget(String(sp.targetAmount));
  };

  const handleDeleteSavings = async (id: string) => {
    await storage.delete('savingsPlans', id);
    if (editingSaveId === id) {
      setEditingSaveId(null);
      setSaveName('');
      setSaveCurrent('');
      setSaveTarget('');
    }
    onSuccess('Savings target deleted');
    onRefresh();
  };

  const handleExportCSV = () => {
    if (transactions.length === 0) return;
    const headers = ['Date', 'Type', 'Category', 'Amount', 'Note'];
    const rows = transactions.map(t => [t.date, t.type, `"${t.category}"`, t.amount, `"${t.note || ''}"`]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onSuccess('Ledger exported as CSV');
  };

  const filteredTransactions = transactions.filter(t => {
    if (typeFilter !== 'all' && t.type !== typeFilter) return false;
    if (searchLedger) {
      const q = searchLedger.toLowerCase();
      return `${t.category} ${t.note || ''} ${t.type} ${t.amount}`.toLowerCase().includes(q);
    }
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              Finance & Sovereign Treasury
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Liquid accounts, double-entry cashflow ledger, loan amortization, and sovereign balance sheet.
          </p>
        </div>

        <div className="flex rounded-xl border border-slate-200 bg-slate-100/80 p-1 text-xs dark:border-slate-700 dark:bg-slate-800 shrink-0 overflow-x-auto no-scrollbar">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'ledger', label: `Ledger (${transactions.length})` },
            { id: 'loans', label: `Loans & Debt (${loans.length})` },
            { id: 'investments', label: `Portfolio (${investments.length})` },
            { id: 'savings', label: `Savings (${savingsPlans.length})` }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1 font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Financial Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          { label: 'Estimated Net Worth', val: `₹${netWorth.toLocaleString('en-IN')}`, sub: 'Assets minus total debt', cls: 'text-slate-900 dark:text-white', icon: <ShieldCheck className="h-4 w-4 text-indigo-500 shrink-0" /> },
          { label: 'Liquid Cash', val: `₹${liquidCash.toLocaleString('en-IN')}`, sub: `Across ${accounts.length} accounts`, cls: 'text-emerald-600 dark:text-emerald-400', icon: <Landmark className="h-4 w-4 text-emerald-500 shrink-0" /> },
          { label: 'Investments', val: `₹${totalInvestments.toLocaleString('en-IN')}`, sub: `${investments.length} portfolio holdings`, cls: 'text-blue-600 dark:text-blue-400', icon: <TrendingUp className="h-4 w-4 text-blue-500 shrink-0" /> },
          { label: 'Total Debt', val: `₹${totalDebt.toLocaleString('en-IN')}`, sub: `${loans.length} active loans`, cls: 'text-rose-600 dark:text-rose-400', icon: <ArrowUpRight className="h-4 w-4 text-rose-500 shrink-0" /> }
        ].map(m => (
          <div key={m.label} className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 min-w-0">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider truncate">{m.label}</span>
              {m.icon}
            </div>
            <div className={`mt-2 font-mono text-xl sm:text-2xl font-extrabold tabular-nums truncate ${m.cls}`}>{m.val}</div>
            <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Record / Edit Transaction Form (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="h-4 w-4 text-indigo-500" />
                <span>{editingTxId ? 'Edit Transaction' : 'Record Transaction'}</span>
              </h2>
              {editingTxId && (
                <button type="button" onClick={resetTxForm} className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer">
                  Cancel
                </button>
              )}
            </div>

            <form onSubmit={handleSaveTransaction} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs">
                {(['expense', 'income', 'transfer'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTxType(t)}
                    className={`py-1.5 font-semibold rounded-lg capitalize transition-all cursor-pointer ${
                      txType === t
                        ? t === 'expense' ? 'bg-white text-rose-600 shadow-2xs dark:bg-slate-700 dark:text-rose-400'
                        : t === 'income' ? 'bg-white text-emerald-600 shadow-2xs dark:bg-slate-700 dark:text-emerald-400'
                        : 'bg-white text-indigo-600 shadow-2xs dark:bg-slate-700 dark:text-indigo-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Amount (₹)</label>
                  <input type="number" step="0.01" required value={txAmount} onChange={e => setTxAmount(e.target.value)} placeholder="0.00" className={`${INPUT_CLS} font-mono`} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Date</label>
                  <input type="date" value={txDate} onChange={e => setTxDate(e.target.value)} className={`${INPUT_CLS} font-mono`} />
                </div>
              </div>

              {txType !== 'transfer' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLS}>Category</label>
                    <input type="text" required value={txCategory} onChange={e => setTxCategory(e.target.value)} placeholder={txType === 'income' ? 'Salary, Retainer...' : 'Tech, Food, Rent...'} className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Account</label>
                    <select value={txAccount || accounts[0]?.id || ''} onChange={e => setTxAccount(e.target.value)} className={`${INPUT_CLS} cursor-pointer`}>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name} (₹{Number(a.balance).toLocaleString('en-IN')})</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLS}>From Account</label>
                    <select value={txAccount || accounts[0]?.id || ''} onChange={e => setTxAccount(e.target.value)} className={`${INPUT_CLS} cursor-pointer`}>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_CLS}>To Account</label>
                    <select value={txToAccount || accounts[1]?.id || ''} onChange={e => setTxToAccount(e.target.value)} className={`${INPUT_CLS} cursor-pointer`}>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className={LABEL_CLS}>Note / Payee</label>
                <input type="text" value={txNote} onChange={e => setTxNote(e.target.value)} placeholder="Memo, invoice number, or detail..." className={INPUT_CLS} />
              </div>

              <div>
                <label className={LABEL_CLS}>Link to Goal</label>
                <select value={txGoalId} onChange={e => setTxGoalId(e.target.value)} className={`${INPUT_CLS} cursor-pointer`}>
                  <option value="">None (Independent)</option>
                  {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              </div>

              <button type="submit" className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 active:scale-98 transition-transform cursor-pointer">
                {editingTxId ? 'Update Transaction' : '+ Commit to Ledger'}
              </button>
            </form>
          </div>

          {/* Accounts & Cash Flow Summary (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-indigo-500" />
                  <span>Accounts & Treasury Wallets ({accounts.length})</span>
                </h2>
                {editingAcctId && (
                  <button
                    type="button"
                    onClick={() => { setEditingAcctId(null); setAcctName(''); setAcctBalance(''); }}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {accounts.map(a => (
                  <div
                    key={a.id}
                    className="rounded-2xl border border-slate-100 p-3.5 text-xs dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex justify-between items-center gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white truncate">{a.name}</div>
                      <div className="text-[10px] text-slate-400 capitalize mt-0.5">{a.type} account</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono text-sm font-extrabold text-slate-900 dark:text-white tabular-nums mr-1">
                        ₹{Number(a.balance).toLocaleString('en-IN')}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleEditAccount(a)}
                        className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                        title="Edit account"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAccount(a.id)}
                        className="p-1 text-slate-400 hover:text-rose-500 rounded cursor-pointer"
                        title="Delete account"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSaveAccount} className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 items-center">
                <input
                  type="text"
                  required
                  placeholder="Account Name (e.g. HDFC Reserve)"
                  value={acctName}
                  onChange={e => setAcctName(e.target.value)}
                  className="flex-1 min-w-[140px] h-8 rounded-lg border border-slate-200 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <select
                  value={acctType}
                  onChange={e => setAcctType(e.target.value as any)}
                  className="h-8 rounded-lg border border-slate-200 px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="bank">Bank</option>
                  <option value="cash">Cash</option>
                  <option value="wallet">Wallet</option>
                  <option value="crypto">Crypto</option>
                </select>
                <input
                  type="number"
                  placeholder="Balance ₹"
                  value={acctBalance}
                  onChange={e => setAcctBalance(e.target.value)}
                  className="w-24 h-8 rounded-lg border border-slate-200 px-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <button
                  type="submit"
                  className="h-8 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-500 cursor-pointer"
                >
                  {editingAcctId ? 'Update' : '+ Add'}
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
                Operating Cash Flow Statement
              </h2>
              <div className="mt-3.5 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                  <span className="text-slate-500">Total Income Inflow:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">+₹{totalIncome.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                  <span className="text-slate-500">Total Operating Expenses:</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">-₹{totalExpense.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 pt-2 font-bold text-slate-900 dark:text-white">
                  <span>Net Ledger Surplus:</span>
                  <span className={`font-mono tabular-nums ${netCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    ₹{netCashFlow.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LEDGER TRANSACTIONS */}
      {activeTab === 'ledger' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Ledger Transactions ({filteredTransactions.length})
            </h2>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search ledger..."
                value={searchLedger}
                onChange={e => setSearchLedger(e.target.value)}
                className="h-8 w-44 rounded-xl border border-slate-200 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <button
                type="button"
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 h-8 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className="flex gap-1.5">
            {[
              { id: 'all', label: 'All' },
              { id: 'expense', label: 'Expenses' },
              { id: 'income', label: 'Income' },
              { id: 'transfer', label: 'Transfers' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTypeFilter(f.id as any)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  typeFilter === f.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/60 max-h-[550px] overflow-y-auto">
            {filteredTransactions.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">No ledger transactions match this filter.</div>
            ) : (
              filteredTransactions.map(tx => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-3 text-xs transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-850/40 px-2 rounded-xl"
                >
                  <div className="min-w-0 pr-3">
                    <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{tx.category}</span>
                      {tx.note && <span className="text-slate-400 font-normal">({tx.note})</span>}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                      <span className="font-mono">{tx.date}</span>
                      <span>·</span>
                      <span className="capitalize">{tx.type}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`font-mono font-bold text-sm tabular-nums mr-1.5 ${
                      tx.type === 'income' ? 'text-emerald-600' : 'text-slate-900 dark:text-white'
                    }`}>
                      {tx.type === 'income' ? '+' : '-'} ₹{tx.amount.toLocaleString('en-IN')}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleEditTransaction(tx)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Edit transaction"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTransaction(tx.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Delete transaction"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: LOANS & DEBT */}
      {activeTab === 'loans' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {editingLoanId ? 'Edit Loan / Liability' : 'Register Loan / Liability'}
              </h2>
              {editingLoanId && (
                <button
                  type="button"
                  onClick={() => { setEditingLoanId(null); setLoanName(''); setLoanPrincipal(''); setLoanOutstanding(''); }}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
            <form onSubmit={handleSaveLoan} className="mt-4 space-y-3.5">
              <div>
                <label className={LABEL_CLS}>Loan Name</label>
                <input type="text" required value={loanName} onChange={e => setLoanName(e.target.value)} placeholder="e.g. Home Mortgage, Business Credit" className={INPUT_CLS} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Principal (₹)</label>
                  <input type="number" required value={loanPrincipal} onChange={e => setLoanPrincipal(e.target.value)} placeholder="500000" className={`${INPUT_CLS} font-mono`} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Outstanding (₹)</label>
                  <input type="number" value={loanOutstanding} onChange={e => setLoanOutstanding(e.target.value)} placeholder="Same as principal" className={`${INPUT_CLS} font-mono`} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Interest Rate (%)</label>
                  <input type="number" step="0.1" value={loanRate} onChange={e => setLoanRate(e.target.value)} className={`${INPUT_CLS} font-mono`} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Tenure (Months)</label>
                  <input type="number" value={loanTenure} onChange={e => setLoanTenure(e.target.value)} className={`${INPUT_CLS} font-mono`} />
                </div>
              </div>
              <button type="submit" className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 cursor-pointer">
                {editingLoanId ? 'Update Loan Liability' : '+ Save Loan Liability'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Active Amortization Loans ({loans.length})
            </h2>
            <div className="space-y-3">
              {loans.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">Zero active loans. You are debt-free!</div>
              ) : (
                loans.map(l => {
                  const emi = calcEmi(l.principal, l.rate, l.tenureMonths);
                  return (
                    <div key={l.id} className="rounded-2xl border border-slate-100 p-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 space-y-2.5">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-sm">{l.name}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Principal: ₹{Number(l.principal).toLocaleString('en-IN')} · {l.rate}% p.a. · {l.tenureMonths} mos
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="text-right">
                            <div className="text-[10px] uppercase font-bold text-slate-400">Outstanding</div>
                            <div className="font-mono text-base font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">
                              ₹{Number(l.outstanding).toLocaleString('en-IN')}
                            </div>
                          </div>
                          <button type="button" onClick={() => handleEditLoan(l)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg cursor-pointer" title="Edit loan">
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => handleDeleteLoan(l.id)} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg cursor-pointer" title="Delete loan">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-xl bg-white p-2.5 dark:bg-slate-800 text-[11px] border border-slate-100 dark:border-slate-700">
                        <span className="text-slate-500">Monthly Calculated EMI:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">₹{emi.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: INVESTMENTS */}
      {activeTab === 'investments' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {editingInvId ? 'Edit Investment Holding' : 'Add Investment Holding'}
              </h2>
              {editingInvId && (
                <button
                  type="button"
                  onClick={() => { setEditingInvId(null); setInvName(''); setInvAmount(''); setInvCurrentVal(''); }}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
            <form onSubmit={handleSaveInvestment} className="mt-4 space-y-3.5">
              <div>
                <label className={LABEL_CLS}>Asset / Ticker Name</label>
                <input type="text" required value={invName} onChange={e => setInvName(e.target.value)} placeholder="e.g. Nifty 50 Index Fund, Sovereign Gold" className={INPUT_CLS} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Invested Capital (₹)</label>
                  <input type="number" required value={invAmount} onChange={e => setInvAmount(e.target.value)} placeholder="100000" className={`${INPUT_CLS} font-mono`} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Current Value (₹)</label>
                  <input type="number" value={invCurrentVal} onChange={e => setInvCurrentVal(e.target.value)} placeholder="115000" className={`${INPUT_CLS} font-mono`} />
                </div>
              </div>
              <button type="submit" className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-500 cursor-pointer">
                {editingInvId ? 'Update Holding' : '+ Register Holding'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Holdings Portfolio ({investments.length})
            </h2>
            <div className="space-y-3">
              {investments.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">No investment holdings tracked yet.</div>
              ) : (
                investments.map(i => {
                  const gain = (Number(i.currentValue) || Number(i.amount)) - Number(i.amount);
                  const roiPct = Number(i.amount) > 0 ? (gain / Number(i.amount)) * 100 : 0;
                  return (
                    <div key={i.id} className="rounded-2xl border border-slate-100 p-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 flex justify-between items-center gap-3">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm">{i.name}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Cost: ₹{Number(i.amount).toLocaleString('en-IN')} · {i.date}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-right mr-1">
                          <div className="font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                            ₹{Number(i.currentValue || i.amount).toLocaleString('en-IN')}
                          </div>
                          <div className={`font-mono text-[11px] font-bold ${gain >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {gain >= 0 ? '+' : ''}₹{gain.toLocaleString('en-IN')} ({roiPct.toFixed(1)}%)
                          </div>
                        </div>
                        <button type="button" onClick={() => handleEditInvestment(i)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg cursor-pointer" title="Edit investment">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => handleDeleteInvestment(i.id)} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg cursor-pointer" title="Delete investment">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SAVINGS PLANS */}
      {activeTab === 'savings' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {editingSaveId ? 'Edit Savings Target' : 'Create Savings Target'}
              </h2>
              {editingSaveId && (
                <button
                  type="button"
                  onClick={() => { setEditingSaveId(null); setSaveName(''); setSaveCurrent(''); setSaveTarget(''); }}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
            <form onSubmit={handleSaveSavings} className="mt-4 space-y-3.5">
              <div>
                <label className={LABEL_CLS}>Plan Name</label>
                <input type="text" required value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="e.g. Sovereign Emergency Reserve" className={INPUT_CLS} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Current (₹)</label>
                  <input type="number" value={saveCurrent} onChange={e => setSaveCurrent(e.target.value)} placeholder="25000" className={`${INPUT_CLS} font-mono`} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Target (₹)</label>
                  <input type="number" required value={saveTarget} onChange={e => setSaveTarget(e.target.value)} placeholder="100000" className={`${INPUT_CLS} font-mono`} />
                </div>
              </div>
              <button type="submit" className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 cursor-pointer">
                {editingSaveId ? 'Update Savings Target' : '+ Register Savings Goal'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Active Targets ({savingsPlans.length})
            </h2>
            <div className="space-y-4">
              {savingsPlans.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">No active savings targets configured.</div>
              ) : (
                savingsPlans.map(sp => {
                  const target = Number(sp.targetAmount) || 1;
                  const current = Number(sp.currentAmount) || 0;
                  const pct = Math.min(100, Math.round((current / target) * 100));
                  return (
                    <div key={sp.id} className="rounded-2xl border border-slate-100 p-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 space-y-2.5">
                      <div className="flex justify-between items-center gap-2 text-xs">
                        <span className="font-bold text-slate-900 dark:text-white">{sp.name}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 mr-1">
                            ₹{current.toLocaleString('en-IN')} / ₹{target.toLocaleString('en-IN')} ({pct}%)
                          </span>
                          <button type="button" onClick={() => handleEditSavings(sp)} className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer" title="Edit savings goal">
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => handleDeleteSavings(sp.id)} className="p-1 text-slate-400 hover:text-rose-500 rounded cursor-pointer" title="Delete savings goal">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div className="h-full bg-indigo-600 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
