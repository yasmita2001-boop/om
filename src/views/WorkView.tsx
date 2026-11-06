import { ThemedDateTimeInput } from '../components/ThemedDateTimeInput';
import React, { useState } from 'react';
import {
  BookOpen, Trash2, Award, Edit3, X,
  Target, BellRing, Bell, Zap
} from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import {
  LearningItem, Skill, Goal,
  Task, TaskPriority, ReminderItem
} from '../types';
import { storage, generateUUID } from '../lib/storage';
import { getLocalDateString, getLocalDateTimeString } from '../lib/dateUtils';
import {
  syncGoalProgressFromLearning,
  syncGoalProgressFromSkills,
  syncGoalProgressFromTasks
} from '../lib/goalTaskSync';
import { ConfirmModal } from '../components/ConfirmModal';
import { LinkModeSelector } from '../components/LinkModeSelector';
import { SlideTabs } from '../components/SlideTabs';
import { FormToggleButton } from '../components/FormToggleButton';
import { computeItemDelay } from '../components/TimelinePlan';
import { alarmService } from '../lib/alarmService';
import { BUILTIN_RINGTONES } from '../lib/alarmAudio';
import { ProgressiveActions } from '../components/ProgressiveActions';
import { GoalPicker } from '../components/GoalPicker';
import { GoalTierIcon, ThemeIcon } from '../components/ThemeIcon';

interface WorkViewProps {
  learningItems: LearningItem[];
  skills?: Skill[];
  goals?: Goal[];
  tasks?: Task[];
  reminders?: ReminderItem[];
  embedded?: boolean;
  initialTab?: WorkTab;
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
}

type WorkTab = 'learning' | 'skills';

interface DeleteTarget {
  type: 'learning' | 'skill';
  id: string;
  name: string;
  store: string;
}

interface EditTarget {
  type: 'learning' | 'skill';
  item: any;
}

export const WorkView: React.FC<WorkViewProps> = ({
  learningItems,
  skills = [],
  goals = [],
  embedded = false,
  initialTab = 'learning',
  onRefresh,
  onSuccess
}) => {
  const today = getLocalDateString();
  const [activeTab, setActiveTab] = useState<WorkTab>(initialTab);
  const [openWorkForm, setOpenWorkForm] = useState<WorkTab | null>(embedded ? initialTab : null);

  // Task Genesis Modal State
  const [genesisModal, setGenesisModal] = useState<{
    isOpen: boolean;
    sourceType: 'learning' | 'skill';
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
    sourceType: 'learning',
    title: '',
    priority: 'High',
    dueAt: today,
    goalId: goals[0]?.id || '',
    armAlarm: true,
    ringtone: 'digital_pulse',
    alarmTime: '09:00'
  });

  // New Item Forms: Learning Tracks
  const [learnTitle, setLearnTitle] = useState('');
  const [learnType, setLearnType] = useState('Course');
  const [learnProgress, setLearnProgress] = useState(0);
  const [learnTargetDate, setLearnTargetDate] = useState('');
  const [learnInputMode, setLearnInputMode] = useState<'manual' | 'link'>('manual');
  const [learnGoalId, setLearnGoalId] = useState<string>('');
  const [learnArmGenesis, setLearnArmGenesis] = useState(false);
  const [learnTaskPriority, setLearnTaskPriority] = useState<TaskPriority>('Medium');
  const [learnAlarmTime, setLearnAlarmTime] = useState('10:00');
  const learnRingtone = 'morning_chime';

  // New Item Forms: Skills
  const [skillName, setSkillName] = useState('');
  const [skillLevel, setSkillLevel] = useState('Intermediate');
  const [targetLevel, setTargetLevel] = useState('Mastery');
  const [skillTargetDate, setSkillTargetDate] = useState('');
  const [skillInputMode, setSkillInputMode] = useState<'manual' | 'link'>('manual');
  const [skillGoalId, setSkillGoalId] = useState<string>('');
  const [skillArmGenesis, setSkillArmGenesis] = useState(false);
  const [skillTaskPriority, setSkillTaskPriority] = useState<TaskPriority>('Medium');
  const [skillAlarmTime, setSkillAlarmTime] = useState('18:00');
  const skillRingtone = 'zen_bell';

  // Quick Preset Alarm Modal
  const [quickAlarmItem, setQuickAlarmItem] = useState<{
    id: string;
    title: string;
    type: 'learning' | 'skill';
    due?: string;
  } | null>(null);
  const [alarmPresetChoice, setAlarmPresetChoice] = useState<'5m' | '15m' | '30m' | '1h' | 'tonight' | 'tomorrow' | 'custom'>('15m');
  const quickCustomDate = today;
  const quickCustomTime = '18:00';
  const [quickAlarmRingtone, setQuickAlarmRingtone] = useState('digital_pulse');

  // Edit & Delete modal states
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  // Edit form internal fields
  const [editTitle, setEditTitle] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [editNumber, setEditNumber] = useState<number>(0);
  const [editExtra, setEditExtra] = useState('');
  const [editGoalId, setEditGoalId] = useState<string>('');

  const handleSelectGoalForLearning = (gId: string) => {
    setLearnGoalId(gId);
    if (!gId) return;
    const matched = goals.find(g => g.id === gId);
    if (matched) {
      if (!learnTitle.trim() || goals.some(g => learnTitle.includes(g.title))) {
        setLearnTitle(`Mastery Track: ${matched.title}`);
      }
    }
  };

  const handleSelectGoalForSkill = (gId: string) => {
    setSkillGoalId(gId);
    if (!gId) return;
    const matched = goals.find(g => g.id === gId);
    if (matched) {
      if (!skillName.trim() || goals.some(g => skillName.includes(g.title))) {
        setSkillName(`Competency: ${matched.title}`);
      }
    }
  };

  const handleOpenEdit = (type: EditTarget['type'], item: any) => {
    setEditTarget({ type, item });
    setEditGoalId(item.goalId || '');
    if (type === 'learning') {
      setEditTitle(item.title || '');
      setEditSubtitle(item.type || 'Course');
      setEditNumber(item.progress || 0);
    } else if (type === 'skill') {
      setEditTitle(item.name || '');
      setEditSubtitle(item.level || 'Intermediate');
      setEditExtra(item.targetLevel || 'Mastery');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget || !editTitle.trim()) return;

    const { type, item } = editTarget;
    const now = Date.now();

    if (type === 'learning') {
      const oldGoalId = item.goalId;
      const prog = Number(editNumber) || 0;
      const updated: LearningItem = {
        ...item,
        title: editTitle.trim(),
        type: editSubtitle.trim() || 'Course',
        progress: prog,
        goalId: editGoalId || null,
        updatedAt: now
      };
      await storage.put('learningItems', updated);
      onSuccess('✓ Learning curriculum item updated');

      if (editGoalId) {
        await syncGoalProgressFromLearning(editGoalId, item.id, prog);
      }
      if (oldGoalId && oldGoalId !== editGoalId) {
        await syncGoalProgressFromLearning(oldGoalId);
      }
    } else if (type === 'skill') {
      const oldGoalId = item.goalId;
      const lvl = editSubtitle.trim() || 'Intermediate';
      const updated: Skill = {
        ...item,
        name: editTitle.trim(),
        level: lvl,
        targetLevel: editExtra.trim() || 'Mastery',
        goalId: editGoalId || null,
        progress: lvl === 'Mastery' ? 100 : lvl === 'Advanced' ? 75 : lvl === 'Intermediate' ? 50 : 25
      };
      await storage.put('skills', updated);
      onSuccess('✓ Skill item updated');

      if (editGoalId) {
        await syncGoalProgressFromSkills(editGoalId, item.id, lvl);
      }
      if (oldGoalId && oldGoalId !== editGoalId) {
        await syncGoalProgressFromSkills(oldGoalId);
      }
    }

    setEditTarget(null);
    onRefresh();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      let linkedGoalId: string | null = null;
      if (deleteTarget.store === 'learningItems') {
        linkedGoalId = learningItems.find(l => l.id === deleteTarget.id)?.goalId || null;
      } else if (deleteTarget.store === 'skills') {
        linkedGoalId = skills.find(s => s.id === deleteTarget.id)?.goalId || null;
      }

      await storage.delete(deleteTarget.store, deleteTarget.id);

      if (linkedGoalId) {
        if (deleteTarget.store === 'learningItems') await syncGoalProgressFromLearning(linkedGoalId);
        else if (deleteTarget.store === 'skills') await syncGoalProgressFromSkills(linkedGoalId);
      }

      onSuccess(`✓ ${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      onRefresh();
    } catch (err) {
      console.error('Delete error', err);
    }
  };

  const handleOpenGenesisForLearning = (item: LearningItem) => {
    setGenesisModal({
      isOpen: true,
      sourceType: 'learning',
      sourceId: item.id,
      title: `Study Session: ${item.title}`,
      priority: 'Medium',
      dueAt: today,
      goalId: item.goalId || goals[0]?.id || '',
      armAlarm: true,
      ringtone: 'morning_chime',
      alarmTime: '10:00'
    });
  };

  const handleOpenGenesisForSkill = (s: Skill) => {
    setGenesisModal({
      isOpen: true,
      sourceType: 'skill',
      sourceId: s.id,
      title: `Practice & Drill: ${s.name}`,
      priority: 'Medium',
      dueAt: today,
      goalId: s.goalId || goals[0]?.id || '',
      armAlarm: true,
      ringtone: 'zen_bell',
      alarmTime: '18:00'
    });
  };

  const handleSaveGenesisTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genesisModal.title.trim()) return;

    const taskId = generateUUID();
    const newTask: Task = {
      id: taskId,
      title: genesisModal.title.trim(),
      domain: genesisModal.sourceType === 'learning' ? 'learning' : 'work',
      priority: genesisModal.priority,
      dueAt: genesisModal.dueAt,
      date: genesisModal.dueAt,
      goalId: genesisModal.goalId || null,
      learningId: genesisModal.sourceType === 'learning' ? genesisModal.sourceId : null,
      skillId: genesisModal.sourceType === 'skill' ? genesisModal.sourceId : null,
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
        title: `Genesis Task Alarm: ${newTask.title}`,
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
    onSuccess(`Task Genesis deployed for "${newTask.title}"! Task and audio reminder armed.`);
    onRefresh();
  };

  const handleTriggerUrgentAlarm = (title: string, subtitle?: string) => {
    alarmService.triggerAlarm({
      id: generateUUID(),
      type: 'reminder',
      title: `DELAY ALERT: ${title}`,
      subtitle: subtitle || 'Deliverable is overdue beyond scheduled date!',
      timeStr: 'NOW',
      ringtone: 'digital_pulse'
    });
    onSuccess(`Urgent alarm ringing for "${title}"!`);
  };

  const handleAddLearning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!learnTitle.trim()) return;

    const itemId = generateUUID();
    const prog = Number(learnProgress) || 0;
    const l: LearningItem = {
      id: itemId,
      title: learnTitle.trim(),
      type: learnType,
      progress: prog,
      targetDate: learnTargetDate || undefined,
      goalId: learnGoalId || null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await storage.put('learningItems', l);

    // If Study Session Task Genesis armed on creation
    if (learnArmGenesis) {
      const taskId = generateUUID();
      const taskDue = learnTargetDate || today;
      const newTask: Task = {
        id: taskId,
        title: `Study Session: ${l.title}`,
        domain: 'learning',
        priority: learnTaskPriority,
        dueAt: taskDue,
        date: taskDue,
        goalId: learnGoalId || null,
        done: false,
        status: 'open',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await storage.put('tasks', newTask);

      const alarmDueAt = `${taskDue}T${learnAlarmTime}`;
      await storage.put('reminders', {
        id: generateUUID(),
        title: `Learning Genesis Alarm: ${newTask.title}`,
        dueAt: alarmDueAt,
        repeatRule: 'none',
        status: 'open',
        linkedId: taskId,
        alarmEnabled: true,
        ringtone: learnRingtone,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      if (learnGoalId) {
        await syncGoalProgressFromTasks(learnGoalId, taskId, false);
      }
    }

    if (learnGoalId) {
      await syncGoalProgressFromLearning(learnGoalId, l.id, prog);
    }

    onSuccess(learnArmGenesis ? '✓ Learning Track & Study Task Genesis with Alarm deployed!' : (learnGoalId ? '✓ Learning track linked to Goal & added' : '✓ Learning curriculum updated'));
    setLearnTitle('');
    setLearnProgress(0);
    setLearnTargetDate('');
    setLearnGoalId('');
    setLearnArmGenesis(false);
    onRefresh();
  };

  const handleUpdateLearningProgress = async (item: LearningItem, deltaOrExact: number, isExact = false) => {
    const nextProg = isExact
      ? Math.max(0, Math.min(100, deltaOrExact))
      : Math.max(0, Math.min(100, (item.progress || 0) + deltaOrExact));

    const updated: LearningItem = {
      ...item,
      progress: nextProg,
      updatedAt: Date.now()
    };
    await storage.put('learningItems', updated);

    if (item.goalId) {
      const res = await syncGoalProgressFromLearning(item.goalId, item.id, nextProg);
      if (res.targetGoal) {
        onSuccess(`✓ Learning track updated to ${nextProg}%! Goal "${res.targetGoal.title}" progress updated to ${res.targetGoal.progress}%`);
      } else {
        onSuccess(`✓ Learning progress updated to ${nextProg}%`);
      }
    } else {
      onSuccess(`✓ Learning progress updated to ${nextProg}%`);
    }
    onRefresh();
  };

  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillName.trim()) return;

    const skillId = generateUUID();
    const prog = skillLevel === 'Mastery' ? 100 : skillLevel === 'Advanced' ? 75 : skillLevel === 'Intermediate' ? 50 : 25;
    const s: Skill = {
      id: skillId,
      name: skillName.trim(),
      level: skillLevel,
      targetLevel,
      progress: prog,
      targetDate: skillTargetDate || undefined,
      goalId: skillGoalId || null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await storage.put('skills', s);

    // If Practice Drill Task Genesis armed on creation
    if (skillArmGenesis) {
      const taskId = generateUUID();
      const taskDue = skillTargetDate || today;
      const newTask: Task = {
        id: taskId,
        title: `Practice Drill: ${s.name}`,
        domain: 'work',
        priority: skillTaskPriority,
        dueAt: taskDue,
        date: taskDue,
        goalId: skillGoalId || null,
        done: false,
        status: 'open',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await storage.put('tasks', newTask);

      const alarmDueAt = `${taskDue}T${skillAlarmTime}`;
      await storage.put('reminders', {
        id: generateUUID(),
        title: `Skill Genesis Alarm: ${newTask.title}`,
        dueAt: alarmDueAt,
        repeatRule: 'none',
        status: 'open',
        linkedId: taskId,
        alarmEnabled: true,
        ringtone: skillRingtone,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      if (skillGoalId) {
        await syncGoalProgressFromTasks(skillGoalId, taskId, false);
      }
    }

    if (skillGoalId) {
      await syncGoalProgressFromSkills(skillGoalId, s.id, skillLevel);
    }

    onSuccess(skillArmGenesis ? '✓ Skill Tree & Practice Task Genesis with Alarm deployed!' : (skillGoalId ? '✓ Skill registered & linked to Goal' : '✓ Skill tree item registered'));
    setSkillName('');
    setSkillTargetDate('');
    setSkillGoalId('');
    setSkillArmGenesis(false);
    onRefresh();
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
      title: `Reminder Alarm: ${quickAlarmItem.title}`,
      dueAt: targetDueAt,
      repeatRule: 'none',
      status: 'open',
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

  const handleUpdateSkillLevel = async (s: Skill, newLevel: string) => {
    const prog = newLevel === 'Mastery' ? 100 : newLevel === 'Advanced' ? 75 : newLevel === 'Intermediate' ? 50 : 25;
    const updated: Skill = {
      ...s,
      level: newLevel,
      progress: prog
    };
    await storage.put('skills', updated);

    if (s.goalId) {
      const res = await syncGoalProgressFromSkills(s.goalId, s.id, newLevel);
      if (res.targetGoal) {
        onSuccess(`✓ Skill advanced to ${newLevel}! Goal "${res.targetGoal.title}" progress updated to ${res.targetGoal.progress}%`);
      } else {
        onSuccess(`✓ Skill level updated to ${newLevel}`);
      }
    } else {
      onSuccess(`✓ Skill level updated to ${newLevel}`);
    }
    onRefresh();
  };

  const renderWorkFormAction = () => {
    if (activeTab === 'learning') {
      return <FormToggleButton label="Add Learning Track" open={openWorkForm === 'learning'} onClick={() => setOpenWorkForm(openWorkForm === 'learning' ? null : 'learning')} />;
    }
    if (activeTab === 'skills') {
      return <FormToggleButton label="Add Skill" open={openWorkForm === 'skills'} onClick={() => setOpenWorkForm(openWorkForm === 'skills' ? null : 'skills')} />;
    }
    return null;
  };

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-6'}>
      {!embedded && <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl flex items-center gap-2">
          <span>Learning & Skill Trees</span>
        </h1>
      </div>}

      {/* Learning and skill overview */}
      {!embedded && <div className="metric-summary-grid grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Learning Tracks</span>
            <BookOpen className="h-4 w-4 text-blue-500 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">
            {learningItems.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            Active tracks
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate">Skill Trees</span>
            <Award className="h-4 w-4 text-amber-500 shrink-0" />
          </div>
          <div className="mt-2.5 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">
            {skills.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            {skills.filter(s => (s.progress || 0) === 100).length} mastered
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
  
  
          <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">
            Agendas & syncs
          </div>
        </div>
      </div>}

      {/* Delay Alert Banner in WorkView */}
      {!embedded && (() => {
        const delayedLearning = learningItems.filter(l => l.progress < 100 && computeItemDelay({ ...l, targetDate: l.targetDate, dueAt: l.targetDate, progress: l.progress }).isDelayed);
        const delayedSkills = skills.filter(s => (s.progress || 0) < 100 && computeItemDelay({ ...s, targetDate: s.targetDate, dueAt: s.targetDate, progress: s.progress }).isDelayed);
        const totalWorkDelays = delayedLearning.length + delayedSkills.length;

        if (totalWorkDelays > 0) {
          const firstDelayedTitle = delayedLearning[0]?.title || delayedSkills[0]?.name || 'Deliverable';
          return (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border-2 border-rose-500/40 bg-gradient-to-r from-rose-500/15 via-rose-500/10 to-amber-500/15 p-4 dark:border-rose-900/60 dark:bg-rose-950/30">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-xs">
                  <span className="h-2.5 w-2.5 rounded-full bg-white animate-ping" />
                </span>
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                    <span>Work Delays Detected (⚠️ {totalWorkDelays})</span>
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                    {totalWorkDelays} items past target deadline: {delayedLearning.length > 0 ? `${delayedLearning.length} Learning ` : ''}{delayedSkills.length > 0 ? `· ${delayedSkills.length} Skills` : ''}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Deploy Task Genesis with alarm reminders to ensure urgent execution.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTriggerUrgentAlarm(firstDelayedTitle, 'Work deliverable or track overdue!')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-500 cursor-pointer"
                >
                  <BellRing className="h-4 w-4 animate-bounce" />
                  <span>Ring Alarm</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (delayedLearning.length > 0) handleOpenGenesisForLearning(delayedLearning[0]);
                    else if (delayedSkills.length > 0) handleOpenGenesisForSkill(delayedSkills[0]);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 cursor-pointer"
                >
                  <Zap className="h-3.5 w-3.5 text-amber-300" />
                  <span className="inline-flex items-center gap-1"><ThemeIcon name="zap" className="h-3.5 w-3.5" /> Task Genesis</span>
                </button>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Tabs (Full Width Responsive Slide Tab) */}
      {!embedded && <><div className="w-full pb-2 border-b border-slate-200 dark:border-slate-800">
        <SlideTabs
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as any)}
          tabs={(() => {
            const delayedLearningCount = learningItems.filter(l => l.progress < 100 && computeItemDelay({ ...l, targetDate: l.targetDate, dueAt: l.targetDate, progress: l.progress }).isDelayed).length;
            const delayedSkillsCount = skills.filter(s => (s.progress || 0) < 100 && computeItemDelay({ ...s, targetDate: s.targetDate, dueAt: s.targetDate, progress: s.progress }).isDelayed).length;

            return [
              { id: 'learning', label: `Learning Tracks (${learningItems.length})`, shortLabel: `Tracks (${learningItems.length})`, icon: BookOpen, delayed: delayedLearningCount },
              { id: 'skills', label: `Skill Trees (${skills.length})`, shortLabel: `Skills (${skills.length})`, icon: Award, delayed: delayedSkillsCount },
              
            ];
          })()}
          extraRight={<div className="hidden sm:block">{renderWorkFormAction()}</div>}
        />
      </div>
      <div className="flex justify-end sm:hidden">
        {renderWorkFormAction()}
      </div>
      </>}

      {/* Tab: Learning */}
      {activeTab === 'learning' && (
        <div className={`grid grid-cols-1 items-start lg:grid-cols-12 ${embedded ? 'gap-4' : 'gap-6'}`}>
          {openWorkForm === 'learning' && <div className={`${embedded && learningItems.length === 0 ? 'lg:col-span-12' : 'lg:col-span-5'} rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-5`}>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Learning Genesis</h2>
            </div>
            <form onSubmit={handleAddLearning} className="mt-4 space-y-3.5">
              {/* LEARNING TRACK TITLE WITH INTEGRATED LINK GOAL / MANUAL TOGGLE (As in image.png) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Course / Curriculum Title
                  </label>
                  {/* Mode Selector: Link Goal vs Manual */}
                  <LinkModeSelector
                    value={learnInputMode}
                    ariaLabel="Learning goal link mode"
                    options={[{ value: 'link', label: 'Link Goal' }, { value: 'manual', label: 'Manual' }]}
                    onChange={mode => {
                      if (mode === 'link') {
                        setLearnInputMode('link');
                        if (goals.length > 0 && !learnGoalId) handleSelectGoalForLearning(goals[0].id);
                      } else {
                        setLearnInputMode('manual');
                        setLearnGoalId('');
                      }
                    }}
                  />
                </div>

                {learnInputMode === 'link' && (
                  <div className="mb-2 space-y-1.5 rounded-xl border border-indigo-200/80 bg-indigo-50/60 p-2.5 dark:border-indigo-900/60 dark:bg-indigo-950/30">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                        Select Target Goal to Link *
                      </label>
                      {learnGoalId && (
                        <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                          {goals.find(g => g.id === learnGoalId)?.progress}% Done
                        </span>
                      )}
                    </div>
                    <GoalPicker
                      goals={goals || []}
                      value={learnGoalId}
                      onChange={handleSelectGoalForLearning}
                      placeholder="-- Choose Goal --"
                      className="h-10 w-full rounded-lg border border-indigo-300 bg-white px-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-indigo-700 dark:bg-slate-900 dark:text-white cursor-pointer font-medium"
                    />
                    {learnGoalId && (
                      <span className="block text-[10px] text-indigo-800 dark:text-indigo-300">
                        <ThemeIcon name="zap" className="mr-1 inline h-3 w-3" />Advancing learning progress will reflect directly into this goal!
                      </span>
                    )}
                  </div>
                )}

                <input
                  type="text"
                  required
                  value={learnTitle}
                  onChange={e => setLearnTitle(e.target.value)}
                  placeholder="e.g. Distributed Systems in Go"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Type</label>
                  <input
                    type="text"
                    value={learnType}
                    onChange={e => setLearnType(e.target.value)}
                    placeholder="Book, Course, Paper"
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Progress ({learnProgress}%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={learnProgress}
                    onChange={e => setLearnProgress(Number(e.target.value))}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Target Completion Date</label>
                <ThemedDateTimeInput
                  type="date"
                  value={learnTargetDate}
                  onChange={e => setLearnTargetDate(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                />
              </div>

              {/* Task Genesis deployment with Alarm toggle on Creation */}
              <div className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 dark:border-indigo-900/60 dark:bg-indigo-950/20">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  <input
                    type="checkbox"
                    checked={learnArmGenesis}
                    onChange={e => setLearnArmGenesis(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="inline-flex items-center gap-1"><ThemeIcon name="zap" className="h-3 w-3" /> Deploy Study Session Task Genesis with Alarm</span>
                </label>
                {learnArmGenesis && (
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[10px]">
                    <div>
                      <label className="text-xs font-semibold text-slate-500">Priority</label>
                      <select
                        value={learnTaskPriority}
                        onChange={e => setLearnTaskPriority(e.target.value as any)}
                        className="mt-0.5 h-7 w-full rounded border border-slate-200 bg-white px-1 dark:border-slate-700 dark:bg-slate-800 text-[10px]"
                      >
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500">Alarm Time</label>
                      <ThemedDateTimeInput
                        type="time"
                        value={learnAlarmTime}
                        onChange={e => setLearnAlarmTime(e.target.value)}
                        className="mt-0.5 h-7 w-full rounded border border-slate-200 bg-white px-1 dark:border-slate-700 dark:bg-slate-800 text-[10px] font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 cursor-pointer"
              >
                + Register Learning Curriculum
              </button>
            </form>
          </div>}

          <div className={`${embedded && learningItems.length === 0 ? 'hidden' : ''} ${openWorkForm === 'learning' ? 'lg:col-span-7' : 'lg:col-span-12'} rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-5`}>
            <h2 className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 text-sm font-bold text-slate-900 dark:border-slate-800 dark:text-white">
              Curriculum & Mastery ({learningItems.length})
            </h2>
            <div className="adaptive-card-grid mt-4 gap-3">
              {learningItems.length === 0 ? (
                <div className="col-span-full"><EmptyState icon={BookOpen} compact title="No learning tracks yet" hint="Add a course or track to follow structured progress." /></div>
              ) : (
                [...learningItems].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(l => {
                  const linkedGoal = goals.find(g => g.id === l.goalId);
                  const isLearningDelayed = computeItemDelay({ ...l, targetDate: l.targetDate, dueAt: l.targetDate, progress: l.progress }).isDelayed && l.progress < 100;
                  const delayInfo = computeItemDelay({ ...l, targetDate: l.targetDate, dueAt: l.targetDate, progress: l.progress });

                  return (
                    <div
                      key={l.id}
                      className="dashboard-item-row rounded-xl border border-slate-100 p-3 text-xs dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-colors space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            {l.type || 'Curriculum'}
                          </span>
                          {isLearningDelayed && (
                            <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-white animate-pulse">
                              ⚠️ {delayInfo.label}
                            </span>
                          )}
                          {l.targetDate && <span>Target Date: {l.targetDate}</span>}
                        </div>

                        <ProgressiveActions label={`More actions for ${l.title}`} className="shrink-0">
                          {isLearningDelayed && (
                            <button
                              type="button"
                              onClick={() => handleTriggerUrgentAlarm(l.title, 'Study session overdue!')}
                              className="h-7 px-2 rounded-lg bg-rose-600 text-white hover:bg-rose-500 cursor-pointer flex items-center gap-1 text-[10px] font-bold shadow-2xs"
                              title="Ring Urgent Alarm"
                            >
                              <BellRing className="h-3 w-3 animate-bounce" />
                              <span>Alarm</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setQuickAlarmItem({ id: l.id, title: l.title, type: 'learning', due: l.targetDate })}
                            className="h-7 px-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                            title="Schedule Study Reminder Alarm"
                          >
                            <Bell className="h-3 w-3" />
                            <span>Set Alarm</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenGenesisForLearning(l)}
                            className="h-7 rounded-lg bg-emerald-50 px-2 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 cursor-pointer flex items-center gap-1"
                            title="Task Genesis with Reminder Alarm"
                          >
                            <Zap className="h-3 w-3 text-amber-500" />
                            <span>Genesis</span>
                          </button>

                          {/* EDIT BUTTON */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit('learning', l)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Edit Learning Track"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          {/* DELETE BUTTON */}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ type: 'learning', id: l.id, name: l.title, store: 'learningItems' })}
                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                            title="Delete Learning Track"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </ProgressiveActions>
                      </div>

                      <div className="w-full font-bold text-slate-900 dark:text-white text-sm leading-snug">
                        {l.title}
                      </div>

                      {/* Full-Width LINKED GOAL BADGE */}
                      {linkedGoal && (
                        <div className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                          <Target className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span className="w-full leading-snug">
                            <><GoalTierIcon level={linkedGoal.level} /> {linkedGoal.level === 5 ? 'Atomic' : linkedGoal.level === 4 ? 'Nano' : linkedGoal.level === 3 ? 'Micro' : linkedGoal.level === 2 ? 'Sub' : 'Main'}: {linkedGoal.title} ({linkedGoal.progress}%)</>
                          </span>
                        </div>
                      )}

                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                        <span>{l.type}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleUpdateLearningProgress(l, -10)}
                            className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 text-[10px] font-mono cursor-pointer"
                            title="Decrease 10%"
                          >
                            -10%
                          </button>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 px-1">
                            {l.progress}%
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateLearningProgress(l, 10)}
                            className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 text-[10px] font-mono cursor-pointer"
                            title="Increase 10%"
                          >
                            +10%
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateLearningProgress(l, 100, true)}
                            className={`ml-1 px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                              l.progress >= 100
                                ? 'bg-emerald-600 text-white'
                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            }`}
                          >
                            {l.progress >= 100 ? '✓ Complete' : '100%'}
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                          style={{ width: `${l.progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Skills */}
      {activeTab === 'skills' && (
        <div className={`grid grid-cols-1 items-start lg:grid-cols-12 ${embedded ? 'gap-4' : 'gap-6'}`}>
          {openWorkForm === 'skills' && <div className={`${embedded && skills.length === 0 ? 'lg:col-span-12' : 'lg:col-span-5'} rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-5`}>
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Skill Genesis</h2>
            </div>
            <form onSubmit={handleAddSkill} className="mt-4 space-y-3.5">
              {/* SKILL TREE TITLE WITH INTEGRATED LINK GOAL / MANUAL TOGGLE (As in image.png) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Skill Title / Purpose
                  </label>
                  {/* Mode Selector: Link Goal vs Manual */}
                  <LinkModeSelector
                    value={skillInputMode}
                    ariaLabel="Skill goal link mode"
                    options={[{ value: 'link', label: 'Link Goal' }, { value: 'manual', label: 'Manual' }]}
                    onChange={mode => {
                      if (mode === 'link') {
                        setSkillInputMode('link');
                        if (goals.length > 0 && !skillGoalId) handleSelectGoalForSkill(goals[0].id);
                      } else {
                        setSkillInputMode('manual');
                        setSkillGoalId('');
                      }
                    }}
                  />
                </div>

                {skillInputMode === 'link' && (
                  <div className="mb-2 space-y-1.5 rounded-xl border border-indigo-200/80 bg-indigo-50/60 p-2.5 dark:border-indigo-900/60 dark:bg-indigo-950/30">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                        Select Target Goal to Link *
                      </label>
                      {skillGoalId && (
                        <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                          {goals.find(g => g.id === skillGoalId)?.progress}% Done
                        </span>
                      )}
                    </div>
                    <GoalPicker
                      goals={goals || []}
                      value={skillGoalId}
                      onChange={handleSelectGoalForSkill}
                      placeholder="-- Choose Goal --"
                      className="h-10 w-full rounded-lg border border-indigo-300 bg-white px-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-indigo-700 dark:bg-slate-900 dark:text-white cursor-pointer font-medium"
                    />
                    {skillGoalId && (
                      <span className="block text-[10px] text-indigo-800 dark:text-indigo-300">
                        <ThemeIcon name="zap" className="mr-1 inline h-3 w-3" />Advancing this skill towards Mastery will roll up directly into this goal!
                      </span>
                    )}
                  </div>
                )}

                <input
                  type="text"
                  required
                  value={skillName}
                  onChange={e => setSkillName(e.target.value)}
                  placeholder="e.g. TypeScript, System Architecture"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Current Level</label>
                  <select
                    value={skillLevel}
                    onChange={e => setSkillLevel(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
                  >
                    <option value="Novice">Novice</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Mastery">Mastery</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Target Level</label>
                  <select
                    value={targetLevel}
                    onChange={e => setTargetLevel(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
                  >
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Mastery">Mastery</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Target Mastery Date</label>
                <ThemedDateTimeInput
                  type="date"
                  value={skillTargetDate}
                  onChange={e => setSkillTargetDate(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                />
              </div>

              {/* Task Genesis deployment with Alarm toggle on Creation */}
              <div className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 dark:border-indigo-900/60 dark:bg-indigo-950/20">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  <input
                    type="checkbox"
                    checked={skillArmGenesis}
                    onChange={e => setSkillArmGenesis(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="inline-flex items-center gap-1"><ThemeIcon name="zap" className="h-3 w-3" /> Deploy Practice Drill Task Genesis with Alarm</span>
                </label>
                {skillArmGenesis && (
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[10px]">
                    <div>
                      <label className="text-xs font-semibold text-slate-500">Priority</label>
                      <select
                        value={skillTaskPriority}
                        onChange={e => setSkillTaskPriority(e.target.value as any)}
                        className="mt-0.5 h-7 w-full rounded border border-slate-200 bg-white px-1 dark:border-slate-700 dark:bg-slate-800 text-[10px]"
                      >
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500">Alarm Time</label>
                      <ThemedDateTimeInput
                        type="time"
                        value={skillAlarmTime}
                        onChange={e => setSkillAlarmTime(e.target.value)}
                        className="mt-0.5 h-7 w-full rounded border border-slate-200 bg-white px-1 dark:border-slate-700 dark:bg-slate-800 text-[10px] font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 cursor-pointer"
              >
                + Register Skill Competency
              </button>
            </form>
          </div>}

          <div className={`${embedded && skills.length === 0 ? 'hidden' : ''} ${openWorkForm === 'skills' ? 'lg:col-span-7' : 'lg:col-span-12'} rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-5`}>
            <h2 className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 text-sm font-bold text-slate-900 dark:border-slate-800 dark:text-white">
              Acquired Competencies ({skills.length})
            </h2>
            <div className="adaptive-card-grid mt-4 gap-3">
              {skills.length === 0 ? (
                <div className="col-span-full"><EmptyState icon={Award} compact title="No competencies recorded" hint="Rate skills to reveal your capability map." /></div>
              ) : (
                [...skills].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(s => {
                  const linkedGoal = goals.find(g => g.id === s.goalId);
                  const levels = ['Novice', 'Intermediate', 'Advanced', 'Mastery'];
                  const isSkillDelayed = computeItemDelay({ ...s, targetDate: s.targetDate, dueAt: s.targetDate, progress: s.progress }).isDelayed && (s.progress || 0) < 100;
                  const delayInfo = computeItemDelay({ ...s, targetDate: s.targetDate, dueAt: s.targetDate, progress: s.progress });

                  return (
                    <div
                      key={s.id}
                      className="dashboard-item-row rounded-xl border border-slate-100 p-3 text-xs dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-colors flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                            {isSkillDelayed && (
                              <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-white animate-pulse">
                                ⚠️ {delayInfo.label}
                              </span>
                            )}
                            {s.targetDate && <span>Mastery Target: {s.targetDate}</span>}
                          </div>

                          <ProgressiveActions label={`More actions for ${s.name}`} className="shrink-0">
                            {isSkillDelayed && (
                              <button
                                type="button"
                                onClick={() => handleTriggerUrgentAlarm(s.name, 'Skill practice drill overdue!')}
                                className="h-7 px-2 rounded-lg bg-rose-600 text-white hover:bg-rose-500 cursor-pointer flex items-center gap-1 text-[10px] font-bold shadow-2xs"
                                title="Ring Urgent Alarm"
                              >
                                <BellRing className="h-3 w-3 animate-bounce" />
                                <span>Alarm</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setQuickAlarmItem({ id: s.id, title: s.name, type: 'skill', due: s.targetDate })}
                              className="h-7 px-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                              title="Schedule Drill Reminder Alarm"
                            >
                              <Bell className="h-3 w-3" />
                              <span>Alarm</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenGenesisForSkill(s)}
                              className="h-7 rounded-lg bg-purple-50 px-2 text-[10px] font-bold text-purple-700 hover:bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300 cursor-pointer flex items-center gap-1"
                              title="Task Genesis for Skill Practice with Reminder Alarm"
                            >
                              <Zap className="h-3 w-3 text-amber-500" />
                              <span>Genesis</span>
                            </button>

                            {/* EDIT BUTTON */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit('skill', s)}
                              className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Edit Skill"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            {/* DELETE BUTTON */}
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ type: 'skill', id: s.id, name: s.name, store: 'skills' })}
                              className="p-1 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                              title="Delete Skill"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </ProgressiveActions>
                        </div>

                        <div className="w-full font-bold text-slate-900 dark:text-white text-sm leading-snug">
                          {s.name}
                        </div>

                        <div className="text-[11px] text-slate-400">
                          Current: <span className="font-semibold text-purple-600 dark:text-purple-400">{s.level || 'Intermediate'}</span> · Target: {s.targetLevel || 'Mastery'}
                        </div>

                        {/* Full-Width LINKED GOAL BADGE */}
                        {linkedGoal && (
                          <div className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200/80 dark:border-purple-800/80 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                            <Target className="h-3.5 w-3.5 shrink-0 text-purple-500" />
                            <span className="w-full leading-snug">
                              <><GoalTierIcon level={linkedGoal.level} /> {linkedGoal.level === 5 ? 'Atomic' : linkedGoal.level === 4 ? 'Nano' : linkedGoal.level === 3 ? 'Micro' : linkedGoal.level === 2 ? 'Sub' : 'Main'}: {linkedGoal.title} ({linkedGoal.progress}%)</>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* QUICK LEVEL BUTTONS */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                        <span className="block text-[10px] text-slate-400 mb-1">Set Level & Advance Goal:</span>
                        <div className="grid grid-cols-4 gap-2">
                          {levels.map(lvl => {
                            const isCurrent = (s.level || 'Intermediate').toLowerCase() === lvl.toLowerCase();
                            return (
                              <button
                                key={lvl}
                                type="button"
                                onClick={() => handleUpdateSkillLevel(s, lvl)}
                                className={`border-b-0 border-transparent py-1 text-[9px] font-bold transition-colors cursor-pointer truncate ${
                                  isCurrent
                                    ? 'text-amber-700 dark:text-amber-300'
                                    : 'text-amber-800 hover:border-amber-500 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
                                }`}
                                title={`Set level to ${lvl}`}
                              >
                                {lvl.slice(0, 5)}
                              </button>
                            );
                          })}
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
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white capitalize">
                    Edit {editTarget.type}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-3.5">
              {/* GOAL LINK SELECTOR IN EDIT MODAL */}
              {(editTarget.type === 'learning' || editTarget.type === 'skill') && (
                <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/60 p-2.5 dark:border-indigo-800/80 dark:bg-indigo-950/30">
                  <label className="block text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1 mb-1">
                    <Target className="h-3.5 w-3.5" />
                    <span>Linked Goal (Main, Sub, or Micro):</span>
                  </label>
                  <select
                    value={editGoalId}
                    onChange={e => setEditGoalId(e.target.value)}
                    className="h-8 w-full rounded-lg border border-indigo-300 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-indigo-700 dark:bg-slate-900 dark:text-white cursor-pointer font-medium"
                  >
                    <option value="">None (Standalone)</option>
                    {goals.map(g => {
                      const lvl = g.level === 5 ? 'Atomic' : g.level === 4 ? 'Nano' : g.level === 3 ? 'Micro' : g.level === 2 ? 'Sub' : 'Main';
                      return (
                        <option key={g.id} value={g.id}>
                          {lvl}: {g.title} ({g.progress}%)
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  {editTarget.type === 'learning' ? 'Curriculum Title' : 'Skill Name'}
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {editTarget.type === 'learning' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Type</label>
                    <input
                      type="text"
                      value={editSubtitle}
                      onChange={e => setEditSubtitle(e.target.value)}
                      className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Progress (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editNumber}
                      onChange={e => setEditNumber(Number(e.target.value))}
                      className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {editTarget.type === 'skill' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Current Level</label>
                    <select
                      value={editSubtitle}
                      onChange={e => setEditSubtitle(e.target.value)}
                      className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
                    >
                      <option value="Novice">Novice</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                      <option value="Mastery">Mastery</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Target Level</label>
                    <select
                      value={editExtra}
                      onChange={e => setEditExtra(e.target.value)}
                      className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
                    >
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                      <option value="Mastery">Mastery</option>
                    </select>
                  </div>
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
        title={`Delete ${deleteTarget?.type || 'item'}?`}
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

      {/* TASK GENESIS MODAL WITH AUDIO ALARM SCHEDULING */}
      {genesisModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-black text-xs">
                  <Zap className="h-4 w-4 text-white" />
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
                  <ThemedDateTimeInput
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
                      <ThemedDateTimeInput
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

      {/* QUICK PRESET ALARM MODAL FOR ANY WORK DELIVERABLE, LEARNING TRACK, OR SKILL */}
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
                    { id: 'tomorrow', label: 'Tomorrow 9 AM' }
                  ].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setAlarmPresetChoice(p.id as any)}
                      className={`py-2 px-1 text-center text-xs font-bold transition-colors cursor-pointer ${
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
