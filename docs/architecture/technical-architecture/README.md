# BorderPass — Technical Architecture Document (TAD)

> **Status:** Draft v0.1 · **Owners:** CTO / Principal Architect / DevSecOps / Cloud / AI Systems / TPM · **Last updated:** 2026-06-29
> **App:** **BorderPass** (Powered by Maralito Labs). First app on the [Maralito Platform](../../maralito-platform/docs) + [Automation Platform](../../maralito-platform/automation).
> **Implements:** the [BorderPass PRD](../README.md) + Stitch design direction.
> **Constraint honored:** architecture only — **no code, no SQL, no implementation files.** Text-based diagrams throughout. Code-level data/API/event contracts are deferred (see [contracts/](../contracts/README.md)).

---

## Deliverable 1 · Executive technical summary

BorderPass is engineered as a **thin, premium product application on top of the Maralito Platform and Automation Platform**. It reuses shared services (auth, profiles, payments, notifications, files, AI, audit, analytics, localization, flags, observability, API platform) and the automation fabric (event bus, durable workflow engine, human approvals, LangGraph orchestration, task queues, rules engine) — so the engineering effort concentrates on the **cross-border domain**: the 24-status order lifecycle, the El Paso Hub + inspection + crossing + delivery operations, the customer "Border Journey" experience, and the AI agents that assist (recommend-only, with human approval on risky/compliance/financial decisions).

The system is a **Next.js (App Router) + TypeScript** application on **Vercel**, with a **Backend-for-Frontend** (server actions + route handlers) as the only place app code calls the platform SDK, sets tenant context, validates input (Zod), and triggers workflows. The **order lifecycle is a durable workflow** on the automation engine (Inngest or Trigger.dev) — not app-coded chains — giving retries, timeouts, compensation, and replay. BorderPass owns **its own Postgres database (Neon)**, RLS-isolated by tenant, and references platform-owned data (users, payments, audit) by id. **AI agents run through the platform AI gateway** as governed workflow steps. Security and compliance are defaults: RLS tenant isolation, field-encryption for PII/RFC/financial data, audit on every sensitive action, and a **mandatory human compliance gate** on every order (MVP) given the customs sensitivity.

The architecture is built to be **shipped in phases**: an MVP that runs a polished automated customer experience over mostly-manual operations, then a V1 that deepens automation and AI. It is production-oriented (observability, SLOs, DR, CI/CD with security gates) while right-sized for a pilot (modular monolith, manual ops gates). The single hard external dependency is the **Compliance & Customs Operating Model** (legal), which gates real cross-border orders.

## Deliverable 3 · Recommended final stack (with reasoning)

| Layer | Final choice | Reasoning | Alt considered |
|-------|--------------|-----------|----------------|
| Web framework | **Next.js App Router** | RSC + server actions = type-safe BFF; one framework for customer/admin/ops; Vercel-native | Remix, separate SPA+API |
| Language | **TypeScript** (end-to-end) | Shared types/Zod across UI, BFF, workflows, SDK | — |
| Styling | **Tailwind CSS** + Stitch tokens over `@maralito/ui` | Implements the approved design system fast, consistently | CSS-in-JS |
| Hosting | **Vercel** (app) + **Cloudflare** (DNS/WAF/CDN) | Next.js-native deploys + previews; edge security | self-host |
| Auth | **Supabase Auth** behind the platform `auth.*` SDK | Fastest MVP auth (phone OTP, MFA-ready); abstracted so re-hostable | Auth.js on Neon |
| Primary DB | **Neon Postgres** (BorderPass DB) | Branch-per-PR previews; serverless; clean per-app DB (platform two-tier model) | Supabase Postgres |
| Storage | **Supabase Storage or Cloudflare R2** behind Files (S5) | Signed-URL uploads; receipts/photos/docs; choose one `⚠️ VERIFY` | direct S3 |
| ORM | **Drizzle** + **Zod** | Type-safe SQL, lightweight migrations, branch-friendly; Zod runtime validation | Prisma |
| Payments | **Stripe** (via platform Payments S3) | Standard; Connect-ready for future; no raw card data | — |
| Email | **Resend** (via Notifications S4) | Transactional + templates | — |
| SMS/WhatsApp | **Twilio / WhatsApp Business** (via S4) | WhatsApp is the corridor's primary channel | — |
| AI orchestration | **LangGraph** via platform AI gateway | Stateful agents, checkpoints, HITL nodes; governed centrally | bespoke |
| Workflow engine | **Inngest or Trigger.dev** (pick one via spike) | Durable steps, retries, sleep, fan-out, replay | bespoke queues |
| Cache/limits/idempotency | **Upstash Redis** | Serverless; rate limits, idempotency keys, light queues | — |
| Product analytics | **PostHog** | Events, funnels, flags | — |
| Errors/perf | **Sentry** | Errors + performance + trace correlation | — |
| Tracing | **OpenTelemetry** | Vendor-neutral traces across app→workflow→agent | — |
| CI/CD | **GitHub Actions** | Security-gated pipelines; OIDC to cloud | — |

> Final engine + storage picks carry `⚠️ VERIFY` (limits/pricing) and are resolved by a short spike — see [09 · CI/CD & Environments](./docs/09-environments-cicd-repo.md) and [Open Questions](./docs/10-boundaries-scope-sequence-risks.md).

## Deliverable 29 · Integration list (at a glance)
Identity/Auth · Payments(Stripe) · Notifications(Resend/Twilio/WhatsApp) · Files/Storage · AI gateway/LangGraph · Audit · Analytics(PostHog) · Localization · Feature flags · Observability(Sentry/OTel) · Automation(event bus, workflow engine, approvals, task queues, rules) · external Carriers/Customs/KYC `⚠️ VERIFY`.

## Deliverable 30 · Third-party services list
Vercel · Cloudflare · Neon · Supabase (Auth/Storage) · Stripe · Resend · Twilio/WhatsApp Business · LLM provider(s) · Inngest/Trigger.dev · Upstash · PostHog · Sentry · GitHub · (future) carrier/customs/KYC providers. Full detail + data-shared + criticality in [09](./docs/09-environments-cicd-repo.md).

---

## Document map (covers all 37 required deliverables)

| Doc | Deliverables covered |
|-----|----------------------|
| **README** (this) | 1 Exec summary · 3 Final stack · 29 Integration list · 30 Third-party list |
| [01 · System & Application Architecture](./docs/01-system-and-app-architecture.md) | 2 System overview · 4 Application arch · 5 Frontend arch · 8 Customer mobile-web arch |
| [02 · Backend, API & Admin](./docs/02-backend-api-and-admin.md) | 6 Backend/API arch · 7 Admin dashboard arch · (API surface design) |
| [03 · Automation, Workflow & Events](./docs/03-automation-workflow-and-events.md) | 10 Automation integration · 17 Workflow orchestration · 18 Event-driven arch |
| [04 · Platform Integration (Pay/Notify/Files/Audit/Analytics)](./docs/04-platform-integration.md) | 9 Platform integration · 14 File/storage · 15 Payments · 16 Notifications · 19 Audit · 20 Analytics |
| [05 · AI / LangGraph Integration](./docs/05-ai-langgraph.md) | 11 AI/LangGraph model |
| [06 · Auth, RBAC, Security & Privacy](./docs/06-auth-rbac-security-privacy.md) | 12 Auth arch · 13 RBAC · 21 Security arch · 22 Data privacy & retention |
| [07 · Data Architecture](./docs/07-data-architecture.md) | Data model (entities/relationships/RLS/retention — design, no SQL) |
| [08 · Observability, Reliability & Scale](./docs/08-observability-reliability-scale.md) | 25 Observability · 26 Error/retry · 27 Backup/recovery · 28 Scalability |
| [09 · Environments, CI/CD & Repo](./docs/09-environments-cicd-repo.md) | 23 Environments · 24 CI/CD · 31 Monorepo/repo |
| [10 · Boundaries, Scope, Sequence & Risks](./docs/10-boundaries-scope-sequence-risks.md) | 32 Service boundaries · 33 MVP scope · 34 V1 scope · 35 Risks · 36 Open questions · 37 Implementation sequence |

## Conventions
- Mermaid diagrams (C4-ish: context → container → component) + ASCII flows where requested.
- **`⚠️ VERIFY`** = third-party/limit/compliance assumption to confirm. **`HUMAN-APPROVAL`** = human-gated step.
- Tenancy: `org_id` = tenant; `app_id = "borderpass"`.

## Changelog
| Version | Date | Author | Change |
|---------|------|--------|--------|
| v0.1 | 2026-06-29 | Engineering | Initial TAD covering all 37 deliverables (architecture only, no code) |
