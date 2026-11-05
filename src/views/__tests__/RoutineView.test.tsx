import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoutineView } from '../RoutineView';

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

describe('Routine view navigation', () => {
  it('renders the routine workspace with its shared work-area menu', async () => {
    await act(async () => {
      root.render(
        <RoutineView
          routines={[]}
          habits={[]}
          habitLogs={[]}
          activeWorkAreaSection="routine"
          onSelectWorkAreaSection={vi.fn()}
          onRefresh={vi.fn()}
          onSuccess={vi.fn()}
        />
      );
    });

    expect(container.querySelector('h1')?.textContent).toBe('Routine');
    expect(container.querySelector('[aria-label="Tasks, routines and focus submenu"]')).not.toBeNull();
    expect(container.textContent).toContain('Routine Genesis');
  });

  it('routes a switch to the habit workspace', async () => {
    const onSelectWorkAreaSection = vi.fn();
    await act(async () => {
      root.render(
        <RoutineView
          routines={[]}
          habits={[]}
          habitLogs={[]}
          activeWorkAreaSection="routine"
          onSelectWorkAreaSection={onSelectWorkAreaSection}
          onRefresh={vi.fn()}
          onSuccess={vi.fn()}
        />
      );
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Tasks, routines and focus submenu"]')!.click();
    });
    const habitOption = [...container.querySelectorAll('button')]
      .find(button => button.textContent?.trim() === 'Habit')!;
    await act(async () => habitOption.click());

    expect(onSelectWorkAreaSection).toHaveBeenCalledWith('routine-habits');
  });
});