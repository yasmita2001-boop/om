# Push notifications (Web Push)

Om LifeOS keeps everything on the device, so reminders can only fire while the
app is closed if a server knows about them. This setup mirrors **only** the
upcoming alarms (id, title, due time) and the browser push subscription to
Firestore, then a scheduled Cloud Function sends the notification.

Nothing else leaves the device.

## Pieces

| Layer | File | What it does |
|---|---|---|
| Service worker | `src/sw.ts` | Shows a notification for every `push` event and focuses the app on click. A push without a visible notification is dropped by browsers, so a fallback is always shown. |
| Client | `src/lib/pushNotifications.ts` | Requests permission, subscribes with the VAPID key, mirrors the subscription + upcoming alarms, and cleans up on disable. |
| Settings | `src/views/SettingsView.tsx` | Enabling the Notifications switch also registers the device for push. Disabling it unsubscribes and deletes the server copy. |
| App | `src/App.tsx` | Re-syncs the alarm list whenever reminders change. |
| Sender | `functions/src/index.ts` | `sendScheduledReminders`, every 5 minutes: sends whatever is due, removes delivered entries, drops dead subscriptions (404/410). |
| Rules | `firestore.rules` | Each signed-in user can read/write only `pushSubscriptions/{uid}`. Everything else is denied. |

## One-time setup

```bash
# 1. Generate the VAPID pair (writes .env.local and functions/.env, both git-ignored)
npm run push:keys

# 2. Install and build the function
cd functions
npm install
npm run build
cd ..

# 3. Sign in to Firebase and deploy
firebase login
firebase use <your-project-id>
firebase deploy --only functions,firestore:rules
```

The Firebase project ID is read from `firebase-applet-config.json`; add a
`.firebaserc` (or pass `--project`) so the CLI targets the right project.

## Enabling it in the app

1. Sign in with Google (the subscription is stored per user).
2. Settings → Notifications → switch on.
3. Accept the browser permission prompt.

Turning the switch off unsubscribes and removes the Firestore document.

## How a reminder becomes a notification

1. A reminder with an alarm enabled and a due time within 14 days is included in
   the client sync (max 50 entries).
2. The scheduled function wakes up every 5 minutes and sends anything due within
   `[now - 5 min, now + 2 min]`.
3. Delivered entries are removed from the document, so each alarm fires once.
4. If the browser reports the subscription as gone (404/410), the document is
   deleted; push resumes after the user opts in again.

## Notes and limits

- Quiet hours are enforced in-app by `alarmService`; the scheduled sender is
  deliberately unaware of them and only sends the alarms the user armed.
- The sender runs on Cloud Scheduler (Blaze plan required for scheduled
  functions). For a free alternative, point any cron runner at the same logic.
- Open tabs still handle alarms locally through `alarmService`; push covers the
  app-closed case only.
- Rotating VAPID keys invalidates existing subscriptions: run
  `npm run push:keys`, deploy, then toggle notifications off/on on each device.
- The service worker is registered by `vite-plugin-pwa`; push handlers live in
  `src/sw.ts` alongside the caching strategies.
