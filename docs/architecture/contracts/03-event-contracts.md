# BorderPass — Event, Webhook, Workflow & Agent Contracts

> **Deliverables:** 15 (event schema catalog), 16 (workflow trigger events), 17 (webhook contracts), 26 (agent-run contract), 27 (workflow-run contract).
> Source: Automation `03-event-bus-and-schema.md`, `04-workflow-lifecycle.md`, `05-agent-orchestration.md`, `18-api-endpoints.md`; TAD `03-automation-workflow-and-events.md`.

---

# 1. Event envelope standard

**Wire contract** (Automation §5.1 — authoritative; the flattened `EventLog` columns in `01-data-model.md` A11 are the persistence projection).

```jsonc
{
  "id": "evt_01HXYZ...",               // ULID/UUID — unique; IS the dedupe/idempotency key
  "type": "borderpass.order.submitted",// domain.entity.pastTenseVerb
  "version": 1,                         // schema version of this event TYPE
  "source": "borderpass",              // producing app/service
  "org_id": "org_123",                 // tenant — REQUIRED for tenant data
  "app_id": "borderpass",
  "subject": { "type": "order", "id": "ord_456" },
  "actor":   { "type": "user|staff|admin|agent|system|external", "id": "usr_789" },
  "data":    { /* typed payload, validated by registered schema per type+version */ },
  "metadata": {
    "trace_id": "trc_...",
    "correlation_id": "ord_456",        // = order_id for everything in an order lifecycle
    "causation_id": "evt_prev",         // event that caused this one
    "idempotency_key": "...",
    "sequence": 3                        // per-subject ordering when needed
  },
  "occurred_at": "2026-06-29T12:00:00Z",
  "received_at":  "2026-06-29T12:00:00.120Z"
}
```

### Envelope field rules (apply to every event)
- **`type` naming:** `domain.entity.pastTenseVerb`. BorderPass domain = `borderpass.*`; reused platform namespaces = `payment.*`, `notification.*`, `workflow.*`, `approval.*`, `task.*`, `agent.*`, `file.*`, `user.*`, `kyc.*`.
- **`version`** is per event-type. **Additive changes do not bump; breaking changes bump.** Consumers pin to versions.
- **`org_id`** mandatory for any tenant-data event; router + consumers enforce isolation.
- **`data`** validated against the registered schema for `type`+`version`; unknown/invalid → **DLQ**.
- **`correlation_id` = `order_id`** for the whole journey (replay/debug).
- **Money** = integer minor units + currency; **timestamps** UTC ISO-8601; **ids** prefixed.

### Delivery & reliability (every event)
- **At-least-once** delivery. **Consumers MUST be idempotent, keyed by `event.id`** (store processed ids in Upstash + `processed_events`; redelivery = no-op).
- **Outbox pattern:** the state change and its event are written in **one DB transaction**; a relay publishes.
- **Ordering:** no global order; use `metadata.sequence` per `subject_id` where order matters (order lifecycle).
- **Retry:** exponential backoff + jitter, per-consumer max attempts, poison detection.
- **DLQ:** per-consumer dead-letter with reason; alert on depth; one-click/CLI replay after fix.
- **Governance:** every event type registered in the **event catalog** (name, version, owner, schema, producers, consumers, description). Adding/changing an event = reviewed change.

### Per-event contract template
Each catalog entry below specifies: **Producer · Consumers · Payload (`data`) · Required fields · Retry policy · Idempotency key · Audit requirement · Example use case.** Unless overridden: **Retry = exp backoff+jitter, ≤8 attempts → DLQ**; **Idempotency key = `event.id`**; **Audit = yes** (every order-lifecycle event is audited).

---

# 2. BorderPass event catalog (Deliverable 15)

> All emit envelope above with `source="borderpass"`, `subject.type="order"` (unless noted), `correlation_id=order_id`. `data` shapes are contracts (TypeScript-style).

### 2.1 Identity / intake

**`user.created`** *(platform; consumed by BorderPass)*
- **Producer:** Identity. **Consumers:** BorderPass (profile init workflow), Notifications (`account_created`).
- **`data`:** `{ user_id, org_id, phone, email?, locale? }`. **Required:** `user_id, org_id, phone`.
- **Idempotency:** `user_id`. **Example:** new signup → create `CustomerProfile`, send welcome.

**`borderpass.order.created`** — draft started.
- **Producer:** BorderPass app. **Consumers:** Analytics, Audit.
- **`data`:** `{ order_id, order_ref, customer_id, service_type }`. **Required:** all.
- **Example:** funnel "request started" metric.

**`borderpass.order.submitted`** — request submitted. *(W1 trigger)*
- **Producer:** app. **Consumers:** intake workflow (W1), Audit, Analytics, Notifications (`request_submitted`).
- **`data`:** `{ order_id, order_ref, customer_id, service_type, item_count, declared_value: Money, purpose?, has_receipt: bool }`. **Required:** `order_id, customer_id, service_type, item_count`.
- **Example:** start intake/validation workflow.

**`borderpass.order.missing_information`** — validation gap. *(W2 trigger)*
- **Producer:** workflow / Intake agent. **Consumers:** Notifications (`missing_information`), customer app.
- **`data`:** `{ order_id, missing_fields: string[], message_key }`. **Required:** `order_id, missing_fields`.

**`borderpass.order.under_review`** — entered review.
- **Producer:** workflow. **Consumers:** compliance queue, Analytics.
- **`data`:** `{ order_id, reason: "mvp_all" | "risk" | "value" | "category" | ... }`. **Required:** `order_id`.

**`borderpass.order.risk_assessed`** — risk band set.
- **Producer:** Risk workflow (W3). **Consumers:** quote workflow (W4), Audit, compliance dashboard.
- **`data`:** `{ order_id, risk_band: "LOW"|"MEDIUM"|"HIGH"|"BLOCK", matched_rules: {rule_key,version,outcome}[], confidence, agent_run_id }`. **Required:** `order_id, risk_band`.

**`borderpass.order.rejected`** — compliance rejection.
- **Producer:** compliance decision. **Consumers:** Notifications (`order_rejected`), Audit, Analytics.
- **`data`:** `{ order_id, reason, reviewer_id, matched_rules? }`. **Required:** `order_id, reason, reviewer_id`. **Audit:** mandatory (compliance decision).

### 2.2 Quote & payment

**`borderpass.quote.created`** — quote drafted/approved.
- **Producer:** quote workflow (W4). **Consumers:** finance queue, Audit.
- **`data`:** `{ order_id, quote_id, version, total: Money, service_fee: Money, estimated_duties: Money, expires_at }`. **Required:** `order_id, quote_id, total`.

**`borderpass.quote.sent`** — quote presented to customer.
- **Producer:** workflow. **Consumers:** Notifications (`quote_ready`), Analytics.
- **`data`:** `{ order_id, quote_id, version, total: Money, expires_at }`. **Required:** `order_id, quote_id`.

**`borderpass.quote.accepted`** — customer accepted.
- **Producer:** app (customer action). **Consumers:** payment workflow (W6), Analytics.
- **`data`:** `{ order_id, quote_id, accepted_by: customer_id }`. **Required:** `order_id, quote_id`. **Idempotency:** `quote_id` (accepting twice = no-op).

**`borderpass.quote.expiring`** / **`borderpass.quote.expired`** — expiry window / elapsed. *(W5)*
- **Producer:** schedule/workflow. **Consumers:** Notifications, Analytics.
- **`data`:** `{ order_id, quote_id, expires_at }`. **Required:** `order_id, quote_id`.

**`payment.succeeded`** *(platform; normalized from Stripe webhook)*
- **Producer:** Payments (webhook normalizer). **Consumers:** payment workflow (W6 resume), fulfilment, Notifications (`payment_received`), ledger, Analytics.
- **`data`:** `{ payment_id, order_id, quote_id, amount: Money, type: "service_charge"|"duty_charge", stripe_event_id }`. **Required:** `payment_id, order_id, amount`.
- **Idempotency:** Stripe `event.id` (deduped at webhook). **Audit:** mirrored to ledger.

**`payment.failed`** *(platform)*
- **Producer:** Payments. **Consumers:** payment workflow (dunning), Notifications (`payment_failed`).
- **`data`:** `{ payment_id, order_id, quote_id, failure_code, attempt }`. **Required:** `payment_id, order_id`.

### 2.3 Fulfilment & hub

**`borderpass.order.purchased`** — item bought (buy-for-me, W7).
- **Producer:** purchase workflow. **Consumers:** journey, Notifications (`purchased`), Audit (spend).
- **`data`:** `{ order_id, purchase_proof_file_id, actual_cost: Money, variance: Money }`. **Required:** `order_id, purchase_proof_file_id`.

**`borderpass.package.received`** — hub receipt (W8). *(task list: `package.received`)*
- **Producer:** hub scan / W8. **Consumers:** inspection workflow (W9), Notifications (`package_received`).
- **`data`:** `{ order_id, package_id, tracking_number?, weight_grams?, matched_by: "agent"|"staff" }`. **Required:** `order_id, package_id`.

**`borderpass.inspection.started`** — inspection task created. *(task list: `inspection.started`)*
- **Producer:** W9. **Consumers:** inspection center, Analytics.
- **`data`:** `{ order_id, package_id, inspection_id, inspector_id? }`. **Required:** `order_id, inspection_id`.

**`borderpass.inspection.passed`** — inspection OK. *(task list: `inspection.passed`)*
- **Producer:** inspection workflow. **Consumers:** crossing workflow (W10), Notifications (`inspection_completed`), Analytics.
- **`data`:** `{ order_id, inspection_id, serial_match: bool, seal_number, photo_ids: string[] }`. **Required:** `order_id, inspection_id`.

**`borderpass.inspection.failed`** — issue found. *(task list: `inspection.failed`)*
- **Producer:** inspection workflow. **Consumers:** resolution/refund workflow, support, Notifications (`issue_found`), Audit.
- **`data`:** `{ order_id, inspection_id, discrepancy_flags: string[], condition, recommended_resolution? }`. **Required:** `order_id, inspection_id, discrepancy_flags`. **Audit:** mandatory.

### 2.4 Border crossing

**`borderpass.order.border_documentation_ready`** — docs approved.
- **Producer:** compliance/W10. **Consumers:** crossing scheduling, Notifications (`documents_ready`), Audit.
- **`data`:** `{ order_id, document_ids: string[], approved_by }`. **Required:** `order_id, approved_by`. **Audit:** mandatory.

**`borderpass.order.ready_for_crossing`** — staged + scheduled. *(task list: `border.ready_for_crossing`)*
- **Producer:** ops/W10. **Consumers:** journey, crossing ops.
- **`data`:** `{ order_id, scheduled_window? }`. **Required:** `order_id`.

**`borderpass.border.crossing_started`** — crossing begun. *(task list: `border.crossing_started`)*
- **Producer:** ops/system. **Consumers:** journey, Notifications (`border_crossing_started`).
- **`data`:** `{ order_id, eta?, gps_session_id? }`. **Required:** `order_id`.

**`borderpass.border.customs_processing`** — at customs. *(task list: `border.customs_processing`)*
- **Producer:** ops/system. **Consumers:** journey, delay-watch.
- **`data`:** `{ order_id, entered_customs_at }`. **Required:** `order_id`.

**`borderpass.customs.delayed`** — hold/delay (W11).
- **Producer:** delay workflow (Border Journey agent + ops confirm). **Consumers:** Notifications (`customs_delay`).
- **`data`:** `{ order_id, reason, new_eta }`. **Required:** `order_id, reason`.

**`borderpass.order.arrived_juarez`** — arrival.
- **Producer:** ops/system. **Consumers:** delivery workflow (W12), Notifications (`arrived_juarez`).
- **`data`:** `{ order_id, arrived_at }`. **Required:** `order_id`.

### 2.5 Delivery

**`borderpass.delivery.out_for_delivery`** — en route. *(task list: `delivery.out_for_delivery`)*
- **Producer:** W12. **Consumers:** Notifications (`out_for_delivery`), journey.
- **`data`:** `{ order_id, delivery_id, driver_id, window: {start,end} }`. **Required:** `order_id, delivery_id`.

**`borderpass.delivery.completed`** — delivered. *(task list: `delivery.completed`)*
- **Producer:** W12. **Consumers:** Notifications (`delivered`), Analytics, follow-up scheduler.
- **`data`:** `{ order_id, delivery_id, proof_file_id, delivered_at }`. **Required:** `order_id, delivery_id, proof_file_id`.

**`borderpass.delivery.failed`** — failed attempt. *(task list: `delivery.failed`)*
- **Producer:** W12/W13. **Consumers:** failed-delivery workflow (W13), Notifications (`delivery_failed`).
- **`data`:** `{ order_id, delivery_id, attempt, failure_reason }`. **Required:** `order_id, delivery_id, failure_reason`.

### 2.6 Refund & support

**`borderpass.refund.requested`** — refund initiated (W14 trigger).
- **Producer:** customer/support/compensation. **Consumers:** refund workflow (W14), finance, Audit.
- **`data`:** `{ order_id, payment_id, requested_by: {type,id}, reason, amount?: Money }`. **Required:** `order_id, payment_id, reason`.

**`borderpass.refund.processed`** — refund executed.
- **Producer:** refund workflow. **Consumers:** Notifications (`refund_processed`), ledger, Analytics, Audit.
- **`data`:** `{ order_id, refund_id, amount: Money, approved_by, timeline_estimate }`. **Required:** `order_id, refund_id, amount, approved_by`.
- **Idempotency:** `refund.idempotency_key` (**never double-refund**). **Audit:** mandatory.

**`borderpass.support.escalated`** — escalation (W15 trigger).
- **Producer:** support/system (SLA breach / message / exception). **Consumers:** support workflow (W15), specialist queues, Notifications (`staff_escalation`).
- **`data`:** `{ ticket_id?, order_id?, customer_id, category, severity, reason }`. **Required:** `customer_id, category`.

**`agent.review_completed`** — a human-approval/agent-review gate closed. *(task list explicit)*
- **Producer:** Automation (on `approval.granted/rejected` resolving an agent recommendation). **Consumers:** the waiting workflow, Audit, Analytics (override-rate).
- **`data`:** `{ order_id, agent_run_id, agent_key, recommendation, human_decision: "approved"|"rejected"|"modified", decided_by, overridden: bool }`. **Required:** `agent_run_id, human_decision, decided_by`. **Audit:** mandatory (customs/dispute defense).

### 2.7 Platform events consumed by BorderPass
`approval.requested|granted|rejected` (HITL gates), `task.created|assigned|completed|sla_breached` (ops queue work), `notification.sent|delivered|failed` (delivery tracking), `file.uploaded` (inspection photos/receipts → ingest), `agent.run.started|completed|guardrail.triggered|cost.recorded`, `workflow.run.started|completed|failed|rolled_back`, `kyc.*`.

### 2.8 `workflow.failed` *(platform; task list explicit)*
- **Producer:** Automation engine (retries exhausted / unrecoverable). **Consumers:** ops alerting, DLQ dashboard, on-call. **`data`:** `{ run_id, definition_key, subject_id (order_id), step, error, attempt }`. **Required:** `run_id, definition_key, error`. **Audit:** yes. **Retry:** N/A (terminal); raises ops task.

---

# 3. Workflow trigger events (Deliverable 16)

Mapping of the 15 BorderPass workflows to their trigger event and the events they emit (full step detail in PRD 13). Engine: Inngest **or** Trigger.dev (`⚠️ VERIFY`).

| Workflow | Trigger | Emits (key) | Human gate |
|----------|---------|-------------|-----------|
| W1 Intake | `borderpass.order.submitted` | `order.under_review`, `order.missing_information` | reviewer (MVP all) |
| W2 Missing-info | `order.missing_information` | (resume) `order.submitted` | customer supplies |
| W3 Risk review | `order.under_review` | `order.risk_assessed`, `order.rejected` | **compliance** |
| W4 Quote | `order.risk_assessed` (cleared) | `quote.created`, `quote.sent` | **finance** |
| W5 Quote-expiry | schedule (expiry − window) | `quote.expiring`, `quote.expired` | — |
| W6 Payment | `quote.accepted` → resumes on `payment.succeeded`/`payment.failed` | `order.paid` | disputes only |
| W7 Purchase | `order.paid` (buy_for_me) | `order.purchased` | **buyer spend; finance on variance** |
| W8 Package received | hub scan | `package.received` | hub staff |
| W9 Inspection | `package.received` | `inspection.started`, `inspection.passed`, `inspection.failed` | **compliance on fail** |
| W10 Border crossing | `inspection.passed` | `border_documentation_ready`, `ready_for_crossing`, `border.crossing_started`, `border.customs_processing` | **compliance (docs)** |
| W11 Delay notification | stage exceeds window / hold | `customs.delayed` | ops confirm |
| W12 Delivery | `order.arrived_juarez` | `delivery.out_for_delivery`, `delivery.completed` | driver POD |
| W13 Failed delivery | `delivery.failed` | (reschedule) `delivery.out_for_delivery` | concierge after N |
| W14 Refund | `borderpass.refund.requested` | `refund.processed` | **finance** |
| W15 Support escalation | `borderpass.support.escalated` | `support.message.sent` | concierge/specialist |

**Trigger router** maps event facts → workflow runs via subscriptions + rules. A workflow can subscribe to its own-app and platform events. Schedules live in the `schedules` table (`cron`/`delayed`/`recurring`).

---

# 4. Webhook contracts (Deliverable 17)

All inbound webhooks: **verify signature → dedupe by provider event id → persist `WebhookEvent` → normalize to a platform `*.*` event → ACK fast (2xx)**. Never process inline; hand to workflow/event bus. Reject unverified signatures with `401`.

| Endpoint | Provider | Verifies | Normalizes to | Dedupe key | Notes |
|----------|----------|----------|---------------|-----------|-------|
| `POST /api/webhooks/stripe` | Stripe | Stripe signature (`Stripe-Signature`) | `payment.succeeded` / `payment.failed` / `refund.processed` / dispute events | Stripe `event.id` | Source of truth for payment state; idempotent reconcile |
| `POST /api/webhooks/twilio` (+ `/whatsapp`) | Twilio / WhatsApp | Twilio signature | `notification.delivered`/`notification.failed`; inbound msg → concierge `support.message` (inbound) | provider message id | Inbound WhatsApp routes to Concierge Workspace |
| `POST /api/webhooks/resend` | Resend | Resend signature | `notification.delivered` / `notification.bounced` | provider event id | Email delivery/bounce tracking |
| `POST /api/events` (internal) | internal producers | service principal / signed | (passthrough to bus) | `event.id` | Internal domain/workflow event ingress |

**Outbound webhooks** (future partner API): **HMAC-signed**, retried with backoff, delivery tracked. Not in MVP scope.

**Webhook response contract:** `2xx` = accepted (will process async); `400` = malformed; `401` = bad signature; `409` = duplicate (already processed — still returns 2xx-style ack in practice to stop retries). Handlers must complete in < provider timeout.

---

# 5. Workflow-run contract (Deliverable 27)

BorderPass references `WorkflowRun` by id and reads via the Automation API. The 25-status Order machine **is** the durable workflow (steps = transitions; long waits = durable sleep/awaits; human gates = `approval` steps; field work = `task` steps).

### 5.1 WorkflowRun shape (read contract)
```ts
interface WorkflowRun {
  id: string;                 // wfr_…
  org_id: string;
  app_id: "borderpass";
  definition_key: string;     // e.g. "borderpass.order.intake"
  definition_version: number; // pinned; in-flight runs keep their version
  subject: { type: "order"; id: string };
  correlation_id: string;     // = order_id
  trace_id: string;
  current_step: string;
  status: "pending"|"running"|"waiting"|"escalated"|"compensating"|"completed"|"failed"|"rolled_back";
  input: object;
  state: object;              // checkpoint (resumable)
  error?: object;
  started_at: string; updated_at: string; ended_at?: string;
}
```

### 5.2 Step model
- **Step types:** `function | agent | approval | task | wait | signal | effect | subworkflow`.
- **Step status:** `pending | running | waiting | succeeded | failed | compensated | skipped`.
- **Step config:** `retry {maxAttempts, backoff, jitter}`, `timeout` (ISO-8601 e.g. `"PT30M"`), `on_timeout` (`escalate|fail|compensate|default_branch`), `on_failure` (`retry|compensate|escalate|dlq|branch`), `compensation` (step id), `idempotency_key`, `permissions {tools, data_scopes}`.

### 5.3 Lifecycle & semantics
- **States:** `pending → running → waiting → running → completed`; failure paths `running → compensating → rolled_back`/`failed`; `waiting → escalated → waiting`/`failed`. Terminal: `completed | failed | rolled_back`.
- **Triggers:** event (router), schedule, manual/API (`POST /runs`).
- **Resume:** on signal/timer the engine reloads the checkpointed `state` and continues from the next step — **completed side effects never re-run**.
- **Approval steps** emit `approval.requested`, create an `approvals` record, run → `waiting`; on `approval.granted/rejected` **signal**, resume the matching branch. Approval steps have their own timeout → escalation.
- **Compensation/saga:** on failure, compensations run in **reverse order** for completed effect steps → `rolled_back`. Failed compensation → `failed` + **P0 manual-remediation task** (never silently inconsistent).
- **Versioning:** immutable pinned versions; in-flight runs keep their started version; new triggers use latest published; instant revert by re-pointing the trigger.
- **Guard:** unique active run per `(definition_key, subject_id)`.
- Every transition emits a `workflow.*` event (`workflow.run.started|completed|failed|rolled_back`, `workflow.step.completed`, `workflow.compensation.started`) + audit.

### 5.4 Control operations (via Automation API — see `02-api-contracts.md` §Automation)
Start `POST /runs` · Read `GET /runs/{id}` (+ `/steps`, `/events`) · **Resume (approve/reject) `POST /runs/{id}/signal`** · Resume stuck `POST /runs/{id}/resume` · Retry step `POST /runs/{id}/retry-step` · Cancel+compensate `POST /runs/{id}/cancel` · Replay `POST /runs/{id}/replay` · Override `POST /runs/{id}/override` (elevated + audited).

---

# 6. Agent-run contract (Deliverable 26)

Agents are workflow **steps** run via the LangGraph manager through the **AI gateway** (never hold provider keys; never act beyond granted tools/scope). BorderPass references `AgentRun` by id. **There is no separate "log agent action" endpoint — `AgentRun`/`AgentStep`, written by the orchestrator, ARE the log** (read via `GET /agent-runs/{id}`).

### 6.1 AgentRun shape (read contract)
```ts
interface AgentRun {
  id: string;                 // agr_…
  org_id: string; app_id: "borderpass";
  agent_key: string;          // e.g. "borderpass.risk_agent"
  agent_version: string;
  run_id: string;             // parent WorkflowRun (wfr_…)
  step_id: string;
  subject: { type: "order"; id: string };
  trace_id: string; correlation_id: string;   // = order_id
  status: "running"|"completed"|"failed"|"awaiting_approval";
  input: object;
  output: object;
  verdict: object;            // e.g. { risk_band, recommendation }
  confidence: number;         // 0..1
  tokens_in: number; tokens_out: number;
  cost_usd: number; latency_ms: number;
  started_at: string; ended_at?: string;
}
```

### 6.2 AgentStep (sub-record)
`{ id, agent_run_id, org_id, node, type: "reason"|"tool"|"decision"|"approval", tool_key?, input, output(redacted), guardrail_outcome, cost_usd, tokens, latency_ms }`.

### 6.3 Autonomy & human-in-the-loop contract
- **Autonomy tiers:** `suggest | act_with_approval | act_autonomously(bounded)`. New agents start at **`suggest`**.
- **Irreversible/high-value actions** (payments, refunds, purchase spend, border/compliance, order rejection) **always require human approval** — the orchestrator **auto-inserts an `approval` step** before executing and sets `AgentRun.status = awaiting_approval`.
- **Low-confidence rule:** any risky recommendation below threshold **escalates to a human** (never auto-acts); the recommendation + confidence + escalation + human decision are all audited.
- **Guardrails:** hits emit `agent.guardrail.triggered` + audit; can block/downgrade/escalate.
- **Closing the loop:** when the human decides, the workflow resumes and `agent.review_completed` is emitted (records `overridden` for override-rate metrics).
- **Logging:** every run/step traced with the parent `trace_id`: model, tokens, cost, latency, tool calls, guardrail outcomes, memory R/W, approval waits, final verdict. Cost attributed per workflow/app/org.

### 6.4 BorderPass agents → workflows (reference)
Intake→W1/W2 · Shopping→W7 · Risk & Compliance→W3 · Quote→W4/W5 · Inspection Assistant→W9 · Border Journey→W10/W11 · Customer Support→W15 · Finance→W6/W14 · Operations Coordinator→W7/W8/W10/W12 · Manager (V2)→oversight. Each emits `agent.run.started|completed`, optional `agent.handoff`, `agent.guardrail.triggered`, `agent.cost.recorded`.

---

*Satisfies Deliverables 15–17, 26–27. Notification payloads/matrix in `04-state-machines.md`; API endpoints that emit/consume these events in `02-api-contracts.md`.*
