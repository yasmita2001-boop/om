import { ThemedDateTimeInput } from '../components/ThemedDateTimeInput';
import React, { useState, useRef, useEffect } from 'react';
import {
  CheckSquare, Trash2, Target, CheckCircle2,
  Circle, Edit3, Check, ChevronDown, Filter,
  Download, Save,
  Volume2, Bell, BellRing, AlertTriangle, X
} from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import {
  Task, TaskDomain, TaskPriority, DailyPlanner, Goal,
  LearningItem, Skill, Routine, Habit, HabitLog, ReminderItem, Strategy, Mission
} from '../types';
import { storage, generateUUID } from '../lib/storage';
import { resolveTaskGoalId, syncGoalProgressFromTasks } from '../lib/goalTaskSync';
import { ConfirmModal } from '../components/ConfirmModal';
import { globalTextReader } from '../lib/voiceService';
import { alarmService } from '../lib/alarmService';
import { BUILTIN_RINGTONES } from '../lib/alarmAudio';
import { ProgressiveActions } from '../components/ProgressiveActions';
import { LinkModeSelector } from '../components/LinkModeSelector';
import { ThemeIcon } from '../components/ThemeIcon';
import { TaskRoutineFocusSwitcher, type WorkAreaSection } from '../components/TaskRoutineFocusSwitcher';
import { GoalPicker } from '../components/GoalPicker';
import { soundEngine } from '../lib/soundEngine';
import { getLocalDateString, getLocalDateTimeString } from '../lib/dateUtils';

interface TasksViewProps {
  tasks: Task[];
  goals: Goal[];
  strategies?: Strategy[];
  missions?: Mission[];
  dailyPlanner?: DailyPlanner;
  learningItems?: LearningItem[];
  skills?: Skill[];
  routines?: Routine[];
  habits?: Habit[];
  habitLogs?: HabitLog[];
  reminders?: ReminderItem[];
  activeWorkAreaSection: WorkAreaSection;
  onSelectWorkAreaSection: (section: WorkAreaSection) => void;
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
  updatedAt?: number;
  raw: DailyPlanner;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  goals,
  strategies = [],
  missions = [],
  dailyPlanner,
  learningItems = [],
  skills = [],
  routines = [],
  activeWorkAreaSection,
  onSelectWorkAreaSection,
  onRefresh,
  onSuccess
}) => {
  const today = getLocalDateString();

  // Quick preset alarm modal
  const [quickAlarmItem, setQuickAlarmItem] = useState<{
    id: string;
    title: string;
    dueAt?: string;
  } | null>(null);
  const [alarmPresetChoice, setAlarmPresetChoice] = useState<'5m' | '15m' | '30m' | '1h' | 'tonight' | 'tomorrow' | 'custom'>('15m');
  const [quickCustomDate, setQuickCustomDate] = useState(today);

  // Progressive rendering: very long rosters choke scroll/input latency.
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
      title: `DELAY ALERT: ${taskTitle}`,
      subtitle: subtitle || 'Overdue action unit! Urgent execution required.',
      timeStr: 'NOW',
      ringtone: 'digital_pulse'
    });
    onSuccess(`Urgent alarm ringing for "${taskTitle}"!`);
  };

  const handleSaveQuickAlarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAlarmItem) return;

    let targetDueAt = '';
    const now = new Date();
    if (alarmPresetChoice === '5m') {
      targetDueAt = getLocalDateTimeString(new Date(now.getTime() + 5 * 60 * 1000));
    } else if (alarmPresetChoice === '15m') {
      targetDueAt = getLocalDateTimeString(new Date(now.getTime() + 15 * 60 * 1000));
    } else if (alarmPresetChoice === '30m') {
      targetDueAt = getLocalDateTimeString(new Date(now.getTime() + 30 * 60 * 1000));
    } else if (alarmPresetChoice === '1h') {
      targetDueAt = getLocalDateTimeString(new Date(now.getTime() + 60 * 60 * 1000));
    } else if (alarmPresetChoice === 'tonight') {
      targetDueAt = `${today}T20:00`;
    } else if (alarmPresetChoice === 'tomorrow') {
      const tm = new Date();
      tm.setDate(tm.getDate() + 1);
      targetDueAt = `${getLocalDateString(tm)}T09:00`;
    } else {
      targetDueAt = `${quickCustomDate}T${quickCustomTime}`;
    }

    await storage.put('reminders', {
      id: generateUUID(),
      title: `Task Reminder: ${quickAlarmItem.title}`,
      dueAt: targetDueAt,
      repeatRule: 'none',
      status: 'open',
      linkedType: 'task',
      linkedId: quickAlarmItem.id,
      alarmEnabled: true,
      ringtone: quickAlarmRingtone,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    onSuccess(`Reminder alarm scheduled for "${quickAlarmItem.title}" at ${targetDueAt.replace('T', ' ')}!`);
    setQuickAlarmItem(null);
    onRefresh();
  };

  // Task Roster filters
  const [filterTab, setFilterTab] = useState<'all' | 'today' | 'high' | 'work' | 'personal' | 'done'>('all');
  const taskFilterMenuRef = useRef<HTMLDetailsElement>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  // New/Edit task form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [checklistText, setChecklistText] = useState('');
  const [domain, setDomain] = useState<TaskDomain>('work');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [dueAt, setDueAt] = useState(today);
  const [goalId, setGoalId] = useState<string>('');
  const [strategyId, setStrategyId] = useState('');
  const [missionId, setMissionId] = useState('');
  const [plannerMissionId, setPlannerMissionId] = useState(dailyPlanner?.missionId || '');
  const [taskInputMode, setTaskInputMode] = useState<'manual' | 'link'>('manual');

  const formRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const switchToManualMode = () => {
    setTaskInputMode('manual');
    setGoalId('');
    setStrategyId('');
    setMissionId('');
  };

  const switchToLinkMode = () => {
    setTaskInputMode('link');
    if (goals.length > 0 && !goalId) {
      handleSelectGoalForTask(goals[0].id);
    }
  };

  const handleSelectGoalForTask = (gId: string) => {
    setGoalId(gId);
    setStrategyId('');
    setMissionId('');
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

  const handleSelectStrategyForTask = (id: string) => {
    setStrategyId(id);
    setMissionId('');
    const strategy = strategies.find(item => item.id === id);
    setGoalId(strategy?.goalId || '');
  };

  const handleSelectMissionForTask = (id: string) => {
    setMissionId(id);
    setStrategyId('');
    const mission = missions.find(item => item.id === id);
    setGoalId(mission?.goalId || '');
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
  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const [editingPointText, setEditingPointText] = useState('');
  const [dailyWins, setDailyWins] = useState(dailyPlanner?.wins?.join('\n') || '');
  const [eveningReview, setEveningReview] = useState(dailyPlanner?.reflection?.join('\n') || '');
  const [savedTargetsArchive, setSavedTargetsArchive] = useState<SavedTargetRecord[]>([]);
  const [editingSavedTargetId, setEditingSavedTargetId] = useState<string | null>(null);

  // Synchronize Daily Planner state whenever dailyPlanner prop updates from storage
  useEffect(() => {
    if (dailyPlanner) {
      if (dailyPlanner.target !== undefined) setPlannerTarget(dailyPlanner.target);
      if (dailyPlanner.progress !== undefined) setPlannerProgress(dailyPlanner.progress);
      if (dailyPlanner.wins) setDailyWins(dailyPlanner.wins.join('\n'));
      if (dailyPlanner.reflection) setEveningReview(dailyPlanner.reflection.join('\n'));
      setPlannerMissionId(dailyPlanner.missionId || '');
    }
  }, [dailyPlanner]);

  // Load Saved Target Files & Records from local storage
  useEffect(() => {
    try {
      const key = `om-saved-command-targets:${storage.getActiveProfileId()}`;
      const legacy = storage.getActiveProfileId() === 'om-master-profile'
        ? localStorage.getItem('om-saved-command-targets')
        : null;
      const stored = localStorage.getItem(key) || legacy;
      if (stored) {
        const parsed = JSON.parse(stored);
        setSavedTargetsArchive(Array.isArray(parsed) ? parsed : []);
        if (legacy && !localStorage.getItem(key)) localStorage.setItem(key, legacy);
      }
    } catch {}
  }, []);

  const handleCreateOrUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const existingChecklist = tasks.find(task => task.id === editingTaskId)?.checklist || [];
    const checklist = checklistText.split('\n').map(value => value.trim()).filter(Boolean).map(text => {
      const existing = existingChecklist.find(item => item.text === text);
      return { id: existing?.id || generateUUID(), text, done: existing?.done || false };
    });

    const now = Date.now();
    if (editingTaskId) {
      const existing = tasks.find(t => t.id === editingTaskId);
      if (existing) {
        const oldGoalId = resolveTaskGoalId(existing, { routines, skills, learningItems });
        const updated: Task = {
          ...existing,
          title: title.trim(),
          description: description.trim() || undefined,
          domain,
          priority,
          dueAt,
          date: dueAt,
          goalId: goalId || null,
          strategyId: strategyId || null,
          missionId: missionId || null,
          checklist: checklist.length ? checklist : undefined,
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
        strategyId: strategyId || null,
        missionId: missionId || null,
        checklist: checklist.length ? checklist : undefined,
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
          title: `Task Genesis Alarm: ${newTask.title}`,
          dueAt: alarmDueAt,
          repeatRule: 'none',
          status: 'open',
          linkedType: 'task',
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
    setChecklistText('');
    setGoalId('');
    setStrategyId('');
    setMissionId('');
    onRefresh();
  };

  const handleEditClick = (task: Task) => {
    onSelectWorkAreaSection('tasks-roster');
    setEditingTaskId(task.id);
    setTitle(task.title);
    setDescription(task.description || '');
    setChecklistText((task.checklist || []).map(item => item.text).join('\n'));
    setDomain(task.domain || 'work');
    setPriority(task.priority || 'Medium');
    setDueAt(task.dueAt || today);
    setGoalId(task.goalId || '');
    setStrategyId(task.strategyId || '');
    setMissionId(task.missionId || '');
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
    setChecklistText('');
    setGoalId('');
    setStrategyId('');
    setMissionId('');
  };

  const handleToggleTask = async (task: Task) => {
    const nextDone = !task.done;
    if (nextDone) {
      soundEngine.play('taskComplete');
    } else {
      soundEngine.play('taskUncheck');
    }
    const updated: Task = {
      ...task,
      done: nextDone,
      status: nextDone ? 'done' : 'open',
      updatedAt: Date.now()
    };
    await storage.put('tasks', updated);

    // Reflect task completion in linked goal progress & rollup through 3-tier hierarchy!
    const linkedGoalId = resolveTaskGoalId(task, { routines, skills, learningItems });
    if (linkedGoalId) {
      const res = await syncGoalProgressFromTasks(linkedGoalId, task.id, nextDone);
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

  const handleToggleChecklistItem = async (task: Task, itemId: string) => {
    const checklist = (task.checklist || []).map(item =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );
    await storage.put('tasks', { ...task, checklist, updatedAt: Date.now() });
    onRefresh();
  };

  const handleDeleteTask = (task: Task) => {
    setTaskToDelete(task);
  };

  const handleConfirmDelete = async () => {
    if (!taskToDelete) return;
    try {
      const targetGoalId = resolveTaskGoalId(taskToDelete, { routines, skills, learningItems });
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
    if (editingSavedTargetId) {
      const currentRecord = savedTargetsArchive.find(record => record.id === editingSavedTargetId);
      if (!currentRecord) {
        onSuccess('The saved target could not be found. Refresh the archive and try again.');
        setEditingSavedTargetId(null);
        return;
      }
      const winsArray = dailyWins.split('\n').map(s => s.trim()).filter(Boolean);
      const reflectionArray = eveningReview.split('\n').map(s => s.trim()).filter(Boolean);
      const updatedArchive = savedTargetsArchive.map(record => record.id === editingSavedTargetId
        ? {
            ...record,
            target: plannerTarget || 'Daily Command Target',
            progress: plannerProgress,
            updatedAt: Date.now(),
            raw: {
              ...record.raw,
              target: plannerTarget,
              progress: plannerProgress,
              wins: winsArray,
              reflection: reflectionArray,
              missionId: plannerMissionId || undefined
            }
          }
        : record);
      try {
        localStorage.setItem(`om-saved-command-targets:${storage.getActiveProfileId()}`, JSON.stringify(updatedArchive));
      } catch (error) {
        console.error('Unable to update saved command target', error);
        onSuccess('Unable to update the saved target. Check browser storage and try again.');
        return;
      }
      setSavedTargetsArchive(updatedArchive);
      setEditingSavedTargetId(null);
      onSuccess('Saved command target updated');
      return;
    }

    const appSettings = (await storage.getSingleton<any>('appSettings')) || {};
    const winsArray = dailyWins.split('\n').map(s => s.trim()).filter(Boolean);
    const reflArray = eveningReview.split('\n').map(s => s.trim()).filter(Boolean);

    const updatedPlanner: DailyPlanner = {
      date: today,
      target: plannerTarget,
      progress: plannerProgress,
      points: dailyPlanner?.points || [],
      wins: winsArray,
      reflection: reflArray,
      missionId: plannerMissionId || undefined
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
    try {
      localStorage.setItem(`om-saved-command-targets:${storage.getActiveProfileId()}`, JSON.stringify(updatedArchive));
    } catch (error) {
      console.error('Unable to save command target archive record', error);
      onSuccess('Daily target saved, but its archive record could not be stored.');
      onRefresh();
      return;
    }
    setSavedTargetsArchive(updatedArchive);

    onSuccess('✓ Command Target saved successfully');
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
    onSuccess('Command Target file exported and downloaded (.md)');
  };

  // Load a saved record from archive
  const handleLoadSavedRecord = (record: SavedTargetRecord) => {
    setEditingSavedTargetId(null);
    setPlannerTarget(record.target);
    setPlannerProgress(record.progress);
    if (record.raw?.wins) setDailyWins(record.raw.wins.join('\n'));
    if (record.raw?.reflection) setEveningReview(record.raw.reflection.join('\n'));
    setPlannerMissionId(record.raw?.missionId || '');
    onSuccess(`Loaded saved target from ${record.date}`);
  };

  const handleEditSavedRecord = (record: SavedTargetRecord) => {
    setEditingSavedTargetId(record.id);
    setPlannerTarget(record.target);
    setPlannerProgress(record.progress);
    setDailyWins(record.raw?.wins?.join('\n') || '');
    setEveningReview(record.raw?.reflection?.join('\n') || '');
    setPlannerMissionId(record.raw?.missionId || '');
    onSuccess(`Editing saved target from ${record.date}`);
  };

  const handleCancelEditSavedRecord = () => {
    setEditingSavedTargetId(null);
    if (dailyPlanner) {
      setPlannerTarget(dailyPlanner.target || '');
      setPlannerProgress(dailyPlanner.progress ?? 0);
      setDailyWins(dailyPlanner.wins?.join('\n') || '');
      setEveningReview(dailyPlanner.reflection?.join('\n') || '');
      setPlannerMissionId(dailyPlanner.missionId || '');
    }
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
      reflection: dailyPlanner?.reflection || [],
      missionId: plannerMissionId || undefined
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
      reflection: dailyPlanner?.reflection || [],
      missionId: plannerMissionId || undefined
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
      reflection: dailyPlanner?.reflection || [],
      missionId: plannerMissionId || undefined
    };

    appSettings.dailyPlanner = updatedPlanner;
    await storage.setSingleton('appSettings', appSettings);
    onRefresh();
  };

  const handleSavePoint = async (pointId: string, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (!editingPointText.trim()) return;

    const appSettings = (await storage.getSingleton<any>('appSettings')) || {};
    const currentPlanner = appSettings.dailyPlanner || dailyPlanner;
    const currentPoints = currentPlanner?.points || [];
    if (!currentPoints.some((point: DailyPlanner['points'][number]) => point.id === pointId)) {
      setEditingPointId(null);
      onRefresh();
      return;
    }

    appSettings.dailyPlanner = {
      ...(currentPlanner || {}),
      date: today,
      target: plannerTarget,
      progress: plannerProgress,
      points: currentPoints.map((point: DailyPlanner['points'][number]) =>
        point.id === pointId ? { ...point, text: editingPointText.trim() } : point
      ),
      wins: currentPlanner?.wins || [],
      reflection: currentPlanner?.reflection || [],
      missionId: plannerMissionId || undefined
    };
    await storage.setSingleton('appSettings', appSettings);
    setEditingPointId(null);
    setEditingPointText('');
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
    return true;
  });

  const openCount = tasks.filter(t => !t.done).length;
  const todayCount = tasks.filter(t => t.dueAt === today && !t.done).length;
  const highCount = tasks.filter(t => t.priority === 'High' && !t.done).length;

  // Timeline classification
  const overdueTasks = sortedTasks
    .filter(t => !t.done && t.dueAt && t.dueAt < today)
    .sort((a, b) => (a.dueAt || '').localeCompare(b.dueAt || ''));
  return (
    <div className="task-area-card-view space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            Tasks & Planner
          </h1>
        </div>
        <TaskRoutineFocusSwitcher
          activeSection={activeWorkAreaSection}
          taskCount={openCount}
          onSelectSection={onSelectWorkAreaSection}
        />
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
              <span>Ring Alarm</span>
            </button>
          </div>
        </div>
      )}

      {/* SUBMENU 1: TASK ROSTER & INLINE PLANNER */}
      {activeWorkAreaSection === 'tasks-roster' && (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
          {/* Keep the task entry card visible, and show roster data only when tasks exist. */}
          <div
            id="task-genesis-form"
            ref={formRef}
            data-task-genesis-card
            className={`${tasks.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'} rounded-2xl border transition-all ${
              editingTaskId
                ? 'border-emerald-400 bg-emerald-50/20 dark:border-emerald-500/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                : 'border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-900'
              } p-4 sm:p-5 shadow-card`}
            >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">
                  <CheckSquare className="h-4 w-4" />
                </span>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    {editingTaskId ? 'Edit Task' : 'Task Genesis'}
                  </h2>
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

            <form onSubmit={handleCreateOrUpdateTask} className="task-genesis-form mt-4 space-y-3">
              {/* TASK TITLE WITH INTEGRATED LINK GOAL / MANUAL TOGGLE (As in image.png) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Task Title / Purpose
                  </label>
                  {/* Mode Selector: Link Goal vs Manual */}
                  <LinkModeSelector
                    value={taskInputMode}
                    ariaLabel="Task goal link mode"
                    options={[{ value: 'link', label: 'Link Goal' }, { value: 'manual', label: 'Manual' }]}
                    onChange={mode => mode === 'link' ? switchToLinkMode() : switchToManualMode()}
                    className="task-genesis-mode-toggle"
                  />
                </div>

                {/* When Link from Goal is active */}
                {taskInputMode === 'link' && (
                  <div className="task-genesis-goal-link-panel mb-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Select Target Goal to Link *
                      </label>
                    </div>
                    <GoalPicker
                      goals={goals}
                      value={goalId}
                      onChange={handleSelectGoalForTask}
                      placeholder="-- Choose Goal --"
                      flatFilters
                      className="task-genesis-field h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
                    />

                  </div>
                )}

                <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Linked Strategy (optional)
                    <select value={strategyId} onChange={event => handleSelectStrategyForTask(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                      <option value="">None</option>
                      {strategies.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
                    </select>
                  </label>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Linked Mission (optional)
                    <select value={missionId} onChange={event => handleSelectMissionForTask(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                      <option value="">None</option>
                      {missions.filter(item => item.status !== 'archived').map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
                    </select>
                  </label>
                </div>

                <input
                  ref={titleInputRef}
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="task-genesis-field mt-1 h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50/50 px-3 pr-8 text-left text-sm text-ellipsis text-slate-900 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Domain
                  </label>
                  <div className="relative mt-1">
                    <select
                      value={domain}
                      onChange={e => setDomain(e.target.value as any)}
                      className="task-genesis-field h-10 w-full min-w-0 appearance-none rounded-lg border border-slate-200 bg-slate-50/50 px-3 pr-9 text-left text-sm text-ellipsis text-slate-900 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="work">Work</option>
                      <option value="personal">Personal</option>
                      <option value="health">Health</option>
                      <option value="finance">Finance</option>
                      <option value="spiritual">Spiritual</option>
                      <option value="social">Social</option>
                      <option value="learning">Learning</option>
                    </select>
                    <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Priority
                  </label>
                  <div className="relative mt-1">
                    <select
                      value={priority}
                      onChange={e => setPriority(e.target.value as any)}
                      className="task-genesis-field h-10 w-full min-w-0 appearance-none rounded-lg border border-slate-200 bg-slate-50/50 px-3 pr-9 text-left text-sm text-ellipsis text-slate-900 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                    <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Due Date
                  </label>
                  <ThemedDateTimeInput
                    type="date"
                    value={dueAt}
                    onChange={e => setDueAt(e.target.value)}
                    className="task-genesis-field mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 font-mono text-sm text-slate-900 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Strategic Goal
                  </label>
                  <div className="relative mt-1">
                    <select
                      value={goalId}
                      onChange={e => handleSelectGoalForTask(e.target.value)}
                      className="task-genesis-field h-10 w-full min-w-0 appearance-none rounded-lg border border-slate-200 bg-slate-50/50 px-3 pr-9 text-left text-sm text-ellipsis text-slate-900 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="">None (Independent)</option>
                      {goals.map(g => (
                        <option key={g.id} value={g.id}>{g.title}</option>
                      ))}
                    </select>
                    <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Description / Context
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="task-genesis-field mt-1 h-[4.25rem] w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Checklist / Subtasks
                </label>
                <textarea
                  rows={3}
                  value={checklistText}
                  onChange={e => setChecklistText(e.target.value)}
                  placeholder={'Enter one step per line'}
                  className="task-genesis-field mt-1 h-[5.25rem] w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {!editingTaskId && (
                <div className="task-genesis-alarm-options space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={armTaskGenesisAlarm}
                      onChange={e => setArmTaskGenesisAlarm(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="inline-flex items-center gap-1"><ThemeIcon name="zap" className="h-3 w-3" /> Arm Audio Reminder Alarm on Creation</span>
                  </label>
                  {armTaskGenesisAlarm && (
                    <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Alarm Time</label>
                        <ThemedDateTimeInput
                          type="time"
                          value={taskGenesisAlarmTime}
                          onChange={e => setTaskGenesisAlarmTime(e.target.value)}
                          className="task-genesis-field mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm font-mono dark:border-slate-700 dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Ringtone</label>
                        <div className="relative mt-1">
                          <select
                            value={taskGenesisRingtone}
                            onChange={e => setTaskGenesisRingtone(e.target.value)}
                            className="task-genesis-field h-10 w-full min-w-0 appearance-none rounded-lg border border-slate-200 bg-slate-50/50 px-3 pr-9 text-left text-sm text-ellipsis dark:border-slate-700 dark:bg-slate-800"
                          >
                            {BUILTIN_RINGTONES.map(r => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={!title.trim()}
                className="w-full rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {editingTaskId ? 'Update Task' : '＋ Add Task to Planner'}
              </button>
            </form>
          </div>

          {/* Task Filter Tabs & All Tasks List */}
          {tasks.length > 0 && <section id="task-roster-card" data-task-roster-card className="lg:col-span-7 rounded-lg border border-slate-200/80 bg-white p-5 shadow-none dark:border-slate-800/80 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Task Roster ({filteredTasks.length})
              </h2>
              <details ref={taskFilterMenuRef} className="relative shrink-0">
                <summary className="flex h-5 cursor-pointer list-none items-center gap-2 rounded-none border-0 bg-transparent px-2.5 text-xs font-semibold text-slate-700 shadow-none hover:bg-slate-50 dark:bg-transparent dark:text-slate-200 dark:hover:bg-slate-800/40">
                  <Filter className="h-3.5 w-3.5" />
                  <span>Filter</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </summary>
                <div className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
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
                      onClick={() => {
                        setFilterTab(tab.id as typeof filterTab);
                        if (taskFilterMenuRef.current) taskFilterMenuRef.current.open = false;
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors ${
                        filterTab === tab.id
                          ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      {tab.label}
                      {filterTab === tab.id && <Check className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </div>
              </details>
            </div>

            {/* Tasks List */}
            <div className="space-y-2">
              {filteredTasks.length === 0 ? (
                <div className="col-span-full">
                  <EmptyState
                    icon={CheckSquare}
                    compact
                    title="No tasks in this view"
                    hint="Create a task with Quick Capture or clear the active filters."
                  />
                </div>
              ) : (
                filteredTasks.map(task => (
                  <div
                    key={task.id}
                    className="dashboard-item-row progressive-row flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-none border-0 p-3 text-sm shadow-none transition-all hover:border-0 hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className={`truncate font-semibold ${task.done ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                        {task.title}
                      </div>
                      {task.description && (
                        <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                          {task.description}
                        </div>
                      )}
                      {(task.checklist || []).length > 0 && (
                        <div className="mt-1.5 space-y-1">
                          {task.checklist!.map(item => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => void handleToggleChecklistItem(task, item.id)}
                              className="flex w-full items-center gap-2 text-left text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                            >
                              <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${item.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                                {item.done && <Check className="h-2.5 w-2.5" />}
                              </span>
                              <span className={item.done ? 'line-through opacity-60' : ''}>{item.text}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-slate-400">
                        <span className="capitalize">{task.domain}</span>
                        <span aria-hidden="true">·</span>
                        <span className={task.priority === 'High' ? 'text-rose-600 dark:text-rose-400' : task.priority === 'Medium' ? 'text-amber-600 dark:text-amber-400' : undefined}>
                          {task.priority} Priority
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{task.dueAt ? `Due ${task.dueAt}` : 'No due date'}</span>
                        {task.strategyId && <span className="text-indigo-600 dark:text-indigo-300">Strategy: {strategies.find(item => item.id === task.strategyId)?.title || 'Strategy'}</span>}
                        {task.missionId && <span className="text-amber-700 dark:text-amber-300">Mission: {missions.find(item => item.id === task.missionId)?.title || 'Mission'}</span>}
                      {task.goalId && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex min-w-0 items-center gap-1 text-indigo-600 dark:text-indigo-300">
                              <Target className="h-3 w-3 shrink-0" />
                              <span className="max-w-40 truncate">{goals.find(g => g.id === task.goalId)?.title || 'Goal'}</span>
                            </span>
                          </>
                      )}
                        {task.done && <span className="text-emerald-600 dark:text-emerald-400">· ✓ Reflected</span>}
                      </div>

                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleTask(task)}
                        aria-label={task.done ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
                        title={task.done ? 'Mark incomplete' : 'Mark complete'}
                        className={`flex h-5 w-5 items-center justify-center rounded-lg border transition-all cursor-pointer ${
                          task.done
                            ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                            : 'border-slate-300 hover:border-indigo-500 dark:border-slate-600'
                        }`}
                      >
                        {task.done && <Check className="h-3.5 w-3.5" />}
                      </button>
                    <ProgressiveActions label={`More actions for ${task.title}`} className="shrink-0">
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
                    </ProgressiveActions>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>}
        </div>
      )}

      {/* SUBMENU 2: DAILY COMMAND TARGET (With File Save, Export, and History!) */}
      {activeWorkAreaSection === 'tasks-daily' && (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className={`${savedTargetsArchive.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'} rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-5`}>
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300">
                  <ThemeIcon name="target" className="h-4 w-4" />
                </span>
                <span>Daily Command Target</span>
              </h2>
              <div className="mt-4 space-y-3.5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* Decisive Victory Target */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Core Priority
                    </label>
                    <input
                      type="text"
                      value={plannerTarget}
                      onChange={e => setPlannerTarget(e.target.value)}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm font-medium text-slate-900 transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  {/* Progress Slider */}
                  <div>
                    <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <label htmlFor="daily-command-progress">
                        Execution Progress
                      </label>
                      <span className="shrink-0 font-mono text-sm font-bold text-amber-600 dark:text-amber-300">
                        {plannerProgress}%
                      </span>
                    </div>
                    <div className="mt-2 px-1">
                      <input
                        id="daily-command-progress"
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={plannerProgress}
                        onChange={e => setPlannerProgress(Number(e.target.value))}
                        className="block h-2 w-full accent-amber-600 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Related Mission (optional)
                  </label>
                  <select
                    value={plannerMissionId}
                    onChange={event => setPlannerMissionId(event.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">No linked mission</option>
                    {missions.filter(item => item.status !== 'archived' || item.id === plannerMissionId).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                  <p className="mt-1 text-[10px] text-slate-400">This links today's target to a mission; it does not change Goal progress by itself.</p>
                </div>

                {/* Action Checkpoints */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Action Checkpoints
                  </label>
                  <input
                    type="text"
                    value={pointText}
                    onChange={e => setPointText(e.target.value)}
                    onKeyDown={handleAddPlannerPoint}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />

                  <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                    {(dailyPlanner?.points || []).length > 0 && (
                      (dailyPlanner?.points || []).map(pt => (
                        <div
                          key={pt.id}
                          onClick={() => {
                            if (editingPointId !== pt.id) void handleTogglePoint(pt.id);
                          }}
                          className="group flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-card-soft cursor-pointer"
                        >
                          <div className="flex min-w-0 items-center gap-2.5 pr-2">
                            {pt.done ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                            ) : (
                              <Circle className="h-4 w-4 shrink-0 text-ink-muted/50" />
                            )}
                            {editingPointId === pt.id ? (
                              <input
                                autoFocus
                                value={editingPointText}
                                onClick={event => event.stopPropagation()}
                                onChange={event => setEditingPointText(event.target.value)}
                                onKeyDown={event => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    void handleSavePoint(pt.id, event);
                                  } else if (event.key === 'Escape') {
                                    event.stopPropagation();
                                    setEditingPointId(null);
                                  }
                                }}
                                aria-label="Edit checkpoint"
                                className="min-w-0 flex-1 rounded-md border border-indigo-300 bg-white px-2 py-1 text-sm text-slate-900 focus:outline-none dark:border-indigo-700 dark:bg-slate-800 dark:text-white"
                              />
                            ) : (
                              <span className={pt.done ? 'text-ink-muted line-through' : 'font-medium text-ink'}>
                                {pt.text}
                              </span>
                            )}
                          </div>
                          {editingPointId === pt.id && (
                            <button
                              type="button"
                              onClick={event => void handleSavePoint(pt.id, event)}
                              className="p-1 text-indigo-600 hover:text-indigo-800"
                              title="Save checkpoint"
                              aria-label="Save checkpoint"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {editingPointId !== pt.id && (
                            <button
                              type="button"
                              onClick={event => {
                                event.stopPropagation();
                                setEditingPointId(pt.id);
                                setEditingPointText(pt.text);
                              }}
                              className="p-1 text-slate-400 transition-colors hover:text-indigo-600"
                              title="Edit checkpoint"
                              aria-label={`Edit checkpoint ${pt.text}`}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleDeletePoint(pt.id, e)}
                            className="p-1 text-slate-300 opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"
                            title="Remove checkpoint"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Wins & Reflections */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Daily Victories & Wins
                    </label>
                    <textarea
                      rows={3}
                      value={dailyWins}
                      onChange={e => setDailyWins(e.target.value)}
                      className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm text-slate-900 transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Evening Reflection & Learnings
                    </label>
                    <textarea
                      rows={3}
                      value={eveningReview}
                      onChange={e => setEveningReview(e.target.value)}
                      className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm text-slate-900 transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={handleSaveToFile}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-200/80 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-200 dark:hover:bg-amber-950/30 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
                  <span>Save to File</span>
                </button>

                <button
                  type="button"
                  onClick={handleSavePlannerTarget}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-transparent px-3.5 py-2 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-50 cursor-pointer dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/30"
                >
                  <Save className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
                  <span>{editingSavedTargetId ? 'Update Saved Target' : 'Save Target'}</span>
                </button>
                {editingSavedTargetId && (
                  <button
                    type="button"
                    onClick={handleCancelEditSavedRecord}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {savedTargetsArchive.length > 0 && (
              <div className="lg:col-span-7 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
                <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Command history
                  </h2>
                </div>

                <div className="mt-2 max-h-[500px] space-y-2 overflow-y-auto">
                  {savedTargetsArchive.map(rec => (
                    <div
                      key={rec.id}
                      className="dashboard-item-row group flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 text-sm transition-all hover:border-slate-200 hover:bg-slate-50/80 dark:border-slate-800/60 dark:hover:bg-slate-800/40"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-slate-900 dark:text-white">
                          {rec.target}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-400">
                          {rec.date} · {rec.pointsDone}/{rec.pointsCount}
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                        {rec.progress}%
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditSavedRecord(rec)}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800"
                          title="Edit saved target"
                          aria-label={`Edit saved target ${rec.target}`}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLoadSavedRecord(rec)}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/40 dark:hover:text-amber-300"
                          title="Load saved target"
                          aria-label={`Load saved target ${rec.target}`}
                        >
                          <Save className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = savedTargetsArchive.filter(r => r.id !== rec.id);
                            try {
                              localStorage.setItem(`om-saved-command-targets:${storage.getActiveProfileId()}`, JSON.stringify(updated));
                              setSavedTargetsArchive(updated);
                              if (editingSavedTargetId === rec.id) setEditingSavedTargetId(null);
                            } catch (error) {
                              console.error('Unable to remove saved command target', error);
                              onSuccess('Unable to remove the saved target. Check browser storage and try again.');
                            }
                          }}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/40"
                          title="Remove record"
                          aria-label={`Remove saved target ${rec.target}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                      className={`px-1 py-2 text-center text-xs font-bold transition-colors cursor-pointer ${
                        alarmPresetChoice === p.id
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
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
                    <ThemedDateTimeInput
                      type="date"
                      value={quickCustomDate}
                      onChange={e => setQuickCustomDate(e.target.value)}
                      className="mt-0.5 h-8 w-full rounded-lg border border-slate-200 px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500">Time</label>
                    <ThemedDateTimeInput
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
                  Arm Alarm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
