import { useEffect, useRef } from 'react';

const STORAGE_KEY_TIMEOUT = 'om_auto_lock_minutes';
const DEFAULT_TIMEOUT_MINUTES = 15;

function getTimeoutMs(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_TIMEOUT);
    if (stored) {
      const mins = Number(stored);
      if (Number.isFinite(mins) && mins >= 1 && mins <= 120) return mins * 60_000;
    }
  } catch {}
  return DEFAULT_TIMEOUT_MINUTES * 60_000;
}

function hasLockCredential(): boolean {
  try {
    return localStorage.getItem('om_lock_pin_hash') !== null;
  } catch {
    return false;
  }
}

export function getAutoLockMinutes(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_TIMEOUT);
    if (stored) {
      const mins = Number(stored);
      if (Number.isFinite(mins) && mins >= 1 && mins <= 120) return mins;
    }
  } catch {}
  return DEFAULT_TIMEOUT_MINUTES;
}

export function setAutoLockMinutes(minutes: number): void {
  const clamped = Math.max(1, Math.min(120, Math.round(minutes)));
  try {
    localStorage.setItem(STORAGE_KEY_TIMEOUT, String(clamped));
  } catch {}
}

export function useAutoLock(onLock: () => void, enabled: boolean) {
  const onLockRef = useRef(onLock);
  onLockRef.current = onLock;

  useEffect(() => {
    if (!enabled) return;
    if (!hasLockCredential()) return;

    const timeoutMs = getTimeoutMs();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        onLockRef.current();
      }, timeoutMs);
    };

    const events: Array<keyof DocumentEventMap> = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    const handler = () => resetTimer();

    events.forEach(evt => document.addEventListener(evt, handler, { passive: true }));
    resetTimer();

    return () => {
      if (timer) clearTimeout(timer);
      events.forEach(evt => document.removeEventListener(evt, handler));
    };
  }, [enabled]);
}
