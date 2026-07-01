# Phase 5 Readiness Checklist

**Phase 4 (ADR-0010):** Stripe payment foundation — PaymentIntent + webhook → order `paid`. Development-only.

## Carried release blockers (PENDING — required before any non-dev release / real PII / real payments)
- [ ] **Live Supabase RLS gate** (foundation + orders + quotes + **payments**) passes on a real project
- [ ] `SET LOCAL ROLE authenticated` works on the pooler, or fallback applied (ADR-0006)
- [ ] Real `pnpm install` + committed `pnpm-lock.yaml` + **app-server typecheck** + CI green on a real PR
- [ ] OTP → provisioning → session live smoke
- [ ] KMS / secret-management decision (before storing any PII / Stripe customer data)
- [ ] Preview-branching decision
- [ ] **Stripe TEST-mode smoke** (real test keys + webhook secret): initiate → confirm → webhook → order `paid`
- [ ] **Stripe LIVE-mode validation gate** before any real charge

## Candidate Phase 5 scope (pick + sequence when approved)
- [ ] Customer payment screen / confirmation UX (Stripe Elements or hosted Checkout)
- [ ] Notifications workflow (payment receipt; consumes `emitPaymentEvent`)
- [ ] Inspection workflow (order `paid → purchasing/...` lifecycle continues)
- [ ] Delivery workflow (Juárez last-mile states)
- [ ] Refund / dispute expansion (build on the `refunds` placeholder + `refunded_placeholder` edge)
- [ ] Durable Inngest workflow wrapping the payment/order seams + real event bus + consumers
- [ ] Accounting / export planning

## Foundation Phase 5 can rely on (delivered)
Payments + `payment_events` + webhook ledger + refunds placeholder · 7-state payment machine + `transitionPayment` seam · server-only Stripe boundary (config/client/PaymentIntent/webhook-verify) · idempotent initiation keyed by quote · webhook verify (fail closed) + idempotency · order `paid` cascade via `transitionOrder` (only on `succeeded`+`awaiting_payment`) · payment RLS (customer own-only, no customer writes, webhook ledger private) · payment audit + `emitPaymentEvent` seam · committed tests (state machine, rules/cascade, webhook signature, idempotency, RLS).

## Standing rules
Status only via the seams · money integer minor units · accepted-quote total is the payment amount · no PII without KMS · no card data (Stripe refs only) · payment failure never marks order paid · live gates before any release.
