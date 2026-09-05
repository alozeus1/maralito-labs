# BorderPass — Counsel Review Brief

> **For:** external counsel (Mexican data-protection + consumer law; U.S./MX cross-border commerce).
> **From:** the BorderPass engineering team.
> **Purpose:** obtain the legal review and sign-off required before BorderPass processes any real
> customer personal data or takes any real payment.
>
> **This brief is self-contained.** You do not need access to the codebase. Where we reference a file,
> it is so our engineers can act on your answer, not something you need to read.
>
> **Nothing described here is live.** BorderPass is development-only. No real customer data has been
> collected, no real payment has been taken, and no legal document has been published to a real user.
> Both documents currently carry a visible "Draft — pending legal review" banner, in Spanish and
> English, which we will remove **only** on your sign-off.

---

## 1. The single blocking question

**What is the legal entity, and its registered address?**

Both documents carry the placeholder `[RAZÓN SOCIAL / ENTIDAD LEGAL PENDIENTE]`. This is mandatory
content for a Mexican *aviso de privacidad* (the identity and address of the *responsable*), and it is
also required by Stripe to open a business account. It therefore blocks both the legal review and the
payment provider onboarding. **If only one thing is answered first, make it this.**

---

## 2. What BorderPass does

BorderPass is a cross-border purchase-and-delivery service between the United States and Mexico,
serving customers in Ciudad Juárez.

A customer flow:

1. Customer creates an account (email one-time code — no password).
2. Customer submits a request for goods to be purchased in the U.S.
3. BorderPass returns a quote.
4. Customer accepts and pays online by card.
5. The goods are purchased, inspected, cross the border, and are delivered to a Mexican address the
   customer supplies.
6. The customer receives status and receipt emails throughout.

Relevant characteristics:

- **Customers are individuals in Mexico.** The service, the delivery address and the recipient are
  Mexican; the purchase and part of the processing are in the United States.
- **Card data never touches our systems.** Payment is by Stripe. We never see, transmit or store a card
  number. We hold a Stripe payment identifier only.
- **We do store delivery and contact PII:** recipient name, street address, city, state, postal code and
  phone number.
- **We do not currently capture IP address or user-agent** on consent records. This was a deliberate
  data-minimisation choice; see question 9.

---

## 3. Data flows and storage

| Data | Collected | Stored where | Notes |
|---|---|---|---|
| Email address | at sign-up | database (Supabase, U.S. region) | account identifier |
| Recipient name, street, city, state, postal, phone | at address entry | database, **encrypted at rest** | delivery address |
| Order, quote, payment status | throughout | database | no card data |
| Card details | never | never — Stripe only | we hold an identifier only |
| Consent record | at sign-up | database | document type + version + timestamp |

**Cross-border position:** the customer and the delivery address are in Mexico; the database and
application hosting are in the **United States**. Personal data is therefore transferred to and stored
outside Mexico. Question 8 asks you to confirm the lawful basis for this.

**Two statements in the draft Privacy Notice are engineering commitments we will keep true:**

1. Card data is handled by Stripe and never stored by BorderPass. *(True today.)*
2. Delivery address and contact PII are encrypted at rest. *(The encryption design is built; the
   production key-management service is not yet enabled. **The notice will not be published until it
   is.**)*

If either ceases to be true, we change the copy in the same change that breaks it.

---

## 4. What we have drafted

Both documents exist in Spanish and English, and are versioned so we can prove which text a given
customer accepted.

- **Terms of Service** — 14 sections: who we are; the service; accounts; requests and quotes; payments;
  cancellations, refunds and disputes; restricted and prohibited items; inspection, crossing and
  delivery; customer responsibilities; limitation of liability; suspension and termination; changes;
  governing law and venue; contact.
- **Privacy Notice / Aviso de Privacidad** — 15 sections: who is responsible; what we collect; card
  data; purposes; secondary (optional) purposes; who we share with; transfers and storage outside
  Mexico; how we protect data; retention; ARCO rights; how to exercise them; cookies; children;
  changes; contact.

They were drafted by engineers as a structural starting point. **They are a template, not advice**, and
several clauses were deliberately left unwritten rather than guessed — see §5.

---

## 5. What we need you to resolve

Ten items. Where we say "deliberately left unwritten," we mean an engineer declined to invent a clause
that carries legal consequence.

1. **Legal entity and registered address.** See §1. Blocks everything.
2. **Governing law and venue.** Currently an explicit placeholder.
3. **Limitation of liability.** *Deliberately left unwritten.* We understand Mexican consumer-protection
   law limits the enforceability of certain exclusions, and we did not want to draft a clause that is
   either unenforceable or unfair. Please supply it.
4. **Refund window, non-refundable amounts, and the dispute/*aclaración* procedure.** Our system
   supports refunds and disputes technically; the policy is yours to set. Stripe also requires a
   published refund policy before it will approve the account.
5. **Prohibited and restricted items.** Our current list is illustrative only. It needs validating
   against U.S. export rules and Mexican import rules — we expect this needs a licensed customs broker
   as well as counsel.
6. **Retention periods.** The fiscal/accounting retention period is a placeholder. We need a concrete
   number per data category so we can build automated deletion; "as long as necessary" is not
   implementable.
7. **ARCO procedure and statutory response deadline.** The formal procedure and timeline are
   placeholders.
8. **Cross-border transfer basis.** Which transfers require express consent, and which fall within a
   statutory exception? This determines whether our consent flow needs an additional, separately
   recorded consent.
9. **Sufficiency of consent evidence.** We record: user, document type, document version, timestamp,
   and the source of the consent event. We do **not** record IP address or user-agent, on
   data-minimisation grounds. Is that record sufficient proof of consent, or must we capture more? We
   would rather add a field now than discover the gap later.
10. **Consumer-law disclosures** that a cross-border purchase-and-import service may owe in Mexico and
    which our drafts do not represent at all.

---

## 6. What we need back, and in what form

1. **Approved final text** for both documents, in Spanish and English, with the placeholders resolved.
   Spanish is the operative language for Mexican customers; we will publish both.
2. **A concrete retention schedule** — a number per data category, so it can be automated.
3. **A yes/no on the consent-evidence question (9)**, and if no, the additional fields required.
4. **Written sign-off** that the reviewed text may be published to real users. We record this against
   the gate that currently blocks launch; without it, the "pending legal review" banner stays and no
   real customer data is collected.

**Re-consent:** each document carries a version string stamped onto every consent record. If you
materially change either text later, we bump the version and re-prompt existing users. Please tell us
if any of your changes is material in that sense.

---

## 7. What is *not* being asked

To keep the scope clear: we are not asking for corporate structuring, tax advice, employment advice,
or customs brokerage. Item 5 likely needs a customs specialist alongside you; we are happy to engage
one separately if you would prefer to scope out import/export classification.

---

*Prepared by the BorderPass engineering team. BorderPass remains development-only until this review
completes and the remaining production gates pass.*
