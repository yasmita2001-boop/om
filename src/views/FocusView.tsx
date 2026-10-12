import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, RotateCcw, Check, Sparkles, Volume2,
  VolumeX, Clock, Target, Bell, Plus, Trash2,
  Upload, Music, Radio, CheckCircle2, Sliders, ArrowRight,
  Link2
} from 'lucide-react';
import { FocusSession, Task, Goal, Routine } from '../types';
import { storage, generateUUID } from '../lib/storage';
import { alarmAudio, BUILTIN_RINGTONES } from '../lib/alarmAudio';
import { alarmService, FocusAlarm } from '../lib/alarmService';

interface FocusViewProps {
  sessions: FocusSession[];
  tasks: Task[];
  goals: Goal[];
  routines?: Routine[];
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
}

export const FocusView: React.FC<FocusViewProps> = ({
  sessions,
  tasks,
  goals,
  routines = [],
  onRefresh,
  onSuccess
}) => {
  // Navigation Tabs in Focus Menu
  const [activeMenuTab, setActiveMenuTab] = useState<'timer' | 'alarms' | 'ringtones'>('timer');

  // Focus Timer States
  const [totalSeconds, setTotalSeconds] = useState(25 * 60);
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [customMin, setCustomMin] = useState(25);
  const [selectedTask, setSelectedTask] = useState<string>('');
  const [selectedGoal, setSelectedGoal] = useState<string>('');
  const [sessionLabel, setSessionLabel] = useState('Deep Work Sprint');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Alarm Clock States
  const [alarmsList, setAlarmsList] = useState<FocusAlarm[]>(() => alarmService.getFocusAlarms());
  const [newAlarmTime, setNewAlarmTime] = useState('08:00');
  const [newAlarmLabel, setNewAlarmLabel] = useState('');
  const [newAlarmRingtone, setNewAlarmRingtone] = useState(alarmAudio.getDefaultRingtoneId());
  const [newAlarmDays, setNewAlarmDays] = useState<number[]>([1, 2, 3, 4, 5]); // Weekdays default
  const [isAddingAlarm, setIsAddingAlarm] = useState(false);
  const [alarmTitleMode, setAlarmTitleMode] = useState<'routine' | 'manual'>('manual');
  const [selectedRoutineId, setSelectedRoutineId] = useState<string>('');
  const [availableRoutines, setAvailableRoutines] = useState<Routine[]>(routines || []);

  // Ringtone Studio States
  const [selectedDefaultRingtone, setSelectedDefaultRingtone] = useState(alarmAudio.getDefaultRingtoneId());
  const [volume, setVolume] = useState(() => Math.round(alarmAudio.getVolume() * 100));
  const [customRingtone, setCustomRingtone] = useState(() => alarmAudio.getCustomRingtone());
  const [previewingRingtone, setPreviewingRingtone] = useState<string | null>(null);

  const startTimeRef = useRef<number>(0);
  const elapsedBeforePauseRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync alarms when updated
  const refreshAlarms = () => {
    setAlarmsList([...alarmService.getFocusAlarms()]);
  };

  // Focus timer countdown
  useEffect(() => {
    let interval: any = null;
    if (isRunning) {
      interval = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            setIsRunning(false);
            if (soundEnabled) {
              alarmService.triggerAlarm({
                id: generateUUID(),
                type: 'focus_timer',
                title: '🎯 Deep Work Sprint Complete!',
                subtitle: sessionLabel || 'Great job staying in deep focus.',
                timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                ringtone: selectedDefaultRingtone
              });
            }
            handleFinishSession();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, totalSeconds, soundEnabled, sessionLabel, selectedDefaultRingtone]);

  const handleStart = () => {
    if (!isRunning) {
      startTimeRef.current = Date.now();
      setIsRunning(true);
    }
  };

  const handlePause = () => {
    if (isRunning) {
      setIsRunning(false);
      elapsedBeforePauseRef.current += Math.floor((Date.now() - startTimeRef.current) / 1000);
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setRemainingSeconds(totalSeconds);
    elapsedBeforePauseRef.current = 0;
  };

  const handleSetPreset = (minutes: number) => {
    if (isRunning) return;
    const secs = minutes * 60;
    setTotalSeconds(secs);
    setRemainingSeconds(secs);
    setCustomMin(minutes);
  };

  const handleApplyCustom = () => {
    if (isRunning) return;
    const s = Math.max(1, customMin * 60);
    setTotalSeconds(s);
    setRemainingSeconds(s);
  };

  const handleFinishSession = async () => {
    const elapsed = totalSeconds - remainingSeconds || totalSeconds;
    const now = Date.now();
    const newSession: FocusSession = {
      id: generateUUID(),
      taskId: selectedTask || null,
      goalId: selectedGoal || null,
      label: sessionLabel || 'Focus Session',
      durationSeconds: elapsed,
      minutes: Number((elapsed / 60).toFixed(1)),
      date: new Date().toISOString().slice(0, 10),
      startedAt: now - elapsed * 1000,
      endedAt: now,
      createdAt: now,
      updatedAt: now
    };

    await storage.put('focus', newSession);
    onSuccess(`🎯 Focus session logged (${Math.round(elapsed / 60)} minutes)`);
    handleReset();
    onRefresh();
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Ringtone preview handler
  const handlePreview = (ringtoneId: string) => {
    if (previewingRingtone === ringtoneId) {
      alarmAudio.stop();
      setPreviewingRingtone(null);
      return;
    }
    setPreviewingRingtone(ringtoneId);
    alarmAudio.previewRingtone(ringtoneId);
    setTimeout(() => {
      setPreviewingRingtone(null);
    }, 4500);
  };

  // Custom ringtone upload handler
  const handleCustomAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      alert('Audio file size exceeds 8MB limit. Please choose a smaller ringtone file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const saved = alarmAudio.setCustomRingtone(file.name, dataUrl);
      if (saved) {
        setCustomRingtone({ name: file.name, dataUrl });
        setSelectedDefaultRingtone('custom');
        onSuccess(`🎵 Custom ringtone "${file.name}" saved!`);
        handlePreview('custom');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Sync available routines
  useEffect(() => {
    if (routines && routines.length > 0) {
      setAvailableRoutines(routines);
    } else {
      storage.getAll<Routine>('routines').then(rts => {
        if (rts && rts.length > 0) setAvailableRoutines(rts);
      }).catch(() => {});
    }
  }, [routines]);

  // Routine selection handler
  const handleSelectRoutine = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const routineId = e.target.value;
    setSelectedRoutineId(routineId);
    if (!routineId) return;

    const routine = availableRoutines.find(r => r.id === routineId);
    if (routine) {
      setNewAlarmLabel(routine.name);

      // Auto-set time from routine start time or time
      const rTime = routine.startTime || routine.time;
      if (rTime) {
        setNewAlarmTime(rTime);
      }

      // Auto-set repeat days based on routine cadence
      if (routine.frequency === 'weekdays') {
        setNewAlarmDays([1, 2, 3, 4, 5]);
      } else if (routine.frequency === 'daily') {
        setNewAlarmDays([0, 1, 2, 3, 4, 5, 6]);
      } else if (routine.frequency === 'weekly') {
        const currentDay = new Date().getDay();
        setNewAlarmDays([currentDay]);
      }
    }
  };

  // Add Alarm Handler
  const handleCreateAlarm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlarmTime) return;

    const matchedRoutine = selectedRoutineId
      ? availableRoutines.find(r => r.id === selectedRoutineId)
      : null;

    alarmService.addFocusAlarm({
      time: newAlarmTime,
      label: newAlarmLabel.trim() || (matchedRoutine ? matchedRoutine.name : 'Focus Alarm'),
      ringtone: newAlarmRingtone,
      enabled: true,
      days: newAlarmDays,
      linkedRoutineId: selectedRoutineId || null,
      linkedRoutineName: matchedRoutine ? matchedRoutine.name : null,
      sourceType: selectedRoutineId ? 'routine' : 'manual'
    });

    onSuccess(`⏰ Alarm scheduled for ${newAlarmTime}${matchedRoutine ? ` linked with "${matchedRoutine.name}"` : ''}`);
    setNewAlarmLabel('');
    setSelectedRoutineId('');
    setAlarmTitleMode('manual');
    setIsAddingAlarm(false);
    refreshAlarms();
  };

  const toggleAlarmStatus = (alarm: FocusAlarm) => {
    alarmService.updateFocusAlarm(alarm.id, { enabled: !alarm.enabled });
    refreshAlarms();
  };

  const deleteAlarm = (id: string) => {
    alarmService.deleteFocusAlarm(id);
    refreshAlarms();
    onSuccess('Alarm removed');
  };

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const toggleDaySelection = (dayIdx: number) => {
    if (newAlarmDays.includes(dayIdx)) {
      setNewAlarmDays(newAlarmDays.filter(d => d !== dayIdx));
    } else {
      setNewAlarmDays([...newAlarmDays, dayIdx].sort());
    }
  };

  const totalFocusSeconds = sessions.reduce((sum, s) => sum + (Number(s.durationSeconds) || 0), 0);
  const totalFocusHours = (totalFocusSeconds / 3600).toFixed(1);
  const today = new Date().toISOString().slice(0, 10);
  const todaySessions = sessions.filter(s => s.date === today);
  const todayMinutes = Math.round(todaySessions.reduce((sum, s) => sum + (Number(s.durationSeconds) || 0), 0) / 60);

  const progressPercent = totalSeconds > 0 ? ((totalSeconds - remainingSeconds) / totalSeconds) * 100 : 0;
  const strokeDashoffset = 565.48 - (565.48 * (100 - progressPercent)) / 100;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl flex items-center gap-2">
            <span>Focus & Alarm Center</span>
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
              Audio Chimes Active
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) handlePreview(selectedDefaultRingtone);
              onSuccess(next ? '🔔 Chime enabled' : 'Muted');
            }}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              soundEnabled
                ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300'
                : 'border-slate-200 text-slate-500 dark:border-slate-800'
            }`}
          >
            {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            <span>{soundEnabled ? 'Alarm Sound: ON' : 'Alarm Sound: OFF'}</span>
          </button>
        </div>
      </div>

      {/* Focus Menu Navigation Tabs */}
      <div className="grid grid-cols-3 gap-2 p-1.5 w-full rounded-2xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/70 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveMenuTab('timer')}
          className={`min-w-0 flex items-center justify-center gap-2 rounded-xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeMenuTab === 'timer'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white ring-1 ring-slate-200/60 dark:ring-slate-700/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60'
          }`}
        >
          <Sparkles className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
          <span className="whitespace-nowrap truncate">Deep Work Sprint</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMenuTab('alarms')}
          className={`min-w-0 flex items-center justify-center gap-2 rounded-xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeMenuTab === 'alarms'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white ring-1 ring-slate-200/60 dark:ring-slate-700/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60'
          }`}
        >
          <Bell className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
          <span className="whitespace-nowrap truncate">Alarm Clock ({alarmsList.filter(a => a.enabled).length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMenuTab('ringtones')}
          className={`min-w-0 flex items-center justify-center gap-2 rounded-xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeMenuTab === 'ringtones'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white ring-1 ring-slate-200/60 dark:ring-slate-700/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60'
          }`}
        >
          <Music className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="whitespace-nowrap truncate">Ringtone Studio</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: Deep Work Sprint Timer                                 */}
      {/* ============================================================== */}
      {activeMenuTab === 'timer' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Focus Clock Main Card (7 cols) */}
          <div className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              <Sparkles className="h-4 w-4" />
              <span>Active Deep Work Cycle</span>
            </div>

            {/* Circular Countdown Ring */}
            <div className="relative my-6 flex items-center justify-center">
              <svg className="h-56 w-56 sm:h-64 sm:w-64 -rotate-90 transform" viewBox="0 0 200 200">
                <circle
                  cx="100"
                  cy="100"
                  r="90"
                  className="stroke-slate-100 dark:stroke-slate-800"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="90"
                  className="stroke-indigo-600 dark:stroke-indigo-500 transition-all duration-500"
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
                <span className="mt-1 text-xs font-medium text-slate-400 max-w-[140px] truncate">
                  {sessionLabel}
                </span>
              </div>
            </div>

            {/* Preset Buttons */}
            <div className="flex flex-wrap justify-center gap-2">
              {[
                { m: 25, label: '25m Pomodoro' },
                { m: 50, label: '50m Deep Work' },
                { m: 90, label: '90m Ultra Sprint' },
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

            {/* Play / Pause / Reset Controls */}
            <div className="mt-6 flex items-center justify-center gap-3">
              {!isRunning ? (
                <button
                  type="button"
                  onClick={handleStart}
                  className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 transition-all cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>Start Sprint</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePause}
                  className="flex items-center gap-2 rounded-2xl bg-amber-500 px-6 py-3 text-sm font-bold text-white shadow-md shadow-amber-500/30 hover:bg-amber-600 active:scale-95 transition-all cursor-pointer"
                >
                  <Pause className="h-4 w-4 fill-current" />
                  <span>Pause Session</span>
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

              {(totalSeconds - remainingSeconds > 60) && (
                <button
                  type="button"
                  onClick={handleFinishSession}
                  className="flex items-center gap-1.5 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-pointer"
                  title="Complete & Log Session Now"
                >
                  <Check className="h-4 w-4" />
                  <span>Log Now</span>
                </button>
              )}
            </div>
          </div>

          {/* Task Linkage & Focus Telemetry (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            {/* Link Task Form */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
                Focus Session Target
              </h2>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Session Objective / Topic
                </label>
                <input
                  type="text"
                  value={sessionLabel}
                  onChange={e => setSessionLabel(e.target.value)}
                  placeholder="e.g. Write architecture document"
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Link to Task
                </label>
                <select
                  value={selectedTask}
                  onChange={e => setSelectedTask(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">No task linked</option>
                  {tasks.filter(t => !t.done).map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Link to Strategic Goal
                </label>
                <select
                  value={selectedGoal}
                  onChange={e => setSelectedGoal(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">No goal linked</option>
                  {goals.map(g => (
                    <option key={g.id} value={g.id}>{g.title}</option>
                  ))}
                </select>
              </div>

              {/* Custom Minutes Input */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Custom Duration (Minutes)
                </label>
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
                    onClick={handleApplyCustom}
                    disabled={isRunning}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    Set Time
                  </button>
                </div>
              </div>
            </div>

            {/* Telemetry Stats Card */}
            <div className="flex-1 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
                Focus Telemetry
              </h2>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-indigo-50/60 p-4 dark:bg-indigo-950/30">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Today's Deep Work
                  </div>
                  <div className="mt-1 font-mono text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                    {todayMinutes}m
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{todaySessions.length} sprints today</div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    All-Time Hours
                  </div>
                  <div className="mt-1 font-mono text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                    {totalFocusHours}h
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{sessions.length} total blocks</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: Alarm Clock & Scheduled Alarms                          */}
      {/* ============================================================== */}
      {activeMenuTab === 'alarms' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Alarms Roster (7 cols) */}
          <div className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Scheduled Alarms
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Alarms play your selected ringtone and trigger full-screen alerts even in the background.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddingAlarm(!isAddingAlarm)}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>New Alarm</span>
              </button>
            </div>

            {/* Quick Add Alarm Form */}
            {isAddingAlarm && (
              <form onSubmit={handleCreateAlarm} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 dark:bg-slate-800/60 dark:border-slate-700/60 space-y-3 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Alarm Time (24h)
                    </label>
                    <input
                      type="time"
                      required
                      value={newAlarmTime}
                      onChange={e => setNewAlarmTime(e.target.value)}
                      className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm font-bold text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Ringtone
                    </label>
                    <select
                      value={newAlarmRingtone}
                      onChange={e => setNewAlarmRingtone(e.target.value)}
                      className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    >
                      {BUILTIN_RINGTONES.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                      {customRingtone && (
                        <option value="custom">🎵 {customRingtone.name} (Custom)</option>
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Alarm Title / Purpose
                    </label>
                    {/* Mode Selector: Link Routine vs Manual */}
                    <div className="flex items-center rounded-lg bg-slate-200/80 p-0.5 dark:bg-slate-700/80">
                      <button
                        type="button"
                        onClick={() => {
                          setAlarmTitleMode('routine');
                          if (!selectedRoutineId && availableRoutines.length > 0) {
                            const r = availableRoutines[0];
                            setSelectedRoutineId(r.id);
                            setNewAlarmLabel(r.name);
                            if (r.startTime || r.time) setNewAlarmTime(r.startTime || r.time || '08:00');
                            if (r.frequency === 'weekdays') setNewAlarmDays([1, 2, 3, 4, 5]);
                            else if (r.frequency === 'daily') setNewAlarmDays([0, 1, 2, 3, 4, 5, 6]);
                          }
                        }}
                        className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer ${
                          alarmTitleMode === 'routine'
                            ? 'bg-white text-indigo-600 shadow-2xs dark:bg-slate-900 dark:text-indigo-400'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        }`}
                      >
                        <Link2 className="h-3 w-3" />
                        <span>Link Routine</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAlarmTitleMode('manual');
                          setSelectedRoutineId('');
                        }}
                        className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer ${
                          alarmTitleMode === 'manual'
                            ? 'bg-white text-indigo-600 shadow-2xs dark:bg-slate-900 dark:text-indigo-400'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        }`}
                      >
                        <span>Manual</span>
                      </button>
                    </div>
                  </div>

                  {alarmTitleMode === 'routine' ? (
                    <div className="mt-1.5 space-y-2">
                      {availableRoutines.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 p-3 text-center text-xs text-slate-500 dark:border-slate-700">
                          <span>No routines created yet in Routine menu. </span>
                          <button
                            type="button"
                            onClick={() => setAlarmTitleMode('manual')}
                            className="text-indigo-600 dark:text-indigo-400 font-bold underline cursor-pointer"
                          >
                            Switch to Manual Title
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="relative">
                            <select
                              value={selectedRoutineId}
                              onChange={handleSelectRoutine}
                              className="h-10 w-full rounded-xl border border-indigo-300 bg-indigo-50/40 px-3 text-xs font-semibold text-slate-900 focus:border-indigo-500 focus:outline-hidden dark:border-indigo-700 dark:bg-slate-900 dark:text-white cursor-pointer"
                            >
                              <option value="">-- Choose a Routine to Link --</option>
                              {availableRoutines.map(r => (
                                <option key={r.id} value={r.id}>
                                  📅 {r.name} {r.startTime ? `(${r.startTime}${r.endTime ? ` - ${r.endTime}` : ''})` : ''} • {r.frequency}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                              <span>Alarm Label (editable):</span>
                              {selectedRoutineId && (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                  <Check className="h-3 w-3" /> Auto-synced from routine
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              value={newAlarmLabel}
                              onChange={e => setNewAlarmLabel(e.target.value)}
                              placeholder="Routine alarm label"
                              className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1">
                      <input
                        type="text"
                        value={newAlarmLabel}
                        onChange={e => setNewAlarmLabel(e.target.value)}
                        placeholder="e.g. Morning Sprint, Standup, Medicine"
                        className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                  )}
                </div>

                {/* Repeat Day Selector */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Repeat on Days:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {dayLabels.map((dayName, idx) => {
                      const isSelected = newAlarmDays.includes(idx);
                      return (
                        <button
                          key={dayName}
                          type="button"
                          onClick={() => toggleDaySelection(idx)}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {dayName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setIsAddingAlarm(false)}
                    className="rounded-xl px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 cursor-pointer"
                  >
                    Save Alarm
                  </button>
                </div>
              </form>
            )}

            {/* Alarms List */}
            <div className="space-y-3 pt-1">
              {alarmsList.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No alarms scheduled yet. Click "+ New Alarm" to create one.
                </div>
              ) : (
                [...alarmsList].sort((a, b) => (a.time || '').localeCompare(b.time || '')).map(alarm => {
                  const ringtoneMeta = BUILTIN_RINGTONES.find(r => r.id === alarm.ringtone) || {
                    name: alarm.ringtone === 'custom' ? 'Custom Ringtone' : 'Zen Bell'
                  };
                  return (
                    <div
                      key={alarm.id}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                        alarm.enabled
                          ? 'border-indigo-100 bg-indigo-50/30 dark:border-indigo-900/50 dark:bg-indigo-950/20'
                          : 'border-slate-200 bg-white opacity-60 dark:border-slate-800 dark:bg-slate-800/40'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-2xl font-black tracking-tight text-slate-900 dark:text-white tabular-nums">
                            {alarm.time}
                          </span>
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                            {ringtoneMeta.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {alarm.label}
                          </span>
                          {alarm.linkedRoutineName && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-1.5 py-0.5 text-[9px] font-bold text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60">
                              <Link2 className="h-2.5 w-2.5" />
                              <span>Routine: {alarm.linkedRoutineName}</span>
                            </span>
                          )}
                          {alarm.sourceType === 'manual' && !alarm.linkedRoutineName && (
                            <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              Manual
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {alarm.days && alarm.days.length > 0
                            ? alarm.days.length === 7
                              ? 'Every day'
                              : alarm.days.map(d => dayLabels[d]).join(', ')
                            : 'One-time Alarm'}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handlePreview(alarm.ringtone)}
                          className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                          title="Test Alarm Sound"
                        >
                          <Volume2 className="h-4 w-4" />
                        </button>

                        {/* ON/OFF Switch */}
                        <button
                          type="button"
                          onClick={() => toggleAlarmStatus(alarm)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                            alarm.enabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              alarm.enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteAlarm(alarm.id)}
                          className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                          title="Delete Alarm"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Alarm Helpers & Clock Overview (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
                Quick Alarm Presets
              </h2>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tap to quickly schedule an alarm from right now:
              </p>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'In 15 Minutes', mins: 15 },
                  { label: 'In 30 Minutes', mins: 30 },
                  { label: 'In 45 Minutes', mins: 45 },
                  { label: 'In 1 Hour', mins: 60 },
                  { label: 'In 2 Hours', mins: 120 },
                  { label: 'Power Nap (20m)', mins: 20 }
                ].map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      const d = new Date(Date.now() + p.mins * 60 * 1000);
                      const hh = String(d.getHours()).padStart(2, '0');
                      const mm = String(d.getMinutes()).padStart(2, '0');
                      alarmService.addFocusAlarm({
                        time: `${hh}:${mm}`,
                        label: `Quick Alarm (${p.label})`,
                        ringtone: selectedDefaultRingtone,
                        enabled: true,
                        days: []
                      });
                      refreshAlarms();
                      onSuccess(`⏰ Alarm set for ${hh}:${mm} (${p.label})`);
                    }}
                    className="flex items-center justify-between p-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-indigo-50 hover:border-indigo-300 text-left transition-all dark:border-slate-800 dark:bg-slate-800/60 cursor-pointer shadow-2xs"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">{p.label}</div>
                      <div className="text-[10px] text-slate-400">Timer alarm</div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>

            {/* Test Alarm Trigger Card */}
            <div className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-purple-50/40 p-5 dark:border-indigo-900/60 dark:from-indigo-950/40 dark:to-slate-900 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                  Alarm Testing & Sound Check
                </h3>
              </div>
              <p className="text-[11px] text-indigo-900/70 dark:text-indigo-300/70 leading-relaxed">
                Test the real full-screen alarm popup, ringtone playback, snooze (+5m), and dismissal on your current device.
              </p>
              <button
                type="button"
                onClick={() => {
                  alarmService.triggerAlarm({
                    id: generateUUID(),
                    type: 'focus_alarm',
                    title: '🔔 Test Alarm Trigger',
                    subtitle: 'Testing ringtone audio and alert responsiveness',
                    timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    ringtone: selectedDefaultRingtone
                  });
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 cursor-pointer"
              >
                <Bell className="h-4 w-4" />
                <span>Test Trigger Alarm Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: Ringtone & Audio Studio ("khud se ringtone rakhne ka")  */}
      {/* ============================================================== */}
      {activeMenuTab === 'ringtones' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Preset Ringtones Catalog (7 cols) */}
          <div className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Music className="h-4 w-4 text-indigo-600" />
                <span>Built-in Synthesizer Ringtones</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Pure harmonic tones crafted via Web Audio API. Zero external downloads, 100% offline reliable.
              </p>
            </div>

            <div className="space-y-2.5">
              {BUILTIN_RINGTONES.map(r => {
                const isSelected = selectedDefaultRingtone === r.id;
                const isPlaying = previewingRingtone === r.id;
                return (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/40 dark:border-indigo-500 dark:bg-indigo-950/30 ring-1 ring-indigo-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handlePreview(r.id)}
                        className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all cursor-pointer ${
                          isPlaying
                            ? 'bg-indigo-600 text-white shadow-md animate-pulse'
                            : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200 dark:bg-indigo-950 dark:text-indigo-400'
                        }`}
                        title="Preview Ringtone Sound"
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{r.name}</span>
                          {isSelected && (
                            <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[9px] font-bold text-white">
                              Active Default
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{r.description}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDefaultRingtone(r.id);
                        alarmAudio.setDefaultRingtoneId(r.id);
                        onSuccess(`Default ringtone set to "${r.name}"`);
                        handlePreview(r.id);
                      }}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {isSelected ? 'Selected' : 'Set as Default'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom Ringtone Uploader & Audio Controls (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            {/* Custom Ringtone Upload Card ("khud se ringtone rakhne ka feature") */}
            <div className="rounded-3xl border border-indigo-200 bg-white p-6 shadow-sm dark:border-indigo-900/60 dark:bg-slate-900 space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                  <Upload className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Custom Ringtone Uploader
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Apni manpasand MP3, WAV ya OGG audio file upload karein.
                  </p>
                </div>
              </div>

              {customRingtone ? (
                <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 dark:bg-indigo-950/40 dark:border-indigo-900/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate pr-2">
                      <Music className="h-4 w-4 text-indigo-600 shrink-0" />
                      <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 truncate">
                        {customRingtone.name}
                      </span>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 shrink-0">
                      Loaded
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handlePreview('custom')}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 cursor-pointer"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                      <span>{previewingRingtone === 'custom' ? 'Playing...' : 'Play Custom Audio'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        alarmAudio.removeCustomRingtone();
                        setCustomRingtone(null);
                        setSelectedDefaultRingtone('zen_bell');
                        onSuccess('Custom ringtone removed');
                      }}
                      className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl cursor-pointer"
                      title="Remove custom audio"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDefaultRingtone('custom');
                      alarmAudio.setDefaultRingtoneId('custom');
                      onSuccess(`Default ringtone set to your custom audio!`);
                    }}
                    className={`w-full py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedDefaultRingtone === 'custom'
                        ? 'bg-emerald-600 text-white'
                        : 'border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-800 dark:text-indigo-300'
                    }`}
                  >
                    {selectedDefaultRingtone === 'custom' ? '✓ Set as Default Alarm Ringtone' : 'Make this Default Ringtone'}
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center dark:border-slate-700">
                  <Music className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    No custom audio uploaded yet
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Supports MP3, WAV, OGG, AAC up to 8MB
                  </p>
                  <label className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 cursor-pointer active:scale-95 transition-all">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload Ringtone File</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*,.mp3,.wav,.ogg,.m4a"
                      onChange={handleCustomAudioUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Volume Control Card */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-indigo-600" />
                  <span>Master Alarm Volume</span>
                </h3>
                <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  {volume}%
                </span>
              </div>

              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={e => {
                    const v = Number(e.target.value);
                    setVolume(v);
                    alarmAudio.setVolume(v / 100);
                  }}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                  <span>Mute (0%)</span>
                  <span>Balanced (50%)</span>
                  <span>Maximum (100%)</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handlePreview(selectedDefaultRingtone)}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <Volume2 className="h-4 w-4" />
                <span>Test Current Volume</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
