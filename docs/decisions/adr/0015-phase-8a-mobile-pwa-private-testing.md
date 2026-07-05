# ADR 0015 — Phase 8A: Mobile PWA Private Testing Round (ACCEPTED — dev-only scope)

- **Status:** **ACCEPTED (8A dev-only work)** — owner issued **`START BORDERPASS PHASE 8 — 8A.1`** in writing on
  2026-07-05, which both accepts this ADR for dev-only 8A execution and starts increment 8A.1. Acceptance covers
  ONLY the dev-only increments; the tester round itself remains blocked until the activation gates close
  (Phase 7 rows 11 + 18, then Row 19 Option B activation).
- **Date:** 2026-07-05 · **Phase:** 8A (planning) · **Builds on:** ADR-0013 (live gates), ADR-0014 (Phase 8 scope — PROPOSED).
- **Plan:** `docs/phase-8/8a-mobile-pwa-tester-release-plan.md`.

## Context

Phase 7 hardened the dev build behind an evidence-gated ledger. Rows 1–10 and 12–14 (Stripe TEST) passed;
Row 11 (OTP smoke) is blocked by an external Supabase platform incident; Row 18's open action remains; Row 19
carries a **conditional** owner approval (Option B) that activates only when rows 11 + 18 close. The owner has
directed that 8A planning proceed now so dev-only work is ready to start the moment the trigger is given.

## Decision (proposed)

1. **8A is synthetic-only.** Synthetic testers, orders, names, emails. **No real PII / addresses / RFC / KYC /
   documents** — real PII remains gated on 8B (KMS envelope encryption).
2. **PWA-first** (owner-ratified in `mobile-testing-readiness-plan.md`): the existing Next.js app ships as an
   installable PWA to a controlled HTTPS host for the tester round; native (Expo) stays deferred and documented.
3. **No live payments.** Stripe **TEST mode only**; Row 15 (Stripe LIVE) stays deferred and is not an 8A gate.
4. **No new design system.** The approved **Stitch** direction + existing BorderPass UI are canonical
   (`docs/design/Design-to-Frontend-Handoff-Package.md`). Claude Design may produce optional throwaway mockups
   only. 8A work is mobile *polish* of the existing UI, executed in the eight stop-pointed increments of the plan.
5. **Tester release stays blocked until activation gates close:** Row 11 PASS with evidence, Row 18 open action
   closed, and Row 19 Option B activation. Completing 8A's increments does **not** by itself authorize testers,
   deployment beyond dev, or any readiness claim.

## Consequences

- Dev-only mobile polish can proceed (once triggered) in parallel with waiting out the external Row 11 blocker,
  without touching payment logic, PII storage, or providers.
- The tester round remains a separate activation event with its own preconditions — blast radius contained.
- 8A adds PWA wiring (manifest/icons/minimal service worker) that currently does not exist in `apps/borderpass`.

## Non-goals

Tester invites · public/staging/pilot/production release · real payments or Stripe LIVE · real PII ·
notification/courier providers (8C) · refunds/disputes (8D) · any new order states or state-machine bypasses.

## Status control

**ACCEPTED (dev-only 8A scope) — `START BORDERPASS PHASE 8 — 8A.1` received 2026-07-05; increment 8A.1 underway.
BorderPass remains development-only; private testers remain blocked until the activation gates close.**
