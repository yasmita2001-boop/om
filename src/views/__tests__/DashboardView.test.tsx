import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardView from '../DashboardView';

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

describe('Dashboard finance activity', () => {
  it('shows transactions even when the profile has no habits', async () => {
    await act(async () => root.render(
      <DashboardView
        tasks={[]}
        goals={[]}
        habits={[]}
        habitLogs={[]}
        finance={[{
          id: 'transaction-1',
          type: 'expense',
          amount: 40,
          category: 'Food & Dining',
          date: '2026-11-05',
          paymentMethod: 'ATM',
          createdAt: 1
        }]}
        onNavigate={vi.fn()}
        onToggleTask={vi.fn()}
        onLogHabit={vi.fn()}
        onOpenQuickCapture={vi.fn()}
      />
    ));

    expect(container.textContent).toContain('Money this month');
    expect(container.textContent).toContain('Food & Dining');
    expect(container.textContent).toContain('40');
  });
});
