import React, { useState } from 'react';
import { X, CheckSquare, FileText, BookOpen, DollarSign, Target, Bell, User, Volume2, Clock } from 'lucide-react';
import { storage, generateUUID } from '../lib/storage';
import { Task, Note, JournalEntry, FinanceTransaction, Goal, ReminderItem, Person } from '../types';
import { AttachmentUploader, StoredAttachmentMeta } from './AttachmentUploader';
import { alarmAudio, BUILTIN_RINGTONES } from '../lib/alarmAudio';

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
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reminderTime, setReminderTime] = useState(() => {
    const d = new Date(Date.now() + 30 * 60 * 1000);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [reminderRingtone, setReminderRingtone] = useState(alarmAudio.getDefaultRingtoneId());
  const [attachments, setAttachments] = useState<StoredAttachmentMeta[]>([]);

  React.useEffect(() => {
    if (isOpen) {
      setActiveType(initialType);
      setAttachments([]);
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
          domain: 'personal',
          priority,
          dueAt: date,
          date,
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
          html: `<p>${details.trim().replace(/\n/g, '<br>')}</p>`,
          category: category.trim() || 'General',
          attachments: serializedAttachments.length > 0 ? serializedAttachments : undefined,
          date,
          createdAt: now,
          updatedAt: now
        };
        await storage.put('notes', newNote);
        onSuccess('📝 Note captured successfully');
      } else if (activeType === 'journal') {
        const serializedAttachments = attachments.map(a => JSON.stringify(a));
        const newJournal: JournalEntry = {
          id: generateUUID(),
          title: title.trim() || 'Daily Reflection',
          text: details.trim(),
          html: `<p>${details.trim().replace(/\n/g, '<br>')}</p>`,
          attachments: serializedAttachments.length > 0 ? serializedAttachments : undefined,
          date,
          createdAt: now,
          updatedAt: now
        };
        await storage.put('journal', newJournal);
        onSuccess('📔 Journal entry captured');
      } else if (activeType === 'expense') {
        const amt = Number(amount);
        if (!amt || amt <= 0) return;
        const newTx: FinanceTransaction = {
          id: generateUUID(),
          type: 'expense',
          amount: amt,
          category: category.trim() || 'Daily Expense',
          date,
          note: title.trim() || undefined,
          createdAt: now
        };
        await storage.put('finance', newTx);
        onSuccess('💰 Expense logged');
      } else if (activeType === 'goal') {
        const newGoal: Goal = {
          id: generateUUID(),
          title: title.trim(),
          progress: 0,
          date,
          status: 'active',
          createdAt: now,
          updatedAt: now
        };
        await storage.put('goals', newGoal);
        onSuccess('🎯 Strategic goal captured');
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
        onSuccess(`⏰ Reminder & Alarm scheduled for ${date} at ${reminderTime}`);
      } else if (activeType === 'person') {
        const newPerson: Person = {
          id: generateUUID(),
          name: title.trim(),
          relationship: category.trim() || 'Friend',
          contact: details.trim() || undefined,
          createdAt: now
        };
        await storage.put('people', newPerson);
        onSuccess('🤝 Contact saved');
      }

      reloadAll();
      onClose();
      setTitle('');
      setDetails('');
      setAmount('');
    } catch (err: any) {
      console.error('Quick capture failed', err);
    }
  };

  const types = [
    { id: 'task', label: 'Task', icon: <CheckSquare className="h-3.5 w-3.5" /> },
    { id: 'note', label: 'Note', icon: <FileText className="h-3.5 w-3.5" /> },
    { id: 'journal', label: 'Journal', icon: <BookOpen className="h-3.5 w-3.5" /> },
    { id: 'expense', label: 'Expense', icon: <DollarSign className="h-3.5 w-3.5" /> },
    { id: 'goal', label: 'Goal', icon: <Target className="h-3.5 w-3.5" /> },
    { id: 'reminder', label: 'Reminder', icon: <Bell className="h-3.5 w-3.5" /> },
    { id: 'person', label: 'Person', icon: <User className="h-3.5 w-3.5" /> }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 font-bold">
              ＋
            </span>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Quick Capture</h2>
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
        <div className="mt-4 flex flex-wrap gap-1.5 border-b border-slate-100 pb-3 dark:border-slate-800">
          {types.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveType(t.id)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                activeType === t.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

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
              placeholder={
                activeType === 'task' ? 'e.g. Finish quarterly project proposal' :
                activeType === 'note' ? 'e.g. System Architecture Notes' :
                activeType === 'journal' ? 'e.g. Evening Reflection & Wins' :
                activeType === 'expense' ? 'e.g. Team lunch or cloud hosting' :
                activeType === 'goal' ? 'e.g. Launch SaaS product by Q4' :
                activeType === 'person' ? 'e.g. Alexander Vance' : 'Title...'
              }
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              autoFocus
            />
          </div>

          {activeType === 'expense' && (
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
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                  placeholder="Food, Tech, Travel..."
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
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
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
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
                  <input
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
                  <input
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
                  <span>⏰ Ring Audio Alarm on Time</span>
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
                        <option value="custom">🎵 Custom Ringtone</option>
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

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              Details / Notes
            </label>
            <textarea
              rows={3}
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder="Add additional context or notes here..."
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
              className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 active:scale-98"
            >
              Capture Now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
