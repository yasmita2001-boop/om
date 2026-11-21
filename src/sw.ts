import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';

interface WaitableEvent {
  waitUntil(promise: Promise<unknown>): void;
}

type SWScope = typeof globalThis & {
  __WB_MANIFEST: Array<string | { url: string; revision?: string | null }>;
  skipWaiting(): void;
  clients: { claim(): Promise<void>; matchAll(): Promise<{ postMessage(msg: any): void }[]> };
  addEventListener(type: 'message', listener: (event: WaitableEvent & { data: any }) => void): void;
  addEventListener(type: 'activate', listener: (event: WaitableEvent) => void): void;
  addEventListener(type: 'sync', listener: (event: WaitableEvent & { tag: string }) => void): void;
};

const sw = globalThis as unknown as SWScope;

precacheAndRoute((self as unknown as SWScope).__WB_MANIFEST);
cleanupOutdatedCaches();

sw.addEventListener('message', (event: any) => {
  if (event.data?.type === 'SKIP_WAITING') sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(sw.clients.claim());
});

registerRoute(new NavigationRoute(
  new NetworkFirst({
    cacheName: 'om-navigation-cache',
    networkTimeoutSeconds: 3
  })
));

registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] })
    ]
  })
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] })
    ]
  })
);

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Om LifeOS — Offline</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;
  font-family:system-ui,sans-serif;background:#0B0F19;color:#e2e8f0;padding:1.5rem}
.card{max-width:26rem;text-align:center;border:1px solid #1e293b;border-radius:1.5rem;
  padding:2.5rem 2rem;background:#111827}
h1{font-size:1.25rem;font-weight:700;margin-bottom:.75rem}
p{font-size:.875rem;line-height:1.6;color:#94a3b8;margin-bottom:1.5rem}
button{border:none;border-radius:.75rem;padding:.625rem 1.5rem;font-size:.875rem;
  font-weight:600;cursor:pointer;background:#b88648;color:#fff}
button:hover{background:#a07438}
</style></head>
<body><div class="card">
<h1>You're offline</h1>
<p>Om LifeOS needs an internet connection for this page. Your saved data is safe — reconnect and try again.</p>
<button onclick="location.reload()">Retry</button>
</div></body></html>`;

sw.addEventListener('sync', (event) => {
  if (event.tag === 'om-drive-sync') {
    event.waitUntil(
      sw.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ type: 'TRIGGER_DRIVE_SYNC' }));
      })
    );
  }
});

setCatchHandler(async ({ request }) => {
  if (request.destination === 'document') {
    return new Response(OFFLINE_HTML, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
  return Response.error();
});
