import { ThemedDateTimeInput } from '../components/ThemedDateTimeInput';
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Phone, Calendar, Trash2, Edit2, Bell, ChevronDown, ChevronUp, Search, Merge, Loader2, Undo2, X, Camera } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { Person, Interaction, ReminderItem, Meeting, Goal } from '../types';
import { storage, generateUUID } from '../lib/storage';
import { getLocalDateString } from '../lib/dateUtils';
import { ProgressiveActions } from '../components/ProgressiveActions';
import { GoalLinkSelector } from '../components/GoalLinkSelector';
import { syncGoalProgressFromMeetings } from '../lib/goalTaskSync';
import { CardCloseButton } from '../components/CardCloseButton';
import { ConfirmModal } from '../components/ConfirmModal';

interface PeopleViewProps {
  people: Person[];
  interactions: Interaction[];
  goals?: Goal[];
  reminders?: ReminderItem[];
  embedded?: boolean;
  initialForm?: 'person' | 'interaction' | 'meeting';
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
}

export const PeopleView: React.FC<PeopleViewProps> = ({
  people,
  interactions,
  goals = [],
  reminders = [],
  embedded = false,
  initialForm,
  onRefresh,
  onSuccess
}) => {
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('Friend');
  const [contact, setContact] = useState('');
  const [emailsInput, setEmailsInput] = useState('');
  const [phonesInput, setPhonesInput] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [socialLinksInput, setSocialLinksInput] = useState('');
  const [importantDate, setImportantDate] = useState('');
  const [avatar, setAvatar] = useState<string>('');
  const [note, setNote] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [openPeopleForm, setOpenPeopleForm] = useState<'person' | 'interaction' | 'meeting' | null>(initialForm || null);
  // Interaction logger & editor state
  const [selectedPersonId, setSelectedPersonId] = useState(people[0]?.id || '');
  const [interactionText, setInteractionText] = useState('');
  const [editingInteraction, setEditingInteraction] = useState<Interaction | null>(null);
  const [expandedPeopleInteractions, setExpandedPeopleInteractions] = useState<Record<string, boolean>>({});
  const [meetingPeople, setMeetingPeople] = useState('');
  const [meetingDate, setMeetingDate] = useState(getLocalDateString());
  const [meetingGoalInputMode, setMeetingGoalInputMode] = useState<'manual' | 'link'>('manual');
  const [meetingGoalId, setMeetingGoalId] = useState('');
  const [deletePersonTarget, setDeletePersonTarget] = useState<Person | null>(null);
  const [deleteInteractionTarget, setDeleteInteractionTarget] = useState<Interaction | null>(null);
  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [peopleSort, setPeopleSort] = useState<'name' | 'recent' | 'upcoming'>('name');
  // Loading state
  const [loading, setLoading] = useState(true);
  // Local meetings state (fetched independently — not passed as prop)
  const [localMeetings, setLocalMeetings] = useState<Meeting[]>([]);
  // Undo toast
  const [undoStack, setUndoStack] = useState<Array<{ person: Person; orphanedInteractions: Interaction[]; orphanedMeetings: Meeting[]; label: string; timer: ReturnType<typeof setTimeout> }>>([]);
  const [undoInteractionStack, setUndoInteractionStack] = useState<Array<{ interaction: Interaction; label: string; timer: ReturnType<typeof setTimeout> }>>([]);
  // Merge duplicates
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeGroups, setMergeGroups] = useState<Array<{ people: Person[]; primaryId: string }>>([]);

  useEffect(() => {
    if (people.length > 0 || !loading) setLoading(false);
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, [people]);

  useEffect(() => {
    storage.getAll<Meeting>('meetings').then(all => {
      setLocalMeetings(all.sort((a, b) => (b.date || '').localeCompare(a.date || '')));
    }).catch(() => {});
  }, [people]);

  // Fix stale selectedPersonId when people array changes
  useEffect(() => {
    if (selectedPersonId && people.length > 0 && !people.some(p => p.id === selectedPersonId)) {
      setSelectedPersonId(people[0]?.id || '');
    } else if (!selectedPersonId && people.length > 0) {
      setSelectedPersonId(people[0].id);
    }
  }, [people]);

  const undoTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    return () => { undoTimers.current.forEach(clearTimeout); };
  }, []);

  const resetPeopleCard = () => {
    setEditingPerson(null);
    setEditingInteraction(null);
    setName('');
    setRelationship('Friend');
    setContact('');
    setEmailsInput('');
    setPhonesInput('');
    setAddressInput('');
    setSocialLinksInput('');
    setImportantDate('');
    setAvatar('');
    setNote('');
    setTagsInput('');
    setInteractionText('');
    setMeetingPeople('');
    setMeetingDate(getLocalDateString());
    setMeetingGoalInputMode('manual');
    setMeetingGoalId('');
  };

  const handleSavePeopleCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedMemo = interactionText.trim();
    const shouldSavePerson = openPeopleForm === 'person' && Boolean(editingPerson || trimmedName);
    const shouldSaveInteraction = openPeopleForm === 'interaction' && Boolean(trimmedMemo || editingInteraction);
    const shouldSaveMeeting = openPeopleForm === 'meeting' && Boolean(
      meetingPeople.trim() || (meetingGoalInputMode === 'link' && meetingGoalId)
    );

    if (!shouldSavePerson && !shouldSaveInteraction && !shouldSaveMeeting) return;
    if (shouldSavePerson && !trimmedName) return;

    const personId = editingPerson?.id
      || (shouldSavePerson && trimmedName ? generateUUID() : undefined)
      || editingInteraction?.personId;
    const interactionPersonId = personId || selectedPersonId || editingInteraction?.personId;
    if (shouldSaveInteraction && !interactionPersonId) {
      onSuccess('Add a person or select a contact for the touchpoint.');
      return;
    }
    if (editingInteraction && !trimmedMemo) return;
    if (shouldSavePerson && personId) {
      const person: Person = editingPerson
        ? {
            ...editingPerson,
            name: trimmedName,
            relationship,
            contact: contact.trim() || undefined,
            emails: emailsInput.split(',').map(value => value.trim()).filter(Boolean),
            phones: phonesInput.split(',').map(value => value.trim()).filter(Boolean),
            address: addressInput.trim() || undefined,
            socialLinks: socialLinksInput.split(',').map(value => value.trim()).filter(Boolean),
            importantDate: importantDate || undefined,
            avatar: avatar || editingPerson.avatar || undefined,
            note: note.trim() || undefined,
            tags: tagsInput.split(',').map(tag => tag.trim()).filter(Boolean),
            updatedAt: Date.now()
          }
        : {
            id: personId,
            name: trimmedName,
            relationship,
            contact: contact.trim() || undefined,
            emails: emailsInput.split(',').map(value => value.trim()).filter(Boolean),
            phones: phonesInput.split(',').map(value => value.trim()).filter(Boolean),
            address: addressInput.trim() || undefined,
            socialLinks: socialLinksInput.split(',').map(value => value.trim()).filter(Boolean),
            importantDate: importantDate || undefined,
            avatar: avatar || undefined,
            note: note.trim() || undefined,
            tags: tagsInput.split(',').map(tag => tag.trim()).filter(Boolean),
            createdAt: Date.now()
          };
      await storage.put('people', person);
    }

    if (shouldSaveInteraction && interactionPersonId) {
      const interaction: Interaction = editingInteraction
        ? {
            ...editingInteraction,
            personId: interactionPersonId,
            text: trimmedMemo
          }
        : {
            id: generateUUID(),
            personId: interactionPersonId,
            date: getLocalDateString(),
            text: trimmedMemo,
            createdAt: Date.now()
          };
      await storage.put('interactions', interaction);
    }

    if (shouldSaveMeeting) {
      const meeting: Meeting = {
        id: generateUUID(),
        title: `${trimmedName || 'Contact'} meeting`,
        people: meetingPeople.trim() || undefined,
        personId: personId || undefined,
        date: meetingDate,
        goalId: meetingGoalInputMode === 'link' ? meetingGoalId || undefined : undefined,
        status: 'scheduled',
        completed: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await storage.put('meetings', meeting);
      if (meeting.goalId) {
        await syncGoalProgressFromMeetings(meeting.goalId, meeting.id, meeting.completed, meeting.status);
      }
    }

    const savedItems = [
      shouldSavePerson && (editingPerson ? 'contact updated' : 'contact added'),
      shouldSaveInteraction && (editingInteraction ? 'touchpoint updated' : 'touchpoint logged'),
      shouldSaveMeeting && 'meeting scheduled'
    ].filter(Boolean);
    onSuccess(`✓ ${savedItems.join(', ')}`);
    resetPeopleCard();
    onRefresh();
  };

  const handleStartEditPerson = (person: Person) => {
    setEditingInteraction(null);
    setInteractionText('');
    setMeetingPeople('');
    setMeetingGoalId('');
    setEditingPerson(person);
    setOpenPeopleForm('person');
    setName(person.name);
    setRelationship(person.relationship || 'Friend');
    setContact(person.contact || '');
    setEmailsInput((person.emails || []).join(', '));
    setPhonesInput((person.phones || []).join(', '));
    setAddressInput(person.address || '');
    setSocialLinksInput((person.socialLinks || []).join(', '));
    setImportantDate(person.importantDate || '');
    setAvatar(person.avatar || '');
    setNote(person.note || '');
    setTagsInput((person.tags || []).join(', '));
  };

  const handleCancelEditPerson = () => {
    resetPeopleCard();
  };

  const handleStartEditInteraction = (inter: Interaction) => {
    setEditingPerson(null);
    setName('');
    setContact('');
    setEmailsInput('');
    setPhonesInput('');
    setAddressInput('');
    setSocialLinksInput('');
    setImportantDate('');
    setAvatar('');
    setNote('');
    setMeetingPeople('');
    setMeetingGoalId('');
    setEditingInteraction(inter);
    setOpenPeopleForm('interaction');
    setSelectedPersonId(inter.personId);
    setInteractionText(inter.text);
  };

  const handleCancelEditInteraction = () => {
    setEditingInteraction(null);
    setInteractionText('');
  };

  const handleDeleteInteraction = async (interId: string) => {
    const interaction = interactions.find(i => i.id === interId);
    await storage.moveToRecycleBin('interactions', interId);
    if (editingInteraction?.id === interId) {
      handleCancelEditInteraction();
    }
    setDeleteInteractionTarget(null);
    onRefresh();
    if (interaction) {
      const personName = people.find(p => p.id === interaction.personId)?.name || 'Unknown';
      const timer = setTimeout(() => {
        setUndoInteractionStack(prev => prev.filter(e => e.interaction.id !== interId));
      }, 8000);
      setUndoInteractionStack(prev => [...prev, { interaction, label: `Deleted touchpoint for "${personName}"`, timer }]);
    }
  };

  const handleUndoInteractionDelete = (index: number) => {
    const entry = undoInteractionStack[index];
    if (!entry) return;
    clearTimeout(entry.timer);
    storage.restoreFromRecycleBin('interactions', entry.interaction.id).then(restored => {
      if (!restored) return;
      setUndoInteractionStack(prev => prev.filter((_, i) => i !== index));
      onSuccess(`Restored touchpoint`);
      onRefresh();
    });
  };

  const handleDeletePerson = async (id: string) => {
    const person = people.find(p => p.id === id);
    const orphanedInteractions = interactions.filter(i => i.personId === id);
    // Also clean up meetings linked to this person
    const allMeetings = await storage.getAll<Meeting>('meetings');
    const orphanedMeetings = allMeetings.filter(m => m.personId === id);
    await Promise.all(orphanedInteractions.map(i => storage.delete('interactions', i.id)));
    await Promise.all(orphanedMeetings.map(m => storage.delete('meetings', m.id)));
    await storage.delete('people', id);
    setDeletePersonTarget(null);
    onRefresh();
    if (person) {
      const timer = setTimeout(() => {
        setUndoStack(prev => prev.filter(e => e.person.id !== id));
      }, 8000);
      setUndoStack(prev => [...prev, { person, orphanedInteractions, orphanedMeetings, label: `Deleted "${person.name}"`, timer }]);
    }
  };

  const handleCreateImportantDateReminder = async (p: Person) => {
    if (!p.importantDate) return;
    const matchingReminders = (reminders || [])
      .filter(r => r.linkedType === 'contact' && r.linkedId === p.id && r.status === 'open')
      .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
    const now = Date.now();
    const reminderData = {
      title: `${p.name}'s Milestone (${p.relationship}): ${p.importantDate}`,
      dueAt: p.importantDate,
      repeatRule: 'yearly' as const,
      status: 'open' as const,
      alarmEnabled: true,
      ringtone: 'gentle_bell',
      linkedType: 'contact',
      linkedId: p.id,
      updatedAt: now
    };
    if (matchingReminders.length > 0) {
      const [existing, ...duplicates] = matchingReminders;
      await storage.put('reminders', { ...existing, ...reminderData });
      await Promise.all(duplicates.map(reminder => storage.delete('reminders', reminder.id)));
      onSuccess(`Reminder re-armed for ${p.name}'s important date!`);
      onRefresh();
      return;
    }

    const reminder: ReminderItem = {
      id: generateUUID(),
      ...reminderData,
      createdAt: Date.now(),
      updatedAt: now
    };
    await storage.put('reminders', reminder);
    onSuccess(`Reminder scheduled for ${p.name}'s important date!`);
    onRefresh();
  };

  const toggleExpandInteractions = (personId: string) => {
    setExpandedPeopleInteractions(prev => ({
      ...prev,
      [personId]: !prev[personId]
    }));
  };

  const getImportantDateCountdown = (dateStr?: string) => {
    if (!dateStr) return null;
    const today = getLocalDateString();
    const tD = new Date(`${today}T00:00:00`).getTime();
    const target = new Date(`${dateStr.slice(0, 10)}T00:00:00`).getTime();
    if (isNaN(target)) return null;
    const diffDays = Math.round((target - tD) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return { label: 'Today', style: 'bg-rose-500 text-white font-bold animate-pulse' };
    if (diffDays > 0 && diffDays <= 7) return { label: `In ${diffDays}d`, style: 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200 font-bold' };
    if (diffDays > 7) return { label: `In ${diffDays}d`, style: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300' };
    return { label: `${Math.abs(diffDays)}d ago`, style: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' };
  };
  // Image resize helper for avatar upload
  const resizeImageToBase64 = (file: File, maxSize: number = 128): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
          else { w = Math.round(w * maxSize / h); h = maxSize; }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas not supported')); return; }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = reject;
        img.src = ev.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Avatar helpers
  const AVATAR_COLORS = [
    'bg-rose-500', 'bg-pink-500', 'bg-fuchsia-500', 'bg-purple-500',
    'bg-violet-500', 'bg-indigo-500', 'bg-blue-500', 'bg-sky-500',
    'bg-cyan-500', 'bg-teal-500', 'bg-emerald-500', 'bg-green-500',
    'bg-amber-500', 'bg-orange-500'
  ];
  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (name[0] || '?').toUpperCase();
  };
  const getAvatarColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  };

  // Search filtering
  const filteredPeople = searchQuery.trim()
    ? people.filter(p => {
        const q = searchQuery.toLowerCase();
        return (p.name || '').toLowerCase().includes(q)
          || (p.relationship || '').toLowerCase().includes(q)
          || (p.contact || '').toLowerCase().includes(q)
          || (p.emails || []).some(value => value.toLowerCase().includes(q))
          || (p.phones || []).some(value => value.toLowerCase().includes(q))
          || (p.address || '').toLowerCase().includes(q)
          || (p.socialLinks || []).some(value => value.toLowerCase().includes(q))
          || (p.note || '').toLowerCase().includes(q)
          || (p.tags || []).some(tag => tag.toLowerCase().includes(q));
      })
    : people;

  // Undo delete handler
  const handleUndoDelete = (index: number) => {
    const entry = undoStack[index];
    if (!entry) return;
    clearTimeout(entry.timer);
    Promise.all([
      storage.put('people', entry.person),
      ...entry.orphanedInteractions.map(i => storage.put('interactions', i)),
      ...(entry.orphanedMeetings || []).map(m => storage.put('meetings', m))
    ]).then(() => {
      setUndoStack(prev => prev.filter((_, i) => i !== index));
      onSuccess(`Restored ${entry.person.name}`);
      onRefresh();
    });
  };

  // Merge duplicates logic
  const findDuplicateGroups = () => {
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const visited = new Set<string>();
    const groups: Array<{ people: Person[]; primaryId: string }> = [];
    for (let i = 0; i < people.length; i++) {
      if (visited.has(people[i].id)) continue;
      const norm = normalize(people[i].name);
      const group = [people[i]];
      for (let j = i + 1; j < people.length; j++) {
        if (visited.has(people[j].id)) continue;
        const normJ = normalize(people[j].name);
        if (norm === normJ || levenshtein(norm, normJ) <= 2) {
          group.push(people[j]);
          visited.add(people[j].id);
        }
      }
      if (group.length > 1) {
        visited.add(people[i].id);
        groups.push({ people: group, primaryId: group[0].id });
      }
    }
    return groups;
  };

  const levenshtein = (a: string, b: string): number => {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => {
      const row = new Array(n + 1).fill(0);
      row[0] = i;
      return row;
    });
    for (let j = 1; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  };

  const handleOpenMerge = () => {
    const groups = findDuplicateGroups();
    setMergeGroups(groups);
    setShowMergeModal(true);
  };

  const handleConfirmMerge = async () => {
    for (const group of mergeGroups) {
      const primary = group.people.find(p => p.id === group.primaryId);
      if (!primary) continue;
      const secondaries = group.people.filter(p => p.id !== group.primaryId);
      const merged = { ...primary };
      for (const sec of secondaries) {
        if (!merged.contact && sec.contact) merged.contact = sec.contact;
        if (!merged.importantDate && sec.importantDate) merged.importantDate = sec.importantDate;
        if (!merged.note && sec.note) merged.note = sec.note;
        if (!merged.avatar && sec.avatar) merged.avatar = sec.avatar;
        if (!merged.address && sec.address) merged.address = sec.address;
        // Merge arrays (deduplicate by string value)
        if (sec.emails?.length) merged.emails = [...new Set([...(merged.emails || []), ...sec.emails])];
        if (sec.phones?.length) merged.phones = [...new Set([...(merged.phones || []), ...sec.phones])];
        if (sec.tags?.length) merged.tags = [...new Set([...(merged.tags || []), ...sec.tags])];
        if (sec.socialLinks?.length) merged.socialLinks = [...new Set([...(merged.socialLinks || []), ...sec.socialLinks])];
        // Re-assign interactions from secondary to primary
        const secInteractions = interactions.filter(i => i.personId === sec.id);
        await Promise.all(secInteractions.map(i => storage.put('interactions', { ...i, personId: primary.id })));
      }
      merged.updatedAt = Date.now();
      await storage.put('people', merged);
      await Promise.all(secondaries.map(s => storage.delete('people', s.id)));
    }
    setShowMergeModal(false);
    onSuccess(`✓ Merged ${mergeGroups.length} duplicate group(s)`);
    onRefresh();
  };

  const hasDirectoryRecords = people.length > 0;

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-6'}>
      {!embedded && <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            People & Relationships
          </h1>
        </div>
      </div>}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        {openPeopleForm && <section className={`rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-5 ${
          embedded && !hasDirectoryRecords ? 'lg:col-span-12' : 'lg:col-span-5'
        }`}>
          <form onSubmit={handleSavePeopleCard} className="space-y-3">
          <div>
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                {(editingPerson || editingInteraction) ? <Edit2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> : <Plus className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editingPerson ? 'Edit Contact' : editingInteraction ? 'Edit Touchpoint' : openPeopleForm === 'person' ? 'Add Contact' : openPeopleForm === 'interaction' ? 'Log Touchpoint' : 'Schedule Meeting'}
                </h2>
              </div>
              <CardCloseButton label="people form" onClick={() => setOpenPeopleForm(null)} />
            </div>

            {!editingPerson && !editingInteraction && (
              <div className="flex gap-1 mt-3">
                {(['person', 'interaction', 'meeting'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setOpenPeopleForm(mode)}
                    className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      openPeopleForm === mode
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {mode === 'person' ? 'Contact' : mode === 'interaction' ? 'Touchpoint' : 'Meeting'}
                  </button>
                ))}
              </div>
            )}

            {(editingPerson || editingInteraction) && (
              <button type="button" onClick={handleCancelEditPerson} className="mt-3 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">
                Cancel editing
              </button>
            )}

            {/* === PERSON MODE === */}
            {openPeopleForm === 'person' && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="relative h-14 w-14 shrink-0 cursor-pointer group"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {avatar ? (
                    <img src={avatar} alt="Avatar" className="h-14 w-14 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700" />
                  ) : (
                    <div className={`flex h-14 w-14 items-center justify-center rounded-full text-base font-bold text-white ${name ? getAvatarColor(name) : 'bg-slate-300 dark:bg-slate-600'}`}>
                      {name ? getInitials(name) : <Camera className="h-5 w-5" />}
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="h-4 w-4 text-white" />
                  </div>
                  {avatar && (
                    <button
                      type="button"
                      onClick={(ev) => { ev.stopPropagation(); setAvatar(''); }}
                      className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-white text-[8px] hover:bg-rose-600"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (ev) => {
                    const file = ev.target.files?.[0];
                    if (file) {
                      try {
                        const base64 = await resizeImageToBase64(file);
                        setAvatar(base64);
                      } catch { /* ignore */ }
                    }
                    ev.target.value = '';
                  }}
                />
                <div className="flex-1 min-w-0">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    aria-label="Full name"
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Relationship</label>
                  <select
                    value={relationship}
                    onChange={e => setRelationship(e.target.value)}
                    className="mt-1 h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
                  >
                    <option value="Mentor">Mentor</option>
                    <option value="Friend">Friend</option>
                    <option value="Family">Family</option>
                    <option value="Colleague">Colleague</option>
                    <option value="Partner">Partner</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Important Date</label>
                  <ThemedDateTimeInput
                    type="date"
                    value={importantDate}
                    onChange={e => setImportantDate(e.target.value)}
                    className="mt-1 h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Contact / Email / Phone</label>
                <input
                  type="text"
                  value={contact}
                  onChange={e => setContact(e.target.value)}
                  aria-label="Contact / Email / Phone"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input value={emailsInput} onChange={e => setEmailsInput(e.target.value)} placeholder="Email addresses, comma-separated" aria-label="Email addresses" className="h-9 rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                <input value={phonesInput} onChange={e => setPhonesInput(e.target.value)} placeholder="Phone numbers, comma-separated" aria-label="Phone numbers" className="h-9 rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                <input value={addressInput} onChange={e => setAddressInput(e.target.value)} placeholder="Address" aria-label="Address" className="h-9 rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                <input value={socialLinksInput} onChange={e => setSocialLinksInput(e.target.value)} placeholder="Social profile links, comma-separated" aria-label="Social profile links" className="h-9 rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Groups / tags</label>
                <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="Family, Work, Friends" className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Note</label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Optional note..."
                  className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-indigo-500"
                />
              </div>
            </div>
            )}

            {/* === INTERACTION MODE === */}
            {openPeopleForm === 'interaction' && (
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Person</label>
                <select
                  value={selectedPersonId}
                  onChange={e => setSelectedPersonId(e.target.value)}
                  disabled={!!editingInteraction}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer disabled:opacity-60"
                >
                  <option value="">Select a person...</option>
                  {people.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className={`${editingInteraction ? 'rounded-xl border border-amber-400 bg-amber-50/20 p-3 dark:border-amber-700 dark:bg-amber-950/20' : ''} transition-colors`}>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Interaction Memo</label>
                <textarea
                  rows={4}
                  required
                  value={interactionText}
                  onChange={e => setInteractionText(e.target.value)}
                  aria-label="Interaction memo"
                  className="people-interaction-memo mt-1 w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-sm leading-relaxed text-slate-900 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-indigo-500"
                />
              </div>
            </div>
            )}

            {/* === MEETING MODE === */}
            {openPeopleForm === 'meeting' && (
            <div className="mt-4 space-y-3">
              <div>
                <GoalLinkSelector
                  goals={goals}
                  mode={meetingGoalInputMode}
                  goalId={meetingGoalId}
                  onModeChange={setMeetingGoalInputMode}
                  onGoalChange={setMeetingGoalId}
                  label="Meeting Title"
                >
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    aria-label="Meeting title"
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </GoalLinkSelector>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Attendees</label>
                <input
                  type="text"
                  value={meetingPeople}
                  onChange={event => setMeetingPeople(event.target.value)}
                  aria-label="Attendees"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Meeting Date</label>
                <ThemedDateTimeInput
                  type="date"
                  value={meetingDate}
                  onChange={e => setMeetingDate(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
            )}

          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 cursor-pointer"
          >
            {editingPerson ? 'Save Changes' : editingInteraction ? 'Save Changes' : openPeopleForm === 'person' ? 'Save Contact' : openPeopleForm === 'interaction' ? 'Log Touchpoint' : 'Schedule Meeting'}
          </button>
          </form>
        </section>}

        {/* Contacts Directory */}
        {(!embedded || hasDirectoryRecords || !openPeopleForm) && <div className={`${openPeopleForm ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-4`}>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-5">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              <span>Relationships Directory ({people.length})</span>
            </h2>
            <div className="flex items-center gap-2">
              {people.length >= 2 && (
                <button
                  type="button"
                  onClick={handleOpenMerge}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <span className="flex items-center gap-1"><Merge className="h-3 w-3" /> Merge Duplicates</span>
                </button>
              )}
              {!openPeopleForm && (
                <button
                  type="button"
                  onClick={() => setOpenPeopleForm('person')}
                  className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-500"
                >
                  + Add Contact
                </button>
              )}
            </div>
            </div>

            {/* Search Bar */}
            {people.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  aria-label="Search contacts"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search people..."
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-8 pr-3 text-xs text-slate-900 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                {searchQuery && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                    {filteredPeople.length} result{filteredPeople.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <select aria-label="Sort contacts" value={peopleSort} onChange={e => setPeopleSort(e.target.value as typeof peopleSort)} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <option value="name">Name</option><option value="recent">Recently contacted</option><option value="upcoming">Upcoming date</option>
              </select>
              </div>
            )}

            <div className="adaptive-card-grid mt-3 gap-3">
              {loading ? (
                <div role="status" aria-label="Loading contacts" className="col-span-full flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                </div>
              ) : people.length === 0 ? (
                <div className="col-span-full">
                  <EmptyState
                    icon={Phone}
                    compact
                    title="No contacts yet"
                    hint={embedded ? 'Add your first connection using the form.' : 'Add your first connection using the button above.'}
                  />
                </div>
              ) : (
                [...filteredPeople].sort((a, b) => peopleSort === 'recent'
                  ? Math.max(...interactions.filter(i => i.personId === b.id).map(i => Date.parse(i.date) || i.createdAt || 0), 0) - Math.max(...interactions.filter(i => i.personId === a.id).map(i => Date.parse(i.date) || i.createdAt || 0), 0)
                  : peopleSort === 'upcoming' ? (a.importantDate || '9999').localeCompare(b.importantDate || '9999')
                    : (a.name || '').localeCompare(b.name || '') || (b.createdAt || 0) - (a.createdAt || 0)).map(p => {
                  const pInteractions = interactions.filter(i => i.personId === p.id);
                  const lastContactAt = pInteractions.reduce((latest, interaction) => Math.max(latest, Date.parse(interaction.date) || interaction.createdAt || 0), 0);
                  const daysSinceContact = lastContactAt ? Math.max(0, Math.floor((Date.now() - lastContactAt) / 86_400_000)) : null;
                  const isExpanded = Boolean(expandedPeopleInteractions[p.id]);
                  const displayedInteractions = isExpanded ? pInteractions : pInteractions.slice(0, 2);

                  return (
                    <div key={p.id} data-record-id={p.id} className="dashboard-item-row flex flex-col justify-between rounded-xl border border-slate-100 p-2.5 text-xs transition-all hover:border-slate-200 hover:bg-slate-50/80 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                      <div>
                        <div className="flex flex-wrap justify-between items-start gap-1">
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            {p.avatar ? (
                              <img src={p.avatar} alt={p.name} className="h-7 w-7 rounded-full object-cover shrink-0" />
                            ) : (
                              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${getAvatarColor(p.name)}`}>
                                {getInitials(p.name)}
                              </span>
                            )}
                            <span className="min-w-0 truncate font-bold text-slate-900 dark:text-white">{p.name}</span>
                            <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                              {p.relationship}
                            </span>
                          </div>
                          <ProgressiveActions label={`More actions for ${p.name}`} className="shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEditPerson(p)}
                              className="text-slate-400 hover:text-indigo-600 cursor-pointer p-1"
                              title="Edit contact"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletePersonTarget(p)}
                              className="text-slate-300 hover:text-rose-500 cursor-pointer p-1"
                              title="Delete contact"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </ProgressiveActions>
                        </div>

                        {p.contact && (
                          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                            <Phone className="h-3 w-3 shrink-0 text-slate-400" />
                            <span>{p.contact}</span>
                          </div>
                        )}
                        {daysSinceContact !== null && <div className="mt-1 text-[10px] text-slate-400">Last in touch · {daysSinceContact === 0 ? 'today' : `${daysSinceContact}d ago`}</div>}
                        {(p.phones || []).map(phone => <a key={phone} href={`tel:${phone}`} className="mt-1 block truncate text-[11px] text-slate-500 hover:text-indigo-600 dark:text-slate-400">{phone}</a>)}
                        {(p.emails || []).map(email => <a key={email} href={`mailto:${email}`} className="mt-1 block truncate text-[11px] text-slate-500 hover:text-indigo-600 dark:text-slate-400">{email}</a>)}
                        {p.address && <div className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">{p.address}</div>}
                        {(p.socialLinks || []).length > 0 && <div className="mt-1 flex flex-wrap gap-2">{p.socialLinks!.map((link, index) => {
                          const href = /^https?:\/\//i.test(link) ? link : `https://${link}`;
                          let label = link;
                          try { label = new URL(href).hostname.replace(/^www\./, ''); } catch { label = link.length > 22 ? `${link.slice(0, 20)}…` : link; }
                          return <a key={`${link}-${index}`} href={href} target="_blank" rel="noreferrer" className="text-[10px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400">{label}</a>;
                        })}</div>}
                        {p.tags && p.tags.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{p.tags.map(tag => <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{tag}</span>)}</div>}

                        {p.importantDate && (() => {
                          const countdown = getImportantDateCountdown(p.importantDate);
                          const hasActiveReminder = (reminders || []).some(r => r.linkedId === p.id && r.status === 'open');

                          return (
                            <div className="mt-1 flex items-center justify-between gap-1 text-[10px] bg-slate-50 dark:bg-slate-800/60 p-1 rounded-lg border border-slate-100 dark:border-slate-800">
                              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 min-w-0 flex-1">
                                <Calendar className="h-3 w-3 text-indigo-500 shrink-0" />
                                <span className="font-medium font-mono truncate">{p.importantDate}</span>
                                {countdown && (
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] shrink-0 ${countdown.style}`}>
                                    {countdown.label}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCreateImportantDateReminder(p)}
                                className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition-colors shrink-0 ${
                                  hasActiveReminder
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300'
                                }`}
                                title={hasActiveReminder ? 'Reminder alarm already armed (click to re-arm)' : 'Set audio notification alarm for this date'}
                              >
                                <Bell className={`h-2.5 w-2.5 ${hasActiveReminder ? 'text-emerald-600 fill-emerald-600' : ''}`} />
                                <span>{hasActiveReminder ? 'Armed' : 'Remind'}</span>
                              </button>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Touchpoints Stream */}
                      <div className="mt-2 border-t border-slate-50 pt-1.5 text-[10px] text-slate-400 dark:border-slate-800">
                        <div className="flex items-center justify-between gap-2 text-slate-500 dark:text-slate-400 font-semibold">
                          <div className="flex min-w-0 flex-wrap items-center gap-x-2">
                            <span>{pInteractions.length} recorded touchpoint{pInteractions.length === 1 ? '' : 's'}</span>
                            {pInteractions.length === 1 && (
                              <span className="font-mono font-normal text-slate-400">{pInteractions[0].date}</span>
                            )}
                          </div>
                          {pInteractions.length > 2 && (
                            <button
                              type="button"
                              onClick={() => toggleExpandInteractions(p.id)}
                              className="text-[9px] text-indigo-600 hover:underline dark:text-indigo-400 cursor-pointer flex items-center gap-0.5"
                            >
                              <span>{isExpanded ? 'Less' : `All (${pInteractions.length})`}</span>
                              {isExpanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                            </button>
                          )}
                        </div>

                        {displayedInteractions.length > 0 && (
                          <div className="space-y-1 mt-1">
                            {displayedInteractions.map(i => (
                              <div
                                key={i.id}
                                className={`group flex flex-wrap items-start justify-between gap-2 text-sm ${
                                  editingInteraction?.id === i.id
                                    ? 'text-amber-900 dark:text-amber-200'
                                    : 'text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  {pInteractions.length > 1 ? (
                                    <p className="break-words leading-snug">
                                      <span className="mr-2 font-mono text-xs text-slate-400">{i.date}</span>
                                      <span className="italic leading-relaxed">"{i.text}"</span>
                                    </p>
                                  ) : (
                                    <p className="italic leading-snug break-words">"{i.text}"</p>
                                  )}
                                </div>
                                <ProgressiveActions label={`More actions for touchpoint on ${i.date}`} className="shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditInteraction(i)}
                                    className="p-1 rounded text-slate-400 hover:bg-slate-200 hover:text-indigo-600 dark:hover:bg-slate-700 dark:hover:text-indigo-400 cursor-pointer"
                                    title="Edit touchpoint"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteInteractionTarget(i)}
                                    className="p-1 rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 cursor-pointer"
                                    title="Delete touchpoint"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </ProgressiveActions>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Meetings section */}
                      {localMeetings.filter(m => m.personId === p.id).length > 0 && (
                        <div className="mt-2 border-t border-slate-50 pt-1.5 dark:border-slate-800">
                          <div className="mb-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                            {localMeetings.filter(m => m.personId === p.id).length} scheduled meeting{localMeetings.filter(m => m.personId === p.id).length === 1 ? '' : 's'}
                          </div>
                          {localMeetings.filter(m => m.personId === p.id).map(meeting => (
                            <div key={meeting.id} className="mt-1 flex items-center justify-between gap-2 rounded-lg bg-indigo-50/50 px-2 py-1 dark:bg-indigo-950/20">
                              <div className="min-w-0 flex-1">
                                <span className={`block truncate text-[10px] font-semibold ${meeting.completed ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>{meeting.title}</span>
                                <span className="font-mono text-[9px] text-slate-400">{meeting.date}</span>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                {!meeting.completed && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void storage.put('meetings', { ...meeting, completed: true, status: 'completed' as const, updatedAt: Date.now() }).then(() => {
                                        setLocalMeetings(prev => prev.map(m => m.id === meeting.id ? { ...m, completed: true, status: 'completed' as const } : m));
                                        onSuccess('Meeting marked complete');
                                      });
                                    }}
                                    className="cursor-pointer rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 hover:text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                    aria-label="Mark meeting complete"
                                  >Done</button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    void storage.delete('meetings', meeting.id).then(() => {
                                      setLocalMeetings(prev => prev.filter(m => m.id !== meeting.id));
                                    });
                                  }}
                                  className="cursor-pointer rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                                  aria-label="Delete meeting"
                                >
                                  <Trash2 className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>}
      </div>

      {/* Delete person confirmation */}
      <ConfirmModal
        isOpen={!!deletePersonTarget}
        title="Delete Contact"
        message={`Delete "${deletePersonTarget?.name}"? All their touchpoints will also be removed.`}
        confirmText="Delete"
        onConfirm={() => deletePersonTarget && handleDeletePerson(deletePersonTarget.id)}
        onCancel={() => setDeletePersonTarget(null)}
      />

      {/* Delete interaction confirmation */}
      <ConfirmModal
        isOpen={!!deleteInteractionTarget}
        title="Delete Touchpoint"
        message="Are you sure you want to delete this touchpoint?"
        confirmText="Delete"
        onConfirm={() => deleteInteractionTarget && handleDeleteInteraction(deleteInteractionTarget.id)}
        onCancel={() => setDeleteInteractionTarget(null)}
      />

      {/* Undo Delete Toast */}
      {undoStack.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" role="status" aria-live="polite">
          {undoStack.map((entry, idx) => (
            <div key={entry.person.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{entry.label}</span>
              <button
                type="button"
                onClick={() => handleUndoDelete(idx)}
                className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-950/70 cursor-pointer"
              >
                <Undo2 className="h-3 w-3" /> Undo
              </button>
            </div>
          ))}
        </div>
      )}
      {undoInteractionStack.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[51] flex flex-col gap-2" role="status" aria-live="polite">
          {undoInteractionStack.map((entry, idx) => (
            <div key={entry.interaction.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{entry.label}</span>
              <button type="button" onClick={() => handleUndoInteractionDelete(idx)} className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-950/70">
                <Undo2 className="h-3 w-3" /> Undo
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Merge Duplicates Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Merge className="h-4 w-4 text-indigo-600" /> Merge Duplicates
              </h3>
              <button type="button" onClick={() => setShowMergeModal(false)} className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            </div>

            {mergeGroups.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">No duplicate contacts found.</p>
            ) : (
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {mergeGroups.map((group, gi) => (
                  <div key={gi} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800 space-y-2">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Group {gi + 1} — Select primary:</p>
                    {group.people.map(p => (
                      <label key={p.id} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="radio"
                          name={`merge-group-${gi}`}
                          checked={group.primaryId === p.id}
                          onChange={() => setMergeGroups(prev => prev.map((g, i) => i === gi ? { ...g, primaryId: p.id } : g))}
                          className="accent-indigo-600"
                        />
                        <span className="font-semibold text-slate-900 dark:text-white">{p.name}</span>
                        {p.relationship && <span className="text-slate-400">({p.relationship})</span>}
                        {p.contact && <span className="text-slate-400 truncate max-w-[120px]">{p.contact}</span>}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowMergeModal(false)} className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                Cancel
              </button>
              {mergeGroups.length > 0 && (
                <button type="button" onClick={handleConfirmMerge} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500">
                  Merge {mergeGroups.length} Group{mergeGroups.length > 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
