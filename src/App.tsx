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
  ImportantRecordItem, ReminderItem, AchievementItem,
  CalcHistoryItem, Skill, Course, WorkResponsibility
} from './types';
import { ensureDefaultProfiles, storage } from './lib/storage';
import { getGoogleWorkspaceProfileId, GoogleUser, signInWithGoogle } from './lib/googleDriveSync';
import { getLocalDateString } from './lib/dateUtils';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { ViewSkeleton } from './components/Skeleton';
import { resolveSavedAccent } from './lib/accentTheme';
import {
  applyAppearance,
  AppearancePreferences,
  DEFAULT_APPEARANCE,
  getEffectiveColorMode,
  hasSavedAppearance,
  normalizeAppearance,
  readSavedAppearance,
  restoreBackgroundImage,
  saveLocalAppearance
} from './lib/appearance';

const IS_GUEST_MODE = import.meta.env.DEV || import.meta.env.MODE === 'local-test';
const GUEST_PROFILE_ID = 'om-master-profile';
const LOW_POWER_VIEWPORT_QUERY = '(max-width: 767px), (pointer: coarse)';

// Components
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { QuickCaptureModal } from './components/QuickCaptureModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { OmLogoMark } from './components/OmLogoMark';
import { BsDateModal } from './components/BsDateModal';
import { AlarmTriggerModal } from './components/AlarmTriggerModal';
import { VoiceStudioWidget } from './components/VoiceStudioWidget';
import { OfflineIndicator } from './components/OfflineIndicator';
import { alarmService, TriggeredAlarmData } from './lib/alarmService';
import { lazyWithRetry } from './lib/lazyWithRetry';
import { syncGoalProgressFromTasks, syncGoalProgressFromHabits, recalculateAllGoalsProgress, resolveHabitGoalId } from './lib/goalTaskSync';
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
const SanctuaryEnvironment = lazyWithRetry(() => import('./components/SanctuaryEnvironment').then(m => ({ default: m.default })));


const ViewFallback: React.FC = () => <ViewSkeleton />;

export default function App() {
  return <LifeOSApp />;
}

function LifeOSApp() {
  const [activeModule, setActiveModule] = useState<NavModule>('dashboard');
  const [appearance, setAppearance] = useState<AppearancePreferences>(() => readSavedAppearance());
  const [theme, setTheme] = useState<'light' | 'dark'>(() => getEffectiveColorMode(readSavedAppearance().colorMode));
  const appearanceRef = useRef(appearance);
  const [environmentEnabled, setEnvironmentEnabled] = useState(() => {
    try {
      return localStorage.getItem('om_environment') !== 'off';
    } catch {
      return true;
    }
  });
  const [isLowPowerViewport, setIsLowPowerViewport] = useState(() =>
    window.matchMedia(LOW_POWER_VIEWPORT_QUERY).matches
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);

  // Modals state
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [quickCaptureType, setQuickCaptureType] = useState<string>('task');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBsModalOpen, setIsBsModalOpen] = useState(false);
  const [isVoiceStudioOpen, setIsVoiceStudioOpen] = useState(false);
  const [activeTriggeredAlarm, setActiveTriggeredAlarm] = useState<TriggeredAlarmData | null>(null);

  // Entities state
  const [appSettings, setAppSettings] = useState<AppState | undefined>();

  // Module switches get a soft cross-fade/slide via the View Transitions API.
  const changeModule = useCallback((module: NavModule) => {
    const doc = document as Document & { startViewTransition?: (updateCallback: () => void) => unknown };
    const reduceMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (typeof doc.startViewTransition === 'function' && !reduceMotion) {
      doc.startViewTransition(() => { setActiveModule(module); });
      return;
    }
    setActiveModule(module);
  }, []);

  // Restore appearance immediately so local preferences remain available offline.
  useEffect(() => {
    appearanceRef.current = appearance;
    applyAppearance(appearance);
    setTheme(getEffectiveColorMode(appearance.colorMode));
    try {
      localStorage.setItem('om_theme_mode', appearance.colorMode);
    } catch {}
  }, [appearance]);
  useEffect(() => {
    const media = window.matchMedia(LOW_POWER_VIEWPORT_QUERY);
    const updateViewportMode = () => setIsLowPowerViewport(media.matches);
    media.addEventListener('change', updateViewportMode);
    return () => media.removeEventListener('change', updateViewportMode);
  }, []);
  useEffect(() => {
    if (appearance.backgroundId !== 'custom' || !appearance.backgroundImage.startsWith('idb-background:')) return;
    let cancelled = false;
    restoreBackgroundImage(appearance.backgroundImage)
      .then(() => {
        if (!cancelled) applyAppearance(appearance);
      })
      .catch(error => {
        console.error('Could not restore the saved background image.', error);
      });
    return () => {
      cancelled = true;
    };
  }, [appearance.backgroundId, appearance.backgroundImage]);
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
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [calcHistory, setCalcHistory] = useState<CalcHistoryItem[]>([]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 2500);
  }, []);

  const handleApplyAppearance = useCallback(async (value: AppearancePreferences) => {
    const nextAppearance = applyAppearance(value);
    appearanceRef.current = nextAppearance;
    setAppearance(nextAppearance);
    saveLocalAppearance(nextAppearance);

    const profileId = activeProfileIdRef.current;
    const settingsData = await storage.getSingleton<AppState>('appSettings', profileId || undefined);
    if (!settingsData) {
      throw new Error('Workspace settings are not ready. Please try again.');
    }
    const nextSettings: AppState = {
      ...settingsData,
      appearance: nextAppearance,
      themeMode: nextAppearance.colorMode,
      accentColor: nextAppearance.accentColor
    };
    await storage.setSingleton('appSettings', nextSettings);
    setAppSettings(nextSettings);
  }, []);

  const loadAllData = useCallback(async (overrideProfileId?: string) => {
    const loadGeneration = ++loadGenerationRef.current;
    setDataLoadError(null);
    try {
      const requestedProfileId = overrideProfileId || activeProfileIdRef.current || storage.getActiveProfileId();
      if (requestedProfileId) storage.setActiveProfile(requestedProfileId);
      let settingsData = await storage.getSingleton<AppState>('appSettings', requestedProfileId || undefined);
      if (!settingsData && requestedProfileId === GUEST_PROFILE_ID) {
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
        getAllForProfile<AchievementItem>('achievements'),
        getAllForProfile<CalcHistoryItem>('calcHistory')
      ]);

      if (!isCurrentLoad()) return;
      if (settingsData) {
        const savedAppearance = hasSavedAppearance()
          ? readSavedAppearance()
          : normalizeAppearance({
              ...DEFAULT_APPEARANCE,
              ...settingsData.appearance,
              colorMode: settingsData.appearance?.colorMode || settingsData.themeMode || DEFAULT_APPEARANCE.colorMode,
              accentColor: settingsData.appearance?.accentColor || resolveSavedAccent(settingsData.accentColor)
            });
        if (!hasSavedAppearance()) {
          try {
            saveLocalAppearance(savedAppearance);
          } catch (error) {
            console.error('Could not migrate appearance preferences to this device.', error);
          }
        }
        settingsData.appearance = savedAppearance;
        settingsData.themeMode = savedAppearance.colorMode;
        settingsData.accentColor = savedAppearance.accentColor;
        appearanceRef.current = savedAppearance;
        setAppearance(savedAppearance);
        setAppSettings(settingsData);
        setTheme(getEffectiveColorMode(savedAppearance.colorMode));
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
      if (loadGeneration === loadGenerationRef.current) {
        setDataLoadError(err instanceof Error ? err.message : 'Unexpected storage error.');
      }
    }
  }, []);

  // Keep global alarm notifications available independently of the login screen.
  useEffect(() => {
    alarmService.onAlarmTrigger((alarmData) => {
      setActiveTriggeredAlarm(alarmData);
    });
  }, []);

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
        avatarColor: '#b88648',
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
            accentColor: '#b88648',
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

  const handleGuestUnlock = () => {
    setGoogleUnlockError(null);
    setDataLoadError(null);
    setGoogleUser(null);
    setAppSettings(undefined);
    storage.setActiveProfile(GUEST_PROFILE_ID);
    activeProfileIdRef.current = GUEST_PROFILE_ID;
    setActiveProfileId(GUEST_PROFILE_ID);
    setActiveModule('dashboard');
    setIsGoogleLocked(false);
  };

  // Load all data whenever activeProfileId updates
  useEffect(() => {
    if (activeProfileId) {
      loadAllData(activeProfileId);
    }
  }, [activeProfileId, loadAllData]);

  useEffect(() => {
    if (appearance.colorMode !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = () => setTheme(media.matches ? 'dark' : 'light');
    media.addEventListener('change', updateSystemTheme);
    return () => media.removeEventListener('change', updateSystemTheme);
  }, [appearance.colorMode]);

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
  }, [theme]);

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
    let refreshTimeout: number | undefined;
    const scheduleDataRefresh = () => {
      if (!activeProfileIdRef.current) return;
      window.clearTimeout(refreshTimeout);
      refreshTimeout = window.setTimeout(() => {
        void loadAllData();
      }, 150);
    };
    const refreshActions = new Set([
      'delete', 'recycle', 'clear', 'empty', 'restore', 'purge',
      'restoreWorkspaceBackup', 'importFullBackup', 'purgeDefaultData'
    ]);
    const unsub = storage.onStorageChange((_store, action) => {
      if (action && refreshActions.has(action) && activeProfileIdRef.current) {
        scheduleDataRefresh();
      }
    });

    if (!channel) {
      return () => {
        window.clearTimeout(refreshTimeout);
        unsub();
      };
    }

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.sourceDevice !== storage.deviceId && activeProfileId) {
        scheduleDataRefresh();
      }
    };
    channel.addEventListener('message', handleMessage);
    return () => {
      window.clearTimeout(refreshTimeout);
      unsub();
      channel.removeEventListener('message', handleMessage);
    };
  }, [loadAllData, activeProfileId]);




  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    void handleApplyAppearance({ ...appearanceRef.current, colorMode: newTheme }).catch(error => {
      showToast(error instanceof Error ? error.message : 'Could not save color mode.');
    });
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
    const goalId = targetHabit ? resolveHabitGoalId(targetHabit, routines) : undefined;
    if (targetHabit && goalId) {
      await syncGoalProgressFromHabits(goalId, targetHabit.id);
    }
    loadAllData();
  };

  const openTasksCount = tasks.filter(t => !t.done).length;
  const categoriesList = appSettings?.noteCategories || ['General', 'Strategy', 'Projects', 'Finance', 'Ideas'];

  if (isGoogleLocked) {
    return (
      <div className="sanctuary-shell lock-screen">
        <div className="lock-screen__scene" aria-hidden="true">
          <div className="lock-screen__nebula" />
          <div className="lock-screen__orbit lock-screen__orbit--one" />
          <div className="lock-screen__orbit lock-screen__orbit--two" />
        </div>
        <section className="lock-screen__card" aria-labelledby="lock-screen-title">
          <div className="lock-screen__portal" aria-hidden="true">
            <span className="lock-screen__portal-core" />
            <LockKeyhole className="h-14 w-14" />
          </div>
          <p className="lock-screen__eyebrow">OM LIFEOS <span /> PRIVATE WORKSPACE</p>
          <h1 id="lock-screen-title" className="lock-screen__title">Your space, safely yours.</h1>
          <p className="lock-screen__description">
            Sign in with your Google account to unlock your workspace.
          </p>
          <button
            type="button"
            onClick={handleGoogleUnlock}
            disabled={isUnlockingGoogle}
            className="lock-screen__button"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {isUnlockingGoogle ? 'Signing in…' : 'Unlock with Google'}
          </button>
          <div className="lock-screen__divider"><span>or</span></div>
          <button
            type="button"
            onClick={handleGuestUnlock}
            className="lock-screen__guest-button"
          >
            Continue as guest
          </button>
          {googleUnlockError && (
            <p role="alert" className="lock-screen__error">
              {googleUnlockError}
            </p>
          )}
          <div className="lock-screen__privacy">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <p>Guest data stays on this device. Sign in to open your Google workspace.</p>
          </div>
        </section>
      </div>
    );
  }

  if (!appSettings || !activeProfileId) {
    if (dataLoadError && activeProfileId) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 text-slate-900 dark:bg-[#0B0F19] dark:text-slate-100">
          <section className="w-full max-w-lg space-y-5 rounded-2xl border border-rose-200 bg-white p-6 shadow-sm dark:border-rose-900/60 dark:bg-slate-900">
            <div className="space-y-2">
              <h1 className="text-lg font-bold">Workspace could not be opened</h1>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Your saved data has not been cleared. Check browser storage availability, then retry.
              </p>
              <p role="alert" className="break-words rounded-lg bg-rose-50 p-3 text-xs text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
                {dataLoadError}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadAllData(activeProfileId)}
              className="rounded-lg border border-amber-700/30 bg-amber-700/10 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-700/15 dark:text-amber-200"
            >
              Retry opening workspace
            </button>
          </section>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F19] flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm font-medium">
        <div className="flex items-center gap-2.5">
          <OmLogoMark className="h-8 w-7" />
          <span>Loading Om-LifeOS…</span>
        </div>
      </div>
    );
  }

  return (
    <div
      data-app-root="true"
      data-environment={environmentEnabled ? 'on' : 'off'}
      data-wallpaper-custom={appearance.backgroundId === 'custom' ? 'true' : 'false'}
      className="sanctuary-shell isolate flex min-h-screen flex-col font-sans text-slate-900 selection:bg-indigo-500 selection:text-white dark:text-slate-100 bg-transparent"
    >
      <style>{'@supports (appearance: base-select) { .sanctuary-shell select::picker(select)::backdrop { background: transparent; } }'}</style>
      {environmentEnabled && !isLowPowerViewport && (
        <Suspense fallback={null}>
          <SanctuaryEnvironment />
        </Suspense>
      )}
      <div className="sanctuary-foreground-dimmer" aria-hidden="true" />
      {/* Top Bar */}
      <Header
        activeModule={activeModule}
        onNavigate={changeModule}
        onOpenQuickCapture={(type = 'task') => {
          setQuickCaptureType(type);
          setIsQuickCaptureOpen(true);
        }}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenBsModal={() => setIsBsModalOpen(true)}
        onOpenVoiceStudio={() => setIsVoiceStudioOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        environmentEnabled={environmentEnabled}
        onToggleEnvironment={() => {
          setEnvironmentEnabled(enabled => {
            const nextEnabled = !enabled;
            try {
              localStorage.setItem('om_environment', nextEnabled ? 'on' : 'off');
            } catch (error) {
              console.error('Could not save the sanctuary environment preference.', error);
            }
            return nextEnabled;
          });
        }}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        onShowToast={showToast}
      />

      <div className="flex flex-1">
        {/* Sidebar */}
        <Sidebar
          activeModule={activeModule}
          onNavigate={changeModule}
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
        <main className="sanctuary-main relative isolate mx-auto w-full max-w-7xl flex-1 min-w-0 px-3 sm:px-5 lg:px-6 py-4 sm:py-6 pb-28 md:pb-12">
          <div className="w-full space-y-6">
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
                onNavigate={changeModule}
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
                onNavigate={changeModule}
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
                onNavigate={changeModule}
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
                onNavigate={changeModule}
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
                onRefresh={loadAllData}
                onSuccess={showToast}
                onError={msg => showToast(`⚠️ ${msg}`)}
                theme={theme}
                onToggleTheme={toggleTheme}
                appearance={appearance}
                onApplyAppearance={handleApplyAppearance}
              />
            )}
            </Suspense>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Thumb Navigation */}
      <MobileBottomNav activeModule={activeModule} onNavigate={changeModule} />

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
        onNavigate={changeModule}
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
