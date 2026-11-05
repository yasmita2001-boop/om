import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeaderDropdown } from '../HeaderDropdown';

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

const renderDropdown = async (onSelect = vi.fn()) => {
  await act(async () => {
    root.render(
      <HeaderDropdown label="Om-LifeOS" menuLabel="Main navigation" icon={<span aria-hidden="true">Om</span>}>
        {closeMenu => (
          <button role="menuitem" type="button" onClick={() => { onSelect(); closeMenu(); }}>
            Dashboard
          </button>
        )}
      </HeaderDropdown>
    );
  });
  return onSelect;
};

describe('HeaderDropdown', () => {
  it('opens the menu and closes after an item is selected', async () => {
    const onSelect = await renderDropdown();
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Main navigation"]')!;

    await act(async () => trigger.click());
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('[role="menuitem"]')?.textContent).toBe('Dashboard');

    await act(async () => container.querySelector<HTMLButtonElement>('[role="menuitem"]')!.click());
    expect(onSelect).toHaveBeenCalledOnce();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes on Escape and outside pointer interaction', async () => {
    await renderDropdown();
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Main navigation"]')!;

    await act(async () => trigger.click());
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    await act(async () => trigger.click());
    await act(async () => document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});
