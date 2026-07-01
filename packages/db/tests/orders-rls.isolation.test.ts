/**
 * Phase 2 (ADR-0008) — Orders-domain RLS isolation on real Postgres (PGlite), applying the REAL
 * foundation policies.sql + orders-policies.sql. Extends the hardened pattern to order tables.
 * Proves the Supabase deployment NOTHING — that is the live gate (PENDING).
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
    if (sub) await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub, role: 'authenticated' })]);
    await db.query('set local role authenticated');
    return await fn();
  } finally { await db.query('commit').catch(() => {}); }
}
const rows = (sql: string, p: unknown[] = []) => db.query(sql, p).then((r) => r.rows as Record<string, unknown>[]);

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
    create role authenticated nologin;
    grant usage on schema public, auth to authenticated;
    grant select, insert, update on all tables in schema public to authenticated;
    grant execute on all functions in schema auth to authenticated;
  `);
  await db.exec(readFileSync(new URL('../src/rls/policies.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../src/rls/orders-policies.sql', import.meta.url), 'utf8'));
  await db.exec('grant execute on all functions in schema public to authenticated;');
  await db.exec(`
    insert into organizations(id,name) values('org_a','A');
    insert into user_identities(id,auth_user_id,org_id) values('uid_a','${A}','org_a'),('uid_b','${B}','org_a'),('uid_ops','${OPS}','org_a');
    insert into customer_profiles(id,auth_user_id,org_id,display_name) values('cust_a','${A}','org_a','A'),('cust_b','${B}','org_a','B');
    insert into staff_profiles(id,auth_user_id,org_id,display_name) values('staff_ops','${OPS}','org_a','Ops');
    insert into user_roles(id,auth_user_id,org_id,role_key) values('ur_a','${A}','org_a','customer'),('ur_b','${B}','org_a','customer'),('ur_ops','${OPS}','org_a','operations_manager');
    insert into orders(id,order_ref,customer_id,org_id,service_type,correlation_id) values('ord_a','BP-0001','cust_a','org_a','buy_for_me','ord_a'),('ord_b','BP-0002','cust_b','org_a','buy_for_me','ord_b');
    insert into order_items(id,order_id,description,unit_value) values('itm_a','ord_a','Item A','{"amount_minor":1500,"currency":"USD"}'),('itm_b','ord_b','Item B','{"amount_minor":2500,"currency":"USD"}');
  `);
});

describe('orders RLS isolation (real policies + orders-policies on PGlite)', () => {
  it('customer A sees only own order', async () =>
    expect(await asTenant(A, () => rows('select id from orders'))).toEqual([{ id: 'ord_a' }]));
  it('customer A cannot read B order or items', async () => {
    expect(await asTenant(A, () => rows("select * from orders where id='ord_b'"))).toHaveLength(0);
    expect(await asTenant(A, () => rows("select * from order_items where order_id='ord_b'"))).toHaveLength(0);
  });
  it('ops (staff) sees all org orders', async () =>
    expect(await asTenant(OPS, () => rows('select id from orders order by id'))).toHaveLength(2));
  it('missing claims → no orders', async () =>
    expect(await asTenant(null, () => rows('select * from orders'))).toHaveLength(0));
  it('customer A cannot insert an order for customer B (with check)', async () => {
    await expect(asTenant(A, () => db.query(
      "insert into orders(id,order_ref,customer_id,org_id,service_type,correlation_id) values('ord_x','BP-9','cust_b','org_a','buy_for_me','ord_x')",
    ))).rejects.toThrow();
  });
});
