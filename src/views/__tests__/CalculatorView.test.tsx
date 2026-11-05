import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalculatorView } from '../CalculatorView';
import { CALCULATOR_CATALOG } from '../../lib/calculatorEngine';

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

describe('Calculator dropdown navigation', () => {
  it('lists every calculator category and tool in dropdowns', async () => {
    await act(async () => {
      root.render(
        <CalculatorView
          history={[]}
          favorites={[]}
          noteCount={0}
          journalCount={0}
          onSelectNotesJournalAction={vi.fn()}
          onRefresh={vi.fn()}
          onSuccess={vi.fn()}
        />
      );
    });

    const categoryMenu = container.querySelector<HTMLSelectElement>('[aria-label="Calculator category"]')!;
    const toolMenu = container.querySelector<HTMLSelectElement>('[aria-label="Calculator tool"]')!;
    expect([...categoryMenu.options].map(option => option.value)).toEqual(Object.keys(CALCULATOR_CATALOG));
    expect([...toolMenu.options].map(option => option.value)).toEqual(CALCULATOR_CATALOG.quick);
    expect(toolMenu.value).toBe('Basic');
  });

  it('selects the first tool in a category and can switch calculator tools', async () => {
    await act(async () => {
      root.render(
        <CalculatorView
          history={[]}
          favorites={[]}
          noteCount={0}
          journalCount={0}
          onSelectNotesJournalAction={vi.fn()}
          onRefresh={vi.fn()}
          onSuccess={vi.fn()}
        />
      );
    });

    const categoryMenu = container.querySelector<HTMLSelectElement>('[aria-label="Calculator category"]')!;
    const toolMenu = container.querySelector<HTMLSelectElement>('[aria-label="Calculator tool"]')!;
    await act(async () => {
      categoryMenu.value = 'money';
      categoryMenu.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(toolMenu.value).toBe('EMI / Loan');
    expect(toolMenu.value).toBe('EMI / Loan');

    await act(async () => {
      categoryMenu.value = 'quick';
      categoryMenu.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      toolMenu.value = 'Scientific';
      toolMenu.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(toolMenu.value).toBe('Scientific');
    expect([...toolMenu.options].map(option => option.value)).toEqual(CALCULATOR_CATALOG.quick);
    expect([...container.querySelectorAll('button')].some(button => button.textContent?.includes('Form Fields Mode'))).toBe(true);
  });
});
