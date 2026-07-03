# ADR 0014 — Phase 8 Scope + Sequencing (PROPOSED)

- **Status:** **PROPOSED** (not accepted; no implementation). Accepted only when the owner sends `START BORDERPASS PHASE 8`.
- **Date:** 2026-07-02 · **Phase:** 8 (planning) · **Numbering:** 0014 = Phase 8 scope. Next ADR = 0015.
- **Supersedes//builds on:** ADR-0013 (live-gate hardening). See `docs/phase-8/phase-8-plan.md`.

## Context

Phases 0–7 delivered a development-only, gate-hardened foundation: auth/RBAC, RLS (live gate passed),
orders/quotes/payments (Stripe TEST), inspection/delivery sub-status, notification outbox (placeholder),
and Phase-7 live-gate tooling. Remaining Phase-7 gates **11 (OTP)**, **18 (secret rotation)**, **19 (owner
sign-off)** are still open. The owner selected **all four** candidate Phase-8 workstreams.

## Decision (proposed)

1. **Phase 8 = four workstreams**, each an independently increment-gated sub-phase:
   **8A** private mobile PWA tester release (synthetic) · **8B** KMS envelope encryption for real PII ·
   **8C** real notifications + delivery providers · **8D** refunds & disputes.
2. **Phase 7 must close first** (rows 11/18/19). No Phase-8 implementation begins before that + an explicit
   `START BORDERPASS PHASE 8 — <sub-phase>` trigger.
3. **8B (KMS) gates all real PII.** No real address/RFC/KYC/document is stored until 8B is implemented + validated.
   8A and 8D may proceed in synthetic/TEST mode first.
4. **Money and PII stay behind separate owner sign-offs:** Stripe LIVE (row 15) before real charges/refunds; a
   real-PII/pilot round is a separate future plan (not authorized here).
5. All Phase-7 invariants remain in force (state-machine seams, `withTenant`/privileged access, secret hygiene, CI security gates).

## Consequences

- Clear, dependency-safe order; each workstream ships behind its own gates; blast radius contained.
- Larger total scope than a single phase — mitigated by treating 8A–8D as separate sub-phases with their own plans/ADRs (0015+).
- Real-customer readiness (PII + payments + public) remains explicitly out of scope until later, separately-approved phases.

## Non-goals

Public/app-store launch · real payments before Stripe LIVE validation · real PII before 8B · bulk messaging ·
autonomous money movement · starting Phase 8 implementation from this document.

## Status control

**PROPOSED — awaiting Phase 7 close-out + `START BORDERPASS PHASE 8`. BorderPass remains development-only.**
