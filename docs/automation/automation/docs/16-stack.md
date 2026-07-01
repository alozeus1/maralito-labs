# 16 · Recommended Automation Stack

Covers required output **(18)**. Reuses the parent platform stack; this focuses on automation-specific choices and the trade-offs to validate.

---

## 16.1 Stack summary

| Concern | Recommendation | Role | `⚠️ VERIFY` before depending |
|---------|----------------|------|------------------------------|
| **Durable workflow engine** | **Inngest** *or* **Trigger.dev** (pick one) | Durable steps, retries, sleep, cron, fan-out, concurrency | Max step/run duration, concurrency limits, pricing, self-host |
| **Agent orchestration** | **LangGraph** | Stateful agent graphs, checkpoints, HITL nodes | Checkpointer ↔ engine/Postgres integration |
| **Event transport / queues / locks** | **Upstash Redis** | At-least-once delivery aids, rate limits, idempotency keys, lightweight queues | Limits, throughput, latency |
| **Durable state / history / outbox** | **Neon Postgres** | Workflow/agent/task/approval tables, event history, outbox | Connection/pooling for serverless, branching limits |
| **Auth, RLS, some storage** | **Supabase** (where used) | Auth + RLS tooling (per platform decision) | Keep single source of truth; pricing |
| **Host / control plane** | **Vercel** | Next.js apps, admin dashboard, API routes, webhook endpoints | Function timeout limits (use engine for long work) |
| **Email** | **Resend** | Transactional email (via Notifications S4) | Limits, deliverability |
| **SMS / WhatsApp** | **Twilio / WhatsApp Business** | SMS + WA (via Notifications S4) | WA template approval + opt-in rules |
| **Payments events** | **Stripe webhooks** | Payment/refund/dispute events into the bus | Webhook signing, event types, idempotency |
| **Product / agent analytics** | **PostHog** | Workflow + agent metrics, funnels, flags | Event volume limits |
| **Errors / performance** | **Sentry** | Error tracking + performance + trace correlation | Serverless trace propagation |
| **Distributed tracing** | **OpenTelemetry** | Vendor-neutral traces across run→agent→tool→model | Export path on Vercel + engine |

## 16.2 Key decision — workflow engine

`DECISION:` Standardize on **one** durable engine. Evaluate against BorderPass's real workloads:

| Criterion | Inngest | Trigger.dev |
|-----------|---------|-------------|
| Event-triggered functions + fan-out + concurrency/throttle | Strong | Good |
| Long-running tasks (border crossing spanning days) | Good (durable sleep) | Strong (long-duration tasks) |
| Step durability / replay | Yes | Yes |
| Cron / scheduled | Yes | Yes |
| Local dev experience | Local dev server | Local dev |
| Self-host / data-residency option | `⚠️ VERIFY` | `⚠️ VERIFY` |
| Pricing model at our volume | `⚠️ VERIFY` | `⚠️ VERIFY` |

**Recommendation:** Run a **1–2 week spike** implementing W1 (intake) + W6 (payment, long wait) + W9 (border crossing, multi-day) on each, measuring durability, long-wait behavior, concurrency controls, observability, and cost. Lean **Inngest** if event fan-out + concurrency dominate; **Trigger.dev** if long-running multi-day tasks dominate. Do **not** run both in production.

## 16.3 Key decision — agents on top of the engine

`DECISION:` **LangGraph for agent logic, the durable engine for persistence/long-waits.** The engine owns "this run is paused for 3 days waiting on approval"; LangGraph owns "the agent's reasoning graph." The agent manager (§05) binds them. `⚠️ VERIFY` LangGraph's Postgres checkpointer + how it interleaves with engine step durability — this is the riskiest integration; spike it early.

## 16.4 What we deliberately reuse (not rebuild)
- **Events, notifications, payments, files, audit, analytics, identity/RLS** = platform services (parent blueprint). The automation platform **orchestrates** them; it does not re-implement them.
- **Upstash + Postgres outbox** = the event delivery substrate already defined for the platform.

## 16.5 Build vs. buy posture
- **Buy/adopt** the hard, undifferentiated reliability primitives (durable engine, tracing, analytics, error tracking).
- **Build** the differentiators: the workflow/agent/approval/rules **model**, the registries, the authoring + simulation DX, and the BorderPass/app workflows.

## 16.6 Acceptance criteria (stack)
`ACCEPTANCE:`
- One durable engine chosen via a measured spike (durability, long-wait, concurrency, cost) and recorded in an ADR.
- LangGraph↔engine checkpoint integration proven on a long-waiting agent workflow.
- No automation feature re-implements an existing platform service.
- Every `⚠️ VERIFY` item resolved into an ADR before the dependent capability is built.
