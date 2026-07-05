# BorderPass — Current Build State

> Single source of truth for "where we are." Update at the end of every phase/patch.
> **Last updated:** 2026-07-05 · **App:** BorderPass (first app on the Maralito Platform + Automation Platform) · **Mode:** development-only

---

## Current phase completed

**Phase 7 — Live-Gate Hardening + Real Environment Validation (TOOLING)** (ADR-0013). Development-only. Gate execution is in progress: rows 1–10 + 12–14 + 16–17 have since PASSED with evidence; rows **11 (OTP — blocked by a Supabase platform incident), 15 (Stripe LIVE — deferred), 18 (secret rotation — PARTIAL), 19 (owner sign-off)** remain open. See `docs/phase-7/gate-ledger.md` (single source of truth).

Delivered (in-repo tooling + runbooks only — no live gate executed or marked passed):
- Consolidated **non-destructive** live-RLS-gate (`packages/db/scripts/live-rls-gate.ts`, `pnpm gate:rls`) covering all 7 policy files (orders/quotes/payments/notifications/inspections/delivery-preparations) with two-user cross-domain isolation, transaction-rollback (nothing persists). Logic verified 10/10 on PGlite.
- `scripts/preflight.mjs` (`pnpm preflight`) — runs local gates + prints the operator gate checklist.
- `.github/workflows/live-gates.yml` — manual, secret-gated operator CI (install/typecheck/test/build/migrate/gate:rls); hard-fails without `DATABASE_URL`.
- Stripe test-mode smoke (`packages/payments/scripts/stripe-smoke.mjs`, `pnpm --filter @maralito/payments stripe:smoke`) — offline TEST-mode/API-version/signature checks; refuses `sk_live_`. Runbook for the live CLI round-trip.
- Decision records (KMS, preview-branching — **not decided**), env/secrets review, deployment-readiness checklist, live-gate execution runbook, and the **gate ledger** (19 rows, all 🔲 UNRUN). ADR-0013 + Phase 7 docs.

**Previously: Phase 6 — Post-Payment Order Lifecycle Foundation: Inspection + Delivery Preparation** (ADR-0012):
- Inspection domain: `inspections` + `inspection_status_history` schema + RLS; sub-status machine (`scheduled → in_progress ↔ on_hold → passed/failed`); staff actions (create/start/hold/resume/pass/fail); customer-safe `getMyOrderInspection`; order join `inspection_pending → inspection_passed/failed` via `transitionOrder` (only-if-expected).
- Delivery-prep domain: `delivery_preparations` + `delivery_prep_status_history` schema + RLS; machine (`pending → preparing → ready → scheduled → handed_off`); staff actions; customer-safe `getMyOrderDelivery`; handoff `arrived_juarez → out_for_delivery` via `transitionOrder`. **Address policy: opaque `delivery_address_ref` + non-PII scheduling windows only** (real PII deferred to KMS).
- Admin inspection/delivery panels (staff read/write) + customer read-only inspection/delivery visibility.
- `emitInspectionEvent` / `emitDeliveryEvent` placeholders + idempotent lifecycle `notification_outbox` placeholders (no provider/send/body/PII; `notification_outbox` gained nullable inspection_id/delivery_prep_id, payment_id nullable).
- Tests (state machines, rules, RLS isolation, notification idempotency) + guards; ADR-0012 + Phase 6 docs + Phase 7 readiness checklist.

**Previously: Phase 5 — Customer Payment Confirmation UX + Notifications Foundation** (ADR-0011):
- Customer payment summary read model (`getMyOrderPaymentSummary`) + pure `toPaymentDisplayState` mapper (+ flow helpers).
- Public Stripe client boundary: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` + memoized client-only loader + CI guard (`check:client-stripe`).
- Customer payment page (`/orders/[orderId]/pay`) + Stripe Elements client confirmation (`PaymentConfirm`).
- Server-authoritative status polling: success ("Paid") renders ONLY when the webhook-driven server status is `succeeded`; client confirm is advisory.
- Retry-safe UX (reuses the idempotent Phase 4 PaymentIntent) + return-to-order.
- `notification_outbox` placeholder + `queuePaymentReceipt` (enqueued only on webhook-driven `payment.succeeded`; no provider, no send, no PII/body).
- Read-only customer/admin payment visibility (`getOrderPaymentForStaff`, org-scoped) on detail pages — no admin payment ops, no refund/dispute UI.
- ADR-0011 + Phase 5 docs + Phase 6 readiness checklist.

**Previously: Phase 4 — Stripe Payments + Payment State Machine Foundation** (ADR-0010):
- Schema: `payments`, `payment_events` (doubles as status history), `stripe_webhook_events` (idempotency ledger), `refunds` (placeholder) — integer minor units, Stripe references only, no card data.
- 7-state payment machine + single `transitionPayment` seam; `succeeded` cascades order `awaiting_payment → paid` via `transitionOrder` only; failed/canceled/requires_action never mark paid (pure, exhaustively-tested `orderPaidCascadeTarget`).
- Server-only Stripe boundary (`@maralito/payments`: config/client/PaymentIntent/webhook-verify) — fail-closed, no secret exposure, no live-mode assumption.
- Customer initiation (`initiateQuotePayment`): accepted-quote + awaiting_payment only, idempotent (key `pi_<quote_id>`), returns only safe client fields.
- Webhook route: fail-closed signature verify, idempotency ledger, 5 `payment_intent.*` events → `transitionPayment`.
- Payment RLS (`payments-policies.sql`): customer own-only, no customer writes, `payment_events` staff-only, `stripe_webhook_events` privileged-only, `refunds` owner-scoped.
- Full `payment.*` audit + `emitPaymentEvent` placeholder seam. Committed tests (state machine, rules/cascade, webhook signature, idempotency, RLS).

**Previously: Phase 3 — Quotes + Finance Approval Foundation** (ADR-0009) + **Patch 3.1**:
- Quote schema: `quotes`, `quote_line_items`, `quote_status_history`, `quote_approvals` (+ indexes, `unique(order_id, version)`) — money in integer minor units only.
- 9-state quote machine with role-gated transitions; single `transitionQuote` seam (writes status history + audit + event placeholder).
- Deterministic `calculateQuoteTotals` (integer-only, single-currency, negatives restricted to discount/adjustment).
- Finance approval (`quote_approvals`, reason required on reject) kept separate from customer acceptance.
- Admin/finance + customer server actions; quote↔order cascades routed only through `transitionOrder`/`transitionOrderPrivileged`.
- Quote RLS (`quotes-policies.sql`); customer sees only own quotes and only customer-visible, non-internal line items; `internal_notes` hidden by app projection.

**Patch 3.1 — review fixes applied (2026-06-30):**
- **B1 fixed:** auto-approve path. `draft → approved` now permits the `system` actor class, so quotes that don't require finance approval auto-approve on submit instead of throwing `IllegalQuoteTransitionError`. The submit action wraps the transition and returns a structured `conflict_state` rather than throwing.
- **B2 fixed:** approve/reject now pass the user's **actual finance role** (`financeRoleOf`), not positional `roles[0]`, so multi-role finance/ops users no longer spuriously fail the transition assertion.
- **Event taxonomy completed:** `quote.created`, `quote.updated`, `quote.rejected` are now emitted through `emitQuoteEvent` (placeholder) — all 11 quote events wired.
- **Tests added:** auto-approve (`system`) edge and multi-role finance approval. Verified green via arch-independent transpile-and-assert (21/21 pure-domain assertions pass); full Vitest/PGlite suite runs in the real env (sandbox `node_modules` is arch-mismatched).

---

## Next phase

**Operator action, then Phase 8.** Phase 7 tooling is complete and most gates are green; the operator must close the remaining rows (11 OTP, 18 rotation, 19 sign-off) per `docs/phase-7/live-gate-runbook.md` and record results in `docs/phase-7/gate-ledger.md`. Phase 8 (ADR-0014 — **PROPOSED**, plan at `docs/phase-8/phase-8-plan.md`) begins only after the required gates are green + owner-signed. Candidate Phase 8 directions once gates pass: real notification provider, delivery/courier provider, refund/dispute expansion, or KMS-gated address/PII. **Do not start Phase 8 until gates pass and the user gives `START BORDERPASS PHASE 8`.**

### (superseded) original Phase 7 recommendation

**Phase 7 (was proposed, now ADR-0013 — DONE as tooling).** Recommended: **Live-Gate Hardening + Real Environment Validation** — run the live Supabase RLS gate (now across all domains incl. inspections + delivery-preparations), real `pnpm install` + lockfile + full app build/app-server typecheck + CI green, full Vitest suite, Stripe test-mode smoke, OTP live smoke, and make the KMS/secret-management decision — **before** adding more product surface. Alternatives: real notification provider, delivery/courier provider, refund/dispute expansion, KMS-gated address/PII. See `docs/phase-6/phase-7-readiness-checklist.md`. **Produce the Phase 7 plan first and WAIT for `START BORDERPASS PHASE 7` before coding.**

---

## All ADR numbers

| ADR | Title |
|-----|-------|
| 0001 | Single-app architecture |
| 0002 | Monorepo (pnpm + Turborepo) |
| 0003 | Security CI (gitleaks/semgrep/osv/pnpm audit) |
| 0004 | LangGraph × Inngest spike |
| 0005 | Auth / RBAC / Supabase |
| 0006 | RLS-aware DB access (`withTenant` / `withPrivilegedDbAccess`) |
| 0007 | Provisioning + live RLS gate |
| 0008 | Orders domain foundation |
| 0009 | Quotes + finance approval foundation |
| 0010 | Stripe payments + payment state machine foundation |
| 0011 | Customer payment confirmation UX + notifications foundation |
| 0012 | Post-payment order lifecycle foundation (inspection + delivery prep) |
| 0013 | Live-gate hardening + real environment validation (tooling) |
| 0014 | Phase 8 scope + sequencing — **PROPOSED** (not accepted; Phase 8 not started) |
| 0015 | Phase 8A mobile PWA private testing — **ACCEPTED (dev-only scope)**; 8A dev work **complete except the Row 11-gated device dry-run** (see `docs/phase-8/8a-final-dev-review.md`, 2026-07-05). Tester round still gated on Phase 7 rows 11/18 + Row 19 activation |

---

## All blockers

1. **Live Supabase RLS gate — NOT run (standing release blocker).** Apply real `policies.sql` + `orders-policies.sql` + `quotes-policies.sql` + `payments-policies.sql` + `notifications-policies.sql` + `inspections-policies.sql` + `delivery-preparations-policies.sql` on a real Supabase project; confirm `SET LOCAL ROLE authenticated` works on the pooler (`canAssumeAuthenticatedRole`) or apply the documented fallback (direct conn → claims-only → Supabase-client) inside `withTenant`; run a live two-user isolation smoke. Runbook: `docs/phase-1.6/live-supabase-rls-gate.md` + `packages/db/scripts/live-rls-gate.ts`.
2. **Real `pnpm install` + committed `pnpm-lock.yaml` + full app-server typecheck + CI green on a real PR.** The app server-action layer (`@/` aliases, `server-only`, next/supabase, drizzle writes) cannot be fully typechecked/run in the sandbox; domain/db/schema/RLS are verified here.
3. **OTP → provisioning → session live smoke** (auth round-trip on a real Supabase project).
4. **KMS / secret-management decision** — required before storing any real PII / RFC / KYC / Stripe customer data.
5. **Preview-branching decision** (Supabase + Vercel preview environments).
6. **Stripe test-mode smoke + live/test account validation** — required before any real payment. (Phase 4 code is built; no Stripe account has been exercised.)

---

## Live-gate status

🟡 **PARTIALLY PASSED — release still blocked.** Per the ledger (`docs/phase-7/gate-ledger.md`, single source of truth): rows **1–10 PASSED** (real install/typecheck/build/Vitest/PR-CI + live Supabase migrate/RLS/seed + live two-user `gate:rls` 13/13), rows **12–14 PASSED (Stripe TEST mode only)**, rows **16–17 owner-signed**. Still open: **row 11** (OTP smoke — latest attempt 2026-07-05 blocked by a Supabase platform incident preventing the redirect-URL save), **row 15** (Stripe LIVE validation — deferred; required before any real payment), **row 18** (🟡 PARTIAL — env/secrets review recorded, but exposed `service_role`/secret key + DB password **rotation remains REQUIRED BEFORE PRIVATE TESTERS**), **row 19** (owner sign-off). The open rows remain hard blockers before any private testers, staging release, pilot, production, real payment, or handling of real customer PII/address content.

---

## Dev-only status

🟢 **Development-only.** Phases 0 → 6 (incl. Patch 3.1) are complete as local, dev-only foundations. Nothing is deployed. No real customer data, payments, PII, or address content have been handled — no Stripe account has been charged or even contacted, and no notification has been sent. The architecture, security model (RLS + RBAC + audit), state machines (order/quote/payment/inspection/delivery-prep), money handling, the Stripe payment foundation, the payment-confirmation UX, the receipt + lifecycle notification placeholders, and the inspection/delivery-preparation foundations are implemented and locally verified, awaiting the live gates before any non-dev use.

---

## What must NOT be done yet

- ❌ **Do not start Phase 8 coding** until the required live gates pass (`docs/phase-7/gate-ledger.md`) and the user gives `START BORDERPASS PHASE 8`.
- ❌ **Do not mark any live gate passed** unless it was actually executed in a real environment and recorded in the gate ledger — the Phase 7 scripts/CI/runbooks are tooling, not results.
- ❌ **Do not deploy** to staging/pilot/production, or point at a real Supabase project for real users, until the live RLS gate + all blockers above pass.
- ❌ **Do not enable live Stripe or charge real money** — no Stripe account has been validated; run a test-mode smoke behind the live gates first.
- ❌ **Do not handle or store real PII / RFC / KYC / address content** until the KMS/secret-management decision is made — delivery prep stores only an opaque `delivery_address_ref` + non-PII windows.
- ❌ **Do not send real notifications or integrate a provider/courier/maps** — `notification_outbox` is a queued placeholder only (no email/SMS/WhatsApp send, no message body/PII).
- ❌ **Do not add new order states** — inspection/delivery are domain sub-status records; the order advances only via existing `transitionOrder` edges.
- ❌ **Do not treat client confirmation as authoritative** — the Stripe webhook is the only source of truth for `succeeded`/`paid`.
- ❌ **Do not build saved cards, subscriptions, real refunds/disputes, admin payment operations, AI automation, accounting/export, customs/tax, or delivery/courier integration** — all deferred past Phase 6.
- ❌ **Do not mutate order / quote / payment / inspection / delivery-prep status directly** — only via `transitionOrder`, `transitionQuote`, `transitionPayment`, `transitionInspection`, `transitionDeliveryPrep`.
- ❌ **Do not import server Stripe (secret/webhook/client) into client code** — blocked by `scripts/check-client-stripe-boundary.mjs` (CI).
- ❌ **Do not bypass `withTenant`** for tenant data, or import the raw DB client in `apps/**` (blocked by ESLint + `scripts/check-db-imports.mjs`).
- ❌ **Do not claim deployment readiness** or mark the live gate resolved until it has actually run on real infrastructure.
- ❌ **Do not log** OTP codes, tokens, secrets, or card/KYC/RFC/document content (redaction enforced).
