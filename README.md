# Om-LifeOS — Executive Personal Operating System

An Executive Personal Operating System featuring unified project timelines, routines & habit architecture, finance ledger, health metrics, sovereign local storage, and real-time **Google Drive Cloud Sync & Google Sign-In**.

---

## 🚀 Features

- **PWA Ready**: 1-Click installable as a native app on **Windows**, **Android**, and **iOS** with offline support.
- **Google Drive Cloud Sync**: Sovereign backup and restore with Google Drive using least-privilege OAuth scopes (`drive.file`).
- **Recycle Bin & Permanent Deletion**: Safe soft-delete with permanent purge protection — permanently deleted items are removed from Google Drive backups immediately and blocked from resurrecting.
- **Local Sovereignty**: All data runs client-side with IndexedDB, zero tracking, and local folder connection.
- **Responsive Executive UI**: Clean desktop, tablet, and mobile interface with dark/light themes.

---

## 🛠️ Deploy to Vercel (Instant 1-Click)

1. Push this repository to **GitHub**.
2. Go to [Vercel](https://vercel.com) and click **"Add New Project"**.
3. Import your GitHub repository.
4. Framework Preset: **Vite**
5. Build Command: `npm run build`
6. Output Directory: `dist`
7. Click **Deploy**!

> `vercel.json` is pre-configured with SPA route rewrites and security headers.

---

## 💻 Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Build for production (generates PWA service worker & manifest)
npm run build
```

---

## 📱 PWA Installation

- **Windows**: Click the **"Install App"** button in the header, or click the install icon in the Edge/Chrome URL bar.
- **Android**: Open in Chrome and tap **"Install App"** or select **"Add to Home screen"**.
- **iOS (iPhone/iPad)**: Open in Safari, tap the **Share** button, and select **"Add to Home Screen"**.

---

## 📄 License

MIT
