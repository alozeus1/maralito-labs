# 11 · Roles & Permissions

Roles map to the Maralito Platform RBAC + the Automation platform's approval system. Customers are app users; staff roles are org-internal operators; super_admin is Maralito/BorderPass administration. Permissions are enforced at the app boundary (RBAC) and the database (RLS). Powerful/irreversible actions require elevation + audit + separation of duties.

> Each role: **Permissions · Allowed actions · Restricted actions · Dashboard access · Data access · Approval powers.**

---

## customer
- **Permissions:** Self-service over own orders only.
- **Allowed:** Create/submit requests; upload receipts; review/accept quotes; pay; view own order/journey/inspection; chat with concierge; manage own profile/addresses/payment methods; request cancel/refund; reorder.
- **Restricted:** Any other customer's data; admin/ops tools; approving their own risk/refunds; changing order status directly.
- **Dashboard:** Customer app only.
- **Data:** Own profile, orders, documents, payments, messages (RLS by user/org).
- **Approval powers:** Approve **their own** quote + payment; authorize duties payment. No staff approvals.

## concierge
- **Permissions:** Customer-facing support + order assistance.
- **Allowed:** View assigned/all customer conversations + order context; send messages (AI-drafted, human-sent); update non-sensitive order notes; trigger standard notifications; create support tickets; assist with request entry.
- **Restricted:** Approve refunds/compliance; change payment; finalize risky decisions; access finance/compliance admin.
- **Dashboard:** Concierge Workspace; read order details.
- **Data:** Customer profiles + orders needed for support (PII access logged).
- **Approval powers:** None for money/compliance; can **escalate** to specialists.

## inspector
- **Permissions:** Hub inspection.
- **Allowed:** View inspection queue + assigned packages; perform inspection; capture photos/serial(OCR)/seal; complete checklist; mark pass / flag issue; add notes.
- **Restricted:** Pricing, payments, refunds, customer PII beyond what's needed, compliance final decisions.
- **Dashboard:** Inspection Center (Ops).
- **Data:** Package + inspection records for assigned items.
- **Approval powers:** Recommend pass/fail; **inspection_failed resolution requires compliance/ops `HUMAN-APPROVAL`** (not inspector alone for refunds/returns).

## driver
- **Permissions:** Last-mile delivery (and crossing tasks as assigned).
- **Allowed:** View assigned delivery/crossing tasks + addresses; update task status; capture proof of delivery (photo/signature); report failed attempts.
- **Restricted:** Order financials, customer data beyond delivery need, status changes outside delivery, other drivers' tasks.
- **Dashboard:** Driver/Delivery view (mobile).
- **Data:** Delivery address + contact + package id for assigned tasks only.
- **Approval powers:** None; confirms delivery; escalates failures.

## operations_manager
- **Permissions:** Run Hub + dispatch + crossing operations.
- **Allowed:** View all orders/ops queues; assign inspectors/drivers; manage receiving, inspection, crossing, delivery; manage schedules/zones; handle holds/exceptions; reassign tasks; trigger ops workflows.
- **Restricted:** Final compliance rejection (compliance domain), refund approval above threshold (finance), changing roles/permissions.
- **Dashboard:** Operations dashboard (full), Orders.
- **Data:** All operational order/package/delivery data (org-scoped).
- **Approval powers:** Operational approvals (dispatch, reassignment); can approve standard ops exceptions; escalates compliance/finance.

## finance_admin
- **Permissions:** Money operations.
- **Allowed:** View/manage payments, receipts, reconciliation, disputes; approve quotes/pricing overrides; **approve refunds** (within authority); issue invoices/RFC; financial reporting.
- **Restricted:** Compliance category decisions; ops dispatch; role administration; self-approving own-initiated refunds (separation of duties).
- **Dashboard:** Finance dashboard, Payments, Refunds, Quotes.
- **Data:** Financial data, customer billing, RFC, ledger.
- **Approval powers:** **`HUMAN-APPROVAL` for quotes (non-standard), refunds, high-value payment exceptions.**

## compliance_admin
- **Permissions:** Risk & customs compliance.
- **Allowed:** View risk-review queue + AI risk band/rationale; approve/reject/hold orders; classify items; approve **border documentation**; manage prohibited/accepted categories + thresholds (rules); review inspection failures; KYC/RFC compliance.
- **Restricted:** Payments/refund execution (finance), ops dispatch, role admin.
- **Dashboard:** Compliance/Risk dashboard, Risk Reviews, Inspections (compliance view), Audit (read).
- **Data:** Order risk, customer KYC/compliance, documents, inspection results.
- **Approval powers:** **`HUMAN-APPROVAL` for order acceptance/rejection, prohibited-item calls, border documentation, inspection-failure compliance decisions.**

## support_agent
- **Permissions:** Support ticket handling (broader than concierge for issue resolution).
- **Allowed:** Manage support tickets + queues; access order context; coordinate resolutions; trigger standard remedies; escalate to finance/compliance/ops.
- **Restricted:** Approve refunds/compliance directly; change payments; alter roles.
- **Dashboard:** Support dashboard, Concierge Workspace.
- **Data:** Tickets + linked order/customer data (PII access logged).
- **Approval powers:** None for money/compliance; routes to specialists.

## super_admin
- **Permissions:** Full BorderPass/Maralito administration.
- **Allowed:** All of the above; manage roles/permissions; configure business rules, feature flags, hub/zones; manage integrations; view all audit; system settings.
- **Restricted:** Still bound by **separation of duties + audit** on sensitive actions (e.g., shouldn't self-approve own refund); cross-org access is audited.
- **Dashboard:** All.
- **Data:** All (org-scoped; cross-org only as Maralito admin, audited).
- **Approval powers:** Can grant/configure approval authorities; emergency override (elevated + audited).

---

## 11.1 Permission matrix (selected actions)
| Action | customer | concierge | inspector | driver | ops_mgr | finance | compliance | support | super_admin |
|--------|:-------:|:--------:|:--------:|:-----:|:------:|:------:|:--------:|:------:|:----------:|
| Submit request | ✅(own) | assist | — | — | — | — | — | assist | ✅ |
| Approve/reject order (risk) | — | — | — | — | escalate | — | ✅ | escalate | ✅ |
| Approve/send quote | accept own | — | — | — | — | ✅ | — | — | ✅ |
| Take payment | pay own | — | — | — | — | ✅ | — | — | ✅ |
| Approve refund | request | — | — | — | escalate | ✅ | risk-related | escalate | ✅ |
| Perform inspection | — | — | ✅ | — | view | — | review | — | ✅ |
| Approve border docs | — | — | — | — | prep | — | ✅ | — | ✅ |
| Assign driver/inspector | — | — | — | — | ✅ | — | — | — | ✅ |
| Confirm delivery | confirm receipt | — | — | ✅ | view | — | — | — | ✅ |
| Manage roles/rules | — | — | — | — | — | — | rules(compliance) | — | ✅ |
| View audit logs | own actions | — | — | — | ops scope | finance scope | ✅ | support scope | ✅ |

## 11.2 Principles
- **Least privilege** per role; data access RLS-scoped by org and need; PII access by staff is **logged to audit**.
- **Separation of duties:** requester ≠ approver (refunds, compliance); finance and compliance authorities are distinct.
- **AI agents act as a distinct `agent` principal** with delegated, tool-scoped permissions ≤ the human they assist; **never** hold final authority on risky/compliance/financial decisions (always `HUMAN-APPROVAL`).
- **All powerful actions audited** with actor + justification.
