import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkView } from '../WorkView';

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

describe('Embedded Work Genesis cards', () => {
  it.each([
    ['learning', 'learning form', 'Learning Genesis', 'Add Learning Track'],
    ['skills', 'skill form', 'Skill Genesis', 'Add Skill']
  ] as const)('can hide and reopen the embedded %s card', async (tab, ariaLabel, heading, reopenLabel) => {
    await act(async () => {
      root.render(
        <WorkView
          learningItems={[]}
          skills={[]}
          embedded
          initialTab={tab}
          onRefresh={vi.fn()}
          onSuccess={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain(heading);
    await act(async () => {
      container.querySelector<HTMLButtonElement>(`[aria-label="Close ${ariaLabel}"]`)!.click();
    });
    expect(container.textContent).not.toContain(heading);

    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>('button')]
        .find(button => button.textContent?.includes(reopenLabel))!
        .click();
    });
    expect(container.textContent).toContain(heading);
  });
});
