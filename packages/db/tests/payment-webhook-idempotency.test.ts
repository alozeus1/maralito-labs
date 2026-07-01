/**
 * Phase 4 (ADR-0010) — Stripe webhook idempotency ledger semantics on real Postgres (PGlite).
 * Proves the unique stripe_event_id + onConflictDoNothing behavior the webhook route relies on.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

let db: PGlite;
const q = (sql: string, p: unknown[] = []) => db.query(sql, p).then((r) => r.rows as Record<string, unknown>[]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create table stripe_webhook_events(
      id text primary key, stripe_event_id text not null unique, event_type text not null,
      api_version text, livemode boolean default false, processing_status text default 'received',
      processed_at timestamptz, error_message text, created_at timestamptz default now());
  `);
});

describe('webhook idempotency ledger', () => {
  it('duplicate stripe_event_id insert is a no-op (onConflictDoNothing)', async () => {
    await q("insert into stripe_webhook_events(id,stripe_event_id,event_type) values('swe1','evt_x','payment_intent.succeeded') on conflict (stripe_event_id) do nothing");
    await q("insert into stripe_webhook_events(id,stripe_event_id,event_type) values('swe2','evt_x','payment_intent.succeeded') on conflict (stripe_event_id) do nothing");
    const rows = await q("select id from stripe_webhook_events where stripe_event_id='evt_x'");
    expect(rows).toEqual([{ id: 'swe1' }]); // first write wins; duplicate ignored
  });

  it('a re-delivered event is detectable as already processed (status != received)', async () => {
    await q("update stripe_webhook_events set processing_status='completed', processed_at=now() where stripe_event_id='evt_x'");
    const rows = await q("select processing_status from stripe_webhook_events where stripe_event_id='evt_x'");
    expect(rows[0]).toEqual({ processing_status: 'completed' });
  });
});
