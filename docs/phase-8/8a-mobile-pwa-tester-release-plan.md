# Phase 8A — Mobile PWA Private Tester Release — Increment Plan

> **Status:** **DEV-ONLY IMPLEMENTATION PLAN** (drafted 2026-07-05, owner-directed). This document plans the work;
> it does not start it and it is **not a tester release**. Implementation of any increment begins only on the
> explicit owner trigger **`START BORDERPASS PHASE 8 — 8A`**.
> **Tester release remains BLOCKED** by Row 11 (OTP smoke — Supabase incident) and the remaining activation
> blockers in `docs/phase-7/gate-ledger.md` (Row 18 open action). Row 19 = conditional owner approval (Option B),
> inactive until those close. Companion: ADR-0015 (PROPOSED) · ADR-0014 (PROPOSED) · `docs/phase-8/phase-8-plan.md`.

## Hard guardrails (all increments)

- **Synthetic data only.** No real PII, addresses, RFC, KYC, or documents (real PII is gated on 8B/KMS).
- **Stripe TEST mode only.** No live payments; Row 15 stays deferred/unchecked.
- **No tester invites** and no tester-ready/staging/pilot/production claims at any point in 8A.
- **Design source of truth:** the approved **Stitch** direction + existing BorderPass UI
  (`docs/design/Design-to-Frontend-Handoff-Package.md`). **No new design system.** Claude Design only for
  optional throwaway mockups.
- All Phase 7 invariants hold: state-machine seams only, `withTenant`/privileged access only, server-only
  secrets never in `NEXT_PUBLIC_`, CI security gates stay green, no secrets in code/logs/docs.
- Every increment ends at a **STOP point**: report + verification evidence; next increment starts only on
  explicit owner approval (per-increment approval, as in Phases 2–7).

## Increments

> **8A.1 outcome (2026-07-05):** audit complete — `8a-route-mobile-audit.md`. Key adjustments: the customer
> home/orders/quotes pages are **placeholders**, so 8A.3 is "build the dashboard/list UI from the existing
> read models," not cosmetic polish; and 8A.2 must **add** the missing customer nav/logout shell (the
> `(customer)` layout is an auth guard only) plus viewport/theme metadata and loading/error boundaries.
> Layout-breakage risk is low (consistent `max-w-md` mobile-first shell; no tables/grids/fixed widths).
> Sequencing 8A.2 → 8A.8 unchanged. Admin-area mobile gaps recorded as out-of-8A-scope.

### 8A.1 — Mobile route/readiness audit (read-only)
- **Work:** inventory all customer-facing routes (`app/(public|auth|customer)`) on mobile viewports (375×812 /
  360×800); record per-route defects (layout breaks, tap targets, overflow, missing loading/error states);
  confirm which QA-checklist items are already satisfiable. No code changes.
- **Output:** `docs/phase-8/run-logs/8a1-mobile-audit-<timestamp>.md` defect table, prioritized.
- **STOP:** owner reviews the defect list and approves the 8A.2–8A.5 polish scope drawn from it.

### 8A.2 — Mobile shell/navigation polish
- **Work:** app shell only — header/nav/menu usable one-handed, safe-area insets, viewport meta, focus states,
  es/en toggle reachable. Match existing Stitch-derived styling; no redesign.
- **Verify:** typecheck/lint/build + audited routes re-checked at mobile widths.
- **STOP:** before/after screenshots (synthetic data) + verification results.

### 8A.3 — Customer dashboard mobile polish
- **Work:** order list (own orders only) legible and scannable on mobile; empty/loading/error states; status
  chips readable; no horizontal scroll.
- **Verify:** as 8A.2 + RLS-scoped rendering unchanged (no query/data-layer changes).
- **STOP:** report + screenshots.

### 8A.4 — Order detail + quote/payment mobile polish
- **Work:** order detail (status + history), quote view (safe projection; internal notes stay hidden), accepted-
  quote payment page + Stripe **TEST** Payment Element rendering on small screens; retry/return-to-order flows.
- **Guardrail:** no payment-logic changes — UI layer only; webhook remains the sole source of `paid`.
- **Verify:** as 8A.2 + Stripe TEST-mode manual check with test card `4242…` on mobile viewport.
- **STOP:** report + screenshots + TEST-payment evidence (redacted).

### 8A.5 — Inspection/delivery tracker mobile polish
- **Work:** customer read-only inspection + delivery-prep visibility on mobile: timeline legibility, non-PII
  scheduling windows only (opaque `delivery_address_ref` — never address text).
- **Verify:** as 8A.2 + confirm no PII-bearing field is introduced.
- **STOP:** report + screenshots.

### 8A.6 — PWA metadata/installability
- **Work:** web app manifest (name/short_name/icons/theme/display=standalone), apple-touch/home-screen meta,
  icon set, basic service worker for install eligibility + graceful reload only (no offline-first scope creep).
  Note: `apps/borderpass/public/` currently has **no** manifest/icons — this is new wiring.
- **Verify:** Lighthouse/devtools installability pass locally; add-to-home-screen launches standalone on
  iOS Safari + Android Chrome (dev devices, synthetic accounts).
- **STOP:** installability evidence.

### 8A.7 — Synthetic QA script + device checklist
- **Work:** finalize the per-tester, per-device QA script from `docs/phase-7/mobile-private-testing-checklist.md`
  §3 + readiness-plan §10 into a fill-in evidence template (`docs/phase-8/8a-device-qa-template.md`); dry-run it
  end-to-end once on each platform with **synthetic accounts** (requires Row 11 unblocked for the auth steps).
- **STOP:** dry-run evidence; confirm every checklist row is executable.

### 8A.8 — Final dev-only 8A review
- **Work:** full verification suite (typecheck/lint/build/tests/guards), unsafe-claim grep, secret scan, ledger
  cross-check, completion report `docs/phase-8/8a-completion-report.md`.
- **STOP (terminal):** 8A is **dev-complete** only. The tester round itself still requires: Row 11 PASS with
  evidence · Row 18 open action closed · Row 19 Option B activation confirmed by the owner · deployment of the
  PWA to a controlled HTTPS preview host with Supabase redirect URLs saved. None of those are part of 8A.8.

## Dependencies / notes

- **Row 11 (OTP)** blocks 8A.7's auth steps and the tester round; it does NOT block 8A.1–8A.6 (local dev-only).
- Deployment to a preview host is deliberately **outside** 8A — it happens at tester-round activation under the
  checklist's §1–§2, after the activation blockers close.
- Money/PII invariants: nothing in 8A touches payment logic, PII storage, notifications, or providers.
