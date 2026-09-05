import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { withPrivilegedDbAccess, notificationOutbox } from '@maralito/db';
import { getServerEnv } from '@/server/env';
import { secretOk } from '@/server/automation-auth';
import { decideOutboxStatus, isCallbackStatus } from '@/server/notification-status';
import { writeAudit } from '@/server/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // node crypto (constant-time compare) + privileged DB — never edge

/**
 * Phase 8C.2 — delivery-status callback (n8n / provider → app). Reports the outcome of one
 * `notification_outbox` row: `delivered | delivery_delayed | bounced | complained | failed`.
 *
 * FAILS CLOSED on the shared secret (constant-time compare of `x-borderpass-secret` vs
 * `N8N_WEBHOOK_SECRET`). Updates only the addressed row via the privileged path (RLS untouched), and
 * is IDEMPOTENT + NON-REGRESSING per `decideOutboxStatus`: re-reporting the same status is a no-op,
 * and a terminal state won't regress to a different one (409). Carries no PII — only the opaque row id
 * and a status enum. Advancing rows also arrive via the signed Resend webhook (8C.3); this endpoint is
 * the provider-agnostic path for statuses relayed through the automation layer.
 */
export async function POST(req: Request): Promise<Response> {
  const env = getServerEnv();
  if (!secretOk(req.headers.get('x-borderpass-secret'), env.N8N_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { id?: unknown; status?: unknown };
  try {
    body = (await req.json()) as { id?: unknown; status?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  if (!isCallbackStatus(body.status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }
  const requested = body.status;

  let outcome:
    | { kind: 'not_found' }
    | { kind: 'noop' }
    | { kind: 'conflict'; from: string }
    | {
        kind: 'updated';
        from: string;
      };
  try {
    outcome = await withPrivilegedDbAccess('notifications.status_callback', async (db) => {
      const row = (
        await db
          .select({ status: notificationOutbox.status })
          .from(notificationOutbox)
          .where(eq(notificationOutbox.id, id))
          .limit(1)
      )[0];
      if (!row) return { kind: 'not_found' as const };

      const decision = decideOutboxStatus(row.status, requested);
      if (decision.kind === 'noop') return { kind: 'noop' as const };
      if (decision.kind === 'conflict') return { kind: 'conflict' as const, from: decision.from };

      await db
        .update(notificationOutbox)
        .set({ status: decision.status, lastEventAt: new Date(), updatedAt: new Date() })
        .where(eq(notificationOutbox.id, id));
      return { kind: 'updated' as const, from: row.status };
    });
  } catch {
    return NextResponse.json({ error: 'internal_error' }, { status: 503 }); // retryable
  }

  switch (outcome.kind) {
    case 'not_found':
      return NextResponse.json({ status: 'not_found' }, { status: 404 });
    case 'noop':
      return NextResponse.json({ status: 'idempotent' }, { status: 200 });
    case 'conflict':
      await writeAudit({
        action: 'notifications.status_conflict',
        entityType: 'notification_outbox',
        entityId: id,
        metadata: { from: outcome.from, requested },
      });
      return NextResponse.json({ status: 'conflict', from: outcome.from }, { status: 409 });
    case 'updated':
      await writeAudit({
        action: 'notifications.status_update',
        entityType: 'notification_outbox',
        entityId: id,
        metadata: { from: outcome.from, to: requested },
      });
      return NextResponse.json({ status: 'updated' }, { status: 200 });
  }
}
