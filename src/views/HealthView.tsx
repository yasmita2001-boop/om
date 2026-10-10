import React, { useState } from 'react';
import {
  Heart, Activity, Moon, Droplet, Calendar, Trash2,
  Stethoscope, FileText, Edit3, X
} from 'lucide-react';
import {
  HealthProfile, HealthMeasurement, SleepRecord, WaterRecord,
  NutritionRecord, HealthAppointment, HealthNote
} from '../types';
import { storage, generateUUID } from '../lib/storage';
import { ConfirmModal } from '../components/ConfirmModal';
import { SlideTabs } from '../components/SlideTabs';

interface HealthViewProps {
  profile?: HealthProfile;
  measurements: HealthMeasurement[];
  sleepRecords: SleepRecord[];
  waterRecords: WaterRecord[];
  nutritionRecords: NutritionRecord[];
  appointments: HealthAppointment[];
  healthNotes?: HealthNote[];
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
}

type HealthTab = 'movement' | 'wellness' | 'appointments' | 'profile';

interface DeleteTarget {
  store: 'healthMeasurements' | 'sleepRecords' | 'waterRecords' | 'nutritionRecords' | 'healthAppointments' | 'healthNotes';
  id: string;
  name: string;
}

interface EditTarget {
  store: 'healthMeasurements' | 'sleepRecords' | 'waterRecords' | 'nutritionRecords' | 'healthAppointments' | 'healthNotes';
  item: any;
}

export const HealthView: React.FC<HealthViewProps> = ({
  profile,
  measurements,
  sleepRecords,
  waterRecords,
  nutritionRecords,
  appointments,
  healthNotes = [],
  onRefresh,
  onSuccess
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const [activeTab, setActiveTab] = useState<HealthTab>('movement');

  // Profile form
  const [name, setName] = useState(profile?.name || '');
  const [dob, setDob] = useState(profile?.dob || '');
  const [height, setHeight] = useState(profile?.height || 175);
  const [weight, setWeight] = useState(profile?.weight || 70);
  const [targetWeight, setTargetWeight] = useState(profile?.targetWeight || 68);

  // Daily log forms
  const [weightLog, setWeightLog] = useState('');
  const [stepsLog, setStepsLog] = useState('');
  const [exerciseLog, setExerciseLog] = useState('');
  const [durationLog, setDurationLog] = useState('');

  const [sleepHours, setSleepHours] = useState('');
  const [waterMl, setWaterMl] = useState('');
  const [calories, setCalories] = useState('');
  const [nutritionNote, setNutritionNote] = useState('');

  // Appointment & note form
  const [apptTitle, setApptTitle] = useState('');
  const [apptDoctor, setApptDoctor] = useState('');
  const [apptDate, setApptDate] = useState(today);
  const [hNoteText, setHNoteText] = useState('');

  // Edit & Delete modal states
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [editDate, setEditDate] = useState(today);
  const [editVal1, setEditVal1] = useState('');
  const [editVal2, setEditVal2] = useState('');
  const [editNote, setEditNote] = useState('');

  const bmi = height > 0 ? (weight / ((height / 100) ** 2)).toFixed(1) : '—';
  const bmr = Math.round(10 * weight + 6.25 * height - 5 * 28 + 5);

  const handleOpenEdit = (store: EditTarget['store'], item: any) => {
    setEditTarget({ store, item });
    setEditDate(item.date || today);

    if (store === 'healthMeasurements') {
      setEditTitle(item.exercise || 'Workout');
      setEditVal1(item.steps ? String(item.steps) : '');
      setEditVal2(item.duration ? String(item.duration) : '');
      setEditSubtitle(item.weight ? String(item.weight) : '');
    } else if (store === 'sleepRecords') {
      setEditVal1(String(item.hours || ''));
    } else if (store === 'waterRecords') {
      setEditVal1(String(item.amount || ''));
    } else if (store === 'nutritionRecords') {
      setEditVal1(item.calories ? String(item.calories) : '');
      setEditNote(item.note || '');
    } else if (store === 'healthAppointments') {
      setEditTitle(item.title || '');
      setEditSubtitle(item.doctor || '');
    } else if (store === 'healthNotes') {
      setEditNote(item.text || '');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;

    const { store, item } = editTarget;
    const now = Date.now();

    if (store === 'healthMeasurements') {
      const updated: HealthMeasurement = {
        ...item,
        date: editDate || today,
        exercise: editTitle.trim() || undefined,
        steps: editVal1 ? Number(editVal1) : undefined,
        duration: editVal2 ? Number(editVal2) : undefined,
        weight: editSubtitle ? Number(editSubtitle) : undefined,
        updatedAt: now
      };
      await storage.put('healthMeasurements', updated);
      onSuccess('✓ Measurement record updated');
    } else if (store === 'sleepRecords') {
      const updated: SleepRecord = {
        ...item,
        date: editDate || today,
        hours: Number(editVal1) || 0,
        updatedAt: now
      };
      await storage.put('sleepRecords', updated);
      onSuccess('✓ Sleep log updated');
    } else if (store === 'waterRecords') {
      const updated: WaterRecord = {
        ...item,
        date: editDate || today,
        amount: Number(editVal1) || 0,
        updatedAt: now
      };
      await storage.put('waterRecords', updated);
      onSuccess('✓ Hydration log updated');
    } else if (store === 'nutritionRecords') {
      const updated: NutritionRecord = {
        ...item,
        date: editDate || today,
        calories: editVal1 ? Number(editVal1) : undefined,
        note: editNote.trim() || undefined,
        updatedAt: now
      };
      await storage.put('nutritionRecords', updated);
      onSuccess('✓ Nutrition log updated');
    } else if (store === 'healthAppointments') {
      const updated: HealthAppointment = {
        ...item,
        title: editTitle.trim(),
        doctor: editSubtitle.trim() || undefined,
        date: editDate || today,
        updatedAt: now
      };
      await storage.put('healthAppointments', updated);
      onSuccess('✓ Appointment updated');
    } else if (store === 'healthNotes') {
      const updated: HealthNote = {
        ...item,
        date: editDate || today,
        text: editNote.trim(),
        updatedAt: now
      };
      await storage.put('healthNotes', updated);
      onSuccess('✓ Health note updated');
    }

    setEditTarget(null);
    onRefresh();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await storage.delete(deleteTarget.store, deleteTarget.id);
      onSuccess(`✓ ${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      onRefresh();
    } catch (err) {
      console.error('Delete error', err);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated: HealthProfile = {
      name,
      dob,
      height: Number(height),
      weight: Number(weight),
      targetWeight: Number(targetWeight),
      updatedAt: Date.now()
    };
    await storage.setSingleton('healthProfile', updated);
    onSuccess('✓ Health profile updated');
    onRefresh();
  };

  const handleAddMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    const m: HealthMeasurement = {
      id: generateUUID(),
      date: today,
      weight: weightLog ? Number(weightLog) : undefined,
      steps: stepsLog ? Number(stepsLog) : undefined,
      exercise: exerciseLog.trim() || undefined,
      duration: durationLog ? Number(durationLog) : undefined,
      createdAt: now
    };
    await storage.put('healthMeasurements', m);
    if (weightLog) {
      setWeight(Number(weightLog));
      const p = await storage.getSingleton<HealthProfile>('healthProfile') || {};
      p.weight = Number(weightLog);
      await storage.setSingleton('healthProfile', p);
    }
    onSuccess('✓ Physical measurement recorded');
    setWeightLog('');
    setStepsLog('');
    setExerciseLog('');
    setDurationLog('');
    onRefresh();
  };

  const handleAddWellness = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();

    if (sleepHours) {
      const s: SleepRecord = {
        id: generateUUID(),
        date: today,
        hours: Number(sleepHours),
        createdAt: now
      };
      await storage.put('sleepRecords', s);
    }

    if (waterMl) {
      const w: WaterRecord = {
        id: generateUUID(),
        date: today,
        amount: Number(waterMl),
        createdAt: now
      };
      await storage.put('waterRecords', w);
    }

    if (calories || nutritionNote) {
      const n: NutritionRecord = {
        id: generateUUID(),
        date: today,
        calories: calories ? Number(calories) : undefined,
        note: nutritionNote.trim() || undefined,
        createdAt: now
      };
      await storage.put('nutritionRecords', n);
    }

    onSuccess('✓ Wellness telemetry saved');
    setSleepHours('');
    setWaterMl('');
    setCalories('');
    setNutritionNote('');
    onRefresh();
  };

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apptTitle.trim()) return;

    const appt: HealthAppointment = {
      id: generateUUID(),
      title: apptTitle.trim(),
      doctor: apptDoctor.trim() || undefined,
      date: apptDate,
      createdAt: Date.now()
    };
    await storage.put('healthAppointments', appt);
    onSuccess('✓ Doctor appointment logged');
    setApptTitle('');
    setApptDoctor('');
    onRefresh();
  };

  const handleAddHealthNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hNoteText.trim()) return;

    const hn: HealthNote = {
      id: generateUUID(),
      date: today,
      text: hNoteText.trim(),
      createdAt: Date.now()
    };
    await storage.put('healthNotes', hn);
    onSuccess('✓ Health observation saved');
    setHNoteText('');
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl flex items-center gap-2">
          <span>Health & Vitality Command</span>
        </h1>
      </div>

      {/* Snapshot cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-white/[0.08] dark:bg-slate-900 min-w-0">
          <div className="flex items-center justify-between gap-1 text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider truncate">Current Weight</span>
            <Heart className="h-4 w-4 shrink-0 text-rose-500" />
          </div>
          <div className="mt-2.5 sm:mt-3 font-mono text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums truncate">
            {weight} kg
          </div>
          <div className="mt-1 text-xs text-slate-400 font-medium truncate">Target: {targetWeight} kg</div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-white/[0.08] dark:bg-slate-900 min-w-0">
          <div className="flex items-center justify-between gap-1 text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider truncate">Body Mass Index</span>
            <Activity className="h-4 w-4 shrink-0 text-indigo-500" />
          </div>
          <div className="mt-2.5 sm:mt-3 font-mono text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums truncate">
            {bmi}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-medium truncate">Height: {height} cm · BMR ~{bmr} kcal</div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-white/[0.08] dark:bg-slate-900 min-w-0">
          <div className="flex items-center justify-between gap-1 text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider truncate">Hydration Logs</span>
            <Droplet className="h-4 w-4 shrink-0 text-blue-500" />
          </div>
          <div className="mt-2.5 sm:mt-3 font-mono text-xl sm:text-2xl lg:text-3xl font-extrabold text-blue-600 dark:text-blue-400 tabular-nums truncate">
            {waterRecords.length}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-medium truncate">Target: 3000 ml/day</div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-white/[0.08] dark:bg-slate-900 min-w-0">
          <div className="flex items-center justify-between gap-1 text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider truncate">Sleep Logs</span>
            <Moon className="h-4 w-4 shrink-0 text-purple-500" />
          </div>
          <div className="mt-2.5 sm:mt-3 font-mono text-xl sm:text-2xl lg:text-3xl font-extrabold text-purple-600 dark:text-purple-400 tabular-nums truncate">
            {sleepRecords.length}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-medium truncate">Nights recorded</div>
        </div>
      </div>

      {/* Navigation Tabs (Full Width Responsive Slide Tab) */}
      <div className="w-full pb-2 border-b border-slate-200 dark:border-slate-800">
        <SlideTabs
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as any)}
          tabs={[
            { id: 'movement', label: `Workouts (${measurements.length})`, shortLabel: `Workouts (${measurements.length})`, icon: Activity },
            { id: 'wellness', label: `Sleep & Fuel (${sleepRecords.length + waterRecords.length + nutritionRecords.length})`, shortLabel: 'Sleep & Fuel', icon: Droplet },
            { id: 'appointments', label: `Appointments (${appointments.length + healthNotes.length})`, shortLabel: `Appts (${appointments.length + healthNotes.length})`, icon: Stethoscope },
            { id: 'profile', label: 'Biometrics', shortLabel: 'Biometrics', icon: Heart }
          ]}
        />
      </div>

      {/* Tab: Physical Movement */}
      {activeTab === 'movement' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800 flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" />
              <span>Log Workout / Steps</span>
            </h2>
            <form onSubmit={handleAddMeasurement} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={weightLog}
                    onChange={e => setWeightLog(e.target.value)}
                    placeholder="e.g. 71.5"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Daily Steps</label>
                  <input
                    type="number"
                    value={stepsLog}
                    onChange={e => setStepsLog(e.target.value)}
                    placeholder="e.g. 10000"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Exercise</label>
                  <input
                    type="text"
                    value={exerciseLog}
                    onChange={e => setExerciseLog(e.target.value)}
                    placeholder="Running, Gym, Yoga"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Duration (Min)</label>
                  <input
                    type="number"
                    value={durationLog}
                    onChange={e => setDurationLog(e.target.value)}
                    placeholder="45"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
              <button type="submit" className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 cursor-pointer">
                Log Physical Activity
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Movement History ({measurements.length})
            </h2>
            <div className="mt-4 space-y-2.5 max-h-[500px] overflow-y-auto">
              {measurements.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">No workout records logged yet.</div>
              ) : (
                [...measurements].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0)).map(m => (
                  <div key={m.id} className="rounded-2xl border border-slate-100 p-3.5 text-xs dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-colors flex justify-between items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 dark:text-white truncate">{m.exercise || 'Daily Activity'}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{m.date}</div>
                    </div>
                    <div className="text-right font-mono font-bold text-slate-700 dark:text-slate-300 shrink-0">
                      {m.steps && <div>{m.steps.toLocaleString()} steps</div>}
                      {m.weight && <div>{m.weight} kg</div>}
                      {m.duration && <div className="text-indigo-600 dark:text-indigo-400">{m.duration} min</div>}
                    </div>
                    {/* EDIT & DELETE BUTTONS */}
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit('healthMeasurements', m)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Edit Measurement"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ store: 'healthMeasurements', id: m.id, name: m.exercise || 'Activity record' })}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                        title="Delete Record"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Wellness */}
      {activeTab === 'wellness' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800 flex items-center gap-2">
              <Droplet className="h-4 w-4 text-blue-500" />
              <span>Log Sleep, Water & Nutrition</span>
            </h2>
            <form onSubmit={handleAddWellness} className="mt-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Sleep (Hrs)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={sleepHours}
                    onChange={e => setSleepHours(e.target.value)}
                    placeholder="7.5"
                    className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Water (ml)</label>
                  <input
                    type="number"
                    value={waterMl}
                    onChange={e => setWaterMl(e.target.value)}
                    placeholder="2500"
                    className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Calories (kcal)</label>
                  <input
                    type="number"
                    value={calories}
                    onChange={e => setCalories(e.target.value)}
                    placeholder="2200"
                    className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Nutrition Memo</label>
                <input
                  type="text"
                  value={nutritionNote}
                  onChange={e => setNutritionNote(e.target.value)}
                  placeholder="Organic greens, high protein diet"
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Quick Water Tap Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    const w: WaterRecord = {
                      id: generateUUID(),
                      date: today,
                      amount: 250,
                      createdAt: Date.now()
                    };
                    await storage.put('waterRecords', w);
                    onSuccess('+250ml Water logged 💧');
                    onRefresh();
                  }}
                  className="flex-1 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 py-2 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-100 transition-colors cursor-pointer"
                >
                  💧 +250ml Glass
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const w: WaterRecord = {
                      id: generateUUID(),
                      date: today,
                      amount: 500,
                      createdAt: Date.now()
                    };
                    await storage.put('waterRecords', w);
                    onSuccess('+500ml Bottle logged 💧');
                    onRefresh();
                  }}
                  className="flex-1 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 py-2 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-100 transition-colors cursor-pointer"
                >
                  🍶 +500ml Bottle
                </button>
              </div>

              <button type="submit" className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 cursor-pointer">
                Save Wellness Record
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Wellness Stream ({sleepRecords.length + waterRecords.length + nutritionRecords.length} records)
            </h2>
            <div className="mt-4 space-y-2.5 max-h-[500px] overflow-y-auto">
              {[
                ...sleepRecords.map(s => ({ type: 'Sleep', text: `${s.hours} hours`, date: s.date, id: s.id, store: 'sleepRecords' as const, raw: s })),
                ...waterRecords.map(w => ({ type: 'Water', text: `${w.amount} ml`, date: w.date, id: w.id, store: 'waterRecords' as const, raw: w })),
                ...nutritionRecords.map(n => ({ type: 'Nutrition', text: `${n.calories ? `${n.calories} kcal` : ''} ${n.note || ''}`, date: n.date, id: n.id, store: 'nutritionRecords' as const, raw: n }))
              ].length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">No wellness records logged yet.</div>
              ) : (
                [
                  ...sleepRecords.map(s => ({ type: 'Sleep', text: `${s.hours} hours`, date: s.date, id: s.id, store: 'sleepRecords' as const, raw: s })),
                  ...waterRecords.map(w => ({ type: 'Water', text: `${w.amount} ml`, date: w.date, id: w.id, store: 'waterRecords' as const, raw: w })),
                  ...nutritionRecords.map(n => ({ type: 'Nutrition', text: `${n.calories ? `${n.calories} kcal` : ''} ${n.note || ''}`, date: n.date, id: n.id, store: 'nutritionRecords' as const, raw: n }))
                ]
                  .sort((a, b) => (b.date || '').localeCompare(a.date || '') || ((b.raw as any)?.createdAt || 0) - ((a.raw as any)?.createdAt || 0))
                  .slice(0, 40)
                  .map(item => (
                  <div key={item.id} className="rounded-2xl border border-slate-100 p-3 text-xs dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-colors flex justify-between items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <span className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold mr-2 ${
                        item.type === 'Sleep' ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400' :
                        item.type === 'Water' ? 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400' :
                        'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
                      }`}>
                        {item.type}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{item.text}</span>
                      <span className="font-mono text-[10px] text-slate-400 ml-2">· {item.date}</span>
                    </div>

                    {/* EDIT & DELETE BUTTONS */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item.store, item.raw)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Edit Entry"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ store: item.store, id: item.id, name: `${item.type} log` })}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                        title="Delete Entry"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Appointments & Health Notes */}
      {activeTab === 'appointments' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800 flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-indigo-500" />
                <span>Log Medical Appointment</span>
              </h2>
              <form onSubmit={handleAddAppointment} className="mt-4 space-y-3">
                <input
                  type="text"
                  required
                  value={apptTitle}
                  onChange={e => setApptTitle(e.target.value)}
                  placeholder="Reason / Consultation (e.g. Annual Checkup)"
                  className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={apptDoctor}
                    onChange={e => setApptDoctor(e.target.value)}
                    placeholder="Doctor / Clinic"
                    className="h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <input
                    type="date"
                    value={apptDate}
                    onChange={e => setApptDate(e.target.value)}
                    className="h-8 w-full rounded-lg border border-slate-200 px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  />
                </div>
                <button type="submit" className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 cursor-pointer">
                  + Add Appointment
                </button>
              </form>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800 flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-500" />
                <span>Quick Health Observation</span>
              </h2>
              <form onSubmit={handleAddHealthNote} className="mt-4 space-y-3">
                <textarea
                  rows={2}
                  required
                  value={hNoteText}
                  onChange={e => setHNoteText(e.target.value)}
                  placeholder="Blood test results, recovery notes, symptoms..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <button type="submit" className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-700 cursor-pointer">
                  Save Health Note
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6">
            {/* Appointments List */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
                Scheduled Consultations ({appointments.length})
              </h2>
              <div className="mt-4 space-y-3 max-h-64 overflow-y-auto">
                {appointments.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">No medical appointments logged.</div>
                ) : (
                  [...appointments].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0)).map(a => (
                    <div key={a.id} className="rounded-2xl border border-slate-100 p-3.5 text-xs dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-colors flex justify-between items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 dark:text-white truncate">{a.title}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          <span>{a.date}</span>
                          {a.doctor && <span>· Dr: {a.doctor}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit('healthAppointments', a)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Edit Appointment"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ store: 'healthAppointments', id: a.id, name: a.title })}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                          title="Delete Appointment"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Health Notes List */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
                Health Observations & Records ({healthNotes.length})
              </h2>
              <div className="mt-4 space-y-2.5 max-h-64 overflow-y-auto">
                {healthNotes.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">No observation notes logged.</div>
                ) : (
                  [...healthNotes].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0)).map(n => (
                    <div key={n.id} className="rounded-2xl border border-slate-100 p-3.5 text-xs dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-colors flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-slate-800 dark:text-slate-200 leading-relaxed">{n.text}</div>
                        <div className="mt-1 font-mono text-[10px] text-slate-400">{n.date}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit('healthNotes', n)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Edit Note"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ store: 'healthNotes', id: n.id, name: 'Observation note' })}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                          title="Delete Note"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Biometric Profile */}
      {activeTab === 'profile' && (
        <div className="max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
            Biometric Profile Configuration
          </h2>
          <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your Name"
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Date of Birth</label>
                <input
                  type="date"
                  value={dob}
                  onChange={e => setDob(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Height (cm)</label>
                <input
                  type="number"
                  value={height}
                  onChange={e => setHeight(Number(e.target.value))}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={weight}
                  onChange={e => setWeight(Number(e.target.value))}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Target (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={targetWeight}
                  onChange={e => setTargetWeight(Number(e.target.value))}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <button type="submit" className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 cursor-pointer">
              Update Biometric Profile
            </button>
          </form>
        </div>
      )}

      {/* DEDICATED EDIT MODAL */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                  <Edit3 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Edit Health Record
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Modify telemetry metrics or appointment details.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Date</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                />
              </div>

              {editTarget.store === 'healthMeasurements' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Exercise / Activity</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      placeholder="Running, Gym, Yoga"
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Steps</label>
                      <input
                        type="number"
                        value={editVal1}
                        onChange={e => setEditVal1(e.target.value)}
                        placeholder="10000"
                        className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Duration (m)</label>
                      <input
                        type="number"
                        value={editVal2}
                        onChange={e => setEditVal2(e.target.value)}
                        placeholder="45"
                        className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Weight (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editSubtitle}
                        onChange={e => setEditSubtitle(e.target.value)}
                        placeholder="70"
                        className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                </>
              )}

              {editTarget.store === 'sleepRecords' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Sleep Duration (Hours)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editVal1}
                    onChange={e => setEditVal1(e.target.value)}
                    placeholder="7.5"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              )}

              {editTarget.store === 'waterRecords' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Water Volume (ml)</label>
                  <input
                    type="number"
                    value={editVal1}
                    onChange={e => setEditVal1(e.target.value)}
                    placeholder="500"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              )}

              {editTarget.store === 'nutritionRecords' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Calories (kcal)</label>
                    <input
                      type="number"
                      value={editVal1}
                      onChange={e => setEditVal1(e.target.value)}
                      placeholder="2200"
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Nutrition Memo</label>
                    <input
                      type="text"
                      value={editNote}
                      onChange={e => setEditNote(e.target.value)}
                      placeholder="Meal note..."
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </>
              )}

              {editTarget.store === 'healthAppointments' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Appointment / Reason</label>
                    <input
                      type="text"
                      required
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Doctor / Clinic</label>
                    <input
                      type="text"
                      value={editSubtitle}
                      onChange={e => setEditSubtitle(e.target.value)}
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </>
              )}

              {editTarget.store === 'healthNotes' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Health Observation</label>
                  <textarea
                    rows={3}
                    required
                    value={editNote}
                    onChange={e => setEditNote(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete Health Record?"
        message={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"?`
            : ''
        }
        confirmText="Delete"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
