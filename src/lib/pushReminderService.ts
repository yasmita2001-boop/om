import firebaseConfig from '../../firebase-applet-config.json';
import type { ReminderItem } from '../types';
import type { FocusAlarm } from './alarmService';
import { alarmService } from './alarmService';
import { storage } from './storage';

const ENABLED_KEY = 'om_closed_app_reminders_enabled';
const DEVICE_KEY_PREFIX = 'om_closed_app_reminders_device';
const DUE_GRACE_PERIOD_MS = 2 * 60 * 1000;
const syncQueues = new Map<string, Promise<void>>();

interface ScheduledAlarm {
  id: string;
  kind: 'reminder' | 'focus_alarm';
  dueAt: number;
  active: boolean;
  repeatDays?: number[];
  localTime?: string;
  timeZone?: string;
}

function profileKey(prefix: string, uid: string, profileId: string): string {
  return `${prefix}:${uid}:${profileId}`;
}

function getDeviceId(uid: string, profileId: string): string {
  const key = profileKey(DEVICE_KEY_PREFIX, uid, profileId);
  let deviceId = localStorage.getItem(key);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(key, deviceId);
  }
  return deviceId;
}

async function getFirebaseAppForUser(uid: string) {
  const [appModule, authModule] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth')
  ]);
  const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(firebaseConfig);
  if (authModule.getAuth(app).currentUser?.uid !== uid) {
    throw new Error('Sign in with the matching Google account before enabling background reminders.');
  }
  return app;
}

function parseReminderDueAt(dueAt: string): number | null {
  const date = new Date(dueAt.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function getNextFocusAlarm(alarm: FocusAlarm, now = new Date()): ScheduledAlarm | null {
  if (!alarm.enabled || !alarm.time) return null;

  const [hours, minutes] = alarm.time.split(':').map(Number);
  if (
    !Number.isInteger(hours) ||
    hours < 0 ||
    hours > 23 ||
    !Number.isInteger(minutes) ||
    minutes < 0 ||
    minutes > 59
  ) return null;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  if (alarm.snoozedUntil && alarm.snoozedUntil > now.getTime() - DUE_GRACE_PERIOD_MS) {
    return {
      id: `focus_${alarm.id}`,
      kind: 'focus_alarm',
      dueAt: alarm.snoozedUntil,
      active: true,
      repeatDays: alarm.days || [],
      localTime: alarm.time,
      timeZone
    };
  }

  for (let offset = 0; offset < 8; offset++) {
    const occurrence = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hours, minutes, 0, 0);
    const matchesDay = !alarm.days?.length || alarm.days.includes(occurrence.getDay());
    if (!matchesDay || occurrence.getTime() <= now.getTime()) continue;

    const occurrenceDate = [
      occurrence.getFullYear(),
      String(occurrence.getMonth() + 1).padStart(2, '0'),
      String(occurrence.getDate()).padStart(2, '0')
    ].join('-');
    if (offset === 0 && alarm.lastTriggeredDate === occurrenceDate) continue;

    return {
      id: `focus_${alarm.id}`,
      kind: 'focus_alarm',
      dueAt: occurrence.getTime(),
      active: true,
      repeatDays: alarm.days || [],
      localTime: alarm.time,
      timeZone
    };
  }

  return null;
}

function getScheduledAlarms(reminders: ReminderItem[], profileId: string): ScheduledAlarm[] {
  const now = Date.now();
  const reminderSchedules = reminders.flatMap(reminder => {
    const dueAt = reminder.dueAt ? parseReminderDueAt(reminder.dueAt) : null;
    if (
      reminder.status === 'done' ||
      reminder.alarmEnabled === false ||
      dueAt === null ||
      dueAt < now - DUE_GRACE_PERIOD_MS
    ) return [];

    return [{ id: reminder.id, kind: 'reminder' as const, dueAt, active: true }];
  });

  return [
    ...reminderSchedules,
    ...alarmService.getFocusAlarms(profileId).flatMap(alarm => {
      const schedule = getNextFocusAlarm(alarm);
      return schedule ? [schedule] : [];
    })
  ];
}

async function getMessagingContext(uid: string) {
  const app = await getFirebaseAppForUser(uid);
  if (!window.isSecureContext || !('serviceWorker' in navigator) || !('Notification' in window)) {
    throw new Error('This browser does not support background push notifications.');
  }
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    throw new Error('Background reminders are not configured yet: add the Firebase Web Push certificate key.');
  }
  if (Notification.permission !== 'granted') {
    throw new Error('Allow notifications in your browser/device settings to receive background reminders.');
  }
  const messagingModule = await import('firebase/messaging');
  if (!await messagingModule.isSupported()) {
    throw new Error('Firebase push messaging is not supported in this browser.');
  }

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    throw new Error('Install/use the hosted PWA over HTTPS before enabling background reminders.');
  }
  const messaging = messagingModule.getMessaging(app);
  const token = await messagingModule.getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error('The browser did not provide a push notification token.');
  return { app, messaging, messagingModule, token };
}

export function isBackgroundRemindersEnabled(uid: string, profileId: string): boolean {
  return localStorage.getItem(profileKey(ENABLED_KEY, uid, profileId)) === 'true';
}

async function syncBackgroundRemindersNow(uid: string, profileId: string): Promise<void> {
  if (!isBackgroundRemindersEnabled(uid, profileId)) return;

  const [{ app, token }, firestore] = await Promise.all([
    getMessagingContext(uid),
    import('firebase/firestore')
  ]);
  const db = firestore.getFirestore(app);
  const deviceRef = firestore.doc(db, 'users', uid, 'devices', getDeviceId(uid, profileId));
  await firestore.setDoc(deviceRef, { token, updatedAt: firestore.serverTimestamp() }, { merge: true });

  const schedulesRef = firestore.collection(deviceRef, 'scheduledReminders');
  const [reminders, existingSnapshot] = await Promise.all([
    storage.getAll<ReminderItem>('reminders', profileId),
    firestore.getDocs(schedulesRef)
  ]);
  const schedules = getScheduledAlarms(reminders, profileId);
  const desiredIds = new Set(schedules.map(schedule => schedule.id));
  const existingById = new Map(existingSnapshot.docs.map(snapshot => [snapshot.id, snapshot]));

  await Promise.all(schedules.map(async schedule => {
    const scheduleRef = firestore.doc(schedulesRef, schedule.id);
    const existing = existingById.get(schedule.id)?.data();
    const sameSchedule = existing?.active === schedule.active && existing?.dueAt === schedule.dueAt;
    await firestore.setDoc(scheduleRef, {
      ...schedule,
      sentAt: sameSchedule ? existing?.sentAt ?? null : null,
      updatedAt: firestore.serverTimestamp()
    }, { merge: true });
  }));

  const staleSchedules = existingSnapshot.docs.filter(snapshot => !desiredIds.has(snapshot.id));
  for (let offset = 0; offset < staleSchedules.length; offset += 450) {
    const batch = firestore.writeBatch(db);
    staleSchedules.slice(offset, offset + 450).forEach(snapshot => batch.delete(snapshot.ref));
    await batch.commit();
  }
}

export function syncBackgroundReminders(uid: string, profileId: string): Promise<void> {
  if (!isBackgroundRemindersEnabled(uid, profileId)) return Promise.resolve();
  const key = profileKey('om_closed_app_reminders_sync', uid, profileId);
  const previous = syncQueues.get(key);
  const next = (previous ? previous.catch(() => undefined) : Promise.resolve())
    .then(() => syncBackgroundRemindersNow(uid, profileId));
  syncQueues.set(key, next);
  void next.then(
    () => { if (syncQueues.get(key) === next) syncQueues.delete(key); },
    () => { if (syncQueues.get(key) === next) syncQueues.delete(key); }
  );
  return next;
}

export async function enableBackgroundReminders(uid: string, profileId: string): Promise<void> {
  if (!window.isSecureContext || !('serviceWorker' in navigator) || !('Notification' in window)) {
    throw new Error('Background reminders need a supported browser and an HTTPS-installed PWA.');
  }
  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Allow notifications in your browser/device settings to receive background reminders.');
  }

  const [{ app, token }, firestore] = await Promise.all([
    getMessagingContext(uid),
    import('firebase/firestore')
  ]);
  const deviceRef = firestore.doc(
    firestore.getFirestore(app),
    'users',
    uid,
    'devices',
    getDeviceId(uid, profileId)
  );
  await firestore.setDoc(deviceRef, { token, updatedAt: firestore.serverTimestamp() }, { merge: true });
  localStorage.setItem(profileKey(ENABLED_KEY, uid, profileId), 'true');
  try {
    await syncBackgroundReminders(uid, profileId);
  } catch (error) {
    localStorage.removeItem(profileKey(ENABLED_KEY, uid, profileId));
    try {
      await disableBackgroundReminders(uid, profileId);
    } catch (cleanupError) {
      console.error('Could not clean up a partially enabled background reminder device:', cleanupError);
    }
    throw error;
  }
}

export async function disableBackgroundReminders(uid: string, profileId: string): Promise<void> {
  const [app, firestore] = await Promise.all([
    getFirebaseAppForUser(uid),
    import('firebase/firestore')
  ]);
  const db = firestore.getFirestore(app);
  const deviceRef = firestore.doc(db, 'users', uid, 'devices', getDeviceId(uid, profileId));
  const schedules = await firestore.getDocs(firestore.collection(deviceRef, 'scheduledReminders'));
  for (let offset = 0; offset < schedules.docs.length; offset += 450) {
    const batch = firestore.writeBatch(db);
    schedules.docs.slice(offset, offset + 450).forEach(snapshot => batch.delete(snapshot.ref));
    await batch.commit();
  }
  await firestore.deleteDoc(deviceRef);
  localStorage.removeItem(profileKey(ENABLED_KEY, uid, profileId));
  const messagingModule = await import('firebase/messaging');
  await messagingModule.deleteToken(messagingModule.getMessaging(app));
}
