const { initializeApp } = require('firebase-admin/app');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { onSchedule } = require('firebase-functions/v2/scheduler');

initializeApp();

const db = getFirestore();
const CLAIM_TIMEOUT_MS = 5 * 60 * 1000;

function zonedParts(timestamp, timeZone) {
  const values = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(timestamp));
  return Object.fromEntries(values.map(part => [part.type, part.value]));
}

function localTimeToEpoch(year, month, day, hour, minute, timeZone) {
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let estimate = target;
  let nearestAfterTarget = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = zonedParts(estimate, timeZone);
    const represented = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute)
    );
    if (represented === target) return estimate;
    if (represented > target && (!nearestAfterTarget || represented < nearestAfterTarget.represented)) {
      nearestAfterTarget = { estimate, represented };
    }
    const adjustment = target - represented;
    estimate += adjustment;
  }
  return nearestAfterTarget ? nearestAfterTarget.estimate : estimate;
}

function nextFocusAlarmTime(now, time, repeatDays, timeZone) {
  const match = /^(\d{2}):(\d{2})$/.exec(time || '');
  if (!match || !timeZone || !repeatDays?.length) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const localNow = zonedParts(now, timeZone);
  const startDay = Date.UTC(Number(localNow.year), Number(localNow.month) - 1, Number(localNow.day));

  for (let offset = 0; offset < 8; offset++) {
    const calendarDay = new Date(startDay + offset * 24 * 60 * 60 * 1000);
    if (!repeatDays.includes(calendarDay.getUTCDay())) continue;
    const dueAt = localTimeToEpoch(
      calendarDay.getUTCFullYear(),
      calendarDay.getUTCMonth() + 1,
      calendarDay.getUTCDate(),
      hour,
      minute,
      timeZone
    );
    if (dueAt > now) return dueAt;
  }
  return null;
}

async function claimReminder(ref, now) {
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return false;
    const schedule = snapshot.data();
    if (!schedule.active || schedule.sentAt !== null || schedule.dueAt > now) return false;
    if (schedule.claimedAt && now - schedule.claimedAt < CLAIM_TIMEOUT_MS) return false;
    transaction.update(ref, { claimedAt: now });
    return true;
  });
}

async function deliverReminder(scheduleRef, now) {
  const deviceRef = scheduleRef.parent.parent;
  if (!deviceRef) {
    console.error('Scheduled reminder has no device parent:', scheduleRef.path);
    return;
  }

  const deviceSnapshot = await deviceRef.get();
  const token = deviceSnapshot.get('token');
  if (!deviceSnapshot.exists || typeof token !== 'string' || !token) {
    await scheduleRef.update({ active: false, sentAt: FieldValue.serverTimestamp() });
    return;
  }

  try {
    await getMessaging().send({
      token,
      data: {
        type: 'om_reminder_due',
        notificationId: scheduleRef.id,
        body: 'A reminder or alarm is due. Open Om to view it.'
      },
      webpush: {
        headers: { TTL: '86400', Urgency: 'high' }
      }
    });
  } catch (error) {
    const code = error && typeof error === 'object' ? error.code : undefined;
    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
      console.warn('Removing an expired Om push token for device:', deviceRef.path);
      await deviceRef.delete();
      await scheduleRef.update({ active: false, sentAt: FieldValue.serverTimestamp() });
      return;
    }
    await scheduleRef.update({ claimedAt: null });
    console.error('Push delivery failed; it will be retried:', scheduleRef.path, error);
    return;
  }

  const scheduleSnapshot = await scheduleRef.get();
  const schedule = scheduleSnapshot.data();
  if (schedule.kind === 'focus_alarm' && schedule.repeatDays?.length) {
    const nextDueAt = nextFocusAlarmTime(
      now,
      schedule.localTime,
      schedule.repeatDays,
      schedule.timeZone
    );
    if (nextDueAt !== null) {
      await scheduleRef.update({
        dueAt: nextDueAt,
        active: true,
        sentAt: null,
        claimedAt: null,
        updatedAt: FieldValue.serverTimestamp()
      });
      return;
    }
  }

  await scheduleRef.update({
    active: false,
    sentAt: FieldValue.serverTimestamp(),
    claimedAt: null,
    updatedAt: FieldValue.serverTimestamp()
  });
}

exports.sendDueReminderNotifications = onSchedule(
  { schedule: 'every 1 minutes', timeZone: 'Etc/UTC', maxInstances: 1 },
  async () => {
    const now = Date.now();
    const dueSchedules = await db.collectionGroup('scheduledReminders')
      .where('active', '==', true)
      .where('dueAt', '<=', now)
      .where('sentAt', '==', null)
      .limit(200)
      .get();

    for (const schedule of dueSchedules.docs) {
      try {
        if (await claimReminder(schedule.ref, now)) {
          await deliverReminder(schedule.ref, now);
        }
      } catch (error) {
        console.error('Could not process scheduled reminder:', schedule.ref.path, error);
      }
    }
  }
);
