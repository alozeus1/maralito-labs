# 16 · Admin & Operations Requirements

Eight back-office surfaces. Each: **Purpose · Users · Required data · Required actions · Filters/search · Automation support · Alert conditions.** Built on the Maralito Platform admin + Automation dashboard, themed for BorderPass. Roles per (11).

---

## 1. Operations Dashboard
- **Purpose:** Real-time command center for Hub intake, crossing/customs queue, and dispatch (Stitch product spec).
- **Users:** operations_manager, super_admin.
- **Required data:** all active orders by stage, Hub on-hand/staged, customs queue, driver/inspector availability, SLA timers, KPIs (17).
- **Required actions:** assign inspectors/drivers, advance/hold orders, resolve exceptions, trigger ops workflows, reassign, escalate.
- **Filters/search:** by status, service type, risk band, date, hub, zone, customer, order id.
- **Automation support:** Ops Coordinator Agent suggests assignments/scheduling; stuck-order + SLA alerts; auto status from workflows.
- **Alerts:** stuck runs, SLA breaches, customs holds, capacity overload, DLQ growth, failed deliveries.

## 2. Concierge Workspace
- **Purpose:** Unified 1:1 customer support with full order context (Stitch concierge).
- **Users:** concierge, support_agent.
- **Required data:** customer conversations (WhatsApp/in-app), order context/timeline, prior tickets, AI-drafted replies.
- **Required actions:** read/send messages (AI-draft, human-send), add notes, create tickets, escalate to finance/compliance/ops, trigger standard notifications.
- **Filters/search:** by customer, order, channel, status, unread, priority.
- **Automation support:** Support Agent triage + draft replies + suggested resolutions; sentiment/priority routing.
- **Alerts:** unanswered within SLA, negative sentiment, high-value/no-visa customer waiting, escalation needed.

## 3. Inspection Center
- **Purpose:** Run Hub inspections with high-fidelity proof (Stitch inspection screens).
- **Users:** inspector, operations_manager, compliance_admin (review).
- **Required data:** inspection queue, package details, declared contents/receipt, checklist, photo capture, serial OCR, seal entry.
- **Required actions:** perform inspection, capture photos/serial/seal, complete checklist, mark pass / flag issue, add notes; compliance review on fail.
- **Filters/search:** by status, priority, order, inspector, flagged.
- **Automation support:** Inspection Assistant compares photos vs. declared/receipt, OCR match, flags discrepancies/damage/prohibited (recommend).
- **Alerts:** discrepancy/prohibited flag, serial mismatch/tamper, inspection SLA breach, receipt missing.

## 4. Driver / Delivery View
- **Purpose:** Field tool for crossings + last-mile delivery.
- **Users:** driver, operations_manager.
- **Required data:** assigned tasks, addresses, package ids, delivery windows, route/zone.
- **Required actions:** accept task, update status, capture proof of delivery (photo/signature), report failed attempt.
- **Filters/search:** by zone, date, status, assigned-to-me.
- **Automation support:** Ops Coordinator assignment/routing suggestions; auto-complete on proof; reschedule on failure.
- **Alerts:** failed attempts, overdue deliveries, address issues, reassignment needed. (Mobile-friendly.)

## 5. Finance Dashboard
- **Purpose:** Manage money — payments, quotes, refunds, reconciliation, invoicing/RFC.
- **Users:** finance_admin, super_admin.
- **Required data:** payments, quotes (pending approval), refunds (pending), ledger, disputes, revenue/AOV/fee metrics.
- **Required actions:** approve/send quotes + overrides (`HUMAN-APPROVAL`), approve refunds (`HUMAN-APPROVAL`), reconcile, issue invoices/RFC, handle disputes.
- **Filters/search:** by status, amount, date, customer, dispute.
- **Automation support:** Finance Agent reconciliation + refund-eligibility recommendations; auto-receipts.
- **Alerts:** failed payments, refund queue/threshold, disputes/chargebacks, reconciliation mismatch, anomaly spikes.

## 6. Compliance / Risk Dashboard
- **Purpose:** Screen and decide on risk/compliance + border documentation.
- **Users:** compliance_admin, super_admin.
- **Required data:** risk-review queue (AI band + rationale), order/customer compliance data, documents, inspection failures, category rules.
- **Required actions:** approve/reject/hold orders (`HUMAN-APPROVAL`), classify items, approve border docs (`HUMAN-APPROVAL`), manage prohibited/accepted categories + thresholds, review inspection fails.
- **Filters/search:** by risk band, category, status, value, flagged, date.
- **Automation support:** Risk Agent recommendations + matched rules; auto-routing of risky orders; rule simulation before publish.
- **Alerts:** HIGH/BLOCK orders, prohibited-item detections, customs holds, compliance SLA breach, rule-change review.

## 7. Support Dashboard
- **Purpose:** Manage support tickets + escalations (V1; MVP uses concierge workspace).
- **Users:** support_agent, operations_manager.
- **Required data:** ticket queue, categories, SLA, linked orders, resolutions, satisfaction.
- **Required actions:** triage, assign, resolve, escalate to specialists, coordinate remedies.
- **Filters/search:** by category, severity, status, SLA, customer, order.
- **Automation support:** Support Agent triage/draft/route; SLA timers + escalation.
- **Alerts:** SLA breach, escalation, reopened tickets, high-severity/sensitive cases.

## 8. Analytics Dashboard
- **Purpose:** Product/business/ops/AI insight + leadership view (V1).
- **Users:** super_admin, operations_manager, finance_admin, leadership.
- **Required data:** KPIs (17) across funnel, revenue, ops, AI; trends; cost.
- **Required actions:** view dashboards, drill down, export, set targets/alerts.
- **Filters/search:** by date range, service type, segment, channel, agent.
- **Automation support:** Manager Agent anomaly detection + summaries; auto-refresh from Analytics (S8) + PostHog.
- **Alerts:** KPI threshold breaches (conversion drop, refund spike, delay frequency, AI override-rate spike, cost anomaly).

---

## 16.1 Cross-cutting requirements
- **RBAC + RLS:** every surface scoped by role + org; PII access logged; powerful actions need elevation + audit.
- **Real-time:** live updates for queues/orders/conversations; deep-linkable records (shareable for support/incident).
- **Bilingual-aware:** staff tools English-primary, but customer-facing content (messages, templates) EN/ES.
- **Automation-native:** every dashboard surfaces agent recommendations + workflow state + replay/DLQ where relevant (Automation dashboard).
- **Audit-visible:** dashboard actions themselves audited; Audit Logs surface searchable history.
- **Alert → runbook:** every alert links to an action/runbook; no dead-end alerts.
