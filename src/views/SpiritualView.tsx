import React, { useState, useEffect } from 'react';
import { Heart, Trash2, Pencil, X } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { SpiritualPractice, Habit, NavModule, Goal } from '../types';
import { storage, generateUUID } from '../lib/storage';
import { GoalLinkSelector, GoalBadge } from '../components/GoalLinkSelector';
import { syncGoalProgressFromPractices } from '../lib/goalTaskSync';
import { ProgressiveActions } from '../components/ProgressiveActions';
import { ThemeIcon } from '../components/ThemeIcon';
import { FormToggleButton } from '../components/FormToggleButton';

interface SpiritualViewProps {
  practices: SpiritualPractice[];
  goals?: Goal[];
  embedded?: boolean;
  initialForm?: 'practices';
  onNavigate: (module: NavModule) => void;
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
}

export const SpiritualView: React.FC<SpiritualViewProps> = ({
  practices,
  goals = [],
  embedded = false,
  initialForm,
  onNavigate,
  onRefresh,
  onSuccess
}) => {
  const [openSpiritualForm, setOpenSpiritualForm] = useState<'practices' | null>(initialForm || null);

  const [pracName, setPracName] = useState('');
  const [pracFreq, setPracFreq] = useState('Daily');
  const [pracInputMode, setPracInputMode] = useState<'manual' | 'link'>('manual');
  const [pracGoalId, setPracGoalId] = useState<string>('');

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
      name: pracName.trim(),
      frequency: pracFreq,
      timesPerDay: 1,
      linkedPracticeId: practiceId,
      goalId: p.goalId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await storage.put('habits', h);

    if (p.goalId) {
      await syncGoalProgressFromPractices(p.goalId);
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
          name: editPracName.trim(),
          frequency: editPracFreq.trim() || 'Daily',
          goalId: newGoalId,
          updatedAt: Date.now()
        };
        await storage.put('habits', updatedHabit);
      }
    } catch (err) {
      console.error('Failed to update linked habit', err);
    }

    if (oldGoalId && oldGoalId !== newGoalId) {
      await syncGoalProgressFromPractices(oldGoalId);
    }
    if (newGoalId) {
      await syncGoalProgressFromPractices(newGoalId);
    }

    onSuccess('✓ Daily practice updated');
    setEditingPractice(null);
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
        await syncGoalProgressFromPractices(linkedGoalId);
      }
      onSuccess('✓ Daily practice deleted');
      onRefresh();
    } catch (err) {
      console.error('Failed to delete daily practice', err);
      onSuccess('Could not delete daily practice. Please try again.');
    }
  };

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-6'}>
      {!embedded && <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
          Daily Practices
        </h1>
        <FormToggleButton
          label="Add Practice"
          open={openSpiritualForm === 'practices'}
          onClick={() => setOpenSpiritualForm(openSpiritualForm === 'practices' ? null : 'practices')}
        />
      </div>}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        {openSpiritualForm && <section className={`rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-5 ${
          embedded && practices.length === 0 ? 'lg:col-span-12' : 'lg:col-span-5'
        }`}>

        <div className={embedded ? '' : 'mt-4'}>
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
              className="h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:text-white dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              type="text"
              value={pracFreq}
              onChange={e => setPracFreq(e.target.value)}
              placeholder="Frequency (e.g. Daily, Weekly)"
              className="h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:text-white dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-rose-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-500 cursor-pointer"
            >
              + Add Practice & Linked Habit
            </button>
          </form>

        </div>

        </section>}

        {(!embedded || practices.length > 0) && <section className={`${openSpiritualForm ? 'lg:col-span-7' : 'lg:col-span-12'} rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-5`}>
          {!embedded && <h2 className="text-sm font-bold text-slate-900 dark:text-white">Saved practices</h2>}
          <div className="mt-4">
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
                    className="dashboard-item-row group flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 p-3 text-xs transition-colors hover:border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400/50 dark:border-slate-800 dark:hover:border-slate-700"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <ThemeIcon name="prayer" className="h-4 w-4" />
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

          </div>
        </section>}
      </div>

      {/* Cross-module links */}
      {!embedded && <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:p-5">
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
      </div>}

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
