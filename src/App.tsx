import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import {
  NavModule, AppState, Task, Goal, Milestone, Strategy, KPI, Mission,
  Routine, Habit, HabitLog, FinanceAccount, FinanceTransaction, Loan,
  LoanPayment, Investment, SavingsPlan, Asset, Liability,
  InvestmentActivity, CashFlowSchedule,
  Note, JournalEntry, FocusSession, SleepRecord, WaterRecord, NutritionRecord,
  HealthMeasurement, HealthAppointment, HealthNote, HealthProfile, LearningItem,
  Meeting, Person, Interaction, SpiritualPractice,
  ThingItem, DocumentItem, WarrantyItem, ReceiptItem, CertificateItem,
  ImportantRecordItem, ReminderItem,
  CalcHistoryItem, Skill
} from './types';
import { ensureDefaultProfiles, generateUUID, storage } from './lib/storage';
import type { GoogleUser } from './lib/googleDriveSync';
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
  restoreBackgroundAsset,
  saveLocalAppearance
} from './lib/appearance';

const IS_GUEST_MODE = import.meta.env.DEV
  || import.meta.env.MODE === 'local-test'
  || import.meta.env.MODE === 'review-copy';
const GUEST_PROFILE_ID = 'om-master-profile';
// Components
import { Header } from './components/Header';
import { MobileBottomNav } from './components/MobileBottomNav';
import { type WorkAreaSection } from './components/TaskRoutineFocusSwitcher';
import { QuickCaptureModal } from './components/QuickCaptureModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { OmLogoMark } from './components/OmLogoMark';
import { BsDateModal } from './components/BsDateModal';
import { AlarmTriggerModal } from './components/AlarmTriggerModal';
import { VoiceStudioWidget } from './components/VoiceStudioWidget';
import { alarmService, TriggeredAlarmData } from './lib/alarmService';
import { lazyWithRetry } from './lib/lazyWithRetry';
import {
  syncGoalProgressFromTasks,
  syncGoalProgressFromHabits,
  recalculateAllGoalsProgress,
  resolveHabitGoalId
} from './lib/goalTaskSync';
import { applyTaskCompletionEffects } from './lib/recurrenceEngine';
import { soundEngine } from './lib/soundEngine';
import { setActiveCurrencySymbol } from './lib/currencyDisplay';

// Views
const DashboardView = lazyWithRetry(() => import('./views/DashboardView').then(m => ({ default: m.default })));
const TasksView = lazyWithRetry(() => import('./views/TasksView').then(m => ({ default: m.TasksView })));
const RoutineView = lazyWithRetry(() => import('./views/RoutineView').then(m => ({ default: m.RoutineView })));
const GoalsView = lazyWithRetry(() => import('./views/GoalsView').then(m => ({ default: m.GoalsView })));
const FocusView = lazyWithRetry(() => import('./views/FocusView').then(m => ({ default: m.FocusView })));
const NotesView = lazyWithRetry(() => import('./views/NotesView').then(m => ({ default: m.NotesView })));
const JournalView = lazyWithRetry(() => import('./views/JournalView').then(m => ({ default: m.JournalView })));
const CalculatorView = lazyWithRetry(() => import('./views/CalculatorView').then(m => ({ default: m.CalculatorView })));
const FinanceView = lazyWithRetry(() => import('./views/FinanceView').then(m => ({ default: m.FinanceView })));
const HealthView = lazyWithRetry(() => import('./views/HealthView').then(m => ({ default: m.HealthView })));
const ThingsView = lazyWithRetry(() => import('./views/ThingsView').then(m => ({ default: m.ThingsView })));
const SettingsView = lazyWithRetry(() => import('./views/SettingsView').then(m => ({ default: m.SettingsView })));

const ViewFallback: React.FC = () => <ViewSkeleton />;

export default function App() {
  return <LifeOSApp />;
}

function LifeOSApp() {
  const [activeModule, setActiveModule] = useState<NavModule>('dashboard');
  const [activeWorkAreaSection, setActiveWorkAreaSection] = useState<WorkAreaSection>('tasks-roster');
  const [healthInitialTab, setHealthInitialTab] = useState<
    'movement' | 'wellness' | 'appointments' | 'profile' | 'people' | 'foundation-practices' | 'work-learning' | 'work-skills'
  >('movement');
  const [pendingRecordId, setPendingRecordId] = useState<string | null>(null);
  const [pendingNotesJournalAction, setPendingNotesJournalAction] = useState<'note' | 'reflection' | 'note-filters' | 'journal-timeline' | null>(null);
  const [appearance, setAppearance] = useState<AppearancePreferences>(() => readSavedAppearance());
  const [wallpaperVideoUrl, setWallpaperVideoUrl] = useState('');
  const [isWallpaperVideoMuted, setIsWallpaperVideoMuted] = useState(true);
  const wallpaperVideoRef = useRef<HTMLVideoElement>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => getEffectiveColorMode(readSavedAppearance().colorMode));
  const appearanceRef = useRef(appearance);
  const [environmentEnabled, setEnvironmentEnabled] = useState(() => {
    try {
      return localStorage.getItem('om_environment') !== 'off';
    } catch {
      return true;
    }
  });
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
  const changeModule = useCallback((module: NavModule, recordId?: string) => {
    const healthTabTarget = module === 'people'
      ? 'people'
      : module === 'spiritual'
        ? 'foundation-practices'
        : module === 'work'
          ? 'work-learning'
          : module === 'health'
            ? 'movement'
            : null;
    if (healthTabTarget) setHealthInitialTab(healthTabTarget);
    const destination = healthTabTarget ? 'health' : module;
    setPendingRecordId(recordId ?? null);
    const updateModule = () => {
      setActiveModule(destination);
      window.scrollTo(0, 0);
    };
    const doc = document as Document & { startViewTransition?: (updateCallback: () => void) => unknown };
    const reduceMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (typeof doc.startViewTransition === 'function' && !reduceMotion) {
      doc.startViewTransition(updateModule);
      return;
    }
    updateModule();
  }, []);

  // After navigating from a search result, scroll to the record and flash a highlight.
  useEffect(() => {
    if (!pendingRecordId) return;
    const timer = window.setTimeout(() => {
      const cssEscape = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(pendingRecordId)
        : pendingRecordId.replace(/["\\]/g, '\\$&');
      const element = document.querySelector<HTMLElement>(`[data-record-id="${cssEscape}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('om-record-focus');
        window.setTimeout(() => element.classList.remove('om-record-focus'), 2400);
      }
      setPendingRecordId(null);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [pendingRecordId, activeModule]);

  const selectWorkAreaSection = useCallback((section: WorkAreaSection) => {
    if (section.startsWith('tasks-')) changeModule('tasks');
    else if (section === 'routine' || section.startsWith('routine-')) changeModule('routine');
    else changeModule('focus');
    setActiveWorkAreaSection(section);
  }, [changeModule]);
  useEffect(() => {
    if (activeModule === 'tasks' && !activeWorkAreaSection.startsWith('tasks-')) {
      setActiveWorkAreaSection('tasks-roster');
    } else if (activeModule === 'routine' && activeWorkAreaSection !== 'routine' && !activeWorkAreaSection.startsWith('routine-')) {
      setActiveWorkAreaSection('routine');
    } else if (activeModule === 'focus' && !activeWorkAreaSection.startsWith('focus-')) {
      setActiveWorkAreaSection('focus-timer');
    }
  }, [activeModule, activeWorkAreaSection]);
  const requestNotesJournalAction = useCallback((target: 'note' | 'reflection' | 'note-filters' | 'journal-timeline' | 'calculator') => {
    if (target === 'calculator') {
      changeModule('calculator');
      return;
    }
    setPendingNotesJournalAction(target);
    changeModule(target === 'note' || target === 'note-filters' ? 'notes' : 'journal');
  }, [changeModule]);
  const consumeNotesJournalAction = useCallback(() => {
    setPendingNotesJournalAction(null);
  }, []);

  // Restore appearance immediately so local preferences remain available offline.
  useEffect(() => {
    const handleWallpaperChange = (event: Event) => {
      const { isVideo, url } = (event as CustomEvent<{ isVideo: boolean; url: string }>).detail;
      setWallpaperVideoUrl(isVideo ? url : '');
    };
    document.addEventListener('om-wallpaper-change', handleWallpaperChange);
    return () => document.removeEventListener('om-wallpaper-change', handleWallpaperChange);
  }, []);
  useEffect(() => {
    appearanceRef.current = appearance;
    applyAppearance(appearance);
    setTheme(getEffectiveColorMode(appearance.colorMode));
    try {
      localStorage.setItem('om_theme_mode', appearance.colorMode);
    } catch {}
  }, [appearance]);
  useEffect(() => {
    if (appearance.backgroundId !== 'custom' || !appearance.backgroundImage.startsWith('idb-background:')) return;
    let cancelled = false;
    restoreBackgroundAsset(appearance.backgroundImage)
      .then(() => {
        if (!cancelled) applyAppearance(appearance);
      })
      .catch(error => {
        console.error('Could not restore the saved background media.', error);
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

  const [learningItems, setLearningItems] = useState<LearningItem[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  const [people, setPeople] = useState<Person[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);

  const [practices, setPractices] = useState<SpiritualPractice[]>([]);

  const [things, setThings] = useState<ThingItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [warranties, setWarranties] = useState<WarrantyItem[]>([]);
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [importantRecords, setImportantRecords] = useState<ImportantRecordItem[]>([]);

  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [calcHistory, setCalcHistory] = useState<CalcHistoryItem[]>([]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 2500);
  }, []);

  const toggleWallpaperVideoSound = useCallback(() => {
    const video = wallpaperVideoRef.current;
    if (!video) {
      showToast('Apply the video background before turning its sound on.');
      return;
    }

    const shouldUnmute = video.muted;
    video.muted = !shouldUnmute;
    if (shouldUnmute) video.volume = 1;
    setIsWallpaperVideoMuted(!shouldUnmute);

    video.play().catch(error => {
      video.muted = true;
      setIsWallpaperVideoMuted(true);
      console.error('Could not play the wallpaper video with sound.', error);
      showToast('Browser could not play the video sound. Try clicking Sound on again.');
    });
  }, [showToast]);

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
        notesData,
        journalData,
        focusData,
        measData,
        sleepData,
        waterData,
        nutriData,
        apptsData,
        hNotesData,
        learnData,
        skillsData,
        meetData,
        peopleData,
        interData,
        pracData,
        thingData,
        docData,
        warData,
        recData,
        certData,
        irData,
        remData,
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
        getAllForProfile<Note>('notes'),
        getAllForProfile<JournalEntry>('journal'),
        getAllForProfile<FocusSession>('focus'),
        getAllForProfile<HealthMeasurement>('healthMeasurements'),
        getAllForProfile<SleepRecord>('sleepRecords'),
        getAllForProfile<WaterRecord>('waterRecords'),
        getAllForProfile<NutritionRecord>('nutritionRecords'),
        getAllForProfile<HealthAppointment>('healthAppointments'),
        getAllForProfile<HealthNote>('healthNotes'),
        getAllForProfile<LearningItem>('learningItems'),
        getAllForProfile<Skill>('skills'),
        getAllForProfile<Meeting>('meetings'),
        getAllForProfile<Person>('people'),
        getAllForProfile<Interaction>('interactions'),
        getAllForProfile<SpiritualPractice>('spiritualPractices'),
        getAllForProfile<ThingItem>('things'),
        getAllForProfile<DocumentItem>('documents'),
        getAllForProfile<WarrantyItem>('warranties'),
        getAllForProfile<ReceiptItem>('receipts'),
        getAllForProfile<CertificateItem>('certificates'),
        getAllForProfile<ImportantRecordItem>('importantRecords'),
        getAllForProfile<ReminderItem>('reminders'),
        getAllForProfile<CalcHistoryItem>('calcHistory')
      ]);

      if (!isCurrentLoad()) return;
      if (settingsData) {
        const savedAppearance = hasSavedAppearance()
          ? readSavedAppearance()
          : normalizeAppearance({
              ...DEFAULT_APPEARANCE,
              ...settingsData.appearance,
              colorMode: settingsData.appearance?.colorMode || DEFAULT_APPEARANCE.colorMode,
              accentColor: settingsData.appearance?.accentColor
                || (settingsData.accentColor?.toLowerCase() === '#b88648'
                  ? DEFAULT_APPEARANCE.accentColor
                  : resolveSavedAccent(settingsData.accentColor))
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
      setLearningItems([...learnData]);
      setSkills([...skillsData]);
      setMeetings([...meetData]);
      setPeople([...peopleData]);
      setInteractions([...interData]);
      setPractices([...pracData]);
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
      setActiveModule('dashboard');
      return;
    }

    setGoogleUser(user);
    const { getGoogleWorkspaceProfileId } = await import('./lib/googleDriveSync');
    const nextProfileId = getGoogleWorkspaceProfileId(user);
    alarmService.clearActiveAlarm();
    setActiveTriggeredAlarm(null);
    setAppSettings(undefined);
    storage.setActiveProfile(nextProfileId);
    activeProfileIdRef.current = nextProfileId;
    setActiveProfileId(nextProfileId);
    setActiveModule('dashboard');
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
            themeMode: DEFAULT_APPEARANCE.colorMode,
            accentColor: DEFAULT_APPEARANCE.accentColor,
            notificationsEnabled: true,
            noteCategories: ['General', 'Strategy', 'Finance', 'Ideas'],
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
      const { signInWithGoogle } = await import('./lib/googleDriveSync');
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
    const updated = {
      ...t,
      done: nextDone,
      status: nextDone ? 'done' as const : 'open' as const,
      updatedAt: Date.now()
    };
    await storage.put('tasks', updated);
    await applyTaskCompletionEffects(updated, nextDone);
    const linkedGoalId = t.goalId;
    if (linkedGoalId) {
      await syncGoalProgressFromTasks(linkedGoalId, t.id, nextDone);
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
        id: generateUUID(),
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
      await syncGoalProgressFromHabits(goalId);
    }
    loadAllData();
  };

  const openTasksCount = tasks.filter(t => !t.done).length;
  const categoriesList = (appSettings?.noteCategories || ['General', 'Strategy', 'Finance', 'Ideas'])
    .filter(category => category !== 'Projects');

  if (isGoogleLocked) {
    return (
      <div className="sanctuary-shell lock-screen">
        <div className="lock-screen__scene" aria-hidden="true">
          <div className="lock-screen__nebula" />
          <div className="lock-screen__orbit lock-screen__orbit--one" />
          <div className="lock-screen__orbit lock-screen__orbit--two" />
        </div>
        <section className="lock-screen__content" aria-labelledby="lock-screen-title">
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
            data-lock-action="google"
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
            data-lock-action="guest"
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

  setActiveCurrencySymbol(appSettings.currencySymbol);

  return (
    <div
      data-app-root="true"
      data-environment={environmentEnabled ? 'on' : 'off'}
      data-wallpaper-custom={appearance.backgroundId === 'custom' ? 'true' : 'false'}
      data-appearance-preset={appearance.presetId}
      className="sanctuary-shell isolate flex min-h-screen flex-col font-sans text-slate-900 selection:bg-indigo-500 selection:text-white dark:text-slate-100 bg-transparent"
    >
      <style>{'@supports (appearance: base-select) { .sanctuary-shell select::picker(select)::backdrop { background: transparent; } }'}</style>
      <div className="sanctuary-theme-background" aria-hidden="true" />
      <div className="sanctuary-cosmos-atmosphere" aria-hidden="true" />
      {wallpaperVideoUrl && (
        <>
          <video
            ref={wallpaperVideoRef}
            className="sanctuary-wallpaper-video"
            src={wallpaperVideoUrl}
            autoPlay
            muted={isWallpaperVideoMuted}
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
            onError={() => {
              console.error('Could not play the selected MP4 background video.');
              document.documentElement.dataset.wallpaperVideo = 'false';
            }}
          />
        </>
      )}
      <div className="sanctuary-foreground-dimmer" aria-hidden="true" />
      {/* Top Bar */}
      <Header
        activeModule={activeModule}
        onNavigate={changeModule}
        openTasksCount={openTasksCount}
        remindersCount={reminders.filter(r => r.status !== 'done').length}
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
        onShowToast={showToast}
        workspaceProfileId={activeProfileId || 'om-master-profile'}
        googleUser={googleUser}
        onGoogleAccountChange={handleGoogleAccountChange}
        onDataRestored={loadAllData}
      />
      <MobileBottomNav activeModule={activeModule} onNavigate={changeModule} />

      <div className="flex flex-1">
        <main className={`sanctuary-main relative isolate mx-auto w-full max-w-7xl flex-1 min-w-0 px-3 sm:px-5 lg:px-6 py-4 sm:py-6 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-12 ${activeModule === 'dashboard' ? 'dashboard-canvas' : ''}`}>
          <div className="w-full space-y-6">
            <Suspense fallback={<ViewFallback />}>
            {activeModule === 'dashboard' && (
              <DashboardView
                tasks={tasks}
                goals={goals}
                habits={habits}
                habitLogs={habitLogs}
                finance={financeTransactions}
                accounts={financeAccounts}
                assets={assets}
                liabilities={liabilities}
                loans={loans}
                investments={investments}
                investmentActivities={investmentActivities}
                savingsPlans={savingsPlans}
                reminders={reminders}
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
                strategies={strategies}
                missions={missions}
                dailyPlanner={appSettings?.dailyPlanner}
                learningItems={learningItems}
                skills={skills}
                routines={routines}
                habits={habits}
                habitLogs={habitLogs}
                reminders={reminders}
                activeWorkAreaSection={activeWorkAreaSection}
                onSelectWorkAreaSection={selectWorkAreaSection}
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
                activeWorkAreaSection={activeWorkAreaSection}
                onSelectWorkAreaSection={selectWorkAreaSection}
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
                learningItems={learningItems}
                skills={skills}
                notes={notes}
                journal={journal}
                reminders={reminders}
                appointments={appointments}
                healthNotes={healthNotes}
                meetings={meetings}
                people={people}
                practices={practices}
                focusSessions={focusSessions}
                healthProfile={healthProfile}
                things={things}
                documents={documents}
                warranties={warranties}
                receipts={receipts}
                certificates={certificates}
                importantRecords={importantRecords}
                onRefresh={loadAllData}
                onSuccess={showToast}
                onNavigate={changeModule}
              />
            )}

            {activeModule === 'focus' && (
              <FocusView
                sessions={focusSessions}
                tasks={tasks}
                goals={goals}
                routines={routines}
                profileId={activeProfileId || 'om-master-profile'}
                activeWorkAreaSection={activeWorkAreaSection}
                onSelectWorkAreaSection={selectWorkAreaSection}
                onRefresh={loadAllData}
                onSuccess={showToast}
              />
            )}

            {activeModule === 'notes' && (
              <NotesView
                notes={notes}
                categories={categoriesList}
                goals={goals}
                journalCount={journal.length}
                pendingAction={pendingNotesJournalAction}
                onActionConsumed={consumeNotesJournalAction}
                onRequestAction={requestNotesJournalAction}
                onRefresh={loadAllData}
                onSuccess={showToast}
              />
            )}

            {activeModule === 'journal' && (
              <JournalView
                journal={journal}
                noteCount={notes.length}
                pendingAction={pendingNotesJournalAction}
                onActionConsumed={consumeNotesJournalAction}
                onRequestAction={requestNotesJournalAction}
                goals={goals}
                onRefresh={loadAllData}
                onSuccess={showToast}
              />
            )}

            {activeModule === 'calculator' && (
              <CalculatorView
                history={calcHistory}
                favorites={appSettings?.calcFavorites || []}
                noteCount={notes.length}
                journalCount={journal.length}
                onSelectNotesJournalAction={requestNotesJournalAction}
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
                receipts={receipts}
                goals={goals}
                mentor={appSettings?.mentor}
                onNavigate={changeModule}
                onRefresh={loadAllData}
                onSuccess={showToast}
                onError={msg => showToast(`⚠️ ${msg}`)}
              />
            )}

            {activeModule === 'health' && (
              <HealthView
                initialTab={healthInitialTab}
                profile={healthProfile}
                measurements={healthMeasurements}
                sleepRecords={sleepRecords}
                waterRecords={waterRecords}
                nutritionRecords={nutritionRecords}
                appointments={appointments}
                healthNotes={healthNotes}
                goals={goals}
                people={people}
                interactions={interactions}
                reminders={reminders}
                practices={practices}
                learningItems={learningItems}
                skills={skills}
                tasks={tasks}
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
                goals={goals}
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
                wallpaperVideoMuted={isWallpaperVideoMuted}
                onToggleWallpaperVideoSound={toggleWallpaperVideoSound}
              />
            )}
            </Suspense>
          </div>
        </main>
      </div>

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
          showToast(`Alarm snoozed for ${mins} minutes`);
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

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-16 right-4 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-2xl dark:bg-white dark:text-slate-900 animate-in fade-in slide-in-from-bottom-2 sm:bottom-6 sm:right-6">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
