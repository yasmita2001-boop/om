/**
 * Generates a complete, self-contained, standalone single-file HTML application (.html)
 * containing the entire Om-LifeOS personal operating system with all user data embedded.
 * Works 100% offline in any browser (Chrome, Edge, Safari, Firefox, iOS, Android)
 * with zero server or runtime dependencies.
 */

import { getLocalDateString } from './dateUtils';
import watermarkUrl from '../assets/om-lifeos-watermark.png';

function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function loadWatermarkDataUrl(): Promise<string> {
  const response = await fetch(watermarkUrl);
  if (!response.ok) throw new Error(`Could not load the watermark image for HTML export (${response.status}).`);

  const image = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Could not encode the watermark image for HTML export.'));
    reader.onerror = () => reject(reader.error || new Error('Could not read the watermark image for HTML export.'));
    reader.readAsDataURL(image);
  });
}

export async function generateCompleteStandaloneHtml(fullData: Record<string, any>): Promise<string> {
  const exportedAt = new Date().toLocaleString();
  const watermarkDataUrl = await loadWatermarkDataUrl();
  const safeDataJson = JSON.stringify(fullData)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');

  const tasks: any[] = fullData.tasks || [];
  const financeAccounts: any[] = fullData.financeAccounts || [];
  const transactions: any[] = fullData.finance || [];
  const loans: any[] = fullData.loans || [];
  const goals: any[] = fullData.goals || [];
  const notes: any[] = fullData.notes || [];
  const journal: any[] = fullData.journal || [];
  const habits: any[] = fullData.habits || [];
  const people: any[] = fullData.people || [];

  // Timeline & Plan Datasets
  const workProjects: any[] = fullData.workProjects || [];
  const milestones: any[] = fullData.milestones || [];
  const learningItems: any[] = fullData.learningItems || [];
  const savingsPlans: any[] = fullData.savingsPlans || [];
  const investments: any[] = fullData.investments || [];

  // Basic computed totals
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.done || t.status === 'completed').length;
  const totalLiquidCash = financeAccounts.reduce((acc, a) => acc + (Number(a.balance) || 0), 0);
  const totalGoals = goals.length;
  const totalNotes = notes.length;
  const totalJournal = journal.length;

  const todayStr = getLocalDateString();

  const checkDelay = (dueDate?: string, status?: string, progress?: number) => {
    const isDone = status === 'completed' || status === 'done' || status === 'Completed' || (progress !== undefined && progress >= 100);
    if (isDone) {
      return { isDelayed: false, delayDays: 0, delayLabel: 'Completed', delaySeverity: 'completed' as const };
    }
    if (!dueDate) {
      return { isDelayed: false, delayDays: 0, delayLabel: 'No deadline', delaySeverity: 'none' as const };
    }
    const dStr = dueDate.slice(0, 10);
    if (dStr === todayStr) {
      return { isDelayed: false, delayDays: 0, delayLabel: 'Due Today', delaySeverity: 'today' as const };
    }
    const dueTime = new Date(`${dStr}T23:59:59`).getTime();
    const nowTime = new Date(`${todayStr}T00:00:00`).getTime();
    const diffDays = Math.round((nowTime - dueTime) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      const severity = diffDays > 7 ? 'critical' as const : 'warning' as const;
      return { isDelayed: true, delayDays: diffDays, delayLabel: `${diffDays}d overdue`, delaySeverity: severity };
    }
    const remDays = Math.abs(diffDays);
    return { isDelayed: false, delayDays: 0, delayLabel: `${remDays}d left`, delaySeverity: 'upcoming' as const };
  };

  interface TimelineExportItem {
    id: string;
    type: 'project' | 'milestone' | 'task' | 'learning' | 'savings' | 'loan' | 'investment';
    typeLabel: string;
    title: string;
    dueDate?: string;
    status: string;
    progress: number;
    goalId?: string;
    goalTitle?: string;
    description?: string;
    isDelayed: boolean;
    delayDays: number;
    delayLabel: string;
    delaySeverity: 'critical' | 'warning' | 'today' | 'upcoming' | 'completed' | 'none';
  }

  const goalsMap = new Map<string, string>();
  goals.forEach(g => {
    if (g.id) goalsMap.set(g.id, g.title || 'Goal');
  });

  const timelineItems: TimelineExportItem[] = [
    ...workProjects.map(p => ({
      id: p.id || '',
      type: 'project' as const,
      typeLabel: 'Work Project',
      title: p.title || p.name || 'Untitled Project',
      dueDate: p.due || p.dueAt || p.deadline,
      status: p.status || 'Active',
      progress: Number(p.progress) || 0,
      goalId: p.goalId,
      goalTitle: p.goalId ? goalsMap.get(p.goalId) : undefined,
      description: p.description || p.note,
      ...checkDelay(p.due || p.dueAt || p.deadline, p.status, Number(p.progress) || 0)
    })),
    ...milestones.map(m => ({
      id: m.id || '',
      type: 'milestone' as const,
      typeLabel: 'Milestone',
      title: m.title || 'Milestone',
      dueDate: m.dueDate,
      status: m.status || 'open',
      progress: Number(m.progress) || 0,
      goalId: m.goalId,
      goalTitle: m.goalId ? goalsMap.get(m.goalId) : undefined,
      description: m.note,
      ...checkDelay(m.dueDate, m.status, Number(m.progress) || 0)
    })),
    ...tasks.filter(t => t.dueAt || t.date || t.dueDate || t.priority === 'High' || t.priority === 'Urgent').map(t => ({
      id: t.id || '',
      type: 'task' as const,
      typeLabel: 'Task Planner',
      title: t.title || 'Task',
      dueDate: t.dueAt || t.date || t.dueDate,
      status: t.done ? 'completed' : t.status || 'open',
      progress: t.done ? 100 : 0,
      goalId: t.goalId,
      goalTitle: t.goalId ? goalsMap.get(t.goalId) : undefined,
      description: t.description,
      ...checkDelay(t.dueAt || t.date || t.dueDate, t.done ? 'completed' : t.status, t.done ? 100 : 0)
    })),
    ...learningItems.map(l => ({
      id: l.id || '',
      type: 'learning' as const,
      typeLabel: 'Learning & Skill',
      title: l.title || l.name || 'Learning Item',
      dueDate: l.targetDate || l.deadline,
      status: l.status || 'In Progress',
      progress: Number(l.progress) || 0,
      goalId: l.goalId,
      goalTitle: l.goalId ? goalsMap.get(l.goalId) : undefined,
      description: l.notes || l.note,
      ...checkDelay(l.targetDate || l.deadline, l.status, Number(l.progress) || 0)
    })),
    ...savingsPlans.map(s => {
      const prog = s.targetAmount > 0 ? Math.min(100, Math.round(((Number(s.currentAmount) || 0) / Number(s.targetAmount)) * 100)) : 0;
      const targetDate = s.targetDate || (s.durationMonths && s.createdAt ? getLocalDateString(new Date(new Date(s.createdAt).getTime() + s.durationMonths * 30 * 86400000)) : undefined);
      return {
        id: s.id || '',
        type: 'savings' as const,
        typeLabel: 'Savings Target',
        title: `💰 ${s.name || 'Savings Plan'}`,
        dueDate: targetDate,
        status: prog >= 100 ? 'Target Reached' : `${prog}% saved`,
        progress: prog,
        goalId: s.goalId,
        goalTitle: s.goalId ? goalsMap.get(s.goalId) : undefined,
        description: `Target: ₹${(Number(s.targetAmount) || 0).toLocaleString('en-IN')} · Saved: ₹${(Number(s.currentAmount) || 0).toLocaleString('en-IN')}`,
        ...checkDelay(targetDate, prog >= 100 ? 'completed' : 'in_progress', prog)
      };
    }),
    ...loans.map(l => {
      const principal = Number(l.principal ?? l.amount) || 0;
      const outstanding = Number(l.outstanding) || 0;
      const paid = Number(l.paidAmount) || (principal ? Math.max(0, principal - outstanding) : 0);
      const prog = principal > 0 ? Math.min(100, Math.round((paid / principal) * 100)) : 0;
      const isPaid = prog >= 100;
      return {
        id: l.id || '',
        type: 'loan' as const,
        typeLabel: 'Debt Clearance',
        title: `💳 ${l.lender || l.name || 'Loan'}`,
        dueDate: l.targetDate || l.dueDate,
        status: isPaid ? 'Cleared' : `${prog}% paid`,
        progress: prog,
        goalId: l.goalId,
        goalTitle: l.goalId ? goalsMap.get(l.goalId) : undefined,
        description: `Principal: ₹${principal.toLocaleString('en-IN')} · Paid: ₹${paid.toLocaleString('en-IN')} · Outstanding: ₹${outstanding.toLocaleString('en-IN')}`,
        ...checkDelay(l.targetDate || l.dueDate, isPaid ? 'completed' : 'active', prog)
      };
    }),
    ...investments.map(inv => {
      const currentVal = Number(inv.currentValue ?? inv.amount) || 0;
      const amount = Number(inv.amount) || 0;
      const gain = currentVal - amount;
      return {
        id: inv.id || '',
        type: 'investment' as const,
        typeLabel: 'Investment Asset',
        title: `📈 ${inv.name || 'Investment'}`,
        dueDate: inv.targetDate || inv.maturityDate || inv.horizonDate,
        status: gain >= 0 ? `+₹${gain.toLocaleString('en-IN')}` : `-₹${Math.abs(gain).toLocaleString('en-IN')}`,
        progress: amount > 0 ? Math.min(100, Math.round((currentVal / amount) * 100)) : 100,
        goalId: inv.goalId,
        goalTitle: inv.goalId ? goalsMap.get(inv.goalId) : undefined,
        description: `Invested: ₹${amount.toLocaleString('en-IN')} · Current Value: ₹${currentVal.toLocaleString('en-IN')}`,
        ...checkDelay(inv.targetDate || inv.maturityDate || inv.horizonDate, 'ongoing', 100)
      };
    })
  ];

  timelineItems.sort((a, b) => {
    if (a.isDelayed !== b.isDelayed) return a.isDelayed ? -1 : 1;
    if (a.delaySeverity === 'today') return -1;
    if (b.delaySeverity === 'today') return 1;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return (a.title || '').localeCompare(b.title || '');
  });

  const totalTimelineItems = timelineItems.length;
  const delayedTimelineItems = timelineItems.filter(i => i.isDelayed).length;
  const dueTodayTimelineItems = timelineItems.filter(i => i.delaySeverity === 'today').length;
  const upcomingTimelineItems = timelineItems.filter(i => i.delaySeverity === 'upcoming').length;
  const completedTimelineItems = timelineItems.filter(i => i.delaySeverity === 'completed').length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Om-LifeOS — Complete Standalone Sovereign Application</title>
  <style>
    :root {
      --bg-body: #f8fafc;
      --bg-card: #ffffff;
      --bg-card-subtle: #f1f5f9;
      --border-color: #e2e8f0;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --accent: #b88648;
      --accent-hover: #94683d;
      --accent-light: #f5ead8;
      --accent-text: #795326;
      --success: #10b981;
      --success-light: #ecfdf5;
      --success-text: #047857;
      --warning: #f59e0b;
      --warning-light: #fffbeb;
      --warning-text: #b45309;
      --danger: #ef4444;
      --danger-light: #fef2f2;
      --danger-text: #b91c1c;
      --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
      --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07);
    }
    body.dark {
      --bg-body: #090d16;
      --bg-card: #131b2e;
      --bg-card-subtle: #1c2742;
      --border-color: #1e293b;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #d4aa6b;
      --accent-hover: #e0bd7d;
      --accent-light: #3a2f1e;
      --accent-text: #f0d7aa;
      --success: #10b981;
      --success-light: #064e3b;
      --success-text: #6ee7b7;
      --warning: #f59e0b;
      --warning-light: #78350f;
      --warning-text: #fde68a;
      --danger: #ef4444;
      --danger-light: #7f1d1d;
      --danger-text: #fca5a5;
      --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.4);
      --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.3);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      position: relative;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: var(--bg-body);
      color: var(--text-main);
      line-height: 1.5;
      transition: background-color 0.2s, color 0.2s;
    }
    body::after {
      content: "";
      position: fixed;
      z-index: 9999;
      inset: 0;
      background: url("${watermarkDataUrl}") center center / min(68vw, 620px) auto no-repeat;
      opacity: 0.14;
      pointer-events: none;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 40;
      background-color: var(--bg-card);
      border-bottom: 1px solid var(--border-color);
      padding: 0.75rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: var(--shadow-sm);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .brand-icon {
      width: 2.25rem;
      height: 2.25rem;
      background: linear-gradient(135deg, #c99c5a, #94683d);
      color: white;
      border-radius: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      font-weight: bold;
      box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
    }
    .brand-text h1 {
      font-size: 1.1rem;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .brand-text p {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .search-input {
      padding: 0.4rem 0.85rem;
      font-size: 0.8rem;
      border: 1px solid var(--border-color);
      border-radius: 0.6rem;
      background-color: var(--bg-card-subtle);
      color: var(--text-main);
      outline: none;
      width: 180px;
      transition: width 0.2s;
    }
    .search-input:focus {
      width: 240px;
      border-color: var(--accent);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.45rem 0.85rem;
      font-size: 0.8rem;
      font-weight: 600;
      border-radius: 0.65rem;
      border: 1px solid var(--border-color);
      background-color: var(--bg-card);
      color: var(--text-main);
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn:hover {
      background-color: var(--bg-card-subtle);
      border-color: var(--accent);
    }
    .btn-primary {
      background-color: var(--accent);
      border-color: var(--accent);
      color: white;
    }
    .btn-primary:hover {
      background-color: var(--accent-hover);
    }
    .layout-container {
      display: flex;
      min-height: calc(100vh - 65px);
    }
    aside {
      width: 240px;
      background-color: var(--bg-card);
      border-right: 1px solid var(--border-color);
      padding: 1rem 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      shrink: 0;
    }
    .nav-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.6rem 0.85rem;
      font-size: 0.825rem;
      font-weight: 600;
      color: var(--text-muted);
      border-radius: 0.65rem;
      cursor: pointer;
      transition: all 0.15s;
    }
    .nav-item:hover {
      background-color: var(--bg-card-subtle);
      color: var(--text-main);
    }
    .nav-item.active {
      background-color: var(--accent-light);
      color: var(--accent-text);
      font-weight: 700;
    }
    .nav-badge {
      font-size: 0.7rem;
      padding: 0.1rem 0.45rem;
      border-radius: 9999px;
      background-color: var(--bg-card-subtle);
      color: var(--text-muted);
    }
    .nav-item.active .nav-badge {
      background-color: var(--accent);
      color: white;
    }
    main {
      flex: 1;
      padding: 1.5rem;
      max-width: 1200px;
      margin: 0 auto;
      width: 100%;
    }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .metric-card {
      background-color: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 1rem;
      padding: 1.25rem;
      box-shadow: var(--shadow-sm);
    }
    .metric-card .title {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }
    .metric-card .value {
      font-size: 1.6rem;
      font-weight: 800;
      margin-top: 0.35rem;
      letter-spacing: -0.03em;
    }
    .metric-card .sub {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.25rem;
    }
    .card {
      background-color: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 1rem;
      padding: 1.25rem;
      margin-bottom: 1.25rem;
      box-shadow: var(--shadow-sm);
    }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.75rem;
      margin-bottom: 1rem;
    }
    .card-title {
      font-size: 0.95rem;
      font-weight: 700;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 0.15rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-high { background-color: var(--danger-light); color: var(--danger-text); }
    .badge-medium { background-color: var(--warning-light); color: var(--warning-text); }
    .badge-low { background-color: var(--accent-light); color: var(--accent-text); }
    .badge-success { background-color: var(--success-light); color: var(--success-text); }
    .badge-today { background-color: var(--warning-light); color: var(--warning-text); font-weight: 800; border: 1px solid rgba(245, 158, 11, 0.4); }
    .timeline-filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-bottom: 1rem;
    }
    .timeline-filter-btn {
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
      border: 1px solid var(--border-color);
      background-color: var(--bg-card);
      color: var(--text-muted);
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .timeline-filter-btn:hover {
      background-color: var(--bg-card-subtle);
      color: var(--text-main);
    }
    .timeline-filter-btn.active {
      background-color: var(--accent);
      color: white;
      border-color: var(--accent);
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8rem;
    }
    .data-table th, .data-table td {
      padding: 0.65rem 0.75rem;
      text-align: left;
      border-bottom: 1px solid var(--border-color);
    }
    .data-table th {
      font-weight: 700;
      color: var(--text-muted);
      background-color: var(--bg-card-subtle);
    }
    .task-item {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.75rem;
      border-radius: 0.75rem;
      border: 1px solid var(--border-color);
      margin-bottom: 0.5rem;
      background-color: var(--bg-card);
      transition: all 0.15s;
    }
    .task-item:hover {
      border-color: var(--accent);
    }
    .task-checkbox {
      width: 1.1rem;
      height: 1.1rem;
      margin-top: 0.2rem;
      cursor: pointer;
      accent-color: var(--accent);
    }
    .task-item.done .task-title {
      text-decoration: line-through;
      color: var(--text-muted);
    }
    .task-info { flex: 1; }
    .task-title { font-size: 0.875rem; font-weight: 600; }
    .task-desc { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.15rem; }
    .task-meta { display: flex; gap: 0.5rem; align-items: center; margin-top: 0.35rem; }
    .notes-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }
    .note-card {
      border: 1px solid var(--border-color);
      background-color: var(--bg-card);
      border-radius: 0.85rem;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .note-title { font-size: 0.875rem; font-weight: 700; }
    .note-content { font-size: 0.8rem; color: var(--text-muted); max-height: 120px; overflow-y: auto; white-space: pre-wrap; }
    .progress-bar-container {
      width: 100%;
      height: 6px;
      background-color: var(--bg-card-subtle);
      border-radius: 9999px;
      overflow: hidden;
      margin-top: 0.35rem;
    }
    .progress-bar-fill {
      height: 100%;
      background-color: var(--accent);
      border-radius: 9999px;
      transition: width 0.3s;
    }
    .json-box {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.75rem;
      background-color: var(--bg-card-subtle);
      padding: 1rem;
      border-radius: 0.75rem;
      border: 1px solid var(--border-color);
      max-height: 450px;
      overflow: auto;
      white-space: pre;
    }
    .banner {
      background: linear-gradient(135deg, rgba(79, 70, 229, 0.08), rgba(124, 58, 237, 0.04));
      border: 1px solid var(--border-color);
      border-radius: 1rem;
      padding: 1rem 1.25rem;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .footer {
      text-align: center;
      padding: 2rem 0;
      color: var(--text-muted);
      font-size: 0.75rem;
      border-top: 1px solid var(--border-color);
      margin-top: 3rem;
    }
    @media (max-width: 768px) {
      .layout-container { flex-direction: column; }
      aside { width: 100%; border-right: none; border-bottom: 1px solid var(--border-color); }
      .search-input { width: 130px; }
      .search-input:focus { width: 160px; }
    }
    @media print {
      @page { size: A4; margin: 8mm; }

      body::after {
        background-size: min(72vw, 620px) auto;
        opacity: 0.2;
      }

      html, body {
        width: auto !important;
        height: auto !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        color: #111 !important;
      }

      header, aside, .header-actions, .btn, .banner, #tab-database {
        display: none !important;
      }

      .layout-container, main {
        display: block !important;
        min-height: 0 !important;
        width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      /* One continuous report: never force a new sheet between sections. */
      .tab-content {
        display: block !important;
        margin: 0 0 5mm 0 !important;
        padding: 0 !important;
        page-break-before: auto !important;
        page-break-after: auto !important;
        break-before: auto !important;
        break-after: auto !important;
      }

      .card {
        margin: 0 0 4mm 0 !important;
        padding: 4mm !important;
        border: 1px solid #cbd5e1 !important;
        border-radius: 3mm !important;
        box-shadow: none !important;
        break-inside: auto !important;
        page-break-inside: auto !important;
      }

      .card-header {
        margin-bottom: 2mm !important;
        padding-bottom: 2mm !important;
      }

      h1, h2, h3, .section-title {
        break-after: avoid !important;
        page-break-after: avoid !important;
      }

      table { width: 100% !important; border-collapse: collapse !important; }
      thead { display: table-header-group !important; }
      tr { break-inside: avoid !important; page-break-inside: avoid !important; }

      /* Avoid tall CSS-grid rows creating blank space at the bottom of a sheet. */
      .metrics-grid, .notes-grid,
      #tab-goals .card > div[style*="display:grid"],
      #tab-habits .card > div[style*="display:grid"] {
        display: block !important;
        column-count: 2 !important;
        column-gap: 4mm !important;
        margin-bottom: 3mm !important;
      }

      .metrics-grid > *, .notes-grid > *,
      #tab-goals .card > div[style*="display:grid"] > *,
      #tab-habits .card > div[style*="display:grid"] > * {
        display: block !important;
        width: 100% !important;
        margin: 0 0 3mm 0 !important;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }

      .metric-card, .note-card, .task-item { padding: 3mm !important; }
      .footer { margin-top: 3mm !important; padding: 2mm 0 !important; }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <header>
    <div class="brand">
      <div class="brand-icon">ॐ</div>
      <div class="brand-text">
        <h1>Om-LifeOS Sovereign Application</h1>
        <p>Standalone Offline Edition · Exported ${escapeHtml(exportedAt)}</p>
      </div>
    </div>
    <div class="header-actions">
      <input type="text" id="global-search" class="search-input" placeholder="Search tasks, notes..." oninput="handleSearch(this.value)">
      <button type="button" class="btn" onclick="toggleTheme()" title="Toggle Dark/Light Mode">🌙 Theme</button>
      <button type="button" class="btn" onclick="window.print()" title="Print Full Report">🖨️ Print</button>
      <button type="button" class="btn btn-primary" onclick="downloadBackupJson()" title="Download raw JSON snapshot">💾 Export JSON</button>
    </div>
  </header>

  <div class="layout-container">
    <!-- Sidebar Navigation -->
    <aside>
      <div class="nav-item active" onclick="showTab('dashboard')">
        <span>⚡ Dashboard</span>
      </div>
      <div class="nav-item" onclick="showTab('timeline')">
        <span>📅 Timeline & Plan</span>
        <span class="nav-badge" id="nav-count-timeline" style="${delayedTimelineItems > 0 ? 'background-color:var(--danger);color:white;font-weight:700;' : ''}">${delayedTimelineItems > 0 ? `⚠️ ${delayedTimelineItems}` : totalTimelineItems}</span>
      </div>
      <div class="nav-item" onclick="showTab('tasks')">
        <span>📋 Tasks & Planner</span>
        <span class="nav-badge" id="nav-count-tasks">${tasks.length}</span>
      </div>
      <div class="nav-item" onclick="showTab('finance')">
        <span>💰 Finance & Ledger</span>
        <span class="nav-badge">${financeAccounts.length}</span>
      </div>
      <div class="nav-item" onclick="showTab('goals')">
        <span>🎯 Goals & Strategy</span>
        <span class="nav-badge">${goals.length}</span>
      </div>
      <div class="nav-item" onclick="showTab('notes')">
        <span>📝 Notes & Notebooks</span>
        <span class="nav-badge">${notes.length}</span>
      </div>
      <div class="nav-item" onclick="showTab('journal')">
        <span>📖 Journal & Mind</span>
        <span class="nav-badge">${journal.length}</span>
      </div>
      <div class="nav-item" onclick="showTab('habits')">
        <span>🔄 Habits & Routines</span>
        <span class="nav-badge">${habits.length}</span>
      </div>
      <div class="nav-item" onclick="showTab('people')">
        <span>👥 People & Network</span>
        <span class="nav-badge">${people.length}</span>
      </div>
      <div class="nav-item" onclick="showTab('database')">
        <span>💾 Database & Backup</span>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main>
      <!-- Top Sovereignty Banner -->
      <div class="banner">
        <div>
          <strong style="font-size: 0.85rem;">🔒 Complete Sovereign Single-File HTML</strong>
          <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">
            This file contains all your LifeOS data, components and offline viewer. It runs entirely inside your browser without any network connection.
          </p>
        </div>
        <div style="font-size: 0.75rem; font-weight: 700; color: var(--success); white-space: nowrap;">
          ● 100% Offline & Sovereign
        </div>
      </div>

      <!-- Tab: Dashboard -->
      <section id="tab-dashboard" class="tab-content active">
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="title">Total Tasks</div>
            <div class="value">${totalTasks}</div>
            <div class="sub">${completedTasks} completed (${totalTasks > 0 ? Math.round((completedTasks/totalTasks)*100) : 0}%)</div>
          </div>
          <div class="metric-card">
            <div class="title">Liquid Cash & Accounts</div>
            <div class="value">₹${totalLiquidCash.toLocaleString('en-IN')}</div>
            <div class="sub">${financeAccounts.length} active accounts</div>
          </div>
          <div class="metric-card">
            <div class="title">Active Goals</div>
            <div class="value">${totalGoals}</div>
            <div class="sub">Strategic vision milestones</div>
          </div>
          <div class="metric-card">
            <div class="title">Notes & Records</div>
            <div class="value">${totalNotes + totalJournal}</div>
            <div class="sub">${totalNotes} notes · ${totalJournal} journals</div>
          </div>
          <div class="metric-card" onclick="showTab('timeline')" style="cursor:pointer;" title="Click to view Timeline & Plan">
            <div class="title">Timeline & Plan</div>
            <div class="value" style="${delayedTimelineItems > 0 ? 'color:var(--danger);' : ''}">${totalTimelineItems}</div>
            <div class="sub">${delayedTimelineItems > 0 ? `⚠️ ${delayedTimelineItems} delayed items` : 'All on track'} · ${workProjects.length} projects</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">📅 Timeline Milestones & Project Deadlines</h2>
            <button type="button" class="btn" onclick="showTab('timeline')">Open Full Timeline →</button>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Item</th>
                <th>Target Due</th>
                <th>Progress</th>
                <th>Delay Status</th>
              </tr>
            </thead>
            <tbody>
              ${timelineItems.slice(0, 5).map(item => `
                <tr>
                  <td><span class="badge ${item.type === 'project' ? 'badge-low' : item.type === 'milestone' ? 'badge-medium' : 'badge-success'}">${escapeHtml(item.typeLabel)}</span></td>
                  <td><strong>${escapeHtml(item.title)}</strong></td>
                  <td style="font-family:ui-monospace, monospace; font-size:0.75rem;">${item.dueDate ? escapeHtml(item.dueDate) : '<span style="color:var(--text-muted)">Unscheduled</span>'}</td>
                  <td>
                    <div style="min-width:90px;">
                      <div style="font-size:0.7rem; font-weight:700;">${item.progress}%</div>
                      <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${item.progress}%;"></div></div>
                    </div>
                  </td>
                  <td>
                    ${item.delaySeverity === 'critical' ? `<span class="badge badge-high">⚠️ ${escapeHtml(item.delayLabel)}</span>` :
                      item.delaySeverity === 'warning' ? `<span class="badge badge-high">${escapeHtml(item.delayLabel)}</span>` :
                      item.delaySeverity === 'today' ? `<span class="badge badge-today">🔔 Due Today</span>` :
                      item.delaySeverity === 'completed' ? `<span class="badge badge-success">✓ Done</span>` :
                      item.delaySeverity === 'upcoming' ? `<span class="badge badge-low">${escapeHtml(item.delayLabel)}</span>` :
                      `<span class="badge" style="background:var(--bg-card-subtle);color:var(--text-muted)">-</span>`}
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="5" style="text-align:center; padding:1rem; color:var(--text-muted)">No timeline items scheduled.</td></tr>'}
            </tbody>
          </table>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Pending High-Priority Focus Tasks</h2>
            <button class="btn" onclick="showTab('tasks')">View All Tasks →</button>
          </div>
          <div id="dashboard-tasks-list">
            ${tasks.filter(t => !t.done && (t.priority === 'High' || t.status === 'in_progress')).slice(0, 5).map(t => `
              <div class="task-item">
                <input type="checkbox" class="task-checkbox" onchange="toggleTaskDone('${escapeHtml(t.id)}', this.checked)">
                <div class="task-info">
                  <div class="task-title">${escapeHtml(t.title)}</div>
                  ${t.description ? `<div class="task-desc">${escapeHtml(t.description)}</div>` : ''}
                  <div class="task-meta">
                    <span class="badge badge-high">High Priority</span>
                    ${t.dueAt ? `<span style="font-size:0.7rem; color:var(--text-muted)">Due: ${escapeHtml(t.dueAt)}</span>` : ''}
                  </div>
                </div>
              </div>
            `).join('') || '<p style="font-size:0.8rem; color:var(--text-muted)">No pending high-priority tasks.</p>'}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Financial Accounts Summary</h2>
            <button class="btn" onclick="showTab('finance')">View Full Ledger →</button>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>Account Name</th>
                <th>Type</th>
                <th>Institution</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              ${financeAccounts.map(a => `
                <tr>
                  <td><strong>${escapeHtml(a.name)}</strong></td>
                  <td><span class="badge badge-low">${escapeHtml(a.type || 'Bank')}</span></td>
                  <td>${escapeHtml(a.institution || 'Local')}</td>
                  <td style="font-weight:700">₹${(Number(a.balance) || 0).toLocaleString('en-IN')}</td>
                </tr>
              `).join('') || '<tr><td colspan="4">No accounts found.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>

      <!-- Tab: Timeline & Plan -->
      <section id="tab-timeline" class="tab-content">
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="title">Timeline Planned Items</div>
            <div class="value">${totalTimelineItems}</div>
            <div class="sub">${workProjects.length} projects · ${milestones.length} milestones</div>
          </div>
          <div class="metric-card">
            <div class="title">Delayed Alarms</div>
            <div class="value" style="${delayedTimelineItems > 0 ? 'color:var(--danger);' : ''}">${delayedTimelineItems}</div>
            <div class="sub">${delayedTimelineItems > 0 ? 'Requires attention / reschedule' : 'Zero overdue milestones'}</div>
          </div>
          <div class="metric-card">
            <div class="title">Due Today</div>
            <div class="value" style="${dueTodayTimelineItems > 0 ? 'color:var(--warning);' : ''}">${dueTodayTimelineItems}</div>
            <div class="sub">Deadlines matching today</div>
          </div>
          <div class="metric-card">
            <div class="title">Upcoming / In-Progress</div>
            <div class="value">${upcomingTimelineItems}</div>
            <div class="sub">${completedTimelineItems} already completed</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">📅 Project Timeline & Execution Schedule (${totalTimelineItems})</h2>
              <p style="font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem;">
                Unified chronological timeline connecting Projects, Milestones, Deadlines, and Learning paths.
              </p>
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted);">
              Reference Date: <strong>${escapeHtml(todayStr)}</strong>
            </div>
          </div>

          <!-- Timeline Filter Controls -->
          <div class="timeline-filter-bar">
            <button type="button" class="timeline-filter-btn active" onclick="filterTimeline('all', this)">All Items (${totalTimelineItems})</button>
            <button type="button" class="timeline-filter-btn" onclick="filterTimeline('project', this)">Projects (${workProjects.length})</button>
            <button type="button" class="timeline-filter-btn" onclick="filterTimeline('milestone', this)">Milestones (${milestones.length})</button>
            <button type="button" class="timeline-filter-btn" onclick="filterTimeline('task', this)">Tasks with Deadlines (${tasks.filter(t => t.dueAt || t.date || t.dueDate).length})</button>
            <button type="button" class="timeline-filter-btn" onclick="filterTimeline('learning', this)">Learning & Skills (${learningItems.length})</button>
            <button type="button" class="timeline-filter-btn" onclick="filterTimeline('savings', this)">Savings (${savingsPlans.length})</button>
            <button type="button" class="timeline-filter-btn" onclick="filterTimeline('loan', this)">Loans (${loans.length})</button>
            <button type="button" class="timeline-filter-btn" onclick="filterTimeline('investment', this)">Investments (${investments.length})</button>
            ${delayedTimelineItems > 0 ? `<button type="button" class="timeline-filter-btn" style="border-color:var(--danger);color:var(--danger);" onclick="filterTimeline('delayed', this)">⚠️ Delayed Only (${delayedTimelineItems})</button>` : ''}
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Item / Title</th>
                <th>Target Due Date</th>
                <th>Progress & Status</th>
                <th>Delay Status</th>
                <th>Linked Goal</th>
              </tr>
            </thead>
            <tbody id="timeline-table-body">
              ${timelineItems.map(item => `
                <tr class="timeline-row" data-type="${escapeHtml(item.type)}" data-delayed="${item.isDelayed ? 'true' : 'false'}">
                  <td>
                    <span class="badge ${item.type === 'project' ? 'badge-low' : item.type === 'milestone' ? 'badge-medium' : item.type === 'savings' ? 'badge-success' : item.type === 'loan' ? 'badge-high' : item.type === 'investment' ? 'badge-low' : 'badge-success'}">
                      ${escapeHtml(item.typeLabel)}
                    </span>
                  </td>
                  <td>
                    <strong style="font-size:0.85rem;">${escapeHtml(item.title)}</strong>
                    ${item.description ? `<div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.15rem;">${escapeHtml(item.description)}</div>` : ''}
                  </td>
                  <td style="font-family:ui-monospace, monospace; font-size:0.75rem; font-weight:600;">
                    ${item.dueDate ? escapeHtml(item.dueDate) : '<span style="color:var(--text-muted)">Unscheduled</span>'}
                  </td>
                  <td>
                    <div style="min-width:110px;">
                      <div style="display:flex; justify-content:space-between; font-size:0.7rem; font-weight:700;">
                        <span>${escapeHtml(item.status)}</span>
                        <span>${item.progress}%</span>
                      </div>
                      <div class="progress-bar-container">
                        <div class="progress-bar-fill" style="width:${item.progress}%; ${item.progress >= 100 ? 'background-color:var(--success);' : ''}"></div>
                      </div>
                    </div>
                  </td>
                  <td>
                    ${item.delaySeverity === 'critical' ? `<span class="badge badge-high">⚠️ ${escapeHtml(item.delayLabel)}</span>` :
                      item.delaySeverity === 'warning' ? `<span class="badge badge-high">${escapeHtml(item.delayLabel)}</span>` :
                      item.delaySeverity === 'today' ? `<span class="badge badge-today">🔔 Due Today</span>` :
                      item.delaySeverity === 'completed' ? `<span class="badge badge-success">✓ Done</span>` :
                      item.delaySeverity === 'upcoming' ? `<span class="badge badge-low">${escapeHtml(item.delayLabel)}</span>` :
                      `<span class="badge" style="background:var(--bg-card-subtle);color:var(--text-muted)">-</span>`}
                  </td>
                  <td>
                    ${item.goalTitle ? `<span style="font-size:0.72rem; background:var(--bg-card-subtle); padding:0.15rem 0.45rem; border-radius:0.4rem; color:var(--text-muted);">🎯 ${escapeHtml(item.goalTitle)}</span>` : '<span style="color:var(--text-muted); font-size:0.72rem;">—</span>'}
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted)">No timeline items planned yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>

      <!-- Tab: Tasks -->
      <section id="tab-tasks" class="tab-content">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Tasks & Command Planner (${tasks.length})</h2>
            <div style="display:flex; gap:0.5rem;">
              <button class="btn" onclick="filterTaskStatus('all')">All</button>
              <button class="btn" onclick="filterTaskStatus('pending')">Pending</button>
              <button class="btn" onclick="filterTaskStatus('completed')">Completed</button>
            </div>
          </div>
          <div id="full-tasks-list">
            ${tasks.map(t => `
              <div class="task-item ${t.done ? 'done' : ''}" data-task-id="${escapeHtml(t.id)}" data-status="${t.done ? 'completed' : 'pending'}" data-priority="${escapeHtml(t.priority || 'Medium')}">
                <input type="checkbox" class="task-checkbox" ${t.done ? 'checked' : ''} onchange="toggleTaskDone('${escapeHtml(t.id)}', this.checked)">
                <div class="task-info">
                  <div class="task-title">${escapeHtml(t.title)}</div>
                  ${t.description ? `<div class="task-desc">${escapeHtml(t.description)}</div>` : ''}
                  <div class="task-meta">
                    <span class="badge ${t.priority === 'High' ? 'badge-high' : t.priority === 'Low' ? 'badge-low' : 'badge-medium'}">${escapeHtml(t.priority || 'Medium')}</span>
                    ${t.dueAt ? `<span style="font-size:0.7rem; color:var(--text-muted)">📅 Due: ${escapeHtml(t.dueAt)}</span>` : ''}
                    ${t.domain ? `<span style="font-size:0.7rem; color:var(--text-muted)">📁 ${escapeHtml(t.domain)}</span>` : ''}
                  </div>
                </div>
              </div>
            `).join('') || '<p style="color:var(--text-muted); font-size:0.8rem;">No tasks found.</p>'}
          </div>
        </div>
      </section>

      <!-- Tab: Finance -->
      <section id="tab-finance" class="tab-content">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Bank Accounts & Liquid Cash</h2>
          </div>
          <div class="metrics-grid">
            ${financeAccounts.map(a => `
              <div class="metric-card">
                <div class="title">${escapeHtml(a.name)}</div>
                <div class="value">₹${(Number(a.balance) || 0).toLocaleString('en-IN')}</div>
                <div class="sub">${escapeHtml(a.institution || 'Bank')} · ${escapeHtml(a.type || 'Account')}</div>
              </div>
            `).join('') || '<p style="font-size:0.8rem; color:var(--text-muted)">No accounts found.</p>'}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Recent Transactions Ledger (${transactions.length})</h2>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Type</th>
                <th>Description / Note</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${transactions.slice(0, 50).map(tx => `
                <tr>
                  <td>${escapeHtml(tx.date || tx.createdAt ? new Date(tx.date || tx.createdAt).toLocaleDateString() : '')}</td>
                  <td><strong>${escapeHtml(tx.category || 'General')}</strong></td>
                  <td><span class="badge ${tx.type === 'income' ? 'badge-success' : 'badge-high'}">${escapeHtml(tx.type || 'Expense')}</span></td>
                  <td>${escapeHtml(tx.note || tx.description || '-')}</td>
                  <td style="font-weight:700; color:${tx.type === 'income' ? 'var(--success)' : 'var(--danger)'}">
                    ${tx.type === 'income' ? '+' : '-'}₹${(Number(tx.amount) || 0).toLocaleString('en-IN')}
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="5">No transactions recorded.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>

      <!-- Tab: Goals -->
      <section id="tab-goals" class="tab-content">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Strategic Goals & Milestones (${goals.length})</h2>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:1rem;">
            ${goals.map(g => `
              <div class="metric-card" style="display:flex; flex-direction:column; gap:0.5rem;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <strong style="font-size:0.9rem;">${escapeHtml(g.title)}</strong>
                  <span class="badge badge-low">${escapeHtml(g.category || 'Strategic')}</span>
                </div>
                ${g.description ? `<p style="font-size:0.75rem; color:var(--text-muted)">${escapeHtml(g.description)}</p>` : ''}
                <div style="margin-top:auto;">
                  <div style="display:flex; justify-content:space-between; font-size:0.75rem; font-weight:700;">
                    <span>Progress</span>
                    <span>${g.progress || 0}%</span>
                  </div>
                  <div class="progress-bar-container">
                    <div class="progress-bar-fill" style="width:${g.progress || 0}%"></div>
                  </div>
                  ${g.targetDate ? `<div style="font-size:0.7rem; color:var(--text-muted); margin-top:0.35rem;">Target: ${escapeHtml(g.targetDate)}</div>` : ''}
                </div>
              </div>
            `).join('') || '<p style="color:var(--text-muted); font-size:0.8rem;">No goals configured.</p>'}
          </div>
        </div>
      </section>

      <!-- Tab: Notes -->
      <section id="tab-notes" class="tab-content">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Notes & Notebooks (${notes.length})</h2>
          </div>
          <div class="notes-grid">
            ${notes.map(n => `
              <div class="note-card">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div class="note-title">${escapeHtml(n.title)}</div>
                  <span class="badge badge-low">${escapeHtml(n.category || 'Note')}</span>
                </div>
                <div class="note-content">${escapeHtml(n.content || n.body || '(Empty note)')}</div>
                ${n.date || n.updatedAt ? `<div style="font-size:0.7rem; color:var(--text-muted); margin-top:auto;">Updated: ${new Date(n.date || n.updatedAt).toLocaleDateString()}</div>` : ''}
              </div>
            `).join('') || '<p style="color:var(--text-muted); font-size:0.8rem;">No notes recorded.</p>'}
          </div>
        </div>
      </section>

      <!-- Tab: Journal -->
      <section id="tab-journal" class="tab-content">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Daily Journal & Reflections (${journal.length})</h2>
          </div>
          <div style="display:flex; flex-direction:column; gap:0.75rem;">
            ${journal.map(j => `
              <div class="card" style="margin-bottom:0;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                  <strong>${escapeHtml(j.title || 'Reflection')}</strong>
                  <span style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(j.date || (j.createdAt ? new Date(j.createdAt).toLocaleDateString() : ''))}</span>
                </div>
                <div style="font-size:0.8rem; color:var(--text-muted); white-space:pre-wrap;">${escapeHtml(j.content || j.reflection || j.body || '')}</div>
              </div>
            `).join('') || '<p style="color:var(--text-muted); font-size:0.8rem;">No journal entries found.</p>'}
          </div>
        </div>
      </section>

      <!-- Tab: Habits -->
      <section id="tab-habits" class="tab-content">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Routines & Atomic Habits (${habits.length})</h2>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:1rem;">
            ${habits.map(h => `
              <div class="metric-card">
                <div style="display:flex; justify-content:space-between;">
                  <strong>${escapeHtml(h.name || h.title)}</strong>
                  <span class="badge badge-success">Streak: ${h.streak || 0}</span>
                </div>
                <div class="sub" style="margin-top:0.5rem;">Frequency: ${escapeHtml(h.frequency || 'Daily')}</div>
                ${h.cue ? `<div style="font-size:0.7rem; color:var(--text-muted); margin-top:0.25rem;">Cue: ${escapeHtml(h.cue)}</div>` : ''}
              </div>
            `).join('') || '<p style="color:var(--text-muted); font-size:0.8rem;">No habits tracked.</p>'}
          </div>
        </div>
      </section>

      <!-- Tab: People -->
      <section id="tab-people" class="tab-content">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">People & Relationships (${people.length})</h2>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Relationship</th>
                <th>Important Date / Note</th>
              </tr>
            </thead>
            <tbody>
              ${people.map(p => `
                <tr>
                  <td><strong>${escapeHtml(p.name)}</strong></td>
                  <td><span class="badge badge-low">${escapeHtml(p.relationship || 'Contact')}</span></td>
                  <td>${escapeHtml(p.importantDate || p.notes || '-')}</td>
                </tr>
              `).join('') || '<tr><td colspan="3">No contacts recorded.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>

      <!-- Tab: Database & Backup -->
      <section id="tab-database" class="tab-content">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Raw Sovereign Database JSON</h2>
            <div style="display:flex; gap:0.5rem;">
              <button class="btn" onclick="copyDataJson()">📋 Copy JSON</button>
              <button class="btn btn-primary" onclick="downloadBackupJson()">💾 Download .omlifeos File</button>
            </div>
          </div>
          <div id="json-viewer" class="json-box">Loading data JSON...</div>
        </div>
      </section>
    </main>
  </div>

  <footer class="footer">
    <p>Om-LifeOS Standalone Edition · Sovereign Offline Local System</p>
  </footer>

  <!-- Raw Embedded JSON Payload -->
  <script id="om-data" type="application/json">
${safeDataJson}
  </script>

  <!-- Interactive Client-side Script -->
  <script>
    let appData = {};
    try {
      const dataEl = document.getElementById('om-data');
      if (dataEl) {
        appData = JSON.parse(dataEl.textContent || '{}');
      }
    } catch(e) {
      console.error('Error loading embedded data', e);
    }

    // Populate JSON viewer
    window.addEventListener('DOMContentLoaded', () => {
      const jsonViewer = document.getElementById('json-viewer');
      if (jsonViewer) {
        jsonViewer.textContent = JSON.stringify(appData, null, 2);
      }
    });

    // Tab Switching
    function showTab(tabId) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

      const target = document.getElementById('tab-' + tabId);
      if (target) target.classList.add('active');

      const navs = document.querySelectorAll('.nav-item');
      navs.forEach(nav => {
        if (nav.getAttribute('onclick') && nav.getAttribute('onclick').includes(tabId)) {
          nav.classList.add('active');
        }
      });
    }

    // Theme Toggle
    function toggleTheme() {
      document.body.classList.toggle('dark');
      const isDark = document.body.classList.contains('dark');
      try {
        localStorage.setItem('om-theme', isDark ? 'dark' : 'light');
      } catch(e) {}
    }

    // Restore saved theme
    try {
      if (localStorage.getItem('om-theme') === 'dark') {
        document.body.classList.add('dark');
      }
    } catch(e) {}

    // Interactive Task Toggle
    function toggleTaskDone(taskId, isDone) {
      const items = document.querySelectorAll('[data-task-id="' + taskId + '"]');
      items.forEach(el => {
        if (isDone) {
          el.classList.add('done');
          el.setAttribute('data-status', 'completed');
        } else {
          el.classList.remove('done');
          el.setAttribute('data-status', 'pending');
        }
        const chk = el.querySelector('.task-checkbox');
        if (chk) chk.checked = isDone;
      });

      // Update in memory
      if (appData.tasks) {
        const t = appData.tasks.find(x => x.id === taskId);
        if (t) {
          t.done = isDone;
          t.status = isDone ? 'completed' : 'open';
        }
      }
    }

    // Task Filter
    function filterTaskStatus(status) {
      const items = document.querySelectorAll('#full-tasks-list .task-item');
      items.forEach(item => {
        if (status === 'all') {
          item.style.display = 'flex';
        } else if (status === 'completed') {
          item.style.display = item.getAttribute('data-status') === 'completed' ? 'flex' : 'none';
        } else if (status === 'pending') {
          item.style.display = item.getAttribute('data-status') === 'pending' ? 'flex' : 'none';
        }
      });
    }

    // Timeline Filter
    function filterTimeline(type, btn) {
      document.querySelectorAll('.timeline-filter-btn').forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');

      const rows = document.querySelectorAll('#timeline-table-body .timeline-row');
      rows.forEach(row => {
        const itemType = row.getAttribute('data-type');
        const isDelayed = row.getAttribute('data-delayed') === 'true';

        if (type === 'all') {
          row.style.display = '';
        } else if (type === 'delayed') {
          row.style.display = isDelayed ? '' : 'none';
        } else {
          row.style.display = itemType === type ? '' : 'none';
        }
      });
    }

    // Global Search
    function handleSearch(query) {
      const q = (query || '').toLowerCase().trim();
      if (!q) {
        document.querySelectorAll('.task-item, .note-card, .timeline-row').forEach(el => el.style.display = '');
        return;
      }
      document.querySelectorAll('.task-item').forEach(el => {
        const text = el.textContent.toLowerCase();
        el.style.display = text.includes(q) ? 'flex' : 'none';
      });
      document.querySelectorAll('.note-card').forEach(el => {
        const text = el.textContent.toLowerCase();
        el.style.display = text.includes(q) ? 'flex' : 'none';
      });
      document.querySelectorAll('.timeline-row').forEach(el => {
        const text = el.textContent.toLowerCase();
        el.style.display = text.includes(q) ? '' : 'none';
      });
    }

    // Download Backup JSON
    function downloadBackupJson() {
      const payload = {
        app: 'Om-LifeOS',
        version: '4.0.0',
        exportedAt: new Date().toISOString(),
        data: appData
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Om-LifeOS-Backup-' + getLocalDateString() + '.omlifeos';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    // Copy JSON to clipboard
    function copyDataJson() {
      const text = JSON.stringify(appData, null, 2);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          alert('Database JSON copied to clipboard!');
        }).catch(() => {
          prompt('Copy database JSON below:', text);
        });
      } else {
        prompt('Copy database JSON below:', text);
      }
    }
  </script>
</body>
</html>`;
}
