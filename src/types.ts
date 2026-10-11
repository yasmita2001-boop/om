export type NavModule =
  | 'dashboard'
  | 'tasks'
  | 'routine'
  | 'goals'
  | 'focus'
  | 'notes'
  | 'journal'
  | 'calculator'
  | 'finance'
  | 'health'
  | 'work'
  | 'people'
  | 'spiritual'
  | 'things'
  | 'recycle_bin'
  | 'settings';

export type TaskDomain = 'personal' | 'work' | 'health' | 'finance' | 'spiritual' | 'social' | 'learning';
export type TaskPriority = 'High' | 'Medium' | 'Low';

export interface Task {
  id: string;
  title: string;
  description?: string;
  domain: TaskDomain;
  priority: TaskPriority;
  dueAt?: string;
  date?: string;
  scheduledAt?: string;
  projectId?: string | null;
  learningId?: string | null;
  skillId?: string | null;
  routineId?: string | null;
  habitId?: string | null;
  goalId?: string | null;
  done: boolean;
  status: 'open' | 'done' | 'in-progress';
  linkedEntity?: { type: string; id: string } | null;
  createdAt: number;
  updatedAt: number;
  sync?: SyncMeta;
}

export interface DailyPlanner {
  date: string;
  target: string;
  progress: number;
  points: { id: string; text: string; done: boolean }[];
  wins: string[];
  reflection: string[];
}

export interface Routine {
  id: string;
  name: string;
  time?: string;
  startTime?: string;
  endTime?: string;
  frequency: 'daily' | 'weekdays' | 'weekly' | 'custom';
  category: 'personal' | 'work' | 'learning' | 'health' | 'spiritual' | 'social';
  note?: string;
  active: boolean;
  goalId?: string | null;
  completedDate?: string | null;
  completedDates?: string[];
  createdAt: number;
  updatedAt: number;
  sync?: SyncMeta;
}

export interface Habit {
  id: string;
  name: string;
  frequency: string;
  timesPerDay: number;
  times?: string[];
  domain?: string;
  linkedPracticeId?: string;
  routineId?: string | null;
  linkedRoutineId?: string | null;
  linkedRoutineName?: string | null;
  goalId?: string | null;
  doneDate?: string | null;
  createdAt: number;
  updatedAt: number;
  sync?: SyncMeta;
}

export interface HabitLog {
  id: string;
  key: string;
  habitId: string;
  date: string;
  occurrence: number | 'all';
  note?: string;
  createdAt: number;
  sync?: SyncMeta;
}

export interface Goal {
  id: string;
  title: string;
  date?: string;
  targetDate?: string;
  progress: number;
  category?: string;
  status?: 'active' | 'completed' | 'paused';
  parentId?: string | null;
  level?: 1 | 2 | 3 | 4 | 5;
  description?: string;
  autoRollupProgress?: boolean;
  createdAt: number;
  updatedAt: number;
  sync?: SyncMeta;
}

export interface Milestone {
  id: string;
  goalId: string;
  title: string;
  dueDate?: string;
  progress: number;
  status: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Strategy {
  id: string;
  goalId: string;
  title: string;
  action: string;
  status: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface KPI {
  id: string;
  goalId?: string;
  name: string;
  target: number;
  current: number;
  unit: string;
  status: string;
  createdAt: number;
  updatedAt: number;
}

export interface Mission {
  id: string;
  title: string;
  period: string;
  target: string;
  action: string;
  status: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MentorProfile {
  mission?: string;
  startDate?: string;
  startingCapital?: number;
  survivalReserve?: number;
  emergencyReserve?: number;
  careerFund?: number;
  opportunityFund?: number;
  dailyBurn?: number;
  monthlyBurn?: number;
  savingTargetMonthly?: number;
  savingGoalAmount?: number;
  savingDuration?: number;
  savingDailyTarget?: number;
  balanceMode?: 'auto' | 'manual';
  manualBalance?: number;
  loanName?: string;
  loanOriginalPrincipal?: number;
  loanTenure?: number;
  loanRemainingMonths?: number;
  loanStartDate?: string;
  emiAmount?: number;
  emiDay?: number;
  updatedAt?: number;
}

export interface FocusSession {
  id: string;
  taskId?: string | null;
  goalId?: string | null;
  label: string;
  durationSeconds: number;
  minutes: number;
  date: string;
  startedAt: number;
  endedAt: number;
  note?: string;
  createdAt: number;
  updatedAt: number;
  sync?: SyncMeta;
}

export interface FocusRuntime {
  taskId?: string | null;
  goalId?: string | null;
  label: string;
  note: string;
  plannedSeconds: number;
  elapsedSeconds: number;
  startedAt: number;
  sessionStartedAt: number;
  running: boolean;
  pausedAt?: number | null;
}

export type AttachmentTransferStatus =
  | 'thumbnail_available'
  | 'original_available'
  | 'original_not_transferred'
  | 'ready_for_transfer'
  | 'transfer_in_progress'
  | 'transfer_failed'
  | 'original_unavailable';

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  ownerType: string;
  ownerId: string;
  createdAt: number;
  blob?: Blob;
  blobBase64?: string;
  thumbnailBase64?: string;
  thumbnailUrl?: string;
  isOriginOnly?: boolean;
  originDeviceId?: string;
  originDevice?: string;
  status?: AttachmentTransferStatus;
  hasOriginal?: boolean;
}

export interface StoredAttachmentMeta {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string; // base64 or blob URL for images & downloads
  thumbnailUrl?: string; // lightweight compressed thumbnail for zero-cloud preview
  isOriginOnly?: boolean; // true if full media was omitted to save storage/bandwidth
  originDeviceId?: string; // originating device ID
  originDevice?: string; // backwards compatibility alias
  status?: AttachmentTransferStatus;
  hasOriginal?: boolean;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  html: string;
  points?: string;
  category: string;
  tags?: string;
  color?: string;
  pinned?: boolean;
  date: string;
  goalId?: string | null;
  attachments?: string[];
  createdAt: number;
  updatedAt: number;
  sync?: SyncMeta;
}

export interface JournalEntry {
  id: string;
  title: string;
  text: string;
  html: string;
  date: string;
  color?: string;
  mood?: string;
  goalId?: string | null;
  attachments?: string[];
  createdAt: number;
  updatedAt: number;
  sync?: SyncMeta;
}

export interface FinanceAccount {
  id: string;
  name: string;
  type: 'bank' | 'cash' | 'wallet' | 'crypto';
  balance: number;
  openingBalance: number;
  accountNumber?: string;
  createdAt?: number;
  updatedAt?: number;
  sync?: SyncMeta;
}

export type FinanceType = 'income' | 'expense' | 'transfer' | 'loan' | 'repayment' | 'investment' | 'savings';

export interface FinanceTransaction {
  id: string;
  type: FinanceType;
  amount: number;
  principal?: number;
  interest?: number;
  category: string;
  date: string;
  note?: string;
  accountId?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  goalId?: string | null;
  linkedLoanId?: string | null;
  linkedLoanPaymentId?: string | null;
  linkedInvestmentId?: string | null;
  linkedSavingsPlanId?: string | null;
  linkedReceiptId?: string | null;
  fileName?: string;
  fileData?: string;
  fileSize?: string;
  fileType?: string;
  attachments?: string[];
  ledgerOnly?: boolean;
  createdAt: number;
  updatedAt?: number;
  sync?: SyncMeta;
}

export interface Loan {
  id: string;
  name: string;
  principal: number;
  rate: number;
  tenure: number;
  dueDay: number;
  outstanding: number;
  goalId?: string | null;
  createdAt: number;
  updatedAt?: number;
  sync?: SyncMeta;
}

export interface LoanPayment {
  id: string;
  loanId: string;
  loanName: string;
  amount: number;
  principal: number;
  interest: number;
  date: string;
  accountId?: string | null;
  createdAt: number;
}

export interface Investment {
  id: string;
  name: string;
  amount: number;
  currentValue: number;
  date: string;
  accountId?: string | null;
  goalId?: string | null;
  createdAt: number;
  updatedAt: number;
  sync?: SyncMeta;
}

export interface SavingsPlan {
  id: string;
  name: string;
  currentAmount: number;
  targetAmount: number;
  durationMonths: number;
  goalId?: string | null;
  createdAt: number;
  updatedAt?: number;
}

export interface Asset {
  id: string;
  name: string;
  value: number;
  category?: string;
  goalId?: string | null;
  createdAt?: number;
}

export interface Liability {
  id: string;
  name: string;
  amount: number;
  category?: string;
  dueDate?: string;
  goalId?: string | null;
  createdAt?: number;
}

export interface FinancialGoal {
  id: string;
  name: string;
  target: number;
  current: number;
  date?: string;
  createdAt: number;
}

export interface HealthProfile {
  name?: string;
  dob?: string;
  height?: number;
  weight?: number;
  targetWeight?: number;
  bloodGroup?: string;
  updatedAt?: number;
}

export interface HealthMeasurement {
  id: string;
  date: string;
  weight?: number;
  steps?: number;
  exercise?: string;
  duration?: number;
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
  amount: number; // in ml
  createdAt: number;
}

export interface NutritionRecord {
  id: string;
  date: string;
  calories?: number;
  note?: string;
  createdAt: number;
}

export interface HealthAppointment {
  id: string;
  date: string;
  title: string;
  doctor?: string;
  createdAt: number;
}

export interface HealthNote {
  id: string;
  date: string;
  text: string;
  createdAt: number;
}

export interface WorkProject {
  id: string;
  name: string;
  client?: string;
  due?: string;
  status: string;
  progress?: number;
  goalId?: string | null;
  createdAt: number;
  updatedAt?: number;
}

export interface LearningItem {
  id: string;
  title: string;
  type: string;
  progress: number;
  targetDate?: string;
  goalId?: string | null;
  createdAt: number;
  updatedAt?: number;
}

export interface Meeting {
  id: string;
  date: string;
  title: string;
  people?: string;
  note?: string;
  createdAt: number;
}

export interface Person {
  id: string;
  name: string;
  relationship?: string;
  contact?: string;
  importantDate?: string;
  note?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface Interaction {
  id: string;
  personId: string;
  date: string;
  text: string;
  createdAt: number;
}

export interface ValueItem {
  id: string;
  title: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface SpiritualPractice {
  id: string;
  name: string;
  frequency: string;
  linkedHabitId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Commitment {
  id: string;
  text: string;
  createdAt: number;
}

export interface ThingItem {
  id: string;
  name: string;
  category: string;
  value: number;
  note?: string;
  fileName?: string;
  fileData?: string;
  fileSize?: string;
  fileType?: string;
  attachments?: string[];
  createdAt: number;
  updatedAt?: number;
}

export interface DocumentItem {
  id: string;
  title: string;
  type: string;
  reference?: string;
  date?: string;
  note?: string;
  fileName?: string;
  fileData?: string;
  fileSize?: string;
  fileType?: string;
  attachments?: string[];
  createdAt: number;
  updatedAt?: number;
}

export interface WarrantyItem {
  id: string;
  title: string;
  expiry?: string;
  note?: string;
  fileName?: string;
  fileData?: string;
  fileSize?: string;
  fileType?: string;
  attachments?: string[];
  createdAt: number;
  updatedAt?: number;
}

export interface ReceiptItem {
  id: string;
  title: string;
  date?: string;
  amount?: number;
  note?: string;
  fileName?: string;
  fileData?: string;
  fileSize?: string;
  fileType?: string;
  attachments?: string[];
  linkedTransactionId?: string | null;
  createdAt: number;
  updatedAt?: number;
}

export interface CertificateItem {
  id: string;
  title: string;
  expiry?: string;
  note?: string;
  issuer?: string;
  fileName?: string;
  fileData?: string;
  fileSize?: string;
  fileType?: string;
  attachments?: string[];
  createdAt: number;
  updatedAt?: number;
}

export interface ReminderItem {
  id: string;
  title: string;
  dueAt: string;
  repeatRule: 'none' | 'daily' | 'weekly' | 'monthly';
  status: 'open' | 'done';
  linkedType?: string | null;
  linkedId?: string | null;
  lastNotifiedAt?: number;
  alarmEnabled?: boolean;
  ringtone?: string;
  createdAt: number;
  updatedAt: number;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message?: string;
  dueAt?: string;
  createdAt: number;
  read?: boolean;
}

export interface AchievementItem {
  id: string;
  title: string;
  unlockedAt: number;
}

export interface CalcHistoryItem {
  id: string;
  tool: string;
  args: any[];
  result: string;
  createdAt: number;
}

export interface SyncMeta {
  deviceId: string;
  version: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export interface MentorRule {
  id: string;
  title: string;
  text: string;
  status?: string;
  createdAt?: number;
}

export interface MentorQuote {
  id: string;
  quote: string;
  author?: string;
  note?: string;
  createdAt?: number;
}

export interface CapitalStrategy {
  id: string;
  title: string;
  target?: number;
  action?: string;
  status?: string;
  note?: string;
  createdAt?: number;
}

export interface CapitalPosition {
  id: string;
  type: string;
  amount: number;
  date?: string;
  note?: string;
  createdAt?: number;
}

export interface CapitalRecord {
  id: string;
  title: string;
  amount: number;
  date?: string;
  status?: string;
  note?: string;
  createdAt?: number;
}

export interface WorkResponsibility {
  id: string;
  title: string;
  projectId?: string | null;
  status: string;
  priority: string;
  dueDate?: string;
  note?: string;
  createdAt?: number;
}

export interface Skill {
  id: string;
  name: string;
  level?: string;
  targetLevel?: string;
  progress?: number;
  goalId?: string | null;
  targetDate?: string;
  note?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface Course {
  id: string;
  title: string;
  provider?: string;
  progress: number;
  startDate?: string;
  endDate?: string;
  note?: string;
  createdAt?: number;
}

export interface LearningProgress {
  id: string;
  itemId?: string;
  date: string;
  progress: number;
  note?: string;
  createdAt?: number;
}

export interface Relationship {
  id: string;
  personId: string;
  type: string;
  status?: string;
  note?: string;
  createdAt?: number;
}

export interface ImportantDate {
  id: string;
  personId?: string;
  title: string;
  date: string;
  note?: string;
  createdAt?: number;
}

export interface RelationshipReminder {
  id: string;
  personId?: string;
  title: string;
  dueAt: string;
  repeatRule?: string;
  status: string;
  createdAt?: number;
}

export interface PrincipleItem {
  id: string;
  title: string;
  text?: string;
  description?: string;
  createdAt?: number;
}

export interface DocumentCollection {
  id: string;
  title: string;
  description?: string;
  createdAt?: number;
}

export interface ImportantRecordItem {
  id: string;
  title: string;
  date?: string;
  note?: string;
  fileName?: string;
  fileData?: string;
  fileSize?: string;
  fileType?: string;
  attachments?: string[];
  createdAt?: number;
  updatedAt?: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  googleSub?: string;
  role?: string;
  avatarColor?: string;
  avatarChar?: string;
  avatarUrl?: string;
  authType?: 'local' | 'google';
  passwordHash?: string;
  passwordSalt?: string;
  passwordHint?: string;
  recoveryQuestion?: string;
  recoveryAnswerHash?: string;
  recoveryAnswerSalt?: string;
  isCurrent?: boolean;
  createdAt: number;
}

export interface AppState {
  profileId: string;
  profiles: UserProfile[];
  currentUser?: {
    email?: string;
    name?: string;
    provider?: 'local' | 'google';
    avatarUrl?: string;
  };
  themeMode: 'light' | 'dark';
  accentColor: string;
  notificationsEnabled: boolean;
  storageEstimate?: {
    usage: number;
    quota: number;
    percent: number;
    level: string;
    updatedAt: number;
  };
  dailyPlanner?: DailyPlanner;
  mentor?: MentorProfile;
  focusRuntime?: FocusRuntime | null;
  noteCategories: string[];
  calcFavorites: string[];
}

export interface CloudSyncDevice {
  id: string;
  device_name: string;
  device_type: string;
  last_seen_at: number;
  created_at: number;
}

export interface SyncChangeRecord {
  changeId: string;
  deviceId: string;
  version: number;
  storeName: string;
  recordId: string;
  operation: 'upsert' | 'delete';
  payload?: any;
  updatedAt?: string;
  timestamp: number;
}

export interface CloudBackupMetadata {
  id: string;
  device_id: string;
  device_name: string;
  r2_key?: string;
  driveFileId?: string;
  size_bytes: number;
  record_count: number;
  checksum: string;
  created_at: number;
}

export interface CloudSyncStatusInfo {
  ok: boolean;
  identityId?: string;
  profileName?: string;
  currentVersion: number;
  totalChanges: number;
  devices: CloudSyncDevice[];
  pendingQueueCount: number;
  lastSyncedAt?: number;
  isOnline: boolean;
  isSyncing: boolean;
  error?: string;
}

export interface ManualUpdateBundle {
  app: 'Om-LifeOS';
  format: 'om-manual-bundle-v1';
  bundleType: 'incremental' | 'full';
  profileId: string;
  profileName: string;
  deviceId: string;
  deviceName?: string;
  exportedAt: string;
  checkpointFrom?: number;
  checkpointTo: number;
  recordCount: number;
  includeFullMedia: boolean;
  totalBytesEstimate?: number;
  mediaBytesEstimate?: number;
  summary: Record<string, number>;
  entities: Record<string, any[]>;
  deletions?: { storeName: string; recordId: string; deletedAt: number }[];
}

export interface BundleConflictItem {
  storeName: string;
  id: string;
  title: string;
  localUpdatedAt: number;
  remoteUpdatedAt: number;
  localPreview?: string;
  remotePreview?: string;
}

export interface BundleDiffInspection {
  valid: boolean;
  error?: string;
  bundle: ManualUpdateBundle;
  targetProfileId: string;
  totalIncoming: number;
  addedCount: number;
  updatedCount: number;
  conflictsCount: number;
  skippedCount: number;
  storeCounts: Record<string, { added: number; updated: number; conflicts: number; skipped: number }>;
  conflicts: BundleConflictItem[];
}

export interface ApplyBundleResult {
  success: boolean;
  appliedCount: number;
  addedCount: number;
  updatedCount: number;
  keptBothCount: number;
  skippedCount: number;
  error?: string;
}

export interface RecycleBinItem {
  id: string; // `${storeName}:${recordId}`
  storeName: string;
  recordId: string;
  profileId: string;
  title: string;
  subtitle?: string;
  moduleLabel?: string;
  storeLabel?: string;
  deletedAt: number;
  data: any;
  contentSignature?: string;
  payload?: any;
}


