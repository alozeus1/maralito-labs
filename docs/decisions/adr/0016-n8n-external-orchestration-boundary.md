# ADR 0016 — n8n as External Orchestration / SaaS-Glue Boundary (PROPOSED)

- **Status:** **ACCEPTED (contract only; dev-only; no n8n instance connected; no live wiring authorized)** — owner
  (Godwill) accepted the boundary in writing on 2026-07-14. Acceptance ratifies the architectural contract below; it
  does **not** start Phase 8C, authorize real sends, or waive the gating in "What this is NOT / gating". Building n8n
  nodes still requires an n8n instance + MCP connected and `START BORDERPASS PHASE 8 — 8C`. · **Date:** 2026-07-14
  (proposed), 2026-07-14 (accepted) · **Phase:** 8 (8C-adjacent)
- **Numbering:** 0016 = n8n integration boundary. Next ADR = 0017.
- **Supersedes:** nothing. **Depends on:** ADR-0013 (live-gate hardening), ADR-0014 (Phase 8 scope), the automation
  corpus in `docs/automation/automation/docs/` (esp. §10 scheduling/integration, §18 API endpoints, §13 security).

## Context

Phase 8C already put the notification send-path **in the app**: `apps/borderpass/src/server/notification-dispatch.ts`
(`dispatchQueuedNotifications` — idempotent `queued→sending→sent/failed`, stale-`sending` re-claim lease, injected
`resolveRecipient` so real-PII resolution stays 8B/KMS-gated), fronted by a dev route
`apps/borderpass/app/api/dev/dispatch-notifications/route.ts` (404 in prod, synthetic recipient only). Durable
domain workflows are Inngest's job; the 25-state order machine and the `transitionOrder/Quote/Payment/Inspection/DeliveryPrep`
seams are the **only legal mutation points**, behind RLS + `writeAudit`.

There is now interest in using **n8n** for SaaS integration and no-code/low-code ops automation. The risk is
architectural: if n8n writes Postgres directly or re-implements domain logic, BorderPass gains a **second source of
truth** and bypasses RLS, the state machines, and the audit trail — violating GOVERNANCE core values 1, 2, 6 and the
Phase 8 cross-cutting guardrails. This ADR fixes n8n's role before any node is built, so the boundary is a decision on
record rather than an emergent accident.

n8n is **not yet present** anywhere in `apps/borderpass`, and **no n8n instance or MCP is connected**. This ADR is a
contract; it authorizes no live wiring.

## Decision

1. **n8n is an external orchestration / SaaS-glue layer only.** It is the "arms and legs" that reach out to third-party
   SaaS (email/SMS providers, Slack, ClickUp/Notion, couriers). The **domain brain stays in-app**: Inngest owns
   code-owned durable workflows; the state-machine seams own all state changes. n8n **never** becomes a place where core
   business state lives.

2. **n8n never touches Postgres directly and never bypasses a state machine or RLS.** It has **no** database
   credentials — not the pooled app connection, and above all **not the Supabase `service_role` key**. Every effect n8n
   has on BorderPass state goes through an app HTTP endpoint that enforces `withTenant` (or an explicitly audited
   `withPrivilegedDbAccess`) + the relevant `transition*` seam + `writeAudit`. This is the §18 "integration layer as a
   single governed boundary" pattern, applied to an external caller.

3. **n8n authenticates with a scoped service token, not user or DB creds.** A dedicated machine principal
   (`n8n-orchestrator`) presents a bearer token on a server-only header to a small, purpose-built set of app endpoints.
   The token is stored **only** in the n8n credential store (never a workflow text field, per the n8n
   credentials-and-security rule and GOVERNANCE value 3), is least-privilege (may invoke only the whitelisted endpoints),
   and is rotatable. The app validates it in an `apps/borderpass/src/server/*` guard and rejects on the fail-closed path.

4. **Two integration directions, both idempotent and observable.**
   - **Outbound trigger (app ← n8n):** n8n invokes app endpoints (e.g. a production-safe successor to
     `/api/dev/dispatch-notifications`, and future `/v1/automation/*` control-plane routes from §18). Mutating calls carry
     an `Idempotency-Key`; the app is the idempotency authority (it already claims `queued→sending` before send).
   - **Inbound callback/events (app → n8n or n8n → app):** delivery-status and ops signals flow back through an app
     endpoint that updates the **existing** `notification_outbox` row via the privileged, audited path keyed by the
     outbox row id — so retries can't double-apply. n8n gets retry/backoff + a visual run history for free; the app keeps
     the ledger.

5. **n8n does NOT re-own the notification outbox dispatcher.** The idempotent dispatcher already exists app-side. n8n's
   sanctioned notification role is limited to being the **scheduled trigger** that calls the dispatch endpoint (an
   alternative to a Vercel cron or an Inngest scheduled function — chosen only where visual ops ownership is wanted), plus
   provider-side observability. Re-implementing send/claim logic in n8n is explicitly out of scope.

6. **Ranked sanctioned use cases** (highest architectural fit first):
   1. **Notification/ops trigger + dispatcher glue** (8C): schedule/kick `dispatchQueuedNotifications`; surface run health.
   2. **Ops alerts:** Stripe webhook failures, inspection `failed`, delivery milestones, DLQ items → Slack/email to ops.
   3. **Back-office glue:** "new order needs a quote" → create a ClickUp/Notion task; daily digest of orders awaiting action.
   4. **AI intake (n8n AI agent):** parse an emailed "buy this for me" request → structured fields → create a **draft**
      order via the app API, **human-approved** before it enters the flow.

7. **Every n8n workflow is built under the n8n skill protocol:** validate (`validate_workflow`) before publish, and
   verify (`get_workflow_details`, inspect the `connections` object) after every create/update. Secrets go only in the n8n
   credential system. This ADR does not waive that protocol.

## Consequences

**Positive**
- Single source of truth preserved: RLS, state machines, and audit stay authoritative; n8n cannot silently diverge state.
- Clean ownership split: Inngest = domain-critical, code-owned, tested durable steps; n8n = SaaS glue and ops automations
  that business/ops can own visually. No overlap, no two brains.
- Secrets blast radius bounded: n8n holds provider keys + one scoped app token; it never holds DB or `service_role` creds.
- Reuses work already shipped: the idempotent dispatcher and the §18 integration-boundary design are leveraged, not rebuilt.

**Negative / costs**
- Requires building and maintaining a small **app-side scoped-token auth guard** and a production-safe dispatch/callback
  endpoint pair (the current `/api/dev/dispatch-notifications` is dev-only, unauthenticated, 404-in-prod — it is a
  reference shape, not the production surface).
- Adds an operational dependency (an n8n instance) that must itself be secured, observed, and kept in sync with the API.
- Cross-system idempotency and retry semantics must be tested end-to-end (app idempotency authority + n8n retry/backoff).

## What this is NOT / gating

- **Not an authorization to send to real customers.** Real recipient contact info is real PII and stays gated on
  **Phase 8B (KMS)** + consent/opt-out handling (ADR-0014). Until then, only a **synthetic** `resolveRecipient` is used.
- **Not a Phase 8 start.** Implementation waits on `START BORDERPASS PHASE 8 — 8C` and on an n8n instance + MCP being
  connected. The first buildable slice is a **TEST/synthetic prototype** (fake outbox, no real providers, no PII) that
  proves the scoped-token auth + idempotent-callback contract.
- **Not a decision Claude may accept on its own.** Per ADR-0013's "decision records are proposals, owner completes"
  precedent and the DECISIONS.md tiers (auth/secrets/integration = elevated), this ADR stays **PROPOSED** until the owner
  accepts it in writing.

## Update 2026-07-14 — the authed pattern already exists (correction to Consequences)

Surveying the connected n8n instance (`https://n8n.maralito.uk`) shows the authenticated app-endpoint boundary
this ADR describes is **already live** for one use case — not net-new:

- App route `apps/borderpass/app/api/automation/review-request/route.ts` fail-closes on `env.N8N_WEBHOOK_SECRET`
  via a constant-time compare of the `x-borderpass-secret` header, and returns retry-aware status codes
  (503 retryable / 502 permanent / 404 / 409) that n8n's retry logic consumes.
- Live n8n workflow `bh2oOgPMTiDJYOwi` ("BorderPass — Post-Delivery Review Request") already calls it via an
  `httpHeaderAuth` credential and sets `errorWorkflow` → `ML | Platform | Global Workflow Error Handler`
  (`0RcqLu1uY5cQUjye`). App host in use: `https://borderpass-phi.vercel.app`.
- Reusable platform sub-workflows exist and MUST be mirrored: Notification Router (`IUSMhbApLaEBCVG2`), Global
  Error Handler (`0RcqLu1uY5cQUjye`), Workflow Metrics Exporter (`66GJRIXbao003zMe`); tags
  `maralito-labs / platform / foundation / production`.
- BorderPass event envelope convention: `{ type: 'borderpass.order.<x>', occurred_at, data: { order_id, correlation_id, … } }`.

**Consequence:** §4's scoped-token boundary is **proven**, not hypothetical. The only net-new app work for the
notification-dispatcher use case is a prod-safe **`/api/automation/dispatch-notifications`** (+ a delivery-status
callback) that reuses this exact `x-borderpass-secret` / `N8N_WEBHOOK_SECRET` auth — Phase 8C, gated on
`START BORDERPASS PHASE 8 — 8C`. New n8n workflows reuse the platform Error Handler + Metrics Exporter and the
`borderpass.*` envelope.

## Open questions for the owner

1. Hosting: **n8n Cloud** vs **self-hosted** (Docker on a controlled host)? Affects where the scoped token + provider
   creds live and the network path to the app.
2. Scheduling owner for the dispatcher: **n8n** vs **Vercel cron** vs **Inngest scheduled function**? (This ADR permits
   n8n but does not mandate it.)
3. Which of the four use cases to prototype first (recommended: #1 notification trigger, then #2 ops alerts).
