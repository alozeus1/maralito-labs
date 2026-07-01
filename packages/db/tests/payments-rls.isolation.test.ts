/**
 * Phase 4 (ADR-0010) — Payments-domain RLS isolation on real Postgres (PGlite), applying the REAL
 * policies.sql + orders-policies.sql + quotes-policies.sql + payments-policies.sql. Proves the policy
 * files under Postgres, NOT the Supabase deployment (live gate PENDING).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const OPS = '00000000-0000-4000-8000-0000000000d1';
let db: PGlite;

async function asTenant<T>(sub: string | null, fn: () => Promise<T>): Promise<T> {
  await db.query('begin');
  try {
    if (sub)
      await db.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({ sub, role: 'authenticated' }),
      ]);
    await db.query('set local role authenticated');
    return await fn();
  } finally {
    await db.query('commit').catch(() => {});
  }
}
const rows = (sql: string, p: unknown[] = []) =>
  db.query(sql, p).then((r) => r.rows as Record<string, unknown>[]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(nullif(current_setting('request.jwt.claims',true),'')::json->>'sub','')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::json->>'role','anon') $$;
    create table organizations(id text primary key, name text, type text, status text, created_at timestamptz default now());
    create table user_identities(id text primary key, auth_user_id uuid unique not null, org_id text not null, status text, created_at timestamptz default now());
    create table customer_profiles(id text primary key, auth_user_id uuid unique not null, org_id text not null, display_name text, language text, notification_prefs jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
    create table staff_profiles(id text primary key, auth_user_id uuid unique not null, org_id text not null, display_name text, role_keys jsonb, status text, created_at timestamptz default now(), updated_at timestamptz default now());
    create table roles(key text primary key, name text, scope text);
    create table permissions(key text primary key, description text);
    create table role_permissions(role_key text, permission_key text, primary key(role_key, permission_key));
    create table user_roles(id text primary key, auth_user_id uuid not null, org_id text not null, role_key text not null, assigned_by uuid, assigned_at timestamptz default now(), unique(auth_user_id, org_id, role_key));
    create table audit_logs(id text primary key, org_id text, actor_user_id uuid, actor_role text, action text, entity_type text, entity_id text, before jsonb, after jsonb, metadata jsonb, ip_address text, user_agent text, created_at timestamptz default now());
    create table platform_config(key text primary key, value jsonb, updated_at timestamptz default now());
    create table feature_flags(key text primary key, enabled boolean default false, description text, updated_at timestamptz default now());
    create table orders(id text primary key, order_ref text not null, customer_id text not null, org_id text not null, service_type text, status text default 'draft', purpose text, declared_value jsonb, risk_band text, current_quote_id text, delivery_address_id text, hub_address_id text, correlation_id text not null, workflow_run_id text, submitted_at timestamptz, cancelled_reason text, created_at timestamptz default now(), updated_at timestamptz default now());
    create table order_items(id text primary key, order_id text not null, description text, product_url text, quantity int default 1, variant text, unit_value jsonb, category text, restriction_flags jsonb, created_at timestamptz default now());
    create table quotes(id text primary key, order_id text not null, customer_id text not null, org_id text not null, status text default 'draft', version int default 1, currency text default 'USD', subtotal_minor int default 0, service_fee_minor int default 0, delivery_fee_minor int default 0, estimated_tax_minor int default 0, inspection_fee_minor int default 0, discount_minor int default 0, total_minor int default 0, requires_approval boolean default false, expires_at timestamptz, approved_by uuid, approved_at timestamptz, sent_at timestamptz, accepted_at timestamptz, declined_at timestamptz, decline_reason text, internal_notes text, customer_message text, created_at timestamptz default now(), updated_at timestamptz default now());
    create table quote_line_items(id text primary key, quote_id text not null, kind text, description text, quantity int default 1, unit_amount_minor int, total_amount_minor int, currency text, taxable boolean default false, customer_visible boolean default true, internal_only boolean default false, metadata jsonb, created_at timestamptz default now());
    create table quote_status_history(id text primary key, quote_id text not null, from_status text, to_status text, actor_user_id uuid, actor_role text, reason text, created_at timestamptz default now());
    create table quote_approvals(id text primary key, quote_id text not null, approver_id uuid, decision text, reason text, metadata jsonb, created_at timestamptz default now());
    create table payments(id text primary key, org_id text not null, customer_id text not null, order_id text not null, quote_id text not null, provider text default 'stripe', status text default 'requires_payment', amount_minor int not null, currency text default 'USD', stripe_customer_id text, stripe_payment_intent_id text, stripe_checkout_session_id text, idempotency_key text not null, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
    create table payment_events(id text primary key, org_id text not null, payment_id text not null, order_id text not null, quote_id text not null, event_type text, from_status text, to_status text, provider text default 'stripe', provider_event_id text, payload_summary jsonb, created_at timestamptz default now());
    create table stripe_webhook_events(id text primary key, stripe_event_id text not null, event_type text not null, api_version text, livemode boolean default false, processing_status text default 'received', processed_at timestamptz, error_message text, created_at timestamptz default now());
    create table refunds(id text primary key, org_id text not null, payment_id text not null, stripe_refund_id text, amount_minor int not null, currency text default 'USD', status text default 'placeholder', reason text, created_at timestamptz default now(), updated_at timestamptz default now());
    create role authenticated nologin;
    grant usage on schema public, auth to authenticated;
    grant select, insert, update on all tables in schema public to authenticated;
    grant execute on all functions in schema auth to authenticated;
  `);
  await db.exec(readFileSync(new URL('../src/rls/policies.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../src/rls/orders-policies.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../src/rls/quotes-policies.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../src/rls/payments-policies.sql', import.meta.url), 'utf8'));
  await db.exec('grant execute on all functions in schema public to authenticated;');
  await db.exec(`
    insert into organizations(id,name) values('org_a','A');
    insert into user_identities(id,auth_user_id,org_id) values('uid_a','${A}','org_a'),('uid_b','${B}','org_a'),('uid_ops','${OPS}','org_a');
    insert into customer_profiles(id,auth_user_id,org_id,display_name) values('cust_a','${A}','org_a','A'),('cust_b','${B}','org_a','B');
    insert into staff_profiles(id,auth_user_id,org_id,display_name) values('staff_ops','${OPS}','org_a','Ops');
    insert into user_roles(id,auth_user_id,org_id,role_key) values('ur_a','${A}','org_a','customer'),('ur_b','${B}','org_a','customer'),('ur_ops','${OPS}','org_a','operations_manager');
    insert into orders(id,order_ref,customer_id,org_id,service_type,status,correlation_id) values('ord_a','BP-1','cust_a','org_a','buy_for_me','awaiting_payment','ord_a'),('ord_b','BP-2','cust_b','org_a','buy_for_me','awaiting_payment','ord_b');
    insert into quotes(id,order_id,customer_id,org_id,status,total_minor) values('qte_a','ord_a','cust_a','org_a','accepted',10000),('qte_b','ord_b','cust_b','org_a','accepted',20000);
    insert into payments(id,org_id,customer_id,order_id,quote_id,status,amount_minor,currency,idempotency_key,stripe_payment_intent_id) values
      ('pay_a','org_a','cust_a','ord_a','qte_a','requires_payment',10000,'USD','pi_qte_a','pi_a'),
      ('pay_b','org_a','cust_b','ord_b','qte_b','requires_payment',20000,'USD','pi_qte_b','pi_b');
    insert into payment_events(id,org_id,payment_id,order_id,quote_id,event_type,to_status) values('pme_a','org_a','pay_a','ord_a','qte_a','payment.intent_created','requires_payment');
    insert into stripe_webhook_events(id,stripe_event_id,event_type) values('swe_a','evt_a','payment_intent.succeeded');
    insert into refunds(id,org_id,payment_id,amount_minor) values('ref_a','org_a','pay_a',0);
  `);
});

describe('payments RLS isolation (real policy files on PGlite)', () => {
  it('customer A sees own payment, not B', async () => {
    expect(await asTenant(A, () => rows('select id from payments'))).toEqual([{ id: 'pay_a' }]);
    expect(await asTenant(A, () => rows("select * from payments where id='pay_b'"))).toHaveLength(
      0,
    );
  });
  it('staff/ops sees all org payments', async () =>
    expect(await asTenant(OPS, () => rows('select id from payments order by id'))).toHaveLength(2));
  it('customer cannot UPDATE a payment (no write policy → 0 rows affected)', async () => {
    const updated = await asTenant(A, () =>
      rows("update payments set status='succeeded' where id='pay_a' returning id"),
    );
    expect(updated).toHaveLength(0);
    // confirm status is unchanged when read back as staff
    const after = await asTenant(OPS, () => rows("select status from payments where id='pay_a'"));
    expect(after[0]).toEqual({ status: 'requires_payment' });
  });
  it('customer cannot read the stripe_webhook_events ledger; neither can staff (privileged-only)', async () => {
    expect(await asTenant(A, () => rows('select * from stripe_webhook_events'))).toHaveLength(0);
    expect(await asTenant(OPS, () => rows('select * from stripe_webhook_events'))).toHaveLength(0);
  });
  it('customer cannot read payment_events; staff can (org-scoped)', async () => {
    expect(await asTenant(A, () => rows('select * from payment_events'))).toHaveLength(0);
    expect(await asTenant(OPS, () => rows('select id from payment_events'))).toHaveLength(1);
  });
  it('customer reads own refund; staff reads org refunds', async () => {
    expect(await asTenant(A, () => rows('select id from refunds'))).toEqual([{ id: 'ref_a' }]);
    expect(await asTenant(B, () => rows('select * from refunds'))).toHaveLength(0);
    expect(await asTenant(OPS, () => rows('select id from refunds'))).toHaveLength(1);
  });
  it('missing claims → no payments', async () =>
    expect(await asTenant(null, () => rows('select * from payments'))).toHaveLength(0));
});
