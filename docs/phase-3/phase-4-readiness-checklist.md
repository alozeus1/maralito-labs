# Phase 4 Readiness Checklist

**Phase 4 (proposed, ADR-0010):** Stripe payment on an **accepted** quote — payment intent + webhook → order `paid`. Builds on Quotes + Orders.

## Carried release blockers (PENDING — required before any non-dev release / real PII / real payments)
- [ ] **Live Supabase RLS gate** (foundation + orders + **quotes** isolation) passes on a real project
- [ ] `SET LOCAL ROLE authenticated` works on the pooler, or fallback applied (ADR-0006)
- [ ] Real `pnpm install` + committed `pnpm-lock.yaml` + **app-server typecheck** + CI green on a real PR
- [ ] OTP → provisioning → session live smoke
- [ ] KMS/secret-management decision (before storing any PII / Stripe customer data)
- [ ] Preview-branching decision

## Phase 4 build (when approved)
- [ ] `payments` (+ `refunds`) tables referencing platform Payments via SDK (no raw card data) + RLS (extend isolation test)
- [ ] **Stripe** payment intent keyed by `quote_id` (idempotent); webhook verify → normalize → `payment.succeeded/failed`
- [ ] On `payment.succeeded`: `transitionOrder` awaiting_payment → `paid` (webhook-driven, audited)
- [ ] Accepted-quote precondition: only `accepted` quotes create a payment intent; declined/expired never do
- [ ] Audit payment events; **never log card data**; PCI surface minimized (Stripe Elements / no raw PAN)
- [ ] Event placeholders → real consumer when bus lands (Notifications receipt)

## Foundation Phase 4 can rely on (delivered)
Quotes + finance approval + `transitionQuote` seam · accepted→awaiting_payment cascade · orders + `transitionOrder` ·
`withTenant`/`withPrivilegedDbAccess` · owner/role action pattern · audit + redaction · PGlite real-policy test harness ·
raw-client guard · deterministic integer-minor-unit money.

## Standing rules
Status only via the seams · money minor units · no PII without KMS · no raw card data (Stripe refs only) · live gate before release.
