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

  it('shows the same complete financial position as Finance and opens the Ledger', async () => {
    const onNavigate = vi.fn();
    await act(async () => root.render(
      <DashboardView
        tasks={[]}
        goals={[]}
        habits={[]}
        habitLogs={[]}
        finance={[]}
        accounts={[{ id: 'cash', name: 'Cash', type: 'cash', balance: 100, openingBalance: 100 }]}
        assets={[{ id: 'asset', name: 'Asset', value: 200 }]}
        liabilities={[{ id: 'manual-debt', name: 'Manual debt', amount: 50 }]}
        loans={[
          { id: 'borrowed', name: 'Borrowed', principal: 400, rate: 0, tenure: 1, dueDay: 1, outstanding: 400, createdAt: 1 },
          { id: 'lent', name: 'Lent', principal: 250, rate: 0, tenure: 1, dueDay: 1, outstanding: 250, direction: 'lent', createdAt: 1 }
        ]}
        investments={[{
          id: 'investment',
          name: 'Investment',
          amount: 1000,
          currentValue: 900,
          date: '2026-01-01',
          createdAt: 1,
          updatedAt: 1
        }]}
        investmentActivities={[]}
        savingsPlans={[{
          id: 'savings',
          name: 'Savings',
          currentAmount: 300,
          targetAmount: 0,
          durationMonths: 12,
          createdAt: 1
        }]}
        onNavigate={onNavigate}
        onToggleTask={vi.fn()}
        onLogHabit={vi.fn()}
        onOpenQuickCapture={vi.fn()}
      />
    ));

    const netWorthCard = container.querySelector<HTMLButtonElement>('.dashboard-view > button');
    expect(netWorthCard?.textContent).toContain('1,300');
    expect(netWorthCard?.textContent).toContain('Assets');
    expect(netWorthCard?.textContent).toContain('1,750');
    expect(netWorthCard?.textContent).toContain('Debt');
    expect(netWorthCard?.textContent).toContain('450');

    await act(async () => netWorthCard?.click());
    expect(onNavigate).toHaveBeenCalledWith('finance');
  });
});
