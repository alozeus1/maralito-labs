# Platform Decision — ADR & Architecture Validation

> **Validated:** 2026-06-30 · Each ADR checked against actual files in the repo.
> Legend: ✅ implemented & consistent · 🟡 partial / live-gate pending · 🔌 designed, future phase.

## Decision
**Adopt the existing `maralito-labs` monorepo as the internal golden platform.** The architecture is
coherent, the ADRs are real (not aspirational), and implementation matches decisions for every shipped
phase. No external starter kit should replace any part of it (see `EXTERNAL_REFERENCE_REPOS.md`). The
only blockers are foundation defects + the live RLS gate (tracked elsewhere), not design flaws.

## ADR-by-ADR validation
### ADR-0001 — Single app, route groups
**Decision:** one Next.js app with `(public)(auth)(customer)(admin)` route groups (not micro-apps).
**Status:** ✅ Implemented. `apps/borderpass` App Router + `middleware.ts` + i18n `messages/`.
**Risk/Fix:** none. Re-confirm admin-group guard coverage when real admin routes land (Phase 3+).

### ADR-0002 — Monorepo structure
**Decision:** Turborepo + pnpm workspaces; thin app, fat platform (`apps/*`, `packages/*`).
**Status:** ✅ Implemented. `turbo.json`, `pnpm-workspace.yaml`, 11 shared packages, `workspace:*` deps.
**Gap:** the `borderpass` build leaks `drizzle-orm` types across the `@maralito/db` boundary (see
`PHASE_READINESS_REPORT.md §4`) — a small boundary erosion to fix to keep the contract clean.

### ADR-0003 — Security-gated CI
**Decision:** CI blocks on quality + secret-scan + SAST + dependency gates.
**Status:** ✅ Implemented. `ci.yml` = quality / gitleaks / semgrep / pnpm-audit + osv-scanner.
**Risk:** CI on a clean branch is **red today** (the same gates fail locally). Fix foundation defects
to restore green. Hardening TODOs (pin actions by SHA, protect main) noted in the workflow.

### ADR-0004 — LangGraph × Inngest (spike-gated)
**Decision:** durable AI orchestration via LangGraph checkpointer × Inngest; spike before committing.
**Status:** 🟡 Spike complete + decision sound; **implementation pending** (`@maralito/ai`,
`@maralito/automation` are placeholders, phases 10–11). `spike/checkpointer-inngest/proof.mjs` proves
pause/resume-across-restart durability; `production-pattern.ts` is the reference wiring.
**Risk/Fix:** see `AI_WORKFLOW_VALIDATION.md`. Verify exact `@langchain/langgraph-checkpoint-postgres`
version on real install; keep Plan B (manual `agent_checkpoints` table) documented.

### ADR-0005 — Auth & RBAC on Supabase
**Decision:** Supabase Auth + app-side RBAC (9 roles + agent principal).
**Status:** ✅ Implemented & tested. `@maralito/auth` (`rbac/{roles,permissions}.ts`, `session.ts`,
`supabase/{browser,server,service}.ts`) + 6 passing tests.
**Risk:** MFA enforcement for admin/finance/compliance to confirm in live env.

### ADR-0006 — RLS-aware server DB access
**Decision:** all tenant data via `withTenant` (RLS-enforced); `withServiceRole` only for 4 privileged
cases (requires `reason` + audit); raw client never for tenant data.
**Status:** ✅ Implemented. `packages/db/src/tenant.ts`, `policies.sql`, fail-closed `strict` mode;
`scripts/check-db-imports.mjs` guard **passes** (no raw-client leakage). 17 RLS tests pass on PGlite.
**Risk:** live-pooler behavior unverified (ADR-0007 gate).

### ADR-0007 — New-user provisioning + live RLS gate
**Decision:** safe provisioning of identities/roles; a **live Supabase RLS gate is blocking** before
relying on isolation in production.
**Status:** 🟡 Provisioning implemented + tested (3 tests). **Live gate NOT run** —
`scripts/live-rls-gate.ts` exists but needs a real Supabase project. → `NOT FULLY VALIDATED — LIVE
SUPABASE REQUIRED`. This is the **#1 gating item** before Phase 3 production.

### ADR-0008 — Orders domain foundation
**Decision:** orders as a 25-state machine with RLS-scoped persistence.
**Status:** ✅ Implemented. `apps/borderpass/src/domain/orders/state-machine.ts` (+ tests),
`order-transitions.ts`, `order-events.ts`, `rls/orders-policies.sql`, 5 passing orders-RLS tests.

## Architecture invariants — verified
| Invariant | Holds? | Evidence |
|-----------|:------:|----------|
| Thin app, fat platform | ✅ (minor leak) | app consumes `@maralito/*`; only the drizzle-type leak breaks purity |
| RBAC + RLS double enforcement | ✅ mech / 🟡 live | guards + policies + 17 tests; live gate pending |
| AI is human-in-the-loop for risk | 🔌 design | structural approval-step design; enforce when `@maralito/ai` is built |
| No provider keys in app (AI via gateway) | ✅ design | `LANGGRAPH_GATEWAY_*` envs; no provider keys in app code |
| Audit sensitive actions | ✅ | `server/audit.ts`; append-only to confirm in live gate |
| Per-env isolation, no committed secrets | ✅ | gitleaks clean, `.env.example` names-only |

## Conclusion
Implementation **matches the ADRs** for every shipped phase; future-phase packages are honestly
labeled placeholders. The platform decision is **sound and ratified by evidence**. Proceed with
hardening + the live RLS gate; do not re-architect.
