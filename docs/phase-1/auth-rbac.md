# Phase 1 — Auth & RBAC

## Auth flow (email magic-link / OTP)
1. `/login` or `/sign-up` → `supabase.auth.signInWithOtp({ email, emailRedirectTo: /auth/callback })` (browser client, anon key).
2. User clicks the emailed link → `/auth/callback` exchanges the code for a session (server client, cookies).
3. `middleware.ts` refreshes the session on each request and gates routes coarsely.
4. Server layouts resolve the full `AppSession` and enforce fine-grained access.

Phone OTP (PRD production primary) is a later increment — the foundation is auth-method-agnostic.

## Session model
`AppSession = { sub (auth.users.id), orgId, roles[], permissions[] }`. Built by `getAppSession()` (app): Supabase user → `user_identities` (org) → `user_roles` (roles) → `role_permissions` (permissions). Fail-closed: any error or missing identity/DB → `null` (treated as unauthenticated).

## Three Supabase clients (strict separation)
| Client | Key | Where | Notes |
|--------|-----|-------|-------|
| browser | anon (`NEXT_PUBLIC_`) | client components | safe to bundle |
| server | anon + cookies | RSC / route handlers | RLS sees the user |
| **service** | **service-role** | **server-only** | bypasses RLS; `import 'server-only'` guard; privileged ops only |

## RBAC
- **Roles (9):** customer, concierge, inspector, driver, operations_manager, finance_admin, compliance_admin, support_agent, super_admin. `agent` is a principal type, not a role.
- **Helpers** (`@maralito/auth`): `hasRole`, `hasAnyRole`, `hasPermission`, `isStaff`, `requireAuth`, `requireRole`, `requirePermission`, `requireAdminAccess`, `requireCustomerAccess`. Guards throw a typed `AuthError` (`unauthenticated`/`forbidden`/`not_found`).
- **super_admin** implicitly holds all permissions in helpers; separation-of-duties (e.g. no self-approved refund) is enforced at the action sites, not bypassed here.
- **Double enforcement:** app `can()`/guards **and** DB RLS. `requireAdminAccess` returns `not_found` for customers so the admin surface is never revealed.

## Route protection
- **Public:** `/welcome`, `/about`, `/login`, `/sign-up`, `/auth/*`, `/unauthorized`, `/api/health`.
- **Middleware:** unauthenticated + non-public → redirect `/login?next=…`; logged-in on auth screens → `/`.
- **`(customer)` layout:** `requireCustomerAccess` (server) → `/unauthorized` on fail.
- **`(admin)` layout:** `requireAdminAccess` (server) → `/unauthorized` on fail; admin lives at `/admin`.
- Middleware does **coarse** auth (edge, no DB); **role checks** run in Node-runtime server layouts.

## Tested (real)
RBAC helpers (6), validation schemas (8), redaction (2) — all green via `pnpm test`.

---

## Phase 1.5 update (corrects Phase 1 wording)
**Double enforcement is now real on the server path.** Phase 1 implied RBAC + RLS were both active, but the Drizzle BFF path bypassed RLS. As of Phase 1.5 (ADR-0006), tenant data is accessed via **`withTenant(...)`** (sets request identity + assumes the `authenticated` role → RLS enforced); **`withServiceRole(reason, …)`** is the only privileged bypass (audited). `getAppSession` and the profile action now run through `withTenant`.

**Audit wiring added:** `role.assigned`/`role.removed` (`src/server/roles.ts`), `access.denied` (customer + admin guards), `auth.signin`/`auth.signin_failed` (callback), `auth.signout` (action), `super_admin.bootstrap` (seed). See `audit-logging.md`.

**Tested (real):** RBAC helpers (6), validation (8), redaction (2), **RLS isolation on real Postgres (9)** — all green.
