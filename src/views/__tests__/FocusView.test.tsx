import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FocusView } from '../FocusView';

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

describe('Focus view navigation', () => {
  it('renders the focus timer and its shared work-area menu', async () => {
    await act(async () => {
      root.render(
        <FocusView
          sessions={[]}
          tasks={[]}
          goals={[]}
          profileId="test-profile"
          activeWorkAreaSection="focus-timer"
          onSelectWorkAreaSection={vi.fn()}
          onRefresh={vi.fn()}
          onSuccess={vi.fn()}
        />
      );
    });

    expect(container.querySelector('h1')?.textContent).toBe('Focus');
    expect(container.querySelector('[aria-label="Tasks, routines and focus submenu"]')?.textContent)
      .toContain('Deep Work Sprint');
    expect(container.querySelector('[aria-label="Tasks, routines and focus submenu"]')).not.toBeNull();
  });

  it('routes a menu selection to the ringtone studio', async () => {
    const onSelectWorkAreaSection = vi.fn();
    await act(async () => {
      root.render(
        <FocusView
          sessions={[]}
          tasks={[]}
          goals={[]}
          profileId="test-profile"
          activeWorkAreaSection="focus-timer"
          onSelectWorkAreaSection={onSelectWorkAreaSection}
          onRefresh={vi.fn()}
          onSuccess={vi.fn()}
        />
      );
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Tasks, routines and focus submenu"]')!.click();
    });
    const ringtoneOption = [...container.querySelectorAll('button')]
      .find(button => button.textContent?.trim() === 'Ringtone Studio')!;
    await act(async () => ringtoneOption.click());

    expect(onSelectWorkAreaSection).toHaveBeenCalledWith('focus-ringtones');
  });
});