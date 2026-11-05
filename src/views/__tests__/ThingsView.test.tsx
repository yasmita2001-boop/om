import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThingsView } from '../ThingsView';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const emptyProps = {
  things: [],
  documents: [],
  warranties: [],
  receipts: [],
  certificates: [],
  importantRecords: [],
  financeTransactions: [],
  onRefresh: vi.fn(),
  onSuccess: vi.fn(),
  onError: vi.fn()
};

const populatedProps = {
  ...emptyProps,
  things: [{ id: 'item', name: 'Item', category: 'Hardware', value: 1, createdAt: 1 }],
  documents: [{ id: 'document', title: 'Document', type: 'Identity', createdAt: 1 }],
  warranties: [{ id: 'warranty', title: 'Warranty', createdAt: 1 }],
  receipts: [{ id: 'receipt', title: 'Receipt', amount: 1, createdAt: 1 }],
  certificates: [{ id: 'certificate', title: 'Certificate', createdAt: 1 }],
  importantRecords: [{ id: 'record', title: 'Record', createdAt: 1 }]
};

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

describe('Vault submenu layouts', () => {
  it.each([
    ['things', 'things'],
    ['documents', 'documents'],
    ['warranties', 'warranties'],
    ['receipts', 'receipts'],
    ['certificates', 'certificates'],
    ['records', 'records']
  ])('adapts the %s form and history cards to whether records exist', async (tab, recordType) => {
    await act(async () => root.render(<ThingsView {...emptyProps} />));
    const selectTab = async () => {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-label="Vault submenu"]')!.click();
      });
      await act(async () => container.querySelector<HTMLButtonElement>(`[data-vault-tab="${tab}"]`)!.click());
    };

    await selectTab();
    let layout = container.querySelector('.vault-submenu-layout')!;
    let cards = [...layout.children] as HTMLElement[];
    expect(cards[0].className).toContain('lg:col-span-12');
    expect(cards[1].className).toContain('hidden');

    await act(async () => root.render(<ThingsView {...populatedProps} />));
    layout = container.querySelector('.vault-submenu-layout')!;
    cards = [...layout.children] as HTMLElement[];
    expect(cards[0].className).toContain('lg:col-span-5');
    expect(cards[1].className).toContain('lg:col-span-7');
    expect(cards[1].className).not.toContain('hidden');
    expect(cards[1].textContent).toContain({
      things: 'Item',
      documents: 'Document',
      warranties: 'Warranty',
      receipts: 'Receipt',
      certificates: 'Certificate',
      records: 'Record'
    }[recordType]);
  });
});
