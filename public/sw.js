/**
 * Om-LifeOS Optimized Core Service Worker
 * Cache Version: lifeos-core-v2
 * Lightweight, offline-ready app shell caching strategy
 */

const CACHE_NAME = 'lifeos-core-v2';

// 1. Strictly essential app shell assets ONLY.
// Heavy audio assets, media files, vendor archives, and raw dumps are completely excluded.
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.ico',
  './icon.svg'
];

// Patterns for assets that should NEVER be stored in Cache Storage
const EXCLUDED_PATTERNS = [
  /\/api\//i,
  /\/push/i,
  /\/pull/i,
  /\/status/i,
  /\/register/i,
  /\/peerjs/i,
  /\.(mp3|wav|ogg|aac|flac|m4a)$/i, // Audio chimes, voice recordings, sound effects
  /\.(mp4|webm|mov|avi|mkv)$/i,     // Video assets
  /\.(zip|tar|gz|omlifeos|omupdate)$/i, // Backup archives and export packages
  /\.(pdf|docx|xlsx)$/i             // Document exports
];

// Maximum allowed single response size to cache: 2MB (prevents heavy chunks / blobs)
const MAX_CACHE_SIZE_BYTES = 2 * 1024 * 1024;

/**
 * Install Event: Pre-cache core app shell assets and skip waiting immediately
 */
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Core app shell precache notice:', err);
      });
    })
  );
});

/**
 * Activate Event: Active cleanup to purge all stale caches (om-lifeos-v4.1, legacy workbox, etc.)
 * Claims clients immediately so modern caching takes effect on first launch.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cache) => {
            if (cache !== CACHE_NAME) {
              console.log('[SW] Purging outdated / bloated cache:', cache);
              return caches.delete(cache);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

/**
 * Helper: Check if request is eligible for caching
 */
function isCacheable(request, url) {
  // Only GET requests
  if (request.method !== 'GET') return false;

  // Only HTTP/HTTPS
  if (!url.protocol.startsWith('http')) return false;

  // Reject dev server endpoints, browser extensions, and APIs
  if (EXCLUDED_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    return false;
  }

  // Only allow app shell assets: scripts, stylesheets, core icons, webmanifest, navigation
  const isAppShell =
    request.mode === 'navigate' ||
    /\.(js|css|svg|ico|webmanifest|woff2)$/i.test(url.pathname) ||
    url.pathname.includes('/assets/');

  return isAppShell;
}

/**
 * Fetch Event:
 * - HTML Navigation: Stale-While-Revalidate with fallback to precached index.html
 * - Essential JS/CSS/Fonts: Stale-While-Revalidate (immediate cache return, background refresh)
 * - Excluded/Heavy Media: Direct network fetch, NEVER saved to Cache Storage
 */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip all non-cacheable routes (APIs, media, backups, audio)
  if (!isCacheable(event.request, url)) {
    return;
  }

  // Navigation mode (HTML pages)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((cached) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', clone));
            }
            return networkResponse;
          })
          .catch(() => cached || caches.match('./index.html') || caches.match('/'));

        return cached || fetchPromise;
      })
    );
    return;
  }

  // Static App Shell assets (CSS, JS, Fonts)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Background revalidation promise
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            // Guard against large responses (>2MB) to prevent Cache Storage bloat
            const contentLength = networkResponse.headers.get('content-length');
            if (!contentLength || parseInt(contentLength, 10) <= MAX_CACHE_SIZE_BYTES) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and request is missing, return cached if exists
          return cachedResponse;
        });

      // Stale-While-Revalidate: Return cached immediately if found, otherwise await network
      return cachedResponse || fetchPromise;
    })
  );
});
