# Reusable Platform Blueprint — Building Future Apps on maralito-labs

> How a future Maralito Labs product is started **from this monorepo** instead of re-cloning starters.
> Pair this with `FUTURE_AGENT_POLICY.md`. All paths are repo-relative.

## Mental model
**Thin app, fat platform.** An app under `apps/*` is mostly route groups + domain logic + UI. Auth,
RBAC, DB access, validation, observability, billing, email, and AI orchestration come from
`packages/@maralito/*`. You should rarely add a new cross-cutting dependency — you wire a shared one.

## 1. Create a new app
1. `apps/<newapp>/` with a Next.js 15 App Router skeleton (copy `apps/borderpass` structure).
2. Route groups per ADR-0001: `app/(public)/ (auth)/ (customer|user)/ (admin)/`.
3. `package.json`: depend on the shared packages via `workspace:*`
   (`@maralito/auth`, `@maralito/db`, `@maralito/schemas`, `@maralito/observability`, `@maralito/ui`,
   `@maralito/sdk`; add `payments`/`notifications`/`ai`/`automation` when those phases land).
4. Add `tsconfig` extending `@maralito/config`, `eslint`/`tailwind` presets from `@maralito/config`,
   `vitest.config.ts` (**remember `jsdom` devDep if `environment: 'jsdom'`** — the gap we hit), and a
   `playwright.config.ts`.
5. Add the app to nothing else — `pnpm-workspace.yaml` already globs `apps/*`.

## 2. New route group
Add `app/(groupname)/...` and protect it in `middleware.ts` + server guards from `@maralito/auth`.
Admin/finance/compliance groups must enforce RBAC **and** rely on RLS for data (never RBAC alone).

## 3. New domain package
- Small/app-specific → `apps/<app>/src/domain/<name>/` (like `domain/orders`): a state machine +
  rules + transitions + tests.
- Reusable across apps → a new `packages/@maralito/<name>` with `lint/typecheck/test` scripts and a
  clean public surface (**do not re-export ORM/provider types** — expose your own types).

## 4. Shared auth & RBAC
```ts
import { getSession } from '@maralito/auth';
import { can } from '@maralito/auth/rbac';
// guard a server action / route handler:
if (!can(session.role, 'orders:approve')) throw forbidden();
```
Add new roles/permissions in `@maralito/auth/rbac` (with unit tests) — not ad hoc per app.

## 5. Shared, RLS-aware DB access
```ts
import { withTenant, withServiceRole } from '@maralito/db';
// tenant data — RLS enforced, fail-closed:
const orders = await withTenant(db, ctx, (tx) => tx.select().from(ordersTable));
// privileged system op — bypass by design, requires a reason + audit:
await withServiceRole(db, 'seed:reference-data', (tx) => /* … */);
```
**Never** import a raw client for tenant data — `pnpm check:db-imports` will fail CI.

## 6. Migrations
- Edit Drizzle schema in `packages/db/src/schema/*`.
- `pnpm --filter @maralito/db db:generate` → review SQL → `db:migrate`.
- Keep migration ordering linear; seed via `db:seed` (idempotent).

## 7. RLS policies (required for every tenant table)
- Add policies to `packages/db/src/rls/*.sql` (RLS enabled + default-deny, owner/staff/role scoping,
  writes **and** reads).
- **Add isolation tests** in `packages/db/tests/*.isolation.test.ts` (PGlite) — copy the orders-RLS
  test as a template. A tenant table without isolation tests is not done.
- Before production, the **live Supabase RLS gate** must cover the new policies.

## 8. Stripe billing (when Phase 6 lands)
Build inside `@maralito/payments`: idempotent payment intents (by a business id), **webhook signature
verification** (`STRIPE_WEBHOOK_SECRET`), status sync to DB, refunds (idempotent), plan gating via
RBAC/entitlements. Reference KolbySisk's webhook→DB sync pattern. Test with `stripe listen` + a live
webhook before claiming ready.

## 9. Resend email (when Phase 9 lands)
Build inside `@maralito/notifications`: provider adapter + EN/ES templates, channel fallback, quiet
hours, idempotent per event, bounce handling. Verify the sending domain. Send a real test email before
claiming ready.

## 10. LangGraph workflows (when Phase 11 lands)
Build inside `@maralito/ai`: Manager + agents, **scoped** tool registry, output schemas (verdict +
confidence + rationale), prompt-injection defense, per-workflow token budget. AI is **recommend-only**
for risk/payment/refund — the orchestrator inserts a human `approval` step. Mocked tests first; eval
gate (prohibited false-clear = 0).

## 11. Inngest background jobs (when Phase 10 lands)
Build inside `@maralito/automation`: Inngest client + durable workflows; long workflow = the domain
state machine; human gates = `step.waitForEvent`; checkpoint via LangGraph `PostgresSaver` (Plan B:
manual `agent_checkpoints`). Idempotent by event id; DLQ + saga compensation.

## 12. Audit logging
Use `apps/<app>/src/server/audit.ts` pattern + `withServiceRole` for append-only audit writes. Log
every sensitive/irreversible action (approve, refund, role change). Route all logs through
`@maralito/observability.redact()` so tokens/PII never persist.

## 13. Tests
Per package: unit (Vitest) + RLS isolation (db) + RBAC (auth) + domain state-machine tests. Per app:
Playwright e2e on preview. **All of `typecheck/lint/test/build/check:db-imports` must be green** before
merge.

## 14. Deploy
Vercel for the app (map all env vars per scope), Cloudflare for DNS/WAF/R2, Supabase for DB/auth,
Inngest for workflows. Add `infra/` (Terraform) only when AWS durability/networking is actually needed.

## 15. Avoid duplicating platform code
Before writing auth/db/billing/email/AI/logging code, **check `packages/@maralito/*` first** and extend
the shared package. If you find yourself copying a pattern between apps, promote it to a package.
