# Om LifeOS

Offline-first personal operating system (tasks, goals, routines, finance, health, notes). Workspace content stays in this browser unless you connect Google Drive; Google Drive is the cloud backup destination. Appearance preferences, including custom backgrounds, stay on each device. Works on phones, tablets and desktops.

## Run
```bash
npm install
npm run dev            # http://localhost:3000 (local machine only)
npm run dev -- --host 0.0.0.0 # optional LAN access; use only on a trusted network
npm run build          # production build -> dist/ (offline service worker + code-splitting)
npm run build:single   # also writes dist/om-lifeos-complete.html (one file, opens offline anywhere)
npm run build:local-test # writes dist-local-test/om-lifeos-local-test.html, opening a local guest workspace without Google sign-in
npm run typecheck      # TypeScript check
```

## Mobile Wi-Fi Keyboard (Windows)

Use your phone as a keyboard for the active Windows app over your local Wi-Fi:

1. Connect the PC and phone to the same trusted Wi-Fi network.
2. Double-click `start-wifi-keyboard.bat` (or run `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\wifi_keyboard.ps1` from the project folder). Running the batch file again safely stops the previous companion before restarting it with a fresh PIN.
3. On your phone, open the `http://...` address printed by the companion and enter the six-digit PIN shown in the PC terminal.
4. Focus the text field in the PC app where you want to type. On your phone, tap **Start typing**; text and the special keys go to the PC. The phone page shows a confirmation when Windows accepts input. Press `Ctrl+C` in the PC terminal to stop the companion.

The companion uses the Windows PowerShell and .NET runtime already included with Windows; no Python or extra package is needed. If Windows Firewall blocks access, allow PowerShell on private networks only. It does not use a cloud relay, but local traffic is unencrypted: use only a trusted private network and do not type sensitive passwords.

Private Cosmos is the default appearance for new workspaces. Sanctuary and the eye-comfort themes remain available. Previously saved Ocean, Forest, Sunset, or Midnight selections automatically fall back to Private Cosmos. Custom backgrounds remain local to each device.

Optional Google Drive backup uses Firebase Auth; edit `firebase-applet-config.json` for your own project and add your domain under Firebase -> Authentication -> Authorized domains.

Appearance preferences are stored locally on each device and are not included in Google Drive backups. Google Drive continues to sync and restore workspace data for the signed-in account; choose a background separately on each device.

The app starts in a separate local guest workspace that remains usable offline. Signing in opens a different workspace scoped to that Firebase/Google account ID; switching accounts never selects another account's workspace. Account workspaces are hidden again when the app goes offline or is reloaded, and require signing in again. Drive sync and restore require an internet connection and a matching Google sign-in. Auto-Sync queues pending account-workspace changes locally and uploads them after the same account signs in again.

Workspace records are stored in this browser's IndexedDB and Google Drive backups are JSON files. Account-scoped app views prevent accidental cross-account display, but this is not client-side encryption: anyone with access to this browser profile/developer tools or a shared Drive backup can access its contents. Use device security and Google account protections; do not treat this as an encrypted vault.

Permanently deleting Recycle Bin data queues deletion of every matching Om-LifeOS backup file the app can access in the signed-in account's Drive (including trashed duplicates), which also removes those files' revisions, before creating a fresh clean backup. The current least-privilege `drive.file` authorization only covers files created or explicitly opened by this app. If Drive is offline or unavailable, the purge remains queued in that account workspace and is retried on its next successful sync; the app's database reset preserves that pending purge. Browser storage deletion is logical deletion, not a forensic secure erase; SSD wear-leveling and browser-managed storage prevent this app from guaranteeing physical erasure.

## Deploy
- **Vercel:** Import the project with the Vite framework preset, build command `npm run build`, and output directory `dist`.
- **GitHub Pages:** The workflow in `.github/workflows/deploy.yml` builds and deploys on pushes to `main`. In repository Settings -> Pages, select **GitHub Actions** as the build and deployment source. Relative asset paths support project-site subpaths.
