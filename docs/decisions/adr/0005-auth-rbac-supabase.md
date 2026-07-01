# ADR 0005 — Auth, RBAC & identity: BorderPass-local foundation on Supabase

- **Status:** Accepted · **Date:** 2026-06-29 · **Phase:** 1
- **Deciders:** Principal Backend Eng, Auth/RBAC Eng, Security Architect (approved by product owner)

## Context
The contracts treat Identity, RBAC, and Audit as **platform-owned** (consumed via `@maralito/sdk`). But the SDK surface is **not yet confirmed** (Phase 0 gap), and Phase 1 needs a working, testable auth/RBAC/audit foundation now. Auth method was also open; the PRD's production primary is phone OTP.

## Decision
1. **Build a BorderPass-local foundation** on **Supabase** (Auth + Postgres): local `user_identities`, `organizations`, `roles`, `permissions`, `role_permissions`, `user_roles`, `audit_logs`. RBAC helpers + RLS enforce access. This unblocks Phase 1.
2. **Auth method = email magic-link / OTP** for Phase 1 (dev-testable without SMS infra). Phone OTP (production primary) is a later increment; the session/RBAC layer is auth-method-agnostic.
3. **Boundary preserved:** `@maralito/sdk` stays a typed placeholder (now with refined `IdentityService`/`AuditService` shapes). When the platform SDK surface is confirmed, these local tables become the **adapter / sync target** — the app calls the SDK; the local foundation either backs it (self-hosted dev) or syncs.

## Rationale
- Lets auth/RBAC/route-protection/audit work and be tested today, without blocking on an external team.
- Supabase Auth + native Postgres RLS gives the double-enforcement the security model requires.
- The seam (`getAppSession`, `@maralito/sdk` interfaces) keeps the migration to platform-owned identity a contained change, not a rewrite.

## Consequences
- Some duplication with eventual platform Identity (mitigated by the adapter boundary).
- Phone OTP, KMS field-encryption (RFC/KYC), and platform-Audit hash-chaining are deferred.
- A confirm-and-migrate task is required when the SDK lands (tracked in the Phase 2 readiness checklist).

## Alternatives considered
- **Block Phase 1 on SDK confirmation:** safer for long-term ownership but stalls all auth work — rejected.
- **Email + password:** simpler but off the PRD's passwordless direction — rejected for OTP.
