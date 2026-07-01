# Phase 1 — Secure Backend Foundation

**Goal:** the secure auth/database/RBAC layer the BorderPass MVP builds on. No order/quote/payment/inspection/AI/admin-feature logic.

## What shipped
- **`@maralito/db`** — Drizzle schema (organizations, user_identities, customer/staff profiles, roles, permissions, role_permissions, user_roles, audit_logs, platform_config, feature_flags), client factory, **RLS policies** (`src/rls/policies.sql`), id helper, dev seed.
- **`@maralito/auth`** — 3 Supabase client patterns (browser/server/**service-role server-only**), `AppSession` + builder, typed `AuthError`, RBAC (roles, permissions, `hasRole/hasPermission/isStaff/requireAuth/requireRole/requirePermission/requireAdminAccess/requireCustomerAccess`).
- **`@maralito/schemas`** — Zod: ProfileCreate/Update, StaffProfile, RoleAssignment, PaginationParams, ApiError/Success (+ primitives).
- **`@maralito/observability`** — `redact()` (secret-key redaction) + init structure.
- **App** — `middleware.ts` (session refresh + coarse protection), server helpers (`env`, `supabase`, `auth`, `audit`), email-OTP `/login` + `/sign-up`, `/auth/callback`, customer + admin **server-side guards**, `/admin`, `/unauthorized`, `upsertMyProfile` action.

## Docs in this folder
`database-foundation.md` · `auth-rbac.md` · `rls-strategy.md` · `audit-logging.md` · `phase-1-completion-report.md` · `phase-2-readiness-checklist.md` · ADR `decisions/adr/0005-auth-rbac-supabase.md`.

## Key decisions
- **Email magic-link/OTP** for the Phase 1 foundation (phone OTP = later). 
- **BorderPass-local identity/RBAC/audit foundation** (ADR-0005) — adapter/sync target for `@maralito/sdk` when its surface is confirmed.

## Run (real env)
`pnpm --filter @maralito/db db:generate && db:migrate` → apply `src/rls/policies.sql` → `db:seed` → `pnpm dev`. Tests: `pnpm test`.
