import React, { useState } from 'react';
import {
  BookOpen, Calendar, Trash2, Edit3, Search,
  Copy, Check, Download
} from 'lucide-react';
import { JournalEntry, Goal } from '../types';
import { storage, generateUUID } from '../lib/storage';
import { NoteRichEditor } from '../components/NoteRichEditor';

interface JournalViewProps {
  journal: JournalEntry[];
  goals: Goal[];
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
}

export const JournalView: React.FC<JournalViewProps> = ({
  journal,
  goals,
  onRefresh,
  onSuccess
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today);
  const [mood, setMood] = useState('Productive');
  const [tags, setTags] = useState('');
  const [goalId, setGoalId] = useState('');
  const [text, setText] = useState('');
  const [textHtml, setTextHtml] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const moods = [
    { label: 'Productive', emoji: '🚀', color: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800' },
    { label: 'Focused', emoji: '🎯', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' },
    { label: 'Calm', emoji: '🧘', color: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800' },
    { label: 'Reflective', emoji: '💡', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' },
    { label: 'Exhausted', emoji: '🔋', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800' }
  ];

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !title.trim()) return;
    const now = Date.now();

    if (editingId) {
      const existing = journal.find(j => j.id === editingId);
      if (existing) {
        const updated: JournalEntry = {
          ...existing,
          title: title.trim() || 'Daily Reflection',
          date,
          mood,
          tags: tags.trim() || undefined,
          goalId: goalId || null,
          text: text.trim(),
          html: textHtml.trim() || undefined,
          updatedAt: now
        };
        await storage.put('journal', updated);
        onSuccess('Journal reflection updated');
      }
      setEditingId(null);
    } else {
      const newEntry: JournalEntry = {
        id: generateUUID(),
        title: title.trim() || 'Daily Reflection',
        date,
        mood,
        tags: tags.trim() || undefined,
        goalId: goalId || null,
        text: text.trim(),
        html: textHtml.trim() || undefined,
        createdAt: now,
        updatedAt: now
      };
      await storage.put('journal', newEntry);
      onSuccess('Reflection recorded in journal');
    }

    setTitle('');
    setText('');
    setTextHtml('');
    setTags('');
    setGoalId('');
    onRefresh();
  };

  const handleEdit = (entry: JournalEntry) => {
    setEditingId(entry.id);
    setTitle(entry.title);
    setDate(entry.date);
    setMood(entry.mood || 'Productive');
    setTags(entry.tags || '');
    setGoalId(entry.goalId || '');
    setText(entry.text);
    setTextHtml(entry.html || (entry.text ? entry.text.replace(/\n/g, '<br/>') : ''));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCopyEntry = async (entry: JournalEntry) => {
    try {
      await navigator.clipboard.writeText(`${entry.title} (${entry.date})\nMood: ${entry.mood}\n\n${entry.text}`);
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(null), 2000);
      onSuccess('Reflection copied to clipboard');
    } catch {
      onSuccess('Failed to copy');
    }
  };

  const handleExportEntry = (entry: JournalEntry) => {
    const md = `# ${entry.title}\nDate: ${entry.date}\nMood: ${entry.mood}\nTags: ${entry.tags || 'none'}\n\n${entry.text}\n`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal-${entry.date}-${entry.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    onSuccess('Exported reflection as Markdown');
  };

  const handleDelete = async (id: string) => {
    await storage.delete('journal', id);
    onSuccess('Reflection deleted');
    onRefresh();
  };

  const filteredEntries = journal
    .filter(j => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return `${j.title} ${j.text} ${j.tags || ''} ${j.mood}`.toLowerCase().includes(q);
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            Daily Reflections & Executive Journal
          </h1>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Evening synthesis, clarity audits, emotional regulation, and lessons compounded over time.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Write Reflection Form (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {editingId ? 'Edit Reflection' : 'New Daily Reflection'}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setTitle('');
                  setText('');
                  setTextHtml('');
                  setTags('');
                  setGoalId('');
                }}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleSaveEntry} className="mt-4 space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Headline / Theme of the Day
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Deep work breakthrough & architectural clarity"
                className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Tags
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  placeholder="gratitude, shipping, mindset"
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Dominant State / Mood
              </label>
              <div className="flex flex-wrap gap-1.5">
                {moods.map(m => (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => setMood(m.label)}
                    className={`flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                      mood === m.label
                        ? m.color + ' ring-2 ring-indigo-500/40'
                        : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400'
                    }`}
                  >
                    <span>{m.emoji}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Link to Strategic Goal
              </label>
              <select
                value={goalId}
                onChange={e => setGoalId(e.target.value)}
                className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
              >
                <option value="">None</option>
                {goals.map(g => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Reflection Synthesis
              </label>
              <NoteRichEditor
                initialHtml={textHtml}
                onChange={(html, plainText) => {
                  setTextHtml(html);
                  setText(plainText);
                }}
                placeholder="What went well today? What friction did you eliminate? What is the single highest-leverage priority for tomorrow?"
                minHeight="min-h-[200px]"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 active:scale-98 transition-transform cursor-pointer"
            >
              {editingId ? 'Update Reflection' : '+ Record Reflection'}
            </button>
          </form>
        </div>

        {/* Right: Chronological Stream (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search reflections by keyword, mood, or tag..."
                className="h-8.5 w-full rounded-xl border border-slate-200 pl-8 pr-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-3.5">
            {filteredEntries.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900">
                No journal entries found. Start recording your daily reflections.
              </div>
            ) : (
              filteredEntries.map(entry => {
                const moodObj = moods.find(m => m.label === entry.mood) || moods[0];
                const linkedGoal = entry.goalId ? goals.find(g => g.id === entry.goalId) : undefined;
                return (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-700"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                            <Calendar className="h-3.5 w-3.5" />
                            {entry.date}
                          </span>
                          <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold ${moodObj.color}`}>
                            <span>{moodObj.emoji}</span>
                            <span>{entry.mood}</span>
                          </span>
                          {linkedGoal && (
                            <span className="rounded-lg bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                              🎯 {linkedGoal.title}
                            </span>
                          )}
                        </div>
                        <h3 className="mt-1.5 text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                          {entry.title}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyEntry(entry)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 cursor-pointer"
                          title="Copy reflection"
                        >
                          {copiedId === entry.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportEntry(entry)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 cursor-pointer"
                          title="Export Markdown"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(entry)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 cursor-pointer"
                          title="Edit"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(entry.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/40 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {entry.html ? (
                      <div
                        className="rich-note-display mt-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: entry.html }}
                      />
                    ) : (
                      <p className="mt-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {entry.text}
                      </p>
                    )}

                    {entry.tags && (
                      <div className="mt-3 flex flex-wrap gap-1.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                        {entry.tags.split(',').map(t => (
                          <span key={t} className="text-[10px] font-medium text-slate-400">
                            #{t.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
