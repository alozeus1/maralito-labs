# Decision Record — Preview Branching

> ADR-0013 · Phase 7 · **Status: 🔲 NOT CONFIGURED — OWNER SIGN-OFF REQUIRED.**
> Drafted for owner decision. Claude has NOT configured preview branching and does not mark ledger row 17 passed.
> Development-only. No real PII in any preview environment.

## Goal

Define how ephemeral **Vercel preview deployments** map their database + secrets, so PRs can be validated without touching staging/production data — and decide the **isolation model** for preview databases.

## Options

### Option A — Vercel preview deployments + shared Supabase dev-gate project
- **What:** every preview deploy points at the single shared `borderpass-dev-gate` Supabase project.
- **Pros:** simplest; no per-branch DB provisioning; reuses the already-validated dev-gate + RLS.
- **Cons:** **weaker isolation** — previews share one database; a bad migration or seed in one preview affects all; no per-PR teardown.
- **Fit:** acceptable **only** for non-PII development testing with synthetic data.

### Option B — Vercel preview deployments + branch-scoped Supabase preview databases
- **What:** each PR/branch gets its own Supabase preview branch/database; migrations + all 7 RLS files + seed applied per branch via CI (`live-gates.yml` pattern); teardown on PR close.
- **Pros:** **stronger isolation** — schema/data changes are contained per PR; closest to real deploy semantics; safe parallel testing.
- **Cons:** more operational complexity (provisioning, secret scoping per branch, migration/policy automation, teardown, cost).
- **Fit:** the target once the app moves toward staging; requires the RLS-apply automation already added to `live-gates.yml`.

### Option C — No preview branching until staging architecture is decided
- **What:** defer preview environments entirely; validate via local Pass 2 + the manual `live-gates` workflow against the dev-gate project.
- **Pros:** **safest** while secrets, RLS, and live gates are still stabilizing; nothing new to secure.
- **Cons:** no per-PR live preview; reviewers rely on CI + local runs.
- **Fit:** reasonable current default given rotation + Stripe + KMS gates are still open.

## Recommended decision (for owner ratification)

1. **Do not enable preview deployments until the env/secrets review (row 18) is complete** and exposed dev secrets are rotated.
2. **Never use real PII in any preview** — synthetic data only, regardless of option chosen.
3. **Keep Supabase preview branching (Option B) unresolved until the owner chooses the isolation model.** In the interim, **Option C** (defer) is the safe default; **Option A** may be used only for non-PII synthetic dev testing with clear "shared DB — no isolation" labeling.
4. Whichever is chosen, previews must reuse the CI **RLS-apply automation** and **scoped preview secrets** (never production/live keys, never `NEXT_PUBLIC_*` for server-only secrets).

## Decision (owner completes)

- **Preview DB strategy (A / B / C):** _____________________
- **Secret scoping for previews:** _____________________
- **Migration + RLS policy application on previews:** _____________________
- **Teardown policy:** _____________________
- **Configured by / date:** _____________________

## Status

```
NOT CONFIGURED — OWNER SIGN-OFF REQUIRED
```

Until an owner completes and signs this record, gate row 17 in `docs/phase-7/gate-ledger.md` stays 🔲 and no preview-based readiness may be claimed.
