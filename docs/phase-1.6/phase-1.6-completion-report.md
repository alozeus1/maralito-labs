# Phase 1.6 — Completion Report

> **Status:** ✅ COMPLETE (code + real-Postgres tests); **live Supabase gate NOT RUN (blocking)** · **Date:** 2026-06-29
> **Scope:** auth-readiness hardening only. No orders/payments/admin/AI/notifications.

## 1. Fixes vs scope
| Fix | Status |
|-----|--------|
| 1. New-user provisioning flow | ✅ `provisionAuthenticatedUser` + `provisionUserCore` (idempotent) |
| 2. Identity row on signup | ✅ in auth callback |
| 3. Default customer role | ✅ shared customer org (ADR-0007) |
| 4. Profile creation readiness | ✅ baseline profile created |
| 5. OTP smoke path | 🟡 documented (live gate) |
| 6. RLS test loads real policies.sql | ✅ |
| 7. Live Supabase RLS gate | 🟡 script + runbook; **NOT RUN** |
| 8. Privileged-access naming/docs | ✅ `withPrivilegedDbAccess` (+alias) |
| 9. Raw DB client guard | ✅ rename + ESLint + CI scan |
| 10. CI/test gate updates | ✅ `check:db-imports` + RLS/provisioning tests in CI |
| 11. Phase 2 readiness update | ✅ |

## 2. Verified by real execution (sandbox, real Postgres/PGlite)
- **Provisioning (3):** identity+role+profile created; **idempotent** on repeat; session prerequisites present.
- **RLS isolation with the REAL policies.sql (9):** own-row, customer≠staff, non-admin≠audit, super-admin, missing-claims, missing-org, RLS backstop, privileged bypass, duplicate-role rejected.
- **Raw-client guard:** `pnpm check:db-imports` ✅ (app imports zero raw clients).
- **Typecheck:** `@maralito/db` (client/tenant/provisioning/schema) PASS vs real drizzle/postgres.
- Carried unit tests (RBAC 6, validation 6, redaction 2) remain green.

## 3. NOT run (honest) → blocking before Phase 2
- **Live Supabase RLS gate** (15 checks) — needs a real project; see `live-supabase-rls-gate.md`. Includes whether the pooler allows `SET LOCAL ROLE authenticated` (else apply the documented fallback).
- Full `pnpm install` / `next build` / workspace typecheck; CI green on a real PR; OTP round-trip.

## 4. Test classification
| Test | Type | CI-blocking | Notes |
|------|------|:-----------:|-------|
| RBAC, validation, redaction | unit | ✅ | — |
| provisioning.integration | PGlite integration | ✅ | real provisionUserCore |
| rls.isolation (real policies.sql) | PGlite integration | ✅ | applies real policy file |
| raw-db-client guard | static scan | ✅ | `check:db-imports` |
| live-rls-gate | live Supabase | manual gate | **must pass pre-Phase-2** |

## 5. Acceptance criteria
New users provisioned ✅ · default customer role ✅ · idempotent ✅ · getAppSession prerequisites ✅ · customer-guard pass (data present; full round-trip via live OTP) 🟡 · PGlite loads real policies.sql ✅ · live gate exists+documented ✅ · live gate passes **before** Phase 2 ❌ (NOT RUN) · privileged access named/documented ✅ · privileged requires reason+audit ✅ · raw client guarded ✅ · tests pass ✅ · docs complete ✅ · Phase 2 checklist updated ✅.

## 6. Recommendation
Phase 1.6 code is complete and proven on real Postgres. **Run the live Supabase gate** (apply fallback if `SET LOCAL ROLE` fails) and the carried env prerequisites, then proceed to **Phase 2 — Orders foundation (ADR-0008)**.

> Ready for Phase 2 when the user gives the command: **START BORDERPASS PHASE 2**
