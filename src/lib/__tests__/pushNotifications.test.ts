import { describe, expect, it } from 'vitest';
import type { ReminderItem } from '../../types';
import {
  collectPushSchedule,
  reminderDueAtMs,
  urlBase64ToUint8Array,
} from '../pushNotifications';

const NOW = new Date('2026-11-20T09:00:00').getTime();

function reminder(overrides: Partial<ReminderItem>): ReminderItem {
  return {
    id: 'reminder',
    title: 'Reminder',
    dueAt: '2026-11-20T10:00',
    repeatRule: 'none',
    status: 'open',
    alarmEnabled: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('urlBase64ToUint8Array', () => {
  it('decodes base64url with padding removed', () => {
    const bytes = urlBase64ToUint8Array('AQID');
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });

  it('translates the url-safe alphabet', () => {
    // "-_" map to "+/" in standard base64.
    const bytes = urlBase64ToUint8Array('-_8');
    expect(Array.from(bytes)).toEqual([251, 255]);
  });
});

describe('reminderDueAtMs', () => {
  it('reads naive local timestamps', () => {
    expect(reminderDueAtMs('2026-11-20T10:30')).toBe(new Date(2026, 10, 20, 10, 30).getTime());
  });

  it('returns null for empty or invalid values', () => {
    expect(reminderDueAtMs('')).toBeNull();
    expect(reminderDueAtMs(undefined)).toBeNull();
    expect(reminderDueAtMs('not-a-date')).toBeNull();
  });
});

describe('collectPushSchedule', () => {
  it('keeps only enabled, open, upcoming alarms', () => {
    const schedule = collectPushSchedule([
      reminder({ id: 'upcoming' }),
      reminder({ id: 'done', status: 'done' }),
      reminder({ id: 'muted', alarmEnabled: false }),
      reminder({ id: 'past', dueAt: '2026-11-20T08:00' }),
      reminder({ id: 'far', dueAt: '2027-06-01T10:00' }),
    ], NOW);

    expect(schedule.map(entry => entry.id)).toEqual(['upcoming']);
    expect(schedule[0].tag).toBe('om-reminder-upcoming');
    expect(schedule[0].dueAtMs).toBe(new Date(2026, 10, 20, 10, 0).getTime());
  });

  it('sorts by due time and caps the payload', () => {
    const reminders = Array.from({ length: 60 }, (_, index) => reminder({
      id: `r${index}`,
      dueAt: `2026-11-21T${String(10 + (index % 10)).padStart(2, '0')}:00`,
    }));

    const schedule = collectPushSchedule(reminders, NOW);

    expect(schedule).toHaveLength(50);
    expect(schedule[0].dueAtMs).toBeLessThanOrEqual(schedule[schedule.length - 1].dueAtMs);
  });
});
