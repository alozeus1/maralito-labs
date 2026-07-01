# Future Agent Policy — maralito-labs

> **Audience:** every future Claude Code / AI agent (and human) working in this repo.
> **Status:** binding. Read this **and** the relevant ADRs before changing anything.

## Source of truth
1. **`maralito-labs` is the source of truth.** It is the internal golden platform. Build *from* it,
   not around it.
2. **Do not introduce random starter kits** into the repo. External repos
   (`EXTERNAL_REFERENCE_REPOS.md`) are *references* — borrow a pattern, cite it, but do not adopt one
   as a base or copy license-restricted code.
3. **Before recommending any external repo, prove the current repo lacks the capability.**

## Reuse before rebuild
4. **Never rebuild from scratch** what the platform already provides. Use the shared packages:
   - Auth / sessions / Supabase clients → `@maralito/auth`
   - RBAC (roles + permissions) → `@maralito/auth/rbac`
   - DB access (always RLS-aware) → `@maralito/db` (`withTenant` / `withServiceRole`)
   - Validation / schemas → `@maralito/schemas`
   - Logging / PII redaction → `@maralito/observability` (`redact`)
   - Billing → `@maralito/payments` (build it out; don't fork a new billing lib)
   - Email/SMS/WhatsApp → `@maralito/notifications`
   - AI orchestration → `@maralito/ai` + `@maralito/automation` (LangGraph × Inngest)
5. **All tenant data access goes through `withTenant`.** Never import a raw DB client for tenant data
   (the `check:db-imports` guard will fail you). `withServiceRole` only for the 4 sanctioned cases,
   always with a `reason` + audit.

## Architecture discipline
6. **Read ADRs (`docs/decisions/adr/`) before architecture changes.** They are real and enforced.
7. **Update / add an ADR when changing a major decision.** No silent drift.
8. **Respect "thin app, fat platform."** Reusable logic belongs in `packages/*`, not in an app. Don't
   leak ORM/provider types across package boundaries (see the drizzle-type build gap as the cautionary
   example).

## Validation gates (no exceptions)
9. **Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm check:db-imports` and confirm
   exit 0 before claiming any work is complete.** Paste the evidence.
10. **Run the security gates before any production claim:** `pnpm audit --audit-level=high`,
    `gitleaks detect`, `semgrep` (the repo's `p/*` ruleset), `trivy fs`.
11. **Validate RLS before claiming data isolation is safe.** Mechanism tests (`@maralito/db`) must be
    green **and** the live Supabase RLS gate must have run. Otherwise say
    `NOT FULLY VALIDATED — LIVE SUPABASE REQUIRED`.
12. **Validate Stripe webhooks** (signature + idempotency, `stripe listen` + a live event) before
    claiming billing is ready.
13. **Validate Resend delivery** (a real sent+received email, verified domain) before claiming email is
    ready.
14. **Validate LangGraph/Inngest workflows with mocked tests first.** Prove durability/approval/retry
    with mocks before any live model call.

## Cost & honesty
15. **Avoid unnecessary live AI calls.** Default to mocked tools/tests. Set token budgets per
    user/workflow. No autonomous infinite loops.
16. **Keep cost low by default** (`COST_OPTIMIZATION_GUIDE.md`): prefer platform reuse over adding new
    paid services; don't run Supabase Postgres *and* Neon for one small app; use AWS only for a real
    durability/networking need; cheaper models for low-risk tasks.
17. **Never fake passing tests.** Never claim a gate passed without running it. Never present a
    placeholder as implemented.
18. **Clearly mark anything requiring live infrastructure** with
    `NOT FULLY VALIDATED — LIVE INFRASTRUCTURE REQUIRED` and say exactly what's missing.

## Starting a new app or domain
19. Follow `REUSABLE_PLATFORM_BLUEPRINT.md` — new app under `apps/*`, new domain as a package or
    `apps/<app>/src/domain/*`, consume shared packages, add RLS policies + isolation tests for every
    new tenant table, wire audit logging for sensitive actions.
20. **Smallest safe change.** Don't refactor unrelated code. Defer out-of-scope improvements (note
    them, don't chase them).
