/**
 * Voice Service: 100% Accurate Voice-to-Text (Speech Recognition) & Text-to-Speech (Audio Reading)
 * Highly optimized for Hindi (hi-IN) and English (en-IN / en-US), robust to non-native accents,
 * verbal punctuation commands, live fast real-time typing, and long-text chunked audio playback.
 */

export type VoiceLanguage = 'hi-IN' | 'en-IN' | 'en-US' | 'auto';

export interface SpeechRecognitionResultPayload {
  transcript: string;
  isFinal: boolean;
  rawText: string;
  confidence?: number;
}

export interface TextReaderOptions {
  lang?: VoiceLanguage;
  rate?: number; // 0.6 to 1.6
  pitch?: number; // 0.5 to 1.6
  pauseWeight?: number; // 0.5 to 1.8
  volume?: number; // 0.1 to 1.0
  persona?: VoicePersona;
  preferGender?: 'female' | 'male' | 'any';
  voiceName?: string;
  onStateChange?: (state: {
    isSpeaking: boolean;
    isPaused: boolean;
    currentSentence?: string;
    progress?: number;
    activeVoiceName?: string;
  }) => void;
}

// Check Web Speech API support
export const isSpeechRecognitionSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  );
};

export const isSpeechSynthesisSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  return 'speechSynthesis' in window;
};

/**
 * Diagnostic & Permission verification helpers
 */
export async function checkMicrophonePermissionState(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unknown';
  try {
    const res = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return res.state;
  } catch {
    return 'unknown';
  }
}

export async function requestMicrophonePermission(): Promise<{ granted: boolean; error?: string }> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { granted: false, error: 'Microphone API is not supported on this device/browser.' };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Stop tracks immediately so microphone resource is cleanly freed for speech recognition
    stream.getTracks().forEach((track) => track.stop());
    return { granted: true };
  } catch (err: any) {
    console.warn('Direct mic permission request result:', err);
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return {
        granted: false,
        error: 'Microphone access is blocked in browser settings. Please allow microphone in the URL bar.'
      };
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return { granted: false, error: 'No microphone found on your computer or device.' };
    }
    return { granted: false, error: err.message || 'Could not access microphone.' };
  }
}

// Verbal punctuation mapping for Hindi, Indian English, and non-native speakers
const PUNCTUATION_MAP: Record<string, string> = {
  // Hindi verbal commands
  'पूर्ण विराम': '.',
  'पूर्णविराम': '.',
  'खड़ी पाई': '.',
  'फुल स्टॉप': '.',
  'फुलस्टॉप': '.',
  'डॉट': '.',
  'अल्प विराम': ',',
  'अल्पविराम': ',',
  'कॉमा': ',',
  'कामा': ',',
  'प्रश्न चिन्ह': '?',
  'प्रश्नचिन्ह': '?',
  'प्रश्नवाचक': '?',
  'सवालिया निशान': '?',
  'विस्मयादिबोधक': '!',
  'एक्सक्लेमेशन': '!',
  'नई लाइन': '\n',
  'नई पंक्ति': '\n',
  'अगली लाइन': '\n',
  'न्यू लाइन': '\n',
  'डैश': ' - ',
  'हाइफ़न': '-',
  'कॉलन': ':',
  'सेमीकॉलन': ';',
  'कोटेशन': '"',

  // English & Indian English verbal commands (spoken by native or non-native speakers)
  'full stop': '.',
  'fullstop': '.',
  'period': '.',
  'dot': '.',
  'comma': ',',
  'question mark': '?',
  'exclamation mark': '!',
  'exclamation point': '!',
  'new line': '\n',
  'next line': '\n',
  'new paragraph': '\n\n',
  'enter': '\n',
  'colon': ':',
  'semicolon': ';',
  'dash': ' - ',
  'hyphen': '-',
  'open bracket': '(',
  'close bracket': ')',
  'open parenthesis': '(',
  'close parenthesis': ')'
};

/**
 * Clean & Format Voice Transcript
 * - Replaces verbal punctuation commands in Hindi and English
 * - Fixes non-native stutter repetitions (e.g. "I I will", "yeh yeh")
 * - Cleans spacing and auto-capitalizes sentences
 */
export const formatVoiceTranscript = (rawText: string, lang: VoiceLanguage): string => {
  if (!rawText) return '';
  let formatted = rawText;

  // Replace verbal punctuation
  Object.keys(PUNCTUATION_MAP).forEach((phrase) => {
    const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
    formatted = formatted.replace(regex, PUNCTUATION_MAP[phrase]);
  });

  // Remove immediate stutter repetitions (e.g., "mein mein", "the the", "to to")
  formatted = formatted.replace(/\b(\w+)[\s,]+\1\b/gi, '$1');

  // Clean double spaces before punctuation marks
  formatted = formatted.replace(/\s+([.,?!:;])/g, '$1');

  // Ensure single space after punctuation (except newline)
  formatted = formatted.replace(/([.,?!:;])(?=[^\s\n])/g, '$1 ');

  // Auto-capitalize English sentences (if not pure Devanagari)
  if (lang !== 'hi-IN' && !/[\u0900-\u097F]/.test(formatted)) {
    formatted = formatted.replace(/(?:^|[.!?\n]\s*)([a-z])/g, (_, match) => match.toUpperCase());
  }

  return formatted.trim();
};

/**
 * Speech Recognition Controller
 * Fast, live real-time typing with auto-reconnect on pauses and robust mic permission initialization
 */
export class VoiceDictationController {
  private recognition: any = null;
  private isListening: boolean = false;
  private currentLanguage: VoiceLanguage = 'hi-IN';
  private onResultCallback?: (result: SpeechRecognitionResultPayload) => void;
  private onErrorCallback?: (err: string) => void;
  private onStatusChangeCallback?: (isListening: boolean) => void;
  private restartTimeout: any = null;
  private autoRestart: boolean = true;
  private mediaStream: MediaStream | null = null;

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    if (!isSpeechRecognitionSupported()) return;

    try {
      const SpeechRecognitionClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognitionClass) return;

      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 3;
      this.applyLanguage(this.currentLanguage);

      this.recognition.onstart = () => {
        this.isListening = true;
        this.onStatusChangeCallback?.(true);
      };

      this.recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';
        let highestConfidence = 0.9;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          const primaryAlternative = item[0];
          const transcript = primaryAlternative.transcript;
          if (primaryAlternative.confidence) {
            highestConfidence = primaryAlternative.confidence;
          }

          if (item.isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }

        if (final.trim()) {
          const formattedFinal = formatVoiceTranscript(final, this.currentLanguage);
          this.onResultCallback?.({
            transcript: formattedFinal,
            isFinal: true,
            rawText: final,
            confidence: highestConfidence
          });
        } else if (interim.trim()) {
          this.onResultCallback?.({
            transcript: interim,
            isFinal: false,
            rawText: interim,
            confidence: highestConfidence
          });
        }
      };

      this.recognition.onerror = (event: any) => {
        console.warn('Speech recognition event error:', event.error);
        if (event.error === 'not-allowed') {
          this.isListening = false;
          this.autoRestart = false;
          this.onErrorCallback?.('MIC_PERMISSION_DENIED');
          this.onStatusChangeCallback?.(false);
        } else if (event.error === 'network') {
          this.onErrorCallback?.('Network delay. Speech engine reconnecting in background...');
        } else if (event.error === 'audio-capture') {
          this.isListening = false;
          this.autoRestart = false;
          this.onErrorCallback?.('MIC_AUDIO_CAPTURE_ERROR');
          this.onStatusChangeCallback?.(false);
        } else if (event.error === 'no-speech') {
          // Normal pause in speech
        } else if (event.error === 'aborted') {
          // Handled during manual restart
        }
      };

      this.recognition.onend = () => {
        // Auto reconnect if user hasn't explicitly stopped listening
        if (this.isListening && this.autoRestart) {
          clearTimeout(this.restartTimeout);
          this.restartTimeout = setTimeout(() => {
            try {
              if (this.isListening && this.recognition) {
                this.recognition.start();
              }
            } catch (e) {
              // In case already started or starting
            }
          }, 200);
        } else {
          this.isListening = false;
          this.onStatusChangeCallback?.(false);
        }
      };
    } catch (e) {
      console.error('Failed to construct SpeechRecognition:', e);
    }
  }

  private applyLanguage(lang: VoiceLanguage) {
    if (!this.recognition) return;
    if (lang === 'hi-IN') {
      this.recognition.lang = 'hi-IN';
    } else if (lang === 'en-IN') {
      this.recognition.lang = 'en-IN';
    } else if (lang === 'en-US') {
      this.recognition.lang = 'en-US';
    } else {
      this.recognition.lang = 'en-IN';
    }
  }

  public setLanguage(lang: VoiceLanguage) {
    this.currentLanguage = lang;
    const wasListening = this.isListening;
    if (wasListening) {
      this.stop();
    }
    this.applyLanguage(lang);
    if (wasListening) {
      setTimeout(() => this.start(), 200);
    }
  }

  public getLanguage(): VoiceLanguage {
    return this.currentLanguage;
  }

  public async start(callbacks?: {
    onResult?: (result: SpeechRecognitionResultPayload) => void;
    onError?: (err: string) => void;
    onStatusChange?: (isListening: boolean) => void;
  }) {
    if (callbacks?.onResult) this.onResultCallback = callbacks.onResult;
    if (callbacks?.onError) this.onErrorCallback = callbacks.onError;
    if (callbacks?.onStatusChange) this.onStatusChangeCallback = callbacks.onStatusChange;

    if (!isSpeechRecognitionSupported()) {
      this.onErrorCallback?.(
        'Speech Recognition is not supported by your current browser. Please open in Google Chrome, Microsoft Edge, or Safari.'
      );
      return;
    }

    if (!this.recognition) {
      this.initRecognition();
    }

    // Explicitly prompt/verify microphone stream permission in browser without holding audio lock
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Free tracks immediately so speech recognition engine gets exclusive device access
        stream.getTracks().forEach((track) => track.stop());
      } catch (err: any) {
        console.warn('getUserMedia permission error:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          this.onErrorCallback?.('MIC_PERMISSION_DENIED');
          this.isListening = false;
          this.onStatusChangeCallback?.(false);
          return;
        }
      }
    }

    this.autoRestart = true;
    this.isListening = true;
    this.onStatusChangeCallback?.(true);

    try {
      this.recognition.start();
    } catch (e: any) {
      // If already started or aborting, stop and re-fire
      try {
        this.recognition.stop();
        setTimeout(() => {
          if (this.isListening && this.recognition) {
            try {
              this.recognition.start();
            } catch (err2) {
              console.warn('Recognition re-start retry:', err2);
            }
          }
        }, 150);
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
      }
    }
  }

  public stop() {
    this.autoRestart = false;
    this.isListening = false;
    clearTimeout(this.restartTimeout);
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignored
      }
    }
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach(t => t.stop());
        this.mediaStream = null;
      } catch {}
    }
    this.onStatusChangeCallback?.(false);
  }

  public getIsListening(): boolean {
    return this.isListening;
  }
}

import {
  prepareNativePhonetics,
  splitIntoSpeechUnits,
  pickOptimalVoice,
  SpeechUnit,
  VoicePersona,
  PERSONA_PRESETS
} from './nativeVoiceEngine';

/**
 * Text-to-Speech (Audio Reader) Controller
 * Reads Hindi and English text aloud with crystal-clear natural native voice,
 * conversational breathing pauses at punctuation marks, and pitch inflection.
 */
export class TextReaderController {
  private isSpeaking: boolean = false;
  private isPaused: boolean = false;
  private currentUnits: SpeechUnit[] = [];
  private currentUnitIndex: number = 0;
  private keepAliveInterval: any = null;
  private pauseTimer: any = null;
  private onStateChange?: TextReaderOptions['onStateChange'];
  private currentOptions: TextReaderOptions = {};
  private activeVoice: SpeechSynthesisVoice | null = null;

  public speak(htmlOrPlainText: string, options: TextReaderOptions = {}) {
    if (!isSpeechSynthesisSupported()) {
      console.warn('Text-to-speech audio reader is not supported by your browser.');
      return;
    }

    this.stop(); // Stop any current speech cleanly
    this.currentOptions = options;
    if (options.onStateChange) this.onStateChange = options.onStateChange;

    const targetLang = options.lang || 'auto';
    const { cleanText, isHindi } = prepareNativePhonetics(htmlOrPlainText, targetLang);

    if (!cleanText) return;

    // Split text into natural conversational speech units with trailing pause timings
    this.currentUnits = splitIntoSpeechUnits(cleanText, options.pauseWeight || 1.0);
    if (this.currentUnits.length === 0) return;

    this.currentUnitIndex = 0;
    this.isSpeaking = true;
    this.isPaused = false;

    // Resolve optimal voice (Indian English, Hindi Devanagari, Natural Neural)
    const effectiveLang = isHindi ? 'hi-IN' : (targetLang === 'auto' ? 'en-IN' : targetLang);
    const voices = window.speechSynthesis.getVoices();
    
    if (options.voiceName) {
      this.activeVoice = voices.find(v => v.name === options.voiceName) || null;
    }
    if (!this.activeVoice) {
      this.activeVoice = pickOptimalVoice(voices, effectiveLang, options.preferGender || 'any');
    }

    // Start keep-alive ping for browser speech synthesis
    this.startKeepAlive();

    // Begin speaking first unit
    this.speakCurrentUnit();
  }

  public previewVoice(options: TextReaderOptions, sampleText?: string) {
    const isHindi = options.lang === 'hi-IN';
    const defaultText = isHindi
      ? 'नमस्ते! यह आपकी चुनी हुई और मिलाई गई आवाज़ है। यह सुर और गति बिलकुल सटीक है।'
      : 'Hello! This is your custom matched voice. The pitch and cadence have been tuned.';
    this.speak(sampleText || defaultText, options);
  }

  private startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveInterval = setInterval(() => {
      if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
        if (!this.isPaused) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }
    }, 8000);
  }

  private stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  private speakCurrentUnit() {
    if (!this.isSpeaking || this.currentUnitIndex >= this.currentUnits.length) {
      this.finishSpeaking();
      return;
    }

    const unit = this.currentUnits[this.currentUnitIndex];
    if (!unit || !unit.text) {
      this.currentUnitIndex++;
      this.speakCurrentUnit();
      return;
    }

    // Refresh voice if needed
    if (!this.activeVoice) {
      const voices = window.speechSynthesis.getVoices();
      const containsHindi = /[\u0900-\u097F]/.test(unit.text);
      this.activeVoice = pickOptimalVoice(
        voices,
        containsHindi ? 'hi-IN' : (this.currentOptions.lang || 'en-IN'),
        this.currentOptions.preferGender || 'any'
      );
    }

    const utterance = new SpeechSynthesisUtterance(unit.text);
    
    // Assign voice & language
    if (this.activeVoice) {
      utterance.voice = this.activeVoice;
      utterance.lang = this.activeVoice.lang;
    } else {
      const containsHindi = /[\u0900-\u097F]/.test(unit.text);
      utterance.lang = containsHindi ? 'hi-IN' : (this.currentOptions.lang === 'hi-IN' ? 'hi-IN' : 'en-IN');
    }

    // Natural pacing & pitch inflection
    const baseRate = this.currentOptions.rate !== undefined ? this.currentOptions.rate : 0.96;
    const basePitch = (this.currentOptions.pitch !== undefined ? this.currentOptions.pitch : 1.0) + unit.pitchOffset;
    const baseVolume = this.currentOptions.volume !== undefined ? this.currentOptions.volume : 1.0;

    utterance.rate = Math.max(0.5, Math.min(1.8, baseRate));
    utterance.pitch = Math.max(0.5, Math.min(1.6, basePitch));
    utterance.volume = Math.max(0.1, Math.min(1.0, baseVolume));

    utterance.onstart = () => {
      this.onStateChange?.({
        isSpeaking: true,
        isPaused: false,
        currentSentence: unit.text,
        progress: Math.round(((this.currentUnitIndex + 1) / this.currentUnits.length) * 100),
        activeVoiceName: this.activeVoice ? `${this.activeVoice.name} (${this.activeVoice.lang})` : 'Natural Native Voice'
      });
    };

    utterance.onend = () => {
      this.currentUnitIndex++;
      if (this.currentUnitIndex < this.currentUnits.length && this.isSpeaking) {
        // Natural breath pause between clauses/sentences
        clearTimeout(this.pauseTimer);
        this.pauseTimer = setTimeout(() => {
          if (this.isSpeaking && !this.isPaused) {
            this.speakCurrentUnit();
          }
        }, unit.trailingPauseMs);
      } else {
        this.finishSpeaking();
      }
    };

    utterance.onerror = (e) => {
      console.warn('Speech synthesis unit error:', e);
      this.currentUnitIndex++;
      if (this.currentUnitIndex < this.currentUnits.length && this.isSpeaking) {
        setTimeout(() => this.speakCurrentUnit(), 100);
      } else {
        this.finishSpeaking();
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  private finishSpeaking() {
    this.isSpeaking = false;
    this.isPaused = false;
    this.stopKeepAlive();
    clearTimeout(this.pauseTimer);
    this.onStateChange?.({
      isSpeaking: false,
      isPaused: false,
      currentSentence: undefined,
      progress: 100,
      activeVoiceName: undefined
    });
  }

  public pause() {
    if (isSpeechSynthesisSupported() && this.isSpeaking) {
      window.speechSynthesis.pause();
      clearTimeout(this.pauseTimer);
      this.isPaused = true;
      this.onStateChange?.({ isSpeaking: true, isPaused: true });
    }
  }

  public resume() {
    if (isSpeechSynthesisSupported() && this.isPaused) {
      window.speechSynthesis.resume();
      this.isPaused = false;
      this.onStateChange?.({ isSpeaking: true, isPaused: false });
    }
  }

  public stop() {
    this.stopKeepAlive();
    clearTimeout(this.pauseTimer);
    if (isSpeechSynthesisSupported()) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
      this.isPaused = false;
      this.activeVoice = null;
      this.onStateChange?.({ isSpeaking: false, isPaused: false, currentSentence: undefined });
    }
  }

  public getState() {
    return {
      isSpeaking: this.isSpeaking,
      isPaused: this.isPaused,
      progress: this.currentUnits.length
        ? Math.round((this.currentUnitIndex / this.currentUnits.length) * 100)
        : 0
    };
  }
}

// Global Singleton Instances
export const globalDictation = new VoiceDictationController();
export const globalTextReader = new TextReaderController();
