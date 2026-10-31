import React, { useState, useEffect, useCallback } from 'react';
import {
  Volume2, Play, Pause, Square,
  X, Sliders, Zap, RotateCcw,
  Waves, ArrowRight, ClipboardPaste
} from 'lucide-react';
import { globalTextReader, VoiceLanguage } from '../lib/voiceService';
import {
  VoicePersona, PERSONA_PRESETS, VOICE_MATCH_PRESETS,
  VoiceMatchPreset, estimatePitchFromAudioData, mapFrequencyToVoiceMatch
} from '../lib/nativeVoiceEngine';
import { ThemeIcon, type ThemeIconName } from './ThemeIcon';

const personaIcons: Record<VoicePersona, ThemeIconName> = {
  female_calm: 'calm',
  female_warm: 'celebrate',
  male_clear: 'mic',
  male_casual: 'zap',
  storyteller: 'book',
  whisper_relax: 'prayer',
  corporate_exec: 'portfolio',
  academic_teacher: 'journal',
  radio_rj: 'music',
  auto_best: 'star'
};

const voiceMatchIcons: Record<VoiceMatchPreset['id'], ThemeIconName> = {
  deep_baritone: 'mic',
  sweet_melody: 'music',
  natural_human: 'calm',
  fast_energetic: 'zap',
  radio_broadcaster: 'music',
  zen_meditation: 'prayer'
};

interface VoiceStudioWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onRefreshNotes?: () => void;
  onRefreshJournal?: () => void;
  onRefreshTasks?: () => void;
}

export const VoiceStudioWidget: React.FC<VoiceStudioWidgetProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'reader' | 'matcher'>('reader');


  // =========================================================================
  // TEXT READER & VOICE PERSONAS STATE
  // =========================================================================
  const [readerText, setReaderText] = useState('');
  const [readerLang, setReaderLang] = useState<VoiceLanguage>('auto');
  const [selectedPersona, setSelectedPersona] = useState<VoicePersona>('female_calm');
  const [personaGenderFilter, setPersonaGenderFilter] = useState<'all' | 'female' | 'male'>('all');

  // =========================================================================
  // VOICE MATCHING & TUNING STATE
  // =========================================================================
  const [matchedPitch, setMatchedPitch] = useState<number>(1.06);
  const [matchedRate, setMatchedRate] = useState<number>(0.95);
  const [matchedPauseWeight, setMatchedPauseWeight] = useState<number>(1.0);
  const [matchedVolume, setMatchedVolume] = useState<number>(1.0);
  const [activeMatchPreset, setActiveMatchPreset] = useState<string>('');
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Mic Pitch Analyzer
  const [isAnalyzingPitch, setIsAnalyzingPitch] = useState(false);
  const [analyzedPitchResult, setAnalyzedPitchResult] = useState<string | null>(null);

  // Playback execution state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSentence, setCurrentSentence] = useState<string | undefined>(undefined);
  const [currentVoiceLabel, setCurrentVoiceLabel] = useState<string | undefined>(undefined);
  const [readingProgress, setReadingProgress] = useState(0);
  const [readerError, setReaderError] = useState<string | null>(null);


  // Load available system voices
  useEffect(() => {
    const updateVoices = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const v = window.speechSynthesis.getVoices();
        setAvailableVoices(v);
      }
    };
    updateVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
      return () => window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
    }
  }, []);

  // Set initial tuning from default persona
  const applyPersonaPreset = useCallback((pKey: VoicePersona) => {
    setSelectedPersona(pKey);
    const p = PERSONA_PRESETS[pKey];
    if (p) {
      setMatchedPitch(p.tuning.pitch);
      setMatchedRate(p.tuning.rate);
      setMatchedPauseWeight(p.tuning.pauseWeight);
      if (p.tuning.volume !== undefined) setMatchedVolume(p.tuning.volume);
      setActiveMatchPreset('');
    }
  }, []);

  // Apply custom voice match preset
  const applyVoiceMatchPreset = (preset: VoiceMatchPreset) => {
    setActiveMatchPreset(preset.id);
    setMatchedPitch(preset.pitch);
    setMatchedRate(preset.rate);
    setMatchedPauseWeight(preset.pauseWeight);
    onSuccess(`✓ Voice matched: ${preset.name} (${preset.nameHi})`);
  };

  // "अपनी आवाज़ से सुर मिलाएँ" (Mic Pitch Analyzer)
  const handleAnalyzeUserVoice = async () => {
    if (isAnalyzingPitch) return;
    setIsAnalyzingPitch(true);
    setAnalyzedPitchResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const buffer = new Float32Array(analyser.fftSize);
      const detectedFrequencies: number[] = [];
      const startTime = Date.now();

      const sampleInterval = setInterval(() => {
        analyser.getFloatTimeDomainData(buffer);
        const pitch = estimatePitchFromAudioData(buffer, ctx.sampleRate);
        if (pitch > 70 && pitch < 450) {
          detectedFrequencies.push(pitch);
        }

        if (Date.now() - startTime >= 3000) {
          clearInterval(sampleInterval);
          stream.getTracks().forEach((t) => t.stop());
          ctx.close().catch(() => {});

          let avgFreq = 160;
          if (detectedFrequencies.length > 0) {
            avgFreq = Math.round(
              detectedFrequencies.reduce((a, b) => a + b, 0) / detectedFrequencies.length
            );
          }

          const match = mapFrequencyToVoiceMatch(avgFreq);
          setMatchedPitch(match.pitch);
          setMatchedRate(match.rate);
          setMatchedPauseWeight(match.pauseWeight);
          setSelectedPersona(match.recommendedPersona);
          setAnalyzedPitchResult(match.detectedToneName);
          setIsAnalyzingPitch(false);
          onSuccess(`✓ Voice Matched: ${match.detectedToneName}`);
        }
      }, 100);
    } catch {
      setIsAnalyzingPitch(false);
      onSuccess('Microphone unavailable for pitch sampling. You can tune sliders directly.');
    }
  };

  // Audio Reading Handlers
  const handleStartReading = () => {
    if (!readerText.trim()) return;
    setReaderError(null);
    const persona = PERSONA_PRESETS[selectedPersona];

    globalTextReader.speak(readerText, {
      lang: readerLang,
      rate: matchedRate,
      pitch: matchedPitch,
      pauseWeight: matchedPauseWeight,
      volume: matchedVolume,
      persona: selectedPersona,
      preferGender: persona?.gender || 'any',
      voiceName: selectedVoiceName || undefined,
      onError: setReaderError,
      onStateChange: (state) => {
        setIsSpeaking(state.isSpeaking);
        setIsPaused(state.isPaused);
        setCurrentSentence(state.currentSentence);
        if (state.activeVoiceName) setCurrentVoiceLabel(state.activeVoiceName);
        if (state.progress !== undefined) setReadingProgress(state.progress);
      }
    });
  };

  // Instant Voice Match Preview
  const handlePreviewMatchedVoice = () => {
    setReaderError(null);
    const isHindi = readerLang === 'hi-IN';
    const sample = isHindi
      ? 'नमस्ते! यह आपकी चुनी हुई और मिलाई गई आवाज़ है। यह सुर और गति बिलकुल सटीक है।'
      : 'Hello! This is your custom tuned voice. The pitch, tone, and pacing are ready.';

    const persona = PERSONA_PRESETS[selectedPersona];
    globalTextReader.speak(sample, {
      lang: readerLang,
      rate: matchedRate,
      pitch: matchedPitch,
      pauseWeight: matchedPauseWeight,
      volume: matchedVolume,
      persona: selectedPersona,
      preferGender: persona?.gender || 'any',
      voiceName: selectedVoiceName || undefined,
      onError: setReaderError,
      onStateChange: (state) => {
        setIsSpeaking(state.isSpeaking);
        setIsPaused(state.isPaused);
        setCurrentSentence(state.currentSentence);
        if (state.activeVoiceName) setCurrentVoiceLabel(state.activeVoiceName);
        if (state.progress !== undefined) setReadingProgress(state.progress);
      }
    });
  };

  const handlePauseReading = () => {
    if (isPaused) {
      globalTextReader.resume();
    } else {
      globalTextReader.pause();
    }
  };

  const handleStopReading = () => {
    globalTextReader.stop();
    setReaderError(null);
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentSentence(undefined);
    setCurrentVoiceLabel(undefined);
    setReadingProgress(0);
  };

  // Filter personas by gender
  const filteredPersonas = Object.entries(PERSONA_PRESETS).filter(([_, p]) => {
    if (personaGenderFilter === 'all') return true;
    if (personaGenderFilter === 'female') return p.gender === 'female' || p.gender === 'any';
    if (personaGenderFilter === 'male') return p.gender === 'male' || p.gender === 'any';
    return true;
  });

  const getPitchToneLabel = (p: number) => {
    if (p < 0.88) return 'Deep Baritone (भारी सुर)';
    if (p >= 0.88 && p <= 1.10) return 'Natural (स्वाभाविक सुर)';
    return 'Sweet / Treble (मधुर सुर)';
  };

  return (
    <>
      {/* Responsive Voice & Audio Studio Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[92vh] sm:max-h-[88vh] rounded-t-3xl sm:rounded-3xl border border-line bg-card shadow-2xl overflow-hidden flex flex-col transition-all">
            
            {/* Header: Strict Clean Top Bar Contract */}
            <div className="flex items-center justify-between border-b border-line px-5 sm:px-6 py-4 bg-card-soft shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-on-accent shadow-xs shrink-0">
                  <Zap className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-ink leading-tight">
                    Voice & Audio Studio
                  </h3>
                  <div className="flex items-center gap-1.5 text-[11px] text-ink-muted mt-0.5">
                    <span>Text to Speech</span>
                    <span aria-hidden="true">·</span>
                    <span>Tuning (सुर मिलाना)</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-ink-muted hover:bg-card hover:text-ink transition-colors cursor-pointer"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Segmented Tab Switcher */}
            <div className="p-3 sm:px-6 border-b border-line bg-card shrink-0">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('reader')}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 px-2 text-xs font-medium transition-colors cursor-pointer truncate ${
                    activeTab === 'reader'
                      ? 'border-indigo-200 bg-indigo-50/70 text-indigo-800 font-semibold dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200'
                      : 'border-transparent text-ink-soft hover:border-line hover:bg-card-soft hover:text-ink'
                  }`}
                >
                  <Volume2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Text Reader</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('matcher')}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 px-2 text-xs font-medium transition-colors cursor-pointer truncate ${
                    activeTab === 'matcher'
                      ? 'border-indigo-200 bg-indigo-50/70 text-indigo-800 font-semibold dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200'
                      : 'border-transparent text-ink-soft hover:border-line hover:bg-card-soft hover:text-ink'
                  }`}
                >
                  <Sliders className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Voice Tuning</span>
                </button>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* TAB 1: VOICE TO TEXT (CLEAN, SPACIOUS, MODERN CANVAS)                     */}
            {/* ========================================================================= */}
            {activeTab === 'reader' && (
              <div className="flex-1 overflow-y-auto bg-card-soft/60 p-4 sm:p-6 space-y-4">
                
                {/* Input text box with paste trigger */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-ink-soft">
                      Text to Read Aloud:
                    </label>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const clipboardText = await navigator.clipboard.readText();
                          if (clipboardText) setReaderText(clipboardText);
                        } catch {
                          // Ignored
                        }
                      }}
                      className="text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-100 flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <ClipboardPaste className="h-3.5 w-3.5" />
                      <span>Paste</span>
                    </button>
                  </div>

                  <textarea
                    rows={3}
                    value={readerText}
                    onChange={(e) => setReaderText(e.target.value)}
                    placeholder="Enter or paste text in Hindi, Hinglish, or English to read aloud with natural human cadence..."
                    className="w-full rounded-2xl border border-line bg-card p-3.5 text-xs sm:text-sm text-ink leading-relaxed placeholder:text-ink-muted focus:border-indigo-500 focus:outline-none transition-colors"
                  />
                </div>

                {/* Active reading status card */}
                {isSpeaking && (
                  <div className="p-3.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/80 space-y-1.5 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs font-semibold text-indigo-800 dark:text-indigo-200">
                      <span className="flex items-center gap-2">
                        <Volume2 className="h-4 w-4 animate-bounce" />
                        <span>Reading Aloud ({readingProgress}%)</span>
                      </span>
                      {currentVoiceLabel && (
                        <span className="text-[11px] font-normal text-ink-muted truncate max-w-[220px]">
                          {currentVoiceLabel}
                        </span>
                      )}
                    </div>
                    {currentSentence && (
                      <p className="text-xs text-ink-soft italic line-clamp-2">
                        "{currentSentence}"
                      </p>
                    )}
                  </div>
                )}
                {readerError && (
                  <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    {readerError}
                  </p>
                )}

                {/* Filter & Language Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-ink-soft">Language:</span>
                    <select
                      value={readerLang}
                      onChange={(e) => setReaderLang(e.target.value as VoiceLanguage)}
                      className="h-8 rounded-xl border border-line bg-card px-2.5 text-xs font-medium text-ink-soft focus:border-indigo-400 focus:outline-none cursor-pointer"
                    >
                      <option value="auto">Auto Detect (Hindi / English)</option>
                      <option value="hi-IN">हिन्दी Voice (Native Hindi)</option>
                      <option value="en-IN">Indian English (Hinglish)</option>
                      <option value="en-US">Global English</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setPersonaGenderFilter('all')}
                      className={`border-b-0 border-transparent px-2 py-1 font-medium transition-colors cursor-pointer ${
                        personaGenderFilter === 'all'
                          ? 'rounded-lg bg-indigo-50/70 text-indigo-800 font-semibold dark:bg-indigo-950/40 dark:text-indigo-200'
                          : 'rounded-lg text-ink-soft hover:bg-card hover:text-ink'
                      }`}
                    >
                      All (10)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPersonaGenderFilter('female')}
                      className={`border-b-0 border-transparent px-2 py-1 font-medium transition-colors cursor-pointer ${
                        personaGenderFilter === 'female'
                          ? 'rounded-lg bg-indigo-50/70 text-indigo-800 font-semibold dark:bg-indigo-950/40 dark:text-indigo-200'
                          : 'rounded-lg text-ink-soft hover:bg-card hover:text-ink'
                      }`}
                    >
                      Female
                    </button>
                    <button
                      type="button"
                      onClick={() => setPersonaGenderFilter('male')}
                      className={`border-b-0 border-transparent px-2 py-1 font-medium transition-colors cursor-pointer ${
                        personaGenderFilter === 'male'
                          ? 'rounded-lg bg-indigo-50/70 text-indigo-800 font-semibold dark:bg-indigo-950/40 dark:text-indigo-200'
                          : 'rounded-lg text-ink-soft hover:bg-card hover:text-ink'
                      }`}
                    >
                      Male
                    </button>
                  </div>
                </div>

                {/* 10 Voice Personas in Responsive Grid */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-ink-soft">
                      Voice Persona:
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('matcher')}
                      className="text-indigo-700 dark:text-indigo-300 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <span>Custom Tuning</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-2 max-h-[240px] overflow-y-auto p-0.5">
                    {filteredPersonas.map(([key, p]) => {
                      const isSelected = selectedPersona === key;
                      return (
                        <div
                          key={key}
                          onClick={() => applyPersonaPreset(key as VoicePersona)}
                          className={`flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer text-left ${
                            isSelected
                              ? 'border-indigo-400 bg-indigo-50/70 dark:border-indigo-500 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                              : 'border-line bg-card hover:border-indigo-300 dark:hover:border-indigo-700'
                          }`}
                        >
                          <span className="shrink-0 p-1.5 rounded-xl bg-card-soft">
                            <ThemeIcon name={personaIcons[key as VoicePersona]} className="h-5 w-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-ink truncate">
                                {p.label}
                              </span>
                              {isSelected && (
                                <span className="h-2 w-2 rounded-full bg-indigo-600 shrink-0 ml-1.5" />
                              )}
                            </div>
                            <p className={`text-[11px] font-medium ${isSelected ? 'text-indigo-800 dark:text-indigo-200' : 'text-ink-muted'}`}>
                              {p.labelHi}
                            </p>
                            <p className="text-[11px] text-ink-muted line-clamp-1 mt-0.5">
                              {p.desc}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Action Bar */}
                <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-card-soft/95 pt-3 pb-1 backdrop-blur">
                  <button
                    type="button"
                    onClick={handlePreviewMatchedVoice}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-line bg-card text-xs font-medium text-ink-soft hover:bg-card-soft cursor-pointer shadow-2xs"
                  >
                    <Play className="h-3.5 w-3.5 fill-current text-indigo-700" />
                    <span>Sample Voice</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {!isSpeaking ? (
                      <button
                        type="button"
                        disabled={!readerText.trim()}
                        onClick={handleStartReading}
                        className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-on-accent shadow-sm hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                      >
                        <Play className="h-4 w-4 fill-current" />
                        <span>Read Aloud</span>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handlePauseReading}
                          className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-4 py-2 text-xs font-semibold text-ink-soft hover:bg-card-soft cursor-pointer"
                        >
                          {isPaused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4" />}
                          <span>{isPaused ? 'Resume' : 'Pause'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleStopReading}
                          className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-500 cursor-pointer"
                        >
                          <Square className="h-4 w-4 fill-current" />
                          <span>Stop</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: VOICE MATCHING & TUNING (सुर मिलाना)                                */}
            {/* ========================================================================= */}
            {activeTab === 'matcher' && (
              <div className="flex-1 overflow-y-auto bg-card-soft/60 p-4 sm:p-6 space-y-4">
                
                {/* 1-Click Harmonization Presets */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-ink-soft">
                      Voice Match Presets (बने-बनाए सुर मिलान):
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        applyPersonaPreset('female_calm');
                        onSuccess('Reset to default voice settings');
                      }}
                      className="text-ink-muted hover:text-ink flex items-center gap-1 cursor-pointer text-[11px]"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Reset</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {VOICE_MATCH_PRESETS.map((preset) => {
                      const isSelected = activeMatchPreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyVoiceMatchPreset(preset)}
                          className={`flex items-start gap-2.5 p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'border-indigo-400 bg-indigo-50/70 dark:border-indigo-500 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                              : 'border-line bg-card hover:border-indigo-300 dark:hover:border-indigo-700'
                          }`}
                        >
                          <ThemeIcon name={voiceMatchIcons[preset.id]} className="h-5 w-5 shrink-0" />
                          <div className="min-w-0">
                            <span className="block text-xs font-semibold text-ink truncate">
                              {preset.name}
                            </span>
                            <span className="block text-[11px] text-ink-muted truncate">
                              {preset.nameHi}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Auto Pitch Match with User's Voice */}
                <div className="p-3.5 rounded-2xl border border-line bg-card-soft flex flex-wrap items-center justify-between gap-2.5">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-ink block">
                      अपनी आवाज़ से सुर मिलाएँ (AI Voice Pitch Matcher)
                    </span>
                    <p className="text-[11px] text-ink-muted">
                      {analyzedPitchResult || '3 सेकंड बोलें और AI आपकी आवाज़ की फ्रीक्वेंसी से पिच और गति सेट कर देगा।'}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isAnalyzingPitch}
                    onClick={handleAnalyzeUserVoice}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-on-accent text-xs font-semibold hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                  >
                    <Waves className={`h-3.5 w-3.5 ${isAnalyzingPitch ? 'animate-spin' : ''}`} />
                    <span>{isAnalyzingPitch ? 'Listening 3s...' : 'Match My Voice'}</span>
                  </button>
                </div>

                {/* Fine-Tuning Sliders in Clean Surface */}
                <div className="p-4 sm:p-5 rounded-2xl border border-line bg-card space-y-4">
                  
                  {/* Pitch Slider */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink-soft">
                        Pitch / सुर (आवाज़ पतली / भारी):
                      </span>
                      <span className="text-xs font-mono font-medium text-indigo-700 dark:text-indigo-300">
                        {matchedPitch.toFixed(2)}x · {getPitchToneLabel(matchedPitch)}
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0.6"
                      max="1.5"
                      step="0.02"
                      value={matchedPitch}
                      onChange={(e) => {
                        setMatchedPitch(parseFloat(e.target.value));
                        setActiveMatchPreset('');
                      }}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />

                    <div className="flex justify-between text-[10px] text-ink-muted">
                      <span>0.6x (भारी / Deep)</span>
                      <span>1.0x (स्वाभाविक)</span>
                      <span>1.5x (मधुर / High)</span>
                    </div>
                  </div>

                  {/* Speed Slider */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink-soft">
                        Speed / गति (रफ़्तार):
                      </span>
                      <span className="text-xs font-mono font-medium text-indigo-700 dark:text-indigo-300">
                        {matchedRate.toFixed(2)}x
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0.6"
                      max="1.6"
                      step="0.05"
                      value={matchedRate}
                      onChange={(e) => {
                        setMatchedRate(parseFloat(e.target.value));
                        setActiveMatchPreset('');
                      }}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />

                    <div className="flex justify-between text-[10px] text-ink-muted">
                      <span>0.6x (धीमी)</span>
                      <span>0.95x (स्वाभाविक)</span>
                      <span>1.6x (तेज़)</span>
                    </div>
                  </div>

                  {/* Pause Cadence Slider */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink-soft">
                        Pause Cadence (अल्पविराम व ठहराव):
                      </span>
                      <span className="text-xs font-mono font-medium text-indigo-700 dark:text-indigo-300">
                        {matchedPauseWeight.toFixed(2)}x
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0.5"
                      max="1.8"
                      step="0.05"
                      value={matchedPauseWeight}
                      onChange={(e) => setMatchedPauseWeight(parseFloat(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />

                    <div className="flex justify-between text-[10px] text-ink-muted">
                      <span>0.5x (कम ठहराव)</span>
                      <span>1.0x (स्वाभाविक सांस)</span>
                      <span>1.8x (गंभीर ठहराव)</span>
                    </div>
                  </div>

                  {/* System Engine Voice selector */}
                  {availableVoices.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-line">
                      <div className="flex items-center justify-between text-xs font-semibold text-ink-soft">
                        <span>Installed System Voice (Microsoft, Google, etc.):</span>
                        <span className="text-[10px] text-ink-muted font-normal">
                          {availableVoices.length} detected
                        </span>
                      </div>
                      <select
                        value={selectedVoiceName}
                        onChange={(e) => setSelectedVoiceName(e.target.value)}
                        className="w-full h-8.5 rounded-xl border border-line bg-card-soft px-2.5 text-xs font-medium text-ink-soft focus:border-indigo-400 focus:outline-none cursor-pointer"
                      >
                        <option value="">Auto Optimal System Voice</option>
                        {availableVoices
                          .map((v) => (
                            <option key={`${v.voiceURI}-${v.lang}`} value={v.voiceURI || v.name}>
                              {v.name} ({v.lang})
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Bottom Test & Actions */}
                <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-card-soft/95 pt-3 pb-1 backdrop-blur">
                  <button
                    type="button"
                    onClick={handlePreviewMatchedVoice}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-on-accent text-xs font-semibold hover:bg-indigo-500 shadow-sm cursor-pointer transition-all"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>Test Matched Voice (आवाज़ सुनें)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('reader')}
                    className="px-4 py-2.5 rounded-xl border border-line bg-card text-xs font-semibold text-ink-soft hover:bg-card-soft cursor-pointer shadow-2xs"
                  >
                    <span>Go to Text Reader</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
