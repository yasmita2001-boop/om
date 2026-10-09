// Pure Web Audio API Synthesizer & Alarm Management Engine
import { storage } from './storage';
import { FocusAlarm, Task } from '../types';

export interface RingtoneOption {
  id: string;
  name: string;
  description: string;
}

export const BUILTIN_RINGTONES: RingtoneOption[] = [
  { id: 'zen_bell', name: 'Zen Temple Bell', description: 'Harmonic sine resonant chime, calm & focused' },
  { id: 'digital_pulse', name: 'Digital Pulse Alarm', description: 'Rhythmic triple beep, alert and crisp' },
  { id: 'morning_chime', name: 'Morning Sunrise Chime', description: 'Pentatonic melody, gentle awakening' },
  { id: 'classic_clock', name: 'Classic Twin-Bell Clock', description: 'Traditional energetic alarm vibration' },
  { id: 'cosmic_arp', name: 'Cosmic Synth Arp', description: 'Atmospheric electronic arpeggio chime' },
  { id: 'marimba_joy', name: 'Marimba Melody', description: 'Warm acoustic wooden marimba cadence' }
];

export interface TriggeredAlarmData {
  id: string;
  title: string;
  subtitle?: string;
  timeStr: string;
  ringtone: string;
  type: 'focus_alarm' | 'task_reminder' | 'focus_timer';
}

class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private loopTimer: any = null;
  private isPlaying: boolean = false;
  private activeOscillators: OscillatorNode[] = [];

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public getVolume(): number {
    try {
      const v = localStorage.getItem('om_alarm_volume');
      if (v !== null) return Math.max(0, Math.min(1, parseFloat(v)));
    } catch {}
    return 0.85;
  }

  public setVolume(v: number): void {
    try {
      localStorage.setItem('om_alarm_volume', String(Math.max(0, Math.min(1, v))));
    } catch {}
  }

  public getDefaultRingtoneId(): string {
    try {
      const r = localStorage.getItem('om_default_ringtone');
      if (r) return r;
    } catch {}
    return 'zen_bell';
  }

  public setDefaultRingtoneId(id: string): void {
    try {
      localStorage.setItem('om_default_ringtone', id);
    } catch {}
  }

  // 1. Zen Temple Bell
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
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 2.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 2.4);
      this.activeOscillators.push(osc);
    });
  }

  // 2. Digital Pulse
  private synthDigitalPulse(ctx: AudioContext, vol: number) {
    const beeps = [0, 0.15, 0.3, 0.6, 0.75, 0.9];
    beeps.forEach(startTime => {
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

  // 3. Morning Sunrise Chime
  private synthMorningChime(ctx: AudioContext, vol: number) {
    const notes = [
      { f: 523.25, t: 0 },
      { f: 659.25, t: 0.22 },
      { f: 783.99, t: 0.44 },
      { f: 1046.5, t: 0.66 },
      { f: 1318.5, t: 0.90 }
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

  // 4. Classic Clock Twin-Bell
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

  // 5. Cosmic Synth Arp
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

  // 6. Marimba Melody
  private synthMarimbaJoy(ctx: AudioContext, vol: number) {
    const notes = [
      { f: 587.33, t: 0 },
      { f: 739.99, t: 0.15 },
      { f: 880.00, t: 0.30 },
      { f: 1174.66, t: 0.45 },
      { f: 880.00, t: 0.60 }
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

  private playTone(id: string, vol: number) {
    try {
      const ctx = this.getContext();
      switch (id) {
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
      console.warn('Audio play error:', e);
    }
  }

  public preview(ringtoneId?: string) {
    this.stop();
    const id = ringtoneId || this.getDefaultRingtoneId();
    const vol = this.getVolume();
    this.playTone(id, vol);
  }

  public startLoop(ringtoneId?: string) {
    this.stop();
    const id = ringtoneId || this.getDefaultRingtoneId();
    const vol = this.getVolume();
    this.isPlaying = true;
    this.playTone(id, vol);
    this.loopTimer = setInterval(() => {
      if (!this.isPlaying) {
        clearInterval(this.loopTimer);
        return;
      }
      this.playTone(id, vol);
    }, 2500);
  }

  public stop() {
    this.isPlaying = false;
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    this.activeOscillators.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    });
    this.activeOscillators = [];
  }
}

export const soundEngine = new AudioSynthesizer();

class AlarmService {
  private listener: ((data: TriggeredAlarmData) => void) | null = null;
  private monitorTimer: any = null;
  private activeTriggered: TriggeredAlarmData | null = null;

  constructor() {
    this.startMonitor();
  }

  public onTrigger(cb: (data: TriggeredAlarmData) => void) {
    this.listener = cb;
  }

  public getActive(): TriggeredAlarmData | null {
    return this.activeTriggered;
  }

  public trigger(data: TriggeredAlarmData) {
    this.activeTriggered = data;
    soundEngine.startLoop(data.ringtone);
    if (this.listener) {
      this.listener(data);
    }
  }

  public async dismiss() {
    soundEngine.stop();
    const target = this.activeTriggered;
    this.activeTriggered = null;
    if (!target) return;

    if (target.type === 'focus_alarm') {
      const alarms = await storage.getAll<FocusAlarm>('focusAlarms');
      const matched = alarms.find(a => a.id === target.id);
      if (matched) {
        matched.lastTriggeredDate = new Date().toISOString().slice(0, 10);
        matched.snoozedUntil = null;
        await storage.put('focusAlarms', matched);
      }
    }
  }

  public async snooze(minutes = 5) {
    soundEngine.stop();
    const target = this.activeTriggered;
    this.activeTriggered = null;
    if (!target) return;

    const snoozeUntil = Date.now() + minutes * 60 * 1000;
    if (target.type === 'focus_alarm') {
      const alarms = await storage.getAll<FocusAlarm>('focusAlarms');
      const matched = alarms.find(a => a.id === target.id);
      if (matched) {
        matched.snoozedUntil = snoozeUntil;
        await storage.put('focusAlarms', matched);
      }
    }
  }

  private startMonitor() {
    if (this.monitorTimer) clearInterval(this.monitorTimer);
    this.monitorTimer = setInterval(() => {
      this.checkAlarms();
    }, 1500);
  }

  private async checkAlarms() {
    if (this.activeTriggered) return;
    const now = new Date();
    const currentH = String(now.getHours()).padStart(2, '0');
    const currentM = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentH}:${currentM}`;
    const currentDay = now.getDay();
    const todayStr = now.toISOString().slice(0, 10);
    const nowMs = now.getTime();

    try {
      const alarms = await storage.getAll<FocusAlarm>('focusAlarms');
      for (const a of alarms) {
        if (!a.enabled) continue;
        if (a.snoozedUntil) {
          if (nowMs >= a.snoozedUntil) {
            a.snoozedUntil = null;
            await storage.put('focusAlarms', a);
            this.trigger({
              id: a.id,
              type: 'focus_alarm',
              title: a.label || 'Focus Alarm',
              subtitle: `Snoozed alarm ringing (${currentTimeStr})`,
              timeStr: currentTimeStr,
              ringtone: a.ringtone || 'zen_bell'
            });
            return;
          }
          continue;
        }

        const matchDay = !a.days || a.days.length === 0 || a.days.includes(currentDay);
        const isDueTime = a.time === currentTimeStr;
        const notDoneToday = a.lastTriggeredDate !== todayStr;

        if (matchDay && isDueTime && notDoneToday) {
          this.trigger({
            id: a.id,
            type: 'focus_alarm',
            title: a.label || 'Scheduled Focus Alarm',
            subtitle: `Alarm reached ${a.time}`,
            timeStr: a.time,
            ringtone: a.ringtone || 'zen_bell'
          });
          return;
        }
      }
    } catch {}
  }
}

export const alarmService = new AlarmService();
