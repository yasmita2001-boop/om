import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceView } from '../FinanceView';

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
