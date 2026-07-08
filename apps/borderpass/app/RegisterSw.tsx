'use client';
// Phase 8A.6: register the conservative service worker (offline navigation fallback only).
// Silent no-op where unsupported; never blocks rendering.
import { useEffect } from 'react';

export function RegisterSw() {
  useEffect(() => {
    // Register ONLY in production. A dev service worker intercepts Next's HMR/chunk
    // requests and breaks module loading; installability is verified on the deployed build.
    if (process.env.NODE_ENV !== 'production') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
