import React, { useState } from 'react';
import {
  Repeat, Clock, Trash2, CheckCircle2,
  Flame, Check, Bell, Link2, Edit3, X, Target,
  BellRing, Zap, AlertTriangle, CheckSquare
} from 'lucide-react';
import { Routine, Habit, HabitLog, Goal, Task, TaskPriority, ReminderItem } from '../types';
import { storage, generateUUID } from '../lib/storage';
import { syncGoalProgressFromHabits, syncGoalProgressFromRoutines, syncGoalProgressFromTasks } from '../lib/goalTaskSync';
import { ConfirmModal } from '../components/ConfirmModal';
import { alarmService } from '../lib/alarmService';
import { computeItemDelay } from '../components/ProjectTimelinePlan';
import { BUILTIN_RINGTONES, useRingtoneOptions, getDefaultRingtoneId } from '../lib/alarmAudio';

interface RoutineViewProps {
  routines: Routine[];
  habits: Habit[];
  habitLogs: HabitLog[];
  goals?: Goal[];
  tasks?: Task[];
  reminders?: ReminderItem[];
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
}

export const RoutineView: React.FC<RoutineViewProps> = ({
  routines,
  habits,
  habitLogs,
  goals = [],
  tasks = [],
  reminders = [],
  onRefresh,
  onSuccess
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const { ringtoneOptions, defaultRingtone } = useRingtoneOptions();
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'routine' | 'habit'; id: string; name: string } | null>(null);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [habitFilter, setHabitFilter] = useState<'all' | 'linked' | 'standalone' | string>('all');

  // Creation form Genesis options
  const [routineArmGenesis, setRoutineArmGenesis] = useState(false);
  const [routineTaskPriority, setRoutineTaskPriority] = useState<TaskPriority>('High');
  const [routineAlarmRingtone, setRoutineAlarmRingtone] = useState<string>(() => getDefaultRingtoneId());

  const [habitArmGenesis, setHabitArmGenesis] = useState(false);
  const [habitTaskPriority, setHabitTaskPriority] = useState<TaskPriority>('Medium');
  const [habitAlarmRingtone, setHabitAlarmRingtone] = useState<string>(() => getDefaultRingtoneId());

  // Quick preset alarm modal
  const [quickAlarmItem, setQuickAlarmItem] = useState<{
    id: string;
    title: string;
    type: 'routine' | 'habit';
    scheduledTime?: string;
  } | null>(null);
  const [alarmPresetChoice, setAlarmPresetChoice] = useState<'5m' | '15m' | '30m' | '1h' | 'tonight' | 'tomorrow'>('15m');
  const [quickAlarmRingtone, setQuickAlarmRingtone] = useState<string>(() => getDefaultRingtoneId());

  // Task Genesis Modal State
  const [genesisModal, setGenesisModal] = useState<{
    isOpen: boolean;
    sourceType: 'routine' | 'habit';
    sourceId?: string;
    title: string;
    priority: TaskPriority;
    dueAt: string;
    goalId: string;
    armAlarm: boolean;
    ringtone: string;
    alarmTime: string;
  }>({
    isOpen: false,
    sourceType: 'routine',
    title: '',
    priority: 'High',
    dueAt: today,
    goalId: goals[0]?.id || '',
    armAlarm: true,
    ringtone: getDefaultRingtoneId(),
    alarmTime: '08:00'
  });

  // New Routine Time Block form
  const [routineName, setRoutineName] = useState('');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('08:00');
  const [routineFreq, setRoutineFreq] = useState<'daily' | 'weekdays' | 'weekly' | 'custom'>('daily');
  const [routineCat, setRoutineCat] = useState<'personal' | 'work' | 'learning' | 'health' | 'spiritual' | 'social'>('health');
  const [routineNote, setRoutineNote] = useState('');
  const [routineInputMode, setRoutineInputMode] = useState<'manual' | 'link'>('manual');
  const [routineGoalId, setRoutineGoalId] = useState<string>('');

  // New Habit form
  const [habitName, setHabitName] = useState('');
  const [habitInputMode, setHabitInputMode] = useState<'manual' | 'linkRoutine' | 'linkGoal'>('manual');
  const [habitFrequency, setHabitFrequency] = useState('Daily');
  const [timesPerDay, setTimesPerDay] = useState(1);
  const [isOccurrencesManual, setIsOccurrencesManual] = useState(false);
  const [editOccurrencesManual, setEditOccurrencesManual] = useState(false);
  const [slotTimes, setSlotTimes] = useState<string[]>([
    '08:00', '14:00', '20:00', '10:00', '16:00', '18:00', '21:00', '22:00'
  ]);
  const [time1, setTime1] = useState('08:00');
  const [time2, setTime2] = useState('14:00');
  const [time3, setTime3] = useState('20:00');
  const [linkedRoutineId, setLinkedRoutineId] = useState<string>('');
  const [habitGoalId, setHabitGoalId] = useState<string>('');

  const handleUpdateSlotTime = (index: number, val: string) => {
    setSlotTimes(prev => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
    if (index === 0) setTime1(val);
    if (index === 1) setTime2(val);
    if (index === 2) setTime3(val);
  };

  // Past 7 days calculation for streak visualization
  const past7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      iso: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-US', { weekday: 'narrow' })
    };
  });

  const handleSelectRoutineForHabit = (rId: string) => {
    setLinkedRoutineId(rId);
    if (rId) {
      const match = routines.find(r => r.id === rId);
      if (match) {
        if (!habitName.trim() || routines.some(rt => rt.name === habitName)) {
          setHabitName(match.name);
        }
        if (match.startTime) {
          setTime1(match.startTime);
          handleUpdateSlotTime(0, match.startTime);
        }
      }
    }
  };

  const handleSelectGoalForRoutine = (gId: string) => {
    setRoutineGoalId(gId);
    if (!gId) return;
    const g = goals.find(goal => goal.id === gId);
    if (g) {
      if (!routineName.trim() || goals.some(gl => routineName.includes(gl.title))) {
        setRoutineName(`Focus: ${g.title}`);
      }
      const cat = (g.category || '').toLowerCase();
      if (cat.includes('health')) setRoutineCat('health');
      else if (cat.includes('work') || cat.includes('career')) setRoutineCat('work');
      else if (cat.includes('learn')) setRoutineCat('learning');
      else if (cat.includes('spirit')) setRoutineCat('spiritual');
      else setRoutineCat('personal');
    }
  };

  const handleSelectGoalForHabit = (gId: string) => {
    setHabitGoalId(gId);
    if (!gId) return;
    const g = goals.find(goal => goal.id === gId);
    if (g) {
      if (!habitName.trim() || goals.some(gl => habitName.includes(gl.title))) {
        setHabitName(`Daily Practice: ${g.title}`);
      }
    }
  };

  const switchToLinkMode = () => {
    setHabitInputMode('linkRoutine');
    setHabitGoalId('');
    if (routines.length > 0 && !linkedRoutineId) {
      handleSelectRoutineForHabit(routines[0].id);
    }
  };

  const switchToGoalMode = () => {
    setHabitInputMode('linkGoal');
    setLinkedRoutineId('');
    if (goals.length > 0 && !habitGoalId) {
      handleSelectGoalForHabit(goals[0].id);
    }
  };

  const switchToManualMode = () => {
    setHabitInputMode('manual');
    setLinkedRoutineId('');
    setHabitGoalId('');
  };

  const handleAddRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routineName.trim()) return;

    const now = Date.now();
    const routineId = generateUUID();
    const newRoutine: Routine = {
      id: routineId,
      name: routineName.trim(),
      startTime,
      endTime,
      time: startTime,
      frequency: routineFreq,
      category: routineCat,
      note: routineNote.trim() || undefined,
      active: true,
      goalId: routineGoalId || undefined,
      createdAt: now,
      updatedAt: now
    };

    await storage.put('routines', newRoutine);

    if (routineArmGenesis) {
      const taskId = generateUUID();
      const newTask: Task = {
        id: taskId,
        title: `Execute Routine: ${newRoutine.name}`,
        domain: 'health',
        priority: routineTaskPriority,
        dueAt: today,
        date: today,
        goalId: routineGoalId || null,
        done: false,
        status: 'open',
        createdAt: now,
        updatedAt: now
      };
      await storage.put('tasks', newTask);

      const alarmDueAt = `${today}T${startTime}`;
      await storage.put('reminders', {
        id: generateUUID(),
        title: `⏰ Routine Genesis Alarm: ${newTask.title}`,
        dueAt: alarmDueAt,
        repeatRule: 'none',
        status: 'open',
        linkedId: taskId,
        alarmEnabled: true,
        ringtone: routineAlarmRingtone,
        createdAt: now,
        updatedAt: now
      });

      if (routineGoalId) {
        await syncGoalProgressFromTasks(routineGoalId, taskId, false);
      }
    }

    if (routineGoalId) {
      await syncGoalProgressFromRoutines(routineGoalId);
    }
    onSuccess(routineArmGenesis ? '✓ Routine block & Task Genesis with Alarm deployed!' : (routineGoalId ? '✓ Routine block linked to Goal & added' : '✓ Time block added to routine'));
    setRoutineName('');
    setRoutineNote('');
    setRoutineArmGenesis(false);
    onRefresh();
  };

  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!habitName.trim()) return;

    const now = Date.now();
    const times = Array.from({ length: timesPerDay }).map((_, i) => slotTimes[i] || `${String(8 + i * 2).padStart(2, '0')}:00`);
    const matchedRoutine = routines.find(r => r.id === linkedRoutineId);

    const habitId = generateUUID();
    const newHabit: Habit = {
      id: habitId,
      name: habitName.trim(),
      frequency: habitFrequency,
      timesPerDay,
      times,
      linkedRoutineId: linkedRoutineId || undefined,
      routineId: linkedRoutineId || undefined,
      linkedRoutineName: matchedRoutine?.name || undefined,
      goalId: habitGoalId || undefined,
      createdAt: now,
      updatedAt: now
    };

    await storage.put('habits', newHabit);

    if (habitArmGenesis) {
      const taskId = generateUUID();
      const newTask: Task = {
        id: taskId,
        title: `Daily Habit: ${newHabit.name}`,
        domain: 'health',
        priority: habitTaskPriority,
        dueAt: today,
        date: today,
        goalId: habitGoalId || null,
        done: false,
        status: 'open',
        createdAt: now,
        updatedAt: now
      };
      await storage.put('tasks', newTask);

      const alarmDueAt = `${today}T${times[0] || '08:00'}`;
      await storage.put('reminders', {
        id: generateUUID(),
        title: `⏰ Habit Genesis Alarm: ${newTask.title}`,
        dueAt: alarmDueAt,
        repeatRule: 'none',
        status: 'open',
        linkedId: taskId,
        alarmEnabled: true,
        ringtone: habitAlarmRingtone,
        createdAt: now,
        updatedAt: now
      });

      if (habitGoalId) {
        await syncGoalProgressFromTasks(habitGoalId, taskId, false);
      }
    }

    if (habitGoalId) {
      await syncGoalProgressFromHabits(habitGoalId);
    }
    onSuccess(
      habitArmGenesis
        ? '✓ Habit & Task Genesis with Alarm deployed!'
        : habitGoalId
        ? '✓ Habit linked to Goal & ready to track'
        : linkedRoutineId
        ? `✓ New habit created and linked to "${matchedRoutine?.name}"`
        : '✓ New habit created'
    );
    setHabitName('');
    setLinkedRoutineId('');
    setHabitGoalId('');
    setHabitArmGenesis(false);
    onRefresh();
  };

  const handleSaveQuickAlarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAlarmItem) return;

    let targetDueAt = '';
    const now = new Date();

    if (alarmPresetChoice === '5m') {
      targetDueAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString().slice(0, 16);
    } else if (alarmPresetChoice === '15m') {
      targetDueAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString().slice(0, 16);
    } else if (alarmPresetChoice === '30m') {
      targetDueAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString().slice(0, 16);
    } else if (alarmPresetChoice === '1h') {
      targetDueAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 16);
    } else if (alarmPresetChoice === 'tonight') {
      targetDueAt = `${today}T20:00`;
    } else if (alarmPresetChoice === 'tomorrow') {
      const tm = new Date();
      tm.setDate(tm.getDate() + 1);
      targetDueAt = `${tm.toISOString().slice(0, 10)}T08:00`;
    }

    await storage.put('reminders', {
      id: generateUUID(),
      title: `⏰ Reminder Alarm: ${quickAlarmItem.title}`,
      dueAt: targetDueAt,
      repeatRule: 'none',
      status: 'open',
      linkedId: quickAlarmItem.id,
      alarmEnabled: true,
      ringtone: quickAlarmRingtone,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    onSuccess(`🔔 Reminder alarm scheduled for "${quickAlarmItem.title}" at ${targetDueAt.replace('T', ' ')}!`);
    setQuickAlarmItem(null);
    onRefresh();
  };

  const handleLogHabit = async (habitId: string, occurrence = 0, targetDate = today) => {
    const key = `${habitId}|${targetDate}|${occurrence}`;
    const existing = habitLogs.find(l => l.key === key);

    if (existing) {
      await storage.delete('habitLogs', existing.id);
    } else {
      const newLog: HabitLog = {
        id: generateUUID(),
        key,
        habitId,
        date: targetDate,
        occurrence,
        createdAt: Date.now()
      };
      await storage.put('habitLogs', newLog);
    }

    // Reflect habit execution in linked Goal progress!
    const targetHabit = habits.find(h => h.id === habitId);
    if (targetHabit?.goalId) {
      const res = await syncGoalProgressFromHabits(targetHabit.goalId);
      if (res.targetGoal) {
        onSuccess(`✓ Habit logged! Goal "${res.targetGoal.title}" progress updated to ${res.targetGoal.progress}%`);
      }
    }

    onRefresh();
  };

  const handleToggleRoutineBlock = async (r: Routine) => {
    const isDone = r.completedDate === today;
    const nextDone = !isDone;
    const updated: Routine = {
      ...r,
      completedDate: nextDone ? today : null,
      updatedAt: Date.now()
    };
    await storage.put('routines', updated);

    if (r.goalId) {
      const res = await syncGoalProgressFromRoutines(r.goalId, r.id, nextDone);
      if (res.targetGoal) {
        onSuccess(
          nextDone
            ? `✓ Routine block done! Goal "${res.targetGoal.title}" progress updated to ${res.targetGoal.progress}%`
            : `Routine block unmarked. Goal "${res.targetGoal.title}" progress adjusted to ${res.targetGoal.progress}%`
        );
      } else {
        onSuccess(nextDone ? '✓ Routine block completed for today' : 'Routine block unmarked');
      }
    } else {
      onSuccess(nextDone ? '✓ Routine block completed for today' : 'Routine block unmarked');
    }
    onRefresh();
  };

  const handleOpenGenesisForRoutine = (r: Routine) => {
    setGenesisModal({
      isOpen: true,
      sourceType: 'routine',
      sourceId: r.id,
      title: `Execute Routine: ${r.name}`,
      priority: 'High',
      dueAt: today,
      goalId: r.goalId || goals[0]?.id || '',
      armAlarm: true,
      ringtone: 'zen_bell',
      alarmTime: r.startTime || '08:00'
    });
  };

  const handleOpenGenesisForHabit = (h: Habit) => {
    setGenesisModal({
      isOpen: true,
      sourceType: 'habit',
      sourceId: h.id,
      title: `Daily Habit: ${h.name}`,
      priority: 'Medium',
      dueAt: today,
      goalId: h.goalId || goals[0]?.id || '',
      armAlarm: true,
      ringtone: 'morning_chime',
      alarmTime: (h.times && h.times[0]) || '09:00'
    });
  };

  const handleSaveGenesisTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genesisModal.title.trim()) return;

    const taskId = generateUUID();
    const newTask: Task = {
      id: taskId,
      title: genesisModal.title.trim(),
      domain: 'health',
      priority: genesisModal.priority,
      dueAt: genesisModal.dueAt,
      date: genesisModal.dueAt,
      goalId: genesisModal.goalId || null,
      routineId: genesisModal.sourceType === 'routine' ? genesisModal.sourceId : null,
      habitId: genesisModal.sourceType === 'habit' ? genesisModal.sourceId : null,
      done: false,
      status: 'open',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await storage.put('tasks', newTask);

    if (genesisModal.goalId) {
      await syncGoalProgressFromTasks(genesisModal.goalId, taskId, false);
    }

    if (genesisModal.armAlarm) {
      const alarmDueAt = `${genesisModal.dueAt}T${genesisModal.alarmTime}`;
      await storage.put('reminders', {
        id: generateUUID(),
        title: `⏰ Task Genesis Alarm: ${newTask.title}`,
        dueAt: alarmDueAt,
        repeatRule: 'none',
        status: 'open',
        linkedId: taskId,
        linkedType: 'task',
        alarmEnabled: true,
        ringtone: genesisModal.ringtone,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    setGenesisModal(prev => ({ ...prev, isOpen: false }));
    onSuccess(`⚡ Task Genesis deployed for "${newTask.title}"! Task and audio reminder armed.`);
    onRefresh();
  };

  const handleTriggerUrgentAlarm = (title: string, subtitle?: string) => {
    alarmService.triggerAlarm({
      id: generateUUID(),
      type: 'reminder',
      title: `🚨 DELAY ALERT: ${title}`,
      subtitle: subtitle || 'Routine block is past scheduled time window!',
      timeStr: 'NOW',
      ringtone: 'zen_bell'
    });
    onSuccess(`🚨 Urgent alarm ringing for "${title}"!`);
  };

  const handleUpdateHabitRoutine = async (habit: Habit, newRoutineId: string) => {
    const matchedRoutine = routines.find(r => r.id === newRoutineId);
    const updated: Habit = {
      ...habit,
      linkedRoutineId: newRoutineId || null,
      routineId: newRoutineId || null,
      linkedRoutineName: matchedRoutine?.name || null,
      updatedAt: Date.now()
    };
    await storage.put('habits', updated);
    onSuccess(newRoutineId ? `✓ Linked "${habit.name}" to routine "${matchedRoutine?.name}"` : `✓ Unlinked "${habit.name}" to standalone`);
    onRefresh();
  };

  const handleSaveEditedHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHabit) return;

    const matchedRoutine = routines.find(r => r.id === editingHabit.linkedRoutineId);
    const updated: Habit = {
      ...editingHabit,
      name: editingHabit.name.trim(),
      linkedRoutineName: matchedRoutine?.name || null,
      routineId: editingHabit.linkedRoutineId || null,
      goalId: editingHabit.goalId || null,
      updatedAt: Date.now()
    };

    await storage.put('habits', updated);
    if (updated.goalId) {
      await syncGoalProgressFromHabits(updated.goalId);
    }
    onSuccess(`✓ Updated habit "${updated.name}"`);
    setEditingHabit(null);
    onRefresh();
  };

  const handleDeleteRoutine = (r: Routine) => {
    setDeleteTarget({ type: 'routine', id: r.id, name: r.name });
  };

  const handleDeleteHabit = (h: Habit) => {
    setDeleteTarget({ type: 'habit', id: h.id, name: h.name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'routine') {
        const targetRoutine = routines.find(r => r.id === deleteTarget.id);
        await storage.delete('routines', deleteTarget.id);
        // Automatically detach habits that were linked to this routine
        const linked = habits.filter(h => h.linkedRoutineId === deleteTarget.id || h.routineId === deleteTarget.id);
        for (const h of linked) {
          await storage.put('habits', {
            ...h,
            linkedRoutineId: null,
            routineId: null,
            linkedRoutineName: null,
            updatedAt: Date.now()
          });
        }
        if (targetRoutine?.goalId) {
          await syncGoalProgressFromRoutines(targetRoutine.goalId);
        }
        onSuccess('✓ Routine block deleted');
      } else {
        const targetHabit = habits.find(h => h.id === deleteTarget.id);
        await storage.delete('habits', deleteTarget.id);
        if (targetHabit?.goalId) {
          await syncGoalProgressFromHabits(targetHabit.goalId);
        }
        onSuccess('✓ Habit deleted');
      }
      setDeleteTarget(null);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete', err);
    }
  };

  const handleSetAlarmFromRoutine = (routine: Routine) => {
    const alarmTime = routine.startTime || routine.time || '07:00';
    let days = [1, 2, 3, 4, 5];
    if (routine.frequency === 'daily') days = [0, 1, 2, 3, 4, 5, 6];
    else if (routine.frequency === 'weekly') days = [new Date().getDay()];

    alarmService.addFocusAlarm({
      time: alarmTime,
      label: routine.name,
      ringtone: 'zen_bell',
      enabled: true,
      days,
      linkedRoutineId: routine.id,
      linkedRoutineName: routine.name,
      sourceType: 'routine'
    });

    onSuccess(`⏰ Alarm scheduled for "${routine.name}" at ${alarmTime}!`);
    onRefresh();
  };

  // Compute streak for a habit
  const getStreak = (habitId: string) => {
    let streak = 0;
    const checkDate = new Date();
    // Check backwards from today
    for (let i = 0; i < 60; i++) {
      const dateStr = checkDate.toISOString().slice(0, 10);
      const hasLog = habitLogs.some(l => l.habitId === habitId && l.date === dateStr);
      if (hasLog) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (i === 0) {
        // Might not have logged today yet, check yesterday
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  };

  // Filter habits for the habit tracker list
  const filteredHabits = habits.filter(h => {
    if (habitFilter === 'all') return true;
    if (habitFilter === 'linked') return Boolean(h.linkedRoutineId || h.routineId);
    if (habitFilter === 'standalone') return !h.linkedRoutineId && !h.routineId;
    // Otherwise filter by specific routine ID
    return h.linkedRoutineId === habitFilter || h.routineId === habitFilter;
  });

  const linkedHabitsCount = habits.filter(h => h.linkedRoutineId || h.routineId).length;
  const standaloneHabitsCount = habits.length - linkedHabitsCount;

  return (
    <div className="space-y-6">
      {/* Top Header & Architecture Manual CTA */}
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            Routine & Habits Architecture
          </h1>
        </div>
      </div>

      {/* 4 Essential Metric Cards (Matching Dashboard Style) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Routine Blocks</span>
            <Clock className="h-4 w-4 text-indigo-500 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">
            {routines.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            {routines.filter(r => r.frequency === 'daily').length} scheduled daily
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Active Habits</span>
            <Repeat className="h-4 w-4 text-amber-500 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">
            {habits.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            {linkedHabitsCount} linked to routines
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Habits Today</span>
            <CheckSquare className="h-4 w-4 text-emerald-500 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">
            {habits.filter(h => habitLogs.some(l => l.habitId === h.id && l.date === today)).length}/{habits.length || 0}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            Logged for today
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Adherence Rate</span>
            <Flame className="h-4 w-4 text-rose-500 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">
            {habits.length > 0
              ? Math.round((habits.filter(h => habitLogs.some(l => l.habitId === h.id && l.date === today)).length / habits.length) * 100)
              : 0}%
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            Daily ritual consistency
          </div>
        </div>
      </div>

      {/* Routine Delay Alert Banner in RoutineView */}
      {(() => {
        const delayedRoutines = routines.filter(r => computeItemDelay(r).isDelayed && r.completedDate !== today);
        const nowTimeStr = new Date().toTimeString().slice(0, 5);
        const delayedHabits = habits.filter(h => {
          if (h.times && h.times.length > 0) {
            return h.times.some((t, idx) => {
              const isPast = t < nowTimeStr;
              const key = `${h.id}|${today}|${idx}`;
              const isDone = habitLogs.some(l => l.key === key);
              return isPast && !isDone;
            });
          }
          return false;
        });
        const totalRoutineDelays = delayedRoutines.length + delayedHabits.length;

        if (totalRoutineDelays > 0) {
          const firstDelayedTitle = delayedRoutines[0]?.name || delayedHabits[0]?.name || 'Routine Block';
          return (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border-2 border-rose-500/40 bg-gradient-to-r from-rose-500/15 via-rose-500/10 to-amber-500/15 p-4 dark:border-rose-900/60 dark:bg-rose-950/30">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-xs">
                  <span className="h-2.5 w-2.5 rounded-full bg-white animate-ping" />
                </span>
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                    <span>Routine & Habit Delays (⚠️ {totalRoutineDelays})</span>
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                    {totalRoutineDelays} items overdue today: {delayedRoutines.length > 0 ? `${delayedRoutines.length} routine time blocks ` : ''}{delayedHabits.length > 0 ? `· ${delayedHabits.length} atomic habits` : ''}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Past scheduled window without execution. Ring alarm or deploy Task Genesis.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTriggerUrgentAlarm(firstDelayedTitle, 'Routine or habit missed today!')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-500 cursor-pointer"
                >
                  <BellRing className="h-4 w-4 animate-bounce" />
                  <span>🚨 Ring Alarm</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (delayedRoutines.length > 0) handleOpenGenesisForRoutine(delayedRoutines[0]);
                    else if (delayedHabits.length > 0) handleOpenGenesisForHabit(delayedHabits[0]);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 cursor-pointer"
                >
                  <Zap className="h-3.5 w-3.5 text-amber-300" />
                  <span>⚡ Task Genesis</span>
                </button>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Forms Grid (Routine Genesis & Habit Genesis) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Schedule Routine Block (1st col) */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 text-xs">
                <Clock className="h-4 w-4" />
              </span>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Routine Genesis
              </h2>
            </div>
            <span className="text-[11px] font-semibold text-slate-400">
              Macro Container
            </span>
          </div>

          <form onSubmit={handleAddRoutine} className="mt-4 space-y-3.5">
            {/* BLOCK TITLE WITH INTEGRATED LINK GOAL / MANUAL TOGGLE (As in image.png) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Block Title / Purpose
                </label>
                {/* Mode Selector: Link Goal vs Manual */}
                <div className="flex items-center rounded-lg bg-slate-200/80 p-0.5 dark:bg-slate-700/80">
                  <button
                    type="button"
                    onClick={() => {
                      setRoutineInputMode('link');
                      if (goals.length > 0 && !routineGoalId) {
                        handleSelectGoalForRoutine(goals[0].id);
                      }
                    }}
                    className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer ${
                      routineInputMode === 'link'
                        ? 'bg-white text-indigo-600 shadow-2xs dark:bg-slate-900 dark:text-indigo-400'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <Link2 className="h-3 w-3" />
                    <span>Link Goal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRoutineInputMode('manual');
                      setRoutineGoalId('');
                    }}
                    className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer ${
                      routineInputMode === 'manual'
                        ? 'bg-white text-indigo-600 shadow-2xs dark:bg-slate-900 dark:text-indigo-400'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <span>Manual</span>
                  </button>
                </div>
              </div>

              {routineInputMode === 'link' && (
                <div className="mb-2 space-y-1.5 rounded-xl border border-indigo-200/80 bg-indigo-50/60 p-2.5 dark:border-indigo-900/60 dark:bg-indigo-950/30">
                  <label className="block text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                    Select Target Goal (🎯 Main, 🔹 Sub, or ▫️ Micro):
                  </label>
                  <select
                    value={routineGoalId}
                    onChange={e => handleSelectGoalForRoutine(e.target.value)}
                    className="h-8.5 w-full rounded-lg border border-indigo-300 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-indigo-700 dark:bg-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="">-- Choose Goal (🎯 Main, 🔹 Sub, ▫️ Micro, 🔸 Nano, ⚡ Atomic) --</option>
                    {goals.map(g => {
                      const lvl = g.level === 5 ? '⚡ Atomic' : g.level === 4 ? '🔸 Nano' : g.level === 3 ? '▫️ Micro' : g.level === 2 ? '🔹 Sub' : '🎯 Main';
                      return (
                        <option key={g.id} value={g.id}>
                          {lvl}: {g.title} ({g.progress}%)
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <input
                type="text"
                required
                value={routineName}
                onChange={e => setRoutineName(e.target.value)}
                placeholder="e.g. Morning Protocol & Meditation"
                className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  End Time
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Category
                </label>
                <select
                  value={routineCat}
                  onChange={e => setRoutineCat(e.target.value as any)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="health">Health & Vitality</option>
                  <option value="work">Work & Deep Focus</option>
                  <option value="learning">Study & Reflection</option>
                  <option value="spiritual">Spiritual Practice</option>
                  <option value="personal">Personal Operations</option>
                  <option value="social">Social Connection</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Cadence
                </label>
                <select
                  value={routineFreq}
                  onChange={e => setRoutineFreq(e.target.value as any)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="daily">Daily</option>
                  <option value="weekdays">Weekdays (Mon-Fri)</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Notes / Checklist Instructions
              </label>
              <input
                type="text"
                value={routineNote}
                onChange={e => setRoutineNote(e.target.value)}
                placeholder="Key action steps during this block..."
                className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Deploy Task Genesis with Alarm on Creation */}
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-2.5 dark:border-indigo-900/60 dark:bg-indigo-950/20 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-indigo-900 dark:text-indigo-200">
                <input
                  type="checkbox"
                  checked={routineArmGenesis}
                  onChange={e => setRoutineArmGenesis(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>⚡ Deploy Task Genesis with Alarm on Creation</span>
              </label>
              {routineArmGenesis && (
                <div className="grid grid-cols-2 gap-2 pt-1 text-[10px]">
                  <div>
                    <label className="text-slate-500 font-semibold">Priority</label>
                    <select
                      value={routineTaskPriority}
                      onChange={e => setRoutineTaskPriority(e.target.value as any)}
                      className="mt-0.5 h-7 w-full rounded border border-slate-200 bg-white px-1 dark:border-slate-700 dark:bg-slate-800 text-[10px]"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-500 font-semibold">Alarm Ringtone</label>
                    <select
                      value={routineAlarmRingtone}
                      onChange={e => setRoutineAlarmRingtone(e.target.value)}
                      className="mt-0.5 h-7 w-full rounded border border-slate-200 bg-white px-1 dark:border-slate-700 dark:bg-slate-800 text-[10px]"
                    >
                      {BUILTIN_RINGTONES.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 active:scale-98 transition-transform cursor-pointer"
            >
              ＋ Add Routine Block
            </button>
          </form>
        </section>

        {/* Create Habit & Link Routine in Habit (2nd col) */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 text-xs">
                <Repeat className="h-4 w-4" />
              </span>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Habit Genesis
              </h2>
            </div>
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              Atomic Behavior
            </span>
          </div>

          <form onSubmit={handleAddHabit} className="mt-4 space-y-3.5">
            {/* HABIT TITLE WITH INTEGRATED LINK & MANUAL OPTIONS (As in image.png) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Habit Title / Purpose
                </label>

                {/* Mode Selector above Habit Name: Link Goal vs Link Routine vs Manual */}
                <div className="flex items-center rounded-lg bg-slate-200/80 p-0.5 dark:bg-slate-700/80">
                  <button
                    type="button"
                    onClick={switchToGoalMode}
                    className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer ${
                      habitInputMode === 'linkGoal'
                        ? 'bg-white text-indigo-600 shadow-2xs dark:bg-slate-900 dark:text-indigo-400'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <Link2 className="h-3 w-3" />
                    <span>Link Goal</span>
                  </button>

                  <button
                    type="button"
                    onClick={switchToLinkMode}
                    className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer ${
                      habitInputMode === 'linkRoutine'
                        ? 'bg-white text-indigo-600 shadow-2xs dark:bg-slate-900 dark:text-indigo-400'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <Clock className="h-3 w-3" />
                    <span>Link Routine</span>
                  </button>

                  <button
                    type="button"
                    onClick={switchToManualMode}
                    className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer ${
                      habitInputMode === 'manual'
                        ? 'bg-white text-indigo-600 shadow-2xs dark:bg-slate-900 dark:text-indigo-400'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <span>Manual</span>
                  </button>
                </div>
              </div>

              {habitInputMode === 'linkGoal' && (
                <div className="mb-2 space-y-1.5 rounded-xl border border-indigo-200/80 bg-indigo-50/60 p-2.5 dark:border-indigo-900/60 dark:bg-indigo-950/30">
                  <label className="block text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                    Select Target Goal to Link *
                  </label>
                  <select
                    value={habitGoalId}
                    onChange={e => handleSelectGoalForHabit(e.target.value)}
                    className="h-8.5 w-full rounded-lg border border-indigo-300 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-indigo-700 dark:bg-slate-900 dark:text-white cursor-pointer font-medium"
                  >
                    <option value="">-- Choose Goal (🎯 Main, 🔹 Sub, ▫️ Micro, 🔸 Nano, ⚡ Atomic) --</option>
                    {goals.map(g => {
                      const lvl = g.level === 5 ? '⚡ Atomic' : g.level === 4 ? '🔸 Nano' : g.level === 3 ? '▫️ Micro' : g.level === 2 ? '🔹 Sub' : '🎯 Main';
                      return (
                        <option key={g.id} value={g.id}>
                          {lvl}: {g.title} ({g.progress}%)
                        </option>
                      );
                    })}
                  </select>
                  {habitGoalId && (
                    <span className="block text-[10px] text-indigo-800 dark:text-indigo-300">
                      ⚡ Logging this habit will automatically advance this goal's progress and roll up to parent goals!
                    </span>
                  )}
                </div>
              )}

              {habitInputMode === 'linkRoutine' && (
                <div className="mb-2 space-y-1.5 rounded-xl border border-indigo-200/80 bg-indigo-50/60 p-2.5 dark:border-indigo-900/60 dark:bg-indigo-950/30">
                  <label className="block text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                    Select Routine to Link *
                  </label>
                  <select
                    value={linkedRoutineId}
                    onChange={e => handleSelectRoutineForHabit(e.target.value)}
                    className="h-8.5 w-full rounded-lg border border-indigo-300 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-indigo-700 dark:bg-slate-900 dark:text-white cursor-pointer font-medium"
                  >
                    {routines.length === 0 ? (
                      <option value="">No routines created yet. Add a routine block first!</option>
                    ) : (
                      routines.map(r => (
                        <option key={r.id} value={r.id}>
                          🔗 {r.name} ({r.startTime || r.time} → {r.endTime || 'end'}) · {r.frequency}
                        </option>
                      ))
                    )}
                  </select>
                  {linkedRoutineId && (
                    <div className="flex items-center gap-1.5 text-[10px] text-indigo-700 dark:text-indigo-300">
                      <CheckCircle2 className="h-3 w-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span>
                        Linked to <strong>{routines.find(r => r.id === linkedRoutineId)?.name}</strong> — Slot synced to {time1}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <input
                type="text"
                required
                value={habitName}
                onChange={e => setHabitName(e.target.value)}
                placeholder="e.g. Read 20 pages, 100 Pushups, Cold Shower"
                className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Cadence
                </label>
                <select
                  value={habitFrequency}
                  onChange={e => setHabitFrequency(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="Daily">Daily</option>
                  <option value="Weekdays">Weekdays</option>
                  <option value="Weekly">Weekly</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Target Occurrences
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsOccurrencesManual(prev => !prev)}
                    className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    {isOccurrencesManual ? '📋 Presets' : '✍️ Manual'}
                  </button>
                </div>

                {isOccurrencesManual ? (
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={timesPerDay}
                      onChange={e => {
                        const val = Math.max(1, Math.min(24, Number(e.target.value) || 1));
                        setTimesPerDay(val);
                      }}
                      className="h-9 w-24 rounded-xl border border-slate-200 bg-white px-2.5 font-mono text-xs text-center font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      times per day
                    </span>
                  </div>
                ) : (
                  <select
                    value={timesPerDay > 5 ? 'manual' : timesPerDay}
                    onChange={e => {
                      if (e.target.value === 'manual') {
                        setIsOccurrencesManual(true);
                      } else {
                        setTimesPerDay(Number(e.target.value));
                      }
                    }}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value={1}>1 time per day</option>
                    <option value={2}>2 times per day</option>
                    <option value={3}>3 times per day</option>
                    <option value={4}>4 times per day</option>
                    <option value={5}>5 times per day</option>
                    <option value="manual">✍️ Manual / Custom count...</option>
                  </select>
                )}
              </div>
            </div>

            {/* Time Slot Inputs */}
            <div>
              <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Time Slots ({timesPerDay} {timesPerDay === 1 ? 'Slot' : 'Slots'}):
              </label>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: Math.min(timesPerDay, 6) }).map((_, idx) => (
                  <div key={idx}>
                    <label className="block text-[10px] text-slate-500 dark:text-slate-400">Slot {idx + 1}</label>
                    <input
                      type="time"
                      value={slotTimes[idx] || '08:00'}
                      onChange={e => handleUpdateSlotTime(idx, e.target.value)}
                      className="mt-0.5 h-8 w-full rounded-lg border border-slate-200 px-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                ))}
              </div>
              {timesPerDay > 6 && (
                <p className="mt-1 text-[10px] text-slate-400">
                  Additional slots (7 to {timesPerDay}) can be logged flexibly at any time of day.
                </p>
              )}
            </div>

            {/* Deploy Habit Genesis Task with Alarm on Creation */}
            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-2.5 dark:border-amber-900/60 dark:bg-amber-950/20 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-amber-900 dark:text-amber-200">
                <input
                  type="checkbox"
                  checked={habitArmGenesis}
                  onChange={e => setHabitArmGenesis(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <span>⚡ Deploy Habit Genesis Task with Alarm on Creation</span>
              </label>
              {habitArmGenesis && (
                <div className="grid grid-cols-2 gap-2 pt-1 text-[10px]">
                  <div>
                    <label className="text-slate-500 font-semibold">Priority</label>
                    <select
                      value={habitTaskPriority}
                      onChange={e => setHabitTaskPriority(e.target.value as any)}
                      className="mt-0.5 h-7 w-full rounded border border-slate-200 bg-white px-1 dark:border-slate-700 dark:bg-slate-800 text-[10px]"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-500 font-semibold">Alarm Ringtone</label>
                    <select
                      value={habitAlarmRingtone}
                      onChange={e => setHabitAlarmRingtone(e.target.value)}
                      className="mt-0.5 h-7 w-full rounded border border-slate-200 bg-white px-1 dark:border-slate-700 dark:bg-slate-800 text-[10px]"
                    >
                      {BUILTIN_RINGTONES.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-amber-500 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-600 active:scale-98 transition-transform cursor-pointer"
            >
              ＋ Save Habit Ritual
            </button>
          </form>
        </section>
      </div>

      {/* Routine Time Blocks Display with Nested Linked Habits */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Daily Routine Timeline ({routines.length} Blocks)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Each routine block hosts its assigned linked habits and audio alarms.
            </p>
          </div>
          <span className="text-[11px] font-medium text-slate-400">
            {habits.filter(h => h.linkedRoutineId || h.routineId).length} Habits assigned to routines
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {routines.length === 0 ? (
            <div className="col-span-full py-10 text-center text-xs text-slate-400">
              No routine time blocks defined. Add one above or load an Architecture Blueprint from the manual.
            </div>
          ) : (
            [...routines].sort((a, b) => (a.startTime || a.time || '').localeCompare(b.startTime || b.time || '')).map(r => {
              const linkedHabits = habits.filter(h => h.linkedRoutineId === r.id || h.routineId === r.id);
              const doneCount = linkedHabits.filter(h => habitLogs.some(l => l.habitId === h.id && l.date === today)).length;
              const percentDone = linkedHabits.length > 0 ? Math.round((doneCount / linkedHabits.length) * 100) : 0;

              return (
                <div
                  key={r.id}
                  className="relative rounded-2xl border border-slate-200/80 p-4 transition-all hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700 flex flex-col justify-between bg-slate-50/40 dark:bg-slate-800/20"
                >
                  <div>
                    {/* Header info */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200/50 dark:border-indigo-800/50">
                          {r.startTime || r.time} {r.endTime ? `→ ${r.endTime}` : ''}
                        </span>
                        {computeItemDelay(r).isDelayed && r.completedDate !== today && (
                          <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-white animate-pulse">
                            ⚠️ {computeItemDelay(r).label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {computeItemDelay(r).isDelayed && r.completedDate !== today && (
                          <button
                            type="button"
                            onClick={() => handleTriggerUrgentAlarm(r.name, `Scheduled for ${r.startTime || r.time} — past time!`)}
                            className="h-6 px-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-500 cursor-pointer flex items-center gap-1 text-[10px] font-bold shadow-2xs"
                            title="Ring Urgent Alarm"
                          >
                            <BellRing className="h-3 w-3 animate-bounce" />
                            <span>Alarm</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setQuickAlarmItem({ id: r.id, title: r.name, type: 'routine', scheduledTime: r.startTime || r.time })}
                          className="h-6 px-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                          title="Schedule Reminder Alarm"
                        >
                          <Bell className="h-3 w-3" />
                          <span>Set Alarm</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenGenesisForRoutine(r)}
                          className="h-6 rounded-lg bg-indigo-50 px-1.5 text-[10px] font-bold text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-400 cursor-pointer flex items-center gap-1"
                          title="Task Genesis with Reminder Alarm"
                        >
                          <Zap className="h-3 w-3 text-amber-500" />
                          <span>Genesis</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetAlarmFromRoutine(r)}
                          className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-1 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                          title="Schedule Zen Bell Alarm for this routine block"
                        >
                          <Bell className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRoutine(r)}
                          className="text-slate-400 hover:text-rose-500 transition-colors p-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          title="Delete routine block"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {r.name}
                    </div>

                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span className="capitalize">{r.category}</span>
                      <span>·</span>
                      <span className="capitalize">{r.frequency}</span>
                    </div>

                    {r.goalId && (() => {
                      const g = goals.find(goal => goal.id === r.goalId);
                      if (!g) return null;
                      const lvl = g.level === 5 ? '⚡ Atomic' : g.level === 4 ? '🔸 Nano' : g.level === 3 ? '▫️ Micro' : g.level === 2 ? '🔹 Sub' : '🎯 Main';
                      return (
                        <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                          <Target className="h-3 w-3 shrink-0 text-indigo-500" />
                          <span>{lvl}: {g.title} ({g.progress}%)</span>
                        </div>
                      );
                    })()}

                    {r.note && (
                      <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {r.note}
                      </p>
                    )}

                    {/* Block Completion Action */}
                    <button
                      type="button"
                      onClick={() => handleToggleRoutineBlock(r)}
                      className={`mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        r.completedDate === today
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{r.completedDate === today ? '✓ Block Completed Today' : 'Mark Block Complete'}</span>
                    </button>

                    {/* NESTED LINKED HABITS SECTION */}
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center justify-between text-[11px] mb-2">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Repeat className="h-3 w-3 text-amber-500" />
                          <span>Linked Habits ({linkedHabits.length})</span>
                        </span>
                        {linkedHabits.length > 0 && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                            percentDone === 100
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-slate-200/80 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                          }`}>
                            {doneCount}/{linkedHabits.length} done
                          </span>
                        )}
                      </div>

                      {linkedHabits.length > 0 ? (
                        <div className="space-y-1.5">
                          {linkedHabits.map(h => {
                            const isDone = habitLogs.some(l => l.habitId === h.id && l.date === today);
                            return (
                              <div
                                key={h.id}
                                className={`flex items-center justify-between p-2 rounded-xl text-xs transition-colors ${
                                  isDone
                                    ? 'bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 border border-emerald-200/60 dark:border-emerald-800/50'
                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700/60'
                                }`}
                              >
                                <span className={`truncate text-[11px] font-medium ${isDone ? 'line-through text-emerald-700 dark:text-emerald-400' : ''}`}>
                                  {h.name}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleLogHabit(h.id, 0)}
                                  className={`h-5.5 px-2 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                    isDone
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-emerald-950'
                                  }`}
                                >
                                  {isDone ? <Check className="h-3 w-3" /> : null}
                                  <span>{isDone ? 'Done' : 'Check'}</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectRoutineForHabit(r.id);
                            window.scrollTo({ top: 200, behavior: 'smooth' });
                          }}
                          className="w-full py-2 px-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 hover:text-indigo-600 hover:border-indigo-300 dark:hover:text-indigo-400 dark:hover:border-indigo-800 text-center transition-colors cursor-pointer"
                        >
                          ＋ Link habit to this routine block
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Habit Tracker Table & 7-Day Consistency Grid with Routine Link Badges */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3.5 dark:border-slate-800 gap-3">
          <div className="flex items-center gap-2.5">
            <Repeat className="h-4.5 w-4.5 text-amber-500" />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Habit Tracker & 7-Day Consistency (Today: {today})
              </h2>
              <p className="text-xs text-slate-400">
                Shows streak continuity and parent routine links.
              </p>
            </div>
          </div>

          {/* Habit Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setHabitFilter('all')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                habitFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              All ({habits.length})
            </button>
            <button
              type="button"
              onClick={() => setHabitFilter('linked')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                habitFilter === 'linked'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              Linked to Routine ({linkedHabitsCount})
            </button>
            <button
              type="button"
              onClick={() => setHabitFilter('standalone')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                habitFilter === 'standalone'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              Standalone ({standaloneHabitsCount})
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {filteredHabits.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No habits found matching filter. Define one above.
            </div>
          ) : (
            filteredHabits.map(h => {
              const occCount = h.timesPerDay || 1;
              const streak = getStreak(h.id);
              const parentRoutine = routines.find(r => r.id === (h.linkedRoutineId || h.routineId));
              const nowTimeStr = new Date().toTimeString().slice(0, 5);
              const isHabitOverdue = Boolean(h.times && h.times.length > 0 && h.times.some((t, idx) => {
                const isPast = t < nowTimeStr;
                const key = `${h.id}|${today}|${idx}`;
                const isDone = habitLogs.some(l => l.key === key);
                return isPast && !isDone;
              }));

              return (
                <div
                  key={h.id}
                  className="flex flex-col md:flex-row md:items-center md:justify-between py-3.5 gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">{h.name}</div>
                      {isHabitOverdue && (
                        <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-white animate-pulse">
                          ⚠️ Overdue Today
                        </span>
                      )}
                      {streak > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          <Flame className="h-3 w-3 fill-current" />
                          <span>{streak}d</span>
                        </span>
                      )}

                      {/* LINKED ROUTINE BADGE */}
                      {parentRoutine ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                          <Clock className="h-3 w-3 text-indigo-500" />
                          <span>Routine: {parentRoutine.name} ({parentRoutine.startTime || parentRoutine.time})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                          Standalone
                        </span>
                      )}

                      {/* LINKED GOAL BADGE */}
                      {h.goalId && (() => {
                        const g = goals.find(goal => goal.id === h.goalId);
                        if (!g) return null;
                        const lvl = g.level === 5 ? '⚡ Atomic' : g.level === 4 ? '🔸 Nano' : g.level === 3 ? '▫️ Micro' : g.level === 2 ? '🔹 Sub' : '🎯 Main';
                        return (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                            <Target className="h-3 w-3 text-indigo-500" />
                            <span>{lvl}: {g.title} ({g.progress}%)</span>
                          </span>
                        );
                      })()}
                    </div>

                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                      <span>{h.frequency} · {occCount}x per day</span>
                      <span>·</span>
                      {/* Routine Link Selector directly on row */}
                      <div className="inline-flex items-center gap-1">
                        <Link2 className="h-3 w-3 text-slate-400" />
                        <select
                          value={h.linkedRoutineId || h.routineId || ''}
                          onChange={e => handleUpdateHabitRoutine(h, e.target.value)}
                          className="text-[10px] font-medium bg-transparent border-0 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 focus:outline-none cursor-pointer"
                        >
                          <option value="">No Routine (Standalone)</option>
                          {routines.map(r => (
                            <option key={r.id} value={r.id}>
                              Link to: {r.name} ({r.startTime || r.time})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 7-Day Mini Dots + Today's Actions */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* 7-day mini bubbles */}
                    <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      {past7Days.map(day => {
                        const dayLogged = habitLogs.some(l => l.habitId === h.id && l.date === day.iso);
                        const isToday = day.iso === today;
                        return (
                          <div
                            key={day.iso}
                            className="flex flex-col items-center gap-0.5"
                            title={`${day.iso}: ${dayLogged ? 'Completed' : 'Not logged'}`}
                          >
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

                    {/* Today's log buttons */}
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: occCount }).map((_, idx) => {
                        const key = `${h.id}|${today}|${idx}`;
                        const isDone = habitLogs.some(l => l.key === key);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleLogHabit(h.id, idx)}
                            className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
                              isDone
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>{h.times?.[idx] || `Slot ${idx + 1}`}</span>
                          </button>
                        );
                      })}

                      {isHabitOverdue && (
                        <button
                          type="button"
                          onClick={() => handleTriggerUrgentAlarm(h.name, 'Habit slot overdue today!')}
                          className="h-7 px-2 rounded-lg bg-rose-600 text-white hover:bg-rose-500 cursor-pointer flex items-center gap-1 text-[10px] font-bold shadow-2xs"
                          title="Ring Urgent Alarm"
                        >
                          <BellRing className="h-3 w-3 animate-bounce" />
                          <span>Alarm</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setQuickAlarmItem({ id: h.id, title: h.name, type: 'habit', scheduledTime: h.times?.[0] })}
                        className="h-7 px-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                        title="Schedule Reminder Alarm"
                      >
                        <Bell className="h-3 w-3" />
                        <span>Set Alarm</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenGenesisForHabit(h)}
                        className="h-7 rounded-lg bg-indigo-50 px-2 text-[10px] font-bold text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-400 cursor-pointer flex items-center gap-1"
                        title="Task Genesis with Reminder Alarm"
                      >
                        <Zap className="h-3 w-3 text-amber-500" />
                        <span>Genesis</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingHabit(h)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                        title="Edit habit details & routine link"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteHabit(h)}
                        className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors cursor-pointer"
                        title="Delete habit"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* EDIT HABIT & ROUTINE LINK MODAL */}
      {editingHabit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Edit Habit & Link Routine
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingHabit(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedHabit} className="mt-4 space-y-3.5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40 space-y-2">
                <label className="block text-[11px] font-bold text-slate-900 dark:text-white">
                  Habit Name & Routine Anchor
                </label>

                <input
                  type="text"
                  required
                  value={editingHabit.name}
                  onChange={e => setEditingHabit({ ...editingHabit, name: e.target.value })}
                  placeholder="Habit name..."
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />

                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Link2 className="h-3 w-3 text-indigo-500" />
                    <span>Link Routine:</span>
                  </span>
                  <select
                    value={editingHabit.linkedRoutineId || editingHabit.routineId || ''}
                    onChange={e => {
                      const newRId = e.target.value;
                      const matched = routines.find(r => r.id === newRId);
                      setEditingHabit({
                        ...editingHabit,
                        linkedRoutineId: newRId || null,
                        routineId: newRId || null,
                        linkedRoutineName: matched?.name || null
                      });
                    }}
                    className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-transparent border-0 focus:outline-none cursor-pointer max-w-[200px] truncate"
                  >
                    <option value="">None (Standalone)</option>
                    {routines.map(r => (
                      <option key={r.id} value={r.id}>
                        🔗 {r.name} ({r.startTime || r.time})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Target className="h-3 w-3 text-indigo-500" />
                    <span>Link Goal:</span>
                  </span>
                  <select
                    value={editingHabit.goalId || ''}
                    onChange={e => {
                      setEditingHabit({
                        ...editingHabit,
                        goalId: e.target.value || null
                      });
                    }}
                    className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-transparent border-0 focus:outline-none cursor-pointer max-w-[200px] truncate"
                  >
                    <option value="">None (No Goal)</option>
                    {goals.map(g => {
                      const lvl = g.level === 5 ? '⚡ Atomic' : g.level === 4 ? '🔸 Nano' : g.level === 3 ? '▫️ Micro' : g.level === 2 ? '🔹 Sub' : '🎯 Main';
                      return (
                        <option key={g.id} value={g.id}>
                          {lvl}: {g.title} ({g.progress}%)
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Cadence
                  </label>
                  <select
                    value={editingHabit.frequency}
                    onChange={e => setEditingHabit({ ...editingHabit, frequency: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="Daily">Daily</option>
                    <option value="Weekdays">Weekdays</option>
                    <option value="Weekly">Weekly</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Target Occurrences
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditOccurrencesManual(prev => !prev)}
                      className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      {editOccurrencesManual ? '📋 Presets' : '✍️ Manual'}
                    </button>
                  </div>

                  {editOccurrencesManual ? (
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={24}
                        value={editingHabit.timesPerDay || 1}
                        onChange={e => {
                          const val = Math.max(1, Math.min(24, Number(e.target.value) || 1));
                          setEditingHabit({ ...editingHabit, timesPerDay: val });
                        }}
                        className="h-9 w-24 rounded-xl border border-slate-200 bg-white px-2.5 font-mono text-xs text-center font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        times per day
                      </span>
                    </div>
                  ) : (
                    <select
                      value={(editingHabit.timesPerDay || 1) > 5 ? 'manual' : (editingHabit.timesPerDay || 1)}
                      onChange={e => {
                        if (e.target.value === 'manual') {
                          setEditOccurrencesManual(true);
                        } else {
                          setEditingHabit({ ...editingHabit, timesPerDay: Number(e.target.value) });
                        }
                      }}
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value={1}>1 time per day</option>
                      <option value={2}>2 times per day</option>
                      <option value={3}>3 times per day</option>
                      <option value={4}>4 times per day</option>
                      <option value={5}>5 times per day</option>
                      <option value="manual">✍️ Manual / Custom count...</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingHabit(null)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TASK GENESIS MODAL WITH AUDIO ALARM SCHEDULING */}
      {genesisModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-black text-xs">
                  ⚡
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Task Genesis: Action Unit Deployment
                  </h3>
                  <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                    Source: {genesisModal.sourceType}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGenesisModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGenesisTask} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Task Title / Action Statement *
                </label>
                <input
                  type="text"
                  required
                  value={genesisModal.title}
                  onChange={e => setGenesisModal({ ...genesisModal, title: e.target.value })}
                  placeholder="Concrete executable action..."
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Priority
                  </label>
                  <select
                    value={genesisModal.priority}
                    onChange={e => setGenesisModal({ ...genesisModal, priority: e.target.value as any })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="High">High (Immediate)</option>
                    <option value="Medium">Medium (Balanced)</option>
                    <option value="Low">Low (Backlog)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Target Execution Date
                  </label>
                  <input
                    type="date"
                    required
                    value={genesisModal.dueAt}
                    onChange={e => setGenesisModal({ ...genesisModal, dueAt: e.target.value })}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Link Target Goal (Progress will auto-rollup)
                </label>
                <select
                  value={genesisModal.goalId}
                  onChange={e => setGenesisModal({ ...genesisModal, goalId: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">-- No Direct Goal Link --</option>
                  {goals.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.title} ({g.progress}%)
                    </option>
                  ))}
                </select>
              </div>

              {/* REMINDER ALARM CONTROLS */}
              <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/50 p-3.5 space-y-2.5 dark:border-indigo-900/60 dark:bg-indigo-950/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BellRing className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Arm Audio Reminder Alarm
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={genesisModal.armAlarm}
                    onChange={e => setGenesisModal({ ...genesisModal, armAlarm: e.target.checked })}
                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>

                {genesisModal.armAlarm && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400">
                        Alarm Time on Due Date
                      </label>
                      <input
                        type="time"
                        value={genesisModal.alarmTime}
                        onChange={e => setGenesisModal({ ...genesisModal, alarmTime: e.target.value })}
                        className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400">
                        Alarm Ringtone
                      </label>
                      <select
                        value={genesisModal.ringtone}
                        onChange={e => setGenesisModal({ ...genesisModal, ringtone: e.target.value })}
                        className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        {BUILTIN_RINGTONES.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setGenesisModal(prev => ({ ...prev, isOpen: false }))}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-extrabold text-white shadow-xs hover:bg-indigo-500 cursor-pointer"
                >
                  Deploy Task Genesis
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK PRESET ALARM MODAL FOR ROUTINES OR HABITS */}
      {quickAlarmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-white font-black">
                  <Bell className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Set Reminder Alarm
                  </h3>
                  <p className="text-[10px] text-slate-500 truncate max-w-[240px]">
                    {quickAlarmItem.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickAlarmItem(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickAlarm} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  When should the alarm ring?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: '5m', label: 'In 5 Mins' },
                    { id: '15m', label: 'In 15 Mins' },
                    { id: '30m', label: 'In 30 Mins' },
                    { id: '1h', label: 'In 1 Hour' },
                    { id: 'tonight', label: 'Tonight 8 PM' },
                    { id: 'tomorrow', label: 'Tomorrow 8 AM' }
                  ].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setAlarmPresetChoice(p.id as any)}
                      className={`rounded-xl py-2 px-1 text-center text-xs font-bold transition-all cursor-pointer ${
                        alarmPresetChoice === p.id
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Alarm Ringtone
                </label>
                <select
                  value={quickAlarmRingtone}
                  onChange={e => setQuickAlarmRingtone(e.target.value)}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {BUILTIN_RINGTONES.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setQuickAlarmItem(null)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-extrabold text-white shadow-xs hover:bg-amber-600 cursor-pointer"
                >
                  🔔 Arm Alarm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE ROUTINE/HABIT MODAL */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title={deleteTarget?.type === 'routine' ? 'Delete Routine Block?' : 'Delete Habit?'}
        message={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"?`
            : ''
        }
        confirmText={deleteTarget?.type === 'routine' ? 'Delete Block' : 'Delete Habit'}
        cancelText="Cancel"
        isDanger={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
