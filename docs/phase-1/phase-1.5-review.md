# BorderPass — Phase 1.5 Hardening Completion Review

> **Status:** Review v1.0 · **Reviewers:** CTO · Principal Supabase Architect · DB Security Reviewer · DevSecOps Lead · QA Lead · **Date:** 2026-06-29
> **Mode:** Completion review + live-env readiness gate. No Phase 2; no code. Audited against the live repo.

---

# DELIVERABLE 1 — Executive Completion Review

- **Completion score: 8.5 / 10.**
- **Decision: ✅ PHASE 1.5 APPROVED — READY FOR LIVE SUPABASE GATE.** (The hardening work is correct and proven on real Postgres; the remaining step is the live-Supabase verification + a few minor fixes — see D10.)
- **Completed fixes (verified):** `withTenant`/`withServiceRole` (ADR-0006); fail-closed strict mode; `getAppSession`, profile action, audit writes rewired; indexes + `user_roles` unique; missing RLS insert/update policies; audit wiring (role/denial/auth/bootstrap); docs corrected; `@maralito/sdk` Phase 2 interfaces; **20 tests green incl. 9-scenario RLS isolation on real Postgres (PGlite)**.
- **Remaining risks:** (1) **live Supabase RLS unverified** — `SET LOCAL ROLE authenticated` on the pooler is unproven; (2) **new-user provisioning gap** — nothing creates a `user_identities` row + `customer` role on fresh signup, so a brand-new user can't pass `getAppSession`; (3) the **PGlite test re-declares policies inline** — it doesn't execute the real `policies.sql`, so drift is possible; (4) `withServiceRole` relies on the base connection role being privileged (not a separate credential) — correct but must be confirmed in the live gate.
- **Can Phase 2 begin yet?** **No.** The live Supabase RLS gate (D3/D9) must pass first, plus the minor fixes in D10.
- **Recommended next action:** run the live Supabase gate; fix the 4 minor items; then start Phase 2 (Orders foundation, ADR-0007).

---

# DELIVERABLE 2 — RLS Hardening Review

| Aspect | Finding |
|--------|---------|
| `withTenant` implementation | ✅ tx + `set_config('request.jwt.claims', …, true)` + `request.jwt.claim.sub` + optional `app.current_org_id` + `set local role authenticated`. Typechecks vs real drizzle/postgres. |
| Transaction behavior | ✅ single `db.transaction`; all sets are `LOCAL` → scoped to the tx. |
| `request.jwt.claims` | ✅ JSON with sub/role/org; parameterized via `set_config` (injection-safe). |
| `SET LOCAL ROLE authenticated` | ✅ literal constant; in strict mode runs unconditionally (line 41). |
| Fail-closed | ✅ in `strict`, a failed role switch aborts the tx → propagates (no silent bypass). |
| `withServiceRole` bypass | ⚠️ **runs `fn(db)` on the SAME connection** — it does not use a separate credential; "privilege" comes from the base `DATABASE_URL` role (which must bypass RLS). Requires a `reason` (≥3 chars). Naming is slightly misleading. |
| Service-role audit | ✅ audit writes + role admin pair a `writeAudit` with the privileged op. |
| AppSession integration | ✅ `getAppSession` reads identity/roles **inside `withTenant`** (RLS-exercised). |
| Profile action integration | ✅ upsert inside `withTenant`; audit emitted after. |
| Audit write integration | ✅ via `withServiceRole(db, 'audit:<action>', …)`. |

**Confirm:** RLS is exercised on protected BFF paths **in principle** (proven on PGlite; live Supabase pending) ✅; service-role not used for normal customer/admin data access ✅; bypass requires `reason` ✅; bypass audited where practical ✅; fallback documented (ADR-0006 / rls-testing) ✅.

**Flags:**
- **F1 (Medium):** `createDbClient` is reachable in 5 server files and a developer could query it **raw** (bypassing RLS) without `withTenant`. No lint guard. → add an ESLint `no-restricted-imports`/naming convention (`createRawDbClient`) or a wrapper-only export.
- **F2 (Medium):** `withServiceRole` doc implies a distinct credential; clarify it’s the base connection role and that the **live gate must confirm** the base role bypasses RLS *and* can `SET ROLE authenticated`.
- **F3 (Medium):** **New-user provisioning gap** — no path creates `user_identities` + `customer` role on first sign-in; `getAppSession` returns null → fresh users blocked. (Onboarding scope, but blocks end-to-end use.)

---

# DELIVERABLE 3 — Live Supabase RLS Gate

> **NOT RUN.** There is no live Supabase (or any external Postgres) in this environment. The mechanism is proven on **PGlite (real Postgres 18.3)**, but per the rules I do **not** claim live Supabase passed. Below is the exact gate to run against a real project; every "Actual" is **NOT RUN / PENDING**.

| # | Check | Command / test | Expected | Actual | Pass/Fail | Blocks Phase 2 |
|---|-------|----------------|----------|--------|:---------:|:--------------:|
| 1 | DATABASE_URL works | `psql "$DATABASE_URL" -c 'select 1'` | `1` | NOT RUN | PENDING | Yes |
| 2 | Migrations apply | `pnpm --filter @maralito/db db:migrate` | clean | NOT RUN | PENDING | Yes |
| 3 | RLS policies apply | `psql "$DATABASE_URL" -f packages/db/src/rls/policies.sql` | clean | NOT RUN | PENDING | Yes |
| 4 | Seed runs | `pnpm --filter @maralito/db db:seed` | org+roles+perms | NOT RUN | PENDING | Yes |
| 5 | `canAssumeAuthenticatedRole()` | small script calling the probe | `true` | NOT RUN | PENDING | Yes (drives fallback) |
| 6 | `SET LOCAL ROLE authenticated` in tx | `begin; set local role authenticated; reset role; commit` | ok | NOT RUN | PENDING | Yes |
| 7 | claims settable + read by policy | set claims → `select auth.uid()` | sub returned | NOT RUN | PENDING | Yes |
| 8 | A cannot read B | live two-user `withTenant` select | only A’s row | NOT RUN | PENDING | Yes |
| 9 | customer ≠ staff profile | `withTenant` (customer) on staff_profiles | 0 rows | NOT RUN | PENDING | Yes |
| 10 | non-admin staff ≠ audit | `withTenant` (inspector) on audit_logs | 0 rows | NOT RUN | PENDING | Yes |
| 11 | missing claims denied | `withTenant` no sub | 0 rows | NOT RUN | PENDING | Yes |
| 12 | missing org denied | identity-less compliance user | 0 rows | NOT RUN | PENDING | Yes |
| 13 | super-admin explicit | `withTenant` (super) on user_roles | all rows | NOT RUN | PENDING | Yes |
| 14 | service-role bypass only via audited path | `withServiceRole` insert audit | ok + audit row | NOT RUN | PENDING | Yes |
| 15 | duplicate user_roles rejected | insert dup | unique violation | NOT RUN | PENDING | Yes |

**If failed (esp. #5/#6):** apply the D4 fallback. All 15 **block Phase 2** until green on a real Supabase preview/staging project.

---

# DELIVERABLE 4 — Fallback Decision

**Trigger:** if `SET LOCAL ROLE authenticated` does not work with the configured Supabase `DATABASE_URL`/pooler.

**Selected fallback (if needed): Option D — Drizzle for schema/migrations; route RLS-sensitive reads/writes through a Supabase auth-context client** (Option C's mechanism), with **Option A (non-pooled direct connection) as the first thing to try** since it is the least invasive.

Decision order:
1. **Try Option A** — use the **direct (non-pooled, port 5432) connection** for `withTenant` (session/transaction GUCs + role switching are reliable on a direct connection; pgbouncer *transaction* mode can restrict `SET`). If the direct role can `SET ROLE authenticated`, **no domain change**, keep `withTenant` as-is.
2. **Else Option B** — claims-only: set `request.jwt.claims` and rely on the connection already being a **non-BYPASSRLS** role. **Security tradeoff:** only safe if the base role does **not** bypass RLS; must verify. Risk: if misconfigured, RLS silently off → unacceptable unless verified, so pair with a startup assertion.
3. **Else Option C/D** — execute tenant reads/writes through the **Supabase server client** (PostgREST preserves the user JWT → RLS native). **Tradeoff:** lose Drizzle typed queries on those paths; **domain code changes** at the data-access layer (but contained behind `withTenant`’s seam if we make `withTenant` dispatch to a Supabase-client executor).

| Fallback | Files impacted | Domain code change | Phase 2 proceed after? |
|----------|----------------|--------------------|------------------------|
| A direct conn | env + `createDbClient` conn string | No | Yes |
| B claims-only | `tenant.ts` (mode) + startup assert | No | Yes (if base role non-bypass verified) |
| C/D Supabase client | `tenant.ts` executor + data-access | Minimal (behind the wrapper) | Yes |

**The wrapper preserves domain code** in A/B; C/D changes only the executor inside `withTenant`. Recommendation: **A first, then B, then C/D**; decide from the D3 probe.

---

# DELIVERABLE 5 — Index & Constraint Review

| Item | Status |
|------|--------|
| Foundation indexes | ✅ user_identities(org), customer/staff_profiles(org), staff(org,status), user_roles(user/role/org), role_permissions(role/perm), audit(actor/entity/action/created/org) |
| `user_roles` unique(auth_user_id,org_id,role_key) | ✅ + duplicate rejection **tested** (PGlite) |
| role/permission uniqueness | ✅ PK on `roles.key`/`permissions.key`; role_permissions composite PK |
| audit indexes | ✅ actor, (entity_type,entity_id), action, created_at, org |
| org/user lookup indexes | ✅ |
| feature_flags/platform_config uniqueness | ✅ key is PK |

**Confirm:** duplicate role assignment blocked ✅; Phase 2 order tables can safely FK `organizations`/`customer_profiles` ✅; **no premature/excessive indexing** — all foundation-justified ✅. (Minor: profiles `org` indexes are slightly redundant with the unique `auth_user_id` for point lookups, but useful for org-scoped scans — acceptable.)

---

# DELIVERABLE 6 — Audit Wiring Review

| Event | Status |
|-------|--------|
| role assigned / removed | ✅ `src/server/roles.ts` |
| permission denied | 🟡 helper `auditPermissionDenied` exists; **not yet called** at action sites (Phase 2) |
| admin / customer route access denied | ✅ guards |
| profile updated / user.created | ✅ profile action |
| privileged service-role op | ✅ paired with `withServiceRole` (audit/role) |
| sign-in / sign-in-failed | ✅ callback |
| sign-out | ✅ action |
| auth callback success/failure | ✅ callback |
| super-admin bootstrap | ✅ seed |

**Confirm:** secrets/OTP/tokens **not logged**; redaction tested (masks card/kyc/rfc/token/secret/document; keeps safe fields) ✅; noise controlled (denials audited once per request, not per render) ✅; deferred events documented (`permission.denied` wiring, ip/ua capture) ✅.

---

# DELIVERABLE 7 — Test Review

| Type | Tests |
|------|-------|
| **Unit** | RBAC (6), validation (6), redaction (2) |
| **Integration (real Postgres)** | RLS isolation (9) — PGlite, **CI-runnable** |
| **Real-env gated** | live Supabase isolation + capability probe (D3) — NOT RUN |
| **CI-blocking now** | all 20 (unit + PGlite RLS) via `pnpm test` |
| **Deferred** | `permission.denied` emit test; live OTP round-trip; app server-file typecheck (needs install) |

**Flags:**
- **Must block Phase 2:** the **live Supabase** isolation test (D3).
- **Coverage gap (Medium):** the PGlite test **re-declares policies inline** — it does not load the real `packages/db/src/rls/policies.sql`, so a typo there wouldn’t be caught. → load `policies.sql` (and/or Drizzle DDL) into the test, or assert parity.
- **Doc-only acceptable:** the live-gate checklist until a Supabase project exists.

---

# DELIVERABLE 8 — Documentation Review

| Doc | Status |
|-----|--------|
| ADR-0006 | ✅ clear; numbering noted (orders = 0007); honest verification status |
| rls-strategy.md | ✅ corrected; pattern + service-role rules + gate |
| auth-rbac.md | ✅ Phase 1.5 correction appended |
| audit-logging.md | ✅ coverage table (implemented vs deferred) |
| phase-1 completion report | ✅ addendum added |
| phase-2 readiness checklist | ✅ resolved-vs-gating + live gate |
| rls-testing.md | ✅ Layer 1/2 + CI gate + env vars + Phase 2 block note |
| SDK Phase 2 surface | ✅ interfaces only |

**Confirm:** no overstated RLS claim remains ✅; live gate documented ✅; service-role rules documented ✅; fallback documented ✅; Phase 2 prerequisites clear ✅. **Minor:** clarify `withServiceRole` = base connection role, not a separate key (F2).

---

# DELIVERABLE 9 — Phase 2 Entry Gates

| # | Gate | Status | Evidence | Blocks Phase 2 | Fix |
|---|------|--------|----------|:--------------:|-----|
| 1 | pnpm install | ❌ | not run (sandbox) | Yes | run in real env |
| 2 | lockfile committed | ❌ | none | Yes | commit `pnpm-lock.yaml` |
| 3 | CI green | ❌ | not run | Yes | first real PR |
| 4 | Supabase provisioned | ❌ | none | Yes | provision project |
| 5 | migrations applied | ❌ | not run | Yes | `db:migrate` |
| 6 | RLS policies applied | ❌ | not run | Yes | apply `policies.sql` |
| 7 | dev seed runs | ❌ | not run | Yes | `db:seed` |
| 8 | OTP round-trip | ❌ | not run | Yes | live smoke |
| 9 | **live RLS isolation passes** | ❌ | D3 NOT RUN | **Yes (key)** | run live gate |
| 10 | `@maralito/sdk` runtime surface | 🟡 | interfaces only | Yes | confirm w/ platform team |
| 11 | env vars verified | 🟡 | `.env.example` complete; not populated | Yes | set real values |
| 12 | docs updated | ✅ | this folder | No | — |
| + | new-user provisioning | ❌ | F3 | Yes (onboarding) | create identity+role on first sign-in |
| + | PGlite test uses real policies.sql | 🟡 | F-coverage | No (recommended) | load real policy file |

---

# DELIVERABLE 10 — Final Decision

## ✅ PHASE 1.5 APPROVED WITH MINOR FIXES — PHASE 2 CAN BEGIN AFTER FIXES

**Reason.** The RLS hardening is correctly designed and **proven on real Postgres** (9-scenario isolation, fail-closed, indexes, unique constraint, audit wiring, corrected docs). The High finding from Phase 1 is resolved in principle. But Phase 2 introduces orders + PII, so it cannot begin until the **live Supabase gate** passes and a few minor fixes land. No new security holes; the model is sound.

**Required fixes before Phase 2 domain code:**
1. **Run the live Supabase RLS gate (D3)** — all 15 checks green on a real preview/staging project; if `SET LOCAL ROLE authenticated` fails, apply the **D4 fallback** (A → B → C/D).
2. **New-user provisioning (F3):** create `user_identities` + assign `customer` role on first sign-in (onboarding) so `getAppSession` resolves for fresh users.
3. **Harden the RLS test (F-coverage):** load the real `policies.sql` (and/or Drizzle DDL) into the isolation test to prevent policy drift.
4. **Clarify `withServiceRole` (F2)** + add a guard/convention so raw `createDbClient` isn’t queried directly for tenant data (F1).
5. **Carried env gates:** real `pnpm install` + lockfile + CI green; provision + migrate/RLS/seed; OTP smoke; confirm SDK runtime surface; KMS provider.

**When those are green**, the next command is:

> ## `START BORDERPASS PHASE 2`

*Reviewers: CTO · Principal Supabase Architect · DB Security Reviewer · DevSecOps Lead · QA Lead — Web Forx Technology Ltd. · 2026-06-29 · Review only — Phase 2 not started.*
