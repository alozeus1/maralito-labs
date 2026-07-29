# n8n Instance + MCP Setup Guide (owner steps)

> **Purpose:** stand up an n8n instance and connect it so the agent can build + validate real workflows under
> ADR-0016. **This is owner/operator work** (hosting + credentials); the agent cannot host n8n or connect its MCP.
> Nothing here authorizes live customer sends — ADR-0016's gating (real PII → 8B/KMS; `START BORDERPASS PHASE 8 — 8C`)
> still applies. Governs: `docs/decisions/adr/0016-n8n-external-orchestration-boundary.md`, `.ai/SECURITY.md`.

## 0. Decide hosting (ADR-0016 open question #1)

| Option | When to pick | Notes |
|--------|--------------|-------|
| **n8n Cloud** | Fastest start; you don't want to run infra | Managed, TLS + backups included. Credentials live in n8n Cloud's store. `⚠️ VERIFY` current plan limits/pricing at n8n's site before committing. |
| **Self-host (Docker)** | You want full control / data residency / to keep it on your own network | You own patching, TLS, backups, and network exposure. Put it behind HTTPS and restrict inbound. |

Recommendation: **n8n Cloud for the first prototype** (lower ops surface), revisit self-host if data-residency or
cost demands it. Either way, the security rules below are identical.

## 1. Self-host quickstart (skip if using n8n Cloud)

Run on a controlled host (not a laptop) behind HTTPS. Minimal Docker example — **do not commit real values**; use the
host's env/secret store:

```bash
docker run -d --name n8n --restart unless-stopped \
  -p 127.0.0.1:5678:5678 \
  -e N8N_HOST="n8n.<your-domain>" \
  -e N8N_PROTOCOL="https" \
  -e WEBHOOK_URL="https://n8n.<your-domain>/" \
  -e N8N_ENCRYPTION_KEY="<generated-32+char-secret>" \
  -e GENERIC_TIMEZONE="America/Denver" \
  -v n8n_data:/home/node/.n8n \
  docker.n8n.io/n8nio/n8n
```

- Terminate TLS at a reverse proxy (Caddy/nginx/Cloudflare) in front of `127.0.0.1:5678`; never expose 5678 raw.
- `N8N_ENCRYPTION_KEY` encrypts the credential store at rest — generate it once, store it in your secret manager,
  and back it up (losing it orphans all stored credentials).
- Turn on n8n user management / SSO and restrict who can edit workflows.

## 2. Connect the n8n MCP to this workspace

So the agent can author, validate, and publish workflows programmatically:

1. Enable the **n8n MCP** for this instance (n8n's MCP server / API access), scoped to the project/workspace you'll use.
2. Add it as a connector in your Claude client (claude.ai connector settings, or `claude mcp` / `/mcp` in an
   interactive session — **this session is non-interactive, so it can't run the OAuth/connect flow**).
3. Once connected, the agent uses the n8n skill protocol on every change: **`validate_workflow` before publish** and
   **`get_workflow_details` after each create/update** to confirm the `connections` object — per
   `n8n-skills:using-n8n-skills-official`.

## 3. Create credentials — the security-critical part (ADR-0016 §3, `.ai/SECURITY.md`)

All of these live **only in n8n's credential store**, never in a workflow text/expression field:

1. **Scoped app service token (`n8n-orchestrator`).** A dedicated machine principal that authenticates n8n to
   BorderPass's app endpoints. It is:
   - **least-privilege** — may invoke only the whitelisted automation endpoints (per ADR-0016 §4), nothing else;
   - **rotatable** — record a rotation owner + cadence in the gate ledger / secrets review;
   - **NOT** the Supabase `service_role` key, **NOT** any database connection string. n8n gets **no DB access**.
   > The app-side guard that validates this token is **net-new app work** gated on `START BORDERPASS PHASE 8 — 8C`
   > (the current `/api/dev/dispatch-notifications` is dev-only, unauthenticated, and 404s in prod — a reference
   > shape, not the production surface).
2. **Provider keys** (added only when their use case is built, not before): Resend, Twilio/WhatsApp, Slack,
   ClickUp/Notion, courier APIs. Each as a proper n8n credential of the official type.
3. **Nothing else.** No customer PII flows through n8n until 8B (KMS) + consent handling; until then, only synthetic
   recipients (ADR-0016 gating).

## 4. First workflow to build (once 1–3 are done + ADR-0016 8C started)

A **synthetic prototype** proving the contract, no real providers/PII:
1. Scheduled trigger → calls the (authenticated, production-safe) dispatch endpoint with an `Idempotency-Key`.
2. Delivery-status callback → updates the existing `notification_outbox` row via the app's privileged, audited path,
   keyed by the outbox row id (retry-safe).
3. Assert idempotency (double-fire → single effect) and retry/backoff visibility in the n8n run history.

Then use case #2 from ADR-0016 (ops alerts to Slack/email) as the second workflow.

## 5. Security checklist before any real use

- [ ] n8n behind HTTPS; port 5678 not publicly exposed; user management/SSO on.
- [ ] `N8N_ENCRYPTION_KEY` generated, stored in secret manager, backed up.
- [ ] `n8n-orchestrator` token is least-privilege + rotatable; **no `service_role`, no DB creds** in n8n.
- [ ] Every secret is a credential, **zero secrets in workflow text fields**.
- [ ] App-side scoped-token guard exists and fail-closes (8C work) before any non-dev call.
- [ ] Synthetic recipients only until 8B/KMS + consent.
- [ ] Each workflow validated + verified per the n8n skill protocol.
