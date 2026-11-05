import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TasksView } from '../TasksView';

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

describe('Tasks view navigation', () => {
  it('renders the task entry form and the shared work-area menu', async () => {
    await act(async () => {
      root.render(
        <TasksView
          tasks={[]}
          goals={[]}
          activeWorkAreaSection="tasks-roster"
          onSelectWorkAreaSection={vi.fn()}
          onRefresh={vi.fn()}
          onSuccess={vi.fn()}
        />
      );
    });

    expect(container.querySelector('h1')?.textContent).toBe('Tasks & Planner');
    expect(container.querySelector('form')).not.toBeNull();
    expect(container.querySelector('[aria-label="Tasks, routines and focus submenu"]')).not.toBeNull();
  });

  it('routes menu selections to the chosen work-area section', async () => {
    const onSelectWorkAreaSection = vi.fn();
    await act(async () => {
      root.render(
        <TasksView
          tasks={[]}
          goals={[]}
          activeWorkAreaSection="tasks-roster"
          onSelectWorkAreaSection={onSelectWorkAreaSection}
          onRefresh={vi.fn()}
          onSuccess={vi.fn()}
        />
      );
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Tasks, routines and focus submenu"]')!.click();
    });
    const dailyTarget = [...container.querySelectorAll('button')]
      .find(button => button.textContent?.includes('Daily Command Target'))!;
    await act(async () => dailyTarget.click());

    expect(onSelectWorkAreaSection).toHaveBeenCalledWith('tasks-daily');
  });
});