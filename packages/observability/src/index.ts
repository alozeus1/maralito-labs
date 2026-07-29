/**
 * @maralito/observability — redaction, structured logging, and a dependency-free capture seam.
 *
 * WHAT IS WIRED HERE (no npm dependencies, by design):
 *   - `redact()`      pre-existing key-name redaction (consumed, not modified).
 *   - `sanitize()`    egress choke point: extra key masking + value scrubbing + caps + `redact()`.
 *   - `logEvent()`    single-line JSON structured logs with a stable schema.
 *   - `captureError()` / `captureMessage()` behind a pluggable `CaptureTransport`, with a
 *     Sentry-compatible `fetch` transport driven by `SENTRY_DSN` (Store endpoint, no SDK).
 *
 * WHAT IS NOT WIRED (needs a dependency and/or an operator dashboard action):
 *   - OpenTelemetry traces/metrics (`otelEndpoint` is accepted and reported as `unwired`).
 *   - PostHog product analytics (`posthogKey` accepted, reported as `unwired`).
 *   - Sentry performance/tracing, session replay, source-map upload, release health — those need
 *     `@sentry/nextjs`. Error capture does NOT.
 *
 * Dev-safe by default: with no `SENTRY_DSN`, `initObservability` installs no transport and capture
 * is a complete no-op (nothing built, nothing sent, nothing logged).
 */
export * from './redact';
export * from './sanitize';
export * from './log';
export * from './capture';

import { createSentryFetchTransport, configureCapture, setCaptureTransport } from './capture';
import { logEvent, setObservabilityContext } from './log';

export interface ObservabilityConfig {
  sentryDsn?: string;
  otelEndpoint?: string;
  posthogKey?: string;
  posthogHost?: string;
  /** Logical service name for log lines + Sentry `logger`. Default `borderpass`. */
  service?: string;
  /** Deploy environment (`local` | `preview` | `staging` | `production`). */
  environment?: string;
  /** Release/commit sha, for Sentry release tagging. */
  release?: string;
  /** Per-capture HTTP timeout. Default 2000ms. */
  captureTimeoutMs?: number;
  /** Circuit breaker so an error storm cannot flood the transport. Default 60; `0` = unlimited. */
  maxEventsPerMinute?: number;
}

export interface ObservabilityStatus {
  /** `sentry-fetch` when a valid DSN was supplied, otherwise `disabled` (silent no-op). */
  capture: 'sentry-fetch' | 'disabled';
  /** Structured logging is always on — it needs no vendor. */
  logging: 'stdout-json';
  otel: 'unwired';
  posthog: 'unwired';
  environment: string;
  service: string;
}

let status: ObservabilityStatus | null = null;

/**
 * Idempotent process-wide init. Safe to call from instrumentation, a route handler, or a test.
 * Never throws: a malformed DSN degrades to `capture: 'disabled'`.
 */
export function initObservability(cfg: ObservabilityConfig = {}): ObservabilityStatus {
  try {
    setObservabilityContext({
      ...(cfg.service ? { service: cfg.service } : {}),
      ...(cfg.environment ? { environment: cfg.environment } : {}),
      ...(cfg.release ? { release: cfg.release } : {}),
    });
    configureCapture({
      ...(typeof cfg.captureTimeoutMs === 'number' ? { timeoutMs: cfg.captureTimeoutMs } : {}),
      ...(typeof cfg.maxEventsPerMinute === 'number'
        ? { maxEventsPerMinute: cfg.maxEventsPerMinute }
        : {}),
    });

    const transport = createSentryFetchTransport(cfg.sentryDsn);
    setCaptureTransport(transport);

    status = {
      capture: transport ? 'sentry-fetch' : 'disabled',
      logging: 'stdout-json',
      otel: 'unwired',
      posthog: 'unwired',
      environment: cfg.environment ?? 'unknown',
      service: cfg.service ?? 'borderpass',
    };
    logEvent({
      event: 'observability.initialised',
      domain: 'observability',
      severity: 'info',
      // Booleans only — never the DSN, key or host.
      data: {
        capture: status.capture,
        sentry_dsn_present: Boolean(cfg.sentryDsn),
        otel_endpoint_present: Boolean(cfg.otelEndpoint),
        posthog_key_present: Boolean(cfg.posthogKey),
      },
    });
    return status;
  } catch {
    status = {
      capture: 'disabled',
      logging: 'stdout-json',
      otel: 'unwired',
      posthog: 'unwired',
      environment: 'unknown',
      service: 'borderpass',
    };
    return status;
  }
}

/** Read env directly (server-side convenience). Values are used, never logged. */
export function initObservabilityFromEnv(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): ObservabilityStatus {
  const release = env.SENTRY_RELEASE ?? env.VERCEL_GIT_COMMIT_SHA;
  return initObservability({
    ...(env.SENTRY_DSN ? { sentryDsn: env.SENTRY_DSN } : {}),
    ...(env.OTEL_EXPORTER_OTLP_ENDPOINT ? { otelEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT } : {}),
    ...(env.NEXT_PUBLIC_POSTHOG_KEY ? { posthogKey: env.NEXT_PUBLIC_POSTHOG_KEY } : {}),
    ...(env.NEXT_PUBLIC_POSTHOG_HOST ? { posthogHost: env.NEXT_PUBLIC_POSTHOG_HOST } : {}),
    ...(env.OBSERVABILITY_SERVICE ? { service: env.OBSERVABILITY_SERVICE } : {}),
    ...(env.BORDERPASS_ENV ? { environment: env.BORDERPASS_ENV } : {}),
    ...(release ? { release } : {}),
  });
}

/** Current status, or `null` if `initObservability` was never called. */
export function getObservabilityStatus(): ObservabilityStatus | null {
  return status;
}
