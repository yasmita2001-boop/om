# Om LifeOS

Offline-first personal operating system (tasks, goals, routines, finance, health, notes). Workspace content stays in this browser unless you connect Google Drive; Google Drive is the cloud backup destination. Appearance preferences, including custom backgrounds, stay on each device. Works on phones, tablets and desktops; installable as a PWA.

## Run
```bash
npm install
npm run dev            # http://localhost:3000
npm run build          # production build -> dist/ (PWA + code-splitting)
npm run build:single   # also writes dist/om-lifeos-complete.html (one file, opens offline anywhere)
npm run build:local-test # writes dist-local-test/om-lifeos-local-test.html, opening a local guest workspace without Google sign-in
npm run typecheck      # TypeScript check
```

Private Cosmos is the default appearance for new workspaces. Sanctuary remains available as a coordinated theme. Its original, locally bundled environment illustration remains available if WebGL is unavailable; the Three.js scene is lazy-loaded and can be disabled from **Actions**. Reduced-motion preferences disable scene animation.

Optional Google Drive backup uses Firebase Auth; edit `firebase-applet-config.json` for your own project and add your domain under Firebase -> Authentication -> Authorized domains.

Appearance preferences are stored locally on each device and are not included in Google Drive backups. Google Drive continues to sync and restore workspace data for the signed-in account; choose a background separately on each device.

The app starts in a separate local guest workspace that remains usable offline. Signing in opens a different workspace scoped to that Firebase/Google account ID; switching accounts never selects another account's workspace. Account workspaces are hidden again when the app goes offline or is reloaded, and require signing in again. Drive sync and restore require an internet connection and a matching Google sign-in. Auto-Sync queues pending account-workspace changes locally and uploads them after the same account signs in again.

Workspace records are stored in this browser's IndexedDB and Google Drive backups are JSON files. Account-scoped app views prevent accidental cross-account display, but this is not client-side encryption: anyone with access to this browser profile/developer tools or a shared Drive backup can access its contents. Use device security and Google account protections; do not treat this as an encrypted vault.

Permanently deleting Recycle Bin data queues deletion of every matching Om-LifeOS backup file the app can access in the signed-in account's Drive (including trashed duplicates), which also removes those files' revisions, before creating a fresh clean backup. The current least-privilege `drive.file` authorization only covers files created or explicitly opened by this app. If Drive is offline or unavailable, the purge remains queued in that account workspace and is retried on its next successful sync; the app's database reset preserves that pending purge. Browser storage deletion is logical deletion, not a forensic secure erase; SSD wear-leveling and browser-managed storage prevent this PWA from guaranteeing physical erasure.

## Deploy
- **Vercel:** Import the project with the Vite framework preset, build command `npm run build`, and output directory `dist`.
- **GitHub Pages:** The workflow in `.github/workflows/deploy.yml` builds and deploys on pushes to `main`. In repository Settings -> Pages, select **GitHub Actions** as the build and deployment source. Relative asset and PWA paths support project-site subpaths.
