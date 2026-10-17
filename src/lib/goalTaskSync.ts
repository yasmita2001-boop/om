import { storage } from './storage';
import { getLocalDateString } from './dateUtils';
import {
  Goal,
  Task,
  Milestone,
  Habit,
  HabitLog,
  Routine,
  WorkProject,
  LearningItem,
  Skill,
  Note,
  JournalEntry,
  FinanceTransaction,
  Loan,
  Investment,
  SavingsPlan,
  Asset,
  Liability,
  HealthMeasurement,
  SleepRecord,
  WaterRecord,
  NutritionRecord,
  HealthAppointment,
  HealthNote,
  Meeting,
  Person,
  Interaction,
  ValueItem,
  SpiritualPractice,
  Commitment,
  FocusSession,
  ReminderItem
} from '../types';

export type GoalItemType =
  | 'goal'
  | 'task'
  | 'milestone'
  | 'habit'
  | 'routine'
  | 'project'
  | 'learning'
  | 'skill'
  | 'note'
  | 'journal'
  | 'savingsPlan'
  | 'loan'
  | 'investment'
  | 'asset'
  | 'liability'
  | 'transaction'
  | 'healthMeasurement'
  | 'sleepRecord'
  | 'waterRecord'
  | 'nutritionRecord'
  | 'appointment'
  | 'healthNote'
  | 'meeting'
  | 'person'
  | 'interaction'
  | 'value'
  | 'practice'
  | 'commitment'
  | 'focusSession'
  | 'reminder';

export interface GoalItemDetail {
  id: string;
  type: GoalItemType;
  typeLabel: string;
  title: string;
  progress: number;
  weightPercent: number; // e.g. 10% if 10 items
  isCompleted: boolean;
}

export interface GoalCategorySummary {
  count: number;
  completedCount: number;
  avgPercent: number;
}

export interface GoalProgressBreakdown {
  goalId: string;
  goalTitle: string;
  totalItems: number;
  completedItems: number;
  totalPercent: number;
  hasLinkedItems: boolean;
  categories: {
    childGoals: GoalCategorySummary;
    tasks: GoalCategorySummary;
    milestones: GoalCategorySummary;
    habits: GoalCategorySummary;
    routines: GoalCategorySummary;
    projects: GoalCategorySummary;
    learning: GoalCategorySummary;
    skills: GoalCategorySummary;
    notes: GoalCategorySummary;
    journal: GoalCategorySummary;
    savingsPlans: GoalCategorySummary;
    loans: GoalCategorySummary;
    investments: GoalCategorySummary;
    assets: GoalCategorySummary;
    liabilities: GoalCategorySummary;
    transactions: GoalCategorySummary;
    healthMeasurements: GoalCategorySummary;
    sleepRecords: GoalCategorySummary;
    waterRecords: GoalCategorySummary;
    nutritionRecords: GoalCategorySummary;
    appointments: GoalCategorySummary;
    healthNotes: GoalCategorySummary;
    meetings: GoalCategorySummary;
    people: GoalCategorySummary;
    interactions: GoalCategorySummary;
    values: GoalCategorySummary;
    practices: GoalCategorySummary;
    commitments: GoalCategorySummary;
    focusSessions: GoalCategorySummary;
    reminders: GoalCategorySummary;
  };
  items: GoalItemDetail[];
}

export interface RecalcOverrides {
  updatedTaskId?: string;
  updatedTaskDone?: boolean;
  updatedMilestoneId?: string;
  updatedMilestoneStatus?: string;
  updatedMilestoneProgress?: number;
  updatedHabitId?: string;
  updatedRoutineId?: string;
  isRoutineDoneToday?: boolean;
  updatedProjectId?: string;
  updatedProjectStatus?: string;
  updatedProjectProgress?: number;
  updatedLearningId?: string;
  updatedLearningProgress?: number;
  updatedSkillId?: string;
  updatedSkillLevelOrProgress?: string | number;
  updatedNoteId?: string;
  updatedJournalId?: string;
  directChildGoalId?: string;
  directChildGoalProgress?: number;
  updatedReminderId?: string;
  updatedReminderDone?: boolean;
  updatedAppointmentId?: string;
  updatedAppointmentStatus?: 'scheduled' | 'completed' | 'cancelled';
  updatedAppointmentCompleted?: boolean;
  updatedMeetingId?: string;
  updatedMeetingStatus?: 'scheduled' | 'completed' | 'cancelled';
  updatedMeetingCompleted?: boolean;
}

export interface GoalRelatedData {
  goals: Goal[];
  tasks: Task[];
  milestones?: Milestone[];
  habits?: Habit[];
  habitLogs?: HabitLog[];
  routines?: Routine[];
  workProjects?: WorkProject[];
  learningItems?: LearningItem[];
  skills?: Skill[];
  notes?: Note[];
  journal?: JournalEntry[];
  savingsPlans?: SavingsPlan[];
  loans?: Loan[];
  investments?: Investment[];
  assets?: Asset[];
  liabilities?: Liability[];
  transactions?: FinanceTransaction[];
  healthMeasurements?: HealthMeasurement[];
  sleepRecords?: SleepRecord[];
  waterRecords?: WaterRecord[];
  nutritionRecords?: NutritionRecord[];
  appointments?: HealthAppointment[];
  healthNotes?: HealthNote[];
  meetings?: Meeting[];
  people?: Person[];
  interactions?: Interaction[];
  values?: ValueItem[];
  practices?: SpiritualPractice[];
  commitments?: Commitment[];
  focusSessions?: FocusSession[];
  reminders?: ReminderItem[];
}

/**
 * Synchronously computes comprehensive aggregate breakdown for a given goal
 * from all provided data arrays in memory across all 21+ linked modules.
 */
export function computeGoalAggregateBreakdown(
  goalId: string,
  data: GoalRelatedData
): GoalProgressBreakdown {
  const goal = data.goals.find(g => g.id === goalId);
  const goalTitle = goal?.title || 'Goal';
  const today = getLocalDateString();

  const milestones = data.milestones || [];
  const habits = data.habits || [];
  const habitLogs = data.habitLogs || [];
  const routines = data.routines || [];
  const projects = data.workProjects || [];
  const learning = data.learningItems || [];
  const skills = data.skills || [];
  const notes = data.notes || [];
  const journal = data.journal || [];

  const savingsPlans = data.savingsPlans || [];
  const loans = data.loans || [];
  const investments = data.investments || [];
  const assets = data.assets || [];
  const liabilities = data.liabilities || [];
  const transactions = data.transactions || [];

  const healthMeasurements = data.healthMeasurements || [];
  const sleepRecords = data.sleepRecords || [];
  const waterRecords = data.waterRecords || [];
  const nutritionRecords = data.nutritionRecords || [];
  const appointments = data.appointments || [];
  const healthNotes = data.healthNotes || [];

  const meetings = data.meetings || [];
  const people = data.people || [];
  const interactions = data.interactions || [];

  const values = data.values || [];
  const practices = data.practices || [];
  const commitments = data.commitments || [];
  const focusSessions = data.focusSessions || [];
  const reminders = data.reminders || [];

  // Filter linked items
  const childGoals = data.goals.filter(g => g.parentId === goalId || (g.parentIds && g.parentIds.includes(goalId)));
  const tasks = data.tasks.filter(t => t.goalId === goalId);
  const linkedMilestones = milestones.filter(m => m.goalId === goalId);
  const linkedHabits = habits.filter(h => h.goalId === goalId);
  const linkedRoutines = routines.filter(r => r.goalId === goalId);
  const linkedProjects = projects.filter(p => p.goalId === goalId);
  const linkedLearning = learning.filter(l => l.goalId === goalId);
  const linkedSkills = skills.filter(s => s.goalId === goalId);
  const linkedNotes = notes.filter(n => n.goalId === goalId);
  const linkedJournal = journal.filter(j => j.goalId === goalId);

  const linkedSavingsPlans = savingsPlans.filter(s => s.goalId === goalId);
  const linkedLoans = loans.filter(l => l.goalId === goalId);
  const linkedInvestments = investments.filter(i => i.goalId === goalId);
  const linkedAssets = assets.filter(a => a.goalId === goalId);
  const linkedLiabilities = liabilities.filter(l => l.goalId === goalId);
  const linkedTransactions = transactions.filter(t => t.goalId === goalId);

  const linkedHealthMeasurements = healthMeasurements.filter(h => h.goalId === goalId);
  const linkedSleepRecords = sleepRecords.filter(s => s.goalId === goalId);
  const linkedWaterRecords = waterRecords.filter(w => w.goalId === goalId);
  const linkedNutritionRecords = nutritionRecords.filter(n => n.goalId === goalId);
  const linkedAppointments = appointments.filter(a => a.goalId === goalId);
  const linkedHealthNotes = healthNotes.filter(n => n.goalId === goalId);

  const linkedMeetings = meetings.filter(m => m.goalId === goalId);
  const linkedPeople = people.filter(p => p.goalId === goalId);
  const linkedInteractions = interactions.filter(i => i.goalId === goalId);

  const linkedValues = values.filter(v => v.goalId === goalId);
  const linkedPractices = practices.filter(p => p.goalId === goalId);
  const linkedCommitments = commitments.filter(c => c.goalId === goalId);

  const linkedFocusSessions = focusSessions.filter(f => f.goalId === goalId);
  const linkedReminders = reminders.filter(r => r.linkedType === 'goal' && r.linkedId === goalId);

  const rawItems: Array<{
    id: string;
    type: GoalItemDetail['type'];
    typeLabel: string;
    title: string;
    progress: number;
    isCompleted: boolean;
  }> = [];

  // 1. Child Goals
  childGoals.forEach(c => {
    const prog = Math.max(0, Math.min(100, Math.round(Number(c.progress) || 0)));
    const typeLabel =
      c.level === 5 ? '⚡ Atomic Goal' :
      c.level === 4 ? '🔸 Nano Goal' :
      c.level === 3 ? '▫️ Micro Goal' :
      c.level === 2 ? '🔹 Sub Goal' : '🎯 Main Goal';
    rawItems.push({
      id: c.id,
      type: 'goal',
      typeLabel,
      title: c.title,
      progress: prog,
      isCompleted: prog >= 100
    });
  });

  // 2. Tasks
  tasks.forEach(t => {
    const isDone = Boolean(t.done || t.status === 'done');
    const prog = isDone ? 100 : t.status === 'in-progress' ? 50 : 0;
    rawItems.push({
      id: t.id,
      type: 'task',
      typeLabel: '📋 Task',
      title: t.title,
      progress: prog,
      isCompleted: isDone
    });
  });

  // 3. Milestones
  linkedMilestones.forEach(m => {
    const isDone = m.status === 'completed';
    const prog = isDone ? 100 : Math.max(0, Math.min(100, Math.round(Number(m.progress) || 0)));
    rawItems.push({
      id: m.id,
      type: 'milestone',
      typeLabel: '🏁 Milestone',
      title: m.title,
      progress: prog,
      isCompleted: isDone || prog >= 100
    });
  });

  // 4. Habits (Evaluated based on 30-day consistency window)
  linkedHabits.forEach(h => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoIso = getLocalDateString(thirtyDaysAgo);
    const recentLogs = habitLogs.filter(l => l.habitId === h.id && l.date >= thirtyDaysAgoIso);
    const uniqueDays = new Set(recentLogs.map(l => l.date)).size;
    const isDoneToday = habitLogs.some(l => l.habitId === h.id && l.date === today);
    const effectiveDays = isDoneToday && uniqueDays === 0 ? 1 : uniqueDays;
    const prog = Math.min(100, Math.round((effectiveDays / 30) * 100));
    rawItems.push({
      id: h.id,
      type: 'habit',
      typeLabel: '🔁 Habit Ritual',
      title: `${h.name} (${effectiveDays}/30d consistency${isDoneToday ? ' · ✓ Done Today' : ''})`,
      progress: prog,
      isCompleted: prog >= 90
    });
  });

  // 5. Routines (Evaluated based on 30-day consistency window)
  linkedRoutines.forEach(r => {
    const isDoneToday = Boolean(r.completedDate === today || (r.completedDates && r.completedDates.includes(today)));
    const dates = Array.from(new Set([...(r.completedDates || []), ...(r.completedDate ? [r.completedDate] : [])]));
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoIso = getLocalDateString(thirtyDaysAgo);
    const recentDays = dates.filter(d => d >= thirtyDaysAgoIso).length;
    const effectiveDays = isDoneToday && recentDays === 0 ? 1 : recentDays;
    const prog = Math.min(100, Math.round((effectiveDays / 30) * 100));
    rawItems.push({
      id: r.id,
      type: 'routine',
      typeLabel: '⏱️ Routine Block',
      title: `${r.name} (${effectiveDays}/30d consistency${isDoneToday ? ' · ✓ Done Today' : ''})`,
      progress: prog,
      isCompleted: prog >= 90
    });
  });

  // 6. Projects
  linkedProjects.forEach(p => {
    let prog = 0;
    if (p.status === 'Completed') prog = 100;
    else if (p.progress !== undefined && p.progress !== null) prog = Number(p.progress) || 0;
    else if (p.status === 'In Review') prog = 80;
    else if (p.status === 'Active') prog = 40;
    else prog = 20;

    prog = Math.max(0, Math.min(100, Math.round(prog)));
    rawItems.push({
      id: p.id,
      type: 'project',
      typeLabel: '📂 Deliverable',
      title: p.name,
      progress: prog,
      isCompleted: prog >= 100 || p.status === 'Completed'
    });
  });

  // 7. Learning Items
  linkedLearning.forEach(l => {
    const prog = Math.max(0, Math.min(100, Math.round(Number(l.progress) || 0)));
    rawItems.push({
      id: l.id,
      type: 'learning',
      typeLabel: '📚 Learning Track',
      title: l.title,
      progress: prog,
      isCompleted: prog >= 100
    });
  });

  // 8. Skills
  linkedSkills.forEach(s => {
    let prog = 0;
    if (typeof s.progress === 'number' && !isNaN(s.progress)) {
      prog = s.progress;
    } else {
      const lvl = (s.level || '').toLowerCase();
      if (lvl.includes('master') || lvl.includes('expert')) prog = 100;
      else if (lvl.includes('advance')) prog = 75;
      else if (lvl.includes('inter')) prog = 50;
      else prog = 25;
    }
    prog = Math.max(0, Math.min(100, Math.round(prog)));
    rawItems.push({
      id: s.id,
      type: 'skill',
      typeLabel: '🏆 Competency',
      title: s.name,
      progress: prog,
      isCompleted: prog >= 100
    });
  });

  // 9. Notebooks & Knowledge Vault (Reference Vault)
  linkedNotes.forEach(n => {
    rawItems.push({
      id: n.id,
      type: 'note',
      typeLabel: '📓 Knowledge Vault',
      title: n.title,
      progress: 0,
      isCompleted: false
    });
  });

  // 10. Daily Journal & Philosophical Reflections (Reference Reflection)
  linkedJournal.forEach(j => {
    rawItems.push({
      id: j.id,
      type: 'journal',
      typeLabel: '📖 Journal Reflection',
      title: j.title,
      progress: 0,
      isCompleted: false
    });
  });

  // 11. Savings Plans
  linkedSavingsPlans.forEach(s => {
    const target = Number(s.targetAmount) || 0;
    const current = Number(s.currentAmount) || 0;
    const prog = target > 0 ? Math.max(0, Math.min(100, Math.round((current / target) * 100))) : 100;
    rawItems.push({
      id: s.id,
      type: 'savingsPlan',
      typeLabel: '💰 Savings Goal',
      title: `${s.name} (₹${current.toLocaleString()} / ₹${target.toLocaleString()})`,
      progress: prog,
      isCompleted: prog >= 100
    });
  });

  // 12. Loans & Debt Clearances
  linkedLoans.forEach(l => {
    const principal = Number(l.principal) || 0;
    const outstanding = Number(l.outstanding) || 0;
    const repaid = principal > 0 ? Math.max(0, principal - outstanding) : 0;
    const prog = principal > 0 ? Math.max(0, Math.min(100, Math.round((repaid / principal) * 100))) : 100;
    rawItems.push({
      id: l.id,
      type: 'loan',
      typeLabel: '💳 Loan Repayment',
      title: `${l.name} (Paid: ₹${repaid.toLocaleString()})`,
      progress: prog,
      isCompleted: outstanding <= 0 || prog >= 100
    });
  });

  // 13. Investments & Portfolios
  linkedInvestments.forEach(i => {
    const amt = Number(i.amount) || 0;
    const val = Number(i.currentValue) || 0;
    const prog = amt > 0 ? Math.max(0, Math.min(100, Math.round((val / amt) * 100))) : 100;
    rawItems.push({
      id: i.id,
      type: 'investment',
      typeLabel: '📈 Investment',
      title: `${i.name} (₹${val.toLocaleString()})`,
      progress: prog,
      isCompleted: val >= amt && val > 0
    });
  });

  // 14. Capital Assets
  linkedAssets.forEach(a => {
    rawItems.push({
      id: a.id,
      type: 'asset',
      typeLabel: '🏛️ Asset Holding',
      title: `${a.name} (₹${(Number(a.value) || 0).toLocaleString()})`,
      progress: 100,
      isCompleted: true
    });
  });

  // 15. Liabilities
  linkedLiabilities.forEach(l => {
    const amt = Number(l.amount) || 0;
    const prog = amt <= 0 ? 100 : 50;
    rawItems.push({
      id: l.id,
      type: 'liability',
      typeLabel: '⚖️ Liability Item',
      title: `${l.name} (₹${amt.toLocaleString()})`,
      progress: prog,
      isCompleted: amt <= 0
    });
  });

  // 16. Finance Transactions (Deposits / Allocations)
  linkedTransactions.forEach(t => {
    rawItems.push({
      id: t.id,
      type: 'transaction',
      typeLabel: '💵 Ledger Entry',
      title: `${t.category || t.type}: ₹${(Number(t.amount) || 0).toLocaleString()} (${t.date})`,
      progress: 0,
      isCompleted: false
    });
  });

  // 17. Health Measurements / Physical Movement Logs
  linkedHealthMeasurements.forEach(h => {
    const detail = h.exercise ? `${h.exercise} (${h.duration || 0}m)` : h.weight ? `${h.weight}kg` : h.steps ? `${h.steps} steps` : 'Vitals logged';
    rawItems.push({
      id: h.id,
      type: 'healthMeasurement',
      typeLabel: '🏃 Physical Movement',
      title: `${detail} (${h.date})`,
      progress: 0,
      isCompleted: false
    });
  });

  // 18. Sleep Records (Informational Daily Log)
  linkedSleepRecords.forEach(s => {
    rawItems.push({
      id: s.id,
      type: 'sleepRecord',
      typeLabel: '💤 Sleep Log',
      title: `${s.hours}h Sleep (${s.date})`,
      progress: 0,
      isCompleted: false
    });
  });

  // 19. Water Hydration Records (Informational Daily Log)
  linkedWaterRecords.forEach(w => {
    rawItems.push({
      id: w.id,
      type: 'waterRecord',
      typeLabel: '💧 Hydration',
      title: `${w.amount}ml Water (${w.date})`,
      progress: 0,
      isCompleted: false
    });
  });

  // 20. Nutrition Records
  linkedNutritionRecords.forEach(n => {
    rawItems.push({
      id: n.id,
      type: 'nutritionRecord',
      typeLabel: '🥗 Nutrition Log',
      title: `${n.calories ? n.calories + ' kcal' : n.note || 'Meal entry'} (${n.date})`,
      progress: 0,
      isCompleted: false
    });
  });

  // 21. Health Appointments (Scheduled vs Attended/Completed)
  linkedAppointments.forEach(a => {
    const isDone = Boolean((a as any).completed === true || (a as any).status === 'completed');
    rawItems.push({
      id: a.id,
      type: 'appointment',
      typeLabel: '🩺 Medical Appointment',
      title: `${a.title} (${a.date})`,
      progress: isDone ? 100 : 0,
      isCompleted: isDone
    });
  });

  // 22. Health Clinical Notes
  linkedHealthNotes.forEach(n => {
    rawItems.push({
      id: n.id,
      type: 'healthNote',
      typeLabel: '📋 Health Clinical Note',
      title: `${(n.text || '').slice(0, 35)}... (${n.date})`,
      progress: 0,
      isCompleted: false
    });
  });

  // 23. Meetings & Strategic Syncs (Scheduled vs Completed)
  linkedMeetings.forEach(m => {
    const isDone = Boolean((m as any).completed === true || (m as any).status === 'completed');
    rawItems.push({
      id: m.id,
      type: 'meeting',
      typeLabel: '🤝 Strategic Meeting',
      title: `${m.title} (${m.date})`,
      progress: isDone ? 100 : 0,
      isCompleted: isDone
    });
  });

  // 24. People & Strategic Network Contacts
  linkedPeople.forEach(p => {
    rawItems.push({
      id: p.id,
      type: 'person',
      typeLabel: '👤 Network Contact',
      title: `${p.name} (${p.relationship || 'Contact'})`,
      progress: 0,
      isCompleted: false
    });
  });

  // 25. Interactions & Touchpoints
  linkedInteractions.forEach(i => {
    rawItems.push({
      id: i.id,
      type: 'interaction',
      typeLabel: '💬 Interaction Touchpoint',
      title: `${(i.text || '').slice(0, 35)}... (${i.date})`,
      progress: 0,
      isCompleted: false
    });
  });

  // 26. Core Values
  linkedValues.forEach(v => {
    rawItems.push({
      id: v.id,
      type: 'value',
      typeLabel: '💎 Core Value',
      title: v.title,
      progress: 0,
      isCompleted: false
    });
  });

  // 27. Spiritual Practices
  linkedPractices.forEach(p => {
    rawItems.push({
      id: p.id,
      type: 'practice',
      typeLabel: '🧘 Spiritual Practice',
      title: p.name,
      progress: 0,
      isCompleted: false
    });
  });

  // 28. Philosophical Commitments
  linkedCommitments.forEach(c => {
    rawItems.push({
      id: c.id,
      type: 'commitment',
      typeLabel: '📜 Commitment',
      title: (c.text || '').slice(0, 40),
      progress: 0,
      isCompleted: false
    });
  });

  // 29. Focus Sessions (Deep Work Session Log)
  linkedFocusSessions.forEach(f => {
    const mins = f.minutes || Math.round((f.durationSeconds || 0) / 60);
    rawItems.push({
      id: f.id,
      type: 'focusSession',
      typeLabel: '⚡ Deep Work Session',
      title: `${f.label || 'Focus'} (${mins}m on ${f.date})`,
      progress: 0,
      isCompleted: false
    });
  });

  // 30. Reminders
  linkedReminders.forEach(r => {
    const isDone = r.status === 'done';
    rawItems.push({
      id: r.id,
      type: 'reminder',
      typeLabel: '⏰ Goal Reminder',
      title: `${r.title} (${r.dueAt})`,
      progress: isDone ? 100 : 0,
      isCompleted: isDone
    });
  });

  // Pure actionable types that legitimately count towards Goal completion rate
  // Excludes informational notes, contacts, interactions, capital assets, transactions, vitals & focus logs
  const actionableTypes = new Set<GoalItemType>([
    'goal',
    'task',
    'milestone',
    'habit',
    'routine',
    'project',
    'learning',
    'skill',
    'savingsPlan',
    'loan',
    'investment',
    'appointment',
    'meeting',
    'reminder'
  ]);

  const actionableItems = rawItems.filter(i => actionableTypes.has(i.type));
  const totalItems = rawItems.length;
  const weightPerItem = actionableItems.length > 0
    ? Number((100 / actionableItems.length).toFixed(1))
    : (totalItems > 0 ? Number((100 / totalItems).toFixed(1)) : 0);

  const items: GoalItemDetail[] = rawItems.map(item => ({
    ...item,
    weightPercent: actionableTypes.has(item.type) ? weightPerItem : 0
  }));

  const completedItems = items.filter(i => i.isCompleted && actionableTypes.has(i.type)).length;

  const calcCategory = (type: GoalItemDetail['type']): GoalCategorySummary => {
    const matched = items.filter(i => i.type === type);
    const count = matched.length;
    const completedCount = matched.filter(i => i.isCompleted).length;
    const avgPercent = count > 0 ? Math.round(matched.reduce((acc, i) => acc + i.progress, 0) / count) : 0;
    return { count, completedCount, avgPercent };
  };

  const totalPercent = actionableItems.length > 0
    ? Math.max(0, Math.min(100, Math.round(actionableItems.reduce((acc, i) => acc + i.progress, 0) / actionableItems.length)))
    : Math.max(0, Math.min(100, Math.round(Number(goal?.progress) || 0)));

  return {
    goalId,
    goalTitle,
    totalItems,
    completedItems,
    totalPercent,
    hasLinkedItems: totalItems > 0,
    categories: {
      childGoals: calcCategory('goal'),
      tasks: calcCategory('task'),
      milestones: calcCategory('milestone'),
      habits: calcCategory('habit'),
      routines: calcCategory('routine'),
      projects: calcCategory('project'),
      learning: calcCategory('learning'),
      skills: calcCategory('skill'),
      notes: calcCategory('note'),
      journal: calcCategory('journal'),
      savingsPlans: calcCategory('savingsPlan'),
      loans: calcCategory('loan'),
      investments: calcCategory('investment'),
      assets: calcCategory('asset'),
      liabilities: calcCategory('liability'),
      transactions: calcCategory('transaction'),
      healthMeasurements: calcCategory('healthMeasurement'),
      sleepRecords: calcCategory('sleepRecord'),
      waterRecords: calcCategory('waterRecord'),
      nutritionRecords: calcCategory('nutritionRecord'),
      appointments: calcCategory('appointment'),
      healthNotes: calcCategory('healthNote'),
      meetings: calcCategory('meeting'),
      people: calcCategory('person'),
      interactions: calcCategory('interaction'),
      values: calcCategory('value'),
      practices: calcCategory('practice'),
      commitments: calcCategory('commitment'),
      focusSessions: calcCategory('focusSession'),
      reminders: calcCategory('reminder')
    },
    items
  };
}

/**
 * MASTER AGGREGATE RECALCULATION ENGINE
 * Calculates proportional, real-time aggregate progress across all 21+ item categories
 * linked to a Goal (Tasks, Milestones, Habits, Routines, Projects, Learning Tracks, Skills, Notes, Journal,
 * Savings Plans, Loans, Investments, Assets, Liabilities, Transactions, Health/Vitals, Sleep, Water, Nutrition,
 * Medical Appointments, Clinical Notes, Meetings, Network Contacts, Interactions, Values, Practices, Commitments, Focus, Reminders).
 * Recursively rolls up progress through the 5-Tier Hierarchy (Atomic 5 -> Nano 4 -> Micro 3 -> Sub 2 -> Main 1).
 */
export async function recalculateGoalAggregateProgress(
  goalId: string,
  overrides?: RecalcOverrides
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  if (!goalId) return { updatedGoals: [] };

  const allGoals = await storage.getAll<Goal>('goals');
  const targetGoal = allGoals.find(g => g.id === goalId);
  if (!targetGoal) return { updatedGoals: [] };

  const [
    loadedTasks,
    loadedMilestones,
    loadedHabits,
    loadedHabitLogs,
    loadedRoutines,
    loadedProjects,
    loadedLearning,
    loadedSkills,
    loadedNotes,
    loadedJournal,
    loadedTransactions,
    loadedLoans,
    loadedInvestments,
    loadedSavingsPlans,
    loadedAssets,
    loadedLiabilities,
    loadedHealthMeasurements,
    loadedSleep,
    loadedWater,
    loadedNutrition,
    loadedAppointments,
    loadedHealthNotes,
    loadedMeetings,
    loadedPeople,
    loadedInteractions,
    loadedValues,
    loadedPractices,
    loadedCommitments,
    loadedFocus,
    loadedReminders
  ] = await Promise.all([
    storage.getAll<Task>('tasks'),
    storage.getAll<Milestone>('milestones'),
    storage.getAll<Habit>('habits'),
    storage.getAll<HabitLog>('habitLogs'),
    storage.getAll<Routine>('routines'),
    storage.getAll<WorkProject>('workProjects'),
    storage.getAll<LearningItem>('learningItems'),
    storage.getAll<Skill>('skills'),
    storage.getAll<Note>('notes'),
    storage.getAll<JournalEntry>('journal'),
    storage.getAll<FinanceTransaction>('finance'),
    storage.getAll<Loan>('loans'),
    storage.getAll<Investment>('investments'),
    storage.getAll<SavingsPlan>('savingsPlans'),
    storage.getAll<Asset>('assets'),
    storage.getAll<Liability>('liabilities'),
    storage.getAll<HealthMeasurement>('healthMeasurements'),
    storage.getAll<SleepRecord>('sleepRecords'),
    storage.getAll<WaterRecord>('waterRecords'),
    storage.getAll<NutritionRecord>('nutritionRecords'),
    storage.getAll<HealthAppointment>('healthAppointments'),
    storage.getAll<HealthNote>('healthNotes'),
    storage.getAll<Meeting>('meetings'),
    storage.getAll<Person>('people'),
    storage.getAll<Interaction>('interactions'),
    storage.getAll<ValueItem>('values'),
    storage.getAll<SpiritualPractice>('spiritualPractices'),
    storage.getAll<Commitment>('commitments'),
    storage.getAll<FocusSession>('focus'),
    storage.getAll<ReminderItem>('reminders')
  ]);

  let allTasks = loadedTasks;
  let allMilestones = loadedMilestones;
  let allHabits = loadedHabits;
  const allHabitLogs = loadedHabitLogs;
  let allRoutines = loadedRoutines;
  let allProjects = loadedProjects;
  let allLearning = loadedLearning;
  let allSkills = loadedSkills;
  const allNotes = loadedNotes;
  const allJournal = loadedJournal;
  let allReminders = loadedReminders;
  let allAppointments = loadedAppointments;
  let allMeetings = loadedMeetings;

  // Apply in-flight overrides if provided
  if (overrides) {
    if (overrides.updatedTaskId) {
      allTasks = allTasks.map(t =>
        t.id === overrides.updatedTaskId
          ? {
              ...t,
              done: overrides.updatedTaskDone !== undefined ? overrides.updatedTaskDone : t.done,
              status: overrides.updatedTaskDone ? 'done' : 'open'
            }
          : t
      );
    }

    if (overrides.updatedMilestoneId) {
      allMilestones = allMilestones.map(m =>
        m.id === overrides.updatedMilestoneId
          ? {
              ...m,
              status: overrides.updatedMilestoneStatus !== undefined ? overrides.updatedMilestoneStatus : m.status,
              progress: overrides.updatedMilestoneProgress !== undefined ? overrides.updatedMilestoneProgress : m.progress
            }
          : m
      );
    }

    if (overrides.updatedRoutineId) {
      const today = getLocalDateString();
      allRoutines = allRoutines.map(r => {
        if (r.id !== overrides.updatedRoutineId) return r;
        const prevDates = r.completedDates || [];
        const nextDates = overrides.isRoutineDoneToday
          ? Array.from(new Set([...prevDates, today]))
          : prevDates.filter(d => d !== today);
        return {
          ...r,
          completedDate: overrides.isRoutineDoneToday ? today : null,
          completedDates: nextDates
        };
      });
    }

    if (overrides.updatedProjectId) {
      allProjects = allProjects.map(p =>
        p.id === overrides.updatedProjectId
          ? {
              ...p,
              status: overrides.updatedProjectStatus !== undefined ? overrides.updatedProjectStatus : p.status,
              progress: overrides.updatedProjectProgress !== undefined ? overrides.updatedProjectProgress : p.progress
            }
          : p
      );
    }

    if (overrides.updatedLearningId) {
      allLearning = allLearning.map(l =>
        l.id === overrides.updatedLearningId
          ? {
              ...l,
              progress: overrides.updatedLearningProgress !== undefined ? overrides.updatedLearningProgress : l.progress
            }
          : l
      );
    }

    if (overrides.updatedSkillId) {
      allSkills = allSkills.map(s => {
        if (s.id !== overrides.updatedSkillId) return s;
        if (typeof overrides.updatedSkillLevelOrProgress === 'number') {
          return { ...s, progress: overrides.updatedSkillLevelOrProgress };
        }
        if (typeof overrides.updatedSkillLevelOrProgress === 'string') {
          const lvl = overrides.updatedSkillLevelOrProgress;
          return {
            ...s,
            level: lvl,
            progress: lvl.toLowerCase().includes('master') ? 100 : lvl.toLowerCase().includes('advance') ? 75 : lvl.toLowerCase().includes('inter') ? 50 : 25
          };
        }
        return s;
      });
    }

    if (overrides.updatedReminderId) {
      allReminders = allReminders.map(r =>
        r.id === overrides.updatedReminderId
          ? {
              ...r,
              status: overrides.updatedReminderDone ? 'done' : 'open'
            }
          : r
      );
    }

    if (overrides.updatedAppointmentId) {
      allAppointments = allAppointments.map(a =>
        a.id === overrides.updatedAppointmentId
          ? {
              ...a,
              status: overrides.updatedAppointmentStatus !== undefined ? overrides.updatedAppointmentStatus : a.status,
              completed: overrides.updatedAppointmentCompleted !== undefined ? overrides.updatedAppointmentCompleted : a.completed
            }
          : a
      );
    }

    if (overrides.updatedMeetingId) {
      allMeetings = allMeetings.map(m =>
        m.id === overrides.updatedMeetingId
          ? {
              ...m,
              status: overrides.updatedMeetingStatus !== undefined ? overrides.updatedMeetingStatus : m.status,
              completed: overrides.updatedMeetingCompleted !== undefined ? overrides.updatedMeetingCompleted : m.completed
            }
          : m
      );
    }
  }

  // Work with a mutable clone map of goals
  const goalMap = new Map<string, Goal>();
  allGoals.forEach(g => goalMap.set(g.id, { ...g }));

  // Helper to recompute and persist a single goal based on goalMap and all linked stores
  const recomputeSingleGoal = async (currentGoalId: string): Promise<{ goal: Goal; breakdown: GoalProgressBreakdown } | null> => {
    const current = goalMap.get(currentGoalId);
    if (!current) return null;

    const currentGoalsArray = Array.from(goalMap.values());
    const breakdown = computeGoalAggregateBreakdown(currentGoalId, {
      goals: currentGoalsArray,
      tasks: allTasks,
      milestones: allMilestones,
      habits: allHabits,
      habitLogs: allHabitLogs,
      routines: allRoutines,
      workProjects: allProjects,
      learningItems: allLearning,
      skills: allSkills,
      notes: allNotes,
      journal: allJournal,
      savingsPlans: loadedSavingsPlans,
      loans: loadedLoans,
      investments: loadedInvestments,
      assets: loadedAssets,
      liabilities: loadedLiabilities,
      transactions: loadedTransactions,
      healthMeasurements: loadedHealthMeasurements,
      sleepRecords: loadedSleep,
      waterRecords: loadedWater,
      nutritionRecords: loadedNutrition,
      appointments: allAppointments,
      healthNotes: loadedHealthNotes,
      meetings: allMeetings,
      people: loadedPeople,
      interactions: loadedInteractions,
      values: loadedValues,
      practices: loadedPractices,
      commitments: loadedCommitments,
      focusSessions: loadedFocus,
      reminders: allReminders
    });

    const newProgress = breakdown.hasLinkedItems ? breakdown.totalPercent : (current.progress || 0);
    const updated: Goal = {
      ...current,
      progress: newProgress,
      status: newProgress >= 100 ? 'completed' : 'active',
      updatedAt: Date.now()
    };

    goalMap.set(current.id, updated);
    await storage.put('goals', updated);
    return { goal: updated, breakdown };
  };

  // 1. Recalculate target goal
  const targetResult = await recomputeSingleGoal(goalId);
  if (!targetResult) return { updatedGoals: [] };

  const updatedGoalsList: Goal[] = [targetResult.goal];

  // 2. Recursively rollup up the hierarchy (Level 5 -> Level 4 -> Level 3 -> Level 2 -> Level 1)
  const allParentIds = new Set<string>();
  if (targetResult.goal.parentId) allParentIds.add(targetResult.goal.parentId);
  (targetResult.goal.parentIds || []).forEach(p => { if (p) allParentIds.add(p); });

  const visitedParents = new Set<string>([targetResult.goal.id]);
  const parentQueue = Array.from(allParentIds);
  while (parentQueue.length > 0) {
    const pId = parentQueue.shift()!;
    if (visitedParents.has(pId)) continue;
    visitedParents.add(pId);
    const parentResult = await recomputeSingleGoal(pId);
    if (!parentResult) continue;
    updatedGoalsList.push(parentResult.goal);
    if (parentResult.goal.parentId && !visitedParents.has(parentResult.goal.parentId)) {
      parentQueue.push(parentResult.goal.parentId);
    }
    (parentResult.goal.parentIds || []).forEach(p => {
      if (p && !visitedParents.has(p)) parentQueue.push(p);
    });
  }

  return {
    updatedGoals: updatedGoalsList,
    targetGoal: targetResult.goal,
    breakdown: targetResult.breakdown
  };
}

/**
 * Recalculate linked goal progress from tasks
 */
export async function syncGoalProgressFromTasks(
  goalId: string,
  updatedTaskId?: string,
  updatedTaskDone?: boolean
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedTaskId,
    updatedTaskDone
  });
}

/**
 * Recalculate linked goal progress from milestones
 */
export async function syncGoalProgressFromMilestones(
  goalId: string,
  updatedMilestoneId?: string,
  updatedMilestoneProgress?: number,
  updatedMilestoneStatus?: string
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedMilestoneId,
    updatedMilestoneProgress,
    updatedMilestoneStatus
  });
}

/**
 * Recalculate linked goal progress from habits
 */
export async function syncGoalProgressFromHabits(
  goalId: string,
  updatedHabitId?: string
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedHabitId
  });
}

/**
 * Recalculate linked goal progress from work projects
 */
export async function syncGoalProgressFromProjects(
  goalId: string,
  updatedProjectId?: string,
  updatedProjectStatus?: string,
  updatedProjectProgress?: number
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedProjectId,
    updatedProjectStatus,
    updatedProjectProgress
  });
}

/**
 * Recalculate linked goal progress from learning tracks
 */
export async function syncGoalProgressFromLearning(
  goalId: string,
  updatedItemId?: string,
  updatedProgress?: number
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedLearningId: updatedItemId,
    updatedLearningProgress: updatedProgress
  });
}

/**
 * Recalculate linked goal progress from skill trees
 */
export async function syncGoalProgressFromSkills(
  goalId: string,
  updatedSkillId?: string,
  updatedLevelOrProgress?: string | number
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedSkillId,
    updatedSkillLevelOrProgress: updatedLevelOrProgress
  });
}

/**
 * Recalculate linked goal progress from routine blocks
 */
export async function syncGoalProgressFromRoutines(
  goalId: string,
  updatedRoutineId?: string,
  isDoneToday?: boolean
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedRoutineId,
    isRoutineDoneToday: isDoneToday
  });
}

/**
 * Recalculate linked goal progress from Notebooks & Knowledge Vault notes
 */
export async function syncGoalProgressFromNotes(
  goalId: string,
  updatedNoteId?: string
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedNoteId
  });
}

/**
 * Recalculate linked goal progress from Daily Journal & Philosophical Reflections
 */
export async function syncGoalProgressFromJournal(
  goalId: string,
  updatedJournalId?: string
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedJournalId
  });
}

/**
 * Recalculate linked goal progress from Finance (Transactions, Loans, Investments, Savings Plans, Assets, Liabilities)
 */
export async function syncGoalProgressFromFinance(
  goalId: string
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId);
}

/**
 * Recalculate linked goal progress from Health (Vitals, Movement, Sleep, Water, Nutrition, Appointments, Clinical Notes)
 */
export async function syncGoalProgressFromHealth(
  goalId: string
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId);
}

/**
 * Recalculate linked goal progress from Health Appointments
 */
export async function syncGoalProgressFromAppointments(
  goalId: string,
  updatedAppointmentId?: string,
  updatedAppointmentCompleted?: boolean,
  updatedAppointmentStatus?: 'scheduled' | 'completed' | 'cancelled'
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedAppointmentId,
    updatedAppointmentCompleted,
    updatedAppointmentStatus
  });
}

/**
 * Recalculate linked goal progress from Strategic Network & People (Meetings, People, Interactions)
 */
export async function syncGoalProgressFromPeople(
  goalId: string
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId);
}

/**
 * Recalculate linked goal progress from Strategic Meetings
 */
export async function syncGoalProgressFromMeetings(
  goalId: string,
  updatedMeetingId?: string,
  updatedMeetingCompleted?: boolean,
  updatedMeetingStatus?: 'scheduled' | 'completed' | 'cancelled'
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedMeetingId,
    updatedMeetingCompleted,
    updatedMeetingStatus
  });
}

/**
 * Recalculate linked goal progress from Spiritual & Philosophical Foundations (Values, Practices, Commitments)
 */
export async function syncGoalProgressFromSpiritual(
  goalId: string
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId);
}

/**
 * Recalculate linked goal progress from Deep Work Focus Sessions
 */
export async function syncGoalProgressFromFocus(
  goalId: string
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId);
}

/**
 * Recalculate linked goal progress from Reminders
 */
export async function syncGoalProgressFromReminders(
  goalId: string,
  updatedReminderId?: string,
  updatedReminderDone?: boolean
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal; breakdown?: GoalProgressBreakdown }> {
  return recalculateGoalAggregateProgress(goalId, {
    updatedReminderId,
    updatedReminderDone
  });
}

/**
 * Directly adjust or set a goal's manual progress (0-100) when it has no auto-linked items,
 * and roll up the 5-Tier Hierarchy.
 */
export async function syncGoalProgressDirect(
  goalId: string,
  progress: number
): Promise<{ updatedGoals: Goal[]; targetGoal?: Goal }> {
  if (!goalId) return { updatedGoals: [] };

  const allGoals = await storage.getAll<Goal>('goals');
  const targetGoal = allGoals.find(g => g.id === goalId);
  if (!targetGoal) return { updatedGoals: [] };

  const clampedProgress = Math.max(0, Math.min(100, Math.round(progress)));

  const goalMap = new Map<string, Goal>();
  allGoals.forEach(g => goalMap.set(g.id, { ...g }));

  const updatedTarget: Goal = {
    ...targetGoal,
    progress: clampedProgress,
    status: clampedProgress >= 100 ? 'completed' : 'active',
    updatedAt: Date.now()
  };
  goalMap.set(targetGoal.id, updatedTarget);
  await storage.put('goals', updatedTarget);

  const updatedGoalsList: Goal[] = [updatedTarget];

  // Rollup hierarchy
  let currentParentId = targetGoal.parentId;
  const visited = new Set<string>([targetGoal.id]);
  while (currentParentId && !visited.has(currentParentId)) {
    visited.add(currentParentId);
    const parentGoal = goalMap.get(currentParentId);
    if (!parentGoal) break;

    const res = await recalculateGoalAggregateProgress(parentGoal.id);
    if (res.targetGoal) {
      updatedGoalsList.push(res.targetGoal);
      currentParentId = res.targetGoal.parentId;
    } else {
      break;
    }
  }

  return { updatedGoals: updatedGoalsList, targetGoal: updatedTarget };
}

/**
 * RECALCULATE ALL GOALS IN SYSTEM (Bottom-Up Order: Level 5 -> Level 4 -> Level 3 -> Level 2 -> Level 1)
 * Used on initial app mount or after bulk imports to ensure 100% accurate aggregate reflection.
 */
export async function recalculateAllGoalsProgress(): Promise<Goal[]> {
  const allGoals = await storage.getAll<Goal>('goals');
  if (allGoals.length === 0) return [];

  // Group goals into Level 5, Level 4, Level 3, Level 2, Level 1
  const level5 = allGoals.filter(g => g.level === 5);
  const level4 = allGoals.filter(g => g.level === 4);
  const level3 = allGoals.filter(g => g.level === 3);
  const level2 = allGoals.filter(g => g.level === 2);
  const level1 = allGoals.filter(g => !g.level || g.level === 1 || !g.parentId);

  // Recalculate bottom-up
  for (const g of level5) {
    await recalculateGoalAggregateProgress(g.id);
  }
  for (const g of level4) {
    await recalculateGoalAggregateProgress(g.id);
  }
  for (const g of level3) {
    await recalculateGoalAggregateProgress(g.id);
  }
  for (const g of level2) {
    await recalculateGoalAggregateProgress(g.id);
  }
  for (const g of level1) {
    await recalculateGoalAggregateProgress(g.id);
  }

  return storage.getAll<Goal>('goals');
}
