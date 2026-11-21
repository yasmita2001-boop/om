import { getCurrencySymbol } from '../lib/currencyDisplay';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search, X, CheckSquare, FileText, BookOpen, Target, DollarSign, User, ArrowRight,
  Clock, Repeat, Heart, Sparkles, Package, GraduationCap, Briefcase, Bell, PiggyBank,
  Landmark, TrendingUp, Shield, Receipt, Award, FileArchive,
  Flag, Compass, BarChart3, Rocket, ChevronDown, ChevronRight
} from 'lucide-react';
import { EmptyState } from './EmptyState';
import { storage } from '../lib/storage';
import { NavModule } from '../types';

interface FuzzyResult {
  match: boolean;
  score: number;
  indices: number[];
}

function fuzzyMatch(query: string, target: string): FuzzyResult {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) {
    const start = t.indexOf(q);
    return { match: true, score: 1000 - start, indices: Array.from({ length: q.length }, (_, i) => start + i) };
  }
  const indices: number[] = [];
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      indices.push(ti);
      qi++;
    }
  }
  if (qi < q.length) return { match: false, score: 0, indices: [] };
  const spread = indices[indices.length - 1] - indices[0];
  return { match: true, score: Math.max(1, 500 - spread * 10), indices };
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const result = fuzzyMatch(query, text);
  if (!result.match || result.indices.length === 0) return text;
  const parts: React.ReactNode[] = [];
  let last = 0;
  const idxSet = new Set(result.indices);
  for (let i = 0; i < text.length; i++) {
    if (idxSet.has(i)) {
      if (last < i) parts.push(text.slice(last, i));
      let end = i;
      while (end < text.length && idxSet.has(end)) end++;
      parts.push(<mark key={i} className="bg-amber-200/60 dark:bg-amber-500/30 rounded-sm px-0.5">{text.slice(i, end)}</mark>);
      last = end;
      i = end - 1;
    }
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function getRecentSearchesKey(): string {
  const profileId = storage.getActiveProfileId();
  return `om-recent-searches:${profileId}`;
}
function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(getRecentSearchesKey());
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveRecentSearch(query: string) {
  const key = getRecentSearchesKey();
  const recent = getRecentSearches().filter(s => s !== query);
  recent.unshift(query);
  localStorage.setItem(key, JSON.stringify(recent.slice(0, 5)));
}
function removeRecentSearch(query: string) {
  const key = getRecentSearchesKey();
  const recent = getRecentSearches().filter(s => s !== query);
  localStorage.setItem(key, JSON.stringify(recent));
}

interface SearchHit {
  id: string;
  module: NavModule;
  type: string;
  title: string;
  subtitle?: string;
  date?: string;
  score: number;
}

interface ResultGroup {
  type: string;
  items: SearchHit[];
  collapsed: boolean;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (module: NavModule, recordId?: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigate
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [totalHitsCount, setTotalHitsCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(getRecentSearches);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const resultListRef = useRef<HTMLDivElement>(null);

  const grouped = useMemo<ResultGroup[]>(() => {
    if (results.length === 0) return [];
    const map = new Map<string, SearchHit[]>();
    for (const r of results) {
      const group = map.get(r.type);
      if (group) group.push(r);
      else map.set(r.type, [r]);
    }
    return Array.from(map.entries()).map(([type, items]) => ({
      type,
      items,
      collapsed: collapsedGroups.has(type)
    }));
  }, [results, collapsedGroups]);

  const flatVisibleResults = useMemo(() => {
    const flat: SearchHit[] = [];
    for (const g of grouped) {
      if (!g.collapsed) flat.push(...g.items);
    }
    return flat;
  }, [grouped]);

  const toggleGroup = useCallback((type: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
    setActiveIndex(-1);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setSearchError('');
      setActiveIndex(-1);
      setCollapsedGroups(new Set());
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onClose(); return; }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex(prev => {
          const next = prev + 1;
          return next >= flatVisibleResults.length ? 0 : next;
        });
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex(prev => {
          const next = prev - 1;
          return next < 0 ? flatVisibleResults.length - 1 : next;
        });
        return;
      }
      if (event.key === 'Enter' && activeIndex >= 0 && activeIndex < flatVisibleResults.length) {
        event.preventDefault();
        const hit = flatVisibleResults[activeIndex];
        onNavigate(hit.module, hit.id);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, flatVisibleResults, activeIndex, onNavigate]);

  useEffect(() => {
    if (activeIndex < 0 || !resultListRef.current) return;
    const el = resultListRef.current.querySelector(`[data-result-index="${activeIndex}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }

    let isSubscribed = true;
    setLoading(true);
    setSearchError('');
    setResults([]);

    const performSearch = async () => {
      try {
        const [
          tasks, notes, journal, goals, finance, people,
          routines, habits, focusSessions, meetings, reminders,
          healthMeasurements, healthAppointments, healthNotes,
          spiritualPractices, things, documents, warranties, receipts,
          certificates, importantRecords, learningItems, skills,
          loans, investments, savingsPlans,
          milestones, strategies, kpis, missions
        ] = await Promise.all([
          storage.getAll<any>('tasks'),
          storage.getAll<any>('notes'),
          storage.getAll<any>('journal'),
          storage.getAll<any>('goals'),
          storage.getAll<any>('finance'),
          storage.getAll<any>('people'),
          storage.getAll<any>('routines'),
          storage.getAll<any>('habits'),
          storage.getAll<any>('focus'),
          storage.getAll<any>('meetings'),
          storage.getAll<any>('reminders'),
          storage.getAll<any>('healthMeasurements'),
          storage.getAll<any>('healthAppointments'),
          storage.getAll<any>('healthNotes'),
          storage.getAll<any>('spiritualPractices'),
          storage.getAll<any>('things'),
          storage.getAll<any>('documents'),
          storage.getAll<any>('warranties'),
          storage.getAll<any>('receipts'),
          storage.getAll<any>('certificates'),
          storage.getAll<any>('importantRecords'),
          storage.getAll<any>('learningItems'),
          storage.getAll<any>('skills'),
          storage.getAll<any>('loans'),
          storage.getAll<any>('investments'),
          storage.getAll<any>('savingsPlans'),
          storage.getAll<any>('milestones'),
          storage.getAll<any>('strategies'),
          storage.getAll<any>('kpis'),
          storage.getAll<any>('missions')
        ]);

        if (!isSubscribed) return;

        const hits: SearchHit[] = [];

        const tryPush = (items: any[], fields: string[], module: NavModule, type: string, titleFn: (i: any) => string, subtitleFn: (i: any) => string, dateFn: (i: any) => string | undefined) => {
          items.forEach(item => {
            const searchableText = fields.map(f => item[f]).filter(Boolean).join(' ');
            const result = fuzzyMatch(q, searchableText);
            if (result.match) {
              hits.push({ id: item.id, module, type, title: titleFn(item), subtitle: subtitleFn(item), date: dateFn(item), score: result.score });
            }
          });
        };

        tryPush(tasks, ['title', 'description', 'priority', 'domain'], 'tasks', 'Task', t => t.title, t => `${t.priority} · ${t.domain || 'personal'}`, t => t.dueAt || t.date);
        tryPush(notes, ['title', 'body', 'category', 'tags'], 'notes', 'Note', n => n.title, n => n.category || 'General', n => n.date);
        tryPush(journal, ['title', 'text'], 'journal', 'Journal', j => j.title, () => 'Daily Reflection', j => j.date);
        tryPush(goals, ['title', 'category', 'description'], 'goals', 'Goal', g => g.title, g => `${g.progress}% Complete`, g => g.date);
        finance.forEach(f => {
          const transactionType = typeof f.type === 'string' ? f.type : '';
          const searchableText = [f.category, f.note, transactionType].filter(Boolean).join(' ');
          const result = fuzzyMatch(q, searchableText);
          if (result.match) {
            hits.push({ id: f.id, module: 'finance', type: 'Finance', title: `${transactionType.toUpperCase() || 'TRANSACTION'}: ${getCurrencySymbol()} ${f.amount}`, subtitle: `${f.category || ''} ${f.note ? '· ' + f.note : ''}`, date: f.date, score: result.score });
          }
        });
        tryPush(people, ['name', 'relationship', 'contact', 'note'], 'people', 'Person', p => p.name, p => p.relationship || 'Contact', () => undefined);
        tryPush(routines, ['name', 'description'], 'routine', 'Routine', r => r.name, r => r.description || 'Daily Routine', r => r.date);
        tryPush(habits, ['name', 'category', 'description'], 'routine', 'Habit', h => h.name, h => h.category || 'Habit', h => h.date);
        tryPush(focusSessions, ['label', 'task', 'note'], 'focus', 'Focus Session', f => f.label || f.task || 'Focus Session', f => f.note || '', f => f.date);
        tryPush(meetings, ['title', 'agenda', 'notes', 'location'], 'work', 'Meeting', m => m.title, m => m.location || '', m => m.date);
        tryPush(reminders, ['title', 'note'], 'tasks', 'Reminder', r => r.title, r => r.note || '', r => r.date || r.triggerAt);
        tryPush(healthMeasurements, ['type', 'note', 'label'], 'health', 'Health', h => h.label || h.type || 'Measurement', h => h.note || '', h => h.date);
        tryPush(healthAppointments, ['title', 'doctor', 'location', 'note'], 'health', 'Appointment', h => h.title, h => h.doctor || h.location || '', h => h.date);
        tryPush(healthNotes, ['title', 'body', 'category'], 'health', 'Health Note', h => h.title, h => h.category || '', h => h.date);
        tryPush(spiritualPractices, ['name', 'type', 'description', 'note'], 'spiritual', 'Practice', s => s.name, s => s.type || 'Spiritual Practice', s => s.date);
        tryPush(things, ['name', 'category', 'location', 'note'], 'things', 'Thing', t => t.name, t => t.category || t.location || '', t => t.date);
        tryPush(documents, ['title', 'category', 'note', 'description'], 'things', 'Document', d => d.title, d => d.category || '', d => d.date);
        tryPush(warranties, ['productName', 'brand', 'note'], 'things', 'Warranty', w => w.productName, w => w.brand || '', w => w.purchaseDate || w.date);
        tryPush(receipts, ['title', 'vendor', 'category', 'note'], 'things', 'Receipt', r => r.title || r.vendor || 'Receipt', r => r.category || '', r => r.date);
        tryPush(certificates, ['title', 'issuer', 'category', 'note'], 'things', 'Certificate', c => c.title, c => c.issuer || '', c => c.date || c.issueDate);
        tryPush(importantRecords, ['title', 'category', 'note', 'description'], 'things', 'Record', r => r.title, r => r.category || '', r => r.date);
        tryPush(learningItems, ['title', 'topic', 'source', 'note'], 'work', 'Learning', l => l.title, l => l.topic || l.source || '', l => l.date);
        tryPush(skills, ['name', 'category', 'description'], 'work', 'Skill', s => s.name, s => s.category || '', s => s.date);
        tryPush(loans, ['name', 'lender', 'borrower', 'note'], 'finance', 'Loan', l => l.name || 'Loan', l => l.lender || l.borrower || '', l => l.date || l.startDate);
        tryPush(investments, ['name', 'type', 'institution', 'note'], 'finance', 'Investment', i => i.name, i => i.type || i.institution || '', i => i.date || i.startDate);
        tryPush(savingsPlans, ['name', 'goal', 'note'], 'finance', 'Savings Plan', s => s.name, s => s.goal || '', s => s.date);
        tryPush(milestones, ['title', 'description'], 'goals', 'Milestone', m => m.title, m => m.description || '', m => m.date || m.targetDate);
        tryPush(strategies, ['title', 'description'], 'goals', 'Strategy', s => s.title, s => s.description || '', s => s.date);
        tryPush(kpis, ['title', 'metric', 'description'], 'goals', 'KPI', k => k.title, k => k.metric || '', k => k.date);
        tryPush(missions, ['title', 'description'], 'goals', 'Mission', m => m.title, m => m.description || '', m => m.date);

        hits.sort((a, b) => b.score - a.score || (b.date || '').localeCompare(a.date || ''));
        if (q.length >= 2) {
          saveRecentSearch(query.trim());
          setRecentSearches(getRecentSearches());
        }
        setTotalHitsCount(hits.length);
        setResults(hits.slice(0, 50));
      } catch (err) {
        console.error('Search error', err);
        if (isSubscribed) setSearchError('Search could not read your saved data. Please retry.');
      } finally {
        if (isSubscribed) setLoading(false);
      }
    };

    const timer = setTimeout(performSearch, 300);
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
      case 'Routine': return <Repeat className="h-4 w-4 text-cyan-500" />;
      case 'Habit': return <Repeat className="h-4 w-4 text-teal-500" />;
      case 'Focus Session': return <Clock className="h-4 w-4 text-orange-500" />;
      case 'Meeting': return <Briefcase className="h-4 w-4 text-slate-600" />;
      case 'Reminder': return <Bell className="h-4 w-4 text-rose-500" />;
      case 'Health': case 'Appointment': case 'Health Note': return <Heart className="h-4 w-4 text-rose-400" />;
      case 'Practice': return <Sparkles className="h-4 w-4 text-violet-500" />;
      case 'Thing': return <Package className="h-4 w-4 text-amber-600" />;
      case 'Document': case 'Record': return <FileArchive className="h-4 w-4 text-slate-500" />;
      case 'Warranty': return <Shield className="h-4 w-4 text-blue-400" />;
      case 'Receipt': return <Receipt className="h-4 w-4 text-green-500" />;
      case 'Certificate': return <Award className="h-4 w-4 text-yellow-500" />;
      case 'Learning': return <GraduationCap className="h-4 w-4 text-indigo-400" />;
      case 'Skill': return <Briefcase className="h-4 w-4 text-cyan-600" />;
      case 'Loan': return <Landmark className="h-4 w-4 text-red-500" />;
      case 'Investment': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'Savings Plan': return <PiggyBank className="h-4 w-4 text-pink-500" />;
      case 'Milestone': return <Flag className="h-4 w-4 text-orange-500" />;
      case 'Strategy': return <Compass className="h-4 w-4 text-blue-500" />;
      case 'KPI': return <BarChart3 className="h-4 w-4 text-emerald-500" />;
      case 'Mission': return <Rocket className="h-4 w-4 text-violet-500" />;
      default: return <Search className="h-4 w-4 text-slate-400" />;
    }
  };

  let globalIdx = -1;

  return (
    <div
      className="sanctuary-search-overlay fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-slate-900/60 backdrop-blur-sm sm:pt-20"
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
      onClick={onClose}
    >
      <div className="sanctuary-glass-dialog sanctuary-search-panel w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden dark:border-slate-800 dark:bg-slate-900" onClick={e => e.stopPropagation()}>
        <div className="sanctuary-search-bar flex items-center border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Global search"
            className="sanctuary-search-input flex-1 bg-transparent px-3 text-sm text-slate-900 focus:outline-none dark:text-white"
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
            aria-label="Close search"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2" ref={resultListRef}>
          {loading && (
            <div className="py-8 text-center text-xs text-slate-400">
              Searching database...
            </div>
          )}

          {!loading && searchError && (
            <div className="mx-2 my-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {searchError}
            </div>
          )}

          {!loading && !searchError && query && results.length === 0 && (
            <EmptyState
              icon={Search}
              compact
              title={`No results for "${query}"`}
              hint="Try a different keyword"
            />
          )}

          {!query && (
            <div className="p-4 text-xs text-slate-400 space-y-3">
              {recentSearches.length > 0 && (
                <div>
                  <span className="font-semibold text-slate-500 dark:text-slate-300">Recent searches:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {recentSearches.map(s => (
                      <span key={s} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <button type="button" onClick={() => setQuery(s)} className="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer">{s}</button>
                        <button type="button" onClick={() => { removeRecentSearch(s); setRecentSearches(getRecentSearches()); }} className="text-slate-400 hover:text-rose-500 cursor-pointer"><X className="h-2.5 w-2.5" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1">
            {grouped.map(group => (
              <div key={group.type}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.type)}
                  className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  {group.collapsed
                    ? <ChevronRight className="h-3 w-3" />
                    : <ChevronDown className="h-3 w-3" />
                  }
                  <span>{group.type}</span>
                  <span className="ml-auto font-normal text-slate-400">{group.items.length}</span>
                </button>
                {!group.collapsed && group.items.map(r => {
                  globalIdx++;
                  const idx = globalIdx;
                  return (
                    <button
                      key={`${r.type}-${r.id}`}
                      type="button"
                      data-result-index={idx}
                      onClick={() => {
                        onNavigate(r.module, r.id);
                        onClose();
                      }}
                      className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition-colors ${
                        idx === activeIndex
                          ? 'bg-indigo-50 dark:bg-indigo-950/40'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                          {getIcon(r.type)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900 dark:text-white">
                            {highlightText(r.title, query)}
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

                      <ArrowRight className={`h-3.5 w-3.5 text-slate-300 transition-opacity dark:text-slate-600 ${
                        idx === activeIndex ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`} />
                    </button>
                  );
                })}
              </div>
            ))}
            {totalHitsCount > 50 && (
              <p className="mt-2 pb-2 text-center text-xs text-slate-400">Showing top 50 results — refine your search to find more</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
