import React, { useState, useEffect } from 'react';
import {
  X, CheckSquare, FileText, BookOpen, DollarSign, Repeat
} from 'lucide-react';
import { storage, generateUUID } from '../lib/storage';
import { Task, Note, JournalEntry, FinanceTransaction, FinanceAccount, Habit } from '../types';

interface QuickCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: string;
  onSuccess: (msg: string) => void;
  onRefresh: () => void;
}

export const QuickCaptureModal: React.FC<QuickCaptureModalProps> = ({
  isOpen,
  onClose,
  initialType = 'task',
  onSuccess,
  onRefresh
}) => {
  const [activeType, setActiveType] = useState(initialType);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [amount, setAmount] = useState('');
  const [txType, setTxType] = useState<'expense' | 'income'>('expense');
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [accountId, setAccountId] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (isOpen) {
      setActiveType(initialType);
      setTitle('');
      setDetails('');
      setAmount('');
      setCategory('');
      setTxType('expense');
      storage.getAll<FinanceAccount>('financeAccounts').then(accts => {
        setAccounts(accts);
        if (accts.length > 0) setAccountId(accts[0].id);
      }).catch(() => {});
    }
  }, [isOpen, initialType]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && activeType !== 'expense') return;
    const now = Date.now();

    try {
      if (activeType === 'task') {
        const newTask: Task = {
          id: generateUUID(),
          title: title.trim(),
          description: details.trim() || undefined,
          domain: 'work',
          priority,
          dueAt: date,
          date,
          done: false,
          status: 'open',
          createdAt: now,
          updatedAt: now
        };
        await storage.put('tasks', newTask);
        onSuccess('Task captured in planner');
      } else if (activeType === 'note') {
        const newNote: Note = {
          id: generateUUID(),
          title: title.trim(),
          body: details.trim(),
          category: category.trim() || 'General',
          date,
          createdAt: now,
          updatedAt: now
        };
        await storage.put('notes', newNote);
        onSuccess('Note captured in vault');
      } else if (activeType === 'journal') {
        const newJournal: JournalEntry = {
          id: generateUUID(),
          title: title.trim() || 'Daily Reflection',
          text: details.trim(),
          mood: 'Productive',
          date,
          createdAt: now,
          updatedAt: now
        };
        await storage.put('journal', newJournal);
        onSuccess('Journal reflection captured');
      } else if (activeType === 'expense') {
        const amt = Number(amount);
        if (!amt || amt <= 0) return;
        const targetAcctId = accountId || accounts[0]?.id;
        const newTx: FinanceTransaction = {
          id: generateUUID(),
          type: txType,
          amount: amt,
          category: category.trim() || (txType === 'income' ? 'Income' : 'Daily Expense'),
          accountId: targetAcctId,
          date,
          note: title.trim() || undefined,
          createdAt: now
        };
        await storage.put('finance', newTx);
        if (targetAcctId) {
          const acct = accounts.find(a => a.id === targetAcctId);
          if (acct) {
            await storage.put('financeAccounts', {
              ...acct,
              balance: txType === 'income' ? acct.balance + amt : acct.balance - amt,
              updatedAt: now
            });
          }
        }
        onSuccess(`${txType === 'income' ? 'Income' : 'Expense'} of ₹${amt.toLocaleString('en-IN')} logged in ledger`);
      } else if (activeType === 'habit') {
        const newHabit: Habit = {
          id: generateUUID(),
          name: title.trim(),
          frequency: 'Daily',
          timesPerDay: 1,
          streak: 0,
          createdAt: now,
          updatedAt: now
        };
        await storage.put('habits', newHabit);
        onSuccess('Habit ritual created');
      }

      onRefresh();
      onClose();
    } catch (err) {
      console.error('Quick capture error', err);
    }
  };

  const captureTypes = [
    { id: 'task', label: 'Task', icon: <CheckSquare className="h-3.5 w-3.5" /> },
    { id: 'note', label: 'Note', icon: <FileText className="h-3.5 w-3.5" /> },
    { id: 'journal', label: 'Reflection', icon: <BookOpen className="h-3.5 w-3.5" /> },
    { id: 'expense', label: 'Finance', icon: <DollarSign className="h-3.5 w-3.5" /> },
    { id: 'habit', label: 'Habit', icon: <Repeat className="h-3.5 w-3.5" /> }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-100">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 font-bold text-xs">
              ⚡
            </span>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Quick Capture</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3.5 flex flex-wrap gap-1.5 border-b border-slate-100 pb-3 dark:border-slate-800">
          {captureTypes.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveType(t.id)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeType === t.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              {activeType === 'expense' ? 'Description / Payee' : 'Title'}
            </label>
            <input
              type="text"
              required={activeType !== 'expense'}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={
                activeType === 'task' ? 'e.g. Implement caching strategy' :
                activeType === 'note' ? 'e.g. System Design Principles' :
                activeType === 'journal' ? 'e.g. Breakthrough insight on focus' :
                activeType === 'expense' ? 'e.g. AWS Cloud Hosting' :
                'e.g. Cold shower & breathwork'
              }
              className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              autoFocus
            />
          </div>

          {activeType === 'expense' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Type
                  </label>
                  <select
                    value={txType}
                    onChange={e => setTxType(e.target.value as 'expense' | 'income')}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="expense">Expense (-)</option>
                    <option value="income">Income (+)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Wallet / Account
                  </label>
                  <select
                    value={accountId}
                    onChange={e => setAccountId(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name} (₹{a.balance.toLocaleString('en-IN')})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Category
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    placeholder="Tech, Food, Utilities..."
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
            </>
          )}

          {activeType === 'task' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as any)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="High">High Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="Low">Low Priority</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Due Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 font-mono text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
          )}

          {activeType === 'note' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Notebook / Category
              </label>
              <input
                type="text"
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="Philosophy, Architecture, Ideas..."
                className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          )}

          {(activeType === 'task' || activeType === 'note' || activeType === 'journal') && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Details / Notes
              </label>
              <textarea
                rows={3}
                value={details}
                onChange={e => setDetails(e.target.value)}
                placeholder="Add context or execution details here..."
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 active:scale-98 transition-transform cursor-pointer"
            >
              Capture
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
