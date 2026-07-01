# BorderPass — Data Model Contract

> **Deliverables:** 3 (entity defs), 4 (field-level), 5 (required), 6 (optional), 7 (sensitive), 8 (retention), 9 (indexing), 10 (RLS).
> RBAC/role-based data access detail lives in [`05-access-control-and-data-requirements.md`](./05-access-control-and-data-requirements.md). Global conventions (IDs, money, time, sensitivity classes) are in [`00-README.md`](./00-README.md) §3.

## How to read this file

Each entity has: a one-line purpose, an ownership tag, a **field table**, **required vs optional**, **sensitive fields**, **retention**, **indexing**, and **RLS**. Field tables use these columns:

- **Req** — `R` required (NOT NULL at create), `O` optional/nullable, `S` system-set (server-assigned, not client-writable), `D` derived/projection.
- **Class** — sensitivity class (Public/Internal/Confidential/Restricted). `🔒` = field-level KMS encryption.
- **Type** — contract type, not a SQL type. `Money = { amount_minor:int, currency }`.

Enum values are **canonical strings** — implement exactly as written.

> **Boundary rule:** platform-owned entities (User, Organization, Role, Permission, Payment, Refund, Notification, AuditLog, AgentRun, WorkflowRun, EventLog, WebhookEvent) are documented here as **reference contracts** — BorderPass stores only the id and resolves the rest via `@maralito/sdk`. Their full schema is owned by the platform.

---

# A. Platform-owned reference entities

These are **not** BorderPass tables. BorderPass stores the id and the minimal denormalized fields noted, and resolves the rest through the SDK. Documented so implementers know the shape they reference.

## A1. User  *(Platform · Identity)*
One human identity across all Maralito apps. `customer`/`staff`/`admin` are **roles**, not separate identity records.

| Field | Req | Class | Type | Notes |
|------|-----|-------|------|------|
| `id` | S | Restricted | `usr_…` | PK |
| `org_id` | S | Internal | `org_…` | Primary org membership; tenant key |
| `phone` | R | Restricted 🔒 | E.164 string | Verified; primary credential (OTP) |
| `email` | O | Restricted 🔒 | string | Optional |
| `status` | S | Internal | `active \| suspended \| deleted` | |
| `auth_methods` | S | Restricted | string[] | `amr` claim (otp, mfa…) |
| `created_at` | S | Internal | timestamp | |

**Retention:** life of account + legal minimum; deletable on request (subject to legal hold). **BorderPass never stores credentials.**

## A2. Organization  *(Platform · Identity)*
Tenant boundary. `org_id` is the RLS key on every BorderPass row.

| Field | Req | Class | Type | Notes |
|------|-----|-------|------|------|
| `id` | S | Internal | `org_…` | PK |
| `name` | R | Internal | string | |
| `type` | S | Internal | `customer_tenant \| internal` | Maralito-internal orgs hold cross-org admins |
| `status` | S | Internal | `active \| suspended` | |

## A3. Role  /  A4. Permission  *(Platform · RBAC)*
- **Role**: `{ key, app_id, scope, name }`. BorderPass app-scoped role keys: `customer, concierge, inspector, driver, operations_manager, finance_admin, compliance_admin, support_agent, super_admin` (+ platform system roles). `agent` is a **principal type**, not a role.
- **Permission**: string `resource.action[.qualifier]` (e.g. `order.approve`, `refund.create`, `inspection.submit`, `borderdocs.approve`, `files.read`, `ai.agent.run`). Roles map to permission sets. Full matrix in `05-…` §RBAC.

## A5. Payment  *(Platform · Payments → Stripe)*
Append-only ledger is the financial system of record. **No raw card data — Stripe references only.**

| Field | Req | Class | Type | Notes |
|------|-----|-------|------|------|
| `id` | S | Restricted | `pay_…` | PK |
| `org_id` | S | Internal | `org_…` | |
| `order_id` | R | Confidential | `ord_…` | BorderPass subject (ref) |
| `quote_id` | R | Confidential | `qte_…` | **Idempotency key for payment intent** |
| `stripe_payment_intent_id` | S | Restricted | string | |
| `type` | R | Confidential | `service_charge \| duty_charge \| refund` | |
| `amount` | R | Confidential | Money | |
| `status` | S | Confidential | `requires_payment \| processing \| succeeded \| failed \| canceled \| refunded \| partially_refunded` | Stripe-driven |
| `ledger_entry_id` | S | Confidential | string | Append-only ledger ref |
| `created_at` | S | Confidential | timestamp | |

**Retention:** financial/tax retention `⚠️ VERIFY` (longer than order life).

## A6. Refund  *(Platform · Payments → Stripe)*
| Field | Req | Class | Type | Notes |
|------|-----|-------|------|------|
| `id` | S | Restricted | `ref_…` | PK |
| `payment_id` | R | Confidential | `pay_…` | Parent charge |
| `order_id` | R | Confidential | `ord_…` | |
| `amount` | R | Confidential | Money | ≤ refundable balance |
| `reason` | R | Confidential | `requested_by_customer \| inspection_failed \| undeliverable \| duplicate \| fraud \| service_failure \| goodwill` | |
| `status` | S | Confidential | `pending \| requires_approval \| approved \| processing \| succeeded \| failed \| rejected` | |
| `approved_by` | S | Restricted | `usr_…` | finance_admin; **≠ requester** (separation of duties) |
| `idempotency_key` | S | Confidential | string | **Never double-refund** |
| `created_at` | S | Confidential | timestamp | |

**Retention:** financial/tax `⚠️ VERIFY`.

## A7. Notification  *(Platform · Notifications)*  — see `04-state-machines.md` notification matrix.
`{ id: ntf_…, org_id, recipient_user_id, order_id?, channel: email|sms|whatsapp|in_app|push, template_key, template_version, locale: en|es, status: queued|sent|delivered|opened|clicked|failed|bounced, idempotency_key (= run+step+recipient), deep_link, sent_at, … }`. **Retention:** medium-term.

## A8. AuditLog  *(Platform · Audit)* — see `05-…` Audit-log contract.
Append-only, hash-chained, immutable. `{ id: aud_…, org_id, app_id, actor{type,id}, action, resource{type,id}, before_hash, after_hash, justification?, correlation_id, trace_id, occurred_at }`. **Retention:** long (compliance) `⚠️ VERIFY`.

## A9. AgentRun  *(Platform · Automation/AI)* — see `03-event-contracts.md` Agent-run contract.
`{ id: agr_…, org_id, agent_key, agent_version, run_id (workflow), step_id, order_id (subject), status: running|completed|failed|awaiting_approval, input, output, verdict, confidence, tokens_in, tokens_out, cost_usd, latency_ms, trace_id, correlation_id, started_at, ended_at }`. **Retention:** medium (eval/audit).

## A10. WorkflowRun  *(Platform · Automation)* — see `03-event-contracts.md` Workflow-run contract.
`{ id: wfr_…, org_id, app_id, definition_key, definition_version, subject{type:order,id}, correlation_id, trace_id, current_step, status: pending|running|waiting|escalated|compensating|completed|failed|rolled_back, input, state, error?, started_at, updated_at, ended_at }`. **Retention:** medium.

## A11. EventLog  *(Platform · Automation)*
Persistence projection of the event bus (flattened envelope). `{ id: evt_…, type, version, source, org_id, app_id, subject_type, subject_id, actor_type, actor_id, data, correlation_id, causation_id, trace_id, idempotency_key, sequence, occurred_at, received_at }`. Append-only. **Retention:** medium; correlation-queryable for replay.

## A12. WebhookEvent  *(Platform · Automation)*
Inbound provider webhook record (Stripe/Twilio/WhatsApp/Resend) before normalization. `{ id: whk_…, provider: stripe|twilio|whatsapp|resend, provider_event_id (dedupe key), signature_verified: bool, payload, normalized_event_id?: evt_…, status: received|verified|normalized|rejected|duplicate, received_at }`. **Dedupe by `provider_event_id`.** **Retention:** medium.

---

# B. BorderPass-owned domain entities

All carry implicit system columns unless noted: `id` (S, PK), `org_id` (S, Internal, RLS key), `app_id = "borderpass"` (S), `created_at` (S), `updated_at` (S). RLS = `org_id = current_setting('app.org_id')` on every table.

## B1. CustomerProfile
**Purpose:** BorderPass-side profile for a customer `User`. **Owner:** BorderPass. 1-1 with `User`.

| Field | Req | Class | Type | Notes |
|------|-----|-------|------|------|
| `id` | S | Internal | `cust_…` | PK |
| `user_id` | R | Restricted | `usr_…` | Ref to platform User (unique) |
| `display_name` | R | Restricted 🔒 | string | |
| `language` | R | Internal | `en \| es` | Drives notification locale |
| `notification_prefs` | O | Internal | `{ channels: string[], quiet_hours?: {start,end,tz}, frequency_cap? }` | |
| `rfc` | O | Restricted 🔒 | string | Mexican tax ID; required for business/commercial (see `04` business rules) |
| `kyc_status` | S | Restricted 🔒 | `none \| pending \| verified \| rejected` | |
| `kyc_level` | S | Restricted 🔒 | `none \| basic \| enhanced` | |
| `default_delivery_address_id` | O | Restricted | `addr_…` | |
| `default_hub_address_id` | O | Restricted | `addr_…` | El Paso hub |
| `loyalty_tier` | O | Internal | string | Future |
| `flags` | S | Internal | string[] | e.g. `abuse_review`, `fraud_hold` |

**Required:** `user_id`, `display_name`, `language`. **Optional:** `rfc`, addresses, prefs, loyalty. **Sensitive:** `display_name`, `rfc`, `kyc_*` (Restricted 🔒). **Retention:** life of account + legal min; deletable on request. **Indexing:** unique(`user_id`); `org_id`. **RLS:** by `org_id`; a customer sees only their own row (`user_id = session.sub`).

## B2. StaffProfile
**Purpose:** BorderPass-side profile for a staff `User` (concierge, inspector, driver, ops, finance, compliance, support, admin). **Owner:** BorderPass. 1-1 with `User`.

| Field | Req | Class | Type | Notes |
|------|-----|-------|------|------|
| `id` | S | Internal | `staff_…` | PK |
| `user_id` | R | Restricted | `usr_…` | unique |
| `display_name` | R | Confidential 🔒 | string | |
| `role_keys` | S | Internal | string[] | Mirror of platform role assignment (cache) |
| `photo_file_id` | O | Internal | `file_…` | Public-facing for concierge |
| `languages` | O | Internal | (`en\|es`)[] | |
| `rating_avg` | D | Internal | decimal | Concierge/driver rating projection |
| `status` | S | Internal | `active \| inactive \| on_leave` | |

**Required:** `user_id`, `display_name`. **Sensitive:** `display_name` (staff PII). **Retention:** employment + legal. **Indexing:** unique(`user_id`); `org_id`, `status`. **RLS:** by `org_id`; staff visibility per role.

## B3. Address
**Purpose:** Customer addresses (Juárez delivery, El Paso hub, business). **Owner:** BorderPass.

| Field | Req | Class | Type | Notes |
|------|-----|-------|------|------|
| `id` | S | Restricted | `addr_…` | PK |
| `customer_id` | R | Restricted | `cust_…` | |
| `type` | R | Internal | `delivery_juarez \| hub_el_paso \| business` | |
| `line1` | R | Restricted 🔒 | string | |
| `line2` | O | Restricted 🔒 | string | |
| `city` | R | Restricted 🔒 | string | |
| `region` | R | Restricted 🔒 | string | State/colonia |
| `postal_code` | R | Restricted 🔒 | string | |
| `country` | R | Internal | `MX \| US` | |
| `contact_name` | O | Restricted 🔒 | string | |
| `contact_phone` | O | Restricted 🔒 | E.164 | |
| `geo` | O | Restricted | `{ lat, lng }` | Optional geocode |
| `is_default` | O | Internal | bool | |

**Required:** `customer_id`, `type`, `line1`, `city`, `region`, `postal_code`, `country`. **Sensitive:** address lines, contact, geo (Restricted 🔒 — PII/location). **Retention:** life of account. **Indexing:** `customer_id`, (`customer_id`,`type`). **RLS:** by `org_id`; owner-only for customers.

## B4. Order  *(aggregate root)*
**Purpose:** A border-crossing request and its lifecycle. **Owner:** BorderPass.

| Field | Req | Class | Type | Notes |
|------|-----|-------|------|------|
| `id` | S | Confidential | `ord_…` | PK |
| `order_ref` | S | Confidential | `BP-####` | Human-facing |
| `customer_id` | R | Confidential | `cust_…` | |
| `service_type` | R | Confidential | `buy_for_me \| package_reception \| local_pickup \| business_delivery` | See `00` open-item #2 |
| `status` | S | Confidential | OrderStatus enum (25 values — see `04-state-machines.md`) | Current state; mutated only via transitions |
| `purpose` | O | Confidential | `personal \| gift \| business \| resale` | |
| `declared_value` | O | Confidential | Money | Customer-declared |
| `rfc` | O | Restricted 🔒 | string | Snapshot if business/commercial |
| `risk_band` | S | Restricted | `LOW \| MEDIUM \| HIGH \| BLOCK` | Set by Risk review |
| `current_quote_id` | S | Confidential | `qte_…` | 1-1 current |
| `payment_id` | S | Confidential | `pay_…` | Ref (platform) |
| `delivery_address_id` | O | Restricted | `addr_…` | |
| `hub_address_id` | O | Restricted | `addr_…` | |
| `correlation_id` | S | Internal | = `id` | Journey correlation |
| `workflow_run_id` | S | Internal | `wfr_…` | Active driving run (ref) |
| `submitted_at` | S | Confidential | timestamp | |
| `cancelled_reason` | O | Confidential | string | |

**Required (at create/draft):** `customer_id`, `service_type`. **Required (at submit):** + ≥1 `OrderItem`, `purpose`, `declared_value`, addresses per service type, `rfc` if business/commercial. **Sensitive:** `rfc` (🔒), `risk_band`, embedded PII via relations. **Retention:** order life + financial/tax min `⚠️ VERIFY`; status changes never deleted (history via events/audit). **Indexing:** unique(`order_ref`); `customer_id`; `status`; (`org_id`,`status`,`created_at`) for queues; `correlation_id`; `risk_band` (compliance queue). **RLS:** by `org_id`; customer sees own; staff queues filtered by role scope.

## B5. OrderItem
**Purpose:** A line item in an order (what is being bought/shipped). **Owner:** BorderPass.

| Field | Req | Class | Type | Notes |
|------|-----|-------|------|------|
| `id` | S | Internal | `itm_…` | PK |
| `order_id` | R | Confidential | `ord_…` | |
| `description` | R | Confidential | string | |
| `product_url` | O | Internal | url | Buy-for-me |
| `quantity` | R | Internal | int ≥1 | |
| `variant` | O | Internal | string | Size/color |
| `unit_value` | R | Confidential | Money | Per-unit declared/resolved |
| `category` | O | Confidential | string | Maps to rules engine category |
| `restriction_flags` | S | Restricted | string[] | From Risk/Intake agent (e.g. `regulated_electronics`) |
| `resolved_price` | S | Confidential | Money | Shopping agent (V1) |
| `availability` | S | Internal | `unknown \| in_stock \| oos` | Shopping agent |

**Required:** `order_id`, `description`, `quantity`, `unit_value`. **Sensitive:** `restriction_flags` (compliance). **Retention:** with Order. **Indexing:** `order_id`. **RLS:** via `order_id`/`org_id`.

## B6. Package
**Purpose:** A physical parcel received at the El Paso hub for an order. **Owner:** BorderPass.

| Field | Req | Class | Type | Notes |
|------|-----|-------|------|------|
| `id` | S | Internal | `pkg_…` | PK |
| `order_id` | R | Confidential | `ord_…` | |
| `status` | S | Internal | `expected \| received \| staged \| inspecting \| sealed \| staged_for_crossing \| crossed \| in_juarez \| released` | Package-level enum (see `04`) |
| `tracking_number` | O | Internal | string | Inbound carrier |
| `carrier` | O | Internal | string | |
| `weight_grams` | O | Internal | int | |
| `dims_mm` | O | Internal | `{ l, w, h }` | |
| `seal_number` | O | Internal | string | Set at inspection seal |
| `hub_location` | O | Internal | string | Bin/shelf |
| `received_at` | S | Internal | timestamp | Scan time |
| `matched_by` | S | Internal | `agent \| staff` | W8 match |

**Required:** `order_id`. **Retention:** order life. **Indexing:** `order_id`; (`org_id`,`status`) for hub queue; `tracking_number`. **RLS:** via `org_id`.

## B7. Quote
**Purpose:** A versioned price quote for an order. **Owner:** BorderPass.

| Field | Req | Class | Type | Notes |
|------|-----|-------|------|------|
| `id` | S | Confidential | `qte_…` | PK |
| `order_id` | R | Confidential | `ord_…` | |
| `version` | S | Confidential | int | Incrementing per order |
| `status` | S | Confidential | `draft \| pending_approval \| approved \| sent \| accepted \| declined \| expired \| superseded` | See `04` |
| `currency` | R | Confidential | `USD \| MXN` | |
| `service_fee` | R | Confidential | Money | Stitch base ~$15 `⚠️ VERIFY` |
| `item_value_total` | R | Confidential | Money | Sum of line items |
| `estimated_duties` | R | Confidential | Money | Duty estimate `⚠️ VERIFY` basis |
| `taxes` | O | Confidential | Money | |
| `total` | R | Confidential | Money | Sum |
| `duty_basis` | S | Confidential | string | Rule explanation/citation |
| `rule_version` | S | Confidential | string | Rules-engine version used |
| `confidence` | S | Internal | decimal | Quote agent |
| `approved_by` | S | Restricted | `usr_…` | finance_admin (HUMAN-APPROVAL) |
| `expires_at` | S | Confidential | timestamp | `⚠️ VERIFY` window (e.g. 48–72h) |
| `pdf_file_id` | S | Confidential | `file_…` | Generated quote PDF |

**Required:** `order_id`, `currency`, `service_fee`, `item_value_total`, `estimated_duties`, `total`. **Sensitive:** all financial (Confidential). **Retention:** order life + financial. **Indexing:** (`order_id`,`version`); (`org_id`,`status`) finance queue; `expires_at` (expiry sweep). **RLS:** via `org_id`.

## B8. QuoteLineItem
**Purpose:** Itemized breakdown of a quote (maps to order items + fees/duties). **Owner:** BorderPass.

| Field | Req | Class | Type | Notes |
|------|-----|-------|------|------|
| `id` | S | Confidential | `qli_…` | PK |
| `quote_id` | R | Confidential | `qte_…` | |
| `order_item_id` | O | Confidential | `itm_…` | Null for fee/duty lines |
| `kind` | R | Confidential | `item_value \| service_fee \| duty \| tax \| discount \| adjustment` | |
| `label` | R | Confidential | string | Display label (EN/ES) |
| `amount` | R | Confidential | Money | |
| `meta` | O | Confidential | object | Duty rate/basis for `duty` lines |

**Required:** `quote_id`, `kind`, `label`, `amount`. **Retention:** with Quote. **Indexing:** `quote_id`. **RLS:** via `org_id`.

## B9. Document
**Purpose:** Compliance/customs documents for an order (commercial invoice, customs declaration, manifest, permit). **Owner:** BorderPass (blob in Files).

| Field | Req | Class | Type | Notes |
|------|-----|-------|------|------|
| `id` | S | Restricted | `doc_…` | PK |
| `order_id` | R | Restricted | `ord_…` | |
| `type` | R | Restricted | `commercial_invoice \| customs_declaration \| manifest \| permit \| other` | |
| `file_id` | R | Restricted | `file_…` | Files service ref |
| `status` | S | Restricted | `draft \| pending_approval \| approved \| rejected` | |
| `approved_by` | S | Restricted | `usr_…` | compliance_admin (HUMAN-APPROVAL) |
| `generated_by` | S | Internal | `agent \| staff` | Border Journey agent drafts |

**Required:** `order_id`, `type`, `file_id`. **Sensitive:** all (Restricted — compliance). **Retention:** customs retention `⚠️ VERIFY` (long). **Indexing:** `order_id`; (`org_id`,`type`,`status`). **RLS:** via `org_id`; compliance/ops scope.

## B10. Receipt
**Purpose:** Customer-uploaded purchase proof and BorderPass-issued receipts/invoices. **Owner:** BorderPass row referencing Files + Payments.

| Field | Req | Class | Type | Notes |
|------|-----|-------|------|------|
| `id` | S | Confidential | `rcpt_…` | PK |
| `order_id` | R | Confidential | `ord_…` | |
| `type` | R | Confidential | `customer_upload \| purchase_proof \| issued_invoice` | |
| `file_id` | R | Confidential | `file_…` | |
| `payment_id` | O | Confidential | `pay_…` | For issued invoices |
| `ocr_data` | S | Restricted 🔒 | object | OCR (amount, merchant, RFC) |
| `amount` | O | Confidential | Money | Parsed/declared |
| `rfc` | O | Restricted 🔒 | string | On issued invoice |

**Required:** `order_id`, `type`, `file_id`. **Sensitive:** `ocr_data`, `rfc` (🔒). **Retention:** financial/tax `⚠️ VERIFY`. **Indexing:** `order_id`; (`org_id`,`type`). **RLS:** via `org_id`; owner + finance.

## B11. Inspection
**Purpose:** Hub inspection record for a package. **Owner:** BorderPass. 1-1 with Package.

| Field | Req | Class | Type | Notes |
|------|-----|-------|------|------|
| `id` | S | Confidential | `insp_…` | PK |
| `order_id` | R | Confidential | `ord_…` | |
| `package_id` | R | Confidential | `pkg_…` | unique |
| `inspector_id` | S | Confidential | `usr_…` | Assigned inspector |
| `status` | S | Confidential | `pending \| in_progress \| passed \| failed \| under_compliance_review` | See `04` |
| `checklist` | O | Confidential | `{ key: string, ok: bool, note? }[]` | |
| `serial_number` | O | Restricted | string | OCR-captured |
| `serial_match` | O | Confidential | bool | vs declared |
| `seal_number` | O | Internal | string | Applied seal |
| `condition` | O | Confidential | `good \| minor_damage \| major_damage` | |
| `ai_risk_score` | S | Restricted | decimal | Inspection Assistant |
| `discrepancy_flags` | S | Restricted | string[] | wrong_item, prohibited, tamper, receipt_mismatch |
| `outcome` | S | Confidential | `passed \| failed` | Final (mirrors status) |
| `resolution` | O | Confidential | `refund \| return \| replace \| proceed` | On fail (HUMAN-APPROVAL) |
| `notes` | O | Confidential | string | |
| `inspected_at` | S | Confidential | timestamp | |

**Required:** `order_id`, `package_id`. **Sensitive:** `serial_number`, `ai_risk_score`, `discrepancy_flags` (Restricted). **Retention:** order life + dispute window. **Indexing:** unique(`package_id`); `order_id`; (`org_id`,`status`) inspection queue. **RLS:** via `org_id`; inspector/ops/compliance scope.

## B12. InspectionPhoto
**Purpose:** Evidence photos for an inspection (customer-visible "View Photos"). **Owner:** BorderPass row referencing Files.

| Field | Req | Class | Type | Notes |
|------|-----|-------|------|------|
| `id` | S | Confidential | `iph_…` | PK |
| `inspection_id` | R | Confidential | `insp_…` | |
| `order_id` | R | Confidential | `ord_…` | Denormalized for ACL/query |
| `file_id` | R | Confidential | `file_…` | Object-level ACL; signed view URL |
| `kind` | O | Internal | `overview \| serial \| seal \| damage \| contents` | |
| `caption` | O | Internal | string | EN/ES |
| `sort_order` | O | Internal | int | |

**Required:** `inspection_id`, `order_id`, `file_id`. **Sensitive:** image content (Confidential); **shown to owning customer only** via permission-checked signed URL. **Retention:** order life + dispute window. **Indexing:** `inspection_id`; `order_id` (append-only; partition-friendly). **RLS:** via `org_id`; owner customer + inspection staff.

## B13. RiskReview
**Purpose:** Compliance/risk assessment of an order. **Owner:** BorderPass. 1-1 with Order.

| Field | Req | Class | Type | Notes |
|------|-----|-------|------|------|
| `id` | S | Restricted | `risk_…` | PK |
| `order_id` | R | Restricted | `ord_…` | unique |
| `risk_band` | S | Restricted | `LOW \| MEDIUM \| HIGH \| BLOCK` | Set on Order too |
| `matched_rules` | S | Restricted | `{ rule_key, version, outcome }[]` | Rules engine result |
| `ai_rationale` | S | Restricted | string | Risk agent narrative |
| `confidence` | S | Internal | decimal | |
| `agent_run_id` | S | Internal | `agr_…` | Ref |
| `decision` | S | Restricted | `pending \| approve \| reject \| hold` | HUMAN-APPROVAL |
| `reviewer_id` | S | Restricted | `usr_…` | compliance_admin |
| `decision_reason` | O | Restricted | string | |
| `decided_at` | S | Restricted | timestamp | |

**Required:** `order_id`. **Sensitive:** all (Restricted — compliance). **Retention:** long (compliance) `⚠️ VERIFY`. **Indexing:** unique(`order_id`); (`org_id`,`risk_band`,`decision`) compliance queue. **RLS:** via `org_id`; compliance scope.

## B14. Delivery
**Purpose:** Last-mile delivery of an order to Juárez (1 active per order). **Owner:** BorderPass.

| Field | Req | Class | Type | Notes |
|------|-----|-------|------|------|
| `id` | S | Confidential | `dlv_…` | PK |
| `order_id` | R | Confidential | `ord_…` | |
| `driver_id` | O | Confidential | `drv_…` | Assigned |
| `address_id` | R | Restricted | `addr_…` | Juárez delivery |
| `mode` | R | Internal | `own_fleet \| carrier` | |
| `status` | S | Internal | `pending \| assigned \| out_for_delivery \| delivered \| failed \| returned \| canceled` | See `04` |
| `attempts` | S | Internal | int | Failed-attempt counter |
| `window` | O | Internal | `{ start, end }` | Promised window |
| `proof_file_id` | O | Confidential | `file_…` | Photo/signature POD |
| `failure_reason` | O | Confidential | string | |
| `delivered_at` | S | Confidential | timestamp | |

**Required:** `order_id`, `address_id`, `mode`. **Sensitive:** `address_id`, `proof_file_id` (PII/location/proof). **Retention:** order life. **Indexing:** `order_id`; (`org_id`,`status`); (`driver_id`,`status`) driver queue; zone (via address). **RLS:** via `org_id`; driver sees only assigned tasks.

## B15. Driver
**Purpose:** Delivery driver/courier. **Owner:** BorderPass.

| Field | Req | Class | Type | Notes |
|------|-----|-------|------|------|
| `id` | S | Restricted | `drv_…` | PK |
| `user_id` | O | Restricted | `usr_…` | If platform user |
| `staff_profile_id` | O | Internal | `staff_…` | |
| `name` | R | Restricted 🔒 | string | |
| `contact_phone` | R | Restricted 🔒 | E.164 | |
| `zones` | R | Internal | string[] | Juárez delivery zones |
| `availability` | S | Internal | `available \| busy \| offline` | |
| `vehicle` | O | Internal | object | |
| `status` | S | Internal | `active \| inactive` | |
| `performance` | D | Internal | `{ success_rate, on_time_rate, rating }` | Projection |

**Required:** `name`, `contact_phone`, `zones`. **Sensitive:** `name`, `contact_phone` (staff PII 🔒). **Retention:** employment + legal. **Indexing:** (`org_id`,`status`,`availability`); zones. **RLS:** via `org_id`; ops scope.

## B16. ConciergeAssignment
**Purpose:** Maps a concierge (staff) to a customer/order for relationship continuity. **Owner:** BorderPass.

| Field | Req | Class | Type | Notes |
|------|-----|-------|------|------|
| `id` | S | Internal | `cona_…` | PK |
| `customer_id` | R | Confidential | `cust_…` | |
| `concierge_staff_id` | R | Internal | `staff_…` | |
| `order_id` | O | Confidential | `ord_…` | Optional per-order assignment |
| `status` | S | Internal | `active \| ended` | |
| `assigned_at` | S | Internal | timestamp | |

**Required:** `customer_id`, `concierge_staff_id`. **Retention:** medium. **Indexing:** `customer_id`; `concierge_staff_id`; `order_id`. **RLS:** via `org_id`; concierge/support scope.

## B17. SupportTicket
**Purpose:** A support case (broader than chat) for a customer/order. **Owner:** BorderPass.

| Field | Req | Class | Type | Notes |
|------|-----|-------|------|------|
| `id` | S | Confidential | `tkt_…` | PK |
| `customer_id` | R | Confidential | `cust_…` | |
| `order_id` | O | Confidential | `ord_…` | |
| `category` | R | Confidential | `general \| order_status \| quote \| payment \| refund \| compliance \| customs_hold \| lost_damaged \| delivery \| fraud` | Routing |
| `severity` | S | Confidential | `low \| normal \| high \| critical` | |
| `status` | S | Confidential | `open \| pending_customer \| escalated \| resolved \| closed \| reopened` | See `04` |
| `assignee_id` | O | Internal | `usr_…` | concierge/support/specialist |
| `escalated_to` | O | Internal | `finance \| compliance \| ops` | |
| `sla_due_at` | S | Internal | timestamp | |
| `resolution` | O | Confidential | string | |
| `satisfaction` | O | Internal | int 1–5 | CSAT |

**Required:** `customer_id`, `category`. **Sensitive:** message content via relation (PII). **Retention:** medium. **Indexing:** (`org_id`,`status`,`severity`); `customer_id`; `order_id`; `category` (specialist queues); `sla_due_at`. **RLS:** via `org_id`; support/concierge scope; PII reads audited.

## B18. SupportMessage
**Purpose:** A single message in a support/concierge thread (in-app or WhatsApp). **Owner:** BorderPass.

| Field | Req | Class | Type | Notes |
|------|-----|-------|------|------|
| `id` | S | Confidential | `msg_…` | PK |
| `ticket_id` | O | Confidential | `tkt_…` | Null for pure concierge chat |
| `customer_id` | R | Confidential | `cust_…` | Thread participant |
| `order_id` | O | Confidential | `ord_…` | Context |
| `direction` | R | Internal | `inbound \| outbound` | |
| `channel` | R | Internal | `in_app \| whatsapp \| sms \| email` | |
| `sender_type` | R | Internal | `customer \| staff \| agent \| system` | |
| `sender_id` | O | Internal | `usr_…` | |
| `body` | R | Confidential 🔒 | string | Message text |
| `ai_drafted` | S | Internal | bool | True if drafted by Support agent (human-sent) |
| `attachments` | O | Confidential | `file_…`[] | |
| `delivered_status` | S | Internal | `queued \| sent \| delivered \| read \| failed` | Channel delivery |
| `sent_at` | S | Confidential | timestamp | |

**Required:** `customer_id`, `direction`, `channel`, `sender_type`, `body`. **Sensitive:** `body`, attachments (Confidential 🔒). **Retention:** medium. **Indexing:** `ticket_id`; (`customer_id`,`sent_at`); `order_id`. **RLS:** via `org_id`; participants + support/concierge scope.

---

# C. Cross-cutting data rules

- **Mutation discipline:** `Order.status` and other lifecycle statuses change **only via workflow transitions** (never ad-hoc updates). All writes go through the domain layer; the BFF is the only place tenant context is set.
- **History without status tables:** transition history lives in `WorkflowRun` step history + `AuditLog` + `EventLog`. A **status-history projection** may be added for fast timelines but is rebuildable from events.
- **Projections are rebuildable:** Border Journey (12-stage view), search index, analytics rollups are derived from events, not systems of record.
- **Encryption:** Restricted 🔒 fields use **field-level KMS encryption** on top of TLS-in-transit and encryption-at-rest. Files (receipts, documents, inspection photos, POD) live in the Files store (R2 or Supabase Storage `⚠️ VERIFY`) with **object-level ACL** and time-limited **signed URLs**; BorderPass stores only `file_id`.
- **No raw card data** ever — Stripe references only. KYC prefers metadata over raw documents.
- **Right to erasure / export:** supported, subject to **legal holds** and financial/customs retention overrides.

---

## Indexing summary (Deliverable 9)

| Access pattern | Index |
|----------------|-------|
| Order by ref / customer / status | unique(`order_ref`), `customer_id`, (`org_id`,`status`,`created_at`) |
| Order by correlation / risk | `correlation_id`, (`org_id`,`risk_band`) |
| Hub inspection queue | (`org_id`, `Package.status`), (`org_id`, `Inspection.status`) |
| Delivery dispatch | (`org_id`,`Delivery.status`), (`driver_id`,`status`), zone |
| Risk/compliance queue | (`org_id`,`RiskReview.risk_band`,`decision`) |
| Finance quote/refund queue | (`org_id`,`Quote.status`), `Quote.expires_at`, (`org_id`,`Refund.status`) |
| Support queues | (`org_id`,`SupportTicket.status`,`severity`), `category`, `sla_due_at` |
| Timelines / evidence (append-heavy) | `InspectionPhoto(order_id)`, status/audit history — **partition-friendly** |

All queries are **org-scoped via RLS**; staff queues additionally filter by role-permitted scope (see `05-…`).

---

*Satisfies Deliverables 3–10. RLS/role-based access detail continues in `05-access-control-and-data-requirements.md`. Status enums are specified authoritatively in `04-state-machines.md`.*
