/**
 * Structured logging — one line of JSON per event, redacted by construction.
 *
 * Why not `console.log('thing happened', obj)`: on Vercel/Supabase the only durable runtime signal
 * is stdout. A stable, machine-parseable schema means an operator can grep, alert and build a
 * dashboard from log drains WITHOUT a vendor SDK, and the same event names carry over unchanged the
 * day Sentry/Datadog is wired.
 *
 * Guarantees:
 *  - Exactly one line per event (JSON.stringify escapes embedded newlines).
 *  - Stable top-level schema: `event`, `severity`, `at` (+ `service`, `env`, `domain`,
 *    `correlation_id` when known). Caller-supplied fields are nested under `data` so they can never
 *    shadow or break the reserved keys.
 *  - Every caller field passes `sanitize()` → key mask + value scrub + `redact()`.
 *  - `logEvent` NEVER throws into the caller (same discipline as `writeAudit`).
 */
import { sanitizeRecord } from './sanitize';

export type Severity = 'debug' | 'info' | 'warning' | 'error' | 'fatal';

/**
 * The signal surfaces production must never be blind to. Keep this closed — a new domain is a
 * deliberate decision, and dashboards/alerts key off it.
 */
export type LogDomain =
  | 'auth' // sign-in/out, OTP issue/verify outcome, session/role denial
  | 'payment' // intent lifecycle, refunds, state-machine transitions
  | 'webhook' // inbound provider callbacks (Stripe, Resend)
  | 'automation' // n8n → app scoped-secret endpoints
  | 'notification' // outbox dispatch + provider send results
  | 'db' // privileged (RLS-bypassing) DB access
  | 'observability'; // the seam reporting on itself

export interface LogEventInput {
  /** Dot-namespaced, stable, low-cardinality. e.g. `payment.webhook_failed`. */
  event: string;
  severity?: Severity;
  domain?: LogDomain;
  /** Order id / request id — the join key across log lines and captured errors. */
  correlationId?: string;
  /** Safe, low-cardinality fields. Sanitised before emission; never pass raw bodies. */
  data?: Record<string, unknown>;
}

/** Emitted line shape (documented so log-drain parsers can rely on it). */
export interface LogLine {
  event: string;
  severity: Severity;
  at: string;
  service: string;
  env: string;
  domain?: LogDomain;
  correlation_id?: string;
  data?: Record<string, unknown>;
}

export type LogSink = (line: string, severity: Severity) => void;

export interface ObservabilityContext {
  service: string;
  environment: string;
  release?: string;
}

/* --------------------------------------------------------------- shared context */

function envVar(name: string): string | undefined {
  // Guarded so the package stays importable from a browser/edge bundle.
  if (typeof process === 'undefined' || !process.env) return undefined;
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

let context: ObservabilityContext = {
  service: envVar('OBSERVABILITY_SERVICE') ?? 'borderpass',
  environment: envVar('BORDERPASS_ENV') ?? envVar('NODE_ENV') ?? 'unknown',
  ...(envVar('VERCEL_GIT_COMMIT_SHA')
    ? { release: envVar('VERCEL_GIT_COMMIT_SHA') as string }
    : {}),
};

export function getObservabilityContext(): ObservabilityContext {
  return context;
}

/** Merge process-wide context (service/env/release). Called by `initObservability`. */
export function setObservabilityContext(patch: Partial<ObservabilityContext>): void {
  context = {
    service: patch.service ?? context.service,
    environment: patch.environment ?? context.environment,
    ...((patch.release ?? context.release) ? { release: patch.release ?? context.release } : {}),
  } as ObservabilityContext;
}

/* ------------------------------------------------------------------------ sink */

const defaultSink: LogSink = (line, severity) => {
  // stderr for actionable severities so platform log drains can split them cheaply.
  if (severity === 'error' || severity === 'fatal') console.error(line);
  else if (severity === 'warning') console.warn(line);
  else console.log(line);
};

let sink: LogSink = defaultSink;

/** Swap the output sink (tests, or an in-process buffer). `null` restores the console sink. */
export function setLogSink(next: LogSink | null): void {
  sink = next ?? defaultSink;
}

/* ------------------------------------------------------------------- logEvent */

/** Build the line object without emitting it. Exported for tests/assertions. */
export function buildLogLine(input: LogEventInput): LogLine {
  const data = sanitizeRecord(input.data);
  return {
    event: input.event,
    severity: input.severity ?? 'info',
    at: new Date().toISOString(),
    service: context.service,
    env: context.environment,
    ...(input.domain ? { domain: input.domain } : {}),
    ...(input.correlationId ? { correlation_id: String(input.correlationId).slice(0, 128) } : {}),
    ...(Object.keys(data).length > 0 ? { data } : {}),
  };
}

/** Emit one sanitised, single-line JSON event. Best-effort: never throws into the caller. */
export function logEvent(input: LogEventInput): void {
  try {
    const line = buildLogLine(input);
    sink(JSON.stringify(line), line.severity);
  } catch {
    /* logging must not break the request */
  }
}

/* --------------------------------------------------- domain convenience wrappers */

type DomainInput = Omit<LogEventInput, 'domain'>;
const forDomain =
  (domain: LogDomain) =>
  (input: DomainInput): void =>
    logEvent({ ...input, domain });

/** Auth/session events: sign-in outcome, OTP issue/verify, role or tenant denial. */
export const logAuthEvent = forDomain('auth');
/** Payment lifecycle: intent created, processing, succeeded, failed, refunded. */
export const logPaymentEvent = forDomain('payment');
/** Inbound provider webhooks: received / signature-invalid / handler-failed. */
export const logWebhookEvent = forDomain('webhook');
/** n8n → app automation endpoints: authorised / unauthorised / result status. */
export const logAutomationEvent = forDomain('automation');
/** Notification outbox dispatch + provider send result. */
export const logNotificationEvent = forDomain('notification');
/** Privileged (RLS-bypassing) DB access — always logged with its justification `reason`. */
export const logPrivilegedDbAccess = forDomain('db');
