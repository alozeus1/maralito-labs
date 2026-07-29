// Security response headers are defined here (not in middleware) so they apply to EVERY response —
// including static assets and routes the middleware matcher skips. See
// docs/production-readiness/rate-limiting-and-headers.md for the rationale and the rollout path.
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Stripe's documented CSP origins (js.stripe.com serves Stripe.js; hooks.stripe.com hosts 3DS
// challenge frames; m.stripe.network is the fraud-signal frame Stripe.js injects). Omitting any of
// these breaks Elements or 3D Secure, so they are allow-listed explicitly rather than by wildcard.
const STRIPE_SCRIPT = 'https://js.stripe.com';
const STRIPE_FRAMES = 'https://js.stripe.com https://hooks.stripe.com https://m.stripe.network';
const STRIPE_CONNECT = 'https://api.stripe.com https://m.stripe.network https://m.stripe.com';

// Supabase auth/PostgREST/Realtime are called directly from the browser. Pin the exact project
// origin when it is known at build time; only fall back to the wildcard when it is not.
function supabaseOrigins() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (raw) {
    try {
      const { origin, host } = new URL(raw);
      return { https: origin, wss: `wss://${host}` };
    } catch {
      /* malformed env → fall through to the wildcard */
    }
  }
  return { https: 'https://*.supabase.co', wss: 'wss://*.supabase.co' };
}

/**
 * Content-Security-Policy.
 *
 * ENFORCING by default. `script-src` still needs `'unsafe-inline'` because the App Router emits
 * inline bootstrap/flight scripts and `headers()` is static — it cannot mint a per-request nonce.
 * Even so this policy is a large net win: it pins every script/style/frame/connect origin, kills
 * `object`/`embed`, forbids framing outright, and locks `base-uri` + `form-action` (which is what
 * actually stops injected-markup credential exfiltration). Tightening to a nonce/`strict-dynamic`
 * policy requires generating the nonce in middleware — that is the documented next step, not a
 * reason to ship no CSP today.
 *
 * Set BORDERPASS_CSP_REPORT_ONLY='true' to emit the identical policy as
 * `Content-Security-Policy-Report-Only` — the safe way to validate a new directive on a preview
 * deploy before enforcing it.
 */
function contentSecurityPolicy() {
  const supabase = supabaseOrigins();
  const directives = [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `form-action 'self'`,
    // Defence in depth alongside X-Frame-Options (which older browsers honour instead).
    `frame-ancestors 'none'`,
    // `'unsafe-eval'` is dev-only (React Refresh / webpack eval source maps) and never shipped.
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''} ${STRIPE_SCRIPT}`,
    `script-src-elem 'self' 'unsafe-inline' ${STRIPE_SCRIPT}`,
    // Next/Tailwind inject inline <style> and style attributes; a nonce cannot cover attributes.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https://*.stripe.com ${supabase.https}`,
    `font-src 'self' data:`,
    // Supabase needs both the REST/auth origin and the Realtime websocket origin.
    `connect-src 'self' ${supabase.https} ${supabase.wss} ${STRIPE_CONNECT}${
      isDevelopment ? ' ws: http://localhost:*' : ''
    }`,
    `frame-src ${STRIPE_FRAMES}`,
    `child-src ${STRIPE_FRAMES}`,
    `media-src 'self' blob: ${supabase.https}`,
    `worker-src 'self' blob:`, // /sw.js offline fallback worker
    `manifest-src 'self'`,
  ];
  if (isProduction) directives.push('upgrade-insecure-requests');
  const reportUri = process.env.BORDERPASS_CSP_REPORT_URI;
  if (reportUri) directives.push(`report-uri ${reportUri}`);
  return directives.join('; ');
}

/**
 * Permissions-Policy.
 *
 * `camera=(self)` is DELIBERATE: admin staff attach package photos through
 * `<input type="file" capture="environment">` (StaffMessagePanel / DirectMessagePanel). The capture
 * attribute is not consistently exempt from the camera permission across mobile browsers, so denying
 * camera outright risks silently breaking document/photo upload. Microphone, geolocation and the
 * remaining sensor features are denied — nothing in the app uses them. `payment` is delegated to
 * Stripe so Apple Pay / Google Pay inside the Payment Element keeps working.
 */
const PERMISSIONS_POLICY = [
  'accelerometer=()',
  'ambient-light-sensor=()',
  'autoplay=()',
  'camera=(self)',
  'display-capture=()',
  'encrypted-media=()',
  'fullscreen=(self)',
  'geolocation=()',
  'gyroscope=()',
  'magnetometer=()',
  'microphone=()',
  'midi=()',
  'payment=(self "https://js.stripe.com")',
  'screen-wake-lock=()',
  'usb=()',
  'xr-spatial-tracking=()',
].join(', ');

function securityHeaders() {
  const cspHeader =
    process.env.BORDERPASS_CSP_REPORT_ONLY === 'true'
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy';
  const headers = [
    { key: cspHeader, value: contentSecurityPolicy() },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },
    { key: 'X-DNS-Prefetch-Control', value: 'off' },
    // Blocks cross-origin XS-Leaks while still allowing the popups Stripe opens for 3DS / wallets.
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  ];
  if (isProduction) {
    // 2 years + subdomains. `preload` is intentionally OMITTED: submitting to the preload list is
    // effectively irreversible for the whole apex domain and is an owner decision, not a default.
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains',
    });
  }
  return headers;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Phase 0: no rewrites/integrations. i18n + middleware wired in Phase 1/2.
  experimental: { typedRoutes: true },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders() }];
  },
};
export default nextConfig;
