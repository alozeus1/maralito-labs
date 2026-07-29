import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { withPrivilegedDbAccess } from '@maralito/db';
import { isStripeConfigured } from '@maralito/payments';
import { logEvent } from '@maralito/observability';
import { getServerEnv } from '@/server/env';
import { secretOk } from '@/server/automation-auth';
import { isResendConfigured, isDeliveryEnabled } from '@/server/resend';
import { isKmsConfigured } from '@/server/kms';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // DB probe + node crypto (timingSafeEqual) — never the edge runtime

/**
 * Liveness + readiness probe.
 *
 * TWO SHAPES, deliberately:
 *
 *  - **Anonymous** (uptime monitors, load balancers, anyone on the internet — `/api/health` is
 *    public in `middleware.ts`) gets liveness only: the process is up. No dependency detail, no
 *    env names, no versions. Enumerating which integrations are unconfigured is reconnaissance for
 *    an attacker, so anonymous callers learn nothing about internals.
 *
 *  - **Authorised** callers (an n8n uptime workflow / an operator) present the existing
 *    `x-borderpass-secret` shared secret — the same constant-time, fail-closed `secretOk` guard the
 *    automation endpoints use — and get a readiness block of **booleans only**. Never a secret, a
 *    key prefix, a connection string, a host name, a version, or an error message.
 *
 * The DB probe runs ONLY on the authorised path, so an anonymous flood can never turn this route
 * into a database amplification vector. The anonymous path stays synchronous and allocation-cheap.
 */

interface ReadinessChecks {
  /** DATABASE_URL present. */
  database_configured: boolean;
  /** `select 1` actually round-tripped within the probe budget. */
  database_reachable: boolean;
  /** STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET present. */
  stripe_configured: boolean;
  /** RESEND_API_KEY + a verified From present. */
  resend_configured: boolean;
  /** Email sending is not hard-disabled (EMAIL_DELIVERY_ENABLED). */
  email_delivery_enabled: boolean;
  /** BORDERPASS_KMS_KEY present — PII paths fail closed without it. */
  kms_configured: boolean;
  /** N8N_WEBHOOK_SECRET present (automation endpoints fail closed without it). */
  automation_secret_configured: boolean;
  /** SENTRY_DSN present — error capture is a silent no-op without it. */
  error_capture_configured: boolean;
}

const DB_PROBE_TIMEOUT_MS = 2000;

/** `select 1` against the privileged connection. Never throws; a hang resolves false. */
async function probeDatabase(): Promise<boolean> {
  try {
    const probe = withPrivilegedDbAccess('health:readiness-probe', async (db) => {
      await db.execute(sql`select 1`);
      return true;
    });
    const timeout = new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), DB_PROBE_TIMEOUT_MS),
    );
    return await Promise.race([probe, timeout]);
  } catch {
    return false; // the reason is intentionally not surfaced to the caller
  }
}

async function readiness(base: Record<string, unknown>): Promise<Response> {
  const env = getServerEnv();
  const databaseConfigured = Boolean(env.DATABASE_URL);
  const checks: ReadinessChecks = {
    database_configured: databaseConfigured,
    database_reachable: databaseConfigured ? await probeDatabase() : false,
    stripe_configured: isStripeConfigured(),
    resend_configured: isResendConfigured(),
    email_delivery_enabled: isDeliveryEnabled(),
    kms_configured: isKmsConfigured(),
    automation_secret_configured: Boolean(env.N8N_WEBHOOK_SECRET),
    error_capture_configured: Boolean(process.env.SENTRY_DSN),
  };
  const ready = checks.database_configured && checks.database_reachable;

  logEvent({
    event: ready ? 'health.readiness_ok' : 'health.readiness_degraded',
    severity: ready ? 'info' : 'warning',
    domain: 'observability',
    data: { ...checks, deploy_env: env.BORDERPASS_ENV },
  });

  return NextResponse.json(
    { ...base, ready, env: env.BORDERPASS_ENV, checks },
    { headers: { 'cache-control': 'no-store' } },
  );
}

export function GET(req: Request): Response | Promise<Response> {
  // Minimal liveness shape. `phase` is retained for backwards compatibility with existing probes.
  const base = { app: 'borderpass', status: 'ok', phase: 0, ts: new Date().toISOString() };

  let authorised = false;
  try {
    authorised = secretOk(
      req.headers.get('x-borderpass-secret'),
      getServerEnv().N8N_WEBHOOK_SECRET,
    );
  } catch {
    authorised = false; // env not parseable → fail closed to the anonymous shape
  }

  if (!authorised) {
    return NextResponse.json(base, { headers: { 'cache-control': 'no-store' } });
  }
  return readiness(base);
}
