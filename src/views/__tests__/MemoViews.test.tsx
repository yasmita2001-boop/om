import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotesView } from '../NotesView';
import { JournalView } from '../JournalView';

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
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Memo submenu"]')!.click();
    });
    const journalOption = [...container.querySelectorAll('button')]
      .find(button => button.textContent?.includes('Daily Journal'))!;
    await act(async () => journalOption.click());

    expect(onRequestAction).toHaveBeenCalledWith('reflection');
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
  });
});