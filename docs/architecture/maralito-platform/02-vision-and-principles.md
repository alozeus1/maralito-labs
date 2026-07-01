# 02 · Platform Vision & Principles

## Platform vision

> **Maralito Labs builds products on a shared, secure, AI-native platform so that launching a new product is a matter of assembling proven services — not rebuilding foundations.**

Concretely, in 18–24 months the platform should make the following true:

- **Speed:** A new product idea can reach a secure, billable, observable MVP in weeks because identity, payments, notifications, files, AI, and analytics already exist and are consumed through one SDK.
- **Safety by default:** Every app inherits least-privilege access, tenant isolation, encryption, audit trails, and AI guardrails without each team re-deriving them.
- **AI-native:** AI is not a feature bolted onto apps; it is a platform tier with a single gateway, shared memory/RAG, cost governance, and human-approval workflows that any app can call.
- **One source of truth per concern:** One identity, one customer profile, one billing ledger, one audit history, one AI cost ledger — across all apps.
- **Composability over coupling:** Apps and services interact through stable contracts (SDK, versioned APIs, events), so any service can evolve internally without breaking consumers.
- **Operable at scale:** A single pane for cost, reliability, and usage across all apps and all AI spend.

### Anti-vision (what we are explicitly NOT building)

- Not a generic "internal developer platform" that tries to be everything for everyone on day one.
- Not a constellation of microservices before we have the scale or team to justify them.
- Not a BorderPass-specific backend with reusable bits sprinkled in. BorderPass is a *tenant of the platform*, not its definition.
- Not a place where each app invents its own auth/payments/notifications.

## Platform principles

These are the decision rules. When a design choice is ambiguous, resolve it in favor of the higher-numbered, more specific principle that applies.

### P1 — Platform is a product; apps are its customers
The platform has a roadmap, contracts, versioning, deprecation policy, changelog, and developer docs. App teams are treated as customers with SLAs and migration support. We never break a consumer silently.

### P2 — Contracts over internals
Apps consume the platform **only** through the SDK, versioned APIs, and events. No app reads another app's database or a platform service's internal tables directly. This is what lets us refactor freely.

### P3 — Secure and compliant by default, not by reminder
Least privilege, encryption at rest and in transit, tenant isolation via RLS, audit logging, secret management, and input validation are **built into the platform primitives**, so an app gets them by using the platform — not by remembering to add them. Compliance-aware patterns (SOC 2 / ISO / NIST / DoD-style controls) inform design even before formal certification.

### P4 — Multi-tenant and multi-app from line one
Every platform table that holds customer data carries an `org_id` (tenant) and, where relevant, an `app_id`. Isolation is enforced at the database (RLS) and re-asserted in the SDK. There is no "we'll add tenancy later."

### P5 — Modular monolith first; extract services on evidence
Start with clean module boundaries inside a monorepo and a single deployable platform API. Extract a service into its own deployable **only** when a measured constraint (scaling, blast radius, team ownership, compliance isolation) justifies it. Boundaries are designed so extraction is mechanical, not a rewrite.

### P6 — Event-driven for side effects; synchronous for reads
The request path stays fast and predictable. Side effects — sending notifications, charging cards, indexing for search, running AI, emitting analytics, writing audit — happen via durable, retryable, idempotent workflows reacting to events. User-facing reads can be synchronous.

### P7 — AI is governed centrally
All model calls go through the LLM gateway. The gateway owns routing, cost tracking, rate limits, guardrails, prompt/version management, and logging. No app calls a model provider directly. Human approval is a platform-provided control any agent workflow can require.

### P8 — Everything is observable and auditable
Every meaningful action produces a structured log, a metric, and (for sensitive/state-changing or agentic actions) an immutable audit record. Traces span the SDK call through services, workflows, and model calls. If we can't see it, we don't ship it.

### P9 — Least privilege everywhere
Humans, services, CI, and AI agents each get the minimum permissions needed, scoped by org and app. Credentials are short-lived and managed centrally. Powerful actions (refunds, data exports, destructive ops, agent writes) require explicit elevation and leave audit trails.

### P10 — Type-safe end to end
TypeScript + Zod schemas define the contract once and reuse it across DB (Drizzle), API, SDK, and UI. A breaking change to a contract is a typed, reviewable diff — not a runtime surprise.

### P11 — Idempotency and replayability
External effects (payments, messages, webhooks, AI actions) are idempotent by key and replayable. Retries are safe. We assume at-least-once delivery and design for it.

### P12 — Cost is a design constraint
Every service tracks its cost drivers (DB, egress, messaging, model tokens, storage). AI and messaging especially carry budgets and alerts. We can attribute spend to app, org, and feature.

### P13 — Boring, well-supported technology at the core
Favor mature, well-documented building blocks (Postgres, Stripe, standard auth patterns) over novel ones for core paths. Reserve novelty for genuine differentiators (AI orchestration). Verify all third-party limits/pricing against official docs (`⚠️ VERIFY`).

### P14 — Reversible decisions move fast; irreversible decisions get scrutiny
Feature flags, branch-based previews, and abstraction layers keep most choices reversible. The few one-way doors (tenancy model, identity model, audit immutability, data ownership) get explicit ADRs and review.

### P15 — Developer experience is a feature
A new engineer should run the whole platform locally, get a preview environment per PR, and ship a change behind a flag on day one. Friction in DX compounds into slow product delivery, so we invest in it deliberately.
