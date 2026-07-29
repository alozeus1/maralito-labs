# Production Environment Runbook

> **Scope:** closes **B1** of `docs/phase-9/production-readiness-review.md` — stand up a real production
> environment (Supabase + Vercel + domain) that is fully separated from `borderpass-dev-gate`.
> **Status: 🔲 NOT STARTED. No production Supabase project, no production Vercel environment, and no
> production domain exist.** Every step below is an **operator action**; none has been executed.
> Nothing here changes a gate status. BorderPass remains development-only.

**Legend** — ✅ **DONE** (verified in-repo) · 🟠 **OPERATOR ACTION REQUIRED** · 🔴 **BLOCKED / DANGER**.

**Golden rules**
1. 🔴 **`borderpass-dev-gate` must never become production.** It is disposable, synthetically seeded, and
   its secrets were exposed in chat before rotation. New project, new keys, new everything.
2. 🔴 **Never paste a secret value into a file, commit, ticket, or chat.** This runbook uses env var
   **names** and shell variables only.
3. 🔴 **No real PII and no real payments until `kms-production-plan.md` and `stripe-live-checklist.md`
   are complete.** Standing up the environment does **not** authorise using it.

---

## 0. Prerequisites — land what is already built 🟠

Do not provision infrastructure against an unbuilt tree.

- [ ] `pnpm install` (real lockfile).
- [ ] `pnpm --filter @maralito/db db:generate` — the Phase-9 review flags that **`encrypted_pii` has no
      migration** (8D's `0005` was generated; 8B's was not). **Review the emitted SQL before committing.**
- [ ] `pnpm typecheck && pnpm test && pnpm build` — includes the new
      `packages/crypto/src/kms/aws-provider.test.ts` (24 assertions, verified offline here; **must be
      re-run in real Vitest**).
- [ ] `pnpm check:db-imports && pnpm check:client-stripe && pnpm preflight`.
- [ ] Commit the outstanding 8B / 8C / PII-vault / middleware work on `fix/webhook-middleware-public` →
      PR → **CI green** (quality, deps, SAST, secret-scan, Semgrep, OSV).
- [ ] 🔴 **Fix D1 before provisioning** (§4.1). Provisioning with the current 7-file list leaves
      `addresses` — the PII table — with **no RLS at all**.
- [ ] Retire or correct `docs/current-build-state.md` (stale; contradicts the ledger).

---

## 1. Create the production Supabase project 🟠

- [ ] **Separate project** named `borderpass-prod`. Ideally a **separate organisation** so dev-gate
      collaborators do not inherit production access.
- [ ] Region: **`us-east-2`** (match the KMS region in `kms-production-plan.md` §3.1 to minimise latency).
- [ ] Generate a **strong, unique DB password** in a password manager. It must share nothing with dev-gate.
- [ ] **Enable PITR / daily backups.** Do this at creation — it may require a paid plan tier. **Verify
      current backup and PITR availability per plan in the official Supabase documentation.**
- [ ] Auth → **redirect allow-list**: the production domain only. 🔴 Remove `localhost` and every preview
      wildcard. *(Known trap: a browser extension broke this save repeatedly during Phase 7 — use a clean
      profile/Incognito, and reload to confirm the values persisted.)*
- [ ] Auth: email confirmations on; sensible OTP expiry and rate limits; **enable leaked-password
      protection** if available.
- [ ] Restrict network access to the database where feasible; disable direct connections you do not need.
- [ ] Record the project ref and region in the gate ledger. **Not** the keys.

---

## 2. Apply migrations 🟠

```bash
# Set DATABASE_URL for the PRODUCTION project in your shell only. Never write it to a file.
read -rs -p "prod DATABASE_URL: " DATABASE_URL; export DATABASE_URL; echo
psql "$DATABASE_URL" -c 'select 1'                      # reachability
pnpm --filter @maralito/db db:migrate                   # apply ALL migrations
psql "$DATABASE_URL" -c "select count(*) from information_schema.tables where table_schema='public';"
```

- [ ] All migrations apply cleanly, in order, with **no** manual SQL.
- [ ] Table count matches the schema (26 tables at the `0000` baseline, plus everything added since —
      `refunds`, `refund_status_history`, `encrypted_pii`, `consent_records`, `user_sessions`,
      `resend_webhook_events`, `email_suppressions`, `messages`, `addresses`).
- [ ] 🔴 **Do NOT run `db:seed`.** The seed creates a synthetic org and dev-only rows. Production needs
      the **roles** rows only. Extract role seeding into a production-safe step, or insert the 9 role keys
      manually and verify no synthetic org, no `DEV_ORG_ID`, and no `SUPER_ADMIN_AUTH_USER_ID` bootstrap
      row exists.

---

## 3. Apply **ALL** RLS policy files 🔴 CRITICAL

### 3.1 Fix the file list first (Phase-9 defect D1)

`packages/db/src/rls/` contains **12** files. `.github/workflows/live-gates.yml` applies **7**;
`scripts/preflight.mjs` checks **7**. The gap is **fail-open**: an unapplied file means
`alter table … enable row level security` never runs, so the table has **no RLS at all**.

- [ ] 🔴 **Single-source the list** — one exported array consumed by the gate script, `live-gates.yml`,
      and `preflight.mjs`, so a new policy file can never again be silently omitted.
- [ ] 🔴 Re-apply the missing files to **`borderpass-dev-gate` too** — it is almost certainly affected.

### 3.2 Apply, in this order (`policies.sql` first — it installs `app_current_org_id()`, `app_has_role()`, `app_is_staff()`)

```bash
set -euo pipefail
RLS_DIR=packages/db/src/rls
FILES=(
  policies.sql                      # foundation: helpers + core policies  (MUST be first)
  orders-policies.sql
  quotes-policies.sql
  payments-policies.sql
  notifications-policies.sql
  inspections-policies.sql
  delivery-preparations-policies.sql
  addresses-policies.sql            # <-- PII table. Omitted by the current 7-file list.
  messages-policies.sql             # <-- omitted by the current 7-file list.
  email-events-policies.sql         # <-- omitted by the current 7-file list.
  consents-policies.sql             # <-- omitted by the current 7-file list.
  sessions-policies.sql             # <-- omitted by the current 7-file list.
)
for f in "${FILES[@]}"; do
  echo "== apply $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$RLS_DIR/$f"
done
```

### 3.3 Verify — do not trust "it ran without error"

```bash
# Every table in public must have RLS enabled. Expected output: ZERO rows.
psql "$DATABASE_URL" -c "
  select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and not c.relrowsecurity order by 1;"

# Policy count + RLS-enabled table count (record both as evidence).
psql "$DATABASE_URL" -c "select count(*) from pg_policies where schemaname='public';"

# Grants must go to `authenticated` ONLY — never anon, never public.
psql "$DATABASE_URL" -c "
  select grantee, table_name, privilege_type from information_schema.role_table_grants
  where table_schema='public' and grantee in ('anon','public') order by 1,2;"   -- expect ZERO rows
```

- [ ] Zero tables without RLS.
- [ ] Zero grants to `anon` or `public`.
- [ ] `addresses`, `messages`, `consent_records`, `user_sessions` present in `pg_policies`.
- [ ] `resend_webhook_events` + `email_suppressions` have RLS enabled and **no** policies and **no**
      grants (privileged-seam-only by design — that is correct, not a gap).

---

## 4. Run `gate:rls` against production 🟠

```bash
pnpm --filter @maralito/db gate:rls          # non-destructive; seeds + rolls back in a transaction
```

- [ ] Result is `N passed, 0 failed` and the rollback check reports `leaked_gate_org=0`.
- [ ] 🔴 **Extend the gate first.** It currently covers the 7 original files (13 assertions). Add
      cross-tenant isolation assertions for **`addresses`** and **`messages`**, and for **`encrypted_pii`**
      (`kms-production-plan.md` G8). Shipping PII tables that the isolation gate never exercises is
      exactly the gap D1 describes.
- [ ] Record the run as a new **Phase 9** row in `docs/phase-7/gate-ledger.md` — a dev-gate pass does
      **not** count for production.

---

## 5. Vercel Production environment + domain 🟠

- [ ] Add the production domain; DNS verified; **HTTPS + valid certificate**.
- [ ] Set `BORDERPASS_ENV=production` in the **Production scope**. 🔴 This drives the KMS fail-closed check
      — if it is wrong, the local dev provider will happily run in production.
- [ ] Set `BORDERPASS_APP_URL` / `BORDERPASS_PUBLIC_APP_URL` to the production domain (email links break
      silently otherwise).
- [ ] Point Production at the **production** Supabase project; leave **Preview** on `borderpass-dev-gate`.
- [ ] Keep **Deployment Protection** on Preview.
- [ ] Verify security headers on a **real** production response (`curl -sI https://<domain>`): HSTS, CSP,
      `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` — see `rate-limiting-and-headers.md`.
- [ ] Confirm the production build does not expose a server secret in any `NEXT_PUBLIC_*` variable.
- [ ] Verify `/api/health` returns the expected readiness shape.
- [ ] Verify the webhook routes are publicly reachable **and** fail closed on a bad signature:
      `/api/stripe/webhook`, `/api/webhooks/resend`, `/api/automation/*`.

---

## 6. Environment variable matrix (NAMES + scope only — never values)

🔴 = must NOT be set in that scope. ✅ = must be set. — = optional / not applicable.

| Variable | Prod | Preview | Local | Notes |
|---|:--:|:--:|:--:|---|
| `BORDERPASS_ENV` | ✅ `production` | ✅ `preview` | ✅ `local` | Drives fail-closed checks |
| `DATABASE_URL` | ✅ prod project | ✅ dev-gate | ✅ local/dev-gate | Server-only, never `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | ✅ prod | ✅ dev-gate | ✅ | Public by design |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ prod | ✅ dev-gate | ✅ | 🔴 **Never** given to n8n |
| `BORDERPASS_APP_URL` | ✅ domain | ✅ preview URL | ✅ localhost | |
| **Stripe** | | | | |
| `STRIPE_SECRET_KEY` | ✅ `sk_live_`/`rk_live_` **only after row 15** | 🔴 `sk_test_` only | 🔴 `sk_test_` only | |
| `STRIPE_WEBHOOK_SECRET` | ✅ live endpoint | test endpoint | `stripe listen` | Distinct per endpoint |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ `pk_live_` | 🔴 `pk_test_` | 🔴 `pk_test_` | |
| `STRIPE_API_VERSION` / `STRIPE_PAYMENT_CURRENCY` | — | — | — | Leave unset to use the pin |
| **KMS** | | | | |
| `MARALITO_KMS_PROVIDER` | `aws` *(only after the §5 factory wiring)* | `local` | `local` | |
| `MARALITO_KMS_KEY_ID` / `MARALITO_KMS_REGION` | ✅ alias ARN | 🔴 unset | 🔴 unset | |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | ✅ `borderpass-prod-kms` | 🔴 **unset** | 🔴 **unset** | |
| `BORDERPASS_KMS_KEY` | 🔴 **UNSET** — see `kms-production-plan.md` §0 | ✅ dev key | ✅ dev key | Fail-open path |
| **Email** | | | | |
| `RESEND_API_KEY` | ✅ prod key | separate/unset | unset | |
| `EMAIL_FROM_*` / `EMAIL_REPLY_TO` | ✅ verified domain | — | — | |
| `RESEND_WEBHOOK_SECRET` | ✅ prod webhook | separate | — | |
| `EMAIL_DELIVERY_ENABLED` | unset (=on) | 🔴 **`false`** | 🔴 **`false`** | |
| `EMAIL_SAFE_RECIPIENT` | 🔴 **UNSET** | ✅ operator address | ✅ operator address | |
| `DEV_SYNTHETIC_NOTIFY_EMAIL` | 🔴 unset | ✅ | ✅ | |
| **Automation** | | | | |
| `N8N_WEBHOOK_SECRET` | ✅ prod-only value | ✅ **different** value | — | Distinct per environment |
| `N8N_ORDER_EVENTS_WEBHOOK_URL` | ✅ | ✅ | — | |
| **Observability / limits** | | | | |
| `SENTRY_DSN` | ✅ | 🔴 unset (keeps dev a no-op) | 🔴 unset | |
| `SENTRY_RELEASE` | ✅ or `VERCEL_GIT_COMMIT_SHA` | — | — | |
| `NEXT_PUBLIC_POSTHOG_KEY` / `_HOST` | ✅ | — | — | |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | ✅ (rate limiting) | — | — | Fail-closed limiter |
| `BORDERPASS_RATE_LIMIT_SALT` / `_PREFIX` | ✅ | — | — | **Distinct prefix per env** |
| `BORDERPASS_CSP_REPORT_ONLY` | `false` | `true` | `true` | |
| `SUPER_ADMIN_AUTH_USER_ID` / `DEV_ORG_ID` | 🔴 **UNSET** | dev only | dev only | Seed bootstrap only |

**Verification:** after setting everything, list the variable **names** per scope and diff against this
table. Two independent people should confirm the 🔴 rows. Most production incidents in this class are a
variable set in the wrong scope, not a missing one.

---

## 7. Separation from `borderpass-dev-gate` 🔴

- [ ] Separate Supabase project (ideally separate org) and separate DB password.
- [ ] Separate Stripe mode (live vs test) and separate webhook endpoints + signing secrets.
- [ ] Separate KMS key — 🔴 **never** share a CMK between environments.
- [ ] Separate Resend API key and separate `N8N_WEBHOOK_SECRET`.
- [ ] Separate rate-limit prefix so dev traffic cannot consume production buckets.
- [ ] Preview deployments point at dev-gate **only**. 🔴 A preview build with a production `DATABASE_URL`
      is a production incident waiting for a `git push`.
- [ ] Access review: who can read production Supabase, Stripe live, Vercel Production, AWS KMS, n8n, and
      Resend? Keep it to the smallest possible set; enforce 2FA everywhere.
- [ ] Preview branching stays **deferred** (`decision-preview-branching.md`, row 17). No real PII in
      previews.

---

## 8. Credential hygiene 🟠

- [ ] 🔴 Every dev-gate credential exposed in chat is **rotated-out and must never appear in production**.
      Row 18 confirms rotation; production simply must not reuse any of it.
- [ ] Supabase → **"Previously used keys"** empty for the production project.
- [ ] All secrets originate from a password manager / secret store; none from a doc, chat, or ticket.
- [ ] `.env*` remains gitignored; CI secret-scan (gitleaks) + Semgrep stay green.
- [ ] Named **rotation owner** and cadence for: DB password, `SUPABASE_SERVICE_ROLE_KEY`, Stripe live key,
      `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `N8N_WEBHOOK_SECRET`, AWS access
      key. Record it in `env-secrets-review.md`.
- [ ] Write the **rotation procedure** for each (set new → verify → invalidate old) *before* you need it.
- [ ] 🔴 n8n holds **only** `N8N_WEBHOOK_SECRET`. Never a DB URL, never `service_role` (ADR-0016).

---

## 9. Monitoring & alerting 🟠

Full detail in `observability-and-alerting.md` §7 — all 16 steps are 🔲. Minimum before real traffic:

- [ ] Sentry receiving server + client errors from Production; **verify one event contains no PII or
      secrets** by opening and reading it.
- [ ] `initObservabilityFromEnv()` actually called at server start-up (Next `instrumentation.ts`) — the
      review notes this file **does not exist yet**, so nothing initialises observability today.
- [ ] Vercel log drain enabled; saved searches per `event` name.
- [ ] n8n Global Error Handler (`0RcqLu1uY5cQUjye`) set as `errorWorkflow` on **every** workflow.
- [ ] Alerts routed to the Notification Router (`IUSMhbApLaEBCVG2`) for: webhook failures · payments stuck
      in `processing` · dispatch failures · refund/dispute events · `gate:rls` failures · KMS
      `AccessDenied` spikes · health-check `ready:false`.
- [ ] 🔴 **Fire one test alert end to end and confirm a human receives it.** Until then, treat production
      as unobserved.
- [ ] Define on-call: who, what hours, and what "acknowledged" means.

---

## 10. Backup & restore drill 🟠 — rehearse BEFORE real data

A backup you have never restored is a hypothesis.

- [ ] Confirm PITR/daily backups are **on** and a backup exists.
- [ ] Document **RPO** (acceptable data loss) and **RTO** (acceptable downtime). Neither is defined today.
- [ ] **Drill (on a throwaway project, not production):** restore a backup into a fresh project → apply
      nothing manually → verify table count, `pg_policies` count, and that `gate:rls` still passes on the
      restored copy. **RLS and grants must survive the restore** — verify, do not assume.
- [ ] Time the restore end to end and record it. That number is your real RTO.
- [ ] Write the incident procedure: who declares, who restores, who communicates, how customers are told.
- [ ] 🔴 **PII deletion path.** LFPDPPP/ARCO rights mean a customer can demand deletion. Backups contain
      their data too. Document the retention window and how deletion propagates. This needs a legal
      decision (`legal-consent.md`) — do not invent a policy here.

---

## 11. Rollback

| Scenario | Action | Data impact |
|---|---|---|
| Bad application deploy | Vercel **Instant Rollback** to the previous Production deployment | None |
| Bad migration | 🔴 There is **no down-migration path.** Restore from PITR to just before it. This is why §10 is rehearsed first. | Data since the restore point is lost |
| RLS regression | Re-apply all 12 policy files (idempotent), re-run `gate:rls` | None |
| Wrong env var scope | Correct the value, redeploy | None, unless it caused writes |
| Environment compromised | Rotate every secret in §8, revoke sessions (`revokeAllSessionsOnPasswordReset` exists), disable Stripe live keys, disable the KMS IAM key | None if caught early; CloudTrail + `audit_logs` are the evidence |
| Total abandonment | Preview/dev-gate is untouched and independent | Production data only |

**Kill-switch summary:** money → `stripe-live-checklist.md` §5 · email → `EMAIL_DELIVERY_ENABLED=false` ·
PII → unset `MARALITO_KMS_PROVIDER` (fails closed) · automation → rotate `N8N_WEBHOOK_SECRET`.

---

## 12. Go / no-go checklist

**Every box must be ✅ with recorded evidence. Any 🔲 is a no-go.**

| # | Item | Ref | State |
|---|---|---|---|
| 1 | Outstanding work committed, CI green | §0 | 🔲 |
| 2 | `encrypted_pii` migration generated, reviewed, committed | §0 | 🔲 |
| 3 | D1 fixed — RLS file list single-sourced | §3.1 | 🔲 |
| 4 | Production Supabase project created, PITR on | §1 | 🔲 |
| 5 | Migrations applied; **no synthetic seed** | §2 | 🔲 |
| 6 | **All 12** RLS files applied; zero tables without RLS; zero `anon`/`public` grants | §3 | 🔲 |
| 7 | `gate:rls` green **against production**, incl. new `addresses`/`messages`/`encrypted_pii` assertions | §4 | 🔲 |
| 8 | Vercel Production + domain + HTTPS + headers verified on a real response | §5 | 🔲 |
| 9 | Env matrix verified by two people; all 🔴 rows confirmed | §6 | 🔲 |
| 10 | Separation from dev-gate confirmed | §7 | 🔲 |
| 11 | Credential hygiene + rotation owners recorded | §8 | 🔲 |
| 12 | Sentry live; **one test alert reached a human**; on-call defined | §9 | 🔲 |
| 13 | Rate limiting active on auth/order/payment | `rate-limiting-and-headers.md` | 🔲 |
| 14 | **Restore drill completed**; RPO/RTO recorded | §10 | 🔲 |
| 15 | Legal pages reviewed by counsel; consent capture live | `legal-consent.md` | 🔲 |
| 16 | 🔴 KMS plan complete through **G12** (incl. the §0 fail-open fix) | `kms-production-plan.md` | 🔲 |
| 17 | Real recipients proven — **N11**, one real inbox | `notifications-production-plan.md` | 🔲 |
| 18 | **Stripe LIVE row 15** — last | `stripe-live-checklist.md` | 🔲 |
| 19 | New **Phase 9** ledger section with production rows; **owner sign-off in writing** | ledger | 🔲 |
| 20 | **Soft launch** — a handful of real orders, watched, before any marketing | review §5 | 🔲 |

**Order is not optional:** environment (1–14) → legal + PII (15–16) → notifications (17) → **money last**
(18) → sign-off (19) → soft launch (20).

---

*No Supabase project, Vercel environment, domain, AWS account, or credential was created or accessed in
producing this runbook. Every checkbox above is 🔲 UNRUN.*
