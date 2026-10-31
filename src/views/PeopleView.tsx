import { ThemedDateTimeInput } from '../components/ThemedDateTimeInput';
import React, { useState } from 'react';
import { Plus, Phone, Calendar, Trash2, Edit2, Bell, ChevronDown, ChevronUp, X } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { Person, Interaction, ReminderItem } from '../types';
import { storage, generateUUID } from '../lib/storage';
import { getLocalDateString } from '../lib/dateUtils';
import { ProgressiveActions } from '../components/ProgressiveActions';
import { FormToggleButton } from '../components/FormToggleButton';

interface PeopleViewProps {
  people: Person[];
  interactions: Interaction[];
  reminders?: ReminderItem[];
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
}

export const PeopleView: React.FC<PeopleViewProps> = ({
  people,
  interactions,
  reminders = [],
  onRefresh,
  onSuccess
}) => {
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('Friend');
  const [contact, setContact] = useState('');
  const [importantDate, setImportantDate] = useState('');
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [activeAction, setActiveAction] = useState<'person' | 'interaction'>('person');
  const [openPeopleForm, setOpenPeopleForm] = useState<'person' | 'interaction' | null>(null);
  // Interaction logger & editor state
  const [selectedPersonId, setSelectedPersonId] = useState(people[0]?.id || '');
  const [interactionText, setInteractionText] = useState('');
  const [editingInteraction, setEditingInteraction] = useState<Interaction | null>(null);
  const [expandedPeopleInteractions, setExpandedPeopleInteractions] = useState<Record<string, boolean>>({});

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const p: Person = editingPerson ? {
      ...editingPerson,
      name: name.trim(),
      relationship,
      contact: contact.trim() || undefined,
      importantDate: importantDate || undefined,
      updatedAt: Date.now()
    } : {
      id: generateUUID(),
      name: name.trim(),
      relationship,
      contact: contact.trim() || undefined,
      importantDate: importantDate || undefined,
      createdAt: Date.now()
    };

    await storage.put('people', p);
    onSuccess(editingPerson ? `Contact "${name}" updated` : `Contact "${name}" added`);
    setEditingPerson(null);
    setName('');
    setRelationship('Friend');
    setContact('');
    setImportantDate('');
    onRefresh();
  };

  const handleStartEditPerson = (person: Person) => {
    setEditingPerson(person);
    setName(person.name);
    setRelationship(person.relationship || 'Friend');
    setContact(person.contact || '');
    setImportantDate(person.importantDate || '');
    setActiveAction('person');
    setOpenPeopleForm('person');
  };

  const handleCancelEditPerson = () => {
    setEditingPerson(null);
    setName('');
    setRelationship('Friend');
    setContact('');
    setImportantDate('');
  };

  const handleSaveInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPersonId || !interactionText.trim()) return;

    if (editingInteraction) {
      const updated: Interaction = {
        ...editingInteraction,
        personId: selectedPersonId,
        text: interactionText.trim()
      };
      await storage.put('interactions', updated);
      onSuccess('✓ Touchpoint updated');
      setEditingInteraction(null);
    } else {
      const inter: Interaction = {
        id: generateUUID(),
        personId: selectedPersonId,
        date: getLocalDateString(),
        text: interactionText.trim(),
        createdAt: Date.now()
      };
      await storage.put('interactions', inter);
      onSuccess('Touchpoint logged');
    }

    setInteractionText('');
    onRefresh();
  };

  const handleStartEditInteraction = (inter: Interaction) => {
    setEditingInteraction(inter);
    setActiveAction('interaction');
    setOpenPeopleForm('interaction');
    setSelectedPersonId(inter.personId);
    setInteractionText(inter.text);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            People & Relationships
          </h1>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <FormToggleButton label="Add Person" open={openPeopleForm === 'person'} onClick={() => {
            const next = openPeopleForm === 'person' ? null : 'person';
            setOpenPeopleForm(next);
            setActiveAction('person');
          }} />
          <FormToggleButton label="Log Touchpoint" open={openPeopleForm === 'interaction'} onClick={() => {
            const next = openPeopleForm === 'interaction' ? null : 'interaction';
            setOpenPeopleForm(next);
            setActiveAction('interaction');
          }} />
        </div>
      </div>

      <div className="grid grid-cols-1 items-start items-start gap-6 lg:grid-cols-12">
        {openPeopleForm && <section className="lg:col-span-5  border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-6">
          <div className={activeAction === 'person' ? 'mt-4' : 'hidden'}>
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <Plus className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">{editingPerson ? 'Edit Important Person' : 'Add Important Person'}</h2>
            </div>

            <form onSubmit={handleAddPerson} className="mt-4 space-y-3">
              {editingPerson && (
                <button type="button" onClick={handleCancelEditPerson} className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">
                  Cancel editing
                </button>
              )}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Elena Rostova"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Relationship</label>
                  <select
                    value={relationship}
                    onChange={e => setRelationship(e.target.value)}
                    className="mt-1 h-9 w-full min-w-0 rounded-lg border border-slate-200 px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
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
                    className="mt-1 h-9 w-full min-w-0 rounded-lg border border-slate-200 px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-500 cursor-pointer"
              >
                {editingPerson ? 'Update Contact' : 'Save Contact'}
              </button>
            </form>
          </div>

          {/* Log / Edit Interaction */}
          <div className={`${activeAction === 'interaction' ? 'mt-4' : 'hidden'} ${editingInteraction ? 'rounded-xl border border-amber-400 bg-amber-50/20 p-4 dark:border-amber-700 dark:bg-amber-950/20' : ''} transition-colors`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                {editingInteraction ? (
                  <>
                    <Edit2 className="h-4 w-4 text-amber-600" />
                    <span>Edit Touchpoint</span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0.5 rounded font-mono">
                      Editing
                    </span>
                  </>
                ) : (
                  <span>Log Touchpoint / Interaction</span>
                )}
              </h2>

              {editingInteraction && (
                <button
                  type="button"
                  onClick={handleCancelEditInteraction}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Cancel</span>
                </button>
              )}
            </div>

            <form onSubmit={handleSaveInteraction} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Person</label>
                <select
                  value={selectedPersonId}
                  onChange={e => setSelectedPersonId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
                >
                  <option value="">Select a contact</option>
                  {people.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.relationship})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Interaction Memo</label>
                <textarea
                  rows={2}
                  required
                  value={interactionText}
                  onChange={e => setInteractionText(e.target.value)}
                  placeholder="Discussed architecture direction and mutual project goals..."
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className={`w-full rounded-lg py-2 text-xs font-semibold text-white cursor-pointer transition-colors ${
                    editingInteraction
                      ? 'bg-amber-600 hover:bg-amber-500'
                      : 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-700'
                  }`}
                >
                  {editingInteraction ? 'Update Touchpoint Memo' : 'Log Interaction'}
                </button>
                {editingInteraction && (
                  <button
                    type="button"
                    onClick={handleCancelEditInteraction}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </section>}

        {/* Contacts Directory */}
        <div className={`${openPeopleForm ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-4`}>
          <div className=" border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
            <h2 className="border-b border-slate-100 pb-3 text-sm font-bold text-slate-900 dark:border-slate-800 dark:text-white">
              <span>Relationships Directory ({people.length})</span>
            </h2>

            <div className="adaptive-card-grid mt-4 gap-3">
              {people.length === 0 ? (
                <div className="col-span-full">
                  <EmptyState
                    icon={Phone}
                    compact
                    title="No contacts yet"
                    hint="Add your first connection using the button above."
                  />
                </div>
              ) : (
                [...people].sort((a, b) => (a.name || '').localeCompare(b.name || '') || (b.createdAt || 0) - (a.createdAt || 0)).map(p => {
                  const pInteractions = interactions.filter(i => i.personId === p.id);
                  const isExpanded = Boolean(expandedPeopleInteractions[p.id]);
                  const displayedInteractions = isExpanded ? pInteractions : pInteractions.slice(0, 2);

                  return (
                    <div key={p.id} className="rounded-xl border border-slate-100 p-3.5 text-xs dark:border-slate-800 flex flex-col justify-between">
                      <div>
                        <div className="flex flex-wrap justify-between items-start gap-1">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 dark:text-white truncate">{p.name}</span>
                            </div>
                            <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
                              {p.relationship}
                            </div>
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
                          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                            <Phone className="h-3 w-3 shrink-0 text-slate-400" />
                            <span>{p.contact}</span>
                          </div>
                        )}

                        {p.importantDate && (() => {
                          const countdown = getImportantDateCountdown(p.importantDate);
                          const hasActiveReminder = (reminders || []).some(r => r.linkedId === p.id && r.status === 'open');

                          return (
                            <div className="mt-1.5 flex items-center justify-between gap-1 text-[10px] bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
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
                      <div className="mt-3 border-t border-slate-50 pt-2.5 text-[10px] text-slate-400 dark:border-slate-800">
                        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-semibold mb-1">
                          <span>{pInteractions.length} recorded touchpoint{pInteractions.length === 1 ? '' : 's'}</span>
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
                          <div className="space-y-1.5 mt-1.5">
                            {displayedInteractions.map(i => (
                              <div
                                key={i.id}
                                className={`group flex flex-wrap items-start justify-between gap-1.5 rounded-lg p-2 text-[10px] transition-colors ${
                                  editingInteraction?.id === i.id
                                    ? 'bg-amber-100/70 border border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200'
                                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:text-slate-300'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1 text-[9px] text-slate-400 font-mono mb-0.5">
                                    <span>{i.date}</span>
                                  </div>
                                  <p className="italic leading-relaxed break-words">"{i.text}"</p>
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
        </div>
      </div>
    </div>
  );
};
