import React, { useState } from 'react';
import {
  FileText, Search, Plus, Trash2, Edit3,
  Star, Copy, Check, Download, BookOpen, X
} from 'lucide-react';
import { Note, Goal } from '../types';
import { storage, generateUUID } from '../lib/storage';
import { NoteRichEditor } from '../components/NoteRichEditor';

interface NotesViewProps {
  notes: Note[];
  goals: Goal[];
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
}

export const NotesView: React.FC<NotesViewProps> = ({
  notes,
  goals,
  onRefresh,
  onSuccess
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Philosophy');
  const [tags, setTags] = useState('');
  const [body, setBody] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [colorTheme, setColorTheme] = useState('slate');
  const [isPinned, setIsPinned] = useState(false);
  const [goalId, setGoalId] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categories = ['Philosophy', 'Architecture', 'Strategy', 'Projects', 'Ideas', 'General'];

  const themePalettes: Record<string, { swatch: string; cardClass: string }> = {
    slate: {
      swatch: '#94a3b8',
      cardClass: 'bg-white border-slate-200/90 dark:bg-slate-900/90 dark:border-slate-800'
    },
    amber: {
      swatch: '#f59e0b',
      cardClass: 'bg-amber-50/40 border-amber-200/70 dark:bg-amber-950/20 dark:border-amber-800/40'
    },
    emerald: {
      swatch: '#10b981',
      cardClass: 'bg-emerald-50/40 border-emerald-200/70 dark:bg-emerald-950/20 dark:border-emerald-800/40'
    },
    sky: {
      swatch: '#0ea5e9',
      cardClass: 'bg-sky-50/40 border-sky-200/70 dark:bg-sky-950/20 dark:border-sky-800/40'
    },
    violet: {
      swatch: '#8b5cf6',
      cardClass: 'bg-purple-50/40 border-purple-200/70 dark:bg-purple-950/20 dark:border-purple-800/40'
    }
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const now = Date.now();

    if (editingNoteId) {
      const existing = notes.find(n => n.id === editingNoteId);
      if (existing) {
        const updated: Note = {
          ...existing,
          title: title.trim(),
          body: body.trim(),
          html: bodyHtml.trim() || undefined,
          category,
          tags: tags.trim() || undefined,
          color: colorTheme,
          pinned: isPinned,
          goalId: goalId || null,
          updatedAt: now
        };
        await storage.put('notes', updated);
        onSuccess('Note updated in vault');
      }
      setEditingNoteId(null);
    } else {
      const newNote: Note = {
        id: generateUUID(),
        title: title.trim(),
        body: body.trim(),
        html: bodyHtml.trim() || undefined,
        category,
        tags: tags.trim() || undefined,
        color: colorTheme,
        pinned: isPinned,
        goalId: goalId || null,
        date: today,
        createdAt: now,
        updatedAt: now
      };
      await storage.put('notes', newNote);
      onSuccess('Note saved to vault');
    }

    setTitle('');
    setBody('');
    setBodyHtml('');
    setTags('');
    setIsPinned(false);
    onRefresh();
  };

  const handleEditClick = (note: Note) => {
    setEditingNoteId(note.id);
    setTitle(note.title);
    setBody(note.body || '');
    setBodyHtml(note.html || (note.body ? note.body.replace(/\n/g, '<br/>') : ''));
    setCategory(note.category || 'General');
    setTags(note.tags || '');
    setColorTheme(note.color || 'slate');
    setIsPinned(Boolean(note.pinned));
    setGoalId(note.goalId || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTogglePin = async (note: Note) => {
    const updated = { ...note, pinned: !note.pinned, updatedAt: Date.now() };
    await storage.put('notes', updated);
    onSuccess(note.pinned ? 'Note unpinned' : 'Note pinned to top');
    onRefresh();
  };

  const handleCopyNote = async (note: Note) => {
    const text = `${note.title}\n\n${note.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(note.id);
      setTimeout(() => setCopiedId(null), 2000);
      onSuccess('Note copied to clipboard');
    } catch {
      onSuccess('Failed to copy');
    }
  };

  const handleExportNote = (note: Note) => {
    const md = `# ${note.title}\nCategory: ${note.category}\nDate: ${note.date}\nTags: ${note.tags || 'none'}\n\n${note.body}\n`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    onSuccess('Exported as Markdown');
  };

  const handleDeleteNote = async (id: string) => {
    await storage.delete('notes', id);
    onSuccess('Note deleted');
    onRefresh();
  };

  const filteredNotes = notes.filter(n => {
    if (selectedCategory !== 'all' && n.category !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return `${n.title} ${n.body} ${n.tags || ''} ${n.category}`.toLowerCase().includes(q);
    }
    return true;
  }).sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            Notebooks & Knowledge Vault
          </h1>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          First-principles synthesis, architecture documentation, ideas, and sovereign markdown exports.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Note Writing Workstation (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-500" />
              <span>{editingNoteId ? 'Edit Note' : 'Write Note'}</span>
            </h2>
            {editingNoteId && (
              <button
                type="button"
                onClick={() => {
                  setEditingNoteId(null);
                  setTitle('');
                  setBody('');
                  setBodyHtml('');
                  setTags('');
                }}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleSaveNote} className="mt-4 space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Note Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Title or thesis statement..."
                className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Notebook
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
                >
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  placeholder="focus, backend, clarity"
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            {/* Color Swatch & Pin Options */}
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mr-1">
                  Accent:
                </span>
                {Object.entries(themePalettes).map(([k, t]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setColorTheme(k)}
                    className={`h-6 w-6 rounded-lg border transition-transform cursor-pointer ${
                      colorTheme === k ? 'scale-110 ring-2 ring-indigo-500' : 'border-slate-200 dark:border-slate-700'
                    }`}
                    style={{ backgroundColor: t.swatch }}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => setIsPinned(!isPinned)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  isPinned
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Star className={`h-3.5 w-3.5 ${isPinned ? 'fill-current' : ''}`} />
                <span>{isPinned ? 'Pinned' : 'Pin'}</span>
              </button>
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
                <option value="">None (Independent)</option>
                {goals.map(g => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Body & Formatted Content
              </label>
              <NoteRichEditor
                initialHtml={bodyHtml}
                onChange={(html, text) => {
                  setBodyHtml(html);
                  setBody(text);
                }}
                placeholder="Write structured thoughts, architecture diagrams, or insights..."
                minHeight="min-h-[220px]"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 active:scale-98 transition-transform cursor-pointer"
            >
              {editingNoteId ? 'Update Note in Vault' : '+ Save to Knowledge Vault'}
            </button>
          </form>
        </div>

        {/* Notes Directory Cards (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search notes by title, tag, or content..."
                className="h-8.5 w-full rounded-xl border border-slate-200 pl-8 pr-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Category Filter Tabs */}
            <div className="flex overflow-x-auto pb-1 gap-1.5 no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                All ({notes.length})
              </button>
              {categories.map(c => {
                const count = notes.filter(n => n.category === c).length;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedCategory(c)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      selectedCategory === c
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {c} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredNotes.length === 0 ? (
              <div className="col-span-full py-16 text-center text-xs text-slate-400">
                No notes found matching your search.
              </div>
            ) : (
              filteredNotes.map(note => {
                const theme = themePalettes[note.color || 'slate'] || themePalettes.slate;
                const linkedGoal = note.goalId ? goals.find(g => g.id === note.goalId) : undefined;
                return (
                  <div
                    key={note.id}
                    className={`rounded-2xl border p-4 shadow-xs flex flex-col justify-between transition-all hover:border-slate-300 dark:hover:border-slate-700 ${theme.cardClass}`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {note.pinned && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />}
                            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                              {note.title}
                            </h3>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                            <span className="font-semibold text-indigo-600 dark:text-indigo-400">{note.category}</span>
                            <span>·</span>
                            <span>{note.date}</span>
                            {linkedGoal && (
                              <>
                                <span>·</span>
                                <span className="rounded bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 dark:text-indigo-300 truncate max-w-[130px]">
                                  🎯 {linkedGoal.title}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleTogglePin(note)}
                            className="p-1 text-slate-400 hover:text-amber-500 transition-colors"
                            title="Toggle Pin"
                          >
                            <Star className={`h-3.5 w-3.5 ${note.pinned ? 'fill-amber-400 text-amber-400' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyNote(note)}
                            className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                            title="Copy text"
                          >
                            {copiedId === note.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportNote(note)}
                            className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                            title="Export Markdown"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditClick(note)}
                            className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                            title="Edit"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteNote(note.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {note.html ? (
                        <div
                          className="rich-note-display mt-2 text-xs text-slate-600 dark:text-slate-300 max-h-36 overflow-y-auto leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: note.html }}
                        />
                      ) : (
                        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 line-clamp-4 leading-relaxed whitespace-pre-wrap">
                          {note.body}
                        </p>
                      )}
                    </div>

                    {note.tags && (
                      <div className="mt-3 flex flex-wrap gap-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                        {note.tags.split(',').map(tag => (
                          <span
                            key={tag}
                            className="text-[10px] font-medium text-slate-400"
                          >
                            #{tag.trim()}
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
