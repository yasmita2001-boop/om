# Om LifeOS

Offline-first personal operating system (tasks, goals, routines, finance, health, notes). Workspace content stays in this browser unless you connect Google Drive; Google Drive is the only cloud backup/sync destination. Optional closed-app reminders send only schedule metadata and a push token to Firebase. Works on phones, tablets and desktops; installable as a PWA.

## Run
```bash
npm install
npm run dev            # http://localhost:3000
npm run build          # production build -> dist/ (PWA + code-splitting)
npm run build:single   # also writes dist/om-lifeos-complete.html (one file, opens offline anywhere)
npm run build:local-test # writes dist-local-test/om-lifeos-local-test.html, opening a local guest workspace without Google sign-in
npm run typecheck      # TypeScript check
```

Optional Google Drive backup uses Firebase Auth; edit `firebase-applet-config.json` for your own project and add your domain under Firebase -> Authentication -> Authorized domains.

### Closed-app reminders (optional)

The hosted PWA can deliver generic push notifications for reminders and focus alarms while it is closed on supported Windows and Android browsers. This requires Google sign-in, an internet connection around the scheduled time, notification permission, and the device's notification sounds enabled. Notification timing and sound are controlled by Firebase/FCM and Windows/Android settings; custom ringtones and a continuous alarm loop require Om to be open. Offline delivery at the exact scheduled time and delivery while the device is powered off are not possible with a PWA. The standalone single-file build does not support closed-app push.

When enabled in **Settings -> System & Appearance**, the app sends only due times, focus-alarm recurrence/time-zone scheduling metadata, and the device's FCM token to Firebase. Reminder titles and other workspace content stay local. Use a Firebase project with Google Authentication, Firestore, Firebase Cloud Messaging, Cloud Functions, and Cloud Scheduler enabled; scheduled Cloud Functions require a billing-enabled Firebase/Google Cloud plan. Deploy the included rules, index, and function:

```bash
npx firebase-tools login
npx firebase-tools use --add
npm install --prefix functions
npx firebase-tools deploy --only firestore:rules,firestore:indexes,functions
```

In Firebase Console -> Project settings -> Cloud Messaging, create a Web Push certificate key pair. Set its public key as `VITE_FIREBASE_VAPID_KEY` in `.env.local` for local builds and in the production build environment (for example, Vercel environment variables or GitHub Actions secrets/variables). Rebuild and deploy the PWA, sign in with Google, then enable background reminders on each Windows/Android device. Ensure the browser/PWA is allowed to send notifications and has not been force-stopped or battery-restricted.

If the Firebase project already contains Firestore data or custom rules, merge `firestore.rules` into the existing rules instead of replacing them wholesale.

The app starts in a separate local guest workspace that remains usable offline. Signing in opens a different workspace scoped to that Firebase/Google account ID; switching accounts never selects another account's workspace. Account workspaces are hidden again when the app goes offline or is reloaded, and require signing in again. Google Drive is the only cloud backup/sync destination; Drive sync and restore require an internet connection and a matching Google sign-in. Auto-Sync queues pending account-workspace changes locally and uploads them after the same account signs in again.

Workspace records are stored in this browser's IndexedDB and Google Drive backups are JSON files. Account-scoped app views prevent accidental cross-account display, but this is not client-side encryption: anyone with access to this browser profile/developer tools or a shared Drive backup can access its contents. Use device security and Google account protections; do not treat this as an encrypted vault.

Permanently deleting Recycle Bin data queues deletion of every matching Om-LifeOS backup file the app can access in the signed-in account's Drive (including trashed duplicates), which also removes those files' revisions, before creating a fresh clean backup. The current least-privilege `drive.file` authorization only covers files created or explicitly opened by this app. If Drive is offline or unavailable, the purge remains queued in that account workspace and is retried on its next successful sync; the app's database reset preserves that pending purge. Browser storage deletion is logical deletion, not a forensic secure erase; SSD wear-leveling and browser-managed storage prevent this PWA from guaranteeing physical erasure.

## Deploy
- **Vercel:** Import the project with the Vite framework preset, build command `npm run build`, and output directory `dist`.
- **GitHub Pages:** The workflow in `.github/workflows/deploy.yml` builds and deploys on pushes to `main`. In repository Settings -> Pages, select **GitHub Actions** as the build and deployment source. Relative asset and PWA paths support project-site subpaths.
