/**
 * Cross-tenant RLS isolation test — runs against real embedded Postgres (PGlite) and applies the
 * **real** packages/db/src/rls/policies.sql (read from disk). It fails on any syntax error or policy
 * mismatch in the actual policy file. Proves the real POLICY FILE works under Postgres — NOT the
 * Supabase deployment (that is the live gate; see docs/phase-1.6/live-supabase-rls-gate.md).
 *
 * The table DDL below mirrors the Drizzle schema columns the policies reference. (Full schema parity
 * with drizzle-kit is a real-env step; this guarantees policies.sql is valid + enforcing.)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const INS = '00000000-0000-4000-8000-0000000000c1';
const CMP = '00000000-0000-4000-8000-0000000000c2';
const SUP = '00000000-0000-4000-8000-0000000000c3';
const ORPHAN = '00000000-0000-4000-8000-0000000000ff';
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
  // 1) Supabase-provided shims (auth.uid()/auth.role()) — present in real Supabase.
  // 2) Real schema columns the policies reference.
  await db.exec(`
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(nullif(current_setting('request.jwt.claims',true),'')::json->>'sub','')::uuid $$;
    create function auth.role() returns text language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims',true),'')::json->>'role','anon') $$;
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
    create role authenticated nologin;
    grant usage on schema public, auth to authenticated;
    grant select, insert, update on all tables in schema public to authenticated;
    grant execute on all functions in schema auth to authenticated;
  `);

  // 3) Apply the REAL policy file (fails the test if it has errors).
  const policies = readFileSync(new URL('../src/rls/policies.sql', import.meta.url), 'utf8');
  await db.exec(policies);
  await db.exec('grant execute on all functions in schema public to authenticated;');

  // seed
  await db.exec(`
    insert into organizations(id,name) values('org_a','A');
    insert into user_identities(id,auth_user_id,org_id) values('uid_a','${A}','org_a'),('uid_b','${B}','org_a'),('uid_ins','${INS}','org_a'),('uid_cmp','${CMP}','org_a'),('uid_sup','${SUP}','org_a');
    insert into customer_profiles(id,auth_user_id,org_id,display_name) values('cust_a','${A}','org_a','Maria A'),('cust_b','${B}','org_a','Bob B');
    insert into staff_profiles(id,auth_user_id,org_id,display_name) values('staff_s','${INS}','org_a','Inspector S');
    insert into user_roles(id,auth_user_id,org_id,role_key) values('ur_a','${A}','org_a','customer'),('ur_ins','${INS}','org_a','inspector'),('ur_cmp','${CMP}','org_a','compliance_admin'),('ur_sup','${SUP}','org_a','super_admin'),('ur_orphan','${ORPHAN}','org_a','compliance_admin');
    insert into audit_logs(id,org_id,action) values('aud_1','org_a','order.reject');
  `);
});

describe('cross-tenant RLS isolation (real policies.sql on PGlite)', () => {
  it('1. user A cannot read user B customer profile', async () =>
    expect(await asTenant(A, () => rows('select auth_user_id from customer_profiles'))).toEqual([{ auth_user_id: A }]));
  it('2. customer cannot read staff profile', async () =>
    expect(await asTenant(A, () => rows('select * from staff_profiles'))).toHaveLength(0));
  it('3. non-admin staff cannot read audit; compliance can', async () => {
    expect(await asTenant(INS, () => rows('select * from audit_logs'))).toHaveLength(0);
    expect(await asTenant(CMP, () => rows('select * from audit_logs'))).toHaveLength(1);
  });
  it('4. super_admin sees all roles; others only own', async () => {
    expect(await asTenant(SUP, () => rows('select * from user_roles'))).toHaveLength(5);
    expect(await asTenant(INS, () => rows('select * from user_roles'))).toHaveLength(1);
  });
  it('5. missing claims denied', async () =>
    expect(await asTenant(null, () => rows('select * from customer_profiles'))).toHaveLength(0));
  it('6. missing org context denied where required', async () =>
    expect(await asTenant(ORPHAN, () => rows('select * from audit_logs'))).toHaveLength(0));
  it('7. RLS backstops missing app filter', async () =>
    expect(await asTenant(A, () => rows('select * from customer_profiles'))).toHaveLength(1));
  it('8. privileged path (superuser) bypasses RLS by design', async () =>
    expect(await rows('select * from customer_profiles')).toHaveLength(2));
  it('9. duplicate user_roles rejected by unique constraint', async () => {
    await expect(db.query('insert into user_roles(id,auth_user_id,org_id,role_key) values($1,$2,$3,$4)', ['dup', A, 'org_a', 'customer'])).rejects.toThrow();
  });
});
