# BorderPass — API & Server Action Contracts

> **Deliverables:** 12 (endpoint catalog), 13 (request/response contracts), 14 (server action contracts), 18 (error response standards), 19 (validation rules).
> Source: TAD `02-backend-api-and-admin.md`, `06-auth-rbac-security-privacy.md`; Automation `18-api-endpoints.md`; Platform `06-api-and-events.md`.

---

# 1. API shape & conventions

**There is no standalone backend service in MVP.** The "backend" is the **Next.js BFF**:
- **Server Actions** (`app/actions/…`) for **mutations** — typed RPC-like, the default for app writes.
- **Route Handlers** (`app/api/…`) for **reads, webhooks, REST, SSE/streaming**.
- **BorderPass domain module** + **automation workflows** behind the BFF.
- App↔platform calls go **only through `@maralito/sdk`** (never hand-rolled HTTP).

### Request pipeline (every call)
Cloudflare (WAF/rate limit) → Next.js middleware (session, locale) → BFF handler/action → **AuthN** (session token) → **AuthZ** (`can(role, action, ctx)`) → **set tenant context** (`org_id` from token, for RLS) → **Zod validate** → **idempotency key** (mutations) → domain/SDK/start workflow → **audit emit** (sensitive ops) + tracing → typed response / typed error.

### Cross-cutting rules
| Concern | Rule |
|---------|------|
| **AuthN** | Session access token: `sub, org_id, app_id, roles, permissions, session_id, exp` (+`amr`). |
| **AuthZ** | RBAC at BFF (`can()`); RLS re-asserts `org_id` in DB. Both layers always. |
| **Tenancy** | `org_id` derived from session — **never a request param/body field**. |
| **Validation** | Zod at every boundary; reject before any side effect. |
| **Idempotency** | `Idempotency-Key` header on all mutations; result cached (Upstash + DB); retries safe. Payment intents keyed by `quote_id`; refunds by refund idempotency key. |
| **Pagination** | Cursor-based, stable ordering. Params: `?cursor=&limit=` (max 100). Response: `{ data, next_cursor }`. |
| **Versioning** | App API additive; public API URL-major (`/v1`) + header-minor (future). |
| **Money/Time/IDs** | Integer minor units + currency; UTC ISO-8601; prefixed ULIDs. |
| **Rate limiting** | Per key/org/route (tighter on auth/payments/AI); `429` + `Retry-After`. |

---

# 2. Error response standards (Deliverable 18)

**Canonical error shape** (all route handlers and server actions):
```jsonc
{
  "error": {
    "code": "validation_failed",     // stable machine string (snake_case)
    "message": "Human-readable summary (localized EN/ES where customer-facing).",
    "details": [                       // optional, field-level
      { "field": "declared_value", "issue": "required" }
    ],
    "request_id": "req_…",
    "trace_id": "trc_…"
  }
}
```
- **No internal leakage** (no stack traces, SQL, provider errors) to clients.
- Server Actions return a typed discriminated result `{ ok: true, data } | { ok: false, error }` mirroring the same shape (never throw raw to the client).

### Canonical error codes → HTTP status

| `code` | HTTP | When |
|--------|------|------|
| `unauthenticated` | 401 | missing/invalid/expired session |
| `forbidden` | 403 | RBAC denies action (also audited as a denial) |
| `not_found` | 404 | resource absent or out of tenant scope (RLS) |
| `validation_failed` | 422 | Zod validation failed (see `details`) |
| `bad_request` | 400 | malformed payload/params |
| `conflict_state` | 409 | illegal state-machine transition / version conflict |
| `idempotency_conflict` | 409 | same key, different payload |
| `duplicate` | 409 | duplicate webhook/resource |
| `payment_required` | 402 | action needs payment first (money gate) |
| `approval_required` | 423 | action blocked pending `HUMAN-APPROVAL` |
| `rate_limited` | 429 | rate/budget exceeded; `Retry-After` |
| `dependency_unavailable` | 503 | platform service/provider down (fail-soft → queue) |
| `internal_error` | 500 | unexpected (logged with `trace_id`) |

**RLS note:** out-of-tenant access returns `not_found` (never reveals existence). **Denials** (`forbidden`) always produce an audit record.

---

# 3. Validation rules (Deliverable 19)

Applied at the boundary (Zod) **and** re-checked by domain/state-machine guards. Business thresholds marked `⚠️ VERIFY` come from the **versioned rules engine**, not code.

### Global field validation
- **IDs**: prefixed-ULID pattern per entity; reject foreign-tenant ids as `not_found`.
- **Money**: `amount_minor` integer ≥ 0; `currency ∈ {USD, MXN}`; reject floats.
- **Phone**: E.164. **Email**: RFC 5322. **Locale** ∈ `{en, es}`.
- **Strings**: length-bounded; trimmed; reject control chars; HTML-escaped on render.
- **Enums**: must match canonical sets in `01`/`04`; unknown value → `validation_failed`.
- **Timestamps**: ISO-8601 UTC.
- **File refs**: must be `file_…` owned by the same `org_id` with an ACL granting the caller.

### Domain validation (selected — full rules in PRD 08)
- **Order submit**: ≥1 `OrderItem`; each item `quantity ≥ 1`, `unit_value > 0`, `description` non-empty; `purpose` + `declared_value` present; addresses required per `service_type`; **RFC required** if `service_type=business_delivery` OR `declared_value ≥ commercial_threshold` (`⚠️ VERIFY`); RFC format-validated.
- **Receipt required** when reception/declared-value/commercial AND none uploaded → block submit / set `missing_information`.
- **Prohibited category** → cannot submit/auto-accept; routes to review/reject.
- **Quote accept**: quote must be `sent` and not `expired`; else `conflict_state`.
- **Pay**: order must be `awaiting_payment`; amount must equal quote `total`; else `conflict_state`/`payment_required`.
- **Refund request**: order must be refund-eligible per status (rules 08.8); amount ≤ refundable balance.
- **State transitions**: every mutate endpoint re-validates the from→to transition against `04-state-machines.md`; illegal → `conflict_state`.
- **Approval-gated actions**: if a `HUMAN-APPROVAL` gate is unmet, return `approval_required` (423).

---

# 4. Server Action contracts (Deliverable 14)

Mutations are **typed Server Actions**, not REST. Contract for every action:

```ts
// Shape every server action follows
type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

async function actionName(input: InputDTO, ctx: { idempotencyKey?: string }): Promise<ActionResult<OutputDTO>>;
```
- **AuthN/AuthZ/tenant/validation/idempotency/audit** are applied by a shared action wrapper (`withAction({ permission, schema, audit })`) — individual actions declare their `permission`, Zod `schema`, and whether `audit` is required.
- Actions **never** set `org_id` from input; they read it from session.
- Actions that change state **start or signal a workflow** rather than mutating status directly.
- Below, "Endpoint" rows tagged **(SA)** are Server Actions; **(RH)** are Route Handlers (`METHOD /path`). Reads are RH; mutations are SA unless they must be REST (webhooks, partner).

---

# 5. Customer API catalog (Deliverables 12–13)

> Role: `customer` (own data only, RLS owner-scoped). All emit audit only where noted (customer reads of own data are not individually audited; sensitive PII reads by staff are — see `05`).

### 5.1 Auth / session / profile

**Start phone OTP** — `POST /api/auth/otp/start` (RH)
- Purpose: begin phone login. Request: `{ phone: E.164 }`. Response: `{ challenge_id, expires_at }`. Validation: E.164. Side effects: OTP sent (Notifications, bypass quiet hours). Events: — (platform `auth.*`). Audit: auth attempt. Errors: `rate_limited`, `bad_request`.

**Verify OTP** — `POST /api/auth/otp/verify` (RH)
- Request: `{ challenge_id, code }`. Response: `{ access_token, refresh_token, user, profile_exists: bool }`. Side effects: session created; on first login `user.created` may fire → profile init. Audit: login. Errors: `unauthenticated` (bad code), `rate_limited`.

**Get my profile** — `GET /api/me` (RH) · role `customer`
- Response: `CustomerProfile` (own) + addresses + prefs. Errors: `unauthenticated`.

**Update profile** — `updateProfile` (SA) · `customer`
- Request: `{ display_name?, language?, notification_prefs?, rfc? }`. Response: updated `CustomerProfile`. Validation: language enum; RFC format. Side effects: none beyond write. Events: `borderpass.customer.updated` (internal). Audit: yes if `rfc`/PII changed. Errors: `validation_failed`.

**Manage addresses** — `createAddress` / `updateAddress` / `deleteAddress` (SA) · `customer`
- Request (create): `Address` (no `id`/`customer_id` — derived). Response: `Address`. Validation: address fields. Audit: yes (PII). Errors: `validation_failed`, `not_found`.

**Manage payment methods** — `addPaymentMethod` / `removePaymentMethod` / `setDefault` (SA) · `customer`
- Request: `{ stripe_payment_method_id }` (created client-side via Stripe Elements). Response: saved method (refs only, **no card data**). Side effects: Payments SDK. Audit: yes. Errors: `dependency_unavailable`.

### 5.2 Orders

**Create request (draft)** — `createOrder` (SA) · `customer`
- Purpose: begin a New Request. Request: `{ service_type, items?: OrderItemInput[], purpose?, declared_value?, addresses?, rfc? }`. Response: `{ order_id, order_ref, status: "draft" }`. Validation: `service_type` enum; partial allowed (draft). Side effects: create `Order` (+ items). Events: `borderpass.order.created`. Audit: yes. Errors: `validation_failed`.

**Update draft order** — `updateDraftOrder` (SA) · `customer`
- Request: `{ order_id, patch: Partial<OrderDraft> }`. Response: updated draft. Validation: only `draft` editable (else `conflict_state`); field-level. Side effects: write. Events: — (draft). Audit: light. Errors: `conflict_state`, `not_found`.

**Submit order** — `submitOrder` (SA) · `customer`
- Purpose: submit for review. Request: `{ order_id }`. Response: `{ order_id, status: "submitted" }`. Validation: full submit ruleset (§3 domain: items, purpose, value, addresses, RFC, receipt) → else `validation_failed`/`missing_information`. Side effects: transition `draft→submitted`; **start W1 intake workflow**. Events: `borderpass.order.submitted`. Audit: **yes**. Errors: `validation_failed`, `conflict_state`.

**List my orders** — `GET /api/orders` (RH) · `customer`
- Query: `?status=&cursor=&limit=`. Response: `{ data: OrderSummary[], next_cursor }`. RLS: own only. Errors: `unauthenticated`.

**Get order detail** — `GET /api/orders/{id}` (RH) · `customer`
- Response: `OrderDetail` (items, current quote, payment summary, documents, status). RLS owner. Errors: `not_found`.

**Get border journey** — `GET /api/orders/{id}/journey` (RH) · `customer`
- Response: `{ stages: JourneyStage[12], current_stage, eta?, tracking_id, location? }` (projection over status). Errors: `not_found`.

**View inspection photos** — `GET /api/orders/{id}/inspection` (RH) · `customer`
- Response: `{ inspection: {serial_match, seal_number, condition, inspector, inspected_at}, photos: {signed_url, caption, kind}[] }`. Side effects: **signed view URLs minted** (time-limited, owner-ACL). Audit: photo access logged. Errors: `not_found`, `forbidden` (not owner).

**Cancel order** — `cancelOrder` (SA) · `customer`
- Request: `{ order_id, reason? }`. Response: `{ order_id, status }`. Validation: cancellable per status (rules 08.12); post-fulfilment → `approval_required` (routes to ops/finance). Side effects: transition `*→cancelled` (or open refund per rules); workflow signal. Events: `borderpass.order.cancelled`. Audit: **yes**. Errors: `conflict_state`, `approval_required`.

**Reorder** — `reorder` (SA) · `customer`
- Request: `{ order_id }`. Response: new `{ order_id, status: "draft" }` prefilled. Audit: light. Errors: `not_found`.

### 5.3 Quotes, payments, files

**View quote** — `GET /api/orders/{id}/quote` (RH) · `customer`
- Response: `Quote` + `QuoteLineItem[]` (itemized) + `expires_at` + `pdf_url(signed)`. Errors: `not_found`.

**Accept quote** — `acceptQuote` (SA) · `customer`
- Request: `{ order_id, quote_id }`. Response: `{ order_id, status: "awaiting_payment" }`. Validation: quote `sent` & not `expired` (else `conflict_state`). Side effects: transition; **W6 payment workflow** creates intent. Events: `borderpass.quote.accepted`. Audit: yes. Errors: `conflict_state`.

**Decline quote** — `declineQuote` (SA) · `customer` — analogous; → `cancelled` or re-quote. Events: `borderpass.order.cancelled`.

**Pay quote / create payment intent** — `createPaymentIntent` (SA) · `customer`
- Request: `{ order_id, quote_id }`. Response: `{ client_secret, payment_id }` (Stripe). Validation: order `awaiting_payment`; **idempotency key = `quote_id`**. Side effects: Payments SDK intent. Events: `payment.intent_created`. Audit: yes. Errors: `payment_required`, `conflict_state`, `dependency_unavailable`. **Confirmation is via Stripe webhook → `payment.succeeded` → `paid` (not this endpoint).**

**Pay duties** — `payDuties` (SA) · `customer` — same shape, `type=duty_charge`; gate before crossing/delivery.

**Get receipts** — `GET /api/orders/{id}/receipts` (RH) · `customer` — Response: issued invoices + uploaded proofs (signed URLs). Errors: `not_found`.

**Get upload URL** — `getUploadUrl` (SA) · `customer`
- Purpose: direct-to-storage upload for receipt/document. Request: `{ order_id, kind: "receipt"|"document", content_type }`. Response: `{ upload_url(signed, short-lived), file_id }`. Side effects: Files SDK mints URL with org/owner ACL. Errors: `validation_failed`.

**Upload receipt/document (commit)** — `attachReceipt` / `attachDocument` (SA) · `customer`
- Request: `{ order_id, file_id, type }` (after client PUTs to storage; `file.uploaded` fired by storage). Response: `Receipt`/`Document` row. Side effects: create row; may clear `missing_information` → re-run W2/W1. Events: consumes `file.uploaded`; may emit `borderpass.order.submitted` (resubmit). Audit: yes. Errors: `not_found`, `validation_failed`.

### 5.4 Concierge / notifications

**List conversations / messages** — `GET /api/messages` , `GET /api/messages/{ticket_id?}` (RH) · `customer` — own threads. Errors: `not_found`.

**Message concierge** — `sendConciergeMessage` (SA) · `customer`
- Request: `{ order_id?, body, attachments?: file_id[] }`. Response: `SupportMessage`. Validation: body length; attachment ACL. Side effects: create `SupportMessage(inbound)`; may open/append `SupportTicket`; route to Concierge Workspace; may emit escalation. Events: `borderpass.support.message` (inbound); `borderpass.support.escalated` if rules match. Audit: light (content is Confidential). Errors: `validation_failed`.

**Request refund** — `requestRefund` (SA) · `customer`
- Request: `{ order_id, reason, amount?: Money }`. Response: `{ refund_request_id, status: "pending" }`. Validation: refund-eligible per status (08.8); amount ≤ balance. Side effects: **start W14**; creates approval gate. Events: `borderpass.refund.requested`. Audit: **yes**. Errors: `conflict_state`, `approval_required`.

**List in-app notifications / mark read** — `GET /api/notifications` (RH) / `markNotificationRead` (SA) · `customer`. Errors: `not_found`.

---

# 6. Admin / Ops API catalog (Deliverables 12–13)

> RBAC-gated. Every admin mutation is **audited**. `HUMAN-APPROVAL`-gated actions enforce separation of duties (requester ≠ approver). Roles per `05-access-control-and-data-requirements.md`.

### 6.1 Orders & review

**List orders** — `GET /api/admin/orders` (RH) · `operations_manager, compliance_admin, finance_admin, support_agent, super_admin` (role-scoped views)
- Query: `?status=&service_type=&risk_band=&hub=&zone=&customer=&date_from=&date_to=&cursor=&limit=`. Response: `{ data: OrderRow[], next_cursor }`. RLS: org; role scope filters columns/rows. Audit: query of PII-bearing lists may be sampled-audited. Errors: `forbidden`.

**Review order (detail)** — `GET /api/admin/orders/{id}` (RH) · ops/compliance/finance/support
- Response: full `OrderDetail` + risk review + agent recommendations + workflow state + timeline. Side effects: **PII read audited**. Errors: `forbidden`, `not_found`.

**Approve / reject order (risk)** — `decideRiskReview` (SA) · `compliance_admin, super_admin` · **HUMAN-APPROVAL**
- Request: `{ order_id, decision: "approve"|"reject"|"hold", reason, matched_rules_ack? }`. Response: `{ order_id, status, risk_review }`. Validation: order `under_review`; reason required on reject/hold. Side effects: **signal W3** (`approval.granted/rejected`); transition → `quote_ready`(approve path)/`rejected`/hold. Events: `borderpass.order.risk_assessed` (if first), `borderpass.order.rejected`, `agent.review_completed`. Audit: **mandatory** (actor, decision, reason, matched rules). Errors: `conflict_state`, `forbidden`.

**Request missing information** — `requestMissingInfo` (SA) · `operations_manager, compliance_admin, concierge, support_agent, super_admin`
- Request: `{ order_id, missing_fields: string[], note? }`. Response: `{ order_id, status: "missing_information" }`. Side effects: transition; **start/branch W2**; notify customer. Events: `borderpass.order.missing_information`. Audit: yes. Errors: `conflict_state`.

**Update order status / advance / hold** — `advanceOrder` / `holdOrder` (SA) · `operations_manager, super_admin` (+ role per transition)
- Request: `{ order_id, to_status, reason? }`. Response: `{ order_id, status }`. Validation: transition legal per `04`; money/human gates enforced (→ `payment_required`/`approval_required`). Side effects: workflow signal; transition. Events: the transition's event. Audit: **yes**. Errors: `conflict_state`, `approval_required`, `payment_required`, `forbidden`.

**Add order note** — `addOrderNote` (SA) · concierge/support/ops/super_admin. Request `{ order_id, body }`. Audit: yes. Errors: `not_found`.

### 6.2 Quotes & payments

**Create quote** — `createQuote` (SA) · `finance_admin, super_admin` (Quote agent drafts; human approves)
- Request: `{ order_id, line_items: QuoteLineItemInput[], service_fee, estimated_duties, taxes?, expires_at?, override_reason? }`. Response: `Quote (draft|pending_approval)`. Validation: line items sum to total; duty basis present. Side effects: create `Quote` + `QuoteLineItem[]`. Events: `borderpass.quote.created`. Audit: yes. Errors: `validation_failed`, `conflict_state`.

**Update quote** — `updateQuote` (SA) · `finance_admin, super_admin` — editable while `draft|pending_approval`; supersedes version. Audit: yes. Errors: `conflict_state`.

**Approve & send quote** — `approveQuote` (SA) · `finance_admin, super_admin` · **HUMAN-APPROVAL**
- Request: `{ order_id, quote_id }`. Response: `{ quote: "sent", order: "quote_ready" }`. Validation: approver ≠ override author for non-standard pricing (separation of duties); quote `pending_approval`. Side effects: signal W4; generate PDF; notify. Events: `borderpass.quote.sent`. Audit: **mandatory**. Errors: `conflict_state`, `forbidden`.

**List payments / reconcile** — `GET /api/admin/payments` (RH) / `reconcilePayment` (SA) · `finance_admin, super_admin`. Audit: yes (financial). Errors: `forbidden`.

**Process refund** — `processRefund` (SA) · `finance_admin, super_admin` · **HUMAN-APPROVAL**
- Request: `{ order_id, refund_request_id, amount: Money, decision: "approve"|"reject", reason }`. Response: `{ refund_id, status }`. Validation: amount ≤ refundable balance; **approver ≠ requester**; threshold/risk → may need compliance co-sign. Side effects: signal W14; **idempotent Stripe refund** (key = refund idempotency key); compensation (void tasks). Events: `borderpass.refund.processed`. Audit: **mandatory**. Errors: `conflict_state`, `forbidden`, `idempotency_conflict`.

### 6.3 Hub, inspection, crossing

**Mark package received** — `markPackageReceived` (SA) · `operations_manager, inspector (hub), super_admin`
- Request: `{ order_id, package: { tracking_number?, weight_grams?, dims_mm?, photos?: file_id[] } }`. Response: `Package`. Validation: order in fulfilment group. Side effects: create/upsert `Package`; match to order (agent; unmatched → staff task); transition → `received_el_paso`; start W9. Events: `borderpass.package.received`. Audit: yes. Errors: `conflict_state`.

**Assign inspector** — `assignInspector` (SA) · `operations_manager, super_admin`. Request `{ order_id|package_id, inspector_id }`. Side effects: `task.assigned`. Audit: yes. Errors: `not_found`.

**Submit / upload inspection report** — `submitInspection` (SA) · `inspector, super_admin`
- Request: `{ inspection_id, checklist, serial_number?, serial_match?, seal_number?, condition, photos: file_id[], notes?, outcome: "passed"|"failed", discrepancy_flags? }`. Response: `Inspection`. Validation: required checklist complete; photos present; `inspector` owns task. Side effects: transition inspection machine; on pass → `inspection_passed` + start W10; on fail → `inspection_failed` + **compliance approval gate**. Events: `borderpass.inspection.passed` / `borderpass.inspection.failed`. Audit: **yes**. Errors: `conflict_state`, `forbidden`.

**Resolve inspection failure** — `resolveInspection` (SA) · `compliance_admin, operations_manager, super_admin` · **HUMAN-APPROVAL**
- Request: `{ inspection_id, resolution: "refund"|"return"|"replace"|"proceed", reason }`. Response: updated inspection + order. Side effects: branch (refund→W14 / re-inspect / proceed). Events: per resolution. Audit: **mandatory**. Errors: `approval_required`, `conflict_state`.

**Approve border documents** — `approveBorderDocs` (SA) · `compliance_admin, super_admin` · **HUMAN-APPROVAL**
- Request: `{ order_id, document_ids: string[], decision: "approve"|"reject", reason? }`. Response: `{ order: "border_documentation_ready" }`. Side effects: signal W10; transition. Events: `borderpass.order.border_documentation_ready`. Audit: **mandatory** (customs defense). Errors: `conflict_state`, `forbidden`.

**Update crossing state** — `updateCrossingState` (SA) · `operations_manager, super_admin`
- Request: `{ order_id, to: "ready_for_crossing"|"border_crossing"|"customs_processing"|"arrived_juarez", meta? }`. Response: `{ order_id, status }`. Side effects: transition; journey update. Events: `borderpass.order.ready_for_crossing` / `borderpass.border.crossing_started` / `borderpass.border.customs_processing` / `borderpass.order.arrived_juarez`. Audit: yes. Errors: `conflict_state`.

**Record customs hold / delay** — `recordCustomsDelay` (SA) · `operations_manager, compliance_admin, super_admin`. Request `{ order_id, reason, new_eta }`. Side effects: W11; customer notify (ops-confirmed). Events: `borderpass.customs.delayed`. Audit: yes.

### 6.4 Delivery & drivers

**Assign delivery / driver** — `assignDelivery` (SA) · `operations_manager, super_admin`
- Request: `{ order_id, driver_id?, mode, window? }`. Response: `Delivery`. Validation: order `arrived_juarez`; driver active & zone-matched. Side effects: create/assign `Delivery`; `task.assigned`. Events: (none until dispatch). Audit: yes. Errors: `conflict_state`, `not_found`.

**Mark out for delivery** — `dispatchDelivery` (SA) · `operations_manager, driver, super_admin`. Side effects: transition → `out_for_delivery`. Events: `borderpass.delivery.out_for_delivery`. Audit: yes.

**Capture proof of delivery** — `completeDelivery` (SA) · `driver, super_admin`
- Request: `{ delivery_id, proof_file_id, notes? }`. Response: `{ delivery: "delivered", order: "delivered" }`. Validation: proof present; driver owns task. Side effects: transition; follow-up scheduled. Events: `borderpass.delivery.completed`. Audit: yes. Errors: `conflict_state`, `forbidden`.

**Report failed delivery** — `failDelivery` (SA) · `driver, operations_manager, super_admin`
- Request: `{ delivery_id, failure_reason }`. Response: `{ delivery: "failed", order: "delivery_failed" }`. Side effects: W13 (reschedule ≤ N / escalate). Events: `borderpass.delivery.failed`. Audit: yes.

**Manage drivers** — `createDriver`/`updateDriver` (SA) · `operations_manager, super_admin`. Audit: yes (staff PII).

### 6.5 Concierge, support, config, audit

**Assign concierge** — `assignConcierge` (SA) · `operations_manager, support_agent, super_admin`. Request `{ customer_id, concierge_staff_id, order_id? }`. Side effects: `ConciergeAssignment`. Audit: yes.

**Send concierge reply** — `sendStaffMessage` (SA) · `concierge, support_agent, super_admin`
- Request: `{ ticket_id?|customer_id, body, ai_drafted?: bool, attachments? }`. Response: `SupportMessage(outbound)`. Validation: sensitive content human-sent; financial/compliance commitments blocked → escalate. Side effects: send via channel; notify. Events: `support.message.sent`. Audit: yes (PII access). Errors: `forbidden`, `approval_required`.

**Manage tickets** — `createTicket`/`updateTicket`/`escalateTicket` (SA) · concierge/support/ops. `escalateTicket` → `escalated_to ∈ {finance,compliance,ops}`. Events: `borderpass.support.escalated`. Audit: yes.

**Manage business rules / templates / flags** — `upsertRuleSet` / `upsertTemplate` / `setFeatureFlag` (SA) · `compliance_admin` (compliance rules), `super_admin` (all) · **elevated**
- Side effects: write versioned rules (rules engine) / templates / flags. Events: `borderpass.config.updated`. Audit: **mandatory** (governance). Errors: `forbidden`.

**Manage roles / permissions** — `assignRole`/`revokeRole` (SA) · `super_admin` only · **elevated (fresh MFA)**. Audit: **mandatory**. Errors: `forbidden`.

**View audit logs** — `GET /api/admin/audit` (RH) · role-scoped (`compliance_admin, super_admin` full; others scoped)
- Query: `?actor=&resource=&order_id=&action=&date_from=&date_to=&cursor=`. Response: `{ data: AuditLog[], next_cursor }` (proxied to platform Audit S7). Audit: the query itself is audited. Errors: `forbidden`.

**View dashboards/analytics** — `GET /api/admin/analytics/{board}` (RH) · role-scoped. Response: KPI tiles/series (PostHog + ledger + ops + AI). Errors: `forbidden`.

---

# 7. Automation API catalog (Deliverables 12–13)

> Base path `/v1/automation/...` (platform API gateway, via `@maralito/sdk`). Callers: BorderPass BFF/workflows + authorized ops tools. Elevated ops (`/override`, effectful `/replay`, publish, rule changes) require **separation of duties + audit**. Full platform reference in Automation `18`.

| Action | Endpoint | Method | Purpose | Role/principal | Request (key) | Response | Events | Audit | Errors |
|--------|----------|--------|---------|----------------|---------------|----------|--------|:--:|--------|
| **Start workflow** | `/v1/automation/runs` | POST | begin a run | service/ops | `{ workflowKey, input, subject{type,id}, idempotencyKey }` | `WorkflowRun` | `workflow.run.started` | yes | `validation_failed`, `conflict_state` (active run exists) |
| **Read workflow run** | `/v1/automation/runs/{id}` | GET | run state | service/ops/support | — | `WorkflowRun` | — | — | `not_found`, `forbidden` |
| ↳ steps / events | `/runs/{id}/steps`, `/runs/{id}/events` | GET | step + event history | same | — | `WorkflowStep[]` / `Event[]` | — | — | `not_found` |
| **Resume / approve / reject step** | `/runs/{id}/signal` | POST | deliver approval/decision/signal to a `waiting` run | approver role | `{ name: "approval.granted"|"approval.rejected"|<signal>, payload }` | `WorkflowRun` | `approval.granted`/`rejected`, `agent.review_completed` | **yes** | `conflict_state`, `forbidden` |
| **Resume stuck run** | `/runs/{id}/resume` | POST | continue from checkpoint | ops | `{}` | `WorkflowRun` | `workflow.run.*` | yes | `conflict_state` |
| **Retry failed step** | `/runs/{id}/retry-step` | POST | re-run a failed step | ops | `{ stepId? }` | `WorkflowRun` | `workflow.step.*` | yes | `conflict_state` |
| **Cancel + compensate** | `/runs/{id}/cancel` | POST | abort + saga rollback | ops/super_admin | `{ reason }` | `WorkflowRun(rolled_back)` | `workflow.compensation.started`, `workflow.run.rolled_back` | **yes** | `conflict_state` |
| **Replay** | `/runs/{id}/replay` | POST | replay run | ops/super_admin (**effectful = elevated**) | `{ mode: "read_only"\|"effectful" }` | `WorkflowRun` | per mode | **yes** | `forbidden` |
| **Override step** | `/runs/{id}/override` | POST | force a step outcome | super_admin (**elevated, fresh MFA**) | `{ stepId, outcome, reason }` | `WorkflowRun` | `workflow.step.*` | **mandatory** | `forbidden` |
| **Emit event** | `/v1/automation/events` | POST | publish a domain event | service principal | `Event envelope` | `{ event_id }` | (the event) | yes | `validation_failed` |
| ↳ query events | `/v1/automation/events` | GET | by correlation/subject/type | service/ops | `?correlation_id=&type=&subject_id=` | `Event[]` | — | — | `forbidden` |
| **Approve / reject (approvals API)** | `/v1/automation/approvals/{id}/decision` | POST | decide an approval | approver role | `{ decision: "approve"\|"reject"\|"request_changes", comment }` | `Approval` | `approval.*` | **mandatory** | `forbidden`, `conflict_state` |
| ↳ comment / reassign / escalate | `/approvals/{id}/comment`, `/reassign`, `/escalate` | POST | manage approval | approver/ops | `{ … }` | `Approval` | `approval.*` | yes | `forbidden` |
| **Run agent** | `/v1/automation/agents/{key}/run` | POST | invoke an agent (as a step) | service principal | `{ input, subject, autonomy? }` | `AgentRun` | `agent.run.started` | yes | `validation_failed` |
| **Read agent run / log** | `/v1/automation/agent-runs/{id}` (+ `/steps`) | GET | **the agent action log** | service/ops | — | `AgentRun` / `AgentStep[]` | — | — | `not_found` |
| **DLQ** | `/v1/automation/dlq`, `/dlq/{id}/replay`, `/dlq/{id}/discard` | GET/POST | dead-letter mgmt | ops/super_admin | `{}` | `DlqItem[]` | — | yes | `forbidden` |
| **Tasks** | `/v1/automation/tasks` (+ `/{id}/assign\|claim\|start\|complete\|block\|cancel\|escalate`) | POST/GET | ops queue work | ops/role | `{ … }` | `Task` | `task.*` | yes | `forbidden` |
| **Rules eval** | `/v1/automation/rule-sets/{key}/evaluate` | POST | evaluate a rule set | service | `{ context }` | `{ matched_rules, outcome }` | — | yes (decision) | `validation_failed` |
| **Schedules** | `/v1/automation/schedules` (+ `/pause\|resume\|run-now`) | POST | manage schedules (e.g. quote-expiry) | ops/super_admin | `{ cron\|run_at, target_workflow_key }` | `Schedule` | — | yes | `forbidden` |

> **"Log agent action"** (task requirement): there is no separate logging endpoint — the orchestrator writes `AgentRun`/`AgentStep` as the action log; read them via `/agent-runs/{id}`. **"Approve/reject workflow step"** = `POST /runs/{id}/signal` with `approval.granted/rejected` (or the approvals API). **"Retry failed workflow"** = `/retry-step` or `/resume`.

---

# 8. Endpoint → audit & event quick index

| Group | Always audited | Notable events emitted |
|-------|----------------|------------------------|
| Customer mutations | submit, cancel, refund, pay, profile/PII, file attach | `order.*`, `quote.accepted`, `payment.intent_created`, `refund.requested`, `support.*` |
| Admin risk/finance/compliance | **all** (mandatory on HUMAN-APPROVAL) | `order.risk_assessed/rejected`, `quote.sent`, `refund.processed`, `border_documentation_ready` |
| Hub/inspection/delivery | submit inspection, mark received, complete/fail delivery | `package.received`, `inspection.*`, `delivery.*` |
| Automation control | signal/override/replay/cancel/rule changes | `workflow.*`, `approval.*`, `agent.review_completed` |
| Webhooks | provider receipt + normalization | `payment.*`, `notification.*`, inbound `support.message` |

---

*Satisfies Deliverables 12–14, 18–19. Event payloads in `03-event-contracts.md`; transitions/guards in `04-state-machines.md`; role definitions and data-access scopes in `05-access-control-and-data-requirements.md`.*
