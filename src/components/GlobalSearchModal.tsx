import React, { useState, useEffect } from 'react';
import {
  Search, X, CheckSquare, FileText, BookOpen, Target, DollarSign,
  ArrowRight, Repeat, Heart, Timer
} from 'lucide-react';
import { storage } from '../lib/storage';
import { NavModule } from '../types';

interface SearchHit {
  id: string;
  module: NavModule;
  type: string;
  title: string;
  subtitle?: string;
  date?: string;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (module: NavModule) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigate
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setResults([]);
      return;
    }

    let isSubscribed = true;
    setLoading(true);

    const performSearch = async () => {
      try {
        const [
          tasks, notes, journal, goals, finance,
          routines, habits, investments, loans, savingsPlans, workouts, focus
        ] = await Promise.all([
          storage.getAll<any>('tasks'),
          storage.getAll<any>('notes'),
          storage.getAll<any>('journal'),
          storage.getAll<any>('goals'),
          storage.getAll<any>('finance'),
          storage.getAll<any>('routines'),
          storage.getAll<any>('habits'),
          storage.getAll<any>('investments'),
          storage.getAll<any>('loans'),
          storage.getAll<any>('savingsPlans'),
          storage.getAll<any>('workouts'),
          storage.getAll<any>('focus')
        ]);

        if (!isSubscribed) return;
        const hits: SearchHit[] = [];

        tasks.forEach(t => {
          if ((t.title + ' ' + (t.description || '') + ' ' + (t.category || '')).toLowerCase().includes(q)) {
            hits.push({
              id: t.id,
              module: 'tasks',
              type: 'Task',
              title: t.title,
              subtitle: `${t.priority} Priority · ${t.domain || 'work'}`,
              date: t.dueAt || t.date
            });
          }
        });

        notes.forEach(n => {
          if ((n.title + ' ' + (n.body || '') + ' ' + (n.category || '') + ' ' + (n.tags || '')).toLowerCase().includes(q)) {
            hits.push({
              id: n.id,
              module: 'notes',
              type: 'Note',
              title: n.title,
              subtitle: n.category || 'General',
              date: n.date
            });
          }
        });

        journal.forEach(j => {
          if ((j.title + ' ' + (j.text || '') + ' ' + (j.tags || '')).toLowerCase().includes(q)) {
            hits.push({
              id: j.id,
              module: 'journal',
              type: 'Journal',
              title: j.title,
              subtitle: `${j.mood || 'Reflection'}`,
              date: j.date
            });
          }
        });

        goals.forEach(g => {
          if ((g.title + ' ' + (g.category || '') + ' ' + (g.notes || '')).toLowerCase().includes(q)) {
            hits.push({
              id: g.id,
              module: 'goals',
              type: 'Goal',
              title: g.title,
              subtitle: `${g.progress}% Complete`,
              date: g.targetDate
            });
          }
        });

        finance.forEach(f => {
          if (((f.category || '') + ' ' + (f.note || '') + ' ' + f.type).toLowerCase().includes(q)) {
            hits.push({
              id: f.id,
              module: 'finance',
              type: 'Finance',
              title: `${f.type.toUpperCase()}: ₹${Number(f.amount || 0).toLocaleString('en-IN')}`,
              subtitle: `${f.category || ''} ${f.note ? '· ' + f.note : ''}`,
              date: f.date
            });
          }
        });

        investments.forEach(inv => {
          if ((inv.name + ' ' + inv.type + ' ' + (inv.note || '')).toLowerCase().includes(q)) {
            hits.push({
              id: inv.id,
              module: 'finance',
              type: 'Finance',
              title: `Investment: ${inv.name}`,
              subtitle: `₹${Number(inv.currentValue || 0).toLocaleString('en-IN')} (${inv.type})`,
              date: inv.date
            });
          }
        });

        loans.forEach(l => {
          if ((l.person + ' ' + (l.note || '') + ' ' + l.type).toLowerCase().includes(q)) {
            hits.push({
              id: l.id,
              module: 'finance',
              type: 'Finance',
              title: `Loan (${l.type}): ${l.person}`,
              subtitle: `₹${Number(l.amount || 0).toLocaleString('en-IN')} · ${l.status}`,
              date: l.dueDate || l.date
            });
          }
        });

        savingsPlans.forEach(sp => {
          if ((sp.name + ' ' + sp.type + ' ' + (sp.note || '')).toLowerCase().includes(q)) {
            hits.push({
              id: sp.id,
              module: 'finance',
              type: 'Finance',
              title: `Savings: ${sp.name}`,
              subtitle: `₹${Number(sp.savedAmount || 0).toLocaleString('en-IN')} / ₹${Number(sp.targetAmount || 0).toLocaleString('en-IN')}`
            });
          }
        });

        routines.forEach(r => {
          if ((r.name + ' ' + (r.notes || '') + ' ' + r.category).toLowerCase().includes(q)) {
            hits.push({
              id: r.id,
              module: 'routine',
              type: 'Routine',
              title: r.name,
              subtitle: `${r.startTime}${r.endTime ? ' – ' + r.endTime : ''} · ${r.category}`
            });
          }
        });

        habits.forEach(h => {
          if ((h.name + ' ' + (h.cue || '') + ' ' + (h.reward || '')).toLowerCase().includes(q)) {
            hits.push({
              id: h.id,
              module: 'routine',
              type: 'Routine',
              title: `Habit: ${h.name}`,
              subtitle: `${h.streak || 0} day streak · ${h.frequency}`
            });
          }
        });

        workouts.forEach(w => {
          if ((w.type + ' ' + (w.notes || '') + ' ' + w.intensity).toLowerCase().includes(q)) {
            hits.push({
              id: w.id,
              module: 'health',
              type: 'Health',
              title: `Workout: ${w.type}`,
              subtitle: `${w.durationMinutes}m · ${w.intensity} Intensity`,
              date: w.date
            });
          }
        });

        focus.forEach(fs => {
          if (((fs.notes || '') + ' ' + fs.type).toLowerCase().includes(q)) {
            hits.push({
              id: fs.id,
              module: 'focus',
              type: 'Focus',
              title: `${fs.durationMinutes}m Focus Session`,
              subtitle: fs.notes || fs.type,
              date: fs.date
            });
          }
        });

        setResults(hits.slice(0, 35));
      } catch (err) {
        console.error('Search error', err);
      } finally {
        if (isSubscribed) setLoading(false);
      }
    };

    const timer = setTimeout(performSearch, 80);
    return () => {
      isSubscribed = false;
      clearTimeout(timer);
    };
  }, [query]);

  if (!isOpen) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'Task': return <CheckSquare className="h-4 w-4 text-emerald-500" />;
      case 'Note': return <FileText className="h-4 w-4 text-amber-500" />;
      case 'Journal': return <BookOpen className="h-4 w-4 text-blue-500" />;
      case 'Goal': return <Target className="h-4 w-4 text-indigo-500" />;
      case 'Finance': return <DollarSign className="h-4 w-4 text-emerald-600" />;
      case 'Routine': return <Repeat className="h-4 w-4 text-purple-500" />;
      case 'Health': return <Heart className="h-4 w-4 text-rose-500" />;
      case 'Focus': return <Timer className="h-4 w-4 text-indigo-500" />;
      default: return <Search className="h-4 w-4 text-slate-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 pt-12 sm:pt-20 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-100">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tasks, notes, goals, routines, ledger, workouts..."
            className="flex-1 bg-transparent px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="mr-2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {loading && (
            <div className="py-8 text-center text-xs text-slate-400">
              Searching sovereign database...
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="py-10 text-center text-xs text-slate-400">
              No results found for "{query}".
            </div>
          )}

          {!query && (
            <div className="p-4 text-xs text-slate-400">
              <span className="font-semibold text-slate-500 dark:text-slate-300">Quick Search Across All Modules:</span>
              <ul className="mt-1 list-disc list-inside space-y-1">
                <li>Tasks, Goals, Routines, and Atomic Habits</li>
                <li>Knowledge Vault Notes and Daily Journal Reflections</li>
                <li>Finance Ledger, Investments, Loans, Savings, and Workouts</li>
              </ul>
            </div>
          )}

          <div className="space-y-1">
            {results.map(r => (
              <button
                key={`${r.type}-${r.id}`}
                type="button"
                onClick={() => {
                  onNavigate(r.module);
                  onClose();
                }}
                className="group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                    {getIcon(r.type)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-900 dark:text-white">
                      {r.title}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span>{r.type}</span>
                      {r.subtitle && (
                        <>
                          <span>·</span>
                          <span className="truncate">{r.subtitle}</span>
                        </>
                      )}
                      {r.date && (
                        <>
                          <span>·</span>
                          <span>{r.date}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-indigo-500 dark:text-slate-600 transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
