/**
 * Phase 4 (ADR-0010) — payment initiation idempotency at the DB level (PGlite). Proves the
 * `onConflictDoNothing((provider, idempotency_key))` + re-read "adopt the winner" hardening that
 * initiateQuotePayment relies on: a concurrent duplicate insert creates NO second row and the loser
 * reads back the existing payment. No Stripe required.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

let db: PGlite;
const q = (sql: string, p: unknown[] = []) => db.query(sql, p).then((r) => r.rows as Record<string, unknown>[]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create table payments(
      id text primary key, org_id text not null, customer_id text not null, order_id text not null,
      quote_id text not null, provider text not null default 'stripe', status text not null default 'requires_payment',
      amount_minor int not null, currency text not null default 'USD', idempotency_key text not null,
      stripe_payment_intent_id text, created_at timestamptz default now(), updated_at timestamptz default now());
    create unique index payments_provider_key_uq on payments(provider, idempotency_key);
  `);
});

describe('payment initiation idempotency (DB-level adopt-the-winner)', () => {
  it('first initiation inserts a row', async () => {
    const inserted = await q(`insert into payments(id,org_id,customer_id,order_id,quote_id,amount_minor,idempotency_key,stripe_payment_intent_id)
      values('pay_winner','org_a','cust_a','ord_a','qte_a',10000,'pi_qte_a','pi_1')
      on conflict (provider, idempotency_key) do nothing returning id`);
    expect(inserted).toEqual([{ id: 'pay_winner' }]);
  });

  it('concurrent duplicate insert is a no-op (returns nothing); loser re-reads the existing row', async () => {
    const inserted = await q(`insert into payments(id,org_id,customer_id,order_id,quote_id,amount_minor,idempotency_key,stripe_payment_intent_id)
      values('pay_loser','org_a','cust_a','ord_a','qte_a',10000,'pi_qte_a','pi_1')
      on conflict (provider, idempotency_key) do nothing returning id`);
    expect(inserted).toEqual([]); // no second row created

    const winner = await q(`select id from payments where provider='stripe' and idempotency_key='pi_qte_a'`);
    expect(winner).toEqual([{ id: 'pay_winner' }]); // loser adopts the winner
  });

  it('exactly one payment row exists for the quote', async () => {
    const all = await q(`select count(*)::int as n from payments where idempotency_key='pi_qte_a'`);
    expect(all[0]).toEqual({ n: 1 });
  });
});
