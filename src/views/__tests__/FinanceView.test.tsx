import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceView } from '../FinanceView';

const financeStorageMock = vi.hoisted(() => ({
  getSingleton: vi.fn(async () => ({ theme: 'dark', mentor: { careerFund: 40 } })),
  setSingleton: vi.fn(async (_key: string, _value: unknown) => undefined)
}));

vi.mock('../../lib/storage', () => ({
  storage: financeStorageMock,
  generateUUID: vi.fn(() => 'finance-test-id')
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type FinanceProps = ComponentProps<typeof FinanceView>;
const originalScrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');

const createProps = (overrides: Partial<FinanceProps> = {}): FinanceProps => ({
  accounts: [],
  transactions: [],
  loans: [],
  loanPayments: [],
  investments: [],
  investmentActivities: [],
  cashFlowSchedules: [],
  savingsPlans: [],
  assets: [],
  liabilities: [],
  receipts: [],
  goals: [],
  onRefresh: vi.fn(),
  onSuccess: vi.fn(),
  onError: vi.fn(),
  onNavigate: vi.fn(),
  ...overrides
});

const populatedProps = {
  loans: [{ id: 'loan', name: 'Loan', principal: 100, rate: 1, tenure: 12, dueDay: 1, outstanding: 100, createdAt: 1 }],
  investments: [{ id: 'investment', name: 'Investment', amount: 100, currentValue: 100, date: '2025-01-01', createdAt: 1, updatedAt: 1 }],
  savingsPlans: [{ id: 'savings', name: 'Savings', currentAmount: 100, targetAmount: 200, durationMonths: 12, createdAt: 1 }],
  assets: [{ id: 'asset', name: 'Asset', value: 100 }],
  cashFlowSchedules: [{
    id: 'schedule',
    name: 'Schedule',
    type: 'expense' as const,
    category: 'Bills',
    amount: 100,
    frequency: 'monthly' as const,
    startDate: '2025-01-01',
    nextDueDate: '2025-01-01',
    status: 'active' as const,
    createdAt: 1,
    updatedAt: 1
  }]
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, writable: true, value: vi.fn() });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  if (originalScrollIntoViewDescriptor) {
    Object.defineProperty(Element.prototype, 'scrollIntoView', originalScrollIntoViewDescriptor);
  } else {
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  }
});

const renderFinance = async (props: FinanceProps) => {
  await act(async () => root.render(<FinanceView {...props} />));
};

const selectMenu = async (menu: string) => {
  const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Finance submenu"]')!;
  await act(async () => {
    trigger.click();
  });
  const selectedItem = container.querySelector<HTMLButtonElement>(`[data-finance-menu-id="${menu}"]`);
  await act(async () => {
    selectedItem?.click();
  });
};

describe('Finance entry and history card layouts', () => {
  it('excludes ledger-only balance updates from the cash flow statement', async () => {
    await renderFinance(createProps({
      transactions: [
        {
          id: 'income',
          type: 'income',
          amount: 300,
          category: 'Salary',
          date: '2026-11-05',
          createdAt: 1
        },
        {
          id: 'ledger-only-income',
          type: 'income',
          amount: 900,
          category: 'Balance correction',
          date: '2026-11-05',
          ledgerOnly: true,
          createdAt: 2
        },
        {
          id: 'expense',
          type: 'expense',
          amount: 100,
          category: 'Food',
          date: '2026-11-05',
          createdAt: 3
        },
        {
          id: 'ledger-only-expense',
          type: 'expense',
          amount: 50,
          category: 'Balance correction',
          date: '2026-11-05',
          ledgerOnly: true,
          createdAt: 4
        }
      ]
    }));

    const valueFor = (label: string) => {
      const labelElement = Array.from(container.querySelectorAll('span'))
        .find(element => element.textContent?.trim() === label);
      return labelElement?.nextElementSibling?.textContent?.trim();
    };

    expect(valueFor('Gross Income Received:')).toBe('+NPR 300');
    expect(valueFor('Operating Expenses Paid:')).toBe('-NPR 100');
    expect(valueFor('Net Operating Flow:')).toBe('NPR 200');
  });

  it('counts borrowed debt without counting lent receivables as debt', async () => {
    await renderFinance(createProps({
      loans: [
        { id: 'borrowed', name: 'Borrowed', principal: 100, rate: 0, tenure: 1, dueDay: 1, outstanding: 100, createdAt: 1 },
        { id: 'lent', name: 'Lent', principal: 75, rate: 0, tenure: 1, dueDay: 1, outstanding: 75, direction: 'lent', createdAt: 2 }
      ]
    }));

    expect(container.textContent).toContain('1 borrowed loan · 0 other debt');
  });

  it('hides the empty-state block when the ledger has no transactions', async () => {
    await renderFinance(createProps());
    await selectMenu('transactions');

    expect(container.textContent).toContain('Ledger Transactions (0)');
    expect(container.querySelector('input[placeholder="Search ledger..."]')).not.toBeNull();
    expect(container.textContent).not.toContain('No transactions found');
    expect(container.textContent).not.toContain('Adjust the search or filters');
  });

  it('uses the shared header dropdown treatment for the Finance submenu', async () => {
    await renderFinance(createProps());

    const trigger = container.querySelector<HTMLButtonElement>('.header-dropdown-trigger');
    expect(trigger?.className).toContain('rounded-xl');
    expect(trigger?.className).toContain('bg-white');
    await act(async () => trigger?.click());
    expect(container.querySelector('[role="menu"][aria-label="Finance submenu options"]')).not.toBeNull();
  });

  it('permanently omits Capital & Financial Planning from Finance', async () => {
    await renderFinance(createProps());

    expect(container.textContent).not.toContain('Capital & Financial Planning');
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Finance submenu"]')?.click();
    });
    expect(container.querySelector('[data-finance-menu-id="capitalPlanning"]')).toBeNull();
  });

  it('omits the empty Loans card while keeping loan actions available in the Finance menu', async () => {
    await renderFinance(createProps());
    await selectMenu('loans');

    expect(container.querySelector('.finance-loans-empty-state')).toBeNull();
    expect(container.textContent).not.toContain('No loans or liabilities yet');
    expect(container.textContent).not.toContain('Create a loan or add an existing liability');

    await selectMenu('newLoan');
    expect(container.querySelector('.finance-unified-split')?.firstElementChild?.className).toContain('lg:col-span-12');
  });

  it('hides the entire Portfolio section when there are no investment assets', async () => {
    await renderFinance(createProps());
    await selectMenu('investments');

    expect(container.querySelector('.finance-unified-list-column')).toBeNull();
    expect(container.textContent).not.toContain('Portfolio (0)');

    await renderFinance(createProps({ investments: populatedProps.investments }));

    expect(container.textContent).toContain('Portfolio (1)');
    expect(container.querySelector('.finance-unified-list-column')).not.toBeNull();
  });

  it.each([
    ['newLoan', '.finance-unified-list-column', { loans: populatedProps.loans }],
    ['addInvestment', '.finance-unified-list-column', { investments: populatedProps.investments }],
    ['registerSavings', '.finance-unified-list-column', { savingsPlans: populatedProps.savingsPlans }],
    ['addAsset', '.finance-balance-sheet-card', { assets: populatedProps.assets }]
  ] as const)('expands the empty %s form and splits it from history after records exist', async (menu, listSelector, populatedData) => {
    await renderFinance(createProps());
    await selectMenu(menu);

    let pane = container.querySelector('.finance-unified-split')!;
    expect(pane.children[0].className).toContain('lg:col-span-12');
    expect(pane.querySelector(listSelector)).toBeNull();

    await renderFinance(createProps(populatedData));

    pane = container.querySelector('.finance-unified-split')!;
    expect(pane.children[0].className).toContain('lg:col-span-7');
    expect(pane.querySelector(listSelector)?.className).toContain('lg:col-span-5');
  });

  it('keeps scheduled cash flow at full width until schedules exist', async () => {
    await renderFinance(createProps());
    await selectMenu('scheduled');

    let panel = container.querySelector('.finance-schedule-panel > div')!;
    expect(panel.children[0].className).toContain('lg:col-span-12');
    expect(panel.children[1]).toBeUndefined();

    await renderFinance(createProps({ cashFlowSchedules: populatedProps.cashFlowSchedules }));

    panel = container.querySelector('.finance-schedule-panel > div')!;
    expect(panel.children[0].className).toContain('lg:col-span-5');
    expect(panel.children[1].className).toContain('lg:col-span-7');
  });
});


describe('Finance reserve planning', () => {
  it('shows reserve targets, liquid-account runway, and savings progress in its Finance section', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await renderFinance(createProps({
      accounts: [{ id: 'cash', name: 'Cash', type: 'cash', balance: 1000, openingBalance: 1000 }],
      transactions: [
        { id: 'deposit', type: 'savings', amount: 200, category: 'Savings', date: today, createdAt: 1 },
        { id: 'ledger-only-deposit', type: 'savings', amount: 5000, category: 'Balance correction', date: today, ledgerOnly: true, createdAt: 2 }
      ],
      mentor: { survivalReserve: 500, emergencyReserve: 300, dailyBurn: 100, savingGoalAmount: 5000 }
    }));
    await selectMenu('reserves');

    expect(container.querySelector('[aria-label="Reserve planning"]')).not.toBeNull();
    expect(container.textContent).toContain('10 days');
    expect(container.textContent).toContain('4%');
    expect(container.querySelector('input[type="number"]')).not.toBeNull();
    expect(container.textContent).toContain('Runway uses account balances only');
  });

  it('saves reserve settings into the shared app profile without overwriting other settings', async () => {
    financeStorageMock.setSingleton.mockClear();
    const onSuccess = vi.fn();
    await renderFinance(createProps({ onSuccess, mentor: { careerFund: 40 } }));
    await selectMenu('reserves');

    const saveButton = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent?.trim() === 'Save Reserve Strategy')!;
    await act(async () => saveButton.click());

    expect(financeStorageMock.setSingleton).toHaveBeenCalledWith('appSettings', expect.objectContaining({
      theme: 'dark',
      mentor: expect.objectContaining({
        careerFund: 40,
        survivalReserve: 100000,
        emergencyReserve: 50000,
        dailyBurn: 800,
        savingGoalAmount: 500000
      })
    }));
    expect(onSuccess).toHaveBeenCalledWith('Reserve strategy saved');
  });

});
