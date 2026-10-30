import { lazy, type ComponentType } from 'react';

const RELOAD_FLAG = 'om_chunk_reload';

/**
 * React.lazy wrapper that survives a stale cache after a new deployment.
 * If a code-split chunk fails to load (old service worker / old cached HTML
 * pointing at deleted files), the page reloads ONCE to fetch fresh assets
 * instead of leaving the user on a broken screen. The flag lives in
 * sessionStorage and is guarded, so private-mode browsers can never loop.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      try { sessionStorage.removeItem(RELOAD_FLAG); } catch {}
      return mod;
    } catch (err) {
      let alreadyRetried = true;
      try {
        alreadyRetried = sessionStorage.getItem(RELOAD_FLAG) === '1';
        if (!alreadyRetried) sessionStorage.setItem(RELOAD_FLAG, '1');
      } catch {
        alreadyRetried = true;
      }
      if (!alreadyRetried && typeof window !== 'undefined') {
        window.location.reload();
        return new Promise<never>(() => {});
      }
      throw err;
    }
  });
}
