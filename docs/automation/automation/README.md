# Maralito Automation Platform — Architecture & Implementation Blueprint

> **Status:** Draft v0.1 · **Owner:** Automation Engineering (Chief Automation Architect / AI Orchestration Lead) · **Last updated:** 2026-06-29
> **Scope:** Architecture, workflow engine design, event model, agent orchestration, human approval system, data model, and roadmap for the **Maralito Automation Platform**.
> **Non-goal:** Application code. This is a design blueprint only.

---

## What this is

The **Maralito Automation Platform** is the workflow + automation layer that powers autonomous and semi-autonomous business operations across all Maralito Labs apps. It connects **app events → AI agents → human approvals → notifications → payments → documents → operations tasks → analytics** into durable, observable, versioned workflows.

It is a **layer of the broader Maralito Platform** (see the parent blueprint in [`../docs`](../docs)). It **consumes** existing platform services rather than rebuilding them:

| It needs… | It uses platform service… |
|-----------|---------------------------|
| To emit/consume events | Event Bus & Workflows ([../docs/06](../docs/06-api-and-events.md)) |
| To run AI/agents | AI Platform — LLM gateway, LangGraph, tools, memory, RAG ([../docs/07](../docs/07-ai-platform.md)) |
| To message customers/staff | Notifications (S4) |
| To collect money | Payments & Billing (S3) |
| To store/produce documents | Files & Documents (S5) |
| To record what happened | Audit & Compliance (S7) |
| To track product/ops metrics | Analytics (S8) |
| Identity, tenancy, RBAC, RLS | Identity & Access (S1) + Security (S14) |

The automation platform adds what those services don't: a **durable workflow engine**, an **orchestration model** that sequences agents + humans + side effects, a **rules engine**, **task queues**, an **approval system**, and the **authoring/observability tooling** to build and run all of it safely.

**BorderPass** is the first consuming app; 12 of its operations are modeled end-to-end in [Workflows: BorderPass](./docs/14-borderpass-workflows.md). The platform is deliberately app-agnostic so future apps reuse the same engine, event model, and agent fabric.

## How to read this blueprint

| # | Document | Required outputs covered |
|---|----------|--------------------------|
| 00 | **README** (this file) | (1) Executive summary · (2) Vision · (18) Stack summary |
| 01 | [Executive Summary & Vision](./docs/01-exec-summary-and-vision.md) | (1), (2) |
| 02 | [Workflow Architecture](./docs/02-workflow-architecture.md) | (3) |
| 03 | [Event Bus & Standard Event Schema](./docs/03-event-bus-and-schema.md) | (4), (5) |
| 04 | [Workflow Lifecycle & Versioning](./docs/04-workflow-lifecycle.md) | (6) |
| 05 | [AI Agent Orchestration](./docs/05-agent-orchestration.md) | (7) |
| 06 | [Human-in-the-Loop & Approval System](./docs/06-human-in-the-loop-and-approvals.md) | (8), (12) |
| 07 | [Rules Engine](./docs/07-rules-engine.md) | (9) |
| 08 | [Task Queues & Management](./docs/08-task-queues.md) | (10) |
| 09 | [Notification Automation](./docs/09-notification-automation.md) | (11) |
| 10 | [Scheduling & Integration Layer](./docs/10-scheduling-and-integration.md) | core capabilities 8 & 9 |
| 11 | [Retry, Failure & Recovery](./docs/11-retry-failure-recovery.md) | (13) |
| 12 | [Observability & Monitoring](./docs/12-observability.md) | (14) |
| 13 | [Security & Permissions](./docs/13-security-and-permissions.md) | (15) |
| 14 | [BorderPass Workflows (12, detailed)](./docs/14-borderpass-workflows.md) | (16) |
| 15 | [Future App Workflow Examples](./docs/15-future-app-workflows.md) | (17) |
| 16 | [Recommended Automation Stack](./docs/16-stack.md) | (18) |
| 17 | [Database Tables Needed](./docs/17-data-model.md) | (19) |
| 18 | [API Endpoints Needed](./docs/18-api-endpoints.md) | (20) |
| 19 | [Admin Dashboard Requirements](./docs/19-admin-dashboard.md) | (21) |
| 20 | [Developer Workflow Authoring Experience](./docs/20-developer-experience.md) | (22) |
| 21 | [Roadmap (MVP + v1)](./docs/21-roadmap.md) | (23), (24) |
| 22 | [Risks & Mitigations](./docs/22-risks-and-mitigations.md) | (25) |
| 23 | [Implementation Backlog](./docs/23-implementation-backlog.md) | (26) |

## Recommended stack (decision summary — detail in [§16](./docs/16-stack.md))

| Concern | Decision | Note |
|---------|----------|------|
| Durable workflow engine | **Inngest** or **Trigger.dev** (pick one) | Step-level durability, retries, sleep, fan-out; choose via a spike on BorderPass load |
| Agent orchestration | **LangGraph** | Stateful agent graphs, checkpoints, human-in-the-loop nodes |
| Event transport / state | **Upstash Redis** + Postgres outbox | At-least-once, idempotent; durable history in Postgres |
| Primary datastore | **Neon Postgres** (+ Supabase where used) | Workflow/agent/task/approval tables; RLS for tenancy |
| App + control plane host | **Vercel** | Next.js apps + admin dashboard + API routes |
| Notifications | **Resend** (email) · **Twilio/WhatsApp** (SMS/WA) | Via platform Notifications service |
| Payments events | **Stripe webhooks** | Ingested by Payments service, surfaced as events |
| Product/agent analytics | **PostHog** | Workflow + agent metrics, funnels |
| Errors / tracing | **Sentry** + **OpenTelemetry** | Distributed traces across workflow → agent → tool → model |

> **`⚠️ VERIFY` discipline (carried over from the platform blueprint):** every third-party limit, price, or feature claim (engine max step duration, concurrency caps, Upstash limits, Neon branching, WhatsApp template rules, model pricing) must be confirmed against official docs and recorded in an ADR before you depend on it. Flagged inline as `⚠️ VERIFY`.

## Conventions

- **`DECISION`** — recommended choice + rationale + alternative.
- **`ACCEPTANCE`** — acceptance criteria.
- **`⚠️ VERIFY`** — third-party claim to confirm against official docs.
- Diagrams are **Mermaid**. Tenancy term: **org** = tenant; **app** = a Maralito product (BorderPass, etc.).
- A **workflow** is a versioned, durable, multi-step process. A **step** is one unit (a function, an agent call, an approval, a wait). An **agent** is an AI actor that runs as a step. A **task** is human work placed on a queue.

## Changelog

| Version | Date | Author | Change |
|---------|------|--------|--------|
| v0.1 | 2026-06-29 | Automation Engineering | Initial blueprint: all 26 outputs + 12 BorderPass workflows |
