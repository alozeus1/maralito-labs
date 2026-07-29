import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { resolveRateLimitPolicy, enforceRateLimit } from '@/server/rate-limit';

// Public paths (no session required). Route groups don't appear in the URL, so we gate by path.
const PUBLIC_PREFIXES = [
  '/welcome',
  '/about',
  '/login',
  '/sign-up',
  '/auth',
  '/unauthorized',
  '/api/health',
  // External webhooks: unauthenticated by nature (no session cookie), authenticated instead by their
  // own signature verification (fail-closed) inside the route. Must bypass the auth redirect gate.
  '/api/stripe/webhook',
  '/api/webhooks/resend',
  // Automation (n8n) endpoints: same reasoning — no session cookie. Every route under this prefix
  // MUST fail closed on the `x-borderpass-secret` shared secret (constant-time `secretOk` vs
  // N8N_WEBHOOK_SECRET) before doing any work. Without this bypass the auth gate 302s them to
  // /login and the workflow silently "succeeds" against an HTML page instead of the API.
  '/api/automation',
];
const isPublic = (p: string) => PUBLIC_PREFIXES.some((x) => p === x || p.startsWith(x + '/'));

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // ---- Rate limiting (Phase 9) --------------------------------------------------------------
  // Runs FIRST — before the Supabase session lookup — so abusive traffic can't drive auth calls or
  // DB work. Only paths with a matching policy are limited (OTP/login, auth callback, order create,
  // quote actions, payment initiation, automation APIs, Stripe webhook); everything else is
  // untouched. Denials return JSON 429 + Retry-After, never an HTML page.
  // FAIL CLOSED: in production with no durable store configured, limited routes are denied by
  // design (see docs/production-readiness/rate-limiting-and-headers.md — provision the store).
  const rlPolicy = resolveRateLimitPolicy(req.nextUrl.pathname, req.method);
  if (rlPolicy) {
    const denied = await enforceRateLimit(req, rlPolicy);
    if (denied) return denied;
  }

  // Dev-only tooling under /api/dev/* is never served in production (each route 404s there), so it
  // doesn't need a session in local/dev. Bypass the auth gate for it outside production only.
  if (process.env.NODE_ENV !== 'production' && req.nextUrl.pathname.startsWith('/api/dev/')) {
    return res;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return res; // env not wired yet (Phase 1 sandbox) → pass through

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => req.cookies.getAll().map((c) => ({ name: c.name, value: c.value })),
      setAll: (cs: { name: string; value: string; options: CookieOptions }[]) =>
        cs.forEach((c) => res.cookies.set({ name: c.name, value: c.value, ...c.options })),
    },
  });
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const path = req.nextUrl.pathname;

  // Logged-in users shouldn't sit on auth screens.
  if (user && (path === '/login' || path === '/sign-up')) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  // Unauthenticated users can't reach protected (customer/admin) paths.
  if (!user && !isPublic(path)) {
    const to = new URL('/login', req.url);
    to.searchParams.set('next', path);
    return NextResponse.redirect(to);
  }
  // Fine-grained role checks (admin vs customer) happen in server layouts (Node runtime + DB).
  return res;
}

export const config = {
  // Run on everything except Next internals + static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
