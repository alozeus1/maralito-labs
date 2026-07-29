/**
 * LEGAL REVIEW REQUIRED (surrounding policy) — consent-evidence RLS isolation on real Postgres
 * (PGlite), applying the REAL policies.sql + consents-policies.sql. Follows the hardened pattern of
 * orders-rls.isolation.test.ts.
 *
 * What this proves: the consent ledger is readable ONLY by its subject, invisible to staff, and
 * IMMUTABLE and INSERT-PROOF from the tenant role — so a consent record cannot be forged, altered,
 * or erased from the browser. What it proves about the live Supabase deployment: NOTHING. That is
 * the live gate (PENDING) — see docs/phase-7/live-gate-runbook.md.
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
    create table consent_records(id text primary key, org_id text not null, auth_user_id uuid not null, consent_type text not null, document_version text not null, document_locale text not null, granted boolean not null, source text not null, idempotency_key text not null, recorded_at timestamptz default now() not null, created_at timestamptz default now() not null);
    create unique index consent_records_idem_uq on consent_records(idempotency_key);
    create role authenticated nologin;
    grant usage on schema public, auth to authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant execute on all functions in schema auth to authenticated;
  `);
  await db.exec(readFileSync(new URL('../src/rls/policies.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../src/rls/consents-policies.sql', import.meta.url), 'utf8'));
  await db.exec('grant execute on all functions in schema public to authenticated;');
  await db.exec(`
    insert into organizations(id,name) values('org_a','A');
    insert into user_identities(id,auth_user_id,org_id) values('uid_a','${A}','org_a'),('uid_b','${B}','org_a'),('uid_ops','${OPS}','org_a');
    insert into customer_profiles(id,auth_user_id,org_id,display_name) values('cust_a','${A}','org_a','A'),('cust_b','${B}','org_a','B');
    insert into staff_profiles(id,auth_user_id,org_id,display_name) values('staff_ops','${OPS}','org_a','Ops');
    insert into user_roles(id,auth_user_id,org_id,role_key) values('ur_a','${A}','org_a','customer'),('ur_b','${B}','org_a','customer'),('ur_ops','${OPS}','org_a','operations_manager');
    insert into consent_records(id,org_id,auth_user_id,consent_type,document_version,document_locale,granted,source,idempotency_key) values
      ('csn_a1','org_a','${A}','terms_of_service','terms-2026-07-28','es',true,'sign_up','sign_up:${A}:terms_of_service:terms-2026-07-28'),
      ('csn_a2','org_a','${A}','marketing_communications','privacy-2026-07-28','es',false,'sign_up','sign_up:${A}:marketing_communications:privacy-2026-07-28'),
      ('csn_b1','org_a','${B}','terms_of_service','terms-2026-07-28','en',true,'sign_up','sign_up:${B}:terms_of_service:terms-2026-07-28');
  `);
});

describe('consent_records RLS isolation (real policies + consents-policies on PGlite)', () => {
  it('the subject reads their OWN consent history only', async () => {
    const ids = await asTenant(A, () => rows('select id from consent_records order by id'));
    expect(ids).toEqual([{ id: 'csn_a1' }, { id: 'csn_a2' }]);
  });

  it('a customer cannot read another customer’s consent records', async () => {
    expect(
      await asTenant(A, () => rows(`select * from consent_records where auth_user_id='${B}'`)),
    ).toHaveLength(0);
  });

  it('staff have NO policy and therefore see no consent records', async () => {
    expect(await asTenant(OPS, () => rows('select id from consent_records'))).toHaveLength(0);
  });

  it('missing claims → no consent records', async () => {
    expect(await asTenant(null, () => rows('select * from consent_records'))).toHaveLength(0);
  });

  it('a tenant cannot INSERT a consent record (privileged server seam only)', async () => {
    await expect(
      asTenant(A, () =>
        db.query(
          `insert into consent_records(id,org_id,auth_user_id,consent_type,document_version,document_locale,granted,source,idempotency_key) values('csn_x','org_a','${A}','marketing_communications','privacy-2026-07-28','es',true,'sign_up','forged')`,
        ),
      ),
    ).rejects.toThrow();
  });

  it('consent records are IMMUTABLE: a tenant cannot UPDATE their own row', async () => {
    await expect(
      asTenant(A, () => db.query("update consent_records set granted=false where id='csn_a1'")),
    ).rejects.toThrow();
    expect(
      await asTenant(A, () => rows("select granted from consent_records where id='csn_a1'")),
    ).toEqual([{ granted: true }]);
  });

  it('consent records are IMMUTABLE: a tenant cannot DELETE their own row', async () => {
    await expect(
      asTenant(A, () => db.query("delete from consent_records where id='csn_a1'")),
    ).rejects.toThrow();
    expect(await asTenant(A, () => rows('select id from consent_records'))).toHaveLength(2);
  });

  it('duplicate sign-up evidence is rejected by the idempotency key', async () => {
    await expect(
      db.query(
        `insert into consent_records(id,org_id,auth_user_id,consent_type,document_version,document_locale,granted,source,idempotency_key) values('csn_dup','org_a','${A}','terms_of_service','terms-2026-07-28','es',true,'sign_up','sign_up:${A}:terms_of_service:terms-2026-07-28')`,
      ),
    ).rejects.toThrow();
  });

  it('a withdrawal is a NEW row (append-only), leaving the original grant intact', async () => {
    await db.query(
      `insert into consent_records(id,org_id,auth_user_id,consent_type,document_version,document_locale,granted,source,idempotency_key) values('csn_a3','org_a','${A}','marketing_communications','privacy-2026-07-28','es',true,'profile_settings','profile_settings:${A}:marketing_communications:evt_1')`,
    );
    const history = await asTenant(A, () =>
      rows(
        "select id,granted from consent_records where consent_type='marketing_communications' order by id",
      ),
    );
    expect(history).toEqual([
      { id: 'csn_a2', granted: false },
      { id: 'csn_a3', granted: true },
    ]);
  });
});
