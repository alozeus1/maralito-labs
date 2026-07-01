# 07 · MVP Scope

The MVP proves one thing: a Juárez customer can complete **one trustworthy cross-border order end-to-end** and trust it enough to pay and reorder — with a **polished automated customer experience over mostly manual operations**, and **humans approving every risky/financial/compliance decision**.

> Guiding rule: **automate the customer experience, keep operations manual where judgment or compliance is involved.** Don't build agents/automation depth that the pilot doesn't need yet.

---

## 7.1 In scope (MVP)
Per the required MVP list, all included:
1. **Customer auth** — EN/ES onboarding, phone OTP, login (platform Identity).
2. **New order request** — 3-step flow (Stitch), services: **Buy for Me** + **Package Reception** (Local Pickup & Business = limited/concierge-assisted in MVP — see Out of Scope).
3. **Product URL submission** — paste URL + item details.
4. **Receipt upload** — upload receipt/invoice (Files).
5. **Compliance / border info form** — purpose, declared value, RFC (optional), category.
6. **Quote generation** — itemized quote (service fee + item value + **estimated duties**), AI-drafted, **human-reviewed** in MVP.
7. **Stripe payment** — secure pay + receipt (Payments).
8. **Order status tracking** — canonical statuses (09) rendered as the **Border Journey** (10).
9. **Admin order dashboard** — ops view of all orders + detail (Automation dashboard themed).
10. **Manual review** — every order passes a human review/approval queue in MVP.
11. **Inspection checklist** — structured inspection at El Paso Hub.
12. **Inspection photo upload** — photos + serial/seal capture, shown to customer.
13. **Customer notifications** — email + WhatsApp/SMS + in-app for key events (14).
14. **Concierge contact** — WhatsApp + in-app chat to a human concierge.
15. **Audit logging** — immutable trail of customer/admin/agent actions.

**Also required for a coherent MVP:**
- Order details + quote review + payment screens; Juárez + Hub addresses; help center (EN/ES); notification preferences; refund/cancel (manual, finance-approved); delivery confirmation with proof.

## 7.2 Out of scope (MVP → deferred)
- Full **AI autonomy** (agents recommend only; heavy automation deferred to V1).
- **Shopping Agent** auto price-resolution (MVP: manual/concierge resolves URLs), **automated duty calculation at scale** (MVP: human-assisted estimate).
- **Local Pickup** and **full Business/freight** as self-serve flows (MVP: concierge-assisted, limited).
- **Reorder**, **saved payment methods**, **loyalty/VIP**, **BorderPass-issued RFC invoices** (auto), **support ticket system** (MVP uses concierge chat), **analytics dashboards** (MVP uses basic metrics), **push notifications** (MVP: email/WhatsApp/SMS/in-app), **voice concierge**.
- **Marketplace, subscriptions, U.S. returns** (product-spec V2/V3).
- **Multi-user B2B accounts / POs / net terms**.

## 7.3 Manual for MVP (humans do it)
- **All risk/compliance decisions** — every order human-reviewed (`HUMAN-APPROVAL`).
- **Quote finalization** — AI drafts, human approves/sends.
- **Product purchasing** (buy-for-me) — staff buyer purchases; uploads proof.
- **Border documentation + customs handling** — staff/compliance assemble + submit; `⚠️ VERIFY` broker/partner.
- **Crossing + customs status updates** — ops update manually (no deep carrier/customs integration yet).
- **Driver dispatch + delivery** — manual assignment; driver captures proof.
- **Duty estimation** — human-assisted (AI suggests, human confirms).
- **Refunds** — finance-approved manually.
- **URL price/availability resolution** — concierge/buyer confirms.

## 7.4 Automated for MVP (system/agents do it)
- **Onboarding/auth + OTP**, **notifications** for key events, **status timeline / Border Journey** rendering.
- **Intake validation** (Intake Agent flags missing info; *Missing information* workflow).
- **Workflow orchestration** — durable order workflow drives statuses, tasks, approvals, compensation.
- **Quote draft** (Quote Agent) + **risk band suggestion** (Risk Agent) — *recommendations only*.
- **Payment processing + receipt** (Stripe), **idempotent webhook handling**.
- **Audit logging** auto-captured for sensitive actions.
- **Task creation** for review/inspection/delivery queues.

## 7.5 Human approval required (MVP)
| Decision | Approver | Why |
|----------|----------|-----|
| Accept/reject order (risk/compliance) | Compliance/Ops | Prohibited/restricted items, sanctions, value |
| Finalize/send quote | Finance/Ops | Pricing + duty accuracy (money) |
| Approve purchase (buy-for-me) | Ops/Finance | Spend on customer's behalf |
| Border documentation / customs submission | Compliance | Legal/regulatory correctness |
| Inspection fail / discrepancy resolution | Compliance/Ops | Wrong/damaged/prohibited goods |
| Refund (any, in MVP) | Finance | Money out; fraud risk |

## 7.6 V1 backlog (fast-follow, ≤60 days)
- **Agent depth:** Shopping Agent (auto URL resolve), automated **duty estimation**, Inspection Assistant (vision), Border Journey Agent (ETA/narration), Support Agent (triage/draft), Finance Agent (auto-reconcile + refund eligibility), Operations Coordinator.
- **Self-serve:** reorder, saved payment methods, BorderPass RFC invoices, support ticket system, push notifications, analytics dashboards.
- **Services:** full Business/freight flow, Local Pickup self-serve.
- **Automation:** raise automation rate (auto-approve low-risk reversible cases), quote-expiry reminders, delay prediction.

## 7.7 MVP acceptance criteria
`ACCEPTANCE:`
- A new Juárez user can onboard (EN/ES) and submit a Buy-for-Me **or** Package-Reception request from the Stitch flow.
- Every order is human-reviewed, quoted transparently, paid via Stripe, and tracked via the Border Journey.
- Packages are received + inspected at the El Paso Hub with photos + serial/seal shown to the customer.
- Customer receives notifications at each key stage and can reach a human concierge.
- Delivery is confirmed with proof; refunds/cancellations work (finance-approved).
- Every sensitive action is audit-logged; the ops team can run the whole flow from the admin dashboard.
- **Pilot success signal:** customers complete orders, rate the experience highly, and a meaningful share **reorder**.
