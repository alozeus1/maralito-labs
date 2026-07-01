# Phase 7 Readiness Checklist

**Phase 6 (ADR-0012):** post-payment order lifecycle foundation — inspection + delivery preparation. Development-only.

## Recommended Phase 7: **Live-Gate Hardening + Real Environment Validation**
Phases 0–6 built a large development-only foundation. The biggest current risk is **not** another feature — it
is that the live Supabase, real install/build, Stripe test-mode, CI, OTP, KMS, and preview-branching gates
have never run. Harden + validate the platform before adding product surface.

### Phase 7 gates (must pass)
- [ ] Real `pnpm install` + committed `pnpm-lock.yaml`
- [ ] Full Next app build (`next build`)
- [ ] Full app-server typecheck (whole workspace)
- [ ] Full **Vitest** suite green (resolves the sandbox Rollup limitation)
- [ ] CI green on a real PR
- [ ] Live Supabase project provisioned; migrations applied
- [ ] **All RLS policies applied:** foundation · orders · quotes · payments · notifications · inspections · delivery-preparations
- [ ] Live two-user RLS isolation gate passed (`SET LOCAL ROLE authenticated` on the pooler, or fallback)
- [ ] OTP → provisioning → session live smoke
- [ ] Stripe **test-mode** smoke: PaymentIntent + Elements confirm + webhook → order `paid` → receipt queued
- [ ] Stripe API-version validation (confirm pinned `2024-06-20` vs account)
- [ ] KMS / secret-management decision (required before any real address/PII)
- [ ] Preview-branching decision (Supabase + Vercel)
- [ ] Env/secrets review
- [ ] No real-PII / real-money use until all gates pass

## Alternative Phase 7 candidates (not recommended yet)
- Real notification provider integration (Resend/Twilio/WhatsApp) consuming `notification_outbox`
- Delivery provider / courier integration + maps/route optimization
- Refund / dispute expansion (on the `refunds` placeholder)
- Address / KMS-gated customer profile expansion (after the KMS decision)
- AI / automation workflow expansion

## Foundation Phase 7 can rely on (delivered through Phase 6)
Orders/quotes/payments/inspection/delivery domains + RLS across all of them · `transitionOrder` /
`transitionQuote` / `transitionPayment` / `transitionInspection` / `transitionDeliveryPrep` seams ·
payment confirmation UX · notification_outbox placeholder (receipts + lifecycle) · admin ops + customer
read-only visibility · `withTenant`/`withPrivilegedDbAccess` · raw-client + client-Stripe CI guards ·
PGlite real-policy test harness.

## Standing rules
Status only via the seams · webhook is source of truth for `paid` · no new order states · address-ref only
(no PII) without KMS · no external sends without an approved provider phase · live gates before any release.
