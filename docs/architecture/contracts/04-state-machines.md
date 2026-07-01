# BorderPass — State Machine & Notification Contracts

> **Deliverables:** 20 (Order state machine), 21 (Payment state machine), 22 (Inspection state machine), 23 (Delivery state machine), 24 (Notification trigger matrix).
> Source: PRD `09-order-state-machine.md`, `14-notification-strategy.md`, `10-border-journey-model.md`; TAD `03-automation-workflow-and-events.md`.

## Contract rules for all state machines

1. **Status is mutated only via a transition** executed by the durable workflow engine (the 25-status Order machine **is** the durable workflow). No ad-hoc status writes.
2. **Every transition** (a) is **audit-logged** (actor, from, to, reason), (b) **emits exactly one domain event** (outbox, same transaction), and (c) **may fire a notification** (see matrix).
3. **Transitions are guarded.** A transition that fails its guard is rejected with `409 conflict_state` (see error standards). Illegal transitions are never silently applied.
4. **Forward-only** except the explicitly listed back-transitions.
5. **`HUMAN-APPROVAL` gates** are realized as workflow `approval` steps; the run sits in `waiting` until an `approval.granted`/`approval.rejected` signal arrives. AI agents may recommend but never satisfy these gates.
6. **Money/irreversible steps are idempotent + compensable** (saga). Compensation runs in reverse (e.g. refund → void quote → cancel ops task).

---

# 1. Order state machine (Deliverable 20)

**Type:** `OrderStatus` (25 canonical values). Current value on `Order.status`.

```
draft, submitted, missing_information, under_review, rejected,
quote_ready, awaiting_payment, paid,
purchasing, purchased, awaiting_package,
received_el_paso, inspection_pending, inspection_passed, inspection_failed,
border_documentation_ready, ready_for_crossing, border_crossing, customs_processing, arrived_juarez,
out_for_delivery, delivered, delivery_failed,
cancelled, refunded
```

> **Reconciliation (00 open-item #1):** `border_documentation_ready` and `ready_for_crossing` are **distinct** states. The "24 vs 25" wording in PRD §10.4 is a counting note; this enumerated **25-value set is authoritative**.

### 1.1 State groups (for queues/UI)

| Group | States |
|-------|--------|
| Intake | `draft, submitted, missing_information, under_review` |
| Quote & Pay | `quote_ready, awaiting_payment, paid` |
| Fulfilment | `purchasing, purchased, awaiting_package` |
| Hub | `received_el_paso, inspection_pending, inspection_passed, inspection_failed` |
| Crossing | `border_documentation_ready, ready_for_crossing, border_crossing, customs_processing` |
| Last mile | `arrived_juarez, out_for_delivery, delivered, delivery_failed` |
| Terminal/exception | `rejected, cancelled, refunded` |

### 1.2 Transition table

| From | → To | Guard / condition | Trigger (actor) | Event emitted | HUMAN-APPROVAL |
|------|------|-------------------|-----------------|---------------|:--:|
| `[*]` | `draft` | new request begun | customer/system | `borderpass.order.created` | |
| `draft` | `submitted` | required fields valid (Zod) | customer | `borderpass.order.submitted` | |
| `submitted` | `under_review` | passed intake validation (MVP: all) | system / Intake agent | `borderpass.order.under_review` | |
| `submitted` | `missing_information` | validation gap | system / Intake agent | `borderpass.order.missing_information` | |
| `submitted` | `cancelled` | customer cancels | customer/ops | `borderpass.order.cancelled` | |
| `missing_information` | `submitted` | customer supplies info (resubmit) | customer | `borderpass.order.submitted` (resubmit) | |
| `under_review` | `quote_ready` | risk cleared + quote approved | system + finance | `borderpass.quote.created` → `borderpass.quote.sent` | ✅ (risk + quote) |
| `under_review` | `rejected` | prohibited / compliance reject | compliance_admin | `borderpass.order.rejected` | ✅ |
| `quote_ready` | `awaiting_payment` | customer accepts quote | customer | `borderpass.quote.accepted` | |
| `quote_ready` | `cancelled` | customer declines/cancels | customer/ops | `borderpass.order.cancelled` | |
| `awaiting_payment` | `paid` | `payment.succeeded` (Stripe) | system (webhook) | `payment.succeeded` (consumed) → `borderpass.order.paid` | |
| `awaiting_payment` | `cancelled` | timeout / customer cancel | customer/system | `borderpass.order.cancelled` | |
| `paid` | `purchasing` | service_type = buy_for_me | system/ops | `borderpass.order.purchasing` | |
| `paid` | `awaiting_package` | reception/pickup flow | system | `borderpass.order.awaiting_package` | |
| `paid` | `refunded` | pre-fulfilment refund | finance | `borderpass.refund.processed` | ✅ |
| `purchasing` | `purchased` | purchase confirmed + proof | buyer/ops | `borderpass.order.purchased` | ✅ (spend) |
| `purchased` | `awaiting_package` | always | system | `borderpass.order.awaiting_package` | |
| `awaiting_package` | `received_el_paso` | hub scan | hub staff | `borderpass.package.received` | |
| `received_el_paso` | `inspection_pending` | inspection task created | system | `borderpass.inspection.started` | |
| `inspection_pending` | `inspection_passed` | inspection OK | inspector (+compliance if flagged) | `borderpass.inspection.passed` | |
| `inspection_pending` | `inspection_failed` | discrepancy/damage/prohibited | inspector/compliance | `borderpass.inspection.failed` | |
| `inspection_passed` | `border_documentation_ready` | docs prepared + approved | compliance_admin (Journey agent drafts) | `borderpass.order.border_documentation_ready` | ✅ (docs) |
| `inspection_failed` | `refunded` | resolution = refund | finance | `borderpass.refund.processed` | ✅ |
| `inspection_failed` | `cancelled` | resolution = return/cancel | ops/compliance | `borderpass.order.cancelled` | ✅ |
| `inspection_failed` | `inspection_pending` | resolution = re-inspect after correction | ops | `borderpass.inspection.started` | ✅ |
| `border_documentation_ready` | `ready_for_crossing` | docs + scheduling done | ops | `borderpass.order.ready_for_crossing` | |
| `ready_for_crossing` | `border_crossing` | crossing begun | ops/system | `borderpass.border.crossing_started` | |
| `border_crossing` | `customs_processing` | at customs | ops/system | `borderpass.border.customs_processing` | |
| `customs_processing` | `arrived_juarez` | cleared customs / arrival scan | ops/system | `borderpass.order.arrived_juarez` | |
| `arrived_juarez` | `out_for_delivery` | driver assigned + en route | ops/driver | `borderpass.delivery.out_for_delivery` | |
| `out_for_delivery` | `delivered` | POD captured | driver/system | `borderpass.delivery.completed` | |
| `out_for_delivery` | `delivery_failed` | failed attempt | driver/system | `borderpass.delivery.failed` | |
| `delivery_failed` | `out_for_delivery` | reschedule (attempts < N) | ops/driver | `borderpass.delivery.out_for_delivery` (retry) | |
| `delivery_failed` | `cancelled` | attempts exhausted → return/abandon | ops | `borderpass.order.cancelled` | |
| any non-terminal | `cancelled` | per cancellation rules (08.12) | customer/ops/system | `borderpass.order.cancelled` | ✅ after fulfilment |
| `*` (post-paid) | `refunded` | refund executed | finance | `borderpass.refund.processed` | ✅ |

**Terminal states:** `delivered`, `rejected`, `cancelled`, `refunded`. **Special note:** `border.ready_for_crossing` event (from the task list) is emitted on entry to `ready_for_crossing`.

### 1.3 Guards (gates)
- **Money gate:** no `purchasing`/`awaiting_package` fulfilment until `paid`. No crossing until `inspection_passed` **and** `border_documentation_ready` (compliance approved). Duties (if separate) may require a second successful payment before `border_crossing`/delivery.
- **Human gates (`HUMAN-APPROVAL`):** `rejected`; quote approval (→`quote_ready`); purchase spend (→`purchased`); border docs (→`border_documentation_ready`); `inspection_failed` resolution; any `refunded`.
- **Idempotency:** a unique active `WorkflowRun` per `(definition_key, order_id)` prevents duplicate processing.

### 1.4 Border Journey projection (customer-facing, 12 stages)
Read-only view over `Order.status` (rebuildable). Not stored as system of record.

| # | Customer stage | Internal status(es) | Trust indicator |
|---|----------------|---------------------|-----------------|
| 1 | Request received | `submitted`/`under_review` | "Reviewed by our team" |
| 2 | Quote ready | `quote_ready` | "No hidden fees" |
| 3 | Payment received | `paid` | "Secure payment" |
| 4 | Purchased in the U.S. | `purchasing`/`purchased` | "Purchase confirmed" |
| 5 | Received at El Paso Hub | `received_el_paso` | "Arrived & logged" |
| 6 | Package inspection | `inspection_pending`/`inspection_passed` | "Verified & Sealed" + View Photos |
| 7 | Border documents ready | `border_documentation_ready` | "Compliance approved" |
| 8 | Crossing the border | `border_crossing` | "GPS tracked" |
| 9 | Customs processing | `customs_processing` | "Cleared customs" |
| 10 | Arrived in Juárez | `arrived_juarez` | "In your city" |
| 11 | Out for delivery | `out_for_delivery` | "Driver assigned • GPS tracked" |
| 12 | Delivered | `delivered` | "Delivered • proof captured" |

Exception statuses (`rejected`, `cancelled`, `refunded`, `delivery_failed`, `missing_information`) are **not** happy-path stages — handled via exception messaging.

---

# 2. Payment state machine (Deliverable 21)

**Type:** `PaymentStatus`. Stripe is the source of truth; BorderPass mirrors via webhooks. Idempotency key = `quote_id` for the intent; Stripe event id for webhook dedupe.

```
requires_payment → processing → succeeded
                              ↘ failed → (retry/dunning) → processing
processing → canceled
succeeded → refunded | partially_refunded
```

| From | → To | Trigger | Event | Order effect |
|------|------|---------|-------|--------------|
| `[*]` | `requires_payment` | intent created (quote accepted) | `payment.intent_created` | `awaiting_payment` |
| `requires_payment` | `processing` | customer pays | `payment.processing` | — |
| `processing` | `succeeded` | Stripe `payment_intent.succeeded` | `payment.succeeded` | → `paid` |
| `processing` | `failed` | Stripe failure/decline | `payment.failed` | dunning (retry ≤ N); never proceed unpaid |
| `failed` | `processing` | retry attempt | `payment.processing` | — |
| `requires_payment`/`processing` | `canceled` | timeout / order cancel | `payment.canceled` | `cancelled` |
| `succeeded` | `refunded` | full refund processed | `refund.processed` | `refunded` |
| `succeeded` | `partially_refunded` | partial refund | `refund.processed` | order stays / `refunded` per rules |

**Duty payment:** a second `Payment` of `type=duty_charge` may be required ("Approve & Pay Duties") before `border_crossing` or delivery — same machine, separate row. **Refund machine** (`RefundStatus`): `pending → requires_approval → approved → processing → succeeded` (or `→ failed`, `→ rejected`); **requires finance `HUMAN-APPROVAL`, separation of duties, idempotent (never double-refund).**

---

# 3. Inspection state machine (Deliverable 22)

**Type:** `InspectionStatus`. Drives Order `inspection_*` states and Package `status`.

```
pending → in_progress → passed
                      ↘ failed → under_compliance_review → (passed | failed-final)
```

| From | → To | Guard | Trigger | Event | Order effect |
|------|------|-------|---------|--------|--------------|
| `[*]` | `pending` | inspection task created (W8→W9) | system | `borderpass.inspection.started` | `inspection_pending` |
| `pending` | `in_progress` | inspector opens task | inspector | — | — |
| `in_progress` | `passed` | checklist OK, serial match, sealed | inspector (+compliance if flagged) | `borderpass.inspection.passed` | `inspection_passed` |
| `in_progress` | `failed` | discrepancy/damage/prohibited/mismatch/tamper | inspector | `borderpass.inspection.failed` | `inspection_failed` |
| `failed` | `under_compliance_review` | needs compliance resolution | system | `approval.requested` | stays `inspection_failed` |
| `under_compliance_review` | `passed` | compliance clears (minor/correctable) | compliance_admin (HUMAN-APPROVAL) | `borderpass.inspection.passed` | `inspection_passed` |
| `under_compliance_review` | `failed` (final) | resolution = refund/return | compliance_admin | (Order →`refunded`/`cancelled`) | per Order machine |

**Captured at inspection:** photos (`InspectionPhoto`), serial OCR + `serial_match`, `seal_number`, `condition`, `ai_risk_score`, `discrepancy_flags`. **Resolution** (on fail) ∈ `refund | return | replace | proceed` — all `HUMAN-APPROVAL` (inspector cannot resolve alone).

---

# 4. Delivery state machine (Deliverable 23)

**Type:** `DeliveryStatus`. One active Delivery per Order; `attempts` counts failures.

```
pending → assigned → out_for_delivery → delivered
                                      ↘ failed → (assigned | returned | canceled)
```

| From | → To | Guard | Trigger | Event | Order effect |
|------|------|-------|---------|--------|--------------|
| `[*]` | `pending` | order `arrived_juarez` (W12) | system | — | — |
| `pending` | `assigned` | driver/mode assigned | ops (Ops Coordinator recommends) | `task.assigned` | — |
| `assigned` | `out_for_delivery` | driver en route | driver/ops | `borderpass.delivery.out_for_delivery` | `out_for_delivery` |
| `out_for_delivery` | `delivered` | POD (photo/signature) captured | driver | `borderpass.delivery.completed` | `delivered` |
| `out_for_delivery` | `failed` | no recipient / bad address | driver | `borderpass.delivery.failed` | `delivery_failed` |
| `failed` | `assigned` | reschedule, `attempts < N` | ops/driver (W13) | `task.assigned` (retry) | (back to `out_for_delivery` on dispatch) |
| `failed` | `returned` | `attempts ≥ N` → return to hub | ops | `borderpass.order.cancelled` (or hold) | `cancelled` per rules |
| `failed` | `canceled` | customer/abandonment | ops/system | `borderpass.order.cancelled` | `cancelled` |

**Guards:** invalid address → request correction before re-dispatch (no blind retry). Bounded retries (`N` = `⚠️ VERIFY`). Unclaimed after grace → abandonment flow (rule 08.13).

---

# 5. Notification trigger matrix (Deliverable 24)

**Mechanics:** notifications are workflow `effect` steps (or event subscriptions) calling Notifications (S4). **Recipient = customer** unless noted. **Locale** from `CustomerProfile.language` (EN/ES). **Idempotency key = (workflow_run + step + recipient)** — no double-send. **Channel fallback chain: WhatsApp → SMS → email.** Transactional (OTP, payment, issue, delivery) **bypass** quiet hours; non-urgent reminders respect quiet hours + frequency caps. Every notification deep-links to the exact screen. Staff alerts (SLA/escalation) target the relevant role queue.

| Trigger event | Channels | Template key | Recipient | Notes / vars |
|---------------|----------|--------------|-----------|--------------|
| `user.created` / signup complete | whatsapp, in_app, (email) | `account_created` | customer | |
| OTP request | sms/whatsapp | `otp_code` | customer | bypass quiet hours |
| `borderpass.order.submitted` | whatsapp, in_app | `request_submitted` | customer | `{order_ref}` |
| `borderpass.order.missing_information` | whatsapp, in_app, email | `missing_information` | customer | `{missing_items}`, `{link}` |
| `borderpass.order.under_review` | in_app | `under_review` | customer | (light touch) |
| `borderpass.order.rejected` | whatsapp, in_app, email | `order_rejected` | customer | `{reason}`, concierge offer |
| `borderpass.quote.created` (internal) | — | — | finance queue | staff: approve quote |
| `borderpass.quote.sent` / quote_ready | email (itemized) + whatsapp + in_app | `quote_ready` | customer | `{item}`,`{fee}`,`{duties}`,`{total}`,`{expiry}` |
| `borderpass.quote.expiring` | whatsapp, in_app | `quote_expiring` | customer | `{expiry}`, re-quote link (respects quiet hours) |
| `borderpass.quote.expired` | in_app, email | `quote_expired` | customer | offer re-quote |
| `payment.succeeded` / paid | email (receipt) + whatsapp + in_app | `payment_received` | customer | receipt link |
| `payment.failed` | whatsapp, in_app | `payment_failed` | customer | retry link (dunning) |
| `borderpass.order.purchased` | whatsapp, in_app | `purchased` | customer | |
| `borderpass.package.received` | whatsapp, in_app | `package_received` | customer | |
| `borderpass.inspection.passed` | whatsapp, in_app, (email) | `inspection_completed` | customer | + View Photos deep link |
| `borderpass.inspection.failed` | whatsapp + in_app + (call) | `issue_found` | customer | `{issue}`, `{concierge}` |
| `borderpass.order.border_documentation_ready` | in_app | `documents_ready` | customer | "Compliance approved" |
| `borderpass.border.crossing_started` | whatsapp, in_app, (push V1) | `border_crossing_started` | customer | `{eta}` |
| `borderpass.border.customs_processing` | in_app | `customs_processing` | customer | |
| `borderpass.customs.delayed` (W11) | whatsapp, in_app | `customs_delay` | customer | `{reason}`, `{eta}` (ops-confirmed) |
| `borderpass.order.arrived_juarez` | whatsapp, in_app | `arrived_juarez` | customer | confetti moment (UI) |
| `borderpass.delivery.out_for_delivery` | whatsapp, sms, in_app, (push) | `out_for_delivery` | customer | `{window}`, `{driver}` |
| `borderpass.delivery.completed` / delivered | whatsapp, in_app, (email) | `delivered` | customer | proof link |
| `borderpass.delivery.failed` | whatsapp, in_app | `delivery_failed` | customer | reschedule/options |
| `borderpass.refund.requested` | in_app | `refund_requested` | customer | acknowledgement |
| `borderpass.refund.processed` | email + whatsapp + in_app | `refund_processed` | customer | `{amount}`, `{timeline}` |
| concierge/support reply (`support.message.sent` outbound) | whatsapp + in_app + (push) | `support_reply` | customer | `{concierge}`, `{preview}` |
| `borderpass.support.escalated` | in_app (staff) | `staff_escalation` | specialist/role queue | SLA/escalation |
| `task.sla_breached` | in_app (staff) | `sla_breach_alert` | ops/supervisor | links to runbook |

**Failure handling:** if a critical message is undeliverable on all channels → raise an **ops task** (`notification.failed` → task). Delivery status streamed via `notification.*`; dependent workflows may await delivery confirmation.

---

*Satisfies Deliverables 20–24. Event payloads are specified in `03-event-contracts.md`; the endpoints that trigger these transitions are in `02-api-contracts.md`.*
