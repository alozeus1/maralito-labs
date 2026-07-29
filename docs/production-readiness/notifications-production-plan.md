# Notifications Production Plan — Synthetic → Real Recipients

> **Scope:** closes **B4** of `docs/phase-9/production-readiness-review.md` and the gated tail of
> `docs/phase-8/8c-completion-report.md` (8C.4 + the real-recipient resolver).
> **Status:** the send path is **built, idempotent, and shipping dark**. **No real customer has ever
> received an email from BorderPass, and none may until §2 and §3 are complete.**
> Nothing here changes a gate status.

**Legend** — ✅ **DONE** (verified in-repo) · 🟠 **OPERATOR ACTION REQUIRED** · 🔴 **BLOCKED**.

---

## 1. Where this actually is today ✅

| Component | File | State |
|---|---|---|
| Outbox dispatcher — claims `queued → sending`, stale-claim lease (10 min), retry vs terminal | `src/server/notification-dispatch.ts` | ✅ |
| Resend transport — `From` **only** from server env, plain-text alternative, tags, kill-switch, safe-recipient redirect | `src/server/resend.ts` | ✅ |
| Suppression list — SHA-256 of the lowercased address; **no recipient stored at rest** | `src/server/email-suppression.ts` | ✅ |
| Delivery webhook — Svix-signed, idempotent on Svix id, writes suppressions | `app/api/webhooks/resend/route.ts` | ✅ |
| Authed dispatch trigger | `app/api/automation/dispatch-notifications/route.ts` | ✅ |
| Authed delivery-status callback | `app/api/automation/notification-status/route.ts` | ✅ |
| Shared constant-time automation auth | `src/server/automation-auth.ts` | ✅ |
| Middleware bypass for `/api/automation/*` | Phase-9 review D2 — **fixed in repo, never re-tested live** (`automation-api-verification.md`) | 🟠 |
| **Real-recipient resolver** | — | 🔴 **does not exist** |
| **n8n workflows activated** | — | 🔴 **not wired** |

### The two facts that make this safe today

1. **The outbox stores no recipient.** `notification_outbox` has `org_id`, `customer_id`, `order_id`,
   `template_key`, `status`, `idempotency_key`, `provider_message_id` — and no address, name, or body.
2. **`resolveRecipient` is injected.** The only wired resolver returns `DEV_SYNTHETIC_NOTIFY_EMAIL` or
   `null`. `null` → the row is skipped, never sent. With no Resend key or no `BORDERPASS_APP_URL`, the
   dispatcher returns an empty summary without touching a single row.

**Email bodies are already non-PII** (a line of copy plus a link to the order — no names, amounts, or
addresses). Keep it that way: it means a mis-delivered email leaks nothing but the existence of an order.

---

## 2. Turning on real recipients

### 2.1 Where the recipient address actually comes from 🔴 DECISION REQUIRED

**There is no customer email column anywhere in the app schema.** `customer_profiles` has
`display_name`, `language`, `notification_prefs` — no contact address. The only copy of a customer's
email is **Supabase `auth.users.email`**.

| Option | How | Verdict |
|---|---|---|
| **A — read `auth.users.email` at dispatch time (RECOMMENDED)** | `withPrivilegedDbAccess('notifications.resolve')` joins `customer_profiles.auth_user_id → auth.users.id`, reads `email`, uses it, discards it | **One** copy of the address, in the identity store that already owns it. Deletion is one place. Adds **no** new PII at rest. |
| B — store a contact address in `encrypted_pii` | New `subjectType: 'customer_contact'` via `pii-vault.ts` | Only if a *notification* address must differ from the *login* address. Creates a second PII copy to protect, rotate, and delete. Defer. |
| C — put an email column on `customer_profiles` | — | 🔴 **Rejected.** Plaintext PII in a tenant-readable table. |

**Take Option A.** Adopt B later only if the product genuinely needs a separate notification address.

> **Honest gating note.** 8C says real recipients are "gated on 8B (KMS)". Under Option A that is
> **not strictly true** — resolving from `auth.users` stores no new PII, so the KMS envelope is not
> mechanically required to *send*. The real blockers are **consent + legal (§3 N1/N2)** and **owner
> sign-off**, plus `kms-production-plan.md` §0 (the same customers whose addresses would be stored by the
> fail-open path). Do not use "KMS is done" as a proxy for "we may email real people." They are
> different questions.

### 2.2 The resolver contract 🔴 TO BUILD

`resolveRecipient(row) → string | null`. It must return `null` — never throw, never guess — unless
**every** one of these holds:

```
 1. BORDERPASS_ENV === 'production'                    (else fall back to the synthetic resolver)
 2. EMAIL_DELIVERY_ENABLED !== 'false'
 3. EMAIL_SAFE_RECIPIENT is UNSET                       (a set value means "this is not production")
 4. owner sign-off flag present (§3 N6)                 explicit, not implied by the above
 5. a consent_records row exists for this customer:
        type = transactional notifications, granted = true, latest version, not withdrawn
 6. the resolved address is non-empty and syntactically valid
 7. hashEmail(address) is NOT in email_suppressions     (dispatcher re-checks; check early to save a call)
 8. the customer's notification_prefs do not opt out of this channel
```

Any miss → `null` → row `skipped`, and the row stays in the outbox for a later pass. **Fail closed and
silent — never send "just in case."**

Additional rules:
- **Transactional vs marketing.** Only transactional templates (`payment_receipt`, `inspection_update`,
  `delivery_update`) may use transactional consent. Marketing needs its own consent type and its own
  unsubscribe path. Never send marketing through this outbox.
- **Never log the resolved address.** Log `{ event, outbox_id, resolved: true|false, reason }` only.
- Unit-test the resolver's **deny** paths first — they are the safety property.

### 2.3 Suppression, bounce, and complaint handling ✅ built / 🟠 to verify

The mechanism exists and is well designed (hash-only, no address at rest). What is missing is proof and
policy:

- [ ] 🟠 Verify the **live** Resend webhook: signature valid → 2xx; **invalid/absent → 4xx and no write**.
- [ ] 🟠 Verify Svix-id dedupe with a replayed event → exactly one `resend_webhook_events` row.
- [ ] 🔴 **Policy gap: `bounced` is treated the same as `complained` — permanent suppression.** Confirm the webhook only suppresses on **hard** bounces. A soft bounce (full mailbox, temporary greylisting) must **not** permanently suppress a paying customer. Verify the exact Resend event/type names and their soft-vs-hard semantics **in the official Resend documentation** and gate accordingly.
- [ ] 🔴 **There is no un-suppression path.** A customer who bounced once can never be emailed again, with no admin way to clear it. Add an audited, admin-only un-suppress action before go-live — otherwise a bad bounce silently and permanently breaks receipts for a real paying customer.
- [ ] 🔴 **Suppression must be visible.** A suppressed customer never gets a receipt and nobody finds out. Surface "notifications suppressed" on the admin order view, and alert when a `payment_receipt` row is skipped for suppression.
- [ ] 🟠 Confirm the **complaint (spam) rate** is monitored. Rising complaints on transactional mail usually means the `From` domain or the copy looks like marketing.

### 2.4 Deliverability 🟠 OPERATOR

- [ ] Verify the sending domain in Resend: **SPF, DKIM, and DMARC** all passing. **Verify current DNS record requirements in the official Resend documentation.**
- [ ] Use a **subdomain** for sending (the repo already assumes `notifications.maralito.uk`) so transactional reputation is isolated from the root domain.
- [ ] Set a **DMARC policy** with a reporting address, starting at `p=none` and tightening once clean.
- [ ] `EMAIL_REPLY_TO` must be a **monitored human inbox**. Customers will reply to receipts.
- [ ] Send Spanish-language copy to Spanish-speaking customers — `customer_profiles.language` exists and defaults to `es`. Templates are currently English-only. 🔴 **Ciudad Juárez customers receiving English-only receipts is a product defect, not just a nicety.**
- [ ] Warm up gradually: transactional volume will be low, but do not batch-send to a cold domain.

---

## 3. Gate checklist — before the first real send

| # | Gate | Owner | State |
|---|---|---|---|
| N1 | **Terms + Privacy reviewed by counsel**, banners removed | owner + counsel | 🔲 `legal-consent.md` |
| N2 | **Consent capture live** — versioned, auditable, transactional separate from marketing | dev | 🔲 |
| N3 | 🔴 `kms-production-plan.md` **§0 fail-open path closed** (same customers, same PII) | dev | 🔲 |
| N4 | Resolver built, **deny-path unit tests green**, code-reviewed | dev | 🔲 |
| N5 | Un-suppression + suppression-visibility built (§2.3) | dev | 🔲 |
| N6 | **Owner sign-off**, in writing, to email real customers | owner | 🔲 |
| N7 | SPF/DKIM/DMARC verified on the production domain | operator | 🔲 |
| N8 | Live webhook signature + dedupe verified in production | operator | 🔲 |
| N9 | `/api/automation/*` middleware bypass **re-tested live** (Phase-9 D2) | operator | 🔲 `automation-api-verification.md` §7 |
| N10 | n8n workflows active with `errorWorkflow` set (§4) | operator | 🔲 |
| N11 | **One real end-to-end send to the owner's own inbox**, then delivery status observed back on the outbox row | operator | 🔲 |
| N12 | Alerting live for dispatch failures and suppression skips | operator | 🔲 `observability-and-alerting.md` |

**N11 is the gate.** A notification system that has never delivered to a real inbox is not a notification
system. Do not enable Stripe LIVE before N11 — see `stripe-live-checklist.md` P11.

---

## 4. n8n workflows to activate 🟠 OPERATOR

Boundary is fixed by **ADR-0016** and is not negotiable: **n8n has no database credentials, never holds
`service_role`, never writes Postgres, and never re-implements domain logic.** It is a scheduled trigger
and a SaaS courier. The app remains the idempotency authority and the owner of the ledger.

| Workflow | Id | Role | Action |
|---|---|---|---|
| **Dispatch prototype** | `XHdmWOckUapDWAAN` | Scheduled trigger → `POST /api/automation/dispatch-notifications` | Point at the **production domain**; attach the `x-borderpass-secret` credential; send `{ max: <small> }`; set a sane interval (every 1–5 min is plenty). |
| **Notification Router** | `IUSMhbApLaEBCVG2` | Fan-out of ops alerts to humans | Front it with the alert sources in `observability-and-alerting.md` §7. |
| **Global Error Handler** | `0RcqLu1uY5cQUjye` | Platform-wide failure catcher | Set as `errorWorkflow` on **every** BorderPass workflow. A dispatch workflow that fails silently is worse than none. |

Delivery/status events flow back through `POST /api/automation/notification-status`, which updates the
**existing** outbox row by id — idempotent and non-regressing (a terminal state is never overwritten; it
returns 409).

### 4.1 Auth model ✅ built / 🟠 to configure
- Header `x-borderpass-secret`, compared **constant-time** against `N8N_WEBHOOK_SECRET`; unset secret or
  mismatch → **401**. Fail-closed by construction (`automation-auth.ts`).
- 🟠 The secret lives **only** in the n8n credential store and Vercel Production. Never in a workflow text
  field, never in the repo, never `NEXT_PUBLIC_`.
- 🟠 Use a **distinct secret per environment**. An n8n workflow pointed at the wrong host with a shared
  secret is how preview traffic reaches production.
- 🟠 Rotation: set the new value in Vercel, update the n8n credential, redeploy, confirm 200s, then
  invalidate the old. Note the rotation owner alongside the other secrets.
- 🔴 **Verify N9 first.** Until the middleware bypass is confirmed live, n8n calls are silently
  302-redirected to `/login` — the workflow reports success while nothing is dispatched.

### 4.2 Idempotency & retry
- The **app** claims `queued → sending` before sending, so a double-fired schedule cannot double-send.
- A crashed worker's `sending` claim is re-claimable after the 10-minute lease — this is the retry
  mechanism; n8n must **not** implement its own.
- 🟠 Configure n8n retry with **backoff**, and cap attempts. The dispatch endpoint returns **503** on a
  transient error specifically so n8n retries.
- 🟠 Ensure only **one** dispatch schedule exists. Two schedules are safe (the claim protects you) but
  will double your Resend request rate for no benefit.
- 🟠 Keep `max` small so one pass cannot fan out an unbounded blast if the outbox backs up.

---

## 5. Environment variables (NAMES only)

| Name | Production | Preview / Dev |
|---|---|---|
| `RESEND_API_KEY` | ✅ set (production key) | separate key, or unset |
| `EMAIL_FROM_DEFAULT` / `_AUTH` / `_ORDERS` / `_SECURITY` / `_SUPPORT` | ✅ verified-domain addresses | may be unset |
| `EMAIL_REPLY_TO` | ✅ monitored inbox | — |
| `RESEND_WEBHOOK_SECRET` | ✅ from the production webhook | separate value |
| `N8N_WEBHOOK_SECRET` | ✅ production-only value | **different** value |
| `EMAIL_DELIVERY_ENABLED` | unset (= enabled) | 🔴 **`false`** |
| `EMAIL_SAFE_RECIPIENT` | 🔴 **UNSET** | ✅ set to an operator address |
| `DEV_SYNTHETIC_NOTIFY_EMAIL` | unset | ✅ set |
| `BORDERPASS_APP_URL` | production domain | preview URL |

🔴 The two most dangerous mistakes: `EMAIL_DELIVERY_ENABLED` not `false` in Preview (preview emails real
people), and `EMAIL_SAFE_RECIPIENT` accidentally set in Production (every customer receipt silently goes
to one operator instead of the customer, and nobody notices for weeks).

---

## 6. Rollback

| Scenario | Lever | Effect | Time |
|---|---|---|---|
| Wrong emails going out | Set `EMAIL_DELIVERY_ENABLED=false` in Production + redeploy | **All sending stops immediately.** Rows stay `queued` and resume when re-enabled. No data loss. | ~2 min |
| Faster, no redeploy | Deactivate the n8n dispatch workflow (`XHdmWOckUapDWAAN`) | No new dispatch passes. Rows queue safely. | seconds |
| Wrong recipients resolved | Set `EMAIL_SAFE_RECIPIENT` to an operator address | Every send is redirected to one inbox — contains the blast while you diagnose. | ~2 min |
| Bad template/copy | Vercel instant rollback | Reverts code; outbox untouched. | ~1 min |
| Resend key compromised | Revoke in Resend; sends fail closed until replaced | Rows retry as `queued`. | seconds |
| n8n compromised | Rotate `N8N_WEBHOOK_SECRET` in Vercel | All n8n calls → 401. **n8n holds no DB credentials, so blast radius is bounded to triggering dispatch.** | ~2 min |

**The outbox is the safety net.** Because rows are claimed, retried, and never deleted on failure,
stopping the world costs nothing but delay. Prefer stopping.

---

## 7. Ordered execution

1. 🔴 N3 — close the fail-open PII path.
2. 🟠 N9 — re-test `/api/automation/*` live on a preview deploy with a real n8n call.
3. 🔴 N4 + N5 — build the resolver (Option A) with deny-path tests; build un-suppress + visibility.
4. 🟠 N7 — SPF/DKIM/DMARC on the production domain.
5. 🟠 N10 — activate the three n8n workflows, `errorWorkflow` set on all.
6. 🟠 N8 — verify the live Resend webhook signature + dedupe.
7. 🔴 N1 + N2 — legal review and consent capture.
8. 🔴 N6 — owner sign-off.
9. 🟠 **N11 — one real send to the owner's own inbox.** Record it.
10. 🟠 N12 — alerting. Then, and only then, `stripe-live-checklist.md`.

---

*No email was sent, no n8n workflow was modified, and no live credential was accessed in producing this
document. Real-recipient sending remains disabled. BorderPass remains development-only.*
