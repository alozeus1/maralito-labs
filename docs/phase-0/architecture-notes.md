# Phase 0 — Architecture Notes

## Monorepo
pnpm + Turborepo. `apps/borderpass` is the only app (single app + route groups, ADR 0001).
`packages/*` are shared and contract-bounded so future Maralito apps reuse them. Import boundary is
lint-enforced (`no-restricted-imports`): apps never deep-import platform internals.

## App
Next.js App Router. Route groups: `(public)` welcome/about, `(auth)` login, `(customer)` shell + home,
`(admin)` shell. `app/api/health` is the only live endpoint. `src/{domain,workflows,agents,db,sdk,events,ui}`
are empty module stubs for later phases. i18n catalogs (`messages/en.json`, `es.json`) seeded; the
"no hardcoded user-facing strings" policy starts now. Tailwind theme bridges the Stitch tokens
(`@maralito/config/tailwind`).

## Shared packages (Phase 0 = typed placeholders)
- `@maralito/sdk` — **boundary only**; the single seam to platform services; real surface confirmed before Phase 1.
- `@maralito/db` — Drizzle client structure (no schema); RLS in DB, tenant context only in BFF.
- `@maralito/auth` — Supabase Auth + RBAC `can()` types (Role union, Session).
- `@maralito/payments` / `@maralito/notifications` — Stripe / Resend+Twilio config structures.
- `@maralito/automation` — Inngest client + step-type union.
- `@maralito/ai` — LangGraph/gateway types; `MVP_AUTONOMY = 'suggest'` (recommend-only).
- `@maralito/observability` — Sentry/OTel/PostHog init structure.
- `@maralito/ui` — token bridge + Button types (components in Phase 2).
- `@maralito/schemas` — Zod primitives (Money minor-units, Phone E.164, prefixed-ULID ids) + tests.

## Security posture (from Phase 0)
Names-only `.env.example`; gitleaks allowlist for placeholders; CI blocks on gitleaks/semgrep/osv/pnpm-audit.
RBAC+RLS, KMS, audit, no-provider-keys, masking are enforced from Phase 1 (types/structure prepared now).

## Key invariants carried into code
Money = integer minor units + currency. `org_id` from session only (never request body). `Order.status`
mutated only via workflows. AI recommend-only (`suggest`). "Powered by Maralito Labs" only in welcome/about/settings.
