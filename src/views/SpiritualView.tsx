import React, { useState, useEffect, useRef } from 'react';
import { Heart, Trash2, Pencil, X, Flame, Loader2, History, Undo2, Check, ChevronDown, ChevronUp, Play, Pause, RotateCcw } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { SpiritualPractice, Habit, NavModule, Goal } from '../types';
import { storage, generateUUID } from '../lib/storage';
import { GoalLinkSelector, GoalBadge } from '../components/GoalLinkSelector';
import { syncGoalProgressFromPractices } from '../lib/goalTaskSync';
import { ProgressiveActions } from '../components/ProgressiveActions';
import { ConfirmModal } from '../components/ConfirmModal';
import { ThemeIcon } from '../components/ThemeIcon';
import { getLocalDateString } from '../lib/dateUtils';
import { FormToggleButton } from '../components/FormToggleButton';
import { CardCloseButton } from '../components/CardCloseButton';

const FREQ_OPTIONS = ['Daily', 'Weekly', 'Monthly', 'Custom'] as const;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function parseFrequency(freq: string): { type: string; days: string[]; custom: string } {
  if (freq.startsWith('Weekly:')) {
    return { type: 'Weekly', days: freq.slice(7).split(',').filter(Boolean), custom: '' };
  }
  if (FREQ_OPTIONS.includes(freq as typeof FREQ_OPTIONS[number])) {
    return { type: freq, days: [], custom: '' };
  }
  return { type: 'Custom', days: [], custom: freq };
}

function buildFrequency(type: string, days: string[], custom: string): string {
  if (type === 'Weekly' && days.length > 0) return `Weekly:${days.join(',')}`;
  if (type === 'Custom' && custom.trim()) return custom.trim();
  if (type === 'Custom') return 'Daily';
  return type;
}

function FrequencySelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parsed = parseFrequency(value);
  const [type, setType] = useState(parsed.type);
  const [days, setDays] = useState<string[]>(parsed.days);
  const [custom, setCustom] = useState(parsed.custom);

  const emit = (t: string, d: string[], c: string) => onChange(buildFrequency(t, d, c));

  return (
    <div className="space-y-2">
      <select
        value={type}
        onChange={e => { const t = e.target.value; setType(t); emit(t, days, custom); }}
        className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
      >
        {FREQ_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {type === 'Weekly' && (
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => {
                const next = days.includes(d) ? days.filter(x => x !== d) : [...days, d];
                setDays(next);
                emit(type, next, custom);
              }}
              className={`rounded-lg px-2 py-1 text-[10px] font-semibold border transition-colors cursor-pointer ${
                days.includes(d)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}
      {type === 'Custom' && (
        <input
          type="text"
          value={custom}
          onChange={e => { setCustom(e.target.value); emit(type, days, e.target.value); }}
          placeholder="e.g. Every 3 days, Twice a week..."
          className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
      )}
    </div>
  );
}

function formatFrequencyDisplay(freq: string): string {
  if (freq.startsWith('Weekly:')) {
    return `Weekly: ${freq.slice(7).split(',').join(', ')}`;
  }
  return freq;
}

function todayISO(): string {
  return getLocalDateString(new Date());
}

interface SpiritualViewProps {
  practices: SpiritualPractice[];
  goals?: Goal[];
  embedded?: boolean;
  initialForm?: 'practices';
  onNavigate: (module: NavModule) => void;
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
  onError?: (msg: string) => void;
}

export const SpiritualView: React.FC<SpiritualViewProps> = ({
  practices,
  goals = [],
  embedded = false,
  initialForm,
  onNavigate,
  onRefresh,
  onSuccess,
  onError
}) => {
  const reportError = onError || ((msg: string) => console.error('[SpiritualView]', msg));
  const [openSpiritualForm, setOpenSpiritualForm] = useState<'practices' | null>(initialForm || null);

  const [pracName, setPracName] = useState('');
  const [pracCategory, setPracCategory] = useState<NonNullable<SpiritualPractice['category']>>('Meditation');
  const [practiceDurations, setPracticeDurations] = useState<Record<string, number>>({});
  const [practiceSessionNotes, setPracticeSessionNotes] = useState<Record<string, string>>({});
  const [pracFreq, setPracFreq] = useState('Daily');
  const [pracInputMode, setPracInputMode] = useState<'manual' | 'link'>('manual');
  const [pracGoalId, setPracGoalId] = useState<string>('');

  // Daily Practice Edit state
  const [editingPractice, setEditingPractice] = useState<SpiritualPractice | null>(null);
  const [editPracName, setEditPracName] = useState('');
  const [editPracCategory, setEditPracCategory] = useState<NonNullable<SpiritualPractice['category']>>('Meditation');
  const [editPracFreq, setEditPracFreq] = useState('Daily');
  const [editPracInputMode, setEditPracInputMode] = useState<'manual' | 'link'>('manual');
  const [editPracGoalId, setEditPracGoalId] = useState<string>('');

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<SpiritualPractice | null>(null);

  // Loading state
  const [loading, setLoading] = useState(true);

  // Undo toast state
  const [undoEntry, setUndoEntry] = useState<{ practice: SpiritualPractice; linkedHabits: Habit[]; timer: ReturnType<typeof setTimeout> } | null>(null);
  const [undoMarkDone, setUndoMarkDone] = useState<{ previous: SpiritualPractice; timer: ReturnType<typeof setTimeout> } | null>(null);

  // History expansion
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [historyVisibleCount, setHistoryVisibleCount] = useState<Record<string, number>>({});
  const [breathingDuration, setBreathingDuration] = useState(60);
  const [breathingSeconds, setBreathingSeconds] = useState(60);
  const [breathingRunning, setBreathingRunning] = useState(false);
  const [breathingSessionSaved, setBreathingSessionSaved] = useState(false);
  useEffect(() => {
    if (!breathingRunning) return;
    const timer = window.setInterval(() => setBreathingSeconds(seconds => {
      if (seconds <= 1) { setBreathingRunning(false); return 0; }
      return seconds - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [breathingRunning]);

  const handleSaveBreathingSession = async () => {
    const elapsed = breathingDuration - breathingSeconds;
    const durationMinutes = Math.max(1, Math.round(elapsed / 60));
    const today = todayISO();
    const session = {
      id: generateUUID(),
      type: 'breathing' as const,
      date: today,
      durationMinutes,
      note: 'Breathing practice session',
      createdAt: Date.now()
    };
    await storage.put('healthNotes', { ...session, title: `Breathing practice · ${durationMinutes} min`, body: session.note, category: 'Breathing' });
    setBreathingSessionSaved(true);
    setTimeout(() => setBreathingSessionSaved(false), 3000);
    onSuccess(`Breathing session saved · ${durationMinutes} min`);
  };
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const weekStartIso = getLocalDateString(weekStart);
  const practicedThisWeek = practices.filter(practice => (practice.practiceLog || []).some(date => date >= weekStartIso && date <= todayISO())).length;

  // Edit modal focus trap ref
  const editModalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (practices.length > 0) setLoading(false);
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, [practices]);

  // Focus trap for edit modal
  useEffect(() => {
    if (!editingPractice) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    editModalRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setEditingPractice(null);
        return;
      }
      if (e.key === 'Tab') {
        const focusable = editModalRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [editingPractice]);

  // Cleanup undo timer on unmount
  useEffect(() => {
    return () => {
      if (undoEntry) clearTimeout(undoEntry.timer);
      if (undoMarkDone) clearTimeout(undoMarkDone.timer);
    };
  }, [undoEntry, undoMarkDone]);

  const handleMarkDone = async (practice: SpiritualPractice) => {
    const today = todayISO();
    if (practice.lastPracticedDate === today) return;

    const log = practice.practiceLog || [];
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = getLocalDateString(yesterdayDate);
    const isConsecutive = practice.lastPracticedDate === yesterday;
    const newStreak = isConsecutive ? (practice.streak || 0) + 1 : 1;

    const updated: SpiritualPractice = {
      ...practice,
      streak: newStreak,
      lastPracticedDate: today,
      practiceLog: [today, ...log].slice(0, 365),
      practiceSessions: [{ date: today, durationMinutes: practiceDurations[practice.id] ?? 10, note: (practiceSessionNotes[practice.id] || '').trim() || undefined }, ...(practice.practiceSessions || [])].slice(0, 365),
      updatedAt: Date.now()
    };
    await storage.put('spiritualPractices', updated);
    if (undoMarkDone) clearTimeout(undoMarkDone.timer);
    const timer = setTimeout(() => setUndoMarkDone(null), 8000);
    setUndoMarkDone({ previous: practice, timer });
    setPracticeSessionNotes(prev => { const next = { ...prev }; delete next[practice.id]; return next; });
    onSuccess([7, 30, 100].includes(newStreak)
      ? `🌟 ${newStreak}-day milestone: ${practice.name}`
      : `${practice.name} done! Streak: ${newStreak} day${newStreak > 1 ? 's' : ''}`);
    onRefresh();
  };

  const handleUndoMarkDone = async () => {
    if (!undoMarkDone) return;
    clearTimeout(undoMarkDone.timer);
    await storage.put('spiritualPractices', undoMarkDone.previous);
    setUndoMarkDone(null);
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
      category: pracCategory,
      frequency: pracFreq,
      linkedHabitId: habitId,
      goalId: pracGoalId || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await storage.put('spiritualPractices', p);

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
    setPracCategory('Meditation');
    setPracFreq('Daily');
    setPracGoalId('');
    setPracInputMode('manual');
    onRefresh();
  };

  const handleStartEditPractice = (p: SpiritualPractice) => {
    setEditingPractice(p);
    setEditPracName(p.name);
    setEditPracCategory(p.category || 'Meditation');
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
      category: editPracCategory,
            frequency: editPracFreq.trim() || 'Daily',
      goalId: newGoalId,
      updatedAt: Date.now()
    };

    await storage.put('spiritualPractices', updatedPractice);

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

    onSuccess('Daily practice updated');
    setEditingPractice(null);
    onRefresh();
  };

  const handleDeletePractice = async (practice: SpiritualPractice) => {
    try {
      const linkedGoalId = practice.goalId;
      await storage.delete('spiritualPractices', practice.id);
      const allHabits = await storage.getAll<Habit>('habits');
      const linked = allHabits.filter(
        h => (practice.linkedHabitId && h.id === practice.linkedHabitId) || h.linkedPracticeId === practice.id
      );
      await Promise.all(linked.map(h => storage.delete('habits', h.id)));
      if (linkedGoalId) {
        await syncGoalProgressFromPractices(linkedGoalId);
      }

      // Undo toast instead of immediate success
      if (undoEntry) clearTimeout(undoEntry.timer);
      const timer = setTimeout(() => setUndoEntry(null), 8000);
      setUndoEntry({ practice, linkedHabits: linked, timer });
      onRefresh();
    } catch (err) {
      console.error('Failed to delete daily practice', err);
      reportError('Could not delete daily practice. Please try again.');
    }
  };

  const handleUndoDelete = async () => {
    if (!undoEntry) return;
    clearTimeout(undoEntry.timer);
    await storage.put('spiritualPractices', undoEntry.practice);
    await Promise.all(undoEntry.linkedHabits.map(h => storage.put('habits', h)));
    if (undoEntry.practice.goalId) {
      await syncGoalProgressFromPractices(undoEntry.practice.goalId);
    }
    setUndoEntry(null);
    onSuccess('Practice restored');
    onRefresh();
  };

  // Loading spinner
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
      </div>
    );
  }

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

      {practices.length > 0 && <div className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 dark:border-indigo-900/50 dark:bg-indigo-950/25">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Weekly practice</span>
        <span className="font-mono text-sm font-bold text-indigo-700 dark:text-indigo-300">{practicedThisWeek}/{practices.length} this week</span>
      </div>}

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900" aria-label="Breathing practice timer">
        <div>
          <h2 className="text-xs font-bold text-slate-800 dark:text-white">Breathing practice</h2>
          <p className="text-[11px] text-slate-500">{breathingSeconds === 0 ? 'Session complete — save to log it' : `${Math.floor(breathingSeconds / 60)}:${String(breathingSeconds % 60).padStart(2, '0')}`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!breathingRunning && breathingSeconds === breathingDuration && (
            <select
              aria-label="Breathing session duration"
              value={breathingDuration}
              onChange={e => { const v = Number(e.target.value); setBreathingDuration(v); setBreathingSeconds(v); }}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              {[60, 120, 180, 300, 600, 900].map(s => <option key={s} value={s}>{s < 60 ? `${s}s` : `${s / 60} min`}</option>)}
            </select>
          )}
          <button type="button" onClick={() => setBreathingRunning(running => !running)} disabled={breathingSeconds === 0} className="life-form-submit inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold disabled:opacity-50">{breathingRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{breathingRunning ? 'Pause' : 'Start'}</button>
          {(breathingSeconds === 0 || (!breathingRunning && breathingSeconds < breathingDuration)) && (
            <button type="button" onClick={() => void handleSaveBreathingSession()} className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${breathingSessionSaved ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`} aria-label="Save breathing session">
              <Check className="h-3.5 w-3.5" />{breathingSessionSaved ? 'Saved!' : 'Save Session'}
            </button>
          )}
          <button type="button" onClick={() => { setBreathingRunning(false); setBreathingSeconds(breathingDuration); setBreathingSessionSaved(false); }} aria-label="Reset breathing timer" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><RotateCcw className="h-3.5 w-3.5" /></button>
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        {openSpiritualForm && <section className={`rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-5 ${
          embedded && practices.length === 0 ? 'lg:col-span-12' : 'lg:col-span-5'
        }`}>
        {( !embedded || practices.length > 0) && <div className="flex justify-end">
          <CardCloseButton label="practice form" onClick={() => setOpenSpiritualForm(null)} />
        </div>}

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
              placeholder="Practice name"
              className="h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:text-white dark:border-slate-700 dark:bg-slate-800"
            />
            <select value={pracCategory} onChange={e => setPracCategory(e.target.value as NonNullable<SpiritualPractice['category']>)} aria-label="Practice category" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option>Meditation</option><option>Prayer</option><option>Gratitude</option><option>Breathing</option><option>Other</option>
            </select>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">Frequency</label>
              <FrequencySelector value={pracFreq} onChange={setPracFreq} />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 cursor-pointer"
            >
              + Add Practice & Linked Habit
            </button>
          </form>

        </div>

        </section>}

        {practices.length > 0 && <section className={`${openSpiritualForm ? 'lg:col-span-7' : 'lg:col-span-12'} rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-5`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Saved practices</h2>
            {!openSpiritualForm && (
              <button
                type="button"
                onClick={() => setOpenSpiritualForm('practices')}
                className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-500"
              >
                + Add Practice
              </button>
            )}
          </div>
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
                ) : [...practices].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(p => {
                  const doneToday = p.lastPracticedDate === todayISO();
                  const isHistoryOpen = expandedHistory === p.id;
                  return (
                  <div key={p.id} className="rounded-xl border border-slate-100 dark:border-slate-800 transition-colors hover:border-slate-200 dark:hover:border-slate-700">
                    <div
                      tabIndex={0}
                      onKeyDown={e => {
                        if (e.key === 'Delete' || e.key === 'Backspace') {
                          e.preventDefault();
                          setDeleteTarget(p);
                        }
                      }}
                      className="dashboard-item-row group flex flex-wrap items-center justify-between gap-2 p-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <ThemeIcon name="prayer" className="h-4 w-4" />
                          <span className="truncate font-semibold text-slate-900 dark:text-white">{p.name}</span>
                          {p.category && <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-medium text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">{p.category}</span>}
                          <GoalBadge goalId={p.goalId} goals={goals} />
                          {(p.streak || 0) > 0 && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                              <Flame className="h-3 w-3" />
                              {p.streak}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                          {formatFrequencyDisplay(p.frequency)}
                        </div>
                      </div>
                      <div className="flex min-w-0 flex-wrap items-center gap-1">
                        <select aria-label={`Session duration for ${p.name}`} value={practiceDurations[p.id] ?? 10} onChange={e => setPracticeDurations(prev => ({ ...prev, [p.id]: Number(e.target.value) }))} className="h-7 rounded-lg border border-slate-200 bg-white px-1.5 text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {[5, 10, 15, 20, 30, 45, 60].map(minutes => <option key={minutes} value={minutes}>{minutes}m</option>)}
                        </select>
                        <input aria-label={`Session note for ${p.name}`} value={practiceSessionNotes[p.id] || ''} onChange={e => setPracticeSessionNotes(prev => ({ ...prev, [p.id]: e.target.value }))} placeholder="Note" className="h-7 w-20 rounded-lg border border-slate-200 bg-white px-2 text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" />
                        <button
                          type="button"
                          onClick={() => handleMarkDone(p)}
                          disabled={doneToday}
                          className={`whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-semibold transition-colors cursor-pointer ${
                            doneToday
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                              : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-950/70'
                          }`}
                        >
                          {doneToday ? <><Check className="inline h-3 w-3 mr-0.5" />Done</> : 'Mark Done'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedHistory(isHistoryOpen ? null : p.id)}
                          className="whitespace-nowrap rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                          title="View practice history"
                        >
                          <History className="inline h-3 w-3 mr-0.5" />
                          {isHistoryOpen ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />}
                        </button>
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
                            onClick={() => setDeleteTarget(p)}
                            title="Delete practice (or press Delete key)"
                            aria-label={`Delete ${p.name}`}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </ProgressiveActions>
                      </div>
                    </div>
                    {/* Practice History Panel */}
                    {isHistoryOpen && (
                      <div className="border-t border-slate-100 px-3 py-2 dark:border-slate-800">
                        <h4 className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">Practice History</h4>
                        {(p.practiceLog && p.practiceLog.length > 0) ? (() => {
                          const visibleCount = historyVisibleCount[p.id] || 15;
                          const totalEntries = p.practiceLog.length;
                          const hasMore = totalEntries > visibleCount;
                          const practicedDays = new Set(p.practiceLog);
                          const sessionMinutes = new Map((p.practiceSessions || []).map(session => [session.date, session.durationMinutes]));
                          const sessionNotes = new Map((p.practiceSessions || []).map(session => [session.date, session.note]));
                          const heatmapDays = Array.from({ length: 28 }, (_, offset) => {
                            const date = new Date();
                            date.setDate(date.getDate() - (27 - offset));
                            const key = getLocalDateString(date);
                            return { key, active: practicedDays.has(key) };
                          });
                          return (
                            <div className="space-y-0.5">
                              <div className="mb-2 grid grid-cols-7 gap-1" role="img" aria-label={`${heatmapDays.filter(day => day.active).length} practice days in the last four weeks`}>
                                {heatmapDays.map(day => <span key={day.key} title={day.key} className={`h-2.5 rounded-sm ${day.active ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />)}
                              </div>
                              <div className="max-h-48 overflow-y-auto space-y-0.5">
                                {p.practiceLog.slice(0, visibleCount).map((date, i) => (
                                  <div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                                    <Check className="h-3 w-3 text-emerald-500" />
                                  <span>{new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}{sessionMinutes.has(date) ? ` · ${sessionMinutes.get(date)} min` : ''}{sessionNotes.get(date) ? ` · ${sessionNotes.get(date)}` : ''}</span>
                                  </div>
                                ))}
                              </div>
                              {hasMore && (
                                <button
                                  type="button"
                                  onClick={() => setHistoryVisibleCount(prev => ({ ...prev, [p.id]: visibleCount + 15 }))}
                                  className="mt-1.5 w-full rounded-lg bg-slate-50 py-1 text-[10px] font-semibold text-indigo-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-indigo-400 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                >
                                  Show more ({totalEntries - visibleCount} remaining)
                                </button>
                              )}
                            </div>
                          );
                        })() : (
                          <p className="text-[10px] text-slate-400">No completions yet. Tap "Mark Done" to start tracking.</p>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })}
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

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete Daily Practice?"
        message={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? This will also remove the linked habit.`
            : ''
        }
        confirmText="Delete"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={() => {
          if (deleteTarget) handleDeletePractice(deleteTarget);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Edit Daily Practice Modal — with focus trap */}
      {editingPractice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setEditingPractice(null)}
        >
          <div
            ref={editModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-practice-title"
            tabIndex={-1}
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
                <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">Category</label>
                <select value={editPracCategory} onChange={e => setEditPracCategory(e.target.value as NonNullable<SpiritualPractice['category']>)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option>Meditation</option><option>Prayer</option><option>Gratitude</option><option>Breathing</option><option>Other</option></select>
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

                  className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Frequency
                </label>
                <FrequencySelector value={editPracFreq} onChange={setEditPracFreq} />
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
                  className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-sm transition-colors cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Undo Delete Toast */}
      {undoEntry && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg dark:border-slate-700 dark:bg-slate-800" role="status" aria-live="polite">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            Deleted "{undoEntry.practice.name}"
          </span>
          <button
            type="button"
            onClick={handleUndoDelete}
            className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-950/70 cursor-pointer"
          >
            <Undo2 className="h-3 w-3" />
            Undo
          </button>
        </div>
      )}
      {undoMarkDone && (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xl">
          <span>Practice logged</span>
          <button type="button" onClick={() => void handleUndoMarkDone()} className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 hover:bg-white/20"><Undo2 className="h-3 w-3" />Undo</button>
        </div>
      )}
    </div>
  );
};
