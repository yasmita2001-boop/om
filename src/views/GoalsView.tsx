import React, { useState } from 'react';
import {
  Target, Plus, TrendingUp, ShieldCheck, Flame,
  Trash2, ChevronDown, ChevronRight, CheckCircle2,
  Layers, Edit3
} from 'lucide-react';
import { Goal, Task, FinanceAccount } from '../types';
import { storage, generateUUID } from '../lib/storage';

interface GoalsViewProps {
  goals: Goal[];
  tasks: Task[];
  accounts: FinanceAccount[];
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
}

const INPUT_CLS = 'mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white';
const LABEL_CLS = 'block text-[11px] font-semibold text-slate-600 dark:text-slate-300';

export const GoalsView: React.FC<GoalsViewProps> = ({
  goals,
  tasks,
  accounts,
  onRefresh,
  onSuccess
}) => {
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalCategory, setGoalCategory] = useState<'Career' | 'Finance' | 'Health' | 'Mastery' | 'Life'>('Career');
  const [goalProgress, setGoalProgress] = useState(0);
  const [targetDate, setTargetDate] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [goalParentId, setGoalParentId] = useState<string>('');

  const [expandedGoalIds, setExpandedGoalIds] = useState<Record<string, boolean>>({});

  const liquidCash = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  const runwayDays = Math.floor(liquidCash / 1200);
  const runwayMonths = (runwayDays / 30).toFixed(1);

  const mainGoals = goals.filter(g => !g.parentId || g.level === 1);
  const getSubGoals = (parentId: string) => goals.filter(g => g.parentId === parentId);

  const resetGoalForm = () => {
    setEditingGoalId(null);
    setGoalTitle('');
    setGoalDescription('');
    setGoalProgress(0);
    setTargetDate('');
    setGoalParentId('');
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;
    const now = Date.now();
    const existing = editingGoalId ? goals.find(g => g.id === editingGoalId) : undefined;

    const goalObj: Goal = {
      id: editingGoalId || generateUUID(),
      title: goalTitle.trim(),
      description: goalDescription.trim() || undefined,
      category: goalCategory,
      progress: goalProgress,
      targetDate: targetDate || undefined,
      level: goalParentId ? 2 : 1,
      parentId: goalParentId || null,
      status: goalProgress >= 100 ? 'completed' : 'active',
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
    await storage.put('goals', goalObj);
    onSuccess(editingGoalId ? `Goal "${goalTitle}" updated` : `Goal "${goalTitle}" registered`);
    resetGoalForm();
    onRefresh();
  };

  const handleEditGoal = (g: Goal) => {
    setEditingGoalId(g.id);
    setGoalTitle(g.title);
    setGoalDescription(g.description || '');
    setGoalCategory(g.category || 'Career');
    setGoalProgress(g.progress);
    setTargetDate(g.targetDate || '');
    setGoalParentId(g.parentId || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleGoalStatus = async (goal: Goal) => {
    const nextStatus = goal.status === 'completed' ? 'active' : 'completed';
    const nextProgress = nextStatus === 'completed' ? 100 : Math.min(90, goal.progress);
    await storage.put('goals', {
      ...goal,
      status: nextStatus,
      progress: nextProgress,
      updatedAt: Date.now()
    });
    onSuccess(`Goal marked ${nextStatus}`);
    onRefresh();
  };

  const handleUpdateProgress = async (goal: Goal, newProgress: number) => {
    const clamped = Math.max(0, Math.min(100, newProgress));
    await storage.put('goals', {
      ...goal,
      progress: clamped,
      status: clamped >= 100 ? 'completed' : 'active',
      updatedAt: Date.now()
    });
    onSuccess(`Goal progress updated to ${clamped}%`);
    onRefresh();
  };

  const handleDeleteGoal = async (id: string) => {
    const subs = goals.filter(g => g.parentId === id);
    for (const sg of subs) {
      await storage.delete('goals', sg.id);
    }
    await storage.delete('goals', id);
    if (editingGoalId === id) resetGoalForm();
    onSuccess('Goal deleted');
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            Goals & Strategic Hierarchy
          </h1>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          5-tier goal architecture with direct auto-rollup from action units, tasks, and habit milestones.
        </p>
      </div>

      {/* Runway & Capital Allocation Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          { label: 'Liquid Reserve', val: `₹${liquidCash.toLocaleString('en-IN')}`, sub: `Across ${accounts.length} liquid accounts`, cls: 'text-slate-900 dark:text-white', icon: <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" /> },
          { label: 'Survival Runway', val: `${runwayDays} Days`, sub: `~${runwayMonths} months independence`, cls: 'text-amber-600 dark:text-amber-400', icon: <Flame className="h-4 w-4 text-amber-500 shrink-0" /> },
          { label: 'Main Trajectories', val: mainGoals.length, sub: `${goals.length - mainGoals.length} sub-goals linked`, cls: 'text-slate-900 dark:text-white', icon: <Layers className="h-4 w-4 text-indigo-500 shrink-0" /> },
          { label: 'Avg Progress', val: `${goals.length > 0 ? Math.round(goals.reduce((acc, g) => acc + g.progress, 0) / goals.length) : 0}%`, sub: 'Combined compounding rate', cls: 'text-emerald-600 dark:text-emerald-400', icon: <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" /> }
        ].map(c => (
          <div key={c.label} className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 min-w-0">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider truncate">{c.label}</span>
              {c.icon}
            </div>
            <div className={`mt-2 font-mono text-xl sm:text-2xl font-extrabold tabular-nums truncate ${c.cls}`}>{c.val}</div>
            <div className="mt-1 text-[11px] text-slate-400 font-medium truncate">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Add / Edit Goal Form */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="h-4 w-4 text-indigo-500" />
              <span>{editingGoalId ? 'Edit Strategic Goal' : 'Define Strategic Goal'}</span>
            </h2>
            {editingGoalId && (
              <button type="button" onClick={resetGoalForm} className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer">
                Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleSaveGoal} className="mt-4 space-y-3.5">
            <div>
              <label className={LABEL_CLS}>Goal Title</label>
              <input type="text" required value={goalTitle} onChange={e => setGoalTitle(e.target.value)} placeholder="e.g. Build ₹1 Crore Sovereign Treasury" className={INPUT_CLS} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>Category</label>
                <select value={goalCategory} onChange={e => setGoalCategory(e.target.value as any)} className={`${INPUT_CLS} cursor-pointer`}>
                  <option value="Career">Career & Work</option>
                  <option value="Finance">Finance & Net Worth</option>
                  <option value="Health">Health & Vigor</option>
                  <option value="Mastery">Learning & Skills</option>
                  <option value="Life">Life & Philosophy</option>
                </select>
              </div>
              <div>
                <label className={LABEL_CLS}>Target Deadline</label>
                <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className={`${INPUT_CLS} font-mono`} />
              </div>
            </div>

            <div>
              <label className={LABEL_CLS}>Parent Goal (Optional Hierarchy Nesting)</label>
              <select value={goalParentId} onChange={e => setGoalParentId(e.target.value)} className={`${INPUT_CLS} cursor-pointer`}>
                <option value="">None (Top-Level Main Goal)</option>
                {mainGoals.filter(g => g.id !== editingGoalId).map(g => (
                  <option key={g.id} value={g.id}>Main: {g.title}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                <span>Progress</span>
                <span className="font-mono font-bold">{goalProgress}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={goalProgress}
                onChange={e => setGoalProgress(Number(e.target.value))}
                className="mt-2 h-2 w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div>
              <label className={LABEL_CLS}>Description & Tactical Scope</label>
              <textarea
                rows={2}
                value={goalDescription}
                onChange={e => setGoalDescription(e.target.value)}
                placeholder="Tactical roadmap, milestones, and success conditions..."
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <button type="submit" className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 active:scale-98 transition-transform cursor-pointer">
              {editingGoalId ? 'Update Strategic Goal' : '+ Commit Strategic Goal'}
            </button>
          </form>
        </div>

        {/* Goals Hierarchy Portfolio List */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Goals Portfolio Hierarchy ({goals.length})</h2>
            <span className="text-[11px] text-slate-400">{goals.filter(g => g.progress >= 100).length} completed</span>
          </div>

          <div className="space-y-3.5 max-h-[600px] overflow-y-auto">
            {mainGoals.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">
                No goals created yet. Register your first strategic priority on the left.
              </div>
            ) : (
              mainGoals.map(goal => {
                const subGoalsList = getSubGoals(goal.id);
                const isExpanded = expandedGoalIds[goal.id] ?? true;
                const linkedTasks = tasks.filter(t => t.goalId === goal.id);

                return (
                  <div key={goal.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4 dark:border-slate-800 dark:bg-slate-850/40 space-y-3 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">{goal.category}</span>
                          <span className="text-slate-300 dark:text-slate-700">·</span>
                          <span className="font-mono text-xs text-slate-400">{goal.targetDate ? `Target ${goal.targetDate}` : 'Ongoing'}</span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1 leading-snug">{goal.title}</h3>
                        {goal.description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{goal.description}</p>}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleGoalStatus(goal)}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            goal.status === 'completed' ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : 'text-slate-400 hover:text-emerald-500'
                          }`}
                          title={goal.status === 'completed' ? 'Mark Active' : 'Mark Complete'}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleEditGoal(goal)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer" title="Edit goal">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => handleDeleteGoal(goal.id)} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer" title="Delete goal">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[11px] text-slate-400 font-medium">
                          Execution Progress ({linkedTasks.filter(t => t.done).length}/{linkedTasks.length} tasks)
                        </span>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => handleUpdateProgress(goal, goal.progress - 10)} className="h-5 w-5 rounded bg-slate-200 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-300 cursor-pointer">-</button>
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{goal.progress}%</span>
                          <button type="button" onClick={() => handleUpdateProgress(goal, goal.progress + 10)} className="h-5 w-5 rounded bg-slate-200 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-300 cursor-pointer">+</button>
                        </div>
                      </div>

                      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div className={`h-full transition-all duration-300 ${goal.progress >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`} style={{ width: `${goal.progress}%` }} />
                      </div>
                    </div>

                    {subGoalsList.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => setExpandedGoalIds(prev => ({ ...prev, [goal.id]: !isExpanded }))}
                          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 cursor-pointer"
                        >
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          <span>Linked Sub-Goals ({subGoalsList.length})</span>
                        </button>

                        {isExpanded && (
                          <div className="mt-2 space-y-2 pl-3 border-l-2 border-indigo-200 dark:border-indigo-900/60">
                            {subGoalsList.map(sg => (
                              <div key={sg.id} className="rounded-xl border border-slate-200/80 bg-white p-2.5 text-xs dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between gap-2">
                                <div className="min-w-0 pr-2">
                                  <div className={`font-semibold truncate ${sg.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                    {sg.title}
                                  </div>
                                  <div className="text-[10px] text-slate-400">{sg.targetDate ? `Due ${sg.targetDate}` : 'Ongoing'}</div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button type="button" onClick={() => handleUpdateProgress(sg, sg.progress - 10)} className="h-4 w-4 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold cursor-pointer">-</button>
                                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{sg.progress}%</span>
                                  <button type="button" onClick={() => handleUpdateProgress(sg, sg.progress + 10)} className="h-4 w-4 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold cursor-pointer">+</button>
                                  <button type="button" onClick={() => handleEditGoal(sg)} className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer" title="Edit sub-goal">
                                    <Edit3 className="h-3 w-3" />
                                  </button>
                                  <button type="button" onClick={() => handleDeleteGoal(sg.id)} className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer" title="Delete sub-goal">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
