/**
 * Phase 6 (ADR-0012) — notification_outbox LIFECYCLE rows (inspection/delivery milestones) on real
 * Postgres (PGlite): idempotency + RLS (customer own-read, no customer write, cross-org, missing claims),
 * applying the REAL policies.sql + notifications-policies.sql. References + queue metadata only; no PII.
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
    create table notification_outbox(id text primary key, org_id text not null, customer_id text not null, order_id text not null, payment_id text, inspection_id text, delivery_prep_id text, channel text not null, template_key text not null, status text not null default 'queued', idempotency_key text not null, created_at timestamptz default now(), updated_at timestamptz default now());
    create unique index notification_outbox_idem_uq on notification_outbox(idempotency_key);
    create role authenticated nologin;
    grant usage on schema public, auth to authenticated;
    grant select, insert, update on all tables in schema public to authenticated;
    grant execute on all functions in schema auth to authenticated;
  `);
  await db.exec(readFileSync(new URL('../src/rls/policies.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../src/rls/notifications-policies.sql', import.meta.url), 'utf8'));
  await db.exec('grant execute on all functions in schema public to authenticated;');
  await db.exec(`
    insert into organizations(id,name) values('org_a','A');
    insert into user_identities(id,auth_user_id,org_id) values('uid_a','${A}','org_a'),('uid_b','${B}','org_a'),('uid_ops','${OPS}','org_a');
    insert into customer_profiles(id,auth_user_id,org_id,display_name) values('cust_a','${A}','org_a','A'),('cust_b','${B}','org_a','B');
    insert into staff_profiles(id,auth_user_id,org_id,display_name) values('staff_ops','${OPS}','org_a','Ops');
    insert into user_roles(id,auth_user_id,org_id,role_key) values('ur_a','${A}','org_a','customer'),('ur_b','${B}','org_a','customer'),('ur_ops','${OPS}','org_a','operations_manager');
    insert into notification_outbox(id,org_id,customer_id,order_id,inspection_id,channel,template_key,idempotency_key) values('nob_i','org_a','cust_a','ord_a','insp_a','lifecycle_placeholder','inspection_update','inspection_update:insp_a:passed');
    insert into notification_outbox(id,org_id,customer_id,order_id,delivery_prep_id,channel,template_key,idempotency_key) values('nob_d','org_a','cust_a','ord_a','dlp_a','lifecycle_placeholder','delivery_update','delivery_update:dlp_a:scheduled');
  `);
});

describe('notification_outbox lifecycle idempotency', () => {
  it('duplicate inspection milestone enqueue is a no-op (one per inspection+status)', async () => {
    const dup = await rows("insert into notification_outbox(id,org_id,customer_id,order_id,inspection_id,channel,template_key,idempotency_key) values('nob_i2','org_a','cust_a','ord_a','insp_a','lifecycle_placeholder','inspection_update','inspection_update:insp_a:passed') on conflict (idempotency_key) do nothing returning id");
    expect(dup).toEqual([]);
    expect((await rows("select count(*)::int n from notification_outbox where idempotency_key='inspection_update:insp_a:passed'"))[0]).toEqual({ n: 1 });
  });
  it('a different status is a distinct row', async () => {
    await rows("insert into notification_outbox(id,org_id,customer_id,order_id,inspection_id,channel,template_key,idempotency_key) values('nob_i3','org_a','cust_a','ord_a','insp_a','lifecycle_placeholder','inspection_update','inspection_update:insp_a:failed') on conflict (idempotency_key) do nothing");
    expect((await rows("select count(*)::int n from notification_outbox where inspection_id='insp_a'"))[0]).toEqual({ n: 2 });
  });
});

describe('notification_outbox lifecycle RLS', () => {
  it('customer A reads own lifecycle rows', async () =>
    expect((await asTenant(A, () => rows("select template_key from notification_outbox where customer_id='cust_a' order by template_key"))).length).toBeGreaterThanOrEqual(2));
  it('customer B sees none', async () =>
    expect(await asTenant(B, () => rows('select * from notification_outbox'))).toHaveLength(0));
  it('staff/ops reads org rows', async () =>
    expect((await asTenant(OPS, () => rows('select id from notification_outbox'))).length).toBeGreaterThanOrEqual(2));
  it('customer CANNOT insert a lifecycle row (no write policy → rejected)', async () => {
    await expect(asTenant(A, () => rows(
      "insert into notification_outbox(id,org_id,customer_id,order_id,inspection_id,channel,template_key,idempotency_key) values('nob_hack','org_a','cust_a','ord_a','insp_a','lifecycle_placeholder','inspection_update','inspection_update:hack:x') returning id",
    ))).rejects.toThrow();
  });
  it('missing claims → no rows', async () =>
    expect(await asTenant(null, () => rows('select * from notification_outbox'))).toHaveLength(0));
});
