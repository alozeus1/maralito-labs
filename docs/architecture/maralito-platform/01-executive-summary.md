# 01 · Executive Platform Summary

## The bet in one paragraph

Maralito Labs intends to ship many products. The slowest, riskiest, most-duplicated work in any new product is not the product itself — it is the plumbing: authentication, tenancy, payments, notifications, file handling, AI orchestration, audit, analytics, and the security/compliance posture around all of it. The **Maralito Platform** builds that plumbing **once**, as a set of reusable, secure, AI-native services with stable contracts, so each new app (starting with **BorderPass**) launches in weeks instead of quarters and inherits enterprise-grade security and observability by default rather than by heroics.

## What we are building

A **shared platform** exposing a coherent set of services to all Maralito apps:

- **Identity & Access** — auth, orgs/tenants, RBAC, API keys, sessions, MFA-ready.
- **User Profile** — one canonical customer profile (addresses, contacts, preferences, payment methods, KYC metadata) reused across apps.
- **Payments & Billing** — Stripe-based payments, invoices, subscriptions, usage billing, platform fees, financial audit trail.
- **Notifications** — email, SMS, WhatsApp, push, in-app, with templates, delivery tracking, retries, and per-user preferences.
- **Files & Documents** — secure upload/storage of receipts, invoices, PDFs, images, inspection photos, with tagging, expiration, and access control.
- **AI Platform** — LLM gateway, model routing, prompt library, tool registry, LangGraph orchestration, agent memory, RAG, embeddings, cost tracking, guardrails, human approval, and evaluation.
- **Audit & Compliance** — immutable, queryable event history of who did what, when, across users, admins, and agents.
- **Analytics** — product, revenue, operational, and agent-performance metrics with dashboards.
- **Search & Knowledge** — global and app-scoped search, vector search, document/customer/entity search.
- **API Platform** — internal + public APIs, webhooks, auth, rate limiting, versioning, developer docs.
- **Localization, Feature Flags & Config, Observability, Security, and Developer Experience** as cross-cutting platform capabilities.

## How apps consume it

Each app is a **thin product layer** on top of the platform. It owns its domain data and UI, and calls the platform through three contracts:

1. **A typed SDK** (`@maralito/sdk`) — the only sanctioned way an app talks to platform services.
2. **Versioned APIs** — internal (service-to-service) and public (partners/customers).
3. **Events** — apps and services react to a shared event stream (durable, replayable) rather than calling each other synchronously where possible.

This keeps apps decoupled from platform internals: we can re-implement a service behind its contract without breaking apps.

## Architectural posture (the short version)

- **Multi-tenant from day one.** Org is the tenant boundary; **Postgres Row-Level Security (RLS)** enforces isolation at the database, not just in app code.
- **Modular monolith first, services later.** Start as a well-bounded modular monolith on Next.js + a platform API, with clean service boundaries and separate schemas, so we can extract services when scale demands — without a rewrite.
- **Platform DB + per-app DB.** Platform-owned data (identity, billing, audit, AI) lives in the platform database; each app gets its **own database/schema** for its domain data. No app reaches into another app's tables.
- **Event-driven where it matters.** Durable workflows (Inngest/Trigger.dev) and an event log decouple side effects (notifications, billing, AI, analytics) from the request path.
- **AI is a first-class platform tier**, not bolted onto each app: one gateway, one cost ledger, one guardrail layer, one human-approval mechanism.
- **Security and observability are defaults, not add-ons.** Least privilege, KMS/CMEK encryption, secrets management, audit logging, SAST/IaC/container scanning in CI, and tracing/metrics/logs wired through the SDK.

## Phasing (see [Roadmap](./12-roadmap.md))

- **MVP (≈ Quarter 1):** Identity, Profile, Payments (core), Notifications (email + one channel), Files, Audit, minimal AI gateway, observability, CI/CD with security gates — enough for **BorderPass** to ship.
- **v1 (≈ Quarters 2–3):** Full notifications (SMS/WhatsApp/push), subscriptions + usage billing + platform fees, RAG + agent orchestration + human approval, analytics dashboards, public API + webhooks, feature flags, localization (EN/ES).
- **Future:** Marketplace/fintech primitives, fraud engine, multi-region, advanced AI evaluation, partner developer platform, SOC 2 / ISO readiness.

## What success looks like

- A **second app** can reach production reusing ≥ 80% of platform services with **zero** re-implementation of auth, billing, notifications, files, or AI.
- New app onboarding to the platform: **< 1 week** to a working authenticated, billable, observable skeleton.
- Security posture is **inherited**: every app gets RLS, audit, encryption, and CI security gates by default.
- **One** place to see cost, usage, and reliability across all apps and all AI spend.

## Top risks (full list in [Risks](./13-risks-and-mitigations.md))

1. **Over-coupling apps to platform internals** → mitigated by SDK/API/event contracts and versioning.
2. **Premature microservices** → mitigated by modular-monolith-first.
3. **Multi-tenant data leakage** → mitigated by RLS + tenant-scoped SDK + automated isolation tests.
4. **AI cost/safety sprawl** → mitigated by central gateway, budgets, guardrails, human-in-the-loop.
5. **Vendor lock-in / limit surprises** → mitigated by abstraction layers and the `⚠️ VERIFY` discipline.
