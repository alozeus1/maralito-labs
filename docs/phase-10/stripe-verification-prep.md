# Stripe Business Verification — Preparation Sheet

> **For:** the BorderPass account owner. **This is the gather-then-submit sheet**, not the go-live
> checklist. `docs/production-readiness/stripe-live-checklist.md` remains the operative document for
> flipping live keys; this covers only §2 of it — account and business verification — which has
> **lead time measured in days** and is the reason to start now.
>
> **Nothing here takes a payment or creates a live key.** Verification is an onboarding and identity
> process. Live keys stay untouched until every precondition in the live checklist §1 is met.

---

## 0. Read this first — verification is not fully parallel with the legal review

The live checklist calls §1 (preconditions) and §2 (verification) parallel. They are *mostly* parallel,
but there is one real dependency, and one shared blocker:

- **Dependency.** Stripe requires a reachable **business website URL, support email, refund policy and
  terms** in account settings, and it checks them. Those come from the legal review (P5). You can open
  the account, submit entity and identity details, and clear most requirements before counsel finishes
  — but **the account will not fully approve until the legal pages are live**.
- **Shared blocker.** Both need the **legal entity**. It is a placeholder in both legal documents
  (`[RAZÓN SOCIAL / ENTIDAD LEGAL PENDIENTE]`) and Stripe needs the correct legal entity — a business
  account for that entity, explicitly not a personal one.

**Practical order:** confirm the legal entity → open/verify the Stripe account with entity, identity
and bank details → publish counsel-approved legal pages → enter those URLs in Stripe → account fully
approved.

---

## 1. Gather before you open the dashboard

Have these to hand; verification stalls mid-flow otherwise.

- [ ] **Legal entity name and registered address** — exactly as registered. Same value that resolves the
      placeholder in the legal documents.
- [ ] **Tax identification** for that entity.
- [ ] **Bank account for payouts**, in the entity's name.
- [ ] **Identity documents for the account representative** — the individual Stripe verifies.
- [ ] **Support email** on a monitored inbox — not a personal address, and not one that only forwards.
- [ ] **Business website URL** — the production domain. It must be reachable when Stripe checks it.

---

## 2. Decisions BorderPass needs from you

These are not paperwork; they are product decisions that change customer-visible behaviour, and two of
them have downstream engineering consequences.

| Decision | Why it matters | Consequence if wrong |
|---|---|---|
| **Statement descriptor** | It is what a Ciudad Juárez customer sees on their card statement | An unrecognised descriptor is the **single largest driver of "I don't recognise this charge" disputes**. Choose something a customer will connect to BorderPass, not the legal entity name if those differ. |
| **Settlement currency** | Must match `STRIPE_PAYMENT_CURRENCY` in the app | A mismatch between what the app charges and what the account settles is a config error that surfaces as failed or wrongly-priced payments |
| **Entity may charge customers in Mexico** | The US↔MX flow depends on it | Confirm supported countries and currencies **in the official Stripe documentation for your account country — do not assume**, and do not take our word for it |
| **Refund policy** | Stripe requires it published; it is also item 4 of the counsel brief | Answer it once, in the legal review, and reuse it here |

---

## 3. Account hygiene — do these during setup, not later

- [ ] **2FA enforced for every dashboard user.** No shared logins.
- [ ] **Dispute and payout notification emails route to a monitored inbox.** A dispute has a response
      deadline; an unread notification is a lost dispute.
- [ ] **Radar reviewed, default fraud protection on.**
- [ ] Team access reviewed — least privilege, no standing admin for people who do not need it.

---

## 4. What NOT to do yet

- [ ] 🔴 **Do not create or install live API keys.** Live keys come only after live-checklist §1
      preconditions pass. A live key in Preview turns a test click into a real charge.
- [ ] 🔴 **Do not register the live webhook endpoint yet.** It needs the production domain, which needs
      the production environment, which is blocker B1.
- [ ] 🔴 **Do not take a real payment**, including a test of your own, until the live checklist §4
      round-trip — which is done deliberately, for a token amount, with the kill-switch rehearsed
      first.
- [ ] **Never paste a key value** into a file, commit, ticket or chat. Names only.

---

## 5. Definition of done for this sheet

- [ ] Stripe dashboard shows **no outstanding requirements** for the business account.
- [ ] Identity verification for the representative is complete.
- [ ] Payout bank account verified.
- [ ] Statement descriptor set and recorded here: `________________`
- [ ] Settlement currency confirmed and matches `STRIPE_PAYMENT_CURRENCY`: `________________`
- [ ] Supported-countries/currencies confirmation for US↔MX recorded, with a link to the official Stripe
      documentation you verified it against.
- [ ] 2FA enforced; dispute/payout emails routing to a monitored inbox.
- [ ] Website URL, support email, refund policy and terms entered — **pending the legal pages going
      live**, which is tracked separately.

When every box above is ticked, §2 of the live checklist is satisfied. **That is not permission to go
live** — it means one of twelve preconditions is met.

---

*Verification is an onboarding process, not a launch. Stripe LIVE (ledger row 15) still requires owner
approval and every live-checklist §1 precondition.*
