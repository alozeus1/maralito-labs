# Phase 6 Readiness Checklist

**Phase 5 (ADR-0011):** customer payment confirmation UX + notifications foundation. Development-only.

## Carried release blockers (PENDING — required before any non-dev release / real PII / real payments)
- [ ] **Live Supabase RLS gate** (foundation + orders + quotes + payments + **notifications**) passes on a real project
- [ ] `SET LOCAL ROLE authenticated` works on the pooler, or fallback applied (ADR-0006)
- [ ] Real `pnpm install` + committed `pnpm-lock.yaml` + **full app build / app-server typecheck** + CI green on a real PR
- [ ] OTP → provisioning → session live smoke
- [ ] KMS / secret-management decision (before storing any PII / Stripe customer data)
- [ ] Preview-branching decision
- [ ] **Stripe TEST-mode smoke** (real test keys + webhook secret + `@stripe/*` installed): initiate → confirm (Elements) → webhook → order `paid` → receipt queued
- [ ] **Stripe LIVE-mode validation gate** before any real charge

## Candidate Phase 6 directions (pick + sequence when approved — do NOT start now)
- [ ] **Option A — Inspection workflow** after a paid order (order `paid → purchasing/… → inspection_*`)
- [ ] **Option B — Delivery workflow** (Juárez last-mile states + scheduling/handoff)
- [ ] **Option C — Real notification provider integration** (Resend/Twilio/WhatsApp consuming `notification_outbox`)
- [ ] **Option D — Stripe test-mode smoke + live-gate hardening**
- [ ] **Option E — Refund / dispute expansion** (build on the `refunds` placeholder + `refunded_placeholder` edge)

### Recommended: **Phase 6 — Post-Payment Order Lifecycle Foundation: Inspection + Delivery Preparation** (Options A + B)
Phase 5 completes the customer-facing payment loop; the next logical product step is what happens **after**
payment — inspection, readiness, delivery scheduling, and handoff — advancing the order lifecycle past `paid`.
Real notification provider (Option C) pairs naturally once those events exist to notify on.

## Foundation Phase 6 can rely on (delivered through Phase 5)
Orders + quotes + payments + webhook + payment state machine · `transitionOrder`/`transitionQuote`/`transitionPayment`
seams · customer payment confirmation UX (Elements) + server-authoritative status · `notification_outbox`
placeholder + `queuePaymentReceipt` seam · read-only customer/admin payment visibility · RLS across all domains ·
`withTenant`/`withPrivilegedDbAccess` · raw-client + client-Stripe CI guards · PGlite real-policy test harness.

## Standing rules
Status only via the seams · webhook is the source of truth for `paid` · money integer minor units · no PII without
KMS · no card data (Stripe refs only) · no external sends without an approved provider phase · live gates before release.
