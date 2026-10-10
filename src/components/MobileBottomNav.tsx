import React, { useState } from 'react';
import {
  LayoutDashboard, CheckSquare, Repeat, Briefcase,
  Target, MoreHorizontal, FileText, BookOpen, Calculator,
  DollarSign, Heart, Users, Compass, Folder, Settings,
  X, Lock
} from 'lucide-react';
import { NavModule } from '../types';

interface MobileBottomNavProps {
  activeModule: NavModule;
  onNavigate: (module: NavModule) => void;
  onLockApp?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeModule,
  onNavigate,
  onLockApp,
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const primaryTabs: { id: NavModule; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Home', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'goals', label: 'Goals', icon: <Target className="h-4 w-4" /> },
    { id: 'tasks', label: 'Tasks', icon: <CheckSquare className="h-4 w-4" /> },
    { id: 'routine', label: 'Routines', icon: <Repeat className="h-4 w-4" /> },
    { id: 'work', label: 'Work', icon: <Briefcase className="h-4 w-4" /> },
  ];

  const secondaryModules: { id: NavModule; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'notes', label: 'Notes & Wiki', icon: <FileText className="h-4 w-4 text-amber-500" />, desc: 'Rich notes & attachments' },
    { id: 'journal', label: 'Daily Journal', icon: <BookOpen className="h-4 w-4 text-blue-500" />, desc: 'Reflections & history' },
    { id: 'finance', label: 'Finance & Ledger', icon: <DollarSign className="h-4 w-4 text-emerald-500" />, desc: 'Accounts, budgets & cash' },
    { id: 'calculator', label: 'Calculators', icon: <Calculator className="h-4 w-4 text-purple-500" />, desc: 'Financial & date formulas' },
    { id: 'health', label: 'Health & Vitals', icon: <Heart className="h-4 w-4 text-rose-500" />, desc: 'Sleep, water & biometric logs' },
    { id: 'people', label: 'People & Relations', icon: <Users className="h-4 w-4 text-cyan-500" />, desc: 'Network & interactions' },
    { id: 'spiritual', label: 'Values & Mind', icon: <Compass className="h-4 w-4 text-indigo-500" />, desc: 'Core virtues & practices' },
    { id: 'things', label: 'Things & Assets', icon: <Folder className="h-4 w-4 text-yellow-500" />, desc: 'Warranties & inventory' },
    { id: 'settings', label: 'Settings & Sync', icon: <Settings className="h-4 w-4 text-slate-500" />, desc: 'Backup, alarms & profiles' },
  ];

  const handleSelect = (id: NavModule) => {
    onNavigate(id);
    setIsMoreOpen(false);
  };

  return (
    <>
      {/* Mobile Drawer / Quick Launcher Sheet */}
      {isMoreOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/70 backdrop-blur-sm md:hidden animate-in fade-in duration-200">
          <div
            className="flex-1"
            onClick={() => setIsMoreOpen(false)}
          />
          <div className="rounded-t-3xl border-t border-slate-200 bg-white p-5 pb-8 shadow-2xl dark:border-white/10 dark:bg-[#111827] animate-in slide-in-from-bottom duration-250 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 font-serif font-bold text-white text-xs">
                  ॐ
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">All Workspaces & Modules</h3>
                  <p className="text-[10px] text-slate-400">Quickly switch to any life operating domain</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreOpen(false)}
                className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-4">
              {secondaryModules.map(mod => {
                const isActive = activeModule === mod.id;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => handleSelect(mod.id)}
                    className={`flex items-start gap-2.5 rounded-2xl p-3 text-left transition-all border cursor-pointer ${
                      isActive
                        ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200'
                        : 'border-slate-200/80 bg-slate-50/60 hover:bg-slate-100 dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.07] text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="mt-0.5 rounded-lg p-1.5 bg-white dark:bg-slate-800 shadow-2xs shrink-0">
                      {mod.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate">{mod.label}</div>
                      <div className="text-[10px] text-slate-400 truncate">{mod.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {onLockApp && (
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreOpen(false);
                    onLockApp();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 py-2.5 text-xs font-bold text-rose-700 dark:text-rose-300"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>Lock Workspace App</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Persistent Bottom Bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 pb-safe items-center justify-around border-t border-slate-200/80 bg-white/95 px-1 backdrop-blur-md dark:border-white/[0.08] dark:bg-[#0B0F19]/95 md:hidden shadow-lg transition-colors">
        {primaryTabs.map(tab => {
          const isActive = activeModule === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 px-1 transition-all cursor-pointer ${
                isActive
                  ? 'font-bold text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <div className={`transition-transform ${isActive ? 'scale-110' : ''}`}>
                {tab.icon}
              </div>
              <span className="text-[10px] tracking-normal leading-tight">{tab.label}</span>
            </button>
          );
        })}

        {/* More Launcher Button */}
        <button
          type="button"
          onClick={() => setIsMoreOpen(true)}
          className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 px-1 transition-all cursor-pointer ${
            secondaryModules.some(m => m.id === activeModule)
              ? 'font-bold text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
          }`}
          aria-label="More workspaces"
        >
          <div className="transition-transform">
            <MoreHorizontal className="h-4 w-4" />
          </div>
          <span className="text-[10px] tracking-normal leading-tight">More</span>
        </button>
      </nav>
    </>
  );
};
