import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextReaderController } from '../voiceService';

class MockUtterance {
  text: string;
  lang = '';
  voice: SpeechSynthesisVoice | null = null;
  rate = 1;
  pitch = 1;
  volume = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

describe('TextReaderController', () => {
  let controller: TextReaderController;
  let utterances: MockUtterance[];
  let speechSynthesis: {
    speaking: boolean;
    paused: boolean;
    getVoices: () => SpeechSynthesisVoice[];
    speak: (utterance: MockUtterance) => void;
    pause: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
  };
  let originalSpeechSynthesis: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    utterances = [];
    speechSynthesis = {
      speaking: false,
      paused: false,
      getVoices: () => [],
      speak: vi.fn((utterance: MockUtterance) => {
        utterances.push(utterance);
        speechSynthesis.speaking = true;
      }),
      pause: vi.fn(() => {
        speechSynthesis.paused = true;
      }),
      resume: vi.fn(() => {
        speechSynthesis.paused = false;
      }),
      cancel: vi.fn(() => {
        speechSynthesis.speaking = false;
        speechSynthesis.paused = false;
      })
    };
    originalSpeechSynthesis = Object.getOwnPropertyDescriptor(window, 'speechSynthesis');
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: speechSynthesis });
    vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance);
    controller = new TextReaderController();
  });

  afterEach(() => {
    controller.stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    if (originalSpeechSynthesis) {
      Object.defineProperty(window, 'speechSynthesis', originalSpeechSynthesis);
    } else {
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined });
    }
  });

  it('does not pause active speech for its keep-alive check', () => {
    controller.speak('First sentence. Second sentence.');

    vi.advanceTimersByTime(8000);

    expect(speechSynthesis.pause).not.toHaveBeenCalled();
    expect(speechSynthesis.resume).not.toHaveBeenCalled();

    speechSynthesis.paused = true;
    vi.advanceTimersByTime(8000);

    expect(speechSynthesis.resume).toHaveBeenCalledOnce();
  });

  it('continues with the next sentence when resumed during a sentence pause', () => {
    controller.speak('First sentence. Second sentence.');
    utterances[0].onend?.();

    controller.pause();
    vi.advanceTimersByTime(500);
    expect(utterances).toHaveLength(1);

    controller.resume();
    vi.advanceTimersByTime(0);

    expect(utterances).toHaveLength(2);
    expect(utterances[1].text).toBe('Second sentence.');
  });
});
