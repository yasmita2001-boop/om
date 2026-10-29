import { describe, expect, it } from 'vitest';
import { pickOptimalVoice, splitIntoSpeechUnits } from '../nativeVoiceEngine';

describe('splitIntoSpeechUnits', () => {
  it('splits long unpunctuated text into speech-safe chunks without losing words', () => {
    const text = Array.from({ length: 120 }, (_, index) => `word${index}`).join(' ');
    const units = splitIntoSpeechUnits(text);

    expect(units.length).toBeGreaterThan(1);
    expect(units.every(unit => Array.from(unit.text).length <= 180)).toBe(true);
    expect(units.map(unit => unit.text).join(' ')).toBe(text);
  });

  describe('pickOptimalVoice', () => {
    it('uses the exact selected system voice URI regardless of provider or language', () => {
      const microsoftVoice = {
        name: 'Microsoft David',
        lang: 'en-US',
        voiceURI: 'Microsoft David Desktop'
      } as SpeechSynthesisVoice;
      const googleVoice = {
        name: 'Google हिन्दी',
        lang: 'hi-IN',
        voiceURI: 'Google हिन्दी'
      } as SpeechSynthesisVoice;

      expect(pickOptimalVoice([microsoftVoice, googleVoice], 'en-IN', 'female', googleVoice.voiceURI))
        .toBe(googleVoice);
    });
  });

  it('keeps punctuation and Hindi text when splitting long speech units', () => {
    const sentence = `${'यह पूरा वाक्य पढ़ा जाएगा '.repeat(15)}आखिर।`;
    const units = splitIntoSpeechUnits(sentence);

    expect(units.length).toBeGreaterThan(1);
    expect(units.every(unit => Array.from(unit.text).length <= 180)).toBe(true);
    expect(units.map(unit => unit.text).join(' ')).toBe(sentence);
    expect(units.at(-1)?.text.endsWith('आखिर।')).toBe(true);
  });

  it('preserves existing sentence boundaries for short text', () => {
    expect(splitIntoSpeechUnits('First sentence. Second sentence!').map(unit => unit.text))
      .toEqual(['First sentence.', 'Second sentence!']);
  });
});
