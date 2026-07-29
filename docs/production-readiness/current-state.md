# BorderPass — Production Readiness: Current State

> **SOURCE OF TRUTH** for overall readiness. Gate-by-gate status stays in
> [`docs/phase-7/gate-ledger.md`](../phase-7/gate-ledger.md); `docs/current-build-state.md` is
> **superseded** (Phase-6 era).
>
> **Date:** 2026-07-28 · **Run:** production-readiness strike team (11 workstreams)
>
> ## FINAL CLASSIFICATION: `DEVELOPMENT-ONLY — PRODUCTION ENVIRONMENT BLOCKED`
>
> Rationale: the two critical **fail-open security defects found this run (D1, D3) are fixed and
> proven offline**, plus a third (D4) that would have crashed every request. No P0 security defect is
> known-open. But production remains blocked on environment + external enablement that **cannot be
> done from here**: no production Supabase project, no production KMS, no Stripe LIVE validation, and
> **three new migrations that only the operator can generate**. Nothing below claims a gate passed.

---

## 1. What this run changed

| ID | Defect | Severity | Status |
|----|--------|----------|--------|
| **D1** | 10→12 RLS policy files existed; live-gate/CI/preflight applied only **7**. `addresses` (PII), `messages`, `email_events` enable RLS *only* in their unapplied files ⇒ a fresh project would have had **no RLS at all** on them. **Fail-open.** | **P0** | ✅ **FIXED + PROVEN** |
| **D2** | `/api/automation/*` not in middleware's public list ⇒ n8n calls 302'd to `/login`, silently hitting HTML instead of the API. | P1 | ✅ **FIXED + VERIFIED** (67 tests) |
| **D3** | `createMyAddress` (a `'use server'` action any customer can call) stored **real address PII** via an **env-var KEK** with **no production refusal**, bypassing ADR-0017's fail-closed provider. **Fail-open.** | **P0** | ✅ **FIXED + PROVEN** (20/20) |
| **D4** | `rate-limit.ts` carried `import 'server-only'`; middleware runs in the **edge runtime** where that marker resolves to a **throwing** module ⇒ would have crashed **every request**. | **P0 (availability)** | ✅ **FIXED + GUARDED** |

### D1 — canonical RLS registry
`packages/db/src/rls/registry.mjs` is now the single source of truth for the file set **and** the
application order. It validates **both directions** (unregistered-on-disk *and* registered-but-missing)
and is consumed by `scripts/preflight.mjs`, `.github/workflows/ci.yml` (**every PR**),
`.github/workflows/live-gates.yml` (drives the psql apply loop via `--list`). Adding a policy file
without registering it now **fails the build**. Proven: adding an orphan `.sql` → registry `--check`
exit 1 and preflight exit 1; removing it → green (12 files registered).

### D3 — legacy PII path now fails closed
`apps/borderpass/src/server/kms.ts` refuses to seal/open PII when `BORDERPASS_ENV`,
`MARALITO_PLATFORM_ENV`, or `NODE_ENV` is `production` — **even when the key is set** — and
`isKmsConfigured()` returns `false` there so branching callers degrade closed too. The check runs
**before** the KEK cache read, so a cache warmed in dev cannot be reused in production. Regression
suite: `apps/borderpass/src/server/kms.test.ts`. **Unblock path is migration to `pii-vault.ts` +
real cloud KMS — deliberately NO env override was added.**

### D4 — edge/server-only boundary
`server-only` resolves to `empty.js` only under the `react-server` condition; anywhere else it is a
bare `throw`. Removed from `rate-limit.ts` (edge-imported), with the lost client-bundle protection
replaced by `scripts/check-server-only-boundary.mjs` (`pnpm check:server-only`, wired into CI +
preflight). It fails if a `'use client'` module imports an edge-safe server module **or** if the
throwing marker is re-added.

---

## 2. Capability delivered this run

| Area | Delivered | Verified offline | Gated on |
|---|---|---|---|
| **RLS registry (D1)** | canonical registry + CI/preflight/live-gate wiring | registry + preflight fail-closed both ways | fresh-project `gate:rls` |
| **Automation API (D2)** | verified; prefix-matching proven safe (`/api/automationXYZ` not public) | **67** tests | deployed re-test |
| **Sessions** | `user_sessions` + RLS + fixed lifetime + **max 2 devices (revoke-oldest)** + sign-out revocation, **flag-gated OFF** | **74** + **17** RLS (PGlite) | migration + flag flip |
| **Rate limiting** | 7 policies, Upstash adapter, **fail-closed in prod without a durable store**, hashed IPs, JSON 429 | **25** | Upstash provisioning |
| **Security headers** | enforcing CSP (Stripe/Supabase allowed), HSTS (prod), frame-ancestors none, nosniff, referrer, permissions | config asserted | `pnpm build` + 3DS smoke |
| **Observability** | real capture seam (Sentry envelope over `fetch`, no SDK), redaction at egress, structured logging, tiered health check, A1–A10 alert matrix | **29** + **8** | `instrumentation.ts` + DSN |
| **Legal/consent** | `/terms`, `/privacy` (es+en), immutable consent records + RLS | **18** + **9** RLS | **counsel review** + wiring |
| **KMS** | AWS KMS provider via hand-rolled SigV4, validated against published AWS test vectors | **24** | AWS account + G1–G4 gates |
| **Plans** | KMS production plan · Stripe LIVE checklist · notifications plan · production environment runbook | n/a | owner action |

**Offline verification total: ~320 assertions, 0 failures.** All executed by transpiling the **real**
source with esbuild and asserting under Node 22 (plus real Postgres via PGlite for RLS) — because
`pnpm`/`vitest`/`next`/`drizzle-kit` cannot run in this sandbox (macOS `node_modules`, Linux host).
**No `pnpm test`, `pnpm build`, `pnpm typecheck`, or live gate was run. Those remain operator gates.**

---

## 3. Honest gaps

1. **Password-reset session revocation is N/A as specified.** BorderPass has **no password auth** —
   sign-in is OTP / magic-link / OAuth only. A repo-wide search found no password route or UI. The
   revoke-all function and drop-in snippets exist (`revokeAllSessionsOnPasswordReset`, documented in
   `session-policy.md` §12) for the day password auth or a Supabase auth-hook is added. It was **not
   invented**.
2. **Session enforcement ships OFF.** The `user_sessions` migration does not exist yet; enabling a
   fail-closed check against a missing table would lock out every user. Flag
   `BORDERPASS_SESSION_ENFORCEMENT=on` after the documented rollout.
3. **OTP rate limiting is partial.** `signInWithOtp` is called **client-side**, so it never traverses
   middleware. Bounded only by Supabase's own limits until that call moves server-side.
4. **Three migrations are missing** (`encrypted_pii`, `user_sessions`, `consents`) — only the
   operator can generate them.
5. **Legal copy is a template, not legal advice.** Unresolved placeholders include entity, governing
   law, limitation of liability, prohibited items, retention, and ARCO procedure.
6. **The privacy page claims PII is encrypted at rest** — true only once production KMS is live.
   **Do not publish `/privacy` before then.**
7. **CI secret-scan false positives:** redaction tests intentionally contain fake `sk_live_…`,
   `whsec_…`, and `postgresql://…` strings (that is what they assert gets stripped). If gitleaks
   flags them, allowlist those test files rather than weakening the tests.

---

## 4. Remaining blockers to production

**P1 — operator, offline-blocked**
1. `pnpm install && pnpm --filter @maralito/db db:generate` ×3 migrations → review → commit.
2. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` → fix any fallout → PR → CI green.
   *(Highest-risk item: middleware now imports `rate-limit.ts`; `pnpm build` must confirm the edge
   bundle compiles.)*

**P1 — external, owner-only**
3. Production Supabase project (PITR, migrations, **all 12** RLS files, grants, `gate:rls`).
4. Vercel Production environment + domain + env matrix; Upstash for rate limiting.
5. AWS KMS key + IAM + CloudTrail → then gates G1–G4 → then real PII.
6. Counsel review of `/terms` + `/privacy`; then consent wiring at sign-up.
7. Sentry DSN + `instrumentation.ts`; n8n workflow activation.
8. **Stripe LIVE (row 15) — LAST**, after 3–7, with owner approval.

---

## 5. Standing rules (unchanged)

Development-only. Synthetic data only. Stripe TEST only. No real PII until production KMS + owner
sign-off. Status mutations only via the `transition*` seams. Tenant data only via `withTenant` /
audited `withPrivilegedDbAccess`. Prefer fail-closed everywhere.
