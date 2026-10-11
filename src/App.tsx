import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  storage, seedInitialDataIfEmpty, getProfileSecurityInfo
} from './lib/storage';

// Components
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { QuickCaptureModal } from './components/QuickCaptureModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { BsDateModal } from './components/BsDateModal';
import { MultiUserModal } from './components/MultiUserModal';
import { AlarmTriggerModal } from './components/AlarmTriggerModal';
import { VoiceStudioWidget } from './components/VoiceStudioWidget';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AppLockScreen } from './components/AppLockScreen';
import { alarmService, TriggeredAlarmData } from './lib/alarmService';
import { syncGoalProgressFromTasks, syncGoalProgressFromHabits, recalculateAllGoalsProgress } from './lib/goalTaskSync';

// Views
import { DashboardView } from './views/DashboardView';
import { TasksView } from './views/TasksView';
import { RoutineView } from './views/RoutineView';
import { GoalsView } from './views/GoalsView';
import { FocusView } from './views/FocusView';
import { NotesView } from './views/NotesView';
import { JournalView } from './views/JournalView';
import { CalculatorView } from './views/CalculatorView';
import { FinanceView } from './views/FinanceView';
import { HealthView } from './views/HealthView';
import { WorkView } from './views/WorkView';
import { PeopleView } from './views/PeopleView';
import { SpiritualView } from './views/SpiritualView';
import { ThingsView } from './views/ThingsView';
import { SettingsView } from './views/SettingsView';

export default function App() {
  const [activeModule, setActiveModule] = useState<NavModule>('dashboard');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [quickCaptureType, setQuickCaptureType] = useState<string>('task');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBsModalOpen, setIsBsModalOpen] = useState(false);
  const [isMultiUserOpen, setIsMultiUserOpen] = useState(false);
  const [activeTriggeredAlarm, setActiveTriggeredAlarm] = useState<TriggeredAlarmData | null>(null);

  // Entities state
  const [appSettings, setAppSettings] = useState<AppState | undefined>();
  const [unlockedProfileId, setUnlockedProfileId] = useState<string | null>(null);
  const unlockedProfileIdRef = useRef<string | null>(null);
  useEffect(() => {
    unlockedProfileIdRef.current = unlockedProfileId;
  }, [unlockedProfileId]);
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
      const activeId = overrideProfileId || unlockedProfileIdRef.current || settingsData?.profileId;
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
          const savedUnlocked = localStorage.getItem('om_unlocked_profile') || sessionStorage.getItem('om_session_unlocked');
          const isKnownProfile = settingsData.profiles?.some(p => p.id === savedUnlocked);
          const activeProfId = (isKnownProfile && savedUnlocked) ? savedUnlocked : targetId;

          // If activeProfId differs from settingsData.profileId, keep appSettings in sync
          if (settingsData.profileId !== activeProfId) {
            settingsData.profileId = activeProfId;
            settingsData.profiles = (settingsData.profiles || []).map(p => ({ ...p, isCurrent: p.id === activeProfId }));
            await storage.setSingleton('appSettings', settingsData);
            setAppSettings({ ...settingsData });
          }

          const secInfo = await getProfileSecurityInfo(activeProfId);
          if (secInfo?.credentialsReady) {
            // Workspace is password protected: ALWAYS show Lock Screen on file open/startup!
            storage.setActiveProfile(null);
            setUnlockedProfileId(null);
            try {
              sessionStorage.removeItem('om_session_unlocked');
              localStorage.removeItem('om_unlocked_profile');
            } catch {}
          } else {
            // No password set on this workspace: open directly!
            storage.setActiveProfile(activeProfId);
            setUnlockedProfileId(activeProfId);
            await loadAllData(activeProfId);
          }
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

  // Load all data whenever unlockedProfileId updates
  useEffect(() => {
    if (unlockedProfileId) {
      loadAllData(unlockedProfileId);
    }
  }, [unlockedProfileId, loadAllData]);

  // Sync theme with HTML root class and accent color
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-lifeos-mode', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-lifeos-mode', 'light');
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
      if (action === 'purgeDefaultData' && unlockedProfileIdRef.current) {
        loadAllData();
      }
    });

    if (!channel) return unsub;

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.sourceDevice !== storage.deviceId && unlockedProfileId) {
        loadAllData();
      }
    };
    channel.addEventListener('message', handleMessage);
    return () => {
      unsub();
      channel.removeEventListener('message', handleMessage);
    };
  }, [loadAllData, unlockedProfileId]);


  const handleProfileUnlocked = useCallback(async (profileId: string) => {
    try {
      sessionStorage.setItem('om_session_unlocked', profileId);
      localStorage.setItem('om_unlocked_profile', profileId);
    } catch {}
    const settings = (await storage.getSingleton<AppState>('appSettings')) || ({} as AppState);
    const profile = settings.profiles?.find(p => p.id === profileId);
    if (!profile) return;
    settings.profileId = profileId;
    settings.profiles = (settings.profiles || []).map(p => ({ ...p, isCurrent: p.id === profileId }));
    settings.currentUser = { name: profile.name, email: profile.email, provider: 'local' };
    await storage.setSingleton('appSettings', settings);
    storage.setActiveProfile(profileId);
    await storage.ensureProfileOwnership(profileId);
    try {
      await recalculateAllGoalsProgress();
    } catch (err) {
      console.error('Failed to recalculate goals progress', err);
    }
    setUnlockedProfileId(profileId);
    setAppSettings(settings);
    await loadAllData(profileId);
  }, [loadAllData]);

  const handleSwitchWorkspace = useCallback(async (id: string) => {
    try {
      const s = (await storage.getSingleton<AppState>('appSettings')) || ({} as AppState);
      const targetProfile = (s.profiles || []).find(p => p.id === id);
      if (!targetProfile) return;

      s.profileId = id;
      s.profiles = (s.profiles || []).map(p => ({ ...p, isCurrent: p.id === id }));
      s.currentUser = {
        name: targetProfile.name,
        email: targetProfile.email,
        provider: targetProfile.authType || 'local'
      };
      await storage.setSingleton('appSettings', s);
      storage.setActiveProfile(id);
      await storage.ensureProfileOwnership(id);

      try {
        sessionStorage.setItem('om_session_unlocked', id);
        localStorage.setItem('om_unlocked_profile', id);
      } catch {}

      setUnlockedProfileId(id);
      setAppSettings(s);
      await loadAllData(id);
      showToast(`✓ Switched to workspace: ${targetProfile.name}`);
    } catch (err: any) {
      showToast(`⚠️ Failed to switch workspace: ${err?.message || err}`);
    }
  }, [loadAllData, showToast]);

  const handleLockApp = useCallback(() => {
    try {
      sessionStorage.removeItem('om_session_unlocked');
      localStorage.removeItem('om_unlocked_profile');
    } catch {}
    storage.setActiveProfile(null);
    setUnlockedProfileId(null);
    showToast('Workspace Locked 🔒');
  }, [showToast]);

  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
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
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">Loading Om-LifeOS…</div>;
  }

  if (!unlockedProfileId) {
    return (
      <AppLockScreen
        settings={appSettings}
        onUnlocked={handleProfileUnlocked}
        onSettingsReloaded={nextSettings => setAppSettings(nextSettings)}
      />
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
        onOpenMultiUser={() => setIsMultiUserOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        profiles={appSettings?.profiles || [{ id: 'default', name: 'Primary Workspace', createdAt: Date.now() }]}
        currentProfileId={appSettings?.profileId || 'default'}
        onSelectProfile={handleSwitchWorkspace}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        onLockApp={handleLockApp}
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
          onLockApp={handleLockApp}
          onToast={showToast}
        />

        {/* Main Content Viewport - Responsive across Mobile, Tablet, Laptop, and Desktop */}
        <main className="flex-1 min-w-0 overflow-y-auto px-3 sm:px-5 lg:px-6 py-4 sm:py-6 pb-24 md:pb-10 transition-colors w-full">
          <div className="w-full space-y-6">
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
                currentProfileName={appSettings?.profiles?.find(p => p.id === appSettings?.profileId)?.name || 'Primary Workspace'}
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
                onRefresh={loadAllData}
                onSuccess={showToast}
              />
            )}

            {activeModule === 'spiritual' && (
              <SpiritualView
                values={values}
                practices={practices}
                commitments={commitments}
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
                onSelectProfile={handleSwitchWorkspace}
              />
            )}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Thumb Navigation */}
      <MobileBottomNav activeModule={activeModule} onNavigate={setActiveModule} onLockApp={handleLockApp} />

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

      <MultiUserModal
        isOpen={isMultiUserOpen}
        onClose={() => setIsMultiUserOpen(false)}
        appSettings={appSettings}
        onRefresh={loadAllData}
        onSuccess={showToast}
        onError={msg => showToast(`⚠️ ${msg}`)}
        onSelectProfile={handleSwitchWorkspace}
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
