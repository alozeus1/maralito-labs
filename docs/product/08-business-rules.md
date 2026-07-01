# 08 · Business Rules

Stated as **if/then** rules. These drive the [Rules Engine](../maralito-platform/automation/docs/07-rules-engine.md), [Risk Agent](./12-ai-agent-requirements.md), and [Order State Machine](./09-order-state-machine.md). **Compliance/customs values below are placeholders pending licensed review** — every threshold and category list marked `⚠️ VERIFY` must be confirmed with Mexican customs/import counsel before launch.

> Roles: AI agents may **recommend**; `HUMAN-APPROVAL` decisions need a human. Thresholds (e.g., "high value") are config in the rules engine, tunable without redeploy.

---

## 8.1 Accepted item categories
- **IF** item ∈ {apparel, footwear, beauty/cosmetics, consumer electronics & accessories, home goods, toys, books, sporting goods, small appliances, auto parts (non-hazmat), business supplies/tools} **THEN** allow, subject to value + documentation rules. `⚠️ VERIFY` full allow-list with customs.
- **IF** item is a regulated-but-permitted category (e.g., certain electronics, supplements, commercial goods) **THEN** require additional documentation + `HUMAN-APPROVAL`.

## 8.2 Prohibited item categories
- **IF** item ∈ {weapons/firearms/ammunition, explosives, illegal drugs/controlled substances, hazardous materials, perishable food (restricted), live animals/plants (restricted), counterfeit goods, currency/precious metals above limits, items restricted by Mexican import law} **THEN** **reject** the order (`rejected`), notify customer with reason, log audit. `⚠️ VERIFY` prohibited list with counsel.
- **IF** item is **ambiguous/uncertain** category **THEN** route to `under_review` with `HUMAN-APPROVAL` (never auto-accept uncertain).

## 8.3 Manual review triggers (MVP: all orders; post-MVP: rules-based)
- **IF** MVP **THEN** every order → `under_review` (human) before quote.
- Post-MVP, **IF** any of: risk band ≥ MEDIUM, declared value ≥ high-value threshold, prohibited/regulated-adjacent category, missing/!matching receipt, new customer's first order, RFC/commercial import, sanctioned/unusual destination, duplicate-order signal, fraud signal **THEN** → `under_review` + `HUMAN-APPROVAL`.
- **ELSE** (low-risk, reversible, known customer) **THEN** may auto-approve (V1+).

## 8.4 High-value order rules
- **IF** declared/quoted value ≥ **Tier-1 threshold** (`⚠️ VERIFY`, e.g., USD X) **THEN** require `HUMAN-APPROVAL` (finance + compliance) + enhanced documentation + possibly prepayment of duties.
- **IF** value ≥ **Tier-2 threshold** **THEN** additionally require identity verification (KYC) and commercial-import treatment where applicable.
- **IF** value triggers formal customs entry thresholds **THEN** require broker/commercial-invoice handling. `⚠️ VERIFY` thresholds.

## 8.5 Missing receipt rules
- **IF** order requires a receipt (reception / declared-value / commercial) **AND** none uploaded **THEN** → `missing_information`, request receipt (workflow 2), pause quoting.
- **IF** receipt absent at inspection time **THEN** hold (`inspection_pending`) + concierge follow-up; **do not** cross without required documentation.
- **IF** buy-for-me **THEN** BorderPass generates the purchase receipt (staff uploads proof of purchase).

## 8.6 RFC / tax ID rules
- **IF** order is **business/commercial** OR value ≥ commercial threshold **THEN** require valid **RFC**; **IF** missing/invalid **THEN** `missing_information`.
- **IF** consumer order below commercial threshold **THEN** RFC optional.
- **IF** RFC provided **THEN** validate format and use on issued invoice. `⚠️ VERIFY` RFC validation + invoicing/tax obligations with accountant/counsel.

## 8.7 Payment rules
- **IF** quote accepted **THEN** require successful payment before purchasing/fulfilment (`paid` gate); no fulfilment on unpaid orders.
- **IF** duties are separate/variable **THEN** may require **duty payment** before crossing/delivery ("Approve & Pay Duties").
- **IF** payment fails **THEN** retry/dunning (N attempts) then hold; never proceed unpaid.
- **IF** payment succeeds **THEN** issue receipt, advance order, reconcile to ledger (idempotent).
- All money movement via **Stripe** (platform Payments); no raw card data stored.

## 8.8 Refund rules
- **IF** order in {draft, submitted, under_review, quote_ready, awaiting_payment} **THEN** cancel with **no/low fee** (nothing purchased yet).
- **IF** `paid` but **not yet purchased** **THEN** refund minus non-recoverable fees (e.g., service fee may be partially retained) per policy.
- **IF** **purchased** / item in transit / crossed **THEN** refunds limited — case-by-case, may require return; `HUMAN-APPROVAL` (finance).
- **IF** inspection fails / wrong-damaged item / undeliverable **THEN** customer eligible for refund/replacement (BorderPass-fault path) → `HUMAN-APPROVAL`.
- **IF** refund amount ≥ threshold OR risk-related **THEN** finance (+compliance) approval, separation of duties. Refund execution idempotent (never double-refund).

## 8.9 Quote expiration rules
- **IF** quote issued **THEN** set expiry (`⚠️ VERIFY`, e.g., 48–72h; price/duty validity).
- **IF** expiry − reminder window reached **AND** unpaid **THEN** send *quote expiring* reminder (workflow 5).
- **IF** expired **AND** unpaid **THEN** mark expired; customer may request re-quote (prices may change).
- **IF** underlying price/availability changed before payment **THEN** re-quote before charging.

## 8.10 Delivery failure rules
- **IF** delivery attempt fails (no recipient/bad address) **THEN** → `delivery_failed`, notify, schedule re-attempt (up to N).
- **IF** N attempts exhausted **THEN** escalate to concierge + offer hub pickup / reschedule / return.
- **IF** address invalid **THEN** request correction before re-attempt.
- **IF** unclaimed after grace period **THEN** package-abandonment rule (8.13).

## 8.11 Inspection failure rules
- **IF** inspection finds wrong item / damage / prohibited content / receipt mismatch **THEN** → `inspection_failed`, halt crossing, notify customer, `HUMAN-APPROVAL` for resolution (refund/return/replace).
- **IF** serial/seal mismatch or tamper evidence **THEN** hold + compliance review.
- **IF** minor/correctable issue **THEN** concierge resolves with customer before proceeding.

## 8.12 Customer cancellation rules
- **IF** customer cancels in a cancellable status (8.8) **THEN** process per refund rules; confirm.
- **IF** cancel after purchase/crossing **THEN** limited; explain non-refundable components; `HUMAN-APPROVAL`.
- **IF** repeated late cancellations (abuse) **THEN** flag account for review.

## 8.13 Package abandonment rules
- **IF** package at Hub/Juárez unclaimed or order unpaid beyond grace period (`⚠️ VERIFY`, e.g., 30 days) **THEN** send escalating reminders; **IF** still unresolved **THEN** apply storage fees / return / disposal per ToS, with audit. `⚠️ VERIFY` legal handling of abandoned goods.

## 8.14 Support escalation rules
- **IF** SLA breach (first response / resolution) **THEN** escalate to lead → manager.
- **IF** issue category ∈ {refund, fraud, compliance, customs hold, lost/damaged} **THEN** route to specialist queue + `HUMAN-APPROVAL` for resolution.
- **IF** customer sentiment/severity high (no-visa persona, high-value) **THEN** prioritize + human-led.
- **IF** AI confidence low on a recommendation **THEN** escalate to human (never act on low-confidence risky calls).

---

## Rule governance
- Thresholds/categories live in the **rules engine** (versioned, testable, tenant-tunable) — not hard-coded.
- **Risk/pricing/compliance rule changes require review + audit** (money/legal exposure).
- Every rule decision used in an order records **matched rules + rationale** (explainability) to audit.
- **`⚠️ VERIFY` master list** (resolve before launch): accepted/prohibited categories, value thresholds, formal-entry thresholds, RFC/invoicing/tax obligations, duty rates, abandoned-goods handling, insurance/money-back terms — all need **licensed customs/legal/tax review**.
