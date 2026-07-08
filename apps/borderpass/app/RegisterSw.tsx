'use client';
// Phase 8A.6: register the conservative service worker (offline navigation fallback only).
// Silent no-op where unsupported; never blocks rendering.
import { useEffect } from 'react';

export function RegisterSw() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // In development, a service worker intercepts Next's HMR/chunk requests and breaks module
    // loading. Do NOT register — and actively unregister any worker left behind by a previously
    // visited dev/production build so developers self-heal without manually clearing site data.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
      if (window.caches) {
        caches
          .keys()
          .then((keys) => keys.forEach((k) => caches.delete(k)))
          .catch(() => {});
      }
      return;
    }
    // Production: register the conservative offline-fallback worker. Installability is verified
    // on the deployed build.
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
