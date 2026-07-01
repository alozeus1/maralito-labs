# 12 · AI Agent Product Requirements

Ten BorderPass agents. Each runs through the Maralito **AI gateway** and **automation orchestration** as governed workflow steps. **Core rule: agents may recommend, but risky/compliance/financial decisions require `HUMAN-APPROVAL`.** Agents start at **suggest** autonomy; promotion needs evals + review (per the AI platform autonomy tiers).

> Each agent: **Purpose · Inputs · Outputs · Tools · Data access · Memory · Human approval points · Failure modes · Escalation · Audit.** All agent runs are traced, cost-metered, and audited; memory is org-scoped/RLS-isolated.

---

## Agent 1 — Intake Agent
- **Purpose:** Validate and route new requests; ensure completeness before downstream work.
- **Inputs:** New Request data (service, item, URL, value, border info, receipt presence).
- **Outputs:** Validation result, missing-field list, normalized order, routing recommendation.
- **Tools:** Schema validation, profile lookup, document-presence check, workflow trigger.
- **Data access:** Order + customer profile (org-scoped).
- **Memory:** Per-order (short-term); customer history (read).
- **Human approval:** None (non-decisional) — but routes risky cases to review.
- **Failure modes:** Misclassifies completeness; false "missing info".
- **Escalation:** Ambiguity → concierge/ops.
- **Audit:** Validation outcome + routing recorded.

## Agent 2 — Shopping Agent *(V1)*
- **Purpose:** Resolve product URL → current price, availability, specs, restrictions.
- **Inputs:** Product URL, desired variant/qty.
- **Outputs:** Resolved price/availability, product metadata, restriction flags, purchase recommendation.
- **Tools:** Web/product-data retrieval (allowlisted), price parser, category classifier. (Untrusted web content treated as **data, not instructions** — injection guardrails.)
- **Data access:** Order item; external product APIs (egress-allowlisted).
- **Memory:** Per-order; product cache.
- **Human approval:** **Purchase action `HUMAN-APPROVAL`** (buy-for-me) — agent never buys autonomously.
- **Failure modes:** Wrong product match; stale price; unsupported site.
- **Escalation:** Unresolvable URL → concierge/buyer.
- **Audit:** Resolution + sources recorded.

## Agent 3 — Risk & Compliance Agent
- **Purpose:** Screen orders for prohibited/restricted items, value/destination risk; produce a **risk band + rationale**.
- **Inputs:** Item category/description, declared value, destination, customer KYC/history, receipt.
- **Outputs:** Risk band (LOW/MED/HIGH/BLOCK), matched rules, rationale, required-docs/approval recommendation.
- **Tools:** Rules engine, prohibited/sanctions lists, category classifier, KYC lookup.
- **Data access:** Order, customer compliance data, rules.
- **Memory:** Per-order; customer risk history (read).
- **Human approval:** **`HUMAN-APPROVAL` mandatory for HIGH/BLOCK and all compliance decisions** — agent recommends only.
- **Failure modes:** Misclassification (false clear = serious); over-flagging.
- **Escalation:** Any uncertainty / low confidence → compliance human (never auto-clear uncertain).
- **Audit:** Band + matched rules + rationale + human decision (explainable, compliance-critical).

## Agent 4 — Quote Agent
- **Purpose:** Produce an itemized, transparent quote (service fee + item value + **estimated duties** + total).
- **Inputs:** Item value, category, route, service type, weight/dims, duty rules.
- **Outputs:** Itemized quote draft, duty estimate + basis, confidence, expiry.
- **Tools:** Pricing rules, duty-estimation logic (`⚠️ VERIFY` duty rates with counsel), tax/fee calculators.
- **Data access:** Order, pricing/duty rules.
- **Memory:** Per-order; pricing config.
- **Human approval:** **`HUMAN-APPROVAL` for non-standard pricing/overrides and (MVP) all quotes**; duty estimates human-confirmed where material.
- **Failure modes:** Wrong duty estimate (financial/legal risk), pricing errors.
- **Escalation:** Edge pricing / low confidence → finance.
- **Audit:** Quote breakdown + rule version + approver.

## Agent 5 — Inspection Assistant Agent *(V1)*
- **Purpose:** Assist Hub inspection — analyze photos vs. declared/receipt contents, OCR serial, flag discrepancies/damage/prohibited.
- **Inputs:** Inspection photos, declared contents, receipt, item metadata.
- **Outputs:** Content-match assessment, serial OCR + match result, discrepancy/damage/prohibited flags, risk score.
- **Tools:** Vision model, OCR, comparison logic (via AI gateway, ACL-scoped).
- **Data access:** Inspection record, order, receipt (org-scoped).
- **Memory:** Per-inspection.
- **Human approval:** **`HUMAN-APPROVAL` for fail/discrepancy resolution** — inspector + compliance decide.
- **Failure modes:** Vision errors (false match/mismatch), poor OCR.
- **Escalation:** Low confidence / flag → inspector + compliance.
- **Audit:** Assessment + flags + final human outcome.

## Agent 6 — Border Journey Agent *(V1)*
- **Purpose:** Compute ETAs, narrate journey stages (EN/ES), explain/predict delays.
- **Inputs:** Order status/stage timestamps, location, crossing/customs state, historical timings.
- **Outputs:** ETA, stage narration copy, delay explanations + updated ETA.
- **Tools:** ETA model/heuristics, copy generation (guardrailed), status reader.
- **Data access:** Order journey data.
- **Memory:** Per-order; corridor timing stats.
- **Human approval:** None for narration; **customs-hold messaging confirmed by ops** before sending sensitive delay claims.
- **Failure modes:** Wrong ETA, over-promising, inaccurate delay reason.
- **Escalation:** Unexpected hold → ops/compliance.
- **Audit:** Generated messages + ETA basis.

## Agent 7 — Customer Support Agent *(V1)*
- **Purpose:** Triage customer messages, classify, draft replies, suggest resolutions for the concierge.
- **Inputs:** Customer message, order context/history.
- **Outputs:** Category/severity, drafted reply (EN/ES), suggested action.
- **Tools:** Ticket system, order lookup, knowledge base, reply generation (guardrailed).
- **Data access:** Tickets, order/customer context (PII access logged).
- **Memory:** Conversation thread; customer history.
- **Human approval:** **Sensitive replies/actions human-sent**; refunds/compliance → specialists (`HUMAN-APPROVAL`). Never auto-sends financial/compliance commitments.
- **Failure modes:** Wrong classification, inappropriate/hallucinated reply.
- **Escalation:** Low confidence / sensitive / negative sentiment → human concierge/specialist.
- **Audit:** Draft + human-sent final + actions.

## Agent 8 — Finance Agent *(V1)*
- **Purpose:** Reconcile payments, assess refund eligibility/amount, support invoicing.
- **Inputs:** Payment events, order, refund request, refund rules, ledger.
- **Outputs:** Reconciliation status, refund eligibility + amount recommendation, invoice/RFC draft.
- **Tools:** Payments (Stripe), ledger, refund rules, invoice generator.
- **Data access:** Financial data, order, customer billing/RFC.
- **Memory:** Per-order financial context.
- **Human approval:** **`HUMAN-APPROVAL` for refunds (≥ threshold/all in MVP) + non-standard financial actions**; separation of duties.
- **Failure modes:** Wrong eligibility/amount, double-processing.
- **Escalation:** Disputes/anomalies → finance human.
- **Audit:** Recommendation + approver + ledger entry (financial audit trail).

## Agent 9 — Operations Coordinator Agent *(V1)*
- **Purpose:** Schedule and coordinate inspection, crossing, and delivery; assignment suggestions.
- **Inputs:** Order/package state, hub capacity, driver/inspector availability, zones, schedules.
- **Outputs:** Assignment + scheduling recommendations, task creation, bottleneck alerts.
- **Tools:** Task system, scheduling, capacity/zone data.
- **Data access:** Ops queues, staff availability (org-scoped).
- **Memory:** Ops state; throughput patterns.
- **Human approval:** Ops manager confirms non-standard scheduling; standard assignments may auto-apply (reversible).
- **Failure modes:** Poor assignment/scheduling, overload.
- **Escalation:** Capacity breach / exception → ops manager.
- **Audit:** Assignments + scheduling decisions.

## Agent 10 — Manager Agent *(V2)*
- **Purpose:** Cross-cutting oversight — anomaly detection, SLA/risk monitoring, summaries for leadership; recommend interventions.
- **Inputs:** Aggregate order/ops/finance/agent metrics, SLA + budget data.
- **Outputs:** Anomaly alerts, daily/weekly summaries, intervention recommendations, quality/cost insights.
- **Tools:** Analytics, metrics, alerting, summarization.
- **Data access:** Aggregate (org-scoped); minimized PII.
- **Memory:** Trend history.
- **Human approval:** Recommends only — humans act on interventions; no direct operational authority.
- **Failure modes:** False anomalies, misleading summaries.
- **Escalation:** Critical anomalies → on-call/leadership.
- **Audit:** Alerts + recommendations + summaries.

---

## 12.1 Cross-agent governance
- **Single AI gateway:** all model calls governed (cost, guardrails, routing, logging). No agent calls a provider directly.
- **Delegated, tool-scoped permissions:** an agent does only what its tools + delegated scope allow, ≤ the human it assists (least privilege).
- **Human-in-the-loop is the default for risk:** acceptance/rejection, prohibited-item calls, quotes (material), purchases, border docs, inspection failures, refunds — **always `HUMAN-APPROVAL`**.
- **Memory isolation:** org-scoped, RLS-isolated; cross-tenant retrieval impossible (tested).
- **Evaluation:** each agent has eval + red-team suites gating changes; online quality + **human-override rate** tracked (a key trust metric — 17).
- **Audit + explainability:** every recommendation records inputs, rationale, matched rules, confidence, and the final human decision — essential for compliance and dispute resolution.
- **Low-confidence rule:** any risky recommendation below confidence threshold escalates to a human; agents never act autonomously on low-confidence risky decisions.

## 12.2 Agent ↔ workflow map
| Agent | Primary workflows (13) | Journeys (04) |
|-------|------------------------|----------------|
| Intake | 1,2 | J2,J3,J5,J12 |
| Shopping | 7 | J2,J12 |
| Risk & Compliance | 3 | J2,J5,J7 |
| Quote | 4,5 | J2,J6 |
| Inspection Assistant | 9 | J7 |
| Border Journey | 10,11 | J8 |
| Support | 15 | J10 |
| Finance | 6,14 | J6,J11 |
| Operations Coordinator | 7,8,10,12 | J4,J8,J9 |
| Manager | (oversight) | (all) |
