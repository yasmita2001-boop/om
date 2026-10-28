import React, { useState, useEffect, useRef } from 'react';
import { Compass, Heart, Shield, Trash2, Pencil, X } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { ValueItem, SpiritualPractice, Commitment, Habit, NavModule, Goal } from '../types';
import { storage, generateUUID } from '../lib/storage';
import { GoalLinkSelector, GoalBadge } from '../components/GoalLinkSelector';
import { syncGoalProgressFromSpiritual } from '../lib/goalTaskSync';
import { ProgressiveActions } from '../components/ProgressiveActions';
import { FormToggleButton } from '../components/FormToggleButton';

interface SpiritualViewProps {
  values: ValueItem[];
  practices: SpiritualPractice[];
  commitments: Commitment[];
  goals?: Goal[];
  onNavigate: (module: NavModule) => void;
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
}

export const SpiritualView: React.FC<SpiritualViewProps> = ({
  values,
  practices,
  commitments,
  goals = [],
  onNavigate,
  onRefresh,
  onSuccess
}) => {
  const legacyGoalLinksRemoved = useRef(false);
  const [valTitle, setValTitle] = useState('');
  const [valDesc, setValDesc] = useState('');
  const [valType, setValType] = useState<'value' | 'principle'>('value');
  const [activeAction, setActiveAction] = useState<'values' | 'practices' | 'commitments'>('values');
  const [openSpiritualForm, setOpenSpiritualForm] = useState<'values' | 'practices' | 'commitments' | null>(null);

  const [pracName, setPracName] = useState('');
  const [pracFreq, setPracFreq] = useState('Daily');
  const [pracInputMode, setPracInputMode] = useState<'manual' | 'link'>('manual');
  const [pracGoalId, setPracGoalId] = useState<string>('');

  const [commText, setCommText] = useState('');

  // Daily Practice Edit state
  const [editingPractice, setEditingPractice] = useState<SpiritualPractice | null>(null);
  const [editPracName, setEditPracName] = useState('');
  const [editPracFreq, setEditPracFreq] = useState('Daily');
  const [editPracInputMode, setEditPracInputMode] = useState<'manual' | 'link'>('manual');
  const [editPracGoalId, setEditPracGoalId] = useState<string>('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editingPractice) {
        setEditingPractice(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingPractice]);

  useEffect(() => {
    if (legacyGoalLinksRemoved.current) return;
    legacyGoalLinksRemoved.current = true;

    void (async () => {
      const [savedValues, savedCommitments] = await Promise.all([
        storage.getAll<ValueItem>('values'),
        storage.getAll<Commitment>('commitments')
      ]);
      const linkedValues = savedValues.filter(value => value.goalId);
      const linkedCommitments = savedCommitments.filter(commitment => commitment.goalId);
      if (linkedValues.length === 0 && linkedCommitments.length === 0) return;

      await Promise.all([
        ...linkedValues.map(value => storage.put('values', { ...value, goalId: undefined })),
        ...linkedCommitments.map(commitment => storage.put('commitments', { ...commitment, goalId: undefined }))
      ]);
      onRefresh();
    })().catch(error => {
      console.error('Failed to remove legacy goal links from values and commitments', error);
    });
  }, [onRefresh]);

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
      goalId: pracGoalId || undefined,
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

    if (p.goalId) {
      await syncGoalProgressFromSpiritual(p.goalId);
    }

    onSuccess('Spiritual practice saved and automatically linked to Habit tracker');
    setPracName('');
    setPracGoalId('');
    setPracInputMode('manual');
    onRefresh();
  };

  const handleStartEditPractice = (p: SpiritualPractice) => {
    setEditingPractice(p);
    setEditPracName(p.name);
    setEditPracFreq(p.frequency || 'Daily');
    setEditPracGoalId(p.goalId || '');
    setEditPracInputMode(p.goalId ? 'link' : 'manual');
  };

  const handleSaveEditPractice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPractice || !editPracName.trim()) return;

    const oldGoalId = editingPractice.goalId;
    const newGoalId = editPracGoalId || undefined;

    const updatedPractice: SpiritualPractice = {
      ...editingPractice,
      name: editPracName.trim(),
      frequency: editPracFreq.trim() || 'Daily',
      goalId: newGoalId,
      updatedAt: Date.now()
    };

    await storage.put('spiritualPractices', updatedPractice);

    // Synchronize linked habit if present
    try {
      const allHabits = await storage.getAll<Habit>('habits');
      const linkedHabit = allHabits.find(
        h => (editingPractice.linkedHabitId && h.id === editingPractice.linkedHabitId) || h.linkedPracticeId === editingPractice.id
      );
      if (linkedHabit) {
        const updatedHabit: Habit = {
          ...linkedHabit,
          name: `🕉 ${editPracName.trim()}`,
          frequency: editPracFreq.trim() || 'Daily',
          updatedAt: Date.now()
        };
        await storage.put('habits', updatedHabit);
      }
    } catch (err) {
      console.error('Failed to update linked habit', err);
    }

    if (oldGoalId && oldGoalId !== newGoalId) {
      await syncGoalProgressFromSpiritual(oldGoalId);
    }
    if (newGoalId) {
      await syncGoalProgressFromSpiritual(newGoalId);
    }

    onSuccess('✓ Daily practice updated');
    setEditingPractice(null);
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
      const linkedGoalId = practice.goalId;
      await storage.delete('spiritualPractices', practice.id);
      // Clean up linked habit in habits store if any
      const allHabits = await storage.getAll<Habit>('habits');
      const linked = allHabits.filter(
        h => (practice.linkedHabitId && h.id === practice.linkedHabitId) || h.linkedPracticeId === practice.id
      );
      for (const h of linked) {
        await storage.delete('habits', h.id);
      }
      if (linkedGoalId) {
        await syncGoalProgressFromSpiritual(linkedGoalId);
      }
      onSuccess('✓ Daily practice deleted');
      onRefresh();
    } catch (err) {
      console.error('Failed to delete daily practice', err);
      onSuccess('Could not delete daily practice. Please try again.');
    }
  };

  const handleDeleteCommitment = async (id: string) => {
    await storage.delete('commitments', id);
    onSuccess('✓ Commitment deleted');
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
          Values, Principles & Spiritual Foundations
        </h1>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <FormToggleButton label="Add Value" open={openSpiritualForm === 'values'} onClick={() => {
            const next = openSpiritualForm === 'values' ? null : 'values';
            setOpenSpiritualForm(next);
            setActiveAction('values');
          }} />
          <FormToggleButton label="Add Practice" open={openSpiritualForm === 'practices'} onClick={() => {
            const next = openSpiritualForm === 'practices' ? null : 'practices';
            setOpenSpiritualForm(next);
            setActiveAction('practices');
          }} />
          <FormToggleButton label="Add Vow" open={openSpiritualForm === 'commitments'} onClick={() => {
            const next = openSpiritualForm === 'commitments' ? null : 'commitments';
            setOpenSpiritualForm(next);
            setActiveAction('commitments');
          }} />
        </div>
      </div>

      <div className="grid grid-cols-1 items-start items-start gap-6 lg:grid-cols-12">
        {openSpiritualForm && <section className="lg:col-span-5  border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-6">

        {/* Core Values */}
        <div className={activeAction === 'values' ? 'mt-4' : 'hidden'}>
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <Compass className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Values & Principles ({values.length})</h2>
          </div>

          <form onSubmit={handleAddValue} className="mt-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <input
                type="text"
                required
                value={valTitle}
                onChange={e => setValTitle(e.target.value)}
                placeholder="Title (e.g. Sovereign Truth)"
                className="h-8 min-w-0 flex-1 rounded-xl border border-slate-200 px-2.5 text-xs text-slate-900 dark:text-white dark:border-slate-700 dark:bg-slate-800"
              />
              <select
                value={valType}
                onChange={e => setValType(e.target.value as any)}
                className="h-8 w-24 sm:w-28 shrink-0 rounded-xl border border-slate-200 px-2 text-xs text-slate-900 dark:text-white dark:border-slate-700 dark:bg-slate-800 cursor-pointer"
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
              className="w-full min-w-0 resize-y rounded-xl border border-slate-200 p-2 text-xs text-slate-900 dark:text-white dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 cursor-pointer"
            >
              + Define Value
            </button>
          </form>

        </div>

        {/* Spiritual Practices */}
        <div className={activeAction === 'practices' ? 'mt-4' : 'hidden'}>
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <Heart className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Daily Practices ({practices.length})</h2>
          </div>

          <form onSubmit={handleAddPractice} className="mt-4 space-y-2.5">
            <GoalLinkSelector
              goals={goals}
              mode={pracInputMode}
              goalId={pracGoalId}
              onModeChange={setPracInputMode}
              onGoalChange={setPracGoalId}
            />
            <input
              type="text"
              required
              value={pracName}
              onChange={e => setPracName(e.target.value)}
              placeholder="Practice (e.g. Breathwork, Meditation)"
              className="h-8 w-full min-w-0 rounded-xl border border-slate-200 px-2.5 text-xs text-slate-900 dark:text-white dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              type="text"
              value={pracFreq}
              onChange={e => setPracFreq(e.target.value)}
              placeholder="Frequency (e.g. Daily, Weekly)"
              className="h-8 w-full min-w-0 rounded-xl border border-slate-200 px-2.5 text-xs text-slate-900 dark:text-white dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-rose-600 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 cursor-pointer"
            >
              + Add Practice & Linked Habit
            </button>
          </form>

        </div>

        {/* Personal Commitments */}
        <div className={activeAction === 'commitments' ? 'mt-4' : 'hidden'}>
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <Shield className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Commitments & Vows ({commitments.length})</h2>
          </div>

          <form onSubmit={handleAddCommitment} className="mt-4 space-y-2.5">
            <textarea
              rows={2}
              required
              value={commText}
              onChange={e => setCommText(e.target.value)}
              placeholder="A binding personal standard or moral commitment..."
              className="w-full min-w-0 resize-y rounded-xl border border-slate-200 p-2 text-xs text-slate-900 dark:text-white dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-amber-500 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 cursor-pointer"
            >
              + Commit Vow
            </button>
          </form>

        </div>
        </section>}

        <section className={`${openSpiritualForm ? 'lg:col-span-7' : 'lg:col-span-12'}  border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-6`}>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Saved foundations</h2>
          <div className="mt-4 space-y-5">
            <div>
              <div className="border-b border-slate-100 pb-2 dark:border-slate-800">
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Values & Principles ({values.length})
                </h3>
              </div>
              <div className="adaptive-card-grid mt-3 gap-2.5">
                {values.length === 0 ? (
                  <div className="col-span-full"><EmptyState icon={Shield} compact title="No values or principles yet" hint="Define what you stand for - they anchor goal choices." /></div>
                ) : [...values].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(v => (
                  <div key={v.id} className="rounded-2xl border border-slate-100 p-3.5 text-xs dark:border-slate-800">
                    <div className="flex flex-wrap justify-between items-start gap-1">
                      <span className="font-bold text-slate-900 dark:text-white">{v.title}</span>
                      <ProgressiveActions label={`More actions for ${v.title}`}>
                        <button
                          type="button"
                          onClick={() => handleDeleteValue(v.id)}
                          title="Delete value"
                          aria-label={`Delete ${v.title}`}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </ProgressiveActions>
                    </div>
                    {v.description && <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{v.description}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="border-b border-slate-100 pb-2 dark:border-slate-800">
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Daily Practices ({practices.length})
                </h3>
              </div>
              <div className="adaptive-card-grid mt-3 gap-2.5">
                {practices.length === 0 ? (
                  <div className="col-span-full"><EmptyState icon={Heart} compact title="No daily practices yet" hint="Add small rituals to keep the spiritual core active." /></div>
                ) : [...practices].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(p => (
                  <div
                    key={p.id}
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Delete' || e.key === 'Backspace') {
                        e.preventDefault();
                        handleDeletePractice(p);
                      }
                    }}
                    className="group flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 p-3.5 text-xs transition-colors hover:border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400/50 dark:border-slate-800 dark:hover:border-slate-700"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="truncate font-semibold text-slate-900 dark:text-white">{p.name}</span>
                        <GoalBadge goalId={p.goalId} goals={goals} />
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onNavigate('routine')}
                        className="whitespace-nowrap rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                        title="View linked habit in Routines & Habits"
                      >
                        View Habit →
                      </button>
                      <ProgressiveActions label={`More actions for ${p.name}`}>
                        <button
                          type="button"
                          onClick={() => handleStartEditPractice(p)}
                          title="Edit daily practice"
                          aria-label={`Edit ${p.name}`}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-400"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePractice(p)}
                          title="Delete practice (or press Delete key)"
                          aria-label={`Delete ${p.name}`}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </ProgressiveActions>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="border-b border-slate-100 pb-2 dark:border-slate-800">
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Commitments & Vows ({commitments.length})
                </h3>
              </div>
              <div className="adaptive-card-grid mt-3 gap-2">
                {commitments.length === 0 ? (
                  <div className="col-span-full"><EmptyState icon={Compass} compact title="No commitments yet" hint="Declare commitments you intend to keep visible." /></div>
                ) : [...commitments].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(c => (
                  <div key={c.id} className="rounded-2xl border border-slate-100 p-3.5 text-xs dark:border-slate-800">
                    <div className="flex flex-wrap justify-between items-start">
                      <div className="min-w-0 flex-1 font-medium italic leading-relaxed text-slate-800 dark:text-slate-200">
                        "{c.text}"
                      </div>
                      <ProgressiveActions label="More actions for commitment" className="ml-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDeleteCommitment(c.id)}
                          title="Delete commitment"
                          aria-label="Delete commitment"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </ProgressiveActions>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
            className="border-b-0 border-transparent px-2 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:border-amber-500 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200 cursor-pointer"
          >
            Reflect in Journal →
          </button>
          <button
            type="button"
            onClick={() => onNavigate('routine')}
            className="border-b-0 border-transparent px-2 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:border-amber-500 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200 cursor-pointer"
          >
            Open Habits →
          </button>
        </div>
      </div>

      {/* Edit Daily Practice Modal */}
      {editingPractice && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-practice-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setEditingPractice(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-500 dark:bg-rose-950/50">
                  <Heart className="h-4 w-4" />
                </div>
                <div>
                  <h3 id="edit-practice-title" className="text-sm font-bold text-slate-900 dark:text-white">
                    Edit Daily Practice
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingPractice(null)}
                title="Close modal"
                aria-label="Close"
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditPractice} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Goal Link
                </label>
                <GoalLinkSelector
                  goals={goals}
                  mode={editPracInputMode}
                  goalId={editPracGoalId}
                  onModeChange={setEditPracInputMode}
                  onGoalChange={setEditPracGoalId}
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Practice Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editPracName}
                  onChange={e => setEditPracName(e.target.value)}
                  placeholder="Practice (e.g. Breathwork, Meditation)"
                  className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Frequency
                </label>
                <input
                  type="text"
                  value={editPracFreq}
                  onChange={e => setEditPracFreq(e.target.value)}
                  placeholder="Frequency (e.g. Daily, Weekly)"
                  className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingPractice(null)}
                  className="rounded-xl px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 shadow-sm transition-colors cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
