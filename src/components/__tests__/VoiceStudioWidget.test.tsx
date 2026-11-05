import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceStudioWidget } from '../VoiceStudioWidget';

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

describe('VoiceStudioWidget', () => {
  it('exposes an accessible modal and closes it with Escape', async () => {
    const onClose = vi.fn();
    await act(async () => {
      root.render(<VoiceStudioWidget isOpen onClose={onClose} onSuccess={vi.fn()} />);
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-label')).toBe('Voice & Audio Studio');

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows a dictation tab and reports unsupported speech recognition', async () => {
    vi.stubGlobal('SpeechRecognition', undefined);
    vi.stubGlobal('webkitSpeechRecognition', undefined);
    await act(async () => {
      root.render(<VoiceStudioWidget isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('#voice-studio-tab-dictation')!.click();
    });
    expect(container.querySelector('[role="tablist"]')).not.toBeNull();
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.id)
      .toBe('voice-studio-tab-dictation');
    expect(container.querySelector('[role="tabpanel"]')?.id)
      .toBe('voice-studio-panel-dictation');
    expect(container.textContent).toContain('Dictation language');

    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>('button')]
        .find(button => button.textContent?.includes('Start Dictation'))!
        .click();
    });
    expect(container.querySelector('[role="alert"]')?.textContent)
      .toContain('Speech Recognition is not supported');
  });
});
