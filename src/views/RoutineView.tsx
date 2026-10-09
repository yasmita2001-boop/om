import React, { useState } from 'react';
import {
  Repeat, Clock, Trash2, Flame, Edit3
} from 'lucide-react';
import { Routine, Habit, HabitLog, Goal } from '../types';
import { storage, generateUUID } from '../lib/storage';
import { recalculateGoalProgress } from '../lib/goalTaskSync';

interface RoutineViewProps {
  routines: Routine[];
  habits: Habit[];
  habitLogs: HabitLog[];
  goals: Goal[];
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
}

const INPUT_CLS = 'mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white';
const LABEL_CLS = 'block text-[11px] font-semibold text-slate-600 dark:text-slate-300';

export const RoutineView: React.FC<RoutineViewProps> = ({
  routines,
  habits,
  habitLogs,
  goals,
  onRefresh,
  onSuccess
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const [activeTab, setActiveTab] = useState<'schedule' | 'habits'>('schedule');

  // Routine Form
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [routineName, setRoutineName] = useState('');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('08:00');
  const [frequency, setFrequency] = useState<'daily' | 'weekdays' | 'weekly'>('daily');
  const [category, setCategory] = useState<'morning' | 'deep_work' | 'evening' | 'health' | 'learning' | 'personal'>('morning');
  const [note, setNote] = useState('');
  const [routineGoalId, setRoutineGoalId] = useState('');

  // Habit Form
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [habitName, setHabitName] = useState('');
  const [habitCadence, setHabitCadence] = useState('Daily');
  const [timesPerDay, setTimesPerDay] = useState(1);
  const [habitGoalId, setHabitGoalId] = useState('');

  const past7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      iso: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-US', { weekday: 'narrow' })
    };
  });

  const handleSaveRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routineName.trim()) return;
    const now = Date.now();
    const existing = editingRoutineId ? routines.find(r => r.id === editingRoutineId) : undefined;

    const routineObj: Routine = {
      id: editingRoutineId || generateUUID(),
      name: routineName.trim(),
      startTime,
      endTime,
      frequency,
      category,
      note: note.trim() || undefined,
      active: existing ? existing.active : true,
      goalId: routineGoalId || null,
      completedDate: existing ? existing.completedDate : null,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
    await storage.put('routines', routineObj);
    if (existing?.goalId) await recalculateGoalProgress(existing.goalId);
    if (routineGoalId && routineGoalId !== existing?.goalId) await recalculateGoalProgress(routineGoalId);

    onSuccess(editingRoutineId ? `Routine block "${routineName}" updated` : `Routine block "${routineName}" added`);
    setEditingRoutineId(null);
    setRoutineName('');
    setNote('');
    onRefresh();
  };

  const handleEditRoutine = (r: Routine) => {
    setActiveTab('schedule');
    setEditingRoutineId(r.id);
    setRoutineName(r.name);
    setStartTime(r.startTime);
    setEndTime(r.endTime || '08:00');
    setFrequency(r.frequency || 'daily');
    setCategory(r.category || 'morning');
    setNote(r.note || '');
    setRoutineGoalId(r.goalId || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleRoutineBlock = async (r: Routine) => {
    const nextDone = r.completedDate !== today;
    await storage.put('routines', {
      ...r,
      completedDate: nextDone ? today : null,
      updatedAt: Date.now()
    });
    if (r.goalId) await recalculateGoalProgress(r.goalId);
    onSuccess(nextDone ? 'Routine block marked completed for today' : 'Routine block reset');
    onRefresh();
  };

  const handleDeleteRoutine = async (id: string) => {
    const r = routines.find(x => x.id === id);
    await storage.delete('routines', id);
    if (r?.goalId) await recalculateGoalProgress(r.goalId);
    if (editingRoutineId === id) {
      setEditingRoutineId(null);
      setRoutineName('');
      setNote('');
    }
    onSuccess('Routine block removed');
    onRefresh();
  };

  const handleSaveHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!habitName.trim()) return;
    const now = Date.now();
    const existing = editingHabitId ? habits.find(h => h.id === editingHabitId) : undefined;

    const habitObj: Habit = {
      id: editingHabitId || generateUUID(),
      name: habitName.trim(),
      frequency: habitCadence,
      timesPerDay,
      goalId: habitGoalId || null,
      streak: existing?.streak || 0,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
    await storage.put('habits', habitObj);
    if (existing?.goalId) await recalculateGoalProgress(existing.goalId);
    if (habitGoalId && habitGoalId !== existing?.goalId) await recalculateGoalProgress(habitGoalId);

    onSuccess(editingHabitId ? `Habit "${habitName}" updated` : `Habit "${habitName}" registered`);
    setEditingHabitId(null);
    setHabitName('');
    onRefresh();
  };

  const handleEditHabit = (h: Habit) => {
    setActiveTab('habits');
    setEditingHabitId(h.id);
    setHabitName(h.name);
    setHabitCadence(h.frequency);
    setTimesPerDay(h.timesPerDay || 1);
    setHabitGoalId(h.goalId || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogHabit = async (habitId: string, occurrence = 0) => {
    const key = `${habitId}|${today}|${occurrence}`;
    const existing = habitLogs.find(l => l.key === key);
    const h = habits.find(x => x.id === habitId);
    let nextLogs = [...habitLogs];

    if (existing) {
      await storage.delete('habitLogs', existing.id);
      nextLogs = nextLogs.filter(l => l.id !== existing.id);
      onSuccess('Habit check removed');
    } else {
      const newLog: HabitLog = {
        id: generateUUID(),
        key,
        habitId,
        date: today,
        occurrence,
        createdAt: Date.now()
      };
      await storage.put('habitLogs', newLog);
      nextLogs.push(newLog);
      onSuccess('Habit logged for today');
    }

    if (h) {
      const loggedDates = new Set(nextLogs.filter(l => l.habitId === h.id).map(l => l.date));
      let streak = 0;
      const cursor = new Date();
      while (true) {
        const dStr = cursor.toISOString().slice(0, 10);
        if (loggedDates.has(dStr)) {
          streak++;
          cursor.setDate(cursor.getDate() - 1);
        } else {
          break;
        }
      }
      await storage.put('habits', { ...h, streak, updatedAt: Date.now() });
      if (h.goalId) await recalculateGoalProgress(h.goalId);
    }
    onRefresh();
  };

  const handleDeleteHabit = async (id: string) => {
    const h = habits.find(x => x.id === id);
    const relatedLogs = habitLogs.filter(l => l.habitId === id);
    for (const l of relatedLogs) {
      await storage.delete('habitLogs', l.id);
    }
    await storage.delete('habits', id);
    if (h?.goalId) await recalculateGoalProgress(h.goalId);
    if (editingHabitId === id) {
      setEditingHabitId(null);
      setHabitName('');
    }
    onSuccess('Habit deleted');
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              Routine & Habits Architecture
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Orchestrate structured daily time blocks, recurring rituals, and atomic habit streaks.
          </p>
        </div>

        <div className="flex rounded-xl border border-slate-200 bg-slate-100/80 p-1 text-xs dark:border-slate-700 dark:bg-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('schedule')}
            className={`flex items-center gap-1.5 px-3 py-1 font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'schedule'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Daily Routines ({routines.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('habits')}
            className={`flex items-center gap-1.5 px-3 py-1 font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'habits'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            <Repeat className="h-3.5 w-3.5" />
            <span>Habit Tracker ({habits.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: DAILY ROUTINES SCHEDULE */}
      {activeTab === 'schedule' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-500" />
                <span>{editingRoutineId ? 'Edit Routine Block' : 'Define Routine Block'}</span>
              </h2>
              {editingRoutineId && (
                <button
                  type="button"
                  onClick={() => { setEditingRoutineId(null); setRoutineName(''); setNote(''); }}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>

            <form onSubmit={handleSaveRoutine} className="mt-4 space-y-3.5">
              <div>
                <label className={LABEL_CLS}>Block Title</label>
                <input type="text" required value={routineName} onChange={e => setRoutineName(e.target.value)} placeholder="e.g. Morning Protocol & Meditation" className={INPUT_CLS} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Start Time</label>
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={`${INPUT_CLS} font-mono`} />
                </div>
                <div>
                  <label className={LABEL_CLS}>End Time</label>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={`${INPUT_CLS} font-mono`} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value as any)} className={`${INPUT_CLS} cursor-pointer`}>
                    <option value="morning">Morning Protocol</option>
                    <option value="deep_work">Deep Work Sprint</option>
                    <option value="health">Health & Movement</option>
                    <option value="learning">Study & Reflection</option>
                    <option value="evening">Evening Shutdown</option>
                    <option value="personal">Personal Ops</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLS}>Frequency</label>
                  <select value={frequency} onChange={e => setFrequency(e.target.value as any)} className={`${INPUT_CLS} cursor-pointer`}>
                    <option value="daily">Daily</option>
                    <option value="weekdays">Weekdays (Mon-Fri)</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={LABEL_CLS}>Link to Strategic Goal</label>
                <select value={routineGoalId} onChange={e => setRoutineGoalId(e.target.value)} className={`${INPUT_CLS} cursor-pointer`}>
                  <option value="">None (Independent)</option>
                  {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              </div>

              <div>
                <label className={LABEL_CLS}>Checklist Instructions</label>
                <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Key steps to accomplish during this block..." className={INPUT_CLS} />
              </div>

              <button type="submit" className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 active:scale-98 transition-transform cursor-pointer">
                {editingRoutineId ? 'Update Routine Block' : '+ Add Routine Block'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Daily Timeline Blocks ({routines.length})
            </h2>

            <div className="space-y-3">
              {routines.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">
                  No routine blocks scheduled yet. Add your morning or focus protocol.
                </div>
              ) : (
                [...routines].sort((a, b) => a.startTime.localeCompare(b.startTime)).map(r => {
                  const isDoneToday = r.completedDate === today;
                  return (
                    <div
                      key={r.id}
                      className="rounded-2xl border border-slate-100 p-4 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-850/40 transition-all hover:border-slate-200 dark:hover:border-slate-700 flex items-start justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded-lg border border-indigo-200/50 dark:border-indigo-800/50">
                            {r.startTime} {r.endTime ? `– ${r.endTime}` : ''}
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{r.name}</span>
                        </div>

                        <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                          <span className="capitalize">{r.category.replace('_', ' ')}</span>
                          <span>·</span>
                          <span className="capitalize">{r.frequency}</span>
                          {r.goalId && (
                            <>
                              <span>·</span>
                              <span className="text-indigo-600 dark:text-indigo-400 font-medium truncate max-w-[140px]">
                                {goals.find(g => g.id === r.goalId)?.title}
                              </span>
                            </>
                          )}
                        </div>

                        {r.note && <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{r.note}</p>}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleRoutineBlock(r)}
                          className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                            isDoneToday
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {isDoneToday ? '✓ Done Today' : 'Mark Done'}
                        </button>
                        <button type="button" onClick={() => handleEditRoutine(r)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer" title="Edit routine block">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => handleDeleteRoutine(r.id)} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer" title="Delete routine block">
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

      {/* TAB 2: HABIT TRACKER */}
      {activeTab === 'habits' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Repeat className="h-4 w-4 text-amber-500" />
                <span>{editingHabitId ? 'Edit Habit Ritual' : 'Register Atomic Habit'}</span>
              </h2>
              {editingHabitId && (
                <button
                  type="button"
                  onClick={() => { setEditingHabitId(null); setHabitName(''); }}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>

            <form onSubmit={handleSaveHabit} className="mt-4 space-y-3.5">
              <div>
                <label className={LABEL_CLS}>Habit Name</label>
                <input type="text" required value={habitName} onChange={e => setHabitName(e.target.value)} placeholder="e.g. Morning 20m Breathwork & Cold Shower" className={INPUT_CLS} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Cadence</label>
                  <select value={habitCadence} onChange={e => setHabitCadence(e.target.value)} className={`${INPUT_CLS} cursor-pointer`}>
                    <option value="Daily">Daily</option>
                    <option value="Weekdays">Weekdays</option>
                    <option value="Weekly">Weekly</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLS}>Occurrences per Day</label>
                  <select value={timesPerDay} onChange={e => setTimesPerDay(Number(e.target.value))} className={`${INPUT_CLS} cursor-pointer`}>
                    <option value={1}>1 time daily</option>
                    <option value={2}>2 times daily</option>
                    <option value={3}>3 times daily</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={LABEL_CLS}>Link to Strategic Goal</label>
                <select value={habitGoalId} onChange={e => setHabitGoalId(e.target.value)} className={`${INPUT_CLS} cursor-pointer`}>
                  <option value="">None (Independent)</option>
                  {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              </div>

              <button type="submit" className="w-full rounded-xl bg-amber-500 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-600 active:scale-98 transition-transform cursor-pointer">
                {editingHabitId ? 'Update Habit Ritual' : '+ Save Habit Ritual'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Active Habits & 7-Day Consistency ({habits.length})
              </h2>
              <span className="text-[11px] font-mono text-slate-400">Today: {today}</span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {habits.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">No habits registered. Create one on the left.</div>
              ) : (
                habits.map(h => {
                  const occCount = h.timesPerDay || 1;
                  return (
                    <div key={h.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{h.name}</span>
                          {(h.streak || 0) > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                              <Flame className="h-3 w-3 fill-current" />
                              <span>{h.streak}d</span>
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{h.frequency} · {occCount}x per day</div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/60 px-2 py-1 rounded-xl border border-slate-100 dark:border-slate-800">
                          {past7Days.map(day => {
                            const dayLogged = habitLogs.some(l => l.habitId === h.id && l.date === day.iso);
                            const isToday = day.iso === today;
                            return (
                              <div key={day.iso} className="flex flex-col items-center gap-0.5" title={`${day.iso}: ${dayLogged ? 'Completed' : 'Not logged'}`}>
                                <span className="text-[8px] font-medium text-slate-400">{day.label}</span>
                                <div
                                  className={`h-4 w-4 rounded-full flex items-center justify-center text-[8px] transition-colors ${
                                    dayLogged
                                      ? 'bg-emerald-500 text-white font-bold'
                                      : isToday
                                      ? 'border border-dashed border-slate-400'
                                      : 'bg-slate-200 dark:bg-slate-700'
                                  }`}
                                >
                                  {dayLogged && '✓'}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {Array.from({ length: occCount }).map((_, idx) => {
                            const key = `${h.id}|${today}|${idx}`;
                            const isDone = habitLogs.some(l => l.key === key);
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleLogHabit(h.id, idx)}
                                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                                  isDone
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                              >
                                {isDone ? '✓ Done' : `Slot ${idx + 1}`}
                              </button>
                            );
                          })}

                          <button type="button" onClick={() => handleEditHabit(h)} className="p-1.5 text-slate-400 hover:text-amber-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer" title="Edit habit">
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => handleDeleteHabit(h.id)} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer" title="Delete habit">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
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
