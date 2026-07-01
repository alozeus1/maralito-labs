# BorderPass — Access Control, Audit & Data Requirements

> **Deliverables:** 10 (row-level security), 11 (role-based data access), 19 (validation rules — access angle), 25 (audit-log contract), 28 (admin dashboard data), 29 (customer app data), 30 (reporting/analytics data).
> Source: PRD `11-roles-and-permissions.md`, `16-admin-ops-requirements.md`, `17-metrics-kpis.md`, `05-information-architecture.md`; TAD `06-auth-rbac-security-privacy.md`.

---

# 1. Authorization model (two layers)

Authorization is enforced **twice**, by design:

1. **RBAC (application / BFF):** `can(role, action, ctx)` is checked before any operation. Permissions are strings `resource.action[.qualifier]` (e.g. `order.approve`, `refund.create`, `inspection.submit`, `borderdocs.approve`).
2. **RLS (database):** Postgres RLS enforces `org_id` isolation unconditionally on every BorderPass table. The BFF sets tenant context per request **from the validated token — the only place it is set**. Even an application bug cannot cross tenants.

**Principal types:** customer user, staff user, admin user, API key (per org+app, hashed), service principal (signed internal), **AI agent** (delegated, time-boxed, tool-scoped token ≤ the human it assists). `agent` is a principal type, **not** a role.

**Elevation (Principle P9):** refunds, order rejection, border-doc approval, data export, destructive deletes, manual status overrides, role changes, and **AI agent writes** require: eligible role **+** a contextual condition (fresh MFA / explicit confirmation / human approval) **+** a mandatory audit record. Evaluated centrally as policy. **MFA enforced for admin/compliance/finance roles (V1).**

---

# 2. Roles (9 app-scoped) + agent principal

`customer, concierge, inspector, driver, operations_manager, finance_admin, compliance_admin, support_agent, super_admin` (+ platform system roles; `agent` principal).

| Role | Can do (summary) | Cannot do | Approval authority |
|------|------------------|-----------|--------------------|
| **customer** | self-service over own orders; create/submit; upload; accept/pay quote; chat; cancel/refund request; manage own profile/addresses/payment methods | other customers' data; admin tools; approve own risk/refund; set order status | own quote accept + payment only |
| **concierge** | view assigned/all conversations + order context; send (AI-drafted, human-sent); non-sensitive notes; standard notifications; create tickets; assist intake | approve refunds/compliance; change payment; finalize risky decisions | none (escalate only) |
| **inspector** | inspection queue + assigned packages; capture photos/serial/seal; checklist; pass/flag; notes | pricing, payments, refunds, PII beyond need, compliance final decisions | recommend pass/fail; **fail resolution needs compliance/ops** |
| **driver** | assigned delivery/crossing tasks + addresses; update status; capture POD; report failures | order financials, customer data beyond delivery need, other drivers' tasks | none |
| **operations_manager** | all orders/ops queues; assign inspectors/drivers; receiving/inspection/crossing/delivery; schedules/zones; holds; reassign; trigger ops workflows | final compliance rejection; refund above threshold; role/permission changes | operational (dispatch, reassignment, standard exceptions) |
| **finance_admin** | payments, receipts, reconciliation, disputes; approve quotes/overrides; **approve refunds**; invoices/RFC; financial reporting | compliance category decisions; ops dispatch; role admin; self-approve own-initiated refund | **HUMAN-APPROVAL: quotes (non-standard), refunds, high-value exceptions** |
| **compliance_admin** | risk-review queue (AI band+rationale); approve/reject/hold; classify items; approve border docs; manage prohibited/accepted categories+thresholds; review inspection fails; KYC/RFC | payments/refund execution; ops dispatch; role admin | **HUMAN-APPROVAL: acceptance/rejection, prohibited calls, border docs, inspection-fail compliance** |
| **support_agent** | tickets + queues; order context; coordinate resolutions; standard remedies; escalate | approve refunds/compliance directly; change payments; alter roles | none (route to specialists) |
| **super_admin** | all of the above; manage roles/permissions; business rules, flags, hub/zones; integrations; all audit; settings | still bound by separation of duties + audit; no self-approve own refund | configure approval authorities; emergency override (elevated + audited) |
| **agent** (principal) | delegated tool-scoped actions ≤ the human it assists; **recommend** | hold final authority on risky/compliance/financial decisions | none — always `HUMAN-APPROVAL` for risk |

### Permission matrix (canonical — `✅` full · `↑` escalate · `—` none)

| Action / permission | customer | concierge | inspector | driver | ops_mgr | finance | compliance | support | super_admin |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `order.submit` | ✅(own) | assist | — | — | — | — | — | assist | ✅ |
| `order.approve` / `order.reject` (risk) | — | — | — | — | ↑ | — | ✅ | ↑ | ✅ |
| `quote.approve` / `quote.send` | accept own | — | — | — | — | ✅ | — | — | ✅ |
| `payment.take` | pay own | — | — | — | — | ✅ | — | — | ✅ |
| `refund.create` | request | — | — | — | ↑ | ✅ | risk-related | ↑ | ✅ |
| `inspection.submit` | — | — | ✅ | — | view | — | review | — | ✅ |
| `borderdocs.approve` | — | — | — | — | prep | — | ✅ | — | ✅ |
| `delivery.assign` | — | — | — | — | ✅ | — | — | — | ✅ |
| `delivery.complete` | confirm receipt | — | — | ✅ | view | — | — | — | ✅ |
| `rules.manage` / `roles.manage` | — | — | — | — | — | — | rules (compliance) | — | ✅ |
| `audit.read` | own actions | — | — | — | ops scope | finance scope | ✅ | support scope | ✅ |

---

# 3. Row-level security (Deliverable 10)

- **RLS enabled on every BorderPass table**, policy keyed by `org_id` (+ `app_id`). `org_id` is set per-request by the BFF from the validated token via `set_config('app.org_id', …)` — **never client-supplied**.
- **Customer scope:** customers can read/write only rows linked to their own `user_id`/`customer_id` (owner predicate in addition to `org_id`). Out-of-scope rows return `not_found`, never reveal existence.
- **Staff scope:** staff see org rows **filtered by role-permitted scope** (e.g. driver → only `Delivery` rows where `driver_id = self` and `status ∈ assigned/out_for_delivery`; inspector → assigned packages; finance → financial entities; compliance → risk/compliance entities).
- **Restricted 🔒 fields** (PII/RFC/KYC/financial) are additionally **field-encrypted (KMS)**; decryption is permission-gated and **every staff/agent read is access-audited**.
- **Files** (receipts, documents, inspection photos, POD) carry **object-level ACL**; access is via time-limited **signed URLs** minted only after a permission check (inspection photos → owning customer + inspection staff only).
- **Cross-tenant leakage** is an explicit STRIDE threat-model target with isolation tests in CI.

### Per-entity access scope (summary)

| Entity | Customer | Concierge/Support | Inspector | Driver | Ops | Finance | Compliance |
|--------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| CustomerProfile / Address | own RW | read (audited) | — | delivery contact only | read | billing read | KYC read |
| Order / OrderItem | own R | read | assigned | delivery fields | RW (ops) | financial fields | risk fields |
| Quote / QuoteLineItem | own R | read | — | — | read | RW | — |
| Payment / Refund (ref) | own R | read summary | — | — | read | RW | risk-related |
| Package / Inspection / InspectionPhoto | own R (photos) | read | RW (assigned) | — | read | — | review |
| Document (customs) | own R (some) | — | — | — | prep | — | RW/approve |
| Delivery / Driver | own R (status) | read | — | assigned RW | RW | — | — |
| RiskReview | — | — | — | — | view band | — | RW |
| SupportTicket / SupportMessage | own RW | RW | — | — | read | read | read |

---

# 4. Audit-log contract (Deliverable 25)

Audit lives in the **platform Audit service (S7)** — append-only, immutable, **hash-chained (tamper-evident)**, partitioned, queryable. BorderPass emits to it via the SDK (auto-emitted for sensitive ops so app code can't forget); workflows audit every transition.

### Record shape
```ts
interface AuditLog {
  id: string;                 // aud_…
  org_id: string; app_id: "borderpass";
  actor: { type: "customer"|"staff"|"admin"|"agent"|"system"|"external"; id: string };
  action: string;             // e.g. "order.reject", "refund.process", "pii.read"
  resource: { type: string; id: string };
  before_hash?: string;       // hash of prior state
  after_hash?: string;        // hash of new state
  justification?: string;     // required for elevated actions
  matched_rules?: object;     // for compliance decisions
  correlation_id: string;     // = order_id
  trace_id: string;
  occurred_at: string;        // UTC ISO-8601
  prev_record_hash: string;   // chain link
}
```

### What MUST be audited (mandatory)
- **Every order status transition** (from, to, actor, reason).
- **Every risk / quote / refund / border-doc decision** — actor, decision, reason, matched rules, AI recommendation + confidence + final human decision (for customs/dispute defense).
- **Inspection outcomes** and resolutions.
- **Agent recommendations** and the human decision that resolved them (`agent.review_completed`, including `overridden`).
- **PII / sensitive-data reads** by staff/agents (access logging).
- **All admin actions**; **all authorization denials (403)**; **payments** (mirrored to ledger).
- **Elevated actions** (overrides, effectful replays, rule/role changes) — with `justification`.

### Properties
Immutable (no update/delete); approval history immutable (who/what/when/why/comment); queryable by `actor` / `order_id` (correlation) / `trace_id` / `action` / time range; retention **long (compliance) `⚠️ VERIFY`**, overrides erasure requests under legal hold.

---

# 5. Admin dashboard data requirements (Deliverable 28)

Eight back-office surfaces (PRD 16). Admin nav: `Dashboard · Orders · Customers · Quotes · Payments · Refunds · Risk Reviews · Inspections · Deliveries · Drivers · Concierge Workspace · Support Tickets · Notifications · Analytics · Audit Logs · Settings`. All RBAC+RLS scoped; PII reads audited; powerful actions elevated; real-time updates; deep-linkable; every alert links a runbook.

| Surface | Roles | Data needed | Actions | Filters | Alerts |
|---------|-------|-------------|---------|---------|--------|
| **Operations Dashboard** | ops_mgr, super_admin | active orders by stage; hub on-hand/staged; customs queue; driver/inspector availability; SLA timers; KPIs | assign inspectors/drivers, advance/hold, resolve exceptions, trigger workflows, reassign, escalate | status, service_type, risk_band, date, hub, zone, customer, order_id | stuck runs, SLA breaches, customs holds, capacity overload, DLQ growth, failed deliveries |
| **Concierge Workspace** | concierge, support_agent | conversations (WhatsApp/in-app), order context/timeline, prior tickets, AI-drafted replies | read/send (AI-draft, human-send), notes, create tickets, escalate, trigger notifications | customer, order, channel, status, unread, priority | unanswered within SLA, negative sentiment, high-value/no-visa waiting, escalation |
| **Inspection Center** | inspector, ops_mgr, compliance (review) | inspection queue, package detail, declared contents/receipt, checklist, photo capture, serial OCR, seal | perform inspection, capture, complete checklist, pass/flag, notes; compliance review on fail | status, priority, order, inspector, flagged | discrepancy/prohibited, serial mismatch/tamper, inspection SLA, receipt missing |
| **Driver / Delivery View** (mobile) | driver, ops_mgr | assigned tasks, addresses, package ids, windows, route/zone | accept, update status, capture POD, report failed | zone, date, status, assigned-to-me | failed attempts, overdue, address issues, reassignment |
| **Finance Dashboard** | finance_admin, super_admin | payments, pending quotes, pending refunds, ledger, disputes, revenue/AOV/fee metrics | approve/send quotes+overrides, approve refunds (HUMAN-APPROVAL), reconcile, invoices/RFC, disputes | status, amount, date, customer, dispute | failed payments, refund queue/threshold, disputes/chargebacks, reconciliation mismatch, anomaly |
| **Compliance / Risk Dashboard** | compliance_admin, super_admin | risk-review queue (band+rationale), order/customer compliance, documents, inspection failures, category rules | approve/reject/hold, classify items, approve border docs, manage categories+thresholds, review fails | risk_band, category, status, value, flagged, date | HIGH/BLOCK orders, prohibited detections, customs holds, compliance SLA, rule-change review |
| **Support Dashboard** (V1) | support_agent, ops_mgr | ticket queue, categories, SLA, linked orders, resolutions, satisfaction | triage, assign, resolve, escalate, coordinate | category, severity, status, SLA, customer, order | SLA breach, escalation, reopened, high-severity |
| **Analytics Dashboard** (V1) | super_admin, ops_mgr, finance, leadership | KPIs (funnel/revenue/ops/AI), trends, cost | view, drill down, export, set targets/alerts | date range, service_type, segment, channel, agent | KPI threshold breaches |

Every dashboard surfaces **agent recommendations + workflow state + replay/DLQ controls**; dashboard actions are themselves audited.

---

# 6. Customer app data requirements (Deliverable 29)

Bottom nav: **Home · Orders · Messages · Support · Profile**. Bilingual EN/ES (allow ~20–25% longer Spanish). Each screen maps to status/journey.

| Screen | Data required | Source entities | Status/journey link |
|--------|---------------|-----------------|---------------------|
| **Home** | greeting; El Paso→Bridge→Juárez header; **Active Delivery card** (order + In Transit chip + Track); service tiles | Order (active), Journey projection | any active order |
| **New Request** (3 steps) | service choice; product details (URL, qty, variant, value, notes, photos); border info (purpose, declared value, RFC if business, receipt upload); **Request Summary** (service fee + est. item value + est. duties [AI] + total + est. delivery) | Order draft, OrderItem, Quote estimate | `draft`→`submitted` |
| **Orders list** | status chips, search/filter, reorder | Order summaries | all |
| **Order Details** | summary, items, quote, payment, documents, status timeline, actions | Order, OrderItem, Quote, Payment, Document | all |
| **Border Journey** | vertical 12-stage timeline, ETA, tracking id (`BP-####-MX`), current location, stage cards, View Photos, concierge card | Journey projection, InspectionPhoto, ConciergeAssignment | `paid`→`delivered` |
| **Inspection Details** | photos, verified contents, serial match, seal number, inspector, trust chips | Inspection, InspectionPhoto (signed URLs) | `inspection_passed/failed` |
| **Quote Review** | itemized quote, accept/decline, pay | Quote, QuoteLineItem | `quote_ready`→`awaiting_payment` |
| **Payments** | Stripe checkout, "Approve & Pay Duties", payment status | Payment, Quote | `awaiting_payment`, duties |
| **Messages (Concierge)** | in-app chat + WhatsApp thread, concierge profile + rating | SupportMessage, ConciergeAssignment, StaffProfile | any |
| **Notifications** | in-app center (status, quotes, issues) | Notification | any |
| **Profile** | name, language, loyalty (future), order history; **Addresses** (Juárez delivery + El Paso hub), **Payment Methods** (saved Stripe, default), **Receipts/Invoices** (uploaded + issued RFC) | CustomerProfile, Address, Receipt | — |
| **Help / Settings** | FAQ, how-it-works, prohibited items, fees/duties; language, notification prefs (channels/quiet hours), legal/ToS, "Powered by Maralito Labs" | static + CustomerProfile prefs | — |

All customer data is **owner-RLS-scoped**; inspection photos via permission-checked signed URLs; financial docs (receipts/invoices) via Files signed URLs.

---

# 7. Reporting / analytics data requirements (Deliverable 30)

Instrumented via **PostHog + ledger + workflow/task data + agent runs/cost ledger**. North star = **repeat purchase rate**. Every KPI has an owner, a tile, and (for guardrails) an alert+runbook. Targets `⚠️ VERIFY`.

| Category | Metric | Definition | Target | Source |
|----------|--------|-----------|--------|--------|
| **Product/activation** | Activation rate | % signups submitting first request | ≥40% | PostHog |
| | Request completion | % started reaching `submitted` | ≥70% | PostHog |
| | Quote acceptance | % `quote_ready` accepted | ≥50% | PostHog/Order |
| | Payment conversion | % accepted quotes reaching `paid` | ≥85% | ledger/Order |
| | **Repeat purchase (north star)** | % customers with ≥2 orders/window | ≥30% by 90d | Order |
| **Business/financial** | AOV; avg service fee; CLV; **refund rate** (≤5%); gross margin/order | — | various | ledger/Payments |
| **Operations** | Delivery success (≥95%); inspection failure (≤5%); border-delay frequency; avg cycle time (submit→delivered); hub throughput; on-time delivery (≥90%) | — | various | workflow/task |
| **Support/experience** | Support response (≤15min business hrs); resolution (≤24h); CSAT (≥4.5/5); concierge rating (≥4.5/5) | — | various | tickets |
| **AI/automation** | AI automation rate; **human override rate** (↓ over time); agent error rate; AI cost/order; eval pass rate (100% on release); guardrail trigger rate | — | various | agent runs + cost ledger |

**Framework:** Funnel = signup→activation→request completion→quote acceptance→payment conversion→delivery→repeat. **Guardrail metrics** (must stay bounded, alert on breach): refund rate, inspection failure rate, border-delay frequency, agent error rate. **AI trust loop:** override-rate + error-rate gate agent autonomy promotion. **Segmentation:** service_type / persona / channel / corridor. **Cadence:** weekly ops, monthly business, continuous guardrail alerting.

**Privacy:** analytics minimize PII; identify via stable ids; no Restricted fields in the analytics plane. What must be **captured for reporting:** every funnel-stage transition timestamp, money amounts (minor units), workflow/step durations, agent run cost/tokens/verdict/override, notification delivery outcomes, SLA timers.

---

*Satisfies Deliverables 10–11, 19 (access), 25, 28–30. Entity fields in `01-data-model.md`; transitions that generate audited events in `04-state-machines.md`; endpoint-level role gating in `02-api-contracts.md`.*
