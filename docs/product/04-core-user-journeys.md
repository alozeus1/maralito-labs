# 04 · Core User Journeys

Twelve journeys, each with: **Entry point · User actions · System actions · AI agent actions · Human staff actions · Notifications · Data captured · Success state · Failure/edge cases.** Statuses reference the [Order State Machine](./09-order-state-machine.md); agents reference [AI Agents](./12-ai-agent-requirements.md); flows map to [Automation Workflows](./13-automation-workflows.md). Grounded in the Stitch screens (home, new request, journey tracker, inspection).

> Legend: 🤖 AI agent (recommends) · 🧑 human (acts/approves) · `HUMAN-APPROVAL` = required sign-off.

---

## J1 — First-time customer onboarding
- **Entry point:** Welcome screen (Stitch `welcome_to_borderpass`) from app store / referral / marketing.
- **User actions:** Choose language (EN/ES); enter phone → verify (OTP); create account; optionally set Juárez delivery address; see home "Hola [Name]".
- **System actions:** Create User + CustomerProfile (platform Identity); send OTP (Notifications); seed default preferences (language, channel); log audit `user.created`.
- **AI agent actions:** 🤖 Intake Agent primes a "start your first request" prompt; none decisional.
- **Human staff actions:** None (self-serve).
- **Notifications:** *Account created* (welcome, EN/ES) in-app + WhatsApp/SMS.
- **Data captured:** Phone (verified), name, language, default address (optional), consent/ToS acceptance.
- **Success state:** Authenticated user on Home, ready to start a request.
- **Failure/edge cases:** OTP not received (resend/fallback channel); invalid phone; user abandons before verify (no account persisted); duplicate phone (route to login).

---

## J2 — Buy-for-me order
- **Entry point:** Home → "Shop from USA / Comprar en USA" → New Request (Stitch `new_request_flow`, service = **Buy for Me**).
- **User actions:** Step 1 choose service; Step 2 Product Details (paste product URL, qty, size/variant, notes, est. value); Step 3 Border Information (purpose, RFC if business, declared value); review Request Summary (service fee $15 + est. item value + est. duties "Pending AI Calc"); submit.
- **System actions:** Create Order (`draft`→`submitted`) + OrderItem(s); store URL/details; start **New Request Intake** workflow; status timeline begins.
- **AI agent actions:** 🤖 Intake Agent validates completeness, flags missing info; 🤖 Shopping Agent resolves product price/availability from URL; 🤖 Risk & Compliance Agent screens category/value/destination → risk band; 🤖 Quote Agent drafts itemized quote incl. estimated duties.
- **Human staff actions:** 🧑 Reviewer approves risk + quote where flagged (`HUMAN-APPROVAL` for high-risk/high-value; **MVP = manual review for all**).
- **Notifications:** *Request submitted*; later *Missing information* (if needed) or *Quote ready*.
- **Data captured:** Product URL, item attributes, quantity, declared value, purpose, RFC (if any), photos (optional).
- **Success state:** Order reaches `quote_ready`; customer notified to review quote (→ J6).
- **Failure/edge cases:** Missing/invalid info → `missing_information` (J + workflow 2); prohibited item → `rejected` (business rules 08); product URL unresolvable → concierge follow-up; price changed after quote → re-quote.

---

## J3 — Receive-my-package order (Package Reception)
- **Entry point:** Home → "Receive My Packages / Recibir mis paquetes" → New Request (service = **Package Reception**).
- **User actions:** Get/confirm their **BorderPass El Paso Hub address**; enter expected retailer, tracking number, contents, value; upload **receipt/invoice**; submit border info.
- **System actions:** Create Order + Package (expected); associate Hub address; await inbound (`awaiting_package`); on carrier scan/Hub receipt → `received_el_paso`; start inspection.
- **AI agent actions:** 🤖 Intake Agent validates; 🤖 Risk Agent screens declared contents/value; 🤖 Inspection Assistant later matches contents vs. receipt; 🤖 Quote Agent prices service + duties if applicable.
- **Human staff actions:** 🧑 Hub staff receive/scan package; 🧑 Inspector inspects; 🧑 reviewer approves risky cases.
- **Notifications:** *Request submitted*; *Package received*; *Inspection completed*; then quote/payment if fees due.
- **Data captured:** Tracking number, retailer, declared contents/value, receipt/invoice file, Hub address mapping.
- **Success state:** Package received, inspected, and moved into the crossing/delivery path.
- **Failure/edge cases:** Package never arrives (timeout → concierge); mismatch vs. receipt (wrong item — workflow/edge 18); missing receipt (business rule); unexpected/unregistered package at Hub (match workflow).

---

## J4 — Deliver-to-Juárez order
- **Entry point:** Home → "Deliver to Juárez / Entregar en Juárez" (for items already at/with BorderPass or after reception), or continuation of J2/J3 once item is at the Hub.
- **User actions:** Confirm Juárez delivery address + contact; choose delivery preferences (home delivery vs. hub pickup); confirm/authorize duties payment if separate (Stitch "Approve & Pay Duties").
- **System actions:** Generate border documentation (`border_documentation_ready`); set `ready_for_crossing`; create delivery task; progress crossing/customs/arrival statuses; assign driver.
- **AI agent actions:** 🤖 Border Journey Agent assembles customs docs (draft) and narrates stages; 🤖 Operations Coordinator schedules crossing + delivery; 🤖 Finance Agent reconciles duties.
- **Human staff actions:** 🧑 Compliance approves documentation (`HUMAN-APPROVAL`); 🧑 driver/courier delivers; 🧑 ops handles holds.
- **Notifications:** *Border crossing started*; *(Customs delay)* if applicable; *Out for delivery*; *Delivered*.
- **Data captured:** Delivery address, contact, delivery preference, proof of delivery (photo/signature).
- **Success state:** `delivered` with proof; customer confirmation; follow-up.
- **Failure/edge cases:** Customs hold/delay; wrong/incomplete address; failed delivery attempts → reschedule/escalate; customer unreachable.

---

## J5 — Business order
- **Entry point:** Home → "Business Orders / Pedidos empresariales" → New Request (service = **Business Delivery**).
- **User actions:** Provide business details + **RFC**; itemized list (possibly bulk/pallet); upload commercial invoice(s); specify delivery site/schedule; submit.
- **System actions:** Create business-flagged Order; capture RFC + commercial invoice; route to business/priority handling; freight/pallet reception path.
- **AI agent actions:** 🤖 Intake validates business fields; 🤖 Risk & Compliance screens commercial goods + invoice accuracy; 🤖 Quote prices landed cost incl. duties; 🤖 Operations Coordinator plans freight.
- **Human staff actions:** 🧑 Compliance reviews commercial import (`HUMAN-APPROVAL`); 🧑 Finance handles invoicing/RFC; 🧑 dedicated/priority concierge.
- **Notifications:** Business-tone updates; documentation confirmations; scheduled-delivery notices.
- **Data captured:** Business profile, RFC, commercial invoices, itemized goods, delivery schedule, PO (future).
- **Success state:** Documented, compliant business delivery completed with invoice/RFC records.
- **Failure/edge cases:** Invoice/RFC errors; restricted commercial categories; partial shipments; larger-value approvals; net-terms requests (future).

---

## J6 — Quote approval and payment
- **Entry point:** *Quote ready* notification → Orders → Order details → Quote review.
- **User actions:** Review itemized quote (service fee + item value + estimated duties + total); accept or decline; if accept → pay via Stripe (saved or new card).
- **System actions:** Present Quote with expiry; on accept → `awaiting_payment` → create payment intent; on success → `paid`, store receipt; trigger purchasing/fulfilment; on decline/expiry → close or re-quote.
- **AI agent actions:** 🤖 Quote Agent finalizes numbers; 🤖 Finance Agent confirms payment + reconciles; 🤖 Intake transitions order forward.
- **Human staff actions:** 🧑 Finance handles disputes/exceptions only; `HUMAN-APPROVAL` for non-standard pricing/overrides.
- **Notifications:** *Quote ready*; *(Quote expiring reminder)*; *Payment received*.
- **Data captured:** Quote breakdown + version, acceptance timestamp, Payment record (Stripe ref), receipt file.
- **Success state:** `paid`; order moves to purchasing/awaiting package; receipt available.
- **Failure/edge cases:** Payment fails (retry/dunning — edge 18); quote expires (workflow 5 reminder → expire/re-quote); customer disputes amount (concierge); price changed → re-quote before charge.

---

## J7 — Package inspection
- **Entry point:** System-driven after `received_el_paso` (no direct customer entry); customer **views results** later (Stitch `inspection_details` / `package_inspection_details`).
- **User actions:** Receive *Inspection completed* notification; view inspection photos, verified contents, seal number, serial-number match, inspector name.
- **System actions:** Create Inspection record; store photos (Files); set `inspection_pending`→`inspection_passed`/`inspection_failed`; surface customer-facing inspection card with trust chips ("Security Seal Intact", "Verified Receipt", "Verified & Sealed").
- **AI agent actions:** 🤖 Inspection Assistant analyzes photos vs. declared/receipt contents, OCR serial capture + match, flags discrepancies/damage/prohibited (recommend only).
- **Human staff actions:** 🧑 Inspector performs physical inspection, captures photos/serial/seal, completes checklist; 🧑 Compliance reviews flags (`HUMAN-APPROVAL` on fail/discrepancy).
- **Notifications:** *Inspection completed* (with "View Photos"); *Issue found* if discrepancy.
- **Data captured:** Inspection photos, checklist results, serial number, seal number, inspector id, condition notes, AI risk score.
- **Success state:** `inspection_passed`; package sealed (tamper-evident) and queued for crossing; customer sees proof.
- **Failure/edge cases:** `inspection_failed` (wrong/damaged/prohibited item — edge 18) → customer contact + refund/return decision; OCR no-match → manual verify; missing receipt at inspection.

---

## J8 — Border crossing tracking
- **Entry point:** Orders → Order details → **Border Journey** (Stitch `border_journey_tracker_1/2`); proactive notifications.
- **User actions:** Watch the vertical timeline (Purchased → Received → Inspection → Border Crossing → Customs → Driver Assigned → Delivered); read stage messages; tap "View Photos"; contact concierge.
- **System actions:** Map order statuses to Border Journey stages (10); update "Arriving Tomorrow"/ETA + tracking id (e.g., BP-8492-MX); show current location ("Approaching Zaragoza Port of Entry"); push stage notifications.
- **AI agent actions:** 🤖 Border Journey Agent computes ETA, writes stage narration, predicts/explains delays; 🤖 Operations Coordinator updates crossing/customs state.
- **Human staff actions:** 🧑 Ops/compliance resolve customs holds; 🧑 concierge answers questions.
- **Notifications:** *Border crossing started*; *(Customs delay)*; *Out for delivery* — EN/ES.
- **Data captured:** Stage timestamps, current location, ETA, tracking id, delay reasons.
- **Success state:** Customer always knows where the package is and what's next; arrives as forecast.
- **Failure/edge cases:** Customs delay/hold (delay notification + reason); ETA slips (proactive update); tracking gap (concierge reassurance); crossing rejected (compliance path).

---

## J9 — Delivery confirmation
- **Entry point:** `out_for_delivery` → delivery attempt.
- **User actions:** Receive *Out for delivery* + window; be available; receive package; (optional) confirm receipt / rate; view proof.
- **System actions:** Driver task; capture proof of delivery (photo/signature); set `delivered`; close order; schedule satisfaction follow-up; update analytics.
- **AI agent actions:** 🤖 Operations Coordinator confirms completion; 🤖 Support Agent triggers follow-up; 🤖 Border Journey Agent fires "Delivered" celebration (Stitch confetti moment).
- **Human staff actions:** 🧑 Driver completes delivery + proof; 🧑 support handles disputes.
- **Notifications:** *Delivered* (confirmation + proof); follow-up (satisfaction / reorder offer).
- **Data captured:** Delivery timestamp, proof image/signature, recipient, satisfaction (optional).
- **Success state:** `delivered` confirmed with proof; happy customer; reorder prompt.
- **Failure/edge cases:** No one to receive → reschedule; disputed delivery ("not received") → investigation (proof) + support; wrong address (edge 18).

---

## J10 — Customer support escalation
- **Entry point:** Any screen → Concierge chat / WhatsApp / Support; or system auto-escalation (SLA breach, exception).
- **User actions:** Message the concierge (Stitch concierge card: "Maria G." with WhatsApp + Live Chat); describe issue; attach photo if needed.
- **System actions:** Create SupportTicket with full order context (correlation id); route by category/priority; SLA timers.
- **AI agent actions:** 🤖 Customer Support Agent triages, classifies, drafts reply, suggests resolution; never auto-sends sensitive actions; hands off to human.
- **Human staff actions:** 🧑 Concierge/support resolves; specialist (finance/compliance) for refunds/holds (`HUMAN-APPROVAL`).
- **Notifications:** *Support reply*; status updates on the issue.
- **Data captured:** Ticket, category, severity, messages, linked order, resolution, satisfaction.
- **Success state:** Issue resolved within SLA; customer reassured; learnings fed back.
- **Failure/edge cases:** Customer unreachable; SLA breach → escalate (lead/manager); sensitive request (refund/fraud) → specialist queues.

---

## J11 — Refund / cancellation
- **Entry point:** Order details → "Cancel / Request refund"; or via concierge; or system-initiated compensation (e.g., inspection failed, undeliverable).
- **User actions:** Request cancel/refund with reason; review eligibility (business rules 08); confirm.
- **System actions:** Evaluate eligibility by current status (cancellable before purchase vs. after); compute refund amount/fees; on approval → process Stripe refund → `refunded`/`cancelled`; reverse related tasks (compensation).
- **AI agent actions:** 🤖 Finance Agent assesses eligibility + amount (recommend); 🤖 Support Agent communicates.
- **Human staff actions:** 🧑 Finance approves refunds above threshold (`HUMAN-APPROVAL`); 🧑 Compliance if risk-related; separation of duties (requester ≠ approver).
- **Notifications:** Cancellation confirmation; *Refund processed* (amount + timeline).
- **Data captured:** Refund reason code, eligibility decision + rationale, amount, approver, ledger entry.
- **Success state:** Refund/cancel processed correctly; ledger consistent; customer informed.
- **Failure/edge cases:** Non-refundable stage (already purchased/crossed) → partial/none + explanation; refund execution fails (retry; never double-refund); abuse pattern → review.

---

## J12 — Reorder previous purchase
- **Entry point:** Orders → past order → "Reorder"; or Home reorder prompt; or post-delivery follow-up.
- **User actions:** Select a previous order; confirm/adjust item, quantity, address; submit.
- **System actions:** Clone prior Order/OrderItem data into a new `draft`→`submitted`; pre-fill details; run intake (lighter if previously approved).
- **AI agent actions:** 🤖 Intake pre-validates from history; 🤖 Shopping Agent re-checks price/availability; 🤖 Risk Agent re-screens (cannot assume prior approval valid); 🤖 Quote re-prices.
- **Human staff actions:** 🧑 Review only if newly flagged.
- **Notifications:** *Request submitted*; *Quote ready* (price may differ).
- **Data captured:** Source order id, changed fields, new quote.
- **Success state:** Fast re-purchase with minimal re-entry; quote ready quickly.
- **Failure/edge cases:** Price/availability changed → re-quote; item now prohibited/restricted → reject with explanation; address changed.

---

## Journey → workflow / status cross-reference

| Journey | Primary workflows (13) | Key statuses (09) |
|---------|------------------------|-------------------|
| J1 Onboarding | — | (account) |
| J2 Buy-for-me | 1,2,3,4 | submitted→under_review→quote_ready |
| J3 Receive package | 1,8,9 | awaiting_package→received_el_paso→inspection_* |
| J4 Deliver to Juárez | 10,11,12 | border_documentation_ready→delivered |
| J5 Business order | 1,3,4 | submitted→…→delivered |
| J6 Quote & payment | 4,5,6 | quote_ready→awaiting_payment→paid |
| J7 Inspection | 8,9 | received_el_paso→inspection_passed/failed |
| J8 Crossing tracking | 10,11 | ready_for_crossing→arrived_juarez |
| J9 Delivery | 12 | out_for_delivery→delivered |
| J10 Support | 15 | (any) |
| J11 Refund/cancel | 14 | cancelled/refunded |
| J12 Reorder | 1–6 | draft→…→paid |
