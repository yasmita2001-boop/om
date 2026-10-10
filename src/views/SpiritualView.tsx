import React, { useState } from 'react';
import { Compass, Heart, Shield, Trash2 } from 'lucide-react';
import { ValueItem, SpiritualPractice, Commitment, Habit, NavModule } from '../types';
import { storage, generateUUID } from '../lib/storage';

interface SpiritualViewProps {
  values: ValueItem[];
  practices: SpiritualPractice[];
  commitments: Commitment[];
  onNavigate: (module: NavModule) => void;
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
}

export const SpiritualView: React.FC<SpiritualViewProps> = ({
  values,
  practices,
  commitments,
  onNavigate,
  onRefresh,
  onSuccess
}) => {
  const [valTitle, setValTitle] = useState('');
  const [valDesc, setValDesc] = useState('');
  const [valType, setValType] = useState<'value' | 'principle'>('value');

  const [pracName, setPracName] = useState('');
  const [pracFreq, setPracFreq] = useState('Daily');

  const [commText, setCommText] = useState('');

  const handleAddValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valTitle.trim()) return;

    const v: ValueItem = {
      id: generateUUID(),
      title: `${valType === 'principle' ? '[Principle] ' : ''}${valTitle.trim()}`,
      description: valDesc.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await storage.put('values', v);
    onSuccess(`${valType === 'principle' ? 'Principle' : 'Core Value'} defined`);
    setValTitle('');
    setValDesc('');
    onRefresh();
  };

  const handleAddPractice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pracName.trim()) return;

    const practiceId = generateUUID();
    const habitId = generateUUID();

    const p: SpiritualPractice = {
      id: practiceId,
      name: pracName.trim(),
      frequency: pracFreq,
      linkedHabitId: habitId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await storage.put('spiritualPractices', p);

    // Also auto-create a linked habit in Routine & Habits!
    const h: Habit = {
      id: habitId,
      name: `🕉 ${pracName.trim()}`,
      frequency: pracFreq,
      timesPerDay: 1,
      linkedPracticeId: practiceId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await storage.put('habits', h);

    onSuccess('Spiritual practice saved and automatically linked to Habit tracker');
    setPracName('');
    onRefresh();
  };

  const handleAddCommitment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commText.trim()) return;

    const c: Commitment = {
      id: generateUUID(),
      text: commText.trim(),
      createdAt: Date.now()
    };
    await storage.put('commitments', c);
    onSuccess('Solemn commitment recorded');
    setCommText('');
    onRefresh();
  };

  const handleDeleteValue = async (id: string) => {
    await storage.delete('values', id);
    onSuccess('✓ Value deleted');
    onRefresh();
  };

  const handleDeletePractice = async (practice: SpiritualPractice) => {
    try {
      await storage.delete('spiritualPractices', practice.id);
      // Clean up linked habit in habits store if any
      const allHabits = await storage.getAll<Habit>('habits');
      const linked = allHabits.filter(
        h => (practice.linkedHabitId && h.id === practice.linkedHabitId) || h.linkedPracticeId === practice.id
      );
      for (const h of linked) {
        await storage.delete('habits', h.id);
      }
      onSuccess('✓ Daily practice deleted');
      onRefresh();
    } catch {
      onSuccess('✓ Daily practice deleted');
      onRefresh();
    }
  };

  const handleDeleteCommitment = async (id: string) => {
    await storage.delete('commitments', id);
    onSuccess('✓ Commitment deleted');
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
          Values, Principles & Spiritual Foundations
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Core Values */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <Compass className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Values & Principles ({values.length})</h2>
          </div>

          <form onSubmit={handleAddValue} className="mt-4 space-y-2.5">
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={valTitle}
                onChange={e => setValTitle(e.target.value)}
                placeholder="Title (e.g. Sovereign Truth)"
                className="h-8 flex-1 rounded-xl border border-slate-200 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <select
                value={valType}
                onChange={e => setValType(e.target.value as any)}
                className="h-8 rounded-xl border border-slate-200 px-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="value">Value</option>
                <option value="principle">Principle</option>
              </select>
            </div>
            <textarea
              rows={2}
              value={valDesc}
              onChange={e => setValDesc(e.target.value)}
              placeholder="What does living this standard look like?"
              className="w-full rounded-xl border border-slate-200 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              + Define Value
            </button>
          </form>

          <div className="mt-4 space-y-2.5 max-h-80 overflow-y-auto">
            {[...values].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(v => (
              <div key={v.id} className="rounded-2xl border border-slate-100 p-3.5 text-xs dark:border-slate-800">
                <div className="flex justify-between items-start">
                  <div className="font-bold text-slate-900 dark:text-white">{v.title}</div>
                  <button
                    type="button"
                    onClick={() => handleDeleteValue(v.id)}
                    title="Delete value"
                    aria-label={`Delete ${v.title}`}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {v.description && (
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {v.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Spiritual Practices */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <Heart className="h-4 w-4 text-rose-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Daily Practices ({practices.length})</h2>
          </div>

          <form onSubmit={handleAddPractice} className="mt-4 space-y-2.5">
            <input
              type="text"
              required
              value={pracName}
              onChange={e => setPracName(e.target.value)}
              placeholder="Practice (e.g. Breathwork, Meditation)"
              className="h-8 w-full rounded-xl border border-slate-200 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              type="text"
              value={pracFreq}
              onChange={e => setPracFreq(e.target.value)}
              placeholder="Frequency (Daily, Sunrise)"
              className="h-8 w-full rounded-xl border border-slate-200 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-rose-600 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
            >
              + Add Practice & Linked Habit
            </button>
          </form>

          <div className="mt-4 space-y-2.5 max-h-80 overflow-y-auto">
            {practices.length === 0 ? (
              <p className="text-center py-6 text-xs text-slate-400">
                No daily practices yet. Add one above to automatically track it in your habits.
              </p>
            ) : (
              [...practices].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(p => (
                <div
                  key={p.id}
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Delete' || e.key === 'Backspace') {
                      e.preventDefault();
                      handleDeletePractice(p);
                    }
                  }}
                  className="group rounded-2xl border border-slate-100 p-3.5 text-xs dark:border-slate-800 flex justify-between items-center hover:border-slate-200 dark:hover:border-slate-700 transition-colors focus:outline-none focus:ring-1 focus:ring-rose-400/50"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-slate-900 dark:text-white truncate">{p.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{p.frequency} · Auto-linked to Habit</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onNavigate('routine')}
                      className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition-colors cursor-pointer"
                      title="View linked habit in Routines & Habits"
                    >
                      View Habit →
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePractice(p)}
                      title="Delete practice (or press Delete key)"
                      aria-label={`Delete ${p.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Personal Commitments */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <Shield className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Commitments & Vows ({commitments.length})</h2>
          </div>

          <form onSubmit={handleAddCommitment} className="mt-4 space-y-2.5">
            <textarea
              rows={2}
              required
              value={commText}
              onChange={e => setCommText(e.target.value)}
              placeholder="A binding personal standard or moral commitment..."
              className="w-full rounded-xl border border-slate-200 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-amber-500 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
            >
              + Commit Vow
            </button>
          </form>

          <div className="mt-4 space-y-2 max-h-80 overflow-y-auto">
            {[...commitments].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(c => (
              <div key={c.id} className="rounded-2xl border border-slate-100 p-3.5 text-xs dark:border-slate-800">
                <div className="flex justify-between items-start">
                  <div className="font-medium text-slate-800 dark:text-slate-200 italic leading-relaxed">
                    "{c.text}"
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteCommitment(c.id)}
                    title="Delete commitment"
                    aria-label="Delete commitment"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors ml-2 cursor-pointer shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Cross-module links */}
      <div className="rounded-3xl border border-slate-200 bg-indigo-50/40 p-5 dark:border-slate-800 dark:bg-indigo-950/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-xs text-slate-600 dark:text-slate-400">
          <span className="font-bold text-slate-900 dark:text-white">Cross-System Alignment: </span>
          Practice → Habit/Routine · Reflection → Journal · Spiritual outcome → Goal.
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onNavigate('journal')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            Reflect in Journal →
          </button>
          <button
            type="button"
            onClick={() => onNavigate('routine')}
            className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            Open Habits →
          </button>
        </div>
      </div>
    </div>
  );
};
