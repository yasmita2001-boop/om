import React, { useState, useEffect } from 'react';
import {
  Play, Pause, RotateCcw, Check, Sparkles, Volume2,
  Clock, Bell, Trash2, Edit3, Music, Sliders
} from 'lucide-react';
import { FocusSession, Task, Goal, FocusAlarm } from '../types';
import { storage, generateUUID } from '../lib/storage';
import { soundEngine, alarmService, BUILTIN_RINGTONES } from '../lib/audioSynthesizer';

interface FocusViewProps {
  sessions: FocusSession[];
  tasks: Task[];
  goals: Goal[];
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
}

const INPUT_CLS = 'mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white';
const LABEL_CLS = 'block text-[11px] font-semibold text-slate-600 dark:text-slate-300';

export const FocusView: React.FC<FocusViewProps> = ({
  sessions,
  tasks,
  goals,
  onRefresh,
  onSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'timer' | 'alarms' | 'audio'>('timer');

  // Focus Timer & Session Edit States
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [totalSeconds, setTotalSeconds] = useState(25 * 60);
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [customMin, setCustomMin] = useState(25);
  const [sessionLabel, setSessionLabel] = useState('Deep Work Sprint');
  const [selectedTask, setSelectedTask] = useState<string>('');
  const [selectedGoal, setSelectedGoal] = useState<string>('');

  // Scheduled Alarms State
  const [alarms, setAlarms] = useState<FocusAlarm[]>([]);
  const [editingAlarmId, setEditingAlarmId] = useState<string | null>(null);
  const [newAlarmTime, setNewAlarmTime] = useState('08:00');
  const [newAlarmLabel, setNewAlarmLabel] = useState('');
  const [newAlarmRingtone, setNewAlarmRingtone] = useState('zen_bell');
  const [newAlarmDays, setNewAlarmDays] = useState<number[]>([1, 2, 3, 4, 5]);

  // Audio Engine State
  const [volume, setVolume] = useState(() => Math.round(soundEngine.getVolume() * 100));
  const [selectedRingtone, setSelectedRingtone] = useState(() => soundEngine.getDefaultRingtoneId());

  useEffect(() => {
    storage.getAll<FocusAlarm>('focusAlarms').then(setAlarms).catch(() => {});
  }, []);

  useEffect(() => {
    let interval: any = null;
    if (isRunning) {
      interval = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            setIsRunning(false);
            alarmService.trigger({
              id: generateUUID(),
              type: 'focus_timer',
              title: 'Deep Work Sprint Finished!',
              subtitle: sessionLabel || 'Excellent work on completing your sprint.',
              timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              ringtone: selectedRingtone
            });
            handleLogSession();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isRunning, totalSeconds, sessionLabel, selectedRingtone]);

  const handleReset = () => {
    setIsRunning(false);
    setRemainingSeconds(totalSeconds);
  };

  const handleSetPreset = (min: number) => {
    if (isRunning) return;
    const s = min * 60;
    setTotalSeconds(s);
    setRemainingSeconds(s);
    setCustomMin(min);
  };

  const handleApplyCustom = () => {
    if (isRunning) return;
    const s = Math.max(1, customMin * 60);
    setTotalSeconds(s);
    setRemainingSeconds(s);
  };

  const handleLogSession = async () => {
    const elapsed = totalSeconds - remainingSeconds || totalSeconds;
    const now = Date.now();
    const existing = editingSessionId ? sessions.find(s => s.id === editingSessionId) : undefined;
    const mins = editingSessionId ? Math.max(1, customMin) : Math.max(1, Math.round(elapsed / 60));
    const newSession: FocusSession = {
      id: editingSessionId || generateUUID(),
      label: sessionLabel.trim() || 'Focus Sprint',
      durationMinutes: mins,
      date: existing?.date || new Date().toISOString().slice(0, 10),
      startedAt: existing?.startedAt || now - mins * 60000,
      endedAt: existing?.endedAt || now,
      taskId: selectedTask || null,
      goalId: selectedGoal || null
    };
    await storage.put('focus', newSession);
    onSuccess(editingSessionId ? 'Focus session updated' : `Focus session logged (${mins}m)`);
    setEditingSessionId(null);
    handleReset();
    onRefresh();
  };

  const handleEditSession = (s: FocusSession) => {
    setEditingSessionId(s.id);
    setSessionLabel(s.label);
    setCustomMin(s.durationMinutes || 25);
    setSelectedTask(s.taskId || '');
    setSelectedGoal(s.goalId || '');
  };

  const handleDeleteSession = async (id: string) => {
    await storage.delete('focus', id);
    if (editingSessionId === id) setEditingSessionId(null);
    onSuccess('Focus session deleted');
    onRefresh();
  };

  // Scheduled Alarms CRUD
  const handleSaveAlarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlarmTime) return;
    const existing = editingAlarmId ? alarms.find(a => a.id === editingAlarmId) : undefined;
    const alarmObj: FocusAlarm = {
      id: editingAlarmId || generateUUID(),
      time: newAlarmTime,
      label: newAlarmLabel.trim() || 'Scheduled Alarm',
      ringtone: newAlarmRingtone,
      enabled: existing ? existing.enabled : true,
      days: newAlarmDays,
      createdAt: existing?.createdAt || Date.now()
    };
    await storage.put('focusAlarms', alarmObj);
    setAlarms(prev => editingAlarmId ? prev.map(x => x.id === editingAlarmId ? alarmObj : x) : [...prev, alarmObj]);
    onSuccess(editingAlarmId ? `Alarm updated (${newAlarmTime})` : `Alarm set for ${newAlarmTime}`);
    setEditingAlarmId(null);
    setNewAlarmLabel('');
  };

  const handleEditAlarm = (a: FocusAlarm) => {
    setEditingAlarmId(a.id);
    setNewAlarmTime(a.time);
    setNewAlarmLabel(a.label);
    setNewAlarmRingtone(a.ringtone || 'zen_bell');
    setNewAlarmDays(a.days || [1, 2, 3, 4, 5]);
  };

  const handleToggleAlarm = async (a: FocusAlarm) => {
    const updated = { ...a, enabled: !a.enabled };
    await storage.put('focusAlarms', updated);
    setAlarms(prev => prev.map(x => x.id === a.id ? updated : x));
  };

  const handleDeleteAlarm = async (id: string) => {
    await storage.delete('focusAlarms', id);
    setAlarms(prev => prev.filter(x => x.id !== id));
    if (editingAlarmId === id) setEditingAlarmId(null);
    onSuccess('Alarm deleted');
  };

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const toggleDay = (idx: number) => {
    setNewAlarmDays(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx].sort());
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const progressPercent = totalSeconds > 0 ? ((totalSeconds - remainingSeconds) / totalSeconds) * 100 : 0;
  const strokeDashoffset = 565.48 - (565.48 * (100 - progressPercent)) / 100;
  const totalFocusMins = sessions.reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              Focus & Alarm Center
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Deep work sprints, audio alarms with Web Audio synthesizer, and focus telemetry.
          </p>
        </div>

        <div className="flex rounded-xl border border-slate-200 bg-slate-100/80 p-1 text-xs dark:border-slate-700 dark:bg-slate-800 shrink-0">
          {[
            { id: 'timer', label: 'Deep Work Timer', icon: <Sparkles className="h-3.5 w-3.5" /> },
            { id: 'alarms', label: `Alarm Clock (${alarms.filter(a => a.enabled).length})`, icon: <Bell className="h-3.5 w-3.5" /> },
            { id: 'audio', label: 'Ringtone Studio', icon: <Music className="h-3.5 w-3.5" /> }
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1 font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === t.id
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: DEEP WORK TIMER */}
      {activeTab === 'timer' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Active Sprint</span>

            <div className="relative my-6 flex items-center justify-center">
              <svg className="h-56 w-56 sm:h-64 sm:w-64 -rotate-90 transform" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="90" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="8" fill="none" />
                <circle
                  cx="100"
                  cy="100"
                  r="90"
                  className="stroke-indigo-600 transition-all duration-500"
                  strokeWidth="8"
                  strokeDasharray="565.48"
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="font-mono text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums">
                  {formatTime(remainingSeconds)}
                </span>
                <span className="mt-1 text-xs text-slate-400 max-w-[140px] truncate">{sessionLabel}</span>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              {[
                { m: 25, label: '25m Pomodoro' },
                { m: 50, label: '50m Deep Work' },
                { m: 90, label: '90m Ultra Block' },
                { m: 5, label: '5m Short Break' }
              ].map(p => (
                <button
                  key={p.m}
                  type="button"
                  onClick={() => handleSetPreset(p.m)}
                  disabled={isRunning}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    totalSeconds === p.m * 60
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-center gap-3">
              {!isRunning ? (
                <button
                  type="button"
                  onClick={() => setIsRunning(true)}
                  className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 transition-all cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>Start Sprint</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsRunning(false)}
                  className="flex items-center gap-2 rounded-2xl bg-amber-500 px-6 py-3 text-sm font-bold text-white shadow-md shadow-amber-500/30 hover:bg-amber-600 active:scale-95 transition-all cursor-pointer"
                >
                  <Pause className="h-4 w-4 fill-current" />
                  <span>Pause Sprint</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleReset}
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                title="Reset Timer"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleLogSession}
                className="flex items-center gap-1.5 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-pointer"
              >
                <Check className="h-4 w-4" />
                <span>{editingSessionId ? 'Update Session' : 'Log Session'}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editingSessionId ? 'Edit Logged Session' : 'Session Target Setup'}
                </h2>
                {editingSessionId && (
                  <button type="button" onClick={() => setEditingSessionId(null)} className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer">
                    Cancel
                  </button>
                )}
              </div>

              <div>
                <label className={LABEL_CLS}>Sprint Focus Label</label>
                <input type="text" value={sessionLabel} onChange={e => setSessionLabel(e.target.value)} placeholder="e.g. Build API gateway architecture" className={INPUT_CLS} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Link to Task</label>
                  <select value={selectedTask} onChange={e => setSelectedTask(e.target.value)} className={`${INPUT_CLS} cursor-pointer`}>
                    <option value="">No task linked</option>
                    {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLS}>Link to Goal</label>
                  <select value={selectedGoal} onChange={e => setSelectedGoal(e.target.value)} className={`${INPUT_CLS} cursor-pointer`}>
                    <option value="">No goal linked</option>
                    {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={LABEL_CLS}>Duration (Minutes)</label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={customMin}
                    onChange={e => setCustomMin(Math.max(1, Number(e.target.value)))}
                    className="h-9 flex-1 rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={editingSessionId ? handleLogSession : handleApplyCustom}
                    disabled={isRunning && !editingSessionId}
                    className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 cursor-pointer"
                  >
                    {editingSessionId ? 'Save Changes' : 'Set Time'}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Focus Telemetry & History</h2>
                <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  {Math.floor(totalFocusMins / 60)}h {totalFocusMins % 60}m ({sessions.length})
                </span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto">
                {sessions.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">No focus sprints logged yet.</div>
                ) : (
                  [...sessions].sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0)).map(s => {
                    const linkedTask = s.taskId ? tasks.find(t => t.id === s.taskId) : undefined;
                    const linkedGoal = s.goalId ? goals.find(g => g.id === s.goalId) : undefined;
                    return (
                      <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-2.5 text-xs dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40">
                        <div className="min-w-0 pr-2">
                          <div className="font-semibold text-slate-900 dark:text-white truncate">{s.label || s.notes || 'Focus Sprint'}</div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                            <span>{s.date} · {s.durationMinutes}m</span>
                            {linkedTask && (
                              <span className="font-sans rounded bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700 dark:text-emerald-300 truncate max-w-[130px]">
                                ✓ {linkedTask.title}
                              </span>
                            )}
                            {linkedGoal && (
                              <span className="font-sans rounded bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 text-[9px] font-bold text-indigo-700 dark:text-indigo-300 truncate max-w-[130px]">
                                🎯 {linkedGoal.title}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button type="button" onClick={() => handleEditSession(s)} className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer" title="Edit session">
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => handleDeleteSession(s.id)} className="p-1 text-slate-400 hover:text-rose-500 rounded cursor-pointer" title="Delete session">
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
        </div>
      )}

      {/* TAB 2: SCHEDULED ALARM CLOCK */}
      {activeTab === 'alarms' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bell className="h-4 w-4 text-purple-500" />
                <span>{editingAlarmId ? 'Edit Alarm Clock' : 'Schedule Alarm Clock'}</span>
              </h2>
              {editingAlarmId && (
                <button type="button" onClick={() => { setEditingAlarmId(null); setNewAlarmLabel(''); }} className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer">
                  Cancel
                </button>
              )}
            </div>

            <form onSubmit={handleSaveAlarm} className="mt-4 space-y-3.5">
              <div>
                <label className={LABEL_CLS}>Alarm Time (24h)</label>
                <input
                  type="time"
                  required
                  value={newAlarmTime}
                  onChange={e => setNewAlarmTime(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-sm font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className={LABEL_CLS}>Alarm Label / Purpose</label>
                <input type="text" value={newAlarmLabel} onChange={e => setNewAlarmLabel(e.target.value)} placeholder="e.g. Morning Awakening Protocol" className={INPUT_CLS} />
              </div>

              <div>
                <label className={LABEL_CLS}>Synthesizer Ringtone</label>
                <select value={newAlarmRingtone} onChange={e => setNewAlarmRingtone(e.target.value)} className={`${INPUT_CLS} cursor-pointer`}>
                  {BUILTIN_RINGTONES.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>

              <div>
                <label className={`${LABEL_CLS} mb-1.5`}>Repeat on Days:</label>
                <div className="flex flex-wrap gap-1.5">
                  {dayLabels.map((label, idx) => {
                    const isSelected = newAlarmDays.includes(idx);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => toggleDay(idx)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button type="submit" className="w-full rounded-xl bg-purple-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-purple-500 active:scale-98 transition-transform cursor-pointer">
                {editingAlarmId ? 'Update Scheduled Alarm' : '+ Set Scheduled Alarm'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Scheduled Alarms ({alarms.length})</h2>
              <button
                type="button"
                onClick={() => {
                  alarmService.trigger({
                    id: generateUUID(),
                    type: 'focus_alarm',
                    title: 'Test Audio Alarm Trigger',
                    subtitle: 'Testing ringtone synthesizer responsiveness',
                    timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    ringtone: selectedRingtone
                  });
                }}
                className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
              >
                Test Alarm Now
              </button>
            </div>

            <div className="space-y-3">
              {alarms.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">No alarms scheduled yet. Add an alarm clock on the left.</div>
              ) : (
                alarms.map(alarm => {
                  const ringMeta = BUILTIN_RINGTONES.find(r => r.id === alarm.ringtone) || { name: 'Zen Temple Bell' };
                  return (
                    <div
                      key={alarm.id}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                        alarm.enabled
                          ? 'border-indigo-100 bg-indigo-50/30 dark:border-indigo-900/40 dark:bg-indigo-950/20'
                          : 'border-slate-200 bg-white opacity-60 dark:border-slate-800 dark:bg-slate-850/40'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-2xl font-black text-slate-900 dark:text-white tabular-nums">{alarm.time}</span>
                          <span className="text-[11px] text-slate-400">({ringMeta.name})</span>
                        </div>
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{alarm.label}</div>
                        <div className="text-[11px] text-slate-400">
                          {alarm.days.length === 7 ? 'Every day' : alarm.days.map(d => dayLabels[d]).join(', ')}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => soundEngine.preview(alarm.ringtone)} className="p-1.5 text-slate-400 hover:text-indigo-600 cursor-pointer" title="Preview sound">
                          <Volume2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleAlarm(alarm)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                            alarm.enabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${alarm.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                        <button type="button" onClick={() => handleEditAlarm(alarm)} className="p-1.5 text-slate-400 hover:text-indigo-600 cursor-pointer" title="Edit alarm">
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleDeleteAlarm(alarm.id)} className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer" title="Delete alarm">
                          <Trash2 className="h-4 w-4" />
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

      {/* TAB 3: RINGTONE STUDIO */}
      {activeTab === 'audio' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800 flex items-center gap-2">
              <Music className="h-4 w-4 text-indigo-500" />
              <span>Built-in Synthesizer Ringtones</span>
            </h2>

            <div className="space-y-2.5">
              {BUILTIN_RINGTONES.map(r => {
                const isSelected = selectedRingtone === r.id;
                return (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/40 dark:border-indigo-500 dark:bg-indigo-950/30 ring-1 ring-indigo-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-850/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => soundEngine.preview(r.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 hover:bg-indigo-200 dark:bg-indigo-950 dark:text-indigo-400 cursor-pointer"
                        title="Preview ringtone sound"
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">{r.name}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{r.description}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRingtone(r.id);
                        soundEngine.setDefaultRingtoneId(r.id);
                        onSuccess(`Default ringtone set to ${r.name}`);
                        soundEngine.preview(r.id);
                      }}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all ${
                        isSelected ? 'bg-indigo-600 text-white' : 'border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {isSelected ? 'Default' : 'Select'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800 flex items-center gap-2">
              <Sliders className="h-4 w-4 text-indigo-500" />
              <span>Master Alarm Volume</span>
            </h2>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Output Volume</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{volume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={e => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  soundEngine.setVolume(v / 100);
                }}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Mute (0%)</span>
                <span>Balanced (50%)</span>
                <span>Max (100%)</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => soundEngine.preview(selectedRingtone)}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <Volume2 className="h-4 w-4" />
              <span>Test Audio Volume</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
