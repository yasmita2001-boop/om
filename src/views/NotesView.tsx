import React, { useState, useRef, useEffect } from 'react';
import {
  Search, Trash2, Edit3,
  Copy, Check, Download, X,
  Folder, BookOpen, Volume2, Plus,
  ChevronDown, Hash, CheckCircle2,
  Target
} from 'lucide-react';
import { Note, Goal } from '../types';
import { storage, generateUUID } from '../lib/storage';
import { getLocalDateString } from '../lib/dateUtils';
import { syncGoalProgressFromNotes } from '../lib/goalTaskSync';
import { ConfirmModal } from '../components/ConfirmModal';
import { AttachmentUploader, AttachmentViewer, StoredAttachmentMeta } from '../components/AttachmentUploader';
import { NoteRichEditor } from '../components/NoteRichEditor';
import { globalTextReader } from '../lib/voiceService';
import { htmlToPlainText, plainTextToHtml, sanitizeHtml } from '../lib/sanitizeHtml';
import { ProgressiveActions } from '../components/ProgressiveActions';
import { LinkModeSelector } from '../components/LinkModeSelector';
import { FormDisclosureToggle } from '../components/FormDisclosure';
import { GoalPicker } from '../components/GoalPicker';
import { ThemeIcon } from '../components/ThemeIcon';

interface NotesViewProps {
  notes: Note[];
  categories: string[];
  goals?: Goal[];
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
}

export const NotesView: React.FC<NotesViewProps> = ({
  notes,
  categories = ['General', 'Strategy', 'Projects', 'Finance', 'Ideas'],
  goals = [],
  onRefresh,
  onSuccess
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [colorFilter] = useState<string>('all');
  const [noteFiltersOpen, setNoteFiltersOpen] = useState(false);
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false);
  
  // Custom notebooks list (merged from default categories, appSettings, and note categories)
  const [allCategories, setAllCategories] = useState<string[]>(categories);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Left-panel Inline Editor state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [noteInputMode, setNoteInputMode] = useState<'manual' | 'link'>('manual');
  const [noteGoalId, setNoteGoalId] = useState<string>('');
  const [category, setCategory] = useState('General');
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [tags, setTags] = useState('');
  const [colorTheme, setColorTheme] = useState('slate');
  const [customColor, setCustomColor] = useState('#b88648');
  const [editorText, setEditorText] = useState('');
  const [editorHtml, setEditorHtml] = useState('');
  const [attachments, setAttachments] = useState<StoredAttachmentMeta[]>([]);
  
  // Modal states
  const [editingModalNote, setEditingModalNote] = useState<Note | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edit Modal internal form state
  const [modalTitle, setModalTitle] = useState('');
  const [modalInputMode, setModalInputMode] = useState<'manual' | 'link'>('manual');
  const [modalGoalId, setModalGoalId] = useState<string>('');
  const [modalCategory, setModalCategory] = useState('General');
  const [modalCustomCat, setModalCustomCat] = useState('');
  const [modalTags, setModalTags] = useState('');
  const [modalColor, setModalColor] = useState('slate');
  const [modalCustomColor, setModalCustomColor] = useState('#b88648');
  const [modalContent, setModalContent] = useState('');
  const [modalHtml, setModalHtml] = useState('');
  const [modalAttachments, setModalAttachments] = useState<StoredAttachmentMeta[]>([]);
  const [isSpeakingNote, setIsSpeakingNote] = useState(false);
  const [speakingNoteCardId, setSpeakingNoteCardId] = useState<string | null>(null);

  const handleSelectGoalForNote = (gId: string) => {
    setNoteGoalId(gId);
    if (!gId) return;
    const matched = goals.find(g => g.id === gId);
    if (matched) {
      if (!title.trim() || goals.some(g => title.includes(g.title))) {
        setTitle(`Knowledge Note: ${matched.title}`);
      }
      if (matched.category && allCategories.includes(matched.category)) {
        setCategory(matched.category);
      }
    }
  };

  const handleSelectGoalForModalNote = (gId: string) => {
    setModalGoalId(gId);
    if (!gId) return;
    const matched = goals.find(g => g.id === gId);
    if (matched) {
      if (!modalTitle.trim() || goals.some(g => modalTitle.includes(g.title))) {
        setModalTitle(`Knowledge Note: ${matched.title}`);
      }
    }
  };

  // Toggle read note aloud for individual note card
  const toggleSpeakNoteCard = (note: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    if (speakingNoteCardId === note.id) {
      globalTextReader.stop();
      setSpeakingNoteCardId(null);
    } else {
      globalTextReader.stop();
      const textToRead = (note.title ? note.title + '. ' : '') + (note.body || note.html?.replace(/<[^>]+>/g, ' ') || '');
      if (!textToRead.trim()) return;
      setSpeakingNoteCardId(note.id);
      globalTextReader.speak(textToRead, {
        onStateChange: (st) => {
          if (!st.isSpeaking) {
            setSpeakingNoteCardId(null);
          }
        }
      });
    }
  };

  const formRef = useRef<HTMLDivElement>(null);
  const noteFiltersRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Keep all categories synced with unique ones across existing notes
  useEffect(() => {
    const noteCats = notes.map(n => n.category).filter(Boolean);
    const combined = Array.from(new Set([...categories, ...noteCats]));
    setAllCategories(combined);
  }, [categories, notes]);

  const themePalettes: Record<string, { label: string; swatch: string; cardClass: string; dotClass: string; spineClass: string }> = {
    slate: {
      label: 'Default',
      swatch: '#94a3b8',
      cardClass: 'bg-white border-slate-200/90 dark:bg-slate-900/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700',
      dotClass: 'bg-slate-400',
      spineClass: 'bg-slate-400 dark:bg-slate-600'
    },
    red: {
      label: 'Ruby Red',
      swatch: '#ef4444',
      cardClass: 'bg-red-50/40 border-red-200/70 dark:bg-red-950/20 dark:border-red-800/40 hover:border-red-300 dark:hover:border-red-700/60',
      dotClass: 'bg-red-500',
      spineClass: 'bg-red-500'
    },
    amber: {
      label: 'Warm Amber',
      swatch: '#f59e0b',
      cardClass: 'bg-amber-50/40 border-amber-200/70 dark:bg-amber-950/20 dark:border-amber-800/40 hover:border-amber-300 dark:hover:border-amber-700/60',
      dotClass: 'bg-amber-500',
      spineClass: 'bg-amber-500'
    },
    emerald: {
      label: 'Sage Emerald',
      swatch: '#10b981',
      cardClass: 'bg-emerald-50/40 border-emerald-200/70 dark:bg-emerald-950/20 dark:border-emerald-800/40 hover:border-emerald-300 dark:hover:border-emerald-700/60',
      dotClass: 'bg-emerald-500',
      spineClass: 'bg-emerald-500'
    },
    indigo: {
      label: 'Midnight Indigo',
      swatch: '#6366f1',
      cardClass: 'bg-indigo-50/40 border-indigo-200/70 dark:bg-indigo-950/20 dark:border-indigo-800/40 hover:border-indigo-300 dark:hover:border-indigo-700/60',
      dotClass: 'bg-indigo-500',
      spineClass: 'bg-indigo-500'
    },
    violet: {
      label: 'Royal Violet',
      swatch: '#8b5cf6',
      cardClass: 'bg-purple-50/40 border-purple-200/70 dark:bg-purple-950/20 dark:border-purple-800/40 hover:border-purple-300 dark:hover:border-purple-700/60',
      dotClass: 'bg-purple-500',
      spineClass: 'bg-purple-500'
    },
    custom: {
      label: 'Custom Color',
      swatch: customColor,
      cardClass: 'bg-white border-slate-200/90 dark:bg-slate-900/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700',
      dotClass: 'bg-slate-400',
      spineClass: 'bg-slate-400 dark:bg-slate-600'
    }
  };

  const getTheme = (colorVal?: string) => {
    if (!colorVal) return themePalettes.slate;
    if (colorVal.startsWith('#')) return { ...themePalettes.custom, swatch: colorVal, label: 'Custom Color' };
    if (themePalettes[colorVal]) return themePalettes[colorVal];
    if (colorVal.includes('amber')) return themePalettes.amber;
    if (colorVal.includes('emerald')) return themePalettes.emerald;
    if (colorVal.includes('sky') || colorVal.includes('blue')) return themePalettes.indigo;
    if (colorVal.includes('violet') || colorVal.includes('purple')) return themePalettes.violet;
    if (colorVal.includes('rose') || colorVal.includes('pink')) return themePalettes.red;
    return themePalettes.slate;
  };

  // Open Edit Modal with full content preservation
  const handleOpenEditModal = (note: Note) => {
    setViewingNote(null);
    setEditingModalNote(note);
    setModalTitle(note.title);
    setModalGoalId(note.goalId || '');
    setModalInputMode(note.goalId ? 'link' : 'manual');
    setModalCategory(note.category || 'General');
    setModalCustomCat('');
    setModalTags(note.tags || '');
    setModalColor(note.color && themePalettes[note.color] ? note.color : note.color?.startsWith('#') ? 'custom' : 'slate');
    setModalCustomColor(note.color?.startsWith('#') ? note.color : '#b88648');
    const content = note.body || htmlToPlainText(note.html || '');
    const htmlContent = note.html || plainTextToHtml(note.body || '');
    setModalContent(content);
    setModalHtml(htmlContent);
    const parsedAtts: StoredAttachmentMeta[] = (note.attachments || []).map(a => {
      try {
        return typeof a === 'string' ? JSON.parse(a) : a;
      } catch {
        return { id: a, name: a, type: 'file', size: 0 };
      }
    });
    setModalAttachments(parsedAtts);
  };

  useEffect(() => {
    if (!isNoteEditorOpen || !editingNoteId) return;
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    titleInputRef.current?.focus();
  }, [isNoteEditorOpen, editingNoteId]);

  const handleAddNewNotebook = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;

    if (!allCategories.includes(trimmed)) {
      const updated = [...allCategories, trimmed];
      setAllCategories(updated);

      // Persist to appSettings
      const settings = (await storage.getSingleton<any>('appSettings')) || {};
      settings.noteCategories = updated;
      await storage.setSingleton('appSettings', settings);
      onSuccess(`Notebook "${trimmed}" created`);
    }

    setCategory(trimmed);
    setNewCategoryName('');
    setIsAddingCategory(false);
  };

  const selectedThemeOptions = ['slate', 'red', 'amber', 'emerald', 'indigo', 'violet'];

  // Inline Form Save
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const finalCategory = customCategoryInput.trim() || category || 'General';
    const now = Date.now();
    const body = editorText;
    const html = editorHtml || (editorText ? editorText.replace(/\n/g, '<br/>') : '');

    const serializedAttachments = attachments.map(a => JSON.stringify(a));
    const effectiveGoalId = noteInputMode === 'link' && noteGoalId ? noteGoalId : null;

    if (editingNoteId) {
      const existing = notes.find(n => n.id === editingNoteId);
      if (existing) {
        const oldGoalId = existing.goalId;
        const updated: Note = {
          ...existing,
          title: title.trim(),
          body,
          html,
          category: finalCategory,
          tags: tags.trim() || undefined,
          color: colorTheme === 'custom' ? customColor : colorTheme,
          pinned: undefined,
          goalId: effectiveGoalId,
          attachments: serializedAttachments.length > 0 ? serializedAttachments : undefined,
          updatedAt: now
        };
        await storage.put('notes', updated);
        if (effectiveGoalId) {
          await syncGoalProgressFromNotes(effectiveGoalId, updated.id);
        }
        if (oldGoalId && oldGoalId !== effectiveGoalId) {
          await syncGoalProgressFromNotes(oldGoalId);
        }
        onSuccess(effectiveGoalId ? '✓ Note updated & linked to Goal' : '✓ Note updated in vault');
      }
    } else {
      const newNote: Note = {
        id: generateUUID(),
        title: title.trim(),
        body,
        html,
        category: finalCategory,
        tags: tags.trim() || undefined,
        color: colorTheme === 'custom' ? customColor : colorTheme,
        goalId: effectiveGoalId,
        attachments: serializedAttachments.length > 0 ? serializedAttachments : undefined,
        date: getLocalDateString(),
        createdAt: now,
        updatedAt: now
      };
      await storage.put('notes', newNote);
      if (effectiveGoalId) {
        await syncGoalProgressFromNotes(effectiveGoalId, newNote.id);
      }
      onSuccess(effectiveGoalId ? '✓ Note saved & linked to Goal' : '✓ Note saved to vault');
    }

    // Ensure notebook is in categories list
    if (finalCategory && !allCategories.includes(finalCategory)) {
      setAllCategories(prev => [...prev, finalCategory]);
    }

    resetForm();
    onRefresh();
  };

  // Modal Form Save
  const handleSaveModalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingModalNote || !modalTitle.trim()) return;

    const finalCategory = modalCustomCat.trim() || modalCategory || 'General';
    const now = Date.now();
    const body = modalContent;
    const html = modalHtml || (modalContent ? modalContent.replace(/\n/g, '<br/>') : '');
    const serializedModalAttachments = modalAttachments.map(a => JSON.stringify(a));
    const oldGoalId = editingModalNote.goalId;
    const effectiveGoalId = modalInputMode === 'link' && modalGoalId ? modalGoalId : null;

    const updated: Note = {
      ...editingModalNote,
      title: modalTitle.trim(),
      body,
      html,
      category: finalCategory,
      tags: modalTags.trim() || undefined,
      color: modalColor === 'custom' ? modalCustomColor : modalColor,
      pinned: undefined,
      goalId: effectiveGoalId,
      attachments: serializedModalAttachments.length > 0 ? serializedModalAttachments : undefined,
      updatedAt: now
    };

    await storage.put('notes', updated);
    if (effectiveGoalId) {
      await syncGoalProgressFromNotes(effectiveGoalId, updated.id);
    }
    if (oldGoalId && oldGoalId !== effectiveGoalId) {
      await syncGoalProgressFromNotes(oldGoalId);
    }
    onSuccess(effectiveGoalId ? '✓ Note updated & linked to Goal' : '✓ Note updated in vault');
    setEditingModalNote(null);
    onRefresh();
  };

  const handleCopyNote = async (note: Note, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const fullText = `${note.title}\n\n${note.body || ''}`;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopiedId(note.id);
      setTimeout(() => setCopiedId(null), 2000);
      onSuccess('Note copied to clipboard');
    } catch {
      onSuccess('Copy failed');
    }
  };

  const handleExportNote = (note: Note, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const fullText = `# ${note.title}\nDate: ${note.date} | Notebook: ${note.category}\nTags: ${note.tags || 'none'}\n\n${note.body || ''}`;
    const blob = new Blob([fullText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    onSuccess('Note exported as Markdown file');
  };

  const handleDeleteClick = (note: Note, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setNoteToDelete(note);
  };

  const handleConfirmDelete = async () => {
    if (!noteToDelete) return;
    try {
      const deletedGoalId = noteToDelete.goalId;
      await storage.delete('notes', noteToDelete.id);
      if (deletedGoalId) {
        await syncGoalProgressFromNotes(deletedGoalId);
      }
      onSuccess('✓ Note deleted');
      setNoteToDelete(null);
      if (editingModalNote?.id === noteToDelete.id) {
        setEditingModalNote(null);
      }
      if (viewingNote?.id === noteToDelete.id) {
        setViewingNote(null);
      }
      if (editingNoteId === noteToDelete.id) {
        resetForm();
      }
      onRefresh();
    } catch (err) {
      console.error('Failed to delete note', err);
    }
  };

  const resetForm = () => {
    setEditingNoteId(null);
    setIsNoteEditorOpen(false);
    setTitle('');
    setNoteGoalId('');
    setNoteInputMode('manual');
    setTags('');
    setColorTheme('slate');
    setCustomColor('#b88648');
    setEditorText('');
    setEditorHtml('');
    setCustomCategoryInput('');
    setAttachments([]);
  };

  const filteredNotes = notes.filter(n => {
    if (selectedCategory === '__linked_goals__') {
      if (!n.goalId) return false;
    } else if (selectedCategory !== 'all' && n.category !== selectedCategory) {
      return false;
    }
    if (colorFilter !== 'all' && n.color !== colorFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const linkedGoalTitle = n.goalId ? (goals.find(g => g.id === n.goalId)?.title || '') : '';
      const hay = `${n.title} ${n.body} ${n.tags || ''} ${n.category} ${linkedGoalTitle}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => {
    if (a.date && b.date && a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    const bTime = b.updatedAt || b.createdAt || 0;
    const aTime = a.updatedAt || a.createdAt || 0;
    return bTime - aTime;
  });

  const linkedNotesCount = notes.filter(n => Boolean(n.goalId)).length;
  const [rightColumnNoteCount, setRightColumnNoteCount] = useState(0);

  useEffect(() => {
    const form = formRef.current;
    const filters = noteFiltersRef.current;
    if (!isNoteEditorOpen || !form || !filters) {
      setRightColumnNoteCount(0);
      return;
    }

    const updateRightColumnNoteCount = () => {
      if (window.innerWidth < 1024) {
        setRightColumnNoteCount(0);
        return;
      }

      const availableHeight = form.getBoundingClientRect().height
        - filters.getBoundingClientRect().height
        - 16;
      const rowHeightWithGap = 190;
      const rowCount = Math.max(0, Math.floor((availableHeight + 14) / rowHeightWithGap));
      setRightColumnNoteCount(Math.min(filteredNotes.length, rowCount * 2));
    };

    const resizeObserver = new ResizeObserver(updateRightColumnNoteCount);
    resizeObserver.observe(form);
    resizeObserver.observe(filters);
    window.addEventListener('resize', updateRightColumnNoteCount);
    updateRightColumnNoteCount();
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateRightColumnNoteCount);
    };
  }, [filteredNotes.length, noteFiltersOpen, isNoteEditorOpen, editingNoteId]);

  const noteCards = filteredNotes.map(n => {
    const theme = getTheme(n.color);
    const linkedGoal = n.goalId ? goals.find(g => g.id === n.goalId) : null;
    return (
      <div
        key={n.id}
        onClick={() => setViewingNote(n)}
        className={`note-card group progressive-row relative flex h-44 flex-col justify-between rounded-2xl border p-4 shadow-xs transition-all card-hover cursor-pointer overflow-hidden ${theme.cardClass}`}
      >
        <div className={`absolute top-0 left-0 right-0 h-1 ${theme.spineClass}`} />

        <div className="min-h-0 overflow-hidden">
          <div className="flex items-start justify-between gap-2 pt-0.5">
            <div className="min-w-0 flex-[1_1_9rem]">
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                  {n.title}
                </h3>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-indigo-600 dark:text-indigo-400 truncate max-w-[110px]">{n.category}</span>
                <span aria-hidden="true">·</span>
                <span>{n.date}</span>
                {linkedGoal && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 truncate max-w-[160px]">
                      <Target className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{linkedGoal.title}</span>
                      <span>({linkedGoal.progress}%)</span>
                    </span>
                  </>
                )}
              </div>
            </div>

            <ProgressiveActions label={`More actions for ${n.title}`} className="min-w-0 max-w-full">
              <button
                type="button"
                onClick={e => handleCopyNote(n, e)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 transition-colors"
                title="Copy note text"
              >
                {copiedId === n.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={e => handleExportNote(n, e)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 transition-colors"
                title="Export markdown"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={e => toggleSpeakNoteCard(n, e)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  speakingNoteCardId === n.id
                    ? 'bg-indigo-600 text-white animate-pulse shadow-xs'
                    : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-400'
                }`}
                title={speakingNoteCardId === n.id ? "Stop reading" : "Read note aloud (Hindi & English)"}
                aria-label="Read note aloud"
              >
                <Volume2 className={`h-3.5 w-3.5 ${speakingNoteCardId === n.id ? 'animate-bounce' : ''}`} />
              </button>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  handleOpenEditModal(n);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                title="Edit note"
                aria-label="Edit note"
              >
                <Edit3 className="h-3.5 w-3.5 text-indigo-500" />
              </button>
              <button
                type="button"
                onClick={e => handleDeleteClick(n, e)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 dark:hover:text-rose-400 transition-colors cursor-pointer"
                title="Delete note"
                aria-label="Delete note"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
              </button>
            </ProgressiveActions>
          </div>

          <div
            className="mt-2.5 text-xs text-slate-600 dark:text-slate-300 max-h-36 overflow-hidden line-clamp-4 leading-relaxed om-rich-rendered"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(n.html || plainTextToHtml(n.body || '')) }}
          />
          {n.attachments && n.attachments.length > 0 && (
            <div className="mt-2.5 pt-1.5 border-t border-black/5 dark:border-white/5">
              <AttachmentViewer attachments={n.attachments} compact={true} />
            </div>
          )}
        </div>

        {n.tags && (
          <div className="mt-2 flex shrink-0 flex-wrap gap-1 overflow-hidden border-t border-black/5 pt-2 dark:border-white/5">
            {n.tags.split(',').map(tag => (
              <span
                key={tag}
                className="inline-flex items-center rounded-md bg-white/70 dark:bg-slate-800/70 px-1.5 py-0.5 text-[9px] font-medium text-slate-600 dark:text-slate-300"
              >
                #{tag.trim()}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  });

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* SECTION HEADER: Editorial, Clean, Anti-slop                              */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200/70 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <BookOpen className="h-4 w-4" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              Notebooks & Knowledge Vault
            </h1>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{notes.length} total {notes.length === 1 ? 'note' : 'notes'}</span>
            <span aria-hidden="true">·</span>
            <span>{allCategories.length} notebooks</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex w-full max-w-full flex-wrap items-center gap-1 sm:w-auto sm:shrink-0 sm:flex-nowrap sm:gap-2">
          <button
            type="button"
            aria-expanded={noteFiltersOpen}
            aria-controls="note-archive-filters"
            onClick={() => setNoteFiltersOpen(open => !open)}
            className={`inline-flex items-center gap-2 border-b-0 border-transparent px-2 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              noteFiltersOpen
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-amber-800 hover:border-amber-500 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
            }`}
          >
            <span>Search & Filters</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${noteFiltersOpen ? 'rotate-180' : ''}`} />
          </button>
          <FormDisclosureToggle
            label="New Note"
            openLabel="Close New Note"
            isOpen={isNoteEditorOpen}
            onToggle={() => setIsNoteEditorOpen(open => !open)}
            icon={<Plus className="h-3.5 w-3.5" />}
          />
          <button
            type="button"
            onClick={() => setIsAddingCategory(true)}
            className="flex items-center gap-1.5 border-b-0 border-transparent px-2 py-2 text-xs font-semibold text-amber-800 transition-colors hover:border-amber-500 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200 cursor-pointer"
          >
            <Folder className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>New Notebook</span>
          </button>
        </div>
      </div>

      {/* New Notebook Modal/Bar */}
      {isAddingCategory && (
        <form
          onSubmit={handleAddNewNotebook}
          className="flex items-center gap-2 p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl dark:bg-indigo-950/30 dark:border-indigo-800/60 shadow-xs animate-in fade-in duration-150"
        >
          <BookOpen className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0 ml-1" />
          <input
            type="text"
            required
            autoFocus
            placeholder="Notebook title (e.g. Research, System Design, Ideas)..."
            value={newCategoryName}
            onChange={e => setNewCategoryName(e.target.value)}
            className="flex-1 h-8.5 rounded-xl border border-indigo-200 bg-white px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-indigo-700 dark:bg-slate-800 dark:text-white"
          />
          <button
            type="submit"
            className="h-8.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs cursor-pointer transition-colors"
          >
            Create Notebook
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAddingCategory(false);
              setNewCategoryName('');
            }}
            className="h-8.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer transition-colors"
          >
            Cancel
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 items-start items-start gap-6 lg:grid-cols-12">
        {/* ========================================================================= */}
        {/* LEFT PANEL: LUXURY NOTEBOOK EDITOR (5 cols)                                */}
        {/* ========================================================================= */}
        {(isNoteEditorOpen || Boolean(editingNoteId)) && <div
          ref={formRef}
          className={`lg:col-span-5 rounded-3xl border transition-all ${
            editingNoteId
              ? 'border-indigo-400/90 bg-indigo-50/20 dark:border-indigo-500/50 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20 shadow-md'
              : 'border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm'
          } p-5 sm:p-6 space-y-4`}
        >
          {/* Editor Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                ✍️
              </span>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  {editingNoteId ? 'Edit Note' : 'New Note'}
                </h2>
              </div>
            </div>
            {editingNoteId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                Cancel Edit
              </button>
            )}
            {!editingNoteId && (
              <button
                type="button"
                onClick={() => setIsNoteEditorOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Close note editor"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <form onSubmit={handleSaveNote} className="space-y-4">
            {/* Note Title Input with Integrated Link Goal / Manual Toggle (As in image.png) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Note Title / Purpose
                </label>
                {/* Mode Selector: Link Goal vs Manual */}
                <LinkModeSelector
                  value={noteInputMode}
                  ariaLabel="Note goal link mode"
                  options={[{ value: 'link', label: 'Link Goal' }, { value: 'manual', label: 'Manual' }]}
                  onChange={mode => {
                    if (mode === 'link') {
                      setNoteInputMode('link');
                      if (goals.length > 0 && !noteGoalId) handleSelectGoalForNote(goals[0].id);
                    } else {
                      setNoteInputMode('manual');
                      setNoteGoalId('');
                    }
                  }}
                />
              </div>

              {noteInputMode === 'link' && (
                <div className="mb-2.5 space-y-1.5 rounded-xl border border-indigo-200/80 bg-indigo-50/60 p-2.5 dark:border-indigo-900/60 dark:bg-indigo-950/30">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                      Select Target Goal to Link *
                    </label>
                    {noteGoalId && (
                      <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                        {goals.find(g => g.id === noteGoalId)?.progress}% Done
                      </span>
                    )}
                  </div>
                  <GoalPicker
                    goals={goals}
                    value={noteGoalId}
                    onChange={handleSelectGoalForNote}
                    placeholder="-- Choose Goal --"
                    className="h-8.5 w-full rounded-lg border border-indigo-300 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-indigo-700 dark:bg-slate-900 dark:text-white cursor-pointer font-medium"
                  />
                  {noteGoalId && (
                    <span className="block text-[10px] text-indigo-800 dark:text-indigo-300">
                      <ThemeIcon name="zap" className="mr-1 inline h-3 w-3" />Saving this note links your knowledge vault directly to the selected goal's hierarchy!
                    </span>
                  )}
                </div>
              )}

              <input
                ref={titleInputRef}
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Give your note an inspiring title..."
                className="h-10 w-full rounded-xl border border-slate-200/90 dark:border-slate-700/90 bg-slate-50/60 dark:bg-slate-800/50 px-3.5 text-xs sm:text-sm font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 focus:outline-none dark:text-white transition-all shadow-2xs"
              />
            </div>

            {/* Notebook & Tags Row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Notebook
                </label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="h-9 w-full rounded-xl border border-slate-200/90 dark:border-slate-700/90 bg-slate-50/60 dark:bg-slate-800/50 pl-3 pr-7 text-xs font-medium text-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 focus:outline-none dark:text-slate-200 transition-all appearance-none cursor-pointer shadow-2xs"
                  >
                    {allCategories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="__custom">+ Custom Notebook...</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-3 w-3 text-slate-400" />
                </div>
                {category === '__custom' && (
                  <input
                    type="text"
                    required
                    placeholder="Enter notebook name"
                    value={customCategoryInput}
                    onChange={e => setCustomCategoryInput(e.target.value)}
                    className="mt-1.5 h-8.5 w-full rounded-xl border border-indigo-200 px-3 text-xs dark:border-indigo-700 dark:bg-slate-800 dark:text-white"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tags
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={tags}
                    onChange={e => setTags(e.target.value)}
                    placeholder="ideas, architecture"
                    className="h-9 w-full rounded-xl border border-slate-200/90 dark:border-slate-700/90 bg-slate-50/60 dark:bg-slate-800/50 pl-7 pr-3 text-xs font-medium text-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 focus:outline-none dark:text-slate-200 transition-all shadow-2xs"
                  />
                  <Hash className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                </div>
              </div>

            </div>

            {/* Note Theme Palette */}
            <div className="space-y-1.5">
              <div>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Notebook Spine & Theme
                </span>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedThemeOptions.map((k) => {
                    const t = themePalettes[k];
                    const isSelected = colorTheme === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setColorTheme(k)}
                        aria-label={t.label}
                        aria-pressed={isSelected}
                        className={`group relative flex h-7 w-7 items-center justify-center rounded-full border transition-colors cursor-pointer ${
                          isSelected
                            ? 'border-amber-500 bg-amber-100/60 ring-2 ring-amber-500/30'
                            : 'border-amber-800/20 bg-amber-50/50 hover:border-amber-700/45 dark:border-amber-200/20 dark:bg-slate-800/60 dark:hover:border-amber-200/45'
                        }`}
                        title={t.label}
                      >
                        <span
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: t.swatch }}
                        />
                      </button>
                    );
                  })}
                  <label
                    className={`group relative flex h-7 w-7 items-center justify-center rounded-full border transition-colors cursor-pointer ${
                      colorTheme === 'custom'
                        ? 'border-amber-500 bg-amber-100/60 ring-2 ring-amber-500/30'
                        : 'border-amber-800/20 bg-amber-50/50 hover:border-amber-700/45 dark:border-amber-200/20 dark:bg-slate-800/60 dark:hover:border-amber-200/45'
                    }`}
                    title="Custom color"
                    aria-label="Custom color"
                  >
                    <input
                      type="color"
                      value={customColor}
                      onChange={(e) => {
                        setCustomColor(e.target.value);
                        setColorTheme('custom');
                      }}
                      className="h-4 w-4 cursor-pointer rounded-full border-0 bg-transparent p-0"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Note Writing Canvas */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Note Content & Body
              </label>
              <NoteRichEditor
                initialHtml={editorHtml}
                onChange={(html, text) => {
                  setEditorHtml(html);
                  setEditorText(text);
                }}
                placeholder=""
                minHeight="min-h-[150px]"
                maxHeight="max-h-[280px]"
              />
            </div>

            {/* Attached Files Section */}
            <div>
              <AttachmentUploader
                attachments={attachments}
                onChange={setAttachments}
                label="Attach Files & Images"
              />
            </div>

            {/* Primary Action Button */}
            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.99] py-2.5 text-xs font-semibold text-white shadow-sm hover:shadow-md hover:shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {editingNoteId ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Update Note</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Save Note to Vault</span>
                </>
              )}
            </button>
          </form>
        </div>}

        {/* ========================================================================= */}
        {/* RIGHT PANEL: NOTEBOOKS DIRECTORY & CARDS (7 cols)                         */}
        {/* ========================================================================= */}
        <div className={`space-y-4 ${isNoteEditorOpen || editingNoteId ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
          <div
            ref={noteFiltersRef}
            id="note-archive-filters"
            className={noteFiltersOpen ? ' border-slate-200/80 bg-white p-4 sm:p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900 space-y-3.5' : 'hidden'}
          >
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search notes by title, notebook, tags, or content..."
                className="h-9.5 w-full rounded-xl border border-amber-200 bg-amber-50/40 pl-10 pr-9 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15 focus:outline-none dark:border-amber-900/60 dark:bg-slate-800 dark:text-white transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Notebook Filter Pills */}
            <div className="flex overflow-x-auto pb-1 gap-3 no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`shrink-0 border-b-0 border-transparent px-2 py-1.5 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-amber-800 hover:border-amber-500 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
                }`}
              >
                All Notebooks ({notes.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('__linked_goals__')}
                className={`flex shrink-0 items-center gap-1 border-b-0 border-transparent px-2 py-1.5 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === '__linked_goals__'
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-amber-800 hover:border-amber-500 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
                }`}
              >
                <Target className="h-3.5 w-3.5" />
                <span>Goal Linked ({linkedNotesCount})</span>
              </button>
              {allCategories.map(cat => {
                const count = notes.filter(n => n.category === cat).length;
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`shrink-0 border-b-0 border-transparent px-2 py-1.5 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      isActive
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-amber-800 hover:border-amber-500 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2">
            {noteCards.slice(0, rightColumnNoteCount)}
          </div>
        </div>

        {/* Notes Cards Grid */}
        <div className="grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 xl:grid-cols-3 lg:col-span-12">
          {filteredNotes.length === 0 && (
            <div className="col-span-full py-16 text-center rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 p-8 space-y-2">
              <BookOpen className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto" />
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                No notes found matching your criteria
              </div>
              <div className="text-[11px] text-slate-400">
                Write your first note using the notebook canvas on the left.
              </div>
            </div>
          )}
          {noteCards.slice(rightColumnNoteCount)}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DEDICATED EDIT NOTE MODAL                                                 */}
      {/* ========================================================================= */}
      {editingModalNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                  <Edit3 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Edit Note
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingModalNote(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModalNote} className="mt-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Note Title / Purpose
                  </label>
                  {/* Mode Selector: Link Goal vs Manual */}
                  <LinkModeSelector
                    value={modalInputMode}
                    ariaLabel="Edit note goal link mode"
                    options={[{ value: 'link', label: 'Link Goal' }, { value: 'manual', label: 'Manual' }]}
                    onChange={mode => {
                      if (mode === 'link') {
                        setModalInputMode('link');
                        if (goals.length > 0 && !modalGoalId) handleSelectGoalForModalNote(goals[0].id);
                      } else {
                        setModalInputMode('manual');
                        setModalGoalId('');
                      }
                    }}
                  />
                </div>

                {modalInputMode === 'link' && (
                  <div className="mb-2.5 space-y-1.5 rounded-xl border border-indigo-200/80 bg-indigo-50/60 p-2.5 dark:border-indigo-900/60 dark:bg-indigo-950/30">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                        Select Target Goal to Link *
                      </label>
                      {modalGoalId && (
                        <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                          {goals.find(g => g.id === modalGoalId)?.progress}% Done
                        </span>
                      )}
                    </div>
                    <GoalPicker
                      goals={goals}
                      value={modalGoalId}
                      onChange={handleSelectGoalForModalNote}
                      placeholder="-- Choose Goal --"
                      className="h-8.5 w-full rounded-lg border border-indigo-300 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-indigo-700 dark:bg-slate-900 dark:text-white cursor-pointer font-medium"
                    />
                  </div>
                )}

                <input
                  type="text"
                  required
                  value={modalTitle}
                  onChange={e => setModalTitle(e.target.value)}
                  placeholder="Note title..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Notebook
                  </label>
                  <div className="relative">
                    <select
                      value={modalCategory}
                      onChange={e => setModalCategory(e.target.value)}
                      className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-3 pr-7 text-xs font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white appearance-none cursor-pointer"
                    >
                      {allCategories.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="__custom">+ Custom Notebook...</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-3 w-3 text-slate-400" />
                  </div>
                  {modalCategory === '__custom' && (
                    <input
                      type="text"
                      required
                      placeholder="Notebook name"
                      value={modalCustomCat}
                      onChange={e => setModalCustomCat(e.target.value)}
                      className="mt-1.5 h-8.5 w-full rounded-xl border border-indigo-200 px-3 text-xs dark:border-indigo-700 dark:bg-slate-800 dark:text-white"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tags
                  </label>
                  <input
                    type="text"
                    value={modalTags}
                    onChange={e => setModalTags(e.target.value)}
                    placeholder="ideas, plans"
                    className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Theme */}
              <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Theme Palette
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedThemeOptions.map((k) => {
                      const t = themePalettes[k];
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setModalColor(k)}
                          aria-label={t.label}
                          aria-pressed={modalColor === k}
                          className={`flex h-7.5 w-7.5 items-center justify-center rounded-xl border transition-all cursor-pointer ${
                            modalColor === k
                              ? 'border-amber-500 ring-2 ring-amber-500/30 scale-105'
                              : 'border-slate-200 dark:border-slate-700 hover:scale-105'
                          }`}
                          title={t.label}
                        >
                          <span
                            className="h-4.5 w-4.5 rounded-lg shadow-xs"
                            style={{ backgroundColor: t.swatch }}
                          />
                        </button>
                      );
                    })}
                    <label
                      className={`flex h-7.5 w-7.5 items-center justify-center rounded-xl border transition-all cursor-pointer ${
                        modalColor === 'custom'
                          ? 'border-amber-500 ring-2 ring-amber-500/30 scale-105'
                          : 'border-slate-200 dark:border-slate-700 hover:scale-105'
                      }`}
                      title="Custom color"
                    >
                      <input
                        type="color"
                        value={modalCustomColor}
                        onChange={(e) => {
                          setModalCustomColor(e.target.value);
                          setModalColor('custom');
                        }}
                        className="h-4.5 w-4.5 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                      />
                    </label>
                  </div>
                </div>

              </div>

              {/* Note Content Writing Canvas */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Note Content & Body
                </label>
                <NoteRichEditor
                  initialHtml={modalHtml}
                  onChange={(html, text) => {
                    setModalHtml(html);
                    setModalContent(text);
                  }}
                  placeholder=""
                  minHeight="min-h-[150px]"
                  maxHeight="max-h-[280px]"
                />
              </div>

              {/* Edit Modal Attachments */}
              <div>
                <AttachmentUploader
                  attachments={modalAttachments}
                  onChange={setModalAttachments}
                  label="Attach Files & Images"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    const toDelete = editingModalNote;
                    setEditingModalNote(null);
                    setNoteToDelete(toDelete);
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Note</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingModalNote(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW NOTE MODAL (When clicking a card)                                   */}
      {/* ========================================================================= */}
      {viewingNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="min-w-0 pr-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {viewingNote.title}
                  </h3>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {viewingNote.category}
                  </span>
                  <span>·</span>
                  <span>{viewingNote.date}</span>
                  {viewingNote.goalId && (() => {
                    const lg = goals.find(g => g.id === viewingNote.goalId);
                    return lg ? (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                          <Target className="h-3 w-3 shrink-0" />
                          <span>{lg.title} ({lg.progress}%)</span>
                        </span>
                      </>
                    ) : null;
                  })()}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(viewingNote)}
                  className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
                  title="Edit Note"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const toDelete = viewingNote;
                    setViewingNote(null);
                    setNoteToDelete(toDelete);
                  }}
                  className="rounded-xl p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/50 dark:hover:text-rose-400 cursor-pointer"
                  title="Delete Note"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const text = viewingNote.body || viewingNote.html?.replace(/<[^>]+>/g, ' ') || '';
                    if (isSpeakingNote) {
                      globalTextReader.stop();
                      setIsSpeakingNote(false);
                    } else {
                      globalTextReader.speak(text, {
                        onStateChange: (st) => setIsSpeakingNote(st.isSpeaking)
                      });
                      setIsSpeakingNote(true);
                    }
                  }}
                  className={`rounded-xl p-1.5 transition-colors cursor-pointer ${
                    isSpeakingNote
                      ? 'bg-indigo-600 text-white animate-pulse'
                      : 'text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                  title={isSpeakingNote ? 'Stop Reading' : 'Read Note Aloud (Hindi & English)'}
                >
                  <Volume2 className={`h-4 w-4 ${isSpeakingNote ? 'animate-bounce' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isSpeakingNote) {
                      globalTextReader.stop();
                      setIsSpeakingNote(false);
                    }
                    setViewingNote(null);
                  }}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {/* Content */}
              <div 
                className="text-xs sm:text-sm leading-relaxed text-slate-800 dark:text-slate-200 max-w-none om-rich-rendered"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(viewingNote.html || plainTextToHtml(viewingNote.body || '')) }}
              />

              {/* Tags */}
              {viewingNote.tags && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {viewingNote.tags.split(',').map(tag => (
                    <span
                      key={tag}
                      className="rounded-lg bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400"
                    >
                      #{tag.trim()}
                    </span>
                  ))}
                </div>
              )}

              {/* Attachments in Viewing Modal */}
              {viewingNote.attachments && viewingNote.attachments.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <AttachmentViewer attachments={viewingNote.attachments} />
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyNote(viewingNote)}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 dark:text-slate-400 cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportNote(viewingNote)}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 dark:text-slate-400 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export .md</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleOpenEditModal(viewingNote)}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 cursor-pointer"
              >
                Edit Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal
        isOpen={Boolean(noteToDelete)}
        title="Delete Note?"
        message={
          noteToDelete
            ? `Are you sure you want to delete "${noteToDelete.title}"?`
            : ''
        }
        confirmText="Delete Note"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setNoteToDelete(null)}
      />
    </div>
  );
};
