import React, { useState, useRef, useEffect } from 'react';
import {
  CheckSquare, Trash2, Calendar, Target, CheckCircle2,
  Circle, Edit3, Search, Filter, Check,
  Download, Save, History, Layers, ArrowRight,
  Volume2, Link2, Bell, BellRing, Zap, AlertTriangle, X, Flame, Plus
} from 'lucide-react';
import {
  Task, TaskDomain, TaskPriority, DailyPlanner, Goal,
  WorkProject, LearningItem, Skill, Routine, Habit, HabitLog, ReminderItem
} from '../types';
import { storage, generateUUID } from '../lib/storage';
import { syncGoalProgressFromTasks } from '../lib/goalTaskSync';
import { ConfirmModal } from '../components/ConfirmModal';
import { SlideTabs } from '../components/SlideTabs';
import { globalTextReader, isSpeechSynthesisSupported } from '../lib/voiceService';
import { alarmService } from '../lib/alarmService';
import { BUILTIN_RINGTONES } from '../lib/alarmAudio';

interface TasksViewProps {
  tasks: Task[];
  goals: Goal[];
  dailyPlanner?: DailyPlanner;
  workProjects?: WorkProject[];
  learningItems?: LearningItem[];
  skills?: Skill[];
  routines?: Routine[];
  habits?: Habit[];
  habitLogs?: HabitLog[];
  reminders?: ReminderItem[];
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
}

interface SavedTargetRecord {
  id: string;
  date: string;
  target: string;
  progress: number;
  pointsCount: number;
  pointsDone: number;
  savedAt: number;
  raw: DailyPlanner;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  goals,
  dailyPlanner,
  workProjects = [],
  learningItems = [],
  skills = [],
  routines = [],
  habits = [],
  habitLogs = [],
  reminders = [],
  onRefresh,
  onSuccess
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const [activeSubMenu, setActiveSubMenu] = useState<'roster' | 'dailyCommand' | 'kanban'>('roster');

  // Quick preset alarm modal
  const [quickAlarmItem, setQuickAlarmItem] = useState<{
    id: string;
    title: string;
    dueAt?: string;
  } | null>(null);
  const [alarmPresetChoice, setAlarmPresetChoice] = useState<'5m' | '15m' | '30m' | '1h' | 'tonight' | 'tomorrow' | 'custom'>('15m');
  const [quickCustomDate, setQuickCustomDate] = useState(today);
  const [quickCustomTime, setQuickCustomTime] = useState('18:00');
  const [quickAlarmRingtone, setQuickAlarmRingtone] = useState('digital_pulse');

  // Task Genesis Creation Alarm options in Task Roster
  const [armTaskGenesisAlarm, setArmTaskGenesisAlarm] = useState(false);
  const [taskGenesisAlarmTime, setTaskGenesisAlarmTime] = useState('09:00');
  const [taskGenesisRingtone, setTaskGenesisRingtone] = useState('digital_pulse');

  const handleTriggerUrgentAlarm = (taskTitle: string, subtitle?: string) => {
    alarmService.triggerAlarm({
      id: generateUUID(),
      type: 'reminder',
      title: `🚨 DELAY ALERT: ${taskTitle}`,
      subtitle: subtitle || 'Overdue action unit! Urgent execution required.',
      timeStr: 'NOW',
      ringtone: 'digital_pulse'
    });
    onSuccess(`🚨 Urgent alarm ringing for "${taskTitle}"!`);
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
      targetDueAt = `${tm.toISOString().slice(0, 10)}T09:00`;
    } else {
      targetDueAt = `${quickCustomDate}T${quickCustomTime}`;
    }

    await storage.put('reminders', {
      id: generateUUID(),
      title: `⏰ Task Reminder: ${quickAlarmItem.title}`,
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

  // Task Roster filters
  const [filterTab, setFilterTab] = useState<'all' | 'today' | 'high' | 'work' | 'personal' | 'done'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  // New/Edit task form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [domain, setDomain] = useState<TaskDomain>('work');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [dueAt, setDueAt] = useState(today);
  const [goalId, setGoalId] = useState<string>('');
  const [taskInputMode, setTaskInputMode] = useState<'manual' | 'link'>('manual');

  const formRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const switchToManualMode = () => {
    setTaskInputMode('manual');
    setGoalId('');
  };

  const switchToLinkMode = () => {
    setTaskInputMode('link');
    if (goals.length > 0 && !goalId) {
      handleSelectGoalForTask(goals[0].id);
    }
  };

  const handleSelectGoalForTask = (gId: string) => {
    setGoalId(gId);
    if (!gId) return;
    const matchedGoal = goals.find(g => g.id === gId);
    if (matchedGoal) {
      if (!title.trim() || goals.some(g => title.includes(g.title))) {
        setTitle(`Execute: ${matchedGoal.title}`);
      }
      if (matchedGoal.targetDate) {
        setDueAt(matchedGoal.targetDate);
      }
      const cat = (matchedGoal.category || '').toLowerCase();
      if (cat.includes('finance')) setDomain('finance');
      else if (cat.includes('health') || cat.includes('fitness')) setDomain('health');
      else if (cat.includes('learn') || cat.includes('education')) setDomain('learning');
      else if (cat.includes('spirit')) setDomain('spiritual');
      else if (cat.includes('career') || cat.includes('work')) setDomain('work');
      else setDomain('personal');
    }
  };

  // Audio Reading for Tasks
  const [speakingTaskId, setSpeakingTaskId] = useState<string | null>(null);

  const toggleSpeakTask = (task: Task) => {
    if (speakingTaskId === task.id) {
      globalTextReader.stop();
      setSpeakingTaskId(null);
    } else {
      globalTextReader.stop();
      const textToRead = `${task.title}. ${task.description ? 'Description: ' + task.description : ''}`;
      if (!textToRead.trim()) return;
      setSpeakingTaskId(task.id);
      globalTextReader.speak(textToRead, {
        onStateChange: (st) => {
          if (!st.isSpeaking) {
            setSpeakingTaskId(null);
          }
        }
      });
    }
  };

  // Daily Command Center state
  const [plannerTarget, setPlannerTarget] = useState(dailyPlanner?.target || '');
  const [plannerProgress, setPlannerProgress] = useState(dailyPlanner?.progress ?? 0);
  const [pointText, setPointText] = useState('');
  const [dailyWins, setDailyWins] = useState(dailyPlanner?.wins?.join('\n') || '');
  const [eveningReview, setEveningReview] = useState(dailyPlanner?.reflection?.join('\n') || '');
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<string | null>(null);
  const [savedTargetsArchive, setSavedTargetsArchive] = useState<SavedTargetRecord[]>([]);

  // Synchronize Daily Planner state whenever dailyPlanner prop updates from storage
  useEffect(() => {
    if (dailyPlanner) {
      if (dailyPlanner.target !== undefined) setPlannerTarget(dailyPlanner.target);
      if (dailyPlanner.progress !== undefined) setPlannerProgress(dailyPlanner.progress);
      if (dailyPlanner.wins) setDailyWins(dailyPlanner.wins.join('\n'));
      if (dailyPlanner.reflection) setEveningReview(dailyPlanner.reflection.join('\n'));
    }
  }, [dailyPlanner]);

  // Load Saved Target Files & Records from local storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('om-saved-command-targets');
      if (stored) {
        setSavedTargetsArchive(JSON.parse(stored));
      }
    } catch {}
  }, []);

  const handleCreateOrUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const now = Date.now();
    if (editingTaskId) {
      const existing = tasks.find(t => t.id === editingTaskId);
      if (existing) {
        const oldGoalId = existing.goalId;
        const updated: Task = {
          ...existing,
          title: title.trim(),
          description: description.trim() || undefined,
          domain,
          priority,
          dueAt,
          date: dueAt,
          goalId: goalId || null,
          updatedAt: now
        };
        await storage.put('tasks', updated);
        onSuccess('✓ Task updated');

        if (goalId) {
          await syncGoalProgressFromTasks(goalId);
        }
        if (oldGoalId && oldGoalId !== goalId) {
          await syncGoalProgressFromTasks(oldGoalId);
        }
      }
      setEditingTaskId(null);
    } else {
      const newTask: Task = {
        id: generateUUID(),
        title: title.trim(),
        description: description.trim() || undefined,
        domain,
        priority,
        dueAt,
        date: dueAt,
        goalId: goalId || null,
        done: false,
        status: 'open',
        createdAt: now,
        updatedAt: now
      };
      await storage.put('tasks', newTask);

      if (armTaskGenesisAlarm) {
        const alarmDueAt = `${dueAt}T${taskGenesisAlarmTime}`;
        await storage.put('reminders', {
          id: generateUUID(),
          title: `⏰ Task Genesis Alarm: ${newTask.title}`,
          dueAt: alarmDueAt,
          repeatRule: 'none',
          status: 'open',
          linkedId: newTask.id,
          alarmEnabled: true,
          ringtone: taskGenesisRingtone,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }

      onSuccess(
        armTaskGenesisAlarm
          ? '✓ Task Genesis with Audio Reminder Alarm deployed!'
          : goalId
          ? '✓ Task linked to Goal & added to planner'
          : '✓ Task added to planner'
      );

      if (goalId) {
        await syncGoalProgressFromTasks(goalId);
      }
    }

    setTitle('');
    setDescription('');
    onRefresh();
  };

  const handleEditClick = (task: Task) => {
    setActiveSubMenu('roster');
    setEditingTaskId(task.id);
    setTitle(task.title);
    setDescription(task.description || '');
    setDomain(task.domain || 'work');
    setPriority(task.priority || 'Medium');
    setDueAt(task.dueAt || today);
    setGoalId(task.goalId || '');
    setTaskInputMode(task.goalId ? 'link' : 'manual');

    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => {
      titleInputRef.current?.focus();
    }, 150);
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setTitle('');
    setDescription('');
  };

  const handleToggleTask = async (task: Task) => {
    const nextDone = !task.done;
    const updated: Task = {
      ...task,
      done: nextDone,
      status: nextDone ? 'done' : 'open',
      updatedAt: Date.now()
    };
    await storage.put('tasks', updated);

    // Reflect task completion in linked goal progress & rollup through 3-tier hierarchy!
    if (task.goalId) {
      const res = await syncGoalProgressFromTasks(task.goalId, task.id, nextDone);
      if (res.targetGoal) {
        onSuccess(
          nextDone
            ? `✓ Task complete! Goal "${res.targetGoal.title}" progress updated to ${res.targetGoal.progress}%`
            : `Task opened. Goal "${res.targetGoal.title}" progress adjusted to ${res.targetGoal.progress}%`
        );
      }
    }

    onRefresh();
  };

  const handleUpdateTaskStatus = async (task: Task, status: 'open' | 'in-progress' | 'done') => {
    const isDone = status === 'done';
    const updated: Task = {
      ...task,
      status,
      done: isDone,
      updatedAt: Date.now()
    };
    await storage.put('tasks', updated);

    if (task.goalId) {
      await syncGoalProgressFromTasks(task.goalId, task.id, isDone);
    }

    onSuccess(`Task moved to ${status}`);
    onRefresh();
  };

  const handleDeleteTask = (task: Task) => {
    setTaskToDelete(task);
  };

  const handleConfirmDelete = async () => {
    if (!taskToDelete) return;
    try {
      const targetGoalId = taskToDelete.goalId;
      await storage.delete('tasks', taskToDelete.id);
      onSuccess('✓ Task deleted');
      setTaskToDelete(null);
      if (editingTaskId === taskToDelete.id) {
        handleCancelEdit();
      }
      if (targetGoalId) {
        await syncGoalProgressFromTasks(targetGoalId);
      }
      onRefresh();
    } catch (err) {
      console.error('Failed to delete task', err);
    }
  };

  // Save Daily Command Target
  const handleSavePlannerTarget = async () => {
    const appSettings = (await storage.getSingleton<any>('appSettings')) || {};
    const winsArray = dailyWins.split('\n').map(s => s.trim()).filter(Boolean);
    const reflArray = eveningReview.split('\n').map(s => s.trim()).filter(Boolean);

    const updatedPlanner: DailyPlanner = {
      date: today,
      target: plannerTarget,
      progress: plannerProgress,
      points: dailyPlanner?.points || [],
      wins: winsArray,
      reflection: reflArray
    };

    appSettings.dailyPlanner = updatedPlanner;
    await storage.setSingleton('appSettings', appSettings);

    // Save to Persistent History Archive
    const pointsList = updatedPlanner.points || [];
    const newRecord: SavedTargetRecord = {
      id: generateUUID(),
      date: today,
      target: plannerTarget || 'Daily Command Target',
      progress: plannerProgress,
      pointsCount: pointsList.length,
      pointsDone: pointsList.filter(p => p.done).length,
      savedAt: Date.now(),
      raw: updatedPlanner
    };

    const updatedArchive = [newRecord, ...savedTargetsArchive.filter(r => r.date !== today || r.target !== plannerTarget)].slice(0, 30);
    setSavedTargetsArchive(updatedArchive);
    try {
      localStorage.setItem('om-saved-command-targets', JSON.stringify(updatedArchive));
    } catch {}

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLastSavedTimestamp(timeStr);
    onSuccess(`✓ Command Target saved successfully at ${timeStr}`);
    onRefresh();
  };

  // Export & Download Daily Command Target as a file (.md)
  const handleSaveToFile = () => {
    const pointsList = dailyPlanner?.points || [];
    const openTasks = tasks.filter(t => !t.done && (t.dueAt === today || !t.dueAt));

    let content = `# 🎯 Daily Command Target - ${today}\n`;
    content += `Generated by Om-LifeOS · Sovereign Operating System\n\n`;
    content += `## Core Decisive Victory\n`;
    content += `${plannerTarget || 'None specified'}\n\n`;
    content += `**Execution Progress:** ${plannerProgress}%\n\n`;

    content += `## Action Checkpoints\n`;
    if (pointsList.length === 0) {
      content += `*(No checkpoints defined)*\n`;
    } else {
      pointsList.forEach(p => {
        content += `- [${p.done ? 'x' : ' '}] ${p.text}\n`;
      });
    }
    content += `\n`;

    if (dailyWins.trim()) {
      content += `## Daily Victories & Wins\n${dailyWins}\n\n`;
    }

    if (eveningReview.trim()) {
      content += `## Evening Reflection & Learnings\n${eveningReview}\n\n`;
    }

    content += `## Today's Linked Active Tasks\n`;
    if (openTasks.length === 0) {
      content += `*(No open tasks due today)*\n`;
    } else {
      openTasks.forEach(t => {
        content += `- [ ] [${t.priority}] ${t.title} (${t.domain})\n`;
      });
    }

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `daily-command-target-${today}.md`;
    link.click();
    URL.revokeObjectURL(url);
    onSuccess('💾 Command Target file exported and downloaded (.md)');
  };

  // Load a saved record from archive
  const handleLoadSavedRecord = (record: SavedTargetRecord) => {
    setPlannerTarget(record.target);
    setPlannerProgress(record.progress);
    if (record.raw?.wins) setDailyWins(record.raw.wins.join('\n'));
    if (record.raw?.reflection) setEveningReview(record.raw.reflection.join('\n'));
    onSuccess(`Loaded saved target from ${record.date}`);
  };

  const handleAddPlannerPoint = async (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !pointText.trim()) return;
    e.preventDefault();

    const appSettings = (await storage.getSingleton<any>('appSettings')) || {};
    const currentPoints = dailyPlanner?.points || [];
    const newPoints = [...currentPoints, { id: generateUUID(), text: pointText.trim(), done: false }];

    const updatedPlanner: DailyPlanner = {
      date: today,
      target: plannerTarget,
      progress: plannerProgress,
      points: newPoints,
      wins: dailyPlanner?.wins || [],
      reflection: dailyPlanner?.reflection || []
    };

    appSettings.dailyPlanner = updatedPlanner;
    await storage.setSingleton('appSettings', appSettings);
    setPointText('');
    onRefresh();
  };

  const handleTogglePoint = async (pointId: string) => {
    const appSettings = (await storage.getSingleton<any>('appSettings')) || {};
    const currentPoints = dailyPlanner?.points || [];
    const newPoints = currentPoints.map(p => (p.id === pointId ? { ...p, done: !p.done } : p));

    const updatedPlanner: DailyPlanner = {
      date: today,
      target: plannerTarget,
      progress: plannerProgress,
      points: newPoints,
      wins: dailyPlanner?.wins || [],
      reflection: dailyPlanner?.reflection || []
    };

    appSettings.dailyPlanner = updatedPlanner;
    await storage.setSingleton('appSettings', appSettings);
    onRefresh();
  };

  const handleDeletePoint = async (pointId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const appSettings = (await storage.getSingleton<any>('appSettings')) || {};
    const currentPoints = dailyPlanner?.points || [];
    const newPoints = currentPoints.filter(p => p.id !== pointId);

    const updatedPlanner: DailyPlanner = {
      date: today,
      target: plannerTarget,
      progress: plannerProgress,
      points: newPoints,
      wins: dailyPlanner?.wins || [],
      reflection: dailyPlanner?.reflection || []
    };

    appSettings.dailyPlanner = updatedPlanner;
    await storage.setSingleton('appSettings', appSettings);
    onRefresh();
  };

  const priorityWeight: Record<string, number> = { High: 3, Medium: 2, Low: 1 };

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.dueAt && b.dueAt) {
      const diff = a.dueAt.localeCompare(b.dueAt);
      if (diff !== 0) return diff;
    } else if (a.dueAt && !b.dueAt) {
      return -1;
    } else if (!a.dueAt && b.dueAt) {
      return 1;
    }
    const pA = priorityWeight[a.priority] || 0;
    const pB = priorityWeight[b.priority] || 0;
    if (pA !== pB) return pB - pA;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  const filteredTasks = sortedTasks.filter(t => {
    if (filterTab === 'today' && (t.dueAt !== today || t.done)) return false;
    if (filterTab === 'high' && (t.priority !== 'High' || t.done)) return false;
    if (filterTab === 'work' && (t.domain !== 'work' || t.done)) return false;
    if (filterTab === 'personal' && (t.domain !== 'personal' || t.done)) return false;
    if (filterTab === 'done' && !t.done) return false;
    if (filterTab === 'all' && t.done) return true;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return `${t.title} ${t.description || ''} ${t.domain || ''}`.toLowerCase().includes(q);
    }
    return true;
  });

  const openCount = tasks.filter(t => !t.done).length;
  const todayCount = tasks.filter(t => t.dueAt === today && !t.done).length;
  const highCount = tasks.filter(t => t.priority === 'High' && !t.done).length;

  // Timeline classification
  const overdueTasks = sortedTasks
    .filter(t => !t.done && t.dueAt && t.dueAt < today)
    .sort((a, b) => (a.dueAt || '').localeCompare(b.dueAt || ''));
  const todayTasks = sortedTasks
    .filter(t => !t.done && t.dueAt === today)
    .sort((a, b) => (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0));
  const upcomingTasks = sortedTasks
    .filter(t => !t.done && t.dueAt && t.dueAt > today)
    .sort((a, b) => (a.dueAt || '').localeCompare(b.dueAt || ''));
  const unscheduledTasks = sortedTasks
    .filter(t => !t.done && !t.dueAt);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            Tasks & Planner
          </h1>
        </div>
      </div>

      {/* 4 Essential Metric Cards (Matching Dashboard Style) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Open Tasks</span>
            <CheckSquare className="h-4 w-4 text-emerald-500 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">
            {openCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            {todayCount} due today
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">High Priority</span>
            <Flame className="h-4 w-4 text-rose-500 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-rose-600 dark:text-rose-400 tabular-nums truncate">
            {highCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            Critical focus items
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Completed</span>
            <CheckCircle2 className="h-4 w-4 text-indigo-500 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">
            {tasks.filter(t => t.done).length}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            Action items resolved
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Scheduled</span>
            <Calendar className="h-4 w-4 text-blue-500 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">
            {todayTasks.length + upcomingTasks.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            {upcomingTasks.length} upcoming commitments
          </div>
        </div>
      </div>

      {/* Delay Alert Banner */}
      {overdueTasks.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border-2 border-rose-500/40 bg-gradient-to-r from-rose-500/15 via-rose-500/10 to-amber-500/15 p-4 dark:border-rose-900/60 dark:bg-rose-950/30">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-xs">
              <AlertTriangle className="h-5 w-5 animate-pulse" />
            </span>
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                <span>Delayed Tasks Detected (⚠️ {overdueTasks.length})</span>
              </div>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                {overdueTasks.length} task{overdueTasks.length > 1 ? 's are' : ' is'} past target deadline: "{overdueTasks[0]?.title}"
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Trigger an urgent audio alarm or update task schedule in the Roster.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleTriggerUrgentAlarm(overdueTasks[0].title, 'Overdue task deadline!')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-500 cursor-pointer"
            >
              <BellRing className="h-4 w-4 animate-bounce" />
              <span>🚨 Ring Alarm</span>
            </button>
          </div>
        </div>
      )}

      {/* Submenu Navigation Tabs (Full Width Responsive Slide Tab) */}
      <div className="w-full pb-2 border-b border-slate-200 dark:border-slate-800">
        <SlideTabs
          activeId={activeSubMenu}
          onChange={(id) => setActiveSubMenu(id as any)}
          tabs={[
            { id: 'roster', label: `Task Roster (${openCount})`, shortLabel: `Roster (${openCount})`, icon: CheckSquare },
            { id: 'dailyCommand', label: 'Daily Command Target', shortLabel: 'Daily Target', icon: Target },
            { id: 'kanban', label: 'Status Board (Kanban)', shortLabel: 'Kanban Board', icon: Layers }
          ]}
        />
      </div>

      {/* SUBMENU 1: TASK ROSTER & INLINE PLANNER */}
      {activeSubMenu === 'roster' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Add/Edit Task Box (5 cols) */}
          <div
            ref={formRef}
            className={`lg:col-span-5 rounded-2xl border transition-all ${
              editingTaskId
                ? 'border-indigo-400 bg-indigo-50/20 dark:border-indigo-500/50 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20'
                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
            } p-5 sm:p-6 shadow-xs`}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 text-xs font-bold">
                  ✓
                </span>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    {editingTaskId ? 'Edit Task' : 'Task Genesis'}
                  </h2>
                  {!editingTaskId && (
                    <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                      Action Unit
                    </span>
                  )}
                </div>
              </div>
              {editingTaskId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>

            <form onSubmit={handleCreateOrUpdateTask} className="mt-4 space-y-3.5">
              {/* TASK TITLE WITH INTEGRATED LINK GOAL / MANUAL TOGGLE (As in image.png) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Task Title / Purpose
                  </label>
                  {/* Mode Selector: Link Goal vs Manual */}
                  <div className="flex items-center rounded-lg bg-slate-200/80 p-0.5 dark:bg-slate-700/80">
                    <button
                      type="button"
                      onClick={switchToLinkMode}
                      className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer ${
                        taskInputMode === 'link'
                          ? 'bg-white text-indigo-600 shadow-2xs dark:bg-slate-900 dark:text-indigo-400'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      }`}
                    >
                      <Link2 className="h-3 w-3" />
                      <span>Link Goal</span>
                    </button>
                    <button
                      type="button"
                      onClick={switchToManualMode}
                      className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer ${
                        taskInputMode === 'manual'
                          ? 'bg-white text-indigo-600 shadow-2xs dark:bg-slate-900 dark:text-indigo-400'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      }`}
                    >
                      <span>Manual</span>
                    </button>
                  </div>
                </div>

                {/* When Link from Goal is active */}
                {taskInputMode === 'link' && (
                  <div className="mb-2 space-y-1.5 rounded-xl border border-indigo-200/80 bg-indigo-50/60 p-2.5 dark:border-indigo-900/60 dark:bg-indigo-950/30">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                        Select Target Goal to Link *
                      </label>
                      {goalId && (
                        <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                          {goals.find(g => g.id === goalId)?.progress}% Done
                        </span>
                      )}
                    </div>
                    <select
                      value={goalId}
                      onChange={e => handleSelectGoalForTask(e.target.value)}
                      className="h-8.5 w-full rounded-lg border border-indigo-300 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-indigo-700 dark:bg-slate-900 dark:text-white cursor-pointer"
                    >
                      <option value="">-- Choose Goal (Main 🎯, Sub 🔹, Micro ▫️, Nano 🔸, Atomic ⚡) --</option>
                      {goals.map(g => {
                        const lvlLabel =
                          g.level === 5 ? '⚡ Level 5 Atomic' :
                          g.level === 4 ? '🔸 Level 4 Nano' :
                          g.level === 3 ? '▫️ Level 3 Micro' :
                          g.level === 2 ? '🔹 Level 2 Sub' : '🎯 Level 1 Main';
                        return (
                          <option key={g.id} value={g.id}>
                            {lvlLabel}: {g.title} ({g.progress}%)
                          </option>
                        );
                      })}
                    </select>

                    {goalId && (
                      <span className="block text-[10px] text-indigo-700 dark:text-indigo-300">
                        ⚡ Completing this task will advance the goal's progress and roll up to parent goals!
                      </span>
                    )}
                  </div>
                )}

                <input
                  ref={titleInputRef}
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Morning Sprint, Standup, Review Deliverables"
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Domain
                  </label>
                  <select
                    value={domain}
                    onChange={e => setDomain(e.target.value as any)}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="work">Work</option>
                    <option value="personal">Personal</option>
                    <option value="health">Health</option>
                    <option value="finance">Finance</option>
                    <option value="spiritual">Spiritual</option>
                    <option value="social">Social</option>
                    <option value="learning">Learning</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as any)}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="High">High Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="Low">Low Priority</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={dueAt}
                    onChange={e => setDueAt(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 font-mono text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Strategic Goal
                  </label>
                  <select
                    value={goalId}
                    onChange={e => setGoalId(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">None (Independent)</option>
                    {goals.map(g => (
                      <option key={g.id} value={g.id}>{g.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Description / Context
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Key deliverables, context, or links..."
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {!editingTaskId && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-2.5 dark:border-indigo-900/60 dark:bg-indigo-950/20 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-indigo-900 dark:text-indigo-200">
                    <input
                      type="checkbox"
                      checked={armTaskGenesisAlarm}
                      onChange={e => setArmTaskGenesisAlarm(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span>⚡ Arm Audio Reminder Alarm on Creation</span>
                  </label>
                  {armTaskGenesisAlarm && (
                    <div className="grid grid-cols-2 gap-2 pt-1 text-[10px]">
                      <div>
                        <label className="text-slate-500 font-semibold">Alarm Time</label>
                        <input
                          type="time"
                          value={taskGenesisAlarmTime}
                          onChange={e => setTaskGenesisAlarmTime(e.target.value)}
                          className="mt-0.5 h-7 w-full rounded border border-slate-200 bg-white px-1 dark:border-slate-700 dark:bg-slate-800 text-[10px] font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 font-semibold">Ringtone</label>
                        <select
                          value={taskGenesisRingtone}
                          onChange={e => setTaskGenesisRingtone(e.target.value)}
                          className="mt-0.5 h-7 w-full rounded border border-slate-200 bg-white px-1 dark:border-slate-700 dark:bg-slate-800 text-[10px]"
                        >
                          {BUILTIN_RINGTONES.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 active:scale-98 transition-transform cursor-pointer"
              >
                {editingTaskId ? 'Update Task' : '＋ Add Task to Planner'}
              </button>
            </form>
          </div>

          {/* Task Filter Tabs & All Tasks List (7 cols) */}
          <section className="lg:col-span-7 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                  <CheckSquare className="h-4.5 w-4.5" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Task Roster ({filteredTasks.length})
                </h2>
              </div>

              {/* Quick Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search tasks..."
                  className="h-8.5 w-full rounded-xl border border-slate-200 pl-8 pr-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            {/* Tab Filter Chips */}
            <div className="flex overflow-x-auto pb-1 gap-1.5 no-scrollbar">
              {[
                { id: 'all', label: `All Tasks (${tasks.length})` },
                { id: 'today', label: `Due Today (${todayCount})` },
                { id: 'high', label: `High Priority (${highCount})` },
                { id: 'work', label: 'Work' },
                { id: 'personal', label: 'Personal' },
                { id: 'done', label: `Completed (${tasks.filter(t => t.done).length})` }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id as any)}
                  className={`rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold whitespace-nowrap tracking-normal transition-all cursor-pointer ${
                    filterTab === tab.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/80'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tasks List */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 max-h-[550px] overflow-y-auto">
              {filteredTasks.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">
                  No tasks found in this view.
                </div>
              ) : (
                filteredTasks.map(task => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between py-3 px-2 rounded-xl transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <button
                        type="button"
                        onClick={() => handleToggleTask(task)}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition-all cursor-pointer ${
                          task.done
                            ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                            : 'border-slate-300 hover:border-indigo-500 dark:border-slate-600'
                        }`}
                      >
                        {task.done && <Check className="h-3.5 w-3.5" />}
                      </button>

                      <div className="min-w-0">
                        <div className={`text-xs font-semibold truncate ${task.done ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                          {task.title}
                        </div>
                        {task.description && (
                          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xl">
                            {task.description}
                          </div>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                          <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 capitalize font-medium text-slate-600 dark:text-slate-300">
                            {task.domain}
                          </span>
                          <span className={`rounded-md px-1.5 py-0.5 font-bold ${
                            task.priority === 'High'
                              ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                              : task.priority === 'Medium'
                              ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                          }`}>
                            {task.priority}
                          </span>
                          {task.dueAt && (
                            <span className="font-mono text-slate-500 flex items-center gap-1">
                              <Calendar className="h-2.5 w-2.5" />
                              <span>{task.dueAt}</span>
                            </span>
                          )}
                          {task.goalId && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 dark:bg-indigo-950/80 px-1.5 py-0.5 font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                              <Target className="h-2.5 w-2.5 text-indigo-600 dark:text-indigo-400" />
                              <span className="truncate max-w-[130px]">
                                {goals.find(g => g.id === task.goalId)?.title || 'Goal'}
                              </span>
                              {task.done && (
                                <span className="text-emerald-600 dark:text-emerald-400 font-extrabold ml-0.5">✓ Reflected</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* DELAY ALARM TRIGGER BUTTON */}
                      {!task.done && task.dueAt && task.dueAt < today && (
                        <button
                          type="button"
                          onClick={() => handleTriggerUrgentAlarm(task.title, 'Task is overdue beyond scheduled date!')}
                          className="h-7 px-2 rounded-lg bg-rose-600 text-white hover:bg-rose-500 cursor-pointer flex items-center gap-1 text-[10px] font-bold shadow-2xs"
                          title="Ring Urgent Alarm Now"
                        >
                          <BellRing className="h-3 w-3 animate-bounce" />
                          <span>Alarm</span>
                        </button>
                      )}

                      {/* SET REMINDER ALARM BUTTON */}
                      <button
                        type="button"
                        onClick={() => setQuickAlarmItem({ id: task.id, title: task.title, dueAt: task.dueAt })}
                        className="h-7 px-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                        title="Set Reminder Alarm"
                      >
                        <Bell className="h-3 w-3" />
                        <span className="hidden sm:inline">Alarm</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleSpeakTask(task)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          speakingTaskId === task.id
                            ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950 animate-pulse'
                            : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        title={speakingTaskId === task.id ? "Stop reading" : "Read task aloud (Hindi & English)"}
                      >
                        <Volume2 className={`h-3.5 w-3.5 ${speakingTaskId === task.id ? 'animate-bounce' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditClick(task)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                        title="Edit task"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                        title="Delete task"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* SUBMENU 2: DAILY COMMAND TARGET (With File Save, Export, and History!) */}
      {activeSubMenu === 'dailyCommand' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Main Command Operations Form (7 cols) */}
            <div className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 text-sm font-bold">
                    🎯
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      Daily Command Target ({today})
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      {lastSavedTimestamp ? `Last saved at ${lastSavedTimestamp}` : 'Changes auto-saved to sovereign state'}
                    </p>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveToFile}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                    title="Export and download command target as a file (.md)"
                  >
                    <Download className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Save to File</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSavePlannerTarget}
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>Save Target</span>
                  </button>
                </div>
              </div>

              {/* Decisive Victory Target */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Core Priority / Decisive Victory Outcome
                </label>
                <input
                  type="text"
                  value={plannerTarget}
                  onChange={e => setPlannerTarget(e.target.value)}
                  placeholder="What single outcome will make today a decisive victory?"
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-medium"
                />
              </div>

              {/* Progress Slider */}
              <div className="rounded-2xl bg-amber-50/50 p-4 border border-amber-200/60 dark:bg-amber-950/20 dark:border-amber-800/40">
                <div className="flex justify-between text-xs font-semibold text-amber-900 dark:text-amber-200">
                  <span>Execution Progress</span>
                  <span className="font-mono text-sm font-extrabold">{plannerProgress}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={plannerProgress}
                  onChange={e => setPlannerProgress(Number(e.target.value))}
                  className="mt-2 h-2.5 w-full accent-amber-500 rounded-lg cursor-pointer"
                />
              </div>

              {/* Action Checkpoints */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Action Checkpoints (Type and hit Enter to add)
                </label>
                <input
                  type="text"
                  value={pointText}
                  onChange={e => setPointText(e.target.value)}
                  onKeyDown={handleAddPlannerPoint}
                  placeholder="Type an actionable checkpoint and hit Enter..."
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

                <div className="mt-3 space-y-1.5 max-h-56 overflow-y-auto">
                  {(dailyPlanner?.points || []).length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      No checkpoints registered for today yet.
                    </div>
                  ) : (
                    (dailyPlanner?.points || []).map(pt => (
                      <div
                        key={pt.id}
                        onClick={() => handleTogglePoint(pt.id)}
                        className="flex items-center justify-between rounded-xl p-2.5 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          {pt.done ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          ) : (
                            <Circle className="h-4 w-4 text-slate-300 dark:text-slate-600 shrink-0" />
                          )}
                          <span className={pt.done ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200 font-medium'}>
                            {pt.text}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleDeletePoint(pt.id, e)}
                          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 p-1"
                          title="Remove checkpoint"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Wins & Reflections */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Daily Victories & Wins (1 per line)
                  </label>
                  <textarea
                    rows={3}
                    value={dailyWins}
                    onChange={e => setDailyWins(e.target.value)}
                    placeholder="• Shipped feature on schedule&#10;• Hit daily calorie goal"
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Evening Reflection & Learnings
                  </label>
                  <textarea
                    rows={3}
                    value={eveningReview}
                    onChange={e => setEveningReview(e.target.value)}
                    placeholder="What worked well? What could be executed better tomorrow?"
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Saved Command Target Files & Historical Archive (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-indigo-500" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Saved Command Targets & Files
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {savedTargetsArchive.length} records
                  </span>
                </div>

                <div className="mt-4 space-y-3 max-h-[500px] overflow-y-auto">
                  {savedTargetsArchive.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      No saved files or target history yet.<br/>
                      Click "Save Target" or "Save to File" to save your first record.
                    </div>
                  ) : (
                    savedTargetsArchive.map(rec => (
                      <div
                        key={rec.id}
                        className="rounded-2xl border border-slate-100 p-3.5 text-xs dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-all space-y-2 group"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white text-xs">
                              {rec.target}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Date: {rec.date} · {rec.pointsDone}/{rec.pointsCount} checkpoints
                            </div>
                          </div>
                          <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                            {rec.progress}%
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-50 dark:border-slate-800/40">
                          <button
                            type="button"
                            onClick={() => handleLoadSavedRecord(rec)}
                            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 cursor-pointer"
                          >
                            Load Into Editor
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const updated = savedTargetsArchive.filter(r => r.id !== rec.id);
                              setSavedTargetsArchive(updated);
                              try {
                                localStorage.setItem('om-saved-command-targets', JSON.stringify(updated));
                              } catch {}
                            }}
                            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 p-1"
                            title="Remove record"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBMENU 3: KANBAN STATUS BOARD */}
      {activeSubMenu === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1: Open / Backlog */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col h-[650px]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-900 dark:text-white">To Do / Open</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {tasks.filter(t => !t.done && (t.status === 'open' || !t.status)).length}
              </span>
            </div>
            <div className="mt-3 flex-1 overflow-y-auto space-y-2.5 pr-1">
              {tasks.filter(t => !t.done && (t.status === 'open' || !t.status)).map(t => (
                <div key={t.id} className="rounded-2xl border border-slate-100 p-3.5 shadow-xs dark:border-slate-800 bg-white dark:bg-slate-800/60 text-xs space-y-2">
                  <div className="font-semibold text-slate-900 dark:text-white">{t.title}</div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="capitalize">{t.domain}</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateTaskStatus(t, 'in-progress')}
                      className="flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                    >
                      <span>Start</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: In Progress */}
          <div className="rounded-3xl border border-amber-200 bg-amber-50/30 p-5 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/10 flex flex-col h-[650px]">
            <div className="flex items-center justify-between border-b border-amber-100 pb-3 dark:border-amber-900/30">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-200">In Progress</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                {tasks.filter(t => !t.done && t.status === 'in-progress').length}
              </span>
            </div>
            <div className="mt-3 flex-1 overflow-y-auto space-y-2.5 pr-1">
              {tasks.filter(t => !t.done && t.status === 'in-progress').map(t => (
                <div key={t.id} className="rounded-2xl border border-amber-100 p-3.5 shadow-xs dark:border-slate-800 bg-white dark:bg-slate-800/60 text-xs space-y-2">
                  <div className="font-semibold text-slate-900 dark:text-white">{t.title}</div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <button
                      type="button"
                      onClick={() => handleUpdateTaskStatus(t, 'open')}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateTaskStatus(t, 'done')}
                      className="flex items-center gap-1 font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                      <span>Complete</span>
                      <Check className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 3: Completed */}
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50/30 p-5 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/10 flex flex-col h-[650px]">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3 dark:border-emerald-900/30">
              <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Completed</span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                {tasks.filter(t => t.done).length}
              </span>
            </div>
            <div className="mt-3 flex-1 overflow-y-auto space-y-2.5 pr-1">
              {tasks.filter(t => t.done).map(t => (
                <div key={t.id} className="rounded-2xl border border-emerald-100 p-3.5 shadow-xs dark:border-slate-800 bg-white dark:bg-slate-800/60 text-xs space-y-2">
                  <div className="font-semibold line-through text-slate-400">{t.title}</div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="text-emerald-600 font-medium">✓ Done</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateTaskStatus(t, 'open')}
                      className="text-slate-400 hover:text-indigo-600"
                    >
                      Reopen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE TASK MODAL */}
      <ConfirmModal
        isOpen={Boolean(taskToDelete)}
        title="Delete Task?"
        message={
          taskToDelete
            ? `Are you sure you want to delete "${taskToDelete.title}"?`
            : ''
        }
        confirmText="Delete Task"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setTaskToDelete(null)}
      />

      {/* QUICK PRESET REMINDER ALARM MODAL */}
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
                    { id: 'tomorrow', label: 'Tomorrow 9 AM' },
                    { id: 'custom', label: 'Custom' }
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

              {alarmPresetChoice === 'custom' && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500">Date</label>
                    <input
                      type="date"
                      value={quickCustomDate}
                      onChange={e => setQuickCustomDate(e.target.value)}
                      className="mt-0.5 h-8 w-full rounded-lg border border-slate-200 px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500">Time</label>
                    <input
                      type="time"
                      value={quickCustomTime}
                      onChange={e => setQuickCustomTime(e.target.value)}
                      className="mt-0.5 h-8 w-full rounded-lg border border-slate-200 px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                    />
                  </div>
                </div>
              )}

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
    </div>
  );
};
