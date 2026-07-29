# BorderPass — Production Readiness Review

> **Date:** 2026-07-28 · **Reviewer:** agent (static review of the repo working tree + docs; no live environment access)
> **Verdict:** **NOT production-ready today.** The product is *functionally* complete for the core commercial
> journey and architecturally strong, but production is blocked by **2 defects found in this review**, **4 hard
> gates**, and **1 missing legal surface**. None are large; they are sequenced in §5.
> **Nothing here changes a gate status.** BorderPass remains development-only.

---

## 1. Where the build actually is

**Complete and verified (dev-only):** auth/RBAC · RLS-enforced multi-tenancy · orders · quotes + finance
approval · Stripe payments (TEST) · payment confirmation UX · inspections · delivery prep · refunds &
disputes (8D) · envelope-encryption seam (8B) · notification dispatch + delivery status (8C) · mobile PWA
shell (8A) · i18n (es/en) · 60 test files · 10 RLS policy files · 6 migrations · CI with SAST/secret-scan/
Semgrep/OSV.

**Phase 7 live gates:** rows 1–14 and 16–19 ✅ (live Supabase migrate + RLS + seed + `gate:rls` 13/13, OTP
smoke, Stripe TEST round-trip, owner sign-offs). **Row 15 (Stripe LIVE) deferred — the only open row.**

**Deployment:** a **Preview** deployment exists on Vercel behind Deployment Protection. **No production
domain, no production environment, and no production Supabase project exist.**

The core customer journey (sign up → order → quote → accept → pay → inspection → delivery → refund) is
built end to end. What's missing is not features — it's the production *environment*, the *real-data*
enablement (PII + live money + real emails), and production *operability*.

---

## 2. 🔴 Defects found in this review

### D1 — Three RLS policy files are never applied by any provisioning path (**critical**)

`packages/db/src/rls/` contains **10** policy files. The live-gate script, `.github/workflows/live-gates.yml`,
and `scripts/preflight.mjs` all apply/expect only **7**. Not applied:

| File | Tables | Consequence if a fresh project is provisioned via the documented path |
|---|---|---|
| `addresses-policies.sql` | `addresses` | **RLS never enabled** → any authenticated user can read/write **all** addresses. This is the PII table. |
| `messages-policies.sql` | `messages` | **RLS never enabled** → cross-tenant message exposure. |
| `email-events-policies.sql` | `resend_webhook_events`, `email_suppressions` | **RLS never enabled** → deliverability data readable by any authenticated user. |

These tables have `enable row level security` **only** in their own (unapplied) file, so skipping the file
means no RLS at all — a fail-**open** gap, not a fail-closed one. The existing dev-gate project is likely
affected too.

**Fix:** make the file list single-sourced (one exported array consumed by the gate script, CI, and
preflight) so a new policy file can never be silently omitted; extend `gate:rls` with isolation checks for
`addresses` and `messages`; re-run against the dev-gate project and every future project.

### D2 — `/api/automation/*` was blocked by the auth middleware (**fixed in this pass**)

`PUBLIC_PREFIXES` covered the Stripe and Resend webhooks but not `/api/automation/*`. Unauthenticated n8n
calls were 302-redirected to `/login`, so the **live** review-request workflow was silently hitting an HTML
page instead of the API — and 8C.4 would have failed the same way. Added `/api/automation` to the bypass;
verified all three routes under it fail closed on `secretOk` first. **Needs a live re-test after deploy.**

---

## 3. 🔴 Hard blockers to production

| # | Blocker | Why it blocks | Effort |
|---|---|---|---|
| **B1** | **No production Supabase project.** The only live project is `borderpass-dev-gate` — explicitly disposable, seeded with synthetic data, and its secrets were exposed in chat before rotation. | Production must never run on it. Needs a new project + migrations + **all 10** RLS files + grants + seed + a `gate:rls` pass of its own. | ~half day |
| **B2** | **Row 15 — Stripe LIVE validation.** | No real payment can be taken. Needs live keys, a live webhook endpoint + secret, a real small-value round-trip, and Stripe account/business verification. | ~half day + Stripe verification lead time |
| **B3** | **8B production KMS not wired.** The local dev provider is fail-closed in production and the AWS/GCP adapters throw. | The product **cannot deliver** without storing a real address. Today, storing real PII in prod is impossible by design — correct, but it must be resolved. Needs an AWS (or GCP) KMS adapter + key + IAM + rotation/audit policy. | ~1 day |
| **B4** | **8C real recipients + n8n activation.** Only a synthetic resolver is wired; no real customer ever receives a receipt or status email. | Depends on B3 (contact info is PII) + consent capture. Then wire the real resolver, activate the n8n workflows, verify suppression/bounce handling. | ~half day after B3 |
| **B5** | **No Terms of Service / Privacy Policy / consent capture.** No `/terms`, `/privacy`, no consent checkbox. | Required for Stripe onboarding, and for lawfully processing PII across US↔MX. Also needed: data-retention and deletion paths. | legal review + ~half day |

---

## 4. 🟠 Production hardening gaps (not blockers, but don't skip)

1. **No error tracking.** `@maralito/observability` is a **no-op stub** — `initObservability()` does nothing;
   Sentry/PostHog are unwired despite being in the locked stack. In production you would be blind to runtime
   errors, failed webhooks, and failed dispatches. **Highest-value item in this section.**
2. **No rate limiting** anywhere — login/OTP, order creation, and payment initiation are all unthrottled.
   OTP endpoints are the usual abuse/cost target.
3. **No security headers / CSP** in `next.config.mjs` (no HSTS, X-Frame-Options, CSP, Referrer-Policy).
4. **No backup/restore drill or DR runbook**; no documented RPO/RTO. Supabase PITR should be enabled and a
   restore actually rehearsed before real customer data exists.
5. **No production alerting/on-call path** — webhook failures, dispatch failures, and refund/dispute events
   should page someone. The n8n Global Error Handler + Notification Router exist and can carry this.
6. **`docs/current-build-state.md` is stale** — it still describes Phases 0–6 and says "nothing is deployed."
   It contradicts the ledger. Fix or retire it; the ledger is the source of truth.
7. **Uncommitted work + one missing migration.** The tree has 8B, 8C, PII vault, ADR-0016/0017 and doc
   changes uncommitted on branch `fix/webhook-middleware-public`, and **`encrypted_pii` has no migration
   yet** (8D's migration `0005` was generated; 8B's was not). Run `db:generate`, review, commit, CI.

---

## 5. Recommended sequence to production

**Stage 0 — Close the books on what's built (½ day, no new risk)**
1. `pnpm install` → `pnpm --filter @maralito/db db:generate` (emits the `encrypted_pii` migration) → review.
2. `pnpm typecheck && pnpm test && pnpm build` → commit the 8B/8C/middleware work → PR → CI green.

**Stage 1 — Fix the defects (½–1 day)**
3. **D1:** single-source the RLS file list (gate script + CI + preflight), add `addresses`/`messages`
   isolation checks to `gate:rls`, re-run against dev-gate.
4. **D2:** verify the middleware fix on a deployed preview with a real authed n8n call.

**Stage 2 — Production environment (1–2 days)**
5. Create the **production** Supabase project (separate org/project, PITR on, no synthetic seed).
6. Apply migrations + **all 10** RLS files + grants; run `gate:rls` against it; record as a new ledger row.
7. Create the Vercel **Production** environment + domain; set production env vars (`BORDERPASS_ENV=production`,
   `EMAIL_DELIVERY_ENABLED=true`, no `EMAIL_SAFE_RECIPIENT`); keep Preview pointed at dev-gate.

**Stage 3 — Enable real data, one capability at a time (2–3 days)**
8. **B3 KMS** → then **B5 legal/consent** → then **B4 real recipients + n8n** → then **B2 Stripe LIVE** last,
   so money goes live only after PII handling, comms, and legal are in place.

**Stage 4 — Operability (1–2 days, can run parallel to Stage 3)**
9. Wire Sentry (server + client + webhook routes) and PostHog. 10. Rate-limit auth/order/payment.
11. Security headers + CSP. 12. Backup/restore drill + incident runbook + alerting via n8n.

**Stage 5 — Go-live gate**
13. New ledger section (Phase 9) with production rows; owner sign-off; a **soft launch** with a handful of
    real orders and a live monitoring watch before any marketing push.

**Realistic estimate: ~1.5–2 focused weeks**, excluding Stripe account verification and legal review lead time.

---

## 6. What I would *not* change

The security architecture is the strongest part of this build and should carry into production unchanged:
state-machine-only mutations (`transitionOrder/Quote/Payment/Inspection/DeliveryPrep/Refund`), `withTenant`
vs audited `withPrivilegedDbAccess`, the raw-client and client-Stripe CI guards, webhook-as-source-of-truth
with idempotency ledgers, integer minor units, redaction in audit, and PII-by-reference. Keep them.

---

*Static review only. No live environment was accessed; every row-level gate claim above is quoted from
`docs/phase-7/gate-ledger.md`. Nothing in this document marks a gate passed.*
