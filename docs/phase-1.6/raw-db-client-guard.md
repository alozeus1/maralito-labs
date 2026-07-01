# Phase 1.6 — Raw DB Client Guard

**Goal:** domain code can never silently bypass `withTenant`.

## Measures
1. **Renamed** `createDbClient` → `createRawDbClient`; documented as **internal to `@maralito/db`** (migrations/seed/tests only).
2. **Wrappers own the client:** `withTenant`/`withPrivilegedDbAccess` fetch it via internal `getDb()` — app code never imports a raw client.
3. **ESLint** (`apps/**`): `no-restricted-imports` blocks `createRawDbClient`/`createDbClient`/`getDb` from `@maralito/db` with a message to use the wrappers.
4. **CI static scan:** `scripts/check-db-imports.mjs` (run via `pnpm check:db-imports`, wired into CI) **fails** if any `apps/**` file references the raw client.

## Result
`pnpm check:db-imports` → ✅ no raw DB client imports in apps/. Sanctioned access: `withTenant` (tenant), `withPrivilegedDbAccess` (privileged), raw client (migrations/seed/tests only).
