# ADR 0009 — Quotes + Finance Approval Foundation (dev-only, pre-payment)

- **Status:** Accepted (development-only; live gate blocks release) · **Date:** 2026-06-29 · **Phase:** 3
- **Numbering:** 0009 = Quotes/Finance-approval. Next ADR = 0010.

## Context
Phase 2 delivered the Orders foundation. Phase 3 adds the pricing/quote layer between order submission and payment, **before** any Stripe/payment work, while the live Supabase RLS gate remains a release blocker.

## Decisions
1. **Quote domain before Stripe.** Pricing, finance approval, and customer accept/decline are independent of payment capture. Building them first lets the order→quote→accept flow be correct and audited; Phase 4 only adds the money movement on an already-accepted quote. This keeps payment surface area small and isolates PCI/Stripe concerns.
2. **Integer minor units for money.** All amounts are `*_minor` integers (never floats) to avoid rounding errors; `calculateQuoteTotals` is deterministic, enforces a single currency, and restricts negatives to discount/adjustment.
3. **Finance approval separate from customer acceptance.** Different actors, different status edges: finance (`finance_admin`/`operations_manager`/`super_admin`) approves a quote internally (`quote_approvals`); the **customer** separately accepts/declines a *sent* quote. This is a separation-of-duties control and lets approval thresholds gate sending without involving the customer.
4. **Quote events are placeholders.** `emitQuoteEvent` records the envelope shape only; no Inngest/bus. Real automation (and consumers like Payments/Notifications) wire in later phases — keeps Phase 3 free of workflow-engine coupling.
5. **Quote ↔ order status integration via `transitionOrder`.** Sent → order `quote_ready`; accepted → order `awaiting_payment`. Cascades run through the existing audited seam (`transitionOrderPrivileged`), never via direct status writes. Quote status itself mutates only via the `transitionQuote` seam.
6. **Security pattern reused.** Quotes/line-items/history/approvals ship their own RLS (`quotes-policies.sql`); tenant reads + draft edits via `withTenant`; status transitions + approvals + history writes via `withPrivilegedDbAccess` (reason + audit). `internal_notes` hidden from customers via **app projection** (RLS is row-level). Raw client stays blocked.

## Deferred to Phase 4
Stripe checkout/payment intents/capture, `payments`/`refunds` records, payment webhooks, durable workflow wrapping the quote/order seams, real event bus + consumers, real PII/KMS, full UI, quote PDF, notifications. **Accepted quotes become "ready for payment" — no payment intent is created in Phase 3.**

## Verified (real Postgres / pure)
Quote RLS isolation (6, PGlite + real policy files: own-quote, customer-visible-only line items, staff-all, history/approvals staff-only, missing-claims) · state machine (role gating, helpers, order-cascade legality) · deterministic totals · finance-approval triggers · Zod schemas (negatives, reason-required, lengths). `check:db-imports` green. **Live Supabase gate NOT run — release blocker.**
