# Maralito Platform — Architecture & Implementation Blueprint

> **Status:** Draft v0.1 · **Owner:** Platform Engineering (CTO / Chief Platform Architect) · **Last updated:** 2026-06-29
> **Scope:** Architecture, service design, product requirements, and engineering roadmap for the shared Maralito Platform.
> **Non-goal of this document:** Application code. This is a blueprint only. No production code is written yet.

---

## What this is

The **Maralito Platform** is the shared, AI-native foundation that every future Maralito Labs product consumes. Instead of each app rebuilding authentication, payments, notifications, AI workflows, analytics, storage, audit logs, and automation, apps plug into a common set of platform services through stable contracts (SDK + APIs + events).

**BorderPass** is the **first consuming application**. It is used here to validate the platform with a real workload, but the platform is deliberately designed to be app-agnostic so that future SaaS, marketplace, logistics, fintech, and AI products can onboard cleanly.

## How to read this blueprint

This is a multi-file engineering reference. Read top to bottom for a full picture, or jump to the area you own.

| # | Document | Covers (mapped to the required outputs) |
|---|----------|------------------------------------------|
| 00 | **README** (this file) | Index, reading guide, conventions |
| 01 | [Executive Summary](./docs/01-executive-summary.md) | (1) Executive platform summary |
| 02 | [Vision & Principles](./docs/02-vision-and-principles.md) | (2) Platform vision · (3) Platform principles |
| 03 | [Service Catalog](./docs/03-service-catalog.md) | (4) Service catalog |
| 04 | [System Architecture](./docs/04-system-architecture.md) | (5) Architecture diagram · (6) Service boundaries · (7) Data ownership · (8) Multi-app · (9) Multi-tenant · (10) Shared vs app DB |
| 05 | [Identity, AuthN & AuthZ](./docs/05-authentication-authorization.md) | (11) Authentication & authorization model |
| 06 | [API & Event Architecture](./docs/06-api-and-events.md) | (12) API design strategy · (13) Event-driven architecture |
| 07 | [AI Platform](./docs/07-ai-platform.md) | (14) AI platform architecture |
| 08 | [Security Architecture](./docs/08-security-architecture.md) | (15) Security architecture |
| 09 | [Observability](./docs/09-observability.md) | (16) Observability architecture |
| 10 | [CI/CD & DevSecOps](./docs/10-cicd-devsecops.md) | (17) CI/CD and DevSecOps plan |
| 11 | [Repo Structure & Environments](./docs/11-repo-and-environments.md) | (18) Folder/repo structure · (19) Environment strategy |
| 12 | [Roadmap](./docs/12-roadmap.md) | (20) MVP · (21) v1 · (22) Future roadmap |
| 13 | [Risks & Mitigations](./docs/13-risks-and-mitigations.md) | (23) Risks and mitigations |
| 14 | [Implementation Backlog](./docs/14-implementation-backlog.md) | (24) Epics & user stories |

## Recommended stack (decision summary)

The detailed rationale lives in [System Architecture](./docs/04-system-architecture.md) and [CI/CD & DevSecOps](./docs/10-cicd-devsecops.md). At a glance:

| Layer | Decision | Notes |
|-------|----------|-------|
| Web/app framework | **Next.js + TypeScript** | App Router, RSC, server actions for BFF |
| Language/runtime | **TypeScript everywhere** | Shared types end-to-end |
| Primary database | **Postgres** — **Neon** (platform) | Branching for preview envs; serverless scale-to-zero |
| Auth + Postgres + storage + realtime | **Supabase** (evaluated) | See decision note below — used selectively, not as the only DB |
| ORM / schema | **Drizzle** (primary) + **Zod** | Type-safe SQL, lightweight migrations; Zod for runtime validation |
| Hosting / edge | **Vercel** + **Cloudflare** | Vercel for app/Next.js; Cloudflare for DNS, WAF, R2, edge |
| Payments | **Stripe** | Connect for marketplace/platform fees |
| Email | **Resend** | Transactional + templates |
| SMS / WhatsApp | **Twilio** (+ WhatsApp Business) | Programmable messaging |
| Background jobs / workflows | **Inngest** or **Trigger.dev** | Durable, event-driven; see comparison in §06 |
| AI orchestration | **LangGraph** | Stateful agent graphs, human-in-the-loop |
| Cache / rate limit / queues | **Upstash Redis** | Serverless Redis, REST-friendly |
| Product analytics | **PostHog** | Events, funnels, flags, session replay |
| Error & perf monitoring | **Sentry** | Errors, traces, performance |
| CI/CD | **GitHub Actions** | With security gates (SAST, IaC scan, container scan) |

> **Important stack caveat (per engineering standards):** Pricing, service limits, regional availability, and feature sets for all third-party services above change over time. **Every "X supports Y" claim in this blueprint must be re-verified against the vendor's official docs before you build on it.** Items that are version- or limit-sensitive are explicitly flagged with `⚠️ VERIFY` throughout.

## Conventions used in this blueprint

- **`⚠️ VERIFY`** — a claim about a third-party capability, limit, or price that must be confirmed against official docs before implementation.
- **`DECISION`** — a recommended choice with rationale and the alternative considered.
- **`ACCEPTANCE`** — acceptance criteria for an epic or capability.
- Diagrams are in **Mermaid** so they render in GitHub/most Markdown viewers and stay diffable in git.
- Tenancy term: **Organization (org)** = a tenant boundary. **App** = a Maralito product (e.g., BorderPass). A user may belong to multiple orgs and use multiple apps.

## Document changelog

| Version | Date | Author | Change |
|---------|------|--------|--------|
| v0.1 | 2026-06-29 | Platform Engineering | Initial blueprint across all 24 required sections |
