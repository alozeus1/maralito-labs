'use client';
// Phase 8A.6: register the conservative service worker (offline navigation fallback only).
// Silent no-op where unsupported; never blocks rendering.
import { useEffect } from 'react';

export function RegisterSw() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
