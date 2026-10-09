/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  NavModule, AppState, Task, Goal, Routine, Habit, HabitLog,
  FinanceAccount, FinanceTransaction, Note, JournalEntry,
  HealthMeasurement, SleepRecord, WaterRecord, FocusSession,
  Loan, Investment, SavingsPlan
} from './types';
import { alarmService, TriggeredAlarmData } from './lib/audioSynthesizer';
import { applyAccentTheme, getSavedAccentTheme } from './lib/themeEngine';
import { recalculateGoalProgress } from './lib/goalTaskSync';
import { Loader2 } from 'lucide-react';

// Components
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { QuickCaptureModal } from './components/QuickCaptureModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { BsDateModal } from './components/BsDateModal';
import { AlarmRingingModal } from './components/AlarmRingingModal';
import { GoogleDriveSyncModal } from './components/GoogleDriveSyncModal';
import { GoogleAuthGate } from './components/GoogleAuthGate';
import { initAuth, subscribeAuth, googleSignOut } from './lib/googleDriveService';
import { storage, seedInitialDataIfEmpty, syncGoogleUserProfile, purgePrimaryWorkspace, generateUUID } from './lib/storage';
import { User } from 'firebase/auth';

// Views
import { DashboardView } from './views/DashboardView';
import { TasksView } from './views/TasksView';
import { RoutineView } from './views/RoutineView';
import { GoalsView } from './views/GoalsView';
import { FocusView } from './views/FocusView';
import { NotesView } from './views/NotesView';
import { JournalView } from './views/JournalView';
import { FinanceView } from './views/FinanceView';
import { HealthView } from './views/HealthView';
import { CalculatorView } from './views/CalculatorView';
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
  const [isDriveSyncModalOpen, setIsDriveSyncModalOpen] = useState(false);
  const [activeAlarm, setActiveAlarm] = useState<TriggeredAlarmData | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  // Entities state
  const [appSettings, setAppSettings] = useState<AppState | undefined>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [financeAccounts, setFinanceAccounts] = useState<FinanceAccount[]>([]);
  const [financeTransactions, setFinanceTransactions] = useState<FinanceTransaction[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [savingsPlans, setSavingsPlans] = useState<SavingsPlan[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);
  const [healthMeasurements, setHealthMeasurements] = useState<HealthMeasurement[]>([]);
  const [sleepRecords, setSleepRecords] = useState<SleepRecord[]>([]);
  const [waterRecords, setWaterRecords] = useState<WaterRecord[]>([]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 2500);
  }, []);

  const loadAllData = useCallback(async () => {
    try {
      const [
        settingsData,
        tasksData,
        goalsData,
        routinesData,
        habitsData,
        logsData,
        acctsData,
        txData,
        loansData,
        invData,
        savingsData,
        notesData,
        journalData,
        focusData,
        healthData,
        sleepData,
        waterData
      ] = await Promise.all([
        storage.getSingleton<AppState>('appSettings'),
        storage.getAll<Task>('tasks'),
        storage.getAll<Goal>('goals'),
        storage.getAll<Routine>('routines'),
        storage.getAll<Habit>('habits'),
        storage.getAll<HabitLog>('habitLogs'),
        storage.getAll<FinanceAccount>('financeAccounts'),
        storage.getAll<FinanceTransaction>('finance'),
        storage.getAll<Loan>('loans'),
        storage.getAll<Investment>('investments'),
        storage.getAll<SavingsPlan>('savingsPlans'),
        storage.getAll<Note>('notes'),
        storage.getAll<JournalEntry>('journal'),
        storage.getAll<FocusSession>('focus'),
        storage.getAll<HealthMeasurement>('healthMeasurements'),
        storage.getAll<SleepRecord>('sleepRecords'),
        storage.getAll<WaterRecord>('waterRecords')
      ]);

      if (settingsData) {
        setAppSettings(settingsData);
        if (settingsData.themeMode) setTheme(settingsData.themeMode);
      }
      setTasks(tasksData);
      setGoals(goalsData);
      setRoutines(routinesData);
      setHabits(habitsData);
      setHabitLogs(logsData);
      setFinanceAccounts(acctsData);
      setFinanceTransactions(txData);
      setLoans(loansData);
      setInvestments(invData);
      setSavingsPlans(savingsData);
      setNotes(notesData);
      setJournal(journalData);
      setFocusSessions(focusData);
      setHealthMeasurements(healthData);
      setSleepRecords(sleepData);
      setWaterRecords(waterData);
    } catch (err) {
      console.error('Failed to load initial data', err);
    }
  }, []);

  // Initialize and seed on mount
  useEffect(() => {
    purgePrimaryWorkspace().catch(() => {});
    seedInitialDataIfEmpty().then(() => {
      loadAllData();
    }).catch(err => console.error('Initialization error', err));

    // Listen to alarms
    alarmService.onTrigger((alarmData) => {
      setActiveAlarm(alarmData);
    });

    // Subscribe to storage changes
    const unsub = storage.subscribe(() => {
      loadAllData();
    });

    // Subscribe to Google Auth changes
    const unsubAuth = subscribeAuth(async (user) => {
      setCurrentUser(user);
      if (user) {
        await syncGoogleUserProfile(user);
        await loadAllData();
      }
      setIsAuthChecking(false);
    });

    initAuth(
      async (user) => {
        setCurrentUser(user);
        await syncGoogleUserProfile(user);
        await loadAllData();
        setIsAuthChecking(false);
      },
      () => {
        // Not authenticated
        setIsAuthChecking(false);
      }
    );

    return () => {
      unsub();
      unsubAuth();
    };
  }, [loadAllData]);

  const handleSignOut = async () => {
    try {
      await googleSignOut();
      setCurrentUser(null);
      showToast('Signed out of Google account');
    } catch {
      showToast('Error signing out');
    }
  };

  // Sync theme with HTML root class & custom accent color
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    const brandColor = appSettings?.accentColor || getSavedAccentTheme();
    applyAccentTheme(brandColor);
  }, [theme, appSettings?.accentColor]);

  // Keyboard shortcut: Cmd+K / Ctrl+K
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

  const toggleTheme = async () => {
    const newTheme: 'light' | 'dark' = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    if (appSettings) {
      const updated: AppState = { ...appSettings, themeMode: newTheme };
      setAppSettings(updated);
      await storage.setSingleton('appSettings', updated);
    }
  };

  const handleSwitchWorkspace = async (id: string) => {
    if (!appSettings) return;
    const updated = { ...appSettings, profileId: id };
    setAppSettings(updated);
    await storage.setSingleton('appSettings', updated);
    const profName = appSettings.profiles.find(p => p.id === id)?.name || 'Workspace';
    showToast(`Switched to workspace: ${profName}`);
  };

  const handleToggleTask = async (id: string) => {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    const nextDone = !t.done;
    const updated: Task = {
      ...t,
      done: nextDone,
      status: nextDone ? 'done' : 'open',
      completedAt: nextDone ? new Date().toISOString() : null,
      updatedAt: Date.now()
    };
    await storage.put('tasks', updated);
    if (t.goalId) {
      await recalculateGoalProgress(t.goalId);
    }
    showToast(nextDone ? 'Task completed' : 'Task reopened');
    loadAllData();
  };

  const handleLogHabit = async (habitId: string, occurrence = 0) => {
    const today = new Date().toISOString().slice(0, 10);
    const key = `${habitId}|${today}|${occurrence}`;
    const existing = habitLogs.find(l => l.key === key || (l.habitId === habitId && l.date === today && (l.occurrence || 0) === occurrence));
    if (existing) {
      await storage.delete('habitLogs', existing.id);
      showToast('Habit check removed');
    } else {
      const newLog: HabitLog = {
        id: generateUUID(),
        key,
        habitId,
        date: today,
        occurrence,
        status: 'done',
        createdAt: Date.now()
      };
      await storage.put('habitLogs', newLog);
      showToast('Habit logged for today');
    }

    const allLogs = await storage.getAll<HabitLog>('habitLogs');
    const habit = habits.find(h => h.id === habitId);
    if (habit) {
      const dates = new Set(allLogs.filter(l => l.habitId === habitId).map(l => l.date));
      let streak = 0;
      const d = new Date();
      for (let i = 0; i < 365; i++) {
        const iso = d.toISOString().slice(0, 10);
        if (dates.has(iso)) {
          streak++;
        } else if (i > 0) {
          break;
        }
        d.setDate(d.getDate() - 1);
      }
      await storage.put('habits', { ...habit, streak, updatedAt: Date.now() });
    }
    loadAllData();
  };

  const handleUpdatePlannerProgress = async (prog: number) => {
    if (!appSettings) return;
    const today = new Date().toISOString().slice(0, 10);
    const current = appSettings.dailyPlanner || {
      date: today,
      target: 'Core Target',
      progress: 0,
      points: [],
      wins: [],
      reflection: []
    };
    const updatedPlanner = { ...current, progress: prog };
    const updatedSettings = { ...appSettings, dailyPlanner: updatedPlanner };
    setAppSettings(updatedSettings);
    await storage.setSingleton('appSettings', updatedSettings);
  };

  const handleTogglePlannerPoint = async (pointId: string) => {
    if (!appSettings || !appSettings.dailyPlanner) return;
    const pts = (appSettings.dailyPlanner.points || []).map(p =>
      p.id === pointId ? { ...p, done: !p.done } : p
    );
    const updatedPlanner = { ...appSettings.dailyPlanner, points: pts };
    const updatedSettings = { ...appSettings, dailyPlanner: updatedPlanner };
    setAppSettings(updatedSettings);
    await storage.setSingleton('appSettings', updatedSettings);
  };

  const openTasksCount = tasks.filter(t => !t.done).length;

  // 1. Initial auth check splash screen
  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] dark:bg-[#0B0F19] transition-colors">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 font-serif font-extrabold text-white text-2xl shadow-xl shadow-indigo-600/30 animate-pulse">
          ॐ
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
          <span>Verifying Google account session...</span>
        </div>
      </div>
    );
  }

  // 2. Mandatory Google Authentication Gate (No local mock profile)
  if (!currentUser) {
    return (
      <GoogleAuthGate
        onSignInSuccess={async (user) => {
          setCurrentUser(user);
          await syncGoogleUserProfile(user);
          await loadAllData();
          showToast(`Welcome, ${user.displayName || user.email}!`);
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col font-sans text-slate-900 selection:bg-indigo-500 selection:text-white dark:text-slate-100 bg-[#F8FAFC] dark:bg-[#0B0F19]">
      {/* Top Header */}
      <Header
        activeModule={activeModule}
        onNavigate={setActiveModule}
        onOpenQuickCapture={(type = 'task') => {
          setQuickCaptureType(type);
          setIsQuickCaptureOpen(true);
        }}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenBsModal={() => setIsBsModalOpen(true)}
        onOpenDriveSyncModal={() => setIsDriveSyncModalOpen(true)}
        currentUser={currentUser}
        onSignOut={handleSignOut}
        theme={theme}
        onToggleTheme={toggleTheme}
        profiles={appSettings?.profiles || []}
        currentProfileId={appSettings?.profileId || currentUser.uid}
        onSelectProfile={handleSwitchWorkspace}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
      />

      <div className="flex flex-1">
        {/* Navigation Sidebar */}
        <Sidebar
          activeModule={activeModule}
          onNavigate={setActiveModule}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          openTasksCount={openTasksCount}
          onOpenDriveSync={() => setIsDriveSyncModalOpen(true)}
          currentUser={currentUser}
        />

        {/* Main Workspace Canvas */}
        <main className="flex-1 min-w-0 overflow-y-auto px-3 sm:px-5 lg:px-7 py-4 sm:py-6 pb-24 lg:pb-10 transition-colors w-full">
          <div className="w-full max-w-7xl mx-auto space-y-6">
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
                onNavigate={setActiveModule}
                onToggleTask={handleToggleTask}
                onLogHabit={handleLogHabit}
                onOpenQuickCapture={type => {
                  setQuickCaptureType(type || 'task');
                  setIsQuickCaptureOpen(true);
                }}
                onUpdatePlannerProgress={handleUpdatePlannerProgress}
                onTogglePlannerPoint={handleTogglePlannerPoint}
                currentUser={currentUser}
                onOpenDriveSync={() => setIsDriveSyncModalOpen(true)}
              />
            )}

            {activeModule === 'tasks' && (
              <TasksView
                tasks={tasks}
                goals={goals}
                dailyPlanner={appSettings?.dailyPlanner}
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
                onRefresh={loadAllData}
                onSuccess={showToast}
              />
            )}

            {activeModule === 'goals' && (
              <GoalsView
                goals={goals}
                tasks={tasks}
                accounts={financeAccounts}
                onRefresh={loadAllData}
                onSuccess={showToast}
              />
            )}

            {activeModule === 'focus' && (
              <FocusView
                sessions={focusSessions}
                tasks={tasks}
                goals={goals}
                onRefresh={loadAllData}
                onSuccess={showToast}
              />
            )}

            {activeModule === 'notes' && (
              <NotesView
                notes={notes}
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

            {activeModule === 'finance' && (
              <FinanceView
                accounts={financeAccounts}
                transactions={financeTransactions}
                loans={loans}
                investments={investments}
                savingsPlans={savingsPlans}
                goals={goals}
                onRefresh={loadAllData}
                onSuccess={showToast}
              />
            )}

            {activeModule === 'health' && (
              <HealthView
                measurements={healthMeasurements}
                sleepRecords={sleepRecords}
                waterRecords={waterRecords}
                onRefresh={loadAllData}
                onSuccess={showToast}
              />
            )}

            {activeModule === 'calculator' && (
              <CalculatorView />
            )}

            {activeModule === 'settings' && (
              <SettingsView
                settings={appSettings}
                onRefresh={loadAllData}
                onSuccess={showToast}
                theme={theme}
                onToggleTheme={toggleTheme}
                onSelectProfile={handleSwitchWorkspace}
                currentUser={currentUser}
                onSignOut={handleSignOut}
                onOpenDriveSyncModal={() => setIsDriveSyncModalOpen(true)}
              />
            )}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Thumb Bar */}
      <MobileBottomNav
        activeModule={activeModule}
        onNavigate={setActiveModule}
      />

      {/* Google Drive Sovereign Cloud Sync Dialog */}
      <GoogleDriveSyncModal
        isOpen={isDriveSyncModalOpen}
        onClose={() => setIsDriveSyncModalOpen(false)}
        currentUser={currentUser}
        onDataRestored={loadAllData}
        onToast={showToast}
      />

      {/* Quick Capture Dialog */}
      <QuickCaptureModal
        isOpen={isQuickCaptureOpen}
        onClose={() => setIsQuickCaptureOpen(false)}
        initialType={quickCaptureType}
        onSuccess={showToast}
        onRefresh={loadAllData}
      />

      {/* Global Search Dialog (Cmd+K) */}
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

      {/* Full-Screen Ringing Alarm Dialog */}
      <AlarmRingingModal
        alarm={activeAlarm}
        onDismiss={async () => {
          await alarmService.dismiss();
          setActiveAlarm(null);
          loadAllData();
        }}
        onSnooze={async (mins = 5) => {
          await alarmService.snooze(mins);
          setActiveAlarm(null);
          showToast(`Alarm snoozed for ${mins} minutes`);
          loadAllData();
        }}
      />

      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed bottom-18 lg:bottom-6 right-4 lg:right-6 z-50 flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-2xl dark:bg-white dark:text-slate-900 animate-in fade-in slide-in-from-bottom-2">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
