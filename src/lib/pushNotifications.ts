import firebaseConfig from '../../firebase-applet-config.json';
import type { ReminderItem } from '../types';

/**
 * Web Push (client half).
 *
 * The subscription and a small slice of the alarm schedule are mirrored to
 * Firestore so the scheduled Cloud Function in `functions/` can deliver a
 * notification while the app is closed. Nothing else leaves the device.
 */

const VAPID_PUBLIC_KEY = String(import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '').trim();
const ENABLED_FLAG = 'om_push_enabled';
const MAX_SCHEDULE_ENTRIES = 50;
const HORIZON_DAYS = 14;

export type PushStatus = 'unsupported' | 'unconfigured' | 'blocked' | 'idle' | 'subscribed' | 'error';

export interface PushResult {
  status: PushStatus;
  message?: string;
}

export interface PushScheduleEntry {
  id: string;
  title: string;
  dueAtMs: number;
  tag: string;
}

interface SerializedSubscription {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export function isPushConfigured(): boolean {
  return VAPID_PUBLIC_KEY.length > 0;
}

export function isPushEnabledLocally(): boolean {
  try {
    return localStorage.getItem(ENABLED_FLAG) === '1';
  } catch {
    /* storage can be unavailable: treat push as off */
    return false;
  }
}

/** Converts a VAPID key from base64url into the byte array the Push API expects. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * Parses the stored `dueAt` value. Reminders store a naive local timestamp
 * (`YYYY-MM-DDTHH:mm`), which `Date` already reads in the local timezone.
 */
export function reminderDueAtMs(dueAt: string | undefined | null): number | null {
  if (!dueAt) return null;
  const parsed = new Date(dueAt).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

/** Pure helper so the schedule shape can be unit tested. */
export function collectPushSchedule(reminders: ReminderItem[], now: number = Date.now()): PushScheduleEntry[] {
  const horizon = now + HORIZON_DAYS * 24 * 60 * 60 * 1000;

  return reminders
    .filter(reminder => reminder.status !== 'done' && reminder.alarmEnabled === true)
    .map(reminder => ({ reminder, dueAtMs: reminderDueAtMs(reminder.dueAt) }))
    .filter((entry): entry is { reminder: ReminderItem; dueAtMs: number } => entry.dueAtMs !== null)
    .filter(entry => entry.dueAtMs > now - 5 * 60 * 1000 && entry.dueAtMs <= horizon)
    .sort((a, b) => a.dueAtMs - b.dueAtMs)
    .slice(0, MAX_SCHEDULE_ENTRIES)
    .map(entry => ({
      id: entry.reminder.id,
      title: entry.reminder.title,
      dueAtMs: entry.dueAtMs,
      tag: `om-reminder-${entry.reminder.id}`,
    }));
}

type FirestoreBinding = {
  setDoc: (reference: unknown, data: Record<string, unknown>, options?: { merge?: boolean }) => Promise<void>;
  deleteDoc: (reference: unknown) => Promise<void>;
  doc: (...args: unknown[]) => unknown;
  reference: unknown;
};

async function getFirestoreBinding(): Promise<FirestoreBinding | null> {
  try {
    const appModule = await import('firebase/app');
    const authModule = await import('firebase/auth');
    const firestoreModule = await import('firebase/firestore');

    const app = appModule.getApps()[0] ?? appModule.initializeApp(firebaseConfig);
    const uid = authModule.getAuth(app).currentUser?.uid;
    // Local-only mode: without a signed-in user there is nowhere to mirror the subscription.
    if (!uid) return null;

    const db = firestoreModule.getFirestore(app);
    return {
      setDoc: firestoreModule.setDoc as FirestoreBinding['setDoc'],
      deleteDoc: firestoreModule.deleteDoc as FirestoreBinding['deleteDoc'],
      doc: firestoreModule.doc as FirestoreBinding['doc'],
      reference: firestoreModule.doc(db, 'pushSubscriptions', uid),
    };
  } catch {
    /* Firebase unavailable (offline, blocked): push simply stays local */
    return null;
  }
}

function serializeSubscription(subscription: PushSubscription): SerializedSubscription | null {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;
  return {
    endpoint: json.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  return navigator.serviceWorker.ready;
}

async function readSubscription(): Promise<PushSubscription | null> {
  const registration = await getRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

async function writeRemoteDocument(schedule: PushScheduleEntry[] | null): Promise<void> {
  const binding = await getFirestoreBinding();
  if (!binding) return;

  if (schedule === null) {
    // Disabling push: remove the whole document so no stale endpoint is kept.
    await binding.deleteDoc(binding.reference);
    return;
  }

  const subscription = await readSubscription();
  const serialized = subscription ? serializeSubscription(subscription) : null;
  if (!serialized) return;

  await binding.setDoc(binding.reference, {
    subscription: serialized,
    schedule,
    timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
    updatedAt: Date.now(),
  });
}

export async function enablePush(): Promise<PushResult> {
  if (!isPushSupported()) {
    return { status: 'unsupported', message: 'This browser does not support push notifications.' };
  }
  if (!isPushConfigured()) {
    return { status: 'unconfigured', message: 'VITE_VAPID_PUBLIC_KEY is not set.' };
  }

  try {
    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
    if (permission !== 'granted') {
      return { status: 'blocked', message: 'Notification permission was not granted.' };
    }

    const registration = await getRegistration();
    if (!registration) return { status: 'unsupported' };

    const existing = await registration.pushManager.getSubscription();
    if (!existing) {
      await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    try {
      localStorage.setItem(ENABLED_FLAG, '1');
    } catch {
      /* storage can be unavailable: push still works for this session */
    }

    await writeRemoteDocument([]);
    return { status: 'subscribed' };
  } catch {
    /* browser push registration can fail (blocked origin, revoked permission) */
    return { status: 'error', message: 'Could not register this device for push.' };
  }
}

export async function disablePush(): Promise<void> {
  try {
    localStorage.removeItem(ENABLED_FLAG);
  } catch {
    /* storage can be unavailable */
  }

  try {
    const subscription = await readSubscription();
    if (subscription) await subscription.unsubscribe();
  } catch {
    /* subscription may already be released */
  }

  try {
    await writeRemoteDocument(null);
  } catch {
    /* remote cleanup is best-effort */
  }
}

/**
 * Mirrors the upcoming alarm-enabled reminders to Firestore. No-ops unless the
 * user enabled push and the browser still holds a subscription.
 */
export async function syncPushAlarms(reminders: ReminderItem[]): Promise<void> {
  if (!isPushEnabledLocally() || !isPushConfigured()) return;

  const subscription = await readSubscription();
  if (!subscription) return;

  try {
    await writeRemoteDocument(collectPushSchedule(reminders));
  } catch {
    /* a failed sync must never break reminder handling */
  }
}
