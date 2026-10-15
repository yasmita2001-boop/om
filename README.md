# Om LifeOS

Offline-first personal operating system (tasks, goals, routines, finance, health, notes, Drive backup). Works on phones, tablets and desktops; installable as a PWA.

## Run
```bash
npm install
npm run dev            # http://localhost:3000
npm run build          # production build -> dist/ (PWA + code-splitting)
npm run build:single   # also writes dist/om-lifeos-complete.html (one file, opens offline anywhere)
npm run lint           # type-check
```

Google Drive backup uses Firebase Auth; edit `firebase-applet-config.json` for your own project and add your domain under Firebase -> Authentication -> Authorized domains.
