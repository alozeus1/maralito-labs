import { NextResponse } from 'next/server';
import { getServerEnv } from '@/server/env';
import { secretOk } from '@/server/automation-auth';
import { dispatchQueuedNotifications } from '@/server/notification-dispatch';
import { writeAudit } from '@/server/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // node crypto (constant-time compare) + privileged DB — never edge

/** Cap the per-invocation batch so a single call can't scan the whole outbox. */
const MAX_LIMIT = 200;

/**
 * Phase 8C.1 — prod-safe authed trigger for the notification-outbox dispatcher. Called by the n8n
 * scheduled "dispatch notifications" workflow. FAILS CLOSED on the shared secret (constant-time
 * compare of `x-borderpass-secret` vs `N8N_WEBHOOK_SECRET`); no/incorrect secret → 401.
 *
 * PII GATE (ADR-0014 / 8B): this endpoint ONLY ever resolves the SYNTHETIC operator address
 * (`DEV_SYNTHETIC_NOTIFY_EMAIL`). It NEVER resolves a real customer's contact info — that stays gated
 * on Phase 8B (KMS) + consent. When the synthetic address is unset (as in a real prod deploy today),
 * the resolver returns null and the dispatcher SKIPS every row: safe to schedule dark. The dispatcher
 * is itself idempotent per row (claims `queued → sending`), so a double-fire never double-sends.
 *
 * Body (optional): `{ "max": number }` to bound the batch. Honors an optional `Idempotency-Key`
 * header (advisory — recorded in the audit trail; per-row idempotency is enforced by the dispatcher).
 */
export async function POST(req: Request): Promise<Response> {
  const env = getServerEnv();
  if (!secretOk(req.headers.get('x-borderpass-secret'), env.N8N_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { max?: unknown } = {};
  try {
    const text = await req.text();
    body = text ? (JSON.parse(text) as { max?: unknown }) : {};
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const max =
    typeof body.max === 'number' && Number.isInteger(body.max) && body.max > 0
      ? Math.min(body.max, MAX_LIMIT)
      : undefined;

  // SYNTHETIC recipient ONLY. null (address unset) → dispatcher skips every row (never a real address).
  const to = process.env.DEV_SYNTHETIC_NOTIFY_EMAIL ?? null;
  const base = env.BORDERPASS_APP_URL;
  const idempotencyKey = req.headers.get('idempotency-key');

  let summary;
  try {
    summary = await dispatchQueuedNotifications({
      resolveRecipient: async () => to,
      ...(max ? { limit: max } : {}),
      ...(base ? { appBaseUrl: base } : {}),
    });
  } catch {
    // Transient failure → 503 so n8n retries with backoff (dispatch is idempotent per row).
    return NextResponse.json({ error: 'dispatch_error' }, { status: 503 });
  }

  await writeAudit({
    action: 'notifications.dispatch',
    entityType: 'notification_outbox',
    metadata: {
      scanned: summary.scanned,
      sent: summary.sent,
      failed: summary.failed,
      skipped: summary.skipped,
      syntheticRecipient: Boolean(to),
      ...(idempotencyKey ? { idempotencyKey } : {}),
    },
  });

  return NextResponse.json({ status: 'ok', ...summary }, { status: 200 });
}
