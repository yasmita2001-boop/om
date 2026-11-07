// Universal Alarm & Ringtone Engine for Om-LifeOS
// Supports built-in ringtones (synth + custom audio) via Web Audio API + Custom User Uploads (MP3/WAV/OGG/M4A)
import { useState, useEffect } from 'react';
import { storage } from './storage';

export interface RingtoneOption {
  id: string;
  name: string;
  description: string;
  type: 'synth' | 'custom';
  src?: string;
}

export const BUILTIN_RINGTONES: RingtoneOption[] = [
  {
    id: 'om_namah_shivay',
    name: 'Om Namah Shivay',
    description: 'Sacred mantra chant ringtone',
    type: 'custom',
    src: '/audio/om_namah_shivay.mp3',
  },
  {
    id: 'cosmic_arp',
    name: 'Cosmic Synth Arp',
    description: 'Atmospheric electronic arpeggio chime',
    type: 'synth'
  }
];

const STORAGE_KEY_CUSTOM_RINGTONE = 'om_custom_ringtone_data';
const STORAGE_KEY_CUSTOM_NAME = 'om_custom_ringtone_name';
const STORAGE_KEY_VOLUME = 'om_alarm_volume';
const STORAGE_KEY_DEFAULT_RINGTONE = 'om_default_ringtone';
const scopedKey = (key: string) => `${key}:${storage.getActiveProfileId()}`;
const getScopedItem = (key: string) => {
  const scoped = localStorage.getItem(scopedKey(key));
  if (scoped !== null) return scoped;
  return storage.getActiveProfileId() === 'om-master-profile' ? localStorage.getItem(key) : null;
};

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
      const stored = getScopedItem(STORAGE_KEY_VOLUME);
      if (stored !== null) return Math.min(1, Math.max(0, parseFloat(stored)));
    } catch {}
    return 0.85;
  }

  public setVolume(val: number) {
    try {
      localStorage.setItem(scopedKey(STORAGE_KEY_VOLUME), String(Math.min(1, Math.max(0, val))));
    } catch {}
  }

  public getDefaultRingtoneId(): string {
    try {
      const stored = getScopedItem(STORAGE_KEY_DEFAULT_RINGTONE);
      if (stored && BUILTIN_RINGTONES.some(r => r.id === stored)) return stored;
      const custom = this.getCustomRingtone();
      if (custom) return 'custom';
    } catch {}
    return 'om_namah_shivay';
  }

  public setDefaultRingtoneId(id: string) {
    try {
      localStorage.setItem(scopedKey(STORAGE_KEY_DEFAULT_RINGTONE), id);
    } catch {}
  }

  // Custom User Ringtone Storage
  public getCustomRingtone(): { name: string; dataUrl: string } | null {
    try {
      const dataUrl = getScopedItem(STORAGE_KEY_CUSTOM_RINGTONE);
      const name = getScopedItem(STORAGE_KEY_CUSTOM_NAME) || 'Custom Audio';
      if (dataUrl) return { name, dataUrl };
    } catch {}
    return null;
  }

  public setCustomRingtone(name: string, dataUrl: string): boolean {
    try {
      localStorage.setItem(scopedKey(STORAGE_KEY_CUSTOM_RINGTONE), dataUrl);
      localStorage.setItem(scopedKey(STORAGE_KEY_CUSTOM_NAME), name);
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
      localStorage.removeItem(scopedKey(STORAGE_KEY_CUSTOM_RINGTONE));
      localStorage.removeItem(scopedKey(STORAGE_KEY_CUSTOM_NAME));
      if (this.getDefaultRingtoneId() === 'custom') {
        this.setDefaultRingtoneId('om_namah_shivay');
      }
      try {
        window.dispatchEvent(new CustomEvent('om_custom_ringtone_changed', { detail: null }));
      } catch {}
    } catch {}
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
      ringtoneId = 'om_namah_shivay';
    }

    // Built-in custom audio ringtone (MP3/WAV/OGG/M4A served from public/)
    const builtin = BUILTIN_RINGTONES.find(r => r.id === ringtoneId);
    if (builtin?.src) {
      this.getAudioContext();
      if (!this.currentAudioElement) {
        this.currentAudioElement = new Audio(builtin.src);
      }
      this.currentAudioElement.volume = vol;
      this.currentAudioElement.currentTime = 0;
      this.currentAudioElement.play().catch(e => console.warn('Audio play error', e));
      return;
    }

    try {
      const ctx = this.getAudioContext();
      this.synthCosmicArp(ctx, vol);
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

    // Custom audio looping (user-uploaded or built-in audio file)
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
    const builtin = BUILTIN_RINGTONES.find(r => r.id === id);
    if (builtin?.src) {
      this.getAudioContext();
      this.currentAudioElement = new Audio(builtin.src);
      this.currentAudioElement.volume = vol;
      this.currentAudioElement.loop = true;
      this.currentAudioElement.play().catch(e => console.warn('Audio play error', e));
      return;
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
        name: `${custom.name} (Custom)`,
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
    return custom ? `${custom.name} (Custom)` : 'Custom Audio';
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
