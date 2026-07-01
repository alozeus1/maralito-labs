# 18 · Edge Cases & Failure Modes

Fifteen critical edge cases. Each: **Detection · User experience · Admin action · Automation response · Notification · Audit record.** These harden the happy path and protect trust (especially for the no-visa/low-trust personas). Ties to business rules (08), state machine (09), and workflows (13).

---

## 1. Customer submits a prohibited item
- **Detection:** Risk Agent + rules engine flag category; `under_review`.
- **User experience:** Order shows *Reviewing*; if rejected, clear, respectful explanation + what's not allowed + alternatives.
- **Admin action:** compliance_admin confirms rejection (`HUMAN-APPROVAL`).
- **Automation:** auto-flag → review queue; on reject → `rejected`, no charge, close.
- **Notification:** rejection w/ reason (EN/ES) + concierge offer.
- **Audit:** flag, matched rules, rationale, human decision.

## 2. Receipt missing
- **Detection:** Intake validation / inspection finds no required receipt.
- **User experience:** *Action needed* — request to upload; clear instructions; concierge help.
- **Admin action:** reviewer/concierge follows up if not provided.
- **Automation:** `missing_information` → W2 → reminders.
- **Notification:** *Missing information* (what's needed + link).
- **Audit:** missing-info request + resolution.

## 3. Wrong item received
- **Detection:** Inspection Assistant content mismatch vs. declared/receipt; inspector confirms.
- **User experience:** *Issue found* — photos + explanation; options (return/refund/replace); concierge-led.
- **Admin action:** compliance/ops decide resolution (`HUMAN-APPROVAL`); coordinate return.
- **Automation:** `inspection_failed` → halt crossing → resolution workflow → possible refund (W14).
- **Notification:** *Issue found* + next steps.
- **Audit:** mismatch evidence + decision + resolution.

## 4. Package damaged
- **Detection:** Inspector notes damage + photos; Assistant flags.
- **User experience:** *Issue found* with photos; reassurance + insurance/money-back; options.
- **Admin action:** assess; refund/replace/claim (`HUMAN-APPROVAL`); insurance claim if applicable.
- **Automation:** `inspection_failed` (or note) → resolution; compensation if refunded.
- **Notification:** *Issue found* + protection reassurance.
- **Audit:** damage evidence + resolution + claim.

## 5. Package lost
- **Detection:** Tracking gap / not received at Hub past window / lost in transit.
- **User experience:** proactive, honest update; concierge-led; resolution (refund/re-purchase); never silent.
- **Admin action:** ops investigates carrier; finance refund/replace (`HUMAN-APPROVAL`).
- **Automation:** timeout alert → ops task + concierge; compensation path.
- **Notification:** proactive delay → resolution updates.
- **Audit:** investigation + outcome.

## 6. Payment fails
- **Detection:** Stripe `payment.failed` / decline.
- **User experience:** clear retry prompt; alternative method; no penalty; help.
- **Admin action:** finance monitors; assist if needed.
- **Automation:** dunning/retry (N) → hold/cancel if exhausted; never proceed unpaid.
- **Notification:** payment-failed + retry link.
- **Audit:** attempts + outcome.

## 7. Refund requested
- **Detection:** customer/support/compensation trigger.
- **User experience:** clear eligibility + amount + timeline; transparent if partial/none.
- **Admin action:** finance approves (`HUMAN-APPROVAL`), separation of duties.
- **Automation:** W14 — eligibility (rules + Finance Agent) → approve → idempotent Stripe refund → reverse tasks.
- **Notification:** *Refund processed* (amount + timeline).
- **Audit:** reason, eligibility, amount, approver, ledger.

## 8. Customer unreachable
- **Detection:** no response to required action / delivery contact attempts.
- **User experience:** escalating multi-channel outreach (WhatsApp→SMS→email→call); clear deadline.
- **Admin action:** concierge attempts contact; hold order; apply abandonment rule if needed.
- **Automation:** reminder workflow; escalation; eventual hold/abandonment (08.13).
- **Notification:** escalating reminders across channels.
- **Audit:** contact attempts + outcome.

## 9. Border delay
- **Detection:** stage exceeds window / known customs hold.
- **User experience:** calm explanation + reason + updated ETA + concierge access (trust under friction).
- **Admin action:** ops/compliance resolve hold; confirm messaging.
- **Automation:** W11 — detect → Journey Agent explains → ops confirm → notify.
- **Notification:** *Customs delay* (reason + new ETA).
- **Audit:** delay reason + comms + resolution.

## 10. Delivery address incorrect
- **Detection:** driver reports bad address / validation fails.
- **User experience:** prompt to correct address; reschedule; no blame.
- **Admin action:** ops/concierge confirm correction.
- **Automation:** delivery paused → request correction → reschedule (W13).
- **Notification:** address-correction request.
- **Audit:** correction + reschedule.

## 11. Driver cannot deliver
- **Detection:** failed attempt reported.
- **User experience:** *Delivery attempt failed* + reschedule options / hub pickup.
- **Admin action:** ops reassign/reschedule; after N attempts → concierge + options.
- **Automation:** W13 — reschedule (bounded) → escalate → return/abandonment.
- **Notification:** failed-delivery + reschedule.
- **Audit:** attempts + resolution.

## 12. Inspection fails
- **Detection:** inspector/Assistant flag (wrong/damaged/prohibited/mismatch/tamper).
- **User experience:** *Issue found* with proof; concierge-led resolution.
- **Admin action:** compliance/ops decide (`HUMAN-APPROVAL`); halt crossing.
- **Automation:** `inspection_failed` → resolution → refund/return/replace (compensation).
- **Notification:** *Issue found* + options.
- **Audit:** evidence + decision.

## 13. AI makes a low-confidence recommendation
- **Detection:** agent confidence below threshold on a risky decision.
- **User experience:** no visible change (handled internally); avoids a bad automated call.
- **Admin action:** human reviews + decides (`HUMAN-APPROVAL`).
- **Automation:** low-confidence rule → **escalate to human**, never auto-act on risky low-confidence; log for eval.
- **Notification:** none to customer (internal).
- **Audit:** recommendation, confidence, escalation, human decision.

## 14. Duplicate order
- **Detection:** duplicate-signal (same item/customer/time) at intake.
- **User experience:** prompt "did you mean to order twice?" / merge option; avoid double charge.
- **Admin action:** ops confirm/merge/cancel duplicate.
- **Automation:** duplicate detection → flag → review; idempotency prevents double-processing.
- **Notification:** confirmation prompt.
- **Audit:** detection + resolution.

## 15. Fraud suspicion
- **Detection:** fraud signals (velocity, mismatch, high-value new account, payment anomalies, Stripe Radar).
- **User experience:** order held pending verification; KYC/step-up may be requested; respectful framing.
- **Admin action:** compliance/finance review (`HUMAN-APPROVAL`); verify or reject; separation of duties.
- **Automation:** fraud rules → hold + review queue; block auto-progress; possible payout/refund hold.
- **Notification:** verification request (careful tone) / decision.
- **Audit:** signals, decision, rationale (compliance-critical).

---

## 18.1 Cross-cutting principles
- **Never fail silently** — every failure produces a clear customer message + concierge access + an audit record.
- **Human gates on irreversible/risky** — prohibited items, refunds, inspection failures, fraud, low-confidence AI all require `HUMAN-APPROVAL`.
- **Compensation, not corruption** — partial failures roll back side effects (saga); money never left inconsistent (no double charge/refund).
- **Trust under friction** — the worse the situation, the more human, transparent, and proactive the experience (decisive for retention).
- **Feed learnings back** — recurring edge cases inform rules, agent evals, and product fixes.
