# Phase 8C — Real Notifications (Dispatch + Delivery Status) — Completion Report

> **Status:** ✅ CODE-COMPLETE for the in-app increments (8C.1–8C.3, 8C.5). · **Date:** 2026-07-17 · ADR-0014 / ADR-0016
> **8C.4 (n8n wire-up) is deferred to an operator** — it needs the live n8n instance + the shared secret in the
> n8n/Vercel stores; it cannot run in the build sandbox.
> **Development-only · SYNTHETIC-RECIPIENT ONLY.** Real customer contact info stays gated on **Phase 8B (KMS)** +
> consent. The dispatcher ships **dark**: with no synthetic address and no Resend config, every row is skipped —
> nothing is ever sent to a real person.

## Increments

| # | Increment | Status |
|---|-----------|--------|
| 8C.1 | Prod-safe **authed** dispatch endpoint (`/api/automation/dispatch-notifications`) | ✅ |
| 8C.2 | Authed **delivery-status callback** (`/api/automation/notification-status`) | ✅ |
| 8C.3 | Resend provider **delivery webhook** (`/api/webhooks/resend`) — signature-verified, idempotent, suppression | ✅ (pre-existing) |
| 8C.4 | Wire n8n to the live endpoints + synthetic end-to-end | 🔒 operator (live n8n + secret) |
| 8C.5 | Review + completion report (this) | ✅ |

## Files

**New (this pass)**
- `apps/borderpass/src/server/automation-auth.ts` — shared `secretOk` (constant-time, fail-closed) — single source of truth for automation auth.
- `apps/borderpass/app/api/automation/dispatch-notifications/route.ts` — **8C.1** authed trigger for `dispatchQueuedNotifications`; `runtime='nodejs'`; synthetic recipient only; optional `{max}` + advisory `Idempotency-Key`; audited; 503 on transient error (n8n retries).
- `apps/borderpass/src/server/notification-status.ts` — **8C.2** pure `decideOutboxStatus` / `isCallbackStatus` (idempotent + non-regressing).
- `apps/borderpass/app/api/automation/notification-status/route.ts` — **8C.2** authed callback; privileged single-row update; idempotent; terminal states don't regress (409); audited.
- `apps/borderpass/src/server/automation-auth.test.ts`, `notification-status.test.ts` — unit tests.

**Refactor**
- `apps/borderpass/app/api/automation/review-request/route.ts` — now imports the shared `secretOk` (removed its private copy; behavior unchanged).

**Foundation reused (already committed)**
- `notification-dispatch.ts` (idempotent dispatcher, ship-dark, injected `resolveRecipient`), `resend.ts` (send boundary; From from server env; kill-switch + safe-recipient redirect), `email-suppression.ts`, `email-footer.ts`, `resend-webhook.ts`, `dev-seed-notification.ts`, `email_events` / `email_suppressions` schema, `app/api/webhooks/resend/route.ts`, `app/api/dev/dispatch-notifications/route.ts`.

## Security design

- **Auth:** every automation endpoint fails closed on `x-borderpass-secret` vs `N8N_WEBHOOK_SECRET` via constant-time compare. No secret configured or a mismatch → 401. Secret lives only in Vercel/n8n stores (never repo, never `NEXT_PUBLIC_`, n8n never holds `service_role`).
- **PII gate (ADR-0014 / 8B):** the outbox stores **no recipient**. The dispatcher **injects** `resolveRecipient`; the only wired resolver returns the **synthetic** `DEV_SYNTHETIC_NOTIFY_EMAIL`, or `null` → row skipped. A real-customer resolver is **not** wired — it stays gated on 8B (KMS) + consent. Email bodies are **non-PII** (order link only; no names/amounts/addresses).
- **Idempotency:** dispatch claims `queued → sending` (a double-fire never double-sends; a crashed `sending` claim is re-claimable after a lease). The status callback is idempotent (same status = no-op) and **non-regressing** (a terminal state won't be overwritten → 409). The Resend webhook dedupes on the Svix id.
- **Data boundary:** all DB access via `withPrivilegedDbAccess` (RLS untouched); `check:db-imports` + `check:client-stripe` green; routes are `runtime='nodejs'` (node crypto + privileged DB — never edge); logs never carry recipient/body.

## Verification (offline — sandbox can't run pnpm/vitest on macOS node_modules)

- **8C offline proof: 15/15** assertions on the **emitted** real code (esbuild → node): `decideOutboxStatus` (apply / idempotent no-op / terminal non-regression + `from`), `isCallbackStatus` (accepts the 5 callback states; rejects `queued`/`sending`/`sent`/case/`null`/number), `secretOk` (exact match; wrong equal-length; length-mismatch no-throw; unset secret → deny; missing header → deny).
- Vitest suites written for CI: `automation-auth.test.ts`, `notification-status.test.ts`.
- Guards: `check:db-imports` ✅ (no raw DB client in `apps/`), `check:client-stripe` ✅. New routes reference no Stripe code and no `service_role`/raw client.

## Operator follow-ups (their Mac / CI / n8n — cannot run in sandbox)

1. `pnpm typecheck && pnpm test && pnpm build` + push → CI (runs the two new unit suites + existing resend/webhook/suppression tests).
2. **8C.4:** in n8n, point the scheduled dispatch prototype (`XHdmWOckUapDWAAN`) at `POST /api/automation/dispatch-notifications`, attach the `x-borderpass-secret` credential (= `N8N_WEBHOOK_SECRET`), and route provider/status events to `POST /api/automation/notification-status`. Run a **synthetic** end-to-end (seed → dispatch → status callback); assert idempotency + retry/backoff in run history; failures hit the Global Error Handler (ADR-0016).
3. Configure env in Vercel (server-only): `RESEND_API_KEY`, an `EMAIL_FROM_*`/`RESEND_FROM_EMAIL`, `EMAIL_REPLY_TO`, `RESEND_WEBHOOK_SECRET`, `N8N_WEBHOOK_SECRET`; keep `EMAIL_DELIVERY_ENABLED=false` (+ `EMAIL_SAFE_RECIPIENT`) in preview/dev.

## Explicitly NOT done (gated)

- **Real-recipient sending.** No resolver maps a row → a real customer address; that requires **8B (KMS)**-protected contact PII + consent. Until then the endpoints only ever reach the synthetic operator address, or no-op.
- **8C.4 n8n activation** (needs the live instance + secret).
- SMS/WhatsApp (Twilio) transport — env reserved, transport not built this pass (email is the wired channel).

Development-only; synthetic recipients only; no real PII. **Phase 8 remaining:** **8A** (blocked by Phase-7 rows 11/18/19) and the gated tails of **8B/8C** (production KMS + real-recipient + n8n activation).
