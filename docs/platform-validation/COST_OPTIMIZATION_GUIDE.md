# Cost Optimization Guide — Maralito Labs

> **Goal:** enterprise-quality apps at low cost. Default posture: **reuse the platform; add a paid
> service only when a real need is proven.** Aligns with the locked stack (Supabase, Vercel, Stripe,
> Resend, Inngest, LangGraph-via-gateway, PostHog, Sentry/OTel).

## Decision rules (the short version)
1. **Vercel** for the Next.js frontend/BFF. **Supabase** when you need auth + RLS + storage + realtime
   together. **Neon** only for a service that needs *just* serverless Postgres. **Never pay for both
   Supabase Postgres and Neon** on one small app without a concrete reason.
2. **AWS only for durable infrastructure needs** (S3 backups, SQS/EventBridge at scale, private
   networking, scheduled jobs beyond Inngest). Don't stand up EKS/ECS speculatively.
3. **AI:** mocked tests by default; token budgets per user/workflow; cache + batch; cheap models for
   low-risk tasks, expensive models only for reasoning-heavy steps.
4. **Observability:** prefer open-source/self-hosted where it doesn't add ops drag; keep generous free
   tiers (Sentry, PostHog) until volume forces a paid plan.

## Vercel
- **Use for:** Next.js app + BFF + preview deploys per PR (great DX).
- **Cost risks:** bandwidth, image optimization, function GB-hours, and **build minutes** in a monorepo
  (Turbo rebuilds). Long-running/CPU-heavy work on serverless functions gets expensive.
- **Controls:** Turbo remote cache to cut build minutes; move long/cron/queue work to **Inngest** (not
  Vercel functions); Cloudflare R2 for static/media egress; set a spend cap + alerts.
- **Move elsewhere when:** sustained CPU/long-running jobs, large egress, or private networking — then
  AWS/Cloudflare.

## Supabase
- **Use for:** auth, Postgres, RLS, storage, realtime — the BorderPass/default case.
- **Avoid waste:** don't over-provision compute; watch **egress** and storage; cache reads; use the
  connection **pooler** (and verify RLS through it — see RLS report). RLS itself is essentially free
  (policy eval in-DB) — the cost is bad queries, not the policies.
- **Backups:** rely on Supabase PITR on paid tiers; for cheap durability, periodic logical dumps to
  **S3**. Edge functions can surprise on cost — prefer Vercel/Inngest unless you need DB-proximate edge.

## Neon
- **Use when:** a standalone service needs serverless Postgres with cheap **branching** and no
  Supabase-auth coupling (e.g., an analytics or internal tool DB).
- **Don't use when:** the app already uses Supabase Postgres — running both splits data/auth and
  doubles cost. **Warning:** duplicating Supabase Postgres + Neon for one small app is the most common
  avoidable spend. Pick one per app.

## Resend
- **Use for:** transactional email. **Control volume:** idempotent-per-event sends (already in the
  notifications design), quiet hours, channel fallback (WhatsApp→SMS→email) so you don't pay for every
  channel. Verify the sending domain (SPF/DKIM/DMARC) to protect deliverability. Handle bounces/
  complaints to avoid wasted retries. Stay within free tier until real volume; batch digests where UX
  allows.

## AWS (only when justified)
| Need | Service | Cost note |
|------|---------|-----------|
| Object storage / backups | **S3** (or Cloudflare R2 — cheaper egress) | lifecycle rules → IA/Glacier |
| Queues / events at scale | **SQS / EventBridge** | only when Inngest + Postgres outbox is outgrown |
| Scheduled jobs | **EventBridge Scheduler** | cheap; beats idle containers |
| Compute | **Lambda** > containers for spiky/low-volume | avoid EKS/ECS until steady load justifies it |
| Logs | **CloudWatch** | set retention (7–30d) + metric filters; don't keep logs forever |
| Secrets | **Secrets Manager / SSM** | SSM Parameter Store is cheaper for simple secrets |
**Rule:** Lambda + S3 + SQS + EventBridge cover most needs cheaply; reserve EKS/ECS for real scale.

## AI providers (LangGraph via gateway)
- **Mocked tests by default** — never burn tokens to prove plumbing.
- **Token budgets** per user and per workflow; hard caps; **no autonomous infinite loops**.
- **Cache** repeated results (e.g., product-URL extraction); **batch** where possible.
- **Model tiering:** cheap/fast model for extraction/classification/drafting; reserve the expensive
  reasoning model for risk/quote/compliance reasoning. The gateway meters cost — expose it.
- **Human-in-the-loop** also saves money: no expensive autonomous retries on risky actions.

## Observability — compare
| Tool | Best for | Cost posture |
|------|----------|--------------|
| **OpenTelemetry** | vendor-neutral traces/metrics (already a dep) | free; you pay the backend |
| **Sentry** | error tracking | generous free tier; cap event volume |
| **PostHog** | product analytics (self-host option) | free/self-host to control cost |
| **Langfuse** | LLM tracing/evals — **self-hostable** | **preferred for AI tracing on cost** (OSS) |
| **LangSmith** | LLM tracing/evals — hosted, deep LangChain integration | convenient; watch per-trace cost at volume |
| Cloud-native logs (CloudWatch/Vercel) | infra logs | set retention to control spend |
**Recommendation:** OTel + Sentry + PostHog for app; **Langfuse (self-hosted)** for AI traces to avoid
per-trace SaaS cost, with LangSmith as an option if the team wants hosted convenience early.

## When to upgrade (don't pre-pay)
Start on free/low tiers. Upgrade only on a real signal: Vercel build-minute/bandwidth ceilings,
Supabase compute/egress limits, Resend volume, or AI token spend crossing a budget. Add alerts at
70% of each tier so upgrades are deliberate, not surprise overages.
