import { ThemedDateTimeInput } from '../components/ThemedDateTimeInput';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play, Pause, RotateCcw, Check, Sparkles, Volume2,
  VolumeX, Clock, Trash2,
  Upload, Music, Sliders, Pencil, Plus,
  Link2
} from 'lucide-react';
import { FocusSession, Task, Goal, Routine } from '../types';
import { storage, generateUUID } from '../lib/storage';
import { getLocalDateString } from '../lib/dateUtils';
import { alarmAudio, BUILTIN_RINGTONES } from '../lib/alarmAudio';
import { alarmService, FocusAlarm } from '../lib/alarmService';
import { syncGoalProgressFromFocus } from '../lib/goalTaskSync';
import { ProgressiveActions } from '../components/ProgressiveActions';
import { LinkModeSelector } from '../components/LinkModeSelector';
import { TaskRoutineFocusSwitcher, type WorkAreaSection } from '../components/TaskRoutineFocusSwitcher';
import { CardCloseButton } from '../components/CardCloseButton';
import { ConfirmModal } from '../components/ConfirmModal';

interface FocusViewProps {
  sessions: FocusSession[];
  tasks: Task[];
  goals: Goal[];
  routines?: Routine[];
  profileId: string;
  activeWorkAreaSection: WorkAreaSection;
  onSelectWorkAreaSection: (section: WorkAreaSection) => void;
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
}

type FocusMenuTab = 'timer' | 'alarms' | 'ringtones';

interface FocusTimerState {
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  endsAt: number | null;
  customMin: number;
  selectedTask: string;
  selectedGoal: string;
  sessionLabel: string;
  soundEnabled: boolean;
  sprintCount?: number;
}

const DEFAULT_FOCUS_TIMER: FocusTimerState = {
  totalSeconds: 25 * 60,
  remainingSeconds: 25 * 60,
  isRunning: false,
  endsAt: null,
  customMin: 25,
  selectedTask: '',
  selectedGoal: '',
  sessionLabel: 'Deep Work Sprint',
  soundEnabled: true
};

function parseFocusTimerState(saved: Partial<FocusTimerState> | null | undefined): FocusTimerState {
  if (!saved) return DEFAULT_FOCUS_TIMER;
  const totalSeconds = Number.isFinite(saved.totalSeconds) && saved.totalSeconds! > 0
    ? saved.totalSeconds!
    : DEFAULT_FOCUS_TIMER.totalSeconds;
  const endsAt = Number.isFinite(saved.endsAt) ? saved.endsAt! : null;
  const isRunning = saved.isRunning === true && endsAt !== null;
  const remainingSeconds = isRunning
    ? Math.max(0, Math.ceil((endsAt! - Date.now()) / 1000))
    : Number.isFinite(saved.remainingSeconds)
      ? Math.max(0, Math.min(totalSeconds, saved.remainingSeconds!))
      : totalSeconds;

  return {
    totalSeconds,
    remainingSeconds,
    isRunning,
    endsAt: isRunning ? endsAt : null,
    customMin: Number.isFinite(saved.customMin) ? saved.customMin! : 25,
    selectedTask: typeof saved.selectedTask === 'string' ? saved.selectedTask : '',
    selectedGoal: typeof saved.selectedGoal === 'string' ? saved.selectedGoal : '',
    sessionLabel: typeof saved.sessionLabel === 'string' ? saved.sessionLabel : DEFAULT_FOCUS_TIMER.sessionLabel,
    soundEnabled: typeof saved.soundEnabled === 'boolean' ? saved.soundEnabled : true,
    sprintCount: Number.isFinite(saved.sprintCount) ? saved.sprintCount! : 0
  };
}

function readFocusTimerFromLS(profileId: string): FocusTimerState {
  try {
    const raw = localStorage.getItem(`om_focus_timer_v1_${profileId}`);
    if (!raw) return DEFAULT_FOCUS_TIMER;
    return parseFocusTimerState(JSON.parse(raw));
  } catch {
    return DEFAULT_FOCUS_TIMER;
  }
}

export const FocusView: React.FC<FocusViewProps> = ({
  sessions,
  tasks,
  goals,
  routines = [],
  profileId,
  activeWorkAreaSection,
  onSelectWorkAreaSection,
  onRefresh,
  onSuccess
}) => {
  // Navigation Tabs in Focus Menu
  const [activeMenuTab, setActiveMenuTab] = useState<FocusMenuTab>(() =>
    activeWorkAreaSection === 'focus-alarms'
      ? 'alarms'
      : activeWorkAreaSection === 'focus-ringtones'
        ? 'ringtones'
        : 'timer'
  );
  useEffect(() => {
    if (activeWorkAreaSection === 'focus-timer') setActiveMenuTab('timer');
    else if (activeWorkAreaSection === 'focus-alarms') {
      setActiveMenuTab('alarms');
      setIsAddingAlarm(true);
    }
    else if (activeWorkAreaSection === 'focus-ringtones') setActiveMenuTab('ringtones');
  }, [activeWorkAreaSection]);

  // Focus Timer States — initial load from localStorage (sync), then migrate to IndexedDB
  const initialTimerRef = useRef<FocusTimerState | null>(null);
  if (!initialTimerRef.current) initialTimerRef.current = readFocusTimerFromLS(profileId);
  const initialTimer = initialTimerRef.current;
  const [totalSeconds, setTotalSeconds] = useState(initialTimer.totalSeconds);
  const [remainingSeconds, setRemainingSeconds] = useState(initialTimer.remainingSeconds);
  const [isRunning, setIsRunning] = useState(initialTimer.isRunning);
  const [endsAt, setEndsAt] = useState<number | null>(initialTimer.endsAt);
  const [customMin, setCustomMin] = useState(initialTimer.customMin);
  const [selectedTask, setSelectedTask] = useState(initialTimer.selectedTask);
  const [selectedGoal, setSelectedGoal] = useState(initialTimer.selectedGoal);
  const [sessionLabel, setSessionLabel] = useState(initialTimer.sessionLabel);
  const [soundEnabled, setSoundEnabled] = useState(initialTimer.soundEnabled);
  const [timerProfileId, setTimerProfileId] = useState(profileId);

  // Pomodoro sprint counter (4 sprints → long break)
  const [sprintCount, setSprintCount] = useState(0);

  // Alarm delete confirmation
  const [alarmToDelete, setAlarmToDelete] = useState<string | null>(null);

  // Session delete confirmation
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  // Load timer state from IndexedDB on mount (overrides localStorage)
  useEffect(() => {
    storage.getSingleton<FocusTimerState>('focusTimerState').then(saved => {
      if (!saved) return;
      const state = parseFocusTimerState(saved);
      setTotalSeconds(state.totalSeconds);
      setRemainingSeconds(state.remainingSeconds);
      setIsRunning(state.isRunning);
      setEndsAt(state.endsAt);
      setCustomMin(state.customMin);
      setSelectedTask(state.selectedTask);
      setSelectedGoal(state.selectedGoal);
      setSessionLabel(state.sessionLabel);
      setSoundEnabled(state.soundEnabled);
      if (state.sprintCount !== undefined) setSprintCount(state.sprintCount);
    }).catch(() => {});
  }, []);

  // Alarm Clock States
  const [alarmsList, setAlarmsList] = useState<FocusAlarm[]>(() => alarmService.getFocusAlarms());
  const [newAlarmTime, setNewAlarmTime] = useState('08:00');
  const [newAlarmLabel, setNewAlarmLabel] = useState('');
  const [newAlarmRingtone, setNewAlarmRingtone] = useState(alarmAudio.getDefaultRingtoneId());
  const [newAlarmDays, setNewAlarmDays] = useState<number[]>([1, 2, 3, 4, 5]); // Weekdays default
  const [isAddingAlarm, setIsAddingAlarm] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<FocusAlarm | null>(null);
  const [alarmTitleMode, setAlarmTitleMode] = useState<'routine' | 'manual'>('manual');
  const [selectedRoutineId, setSelectedRoutineId] = useState<string>('');
  const [availableRoutines, setAvailableRoutines] = useState<Routine[]>(routines || []);

  // Ringtone Studio States
  const [selectedDefaultRingtone, setSelectedDefaultRingtone] = useState(alarmAudio.getDefaultRingtoneId());
  const [volume, setVolume] = useState(() => Math.round(alarmAudio.getVolume() * 100));
  const [customRingtone, setCustomRingtone] = useState(() => alarmAudio.getCustomRingtone());
  const [previewingRingtone, setPreviewingRingtone] = useState<string | null>(null);

  const [breakMode, setBreakMode] = useState(false);

  const completedTimerRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const alarmFormRef = useRef<HTMLFormElement | null>(null);
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up ringtone preview timeout on unmount
  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current !== null) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (timerProfileId === profileId) return;
    storage.getSingleton<FocusTimerState>('focusTimerState').then(saved => {
      const state = parseFocusTimerState(saved);
      setTotalSeconds(state.totalSeconds);
      setRemainingSeconds(state.remainingSeconds);
      setIsRunning(state.isRunning);
      setEndsAt(state.endsAt);
      setCustomMin(state.customMin);
      setSelectedTask(state.selectedTask);
      setSelectedGoal(state.selectedGoal);
      setSessionLabel(state.sessionLabel);
      setSoundEnabled(state.soundEnabled);
      setTimerProfileId(profileId);
      completedTimerRef.current = false;
    }).catch(() => {
      setTimerProfileId(profileId);
      completedTimerRef.current = false;
    });
  }, [profileId, timerProfileId]);

  useEffect(() => {
    if (timerProfileId !== profileId) return;
    const timerState: FocusTimerState = {
      totalSeconds,
      remainingSeconds,
      isRunning,
      endsAt,
      customMin,
      selectedTask,
      selectedGoal,
      sessionLabel,
      soundEnabled,
      sprintCount
    };
    storage.setSingleton('focusTimerState', timerState).catch(err => {
      console.warn('Could not save focus timer state:', err);
    });
  }, [
    profileId, timerProfileId, totalSeconds, remainingSeconds, isRunning, endsAt,
    customMin, selectedTask, selectedGoal, sessionLabel, soundEnabled, sprintCount
  ]);

  // Sync alarms when updated
  const refreshAlarms = () => {
    setAlarmsList([...alarmService.getFocusAlarms()]);
  };

  // Focus timer countdown
  useEffect(() => {
    if (timerProfileId !== profileId || !isRunning || endsAt === null) return;
    const tick = () => {
      const secondsLeft = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemainingSeconds(secondsLeft);
      if (secondsLeft === 0 && !completedTimerRef.current) {
        completedTimerRef.current = true;
        setIsRunning(false);
        setEndsAt(null);
        if (soundEnabled) {
          alarmService.triggerAlarm({
            id: generateUUID(),
            type: 'focus_timer',
            title: 'Deep Work Sprint Complete!',
            subtitle: sessionLabel || 'Great job staying in deep focus.',
            timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            ringtone: selectedDefaultRingtone
          });
        }
        void handleFinishSession(totalSeconds);
        // Pomodoro sprint tracking
        const isBreakSession = sessionLabel === 'Short Break' || sessionLabel === 'Long Break';
        if (!isBreakSession) {
          setSprintCount(prev => {
            const next = prev + 1;
            return next >= 4 ? 0 : next;
          });
        }
        // After completing a sprint, offer a break timer
        setBreakMode(!isBreakSession);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [
    timerProfileId, profileId, isRunning, endsAt, totalSeconds, soundEnabled,
    sessionLabel, selectedTask, selectedGoal, selectedDefaultRingtone
  ]);

  const handleStartBreak = (minutes: number) => {
    const secs = minutes * 60;
    setTotalSeconds(secs);
    setRemainingSeconds(secs);
    setSessionLabel(minutes <= 5 ? 'Short Break' : 'Long Break');
    setBreakMode(false);
    completedTimerRef.current = false;
    setEndsAt(Date.now() + secs * 1000);
    setIsRunning(true);
  };

  const handleStart = () => {
    if (!isRunning) {
      setBreakMode(false);
      completedTimerRef.current = false;
      setEndsAt(Date.now() + remainingSeconds * 1000);
      setIsRunning(true);
    }
  };

  const handlePause = () => {
    if (isRunning && endsAt !== null) {
      setRemainingSeconds(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
      setEndsAt(null);
      setIsRunning(false);
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setEndsAt(null);
    setRemainingSeconds(totalSeconds);
    completedTimerRef.current = false;
  };

  const handleSetPreset = (minutes: number) => {
    if (isRunning) return;
    const secs = minutes * 60;
    setTotalSeconds(secs);
    setRemainingSeconds(secs);
    setEndsAt(null);
    setCustomMin(minutes);
  };

  const handleApplyCustom = () => {
    if (isRunning) return;
    const s = Math.max(1, customMin * 60);
    setTotalSeconds(s);
    setRemainingSeconds(s);
    setEndsAt(null);
  };

  const handleFinishSession = async (elapsedOverride?: number) => {
    const elapsed = elapsedOverride ?? (totalSeconds - remainingSeconds || totalSeconds);
    const now = Date.now();
    const newSession: FocusSession = {
      id: generateUUID(),
      taskId: selectedTask || null,
      goalId: selectedGoal || null,
      label: sessionLabel || 'Focus Session',
      durationSeconds: elapsed,
      minutes: Number((elapsed / 60).toFixed(1)),
      date: getLocalDateString(),
      startedAt: now - elapsed * 1000,
      endedAt: now,
      createdAt: now,
      updatedAt: now
    };

    await storage.put('focus', newSession);
    if (newSession.goalId) {
      await syncGoalProgressFromFocus(newSession.goalId);
    }
    onSuccess(`Focus session logged (${Math.round(elapsed / 60)} minutes)`);
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
    if (previewTimeoutRef.current !== null) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
    if (previewingRingtone === ringtoneId) {
      alarmAudio.stop();
      setPreviewingRingtone(null);
      return;
    }
    setPreviewingRingtone(ringtoneId);
    alarmAudio.previewRingtone(ringtoneId);
    previewTimeoutRef.current = setTimeout(() => {
      previewTimeoutRef.current = null;
      setPreviewingRingtone(null);
    }, 4500);
  };

  // Custom ringtone upload handler — saves to IndexedDB to avoid localStorage quota issues
  const handleCustomAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      onSuccess('Ringtone must be under 2 MB. Choose a smaller file.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const saved = alarmAudio.setCustomRingtone(file.name, dataUrl);
      if (saved) {
        // Also persist to IndexedDB for cross-device sync
        storage.setSingleton('customRingtone', { name: file.name, dataUrl }).catch(() => {});
        setCustomRingtone({ name: file.name, dataUrl });
        setSelectedDefaultRingtone('custom');
        onSuccess(`Custom ringtone "${file.name}" saved`);
        handlePreview('custom');
      }
    };
    reader.onerror = () => onSuccess('⚠ Could not read audio file.');
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
      const f = (routine.frequency || 'daily').toLowerCase();
      if (f === 'weekdays') {
        setNewAlarmDays([1, 2, 3, 4, 5]);
      } else if (f === 'daily') {
        setNewAlarmDays([0, 1, 2, 3, 4, 5, 6]);
      } else if (f === 'sunday') {
        setNewAlarmDays([0]);
      } else if (f === 'monday') {
        setNewAlarmDays([1]);
      } else if (f === 'tuesday') {
        setNewAlarmDays([2]);
      } else if (f === 'wednesday') {
        setNewAlarmDays([3]);
      } else if (f === 'thursday') {
        setNewAlarmDays([4]);
      } else if (f === 'friday') {
        setNewAlarmDays([5]);
      } else if (f === 'saturday') {
        setNewAlarmDays([6]);
      } else {
        const currentDay = new Date().getDay();
        setNewAlarmDays([currentDay]);
      }
    }
  };

  // Add Alarm Handler
  const handleCreateAlarm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlarmTime) return;

    void alarmService.requestNotificationPermission();

    const matchedRoutine = selectedRoutineId
      ? availableRoutines.find(r => r.id === selectedRoutineId)
      : null;

    const updates = {
      time: newAlarmTime,
      label: newAlarmLabel.trim() || (matchedRoutine ? matchedRoutine.name : 'Focus Alarm'),
      ringtone: newAlarmRingtone,
      days: newAlarmDays,
      linkedRoutineId: selectedRoutineId || null,
      linkedRoutineName: matchedRoutine ? matchedRoutine.name : null,
      sourceType: selectedRoutineId ? 'routine' as const : 'manual' as const
    };
    if (editingAlarm) {
      alarmService.updateFocusAlarm(editingAlarm.id, updates);
      onSuccess(`Alarm updated for ${newAlarmTime}${matchedRoutine ? ` linked with "${matchedRoutine.name}"` : ''}`);
    } else {
      alarmService.addFocusAlarm({ ...updates, enabled: true });
      onSuccess(`Alarm scheduled for ${newAlarmTime}${matchedRoutine ? ` linked with "${matchedRoutine.name}"` : ''}`);
    }

    setNewAlarmLabel('');
    setSelectedRoutineId('');
    setAlarmTitleMode('manual');
    setIsAddingAlarm(!editingAlarm);
    setEditingAlarm(null);
    refreshAlarms();
  };

  const handleEditAlarm = (alarm: FocusAlarm) => {
    setEditingAlarm(alarm);
    setNewAlarmTime(alarm.time);
    setNewAlarmLabel(alarm.label);
    setNewAlarmRingtone(alarm.ringtone);
    setNewAlarmDays(alarm.days || []);
    setSelectedRoutineId(alarm.linkedRoutineId || '');
    setAlarmTitleMode(alarm.sourceType === 'routine' ? 'routine' : 'manual');
    setIsAddingAlarm(true);
    requestAnimationFrame(() => alarmFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const handleCancelAlarmEdit = () => {
    setEditingAlarm(null);
    setIsAddingAlarm(false);
    setSelectedRoutineId('');
    setAlarmTitleMode('manual');
    setNewAlarmLabel('');
  };

  const toggleAlarmStatus = (alarm: FocusAlarm) => {
    alarmService.updateFocusAlarm(alarm.id, { enabled: !alarm.enabled });
    refreshAlarms();
  };

  const deleteAlarm = (id: string) => {
    setAlarmToDelete(id);
  };
  const confirmDeleteAlarm = () => {
    if (alarmToDelete) {
      alarmService.deleteFocusAlarm(alarmToDelete);
      refreshAlarms();
      onSuccess('Alarm removed');
      setAlarmToDelete(null);
    }
  };

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const toggleDaySelection = (dayIdx: number) => {
    if (newAlarmDays.includes(dayIdx)) {
      setNewAlarmDays(newAlarmDays.filter(d => d !== dayIdx));
    } else {
      setNewAlarmDays([...newAlarmDays, dayIdx].sort());
    }
  };

  // Keyboard shortcuts for the timer (Space = start/pause, R = reset, Escape = stop preview)
  useEffect(() => {
    if (activeMenuTab !== 'timer') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in an input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (isRunning) handlePause();
        else handleStart();
      } else if (e.code === 'KeyR' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleReset();
      } else if (e.code === 'Escape' && previewingRingtone) {
        alarmAudio.stop();
        if (previewTimeoutRef.current !== null) {
          clearTimeout(previewTimeoutRef.current);
          previewTimeoutRef.current = null;
        }
        setPreviewingRingtone(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeMenuTab, isRunning, previewingRingtone]);

  const totalFocusSeconds = sessions.reduce((sum, s) => sum + (Number(s.durationSeconds) || 0), 0);
  const totalFocusHours = (totalFocusSeconds / 3600).toFixed(1);
  const today = getLocalDateString();
  const todaySessions = sessions.filter(s => s.date === today);
  const todayMinutes = Math.round(todaySessions.reduce((sum, s) => sum + (Number(s.durationSeconds) || 0), 0) / 60);

  // Weekly stats (Mon-Sun)
  const weekSessions = useMemo(() => {
    const now = new Date();
    const daysSinceMonday = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - daysSinceMonday);
    const mondayStr = getLocalDateString(monday);
    return sessions.filter(s => s.date && s.date >= mondayStr);
  }, [sessions]);
  const weekMinutes = Math.round(weekSessions.reduce((sum, s) => sum + (Number(s.durationSeconds) || 0), 0) / 60);
  const weekHours = (weekMinutes / 60).toFixed(1);

  const progressPercent = totalSeconds > 0 ? ((totalSeconds - remainingSeconds) / totalSeconds) * 100 : 0;
  const strokeDashoffset = 565.48 - (565.48 * (100 - progressPercent)) / 100;

  return (
    <div className="task-area-card-view space-y-6" data-focus-view>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            Focus
          </h1>
          <button
            type="button"
            aria-label={`Alarm Sound: ${soundEnabled ? 'ON' : 'OFF'}`}
            title={`Alarm Sound: ${soundEnabled ? 'ON' : 'OFF'}`}
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) handlePreview(selectedDefaultRingtone);
              onSuccess(next ? 'Chime enabled' : 'Muted');
            }}
            className={`flex items-center justify-center rounded-lg p-1.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 ${
              soundEnabled
                ? 'text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200'
                : 'text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
            }`}
          >
            {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <TaskRoutineFocusSwitcher
            activeSection={activeWorkAreaSection}
            taskCount={tasks.filter(task => !task.done).length}
            onSelectSection={onSelectWorkAreaSection}
            onOpenAlarmClock={() => {
              setIsAddingAlarm(true);
            }}
          />
        </div>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: Deep Work Sprint Timer                                 */}
      {/* ============================================================== */}
      {activeMenuTab === 'timer' && (
        <div data-focus-timer className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Focus Clock Main Card (7 cols) */}
          <div className="focus-flat-card lg:col-span-7 rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-8 flex flex-col items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
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
                  className="stroke-amber-600 dark:stroke-amber-400 transition-all duration-500"
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
            <div className="flex flex-wrap justify-center gap-3">
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
                  aria-pressed={totalSeconds === p.m * 60}
                  className={`focus-preset-tab border-b-2 border-transparent px-2 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    totalSeconds === p.m * 60
                      ? 'border-amber-600 text-amber-700 dark:border-amber-400 dark:text-amber-300'
                      : 'text-amber-800 hover:border-amber-500 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
                  } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Play / Pause / Reset Controls */}
            <div className="focus-timer-controls mt-6 flex items-center justify-center gap-3">
              {!isRunning ? (
                <button
                  type="button"
                  onClick={handleStart}
                  className="focus-timer-primary-action flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-bold cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>Start Sprint</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePause}
                  className="focus-timer-primary-action flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-bold cursor-pointer"
                >
                  <Pause className="h-4 w-4 fill-current" />
                  <span>Pause Session</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleReset}
                className="focus-timer-reset-action flex h-12 w-12 items-center justify-center rounded-lg cursor-pointer"
                title="Reset Timer"
                aria-label="Reset timer"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              {(totalSeconds - remainingSeconds > 60) && (
                <button
                  type="button"
                  onClick={() => void handleFinishSession()}
                  className="flex items-center gap-1.5 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-pointer"
                  title="Complete & Log Session Now"
                >
                  <Check className="h-4 w-4" />
                  <span>Log Now</span>
                </button>
              )}
            </div>

            {/* Pomodoro Sprint Counter */}
            {!breakMode && (
              <div className="mt-3 flex items-center justify-center gap-1.5">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className={`h-2 w-2 rounded-full transition-colors ${i < sprintCount ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                ))}
                <span className="ml-1.5 text-xs text-slate-400 tabular-nums">Sprint {sprintCount + 1}/4</span>
              </div>
            )}

            {/* End time projection */}
            {isRunning && remainingSeconds > 0 && (
              <div className="mt-1 text-xs text-slate-400">
                Ends at {new Date(Date.now() + remainingSeconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}

            {/* Break Timer Prompt */}
            {breakMode && !isRunning && (
              <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-800/60 dark:bg-emerald-950/30">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  {sprintCount === 0 ? '4 sprints done! Take a long break.' : 'Sprint complete! Take a break?'}
                </p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => handleStartBreak(5)} className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 cursor-pointer">
                    5m Short
                  </button>
                  <button type="button" onClick={() => handleStartBreak(15)} className={`rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 cursor-pointer ${sprintCount === 0 ? 'ring-2 ring-emerald-400' : ''}`}>
                    15m Long
                  </button>
                  <button type="button" onClick={() => setBreakMode(false)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer">
                    Skip
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Task Linkage & Focus Telemetry (5 cols) */}
          <div className="lg:col-span-5">
            <div className="focus-flat-card rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-card dark:border-slate-800/80 dark:bg-slate-900 space-y-4">
              <div className="space-y-4">
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

                    className="focus-flat-field mt-1 h-9 w-full px-3 text-xs text-slate-900 focus:outline-none dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Link to Task
                  </label>
                  <select
                    value={selectedTask}
                    onChange={e => setSelectedTask(e.target.value)}
                    className="focus-flat-field mt-1 h-9 w-full px-2.5 text-xs text-slate-900 focus:outline-none dark:text-white"
                  >
                    <option value="">No task linked</option>
                    {tasks.filter(t => !t.done).map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Goal for Focus Session
                  </label>
                  <select
                    value={selectedGoal}
                    onChange={e => setSelectedGoal(e.target.value)}
                    className="focus-flat-field mt-1 h-9 w-full px-2.5 text-xs text-slate-900 focus:outline-none dark:text-white"
                  >
                    <option value="">No goal linked</option>
                    {goals.map(g => (
                      <option key={g.id} value={g.id}>{g.title}</option>
                    ))}
                  </select>
                </div>

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
                      className="focus-flat-field h-9 flex-1 px-3 font-mono text-xs dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCustom}
                      disabled={isRunning}
                      className="focus-flat-control px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      Set Time
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="focus-telemetry-stat py-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Today
                    </div>
                    <div className="mt-1 font-mono text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                      {todayMinutes}m
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{todaySessions.length} sprints</div>
                  </div>

                  <div className="focus-telemetry-stat py-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      This Week
                    </div>
                    <div className="mt-1 font-mono text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                      {weekHours}h
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{weekSessions.length} sprints</div>
                  </div>

                  <div className="focus-telemetry-stat py-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      All-Time
                    </div>
                    <div className="mt-1 font-mono text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                      {totalFocusHours}h
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{sessions.length} blocks</div>
                  </div>
                </div>
              </div>

              {/* Session History */}
              {todaySessions.length > 0 && (
                <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                  <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Today's Sessions</h3>
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {[...todaySessions].sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0)).map(s => (
                      <div key={s.id} className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <div className="min-w-0 truncate">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{s.label}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-slate-400">
                          <span className="font-mono tabular-nums">{Math.round((s.durationSeconds || 0) / 60)}m</span>
                          <span>{s.startedAt ? new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                          <button
                            type="button"
                            onClick={() => setSessionToDelete(s.id)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-300 hover:text-rose-500 transition-opacity cursor-pointer"
                            title="Delete session"
                            aria-label={`Delete session ${s.label || ''}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: Alarm Clock & Scheduled Alarms                          */}
      {/* ============================================================== */}
      {activeMenuTab === 'alarms' && (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {(isAddingAlarm || alarmsList.length === 0) && (
          <div className={`focus-alarm-panel rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-5 ${
            alarmsList.length > 0 && isAddingAlarm ? 'lg:col-span-5' : 'lg:col-span-12'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
              <div className="focus-alarm-icon flex h-8 w-8 items-center justify-center rounded-lg">
                  <Clock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editingAlarm ? 'Edit Alarm' : 'New alarm'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Set time and repeat days</p>
              </div>
              </div>
              {alarmsList.length > 0 && isAddingAlarm && (
                <CardCloseButton label="alarm form" onClick={() => setIsAddingAlarm(false)} />
              )}
            </div>

            {isAddingAlarm && (
              <form ref={alarmFormRef} onSubmit={handleCreateAlarm} className="mt-4 space-y-3 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Alarm Time (24h)
                    </label>
                    <ThemedDateTimeInput
                      type="time"
                      required
                      value={newAlarmTime}
                      onChange={e => setNewAlarmTime(e.target.value)}
                      className="focus-alarm-field mt-1 h-10 w-full rounded-xl border px-3 font-mono text-sm font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Ringtone
                    </label>
                    <select
                      value={newAlarmRingtone}
                      onChange={e => setNewAlarmRingtone(e.target.value)}
                      className="focus-alarm-field mt-1 h-10 w-full rounded-xl border px-3 text-xs font-medium"
                    >
                      {BUILTIN_RINGTONES.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                      {customRingtone && (
                        <option value="custom">{customRingtone.name} (Custom)</option>
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
                    <LinkModeSelector
                      value={alarmTitleMode}
                      ariaLabel="Alarm routine link mode"
                      className="focus-alarm-mode"
                      options={[{ value: 'routine', label: 'Link Routine' }, { value: 'manual', label: 'Manual' }]}
                      onChange={mode => {
                        if (mode === 'manual') {
                          setAlarmTitleMode('manual');
                          setSelectedRoutineId('');
                          return;
                        }
                        setAlarmTitleMode('routine');
                        if (selectedRoutineId || availableRoutines.length === 0) return;
                        const routine = availableRoutines[0];
                        setSelectedRoutineId(routine.id);
                        setNewAlarmLabel(routine.name);
                        const frequency = (routine.frequency || 'daily').toLowerCase();
                        if (frequency === 'weekdays') setNewAlarmDays([1, 2, 3, 4, 5]);
                        else if (frequency === 'daily') setNewAlarmDays([0, 1, 2, 3, 4, 5, 6]);
                        else if (frequency === 'sunday') setNewAlarmDays([0]);
                        else if (frequency === 'monday') setNewAlarmDays([1]);
                        else if (frequency === 'tuesday') setNewAlarmDays([2]);
                        else if (frequency === 'wednesday') setNewAlarmDays([3]);
                        else if (frequency === 'thursday') setNewAlarmDays([4]);
                        else if (frequency === 'friday') setNewAlarmDays([5]);
                        else if (frequency === 'saturday') setNewAlarmDays([6]);
                        else setNewAlarmDays([new Date().getDay()]);
                      }}
                    />
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
                              className="focus-alarm-field h-10 w-full rounded-xl border px-3 text-xs font-semibold cursor-pointer"
                            >
                              <option value="">-- Choose a Routine to Link --</option>
                              {availableRoutines.map(r => (
                                <option key={r.id} value={r.id}>
                                  {r.name} {r.startTime ? `(${r.startTime}${r.endTime ? ` - ${r.endTime}` : ''})` : ''} • {r.frequency}
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

                              className="focus-alarm-field h-9 w-full rounded-xl border px-3 text-xs"
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

                        className="focus-alarm-field h-9 w-full rounded-xl border px-3 text-xs"
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
                          aria-pressed={isSelected}
                          onClick={() => toggleDaySelection(idx)}
                          className={`focus-alarm-day rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                            isSelected
                              ? 'text-emerald-700 dark:text-emerald-300'
                                : 'text-slate-600 hover:border-emerald-500 hover:text-emerald-800 dark:text-slate-300 dark:hover:text-emerald-200'
                          }`}
                        >
                          {dayName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="focus-alarm-actions flex items-center justify-end gap-2 border-t pt-2">
                  <button
                    type="button"
                    onClick={handleCancelAlarmEdit}
                    className="focus-alarm-cancel rounded-xl px-3 py-1.5 text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="focus-alarm-save rounded-xl border px-4 py-1.5 text-xs font-bold cursor-pointer"
                  >
                    {editingAlarm ? 'Update Alarm' : 'Save Alarm'}
                  </button>
                </div>
              </form>
            )}

            {!isAddingAlarm && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/80 p-4 dark:border-slate-700/80">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Create an alarm to set a reminder that repeats on selected days.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddingAlarm(true)}
                  className="focus-alarm-save inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Add Alarm
                </button>
              </div>
            )}
          </div>
          )}

          {alarmsList.length > 0 && (
          <div className={`focus-alarm-panel min-w-0 space-y-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900 ${
            isAddingAlarm ? 'lg:col-span-7' : 'lg:col-span-12'
          }`}>
            <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Scheduled Alarms
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Plays ringtone and triggers full-screen alerts.
                  </p>
                </div>
                {!isAddingAlarm && (
                  <button
                    type="button"
                    onClick={() => setIsAddingAlarm(true)}
                    className="focus-alarm-save inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    Add Alarm
                  </button>
                )}
              </div>
            </div>
            <div className="grid gap-3 pt-1 [grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))]">
              {[...alarmsList].sort((a, b) => (a.time || '').localeCompare(b.time || '')).map(alarm => {
                  const ringtoneMeta = BUILTIN_RINGTONES.find(r => r.id === alarm.ringtone) || {
                    name: alarm.ringtone === 'custom' ? 'Custom Ringtone' : 'Om Namah Shivay'
                  };
                  return (
                    <div
                      key={alarm.id}
                      className={`flex min-w-0 flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border transition-all ${
                        alarm.enabled
                          ? 'border-slate-200/80 bg-slate-50/40 dark:border-slate-700/70 dark:bg-slate-800/35'
                          : 'border-slate-200 bg-white opacity-60 dark:border-slate-800 dark:bg-slate-800/40'
                      }`}
                    >
                      <div className="min-w-0 flex-[1_1_9rem] space-y-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
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

                      <div className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-3">
                        <ProgressiveActions label={`More actions for ${alarm.label}`} className="min-w-0 max-w-full">
                          <button
                            type="button"
                            onClick={() => handleEditAlarm(alarm)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                            title="Edit Alarm"
                            aria-label={`Edit alarm ${alarm.label}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePreview(alarm.ringtone)}
                            className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                            title="Test Alarm Sound"
                          >
                            <Volume2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteAlarm(alarm.id)}
                            className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                            title="Delete Alarm"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </ProgressiveActions>

                        {/* ON/OFF Switch */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={alarm.enabled}
                          aria-label={`${alarm.label || 'Alarm'} ${alarm.enabled ? 'on' : 'off'}`}
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

                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: Ringtone & Audio Studio ("khud se ringtone rakhne ka")  */}
      {/* ============================================================== */}
      {activeMenuTab === 'ringtones' && (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Preset Ringtones Catalog (7 cols) */}
          <div data-ringtone-catalog className="lg:col-span-7 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card dark:border-slate-800/80 dark:bg-slate-900 space-y-4">
            <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Music className="h-4 w-4 text-indigo-600" />
                <span>Built-in Synthesizer Ringtones</span>
              </h2>
            </div>

            <div className="space-y-2.5">
              {BUILTIN_RINGTONES.map(r => {
                const isSelected = selectedDefaultRingtone === r.id;
                const isPlaying = previewingRingtone === r.id;
                return (
                  <div
                    key={r.id}
                    className={`ringtone-flat-row flex items-center justify-between p-3.5 border-b transition-colors ${
                      isSelected
                        ? 'border-amber-500'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handlePreview(r.id)}
                        className={`ringtone-flat-preview flex h-10 w-10 items-center justify-center transition-colors cursor-pointer ${
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
                            <span className="ringtone-flat-badge px-2 py-0.5 text-[9px] font-bold text-amber-800 dark:text-amber-300">
                              Active Default
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{r.description}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSelectedDefaultRingtone(r.id);
                        alarmAudio.setDefaultRingtoneId(r.id);
                        onSuccess(`Default ringtone set to "${r.name}"`);
                        handlePreview(r.id);
                      }}
                      className={`ringtone-flat-select px-2 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                        isSelected
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-amber-800 hover:border-amber-500 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
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
          <div className="lg:col-span-5" data-ringtone-controls>
            {/* Custom Ringtone Upload Card ("khud se ringtone rakhne ka feature") */}
            <div className="focus-flat-card rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-card dark:border-slate-800/80 dark:bg-slate-900 space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="theme-icon-chip flex h-9 w-9 items-center justify-center rounded-xl">
                  <Upload className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Custom Ringtone Uploader
                  </h3>
                </div>
              </div>

              {customRingtone ? (
                <div className="ringtone-flat-content p-4 space-y-3">
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
                      className="ringtone-flat-action flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-white cursor-pointer"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                      <span>{previewingRingtone === 'custom' ? 'Playing...' : 'Play Custom Audio'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        alarmAudio.removeCustomRingtone();
                        setCustomRingtone(null);
                        setSelectedDefaultRingtone('om_namah_shivay');
                        onSuccess('Custom ringtone removed');
                      }}
                      className="ringtone-flat-icon-action p-2 text-rose-600 cursor-pointer"
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
                    className={`w-full py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                      selectedDefaultRingtone === 'custom'
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
                    }`}
                  >
                    {selectedDefaultRingtone === 'custom' ? '✓ Set as Default Alarm Ringtone' : 'Make this Default Ringtone'}
                  </button>
                </div>
              ) : (
                <div className="ringtone-flat-content p-6 text-center">
                  <Music className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    No custom audio uploaded yet
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Supports MP3, WAV, OGG, AAC up to 2 MB
                  </p>
                  <label className="ringtone-upload-trigger mt-3 flex h-[3.75rem] w-full items-center justify-center gap-1.5 text-xs font-bold cursor-pointer transition-colors">
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

            {/* Volume controls share the uploader's outer card. */}
            <div className="border-t border-slate-100 pt-4 dark:border-slate-800 space-y-4">
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
                className="ringtone-flat-control w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <Volume2 className="h-4 w-4" />
                <span>Test Current Volume</span>
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Alarm delete confirmation */}
      <ConfirmModal
        isOpen={alarmToDelete !== null}
        title="Delete alarm?"
        message="This alarm will be permanently removed."
        confirmText="Delete"
        isDanger={true}
        onConfirm={confirmDeleteAlarm}
        onCancel={() => setAlarmToDelete(null)}
      />

      {/* Session delete confirmation */}
      <ConfirmModal
        isOpen={sessionToDelete !== null}
        title="Delete session?"
        message="This focus session record will be permanently removed."
        confirmText="Delete"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={async () => {
          if (sessionToDelete) {
            await storage.delete('focus', sessionToDelete);
            onRefresh();
            onSuccess('Session removed');
            setSessionToDelete(null);
          }
        }}
        onCancel={() => setSessionToDelete(null)}
      />
    </div>
  );
};
