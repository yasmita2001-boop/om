import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar, Trash2, Edit3,
  Copy, Check, Search, Volume2, Target, X, ChevronDown, Plus
} from 'lucide-react';
import { JournalEntry, Goal } from '../types';
import { storage, generateUUID } from '../lib/storage';
import { getLocalDateString } from '../lib/dateUtils';
import { syncGoalProgressFromJournal } from '../lib/goalTaskSync';
import { ConfirmModal } from '../components/ConfirmModal';
import { AttachmentUploader, AttachmentViewer, StoredAttachmentMeta } from '../components/AttachmentUploader';
import { globalTextReader } from '../lib/voiceService';
import { NoteRichEditor } from '../components/NoteRichEditor';
import { htmlToPlainText, plainTextToHtml, sanitizeHtml } from '../lib/sanitizeHtml';
import { ProgressiveActions } from '../components/ProgressiveActions';
import { LinkModeSelector } from '../components/LinkModeSelector';
import { FormDisclosureToggle } from '../components/FormDisclosure';

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
  const today = getLocalDateString();
  const [title, setTitle] = useState('');
  const [journalInputMode, setJournalInputMode] = useState<'manual' | 'link'>('manual');
  const [journalGoalId, setJournalGoalId] = useState<string>('');
  const [date, setDate] = useState(today);
  const [colorTheme, setColorTheme] = useState('slate');
  const [customColor, setCustomColor] = useState('#b88648');
  const [mood, setMood] = useState('Productive');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMoodFilter, setSelectedMoodFilter] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [viewingEntry, setViewingEntry] = useState<JournalEntry | null>(null);
  const [archiveControlsOpen, setArchiveControlsOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<JournalEntry | null>(null);
  const [attachments, setAttachments] = useState<StoredAttachmentMeta[]>([]);
  const [journalHtml, setJournalHtml] = useState('');
  const [journalText, setJournalText] = useState('');
  const [rightColumnEntryCount, setRightColumnEntryCount] = useState(2);
  const formRef = useRef<HTMLDivElement>(null);
  const archiveFiltersRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!viewingEntry) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setViewingEntry(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingEntry]);

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
    slate: {
      label: 'Default',
      swatch: '#94a3b8',
      cardClass: 'bg-white border-slate-200/90 dark:bg-slate-900/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
    },
    red: {
      label: 'Ruby Red',
      swatch: '#ef4444',
      cardClass: 'bg-red-50/70 border-red-200/80 dark:bg-red-950/20 dark:border-red-800/40 hover:border-red-300 dark:hover:border-red-700/60'
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
    indigo: {
      label: 'Midnight Indigo',
      swatch: '#6366f1',
      cardClass: 'bg-indigo-50/70 border-indigo-200/80 dark:bg-indigo-950/20 dark:border-indigo-800/40 hover:border-indigo-300 dark:hover:border-indigo-700/60'
    },
    violet: {
      label: 'Twilight Violet',
      swatch: '#a78bfa',
      cardClass: 'bg-purple-50/70 border-purple-200/80 dark:bg-purple-950/20 dark:border-purple-800/40 hover:border-purple-300 dark:hover:border-purple-700/60'
    },
    custom: {
      label: 'Custom Color',
      swatch: customColor,
      cardClass: 'bg-white border-slate-200/90 dark:bg-slate-900/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
    }
  };

  const getTheme = (colorVal?: string) => {
    if (!colorVal) return themePalettes.slate;
    if (colorVal.startsWith('#')) return { ...themePalettes.custom, swatch: colorVal, label: 'Custom Color' };
    if (themePalettes[colorVal]) return themePalettes[colorVal];
    if (colorVal.includes('amber') || colorVal.includes('fef9c3')) return themePalettes.amber;
    if (colorVal.includes('green') || colorVal.includes('f0fdf4')) return themePalettes.emerald;
    if (colorVal.includes('purple') || colorVal.includes('f5f3ff')) return themePalettes.violet;
    return themePalettes.slate;
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
          color: colorTheme === 'custom' ? customColor : colorTheme,
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
        color: colorTheme === 'custom' ? customColor : colorTheme,
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
    setIsEditorOpen(true);
    setEditingId(entry.id);
    setTitle(entry.title);
    setJournalGoalId(entry.goalId || '');
    setJournalInputMode(entry.goalId ? 'link' : 'manual');
    setDate(entry.date);
    setColorTheme(entry.color && themePalettes[entry.color] ? entry.color : entry.color?.startsWith('#') ? 'custom' : 'slate');
    setCustomColor(entry.color?.startsWith('#') ? entry.color : '#b88648');
    setMood(entry.mood || 'Productive');
    const parsedAtts: StoredAttachmentMeta[] = (entry.attachments || []).map(a => {
      try {
        return typeof a === 'string' ? JSON.parse(a) : a;
      } catch {
        return { id: a, name: a, type: 'file', size: 0 };
      }
    });
    setAttachments(parsedAtts);
    setJournalHtml(entry.html || plainTextToHtml(entry.text || ''));
    setJournalText(entry.text || htmlToPlainText(entry.html || ''));

  };

  useEffect(() => {
    if (!isEditorOpen || !editingId) return;
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    titleInputRef.current?.focus();
  }, [isEditorOpen, editingId]);

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
    setIsEditorOpen(false);
    setTitle('');
    setJournalGoalId('');
    setJournalInputMode('manual');
    setDate(today);
    setColorTheme('slate');
    setCustomColor('#b88648');
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

  useEffect(() => {
    const form = formRef.current;
    const archiveFilters = archiveFiltersRef.current;
    if (!isEditorOpen || !form || !archiveFilters) {
      setRightColumnEntryCount(0);
      return;
    }

    const updateRightColumnEntryCount = () => {
      if (window.innerWidth < 1024) {
        setRightColumnEntryCount(Math.min(2, filteredEntries.length));
        return;
      }

      const availableHeight = form.getBoundingClientRect().height
        - archiveFilters.getBoundingClientRect().height
        - 16;
      const rowHeightWithGap = 336;
      const rowCount = Math.max(1, Math.round((availableHeight + 16) / rowHeightWithGap));
      setRightColumnEntryCount(Math.min(filteredEntries.length, rowCount * 2));
    };

    const resizeObserver = new ResizeObserver(updateRightColumnEntryCount);
    resizeObserver.observe(form);
    resizeObserver.observe(archiveFilters);
    updateRightColumnEntryCount();
    return () => resizeObserver.disconnect();
  }, [archiveControlsOpen, filteredEntries.length, isEditorOpen, editingId]);

  const renderEntryCard = (j: JournalEntry) => {
    const theme = getTheme(j.color);
    const moodObj = moodOptions.find(m => m.label === j.mood);
    const linkedGoal = j.goalId ? goals.find(g => g.id === j.goalId) : null;
    return (
      <article
        key={j.id}
        role="button"
        tabIndex={0}
        aria-label={`Open reflection: ${j.title}`}
        onClick={() => setViewingEntry(j)}
        onKeyDown={event => {
          if (event.target !== event.currentTarget) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setViewingEntry(j);
          }
        }}
        className={`progressive-row relative flex h-80 cursor-pointer flex-col overflow-hidden rounded-2xl border p-4 sm:p-5 shadow-card transition-all card-hover ${theme.cardClass}`}
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

          <ProgressiveActions label={`More actions for ${j.title}`} className="shrink-0">
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
          </ProgressiveActions>
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-hidden">
          <div
            className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed om-rich-rendered"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(j.html || plainTextToHtml(j.text || '')) }}
          />

          {j.attachments && j.attachments.length > 0 && (
            <div className="mt-3 border-t border-black/5 pt-2 dark:border-white/5" onClick={event => event.stopPropagation()}>
              <AttachmentViewer attachments={j.attachments} compact={true} />
            </div>
          )}
        </div>

        <div className="mt-2 shrink-0 border-t border-black/5 pt-2 text-center text-[10px] font-medium text-slate-500 dark:border-white/10 dark:text-slate-400">
          Click to read full reflection
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            Daily Journal & Philosophical Reflections
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            aria-expanded={archiveControlsOpen}
            aria-controls="journal-archive-controls"
            onClick={() => setArchiveControlsOpen(open => !open)}
            className={`inline-flex items-center justify-center gap-2 border-b-0 px-3.5 py-2 text-xs font-semibold transition-colors ${
              archiveControlsOpen
                ? 'text-amber-700 dark:text-amber-300'
                : 'border-transparent text-amber-800 hover:border-amber-500 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
            }`}
          >
            <span>Journal Timeline ({filteredEntries.length})</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${archiveControlsOpen ? 'rotate-180' : ''}`} />
          </button>
          <FormDisclosureToggle
            label="New Reflection"
            openLabel="Close Reflection"
            isOpen={isEditorOpen}
            onToggle={() => setIsEditorOpen(open => !open)}
            icon={<Plus className="h-3.5 w-3.5" />}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 items-start items-start gap-6 lg:grid-cols-12">
        {/* Journal Editor (5 cols) */}
        {(isEditorOpen || Boolean(editingId)) && <div
          ref={formRef}
          className={`min-w-0 lg:col-span-5 rounded-2xl border transition-all ${
            editingId
              ? 'border-indigo-400 bg-indigo-50/20 dark:border-indigo-500/50 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20'
              : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
          } p-5 sm:p-6 shadow-card`}
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
            {!editingId && (
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                aria-label="Close reflection editor"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
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
                <LinkModeSelector
                  value={journalInputMode}
                  ariaLabel="Journal goal link mode"
                  className="journal-reflection-mode"
                  options={[{ value: 'link', label: 'Link Goal' }, { value: 'manual', label: 'Manual' }]}
                  onChange={mode => {
                    if (mode === 'link') {
                      setJournalInputMode('link');
                      if (goals.length > 0 && !journalGoalId) handleSelectGoalForJournal(goals[0].id);
                    } else {
                      setJournalInputMode('manual');
                      setJournalGoalId('');
                    }
                  }}
                />
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
                className="journal-reflection-field h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                  className="journal-reflection-field mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Dominant State / Mood
                </label>
                <select
                  value={mood}
                  onChange={e => setMood(e.target.value)}
                  className="journal-reflection-field mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {['slate', 'red', 'amber', 'emerald', 'indigo', 'violet'].map((k) => {
                  const t = themePalettes[k];
                  const isSelected = colorTheme === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setColorTheme(k)}
                      aria-label={t.label}
                      aria-pressed={isSelected}
                      className={`h-7 w-7 rounded-xl border flex items-center justify-center transition-all ${
                        isSelected
                          ? 'border-amber-500 ring-2 ring-amber-500/30 scale-105'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                      title={t.label}
                    >
                      <span
                        className="h-4 w-4 rounded-lg shadow-xs"
                        style={{ backgroundColor: t.swatch }}
                      />
                    </button>
                  );
                })}
                <label
                  className={`flex h-7 w-7 items-center justify-center rounded-xl border transition-all cursor-pointer ${
                    colorTheme === 'custom'
                      ? 'border-amber-500 ring-2 ring-amber-500/30 scale-105'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                  title="Custom color"
                >
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => {
                      setCustomColor(e.target.value);
                      setColorTheme('custom');
                    }}
                    className="h-4 w-4 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                  />
                </label>
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
                minHeight="min-h-[150px]"
                maxHeight="max-h-[280px]"
                className="journal-reflection-editor"
              />
            </div>

            {/* Attached Files Section */}
            <div>
              <AttachmentUploader
                attachments={attachments}
                onChange={setAttachments}
                label="Attach Files & Media"
                className="journal-reflection-upload"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 active:scale-98 transition-transform cursor-pointer"
            >
              {editingId ? 'Update Reflection' : '＋ Save Reflection'}
            </button>
          </form>
        </div>}

        {/* Journal Timeline Archive (7 cols) */}
        <div className={`space-y-4 ${isEditorOpen || editingId ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
          <div
            ref={archiveFiltersRef}
            id="journal-archive-controls"
            className={archiveControlsOpen ? 'rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 space-y-3.5' : 'hidden'}
          >
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search reflections by word, mood, or date..."
                className="h-9 w-full rounded-xl border border-amber-200 bg-amber-50/40 pl-9 pr-3 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-amber-900/60 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Mood / Category Filter Tabs */}
            <div className="flex overflow-x-auto pb-1 gap-3 no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedMoodFilter('all')}
                className={`shrink-0 border-b-0 border-transparent px-2 py-1.5 text-xs sm:text-sm font-semibold whitespace-nowrap tracking-normal transition-all cursor-pointer ${
                  selectedMoodFilter === 'all'
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-amber-800 hover:border-amber-500 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
                }`}
              >
                All Entries ({journal.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedMoodFilter('__linked_goals__')}
                className={`flex shrink-0 items-center gap-1.5 border-b-0 border-transparent px-2 py-1.5 text-xs sm:text-sm font-semibold whitespace-nowrap tracking-normal transition-all cursor-pointer ${
                  selectedMoodFilter === '__linked_goals__'
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-amber-800 hover:border-amber-500 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
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
                    className={`flex shrink-0 items-center gap-1.5 border-b-0 border-transparent px-2 py-1.5 text-xs sm:text-sm font-semibold whitespace-nowrap tracking-normal transition-all cursor-pointer ${
                      selectedMoodFilter === m.label
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-amber-800 hover:border-amber-500 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
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

          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
            {filteredEntries.slice(0, rightColumnEntryCount).map(renderEntryCard)}
          </div>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 lg:col-span-12">
            No journal reflections found. Record an entry using the New Reflection button.
          </div>
        ) : filteredEntries.length > rightColumnEntryCount || !isEditorOpen ? (
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 lg:col-span-12">
            {filteredEntries.slice(rightColumnEntryCount).map(renderEntryCard)}
          </div>
        ) : null}
      </div>

      {viewingEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5"
          onClick={() => setViewingEntry(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="journal-entry-title"
            className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border p-5 shadow-2xl sm:p-7 ${getTheme(viewingEntry.color).cardClass}`}
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-black/10 pb-4 dark:border-white/10">
              <div className="min-w-0">
                <h2 id="journal-entry-title" className="text-lg font-bold text-slate-900 dark:text-white sm:text-xl">
                  {viewingEntry.title || 'Daily Reflection'}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {viewingEntry.date}
                  </span>
                  {viewingEntry.mood && <span>{moodOptions.find(m => m.label === viewingEntry.mood)?.icon} {viewingEntry.mood}</span>}
                  {viewingEntry.goalId && (
                    <span>{goals.find(g => g.id === viewingEntry.goalId)?.title || 'Goal linked'}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingEntry(null)}
                aria-label="Close reflection"
                className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div
              className="om-rich-rendered mt-5 text-sm leading-7 text-slate-800 dark:text-slate-200"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(viewingEntry.html || plainTextToHtml(viewingEntry.text || '')) }}
            />
            {viewingEntry.attachments && viewingEntry.attachments.length > 0 && (
              <div className="mt-5 border-t border-black/10 pt-4 dark:border-white/10">
                <AttachmentViewer attachments={viewingEntry.attachments} />
              </div>
            )}
          </section>
        </div>
      )}

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
