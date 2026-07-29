# Phase 8C — Real Notifications: Increment Plan

> **Status:** ✅ 8C.1 · 8C.2 · 8C.3 · 8C.5 CODE-COMPLETE (2026-07-17, offline-verified — see `8c-completion-report.md`).
> **8C.4 (n8n wire-up) deferred to operator** (needs live n8n + secret). Real-recipient sends stay gated on 8B + consent.
>
> **Status (history):** STARTED — owner sent **`START BORDERPASS PHASE 8 — 8C`** on 2026-07-15. Preconditions met:
> Phase 7 rows 11 ✅, 18 ✅, 19 ✅ (gate ledger). **Development-only · SYNTHETIC-RECIPIENT ONLY** — real
> recipient contact info stays gated on **8B (KMS)** + consent (ADR-0014). Each increment below is its own
> stop-pointed unit: I build one, verify, and **wait for `START BORDERPASS PHASE 8 — 8C.<n>`** before the next.
> Governs: ADR-0014 (Phase 8 scope), ADR-0016 (n8n boundary), `8c-resend-and-google-signin.md` (foundation).

## What already exists (do not rebuild)

- `apps/borderpass/src/server/notification-dispatch.ts` — `dispatchQueuedNotifications()`, idempotent
  (`queued→sending→sent/failed`, stale-`sending` re-claim), **injected** `resolveRecipient` (synthetic only).
- `apps/borderpass/src/server/resend.ts` — Resend REST transport, retryable/terminal classification, never logs body/recipient.
- `apps/borderpass/app/api/dev/dispatch-notifications/route.ts` — dev-only trigger (404 in prod, synthetic recipient).
- **Proven auth pattern:** `apps/borderpass/app/api/automation/review-request/route.ts` fail-closes on
  `env.N8N_WEBHOOK_SECRET` via constant-time compare of the `x-borderpass-secret` header, `runtime='nodejs'`,
  retry-aware status codes (503 retryable / 502 permanent / 404 / 409). **8C reuses this exact pattern.**
- n8n prototype `XHdmWOckUapDWAAN` (inactive) already models the scheduled dispatch trigger.

## Increments

### 8C.1 — Prod-safe authed dispatch endpoint
- **Build:** `apps/borderpass/app/api/automation/dispatch-notifications/route.ts` — `runtime='nodejs'`,
  fail-closed on `N8N_WEBHOOK_SECRET`/`x-borderpass-secret` (reuse the review-request `secretOk` shape), POST
  body `{ max?: number }`, invokes `dispatchQueuedNotifications` with the **synthetic** `resolveRecipient`
  (`DEV_SYNTHETIC_NOTIFY_EMAIL`) only, honors an optional `Idempotency-Key`, returns the dispatch summary +
  retry-aware statuses. No real-recipient resolver wired (8B gate).
- **Acceptance:** 401 without/!= secret; 200 + summary with secret; no-op when Resend unconfigured; synthetic
  recipient only; no PII in logs; unit test for `secretOk` + a route test (authz + synthetic dispatch);
  `check:db-imports` / `check:client-stripe` green.
- **STOP.**

### 8C.2 — Delivery-status callback (n8n/provider → app)
- **Build:** `apps/borderpass/app/api/automation/notification-status/route.ts` — authed (same secret), updates
  the existing `notification_outbox` row by id via `withPrivilegedDbAccess`, **idempotent** (terminal states
  don't regress), `writeAudit`. Statuses: `delivered|bounced|failed`.
- **Acceptance:** authed; idempotent double-apply = single effect; audited; RLS untouched; PGlite test.
- **STOP.**

### 8C.3 — Resend provider webhook (optional, phased)
- **Build:** verify Resend delivery/bounce webhook signature → normalize → call 8C.2. Suppression list for bounces.
- **Acceptance:** signature verified/fail-closed; bounce → suppress; no PII in logs. **STOP.**

### 8C.4 — Wire n8n to the real endpoints
- **Build:** point prototype `XHdmWOckUapDWAAN` at the live 8C.1 endpoint, attach the `x-borderpass-secret`
  credential, run a **synthetic** end-to-end test (seed → dispatch → status callback), assert idempotency +
  retry/backoff in run history. Optionally add the ops-alerts workflow (ADR-0016 #2) via the platform Notification Router.
- **Acceptance:** synthetic round-trip green; double-fire = single send; failures hit the Global Error Handler. **STOP.**

### 8C.5 — Review + completion report
- Full verification (typecheck/lint/build/tests/guards, secret scan, unsafe-claim grep), `8c-completion-report.md`,
  ledger cross-check. **STOP (terminal):** real-recipient sends remain gated on 8B + consent.

## Cross-cutting guardrails (unchanged)

Synthetic recipients only until 8B/KMS · state only via existing seams · tenant access only via
`withTenant`/`withPrivilegedDbAccess` · secrets in Vercel/n8n stores (never repo, never `NEXT_PUBLIC_`, n8n never
holds `service_role`) · CI security gates green · every sub-increment development-only until its own checks pass.

## Sequencing

`START … 8C.1` → endpoint → `START … 8C.2` → callback → (8C.3 optional) → `START … 8C.4` (n8n wire-up + synthetic test) → `START … 8C.5` (review).
