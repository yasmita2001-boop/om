import React, { useState } from 'react';
import { Plus, Phone, Calendar, Trash2 } from 'lucide-react';
import { Person, Interaction } from '../types';
import { storage, generateUUID } from '../lib/storage';

interface PeopleViewProps {
  people: Person[];
  interactions: Interaction[];
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
}

export const PeopleView: React.FC<PeopleViewProps> = ({
  people,
  interactions,
  onRefresh,
  onSuccess
}) => {
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('Friend');
  const [contact, setContact] = useState('');
  const [importantDate, setImportantDate] = useState('');

  // Interaction logger
  const [selectedPersonId, setSelectedPersonId] = useState(people[0]?.id || '');
  const [interactionText, setInteractionText] = useState('');

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const p: Person = {
      id: generateUUID(),
      name: name.trim(),
      relationship,
      contact: contact.trim() || undefined,
      importantDate: importantDate || undefined,
      createdAt: Date.now()
    };

    await storage.put('people', p);
    onSuccess(`Contact "${name}" added`);
    setName('');
    setContact('');
    onRefresh();
  };

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPersonId || !interactionText.trim()) return;

    const inter: Interaction = {
      id: generateUUID(),
      personId: selectedPersonId,
      date: new Date().toISOString().slice(0, 10),
      text: interactionText.trim(),
      createdAt: Date.now()
    };

    await storage.put('interactions', inter);
    onSuccess('Interaction logged');
    setInteractionText('');
    onRefresh();
  };

  const handleDeletePerson = async (id: string) => {
    await storage.delete('people', id);
    onSuccess('✓ Contact deleted');
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
          People & Relationships
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Add Person (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <Plus className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Add Important Person</h2>
            </div>

            <form onSubmit={handleAddPerson} className="mt-4 space-y-3">
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Relationship</label>
                  <select
                    value={relationship}
                    onChange={e => setRelationship(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs dark:border-slate-700 dark:bg-slate-800"
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
                  <input
                    type="date"
                    value={importantDate}
                    onChange={e => setImportantDate(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs dark:border-slate-700 dark:bg-slate-800"
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
                className="w-full rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                Save Contact
              </button>
            </form>
          </div>

          {/* Log Interaction */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Log Touchpoint / Interaction
            </h2>

            <form onSubmit={handleAddInteraction} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Person</label>
                <select
                  value={selectedPersonId}
                  onChange={e => setSelectedPersonId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs dark:border-slate-700 dark:bg-slate-800"
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
                  value={interactionText}
                  onChange={e => setInteractionText(e.target.value)}
                  placeholder="Discussed architecture direction and mutual project goals..."
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-700"
              >
                Log Interaction
              </button>
            </form>
          </div>
        </div>

        {/* Contacts Directory (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Relationships Directory ({people.length})
            </h2>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {people.length === 0 ? (
                <div className="col-span-full py-12 text-center text-xs text-slate-400">
                  No contacts recorded yet. Add your first connection on the left.
                </div>
              ) : (
                [...people].sort((a, b) => (a.name || '').localeCompare(b.name || '') || (b.createdAt || 0) - (a.createdAt || 0)).map(p => {
                  const pInteractions = interactions.filter(i => i.personId === p.id);
                  return (
                    <div key={p.id} className="rounded-xl border border-slate-100 p-3.5 text-xs dark:border-slate-800">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{p.name}</div>
                          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                            {p.relationship}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeletePerson(p.id)}
                          className="text-slate-300 hover:text-rose-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {p.contact && (
                        <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {p.contact}
                        </div>
                      )}

                      {p.importantDate && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                          <Calendar className="h-3 w-3" />
                          <span>{p.importantDate}</span>
                        </div>
                      )}

                      <div className="mt-2.5 border-t border-slate-50 pt-2 text-[10px] text-slate-400 dark:border-slate-800">
                        {pInteractions.length} recorded interactions
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
