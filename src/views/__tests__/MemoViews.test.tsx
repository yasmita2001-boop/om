import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotesView } from '../NotesView';
import { JournalView } from '../JournalView';
import type { JournalEntry, Note } from '../../types';
import { storage } from '../../lib/storage';

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
  vi.restoreAllMocks();
});

describe('Memo and journal navigation', () => {
  it('keeps text selected in memo and journal archive cards instead of opening their detail view', async () => {
    const note: Note = {
      id: 'memo-selection-1',
      title: 'Selectable memo',
      body: 'Select this memo text',
      html: '<p>Select this memo text</p>',
      category: 'General',
      date: '2026-11-05',
      createdAt: 1,
      updatedAt: 1
    };
    await act(async () => {
      root.render(
        <NotesView
          notes={[note]}
          categories={['General']}
          journalCount={0}
          pendingAction={null}
          onActionConsumed={vi.fn()}
          onRequestAction={vi.fn()}
          onRefresh={vi.fn()}
          onSuccess={vi.fn()}
        />
      );
    });
    const memoRow = container.querySelector<HTMLElement>('[data-record-id="memo-selection-1"]')!;
    const memoText = memoRow.querySelector('.om-rich-rendered')!.firstChild!;
    const range = document.createRange();
    range.selectNodeContents(memoText);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    await act(async () => memoRow.click());
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    selection.removeAllRanges();
    const entry: JournalEntry = {
      id: 'journal-selection-1',
      title: 'Selectable reflection',
      text: 'Select this journal text',
      html: '<p>Select this journal text</p>',
      date: '2026-11-05',
      createdAt: 1,
      updatedAt: 1
    };
    await act(async () => {
      root.render(
        <JournalView
          journal={[entry]}
          noteCount={0}
          pendingAction={null}
          onActionConsumed={vi.fn()}
          onRequestAction={vi.fn()}
          onRefresh={vi.fn()}
          onSuccess={vi.fn()}
        />
      );
    });
    const journalRow = container.querySelector<HTMLElement>('[data-record-id="journal-selection-1"]')!;
    const journalText = journalRow.querySelector('.om-rich-rendered')!.firstChild!;
    const journalRange = document.createRange();
    journalRange.selectNodeContents(journalText);
    selection.removeAllRanges();
    selection.addRange(journalRange);
    await act(async () => journalRow.click());
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('moves deleted memos to the recycle bin so they can be restored', async () => {
    const note: Note = {
      id: 'memo-delete-1',
      title: 'Restorable memo',
      body: 'Memo body',
      html: '<p>Memo body</p>',
      category: 'General',
      date: '2026-11-05',
      createdAt: 1,
      updatedAt: 1
    };
    const moveToRecycleBin = vi.spyOn(storage, 'moveToRecycleBin').mockResolvedValue(undefined);
    const onSuccess = vi.fn();

    await act(async () => {
      root.render(
        <NotesView
          notes={[note]}
          categories={['General']}
          journalCount={0}
          pendingAction={null}
          onActionConsumed={vi.fn()}
          onRequestAction={vi.fn()}
          onRefresh={vi.fn()}
          onSuccess={onSuccess}
        />
      );
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="More actions for Restorable memo"]')!.click();
      container.querySelector<HTMLButtonElement>('[aria-label="Delete memo"]')!.click();
    });
    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>('button')]
        .find(button => button.textContent?.trim() === 'Delete Memo')!
        .click();
    });

    expect(moveToRecycleBin).toHaveBeenCalledWith('notes', 'memo-delete-1');
    expect(onSuccess).toHaveBeenCalledWith(expect.stringContaining('restore it from Settings > System'));
  });

  it('moves deleted journal entries to the recycle bin so they can be restored', async () => {
    const entry: JournalEntry = {
      id: 'journal-delete-1',
      title: 'Restorable reflection',
      text: 'Journal body',
      html: '<p>Journal body</p>',
      date: '2026-11-05',
      createdAt: 1,
      updatedAt: 1
    };
    const moveToRecycleBin = vi.spyOn(storage, 'moveToRecycleBin').mockResolvedValue(undefined);
    const onSuccess = vi.fn();

    await act(async () => {
      root.render(
        <JournalView
          journal={[entry]}
          noteCount={0}
          pendingAction={null}
          onActionConsumed={vi.fn()}
          onRequestAction={vi.fn()}
          onRefresh={vi.fn()}
          onSuccess={onSuccess}
        />
      );
    });

    await act(async () => {
      container.querySelector<HTMLElement>('[aria-label="Open journal entry: Restorable reflection"]')!.click();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Delete journal entry"]')!.click();
    });
    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>('button')]
        .find(button => button.textContent?.trim() === 'Delete Entry')!
        .click();
    });

    expect(moveToRecycleBin).toHaveBeenCalledWith('journal', 'journal-delete-1');
    expect(container.querySelector('[aria-label="Close entry"]')).toBeNull();
    expect(onSuccess).toHaveBeenCalledWith(expect.stringContaining('restore it from Settings > System'));
  });

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
      container.querySelector<HTMLButtonElement>('[aria-label="Memo & Journal"]')!.click();
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
      container.querySelector<HTMLButtonElement>('[aria-label="Close memo editor"]')!.click();
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

    expect(container.querySelector('h1')?.textContent).toBe('Journal');
    expect(container.querySelector('[aria-label="Memo & Journal"]')).not.toBeNull();
    expect(container.querySelector('.journal-editor-panel')).not.toBeNull();
    expect(container.querySelector('.journal-editor-panel')?.className).toContain('lg:col-span-12');
    expect(container.querySelector('.journal-archive-panel')).toBeNull();
    expect([...container.querySelectorAll('button')].some(button => button.textContent?.includes('New Entry'))).toBe(false);
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
      container.querySelector<HTMLButtonElement>('[aria-label="Close journal editor"]')!.click();
    });
    expect(container.querySelector('.journal-editor-panel')).toBeNull();
    expect(container.querySelector('.journal-archive-panel')?.className).toContain('lg:col-span-12');
    expect([...container.querySelectorAll('button')].some(button => button.textContent?.includes('New Entry'))).toBe(true);
  });
});
