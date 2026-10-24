import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import {
  NavModule, AppState, Task, Goal, Milestone, Strategy, KPI, Mission,
  Routine, Habit, HabitLog, FinanceAccount, FinanceTransaction, Loan,
  LoanPayment, Investment, SavingsPlan, Asset, Liability, FinancialGoal,
  InvestmentActivity, CashFlowSchedule,
  Note, JournalEntry, FocusSession, SleepRecord, WaterRecord, NutritionRecord,
  HealthMeasurement, HealthAppointment, HealthNote, HealthProfile, WorkProject, LearningItem,
  Meeting, Person, Interaction, ValueItem, SpiritualPractice, Commitment,
  ThingItem, DocumentItem, WarrantyItem, ReceiptItem, CertificateItem,
  ImportantRecordItem, ReminderItem, NotificationItem, AchievementItem,
  CalcHistoryItem, Skill, Course, WorkResponsibility
} from './types';
import { ensureDefaultProfiles, storage } from './lib/storage';
import { getGoogleWorkspaceProfileId, GoogleUser, signInWithGoogle } from './lib/googleDriveSync';
import { getLocalDateString } from './lib/dateUtils';
import watermarkUrl from './assets/om-lifeos-watermark.png';
import { LockKeyhole, ShieldCheck } from 'lucide-react';

const IS_GUEST_MODE = import.meta.env.DEV || import.meta.env.MODE === 'local-test';
const GUEST_PROFILE_ID = 'om-master-profile';

// Components
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { QuickCaptureModal } from './components/QuickCaptureModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { BsDateModal } from './components/BsDateModal';
import { AlarmTriggerModal } from './components/AlarmTriggerModal';
import { VoiceStudioWidget } from './components/VoiceStudioWidget';
import { OfflineIndicator } from './components/OfflineIndicator';
import { alarmService, TriggeredAlarmData } from './lib/alarmService';
import { alarmAudio } from './lib/alarmAudio';
import { isBackgroundRemindersEnabled, syncBackgroundReminders } from './lib/pushReminderService';
import { lazyWithRetry } from './lib/lazyWithRetry';
import { syncGoalProgressFromTasks, syncGoalProgressFromHabits, recalculateAllGoalsProgress, computeGoalAggregateBreakdown } from './lib/goalTaskSync';
import { soundEngine } from './lib/soundEngine';

// Views
import DashboardView from './views/DashboardView';
const TasksView = lazyWithRetry(() => import('./views/TasksView').then(m => ({ default: m.TasksView })));
const RoutineView = lazyWithRetry(() => import('./views/RoutineView').then(m => ({ default: m.RoutineView })));
const GoalsView = lazyWithRetry(() => import('./views/GoalsView').then(m => ({ default: m.GoalsView })));
const FocusView = lazyWithRetry(() => import('./views/FocusView').then(m => ({ default: m.FocusView })));
const NotesView = lazyWithRetry(() => import('./views/NotesView').then(m => ({ default: m.NotesView })));
const JournalView = lazyWithRetry(() => import('./views/JournalView').then(m => ({ default: m.JournalView })));
const CalculatorView = lazyWithRetry(() => import('./views/CalculatorView').then(m => ({ default: m.CalculatorView })));
const FinanceView = lazyWithRetry(() => import('./views/FinanceView').then(m => ({ default: m.FinanceView })));
const HealthView = lazyWithRetry(() => import('./views/HealthView').then(m => ({ default: m.HealthView })));
const WorkView = lazyWithRetry(() => import('./views/WorkView').then(m => ({ default: m.WorkView })));
const PeopleView = lazyWithRetry(() => import('./views/PeopleView').then(m => ({ default: m.PeopleView })));
const SpiritualView = lazyWithRetry(() => import('./views/SpiritualView').then(m => ({ default: m.SpiritualView })));
const ThingsView = lazyWithRetry(() => import('./views/ThingsView').then(m => ({ default: m.ThingsView })));
const RecycleBinView = lazyWithRetry(() => import('./views/RecycleBinView').then(m => ({ default: m.RecycleBinView })));
const SettingsView = lazyWithRetry(() => import('./views/SettingsView').then(m => ({ default: m.SettingsView })));


const ViewFallback: React.FC = () => (
  <div role="status" aria-live="polite" className="flex items-center justify-center py-24">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 dark:border-slate-700 dark:border-t-indigo-400" />
    <span className="sr-only">Loading…</span>
  </div>
);

export default function App() {
  return <LifeOSApp />;
}

function LifeOSApp() {
  const [activeModule, setActiveModule] = useState<NavModule>('dashboard');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('om_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {}
    return 'light';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [quickCaptureType, setQuickCaptureType] = useState<string>('task');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBsModalOpen, setIsBsModalOpen] = useState(false);
  const [isVoiceStudioOpen, setIsVoiceStudioOpen] = useState(false);
  const [activeTriggeredAlarm, setActiveTriggeredAlarm] = useState<TriggeredAlarmData | null>(null);

  // Entities state
  const [appSettings, setAppSettings] = useState<AppState | undefined>();
  const [activeProfileId, setActiveProfileId] = useState<string | null>(
    IS_GUEST_MODE ? GUEST_PROFILE_ID : null
  );
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);
  const [isGoogleLocked, setIsGoogleLocked] = useState(!IS_GUEST_MODE);
  const [isUnlockingGoogle, setIsUnlockingGoogle] = useState(false);
  const [googleUnlockError, setGoogleUnlockError] = useState<string | null>(null);
  const activeProfileIdRef = useRef<string | null>(activeProfileId);
  const loadGenerationRef = useRef(0);
  useEffect(() => {
    activeProfileIdRef.current = activeProfileId;
  }, [activeProfileId]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);

  const [financeAccounts, setFinanceAccounts] = useState<FinanceAccount[]>([]);
  const [financeTransactions, setFinanceTransactions] = useState<FinanceTransaction[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loanPayments, setLoanPayments] = useState<LoanPayment[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [investmentActivities, setInvestmentActivities] = useState<InvestmentActivity[]>([]);
  const [cashFlowSchedules, setCashFlowSchedules] = useState<CashFlowSchedule[]>([]);
  const [savingsPlans, setSavingsPlans] = useState<SavingsPlan[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [financialGoals, setFinancialGoals] = useState<FinancialGoal[]>([]);

  const [notes, setNotes] = useState<Note[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);

  const [healthMeasurements, setHealthMeasurements] = useState<HealthMeasurement[]>([]);
  const [healthProfile, setHealthProfile] = useState<HealthProfile | undefined>();
  const [sleepRecords, setSleepRecords] = useState<SleepRecord[]>([]);
  const [waterRecords, setWaterRecords] = useState<WaterRecord[]>([]);
  const [nutritionRecords, setNutritionRecords] = useState<NutritionRecord[]>([]);
  const [appointments, setAppointments] = useState<HealthAppointment[]>([]);
  const [healthNotes, setHealthNotes] = useState<HealthNote[]>([]);

  const [workProjects, setWorkProjects] = useState<WorkProject[]>([]);
  const [workResponsibilities, setWorkResponsibilities] = useState<WorkResponsibility[]>([]);
  const [learningItems, setLearningItems] = useState<LearningItem[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  const [people, setPeople] = useState<Person[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);

  const [values, setValues] = useState<ValueItem[]>([]);
  const [practices, setPractices] = useState<SpiritualPractice[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);

  const [things, setThings] = useState<ThingItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [warranties, setWarranties] = useState<WarrantyItem[]>([]);
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [importantRecords, setImportantRecords] = useState<ImportantRecordItem[]>([]);

  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [calcHistory, setCalcHistory] = useState<CalcHistoryItem[]>([]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 2500);
  }, []);

  const loadAllData = useCallback(async (overrideProfileId?: string) => {
    const loadGeneration = ++loadGenerationRef.current;
    try {
      const requestedProfileId = overrideProfileId || activeProfileIdRef.current || storage.getActiveProfileId();
      if (requestedProfileId) storage.setActiveProfile(requestedProfileId);
      let settingsData = await storage.getSingleton<AppState>('appSettings', requestedProfileId || undefined);
      if (!settingsData && IS_GUEST_MODE && requestedProfileId === GUEST_PROFILE_ID) {
        settingsData = await ensureDefaultProfiles();
      }
      const activeId = requestedProfileId || settingsData?.profileId;
      if (!activeId) return;
      storage.setActiveProfile(activeId);
      const isCurrentLoad = () =>
        loadGeneration === loadGenerationRef.current && activeProfileIdRef.current === activeId;
      const healthProfileData = await storage.getSingleton<HealthProfile>('healthProfile', activeId) || undefined;
      await storage.ensureProfileOwnership(activeId);
      await storage.reconcileLinkedReminders(activeId);
      const getAllForProfile = <T,>(storeName: string) => storage.getAll<T>(storeName, activeId);
      const [
        tasksData,
        goalsData,
        milestonesData,
        strategiesData,
        kpisData,
        missionsData,
        routinesData,
        habitsData,
        habitLogsData,
        acctsData,
        txData,
        loansData,
        loanPaymentsData,
        investmentsData,
        investmentActivitiesData,
        cashFlowSchedulesData,
        savingsData,
        assetsData,
        liabilitiesData,
        fgData,
        notesData,
        journalData,
        focusData,
        measData,
        sleepData,
        waterData,
        nutriData,
        apptsData,
        hNotesData,
        projData,
        respData,
        learnData,
        skillsData,
        coursesData,
        meetData,
        peopleData,
        interData,
        valData,
        pracData,
        commData,
        thingData,
        docData,
        warData,
        recData,
        certData,
        irData,
        remData,
        notifData,
        achData,
        calcData
      ] = await Promise.all([
        getAllForProfile<Task>('tasks'),
        getAllForProfile<Goal>('goals'),
        getAllForProfile<Milestone>('milestones'),
        getAllForProfile<Strategy>('strategies'),
        getAllForProfile<KPI>('kpis'),
        getAllForProfile<Mission>('missions'),
        getAllForProfile<Routine>('routines'),
        getAllForProfile<Habit>('habits'),
        getAllForProfile<HabitLog>('habitLogs'),
        getAllForProfile<FinanceAccount>('financeAccounts'),
        getAllForProfile<FinanceTransaction>('finance'),
        getAllForProfile<Loan>('loans'),
        getAllForProfile<LoanPayment>('loanPayments'),
        getAllForProfile<Investment>('investments'),
        getAllForProfile<InvestmentActivity>('investmentActivities'),
        getAllForProfile<CashFlowSchedule>('cashFlowSchedules'),
        getAllForProfile<SavingsPlan>('savingsPlans'),
        getAllForProfile<Asset>('assets'),
        getAllForProfile<Liability>('liabilities'),
        getAllForProfile<FinancialGoal>('financialGoals'),
        getAllForProfile<Note>('notes'),
        getAllForProfile<JournalEntry>('journal'),
        getAllForProfile<FocusSession>('focus'),
        getAllForProfile<HealthMeasurement>('healthMeasurements'),
        getAllForProfile<SleepRecord>('sleepRecords'),
        getAllForProfile<WaterRecord>('waterRecords'),
        getAllForProfile<NutritionRecord>('nutritionRecords'),
        getAllForProfile<HealthAppointment>('healthAppointments'),
        getAllForProfile<HealthNote>('healthNotes'),
        getAllForProfile<WorkProject>('workProjects'),
        getAllForProfile<WorkResponsibility>('workResponsibilities'),
        getAllForProfile<LearningItem>('learningItems'),
        getAllForProfile<Skill>('skills'),
        getAllForProfile<Course>('courses'),
        getAllForProfile<Meeting>('meetings'),
        getAllForProfile<Person>('people'),
        getAllForProfile<Interaction>('interactions'),
        getAllForProfile<ValueItem>('values'),
        getAllForProfile<SpiritualPractice>('spiritualPractices'),
        getAllForProfile<Commitment>('commitments'),
        getAllForProfile<ThingItem>('things'),
        getAllForProfile<DocumentItem>('documents'),
        getAllForProfile<WarrantyItem>('warranties'),
        getAllForProfile<ReceiptItem>('receipts'),
        getAllForProfile<CertificateItem>('certificates'),
        getAllForProfile<ImportantRecordItem>('importantRecords'),
        getAllForProfile<ReminderItem>('reminders'),
        getAllForProfile<NotificationItem>('notifications'),
        getAllForProfile<AchievementItem>('achievements'),
        getAllForProfile<CalcHistoryItem>('calcHistory')
      ]);

      if (!isCurrentLoad()) return;
      if (settingsData) {
        setAppSettings(settingsData);
        if (settingsData.themeMode) {
          setTheme(settingsData.themeMode);
        }
      }

      setTasks([...tasksData]);
      setGoals([...goalsData]);
      setMilestones([...milestonesData]);
      setStrategies([...strategiesData]);
      setKpis([...kpisData]);
      setMissions([...missionsData]);
      setRoutines([...routinesData]);
      setHabits([...habitsData]);
      setHabitLogs([...habitLogsData]);
      setFinanceAccounts([...acctsData]);
      setFinanceTransactions([...txData]);
      setLoans([...loansData]);
      setLoanPayments([...loanPaymentsData]);
      setInvestments([...investmentsData]);
      setInvestmentActivities([...investmentActivitiesData]);
      setCashFlowSchedules([...cashFlowSchedulesData]);
      setSavingsPlans([...savingsData]);
      setAssets([...assetsData]);
      setLiabilities([...liabilitiesData]);
      setFinancialGoals([...fgData]);
      setNotes([...notesData]);
      setJournal([...journalData]);
      setFocusSessions([...focusData]);
      setHealthMeasurements([...measData]);
      setHealthProfile(healthProfileData);
      setSleepRecords([...sleepData]);
      setWaterRecords([...waterData]);
      setNutritionRecords([...nutriData]);
      setAppointments([...apptsData]);
      setHealthNotes([...hNotesData]);
      setWorkProjects([...projData]);
      setWorkResponsibilities([...respData]);
      setLearningItems([...learnData]);
      setSkills([...skillsData]);
      setCourses([...coursesData]);
      setMeetings([...meetData]);
      setPeople([...peopleData]);
      setInteractions([...interData]);
      setValues([...valData]);
      setPractices([...pracData]);
      setCommitments([...commData]);
      setThings([...thingData]);
      setDocuments([...docData]);
      setWarranties([...warData]);
      setReceipts([...recData]);
      setCertificates([...certData]);
      setImportantRecords([...irData]);
      const activeTaskIds = new Set(tasksData.map(task => task.id));
      const activePeopleIds = new Set(peopleData.map(person => person.id));
      setReminders(remData.filter(reminder => {
        if (reminder.linkedType === 'task') {
          return Boolean(reminder.linkedId && activeTaskIds.has(reminder.linkedId));
        }
        if (reminder.linkedType === 'contact') {
          return Boolean(reminder.linkedId && activePeopleIds.has(reminder.linkedId));
        }
        return true;
      }));
      setNotifications([...notifData]);
      setAchievements([...achData]);
      setCalcHistory([...calcData]);
      // Auto-reconcile goal progress against actual linked items in database to fix stale/legacy 100% false progress
      recalculateAllGoalsProgress().then(freshGoals => {
        if (isCurrentLoad() && freshGoals && freshGoals.length > 0) {
          setGoals([...freshGoals]);
        }
      }).catch(err => {
        console.warn('Goal progress auto-reconcile error:', err);
      });
    } catch (err) {
      console.error('Failed to load initial data', err);
    }
  }, []);

  // Keep global alarm notifications available independently of the login screen.
  useEffect(() => {
    alarmService.onAlarmTrigger((alarmData) => {
      setActiveTriggeredAlarm(alarmData);
    });
  }, []);

  useEffect(() => {
    const uid = googleUser?.uid;
    if (!uid || !activeProfileId || !isBackgroundRemindersEnabled(uid, activeProfileId)) return;

    const sync = () => {
      void syncBackgroundReminders(uid, activeProfileId).catch(error => {
        console.error('Background alarm sync failed:', error);
      });
    };
    const unsubscribe = storage.onStorageChange(store => {
      if (store === 'reminders') sync();
    });
    window.addEventListener('om_focus_alarms_changed', sync);
    sync();

    return () => {
      unsubscribe();
      window.removeEventListener('om_focus_alarms_changed', sync);
    };
  }, [googleUser?.uid, activeProfileId]);

  const handleGoogleAccountChange = useCallback(async (user: GoogleUser | null) => {
    if (!user) {
      setGoogleUser(null);
      alarmService.clearActiveAlarm();
      setActiveTriggeredAlarm(null);
      setAppSettings(undefined);
      const guestProfileId = IS_GUEST_MODE ? GUEST_PROFILE_ID : null;
      storage.setActiveProfile(guestProfileId);
      activeProfileIdRef.current = guestProfileId;
      setActiveProfileId(guestProfileId);
      setIsGoogleLocked(!IS_GUEST_MODE);
      setIsMobileMenuOpen(false);
      setActiveModule('dashboard');
      return;
    }

    setGoogleUser(user);
    const nextProfileId = getGoogleWorkspaceProfileId(user);
    alarmService.clearActiveAlarm();
    setActiveTriggeredAlarm(null);
    setAppSettings(undefined);
    storage.setActiveProfile(nextProfileId);
    activeProfileIdRef.current = nextProfileId;
    setActiveProfileId(nextProfileId);
    setActiveModule('dashboard');
    setIsMobileMenuOpen(false);
    window.dispatchEvent(new CustomEvent('om_custom_ringtone_changed'));

    const now = Date.now();
    const profile = {
        id: nextProfileId,
        name: user.displayName || user.email || 'Google Account',
        email: user.email || undefined,
        googleSub: user.uid,
        role: 'Personal',
        authType: 'google' as const,
        avatarUrl: user.photoURL || undefined,
        avatarChar: (user.displayName || user.email || 'G').charAt(0).toUpperCase(),
        avatarColor: '#6366f1',
        isCurrent: true,
        createdAt: now
    };
    const currentSettings = await storage.getSingleton<AppState>('appSettings');
    const nextSettings: AppState = currentSettings
        ? {
            ...currentSettings,
            profileId: nextProfileId,
            profiles: (currentSettings.profiles || []).map(existing => ({
              ...existing,
              isCurrent: existing.id === nextProfileId
            }))
          }
        : {
            profileId: nextProfileId,
            profiles: [profile],
            currentUser: {
              name: profile.name,
              email: profile.email,
              provider: 'google',
              avatarUrl: profile.avatarUrl
            },
            themeMode: 'light',
            accentColor: '#6366f1',
            notificationsEnabled: true,
            noteCategories: ['General', 'Strategy', 'Projects', 'Finance', 'Ideas'],
            calcFavorites: ['EMI / Loan', 'SIP / Investment', 'Date Difference']
          };
    if (currentSettings && !nextSettings.profiles.some(existing => existing.id === nextProfileId)) {
      nextSettings.profiles = [...nextSettings.profiles, profile];
    }
    nextSettings.currentUser = {
      name: profile.name,
      email: profile.email,
      provider: 'google',
      avatarUrl: profile.avatarUrl
    };
    await storage.setSingleton('appSettings', nextSettings);

    await loadAllData(nextProfileId);
  }, [loadAllData]);

  const handleGoogleUnlock = async () => {
    setIsUnlockingGoogle(true);
    setGoogleUnlockError(null);
    try {
      const result = await signInWithGoogle();
      await handleGoogleAccountChange(result.user);
      setIsGoogleLocked(false);
    } catch (err) {
      console.error('Google unlock failed:', err);
      setGoogleUnlockError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.');
    } finally {
      setIsUnlockingGoogle(false);
    }
  };

  // Load all data whenever activeProfileId updates
  useEffect(() => {
    if (activeProfileId) {
      loadAllData(activeProfileId);
    }
  }, [activeProfileId, loadAllData]);

  // Sync theme with HTML root class, localStorage, and accent color
  useEffect(() => {
    try {
      localStorage.setItem('om_theme', theme);
    } catch {}
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-lifeos-mode', 'dark');
      document.documentElement.style.backgroundColor = '#0B0F19';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-lifeos-mode', 'light');
      document.documentElement.style.backgroundColor = '#F8FAFC';
    }
    const brandColor = appSettings?.accentColor || '#6366f1';
    document.documentElement.style.setProperty('--color-brand', brandColor);
  }, [theme, appSettings?.accentColor]);

  // Keyboard Shortcuts (⌘K for search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Multi-tab cross-device broadcast listener & storage event listener
  useEffect(() => {
    const channel = storage.getChannel();
    const refreshActions = new Set([
      'delete', 'recycle', 'clear', 'empty', 'restore', 'purge',
      'restoreWorkspaceBackup', 'importFullBackup', 'purgeDefaultData'
    ]);
    const unsub = storage.onStorageChange((_store, action) => {
      if (action && refreshActions.has(action) && activeProfileIdRef.current) {
        loadAllData(activeProfileIdRef.current);
      }
    });

    if (!channel) return unsub;

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.sourceDevice !== storage.deviceId && activeProfileId) {
        loadAllData();
      }
    };
    channel.addEventListener('message', handleMessage);
    return () => {
      unsub();
      channel.removeEventListener('message', handleMessage);
    };
  }, [loadAllData, activeProfileId]);




  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    try {
      localStorage.setItem('om_theme', newTheme);
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.style.backgroundColor = '#0B0F19';
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.backgroundColor = '#F8FAFC';
      }
    } catch {}
    const settingsObj = (await storage.getSingleton<AppState>('appSettings')) || {
      profileId: 'default',
      profiles: [],
      themeMode: newTheme,
      accentColor: '#5d57c9',
      notificationsEnabled: true,
      noteCategories: ['General'],
      calcFavorites: []
    };
    settingsObj.themeMode = newTheme;
    await storage.setSingleton('appSettings', settingsObj);
  };

  const handleToggleTask = async (id: string) => {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    const nextDone = !t.done;
    if (nextDone) {
      soundEngine.play('taskComplete');
    } else {
      soundEngine.play('taskUncheck');
    }
    const updated: Task = {
      ...t,
      done: nextDone,
      status: nextDone ? 'done' : 'open',
      updatedAt: Date.now()
    };
    await storage.put('tasks', updated);
    if (t.goalId) {
      await syncGoalProgressFromTasks(t.goalId, t.id, nextDone);
    }
    loadAllData();
  };

  const handleLogHabit = async (habitId: string, occurrence: number | 'all' = 0) => {
    const today = getLocalDateString();
    const key = `${habitId}|${today}|${occurrence}`;
    const existing = habitLogs.find(l => l.key === key);

    if (existing) {
      soundEngine.play('habitUncheck');
      await storage.delete('habitLogs', existing.id);
    } else {
      soundEngine.play('habitComplete');
      const newLog: HabitLog = {
        id: (await import('./lib/storage')).generateUUID(),
        key,
        habitId,
        date: today,
        occurrence,
        createdAt: Date.now()
      };
      await storage.put('habitLogs', newLog);
    }
    const targetHabit = habits.find(h => h.id === habitId);
    if (targetHabit?.goalId) {
      await syncGoalProgressFromHabits(targetHabit.goalId, targetHabit.id);
    }
    loadAllData();
  };

  const openTasksCount = tasks.filter(t => !t.done).length;
  const categoriesList = appSettings?.noteCategories || ['General', 'Strategy', 'Projects', 'Finance', 'Ideas'];

  if (isGoogleLocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 text-slate-900 dark:bg-[#0B0F19] dark:text-slate-100">
        <section className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
            <LockKeyhole className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-xl font-bold">Om-LifeOS is locked</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Sign in with your Google account to unlock your workspace.
          </p>
          <button
            type="button"
            onClick={handleGoogleUnlock}
            disabled={isUnlockingGoogle}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4" />
            {isUnlockingGoogle ? 'Signing in…' : 'Unlock with Google'}
          </button>
          {googleUnlockError && (
            <p role="alert" className="mt-4 text-left text-xs font-medium text-rose-600 dark:text-rose-400">
              {googleUnlockError}
            </p>
          )}
          <p className="mt-5 text-[11px] text-slate-400">
            Your workspace remains locked until Google sign-in succeeds.
          </p>
        </section>
      </div>
    );
  }

  if (!appSettings || !activeProfileId) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F19] flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm font-medium">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 font-serif font-bold text-white text-xs">
            ॐ
          </div>
          <span>Loading Om-LifeOS…</span>
        </div>
      </div>
    );
  }

  return (
    <div
      data-app-root="true"
      className="flex min-h-screen flex-col font-sans text-slate-900 selection:bg-indigo-500 selection:text-white dark:text-slate-100 bg-[#F8FAFC] dark:bg-[#0B0F19]"
    >
      {/* Top Bar */}
      <Header
        activeModule={activeModule}
        onNavigate={setActiveModule}
        onOpenQuickCapture={(type = 'task') => {
          setQuickCaptureType(type);
          setIsQuickCaptureOpen(true);
        }}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenBsModal={() => setIsBsModalOpen(true)}
        onOpenVoiceStudio={() => setIsVoiceStudioOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        onShowToast={showToast}
      />

      <div className="flex flex-1">
        {/* Sidebar */}
        <Sidebar
          activeModule={activeModule}
          onNavigate={setActiveModule}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          openTasksCount={openTasksCount}
          remindersCount={reminders.filter(r => r.status !== 'done').length}
          onToast={showToast}
          onDataRestored={loadAllData}
          workspaceProfileId={activeProfileId || 'om-master-profile'}
          googleUser={googleUser}
          onGoogleAccountChange={handleGoogleAccountChange}
        />

        {/* Main Content Viewport - Responsive across Mobile, Tablet, Laptop, and Desktop */}
        <main className="app-watermark relative isolate flex-1 min-w-0 px-3 sm:px-5 lg:px-6 py-4 sm:py-6 pb-28 md:pb-12 w-full">
          <img
            className="app-watermark__image"
            src={watermarkUrl}
            alt=""
            aria-hidden="true"
          />
          <div className="app-watermark__content w-full space-y-6">
            <Suspense fallback={<ViewFallback />}>
            {activeModule === 'dashboard' && (
              <DashboardView
                tasks={tasks}
                goals={goals}
                routines={routines}
                habits={habits}
                habitLogs={habitLogs}
                finance={financeTransactions}
                accounts={financeAccounts}
                notes={notes}
                journal={journal}
                dailyPlanner={appSettings?.dailyPlanner}
                reminders={reminders}
                achievements={achievements}
                onNavigate={setActiveModule}
                onToggleTask={handleToggleTask}
                onLogHabit={handleLogHabit}
                onOpenQuickCapture={type => {
                  setQuickCaptureType(type || 'task');
                  setIsQuickCaptureOpen(true);
                }}
              />
            )}

            {activeModule === 'tasks' && (
              <TasksView
                tasks={tasks}
                goals={goals}
                dailyPlanner={appSettings?.dailyPlanner}
                workProjects={workProjects}
                learningItems={learningItems}
                skills={skills}
                routines={routines}
                habits={habits}
                habitLogs={habitLogs}
                reminders={reminders}
                onRefresh={loadAllData}
                onSuccess={showToast}
              />
            )}

            {activeModule === 'routine' && (
              <RoutineView
                routines={routines}
                habits={habits}
                habitLogs={habitLogs}
                goals={goals}
                tasks={tasks}
                reminders={reminders}
                onRefresh={loadAllData}
                onSuccess={showToast}
              />
            )}

            {activeModule === 'goals' && (
              <GoalsView
                goals={goals}
                milestones={milestones}
                strategies={strategies}
                kpis={kpis}
                missions={missions}
                mentor={appSettings?.mentor}
                accounts={financeAccounts}
                transactions={financeTransactions}
                loans={loans}
                investments={investments}
                savingsPlans={savingsPlans}
                liabilities={liabilities}
                assets={assets}
                tasks={tasks}
                habits={habits}
                habitLogs={habitLogs}
                routines={routines}
                workProjects={workProjects}
                learningItems={learningItems}
                skills={skills}
                notes={notes}
                journal={journal}
                reminders={reminders}
                appointments={appointments}
                healthNotes={healthNotes}
                meetings={meetings}
                people={people}
                values={values}
                practices={practices}
                commitments={commitments}
                focusSessions={focusSessions}
                onRefresh={loadAllData}
                onSuccess={showToast}
              />
            )}

            {activeModule === 'focus' && (
              <FocusView
                sessions={focusSessions}
                tasks={tasks}
                goals={goals}
                routines={routines}
                profileId={activeProfileId || 'om-master-profile'}
                onRefresh={loadAllData}
                onSuccess={showToast}
              />
            )}

            {activeModule === 'notes' && (
              <NotesView
                notes={notes}
                categories={categoriesList}
                goals={goals}
                onRefresh={loadAllData}
                onSuccess={showToast}
              />
            )}

            {activeModule === 'journal' && (
              <JournalView
                journal={journal}
                goals={goals}
                onRefresh={loadAllData}
                onSuccess={showToast}
              />
            )}

            {activeModule === 'calculator' && (
              <CalculatorView
                history={calcHistory}
                favorites={appSettings?.calcFavorites || []}
                onRefresh={loadAllData}
                onSuccess={showToast}
              />
            )}

            {activeModule === 'finance' && (
              <FinanceView
                accounts={financeAccounts}
                transactions={financeTransactions}
                loans={loans}
                loanPayments={loanPayments}
                investments={investments}
                investmentActivities={investmentActivities}
                cashFlowSchedules={cashFlowSchedules}
                savingsPlans={savingsPlans}
                assets={assets}
                liabilities={liabilities}
                financialGoals={financialGoals}
                receipts={receipts}
                goals={goals}
                onNavigate={setActiveModule}
                onRefresh={loadAllData}
                onSuccess={showToast}
                onError={msg => showToast(`⚠️ ${msg}`)}
              />
            )}

            {activeModule === 'health' && (
              <HealthView
                profile={healthProfile}
                measurements={healthMeasurements}
                sleepRecords={sleepRecords}
                waterRecords={waterRecords}
                nutritionRecords={nutritionRecords}
                appointments={appointments}
                healthNotes={healthNotes}
                goals={goals}
                onRefresh={loadAllData}
                onSuccess={showToast}
              />
            )}

            {activeModule === 'work' && (
              <WorkView
                projects={workProjects}
                responsibilities={workResponsibilities}
                learningItems={learningItems}
                skills={skills}
                courses={courses}
                meetings={meetings}
                goals={goals}
                tasks={tasks}
                reminders={reminders}
                onRefresh={loadAllData}
                onSuccess={showToast}
              />
            )}

            {activeModule === 'people' && (
              <PeopleView
                people={people}
                interactions={interactions}
                reminders={reminders}
                onRefresh={loadAllData}
                onSuccess={showToast}
              />
            )}

            {activeModule === 'spiritual' && (
              <SpiritualView
                values={values}
                practices={practices}
                commitments={commitments}
                goals={goals}
                onNavigate={setActiveModule}
                onRefresh={loadAllData}
                onSuccess={showToast}
              />
            )}

            {activeModule === 'things' && (
              <ThingsView
                things={things}
                documents={documents}
                warranties={warranties}
                receipts={receipts}
                financeAccounts={financeAccounts}
                financeTransactions={financeTransactions}
                onNavigate={setActiveModule}
                certificates={certificates}
                importantRecords={importantRecords}
                onRefresh={loadAllData}
                onSuccess={showToast}
                onError={msg => showToast(`⚠️ ${msg}`)}
              />
            )}

            {activeModule === 'recycle_bin' && (
              <RecycleBinView
                profileId={appSettings?.profileId || 'om-master-profile'}
                onRefresh={loadAllData}
                onSuccess={showToast}
                onError={msg => showToast(`⚠️ ${msg}`)}
              />
            )}

            {activeModule === 'settings' && (
              <SettingsView
                settings={appSettings}
                googleUserUid={googleUser?.uid}
                onRefresh={loadAllData}
                onSuccess={showToast}
                onError={msg => showToast(`⚠️ ${msg}`)}
                theme={theme}
                onToggleTheme={toggleTheme}
              />
            )}
            </Suspense>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Thumb Navigation */}
      <MobileBottomNav activeModule={activeModule} onNavigate={setActiveModule} />

      {/* Quick Capture Dialog */}
      <QuickCaptureModal
        isOpen={isQuickCaptureOpen}
        onClose={() => setIsQuickCaptureOpen(false)}
        initialType={quickCaptureType}
        onSuccess={showToast}
        reloadAll={loadAllData}
      />

      {/* Global Search Dialog */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={setActiveModule}
      />

      {/* Nepali Bikram Sambat Date Modal */}
      <BsDateModal
        isOpen={isBsModalOpen}
        onClose={() => setIsBsModalOpen(false)}
      />

      {/* Real-time Global Alarm Trigger Modal */}
      <AlarmTriggerModal
        alarm={activeTriggeredAlarm}
        onDismiss={async () => {
          await alarmService.dismissAlarm();
          setActiveTriggeredAlarm(null);
          loadAllData();
        }}
        onSnooze={async (mins = 5) => {
          await alarmService.snoozeAlarm(mins);
          setActiveTriggeredAlarm(null);
          showToast(`⏰ Alarm snoozed for ${mins} minutes`);
          loadAllData();
        }}
      />

      {/* Global High-Accuracy Voice-to-Text & Text Reading Studio (Hindi & English) */}
      <VoiceStudioWidget
        isOpen={isVoiceStudioOpen}
        onClose={() => setIsVoiceStudioOpen(false)}
        onSuccess={showToast}
        onRefreshNotes={loadAllData}
        onRefreshJournal={loadAllData}
        onRefreshTasks={loadAllData}
      />

      {/* Offline Connectivity Indicator */}
      <OfflineIndicator />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-16 right-4 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-2xl dark:bg-white dark:text-slate-900 animate-in fade-in slide-in-from-bottom-2 sm:bottom-6 sm:right-6">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
