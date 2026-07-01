# Phase 1.6 — New-User Provisioning

## Problem
A fresh OTP signup had no `user_identities` row or `customer` role → `getAppSession` returned null → customer guard failed.

## Solution
On first successful auth (`app/auth/callback/route.ts` after `exchangeCodeForSession`):
`provisionAuthenticatedUser(authUserId, email?)` → `withPrivilegedDbAccess('provision:new_user', db => provisionUserCore(db, …))` → audit `user.provisioned`.

`provisionUserCore` (in `@maralito/db`, pure/testable) is **idempotent**:
1. `user_identities` (auth_user_id, org_id = shared customer org) — `onConflictDoNothing` (unique auth_user_id).
2. `user_roles` (…, 'customer') — `onConflictDoNothing` (unique auth_user_id,org_id,role_key).
3. `customer_profiles` baseline (display_name = email local-part or "Customer", language 'es') — `onConflictDoNothing`.

## Org model (ADR-0007)
**Single shared customer org** (`BORDERPASS_DEFAULT_CUSTOMER_ORG_ID`). Per-customer isolation = owner predicate in RLS (`auth_user_id = auth.uid()`).

## Rules honored
Idempotent · no duplicate roles · no admin intervention · service-role not in client code · audited · safe on failure (typed error; callback still redirects) · never logs OTP/tokens/secrets.

## Tested (real PGlite)
identity+role+profile created · idempotent on repeat · session prerequisites present (orgId + customer role → guard passes). Full `getAppSession`/guard round-trip is covered by the **live OTP smoke** (gated).
