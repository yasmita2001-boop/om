import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PeopleView } from '../PeopleView';
import type { Goal, Interaction, Meeting, Person } from '../../types';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const storageMocks = vi.hoisted(() => ({
  put: vi.fn(async () => undefined),
  delete: vi.fn(async () => undefined),
  generateUUID: vi.fn(() => 'generated-id')
}));

vi.mock('../../lib/storage', () => ({
  storage: {
    put: storageMocks.put,
    delete: storageMocks.delete
  },
  generateUUID: storageMocks.generateUUID
}));

vi.mock('../../lib/goalTaskSync', () => ({
  syncGoalProgressFromMeetings: vi.fn(async () => undefined)
}));

import { storage, generateUUID } from '../../lib/storage';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('People card', () => {
  it('shows touchpoints inside the contact card without a second card', async () => {
    const person: Person = {
      id: 'person-1',
      name: 'Alex',
      relationship: 'Colleague',
      createdAt: 1
    };
    const interaction: Interaction = {
      id: 'interaction-1',
      personId: person.id,
      date: '2026-11-05',
      text: 'Discussed the launch',
      createdAt: 1
    };

    await act(async () => root.render(
      <PeopleView
        people={[person]}
        interactions={[interaction]}
        embedded
        onRefresh={vi.fn()}
        onSuccess={vi.fn()}
      />
    ));

    expect(container.querySelectorAll('.dashboard-item-row')).toHaveLength(1);
    const name = container.querySelector('.dashboard-item-row .font-bold');
    const relationship = [...(container.querySelectorAll('.dashboard-item-row span') || [])]
      .find(span => span.textContent === 'Colleague');
    expect(name?.parentElement).toBe(relationship?.parentElement);
    const touchpointSection = container.querySelector('.dashboard-item-row .border-t');
    expect(touchpointSection?.firstElementChild?.textContent).toContain('1 recorded touchpoint');
    expect(touchpointSection?.firstElementChild?.textContent).toContain('2026-11-05');
    expect(container.textContent).toContain('Discussed the launch');
    expect(touchpointSection?.querySelector('p')?.textContent).not.toContain('2026-11-05');
  });

  it('keeps dates beside each memo when a contact has multiple touchpoints', async () => {
    const person: Person = {
      id: 'person-1',
      name: 'Alex',
      relationship: 'Colleague',
      createdAt: 1
    };
    const interactions: Interaction[] = [
      { id: 'interaction-1', personId: person.id, date: '2026-11-05', text: 'Discussed launch', createdAt: 1 },
      { id: 'interaction-2', personId: person.id, date: '2026-11-04', text: 'Reviewed plan', createdAt: 2 }
    ];

    await act(async () => root.render(
      <PeopleView
        people={[person]}
        interactions={interactions}
        embedded
        onRefresh={vi.fn()}
        onSuccess={vi.fn()}
      />
    ));

    const touchpointSection = container.querySelector('.dashboard-item-row .border-t');
    expect(touchpointSection?.firstElementChild?.textContent).toContain('2 recorded touchpoints');
    const entries = [...(touchpointSection?.querySelectorAll('p') || [])].map(entry => entry.textContent);
    expect(entries).toContain('2026-11-05"Discussed launch"');
    expect(entries).toContain('2026-11-04"Reviewed plan"');
  });

  it('keeps only the memo, attendees, and goal fields with person details in one form', async () => {
    const person: Person = {
      id: 'person-1',
      name: 'Alex',
      relationship: 'Colleague',
      createdAt: 1
    };
    const goal: Goal = {
      id: 'goal-1',
      title: 'Launch initiative',
      progress: 0,
      level: 1,
      createdAt: 1,
      updatedAt: 1
    };

    await act(async () => root.render(
      <PeopleView
        people={[person]}
        interactions={[]}
        goals={[goal]}
        embedded
        initialForm="person"
        onRefresh={vi.fn()}
        onSuccess={vi.fn()}
      />
    ));

    const formCard = container.querySelector('section');
    expect(container.querySelector('[aria-label="People actions"]')).toBeNull();
    expect(formCard?.querySelectorAll('form')).toHaveLength(1);
    expect(formCard?.querySelectorAll('button[type="submit"]')).toHaveLength(1);
    const fullNameLabel = [...(formCard?.querySelectorAll('label') || [])].find(label => label.textContent === 'Full Name');
    const goalModeToggle = formCard?.querySelector('[role="switch"][aria-label="Full Name mode"]');
    expect(fullNameLabel?.parentElement?.contains(goalModeToggle ?? null) ?? false).toBe(true);
    expect(formCard?.textContent).toContain('Add Important Person');
    expect(goalModeToggle?.textContent).toContain('Manual');
    expect(formCard?.textContent).toContain('Attendees');
    expect(formCard?.textContent).toContain('Interaction Memo');
    expect(formCard?.textContent).not.toContain('Meetings (');
    expect(container.textContent).toContain('Alex');
    expect(formCard?.textContent).not.toContain('Agenda / Topic');
    expect(formCard?.textContent).not.toContain('Related Person');
    expect(formCard?.querySelector('textarea[placeholder*="Discussed"]') ?? null).not.toBeNull();
  });

  it('saves the contact, memo, and meeting together from the single submit button', async () => {
    const goal: Goal = {
      id: 'goal-1',
      title: 'Launch initiative',
      progress: 0,
      level: 1,
      createdAt: 1,
      updatedAt: 1
    };
    vi.mocked(generateUUID)
      .mockReturnValueOnce('new-person')
      .mockReturnValueOnce('new-interaction')
      .mockReturnValueOnce('new-meeting');

    await act(async () => root.render(
      <PeopleView
        people={[]}
        interactions={[]}
        goals={[goal]}
        embedded
        initialForm="person"
        onRefresh={vi.fn()}
        onSuccess={vi.fn()}
      />
    ));

    const updateValue = (element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set;
      setter?.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };

    await act(async () => {
      updateValue(container.querySelector('input[placeholder="e.g. Elena Rostova"]')!, 'Sam');
      updateValue(container.querySelector('textarea[placeholder*="Discussed"]')!, 'Discussed the launch');
      updateValue(container.querySelector('input[placeholder="Team, Alex"]')!, 'Sam, team');
      container.querySelector<HTMLButtonElement>('[role="switch"][aria-label="Full Name mode"]')!.click();
    });

    await act(async () => {
      updateValue(container.querySelector('select[aria-label="Choose a goal"]')!, 'goal-1');
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    });

    const savedStores = vi.mocked(storage.put).mock.calls.map(([store]) => store);
    expect(savedStores).toEqual(['people', 'interactions', 'meetings']);
    const savedPerson = vi.mocked(storage.put).mock.calls[0][1] as Person;
    const savedInteraction = vi.mocked(storage.put).mock.calls[1][1] as Interaction;
    const savedMeeting = vi.mocked(storage.put).mock.calls[2][1] as Meeting;
    expect(vi.mocked(storage.put).mock.calls.filter(([store]) => store === 'people')).toHaveLength(1);
    expect(savedInteraction.personId).toBe(savedPerson.id);
    expect(savedPerson.id).toBe('new-person');
    expect(savedMeeting.goalId).toBe('goal-1');
    expect(savedMeeting.personId).toBe(savedPerson.id);
    expect(savedMeeting.title).toBe('Sam meeting');
    expect(savedMeeting.people).toBe('Sam, team');
  });
});
