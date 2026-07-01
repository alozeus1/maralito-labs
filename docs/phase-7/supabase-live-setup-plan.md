# Phase 7 — Live Supabase Setup Plan (Operator Prep)

> ADR-0013 · **PLAN ONLY — DO NOT EXECUTE WITHOUT OPERATOR APPROVAL.**
>
> This checklist prepares a dedicated Supabase project for the Phase 7 live gates. It does not mark
> any gate passed and does not establish staging, pilot, production, real-payment, or real-PII
> readiness. Use synthetic records and an operator-controlled throwaway email only. Never use real
> customer data.
>
> Source documents: `live-gate-runbook.md`, `gate-ledger.md`,
> `deployment-readiness-checklist.md`, `env-secrets-review.md`, and
> `../current-build-state.md`.

---

## 0. Stop conditions found during plan preparation

Resolve these repository issues before an operator runs the live setup:

1. **No versioned migrations exist.** `packages/db/migrations/` is empty. As currently committed,
   `pnpm --filter @maralito/db db:migrate` has no schema migration to apply. Generate and review a
   baseline migration in development, commit it, and only then target the live-gate project.
2. **Use Node 22.** The root `package.json` requires `node >=22 <23`. The runbook and
   `.github/workflows/live-gates.yml` currently specify Node 20 and must be corrected before relying
   on CI evidence.
3. **The manual live-gates workflow is incomplete.** It runs `db:migrate` and `gate:rls`, but does
   not apply the seven RLS SQL files. It cannot prepare a fresh project end to end.
4. **Use the script's real success signal.** The current `live-rls-gate.ts` performs 13 checks and
   ends with `13 passed, 0 failed`. It does not print the literal text `ALL PASS`.
5. **Root `.env.local` is not automatically loaded by the database CLI scripts.** Source it into
   the operator shell before migration, seed, and gate commands. The Next.js app needs its own
   `apps/borderpass/.env.local`.

Until these are resolved, ledger rows 6–11 and 18 remain **UNRUN**.

---

## 1. Recommended execution model

Use a new, disposable Supabase project named `borderpass-phase7-livegate`. It must not be a future
staging or production project.

Prepare it in this order:

1. Resolve the stop conditions in §0.
2. Create the Supabase project and configure Auth redirect URLs.
3. store connection strings and API keys outside Git;
4. apply the reviewed, committed migration;
5. apply all seven RLS policy files in the required order;
6. apply the synthetic development seed;
7. run the RLS gate against the direct/session connection;
8. run it again against the pooler connection intended for the Vercel runtime;
9. run the magic-link/OTP provisioning smoke;
10. record redacted evidence in the ledger.

Do not combine the first live execution with a staging or production deployment.

---

## 2. Supabase project creation checklist

- [ ] Create a new project named `borderpass-phase7-livegate`.
- [ ] Select and record the organization, project reference, region, plan, and operator.
- [ ] Generate a strong database password and store it in the approved secret manager.
- [ ] Wait for the database and Auth service to report healthy.
- [ ] In the project **Connect** dialog, capture:
  - direct connection: `db.<project-ref>.supabase.co:5432`;
  - shared-pooler session connection: `<region>.pooler.supabase.com:5432`;
  - shared-pooler transaction connection: `<region>.pooler.supabase.com:6543`.
- [ ] Capture the Project URL and a browser-safe publishable key. The code currently calls the
  variable `NEXT_PUBLIC_SUPABASE_ANON_KEY`; it may contain the project's publishable key or, while
  legacy keys remain supported, the legacy `anon` key.
- [ ] Do not collect or configure a privileged API key unless an approved server-side operation
  needs it. The current migration, seed, RLS gate, and provisioning path use `DATABASE_URL`, not the
  Supabase service-role API client.
- [ ] Under Auth URL configuration, set the local smoke-test values:
  - Site URL: `http://localhost:3000`
  - allowed redirect URL: `http://localhost:3000/auth/callback`
- [ ] Confirm email passwordless/magic-link sign-in is enabled.
- [ ] Do not enable external providers, import users, or add customer data.

Supabase currently recommends a direct connection for migrations. Direct connections require IPv6
unless the project has the IPv4 add-on. If the operator network cannot reach IPv6, use the shared
pooler in **session mode** on port 5432 for migration and policy application.

---

## 3. Required secrets and environment variables

### Required for migration, policies, seed, and RLS gate

| Variable | Exposure | Purpose |
|---|---|---|
| `DATABASE_URL` | server-only secret | Active operator connection used by Drizzle, seed, and `gate:rls` |
| `DATABASE_DIRECT_URL` | server-only operator alias | Direct or session-mode URL retained for migration/policy work; the current code does not read this name directly |
| `DATABASE_POOLER_URL` | server-only operator alias | Transaction-pooler URL intended for Vercel runtime and the second RLS-gate run |
| `DEV_ORG_ID` | non-secret synthetic ID | Shared synthetic organization created by `db:seed` |
| `BORDERPASS_DEFAULT_CUSTOMER_ORG_ID` | non-secret synthetic ID | Must equal `DEV_ORG_ID` for provisioning |

Use a synthetic ID such as `org_phase7livegate`; do not use an ID copied from customer data.

### Required for the local OTP/auth smoke

| Variable | Exposure | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser-safe | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser-safe | Supabase publishable key or legacy `anon` key |
| `DATABASE_URL` | server-only secret | Provisioning and session reads; use the connection being validated for runtime |
| `BORDERPASS_DEFAULT_CUSTOMER_ORG_ID` | server-only config | Target org for idempotent customer provisioning |
| `BORDERPASS_APP_URL` | server config | `http://localhost:3000` for this smoke |
| `BORDERPASS_ENV` | server config | `preview`; never `production` for this project |

### Not required by the current Supabase-only execution path

- `SUPABASE_SERVICE_ROLE_KEY`: present in templates and CI, but no current BorderPass live-gate or
  provisioning caller uses the service client.
- `SUPABASE_JWT_SECRET`: not used by the current app or gate.
- Stripe, notification, KMS, AI, workflow, analytics, and storage secrets.
- `SUPER_ADMIN_AUTH_USER_ID`: optional seed bootstrap; omit it for this customer-auth smoke.

If a privileged Supabase API key is later approved, use a new secret key where supported, keep it
server-only, and never place it in a `NEXT_PUBLIC_*` variable.

---

## 4. Local environment setup

Create two ignored files. Do not place values in `.env.example`.

### Root `.env.local` for operator CLI commands

```dotenv
DATABASE_DIRECT_URL='postgresql://...'
DATABASE_POOLER_URL='postgresql://...'
DATABASE_URL='postgresql://...'
DEV_ORG_ID='org_phase7livegate'
BORDERPASS_DEFAULT_CUSTOMER_ORG_ID='org_phase7livegate'
```

Before running any database command, load the file into the current zsh process:

```bash
set -a
source .env.local
set +a
```

Expected signal: `DATABASE_URL` is present in the process without printing its value. Do not use
`echo`, `env`, shell tracing, or `set -x` around secrets.

### `apps/borderpass/.env.local` for the Next.js OTP smoke

```dotenv
NEXT_PUBLIC_SUPABASE_URL='https://<project-ref>.supabase.co'
NEXT_PUBLIC_SUPABASE_ANON_KEY='<publishable-or-legacy-anon-key>'
DATABASE_URL='<runtime-pooler-url-being-validated>'
BORDERPASS_DEFAULT_CUSTOMER_ORG_ID='org_phase7livegate'
BORDERPASS_APP_URL='http://localhost:3000'
BORDERPASS_ENV='preview'
```

Both paths match the repository's `.gitignore` rule for `.env.*`. Before execution, verify that Git
does not track either file:

```bash
git check-ignore -v .env.local apps/borderpass/.env.local
git status --short
```

Expected signal: both files are reported as ignored, and neither appears as an untracked/staged file.
If this workspace still has no Git metadata, perform this check in the actual repository checkout
before creating secrets.

---

## 5. Database connection and pooler decision

Use three explicit connection roles:

| Operation | Connection |
|---|---|
| migrations and RLS SQL | direct `:5432`; shared-pooler session `:5432` only when direct IPv6 is unavailable |
| first `gate:rls` diagnostic | the same direct/session connection |
| Vercel runtime and final runtime-path gate | shared-pooler transaction `:6543` with prepared statements disabled |

The `postgres` client used by BorderPass already sets `prepare: false`. The RLS gate sets claims and
`SET LOCAL ROLE authenticated` inside a transaction, so the runtime pooler must preserve that
transaction-local behavior.

Before each operation, assign the intended URL without printing it:

```bash
export DATABASE_URL="$DATABASE_DIRECT_URL"
# later:
export DATABASE_URL="$DATABASE_POOLER_URL"
```

If direct works but the intended runtime pooler fails `SET LOCAL ROLE authenticated`, stop. Do not
mark row 10 passed and do not silently switch the app to `claims_only`. ADR-0006's fallback requires
a reviewed code change and a verified non-`BYPASSRLS` base role, followed by the full gate again.

---

## 6. Baseline migration preparation — engineering prerequisite

Run this in development only after explicit approval, before live execution:

```bash
test -n "$(find packages/db/migrations -type f -name '*.sql' -print -quit)"
```

Expected current signal: non-zero exit because the directory is empty. That is a blocker, not a live
gate failure.

Generate and review the baseline:

```bash
pnpm --filter @maralito/db db:generate
find packages/db/migrations -type f -print
git diff -- packages/db/migrations packages/db/migrations/meta
```

Required review signal:

- generated SQL creates every schema object represented by `packages/db/src/schema/index.ts`;
- no destructive `DROP`, unintended default, or production reference is present;
- migration metadata is included;
- the baseline applies cleanly to a disposable empty Postgres database;
- the reviewed migration is committed before any live operator run.

Do not point `db:generate` or an unreviewed migration at the Supabase project.

---

## 7. Apply migrations

From the repository root, after loading `.env.local`:

```bash
export DATABASE_URL="$DATABASE_DIRECT_URL"
pnpm --filter @maralito/db db:migrate
```

Expected success signals:

- `drizzle-kit migrate` exits 0 with no SQL error;
- the `drizzle.__drizzle_migrations` table contains the expected committed migration count;
- required public tables exist.

Verification SQL:

```sql
select count(*) as applied_migrations
from drizzle.__drizzle_migrations;

select to_regclass(t.name) as table_name
from unnest(array[
  'public.organizations',
  'public.user_identities',
  'public.customer_profiles',
  'public.user_roles',
  'public.orders',
  'public.quotes',
  'public.payments',
  'public.notification_outbox',
  'public.inspections',
  'public.delivery_preparations'
]) as t(name);
```

All `to_regclass` results must be non-null. This eventually provides evidence for ledger row 7.

---

## 8. Apply all seven RLS policy files

Apply foundation first, then each domain file. These files use `CREATE POLICY` and are not safe to
reapply blindly to a dirty database.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/src/rls/policies.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/src/rls/orders-policies.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/src/rls/quotes-policies.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/src/rls/payments-policies.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/src/rls/notifications-policies.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/src/rls/inspections-policies.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/src/rls/delivery-preparations-policies.sql
```

Expected success signal: every command exits 0. The committed files currently define 48 policies in
total.

Verification SQL:

```sql
select count(*) as borderpass_policy_count
from pg_policies
where schemaname = 'public';

select c.relname, c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'organizations', 'user_identities', 'customer_profiles', 'staff_profiles',
    'roles', 'permissions', 'role_permissions', 'user_roles', 'audit_logs',
    'platform_config', 'feature_flags', 'orders', 'order_items', 'quotes',
    'quote_line_items', 'quote_status_history', 'quote_approvals', 'payments',
    'payment_events', 'stripe_webhook_events', 'refunds', 'notification_outbox',
    'inspections', 'inspection_status_history', 'delivery_preparations',
    'delivery_prep_status_history'
  )
order by c.relname;
```

Expected signal: policy count is 48 on a clean dedicated project, and every listed table reports
`relrowsecurity = true`. Save the detailed `pg_policies` listing as redacted evidence. This
eventually provides evidence for ledger row 8.

---

## 9. Apply synthetic seed data

Keep `SUPER_ADMIN_AUTH_USER_ID` unset:

```bash
unset SUPER_ADMIN_AUTH_USER_ID
export DEV_ORG_ID='org_phase7livegate'
export BORDERPASS_DEFAULT_CUSTOMER_ORG_ID="$DEV_ORG_ID"
pnpm --filter @maralito/db db:seed
```

Expected output:

```text
dev seed complete: org + roles + permissions
```

Verification SQL:

```sql
select count(*) as role_count from roles;
select count(*) as org_count
from organizations
where id = 'org_phase7livegate';
```

Expected results: `role_count = 9`, `org_count = 1`. Do not record connection strings or other
secrets. This eventually provides evidence for ledger row 9.

The gate is self-seeding and rolls its own records back. The persistent development seed is needed
for the OTP provisioning path, not for the RLS script itself.

---

## 10. Execute the live RLS gate

### Direct/session diagnostic

```bash
export DATABASE_URL="$DATABASE_DIRECT_URL"
pnpm gate:rls
```

### Runtime pooler validation

```bash
export DATABASE_URL="$DATABASE_POOLER_URL"
pnpm gate:rls
```

The gate validates connection, role assumption, `auth.uid()` claims, customer isolation across six
domain surfaces, org-scoped operations access, staff-only inspection history, customer payment
write denial, and missing-claims denial.

Expected success signal for **each required connection path**:

```text
13 passed, 0 failed
```

and process exit code 0.

The script currently does not print `ALL PASS`; for ledger row 10, interpret `13 passed, 0 failed`
plus exit 0 as the concrete success signal. Any `FAIL` line or non-zero exit leaves the row UNRUN or
records a failed attempt without checking the row.

Post-run verification:

```sql
select count(*) as leaked_gate_orgs
from organizations
where id = 'org_gate';
```

Expected result: `0`. The gate wraps synthetic data in one transaction and rolls it back.

---

## 11. OTP/magic-link provisioning smoke

This application currently implements an email magic-link flow through `signInWithOtp`; it does not
present a numeric OTP-entry form.

1. Set the app environment in `apps/borderpass/.env.local` as shown in §4.
2. Start the app from the repository root:

   ```bash
   pnpm --filter borderpass dev
   ```

3. Open `http://localhost:3000/sign-up`.
4. Submit an operator-controlled throwaway email. Do not use or record a customer email.
5. Follow the received link. Expected route:
   `/auth/callback` → exchange code for session → `provisionAuthenticatedUser` → redirect to `/`.
6. Record the synthetic Auth user UUID privately; do not record the email or magic-link token.
7. Verify exactly one identity, customer role, and customer profile exist for that UUID:

   ```sql
   select
     (select count(*) from user_identities where auth_user_id = '<synthetic-auth-uuid>') as identities,
     (select count(*) from user_roles where auth_user_id = '<synthetic-auth-uuid>' and role_key = 'customer') as customer_roles,
     (select count(*) from customer_profiles where auth_user_id = '<synthetic-auth-uuid>') as customer_profiles;
   ```

8. Sign out, repeat sign-in through `/login`, and run the same query again.
9. Confirm all three counts remain `1`, the browser has a valid session, and an authenticated
   customer route resolves without cross-customer data.

Expected success signal: magic link received, callback completes, session exists, provisioning
counts are `1/1/1` before and after repeat sign-in, and no duplicate or cross-customer row appears.
This eventually provides evidence for ledger row 11.

Do not treat the redirect alone as success: the callback currently redirects even if the
provisioning helper returns a failure result, so the database counts are mandatory evidence.

---

## 12. CI and Vercel secret setup

### Recommended first execution: local operator shell

Run the first Supabase setup locally. The current `.github/workflows/live-gates.yml` must be fixed
before it can provide reliable evidence:

- change `actions/setup-node` from Node 20 to Node 22;
- add explicit ordered policy application with `psql -v ON_ERROR_STOP=1`;
- either seed explicitly or document that only the self-seeding RLS gate runs;
- add the pooler-path gate if Vercel will use the transaction pooler;
- keep OTP as a separately recorded manual step.

When corrected, GitHub Actions needs only the secrets used by its actual steps. At minimum:

- `DATABASE_URL` for migration/policy work and the first gate;
- `DATABASE_POOLER_URL` if the workflow validates the Vercel runtime path.

Public Supabase variables and `BORDERPASS_DEFAULT_CUSTOMER_ORG_ID` are needed only if CI builds or
tests a path that requires them. Do not add `SUPABASE_SERVICE_ROLE_KEY` merely because the current
workflow declares it; no current workflow step uses it.

### Vercel, only if the approved OTP smoke runs there

Do not deploy solely to complete Supabase provisioning. If an existing approved Preview deployment
is used, configure Preview scope only:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `DATABASE_URL` = transaction-pooler URL
- `BORDERPASS_DEFAULT_CUSTOMER_ORG_ID`
- `BORDERPASS_APP_URL` = exact preview origin
- `BORDERPASS_ENV=preview`

Add `<preview-origin>/auth/callback` to Supabase Auth allowed redirect URLs. Never configure this
disposable project or these secrets in Vercel Production scope.

---

## 13. Failure handling and rollback

| Failure | Required response |
|---|---|
| migration directory empty or migration review fails | Stop. Generate/review/commit a baseline; do not touch live Supabase |
| direct connection unreachable | Check IPv6 support; use shared-pooler session mode `:5432` for operator work |
| migration partially applies | Save the error, do not hand-edit the migration ledger; recreate the disposable project after correcting the migration |
| any policy file fails | Stop subsequent files; save the first error; recreate the disposable project rather than re-running non-idempotent `CREATE POLICY` statements |
| policy count/RLS flags differ | Leave row 8 unchecked; compare live catalog to the seven committed files |
| seed fails or wrong counts appear | Leave row 9 unchecked; recreate the disposable project if state is uncertain |
| direct RLS gate fails | Save the named failing assertion; correct migration/policy/role configuration; rerun all checks |
| direct passes but runtime pooler fails | Do not use that pooler or claim row 10; implement and review the ADR-0006 fallback, then rerun |
| `org_gate` remains after a gate attempt | Treat as a failed safety check; because the project is disposable, recreate it rather than issuing an ad hoc cascade delete |
| magic link/session/provisioning fails | Delete only the synthetic Auth user or recreate the disposable project; never weaken RLS or use service-role access from the browser |
| secret appears in logs/chat/Git | Stop, revoke/rotate it, scrub the unauthorized copy, and document the incident without reproducing the value |

For a clean rollback, delete and recreate `borderpass-phase7-livegate`. Do not promote this project to
staging or production. Project deletion is a separately approved destructive operator action.

---

## 14. Evidence to record in `docs/phase-7/gate-ledger.md`

Only update a row after its command and verification have actually passed. Keep secrets, email
addresses, magic links, access tokens, and database hosts/passwords out of the ledger.

| Row | Eventual gate | Minimum redacted evidence |
|---:|---|---|
| 6 | Live Supabase provisioned | project reference suffix or internal evidence link, region, project health, operator/date |
| 7 | Migrations applied | commit SHA containing reviewed migration, migrate exit 0, applied migration count |
| 8 | Seven RLS files applied | seven command exits 0, policy count 48, required tables all `relrowsecurity=true` |
| 9 | Seed applied | seed exit 0, role count 9, synthetic org count 1 |
| 10 | Two-user RLS isolation | direct/session and intended runtime-pooler outputs showing `13 passed, 0 failed`, exit 0, leaked gate org count 0 |
| 11 | OTP → provisioning → session | timestamp, synthetic Auth UUID suffix, `1/1/1` provisioning counts before/after repeat sign-in, valid session evidence |
| 18, partial | Env/secrets review | storage locations by name, exposure classification, rotation owner/date, Git-ignore verification; never secret values |

The plan itself satisfies no ledger row. A failed attempt may be recorded as evidence, but the status
box remains unchecked.

---

## 15. What remains after Supabase setup

Even if rows 6–11 pass, BorderPass remains development-only. The following still remain:

- rows 1–5: real install with committed lockfile, full typecheck, build, Vitest suite, and normal PR
  CI;
- rows 12–15: Stripe test-mode smoke, live test round-trip, API-version validation, and the separate
  pre-real-payment live validation;
- row 16: KMS/secret-management decision;
- row 17: preview-branching decision;
- row 18: complete review of all non-Supabase secrets and rotation controls;
- row 19: owner deployment-readiness sign-off after every required row is green.

Do not start Phase 8, handle real customer PII, charge real money, or make any production-readiness
claim based on Supabase setup alone.
