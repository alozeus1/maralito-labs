// ⚠️ DELIBERATELY NO `import 'server-only'` HERE — see the RUNTIME note below. Do not add it back.
//
// This module is imported by `middleware.ts`, which Next.js runs in the EDGE runtime. The
// `server-only` package only resolves to its harmless `empty.js` under the `react-server` export
// condition; under any other condition it resolves to `index.js`, whose entire body is a `throw`.
// Middleware is not evaluated under `react-server`, so adding `import 'server-only'` here throws at
// module load and takes down EVERY request that passes through middleware.
//
// The client-bundle protection that `server-only` would have given us is instead enforced by
// `scripts/check-server-only-boundary.mjs` (CI), which fails the build if any `'use client'` module
// imports this file. That guard is equivalent for our purposes and is runtime-safe.

/**
 * Provider-abstracted request rate limiting (server-side). No SDK / no new dependency — the durable
 * backend is Upstash Redis driven over its REST API with `fetch`, exactly like `resend.ts` talks to
 * Resend. This module is the single rate-limit boundary for the app: middleware, route handlers and
 * server actions all go through `checkRateLimit` / `enforceRateLimit`.
 *
 * FAIL CLOSED. In production (and staging) a *durable* store is mandatory: if `UPSTASH_REDIS_REST_URL`
 * / `UPSTASH_REDIS_REST_TOKEN` are absent, or the store errors, every call is DENIED (429). We never
 * silently degrade to per-instance memory in production — serverless/edge instances each get their own
 * heap, so an in-memory counter there is not a limit at all, it is the *appearance* of one. In
 * local/preview the in-memory store is used and is fine.
 *
 * Runtime: Web Crypto + `fetch` only (no `node:crypto`), so this module is safe to import from
 * `middleware.ts` (edge runtime) as well as from Node route handlers.
 *
 * PRIVACY: the client IP is NEVER stored or logged in the clear. It is SHA-256 hashed (with an
 * optional server-side salt) and truncated before it becomes part of a key or a log line. The same
 * applies to the optional user id.
 *
 * Env (all server-only; never NEXT_PUBLIC):
 *   UPSTASH_REDIS_REST_URL      Upstash Redis REST endpoint. Presence of URL+TOKEN = durable store.
 *   UPSTASH_REDIS_REST_TOKEN    Upstash REST token (per-environment, least privilege).
 *   BORDERPASS_RATE_LIMIT_SALT  Optional HMAC-ish salt mixed into the IP/user hash. Recommended: a
 *                               32+ char random value, rotated per environment. Without it a raw
 *                               SHA-256 of an IPv4 address is brute-forceable (small input space).
 *   BORDERPASS_RATE_LIMIT_PREFIX Optional Redis key namespace (e.g. 'prod'). Set this when more than
 *                               one environment shares a single Upstash database.
 */

/** Result of a single counter increment inside a fixed window. */
export interface RateLimitStoreResult {
  /** Number of hits recorded in the current window, INCLUDING this one. */
  count: number;
  /** Epoch ms at which the current window expires and the counter resets. */
  resetAt: number;
}

export type RateLimitStoreName = 'memory' | 'upstash';

/** Provider abstraction. Implementations MUST be atomic per key (increment + read in one step). */
export interface RateLimitStore {
  readonly name: RateLimitStoreName;
  /** True only for stores shared across all server instances. Memory is NOT durable. */
  readonly durable: boolean;
  incr(key: string, windowMs: number): Promise<RateLimitStoreResult>;
}

/** A named limit. `name` is a stable, log-safe policy identifier (no PII). */
export interface RateLimitPolicy {
  readonly name: string;
  readonly limit: number;
  readonly windowMs: number;
}

export type RateLimitDenyReason = 'limit_exceeded' | 'no_durable_store' | 'store_error';

export type RateLimitDecision =
  | {
      ok: true;
      policy: string;
      limit: number;
      remaining: number;
      resetAt: number;
      store: RateLimitStoreName;
    }
  | {
      ok: false;
      policy: string;
      limit: number;
      remaining: 0;
      resetAt: number;
      retryAfterSeconds: number;
      reason: RateLimitDenyReason;
      store: RateLimitStoreName | 'none';
    };

const MINUTE = 60_000;

/**
 * Named policies. Tuned to be invisible to a real human and painful to a script. Windows are fixed
 * (not sliding) — a determined caller can burst across a window boundary, which is an accepted
 * trade-off for a single atomic INCR per request.
 */
export const RATE_LIMIT_POLICIES = {
  /** Passwordless OTP request / login submit. The tightest policy: it costs us an email per hit. */
  otpLogin: { name: 'otp_login', limit: 5, windowMs: 15 * MINUTE },
  /** Supabase auth callback + email-link confirm (token exchange). Guards code-guessing. */
  authCallback: { name: 'auth_callback', limit: 20, windowMs: 5 * MINUTE },
  /** Customer order creation. Generous for a human, hostile to an order-spam script. */
  orderCreate: { name: 'order_create', limit: 10, windowMs: 60 * MINUTE },
  /** Quote accept/decline/re-quote actions. */
  quoteAction: { name: 'quote_action', limit: 30, windowMs: 10 * MINUTE },
  /** Payment intent creation / payment page actions. Caps card-testing attempts per client. */
  paymentInitiate: { name: 'payment_initiate', limit: 10, windowMs: 10 * MINUTE },
  /** n8n automation endpoints (already shared-secret authed — this bounds a leaked-secret blast). */
  automationApi: { name: 'automation_api', limit: 120, windowMs: MINUTE },
  /** Stripe webhook. High ceiling: Stripe legitimately bursts on retries; only absurd volume trips. */
  stripeWebhook: { name: 'stripe_webhook', limit: 600, windowMs: MINUTE },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitPolicyKey = keyof typeof RATE_LIMIT_POLICIES;

// ---------------------------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------------------------

type EnvLike = Record<string, string | undefined>;

/**
 * Environments where a durable store is MANDATORY and its absence means DENY.
 * - explicit `production` / `staging` → always require durable.
 * - explicit `local` / `preview`      → in-memory is acceptable (single dev instance).
 * - BORDERPASS_ENV unset              → fall back to NODE_ENV, so a prod deploy that forgot to set
 *                                       BORDERPASS_ENV still fails closed rather than open.
 */
export function requiresDurableStore(env: EnvLike = process.env): boolean {
  const appEnv = (env.BORDERPASS_ENV ?? '').trim();
  if (appEnv === 'production' || appEnv === 'staging') return true;
  if (appEnv) return false;
  return env.NODE_ENV === 'production';
}

/** True when both Upstash REST credentials are present. */
export function isDurableStoreConfigured(env: EnvLike = process.env): boolean {
  return !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

// ---------------------------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------------------------

interface MemoryEntry {
  count: number;
  resetAt: number;
}

/** Per-process counters. Bounded so a key-space flood can't grow the heap without limit. */
const memoryCounters = new Map<string, MemoryEntry>();
const MEMORY_MAX_KEYS = 10_000;

function pruneMemory(now: number): void {
  for (const [k, v] of memoryCounters) if (v.resetAt <= now) memoryCounters.delete(k);
  if (memoryCounters.size <= MEMORY_MAX_KEYS) return;
  // Still oversized after pruning expired entries → drop oldest-inserted keys (Map preserves
  // insertion order). Dropping a counter can only ever be *more* permissive, which is why this
  // store is never allowed to back production.
  const excess = memoryCounters.size - MEMORY_MAX_KEYS;
  let dropped = 0;
  for (const k of memoryCounters.keys()) {
    memoryCounters.delete(k);
    if (++dropped >= excess) break;
  }
}

/** In-memory fixed-window store. DEV/LOCAL ONLY — not shared between instances. */
export const memoryStore: RateLimitStore = {
  name: 'memory',
  durable: false,
  incr(key: string, windowMs: number): Promise<RateLimitStoreResult> {
    const now = Date.now();
    pruneMemory(now);
    const existing = memoryCounters.get(key);
    if (existing && existing.resetAt > now) {
      existing.count += 1;
      return Promise.resolve({ count: existing.count, resetAt: existing.resetAt });
    }
    const fresh: MemoryEntry = { count: 1, resetAt: now + windowMs };
    memoryCounters.set(key, fresh);
    return Promise.resolve({ count: fresh.count, resetAt: fresh.resetAt });
  },
};

/** Test-only: clear per-process counters so window behaviour is deterministic across cases. */
export function __resetRateLimitStateForTests(): void {
  memoryCounters.clear();
}

const UPSTASH_TIMEOUT_MS = 2_000;

interface UpstashPipelineItem {
  result?: unknown;
  error?: unknown;
}

function toInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Upstash Redis REST store. One round trip per check via the pipeline endpoint:
 *   INCR key            → the count for this window
 *   PEXPIRE key ms NX   → set the TTL only on the first hit (so the window doesn't slide)
 *   PTTL key            → remaining ms, used to compute resetAt / Retry-After
 * Throws on transport, auth or protocol failure so the caller can fail closed.
 */
export function createUpstashStore(url: string, token: string): RateLimitStore {
  const endpoint = `${url.replace(/\/+$/, '')}/pipeline`;
  return {
    name: 'upstash',
    durable: true,
    async incr(key: string, windowMs: number): Promise<RateLimitStoreResult> {
      const body = JSON.stringify([
        ['INCR', key],
        ['PEXPIRE', key, String(windowMs), 'NX'],
        ['PTTL', key],
      ]);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body,
        cache: 'no-store',
        ...(typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
          ? { signal: AbortSignal.timeout(UPSTASH_TIMEOUT_MS) }
          : {}),
      });
      if (!res.ok) throw new Error(`upstash_http_${res.status}`);

      const parsed: unknown = await res.json();
      if (!Array.isArray(parsed)) throw new Error('upstash_bad_response');
      const items = parsed as UpstashPipelineItem[];
      const incr = items[0];
      const pttl = items[2];
      if (!incr || incr.error !== undefined) throw new Error('upstash_incr_failed');

      const count = toInt(incr.result);
      if (count === null) throw new Error('upstash_bad_count');

      const ttl = pttl && pttl.error === undefined ? toInt(pttl.result) : null;
      // PTTL returns -1 (no expiry) / -2 (missing). Either means we can't trust the TTL — assume a
      // full window so Retry-After is never under-reported.
      const resetAt = ttl !== null && ttl > 0 ? Date.now() + ttl : Date.now() + windowMs;
      return { count, resetAt };
    },
  };
}

/**
 * Resolve the active store for this environment.
 * Returns `null` ONLY when a durable store is required but not configured — that is the fail-closed
 * signal and the caller MUST deny.
 */
export function resolveRateLimitStore(env: EnvLike = process.env): RateLimitStore | null {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return createUpstashStore(url, token);
  if (requiresDurableStore(env)) return null; // fail closed — never memory in production/staging
  return memoryStore;
}

// ---------------------------------------------------------------------------------------------
// Key derivation (IP is hashed, never stored or logged raw)
// ---------------------------------------------------------------------------------------------

const HASH_LENGTH = 16; // 64 bits of hex — ample collision resistance for a counter namespace

function toHex(buffer: ArrayBuffer): string {
  let out = '';
  for (const byte of new Uint8Array(buffer)) out += byte.toString(16).padStart(2, '0');
  return out;
}

/**
 * SHA-256 (Web Crypto, edge-safe) of `salt:namespace:value`, truncated to 16 hex chars.
 * The salt and namespace stop a rainbow-table lookup of the (small) IPv4 space and stop the same IP
 * producing the same token across policies.
 */
export async function hashIdentifier(
  value: string,
  namespace: string,
  env: EnvLike = process.env,
): Promise<string> {
  const salt = env.BORDERPASS_RATE_LIMIT_SALT ?? '';
  const data = new TextEncoder().encode(`${salt}:${namespace}:${value}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest).slice(0, HASH_LENGTH);
}

/**
 * First hop of `x-forwarded-for` (the client as seen by our edge), falling back to the
 * platform-specific single-value headers. Returns null when no client address is present, which the
 * caller treats as an unattributable client (still limited, under a shared `noip` bucket).
 */
export function clientIpFromHeaders(headers: Headers): string | null {
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const single =
    headers.get('x-real-ip') ?? headers.get('cf-connecting-ip') ?? headers.get('x-vercel-forwarded-for');
  const trimmed = single?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Build the storage key for a policy. Shape: `rl:<prefix>:<policy>:<ipHash>[:u<userHash>]`.
 * No raw IP, no email, no user id ever reaches Redis or a log line.
 */
export async function buildRateLimitKey(
  input: { policy: string; ip: string | null; userId?: string | undefined },
  env: EnvLike = process.env,
): Promise<string> {
  const prefix = env.BORDERPASS_RATE_LIMIT_PREFIX ?? 'bp';
  const ipPart = input.ip ? await hashIdentifier(input.ip, input.policy, env) : 'noip';
  const base = `rl:${prefix}:${input.policy}:${ipPart}`;
  if (!input.userId) return base;
  const userPart = await hashIdentifier(input.userId, `${input.policy}:user`, env);
  return `${base}:u${userPart}`;
}

// ---------------------------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------------------------

function denial(
  policy: string,
  limit: number,
  resetAt: number,
  reason: RateLimitDenyReason,
  store: RateLimitStoreName | 'none',
): RateLimitDecision {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return { ok: false, policy, limit, remaining: 0, resetAt, retryAfterSeconds, reason, store };
}

/** Log-safe denial record. Contains the policy + a truncated key digest — never an IP or user id. */
function logDenial(decision: Extract<RateLimitDecision, { ok: false }>, key: string): void {
  console.warn(
    JSON.stringify({
      event: 'rate_limited',
      policy: decision.policy,
      reason: decision.reason,
      store: decision.store,
      // `key` already contains only hashed identifiers; the tail is enough to correlate two hits.
      key_suffix: key.slice(-HASH_LENGTH),
      retry_after_s: decision.retryAfterSeconds,
    }),
  );
}

/**
 * Core entry point. Increments the counter for `key` and returns a decision.
 * DENIES when: the limit is exceeded, no durable store is configured in production/staging, or the
 * durable store errors (network/auth/protocol). Never throws.
 */
export async function checkRateLimit(
  input: { key: string; limit: number; windowMs: number; policy?: string },
  store: RateLimitStore | null = resolveRateLimitStore(),
): Promise<RateLimitDecision> {
  const policy = input.policy ?? 'unnamed';

  if (!store) {
    // Production/staging with no Upstash configured. Deny — a limiter that can't count must not
    // pretend to. Retry-After is capped so a fixed misconfiguration recovers quickly.
    const resetAt = Date.now() + Math.min(60_000, input.windowMs);
    const decision = denial(policy, input.limit, resetAt, 'no_durable_store', 'none');
    logDenial(decision as Extract<RateLimitDecision, { ok: false }>, input.key);
    return decision;
  }

  let result: RateLimitStoreResult;
  try {
    result = await store.incr(input.key, input.windowMs);
  } catch {
    // Store outage → fail closed. Never log the underlying error object (may echo the key/token).
    const resetAt = Date.now() + Math.min(60_000, input.windowMs);
    const decision = denial(policy, input.limit, resetAt, 'store_error', store.name);
    logDenial(decision as Extract<RateLimitDecision, { ok: false }>, input.key);
    return decision;
  }

  if (result.count > input.limit) {
    const decision = denial(policy, input.limit, result.resetAt, 'limit_exceeded', store.name);
    logDenial(decision as Extract<RateLimitDecision, { ok: false }>, input.key);
    return decision;
  }

  return {
    ok: true,
    policy,
    limit: input.limit,
    remaining: Math.max(0, input.limit - result.count),
    resetAt: result.resetAt,
    store: store.name,
  };
}

/** Derive the key from the request and apply `policy`. Never throws. */
export async function rateLimitRequest(
  req: Request,
  policy: RateLimitPolicy,
  opts?: { userId?: string | undefined },
): Promise<RateLimitDecision> {
  const key = await buildRateLimitKey({
    policy: policy.name,
    ip: clientIpFromHeaders(req.headers),
    userId: opts?.userId,
  });
  return checkRateLimit({
    key,
    limit: policy.limit,
    windowMs: policy.windowMs,
    policy: policy.name,
  });
}

/** RFC 9331-style advisory headers, safe to attach to allowed responses too. */
export function rateLimitHeaders(decision: RateLimitDecision): Record<string, string> {
  const resetSeconds = Math.max(0, Math.ceil((decision.resetAt - Date.now()) / 1000));
  const headers: Record<string, string> = {
    'RateLimit-Limit': String(decision.limit),
    'RateLimit-Remaining': String(decision.remaining),
    'RateLimit-Reset': String(resetSeconds),
  };
  if (!decision.ok) headers['Retry-After'] = String(decision.retryAfterSeconds);
  return headers;
}

/**
 * The 429 every caller gets. ALWAYS `application/json` — a limited API client or an n8n workflow
 * must never receive an HTML error page it would happily treat as success.
 */
export function rateLimitResponse(decision: RateLimitDecision): Response {
  const retryAfter = decision.ok ? 1 : decision.retryAfterSeconds;
  return new Response(
    JSON.stringify({
      error: 'rate_limited',
      policy: decision.policy,
      retry_after_seconds: retryAfter,
      limit: decision.limit,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...rateLimitHeaders(decision),
      },
    },
  );
}

/**
 * Middleware/route-handler helper: returns a ready-to-return 429 `Response` when the caller is over
 * the limit, or `null` when the request may proceed. The allowed-path decision is returned via
 * `rateLimitHeaders` if the caller wants to surface remaining quota.
 */
export async function enforceRateLimit(
  req: Request,
  policy: RateLimitPolicy,
  opts?: { userId?: string | undefined },
): Promise<Response | null> {
  const decision = await rateLimitRequest(req, policy, opts);
  return decision.ok ? null : rateLimitResponse(decision);
}

// ---------------------------------------------------------------------------------------------
// Route → policy mapping (used by middleware.ts, owned by the coordinator)
// ---------------------------------------------------------------------------------------------

interface RouteRule {
  policy: RateLimitPolicy;
  /** Methods this rule applies to. Empty = all methods. */
  methods: readonly string[];
  match: (pathname: string) => boolean;
}

const startsWith = (prefix: string) => (p: string) => p === prefix || p.startsWith(`${prefix}/`);

/**
 * Ordered, first-match-wins. GETs of ordinary pages are intentionally NOT limited — only the
 * expensive/abusable verbs are. Note that `/login` and `/sign-up` submit via POST (Next server
 * actions post back to the page URL), which is what the otpLogin rule catches.
 */
const ROUTE_RULES: readonly RouteRule[] = [
  { policy: RATE_LIMIT_POLICIES.stripeWebhook, methods: ['POST'], match: startsWith('/api/stripe/webhook') },
  { policy: RATE_LIMIT_POLICIES.automationApi, methods: [], match: startsWith('/api/automation') },
  { policy: RATE_LIMIT_POLICIES.authCallback, methods: [], match: startsWith('/auth') },
  { policy: RATE_LIMIT_POLICIES.otpLogin, methods: ['POST'], match: (p) => startsWith('/login')(p) || startsWith('/sign-up')(p) },
  { policy: RATE_LIMIT_POLICIES.paymentInitiate, methods: ['POST'], match: (p) => /\/pay(\/|$)/.test(p) },
  { policy: RATE_LIMIT_POLICIES.quoteAction, methods: ['POST'], match: (p) => /\/quotes?(\/|$)/.test(p) },
  { policy: RATE_LIMIT_POLICIES.orderCreate, methods: ['POST'], match: startsWith('/orders/new') },
];

/** Pick the policy for a request, or null when the route is not rate limited. */
export function resolveRateLimitPolicy(pathname: string, method: string): RateLimitPolicy | null {
  const upper = method.toUpperCase();
  for (const rule of ROUTE_RULES) {
    if (rule.methods.length > 0 && !rule.methods.includes(upper)) continue;
    if (rule.match(pathname)) return rule.policy;
  }
  return null;
}
