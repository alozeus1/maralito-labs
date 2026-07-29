/**
 * Error/message capture seam.
 *
 * Deliberately dependency-free: the payload is built here and shipped with `fetch` to Sentry's
 * documented **Store** HTTP endpoint (`POST <origin>/api/<projectId>/store/` with an
 * `X-Sentry-Auth` header), parsed straight out of `SENTRY_DSN`. That keeps the wire format
 * vendor-correct while adding **zero npm dependencies** — swapping in `@sentry/nextjs` later means
 * replacing one `CaptureTransport`, not rewriting call sites.
 *
 * Non-negotiable properties:
 *  - **Never throws into the caller.** Every entry point is fully wrapped (see `writeAudit`).
 *  - **Never blocks a request.** `captureError`/`captureMessage` return `void`; the HTTP call is
 *    fire-and-forget behind an `AbortController` timeout.
 *  - **Never leaks.** Every field — message, error message, stack frames, tags, extra — goes
 *    through `sanitize()`, whose final step is the existing `redact()`.
 *  - **No DSN → silent no-op.** No transport is installed, so nothing is built and nothing is sent.
 */
import { sanitize, sanitizeRecord, scrubString } from './sanitize';
import { getObservabilityContext, logEvent, type Severity } from './log';

export interface CaptureContext {
  /** Stable, dot-namespaced event name — mirrors `logEvent`'s `event` so signals join up. */
  event?: string;
  severity?: Severity;
  /** Order id / request id. Becomes a Sentry tag. */
  correlationId?: string;
  /** Low-cardinality indexed labels (route, provider, order_state…). */
  tags?: Record<string, string>;
  /** Extra context. Sanitised; never pass raw request bodies. */
  data?: Record<string, unknown>;
}

/** Sentry "Store" event body (the subset we populate). */
export interface CapturePayload {
  event_id: string;
  timestamp: string;
  platform: 'node';
  level: Severity;
  logger: string;
  environment: string;
  release?: string;
  transaction?: string;
  message?: { formatted: string };
  exception?: {
    values: Array<{
      type: string;
      value: string;
      stacktrace?: { frames: StackFrame[] };
    }>;
  };
  tags: Record<string, string>;
  extra: Record<string, unknown>;
}

export interface CaptureTransport {
  readonly name: string;
  send(payload: CapturePayload, signal: AbortSignal): Promise<void>;
}

export interface CaptureStats {
  transport: string | null;
  sent: number;
  failed: number;
  dropped: number;
  inFlight: number;
}

const DEFAULT_TIMEOUT_MS = 2000;
const DEFAULT_MAX_PER_MINUTE = 60;
const MAX_STACK_FRAMES = 25;

let transport: CaptureTransport | null = null;
let timeoutMs = DEFAULT_TIMEOUT_MS;
let maxPerMinute = DEFAULT_MAX_PER_MINUTE;

const stats = { sent: 0, failed: 0, dropped: 0 };
const inFlight = new Set<Promise<void>>();
let windowStart = 0;
let windowCount = 0;

/* ------------------------------------------------------------------ DSN parsing */

export interface ParsedSentryDsn {
  publicKey: string;
  secretKey?: string;
  projectId: string;
  /** Fully-qualified Store endpoint, e.g. `https://o1.ingest.sentry.io/api/42/store/`. */
  storeUrl: string;
  /** Fully-qualified Envelope endpoint (used by newer SDKs; exposed for future use). */
  envelopeUrl: string;
}

/**
 * Parse `<scheme>://<publicKey>[:<secretKey>]@<host>[/<path>]/<projectId>`.
 * Returns `null` for anything unparseable — a malformed DSN must degrade to "no transport",
 * never to a throw at import time.
 */
export function parseSentryDsn(dsn: string | undefined | null): ParsedSentryDsn | null {
  if (!dsn || typeof dsn !== 'string') return null;
  try {
    const url = new URL(dsn.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const publicKey = decodeURIComponent(url.username);
    if (!publicKey) return null;
    const segments = url.pathname.split('/').filter(Boolean);
    const projectId = segments.pop();
    if (!projectId) return null;
    const prefix = segments.length > 0 ? `/${segments.join('/')}` : '';
    const base = `${url.protocol}//${url.host}${prefix}/api/${projectId}`;
    const secretKey = url.password ? decodeURIComponent(url.password) : '';
    return {
      publicKey,
      ...(secretKey ? { secretKey } : {}),
      projectId,
      storeUrl: `${base}/store/`,
      envelopeUrl: `${base}/envelope/`,
    };
  } catch {
    return null;
  }
}

/**
 * Sentry-compatible transport over `fetch`. No SDK.
 * Returns `null` when the DSN is absent/invalid → caller installs nothing → capture is a no-op.
 */
export function createSentryFetchTransport(
  dsn: string | undefined | null,
  options: { clientName?: string } = {},
): CaptureTransport | null {
  const parsed = parseSentryDsn(dsn);
  if (!parsed) return null;
  const client = options.clientName ?? 'maralito-observability/0.1.0';
  const auth = [
    'Sentry sentry_version=7',
    `sentry_client=${client}`,
    `sentry_key=${parsed.publicKey}`,
    ...(parsed.secretKey ? [`sentry_secret=${parsed.secretKey}`] : []),
  ].join(', ');

  return {
    name: 'sentry-fetch',
    async send(payload, signal) {
      const res = await fetch(parsed.storeUrl, {
        method: 'POST',
        signal,
        keepalive: true, // survives serverless response teardown where supported
        headers: { 'content-type': 'application/json', 'x-sentry-auth': auth },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`sentry_store_status_${res.status}`);
    },
  };
}

/* ------------------------------------------------------------------- transport */

export function setCaptureTransport(next: CaptureTransport | null): void {
  transport = next;
}
export function getCaptureTransportName(): string | null {
  return transport?.name ?? null;
}
export function configureCapture(opts: { timeoutMs?: number; maxEventsPerMinute?: number }): void {
  if (typeof opts.timeoutMs === 'number' && opts.timeoutMs > 0) timeoutMs = opts.timeoutMs;
  if (typeof opts.maxEventsPerMinute === 'number' && opts.maxEventsPerMinute >= 0) {
    maxPerMinute = opts.maxEventsPerMinute;
  }
}
export function getCaptureStats(): CaptureStats {
  return { transport: getCaptureTransportName(), ...stats, inFlight: inFlight.size };
}
/** Test helper: reset counters/rate window. Does not touch the installed transport. */
export function resetCaptureStats(): void {
  stats.sent = 0;
  stats.failed = 0;
  stats.dropped = 0;
  windowStart = 0;
  windowCount = 0;
}

/* --------------------------------------------------------------- payload build */

function eventId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID().replace(/-/g, '');
  let out = '';
  for (let i = 0; i < 32; i++) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

interface StackFrame {
  filename: string;
  function: string;
  lineno?: number;
}

/** Best-effort V8 stack parse → Sentry frames (oldest first). Filenames are scrubbed too. */
function parseFrames(stack: string | undefined): StackFrame[] {
  const frames: StackFrame[] = [];
  if (!stack) return frames;
  for (const raw of stack.split('\n').slice(1, MAX_STACK_FRAMES + 1)) {
    const line = raw.trim();
    if (!line.startsWith('at ')) continue;
    const withFn = /^at\s+(.+?)\s+\((.+?)(?::(\d+):(\d+))?\)$/.exec(line);
    const bare = /^at\s+(.+?)(?::(\d+):(\d+))?$/.exec(line);
    if (withFn) {
      frames.push({
        filename: scrubString(withFn[2] ?? '', 256),
        function: scrubString(withFn[1] ?? '?', 128),
        ...(withFn[3] ? { lineno: Number(withFn[3]) } : {}),
      });
    } else if (bare) {
      frames.push({
        filename: scrubString(bare[1] ?? '', 256),
        function: '?',
        ...(bare[2] ? { lineno: Number(bare[2]) } : {}),
      });
    }
  }
  return frames.reverse(); // Sentry renders oldest → newest
}

function baseTags(ctx: CaptureContext | undefined): Record<string, string> {
  const tags: Record<string, string> = {};
  const sanitised = sanitizeRecord(ctx?.tags);
  for (const [k, v] of Object.entries(sanitised)) tags[k] = String(v).slice(0, 200);
  if (ctx?.event) tags.event = ctx.event.slice(0, 200);
  if (ctx?.correlationId) tags.correlation_id = String(ctx.correlationId).slice(0, 128);
  return tags;
}

/**
 * Build the sanitised wire payload. Exported so tests can assert redaction on the exact object that
 * would be transmitted, without any network.
 */
export function buildCapturePayload(
  input: { error?: unknown; message?: string },
  ctx?: CaptureContext,
): CapturePayload {
  const runtime = getObservabilityContext();
  const level: Severity = ctx?.severity ?? (input.error ? 'error' : 'info');
  const payload: CapturePayload = {
    event_id: eventId(),
    timestamp: new Date().toISOString(),
    platform: 'node',
    level,
    logger: runtime.service,
    environment: runtime.environment,
    ...(runtime.release ? { release: runtime.release } : {}),
    ...(ctx?.event ? { transaction: ctx.event } : {}),
    tags: baseTags(ctx),
    extra: sanitizeRecord(ctx?.data),
  };

  if (typeof input.message === 'string' && input.message.length > 0) {
    payload.message = { formatted: scrubString(input.message, 1024) };
  }

  if (input.error !== undefined) {
    const err = input.error;
    const isError = err instanceof Error;
    const type = isError ? err.name || 'Error' : typeof err;
    const value = isError
      ? scrubString(err.message, 1024)
      : scrubString(typeof err === 'string' ? err : safeStringify(err), 1024);
    const frames = isError ? parseFrames(err.stack) : [];
    payload.exception = {
      values: [
        {
          type: scrubString(type, 128),
          value,
          ...(frames.length > 0 ? { stacktrace: { frames } } : {}),
        },
      ],
    };
    // Nested causes carry the real reason for wrapped provider errors.
    if (isError && err.cause !== undefined) {
      payload.extra.cause = sanitize(err.cause);
    }
  }
  return payload;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(sanitize(value)) ?? String(value);
  } catch {
    return '[unserialisable]';
  }
}

/* -------------------------------------------------------------------- dispatch */

function rateLimited(): boolean {
  if (maxPerMinute === 0) return false; // 0 == unlimited
  const now = Date.now();
  if (now - windowStart >= 60_000) {
    windowStart = now;
    windowCount = 0;
  }
  windowCount++;
  return windowCount > maxPerMinute;
}

function dispatch(payload: CapturePayload): void {
  const active = transport;
  if (!active) return; // no DSN configured → silent no-op
  if (rateLimited()) {
    stats.dropped++;
    return;
  }
  const controller = new AbortController();
  const timer: unknown = setTimeout(() => controller.abort(), timeoutMs);
  // Don't hold a Node process open just for a telemetry timer.
  (timer as { unref?: () => void })?.unref?.();

  const task: Promise<void> = Promise.resolve()
    .then(() => active.send(payload, controller.signal))
    .then(
      () => {
        stats.sent++;
      },
      () => {
        stats.failed++; // transport failure is swallowed by design
      },
    )
    .then(() => {
      clearTimeout(timer as ReturnType<typeof setTimeout>);
      inFlight.delete(task);
    });
  inFlight.add(task);
}

/**
 * Capture an exception. Fire-and-forget, non-blocking, never throws.
 * With no transport installed (no `SENTRY_DSN`) this is a complete no-op.
 */
export function captureError(error: unknown, ctx?: CaptureContext): void {
  try {
    if (!transport) return;
    dispatch(buildCapturePayload({ error }, ctx));
  } catch {
    /* capture must never break the caller */
  }
}

/** Capture a standalone message (no exception). Same guarantees as `captureError`. */
export function captureMessage(message: string, ctx?: CaptureContext): void {
  try {
    if (!transport) return;
    dispatch(buildCapturePayload({ message }, ctx));
  } catch {
    /* capture must never break the caller */
  }
}

/**
 * Capture AND emit a structured log line in one call — the recommended shape for catch blocks, so
 * the signal exists in the log drain even when no DSN is configured.
 */
export function reportError(
  error: unknown,
  ctx: CaptureContext & { event: string; domain?: Parameters<typeof logEvent>[0]['domain'] },
): void {
  logEvent({
    event: ctx.event,
    severity: ctx.severity ?? 'error',
    ...(ctx.domain ? { domain: ctx.domain } : {}),
    ...(ctx.correlationId ? { correlationId: ctx.correlationId } : {}),
    data: {
      ...(ctx.data ?? {}),
      error_type: error instanceof Error ? error.name : typeof error,
      error_message: error instanceof Error ? error.message : String(error),
    },
  });
  captureError(error, ctx);
}

/**
 * Await in-flight captures (bounded). Use in serverless handlers via `waitUntil(flushCaptures())`
 * so events are not lost when the runtime freezes. Never throws.
 */
export async function flushCaptures(waitMs = DEFAULT_TIMEOUT_MS): Promise<void> {
  try {
    if (inFlight.size === 0) return;
    // NOTE: this timer is deliberately NOT unref'd. The per-capture abort timer is unref'd (so
    // telemetry never holds a process open on its own), which means an in-flight send can only be
    // aborted while something else keeps the event loop alive — and an awaited flush is exactly
    // that. Unref'ing here would let the runtime exit mid-flush and strand the promise.
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      Promise.allSettled([...inFlight]),
      new Promise((resolve) => {
        timer = setTimeout(resolve, waitMs);
      }),
    ]);
    if (timer) clearTimeout(timer);
  } catch {
    /* flush is best-effort */
  }
}
