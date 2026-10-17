# Om LifeOS

Offline-first personal operating system (tasks, goals, routines, finance, health, notes, Drive backup). Works on phones, tablets and desktops; installable as a PWA.

## Run
```bash
npm install
npm run dev            # http://localhost:3000
npm run build          # production build -> dist/ (PWA + code-splitting)
npm run build:single   # also writes dist/om-lifeos-complete.html (one file, opens offline anywhere)
npm run typecheck      # TypeScript check
```

Google sign-in lock and Google Drive backup use Firebase Auth; edit `firebase-applet-config.json` for your own project and add your domain under Firebase -> Authentication -> Authorized domains.

The app asks you to verify with Google whenever it is opened. Google controls whether it asks for the password again; online access is required to unlock.

## Deploy
- **Vercel:** Import the project with the Vite framework preset, build command `npm run build`, and output directory `dist`.
- **GitHub Pages:** The workflow in `.github/workflows/deploy.yml` builds and deploys on pushes to `main`. In repository Settings -> Pages, select **GitHub Actions** as the build and deployment source. Relative asset and PWA paths support project-site subpaths.
