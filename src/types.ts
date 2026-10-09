export type NavModule =
  | 'dashboard'
  | 'tasks'
  | 'routine'
  | 'goals'
  | 'focus'
  | 'notes'
  | 'journal'
  | 'finance'
  | 'health'
  | 'calculator'
  | 'settings';

export type TaskDomain = 'work' | 'personal' | 'health' | 'finance' | 'learning' | 'spiritual';
export type TaskPriority = 'High' | 'Medium' | 'Low';
export type TaskStatus = 'open' | 'in-progress' | 'done';

export interface Task {
  id: string;
  title: string;
  description?: string;
  domain: TaskDomain;
  priority: TaskPriority;
  dueAt?: string;
  date?: string;
  goalId?: string | null;
  routineId?: string | null;
  done: boolean;
  status: TaskStatus;
  completedAt?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface DailyPlanner {
  date: string;
  target: string;
  mood?: string;
  progress: number;
  points: { id: string; text: string; done: boolean }[];
  wins: string[];
  reflection: string[];
}

export interface Routine {
  id: string;
  name: string;
  startTime: string;
  endTime?: string;
  frequency: 'daily' | 'weekdays' | 'weekly';
  category: 'morning' | 'deep_work' | 'evening' | 'health' | 'learning' | 'personal';
  note?: string;
  active: boolean;
  goalId?: string | null;
  completedDate?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Habit {
  id: string;
  name: string;
  frequency: string;
  timesPerDay: number;
  times?: string[];
  goalId?: string | null;
  linkedRoutineId?: string | null;
  streak?: number;
  createdAt: number;
  updatedAt: number;
}

export interface HabitLog {
  id: string;
  key: string;
  habitId: string;
  date: string;
  occurrence: number;
  status?: string;
  createdAt: number;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  category: 'Career' | 'Finance' | 'Health' | 'Mastery' | 'Life';
  progress: number; // 0-100
  targetDate?: string;
  level: 1 | 2 | 3 | 4 | 5; // 1=Main, 2=Sub, 3=Micro, 4=Nano, 5=Atomic
  parentId?: string | null;
  status: 'active' | 'completed';
  createdAt: number;
  updatedAt: number;
}

export interface FocusSession {
  id: string;
  label: string;
  notes?: string;
  durationMinutes: number;
  date: string;
  startedAt: number;
  endedAt: number;
  taskId?: string | null;
  goalId?: string | null;
}

export interface FocusAlarm {
  id: string;
  time: string; // HH:mm
  label: string;
  ringtone: string;
  enabled: boolean;
  days: number[]; // 0=Sun..6=Sat
  lastTriggeredDate?: string;
  snoozedUntil?: number | null;
  createdAt: number;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  html?: string;
  category: string;
  tags?: string;
  color?: string;
  pinned?: boolean;
  date: string;
  goalId?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface JournalEntry {
  id: string;
  title: string;
  text: string;
  html?: string;
  mood: string;
  tags?: string;
  date: string;
  color?: string;
  goalId?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface FinanceAccount {
  id: string;
  name: string;
  type: 'bank' | 'cash' | 'wallet' | 'crypto';
  balance: number;
  accountNumber?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface FinanceTransaction {
  id: string;
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  category: string;
  date: string;
  note?: string;
  accountId?: string | null;
  toAccountId?: string | null;
  goalId?: string | null;
  createdAt: number;
}

export interface Loan {
  id: string;
  name: string;
  principal: number;
  rate: number;
  tenureMonths: number;
  outstanding: number;
  goalId?: string | null;
  createdAt: number;
}

export interface Investment {
  id: string;
  name: string;
  amount: number;
  currentValue: number;
  date: string;
  goalId?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface SavingsPlan {
  id: string;
  name: string;
  currentAmount: number;
  targetAmount: number;
  goalId?: string | null;
  createdAt: number;
}

export interface HealthMeasurement {
  id: string;
  date: string;
  weight?: number;
  steps?: number;
  exercise?: string;
  durationMinutes?: number;
  createdAt: number;
}

export interface SleepRecord {
  id: string;
  date: string;
  hours: number;
  quality?: string;
  createdAt: number;
}

export interface WaterRecord {
  id: string;
  date: string;
  amountMl: number;
  createdAt: number;
}

export interface CalcHistoryItem {
  id: string;
  tool: string;
  args: any[];
  result: string;
  createdAt: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarChar: string;
  avatarColor: string;
  photoURL?: string;
  createdAt: number;
}

export interface AppState {
  profileId: string;
  profiles: UserProfile[];
  themeMode: 'light' | 'dark';
  accentColor: string;
  dailyPlanner?: DailyPlanner;
  calcFavorites?: string[];
}
