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
    getAll: vi.fn(async () => []),
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

  it('shows the person fields separately from touchpoint and meeting fields', async () => {
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
    expect(formCard?.textContent).toContain('Add Contact');
    expect(formCard?.textContent).toContain('Full Name');
    expect(formCard?.textContent).not.toContain('Attendees');
    expect(formCard?.textContent).not.toContain('Interaction Memo');
    expect([...formCard!.querySelectorAll('button')].map(button => button.textContent?.trim()).filter(Boolean)).toEqual([
      'Contact', 'Touchpoint', 'Meeting', 'Save Contact'
    ]);
    expect(container.textContent).toContain('Alex');
    expect(formCard?.querySelector('textarea[aria-label="Interaction memo"]') ?? null).toBeNull();
  });

  it('saves a contact and a goal-linked meeting through their respective form modes', async () => {
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
      const prototype = element instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : element instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLSelectElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      setter?.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };

    await act(async () => {
      updateValue(container.querySelector('input[aria-label="Full name"]')!, 'Sam');
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    });
    expect(vi.mocked(storage.put).mock.calls.map(([store]) => store)).toEqual(['people']);

    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'Meeting')!.click();
    });

    await act(async () => {
      updateValue(container.querySelector('input[aria-label="Attendees"]')!, 'Sam, team');
      container.querySelector<HTMLButtonElement>('[role="switch"][aria-label="Meeting Title mode"]')!.click();
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    });

    const savedStores = vi.mocked(storage.put).mock.calls.map(([store]) => store);
    expect(savedStores).toEqual(['people', 'meetings']);
    const savedPerson = vi.mocked(storage.put).mock.calls[0][1] as Person;
    const savedMeeting = vi.mocked(storage.put).mock.calls[1][1] as Meeting;
    expect(vi.mocked(storage.put).mock.calls.filter(([store]) => store === 'people')).toHaveLength(1);
    expect(savedPerson.id).toBe('new-person');
    expect(savedMeeting.goalId).toBe('goal-1');
    expect(savedMeeting.title).toBe('Contact meeting');
    expect(savedMeeting.people).toBe('Sam, team');
  });
});
