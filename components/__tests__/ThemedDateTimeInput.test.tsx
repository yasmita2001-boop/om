import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { ThemedDateTimeInput } from '../ThemedDateTimeInput';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe('ThemedDateTimeInput', () => {
  it('updates a date through its themed calendar', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const handleChange = vi.fn();

    await act(async () => {
      root.render(
        <ThemedDateTimeInput
          type="date"
          value="2026-10-29"
          onChange={event => handleChange(event.target.value)}
        />
      );
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Open date picker"]')?.click();
    });
    expect(container.querySelector('[aria-label="Choose a date"]')).not.toBeNull();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-date="2026-11-01"]')?.click();
    });
    expect(handleChange).toHaveBeenCalledWith('2026-11-01');

    await act(async () => root.unmount());
  });

  it('sets hours and minutes in the themed time picker', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const handleChange = vi.fn();

    await act(async () => {
      root.render(
        <ThemedDateTimeInput
          type="time"
          value="07:00"
          onChange={event => handleChange(event.target.value)}
        />
      );
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Open time picker"]')?.click();
    });
    const options = [...container.querySelectorAll<HTMLElement>('[role="option"]')];
    const hourSeven = options.find(option => option.textContent === '08');
    const minuteThirty = options.find(option => option.textContent === '30');
    expect(hourSeven).toBeDefined();
    expect(minuteThirty).toBeDefined();
    await act(async () => {
      hourSeven?.click();
      minuteThirty?.click();
    });
    expect(container.querySelector('.om-datetime-time-value')?.textContent).toBe('08:30');
    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>('button')]
        .find(button => button.textContent === 'Set time')
        ?.click();
    });
    expect(handleChange).toHaveBeenCalledWith('08:30');

    await act(async () => root.unmount());
  });
});
