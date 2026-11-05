import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoalsView } from '../GoalsView';

vi.mock('../../components/ProjectTimelinePlan', () => ({
  ProjectTimelinePlan: () => <div>Project timeline content</div>,
  computeItemDelay: () => ({ isDelayed: true })
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const goal = {
  id: 'main-goal', title: 'Launch product', level: 1 as const,
  progress: 0, createdAt: 0, updatedAt: 0
};

const populatedRecords = {
  goals: [goal],
  strategies: [{ id: 'strategy', goalId: goal.id, title: 'Strategy', action: '', status: 'active', createdAt: 1, updatedAt: 1 }],
  milestones: [{ id: 'milestone', goalId: goal.id, title: 'Milestone', progress: 0, status: 'pending', createdAt: 1, updatedAt: 1 }],
  kpis: [{ id: 'kpi', goalId: goal.id, name: 'KPI', target: 10, current: 1, unit: 'items', status: 'active', createdAt: 1, updatedAt: 1 }],
  missions: [{ id: 'mission', title: 'Mission', period: 'Now', target: '', action: '', status: 'active', createdAt: 1, updatedAt: 1 }]
};

type GoalsProps = ComponentProps<typeof GoalsView>;

let container: HTMLDivElement;
let root: Root;

const selectSection = async (section: string) => {
  await act(async () => {
    container.querySelector<HTMLButtonElement>('[aria-label="Goals submenu"]')!.click();
  });
  await act(async () => {
    container.querySelector<HTMLButtonElement>(`[data-goals-section="${section}"]`)!.click();
  });
};

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const renderGoals = async (overrides: Partial<GoalsProps> = {}) => {
  await act(async () => {
    root.render(<GoalsView goals={[goal]} accounts={[]} onRefresh={vi.fn()} onSuccess={vi.fn()} {...overrides} />);
  });
};

describe('Goals submenu', () => {
  it('shows all seven sections with live counts and the initial goal entry form', async () => {
    await renderGoals();
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Goals submenu"]')!.click();
    });
    const options = [...container.querySelectorAll<HTMLButtonElement>('[data-goals-section]')];
    expect(options.map(option => option.dataset.goalsSection)).toEqual([
      'timeline', 'goals', 'strategies', 'milestones', 'kpis', 'missions', 'mentor'
    ]);
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Goals submenu"]')?.textContent).toContain('Strategic Goals');
    expect(options[1].textContent).toContain('Strategic Goals (1)');
    expect(options[2].textContent).toContain('Strategies (0)');
    expect(container.querySelector('.goal-form-container form')).not.toBeNull();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('adapts the goal entry and portfolio cards to whether goals exist', async () => {
    await renderGoals({ goals: [] });
    let layout = container.querySelector('.goal-entry-layout')!;
    expect(container.querySelector('.goal-form-container')?.className).toContain('lg:col-span-12');
    expect(layout.querySelector('.goal-portfolio-shell')).toBeNull();

    await renderGoals({ goals: populatedRecords.goals });
    layout = container.querySelector('.goal-entry-layout')!;
    expect(container.querySelector('.goal-form-container')?.className).toContain('lg:col-span-5');
    expect(layout.children[1].className).toContain('lg:col-span-7');
    expect(layout.querySelector('.goal-portfolio-shell')).not.toBeNull();
  });

  it.each([
    ['strategies', 'strategy-entry-layout', { strategies: populatedRecords.strategies }],
    ['milestones', 'milestone-entry-layout', { milestones: populatedRecords.milestones }],
    ['kpis', 'kpi-entry-layout', { kpis: populatedRecords.kpis }],
    ['missions', 'mission-entry-layout', { missions: populatedRecords.missions }]
  ] as const)('uses the wide empty form and only shows the %s history when populated', async (section, layoutClass, records) => {
    await renderGoals({ goals: [] });
    await selectSection(section);
    let layout = container.querySelector(`.${layoutClass}`)!;
    expect(layout.children).toHaveLength(1);
    expect(layout.children[0].className).toContain('lg:col-span-12');
    expect(layout.querySelector('form button[type="submit"]')?.className).toContain('life-form-submit');

    await renderGoals(records);
    layout = container.querySelector(`.${layoutClass}`)!;
    expect(layout.children).toHaveLength(2);
    expect(layout.children[0].className).toContain('lg:col-span-5');
    expect(layout.children[1].className).toContain('lg:col-span-7');
  });

  it.each([
    ['strategies', 'Declare Tactical Strategy'],
    ['milestones', 'Add Milestone to Strategic Goal'],
    ['kpis', 'Register Quantitative KPI'],
    ['missions', 'Declare Mission / Monthly Focus'],
    ['mentor', 'Mentor Strategy & Capital Preservation']
  ])('opens the %s form immediately after selection', async (section, heading) => {
    await renderGoals();
    await selectSection(section);
    const disclosure = container.querySelector('details')!;
    expect(disclosure.open).toBe(true);
    expect(disclosure.textContent).toContain(heading);
    expect(disclosure.querySelector('form')).not.toBeNull();
    expect(disclosure.querySelector('form button[type="submit"]')?.className).toContain('life-form-submit');
    expect(container.querySelector('.goal-form-container')).toBeNull();
  });

  it('reopens a collapsed form after switching away and back', async () => {
    await renderGoals();
    await selectSection('strategies');
    await act(async () => {
      const disclosure = container.querySelector('details')!;
      disclosure.open = false;
      disclosure.dispatchEvent(new Event('toggle'));
    });
    expect(container.querySelector('details')!.open).toBe(false);
    await selectSection('missions');
    await selectSection('strategies');
    expect(container.querySelector('details')!.open).toBe(true);
  });

  it('reopens the goal form from the menu and keeps existing drafts', async () => {
    await renderGoals();
    const input = container.querySelector<HTMLInputElement>('.goal-form-container input[type="text"]')!;
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setValue.call(input, 'Unsaved goal draft');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Close goal form"]')!.click();
    });
    expect(container.querySelector('.goal-form-container')).toBeNull();
    await selectSection('missions');
    await selectSection('goals');
    expect(container.querySelector<HTMLInputElement>('.goal-form-container input[type="text"]')!.value)
      .toBe('Unsaved goal draft');
  });

  it('opens the existing timeline without creating or saving records', async () => {
    await renderGoals();
    await selectSection('timeline');
    expect(container.textContent).toContain('Project timeline content');
    expect(container.querySelector('.goal-form-container')).toBeNull();
  });

  it('keeps delayed-item counts and the timeline alert navigation', async () => {
    await act(async () => {
      root.render(
        <GoalsView
          goals={[goal]}
          accounts={[]}
          tasks={[{ id: 'delayed-task', title: 'Overdue task', domain: 'work', priority: 'High', status: 'open', done: false, createdAt: 0, updatedAt: 0 }]}
          onRefresh={vi.fn()}
          onSuccess={vi.fn()}
        />
      );
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Goals submenu"]')!.click();
    });
    expect(container.querySelector('[data-goals-section="timeline"]')?.textContent).toContain('Timeline & Plan (1 delayed)');
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Goals submenu"]')!.click();
    });
    const timelineButton = [...container.querySelectorAll('button')]
      .find(button => button.textContent?.includes('Open Project Timeline & Alarms'))!;
    await act(async () => timelineButton.click());
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Goals submenu"]')?.textContent).toContain('Timeline & Plan');
    expect(container.textContent).toContain('Project timeline content');
    expect(container.textContent).not.toContain('Cross-System Delay Alert');
  });
});
