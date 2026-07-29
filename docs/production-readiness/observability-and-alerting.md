# Observability & Alerting — BorderPass

> **Status:** the *seam* is built and tested; **no alert has ever fired and no dashboard exists.**
> This closes items **§4.1 (no error tracking)** and **§4.5 (no production alerting/on-call path)** of
> `docs/phase-9/production-readiness-review.md` **as code**, not as an operational fact. Every row in
> §6 (Operator checklist) is 🔲 until an operator does it and records it.
>
> Governs / governed by: `.ai/GOVERNANCE.md`, `.ai/SECURITY.md`,
> `docs/decisions/adr/0016-n8n-external-orchestration-boundary.md`.

---

## 1. What is wired (and what is not)

`packages/observability` is no longer a stub. It ships **zero new npm dependencies** — deliberately,
because the operator cannot currently run `pnpm install` and a lockfile-less dependency addition
would break CI.

| Capability | State | Needs |
|---|---|---|
| **Redaction** (`redact`, `sanitize`) | ✅ wired | — |
| **Structured JSON logging** (`logEvent`) | ✅ wired, always on | a log drain (§5) |
| **Error capture** (`captureError` / `captureMessage`) | ✅ wired behind a pluggable transport | `SENTRY_DSN` |
| **Sentry transport** (`fetch` → Store endpoint, no SDK) | ✅ wired | a Sentry project + DSN |
| Sentry **tracing / performance** | ❌ not wired | `@sentry/nextjs` |
| Sentry **session replay**, source-map upload, release health | ❌ not wired | `@sentry/nextjs` + CI upload step |
| **PostHog** product analytics | ❌ not wired (config accepted, reported `unwired`) | `posthog-js` |
| **OpenTelemetry** traces/metrics | ❌ not wired (config accepted, reported `unwired`) | OTel SDK |
| **Uptime / synthetic checks** | ❌ not wired | n8n schedule → `/api/health` (§4.7) |

### Why the Sentry Store endpoint instead of the SDK

The DSN (`https://<publicKey>@<host>/<projectId>`) is parsed into
`https://<host>/api/<projectId>/store/` and events are `POST`ed with an `X-Sentry-Auth` header. This
is Sentry's documented ingest protocol, so events land in the real project with real grouping — but
it costs no dependency. **Swapping in `@sentry/nextjs` later means replacing one `CaptureTransport`
implementation, not touching a single call site.**

### Dev-safe by default

With **no `SENTRY_DSN`**, `initObservability()` installs no transport and `captureError` is a
**complete no-op** — nothing is built, nothing is sent, nothing is printed. Structured logging still
works, so local development is never blind and never noisy.

---

## 2. The privacy guarantee

Every payload that leaves the process — network **or** stdout — passes through
`sanitize()` in `packages/observability/src/sanitize.ts`, which applies three independent layers:

1. **Key layer** — masks values by key name for names `redact.ts` does not cover: `otp`, `email`,
   `phone*`, `*address*`, `body`, `payload`, `raw`, `dsn`, `jwt`, `credential`, `iban`, `curp`,
   `passport`, `*name` variants, …
2. **Value layer** — masks secrets/PII embedded in *string values*, which key-name matching can never
   see: DB connection strings, URLs with userinfo, Sentry DSNs, JWTs, `sk_`/`whsec_`/`re_`/`AKIA`
   key prefixes, `Bearer`/`Basic` headers, long hex digests, Luhn-valid card PANs, e-mail addresses,
   E.164 phone numbers.
3. **`redact()`** — the pre-existing, audit-log-proven gate, applied **last** so it is the final
   authority. Its behaviour is consumed, never modified.

Plus hard shape caps (depth 6, 20 array items, 40 keys, 512-char strings) so a raw request body or a
giant provider response can never be shipped wholesale.

**Deliberate carve-outs, so incidents stay debuggable:**

- Booleans are never key-masked (`kms_configured`, `signature_valid` survive — a boolean cannot carry
  a secret).
- `*_id` / `*_ref` / `*_status` / `*_valid` / `*_present` suffixes skip the key layer (the ADR-0012
  opaque `delivery_address_ref` is a reference, not an address). `redact()` still runs over them.
- Digit runs are Luhn-checked, so `evt_1753660000000` survives while `4242424242424242` does not.

> **Known limitation:** a bare 6-digit OTP appearing as a *value* under a non-obvious key is not
> pattern-detectable without destroying every amount and status code. Protection there is the key
> layer (`otp`, `code` fields) plus the rule below.

> **Rule: never pass a raw request body, provider response, or DB row to `logEvent`/`captureError`.**
> Pass ids, enums, booleans and counts. The sanitiser is a safety net, not a licence.

---

## 3. The event catalogue

`logEvent` emits **one line of JSON per event**, with a stable schema:

```json
{"event":"payment.webhook_failed","severity":"error","at":"2026-07-28T21:04:11.512Z","service":"borderpass","env":"production","domain":"webhook","correlation_id":"ord_01HXYZ","data":{"provider":"stripe","attempt":2}}
```

Top-level keys are reserved and can never be shadowed by caller data (caller fields are nested under
`data`). Severities: `debug | info | warning | error | fatal`.

Domains and the wrappers that emit them (`packages/observability/src/log.ts`):

| Domain | Wrapper | Emit at |
|---|---|---|
| `auth` | `logAuthEvent` | sign-in outcome, OTP issue/verify, role or tenant denial |
| `payment` | `logPaymentEvent` | intent lifecycle, refunds, state-machine transitions |
| `webhook` | `logWebhookEvent` | inbound Stripe/Resend callbacks: received / signature-invalid / handler-failed |
| `automation` | `logAutomationEvent` | n8n → app scoped-secret endpoints: authorised / denied / result |
| `notification` | `logNotificationEvent` | outbox dispatch + provider send result |
| `db` | `logPrivilegedDbAccess` | every `withPrivilegedDbAccess` call, with its justification `reason` |
| `observability` | `logEvent` | the seam reporting on itself (`observability.initialised`, health readiness) |

**Naming contract:** `<domain>.<snake_case_outcome>`, stable and low-cardinality — alerts key off it.
Never interpolate an id into the event name; put it in `correlation_id`.

### Recommended call shape

```ts
import { reportError, logPaymentEvent } from '@maralito/observability';

try {
  await handleWebhook(event);
  logPaymentEvent({ event: 'payment.webhook_handled', correlationId: orderId, data: { type } });
} catch (err) {
  // logs a structured line AND captures to Sentry, in one call; never throws, never blocks
  reportError(err, { event: 'payment.webhook_failed', domain: 'webhook', correlationId: orderId });
  return new Response('retry', { status: 503 });
}
```

In serverless handlers, flush before returning so the runtime does not freeze mid-send:
`waitUntil(flushCaptures())` (or `await flushCaptures(500)`).

---

## 4. What should page a human

Severity ladder:

- **P1 / page immediately** — money or data is at risk, or the product is down.
- **P2 / notify within the hour** (business hours; queue overnight) — degradation a customer will feel.
- **P3 / daily digest** — hygiene; fix in the next working session.

All thresholds below are **starting points**, chosen for a pilot at low volume where a *single*
occurrence of a money-path failure is meaningful. Re-tune after two weeks of real traffic — the goal
is that every page is actionable, and an alert that fires and is ignored must be deleted or retuned.

| # | Condition | Signal | Threshold | Sev | Runbook |
|---|---|---|---|---|---|
| **A1** | **Webhook signature verification failure** | `webhook.signature_invalid` | **≥1 in 5 min** | **P1** | §4.1 |
| **A2** | **Payment stuck in `processing`** | scheduled DB query | **any payment `processing` > 15 min** | **P1** | §4.2 |
| **A3** | **Notification dispatch failure** | `notification.send_failed` / outbox `status='failed'` | **≥3 in 15 min**, or **any single row failed > 3 attempts** | **P2** | §4.3 |
| **A4** | **Automation secret failure** | `automation.unauthorized` (401 from an `/api/automation/*` route) | **≥3 in 10 min** | **P1** | §4.4 |
| **A5** | **RLS gate failure** | `pnpm gate:rls` non-zero in CI / scheduled run | **any failure** | **P1** | §4.5 |
| **A6** | **High auth-failure rate** | `auth.signin_failed`, `auth.otp_verify_failed` | **>20 failures in 5 min globally**, or **>5 for one account in 5 min** | **P2** (P1 if >100/5 min) | §4.6 |
| **A7** | **Health probe degraded** | `/api/health` authorised probe: `ready:false` | **2 consecutive failures ~60 s apart** | **P1** | §4.7 |
| **A8** | **Unhandled error rate** | Sentry issue volume | **>10 events in 5 min**, or **any new issue in a payment/auth route** | **P2** | §4.8 |
| **A9** | **Bounce / complaint spike** | Resend webhook → outbox `bounced`/`complained` | **complaint rate >0.1%**, or **bounce rate >5%** over 100 sends | **P2** | §4.9 |
| **A10** | **Refund / dispute created** | `payment.refunded`, Stripe `charge.dispute.created` | **any** | **P2** | §4.10 |

Two dampeners are built in so an incident cannot become its own outage:
`maxEventsPerMinute` (default **60**) drops capture floods, and the capture transport is
fire-and-forget behind a **2 s** abort timeout, so a Sentry outage cannot slow a checkout.

---

## 5. Where the signals come from

```
Next.js (Vercel)
  ├─ logEvent ──────────► stdout (single-line JSON)
  │                          └─► Vercel Log Drain ─► [drain sink] ─► saved searches + alerts
  ├─ captureError ──────► Sentry Store endpoint (fetch, redacted) ─► Sentry Alert Rules
  └─ /api/health ◄────── n8n scheduled uptime workflow (x-borderpass-secret)

n8n (n8n.maralito.uk)
  ├─ every workflow sets errorWorkflow → ML | Platform | Global Workflow Error Handler | v1  (0RcqLu1uY5cQUjye)
  └─ Global Error Handler ─► ML | Platform | Notification Router | v1  (IUSMhbApLaEBCVG2) ─► operator channel
```

**Routing rule (single front door):** every alert — whether it originates in Sentry, a log drain, or
an n8n schedule — is normalised into the BorderPass event envelope and handed to the **Notification
Router (`IUSMhbApLaEBCVG2`)**. Do not let Sentry/Resend/Stripe each e-mail a different address; one
router means one place to change on-call, one place to add throttling, one audit trail.

Envelope convention (ADR-0016):

```json
{
  "type": "borderpass.ops.alert",
  "occurred_at": "2026-07-28T21:04:11.512Z",
  "data": {
    "alert": "A1",
    "severity": "P1",
    "title": "Stripe webhook signature verification failed",
    "correlation_id": "ord_01HXYZ",
    "runbook": "docs/production-readiness/observability-and-alerting.md#41-a1--webhook-signature-failure",
    "evidence_url": "<Sentry issue or log search link>"
  }
}
```

**The envelope carries ids and a link — never the payload, the signature, the recipient, or the
error body.** An alert notification is a lower-trust channel than the app: assume it lands in a chat
room with a broader audience than the database.

Wiring rules:

- Every n8n workflow **must** set `errorWorkflow` → `0RcqLu1uY5cQUjye` (this is already the pattern in
  `bh2oOgPMTiDJYOwi`). That gives every automation failure a path to a human for free.
- Alert workflows reuse the platform **Workflow Metrics Exporter** (`66GJRIXbao003zMe`) and the tags
  `maralito-labs / platform / foundation / production`.
- The alert workflow authenticates to the app with the **same** `x-borderpass-secret` /
  `N8N_WEBHOOK_SECRET` credential as the other automation endpoints. n8n gets **no** DB access and
  **no** `service_role` key (ADR-0016 §3).

---

## 6. Runbooks

Every runbook: **confirm → contain → diagnose → resolve → record.** Record every P1 in the incident
log with a timestamp, the correlation id, and what changed.

### 4.1 A1 — Webhook signature failure
**Means:** an inbound `/api/stripe/webhook` or `/api/webhooks/resend` request failed signature
verification. Either the signing secret is wrong/rotated, **or someone is forging webhooks.**
1. **Confirm:** `event:"webhook.signature_invalid"` in the drain. Check `data.provider` and the source IP count.
2. **Contain:** the route already rejects the request — no state changed. Do **not** disable verification.
3. **Diagnose:** compare the endpoint's signing secret in the Stripe/Resend dashboard against
   `STRIPE_WEBHOOK_SECRET` / `RESEND_WEBHOOK_SECRET` in Vercel. A recent endpoint re-creation or key
   rotation is the usual cause. Many distinct source IPs with no dashboard change ⇒ treat as an attack.
4. **Resolve:** update the env var → redeploy → replay the missed events from the provider dashboard
   (both providers retry; Stripe events are replayable for 30 days). Verify the order/payment state caught up.
5. **If forged:** capture source IPs, keep verification on, escalate to the owner. Nothing to roll back —
   rejected requests never touched the DB.

### 4.2 A2 — Payment stuck in `processing`
**Means:** money may have moved without the order advancing. **Never resolve this by editing the DB
by hand** — the payment state machine (`transitionPayment`) is the only legal path.
1. **Confirm:** query payments in `processing` older than 15 min; note `order_id` + payment intent id.
2. **Diagnose in Stripe first** (Stripe is the source of truth for money): look up the PaymentIntent.
   - `succeeded` in Stripe, `processing` locally ⇒ a **webhook was missed** (see A1) — replay it.
   - `requires_action` ⇒ customer never completed 3DS. Not an incident; it will expire.
   - `processing` in Stripe too ⇒ genuinely pending with the bank. Wait; re-check in 30 min.
3. **Resolve:** replay the webhook so the normal handler drives the transition. Only if replay is
   impossible, drive the same transition through the app's transition function — never raw SQL.
4. **Record:** if a customer was charged and not served, note it for reconciliation.

### 4.3 A3 — Notification dispatch failure
**Means:** a queued `notification_outbox` row is not reaching the customer. Statuses:
`queued → sending → sent → delivered`, with `failed`, `bounced`, `complained`, `delivery_delayed`.
1. **Confirm:** count outbox rows by `status`; note `template_key` and whether it is one template or all.
2. **Triage:** all templates failing ⇒ provider/credential problem. One template ⇒ a rendering bug.
3. **Check config:** `/api/health` (authorised) → `resend_configured` and `email_delivery_enabled`.
   `email_delivery_enabled:false` in production is a **misconfiguration**, not an outage — it is the
   preview/dev kill switch (`EMAIL_DELIVERY_ENABLED`).
4. **Diagnose:** Resend dashboard for provider errors; check the suppression list (a suppressed
   recipient is correct behaviour, not a failure).
5. **Resolve:** fix the credential/template, then re-run the dispatcher. **Dispatch is idempotent on
   `idempotency_key`** (unique index), so re-running cannot double-send. Never clear that key to force a resend.
6. **Escalate** if a payment receipt is affected — the customer paid and has no confirmation.

### 4.4 A4 — Automation secret failure
**Means:** repeated 401s from `/api/automation/*`. Either n8n's credential drifted, or something is
probing the endpoints.
1. **Confirm:** count `automation.unauthorized` by route and source.
2. **Diagnose:** requests from the n8n egress IP ⇒ credential drift after a rotation. Other sources ⇒ probing.
3. **Resolve (drift):** re-set `N8N_WEBHOOK_SECRET` in Vercel **and** the n8n `httpHeaderAuth`
   credential in the same maintenance window (they must match), then redeploy and re-run one workflow.
4. **Resolve (probing):** the guard already fails closed. Rotate the secret anyway if there is any
   chance of exposure, and check whether any request ever returned non-401.
5. **Never** work around this by removing the guard or accepting an empty secret — `secretOk` fails
   closed by design when no secret is configured.

### 4.5 A5 — RLS gate failure
**Means:** tenant isolation may be broken. **This is the most serious alert in the list.**
1. **Confirm:** re-run `pnpm gate:rls` and read which policy file failed.
2. **Contain:** if it failed against **production**, treat it as a potential data-exposure incident —
   stop deploys, notify the owner immediately.
3. **Diagnose:** a migration that created a table without enabling RLS, a dropped/replaced policy, or
   a grant change. Compare against the policy files.
4. **Resolve:** restore the policy, re-run the gate, and record the run in
   `docs/phase-7/gate-ledger.md` (a gate is not passed until it is in the ledger).
5. **Do not** ship anything else until the gate is green.

### 4.6 A6 — High auth-failure rate
**Means:** credential stuffing, an OTP-abuse/cost attack, or a broken auth deploy.
1. **Confirm:** `auth.signin_failed` / `auth.otp_verify_failed` volume; failures concentrated on one
   account (targeted) vs spread across many (spray).
2. **Rule out a bug first:** a spike starting exactly at a deploy is a regression — roll back.
3. **Contain:** confirm rate limiting is active (`UPSTASH_REDIS_REST_URL`/`_TOKEN` present in prod —
   these fail closed in production/staging). OTP endpoints are the usual cost target.
4. **Resolve:** for a targeted account, notify the owner and consider a temporary lock. For a spray,
   tighten the rate limit and record the source ranges.
5. **Never** log the attempted credential, the OTP, or the e-mail address — the sanitiser masks them,
   and the alert envelope must carry counts only.

### 4.7 A7 — Health probe degraded
**Means:** `/api/health` (authorised) returned `ready:false`, i.e. the DB is configured but not reachable.
1. **Confirm:** re-probe with the shared secret; check `checks.database_configured` vs
   `checks.database_reachable`. `configured:false` is a **deploy/env** problem; `reachable:false` is a
   **database** problem.
2. **Diagnose:** Supabase status/dashboard — paused project, connection-pool exhaustion, or a
   maintenance window. The probe has a 2 s budget, so slow ≈ unreachable.
3. **Resolve:** restore the database or fix `DATABASE_URL`, then re-probe until two consecutive passes.
4. **Note:** the anonymous shape stays `status:ok` while the DB is down — that is intentional
   (liveness ≠ readiness) and is why the uptime workflow must send the secret.

### 4.8 A8 — Unhandled error rate
1. Open the Sentry issue; use `correlation_id` (order id) to pull the matching log lines.
2. New issue in a **payment or auth** route ⇒ treat as P1 regardless of volume.
3. If it started at a deploy, roll back first and diagnose after.
4. Never paste raw request data into the issue to "debug" — reproduce locally with synthetic data.

### 4.9 A9 — Bounce / complaint spike
1. Complaint rate >0.1% or bounce rate >5% threatens **domain reputation** for
   `notifications.maralito.uk` — act the same day.
2. Check the Resend dashboard for hard vs soft bounces; confirm suppression is being applied.
3. Hard bounces concentrated on one template/list ⇒ a bad address source; stop that flow first.
4. Verify SPF/DKIM/DMARC are still valid on the sending domain.

### 4.10 A10 — Refund / dispute created
1. Every dispute has a **provider deadline** — record it immediately; a missed deadline is an automatic loss.
2. Pull the order, payment, inspection and delivery records for evidence via the correlation id.
3. Refunds are TEST-mode only until B2 (Stripe LIVE) is complete — a live refund alert before then
   means something is misconfigured.

---

## 7. Operator checklist (all 🔲 — nothing here has been done)

Sequenced so each step is verifiable before the next.

| # | Step | Owner | State |
|---|---|---|---|
| 1 | Create a Sentry project (`borderpass`), copy the DSN | operator | 🔲 |
| 2 | Set `SENTRY_DSN` in Vercel **Production only** (leave Preview/Local unset so dev stays a no-op) | operator | 🔲 |
| 3 | Set `SENTRY_RELEASE` (or rely on `VERCEL_GIT_COMMIT_SHA`) | operator | 🔲 |
| 4 | Call `initObservabilityFromEnv()` once at server start-up (Next `instrumentation.ts`) — **not yet done; owned by whoever adds that file** | dev | 🔲 |
| 5 | Replace bare `catch {}` blocks in webhook / payment / dispatch paths with `reportError(...)` | dev | 🔲 |
| 6 | Verify a real error reaches Sentry, then **verify the event contains no PII/secrets** (open the event and read it) | operator | 🔲 |
| 7 | Enable a Vercel log drain; save searches for each `event` name in §3 | operator | 🔲 |
| 8 | Build the n8n uptime workflow: schedule → `/api/health` with `x-borderpass-secret` → alert on `ready:false` (A7) | dev+operator | 🔲 |
| 9 | Build the n8n ops-alert workflow fronting the Notification Router (`IUSMhbApLaEBCVG2`) | dev+operator | 🔲 |
| 10 | Set `errorWorkflow` → `0RcqLu1uY5cQUjye` on **every** BorderPass workflow | operator | 🔲 |
| 11 | Configure Sentry alert rules for A8 + A10 → route to the Notification Router | operator | 🔲 |
| 12 | Add the scheduled `processing`-payment query for A2 | dev | 🔲 |
| 13 | Schedule `gate:rls` (A5) and route failures to the Router | operator | 🔲 |
| 14 | **Fire one test alert end-to-end** and confirm a human receives it | operator | 🔲 |
| 15 | Define on-call: who, what hours, what "acknowledged" means | owner | 🔲 |
| 16 | Record the results in `docs/phase-7/gate-ledger.md` as a new Phase 9 section | owner | 🔲 |

**An alerting system that has never fired is not an alerting system.** Step 14 is the gate: until a
test alert reaches a human, treat production as unobserved.

---

## 8. Known gaps in this work

- **`initObservability` is never called yet.** The seam exists; nothing invokes it at start-up. Until
  step 4, `captureError` is a no-op even with a DSN set.
- **No call sites instrumented.** Existing `catch {}` blocks still swallow errors silently (step 5).
- **`packages/observability` has no `test` script**, so its co-located `*.test.ts` files (including
  the new `sanitize`/`log`/`capture` suites) are **not** picked up by `turbo run test`. Adding
  `"test": "vitest run"` to `packages/observability/package.json` is a one-line change deliberately
  left to the owner of that file — **do it, or this suite silently never runs in CI.**
- **A2, A5, A6, A9 have no emitting code yet** — they are scheduled queries / CI hooks, not app events.
- Sanitisation is verified by unit tests against a hostile fixture, **not** against real production
  traffic. Re-read the first real Sentry events by hand (step 6).
