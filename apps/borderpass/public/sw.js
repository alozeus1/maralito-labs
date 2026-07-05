// BorderPass service worker (Phase 8A.6) — deliberately conservative.
// CACHES NOTHING: no API, no authenticated pages, no payment responses, no user data.
// Its only job is a graceful offline fallback for top-level navigations, so an installed
// PWA shows a branded "offline" note instead of the browser error page.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BorderPass — offline</title>
<style>body{font-family:system-ui,sans-serif;background:#fff8f6;color:#241915;margin:0;
display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
main{max-width:28rem;text-align:center}h1{color:#a33e06;font-size:1.5rem}</style></head>
<body><main><h1>BorderPass</h1><p>You appear to be offline. Reconnect and pull to refresh.</p>
</main></body></html>`;

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return; // never intercept API/asset/payment requests
  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(OFFLINE_HTML, {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }),
    ),
  );
});
