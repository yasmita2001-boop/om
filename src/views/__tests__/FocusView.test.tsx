import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FocusView } from '../FocusView';
import { alarmService, type FocusAlarm } from '../../lib/alarmService';

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
  vi.restoreAllMocks();
});

describe('Focus view navigation', () => {
  it('renders the focus timer and its shared work-area menu', async () => {
    await act(async () => {
      root.render(
        <FocusView
          sessions={[]}
          tasks={[]}
          goals={[]}
          profileId="test-profile"
          activeWorkAreaSection="focus-timer"
          onSelectWorkAreaSection={vi.fn()}
          onRefresh={vi.fn()}
          onSuccess={vi.fn()}
        />
      );
    });

    expect(container.querySelector('h1')?.textContent).toBe('Focus');
    expect(container.querySelector('[aria-label="Tasks, routines and focus submenu"]')?.textContent)
      .toContain('Deep Work Sprint');
    expect(container.querySelector('[aria-label="Tasks, routines and focus submenu"]')).not.toBeNull();
  });

  it('routes a menu selection to the ringtone studio', async () => {
    const onSelectWorkAreaSection = vi.fn();
    await act(async () => {
      root.render(
        <FocusView
          sessions={[]}
          tasks={[]}
          goals={[]}
          profileId="test-profile"
          activeWorkAreaSection="focus-timer"
          onSelectWorkAreaSection={onSelectWorkAreaSection}
          onRefresh={vi.fn()}
          onSuccess={vi.fn()}
        />
      );
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Tasks, routines and focus submenu"]')!.click();
    });
    const ringtoneOption = [...container.querySelectorAll('button')]
      .find(button => button.textContent?.trim() === 'Ringtone Studio')!;
    await act(async () => ringtoneOption.click());

    expect(onSelectWorkAreaSection).toHaveBeenCalledWith('focus-ringtones');
  });

  it('expands the alarm form before the first alarm and splits the form and list after saving', async () => {
    let savedAlarms: FocusAlarm[] = [];
    vi.spyOn(alarmService, 'getFocusAlarms').mockImplementation(() => savedAlarms);
    vi.spyOn(alarmService, 'addFocusAlarm').mockImplementation(alarm => {
      const savedAlarm: FocusAlarm = { ...alarm, id: 'alarm-1', createdAt: Date.now() };
      savedAlarms = [savedAlarm];
      return savedAlarm;
    });

    await act(async () => {
      root.render(
        <FocusView
          sessions={[]}
          tasks={[]}
          goals={[]}
          profileId="test-profile"
          activeWorkAreaSection="focus-alarms"
          onSelectWorkAreaSection={vi.fn()}
          onRefresh={vi.fn()}
          onSuccess={vi.fn()}
        />
      );
    });

    expect(container.querySelectorAll('.focus-alarm-panel')).toHaveLength(1);
    expect(container.querySelector('.focus-alarm-panel')?.className).toContain('lg:col-span-12');
    expect(container.querySelector('h2')?.textContent).toBe('New alarm');

    await act(async () => {
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    const alarmPanels = container.querySelectorAll('.focus-alarm-panel');
    expect(alarmPanels).toHaveLength(2);
    expect(alarmPanels[0].className).toContain('lg:col-span-5');
    expect(alarmPanels[1].className).toContain('lg:col-span-7');
    expect(alarmPanels[1].textContent).toContain('Scheduled Alarms');
    expect(alarmPanels[1].textContent).toContain('08:00');
  });
});