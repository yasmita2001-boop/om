// ============================================================================
// OM LIFEOS — TACTILE AUDITORY & HAPTIC ENGINE
// Synthesizes ultra-low-latency, Apple UI-inspired acoustic micro-sounds using Web Audio API.
// Zero network requests, 0ms latency, zero assets required.
// ============================================================================

export type SoundEffectType =
  | 'taskComplete'
  | 'taskUncheck'
  | 'habitComplete'
  | 'habitUncheck'
  | 'calcKey'
  | 'calcEquals'
  | 'tap'
  | 'switchToggle'
  | 'successChime';

class TactileSoundEngine {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private hapticEnabled: boolean = true;
  private masterVolume: number = 0.55;

  constructor() {
    this.initSettings();
  }

  private initSettings() {
    try {
      const storedSound = localStorage.getItem('om_sound_enabled');
      if (storedSound !== null) {
        this.soundEnabled = storedSound === 'true';
      }
      const storedHaptic = localStorage.getItem('om_haptic_enabled');
      if (storedHaptic !== null) {
        this.hapticEnabled = storedHaptic === 'true';
      }
      const storedVol = localStorage.getItem('om_sound_volume');
      if (storedVol !== null) {
        const v = parseFloat(storedVol);
        if (!isNaN(v) && v >= 0 && v <= 1) {
          this.masterVolume = v;
        }
      }
    } catch {
      // LocalStorage access fallback
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  public setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    try {
      localStorage.setItem('om_sound_enabled', String(enabled));
    } catch {}
    if (enabled) {
      this.play('tap');
    }
  }

  public isHapticEnabled(): boolean {
    return this.hapticEnabled;
  }

  public setHapticEnabled(enabled: boolean): void {
    this.hapticEnabled = enabled;
    try {
      localStorage.setItem('om_haptic_enabled', String(enabled));
    } catch {}
    if (enabled) {
      this.vibrate(15);
    }
  }

  public getVolume(): number {
    return this.masterVolume;
  }

  public setVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem('om_sound_volume', String(this.masterVolume));
    } catch {}
  }

  // Haptic feedback trigger
  public vibrate(pattern: number | number[] = 12): void {
    if (!this.hapticEnabled) return;
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch {
      // Haptics unavailable on device/browser
    }
  }

  // Synthesizes tactile sounds using Web Audio oscillators & gain nodes
  public play(type: SoundEffectType): void {
    if (!this.soundEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);
    gainNode.gain.setValueAtTime(0, now);

    switch (type) {
      // 1. Task Complete: Apple-style soft glass/wooden pop tap (crisp ascending micro-frequency)
      case 'taskComplete': {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(620, now);
        osc.frequency.exponentialRampToValueAtTime(1180, now + 0.045);

        // Sub harmonic for rich tactile body
        const osc2 = ctx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(310, now);
        osc2.frequency.exponentialRampToValueAtTime(590, now + 0.045);

        const osc2Gain = ctx.createGain();
        osc2Gain.gain.setValueAtTime(0.25 * this.masterVolume, now);
        osc2Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

        gainNode.gain.setValueAtTime(0.55 * this.masterVolume, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

        osc.connect(gainNode);
        osc2.connect(osc2Gain);
        osc2Gain.connect(ctx.destination);

        osc.start(now);
        osc2.start(now);
        osc.stop(now + 0.08);
        osc2.stop(now + 0.08);
        this.vibrate([14]);
        break;
      }

      // 2. Task Uncheck: Soft muted hollow tap
      case 'taskUncheck': {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(500, now);
        osc.frequency.exponentialRampToValueAtTime(260, now + 0.04);

        gainNode.gain.setValueAtTime(0.28 * this.masterVolume, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        osc.connect(gainNode);
        osc.start(now);
        osc.stop(now + 0.055);
        this.vibrate(8);
        break;
      }

      // 3. Habit Complete: Luminous dual-tone crystalline chime (warm glass bell)
      case 'habitComplete': {
        const notes = [
          { freq: 587.33, delay: 0.0, dur: 0.22, vol: 0.38 }, // D5
          { freq: 880.00, delay: 0.04, dur: 0.28, vol: 0.45 }, // A5
          { freq: 1174.66, delay: 0.09, dur: 0.35, vol: 0.32 }, // D6
        ];

        notes.forEach(({ freq, delay, dur, vol }) => {
          const osc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + delay);

          noteGain.gain.setValueAtTime(0, now + delay);
          noteGain.gain.linearRampToValueAtTime(vol * this.masterVolume, now + delay + 0.008);
          noteGain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);

          osc.connect(noteGain);
          noteGain.connect(ctx.destination);

          osc.start(now + delay);
          osc.stop(now + delay + dur + 0.02);
        });

        this.vibrate([12, 40, 18]);
        break;
      }

      // 4. Habit Uncheck
      case 'habitUncheck': {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.05);

        gainNode.gain.setValueAtTime(0.25 * this.masterVolume, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

        osc.connect(gainNode);
        osc.start(now);
        osc.stop(now + 0.065);
        this.vibrate(10);
        break;
      }

      // 5. Calculator Keystroke: Sharp damped tactile mechanical key tap
      case 'calcKey': {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(980, now);
        osc.frequency.exponentialRampToValueAtTime(420, now + 0.016);

        // Bandpass filter for tactile click sensation
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200, now);
        filter.Q.setValueAtTime(3, now);

        gainNode.gain.setValueAtTime(0.22 * this.masterVolume, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

        osc.connect(filter);
        filter.connect(gainNode);

        osc.start(now);
        osc.stop(now + 0.025);
        this.vibrate(6);
        break;
      }

      // 6. Calculator Equals / Compute Result
      case 'calcEquals': {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(659.25, now); // E5
        osc2.frequency.setValueAtTime(987.77, now + 0.035); // B5

        const g1 = ctx.createGain();
        const g2 = ctx.createGain();

        g1.gain.setValueAtTime(0.3 * this.masterVolume, now);
        g1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        g2.gain.setValueAtTime(0, now);
        g2.gain.setValueAtTime(0.35 * this.masterVolume, now + 0.035);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        osc1.connect(g1);
        osc2.connect(g2);
        g1.connect(ctx.destination);
        g2.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now + 0.035);
        osc1.stop(now + 0.09);
        osc2.stop(now + 0.17);
        this.vibrate([8, 25, 12]);
        break;
      }

      // 7. General Tap / Button Click
      case 'tap': {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(450, now + 0.015);

        gainNode.gain.setValueAtTime(0.18 * this.masterVolume, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

        osc.connect(gainNode);
        osc.start(now);
        osc.stop(now + 0.025);
        this.vibrate(5);
        break;
      }

      // 8. Toggle Switch (Light/Dark, Settings)
      case 'switchToggle': {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.exponentialRampToValueAtTime(850, now + 0.025);

        gainNode.gain.setValueAtTime(0.24 * this.masterVolume, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

        osc.connect(gainNode);
        osc.start(now);
        osc.stop(now + 0.04);
        this.vibrate(9);
        break;
      }

      // 9. Success Chime
      case 'successChime': {
        const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.035);

          g.gain.setValueAtTime(0, now + idx * 0.035);
          g.gain.linearRampToValueAtTime(0.28 * this.masterVolume, now + idx * 0.035 + 0.005);
          g.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.035 + 0.22);

          osc.connect(g);
          g.connect(ctx.destination);

          osc.start(now + idx * 0.035);
          osc.stop(now + idx * 0.035 + 0.25);
        });
        this.vibrate([10, 30, 15]);
        break;
      }
    }
  }
}

export const soundEngine = new TactileSoundEngine();
