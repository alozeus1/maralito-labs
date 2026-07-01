# 15 · Future App Workflow Examples

Covers required output **(17)**. Demonstrates that the same engine, event model, agents, approvals, tasks, and rules power **other product types** with no new orchestration infrastructure — only new definitions, agents, rules, and templates. This is the reusability proof (Principle A10).

---

## Reuse pattern
Every example below reuses the **same spine**: `trigger event → validate → rules/risk → (human approval if needed) → agent/automated action → effect (pay/notify/doc/task) → audit → analytics`, with compensation on failure. Only the **domain specifics** change.

| Reusable primitive | BorderPass use | Reused in future apps as |
|--------------------|----------------|--------------------------|
| Intake + validation | Order/buy-for-me intake | Application intake, listing creation, onboarding |
| Risk/compliance review (W4) | Restricted goods/sanctions | KYC/AML, content moderation, fraud screening |
| Quote/pricing (W5) | Shipping quote | Loan pricing, subscription quote, marketplace fees |
| Payment confirm (W6) | Order payment | Checkout, payout, invoice settlement |
| Task queues (W7/W8/W10) | Buyer/inspector/driver | Underwriter, moderator, fulfilment, field agent |
| Approval system (W11) | Refund | Payout approval, dispute, content takedown |
| Support escalation (W12) | Customer support | Any app's support/ops escalation |

---

## Example A — Marketplace app

### A1. Seller onboarding & verification (`marketplace.seller.onboard`)
- **Trigger:** `marketplace.seller.applied`.
- **Spine:** validate business info → **KYC/risk review (reuses W4 pattern)** → agent checks documents (*suggest*) → **compliance approval** if flagged → create Stripe Connect account (effect) → notify → audit.
- **Reuses:** risk review, approval system, document/Files, notifications, Connect (Payments).

### A2. Listing moderation (`marketplace.listing.moderate`)
- **Trigger:** `marketplace.listing.submitted`.
- **Spine:** validate → **content-moderation agent** (*suggest*: policy violations, prohibited items) → rules engine (category policy) → auto-approve LOW risk / **human review** for flagged → publish or reject → notify → audit.
- **Reuses:** agent orchestration + guardrails, rules engine, approval, task queue (moderators).

### A3. Order dispute & resolution (`marketplace.dispute.resolve`)
- **Trigger:** `marketplace.dispute.opened`.
- **Spine:** assemble context (triage agent) → route to support/finance → evidence collection (tasks) → **refund/payout decision (reuses W11 refund pattern)** with finance/compliance approval → execute → notify → audit.
- **Reuses:** support escalation (W12), refund/approval, payments, tasks.

---

## Example B — Fintech app

### B1. Loan/credit application (`fintech.loan.apply`)
- **Trigger:** `fintech.application.submitted`.
- **Spine:** validate → enrich (profile/KYC) → **risk/underwriting agent** (*suggest* score + rationale) → rules engine (eligibility/pricing) → **human underwriter approval** (HITL, always for credit decisions) → offer generation (doc) → customer accept (signal) → disburse (payment effect, approval-gated) → audit.
- **Reuses:** intake, risk review, rules (pricing/eligibility), approval, documents, payments, long-running waits.
- **Note:** credit decisions are **never** fully autonomous — human approval mandatory (Principle A6); decisions are explainable (rules + agent rationale recorded) for regulatory needs. `⚠️ VERIFY` lending compliance/licensing before building.

### B2. Payout processing (`fintech.payout.process`)
- **Trigger:** `fintech.payout.requested` or scheduled (cron).
- **Spine:** assess (rules: limits, balance, fraud signals) → **fraud/risk agent** (*suggest*) → **finance approval** above threshold → execute payout (idempotent effect) → ledger + notify → compensation (reverse) on downstream failure.
- **Reuses:** scheduling, rules, approval, payments, compensation, audit.

### B3. Transaction monitoring / AML (`fintech.aml.monitor`)
- **Trigger:** `payment.succeeded` stream / scheduled sweep.
- **Spine:** rules (thresholds/patterns) → **AML agent** (*suggest*: suspicious pattern detection) → case creation (task) on hit → **compliance approval / SAR workflow** → audit (immutable).
- **Reuses:** event subscriptions, rules, agents, tasks, compliance approval, audit.

---

## Example C — SaaS / operations app

### C1. Customer onboarding automation (`saas.customer.onboard`)
- **Trigger:** `subscription.created`.
- **Spine:** provision (effects) → send welcome sequence (notifications) → schedule check-in follow-ups (delayed jobs) → create CSM task if enterprise tier (rules) → track activation (analytics).
- **Reuses:** notifications, scheduling, tasks, rules, analytics.

### C2. Subscription dunning & renewal (`saas.billing.dunning`)
- **Trigger:** `payment.failed` / renewal schedule (cron).
- **Spine:** retry schedule with reminders (notifications) → **finance approval** for special handling → downgrade/suspend (effect) on exhaustion → win-back follow-up (delayed) → audit.
- **Reuses:** scheduling, retry/recovery, notifications, payments, approval.

### C3. Incident/ops response (`saas.incident.respond`)
- **Trigger:** `alert.triggered` (from observability).
- **Spine:** triage agent (*suggest* severity + likely cause) → page on-call (task/notification) → track resolution → schedule postmortem task → audit.
- **Reuses:** agents, tasks, notifications, scheduling.

---

## What stays the same vs. what changes
| Stays the same (platform-provided) | Changes per app (authored) |
|------------------------------------|----------------------------|
| Workflow engine, durability, retries, compensation | Workflow definitions (steps/branches) |
| Event bus + standard schema | App-specific event types + payloads |
| Agent orchestration, registries, guardrails, eval | Specific agents + prompts + tools |
| Approval system + HITL | Approval policies + roles |
| Task queues + SLA/escalation | Queue types + assignment rules |
| Rules engine | App/tenant rule sets |
| Notifications + scheduling + integration | Templates, schedules, integrations |
| Observability, audit, security model | (inherited as-is) |

**Implication:** a new app's automation work is **authoring + configuration**, not building orchestration — which is exactly the "launch new automations in days" vision goal.
