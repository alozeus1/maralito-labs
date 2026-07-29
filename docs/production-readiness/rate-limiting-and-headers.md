# Production Readiness — Rate Limiting & Security Headers

> Status: **code shipped, unverified against a live deployment.** Everything below was written and
> unit-verified in the dev sandbox. `pnpm test`, `pnpm build` and a real HTTP response-header check
> are OPERATOR actions and are not yet run. Do not mark any live gate passed on the strength of this
> document.

Owned files:

| File | Purpose |
| --- | --- |
| `apps/borderpass/src/server/rate-limit.ts` | Provider-abstracted, fail-closed rate limiter |
| `apps/borderpass/src/server/rate-limit.test.ts` | Unit suite (Vitest) |
| `apps/borderpass/next.config.mjs` | `headers()` — CSP + transport/framing/permissions headers |
| `apps/borderpass/src/server/env.ts` | New optional env vars (schema + comments only) |

`apps/borderpass/middleware.ts` is **not** owned here. The limiter exports a clean, edge-safe API for
the coordinator to call; see "Wiring" below.

---

## 1. Rate limiting

### 1.1 Design

A two-line abstraction, deliberately small:

```ts
interface RateLimitStore {
  readonly name: 'memory' | 'upstash';
  readonly durable: boolean;                       // false for memory — it is per-instance
  incr(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
}
```

Two implementations:

- **memory** — a bounded `Map` fixed-window counter. **Local/preview only.** Serverless and edge
  instances each have their own heap, so a memory counter in production is not a limit; it is the
  *appearance* of one.
- **upstash** — Upstash Redis over its REST API using `fetch`. **No new npm dependency was added**
  (dependencies cannot be installed in this environment, and the REST surface is small enough that
  an SDK would be pure overhead). One round trip per check via the pipeline endpoint:

  ```
  INCR key              -> hit count for the current window
  PEXPIRE key <ms> NX   -> set the TTL only on the first hit, so the window does not slide
  PTTL  key             -> remaining ms, used for resetAt / Retry-After
  ```

  A 2 s `AbortSignal.timeout` bounds the added latency. Non-2xx, malformed body, or transport
  failure all throw, and the caller fails closed.

Runtime constraint: the module uses **Web Crypto and `fetch` only** — no `node:crypto` — so it is
importable from `middleware.ts` (edge runtime) as well as from Node route handlers and server
actions.

### 1.2 Fail-closed behaviour (the important part)

```
requiresDurableStore():
  BORDERPASS_ENV = production | staging      -> durable store REQUIRED
  BORDERPASS_ENV = local | preview           -> in-memory acceptable
  BORDERPASS_ENV unset                       -> fall back to NODE_ENV === 'production'
```

When a durable store is required and `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are
absent, `resolveRateLimitStore()` returns `null` and **every** `checkRateLimit` call returns a denial
with `reason: 'no_durable_store'`. The very first request is 429'd — there is no grace period and no
silent degrade to memory.

The `BORDERPASS_ENV`-unset fallback to `NODE_ENV` exists specifically so a production deploy that
*forgot* to set `BORDERPASS_ENV` still fails closed rather than open.

A durable-store **outage** is treated the same way (`reason: 'store_error'`). This is a deliberate
availability trade-off: an Upstash outage degrades BorderPass to 429s on the limited routes rather
than removing the limit. Operators must monitor for the `rate_limited` log event with
`reason: 'store_error'` — a sustained burst of those means Upstash, not an attacker. There is
intentionally **no break-glass env var to disable the limiter**; a switch that turns off a security
control is a switch that gets left on.

### 1.3 Named policies

| Key | `name` | Limit | Window | Notes |
| --- | --- | ---: | --- | --- |
| `otpLogin` | `otp_login` | 5 | 15 min | Tightest — each hit costs an outbound email |
| `authCallback` | `auth_callback` | 20 | 5 min | Token exchange; guards code guessing |
| `orderCreate` | `order_create` | 10 | 60 min | Generous for a human, hostile to a script |
| `quoteAction` | `quote_action` | 30 | 10 min | Accept / decline / re-quote |
| `paymentInitiate` | `payment_initiate` | 10 | 10 min | Caps card-testing attempts per client |
| `automationApi` | `automation_api` | 120 | 1 min | Bounds the blast radius of a leaked n8n secret |
| `stripeWebhook` | `stripe_webhook` | 600 | 1 min | High ceiling — Stripe legitimately bursts on retries |

Windows are **fixed**, not sliding. A caller can burst across a window boundary; that is the accepted
cost of one atomic `INCR` per request.

Rate limiting is layered *on top of* the existing controls, never instead of them: automation routes
still fail closed on `secretOk` (`x-borderpass-secret`), and the Stripe webhook still fails closed on
signature verification. Limiting the webhook does **not** replace signature verification, and the
ceiling is set high enough that Stripe's own retry behaviour cannot trip it.

### 1.4 Key derivation and privacy

Key shape: `rl:<prefix>:<policy>:<ipHash>[:u<userHash>]`

- Client IP = **first hop of `x-forwarded-for`**, falling back to `x-real-ip` / `cf-connecting-ip` /
  `x-vercel-forwarded-for`. Absent → the shared `noip` bucket (still limited).
- The IP is **SHA-256 hashed and truncated to 16 hex chars** before it touches Redis or a log line.
  The raw IP is never stored, never logged, and never returned in a response body.
- The hash input is `<salt>:<policy>:<value>`. The policy namespace stops one IP producing the same
  token across policies; `BORDERPASS_RATE_LIMIT_SALT` stops the 2^32 IPv4 space being reversed by
  brute force. **Set the salt in production** — without it, a hash of an IPv4 address is not
  meaningfully anonymous.
- The optional user id is hashed the same way.
- The denial log line is `{"event":"rate_limited","policy","reason","store","key_suffix","retry_after_s"}` —
  policy metadata plus a hash tail, nothing identifying. Allowed requests are not logged (no spam).

### 1.5 Responses

Every denial is **JSON, never an HTML page** — an n8n workflow or API client must never receive HTML
it would treat as success:

```
HTTP/1.1 429 Too Many Requests
Content-Type: application/json; charset=utf-8
Cache-Control: no-store
Retry-After: 42
RateLimit-Limit: 5
RateLimit-Remaining: 0
RateLimit-Reset: 42

{"error":"rate_limited","policy":"otp_login","retry_after_seconds":42,"limit":5}
```

### 1.6 Wiring (coordinator — `middleware.ts`)

Exact signatures:

```ts
import {
  resolveRateLimitPolicy,   // (pathname: string, method: string) => RateLimitPolicy | null
  enforceRateLimit,         // (req, policy, opts?) => Promise<Response | null>
  rateLimitRequest,         // (req, policy, opts?) => Promise<RateLimitDecision>
  rateLimitHeaders,         // (decision: RateLimitDecision) => Record<string, string>
  rateLimitResponse,        // (decision: RateLimitDecision) => Response
  RATE_LIMIT_POLICIES,
} from '@/server/rate-limit';
```

Minimal integration — run it **before** the Supabase session lookup so an attacker cannot burn auth
round trips:

```ts
const policy = resolveRateLimitPolicy(req.nextUrl.pathname, req.method);
if (policy) {
  const limited = await enforceRateLimit(req, policy, { userId: undefined });
  if (limited) return limited; // JSON 429, already carries Retry-After
}
```

`opts.userId` is typed `string | undefined` on purpose (the repo runs
`exactOptionalPropertyTypes: true`), so a possibly-undefined `user?.id` can be passed directly. Pass
it once the session is known if you want per-user rather than per-IP buckets on authenticated routes.

Route mapping is first-match-wins and lives in `ROUTE_RULES` inside `rate-limit.ts`. Only expensive
verbs are limited; ordinary page `GET`s are not. Note `/login` and `/sign-up` are limited on **POST**
because Next server actions post back to the page URL.

**Known gap:** the passwordless OTP request in `app/(auth)/login/page.tsx` and
`app/(auth)/sign-up/page.tsx` calls `supabase.auth.signInWithOtp` **directly from the browser** — that
request never reaches our middleware, so the `otp_login` policy cannot see it. Until that call is
moved behind a server action or route handler, OTP abuse is bounded only by Supabase's own auth rate
limits (configurable in the Supabase dashboard → Authentication → Rate Limits). This is a follow-up,
not something the limiter can fix from here.

---

## 2. Security headers

Defined in `next.config.mjs` `headers()` (source `/:path*`) rather than in middleware, so they apply
to every response including static assets and paths the middleware matcher skips.

### 2.1 Shipped headers

| Header | Value | Scope |
| --- | --- | --- |
| `Content-Security-Policy` | see below | all |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | **production only** |
| `X-Content-Type-Options` | `nosniff` | all |
| `X-Frame-Options` | `DENY` | all |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | all |
| `Permissions-Policy` | see 2.3 | all |
| `X-DNS-Prefetch-Control` | `off` | all |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` | all |
| `Cross-Origin-Resource-Policy` | `same-origin` | all |

`preload` is deliberately **omitted** from HSTS: submitting the apex domain to the preload list is
effectively irreversible and is an owner decision, not a framework default.

`COOP: same-origin-allow-popups` (not plain `same-origin`) is chosen so Stripe's 3D Secure and wallet
popups keep working. `COEP` is deliberately **not** set — it would break the cross-origin Stripe
iframes.

### 2.2 The CSP — enforcing, and why

Production policy:

```
default-src 'self';
base-uri 'self';
object-src 'none';
form-action 'self';
frame-ancestors 'none';
script-src 'self' 'unsafe-inline' https://js.stripe.com;
script-src-elem 'self' 'unsafe-inline' https://js.stripe.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://*.stripe.com <SUPABASE_ORIGIN>;
font-src 'self' data:;
connect-src 'self' <SUPABASE_ORIGIN> wss://<SUPABASE_HOST>
            https://api.stripe.com https://m.stripe.network https://m.stripe.com;
frame-src https://js.stripe.com https://hooks.stripe.com https://m.stripe.network;
child-src <same as frame-src>;
media-src 'self' blob: <SUPABASE_ORIGIN>;
worker-src 'self' blob:;
manifest-src 'self';
upgrade-insecure-requests
```

**Shipped enforcing, not report-only.** Justification: the only concession is `'unsafe-inline'` on
`script-src`, which the App Router requires because it emits inline bootstrap/flight scripts and a
static `headers()` block cannot mint a per-request nonce. Everything else is strict, and the strict
parts are what actually stop the realistic attacks here — `frame-ancestors 'none'` (clickjacking on
the payment page), `form-action 'self'` and `base-uri 'self'` (credential exfiltration via injected
markup), `object-src 'none'`, and a pinned allow-list for every script/frame/connect origin. Shipping
nothing while waiting for a nonce implementation would be strictly worse.

**Rollout / rollback path.** `BORDERPASS_CSP_REPORT_ONLY=true` emits the identical policy as
`Content-Security-Policy-Report-Only`, and `BORDERPASS_CSP_REPORT_URI` appends a `report-uri`. Use
these on a preview deploy to validate any tightening (or to diagnose a suspected CSP break in
production without a code change).

**Next tightening step (requires middleware — coordinator):** generate a per-request nonce in
`middleware.ts`, set it on the request headers, and move `script-src` to
`'self' 'nonce-<value>' 'strict-dynamic'`. That drops `'unsafe-inline'` entirely. It cannot be done
from `next.config.mjs` alone.

Stripe origins allowed, and why each is required:

| Origin | Directive | Why |
| --- | --- | --- |
| `https://js.stripe.com` | `script-src`, `frame-src` | Stripe.js + the Element iframes |
| `https://hooks.stripe.com` | `frame-src` | 3D Secure challenge frame |
| `https://m.stripe.network` | `frame-src`, `connect-src` | Stripe's fraud-signal frame |
| `https://api.stripe.com`, `https://m.stripe.com` | `connect-src` | Stripe.js XHR |
| `https://*.stripe.com` | `img-src` | Card-brand and wallet artwork |

Supabase: the exact project origin is taken from `NEXT_PUBLIC_SUPABASE_URL` **at build time** (both
`https://` for auth/PostgREST/Storage and `wss://` for Realtime). If that env var is missing or
malformed at build time the policy falls back to `https://*.supabase.co wss://*.supabase.co` — which
still works but is broader than it should be. **Ensure `NEXT_PUBLIC_SUPABASE_URL` is present in the
production build environment** so the tight origin is pinned.

In development the policy additionally allows `'unsafe-eval'` (React Refresh / webpack eval source
maps), `ws:` and `http://localhost:*`; none of that ships to production, and
`upgrade-insecure-requests` is production-only.

### 2.3 Permissions-Policy — the camera decision

```
accelerometer=(), ambient-light-sensor=(), autoplay=(), camera=(self), display-capture=(),
encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(),
microphone=(), midi=(), payment=(self "https://js.stripe.com"), screen-wake-lock=(), usb=(),
xr-spatial-tracking=()
```

`camera=(self)` is **deliberate, not an oversight.** The repo was checked for camera usage before
choosing this value:

- `app/(admin)/admin/orders/[orderId]/quote/StaffMessagePanel.tsx:112` — `capture="environment"`
- `app/(admin)/admin/customers/[customerId]/DirectMessagePanel.tsx:112` — `capture="environment"`

Both are `<input type="file" capture="environment">` (staff photographing a package), not
`getUserMedia`. Browsers are inconsistent about whether the `capture` attribute is gated by the
`camera` permission, so `camera=()` risks silently breaking package-photo upload on mobile. It is
scoped to `(self)` — the Stripe iframes are cross-origin and are therefore **not** granted camera.
Microphone, geolocation, display-capture and every sensor feature are denied outright; nothing in the
app uses them.

`payment` is delegated to `https://js.stripe.com` so Apple Pay / Google Pay inside the Payment
Element continues to work.

---

## 3. Verification actually performed

Run in the dev sandbox (`pnpm`/`vitest`/`next` cannot execute here — macOS `node_modules` on a Linux
sandbox). The module was transpiled with `esbuild` and asserted with Node 22, and `next.config.mjs`
was imported directly and its emitted headers asserted.

- **25 / 25** Node assertions passed against the bundled `rate-limit.ts`, including:
  `production + no durable store ⇒ DENY` (via `BORDERPASS_ENV` and via `NODE_ENV`);
  `dev + no store ⇒ allow via memory`; allow under threshold; block over threshold; window reset;
  independent keys; store outage ⇒ deny; raw IP absent from the key, from the Redis key that reached
  the (faked) store, from the 429 body and from the denial log; salt/policy-scoped hashing; JSON 429
  with `Retry-After`; Upstash pipeline shape + auth header + `PTTL` parsing + 401 handling; route
  mapping; all 7 policies present.
- `next.config.mjs` header assertions passed: production CSP contains the Stripe and Supabase
  origins, `frame-ancestors 'none'` exactly once, and no `'unsafe-eval'`; HSTS is production-only;
  `BORDERPASS_CSP_REPORT_ONLY=true` swaps to the report-only header and adds `report-uri`;
  `reactStrictMode` and `experimental.typedRoutes` are preserved.
- `tsc --noEmit` with the repo's strict flags (`strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, …) is clean for `rate-limit.ts`,
  `rate-limit.test.ts` and `env.ts`.

**Not verified (operator):** `pnpm test` / `pnpm typecheck` / `pnpm build` on the real toolchain; a
live Upstash round trip; real response headers from a deployed build; Stripe Elements and 3DS
rendering under the enforcing CSP.

---

## 4. Operator actions required

1. **Provision Upstash Redis** (free tier is sufficient) and set, per environment, as server-side
   secrets — never `NEXT_PUBLIC_`, never committed:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   Until these exist, **production and staging will 429 every rate-limited route.** That is the
   designed behaviour, not a bug.
2. **Set `BORDERPASS_RATE_LIMIT_SALT`** in production/staging (32+ random chars, distinct per
   environment). Rotating it resets all counters, which is harmless.
3. **Set `BORDERPASS_RATE_LIMIT_PREFIX`** (e.g. `prod`, `staging`) if one Upstash database is shared
   between environments, so counters do not cross-contaminate.
4. **Confirm `BORDERPASS_ENV`** is explicitly set in every deployed environment.
5. **Confirm `NEXT_PUBLIC_SUPABASE_URL` is present in the production build environment** so the CSP
   pins the exact Supabase origin instead of the `*.supabase.co` fallback.
6. **Smoke-test Stripe Elements + 3D Secure on a preview deploy** with the enforcing CSP before
   production. If anything is blocked, set `BORDERPASS_CSP_REPORT_ONLY=true` (plus
   `BORDERPASS_CSP_REPORT_URI`), collect the violation reports, and adjust the allow-list.
7. **Verify the live response headers** once deployed (`curl -sI https://<host>/` — expect CSP, HSTS,
   `X-Frame-Options: DENY`, `Permissions-Policy`) and record the result in the Phase 7 gate ledger.
8. **Decide on HSTS `preload`** separately; it is intentionally not enabled.
9. **Tighten Supabase's own auth rate limits** in the dashboard to cover the browser-side
   `signInWithOtp` gap described in 1.6.
