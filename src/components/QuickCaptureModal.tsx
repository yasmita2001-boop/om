import { getCurrencySymbol } from '../lib/currencyDisplay';
import { ThemedDateTimeInput } from './ThemedDateTimeInput';
import React, { useState } from 'react';
import {
  X, CheckSquare, FileText, BookOpen, DollarSign, Target, Bell, User, Volume2,
  Repeat, Clock, Heart, Briefcase, GraduationCap, Zap
} from 'lucide-react';
import { storage, generateUUID } from '../lib/storage';
import { getLocalDateString } from '../lib/dateUtils';
import { plainTextToHtml } from '../lib/sanitizeHtml';
import { Task, TaskDomain, Note, JournalEntry, FinanceTransaction, FinanceAccount, Goal, ReminderItem, Person } from '../types';
import { AttachmentUploader, StoredAttachmentMeta } from './AttachmentUploader';
import { alarmAudio, BUILTIN_RINGTONES } from '../lib/alarmAudio';
import { ThemeIcon } from './ThemeIcon';

interface QuickCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: string;
  onSuccess: (msg: string) => void;
  reloadAll: () => void;
}

export const QuickCaptureModal: React.FC<QuickCaptureModalProps> = ({
  isOpen,
  onClose,
  initialType = 'task',
  onSuccess,
  reloadAll
}) => {
  const [activeType, setActiveType] = useState(initialType);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [domain, setDomain] = useState<TaskDomain>('personal');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [date, setDate] = useState(() => getLocalDateString());
  const [taskHasDueDate, setTaskHasDueDate] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [reminderTime, setReminderTime] = useState(() => {
    const d = new Date(Date.now() + 30 * 60 * 1000);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [reminderRingtone, setReminderRingtone] = useState(alarmAudio.getDefaultRingtoneId());
  const [attachments, setAttachments] = useState<StoredAttachmentMeta[]>([]);
  const [financeAccounts, setFinanceAccounts] = useState<FinanceAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [formError, setFormError] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setActiveType(initialType);
      setTitle('');
      setDetails('');
      setAmount('');
      setCategory('');
      setDomain('personal');
      setPriority('Medium');
      setDate(getLocalDateString());
      setTaskHasDueDate(false);
      const nextReminder = new Date(Date.now() + 30 * 60 * 1000);
      setReminderTime(`${String(nextReminder.getHours()).padStart(2, '0')}:${String(nextReminder.getMinutes()).padStart(2, '0')}`);
      setAlarmEnabled(true);
      setReminderRingtone(alarmAudio.getDefaultRingtoneId());
      setAttachments([]);
      setFormError('');
      storage.getAll<FinanceAccount>('financeAccounts').then(accts => {
        setFinanceAccounts(accts || []);
        if (accts && accts.length > 0) {
          setSelectedAccountId(accts[0].id);
        } else {
          setSelectedAccountId('');
        }
      });
    }
  }, [isOpen, initialType]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const loadCategories = async () => {
      let opts: string[] = [];
      if (activeType === 'expense') {
        const txns = await storage.getAll<any>('finance');
        const cats = new Set(txns.map((t: any) => t.category).filter(Boolean));
        opts = [...cats].sort();
      } else if (activeType === 'note') {
        const notes = await storage.getAll<any>('notes');
        const cats = new Set(notes.map((n: any) => n.category).filter(Boolean));
        opts = [...cats].sort();
      } else if (activeType === 'health') {
        opts = ['General', 'Medication', 'Symptoms', 'Diet', 'Exercise', 'Mental Health', 'Sleep', 'Vitals'];
      } else if (activeType === 'habit') {
        opts = ['Health', 'Fitness', 'Mindfulness', 'Productivity', 'Learning', 'Social', 'Finance'];
      } else if (activeType === 'person') {
        opts = ['Friend', 'Family', 'Colleague', 'Client', 'Mentor', 'Neighbor'];
      }
      if (!cancelled) setCategoryOptions(opts);
    };
    loadCategories();
    return () => { cancelled = true; };
  }, [isOpen, activeType]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && activeType !== 'expense') return;

    setFormError('');
    const now = Date.now();
    try {
      if (activeType === 'task') {
        const newTask: Task = {
          id: generateUUID(),
          title: title.trim(),
          description: details.trim() || undefined,
          domain,
          priority,
          ...(taskHasDueDate && date ? { dueAt: date, date } : {}),
          done: false,
          status: 'open',
          createdAt: now,
          updatedAt: now
        };
        await storage.put('tasks', newTask);
        onSuccess('✓ Task captured successfully');
      } else if (activeType === 'note') {
        const serializedAttachments = attachments.map(a => JSON.stringify(a));
        const newNote: Note = {
          id: generateUUID(),
          title: title.trim(),
          body: details.trim(),
          html: `<p>${plainTextToHtml(details.trim())}</p>`,
          category: category.trim() || 'General',
          attachments: serializedAttachments.length > 0 ? serializedAttachments : undefined,
          date,
          createdAt: now,
          updatedAt: now
        };
        await storage.put('notes', newNote);
        onSuccess('Memo captured successfully');
      } else if (activeType === 'journal') {
        const serializedAttachments = attachments.map(a => JSON.stringify(a));
        const newJournal: JournalEntry = {
          id: generateUUID(),
          title: title.trim() || 'Daily Reflection',
          text: details.trim(),
          html: `<p>${plainTextToHtml(details.trim())}</p>`,
          attachments: serializedAttachments.length > 0 ? serializedAttachments : undefined,
          date,
          createdAt: now,
          updatedAt: now
        };
        await storage.put('journal', newJournal);
        onSuccess('Journal entry captured');
      } else if (activeType === 'expense') {
        const amt = Number(amount);
        if (!Number.isFinite(amt) || amt <= 0) {
          setFormError('Enter an expense amount greater than zero.');
          return;
        }

        let targetAcct = financeAccounts.find(a => a.id === selectedAccountId) || financeAccounts[0];
        const ops: Array<{ storeName: string; item: any }> = [];

        if (!targetAcct && financeAccounts.length === 0) {
          const initialAcct: FinanceAccount = {
            id: generateUUID(),
            name: 'Main Bank Account',
            type: 'bank',
            balance: 0,
            openingBalance: 0,
            createdAt: now
          };
          targetAcct = initialAcct;
        }

        if (targetAcct) {
          const newBal = (Number(targetAcct.balance) || 0) - amt;
          ops.push({
            storeName: 'financeAccounts',
            item: { ...targetAcct, balance: newBal }
          });
        }

        const newTx: FinanceTransaction = {
          id: generateUUID(),
          type: 'expense',
          amount: amt,
          category: category.trim() || 'Daily Expense',
          date,
          note: title.trim() || undefined,
          accountId: targetAcct?.id || null,
          createdAt: now
        };
        ops.push({
          storeName: 'finance',
          item: newTx
        });

        await storage.atomicPutMany(ops);
        onSuccess(`Expense of ${getCurrencySymbol()} ${amt.toLocaleString('en-IN')} logged & deducted from ${targetAcct?.name || 'account'}`);
      } else if (activeType === 'goal') {
        const newGoal: Goal = {
          id: generateUUID(),
          title: title.trim(),
          progress: 0,
          targetDate: date,
          status: 'active',
          createdAt: now,
          updatedAt: now
        };
        await storage.put('goals', newGoal);
        onSuccess('Strategic goal captured');
      } else if (activeType === 'reminder') {
        const fullDue = `${date}T${reminderTime}`;
        const newRem: ReminderItem = {
          id: generateUUID(),
          title: title.trim(),
          dueAt: fullDue,
          repeatRule: 'none',
          status: 'open',
          alarmEnabled,
          ringtone: reminderRingtone,
          createdAt: now,
          updatedAt: now
        };
        await storage.put('reminders', newRem);
        onSuccess(`Reminder & Alarm scheduled for ${date} at ${reminderTime}`);
      } else if (activeType === 'person') {
        const newPerson: Person = {
          id: generateUUID(),
          name: title.trim(),
          relationship: category.trim() || 'Friend',
          contact: details.trim() || undefined,
          createdAt: now
        };
        await storage.put('people', newPerson);
        onSuccess('Contact saved');
      } else if (activeType === 'habit') {
        await storage.put('habits', {
          id: generateUUID(),
          name: title.trim(),
          frequency: 'Daily',
          timesPerDay: 1,
          category: category.trim() || 'General',
          date,
          createdAt: now,
          updatedAt: now
        });
        onSuccess('Habit captured');
      } else if (activeType === 'routine') {
        await storage.put('routines', {
          id: generateUUID(),
          name: title.trim(),
          description: details.trim() || '',
          date,
          createdAt: now
        });
        onSuccess('Routine captured');
      } else if (activeType === 'health') {
        await storage.put('healthNotes', {
          id: generateUUID(),
          title: title.trim(),
          body: details.trim(),
          category: category.trim() || 'General',
          date,
          createdAt: now,
          updatedAt: now
        });
        onSuccess('Health log captured');
      } else if (activeType === 'meeting') {
        await storage.put('meetings', {
          id: generateUUID(),
          title: title.trim(),
          agenda: details.trim() || '',
          date,
          createdAt: now,
          updatedAt: now
        });
        onSuccess('Meeting captured');
      } else if (activeType === 'learning') {
        await storage.put('learningItems', {
          id: generateUUID(),
          title: title.trim(),
          topic: category.trim() || '',
          note: details.trim() || '',
          date,
          createdAt: now,
          updatedAt: now
        });
        onSuccess('Learning item captured');
      } else if (activeType === 'focus') {
        await storage.put('focus', {
          id: generateUUID(),
          label: title.trim(),
          note: details.trim() || '',
          date,
          durationSeconds: 0,
          minutes: 0,
          startedAt: now,
          endedAt: now,
          createdAt: now,
          updatedAt: now
        });
        onSuccess('Focus session captured');
      }

      reloadAll();
      onClose();
      setTitle('');
      setDetails('');
      setAmount('');
    } catch (err: any) {
      console.error('Quick capture failed', err);
      setFormError(err instanceof Error ? err.message : 'Unable to save this item. Please try again.');
    }
  };

  const types = [
    { id: 'task', label: 'Task', icon: <CheckSquare className="h-3.5 w-3.5" /> },
    { id: 'note', label: 'Memo', icon: <FileText className="h-3.5 w-3.5" /> },
    { id: 'journal', label: 'Journal', icon: <BookOpen className="h-3.5 w-3.5" /> },
    { id: 'expense', label: 'Expense', icon: <DollarSign className="h-3.5 w-3.5" /> },
    { id: 'goal', label: 'Goal', icon: <Target className="h-3.5 w-3.5" /> },
    { id: 'reminder', label: 'Reminder', icon: <Bell className="h-3.5 w-3.5" /> },
    { id: 'habit', label: 'Habit', icon: <Repeat className="h-3.5 w-3.5" /> },
    { id: 'routine', label: 'Routine', icon: <Clock className="h-3.5 w-3.5" /> },
    { id: 'health', label: 'Health', icon: <Heart className="h-3.5 w-3.5" /> },
    { id: 'meeting', label: 'Meeting', icon: <Briefcase className="h-3.5 w-3.5" /> },
    { id: 'learning', label: 'Learning', icon: <GraduationCap className="h-3.5 w-3.5" /> },
    { id: 'focus', label: 'Focus', icon: <Zap className="h-3.5 w-3.5" /> },
    { id: 'person', label: 'Person', icon: <User className="h-3.5 w-3.5" /> }
  ];

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="qc-modal-title" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 font-bold">
              ＋
            </span>
            <h2 id="qc-modal-title" className="text-sm font-bold text-slate-900 dark:text-white">Quick Capture</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Capture Type Selector */}
        <div className="mt-4 flex flex-wrap gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
          {types.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveType(t.id)}
              className={`flex items-center gap-1.5 border-b-0 border-transparent px-2 py-1.5 text-xs font-semibold transition-colors ${
                activeType === t.id
                  ? 'text-amber-700 dark:text-amber-300 [&_svg]:text-amber-700 dark:[&_svg]:text-amber-300'
                  : 'text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {formError && (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {formError}
          </p>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              {activeType === 'person' ? 'Full Name' : activeType === 'expense' ? 'Description / Payee' : 'Title'}
            </label>
            <input
              type="text"
              required={activeType !== 'expense'}
              value={title}
              onChange={e => setTitle(e.target.value)}

              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              autoFocus
            />
          </div>

          {activeType === 'expense' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Amount ({getCurrencySymbol()})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={e => setAmount(e.target.value)}

                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Category
                  </label>
                  <input
                    type="text"
                    list="qc-category-opts-expense"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <datalist id="qc-category-opts-expense">
                    {categoryOptions.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </div>

              {financeAccounts.length > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Deduct From Account / Wallet
                  </label>
                  <select
                    value={selectedAccountId}
                    onChange={e => setSelectedAccountId(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {financeAccounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} (Balance: {getCurrencySymbol()} {Number(a.balance).toLocaleString('en-IN')})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {activeType === 'task' && (
            <div className="space-y-3">
              <label className="flex items-start gap-2 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={taskHasDueDate}
                  onChange={e => setTaskHasDueDate(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Due date</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as any)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Domain
                  </label>
                  <select
                    value={domain}
                    onChange={e => setDomain(e.target.value as TaskDomain)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="personal">Personal</option>
                    <option value="work">Work</option>
                    <option value="health">Health</option>
                    <option value="finance">Finance</option>
                    <option value="spiritual">Spiritual</option>
                    <option value="social">Social</option>
                    <option value="learning">Learning</option>
                  </select>
                </div>
                {taskHasDueDate && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Due Date
                    </label>
                    <ThemedDateTimeInput
                      type="date"
                      required
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {activeType === 'reminder' && (
            <div className="space-y-3 p-3 rounded-2xl bg-indigo-50/40 border border-indigo-100 dark:bg-indigo-950/30 dark:border-indigo-900/50">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Reminder Date
                  </label>
                  <ThemedDateTimeInput
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Alarm Time
                  </label>
                  <ThemedDateTimeInput
                    type="time"
                    required
                    value={reminderTime}
                    onChange={e => setReminderTime(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={alarmEnabled}
                    onChange={e => setAlarmEnabled(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="inline-flex items-center gap-1"><ThemeIcon name="alarm" className="h-3 w-3" /> Alarm</span>
                </label>

                {alarmEnabled && (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={reminderRingtone}
                      onChange={e => {
                        setReminderRingtone(e.target.value);
                        alarmAudio.previewRingtone(e.target.value);
                      }}
                      className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      {BUILTIN_RINGTONES.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                      {alarmAudio.getCustomRingtone() && (
                        <option value="custom">Custom Ringtone</option>
                      )}
                    </select>

                    <button
                      type="button"
                      onClick={() => alarmAudio.previewRingtone(reminderRingtone)}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-indigo-600 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:text-indigo-400"
                      title="Preview Tone"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {['note', 'habit', 'health', 'person', 'learning'].includes(activeType) && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                {activeType === 'person' ? 'Relationship' : activeType === 'learning' ? 'Topic' : 'Category'}
              </label>
              <input
                type="text"
                list="qc-category-opts-general"
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <datalist id="qc-category-opts-general">
                {categoryOptions.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              Details / Notes
            </label>
            <textarea
              rows={3}
              value={details}
              onChange={e => setDetails(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {(activeType === 'note' || activeType === 'journal') && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
              <AttachmentUploader
                attachments={attachments}
                onChange={setAttachments}
                label="Attach Files"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 active:scale-95"
            >
              Capture Now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
