import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { RecurrenceSelector } from '../RecurrenceSelector';
import type { RecurrenceConfig } from '../../types';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe('RecurrenceSelector', () => {
  it('uses the app date picker for the recurrence end date', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const onChange = vi.fn();
    const value: RecurrenceConfig = {
      frequency: 'daily',
      interval: 1,
      endType: 'by_date',
      endByDate: '2026-11-30'
    };

    await act(async () => {
      root.render(<RecurrenceSelector value={value} onChange={onChange} startDate="2026-11-08" />);
    });

    const input = container.querySelector<HTMLInputElement>('[aria-label="Recurrence end date"]');
    expect(input?.type).toBe('text');

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Open date picker"]')?.click();
    });
    expect(container.querySelector('[aria-label="Choose a date"]')).not.toBeNull();

    await act(async () => root.unmount());
  });
});
