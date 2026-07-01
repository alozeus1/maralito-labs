# Action Plan — Restore Green & Reach Phase-3 Readiness

> **Validated baseline:** 2026-06-30. Ordered, copy-pasteable. IDs map to `GAP_ANALYSIS.md`.
> Each step lists the exact validation command that must exit 0 before it's "done". **Never mark a step
> complete without running its validation.**

## Sprint 0 — Restore green CI (~½ day, do first)
Goal: all six local gates exit 0.

1. **H1 + H3 (observability):** add `vitest` devDep + `test` script to `packages/observability`; fix
   the `as any` in `redact.test.ts`.
   - `pnpm --filter @maralito/observability add -D vitest`
   - add `"test": "vitest run"` to its `package.json` scripts
   - replace `as any` with a typed cast / interface
   - ✅ `pnpm --filter @maralito/observability typecheck && pnpm --filter @maralito/observability test`
2. **H3 (db lint):** fix `no-unused-expressions` in `packages/db/scripts/live-rls-gate.ts` (make it an
   assignment/call or add a scoped disable).
   - ✅ `pnpm --filter @maralito/db lint`
3. **H2 (borderpass tests):** `pnpm --filter borderpass add -D jsdom`
   - ✅ `pnpm --filter borderpass test`
4. **C1 (build):** fix the Drizzle type leak. Preferred: ensure `@maralito/db` exposes app-facing types
   (don't re-export `drizzle-orm` types through its public API). Quick unblock: `pnpm --filter
   borderpass add drizzle-orm`.
   - ✅ `pnpm build`
5. **Full green check:**
   - ✅ `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm check:db-imports`

## Sprint 1 — Dependency hardening (~½ day)
6. **C3 + H4:** bump vulnerable deps.
   - `pnpm up -r vitest@^3` (resolves vitest critical + vite/vite-node high transitive)
   - `pnpm up -r drizzle-orm@^0.45.2 drizzle-kit@latest`
   - add to root `package.json`: `"pnpm": { "overrides": { "lodash": "^4.18.0" } }`
   - **re-run the 17 RLS tests** after the drizzle bump (API check): `pnpm --filter @maralito/db test`
   - ✅ `pnpm audit --audit-level=high` (exit 0)

## Sprint 2 — Live RLS gate (blocking for Phase 3) — needs live Supabase
7. **C2 + M1:** stand up a real Supabase project (or preview branch); apply migrations +
   `policies.sql` + `orders-policies.sql` + seed; set `DATABASE_URL`/`SUPABASE_DB_*`.
   - run `pnpm --filter @maralito/db exec tsx scripts/live-rls-gate.ts`
   - confirm `set local role authenticated` works through the **pooler**
   - confirm audit logs are append-only at the DB level
   - record result in `RLS_VALIDATION_REPORT.md`; flip gate to ✅
   - ⚠️ Until done: `NOT FULLY VALIDATED — LIVE SUPABASE REQUIRED`

## Sprint 3 — CI / deploy hardening (~½ day)
8. **M2:** pin all GitHub Action `uses:` by commit SHA; enable branch protection on `main`; require all
   4 CI jobs.
9. **M5:** tune semgrep ruleset (replace `--config auto` with the explicit `p/*` set already used
   locally to reduce noise).
10. **M4:** add Vercel project config + env-var mapping (all 48 keys → preview/prod scopes).
    - ✅ a green preview deploy (LIVE DEPLOY REQUIRED to fully validate)

## Sprint 4 — Limiter + SDK (before public traffic)
11. **H5:** implement Upstash rate-limit middleware; apply to auth + (future) webhook routes.
    - ✅ limiter unit test + 429-on-burst integration test
12. **M3:** finalize `@maralito/sdk` surface (resolves known gap #3, unblocks clean app↔platform BFF).

## Future phases (roadmap, validate per-integration — do NOT claim ready early)
- **Phase 6 — Stripe:** implement intents (idempotent by `quote_id`) + **webhook signature verify** +
  refunds; validate with `stripe listen` locally and live webhook before "billing ready".
- **Phase 9 — Resend/Twilio:** adapters + templates + domain verification (SPF/DKIM/DMARC) + bounce
  handling; send a real test email before "email ready".
- **Phase 10 — Inngest:** client + W1–W15 + saga compensation + DLQ; verify checkpointer×Inngest on
  real Postgres (keep Plan B).
- **Phase 11 — AI agents:** Manager + agents + scoped tools + guardrails; **mocked tests first**, then
  eval gate (prohibited false-clear = 0); enforce token budgets.

## Definition of "Phase-3 ready"
All of: Sprint 0 green ✅ · Sprint 1 audit clean ✅ · Sprint 2 live RLS gate green ✅ · CI pinned +
`main` protected ✅. Cleanup items (L1–L4) can trail. Revenue/comms/AI integrations remain future-phase
and are not part of Phase-3 readiness.
