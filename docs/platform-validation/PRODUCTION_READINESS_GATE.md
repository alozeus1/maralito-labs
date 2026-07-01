# Production Readiness Gate — Integrations (Stripe / Resend / Neon / Vercel / AWS)

> **Validated:** 2026-06-30 · Code + docs inspected. No live third-party credentials in this
> environment, so every live integration below is marked accordingly. **Nothing here is claimed as
> production-validated.**

## Summary gate
| Integration | Implemented? | Local-validatable? | Gate status |
|-------------|:------------:|:------------------:|-------------|
| Stripe (billing) | ⛔ placeholder (`phase6`) | no | 🔴 NOT VALIDATED — LIVE SERVICE REQUIRED **and not yet built** |
| Resend (email) | ⛔ placeholder (`phase9`) | no | 🔴 NOT VALIDATED — LIVE SERVICE REQUIRED **and not yet built** |
| Neon (Postgres) | platform-doc decision | n/a | 🟡 decision documented; Supabase is the app DB today |
| Vercel (deploy) | docs only, no `vercel.json` | partial (build works) | 🔴 NOT VALIDATED — LIVE DEPLOY REQUIRED |
| AWS (infra) | not present (no `infra/`) | n/a | 🟡 documented intent; nothing to deploy yet |

## Stripe — billing
**State:** `@maralito/payments` is a Phase-0 placeholder. `createStripeConfig()` throws
`TODO(phase6)`. Envs reserved: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`.
**Readiness checklist (none implemented yet — design targets):**
| Capability | Status | Required before "billing ready" |
|-----------|:------:|---------------------------------|
| Checkout / subscriptions / customer portal | 🔌 | implement in `@maralito/payments` |
| **Webhook signature verification** | 🔌 | mandatory — verify `Stripe-Signature` with `STRIPE_WEBHOOK_SECRET` |
| Idempotency (by `quote_id`) | 🔌 design | TODO note already specifies idempotent intents |
| Subscription status sync, invoice/payment events, failed-payment (dunning) | 🔌 | implement + reconcile to DB |
| Plan gating | 🔌 | tie to RBAC/entitlements |
| Local webhook testing | 🔴 | `stripe listen --forward-to localhost` + fixtures; not possible here |
**Gate:** `NOT FULLY VALIDATED — LIVE SERVICE REQUIRED`. Also note: **billing is not implemented at
all yet** — this is a future phase, correctly scaffolded.

## Resend — transactional email
**State:** `@maralito/notifications` placeholder (`phase9`). Envs: `RESEND_API_KEY`,
`RESEND_FROM_EMAIL`. Design: EN/ES, channel fallback (WhatsApp→SMS→email), quiet hours, idempotent
per event.
**Required before "email ready":** provider adapter + template rendering; **domain verification**
(SPF/DKIM/DMARC) on the sending domain; bounce/complaint handling; retry with backoff; rate control;
secrets server-only. **Gate:** `NOT FULLY VALIDATED — LIVE SERVICE REQUIRED` and not implemented yet.

## Neon vs Supabase Postgres — which DB, when
- **Today:** the app DB is **Supabase Postgres** (auth + RLS + storage are first-class needs → Supabase
  is the right call). RLS, `auth.uid()`, and policies are built around Supabase.
- **Platform doc** lists Neon as the *platform-level* serverless Postgres option (branching for preview
  envs, scale-to-zero). **Do not run both Supabase Postgres and Neon for the same small app** without a
  concrete reason — it doubles cost and split-brains your data/auth model.
- **Rule:** Supabase when you need auth+RLS+storage+realtime together (BorderPass and most Maralito
  apps). Neon only for a service that needs *just* serverless Postgres with cheap branching and no
  Supabase-auth coupling. See `COST_OPTIMIZATION_GUIDE.md`.

## Vercel — deployment
**State:** documented target (Vercel app + Cloudflare DNS/WAF/R2). **No `vercel.json`** and no
deploy has run. The Next.js app **does compile** (`next build` succeeds before the type-check leak),
so the build pipeline is close.
**Before "deploy ready":** fix the build gate (drizzle-orm type leak), map all 48 env vars into Vercel
project/preview/prod scopes, confirm monorepo root + build command (`turbo build` / app filter),
verify RSC/serverless compatibility of server-only modules, set preview-branch DB strategy.
**Gate:** `NOT FULLY VALIDATED — LIVE DEPLOY REQUIRED`.

## AWS — when (and when not)
**State:** no `infra/`, no Terraform, no Dockerfile. This is appropriate for the current phase.
**Use AWS only when a real infrastructure need appears:**
| Need | AWS service | Use when |
|------|-------------|----------|
| Durable object storage / backups | **S3** | large files, receipt/inspection media, DB backups beyond Supabase |
| Queues / events at scale | **SQS / EventBridge** | when Inngest + Postgres outbox is outgrown |
| Scheduled jobs | **EventBridge Scheduler** | cron beyond Vercel/Inngest |
| Private networking / data residency | **VPC** | enterprise/compliance deployment |
| Secrets | **Secrets Manager / SSM** | when off Vercel-managed env |
**Avoid:** standing up EKS/ECS or heavy infra before there's load to justify it. Prefer Vercel +
Supabase + Inngest + Cloudflare R2 until a concrete durability/networking requirement forces AWS.
**Gate:** 🟡 documented intent; nothing to validate yet.

## Overall production-readiness verdict
The **core platform** (auth, RLS-aware DB, orders domain, observability) is near-ready pending the
foundation fixes + live RLS gate. The **revenue/comms/AI integrations are deliberately not built yet**
(future phases). Therefore the app is **not production-ready as a billable SaaS** today, and must not
be described as such. It **is** ready to be the foundation other phases build on.
