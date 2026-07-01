# BorderPass — Phase 1 Completion Review

> **Status:** Review v1.0 · **Reviewers:** CTO · Principal Backend Architect · Supabase Architect · DevSecOps Lead · Security Reviewer · QA Lead · **Date:** 2026-06-29
> **Mode:** REVIEW & APPROVAL CHECKPOINT — Phase 2 not started; no new code/files. Audited against the live repo.

---

# 1. Executive Phase 1 Review

- **Completion score: 8.0 / 10.**
- **Decision: ✅ PHASE 1 APPROVED WITH MINOR FIXES — PHASE 2 CAN BEGIN AFTER FIXES.**
- **Reasoning.** The secure foundation is real and well-structured: Drizzle schema for the 11 foundation tables, three Supabase clients with a verified server-only guard on the service-role key, a tested RBAC helper set, server-side customer/admin guards, Zod patterns, and an audit helper with tested redaction (16 unit tests pass; secret/import-safety checks clean). However, an independent code audit surfaced findings the build report missed — most importantly that **the app's Drizzle query path does not actually exercise RLS** (it connects as the DB role without per-request JWT claims), so the "double enforcement" posture is currently **app-level scoping only**. That is acceptable for Phase 1 (no customer-facing domain/tenant data exists yet) but **must be fixed before Phase 2 introduces orders/PII**. Plus minor schema gaps (indexes, a missing unique constraint) and partial audit wiring.
- **Critical blockers:** none for Phase 1 itself.
- **Recommended next action.** Apply the Phase 2 **entry fixes** (RLS tenant-context on the DB connection, `user_roles` unique constraint, indexes, audit wiring) as the **first tasks of Phase 2**, alongside the carried-over environment prerequisites (real install + lockfile + CI green, Supabase provision + migrate/RLS/seed, OTP smoke test, SDK surface). Then `START BORDERPASS PHASE 2`.

---

# 2. Foundation Package Review

| Package / area | Status | Strengths | Risks | Required fixes | Phase 2 impact |
|----------------|--------|-----------|-------|----------------|----------------|
| **@maralito/db** | Mostly complete | clean Drizzle schema; FKs (7); RLS file; seed; id helper | **no indexes**; `user_roles` no unique; client comment overstates RLS | add indexes + unique; fix client doc | orders build on this — fix first |
| **@maralito/auth** | Complete | 3 clients; **server-only** on service; tested RBAC; typed errors | super_admin implicit-all (intended) | none blocking | solid base for domain guards |
| **@maralito/schemas** | Complete | reusable Zod; canonical error/success; tested | — | none | reused by every action |
| **@maralito/observability** | Mostly complete | pure `redact()`; tested; init structure | Sentry/OTel/PostHog not yet initialized (by design) | none (Phase 12) | fine |
| **app middleware** | Complete | session refresh; coarse gate; correct matcher | passes through when env unset (dev convenience) | ensure env required in prod | fine |
| **auth routes** | Complete | login/sign-up (OTP) + callback exchange | email-only for now (phone later) | none | fine |
| **customer/admin guards** | Complete | server-side; `requireAdminAccess`→`not_found` for customers | role check needs DB (not edge) — correct | none | fine |
| **audit helper** | Mostly complete | append-only; **tested redaction**; best-effort | **wired only in profile action** (role/sign/deny not wired) | wire remaining actions | complete in Phase 2 |
| **docs** | Complete | 7 Phase 1 docs + ADR-0005 | auth-rbac/rls docs **overstate** current RLS enforcement | correct the double-enforcement wording | accuracy |

---

# 3. Database & RLS Review

**Tables (11):** organizations, user_identities, customer_profiles, staff_profiles, roles, permissions, role_permissions, user_roles, audit_logs, platform_config, feature_flags. **Relationships:** 7 FKs present (org_id, role_key, permission_key). **Schema quality:** good — strict types, `$type<>()` enums, timestamptz, unique on `auth_user_id`. **Migration approach:** Drizzle Kit forward-only + RLS as follow-on — sound. **Dev seed + super-admin bootstrap:** present and guarded (dev-only env).

**Findings:**

| # | Finding | Severity |
|---|---------|----------|
| DB-1 | **RLS not exercised on the app's Drizzle path.** `createDbClient` opens a direct `postgres()` connection as the DB role; queries **bypass RLS** because no `set local role authenticated` / `request.jwt.claims` is set per request. Tenant isolation today = **app-level scoping** (`getAppSession` filters by `auth_user_id`). The client doc comment claims RLS enforcement — **inaccurate**. | **High** |
| DB-2 | **No indexes** beyond PKs + `unique(auth_user_id)`. Missing: `user_roles(auth_user_id)`, `user_roles(org_id)`, `audit_logs(org_id, created_at)`, `org_id` on profiles. | Medium |
| DB-3 | **`user_roles` has no unique constraint** on `(auth_user_id, org_id, role_key)` → duplicate role assignments possible; seed `onConflictDoNothing` has no conflict target to honor. | Medium |
| DB-4 | RFC/KYC fields intentionally omitted pending KMS — correct, but note customer_profiles will need them + field-encryption before storing PII. | Low (tracked) |
| DB-5 | `audit_logs` writes rely on service-role/direct connection (RLS read policy is admin-scoped) — consistent, but immutability/hash-chaining absent (platform Audit later). | Low |

**Default-deny posture:** ✅ RLS enabled on all tables; reference tables readable by authenticated; writes default-denied (service-role only). **Future domain-table compatibility:** good — the `org_id` + owner pattern extends cleanly, **once DB-1 is resolved** so RLS actually guards the BFF path.

**Blocking Phase 2 orders foundation?** DB-1 should be fixed **before** orders carry tenant data; DB-2/DB-3 fixed with the first domain migration. None block *starting* Phase 2 setup.

---

# 4. Auth & RBAC Review

- **Clients:** browser (anon), server (anon+cookies), service (service-role). **Server-only enforcement: verified** — `import 'server-only'` in `service.ts`; no client component imports db/service (grep-confirmed).
- **AppSession:** `{ sub, orgId, roles, permissions }`, built from Supabase user + DB identity/roles; **fail-closed** to `null` on any error.
- **RBAC helpers:** complete + **tested (6)**; guards throw typed `AuthError`.
- **Route protection:** middleware coarse gate + server-layout role checks; **`requireAdminAccess` returns `not_found`** for customers (admin surface never revealed) — good.
- **Staff vs customer separation:** clear (`isStaff`). **Super-admin:** implicit-all in `hasPermission`/`requireRole` — intended; SoD deferred to action sites.

**Flags:**

| # | Finding | Severity |
|---|---------|----------|
| AUTH-1 | **Privilege-escalation surface is low**, but super-admin implicit-all means any future action relying solely on `hasPermission` is auto-granted to super_admin — ensure SoD-sensitive actions (refund self-approval, etc.) add explicit requester≠approver checks. | Medium (design note) |
| AUTH-2 | **No audit on access/permission denial.** `requireAdminAccess`/guards redirect but don't emit `access.denied`/`permission.denied`. | Medium |
| AUTH-3 | Middleware can't do role checks (edge) — correctly deferred to layouts; but a mis-added admin page **without** the `(admin)` layout would be unguarded. Add a route-protection test/convention. | Low |
| AUTH-4 | RLS not enforcing on BFF path (see DB-1) means RBAC is currently the **sole** server-side guard — raises the stakes on guard completeness. | High (ties to DB-1) |

---

# 5. Validation & Audit Review

- **Zod schemas:** ProfileCreate/Update, StaffProfile, RoleAssignment, PaginationParams, ApiError/apiSuccess + primitives — clean, shared, **tested (8)**. Canonical error/success envelopes match `contracts/02`.
- **Audit shape:** all required fields present (actor, action, entity, before/after, metadata, ip, ua, created_at). **Redaction: tested (2)** — masks secret-ish keys recursively, preserves safe fields; never logs card/KYC/RFC/document content.
- **Audit coverage (Phase 1 actions):** **partial.** Wired: `user.created`, `profile.updated`. **Not wired:** `role.assigned/removed` (no role-admin action yet), `access.denied`, `permission.denied`, sign-in/out. The **baseline** (table+helper+redaction) is complete; **coverage** is not.
- **Sensitive-data handling:** ✅ no secrets logged; service-role server-only; RFC/KYC deferred to KMS.

| # | Finding | Severity |
|---|---------|----------|
| VAL-1 | Audit coverage partial (above). | Medium (acceptable for foundation) |
| VAL-2 | `ip_address`/`user_agent` are in the schema but no action populates them yet (needs request-context plumbing). | Low |

---

# 6. Testing & Security Review

| Item | Status | Evidence |
|------|--------|----------|
| Unit tests | ✅ **16 pass** | RBAC 6 · validation 8 · redaction 2 (real isolated runs) |
| RBAC tests | ✅ | guards, super-admin implicit-all, customer→admin `not_found` |
| Validation tests | ✅ | defaults/trim/clamp/enum |
| Redaction tests | ✅ | nested/arrays/safe-keys |
| Typecheck | 🟡 partial | schema (drizzle) + rbac + schemas typecheck PASS in isolation; **full app `tsc` not run** (no workspace install) |
| Lint | ⏳ not run | needs install |
| Build (`next build`) | ⏳ not run | needs install |
| Security scans | 🟡 configured | gitleaks/semgrep/osv/pnpm-audit in CI; not executed in sandbox |
| Secrets exposure | ✅ | repo scan clean; `.env.example` names-only |
| Client/server import safety | ✅ | service-role server-only; no client imports db/service |

**Failure classification:** **0 critical, 0 high test failures.** "Not run" items (full typecheck/lint/build, CI, security-scan execution) are **acceptable limitations** of the sandbox, converted to Phase 2 entry tasks. DB-1 (RLS path) is a **High design finding**, not a test failure.

---

# 7. Phase 2 Entry Gate Review

| Gate | Status |
|------|--------|
| Real `pnpm install` | ⏳ Required |
| Lockfile committed | ⏳ Required |
| CI green | ⏳ Required |
| Supabase project provisioned | ⏳ Required |
| Migrations run | ⏳ Required |
| RLS applied | ⏳ Required (+ **DB-1**: set per-request tenant context so RLS guards the Drizzle path) |
| Dev seed run | ⏳ Required |
| OTP auth smoke test | ⏳ Required |
| `@maralito/sdk` surface confirmed | ⏳ Required |
| Env vars verified | ⏳ Required |
| Docs updated | 🟡 update RLS/auth docs for DB-1 accuracy |

---

# 8. Open Issues

| Issue | Category | Severity | Blocks Phase 2? | Recommended fix | Timing |
|-------|----------|:--------:|:---------------:|-----------------|--------|
| Drizzle path bypasses RLS (app-level scoping only) | Security/DB | **High** | **Yes (before orders/PII)** | Set `role authenticated` + `request.jwt.claims.sub` per transaction, OR route tenant reads via RLS-aware client; add cross-tenant isolation test | Phase 2 start |
| Missing indexes (user_roles, audit_logs, org_id) | DB/perf | Medium | No | Add with first domain migration | Phase 2 |
| `user_roles` no unique (user,org,role) | DB integrity | Medium | No | Add unique constraint | Phase 2 start |
| Audit coverage partial (deny/role/sign events) | Audit | Medium | No | Wire writeAudit at guard/role/auth sites | Phase 2 |
| RLS/auth docs overstate enforcement | Docs | Medium | No | Correct double-enforcement wording | Phase 2 start |
| super_admin implicit-all vs SoD | Security design | Medium | No | Explicit requester≠approver at sensitive actions | when those actions land |
| ip/ua not populated | Audit | Low | No | Plumb request context | Phase 2 |
| Full install/lockfile/CI/build not run | Tooling | Medium | **Yes (gate)** | Run in real env; commit lockfile; CI green | Before Phase 2 code |
| Supabase provision + migrate/RLS/seed + OTP smoke | Infra | Medium | **Yes (gate)** | Provision + run + smoke test | Before Phase 2 code |
| `@maralito/sdk` surface unconfirmed | Architecture | Medium | **Yes (gate)** | Confirm with platform team | Before Phase 2 identity work |

---

# 9. Final Decision

## ✅ PHASE 1 APPROVED WITH MINOR FIXES — PHASE 2 CAN BEGIN AFTER FIXES

**Reason.** The secure foundation is complete, well-architected, and tested (16 green; service-role and import-safety verified). The audit found no critical defects, but did surface a **High** design gap — the Drizzle/BFF path does not currently exercise RLS, so tenant isolation rests on app-level scoping — plus minor schema gaps (indexes, `user_roles` uniqueness), partial audit wiring, and a doc-accuracy correction. None block *starting* Phase 2 setup, but the RLS path **must be fixed before Phase 2 introduces orders and customer PII**, and the carried-over environment prerequisites must be satisfied.

**Required before Phase 2 domain code (entry fixes):**
1. **RLS enforcement on the Drizzle path** (per-request tenant context) + add the cross-tenant isolation test (blocking in CI).
2. `user_roles` unique constraint + foundation indexes.
3. Correct the RLS/auth docs; wire audit at denial/role/auth sites (can trail slightly).
4. Real `pnpm install` + lockfile + CI green; Supabase provision + migrate/RLS/seed; OTP smoke test; confirm `@maralito/sdk` surface; verify env vars.

**Exact next command once the entry fixes/gates are in:**

> ## `START BORDERPASS PHASE 2`

*Reviewers: CTO · Principal Backend Architect · Supabase Architect · DevSecOps Lead · Security Reviewer · QA Lead — Web Forx Technology Ltd. · 2026-06-29 · Review only — Phase 2 not started.*
