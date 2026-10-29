import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { Goal } from '../../types';
import { GoalPicker } from '../GoalPicker';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const goals: Goal[] = [
  { id: 'atomic', title: 'Atomic goal', parentId: 'nano', level: 1, progress: 0, createdAt: 0, updatedAt: 0 },
  { id: 'nano', title: 'Nano goal', parentId: 'micro', level: 1, progress: 0, createdAt: 0, updatedAt: 0 },
  { id: 'micro', title: 'Micro goal', parentId: 'sub', level: 1, progress: 0, createdAt: 0, updatedAt: 0 },
  { id: 'sub', title: 'Sub goal', parentId: 'main', level: 1, progress: 0, createdAt: 0, updatedAt: 0 },
  { id: 'main', title: 'Main goal', level: 1, progress: 0, createdAt: 0, updatedAt: 0 }
];

describe('GoalPicker', () => {
  it('filters by clickable level and keeps the remaining goals in hierarchy order', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const onChange = vi.fn();

    await act(async () => {
      root.render(<GoalPicker goals={goals} value="" onChange={onChange} />);
    });

    const atomicFilter = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('Atomic'));
    expect(atomicFilter).toBeDefined();

    await act(async () => {
      atomicFilter?.click();
    });

    const select = container.querySelector('select');
    expect([...select!.options].map(option => option.value)).toEqual(['', 'atomic']);

    await act(async () => {
      select!.value = 'atomic';
      select!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith('atomic');

    await act(async () => {
      root.unmount();
    });
  });
});
