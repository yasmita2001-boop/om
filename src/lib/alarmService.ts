import { storage, generateUUID } from './storage';
import { ReminderItem } from '../types';
import { alarmAudio } from './alarmAudio';

export interface FocusAlarm {
  id: string;
  time: string; // "HH:mm" 24-hour format
  label: string;
  ringtone: string; // 'zen_bell' | 'digital_pulse' | etc. | 'custom'
  enabled: boolean;
  days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat (empty array = one-time today/tomorrow)
  snoozedUntil?: number | null;
  lastTriggeredDate?: string;
  linkedRoutineId?: string | null;
  linkedRoutineName?: string | null;
  sourceType?: 'routine' | 'manual';
  createdAt: number;
}

export interface TriggeredAlarmData {
  id: string;
  type: 'reminder' | 'focus_alarm' | 'focus_timer';
  title: string;
  subtitle?: string;
  timeStr: string;
  ringtone: string;
  originalEntity?: any;
}

const STORAGE_KEY_FOCUS_ALARMS = 'om_focus_alarms_list';

class AlarmManagerService {
  private listenerCallback: ((data: TriggeredAlarmData) => void) | null = null;
  private checkInterval: any = null;
  private activeTriggered: TriggeredAlarmData | null = null;

  constructor() {
    this.purgeDefaultAlarms();
    this.startBackgroundMonitor();
  }

  // Subscribe to alarm triggers
  public onAlarmTrigger(cb: (data: TriggeredAlarmData) => void) {
    this.listenerCallback = cb;
  }

  public getActiveTriggered(): TriggeredAlarmData | null {
    return this.activeTriggered;
  }

  // Focus Alarms CRUD
  public purgeDefaultAlarms(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_FOCUS_ALARMS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((a: any) =>
            !a.id?.startsWith('default-') &&
            !a.id?.startsWith('seed-') &&
            a.label !== 'Morning Awakening & Routine' &&
            a.label !== 'Evening Reflection & Shutdown'
          );
          localStorage.setItem(STORAGE_KEY_FOCUS_ALARMS, JSON.stringify(cleaned));
        }
      }
    } catch {}
  }

  public getFocusAlarms(): FocusAlarm[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_FOCUS_ALARMS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.filter((a: any) =>
            !a.id?.startsWith('default-') &&
            !a.id?.startsWith('seed-') &&
            a.label !== 'Morning Awakening & Routine' &&
            a.label !== 'Evening Reflection & Shutdown'
          );
        }
      }
    } catch {}
    return [];
  }

  public saveFocusAlarms(alarms: FocusAlarm[]) {
    try {
      localStorage.setItem(STORAGE_KEY_FOCUS_ALARMS, JSON.stringify(alarms));
    } catch {}
  }

  public addFocusAlarm(alarm: Omit<FocusAlarm, 'id' | 'createdAt'>): FocusAlarm {
    const alarms = this.getFocusAlarms();
    const newAlarm: FocusAlarm = {
      ...alarm,
      id: generateUUID(),
      createdAt: Date.now()
    };
    alarms.push(newAlarm);
    this.saveFocusAlarms(alarms);
    return newAlarm;
  }

  public updateFocusAlarm(id: string, updates: Partial<FocusAlarm>) {
    const alarms = this.getFocusAlarms();
    const idx = alarms.findIndex(a => a.id === id);
    if (idx !== -1) {
      alarms[idx] = { ...alarms[idx], ...updates };
      this.saveFocusAlarms(alarms);
    }
  }

  public deleteFocusAlarm(id: string) {
    const alarms = this.getFocusAlarms().filter(a => a.id !== id);
    this.saveFocusAlarms(alarms);
  }

  // Trigger an immediate alarm event
  public triggerAlarm(data: TriggeredAlarmData) {
    this.activeTriggered = data;
    alarmAudio.startAlarmLoop(data.ringtone);

    // Browser Notification if permitted
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(`⏰ Alarm: ${data.title}`, {
          body: data.subtitle || `Time: ${data.timeStr}`,
          icon: '/favicon.ico'
        });
      }
    } catch {}

    if (this.listenerCallback) {
      this.listenerCallback(data);
    }
  }

  // Dismiss currently ringing alarm
  public async dismissAlarm(data?: TriggeredAlarmData) {
    const target = data || this.activeTriggered;
    alarmAudio.stop();
    this.activeTriggered = null;

    if (!target) return;

    const todayStr = new Date().toISOString().slice(0, 10);

    if (target.type === 'focus_alarm') {
      const alarms = this.getFocusAlarms();
      const alarm = alarms.find(a => a.id === target.id);
      if (alarm) {
        alarm.lastTriggeredDate = todayStr;
        alarm.snoozedUntil = null;
        // If one-time alarm (no repeat days), turn it off
        if (!alarm.days || alarm.days.length === 0) {
          alarm.enabled = false;
        }
        this.saveFocusAlarms(alarms);
      }
    } else if (target.type === 'reminder') {
      try {
        const rems = await storage.getAll<ReminderItem>('reminders');
        const rem = rems.find(r => r.id === target.id);
        if (rem) {
          rem.lastNotifiedAt = Date.now();
          rem.status = 'done';
          rem.updatedAt = Date.now();
          await storage.put('reminders', rem);
        }
      } catch (e) {
        console.error('Failed updating reminder on dismiss', e);
      }
    }
  }

  // Snooze alarm by X minutes (default 5 minutes)
  public async snoozeAlarm(minutes: number = 5, data?: TriggeredAlarmData) {
    const target = data || this.activeTriggered;
    alarmAudio.stop();
    this.activeTriggered = null;

    if (!target) return;

    const snoozeTargetTime = Date.now() + minutes * 60 * 1000;

    if (target.type === 'focus_alarm') {
      const alarms = this.getFocusAlarms();
      const alarm = alarms.find(a => a.id === target.id);
      if (alarm) {
        alarm.snoozedUntil = snoozeTargetTime;
        this.saveFocusAlarms(alarms);
      }
    } else if (target.type === 'reminder') {
      try {
        const rems = await storage.getAll<ReminderItem>('reminders');
        const rem = rems.find(r => r.id === target.id);
        if (rem) {
          // Push dueAt forward by snooze minutes
          const snoozedDate = new Date(snoozeTargetTime);
          const yyyy = snoozedDate.getFullYear();
          const mm = String(snoozedDate.getMonth() + 1).padStart(2, '0');
          const dd = String(snoozedDate.getDate()).padStart(2, '0');
          const hh = String(snoozedDate.getHours()).padStart(2, '0');
          const min = String(snoozedDate.getMinutes()).padStart(2, '0');
          rem.dueAt = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
          rem.updatedAt = Date.now();
          await storage.put('reminders', rem);
        }
      } catch {}
    }
  }

  // Background monitor loop: checks every 1.5 seconds
  private startBackgroundMonitor() {
    if (this.checkInterval) clearInterval(this.checkInterval);

    this.checkInterval = setInterval(() => {
      this.evaluateAlarms();
    }, 1500);
  }

  private async evaluateAlarms() {
    if (this.activeTriggered) {
      // An alarm is currently ringing, don't trigger another over it
      return;
    }

    const now = new Date();
    const currentDay = now.getDay(); // 0 to 6
    const todayStr = now.toISOString().slice(0, 10);
    const currentH = String(now.getHours()).padStart(2, '0');
    const currentM = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentH}:${currentM}`; // "HH:mm"
    const nowTimeMs = now.getTime();

    // 1. Check Focus Alarms
    const focusAlarms = this.getFocusAlarms();
    for (const alarm of focusAlarms) {
      if (!alarm.enabled) continue;

      // Check if snoozed
      if (alarm.snoozedUntil) {
        if (nowTimeMs >= alarm.snoozedUntil) {
          alarm.snoozedUntil = null;
          this.saveFocusAlarms(focusAlarms);
          this.triggerAlarm({
            id: alarm.id,
            type: 'focus_alarm',
            title: alarm.label || 'Focus Alarm',
            subtitle: `Snoozed alarm ringing (${currentTimeStr})`,
            timeStr: currentTimeStr,
            ringtone: alarm.ringtone || alarmAudio.getDefaultRingtoneId(),
            originalEntity: alarm
          });
          return;
        }
        continue;
      }

      // Check standard schedule
      const matchesDay = !alarm.days || alarm.days.length === 0 || alarm.days.includes(currentDay);
      const isDue = alarm.time === currentTimeStr;
      const notTriggeredToday = alarm.lastTriggeredDate !== todayStr;

      if (matchesDay && isDue && notTriggeredToday) {
        this.triggerAlarm({
          id: alarm.id,
          type: 'focus_alarm',
          title: alarm.label || 'Focus Alarm',
          subtitle: `Scheduled for ${alarm.time}`,
          timeStr: alarm.time,
          ringtone: alarm.ringtone || alarmAudio.getDefaultRingtoneId(),
          originalEntity: alarm
        });
        return;
      }
    }

    // 2. Check Database Reminders with alarms enabled
    try {
      const reminders = await storage.getAll<ReminderItem>('reminders');
      for (const rem of reminders) {
        if (rem.status === 'done') continue;
        if (!rem.dueAt) continue;

        // Parse rem.dueAt (format could be "YYYY-MM-DDTHH:mm" or "YYYY-MM-DD HH:mm")
        const dueStr = rem.dueAt.replace(' ', 'T');
        const dueDate = new Date(dueStr);

        if (isNaN(dueDate.getTime())) continue;

        // Check if due within the last 2 minutes and not notified within the last 60 seconds
        const timeDiffMs = nowTimeMs - dueDate.getTime();
        const justDue = timeDiffMs >= 0 && timeDiffMs < 120000;
        const recentlyNotified = rem.lastNotifiedAt && (nowTimeMs - rem.lastNotifiedAt < 120000);

        if (justDue && !recentlyNotified) {
          const remTimeStr = dueStr.includes('T') ? dueStr.split('T')[1].slice(0, 5) : currentTimeStr;
          const assignedRingtone = (rem as any).ringtone || alarmAudio.getDefaultRingtoneId();

          this.triggerAlarm({
            id: rem.id,
            type: 'reminder',
            title: rem.title || 'Reminder Alert',
            subtitle: `Scheduled for ${rem.dueAt}`,
            timeStr: remTimeStr,
            ringtone: assignedRingtone,
            originalEntity: rem
          });
          return;
        }
      }
    } catch {}
  }
}

export const alarmService = new AlarmManagerService();
