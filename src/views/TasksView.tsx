import React, { useState, useEffect } from 'react';
import {
  CheckSquare, Search, Plus, Trash2, Edit3,
  Check, Circle, CheckCircle2, ArrowRight,
  Layers, Target, Download, Save, History, X
} from 'lucide-react';
import { Task, TaskDomain, TaskPriority, TaskStatus, Goal, DailyPlanner } from '../types';
import { storage, generateUUID } from '../lib/storage';
import { recalculateGoalProgress } from '../lib/goalTaskSync';

interface TasksViewProps {
  tasks: Task[];
  goals: Goal[];
  dailyPlanner?: DailyPlanner;
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
}

const INPUT_CLS = 'mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white';
const LABEL_CLS = 'block text-[11px] font-semibold text-slate-600 dark:text-slate-300';

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  goals,
  dailyPlanner,
  onRefresh,
  onSuccess
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const [activeTab, setActiveTab] = useState<'roster' | 'dailyCommand' | 'kanban'>('roster');
  const [filterType, setFilterType] = useState<'all' | 'today' | 'high' | 'work' | 'personal' | 'done'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Task Form states
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [domain, setDomain] = useState<TaskDomain>('work');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [dueAt, setDueAt] = useState(today);
  const [goalId, setGoalId] = useState<string>('');

  // Daily Command Center states
  const [plannerTarget, setPlannerTarget] = useState(dailyPlanner?.target || '');
  const [plannerProgress, setPlannerProgress] = useState(dailyPlanner?.progress ?? 40);
  const [pointText, setPointText] = useState('');
  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const [dailyWins, setDailyWins] = useState(dailyPlanner?.wins?.join('\n') || '');
  const [eveningReview, setEveningReview] = useState(dailyPlanner?.reflection?.join('\n') || '');
  const [savedArchive, setSavedArchive] = useState<SavedTargetRecord[]>([]);

  useEffect(() => {
    if (dailyPlanner) {
      if (dailyPlanner.target !== undefined) setPlannerTarget(dailyPlanner.target);
      if (dailyPlanner.progress !== undefined) setPlannerProgress(dailyPlanner.progress);
      if (dailyPlanner.wins) setDailyWins(dailyPlanner.wins.join('\n'));
      if (dailyPlanner.reflection) setEveningReview(dailyPlanner.reflection.join('\n'));
    }
  }, [dailyPlanner]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('om-saved-command-targets');
      if (stored) setSavedArchive(JSON.parse(stored));
    } catch {}
  }, []);

  const resetTaskForm = () => {
    setEditingTaskId(null);
    setTitle('');
    setDescription('');
    setDomain('work');
    setPriority('Medium');
    setDueAt(today);
    setGoalId('');
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const now = Date.now();

    if (editingTaskId) {
      const existing = tasks.find(t => t.id === editingTaskId);
      if (existing) {
        const updated: Task = {
          ...existing,
          title: title.trim(),
          description: description.trim() || undefined,
          domain,
          priority,
          dueAt: dueAt || undefined,
          date: dueAt || undefined,
          goalId: goalId || null,
          updatedAt: now
        };
        await storage.put('tasks', updated);
        onSuccess('Task updated successfully');
        if (existing.goalId) await recalculateGoalProgress(existing.goalId);
        if (goalId && goalId !== existing.goalId) await recalculateGoalProgress(goalId);
      }
    } else {
      const newTask: Task = {
        id: generateUUID(),
        title: title.trim(),
        description: description.trim() || undefined,
        domain,
        priority,
        dueAt: dueAt || undefined,
        date: dueAt || undefined,
        goalId: goalId || null,
        done: false,
        status: 'open',
        createdAt: now,
        updatedAt: now
      };
      await storage.put('tasks', newTask);
      onSuccess('Task added to execution planner');
      if (goalId) await recalculateGoalProgress(goalId);
    }

    resetTaskForm();
    onRefresh();
  };

  const handleEditClick = (task: Task) => {
    setActiveTab('roster');
    setEditingTaskId(task.id);
    setTitle(task.title);
    setDescription(task.description || '');
    setDomain(task.domain || 'work');
    setPriority(task.priority || 'Medium');
    setDueAt(task.dueAt || today);
    setGoalId(task.goalId || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    if (task.goalId) await recalculateGoalProgress(task.goalId);
    onSuccess(nextDone ? 'Task marked complete' : 'Task reopened');
    onRefresh();
  };

  const handleSetStatus = async (task: Task, status: TaskStatus) => {
    const updated: Task = {
      ...task,
      status,
      done: status === 'done',
      updatedAt: Date.now()
    };
    await storage.put('tasks', updated);
    if (task.goalId) await recalculateGoalProgress(task.goalId);
    onSuccess(`Task moved to ${status}`);
    onRefresh();
  };

  const handleDeleteTask = async (task: Task) => {
    await storage.delete('tasks', task.id);
    if (task.goalId) await recalculateGoalProgress(task.goalId);
    if (editingTaskId === task.id) resetTaskForm();
    onSuccess('Task deleted from workspace');
    onRefresh();
  };

  // Unified Daily Planner Persistence
  const persistPlanner = async (patch: Partial<DailyPlanner>) => {
    const appSettings = (await storage.getSingleton<any>('appSettings')) || {};
    const updatedPlanner: DailyPlanner = {
      date: today,
      target: plannerTarget,
      progress: plannerProgress,
      points: dailyPlanner?.points || [],
      wins: dailyWins.split('\n').map(s => s.trim()).filter(Boolean),
      reflection: eveningReview.split('\n').map(s => s.trim()).filter(Boolean),
      ...patch
    };
    appSettings.dailyPlanner = updatedPlanner;
    await storage.setSingleton('appSettings', appSettings);
    onRefresh();
    return updatedPlanner;
  };

  const handleSavePlannerTarget = async () => {
    const updatedPlanner = await persistPlanner({});
    const pointsList = updatedPlanner.points || [];
    const newRecord: SavedTargetRecord = {
      id: generateUUID(),
      date: today,
      target: plannerTarget || 'Daily Command Target',
      progress: plannerProgress,
      pointsCount: pointsList.length,
      pointsDone: pointsList.filter(p => p.done).length,
      savedAt: Date.now()
    };
    const updatedArchive = [newRecord, ...savedArchive.filter(r => r.date !== today || r.target !== plannerTarget)].slice(0, 20);
    setSavedArchive(updatedArchive);
    try {
      localStorage.setItem('om-saved-command-targets', JSON.stringify(updatedArchive));
    } catch {}
    onSuccess('Daily Command Target saved');
  };

  const handleDeleteArchiveRecord = (id: string) => {
    const updatedArchive = savedArchive.filter(r => r.id !== id);
    setSavedArchive(updatedArchive);
    try {
      localStorage.setItem('om-saved-command-targets', JSON.stringify(updatedArchive));
    } catch {}
    onSuccess('Saved target removed from archive');
  };

  const handleSaveToFile = () => {
    const pointsList = dailyPlanner?.points || [];
    let content = `# Daily Command Target — ${today}\n\n## Decisive Victory Outcome\n${plannerTarget || 'None specified'}\n\n**Progress:** ${plannerProgress}%\n\n## Action Checkpoints\n`;
    if (pointsList.length === 0) content += `*(No checkpoints)*\n`;
    else pointsList.forEach(p => { content += `- [${p.done ? 'x' : ' '}] ${p.text}\n`; });
    content += `\n`;
    if (dailyWins.trim()) content += `## Daily Victories & Wins\n${dailyWins}\n\n`;
    if (eveningReview.trim()) content += `## Reflections\n${eveningReview}\n\n`;

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `command-target-${today}.md`;
    a.click();
    URL.revokeObjectURL(url);
    onSuccess('Exported command target file (.md)');
  };

  const submitPlannerPoint = async () => {
    if (!pointText.trim()) return;
    const currentPoints = dailyPlanner?.points || [];
    const newPoints = editingPointId
      ? currentPoints.map(p => (p.id === editingPointId ? { ...p, text: pointText.trim() } : p))
      : [...currentPoints, { id: generateUUID(), text: pointText.trim(), done: false }];
    await persistPlanner({ points: newPoints });
    setPointText('');
    setEditingPointId(null);
    onSuccess(editingPointId ? 'Checkpoint updated' : 'Checkpoint added');
  };

  const handleTogglePoint = async (pointId: string) => {
    const currentPoints = dailyPlanner?.points || [];
    await persistPlanner({
      points: currentPoints.map(p => (p.id === pointId ? { ...p, done: !p.done } : p))
    });
  };

  const handleEditPoint = (pt: { id: string; text: string }, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPointId(pt.id);
    setPointText(pt.text);
  };

  const handleDeletePoint = async (pointId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentPoints = dailyPlanner?.points || [];
    await persistPlanner({ points: currentPoints.filter(p => p.id !== pointId) });
    if (editingPointId === pointId) {
      setEditingPointId(null);
      setPointText('');
    }
    onSuccess('Checkpoint deleted');
  };

  const filteredTasks = tasks.filter(t => {
    if (filterType === 'today' && (t.dueAt !== today || t.done)) return false;
    if (filterType === 'high' && (t.priority !== 'High' || t.done)) return false;
    if (filterType === 'work' && (t.domain !== 'work' || t.done)) return false;
    if (filterType === 'personal' && (t.domain !== 'personal' || t.done)) return false;
    if (filterType === 'done' && !t.done) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return `${t.title} ${t.description || ''} ${t.domain}`.toLowerCase().includes(q);
    }
    return true;
  }).sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const pWeights = { High: 3, Medium: 2, Low: 1 };
    return (pWeights[b.priority] || 0) - (pWeights[a.priority] || 0);
  });

  const openCount = tasks.filter(t => !t.done).length;

  return (
    <div className="space-y-6">
      {/* Top Header & View Modes */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              Tasks & Execution Planner
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Action roster, daily victory target checkpoints, and Kanban pipeline.
          </p>
        </div>

        <div className="flex rounded-xl border border-slate-200 bg-slate-100/80 p-1 text-xs dark:border-slate-700 dark:bg-slate-800 shrink-0 overflow-x-auto no-scrollbar">
          {[
            { id: 'roster', label: `Task Roster (${openCount})`, icon: <CheckSquare className="h-3.5 w-3.5" /> },
            { id: 'dailyCommand', label: 'Daily Command Target', icon: <Target className="h-3.5 w-3.5" /> },
            { id: 'kanban', label: 'Kanban Board', icon: <Layers className="h-3.5 w-3.5" /> }
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1 font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
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

      {/* VIEW 1: TASK ROSTER */}
      {activeTab === 'roster' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 font-bold text-xs">⚡</span>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editingTaskId ? 'Edit Task' : 'Task Genesis'}
                </h2>
              </div>
              {editingTaskId && (
                <button type="button" onClick={resetTaskForm} className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer">
                  Cancel
                </button>
              )}
            </div>

            <form onSubmit={handleSaveTask} className="mt-4 space-y-3.5">
              <div>
                <label className={LABEL_CLS}>Task Title / Action Statement</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Implement distributed caching logic"
                  className={INPUT_CLS}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Domain</label>
                  <select value={domain} onChange={e => setDomain(e.target.value as any)} className={`${INPUT_CLS} cursor-pointer`}>
                    <option value="work">Work & Career</option>
                    <option value="personal">Personal Operations</option>
                    <option value="health">Health & Vitality</option>
                    <option value="finance">Finance & Capital</option>
                    <option value="learning">Study & Learning</option>
                    <option value="spiritual">Mind & Philosophy</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLS}>Priority</label>
                  <select value={priority} onChange={e => setPriority(e.target.value as any)} className={`${INPUT_CLS} cursor-pointer`}>
                    <option value="High">High (Immediate)</option>
                    <option value="Medium">Medium (Balanced)</option>
                    <option value="Low">Low (Backlog)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Target Due Date</label>
                  <input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} className={`${INPUT_CLS} font-mono`} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Link to Goal</label>
                  <select value={goalId} onChange={e => setGoalId(e.target.value)} className={`${INPUT_CLS} cursor-pointer`}>
                    <option value="">None (Independent)</option>
                    {goals.map(g => (
                      <option key={g.id} value={g.id}>{g.title} ({g.progress}%)</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={LABEL_CLS}>Notes & Context</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Additional context or links..."
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 active:scale-98 transition-transform cursor-pointer"
              >
                {editingTaskId ? 'Update Task' : '+ Deploy Action Unit'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Roster Items ({filteredTasks.length})
              </h2>
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Filter tasks..."
                  className="h-8.5 w-full rounded-xl border border-slate-200 pl-8 pr-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex overflow-x-auto pb-1 gap-1.5 no-scrollbar">
              {[
                { id: 'all', label: `All (${tasks.length})` },
                { id: 'today', label: 'Due Today' },
                { id: 'high', label: 'High Priority' },
                { id: 'work', label: 'Work' },
                { id: 'personal', label: 'Personal' },
                { id: 'done', label: 'Completed' }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilterType(f.id as any)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    filterType === f.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 max-h-[550px] overflow-y-auto">
              {filteredTasks.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">No tasks found in this view.</div>
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
                            ? 'border-emerald-600 bg-emerald-600 text-white shadow-2xs'
                            : 'border-slate-300 hover:border-indigo-500 dark:border-slate-600'
                        }`}
                      >
                        {task.done && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </button>

                      <div className="min-w-0">
                        <div className={`text-xs font-semibold truncate ${task.done ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                          {task.title}
                        </div>
                        {task.description && (
                          <div className="text-[11px] text-slate-400 truncate max-w-md mt-0.5">{task.description}</div>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                          <span className="capitalize">{task.domain}</span>
                          <span>·</span>
                          <span className={task.priority === 'High' ? 'font-bold text-rose-500' : ''}>{task.priority} Priority</span>
                          {task.dueAt && (
                            <>
                              <span>·</span>
                              <span className="font-mono">Due {task.dueAt}</span>
                            </>
                          )}
                          {task.goalId && (
                            <>
                              <span>·</span>
                              <span className="font-medium text-indigo-600 dark:text-indigo-400 truncate max-w-[120px]">
                                {goals.find(g => g.id === task.goalId)?.title}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEditClick(task)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Edit task"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Delete task"
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

      {/* VIEW 2: DAILY COMMAND TARGET */}
      {activeTab === 'dailyCommand' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950 font-bold text-xs">🎯</span>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Daily Command Target ({today})</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveToFile}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
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

            <div>
              <label className={LABEL_CLS}>Core Priority / Decisive Victory Outcome</label>
              <input
                type="text"
                value={plannerTarget}
                onChange={e => setPlannerTarget(e.target.value)}
                placeholder="What single outcome will make today a decisive victory?"
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-medium"
              />
            </div>

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

            <div>
              <label className={LABEL_CLS}>
                {editingPointId ? 'Edit Action Checkpoint' : 'Action Checkpoints (Press Enter or click Add)'}
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="text"
                  value={pointText}
                  onChange={e => setPointText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitPlannerPoint(); } }}
                  placeholder="Type an actionable checkpoint..."
                  className="h-9 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                {editingPointId && (
                  <button
                    type="button"
                    onClick={() => { setEditingPointId(null); setPointText(''); }}
                    className="h-9 px-2.5 rounded-xl border border-slate-200 text-xs text-slate-500 hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={submitPlannerPoint}
                  className="h-9 px-3 rounded-xl bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 active:scale-98 shrink-0 cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{editingPointId ? 'Update' : 'Add'}</span>
                </button>
              </div>

              <div className="mt-3 space-y-1.5 max-h-52 overflow-y-auto">
                {(dailyPlanner?.points || []).map(pt => (
                  <div
                    key={pt.id}
                    onClick={() => handleTogglePoint(pt.id)}
                    className="flex items-center justify-between rounded-xl p-2.5 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors border border-slate-100 dark:border-slate-800"
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
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={e => handleEditPoint(pt, e)}
                        className="text-slate-400 hover:text-indigo-600 p-1 rounded cursor-pointer"
                        title="Edit checkpoint"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={e => handleDeletePoint(pt.id, e)}
                        className="text-slate-400 hover:text-rose-500 p-1 rounded cursor-pointer"
                        title="Delete checkpoint"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className={LABEL_CLS}>Daily Victories & Wins (1 per line)</label>
                <textarea
                  rows={3}
                  value={dailyWins}
                  onChange={e => setDailyWins(e.target.value)}
                  placeholder="• Shipped feature on schedule&#10;• Zero distraction deep work"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Evening Reflection & Learnings</label>
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

          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Saved Command Targets Archive</h3>
              </div>
              <span className="font-mono text-xs text-slate-400">{savedArchive.length} entries</span>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {savedArchive.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">
                  No saved targets archive yet.<br />Click "Save Target" to store daily targets.
                </div>
              ) : (
                savedArchive.map(rec => (
                  <div
                    key={rec.id}
                    className="rounded-2xl border border-slate-100 p-3.5 text-xs dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-all space-y-1.5"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{rec.target}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Date: {rec.date} · {rec.pointsDone}/{rec.pointsCount} checkpoints
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 shrink-0">
                        {rec.progress}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPlannerTarget(rec.target);
                          setPlannerProgress(rec.progress);
                          onSuccess(`Loaded target from ${rec.date}`);
                        }}
                        className="text-[11px] font-semibold text-indigo-600 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <Edit3 className="h-3 w-3" />
                        <span>Edit / Load Target</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteArchiveRecord(rec.id)}
                        className="p-1 text-slate-400 hover:text-rose-500 rounded cursor-pointer"
                        title="Delete archived target"
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

      {/* VIEW 3: KANBAN STATUS BOARD */}
      {activeTab === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              key: 'open',
              title: 'To Do / Open',
              wrapCls: 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
              headCls: 'border-slate-100 text-slate-900 dark:border-slate-800 dark:text-white',
              items: tasks.filter(t => !t.done && (t.status === 'open' || !t.status))
            },
            {
              key: 'in-progress',
              title: 'In Progress',
              wrapCls: 'border-amber-200 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/20',
              headCls: 'border-amber-200/60 text-amber-900 dark:border-amber-900/40 dark:text-amber-200',
              items: tasks.filter(t => !t.done && t.status === 'in-progress')
            },
            {
              key: 'done',
              title: 'Done',
              wrapCls: 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/20',
              headCls: 'border-emerald-200/60 text-emerald-900 dark:border-emerald-900/40 dark:text-emerald-200',
              items: tasks.filter(t => t.done)
            }
          ].map(col => (
            <div key={col.key} className={`rounded-2xl border p-4 shadow-xs flex flex-col h-[600px] ${col.wrapCls}`}>
              <div className={`flex items-center justify-between border-b pb-2.5 ${col.headCls}`}>
                <span className="text-xs font-bold uppercase tracking-wider">{col.title}</span>
                <span className="font-mono text-xs font-bold opacity-70">{col.items.length}</span>
              </div>
              <div className="mt-3 flex-1 overflow-y-auto space-y-2.5 pr-1">
                {col.items.map(t => (
                  <div key={t.id} className="rounded-xl border border-slate-100 p-3 shadow-2xs bg-white dark:border-slate-800 dark:bg-slate-900 text-xs space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className={`font-semibold ${t.done ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>
                        {t.title}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEditClick(t)}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                          title="Edit task"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(t)}
                          className="p-1 text-slate-400 hover:text-rose-500 rounded cursor-pointer"
                          title="Delete task"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-50 dark:border-slate-800/60">
                      {col.key === 'open' && (
                        <>
                          <span className="capitalize">{t.domain} · {t.priority}</span>
                          <button
                            type="button"
                            onClick={() => handleSetStatus(t, 'in-progress')}
                            className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>Start</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </>
                      )}
                      {col.key === 'in-progress' && (
                        <>
                          <button type="button" onClick={() => handleSetStatus(t, 'open')} className="hover:underline cursor-pointer">
                            ← To Do
                          </button>
                          <button type="button" onClick={() => handleSetStatus(t, 'done')} className="font-bold text-emerald-600 hover:underline cursor-pointer">
                            Complete ✓
                          </button>
                        </>
                      )}
                      {col.key === 'done' && (
                        <>
                          <span className="text-emerald-600 font-medium">Completed</span>
                          <button type="button" onClick={() => handleSetStatus(t, 'open')} className="hover:underline cursor-pointer text-slate-500">
                            Reopen
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
