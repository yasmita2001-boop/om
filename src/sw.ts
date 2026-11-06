import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';

interface WaitableEvent {
  waitUntil(promise: Promise<unknown>): void;
}

type ServiceWorkerScope = typeof globalThis & {
  __WB_MANIFEST: Array<string | { url: string; revision?: string | null }>;
  addEventListener(type: 'activate', listener: (event: WaitableEvent) => void): void;
};

const serviceWorker = globalThis as unknown as ServiceWorkerScope;

precacheAndRoute((self as unknown as ServiceWorkerScope).__WB_MANIFEST);
cleanupOutdatedCaches();
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

serviceWorker.addEventListener('activate', event => {
  event.waitUntil(caches.delete('om-theme-wallpapers'));
});
