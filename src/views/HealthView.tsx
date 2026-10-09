import React, { useState } from 'react';
import {
  Heart, Activity, Moon, Droplet, Trash2, Edit3,
  Award, Flame
} from 'lucide-react';
import { HealthMeasurement, SleepRecord, WaterRecord } from '../types';
import { storage, generateUUID } from '../lib/storage';
import { calculatorEngine } from '../lib/calculatorEngine';

interface HealthViewProps {
  measurements: HealthMeasurement[];
  sleepRecords: SleepRecord[];
  waterRecords: WaterRecord[];
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
}

const INPUT_CLS = 'mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white';
const LABEL_CLS = 'block text-[11px] font-semibold text-slate-600 dark:text-slate-300';

export const HealthView: React.FC<HealthViewProps> = ({
  measurements,
  sleepRecords,
  waterRecords,
  onRefresh,
  onSuccess
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const [activeTab, setActiveTab] = useState<'vitals' | 'hydration' | 'sleep'>('vitals');

  // Vitals & Workout Form
  const [editingVitalId, setEditingVitalId] = useState<string | null>(null);
  const [vitalDate, setVitalDate] = useState(today);
  const [weight, setWeight] = useState('71.5');
  const [height, setHeight] = useState('175');
  const [steps, setSteps] = useState('8500');
  const [exercise, setExercise] = useState('Strength & Mobility');
  const [durationMinutes, setDurationMinutes] = useState('45');

  // Hydration Form
  const [editingWaterId, setEditingWaterId] = useState<string | null>(null);
  const [customWaterMl, setCustomWaterMl] = useState('300');

  // Sleep Form
  const [editingSleepId, setEditingSleepId] = useState<string | null>(null);
  const [sleepDate, setSleepDate] = useState(today);
  const [sleepHours, setSleepHours] = useState('7.5');
  const [sleepQuality, setSleepQuality] = useState('Good');

  // Calculations
  const bmiInfo = calculatorEngine.bmiStructured(Number(weight) || 70, Number(height) || 175);
  const bmrKcal = calculatorEngine.bmr(Number(weight) || 70, Number(height) || 175, 28, 'male');

  // Today's Water
  const todayWater = waterRecords
    .filter(w => w.date === today)
    .reduce((sum, w) => sum + (Number(w.amountMl) || 0), 0);
  const waterTarget = 3000;
  const waterProgress = Math.min(100, Math.round((todayWater / waterTarget) * 100));

  // Vitals CRUD
  const handleSaveMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    const existing = editingVitalId ? measurements.find(m => m.id === editingVitalId) : undefined;
    const rec: HealthMeasurement = {
      id: editingVitalId || generateUUID(),
      date: vitalDate || today,
      weight: Number(weight) || undefined,
      steps: Number(steps) || undefined,
      exercise: exercise.trim() || undefined,
      durationMinutes: Number(durationMinutes) || undefined,
      createdAt: existing?.createdAt || Date.now()
    };
    await storage.put('healthMeasurements', rec);
    onSuccess(editingVitalId ? 'Workout & vitals updated' : 'Physical workout & vitals logged');
    setEditingVitalId(null);
    onRefresh();
  };

  const handleEditMeasurement = (m: HealthMeasurement) => {
    setEditingVitalId(m.id);
    setVitalDate(m.date || today);
    setWeight(m.weight !== undefined ? String(m.weight) : '');
    setSteps(m.steps !== undefined ? String(m.steps) : '');
    setExercise(m.exercise || '');
    setDurationMinutes(m.durationMinutes !== undefined ? String(m.durationMinutes) : '');
  };

  const handleDeleteMeasurement = async (id: string) => {
    await storage.delete('healthMeasurements', id);
    if (editingVitalId === id) setEditingVitalId(null);
    onSuccess('Measurement deleted');
    onRefresh();
  };

  // Water CRUD
  const handleLogWater = async (amount: number) => {
    if (!amount || amount <= 0) return;
    const existing = editingWaterId ? waterRecords.find(w => w.id === editingWaterId) : undefined;
    const rec: WaterRecord = {
      id: editingWaterId || generateUUID(),
      date: existing?.date || today,
      amountMl: amount,
      createdAt: existing?.createdAt || Date.now()
    };
    await storage.put('waterRecords', rec);
    onSuccess(editingWaterId ? `Water record updated (${amount}ml)` : `+${amount}ml water logged`);
    setEditingWaterId(null);
    onRefresh();
  };

  const handleEditWater = (w: WaterRecord) => {
    setEditingWaterId(w.id);
    setCustomWaterMl(String(w.amountMl));
  };

  const handleDeleteWater = async (id: string) => {
    await storage.delete('waterRecords', id);
    if (editingWaterId === id) setEditingWaterId(null);
    onSuccess('Hydration entry deleted');
    onRefresh();
  };

  // Sleep CRUD
  const handleSaveSleep = async (e: React.FormEvent) => {
    e.preventDefault();
    const existing = editingSleepId ? sleepRecords.find(s => s.id === editingSleepId) : undefined;
    const rec: SleepRecord = {
      id: editingSleepId || generateUUID(),
      date: sleepDate || today,
      hours: Number(sleepHours) || 7,
      quality: sleepQuality,
      createdAt: existing?.createdAt || Date.now()
    };
    await storage.put('sleepRecords', rec);
    onSuccess(editingSleepId ? 'Sleep record updated' : 'Sleep cycle logged');
    setEditingSleepId(null);
    onRefresh();
  };

  const handleEditSleep = (s: SleepRecord) => {
    setEditingSleepId(s.id);
    setSleepDate(s.date || today);
    setSleepHours(String(s.hours));
    setSleepQuality(s.quality || 'Good');
  };

  const handleDeleteSleep = async (id: string) => {
    await storage.delete('sleepRecords', id);
    if (editingSleepId === id) setEditingSleepId(null);
    onSuccess('Sleep record deleted');
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-rose-500" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              Health, Vitals & Longevity
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Biometrics tracking, daily physical exertion, hydration telemetry, and sleep architecture.
          </p>
        </div>

        <div className="flex rounded-xl border border-slate-200 bg-slate-100/80 p-1 text-xs dark:border-slate-700 dark:bg-slate-800 shrink-0">
          {[
            { id: 'vitals', label: 'Workouts & Vitals' },
            { id: 'hydration', label: 'Hydration' },
            { id: 'sleep', label: 'Sleep Architecture' }
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              className={`px-3 py-1 font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === t.id
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Health KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          { label: 'Body Mass Index', val: bmiInfo.bmi, sub: `${bmiInfo.category} · Range: ${bmiInfo.healthyWeight}`, cls: 'text-slate-900 dark:text-white', icon: <Activity className="h-4 w-4 text-indigo-500 shrink-0" /> },
          { label: 'Resting BMR', val: `${bmrKcal} kcal`, sub: 'Basal daily metabolic rate', cls: 'text-amber-600 dark:text-amber-400', icon: <Flame className="h-4 w-4 text-amber-500 shrink-0" /> },
          { label: 'Water Today', val: `${todayWater} ml`, sub: `${waterProgress}% of ${waterTarget}ml target`, cls: 'text-blue-600 dark:text-blue-400', icon: <Droplet className="h-4 w-4 text-blue-500 shrink-0" /> },
          { label: 'Workouts Logged', val: measurements.length, sub: 'Total recorded sessions', cls: 'text-emerald-600 dark:text-emerald-400', icon: <Award className="h-4 w-4 text-emerald-500 shrink-0" /> }
        ].map(k => (
          <div key={k.label} className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 min-w-0">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider truncate">{k.label}</span>
              {k.icon}
            </div>
            <div className={`mt-2 font-mono text-xl sm:text-2xl font-extrabold tabular-nums truncate ${k.cls}`}>{k.val}</div>
            <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* TAB 1: WORKOUTS & VITALS */}
      {activeTab === 'vitals' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-500" />
                <span>{editingVitalId ? 'Edit Workout / Vitals' : 'Log Workout / Vitals'}</span>
              </h2>
              {editingVitalId && (
                <button type="button" onClick={() => setEditingVitalId(null)} className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer">
                  Cancel
                </button>
              )}
            </div>

            <form onSubmit={handleSaveMeasurement} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className={LABEL_CLS}>Date</label>
                  <input type="date" value={vitalDate} onChange={e => setVitalDate(e.target.value)} className={`${INPUT_CLS} font-mono px-2`} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Weight (kg)</label>
                  <input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} placeholder="70.5" className={`${INPUT_CLS} font-mono`} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Height (cm)</label>
                  <input type="number" value={height} onChange={e => setHeight(e.target.value)} placeholder="175" className={`${INPUT_CLS} font-mono`} />
                </div>
              </div>

              <div>
                <label className={LABEL_CLS}>Exercise Protocol</label>
                <input type="text" value={exercise} onChange={e => setExercise(e.target.value)} placeholder="e.g. Zone-2 Cardio, Strength Hypertrophy" className={INPUT_CLS} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Steps Count</label>
                  <input type="number" value={steps} onChange={e => setSteps(e.target.value)} placeholder="10000" className={`${INPUT_CLS} font-mono`} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Duration (Minutes)</label>
                  <input type="number" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} placeholder="45" className={`${INPUT_CLS} font-mono`} />
                </div>
              </div>

              <button type="submit" className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 cursor-pointer">
                {editingVitalId ? 'Update Workout / Vitals' : '+ Commit Physical Activity'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Activity History ({measurements.length})
            </h2>

            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {measurements.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">No workouts logged yet. Record your daily physical training.</div>
              ) : (
                measurements.map(m => (
                  <div key={m.id} className="rounded-2xl border border-slate-100 p-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 flex justify-between items-center gap-3">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm">{m.exercise || 'Daily Physical Movement'}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {m.date} · {m.durationMinutes ? `${m.durationMinutes} mins` : 'Completed'}
                      </div>
                    </div>

                    <div className="text-right flex items-center gap-2">
                      <div className="mr-1">
                        {m.steps && <div className="font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">{m.steps.toLocaleString()} steps</div>}
                        {m.weight && <div className="text-[11px] text-slate-400 font-mono">{m.weight} kg</div>}
                      </div>
                      <button type="button" onClick={() => handleEditMeasurement(m)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg cursor-pointer" title="Edit workout">
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => handleDeleteMeasurement(m.id)} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg cursor-pointer" title="Delete workout">
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

      {/* TAB 2: HYDRATION */}
      {activeTab === 'hydration' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Droplet className="h-6 w-6" />
            </div>

            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Daily Hydration Telemetry</h2>
              <p className="text-xs text-slate-400 mt-0.5">Target: 3,000 ml per day for peak cognitive & physical output</p>
            </div>

            <div className="space-y-2">
              <div className="font-mono text-3xl font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
                {todayWater} <span className="text-base font-normal text-slate-400">/ 3000 ml</span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${waterProgress}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleLogWater(250)}
                className="py-2.5 rounded-2xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 text-xs font-bold text-blue-700 dark:text-blue-300 transition-colors cursor-pointer"
              >
                + 250 ml (Glass)
              </button>
              <button
                type="button"
                onClick={() => handleLogWater(500)}
                className="py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                + 500 ml (Bottle)
              </button>
            </div>

            {/* Custom / Edit Water Form */}
            <form
              onSubmit={e => { e.preventDefault(); handleLogWater(Number(customWaterMl)); }}
              className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2"
            >
              <input
                type="number"
                min="10"
                required
                value={customWaterMl}
                onChange={e => setCustomWaterMl(e.target.value)}
                placeholder="Amount (ml)"
                className="h-9 flex-1 rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              {editingWaterId && (
                <button
                  type="button"
                  onClick={() => setEditingWaterId(null)}
                  className="h-9 px-2.5 rounded-xl border border-slate-200 text-xs text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="h-9 px-3.5 rounded-xl bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-500 cursor-pointer"
              >
                {editingWaterId ? 'Update ml' : '+ Log ml'}
              </button>
            </form>
          </div>

          {/* Hydration Records List */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Hydration Log History ({waterRecords.length})
            </h2>
            <div className="space-y-2.5 max-h-[450px] overflow-y-auto">
              {waterRecords.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">No water intake logged yet.</div>
              ) : (
                [...waterRecords].sort((a, b) => b.createdAt - a.createdAt).map(w => (
                  <div key={w.id} className="rounded-2xl border border-slate-100 p-3.5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">{w.amountMl} ml</span>
                      <span className="ml-2 text-slate-400 font-mono">{w.date}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => handleEditWater(w)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg cursor-pointer" title="Edit water entry">
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => handleDeleteWater(w.id)} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg cursor-pointer" title="Delete water entry">
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

      {/* TAB 3: SLEEP ARCHITECTURE */}
      {activeTab === 'sleep' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Moon className="h-4 w-4 text-purple-500" />
                <span>{editingSleepId ? 'Edit Sleep Record' : 'Log Sleep Architecture'}</span>
              </h2>
              {editingSleepId && (
                <button type="button" onClick={() => setEditingSleepId(null)} className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer">
                  Cancel
                </button>
              )}
            </div>

            <form onSubmit={handleSaveSleep} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Date</label>
                  <input type="date" value={sleepDate} onChange={e => setSleepDate(e.target.value)} className={`${INPUT_CLS} font-mono`} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Duration (Hours)</label>
                  <input type="number" step="0.1" required value={sleepHours} onChange={e => setSleepHours(e.target.value)} placeholder="7.5" className={`${INPUT_CLS} font-mono`} />
                </div>
              </div>

              <div>
                <label className={LABEL_CLS}>Rest Quality</label>
                <select value={sleepQuality} onChange={e => setSleepQuality(e.target.value)} className={`${INPUT_CLS} cursor-pointer`}>
                  <option value="Deep & Restorative">Deep & Restorative</option>
                  <option value="Good">Good</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Fragmented">Fragmented</option>
                </select>
              </div>

              <button type="submit" className="w-full rounded-xl bg-purple-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-purple-500 cursor-pointer">
                {editingSleepId ? 'Update Sleep Record' : '+ Save Sleep Record'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Sleep History ({sleepRecords.length})
            </h2>

            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {sleepRecords.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">No sleep records logged yet.</div>
              ) : (
                sleepRecords.map(s => (
                  <div key={s.id} className="rounded-2xl border border-slate-100 p-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 flex justify-between items-center gap-3">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm">{s.hours} Hours Sleep</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 font-mono">{s.date} · {s.quality || 'Restful'}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-purple-600 dark:text-purple-400 text-xs mr-1">
                        {s.hours >= 7.5 ? 'Optimal' : 'Short'}
                      </span>
                      <button type="button" onClick={() => handleEditSleep(s)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg cursor-pointer" title="Edit sleep record">
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => handleDeleteSleep(s.id)} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg cursor-pointer" title="Delete sleep record">
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
    </div>
  );
};
