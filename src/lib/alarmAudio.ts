// Universal Alarm & Ringtone Engine for Om-LifeOS
// Supports 6 synthesizer ringtones via Web Audio API + Custom User Uploads (MP3/WAV/OGG/M4A)
import { useState, useEffect } from 'react';

export interface RingtoneOption {
  id: string;
  name: string;
  description: string;
  type: 'synth' | 'custom';
}

export const BUILTIN_RINGTONES: RingtoneOption[] = [
  {
    id: 'zen_bell',
    name: 'Zen Temple Bell',
    description: 'Deep resonant harmonics, calming & meditative',
    type: 'synth'
  },
  {
    id: 'digital_pulse',
    name: 'Digital Pulse Alarm',
    description: 'Crisp rhythmic triple-beep, highly alert',
    type: 'synth'
  },
  {
    id: 'morning_chime',
    name: 'Morning Sunrise Chime',
    description: 'Pleasant pentatonic melody, gentle awakening',
    type: 'synth'
  },
  {
    id: 'classic_clock',
    name: 'Classic Twin-Bell Clock',
    description: 'Traditional energetic alarm bell vibration',
    type: 'synth'
  },
  {
    id: 'cosmic_arp',
    name: 'Cosmic Synth Arp',
    description: 'Atmospheric electronic arpeggio chime',
    type: 'synth'
  },
  {
    id: 'marimba_joy',
    name: 'Marimba Melody',
    description: 'Warm acoustic wooden marimba sequence',
    type: 'synth'
  }
];

const STORAGE_KEY_CUSTOM_RINGTONE = 'om_custom_ringtone_data';
const STORAGE_KEY_CUSTOM_NAME = 'om_custom_ringtone_name';
const STORAGE_KEY_VOLUME = 'om_alarm_volume';
const STORAGE_KEY_DEFAULT_RINGTONE = 'om_default_ringtone';

class AlarmAudioEngine {
  private audioCtx: AudioContext | null = null;
  private currentLoopTimer: any = null;
  private isPlaying: boolean = false;
  private currentAudioElement: HTMLAudioElement | null = null;
  private activeOscillators: OscillatorNode[] = [];

  private getAudioContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // Volume helper (0.0 to 1.0)
  public getVolume(): number {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_VOLUME);
      if (stored !== null) return Math.min(1, Math.max(0, parseFloat(stored)));
    } catch {}
    return 0.85;
  }

  public setVolume(val: number) {
    try {
      localStorage.setItem(STORAGE_KEY_VOLUME, String(Math.min(1, Math.max(0, val))));
    } catch {}
  }

  public getDefaultRingtoneId(): string {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_DEFAULT_RINGTONE);
      if (stored) return stored;
      const custom = this.getCustomRingtone();
      if (custom) return 'custom';
    } catch {}
    return 'zen_bell';
  }

  public setDefaultRingtoneId(id: string) {
    try {
      localStorage.setItem(STORAGE_KEY_DEFAULT_RINGTONE, id);
    } catch {}
  }

  // Custom User Ringtone Storage
  public getCustomRingtone(): { name: string; dataUrl: string } | null {
    try {
      const dataUrl = localStorage.getItem(STORAGE_KEY_CUSTOM_RINGTONE);
      const name = localStorage.getItem(STORAGE_KEY_CUSTOM_NAME) || 'Custom Audio';
      if (dataUrl) return { name, dataUrl };
    } catch {}
    return null;
  }

  public setCustomRingtone(name: string, dataUrl: string): boolean {
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_RINGTONE, dataUrl);
      localStorage.setItem(STORAGE_KEY_CUSTOM_NAME, name);
      this.setDefaultRingtoneId('custom');
      try {
        window.dispatchEvent(new CustomEvent('om_custom_ringtone_changed', { detail: { name, dataUrl } }));
      } catch {}
      return true;
    } catch (e) {
      console.error('Failed storing custom ringtone in localStorage', e);
      return false;
    }
  }

  public removeCustomRingtone() {
    try {
      localStorage.removeItem(STORAGE_KEY_CUSTOM_RINGTONE);
      localStorage.removeItem(STORAGE_KEY_CUSTOM_NAME);
      if (this.getDefaultRingtoneId() === 'custom') {
        this.setDefaultRingtoneId('zen_bell');
      }
      try {
        window.dispatchEvent(new CustomEvent('om_custom_ringtone_changed', { detail: null }));
      } catch {}
    } catch {}
  }

  // Synthesizer: 1. Zen Temple Bell
  private synthZenBell(ctx: AudioContext, vol: number) {
    const freqs = [528, 1056, 1584, 2112];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const delay = idx * 0.04;
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime((vol * 0.4) / (idx + 1), ctx.currentTime + delay + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 2.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 2.2);
      this.activeOscillators.push(osc);
    });
  }

  // Synthesizer: 2. Digital Pulse Alarm (Beep-Beep-Beep)
  private synthDigitalPulse(ctx: AudioContext, vol: number) {
    const beeps = [0, 0.15, 0.3, 0.6, 0.75, 0.9];
    beeps.forEach((startTime) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, ctx.currentTime + startTime);

      gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
      gain.gain.linearRampToValueAtTime(vol * 0.35, ctx.currentTime + startTime + 0.01);
      gain.gain.setValueAtTime(vol * 0.35, ctx.currentTime + startTime + 0.08);
      gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + startTime + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + 0.11);
      this.activeOscillators.push(osc);
    });
  }

  // Synthesizer: 3. Morning Sunrise Chime (Gentle rising melody)
  private synthMorningChime(ctx: AudioContext, vol: number) {
    const notes = [
      { f: 523.25, t: 0 },    // C5
      { f: 659.25, t: 0.22 }, // E5
      { f: 783.99, t: 0.44 }, // G5
      { f: 1046.5, t: 0.66 }, // C6
      { f: 1318.5, t: 0.90 }  // E6
    ];

    notes.forEach(({ f, t }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, ctx.currentTime + t);

      gain.gain.setValueAtTime(0, ctx.currentTime + t);
      gain.gain.linearRampToValueAtTime(vol * 0.4, ctx.currentTime + t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 1.25);
      this.activeOscillators.push(osc);
    });
  }

  // Synthesizer: 4. Classic Clock Twin-Bell
  private synthClassicClock(ctx: AudioContext, vol: number) {
    for (let i = 0; i < 8; i++) {
      const t = i * 0.12;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(i % 2 === 0 ? 1200 : 1500, ctx.currentTime + t);

      gain.gain.setValueAtTime(0, ctx.currentTime + t);
      gain.gain.linearRampToValueAtTime(vol * 0.3, ctx.currentTime + t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.1);
      this.activeOscillators.push(osc);
    }
  }

  // Synthesizer: 5. Cosmic Synth Arp
  private synthCosmicArp(ctx: AudioContext, vol: number) {
    const freqs = [440, 554.37, 659.25, 880, 1108.73, 1318.51];
    freqs.forEach((freq, idx) => {
      const t = idx * 0.14;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + t);

      gain.gain.setValueAtTime(0, ctx.currentTime + t);
      gain.gain.linearRampToValueAtTime(vol * 0.38, ctx.currentTime + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 1.0);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 1.05);
      this.activeOscillators.push(osc);
    });
  }

  // Synthesizer: 6. Marimba Melody
  private synthMarimbaJoy(ctx: AudioContext, vol: number) {
    const notes = [
      { f: 587.33, t: 0 },    // D5
      { f: 739.99, t: 0.15 }, // F#5
      { f: 880.00, t: 0.30 }, // A5
      { f: 1174.66, t: 0.45 },// D6
      { f: 880.00, t: 0.60 }, // A5
      { f: 1174.66, t: 0.75 } // D6
    ];

    notes.forEach(({ f, t }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, ctx.currentTime + t);

      gain.gain.setValueAtTime(0, ctx.currentTime + t);
      gain.gain.linearRampToValueAtTime(vol * 0.45, ctx.currentTime + t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.55);
      this.activeOscillators.push(osc);
    });
  }

  // Single iteration playback of specified ringtone
  private playOnce(ringtoneId: string, vol: number) {
    if (ringtoneId === 'custom') {
      const custom = this.getCustomRingtone();
      if (custom && custom.dataUrl) {
        if (!this.currentAudioElement) {
          this.currentAudioElement = new Audio(custom.dataUrl);
        }
        this.currentAudioElement.volume = vol;
        this.currentAudioElement.currentTime = 0;
        this.currentAudioElement.play().catch(e => console.warn('Audio play error', e));
        return;
      }
      ringtoneId = 'zen_bell';
    }

    try {
      const ctx = this.getAudioContext();
      switch (ringtoneId) {
        case 'digital_pulse':
          this.synthDigitalPulse(ctx, vol);
          break;
        case 'morning_chime':
          this.synthMorningChime(ctx, vol);
          break;
        case 'classic_clock':
          this.synthClassicClock(ctx, vol);
          break;
        case 'cosmic_arp':
          this.synthCosmicArp(ctx, vol);
          break;
        case 'marimba_joy':
          this.synthMarimbaJoy(ctx, vol);
          break;
        case 'zen_bell':
        default:
          this.synthZenBell(ctx, vol);
          break;
      }
    } catch (e) {
      console.error('Synthesizer play error', e);
    }
  }

  // Play once as preview (e.g. clicking "Test Ringtone")
  public previewRingtone(ringtoneId?: string) {
    this.stop();
    const id = ringtoneId || this.getDefaultRingtoneId();
    const vol = this.getVolume();
    this.playOnce(id, vol);
  }

  // Start continuous alarm loop (stops when user clicks Dismiss / Snooze)
  public startAlarmLoop(ringtoneId?: string) {
    this.stop();
    const id = ringtoneId || this.getDefaultRingtoneId();
    const vol = this.getVolume();
    this.isPlaying = true;

    // Custom audio looping
    if (id === 'custom') {
      const custom = this.getCustomRingtone();
      if (custom && custom.dataUrl) {
        this.currentAudioElement = new Audio(custom.dataUrl);
        this.currentAudioElement.volume = vol;
        this.currentAudioElement.loop = true;
        this.currentAudioElement.play().catch(e => console.warn('Audio play error', e));
        return;
      }
    }

    // Synthesizer looping every 2.4 seconds
    this.playOnce(id, vol);
    this.currentLoopTimer = setInterval(() => {
      if (!this.isPlaying) {
        clearInterval(this.currentLoopTimer);
        return;
      }
      this.playOnce(id, vol);
    }, 2400);
  }

  // Stop any active ringtone or loop
  public stop() {
    this.isPlaying = false;
    if (this.currentLoopTimer) {
      clearInterval(this.currentLoopTimer);
      this.currentLoopTimer = null;
    }
    if (this.currentAudioElement) {
      this.currentAudioElement.pause();
      this.currentAudioElement.currentTime = 0;
      this.currentAudioElement = null;
    }
    this.activeOscillators.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    });
    this.activeOscillators = [];
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

export const alarmAudio = new AlarmAudioEngine();

// Dynamic Helper: Returns Custom Ringtone (if set) + 6 Built-in Synth Ringtones
export function getAllRingtoneOptions(): RingtoneOption[] {
  const custom = alarmAudio.getCustomRingtone();
  if (custom) {
    return [
      {
        id: 'custom',
        name: `🎵 ${custom.name} (Custom)`,
        description: 'Your uploaded custom audio ringtone',
        type: 'custom'
      },
      ...BUILTIN_RINGTONES
    ];
  }
  return BUILTIN_RINGTONES;
}

// Dynamic Helper: Returns the user's active default ringtone ID
export function getDefaultRingtoneId(): string {
  return alarmAudio.getDefaultRingtoneId();
}

// Dynamic Helper: Returns human-friendly ringtone display title
export function getRingtoneLabel(id?: string): string {
  if (!id) return 'Default Alarm';
  if (id === 'custom') {
    const custom = alarmAudio.getCustomRingtone();
    return custom ? `🎵 ${custom.name} (Custom)` : 'Custom Audio';
  }
  const found = BUILTIN_RINGTONES.find(r => r.id === id);
  return found ? found.name : id;
}

// React Hook: Listens for ringtone changes and keeps dropdowns updated everywhere
export function useRingtoneOptions() {
  const [ringtoneOptions, setRingtoneOptions] = useState<RingtoneOption[]>(() => getAllRingtoneOptions());
  const [defaultRingtone, setDefaultRingtone] = useState<string>(() => getDefaultRingtoneId());

  useEffect(() => {
    const update = () => {
      setRingtoneOptions(getAllRingtoneOptions());
      setDefaultRingtone(getDefaultRingtoneId());
    };
    window.addEventListener('storage', update);
    window.addEventListener('om_custom_ringtone_changed', update);
    return () => {
      window.removeEventListener('storage', update);
      window.removeEventListener('om_custom_ringtone_changed', update);
    };
  }, []);

  return { ringtoneOptions, defaultRingtone };
}
