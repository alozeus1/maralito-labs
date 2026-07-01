# Maralito Labs — Platform Validation

> **Date:** 2026-06-30 · **Scope:** validate, harden, and operationalize the existing `maralito-labs`
> monorepo as the internal **golden platform** for future products. Honest, evidence-based. Raw tool
> output in `_evidence/`.

## Is this repo the golden starter?
**Yes — adopt it as the golden platform.** It is a mature, converged, well-architected monorepo at
**Phase 2** (orders domain), with real ADRs, RLS-aware DB access, Supabase RBAC, a security-gated CI,
and a proven LangGraph×Inngest durability spike. **Do not** replace any part with an external starter
kit. **Do not** create a separate `maralito-labs-starter` repo now — this *is* it.

**But it is not "production-ready" today.** On a clean checkout it installs but **fails 4 of 6 quality
gates** due to small, fixable foundation defects, and the **live Supabase RLS gate has not been run**.

## What was validated (real, on this machine)
| Check | Tool | Result |
|-------|------|--------|
| Dependency install | `pnpm install --frozen-lockfile` | ✅ pass |
| Typecheck | `pnpm typecheck` | ❌ fail (observability missing `vitest` devDep) |
| Lint | `pnpm lint` | ❌ fail (2 nits) |
| Tests | per-package | ✅ auth(6), schemas(9), **db RLS(17)** pass · ❌ borderpass (missing `jsdom`) |
| Build | `pnpm build` | ❌ fail (borderpass can't resolve `drizzle-orm` types) |
| Dep audit | `pnpm audit` | ❌ 9 vulns (1 crit vitest, 1 high **drizzle-orm SQLi**, …) |
| Secrets | `gitleaks` | ✅ no leaks |
| SAST | `semgrep` (138 rules, 547 files) | ✅ 0 findings |
| Vuln/secret/misconfig | `trivy fs` | ⚠️ 2 HIGH dep CVEs, 0 secrets, 0 misconfig |
| DB-import guard | `check:db-imports` | ✅ pass |

## What passed / what failed (summary)
- **Passed:** install, RLS mechanism (17 tests on PGlite), RBAC, schemas, secret scan, SAST, db-import
  guard, architecture↔ADR consistency.
- **Failed (fixable, ~1–2 days):** typecheck, lint, app tests, build, dependency audit. See
  `ACTION_PLAN.md` Sprint 0–1.

## What requires live infrastructure (NOT VALIDATED)
- **`NOT FULLY VALIDATED — LIVE SUPABASE REQUIRED`** — the live RLS gate (`live-rls-gate.ts`) through
  the real pooler. **This is the #1 gate before Phase 3 production.**
- **`NOT FULLY VALIDATED — LIVE SERVICE REQUIRED`** — Stripe (and not built — `phase6`), Resend (not
  built — `phase9`).
- **`NOT FULLY VALIDATED — LIVE AI PROVIDER KEY REQUIRED`** — agent runs (not built — `phase10/11`;
  durability proven by the dependency-free spike).
- **`NOT FULLY VALIDATED — LIVE DEPLOY REQUIRED`** — Vercel deploy; AWS infra not present yet.

## What future agents should reuse (not rebuild)
`@maralito/auth` (auth+RBAC), `@maralito/db` (`withTenant`/`withServiceRole`, RLS), `@maralito/schemas`,
`@maralito/observability` (`redact`), and — when built — `@maralito/payments`, `@maralito/notifications`,
`@maralito/ai`, `@maralito/automation`. See `FUTURE_AGENT_POLICY.md` + `REUSABLE_PLATFORM_BLUEPRINT.md`.

## External repos — references only
No external repo should be adopted as a base. Borrow patterns only: KolbySisk (Stripe webhook→DB),
Nextbase (multi-tenant UI), nextjs/saas-starter (teams/activity-log), langgraph(js) + assistant-ui (AI
tier/UI). The one strategic call: prefer **langgraphjs** so the AI tier stays TypeScript + in-monorepo.
See `EXTERNAL_REFERENCE_REPOS.md`.

## Cost-saving recommendations (top 5)
1. One DB per app — **Supabase or Neon, not both**. 2. Long/cron/queue work → **Inngest**, not Vercel
functions. 3. **AWS only** for real durability/networking (S3/SQS/EventBridge/Lambda; avoid EKS early).
4. AI: **mocked tests by default**, token budgets, model tiering, cache+batch. 5. **Langfuse
(self-hosted)** + OTel/Sentry/PostHog for observability. See `COST_OPTIMIZATION_GUIDE.md`.

## Risks & warnings
- CI on a clean branch is **red today** (same gates fail) — fix Sprint 0 first.
- **`drizzle-orm` 0.33.0 has a HIGH SQL-injection CVE** in the data layer — bump before production.
- Tenant isolation is **proven in mechanism, not in production** — run the live RLS gate.
- Billing/email/AI are **placeholders** — never describe them as ready.

## Documents in this folder
| File | Purpose |
|------|---------|
| `PLATFORM_DECISION.md` | ADR-by-ADR validation; adopt-the-platform decision |
| `CURRENT_REPO_AUDIT.md` | Repo discovery + structure + implementation status |
| `PHASE_READINESS_REPORT.md` | Real build/lint/typecheck/test results |
| `PRODUCTION_READINESS_GATE.md` | Stripe/Resend/Neon/Vercel/AWS readiness |
| `SECURITY_AUDIT.md` | Scanner results + manual security review |
| `RLS_VALIDATION_REPORT.md` | RLS mechanism (proven) + live gate (pending) |
| `AI_WORKFLOW_VALIDATION.md` | LangGraph×Inngest design + spike validation |
| `COST_OPTIMIZATION_GUIDE.md` | Cost posture across the stack |
| `REUSABLE_PLATFORM_BLUEPRINT.md` | How to build future apps on the platform |
| `FUTURE_AGENT_POLICY.md` | Binding rules for future agents |
| `EXTERNAL_REFERENCE_REPOS.md` | External repos as references only |
| `GAP_ANALYSIS.md` | Findings by severity |
| `ACTION_PLAN.md` | Ordered, validated remediation plan |

## Next recommended phase
**Phase 2.x hardening** → `ACTION_PLAN.md` Sprint 0 (restore green) + Sprint 1 (dep CVEs), then
**Sprint 2 (live Supabase RLS gate)**. Only after those is the platform "Phase-3 ready". Keep
revenue/comms/AI integrations on their phased roadmap and validate each before calling it ready.

---

```
MARALITO LABS PLATFORM VALIDATION COMPLETE

Production readiness:   NOT READY — 4/6 local gates fail (fixable, ~1–2 days)
Phase readiness:        Phase 2 complete; Phase-3 ready AFTER hardening + live RLS gate
Security gate:          STRONG code posture (gitleaks ✅, semgrep ✅) — dep CVEs to fix (drizzle-orm HIGH)
RLS gate:               MECHANISM PROVEN (17/17 PGlite) — LIVE: NOT FULLY VALIDATED, LIVE SUPABASE REQUIRED
AI workflow gate:       DESIGN + SPIKE PROVEN — not implemented (phase 10/11); LIVE AI KEY REQUIRED for runs
Cost posture:           Lean & correct (Supabase+Vercel+Inngest); AWS only on real need; AI mocked-first
External starter need:  NONE — adopt this repo; external repos are references only
Recommended next action: Execute ACTION_PLAN Sprint 0 (restore green CI), then Sprint 2 (live RLS gate)
```
