# Decision Record — Preview Branching (PENDING)

> ADR-0013 · Phase 7 · **Status: 🔲 NOT CONFIGURED.** Template for an operator to complete.
> Claude has NOT configured preview branching.

## Goal
Define how ephemeral preview environments map database + secrets so PRs can be validated without touching
staging/production data.

## Options to evaluate (fill in)
| Aspect | Option A | Option B | Decision |
|--------|----------|----------|----------|
| DB per preview | Supabase branch per PR | shared preview DB | |
| Migrations on preview | auto on branch create | manual | |
| RLS policies on preview | applied via CI | manual | |
| Secrets on preview | scoped preview secrets | reuse test secrets | |
| Vercel preview ↔ Supabase branch mapping | | | |
| Teardown | auto on PR close | manual | |

## Decision (to complete)
- **Preview DB strategy:** _____________________
- **Secret scoping:** _____________________
- **Migration + policy application:** _____________________
- **Configured by / date:** _____________________

## Consequence
Until configured, the "preview-branching decision" gate in `docs/phase-7/gate-ledger.md` stays unchecked, and
no preview-based readiness may be claimed.
