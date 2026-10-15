import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import {
  NavModule, AppState, Task, Goal, Milestone, Strategy, KPI, Mission,
  Routine, Habit, HabitLog, FinanceAccount, FinanceTransaction, Loan,
  LoanPayment, Investment, SavingsPlan, Asset, Liability, FinancialGoal,
  Note, JournalEntry, FocusSession, SleepRecord, WaterRecord, NutritionRecord,
  HealthMeasurement, HealthAppointment, HealthNote, WorkProject, LearningItem,
  Meeting, Person, Interaction, ValueItem, SpiritualPractice, Commitment,
  ThingItem, DocumentItem, WarrantyItem, ReceiptItem, CertificateItem,
  ImportantRecordItem, ReminderItem, NotificationItem, AchievementItem,
  CalcHistoryItem, Skill, Course, WorkResponsibility
} from './types';
import {
  storage, seedInitialDataIfEmpty
} from './lib/storage';

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
import { lazyWithRetry } from './lib/lazyWithRetry';
import { syncGoalProgressFromTasks, syncGoalProgressFromHabits, recalculateAllGoalsProgress, computeGoalAggregateBreakdown } from './lib/goalTaskSync';

// Views
import { DashboardView } from './views/DashboardView';
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
const SettingsView = lazyWithRetry(() => import('./views/SettingsView').then(m => ({ default: m.SettingsView })));


const ViewFallback: React.FC = () => (
  <div role="status" aria-live="polite" className="flex items-center justify-center py-24">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 dark:border-slate-700 dark:border-t-indigo-400" />
    <span className="sr-only">Loading…</span>
  </div>
);

export default function App() {
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
  const [activeTriggeredAlarm, setActiveTriggeredAlarm] = useState<TriggeredAlarmData | null>(null);

  // Entities state
  const [appSettings, setAppSettings] = useState<AppState | undefined>();
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const activeProfileIdRef = useRef<string | null>(null);
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
  const [savingsPlans, setSavingsPlans] = useState<SavingsPlan[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [financialGoals, setFinancialGoals] = useState<FinancialGoal[]>([]);

  const [notes, setNotes] = useState<Note[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);

  const [healthMeasurements, setHealthMeasurements] = useState<HealthMeasurement[]>([]);
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
  const [recycleBinCount, setRecycleBinCount] = useState<number>(0);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 2500);
  }, []);

  const loadAllData = useCallback(async (overrideProfileId?: string) => {
    try {
      const settingsData = await storage.getSingleton<AppState>('appSettings');
      const activeId = overrideProfileId || activeProfileIdRef.current || settingsData?.profileId;
      if (!activeId) return;
      if (settingsData) {
        setAppSettings(settingsData);
        if (settingsData.themeMode) setTheme(settingsData.themeMode);
      }
      storage.setActiveProfile(activeId);
      await storage.ensureProfileOwnership(activeId);
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
        storage.getAll<Task>('tasks'),
        storage.getAll<Goal>('goals'),
        storage.getAll<Milestone>('milestones'),
        storage.getAll<Strategy>('strategies'),
        storage.getAll<KPI>('kpis'),
        storage.getAll<Mission>('missions'),
        storage.getAll<Routine>('routines'),
        storage.getAll<Habit>('habits'),
        storage.getAll<HabitLog>('habitLogs'),
        storage.getAll<FinanceAccount>('financeAccounts'),
        storage.getAll<FinanceTransaction>('finance'),
        storage.getAll<Loan>('loans'),
        storage.getAll<LoanPayment>('loanPayments'),
        storage.getAll<Investment>('investments'),
        storage.getAll<SavingsPlan>('savingsPlans'),
        storage.getAll<Asset>('assets'),
        storage.getAll<Liability>('liabilities'),
        storage.getAll<FinancialGoal>('financialGoals'),
        storage.getAll<Note>('notes'),
        storage.getAll<JournalEntry>('journal'),
        storage.getAll<FocusSession>('focus'),
        storage.getAll<HealthMeasurement>('healthMeasurements'),
        storage.getAll<SleepRecord>('sleepRecords'),
        storage.getAll<WaterRecord>('waterRecords'),
        storage.getAll<NutritionRecord>('nutritionRecords'),
        storage.getAll<HealthAppointment>('healthAppointments'),
        storage.getAll<HealthNote>('healthNotes'),
        storage.getAll<WorkProject>('workProjects'),
        storage.getAll<WorkResponsibility>('workResponsibilities'),
        storage.getAll<LearningItem>('learningItems'),
        storage.getAll<Skill>('skills'),
        storage.getAll<Course>('courses'),
        storage.getAll<Meeting>('meetings'),
        storage.getAll<Person>('people'),
        storage.getAll<Interaction>('interactions'),
        storage.getAll<ValueItem>('values'),
        storage.getAll<SpiritualPractice>('spiritualPractices'),
        storage.getAll<Commitment>('commitments'),
        storage.getAll<ThingItem>('things'),
        storage.getAll<DocumentItem>('documents'),
        storage.getAll<WarrantyItem>('warranties'),
        storage.getAll<ReceiptItem>('receipts'),
        storage.getAll<CertificateItem>('certificates'),
        storage.getAll<ImportantRecordItem>('importantRecords'),
        storage.getAll<ReminderItem>('reminders'),
        storage.getAll<NotificationItem>('notifications'),
        storage.getAll<AchievementItem>('achievements'),
        storage.getAll<CalcHistoryItem>('calcHistory')
      ]);

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
      setSavingsPlans([...savingsData]);
      setAssets([...assetsData]);
      setLiabilities([...liabilitiesData]);
      setFinancialGoals([...fgData]);
      setNotes([...notesData]);
      setJournal([...journalData]);
      setFocusSessions([...focusData]);
      setHealthMeasurements([...measData]);
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
      setReminders([...remData]);
      setNotifications([...notifData]);
      setAchievements([...achData]);
      setCalcHistory([...calcData]);
      const binData = await storage.getRecycleBinItems(activeId);
      setRecycleBinCount(binData.length);

      // Auto-reconcile goal progress against actual linked items in database to fix stale/legacy 100% false progress
      recalculateAllGoalsProgress().then(freshGoals => {
        if (freshGoals && freshGoals.length > 0) {
          setGoals([...freshGoals]);
        }
      }).catch(err => {
        console.warn('Goal progress auto-reconcile error:', err);
      });
    } catch (err) {
      console.error('Failed to load initial data', err);
    }
  }, []);

  // First turn initialization: run ONCE on mount
  useEffect(() => {
    let active = true;
    seedInitialDataIfEmpty().then(async () => {
      const settingsData = await storage.getSingleton<AppState>('appSettings');
      if (!active) return;
      if (settingsData) {
        setAppSettings(settingsData);
        if (settingsData.themeMode) setTheme(settingsData.themeMode);

        const targetId = settingsData.profileId || settingsData.profiles?.[0]?.id || 'om-master-profile';
        if (targetId) {
          let savedProfile: string | null = null;
          try { savedProfile = localStorage.getItem('om_active_profile'); } catch {}
          const isKnownProfile = settingsData.profiles?.some(p => p.id === savedProfile);
          const activeProfId = (isKnownProfile && savedProfile) ? savedProfile : targetId;

          if (settingsData.profileId !== activeProfId) {
            settingsData.profileId = activeProfId;
            settingsData.profiles = (settingsData.profiles || []).map(p => ({ ...p, isCurrent: p.id === activeProfId }));
            await storage.setSingleton('appSettings', settingsData);
            setAppSettings({ ...settingsData });
          }

          storage.setActiveProfile(activeProfId);
          setActiveProfileId(activeProfId);
          await loadAllData(activeProfId);
        }
      }
    }).catch(err => console.error('Failed to initialize Om-LifeOS', err));

    // Subscribe to scheduled alarms & reminder triggers
    const unsub = alarmService.onAlarmTrigger((alarmData) => {
      setActiveTriggeredAlarm(alarmData);
    });

    return () => {
      active = false;
    };
  }, []);

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
    const unsub = storage.onStorageChange((store, action) => {
      if (action === 'purgeDefaultData' && activeProfileIdRef.current) {
        loadAllData();
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

  const handleLogHabit = async (habitId: string, occurrence = 0) => {
    const today = new Date().toISOString().slice(0, 10);
    const key = `${habitId}|${today}|${occurrence}`;
    const existing = habitLogs.find(l => l.key === key);

    if (existing) {
      await storage.delete('habitLogs', existing.id);
    } else {
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

  if (!appSettings) {
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
          recycleBinCount={recycleBinCount}
          onToast={showToast}
          onDataRestored={loadAllData}
        />

        {/* Main Content Viewport - Responsive across Mobile, Tablet, Laptop, and Desktop */}
        <main className="flex-1 min-w-0 px-3 sm:px-5 lg:px-6 py-4 sm:py-6 pb-28 md:pb-12 w-full">
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
                healthMeasurements={healthMeasurements}
                sleepRecords={sleepRecords}
                waterRecords={waterRecords}
                nutritionRecords={nutritionRecords}
                appointments={appointments}
                healthNotes={healthNotes}
                meetings={meetings}
                people={people}
                interactions={interactions}
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
                savingsPlans={savingsPlans}
                assets={assets}
                liabilities={liabilities}
                financialGoals={financialGoals}
                receipts={receipts}
                goals={goals}
                onNavigate={setActiveModule}
                onRefresh={loadAllData}
                onSuccess={showToast}
              />
            )}

            {activeModule === 'health' && (
              <HealthView
                profile={undefined}
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
                goals={goals}
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
              />
            )}

            {((activeModule as string) === 'settings' || (activeModule as string) === 'recycle_bin') && (
              <SettingsView
                settings={appSettings}
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
