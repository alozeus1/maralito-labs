# Stripe LIVE Checklist — Gate Ledger Row 15

> **This is the LAST gate before real money moves.** It closes **row 15** of
> `docs/phase-7/gate-ledger.md` (the only open Phase-7 row) and **B2** of
> `docs/phase-9/production-readiness-review.md`.
>
> **STATUS: 🔲 UNRUN. Nothing below has been executed. No live key exists in this repo or in any
> environment the build has seen.** Reading this document does not authorise anything.
>
> ## ⛔ LIVE mode must not be enabled until the owner approves in writing
> Approval requires **all** of §1 complete. In particular: **real PII handling (KMS) and the legal pages
> must be live BEFORE live payments** — taking a real payment creates a real customer with a real
> receipt, a real refund right, and a real dispute exposure. Money last.

**Legend** — ✅ **DONE** (verified in-repo) · 🟠 **OPERATOR ACTION REQUIRED** · 🔴 **BLOCKED**.

---

## 0. What is already proven — in TEST mode only ✅

Row 15 is the only Stripe row left because the payment machinery is already validated (see the ledger):

| Ledger row | Proven | Evidence |
|---|---|---|
| 12 | Offline smoke 5/5 with real `sk_test_`/`whsec_`; **live-key refusal verified** | `run-logs/stripe-gate-20260701T2137Z.md` |
| 13 | TEST round-trip: success → order `paid`; decline → order stays `awaiting_payment`; redelivery idempotent | same |
| 14 | Webhook API version `2024-06-20` == pinned; signature fail-closed (missing/invalid → 400) | same |
| 8D | Refunds + disputes: `transitionRefund`, idempotent webhook ingestion, **no automated fund movement on disputes** | `docs/phase-8/8D-completion-report.md` |

**What TEST mode did NOT prove:** that the Stripe *account* is verified and can be paid out, that a LIVE
webhook endpoint on a real domain receives events, that live 3DS/SCA behaves as expected, that a real
dispute reaches the app, and that money actually settles. That is this document.

---

## 1. Preconditions — every one must be ✅ before requesting approval

| # | Precondition | Owner | State |
|---|---|---|---|
| P1 | **Production Supabase project** exists, migrated, **ALL** RLS policy files applied, `gate:rls` green against it | operator | 🔲 `production-environment-runbook.md` |
| P2 | **Vercel Production environment + real domain**, `BORDERPASS_ENV=production` | operator | 🔲 |
| P3 | **KMS production plan complete through G12** (owner sign-off for real PII) | owner | 🔲 `kms-production-plan.md` |
| P4 | 🔴 **The fail-open PII path is closed** (`kms-production-plan.md` §0) | dev | 🔲 |
| P5 | **Terms of Service + Privacy Notice reviewed by counsel** and published without the "pending legal review" banner; refund/cancellation policy published | owner + counsel | 🔲 `legal-consent.md` |
| P6 | **Consent capture live** at sign-up, versioned + auditable | dev | 🔲 |
| P7 | **Observability wired and proven** — Sentry receiving events, and **one test alert has reached a human** | operator | 🔲 `observability-and-alerting.md` §7 step 14 |
| P8 | **Rate limiting active** on payment initiation and auth | dev+operator | 🔲 `rate-limiting-and-headers.md` |
| P9 | **Security headers / CSP verified on a real response** | operator | 🔲 |
| P10 | **Backup + restore drill rehearsed** on the production project (PITR on) | operator | 🔲 |
| P11 | **Real notification recipients working** — a real customer can actually receive a receipt | dev+operator | 🔲 `notifications-production-plan.md` |
| P12 | Uncommitted work landed, CI green (`pnpm install && typecheck && test && build`) | operator | 🔲 Phase-9 review §5 Stage 0 |

> **P11 matters more than it looks.** Taking a real payment while receipts silently no-op produces a
> customer who has paid and received nothing. Do not go live with dark notifications.

---

## 2. Stripe account & business verification 🟠 OPERATOR

Lead time here is measured in **days**, not minutes — start it early, in parallel with §1.

- [ ] Stripe account is a **business** account for the correct legal entity (Maralito Labs), not a personal one.
- [ ] Business details, tax id, and **bank account for payouts** submitted and **verified** (dashboard shows no outstanding requirements).
- [ ] Identity verification for the account representative complete.
- [ ] **Statement descriptor** set to something a Ciudad Juárez customer will recognise — an unrecognised descriptor is the #1 driver of "I don't recognise this charge" disputes.
- [ ] **Supported countries / currencies confirmed** for the US↔MX flow. Confirm the settlement currency matches `STRIPE_PAYMENT_CURRENCY` and that the entity may charge customers in Mexico. **Verify in the official Stripe documentation for your account country — do not assume.**
- [ ] Public **business website URL, support email, refund policy, and terms** entered in Stripe settings and reachable (Stripe checks these; P5 supplies them).
- [ ] **Radar** rules reviewed; default fraud protection on.
- [ ] Team access: 2FA enforced for every Stripe dashboard user; no shared logins.
- [ ] Dispute + payout notification emails route to a monitored inbox.

---

## 3. Live keys, webhook endpoint, and env 🟠 OPERATOR

**Never write a key value into a file, a commit, a ticket, or a chat message.** Names only.

- [ ] Create a **restricted** live API key where possible rather than the unrestricted `sk_live_`. Minimum scopes: PaymentIntents (write), Charges (read), Refunds (write), Disputes (read), Events (read). *Verify current scope names in the Stripe dashboard.*
- [ ] Set in **Vercel Production scope only**:

| Name | Scope | Value shape |
|---|---|---|
| `STRIPE_SECRET_KEY` | server, Production | `sk_live_…` / `rk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | server, Production | `whsec_…` **from the LIVE endpoint** (different from the test one) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | public, Production | `pk_live_…` |
| `STRIPE_API_VERSION` | server, Production | leave unset to use the pinned default, or pin explicitly |
| `STRIPE_PAYMENT_CURRENCY` | server, Production | settlement currency |

- [ ] 🔴 **Preview and Development keep `sk_test_`.** A live key in Preview is a live charge from a test click.
- [ ] Register the **LIVE webhook endpoint**: `https://<production-domain>/api/stripe/webhook`.
- [ ] Subscribe **only** the events the app handles: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `payment_intent.processing`, `payment_intent.requires_action`, `charge.refund.updated` / `refund.*`, `charge.dispute.created` / `.updated` / `.closed`. Confirm the exact set against `packages/payments` + `apps/borderpass/src/server/refund-webhook.ts` before subscribing.
- [ ] Copy the **live** signing secret into `STRIPE_WEBHOOK_SECRET` (Production) and redeploy.
- [ ] **API version check:** the LIVE endpoint's version must equal `DEFAULT_STRIPE_API_VERSION` in `packages/payments/src/stripe/config.ts` (`2024-06-20` as of row 14). A mismatch changes payload shapes — fix the pin or the endpoint version before proceeding.
- [ ] Confirm the webhook route is reachable **unauthenticated** in production (it is a `PUBLIC_PREFIXES` bypass) and still **fail-closed on signature** — see §4 T2.

---

## 4. The smallest safe real-money round-trip 🟠 OPERATOR

**Do this once, with the owner's own card, for a token amount, outside business hours, with one person
watching logs.** This is a *validation*, not a launch.

**Setup:** one synthetic-but-real order for the owner's own account, quote total set to the smallest
amount Stripe accepts for the currency (verify the minimum in the official Stripe docs — it varies by
currency). Have the Stripe dashboard, Vercel logs, and Sentry open before you start.

| # | Test | Expected | Record |
|---|---|---|---|
| T1 | **Happy path.** Pay the order with a real card. | Stripe: PaymentIntent `succeeded`, `livemode: true`. App: `payments` row `succeeded`, order `awaiting_payment → paid` via `transitionOrder`, one `payment_events` row, one receipt row in `notification_outbox`. | PI id, order id, timestamps |
| T2 | **Signature fail-closed.** POST a hand-made body to the live webhook with a bad/absent signature. | HTTP **400**. No DB write. No state change. | status + a log line |
| T3 | **Idempotency.** Resend the `payment_intent.succeeded` event from the Stripe dashboard. | Exactly **1** payment row, **1** event row, **1** receipt row. No double cascade. | before/after counts |
| T4 | **Failure path.** A second small order, declined (a real card at an over-limit amount, or a deliberately wrong CVC). | Payment `failed`; order **stays `awaiting_payment`**; **never** `paid`. | order state |
| T5 | **Receipt actually arrives.** | The owner receives the receipt email at a real inbox (this exercises P11 end to end). | message id |
| T6 | **Refund (LIVE).** Refund T1 in full through the app's admin/finance action — **not** from the Stripe dashboard, so the app path is what gets validated. | `refunds` row `succeeded` via `transitionRefund`; `charge.refund.updated` ingested idempotently; money back on the card (settlement takes days — verify later). | refund id |
| T7 | **Partial refund.** On a second small live charge, refund part of it. | Partial amount correct in integer minor units; over-refund rejected by the guard. | amounts |
| T8 | **Dispute handling.** Do **not** manufacture a real dispute. Instead: (a) confirm `charge.dispute.created` is subscribed and the handler is reachable, (b) replay a dispute event from the Stripe dashboard's event tooling if available, (c) verify the app **records** the dispute and **moves no money**. | Dispute recorded; **zero** automated transfers; alert fires to a human. | event id |
| T9 | **Payout reaches the bank.** Days later, confirm the settled amount landed. | Payout `paid` in Stripe; amount reconciles. | payout id |

**Abort immediately** if: an order reaches `paid` without a `succeeded` webhook · a duplicate charge
appears · any plaintext card data, key, or PII shows up in a log · the webhook returns 5xx repeatedly.

**Clean up:** refund every live test charge (T1, T4's charge if any, T7's remainder). Do **not** delete
the orders — they are the gate evidence.

---

## 5. Kill-switch & rollback 🟠 OPERATOR — rehearse BEFORE T1

Know how to stop taking money **before** you start taking it. Verify each of these works:

| Lever | How | Effect | Time |
|---|---|---|---|
| **1. Disable the LIVE webhook endpoint** | Stripe dashboard → Webhooks → disable | App stops advancing orders. **Charges still succeed at Stripe** — this alone is not enough. | seconds |
| **2. Roll back the deployment** | Vercel → previous Production deployment → Instant Rollback | Reverts app code. | ~1 min |
| **3. Revert to TEST keys** | Set `STRIPE_SECRET_KEY`/`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` back to `sk_test_`/`pk_test_` in Production + redeploy | **No further real charges are possible.** The strongest lever. | ~2 min |
| **4. Roll the live key** | Stripe dashboard → roll the key | Instantly invalidates the compromised key; app fails closed until the new value is set. | seconds |
| **5. Pause payouts** | Stripe dashboard | Money stays at Stripe pending investigation. | seconds |

**If a customer is wrongly charged:** refund immediately from the Stripe dashboard (do not wait for a code
fix), then apply lever 3, then investigate. A prompt refund is cheaper than a dispute in every dimension.

**Data note:** none of these levers loses data. Stripe is the source of truth for money; the app's
`stripe_webhook_events` ledger lets missed events be replayed from the dashboard after the fix.

---

## 6. Evidence to record

Create `docs/phase-7/run-logs/stripe-live-<UTC-timestamp>.md`, and add a **Phase 9** row to
`docs/phase-7/gate-ledger.md` referencing it. Record:

- [ ] Date/time (UTC), operator name, and the **written owner approval** (quote it, with its date).
- [ ] Confirmation that §1 P1–P12 were all ✅ **before** live keys were set.
- [ ] Stripe account id (`acct_…`), and confirmation that verification and payouts are enabled.
- [ ] Live webhook endpoint URL + its **API version**, and the pinned `DEFAULT_STRIPE_API_VERSION`.
- [ ] T1–T9: pass/fail, PaymentIntent / refund / payout ids, order ids, and the observed app states.
- [ ] Amounts charged and **proof every test charge was refunded**.
- [ ] Confirmation that levers 1–5 in §5 were rehearsed, and how long each took.
- [ ] A grep of production logs proving **no key, no card data, and no PII** was written.

**🔴 Redaction rules — non-negotiable.** Never record: `sk_live_`/`rk_live_`/`pk_live_`/`whsec_` values ·
full card numbers, CVC, or expiry · the cardholder's name or billing address · any customer PII. Stripe
object ids (`pi_…`, `re_…`, `ch_…`, `evt_…`, `po_…`, `acct_…`) are safe references and are what you record.
`scripts/phase7-stripe-gate.sh` already redacts `sk_`/`rk_`/`whsec_`/connection strings — reuse it.

**Row 15 is ticked only when:** T1–T8 pass, every test charge is refunded, §5 is rehearsed, the evidence
log exists, and the **owner signs off in writing**. T9 (payout) may be recorded a few days later as a
follow-up note.

---

## 7. First-week watch after go-live

Live validation ≠ launch. Before any marketing:

- [ ] **Soft launch:** a handful of real orders, watched. No paid acquisition.
- [ ] Daily for the first week: Stripe payments vs the app's `payments` table — **they must reconcile exactly**. Any drift is a webhook problem.
- [ ] Alert on: webhook 4xx/5xx · payments stuck in `processing` · any order `paid` without a matching `succeeded` event · every new dispute (**page a human**) · refund failures.
- [ ] Watch the dispute rate. Rising disputes usually mean the statement descriptor or delivery expectations are wrong, not fraud.
- [ ] Re-verify the pinned API version after any Stripe-initiated version upgrade notice.

---

*No live Stripe key, dashboard, or account was accessed in producing this document. Ledger row 15 remains
🔲 UNRUN. BorderPass remains development-only.*
