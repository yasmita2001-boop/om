import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import firebaseConfig from '../firebase-applet-config.json';

interface VisibleWindowClient {
  visibilityState: DocumentVisibilityState;
  focus(): Promise<VisibleWindowClient>;
  navigate(url: string): Promise<VisibleWindowClient | null>;
}

interface WaitableEvent {
  waitUntil(promise: Promise<unknown>): void;
}

interface NotificationClickEvent extends WaitableEvent {
  notification: Notification;
}

type PushServiceWorkerScope = typeof globalThis & {
  __WB_MANIFEST: Array<string | { url: string; revision?: string | null }>;
  registration: ServiceWorkerRegistration;
  clients: {
    claim(): Promise<void>;
    matchAll(options: { type: 'window'; includeUncontrolled: boolean }): Promise<VisibleWindowClient[]>;
    openWindow(url: string): Promise<VisibleWindowClient | null>;
  };
  addEventListener(type: 'activate', listener: (event: WaitableEvent) => void): void;
  addEventListener(type: 'notificationclick', listener: (event: NotificationClickEvent) => void): void;
};

const serviceWorker = globalThis as unknown as PushServiceWorkerScope;

precacheAndRoute((self as unknown as PushServiceWorkerScope).__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

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

const messaging = getMessaging(initializeApp(firebaseConfig));
onBackgroundMessage(messaging, async payload => {
  const openWindows = await serviceWorker.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (openWindows.some(client => client.visibilityState === 'visible')) return;

  const notificationId = payload.data?.notificationId || 'om-background-reminder';
  await serviceWorker.registration.showNotification('Om reminder', {
    body: payload.data?.body || 'A reminder is due. Open Om to view it.',
    icon: new URL('pwa-192x192.png', serviceWorker.registration.scope).href,
    badge: new URL('favicon.ico', serviceWorker.registration.scope).href,
    tag: notificationId,
    data: { url: new URL('./', serviceWorker.registration.scope).href }
  });
});

serviceWorker.addEventListener('activate', event => {
  event.waitUntil(serviceWorker.clients.claim());
});

serviceWorker.addEventListener('notificationclick', event => {
  const notificationEvent = event as NotificationClickEvent;
  notificationEvent.notification.close();
  const targetUrl = new URL('./', serviceWorker.registration.scope).href;
  notificationEvent.waitUntil(
    serviceWorker.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
      const existing = clients.find(client => 'focus' in client);
      if (existing) {
        await existing.navigate(targetUrl);
        await existing.focus();
      } else {
        await serviceWorker.clients.openWindow(targetUrl);
      }
    })
  );
});
