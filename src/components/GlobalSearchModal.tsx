import React, { useState, useEffect } from 'react';
import { Search, X, CheckSquare, FileText, BookOpen, Target, DollarSign, User, ArrowRight } from 'lucide-react';
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
      return;
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
        const [tasks, notes, journal, goals, finance, people] = await Promise.all([
          storage.getAll<any>('tasks'),
          storage.getAll<any>('notes'),
          storage.getAll<any>('journal'),
          storage.getAll<any>('goals'),
          storage.getAll<any>('finance'),
          storage.getAll<any>('people')
        ]);

        if (!isSubscribed) return;

        const hits: SearchHit[] = [];

        tasks.forEach(t => {
          if ((t.title + ' ' + (t.description || '')).toLowerCase().includes(q)) {
            hits.push({
              id: t.id,
              module: 'tasks',
              type: 'Task',
              title: t.title,
              subtitle: `${t.priority} · ${t.domain || 'personal'}`,
              date: t.dueAt || t.date
            });
          }
        });

        notes.forEach(n => {
          if ((n.title + ' ' + (n.body || '') + ' ' + (n.category || '')).toLowerCase().includes(q)) {
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
          if ((j.title + ' ' + (j.text || '')).toLowerCase().includes(q)) {
            hits.push({
              id: j.id,
              module: 'journal',
              type: 'Journal',
              title: j.title,
              subtitle: 'Daily Reflection',
              date: j.date
            });
          }
        });

        goals.forEach(g => {
          if ((g.title + ' ' + (g.category || '')).toLowerCase().includes(q)) {
            hits.push({
              id: g.id,
              module: 'goals',
              type: 'Goal',
              title: g.title,
              subtitle: `${g.progress}% Complete`,
              date: g.date
            });
          }
        });

        finance.forEach(f => {
          if (((f.category || '') + ' ' + (f.note || '') + ' ' + f.type).toLowerCase().includes(q)) {
            hits.push({
              id: f.id,
              module: 'finance',
              type: 'Finance',
              title: `${f.type.toUpperCase()}: ₹${f.amount}`,
              subtitle: `${f.category || ''} ${f.note ? '· ' + f.note : ''}`,
              date: f.date
            });
          }
        });

        people.forEach(p => {
          if ((p.name + ' ' + (p.relationship || '') + ' ' + (p.contact || '')).toLowerCase().includes(q)) {
            hits.push({
              id: p.id,
              module: 'people',
              type: 'Person',
              title: p.name,
              subtitle: p.relationship || 'Contact'
            });
          }
        });

        hits.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        setResults(hits.slice(0, 50));
      } catch (err) {
        console.error('Search error', err);
      } finally {
        if (isSubscribed) setLoading(false);
      }
    };

    const timer = setTimeout(performSearch, 100);
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
      case 'Person': return <User className="h-4 w-4 text-purple-500" />;
      default: return <Search className="h-4 w-4 text-slate-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-slate-900/60 backdrop-blur-sm sm:pt-20">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type to search across everything in Om-LifeOS..."
            className="flex-1 bg-transparent px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="mr-2 text-xs text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {loading && (
            <div className="py-8 text-center text-xs text-slate-400">
              Searching database...
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="py-12 text-center text-xs text-slate-400">
              No results found for "{query}".
            </div>
          )}

          {!query && (
            <div className="p-4 text-xs text-slate-400">
              <span className="font-semibold text-slate-500 dark:text-slate-300">Search tips:</span>
              <ul className="mt-1.5 list-disc list-inside space-y-1">
                <li>Search tasks by title, category, or domain</li>
                <li>Search notes by tags, notebook name, or full text</li>
                <li>Search financial ledger records by category or payee</li>
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
                className="group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                    {getIcon(r.type)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-900 dark:text-white">
                      {r.title}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
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

                <ArrowRight className="h-3.5 w-3.5 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-600" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
