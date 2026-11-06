import { ThemedDateTimeInput } from '../components/ThemedDateTimeInput';
import React, { useState } from 'react';
import { Plus, Phone, Calendar, Trash2, Edit2, Bell, ChevronDown, ChevronUp } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { Person, Interaction, ReminderItem, Meeting, Goal } from '../types';
import { storage, generateUUID } from '../lib/storage';
import { getLocalDateString } from '../lib/dateUtils';
import { ProgressiveActions } from '../components/ProgressiveActions';
import { GoalLinkSelector } from '../components/GoalLinkSelector';
import { syncGoalProgressFromMeetings } from '../lib/goalTaskSync';

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
  const [importantDate, setImportantDate] = useState('');
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

  const resetPeopleCard = () => {
    setEditingPerson(null);
    setEditingInteraction(null);
    setName('');
    setRelationship('Friend');
    setContact('');
    setImportantDate('');
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
    const shouldSavePerson = Boolean(editingPerson || !editingInteraction);
    const shouldSaveInteraction = Boolean(trimmedMemo || editingInteraction);
    const shouldSaveMeeting = Boolean(
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
            importantDate: importantDate || undefined,
            updatedAt: Date.now()
          }
        : {
            id: personId,
            name: trimmedName,
            relationship,
            contact: contact.trim() || undefined,
            importantDate: importantDate || undefined,
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
    setImportantDate(person.importantDate || '');
    setOpenPeopleForm('person');
  };

  const handleCancelEditPerson = () => {
    resetPeopleCard();
  };

  const handleStartEditInteraction = (inter: Interaction) => {
    setEditingPerson(null);
    setName('');
    setContact('');
    setImportantDate('');
    setMeetingPeople('');
    setMeetingGoalId('');
    setEditingInteraction(inter);
    setOpenPeopleForm('person');
    setSelectedPersonId(inter.personId);
    setInteractionText(inter.text);
    const person = people.find(item => item.id === inter.personId);
    if (person) {
      setName(person.name);
      setRelationship(person.relationship || 'Friend');
      setContact(person.contact || '');
      setImportantDate(person.importantDate || '');
    }
  };

  const handleCancelEditInteraction = () => {
    setEditingInteraction(null);
    setInteractionText('');
  };

  const handleDeleteInteraction = async (interId: string) => {
    await storage.delete('interactions', interId);
    if (editingInteraction?.id === interId) {
      handleCancelEditInteraction();
    }
    onSuccess('✓ Touchpoint deleted');
    onRefresh();
  };

  const handleDeletePerson = async (id: string) => {
    await storage.delete('people', id);
    onSuccess('✓ Contact deleted');
    onRefresh();
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
      repeatRule: 'none' as const,
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
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <Plus className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">{editingPerson ? 'Edit Important Person' : 'Add Important Person'}</h2>
            </div>

            <div className="mt-4 space-y-3">
              {(editingPerson || editingInteraction) && (
                <button type="button" onClick={handleCancelEditPerson} className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">
                  Cancel editing
                </button>
              )}
              <div>
                <GoalLinkSelector
                  goals={goals}
                  mode={meetingGoalInputMode}
                  goalId={meetingGoalId}
                  onModeChange={setMeetingGoalInputMode}
                  onGoalChange={setMeetingGoalId}
                  label="Full Name"
                >
                  <input
                    type="text"
                    required={!editingInteraction}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Elena Rostova"
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </GoalLinkSelector>
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
                  placeholder="elena@example.com or phone"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Attendees</label>
              <input
                type="text"
                value={meetingPeople}
                onChange={event => setMeetingPeople(event.target.value)}
                placeholder="Team, Alex"
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Log / Edit Interaction */}
          <div className={`${editingInteraction ? 'rounded-xl border border-amber-400 bg-amber-50/20 p-4 dark:border-amber-700 dark:bg-amber-950/20' : ''} transition-colors`}>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Interaction Memo</label>
                <textarea
                  rows={4}
                  required={Boolean(editingInteraction)}
                  value={interactionText}
                  onChange={e => setInteractionText(e.target.value)}
                  placeholder="Discussed architecture direction and shared priorities..."
                  className="people-interaction-memo mt-1 w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-sm leading-relaxed text-slate-900 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 cursor-pointer"
          >
            {editingPerson || editingInteraction ? 'Save Changes' : 'Save Contact'}
          </button>
          </form>
        </section>}

        {/* Contacts Directory */}
        {(!embedded || hasDirectoryRecords) && <div className={`${openPeopleForm ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-4`}>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-5">
            <h2 className="border-b border-slate-100 pb-3 text-sm font-bold text-slate-900 dark:border-slate-800 dark:text-white">
              <span>Relationships Directory ({people.length})</span>
            </h2>

            <div className="adaptive-card-grid mt-3 gap-3">
              {people.length === 0 ? (
                <div className="col-span-full">
                  <EmptyState
                    icon={Phone}
                    compact
                    title="No contacts yet"
                    hint={embedded ? 'Add your first connection using the form.' : 'Add your first connection using the button above.'}
                  />
                </div>
              ) : (
                [...people].sort((a, b) => (a.name || '').localeCompare(b.name || '') || (b.createdAt || 0) - (a.createdAt || 0)).map(p => {
                  const pInteractions = interactions.filter(i => i.personId === p.id);
                  const isExpanded = Boolean(expandedPeopleInteractions[p.id]);
                  const displayedInteractions = isExpanded ? pInteractions : pInteractions.slice(0, 2);

                  return (
                    <div key={p.id} className="dashboard-item-row flex flex-col justify-between rounded-xl border border-slate-100 p-2.5 text-xs transition-all hover:border-slate-200 hover:bg-slate-50/80 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                      <div>
                        <div className="flex flex-wrap justify-between items-start gap-1">
                          <div className="flex min-w-0 flex-1 items-center gap-2">
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
                              onClick={() => handleDeletePerson(p.id)}
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
                                    onClick={() => handleDeleteInteraction(i.id)}
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
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>}
      </div>
    </div>
  );
};
