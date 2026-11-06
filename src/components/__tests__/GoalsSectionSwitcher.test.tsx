import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { GoalsSectionSwitcher, type GoalsSection } from '../GoalsSectionSwitcher';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const counts = { goals: 3, strategies: 2, milestones: 4, kpis: 1, missions: 0 };

describe('GoalsSectionSwitcher', () => {
  it('preserves menu order, counts and timeline delay information', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => {
      root.render(<GoalsSectionSwitcher activeSection="timeline" counts={counts} delayedCount={5} onSelectSection={vi.fn()} />);
    });
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Goals submenu"]')!.click());
    const options = [...container.querySelectorAll<HTMLButtonElement>('[data-goals-section]')];
    expect(options.map(option => option.textContent?.trim())).toEqual([
      'Timeline & Plan (5 delayed)', 'Strategic Goals (3)', 'Strategies (2)',
      'Milestones (4)', 'KPIs (1)', 'Missions (0)', 'Finance Summary'
    ]);
    expect(container.textContent).toContain('5 delayed');
    await act(async () => root.unmount());
  });

  it('dispatches every section selection and updates the visible label', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const onSelectSection = vi.fn();
    const render = (activeSection: GoalsSection) => root.render(
      <GoalsSectionSwitcher activeSection={activeSection} counts={counts} delayedCount={0} onSelectSection={onSelectSection} />
    );
    await act(async () => render('goals'));
    for (const section of ['timeline', 'strategies', 'milestones', 'kpis', 'missions', 'mentor', 'goals'] as GoalsSection[]) {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-label="Goals submenu"]')!.click();
      });
      await act(async () => container.querySelector<HTMLButtonElement>(`[data-goals-section="${section}"]`)!.click());
      expect(onSelectSection).toHaveBeenLastCalledWith(section);
      await act(async () => render(section));
      expect(container.querySelector<HTMLButtonElement>('[aria-label="Goals submenu"]')?.textContent)
        .toContain(section === 'goals' ? 'Strategic Goals' : sectionsLabel(section));
    }
    expect(onSelectSection).toHaveBeenCalledTimes(7);
    await act(async () => root.unmount());
  });
});

const sectionsLabel = (section: GoalsSection) => ({
  timeline: 'Timeline & Plan',
  goals: 'Strategic Goals',
  strategies: 'Strategies',
  milestones: 'Milestones',
  kpis: 'KPIs',
  missions: 'Missions',
  mentor: 'Finance Summary'
}[section]);
