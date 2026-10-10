import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar, Trash2, Edit3,
  Copy, Check, Search, Volume2, Link2, Target
} from 'lucide-react';
import { JournalEntry, Goal } from '../types';
import { storage, generateUUID } from '../lib/storage';
import { syncGoalProgressFromJournal } from '../lib/goalTaskSync';
import { ConfirmModal } from '../components/ConfirmModal';
import { AttachmentUploader, AttachmentViewer, StoredAttachmentMeta } from '../components/AttachmentUploader';
import { globalTextReader } from '../lib/voiceService';
import { NoteRichEditor } from '../components/NoteRichEditor';

interface JournalViewProps {
  journal: JournalEntry[];
  goals?: Goal[];
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
}

export const JournalView: React.FC<JournalViewProps> = ({
  journal,
  goals = [],
  onRefresh,
  onSuccess
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState('');
  const [journalInputMode, setJournalInputMode] = useState<'manual' | 'link'>('manual');
  const [journalGoalId, setJournalGoalId] = useState<string>('');
  const [date, setDate] = useState(today);
  const [colorTheme, setColorTheme] = useState('sky');
  const [mood, setMood] = useState('Productive');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMoodFilter, setSelectedMoodFilter] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<JournalEntry | null>(null);
  const [attachments, setAttachments] = useState<StoredAttachmentMeta[]>([]);
  const [journalHtml, setJournalHtml] = useState('');
  const [journalText, setJournalText] = useState('');
  const formRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const handleSelectGoalForJournal = (gId: string) => {
    setJournalGoalId(gId);
    if (!gId) return;
    const matched = goals.find(g => g.id === gId);
    if (matched) {
      if (!title.trim() || goals.some(g => title.includes(g.title))) {
        setTitle(`Reflection: ${matched.title}`);
      }
    }
  };

  // Journal Text Reading State for cards
  const [speakingEntryId, setSpeakingEntryId] = useState<string | null>(null);

  // Toggle read reflection aloud for individual entry card
  const toggleSpeakEntry = (j: JournalEntry) => {
    if (speakingEntryId === j.id) {
      globalTextReader.stop();
      setSpeakingEntryId(null);
    } else {
      globalTextReader.stop();
      const textToRead = (j.title ? j.title + '. ' : '') + (j.text || j.html?.replace(/<[^>]+>/g, ' ') || '');
      if (!textToRead.trim()) return;
      setSpeakingEntryId(j.id);
      globalTextReader.speak(textToRead, {
        onStateChange: (st) => {
          if (!st.isSpeaking) {
            setSpeakingEntryId(null);
          }
        }
      });
    }
  };

  const moodOptions = [
    { label: 'Productive', icon: '⚡' },
    { label: 'Peaceful', icon: '😌' },
    { label: 'Inspired', icon: '🌟' },
    { label: 'Deep Focus', icon: '🧘' },
    { label: 'Challenged', icon: '🌧' }
  ];

  const themePalettes: Record<string, { label: string; swatch: string; cardClass: string }> = {
    sky: {
      label: 'Calm Sky',
      swatch: '#38bdf8',
      cardClass: 'bg-sky-50/70 border-sky-200/80 dark:bg-sky-950/20 dark:border-sky-800/40 hover:border-sky-300 dark:hover:border-sky-700/60'
    },
    amber: {
      label: 'Warm Sunrise',
      swatch: '#fbbf24',
      cardClass: 'bg-amber-50/70 border-amber-200/80 dark:bg-amber-950/20 dark:border-amber-800/40 hover:border-amber-300 dark:hover:border-amber-700/60'
    },
    emerald: {
      label: 'Verdant Forest',
      swatch: '#34d399',
      cardClass: 'bg-emerald-50/70 border-emerald-200/80 dark:bg-emerald-950/20 dark:border-emerald-800/40 hover:border-emerald-300 dark:hover:border-emerald-700/60'
    },
    violet: {
      label: 'Twilight Violet',
      swatch: '#a78bfa',
      cardClass: 'bg-purple-50/70 border-purple-200/80 dark:bg-purple-950/20 dark:border-purple-800/40 hover:border-purple-300 dark:hover:border-purple-700/60'
    },
    slate: {
      label: 'Clean Slate',
      swatch: '#94a3b8',
      cardClass: 'bg-white border-slate-200/90 dark:bg-slate-900/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
    }
  };

  const getTheme = (colorVal?: string) => {
    if (!colorVal) return themePalettes.sky;
    if (themePalettes[colorVal]) return themePalettes[colorVal];
    if (colorVal.includes('amber') || colorVal.includes('fef9c3')) return themePalettes.amber;
    if (colorVal.includes('green') || colorVal.includes('f0fdf4')) return themePalettes.emerald;
    if (colorVal.includes('purple') || colorVal.includes('f5f3ff')) return themePalettes.violet;
    return themePalettes.sky;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const html = journalHtml;
    const text = journalText;
    if (!text.trim() && !title.trim()) return;

    const now = Date.now();
    const serializedAttachments = attachments.map(a => JSON.stringify(a));
    const effectiveGoalId = journalInputMode === 'link' && journalGoalId ? journalGoalId : null;

    if (editingId) {
      const existing = journal.find(j => j.id === editingId);
      if (existing) {
        const oldGoalId = existing.goalId;
        const updated: JournalEntry = {
          ...existing,
          title: title.trim() || 'Daily Reflection',
          text,
          html,
          date,
          color: colorTheme,
          mood,
          goalId: effectiveGoalId,
          attachments: serializedAttachments.length > 0 ? serializedAttachments : undefined,
          updatedAt: now
        };
        await storage.put('journal', updated);
        if (effectiveGoalId) {
          await syncGoalProgressFromJournal(effectiveGoalId, updated.id);
        }
        if (oldGoalId && oldGoalId !== effectiveGoalId) {
          await syncGoalProgressFromJournal(oldGoalId);
        }
        onSuccess(effectiveGoalId ? '✓ Journal reflection updated & linked to Goal' : '✓ Journal reflection updated');
      }
    } else {
      const newEntry: JournalEntry = {
        id: generateUUID(),
        title: title.trim() || 'Daily Reflection',
        text,
        html,
        date,
        color: colorTheme,
        mood,
        goalId: effectiveGoalId,
        attachments: serializedAttachments.length > 0 ? serializedAttachments : undefined,
        createdAt: now,
        updatedAt: now
      };
      await storage.put('journal', newEntry);
      if (effectiveGoalId) {
        await syncGoalProgressFromJournal(effectiveGoalId, newEntry.id);
      }
      onSuccess(effectiveGoalId ? '✓ Journal reflection recorded & linked to Goal' : '✓ Journal reflection recorded');
    }

    resetForm();
    onRefresh();
  };

  const handleEdit = (entry: JournalEntry) => {
    setEditingId(entry.id);
    setTitle(entry.title);
    setJournalGoalId(entry.goalId || '');
    setJournalInputMode(entry.goalId ? 'link' : 'manual');
    setDate(entry.date);
    setColorTheme(entry.color && themePalettes[entry.color] ? entry.color : 'sky');
    setMood(entry.mood || 'Productive');
    const parsedAtts: StoredAttachmentMeta[] = (entry.attachments || []).map(a => {
      try {
        return typeof a === 'string' ? JSON.parse(a) : a;
      } catch {
        return { id: a, name: a, type: 'file', size: 0 };
      }
    });
    setAttachments(parsedAtts);
    setJournalHtml(entry.html || entry.text);
    setJournalText(entry.text || '');

    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => {
      titleInputRef.current?.focus();
    }, 150);
  };

  const handleCopy = async (entry: JournalEntry) => {
    const fullText = `${entry.title} (${entry.date})\nMood: ${entry.mood || 'Reflective'}\n\n${entry.text || ''}`;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(null), 2000);
      onSuccess('Copied to clipboard');
    } catch {
      onSuccess('Copy unavailable');
    }
  };

  const handleDelete = (entry: JournalEntry) => {
    setEntryToDelete(entry);
  };

  const handleConfirmDelete = async () => {
    if (!entryToDelete) return;
    try {
      const deletedGoalId = entryToDelete.goalId;
      await storage.delete('journal', entryToDelete.id);
      if (deletedGoalId) {
        await syncGoalProgressFromJournal(deletedGoalId);
      }
      onSuccess('✓ Journal entry deleted');
      setEntryToDelete(null);
      if (editingId === entryToDelete.id) {
        resetForm();
      }
      onRefresh();
    } catch (err) {
      console.error('Failed to delete journal entry', err);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setJournalGoalId('');
    setJournalInputMode('manual');
    setDate(today);
    setColorTheme('sky');
    setMood('Productive');
    setAttachments([]);
    setJournalHtml('');
    setJournalText('');
  };

  const sortedEntries = [...journal].sort((a, b) => {
    const d = (b.date || '').localeCompare(a.date || '');
    if (d !== 0) return d;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  const filteredEntries = sortedEntries.filter(j => {
    if (selectedMoodFilter === '__linked_goals__') {
      if (!j.goalId) return false;
    } else if (selectedMoodFilter !== 'all' && j.mood !== selectedMoodFilter) {
      return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const linkedGoalTitle = j.goalId ? (goals.find(g => g.id === j.goalId)?.title || '') : '';
    return `${j.title} ${j.text} ${j.mood || ''} ${j.date} ${linkedGoalTitle}`.toLowerCase().includes(q);
  });

  const linkedJournalCount = journal.filter(j => Boolean(j.goalId)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            Daily Journal & Philosophical Reflections
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Journal Editor (5 cols) */}
        <div
          ref={formRef}
          className={`lg:col-span-5 rounded-2xl border transition-all ${
            editingId
              ? 'border-indigo-400 bg-indigo-50/20 dark:border-indigo-500/50 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20'
              : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
          } p-5 sm:p-6 shadow-xs`}
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 text-xs">
                📖
              </span>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {editingId ? 'Edit Entry' : 'Record Reflection'}
              </h2>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSave} className="mt-4 space-y-3.5">
            {/* REFLECTION TITLE WITH INTEGRATED LINK GOAL / MANUAL TOGGLE (As in image.png) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Reflection Title / Headline
                </label>
                {/* Mode Selector: Link Goal vs Manual */}
                <div className="flex items-center rounded-lg bg-slate-200/80 p-0.5 dark:bg-slate-700/80">
                  <button
                    type="button"
                    onClick={() => {
                      setJournalInputMode('link');
                      if (goals.length > 0 && !journalGoalId) {
                        handleSelectGoalForJournal(goals[0].id);
                      }
                    }}
                    className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer ${
                      journalInputMode === 'link'
                        ? 'bg-white text-indigo-600 shadow-2xs dark:bg-slate-900 dark:text-indigo-400'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <Link2 className="h-3 w-3" />
                    <span>Link Goal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setJournalInputMode('manual');
                      setJournalGoalId('');
                    }}
                    className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer ${
                      journalInputMode === 'manual'
                        ? 'bg-white text-indigo-600 shadow-2xs dark:bg-slate-900 dark:text-indigo-400'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <span>Manual</span>
                  </button>
                </div>
              </div>

              {journalInputMode === 'link' && (
                <div className="mb-2.5 space-y-1.5 rounded-xl border border-indigo-200/80 bg-indigo-50/60 p-2.5 dark:border-indigo-900/60 dark:bg-indigo-950/30">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                      Select Target Goal to Link *
                    </label>
                    {journalGoalId && (
                      <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                        {goals.find(g => g.id === journalGoalId)?.progress}% Done
                      </span>
                    )}
                  </div>
                  <select
                    value={journalGoalId}
                    onChange={e => handleSelectGoalForJournal(e.target.value)}
                    className="h-8.5 w-full rounded-lg border border-indigo-300 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-indigo-700 dark:bg-slate-900 dark:text-white cursor-pointer font-medium"
                  >
                    <option value="">-- Choose Goal (🎯 Main, 🔹 Sub, ▫️ Micro, 🔸 Nano, ⚡ Atomic) --</option>
                    {goals.map(g => {
                      const lvl = g.level === 5 ? '⚡ Atomic' : g.level === 4 ? '🔸 Nano' : g.level === 3 ? '▫️ Micro' : g.level === 2 ? '🔹 Sub' : '🎯 Main';
                      return (
                        <option key={g.id} value={g.id}>
                          {lvl}: {g.title} ({g.progress}%)
                        </option>
                      );
                    })}
                  </select>
                  {journalGoalId && (
                    <span className="block text-[10px] text-indigo-800 dark:text-indigo-300">
                      ⚡ Recording this reflection links your philosophical insights directly to this goal's hierarchy!
                    </span>
                  )}
                </div>
              )}

              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Navigating strategic ambiguity"
                className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Dominant State / Mood
                </label>
                <select
                  value={mood}
                  onChange={e => setMood(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {moodOptions.map(m => (
                    <option key={m.label} value={m.label}>{m.icon} {m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Theme Swatches */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Entry Color Theme
              </label>
              <div className="mt-1.5 flex gap-2">
                {Object.entries(themePalettes).map(([k, t]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setColorTheme(k)}
                    className={`h-7 w-7 rounded-xl border flex items-center justify-center transition-all ${
                      colorTheme === k
                        ? 'border-indigo-600 ring-2 ring-indigo-500/30 scale-105'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                    title={t.label}
                  >
                    <span
                      className="h-4 w-4 rounded-lg shadow-xs"
                      style={{ backgroundColor: t.swatch }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Introspection & Thoughts
              </label>
              <NoteRichEditor
                initialHtml={journalHtml}
                onChange={(html, text) => {
                  setJournalHtml(html);
                  setJournalText(text);
                }}
                placeholder=""
                minHeight="min-h-[160px]"
                maxHeight="max-h-[380px]"
              />
            </div>

            {/* Attached Files Section */}
            <div>
              <AttachmentUploader
                attachments={attachments}
                onChange={setAttachments}
                label="Attach Files & Media"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 active:scale-98 transition-transform cursor-pointer"
            >
              {editingId ? 'Update Reflection' : '＋ Save Reflection'}
            </button>
          </form>
        </div>

        {/* Journal Timeline Archive (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 dark:border-slate-800">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Journal Timeline ({filteredEntries.length})
              </h2>
              <span className="text-[11px] text-slate-400">Chronological Archive</span>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search reflections by word, mood, or date..."
                className="h-9 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Mood / Category Filter Tabs */}
            <div className="flex overflow-x-auto pb-1 gap-2 no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedMoodFilter('all')}
                className={`rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold whitespace-nowrap tracking-normal transition-all cursor-pointer ${
                  selectedMoodFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/80'
                }`}
              >
                All Entries ({journal.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedMoodFilter('__linked_goals__')}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold whitespace-nowrap tracking-normal transition-all cursor-pointer ${
                  selectedMoodFilter === '__linked_goals__'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/60'
                }`}
              >
                <Target className="h-3.5 w-3.5" />
                <span>Goal Linked ({linkedJournalCount})</span>
              </button>
              {moodOptions.map(m => {
                const count = journal.filter(j => j.mood === m.label).length;
                return (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => setSelectedMoodFilter(m.label)}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold whitespace-nowrap tracking-normal transition-all cursor-pointer ${
                      selectedMoodFilter === m.label
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/80'
                    }`}
                  >
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                    <span>({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3.5">
            {filteredEntries.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                No journal reflections found. Record today's entry on the left.
              </div>
            ) : (
              filteredEntries.map(j => {
                const theme = getTheme(j.color);
                const moodObj = moodOptions.find(m => m.label === j.mood);
                const linkedGoal = j.goalId ? goals.find(g => g.id === j.goalId) : null;
                return (
                  <div
                    key={j.id}
                    className={`relative rounded-2xl border p-4 sm:p-5 shadow-xs transition-all card-hover ${theme.cardClass}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {j.title}
                          </h3>
                          {j.mood && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-white/70 dark:bg-slate-800/70 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                              <span>{moodObj?.icon || '•'}</span>
                              <span>{j.mood}</span>
                            </span>
                          )}
                          {linkedGoal && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50/90 dark:bg-indigo-950/70 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 truncate max-w-[180px]">
                              <Target className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">{linkedGoal.title}</span>
                              <span>({linkedGoal.progress}%)</span>
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                          <Calendar className="h-3 w-3" />
                          <span className="font-mono">{j.date}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleSpeakEntry(j)}
                          className={`p-1 rounded-md transition-colors cursor-pointer ${
                            speakingEntryId === j.id
                              ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950 animate-pulse'
                              : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                          title={speakingEntryId === j.id ? "Stop reading" : "Read reflection aloud (Hindi & English)"}
                        >
                          <Volume2 className={`h-3.5 w-3.5 ${speakingEntryId === j.id ? 'animate-bounce' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(j)}
                          className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                          title="Copy text"
                        >
                          {copiedId === j.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(j)}
                          className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                          title="Edit reflection"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(j)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Delete reflection"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div
                      className="mt-3 text-xs text-slate-700 dark:text-slate-300 leading-relaxed om-rich-rendered"
                      dangerouslySetInnerHTML={{ __html: j.html || (j.text ? j.text.replace(/\n/g, '<br/>') : '') }}
                    />

                    {/* Attached files indicator / download list */}
                    {j.attachments && j.attachments.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-black/5 dark:border-white/5">
                        <AttachmentViewer attachments={j.attachments} compact={true} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* CONFIRM DELETE JOURNAL MODAL */}
      <ConfirmModal
        isOpen={Boolean(entryToDelete)}
        title="Delete Reflection?"
        message={
          entryToDelete
            ? `Are you sure you want to delete "${entryToDelete.title}"?`
            : ''
        }
        confirmText="Delete Reflection"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setEntryToDelete(null)}
      />
    </div>
  );
};
