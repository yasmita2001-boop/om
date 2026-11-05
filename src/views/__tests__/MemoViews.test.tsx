import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotesView } from '../NotesView';
import { JournalView } from '../JournalView';
import type { JournalEntry, Note } from '../../types';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('Memo and journal navigation', () => {
  it('renders the memo view and routes the journal action through its menu', async () => {
    const onRequestAction = vi.fn();
    await act(async () => {
      root.render(
        <NotesView
          notes={[]}
          categories={['General']}
          journalCount={0}
          pendingAction={null}
          onActionConsumed={vi.fn()}
          onRequestAction={onRequestAction}
          onRefresh={vi.fn()}
          onSuccess={vi.fn()}
        />
      );
    });

    expect(container.querySelector('h1')?.textContent).toBe('Memo');
    expect(container.querySelector('.memo-editor-panel')).not.toBeNull();
    expect(container.querySelector('.memo-archive-panel')).toBeNull();
    expect([...container.querySelectorAll('button')].some(button => button.textContent?.includes('New Memo'))).toBe(false);
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Memo submenu"]')!.click();
    });
    const journalOption = [...container.querySelectorAll('button')]
      .find(button => button.textContent?.includes('Daily Journal'))!;
    await act(async () => journalOption.click());

    expect(onRequestAction).toHaveBeenCalledWith('reflection');
  });

  it('uses a full-width editor while the archive is empty, then splits the populated memo layout', async () => {
    const note: Note = {
      id: 'memo-1',
      title: 'First memo',
      body: '',
      html: '',
      category: 'General',
      date: '2026-11-05',
      createdAt: 1,
      updatedAt: 1
    };
    const onActionConsumed = vi.fn();
    const onRequestAction = vi.fn();
    const renderNotes = (notes: Note[], pendingAction: 'note' | null) => (
      <NotesView
        notes={notes}
        categories={['General']}
        journalCount={0}
        pendingAction={pendingAction}
        onActionConsumed={onActionConsumed}
        onRequestAction={onRequestAction}
        onRefresh={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    await act(async () => root.render(renderNotes([], 'note')));

    expect(container.querySelector('.memo-editor-panel')?.className).toContain('lg:col-span-12');
    expect(container.querySelector('.memo-archive-panel')).toBeNull();

    await act(async () => root.render(renderNotes([note], null)));

    expect(container.querySelector('.memo-editor-panel')?.className).toContain('lg:col-span-5');
    expect(container.querySelector('.memo-archive-panel')?.className).toContain('lg:col-span-7');

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Close note editor"]')!.click();
    });

    expect(container.querySelector('.memo-editor-panel')).toBeNull();
    expect(container.querySelector('.memo-archive-panel')?.className).toContain('lg:col-span-12');
    expect([...container.querySelectorAll('button')].some(button => button.textContent?.includes('New Memo'))).toBe(true);
  });

  it('renders the journal view and exposes the same section menu', async () => {
    await act(async () => {
      root.render(
        <JournalView
          journal={[]}
          noteCount={0}
          pendingAction={null}
          onActionConsumed={vi.fn()}
          onRequestAction={vi.fn()}
          onRefresh={vi.fn()}
          onSuccess={vi.fn()}
        />
      );
    });

    expect(container.querySelector('h1')?.textContent).toBe('Notes');
    expect(container.querySelector('[aria-label="Memo submenu"]')).not.toBeNull();
    expect(container.querySelector('.journal-editor-panel')).not.toBeNull();
    expect(container.querySelector('.journal-editor-panel')?.className).toContain('lg:col-span-12');
    expect(container.querySelector('.journal-archive-panel')).toBeNull();
    expect([...container.querySelectorAll('button')].some(button => button.textContent?.includes('New Reflection'))).toBe(false);
  });

  it('keeps the journal editor full-width when empty, then splits the populated history layout', async () => {
    const entry: JournalEntry = {
      id: 'reflection-1',
      title: 'First reflection',
      text: '',
      html: '',
      date: '2026-11-05',
      createdAt: 1,
      updatedAt: 1
    };
    const onActionConsumed = vi.fn();
    const onRequestAction = vi.fn();
    const renderJournal = (journal: JournalEntry[], pendingAction: 'reflection' | null) => (
      <JournalView
        journal={journal}
        noteCount={0}
        pendingAction={pendingAction}
        onActionConsumed={onActionConsumed}
        onRequestAction={onRequestAction}
        onRefresh={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    await act(async () => root.render(renderJournal([], null)));
    expect(container.querySelector('.journal-editor-panel')?.className).toContain('lg:col-span-12');
    expect(container.querySelector('.journal-archive-panel')).toBeNull();

    await act(async () => root.render(renderJournal([entry], null)));
    expect(container.querySelector('.journal-editor-panel')?.className).toContain('lg:col-span-5');
    expect(container.querySelector('.journal-archive-panel')?.className).toContain('lg:col-span-7');

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Close reflection editor"]')!.click();
    });
    expect(container.querySelector('.journal-editor-panel')).toBeNull();
    expect(container.querySelector('.journal-archive-panel')?.className).toContain('lg:col-span-12');
    expect([...container.querySelectorAll('button')].some(button => button.textContent?.includes('New Reflection'))).toBe(true);
  });
});