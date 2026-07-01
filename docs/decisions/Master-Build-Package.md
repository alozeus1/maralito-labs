# BorderPass — Master Build Package (Phase 0 Ready)

> **Status:** Final consolidated build brief v1.0 · **Owner:** Lead Full-Stack Engineer / Principal Platform Engineer / DevSecOps Lead / Technical Architect / AI Workflow Engineer / Build Readiness Owner (Web Forx Technology Ltd.) · **Date:** 2026-06-29
> **Mode:** CONSOLIDATION ONLY — **no code, no repo scaffolding, no implementation.** This package guides Phase 0 and all later phases. Execution begins only on **`START BORDERPASS PHASE 0`**.
> **Readiness decision (carried from Build Readiness Review):** ✅ Ready to proceed into Phase 0 (8.5/10).

## What this document is
The single consolidated, build-ready master brief that supersedes scattered planning notes by **locking** every decision an engineering agent needs for Phase 0 onward. It absorbs the role of the "Build Agent Master Prompt" (source #9, previously distributed) into one place. It invents nothing beyond the approved MVP.

## Source-of-truth inputs (all reconciled)
Maralito Platform Architecture · Maralito Automation Platform · BorderPass PRD · Technical Architecture · Data/API/Event Contracts · AI Agent + LangGraph Architecture · Design-to-Frontend Handoff · Implementation Backlog + Sprint Plan · Build Readiness Review · Approved Stitch board. (The "Build Agent Master Prompt" is consolidated here.)

## Non-negotiable rules (apply to every phase)
1. App name is **BorderPass**; parent is **Maralito Labs**. "Powered by Maralito Labs" appears **only** in welcome footer / About / Settings.
2. **Maralito Platform + Automation Platform are shared foundations**; **BorderPass is the first consuming app** — it consumes platform services via `@maralito/sdk`, never re-implements them.
3. **AI is human-in-the-loop** for every risky/compliance/payment/refund-sensitive action — agents recommend; humans decide.
4. **No features outside the approved MVP.** Don't pull V1 into MVP.
5. **Real cross-border orders stay disabled until customs/compliance legal sign-off** — build + internal testing run on synthetic data until then.

---

# 1 — Final Consolidated Project Summary

BorderPass is a **premium cross-border shopping concierge** for customers in Ciudad Juárez who want to buy from U.S. stores without crossing. Customers request a purchase or ship a package to the **BorderPass El Paso Hub**, upload receipts, submit border/import info, receive a **human-approved itemized quote** (incl. estimated duties), pay via Stripe, then track the package on the signature **Border Journey** (El Paso → bridge → Juárez), view inspection photos (serial/seal), chat with a concierge, and receive delivery with proof.

The MVP proves **one trustworthy order end-to-end** over a **polished, automated customer experience atop mostly-manual operations**, with **humans approving every risky/financial/compliance decision** and **every sensitive action audited**. Built on the Maralito Platform (Identity, Payments, Notifications, Files, Audit, AI gateway) and Automation Platform (durable workflows, events, approvals, tasks), BorderPass is a **thin app on a fat platform**: one TypeScript/Next.js codebase (customer + admin) behind a BFF, durable order workflow on Inngest, recommend-only AI agents via the gateway. Readiness is **8.5/10 — ready for Phase 0**; the only hard external gate (legal sign-off) blocks real orders, not the build.

---

# 2 — Locked MVP Scope

> Frozen. Changes require explicit re-approval. (Matches `docs/07`, Backlog D2, Readiness D4.)

**Customer (22 screens):** Welcome · Language · Login/Signup · Phone/Email OTP · Home · New Request · Buy-for-Me · Receive-My-Package · Product details · Receipt/document upload · Border/compliance info · Request review · Quote review · Stripe payment (+success) · Orders list · Order detail · Border Journey · Inspection details · Concierge contact · Notifications · Profile/Settings · About.

**Admin (14 surfaces):** Admin login · Dashboard · Orders list · Order detail · Risk review · Quote creation · Package-received action · Inspection checklist · Inspection photo upload · Status update controls · Customer profile view · Payment/refund visibility · Audit log visibility · Basic concierge workspace.

**Backend:** 18 BorderPass entities; order/quote/payment/document/inspection/notification/audit/agent-run/workflow-run/event APIs; W1–W15 (+W5 schedule) workflows.

**AI (assist-only, `suggest`):** product extraction · missing-info detection · risk band recommendation · quote draft · support/notification/admin-note drafts · order summary · inspection checklist assistance.

**Excluded from MVP (→ V1+):** reorder · saved cards · loyalty · Local Pickup/Business self-serve · auto RFC invoices · support ticketing · analytics dashboards · push · voice concierge · full AI autonomy · Shopping auto-resolution · automated duty calc at scale · marketplace/subscriptions/returns · B2B multi-user.

**Human-approval gates (MVP):** order accept/reject (compliance) · quote send (finance, all) · purchase spend (ops/finance) · border docs (compliance) · inspection-fail resolution (compliance/ops) · refund (finance).

---

# 3 — Locked Technical Stack

| Layer | Locked choice |
|-------|---------------|
| Frontend | **Next.js App Router + TypeScript + Tailwind**, RSC; Stitch tokens over `@maralito/ui` |
| Backend | **Next.js BFF** (server actions = mutations, route handlers = reads/webhooks) |
| Database | **Supabase Postgres** + **Drizzle ORM** (native RLS) |
| Auth | **Supabase Auth** (phone OTP) behind platform Identity SDK |
| Storage | **Supabase Storage** (signed URLs, object ACL; store `file_id` only) |
| Payments | **Stripe** (payment intents + webhooks; no raw card data) |
| Notifications | **Resend** (email) + **Twilio/WhatsApp** (SMS/WA); in-app center |
| Automation | **Inngest** (durable workflows, sleep, fan-out) |
| AI / LangGraph | **LangGraph via the AI gateway** (recommend-only; HITL nodes); LangSmith optional for eval/trace |
| Analytics | **PostHog** (basic event capture in MVP) |
| Observability | **Sentry + OpenTelemetry** (workflow→agent→tool→model traces; AI cost) |
| Hosting | **Vercel** (preview per PR; progressive prod) |
| CI/CD | **GitHub Actions** (security-gated; OIDC) |
| Testing | **Vitest + Playwright + axe + pseudo-loc** |
| Security | SAST + SCA + secret + IaC scan + **KMS** field encryption + WAF/rate limit |
| Validation | **Zod** (shared client+server from contracts) |

**Resolved forks:** engine = **Inngest** (not Trigger.dev); data = **All-Supabase + Drizzle** (not Neon/Prisma/R2).

---

# 4 — Locked Architecture Assumptions

- **Thin app, fat platform:** BorderPass consumes Identity/Payments/Notifications/Files/Audit/AI/Automation via `@maralito/sdk`; never calls providers directly or re-implements platform services.
- **BFF is the only seam:** tenant context (`org_id`) set **only** here from the validated session token; AuthN + AuthZ (`can()`) + Zod + idempotency + audit applied centrally; client never writes DB directly.
- **Durable order engine:** the 25-status order machine **is** the durable workflow (Inngest); `Order.status` mutates **only** via workflow transitions; long waits = durable sleep; human gates = approval nodes; money/irreversible steps idempotent + saga-compensable.
- **Authorization enforced twice:** RBAC at BFF + **RLS** at Postgres (`org_id` + owner); out-of-tenant → `not_found`.
- **Events are the spine:** at-least-once, idempotent by `event.id`, outbox pattern, DLQ; `correlation_id = order_id`; projections (Border Journey, analytics) rebuildable from events.
- **AI is governed + recommend-only:** all model calls via the gateway (no provider keys in app); agents = distinct principal ≤ the human they assist; structured outputs + confidence; approval auto-inserted for risky actions; org-scoped RLS-isolated memory.
- **Bilingual + mobile-first by default:** EN/ES parity (no hardcoded strings); Stitch design system; WCAG AA.

---

# 5 — Locked Repo / Monorepo Strategy

**BorderPass lives inside the Maralito monorepo** (pnpm + Turborepo) as `apps/borderpass` — **single app** with `(customer)` and `(admin)` route groups (not a separate admin app).

```
maralito/
├─ apps/borderpass/
│  ├─ app/  (public)/ (auth)/ (customer)/ (admin)/ api/ actions/
│  ├─ src/  domain/ workflows/ agents/ db/ sdk/ events/ ui/
│  ├─ messages/   # EN/ES ICU catalogs
│  └─ tests/      # unit, integration(RLS), e2e, workflow, a11y, i18n
├─ packages/  sdk/ ui/ schemas/ automation/ config/
├─ infra/         # Terraform
└─ .github/workflows/
```
**Boundary rules (lint-enforced):** app depends on `packages/*` only (contract-only, never platform internals); tenant context only in BFF; `Order.status` only via workflows; no provider SDKs in app code.

---

# 6 — Locked Environment Strategy

| Env | Purpose | Data | Trigger |
|-----|---------|------|---------|
| **Local** | dev | seeded synthetic | `pnpm dev` (Inngest dev server, Supabase local/branch, providers in sandbox) |
| **Preview** | per-PR review + e2e | synthetic (Supabase branch **or** ephemeral schema — `⚠️` confirm) | on PR (Vercel preview) |
| **Staging** | pre-prod integration/UAT | prod-like synthetic, **no prod PII** | merge to main |
| **Production** | real customers | real | gated + progressive (canary→%→full), instant rollback via flags |

**Principles:** hard isolation (separate DBs/secrets/**provider accounts per env**); config-as-variables; flags decouple deploy from release; OIDC short-lived CI creds. **Pilot is flag-gated behind readiness + legal sign-off.**

---

# 7 — Locked CI/CD Strategy

GitHub Actions, **security-gated, blocking**:
`install → lint + typecheck → unit (Vitest) → SAST → SCA/license → secret scan → IaC scan → build → migration check (Supabase branch) → integration + tenant-isolation (blocking) → e2e (Playwright on preview) → AI eval/regression (if agents changed) → deploy preview/staging → gated promote → production (progressive)`.

**Gates that block merge:** SAST, SCA, secret, IaC, **tenant-isolation**, container scan (if images), AI eval regression (incl. **prohibited false-clear = 0**). Migrations forward-only (expand→migrate→contract), validated on a branch. OIDC creds; pinned actions; protected main; SBOM on release `⚠️ VERIFY`.

---

# 8 — Locked Security Baseline (MVP minimum)

RBAC on every op (9 roles + agent principal) · **RLS** `org_id`+owner on every table, set only in BFF, cross-tenant → `not_found`, isolation tests blocking · protected routes + MFA for admin/finance/compliance · signed-URL file access with object ACL (inspection photos owner-only) · **no raw card data**; Stripe webhook signature verify + dedupe; payment idempotent + webhook-only confirm · immutable hash-chained **audit** on all sensitive ops (incl. PII reads + 403s) · **KMS field encryption** for Restricted 🔒 fields, permission-gated decrypt · admin **PII masked-by-default**, reveal audited · **recommend-only AI**, untrusted=data, egress allowlist, tool scoping, low-confidence→escalate · rate limits (tighter on auth/payments/AI) · safe file upload (type/size/scan) · secrets in manager, none committed, no `NEXT_PUBLIC_` secrets · per-env isolation · errors without internal leakage. **V1:** pen-test cadence, advanced fraud/abuse, DR drills, richer KYC.

---

# 9 — Locked Database Approach

**Drizzle** schema + queries + migrations on **Supabase Postgres**; **RLS policy ships with every table** in the same migration. 18 BorderPass entities (CustomerProfile, StaffProfile, Address, Order, OrderItem, Package, Quote, QuoteLineItem, Document, Receipt, Inspection, InspectionPhoto, RiskReview, Delivery, Driver, ConciergeAssignment, SupportTicket, SupportMessage). Platform entities (User, Org, Payment, Refund, Notification, AuditLog, AgentRun, WorkflowRun, EventLog, WebhookEvent) referenced **by id via SDK** — not built here. Migration order M0–M12 (extensions/RLS → identity → order → quote → files → hub/inspection → risk → delivery → support → indexes → KMS → seed). Money = integer minor units; enums exactly per `contracts/04`; status only via workflows; history via events/audit (status projection rebuildable). Retention durations `⚠️ VERIFY` (financial/customs/audit) with counsel.

---

# 10 — Locked API Approach

BFF = **Server Actions (mutations) + Route Handlers (reads/webhooks)** via a shared `withAction({permission, schema, audit})` wrapper. Per call: session → AuthN → AuthZ (`can()`) → tenant context (RLS) → Zod validate → idempotency key → domain/SDK/start-workflow → audit emit → typed result. Canonical error shape + code→HTTP map (incl. `approval_required` 423, `not_found` for out-of-tenant, `conflict_state` for illegal transitions); no internal leakage. State transitions re-validated against `contracts/04`. Build order: foundation wrapper → auth/profile → orders(draft→submit) → files → admin review → quote → payment(+webhook) → journey/inspection reads → hub/inspection/crossing/delivery → concierge/notifications → refund/cancel → finance/audit/config → automation/webhooks. **No new APIs invented**; GAP reads (KB search) = V1, seed static FAQ.

---

# 11 — Locked Automation Approach

Durable workflows on **Inngest**; 25-status order machine = the workflow; events idempotent by `event.id`; outbox + DLQ. Step types: `function | agent | approval | task | wait | signal | effect | subworkflow`; Postgres checkpointer (spike in Phase 0); unique active run per `(definition, order)`. MVP workflows: **W1 intake, W2 missing-info, W3 risk, W4 quote, W6 payment, W8 received, W9 inspection, W10 crossing, W11 delay, W12 delivery, W13 failed-delivery, W14 refund, W15 support, W5 quote-expiry schedule** (W7 purchase = ops-assisted buy-for-me). Human gates at W3/W4/W7/W9-fail/W10/W14; saga compensation on money/irreversible steps (failed compensation → P0 task); every step emits event + audit; every customer-relevant transition fires a notification. Deferred (V1): agent-depth workflows + auto-approve low-risk reversible.

---

# 12 — Locked AI / LangGraph Approach

**Recommend-only, autonomy = `suggest`.** LangGraph **Manager** (route → validate → enforce approval → escalate → audit) supervises worker agents run as workflow `agent` steps; **all model calls via the AI gateway** (authz, guardrails, cost ledger, tracing) — **no provider keys in the app**. MVP agents: **Intake** (validate + missing-info), **Risk** (band + rationale + matched rules + confidence — never clears), **Quote** (itemized draft + duty **estimate** labeled), plus **draft helpers** (support reply, notification, admin-note, order summary, product extraction, inspection checklist assist). Tool registry = scoped MVP subset, schema-validated. **Structural guarantees (not prompt-only):** AI never final-approves orders, rejects customers, executes refunds, makes customs declarations, edits payments, or marks delivered — each is a missing tool + an approval node. Low-confidence on risky → escalate. RAG seed (policies/FAQ/templates, ACL-tagged); guardrails (injection/PII/schema); evals + red-team gate changes (**prohibited false-clear = 0**); AgentRun/Step = the action log; cost metered + budgeted.

---

# 13 — Locked Frontend / Design Approach

Mobile-first, **Stitch-faithful**, EN/ES, on `@maralito/ui` + BorderPass tokens (DESIGN.md authoritative). Sunset Orange `#a33e06` primary · Deep Navy secondary · Emerald success · Warm White/Soft Sand surfaces; **Literata** (serif headers) + **DM Sans** (body) + Material Symbols; 24px radius language; ambient shadows; signature **bridge header**, **vertical Border Journey timeline**, **bridge progress bar**, **concierge card**. 36 components + 47 screens with empty/error/loading states; WCAG AA (keyboard, SR, focus, reduced-motion, accessible timeline/modals); no hardcoded strings (ICU EN/ES, ~+25% ES). Build order: tokens → shell+nav+i18n → onboarding → Home → New Request → Quote/Payment → Orders/detail → Border Journey → Inspection → Concierge → Notifications/Profile/About → admin shell+tables → admin review/quote/inspection/status/audit. Stitch HTML/fonts via CDN are **reference only** → re-implement as theme + self-hosted fonts. "Powered by Maralito Labs" footer/about/settings only.

---

# 14 — Locked Admin / Operations Approach

Single app `(admin)` route group, RBAC layout-guarded, desktop-first with mobile field views (inspector/driver). Surfaces: dashboard, orders list/detail, risk review (AI band + rationale + confidence + **HumanApprovalModal** with justification + SoD), quote creation/approval, package receiving, inspection center (checklist/photos/serial/seal), status controls, customer profile (PII masked + audited reveal), payment/refund visibility, audit views, basic concierge workspace (AI-draft, **human-sent**). Ops runs the **full order lifecycle from the dashboard**; MVP keeps purchasing, duty confirmation, border docs, crossing/customs updates, dispatch, and refunds **manual** (human judgment) behind the automated customer experience. Every admin action audited; elevated actions (override/replay/role changes) require fresh MFA + justification.

---

# 15 — Required Third-Party Accounts & Credentials

| Account | MVP? | Mockable? | Setup notes | Security notes |
|---------|:----:|:---------:|-------------|----------------|
| **Supabase** (Postgres + Auth + Storage) | Yes | No | one project per env; enable RLS; storage buckets w/ ACL | service-role key server-only; per-env isolation |
| **Vercel** | Yes | No | single app; preview per PR; progressive prod | protected prod; env scoping |
| **Inngest** | Yes | Dev server local | event + signing keys | signing-key verification on endpoints |
| **Stripe** | Yes | Test mode | products/prices; webhook + signing secret; Radar | live vs test separated; verify signatures |
| **Resend** | Yes | Partial | verify sender domain (SPF/DKIM/DMARC) | API key server-only |
| **Twilio / WhatsApp** | SMS yes; WA optional MVP | WA yes | SMS live; WA templates pre-approval (lead time) | verify inbound webhook signature |
| **LLM provider** | Yes | Fixtures in test | **held by AI gateway, not the app** | no provider keys in app code |
| **LangSmith** (optional) | Optional | Yes | eval/trace if used | PII handling in traces |
| **PostHog** | Yes (basic) | Yes | funnel events; dashboards V1 | minimize PII; stable ids |
| **Sentry** | Yes | Yes | errors + OTel traces; AI cost spans | scrub PII |
| **GitHub** | Yes | No | monorepo; protected main; pinned actions | OIDC creds; secret scanning |
| **KMS** | Yes | Local dev key | field encryption for Restricted 🔒 | permission-gated decrypt; audited |
| **Domain / DNS** | Yes (pilot) | vercel.app | custom domain + staging subdomain | HTTPS/HSTS; email DNS |
| **Email sender domain** | Yes | Partial | SPF/DKIM/DMARC for Resend | anti-spoofing; deliverability |

No credential is a hard blocker; **WhatsApp is the only long-lead item** (SMS+email+in-app fallback).

---

# 16 — Required Environment Variables

Names only — values in the secret manager; per-env; **no secrets client-side**; confirm exact names vs `@maralito/sdk` (Clarification #1).

```
# Core
NODE_ENV  APP_ENV  NEXT_PUBLIC_APP_URL  NEXT_PUBLIC_DEFAULT_LOCALE  NEXT_PUBLIC_FLAGS_*
# Supabase (DB + Auth + Storage)
DATABASE_URL  DATABASE_DIRECT_URL  SUPABASE_URL  SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY  SUPABASE_JWT_SECRET  SUPABASE_STORAGE_BUCKET
# Cache / idempotency
UPSTASH_REDIS_REST_URL  UPSTASH_REDIS_REST_TOKEN
# Maralito SDK (confirm names — Clarification #1)
MARALITO_SDK_BASE_URL  MARALITO_SERVICE_TOKEN  MARALITO_APP_ID=borderpass  (+ per-service keys)
# Payments
STRIPE_SECRET_KEY  STRIPE_WEBHOOK_SECRET  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
# Notifications
RESEND_API_KEY  RESEND_FROM_EMAIL  TWILIO_ACCOUNT_SID  TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER  TWILIO_WHATSAPP_FROM  TWILIO_WEBHOOK_SECRET
# Automation
INNGEST_EVENT_KEY  INNGEST_SIGNING_KEY
# AI (gateway only — no provider keys in app)
AI_GATEWAY_URL  AI_GATEWAY_KEY  (LANGSMITH_API_KEY optional)
# Observability
SENTRY_DSN  SENTRY_AUTH_TOKEN  OTEL_EXPORTER_OTLP_ENDPOINT
NEXT_PUBLIC_POSTHOG_KEY  NEXT_PUBLIC_POSTHOG_HOST
# Security
KMS_KEY_ID  KMS_PROVIDER  RATE_LIMIT_*  CRON_SECRET
```

---

# 17 — Required Phase 0 Outputs

1. **Monorepo app scaffold** — `apps/borderpass` with route-group skeleton + `packages/*` wiring (no feature code).
2. **Security-gated CI/CD pipeline** — all blocking gates active; green on the empty app.
3. **Environment wiring** — dev/preview/staging config; `.env.example` (names, empty values); secret-manager entries; **separate provider keys per env**.
4. **Locked-stack integration smoke** — Supabase (DB+Auth+Storage) reachable; Inngest dev server runs; Vercel preview deploys; `@maralito/sdk` health call.
5. **LangGraph Postgres checkpointer × Inngest spike** — proof that a durable agent step can pause at an approval node and resume across a restart.
6. **Consolidated Build Agent Master Prompt** — this package finalized as the single agent-runnable brief.
7. **Preview-DB branching decision** — Supabase branching vs ephemeral per-PR schema, wired into CI.
8. **Baseline observability** — Sentry + OTel + PostHog initialized (no business events yet).
9. **Decision log updated** — clarifications #1–#5 status tracked.

---

# 18 — Phase 0 Acceptance Criteria

- ✅ App **boots** in local + preview; Vercel preview deploys on PR.
- ✅ CI pipeline **green** with **all security gates blocking** (SAST/SCA/secret/IaC) + tenant-isolation harness present.
- ✅ Supabase reachable (DB migration harness runs on a branch; Auth + Storage smoke); **RLS default-deny** scaffold in place.
- ✅ Inngest dev server runs a trivial durable function; **checkpointer spike proves pause/resume across restart**.
- ✅ `@maralito/sdk` health call succeeds; **no provider keys in app code** (lint/arch check).
- ✅ `.env.example` complete; secrets only in manager; secret-scan clean; **per-env isolation** verified.
- ✅ Observability initialized (Sentry/OTel/PostHog).
- ✅ This master package finalized; preview-branching decision recorded.
- ✅ **No feature code, no business logic** — foundation only.

---

# 19 — Items Deferred to Phase 1

(Need answers before Phase 1 starts, per Clarifications.) Confirm **`@maralito/sdk` surface + exact env-var names** (#1); choose **Supabase preview-branching vs ephemeral schemas** + **KMS provider** (#3). Phase 1 builds: Drizzle schema + RLS policies (M0–M11), Supabase Auth phone-OTP, RBAC `can()`, MFA for admin/finance/compliance, tenant-context setter, audit scaffold. **Gate:** cross-tenant isolation test fails closed; OTP onboarding e2e green.

---

# 20 — Items Deferred to Phase 5

Confirm **initial rules-engine values** before Phase 5 (Clarification #2): high-value threshold, commercial/RFC threshold, quote/refund approval limits + refund compliance-co-sign threshold, agent confidence thresholds, **service fee**, **duty-estimate basis**, **quote-expiry window**, SLA tiers (T1/T2). These live in the **versioned rules engine, not code**. Phase 5 builds admin order review + risk gate + quote draft + finance approval; it cannot finalize quotes without these values. **Gate:** every order human-reviewed; finance approves all quotes; never auto-clear.

---

# 21 — Parallel Non-Code Workstreams (start now, run alongside the build)

| Workstream | Owner | Goal | Gate it unblocks |
|------------|-------|------|------------------|
| **Customs / legal review** | Compliance/Legal + CPO | Accepted/prohibited categories, duty handling, RFC/invoicing, broker partner; seed conservative prohibited list | **Real orders** (Phase 13) — hard gate |
| **WhatsApp templates** | Ops | Pre-approve EN/ES templates + opt-in (long lead) | WhatsApp channel (Phase 9); launch SMS+email+in-app meanwhile |
| **Stripe setup** | Finance/DevSecOps | Products/prices, webhook + signing secret, Radar, test→live keys | Phase 6 payment |
| **Domain / email setup** | DevSecOps | Custom domain + staging subdomain; Resend SPF/DKIM/DMARC | Phase 9 notifications; pilot |
| **Operations SOP drafting** | Ops Manager | Hub receiving/inspection, dispatch/delivery, approval-queue handling, edge-case runbooks (15 cases), on-call | Phase 13 pilot — staffing + training |

None of these block Phase 0; the first two have the longest lead times — start day one.

---

# 22 — Build Risks

| Risk | Sev | Mitigation |
|------|:---:|------------|
| Customs/legal unresolved | 🔴 Critical (orders) | Start counsel now; gate real orders only; build + internal test proceed |
| Prohibited-item false-clear | 🔴 Critical (controlled) | Recommend-only + compliance gate; 0-tolerance eval; never auto-clear |
| RLS/RBAC isolation gap | 🔴 Critical (controlled) | Double enforcement; blocking isolation tests; pen-test pre-pilot |
| Payment/refund correctness | 🟠 High (controlled) | Idempotency keys; saga; webhook-only confirm; never optimistic |
| `@maralito/sdk` surface unconfirmed | 🟠 High | Confirm before Phase 1 (Clarification #1) |
| LangGraph checkpointer × Inngest unproven | 🟠 High | Phase 0 spike before depending on durable agent resume |
| Platform MVP services parallel readiness | 🟠 High | Track milestones; stub where safe; align roadmaps |
| Rules-engine values undefined | 🟡 Med | Provide before Phase 5; finance approves all quotes meanwhile |
| Supabase preview-branching maturity | 🟡 Med | Confirm vs ephemeral schemas before Phase 1 CI |
| WhatsApp template lead time | 🟡 Med | Start now; SMS+email+in-app fallback |
| Hub/ops maturity + SOPs | 🟡 Med | Draft + train in parallel; dry-run pre-pilot |
| Scope creep (V1 into MVP) | 🟡 Med | Assist-only discipline; phase gates; frozen scope (§2) |
| Brand assets / copy gaps | 🟢 Low | Placeholders; swap on delivery |

---

# 23 — Open Questions

| # | Question | Recommended default | Blocks |
|---|----------|---------------------|--------|
| 1 | `@maralito/sdk` method surface + env names? | Confirm with platform team | Phase 1 |
| 2 | Rules-engine values (thresholds/fee/duty/expiry)? | From rules engine; finance approves all | Phase 5 |
| 3 | Supabase preview-branching vs ephemeral schemas? | Supabase branching; fallback ephemeral | Phase 1 CI |
| 4 | KMS provider for field encryption? | Supabase/cloud KMS | Phase 1 |
| 5 | LangGraph Postgres checkpointer × Inngest proven? | Phase 0 spike | Phase 2 (AI) |
| 6 | Messages vs Support nav split? | Messages = concierge thread; Support = help hub | No |
| 7 | Warning/Info/Gold token hex + modal/sheet shadows? | Propose amber/navy/gold; confirm AA | Phase 2 |
| 8 | Customs categories/duty/RFC/broker sign-off? | Counsel; conservative seed | Real orders |
| 9 | WhatsApp templates approved per language? | Launch SMS+email+in-app; add WA later | No |
| 10 | File scanner vendor + pen-test timing? | Select scanner; pen-test Phase 12 | Pre-pilot |

**None block Phase 0.** Items 1, 3, 4 → before Phase 1; item 5 → in Phase 0; item 2 → before Phase 5; item 8 → before real orders.

---

# 24 — Final Instruction for When Phase 0 Can Begin

**Phase 0 has no upstream blocker and is cleared to start.** Before issuing the command, ideally line up (not required to begin): confirm the locked stack, kick off the customs/legal review and WhatsApp template prep in parallel, and have the platform team ready to confirm the SDK surface for Phase 1.

On the start command I will execute **Phase 0** in small, reviewable increments — **goal → files to create → implement → explain changes → test steps → remaining issues → await approval before the next major phase** — beginning with: scaffold the monorepo app, stand up the security-gated CI, wire the locked stack (Supabase + Inngest + Vercel), and run the LangGraph Postgres checkpointer × Inngest spike. **No real cross-border orders until customs/compliance legal sign-off; all Phase 0 work is foundation on synthetic data.**

Until then I remain in planning mode and will write no code.

**Ready for Phase 0 execution when the user gives the command: START BORDERPASS PHASE 0**

---

*Owner: Lead Full-Stack Engineer / Build Readiness Owner — Web Forx Technology Ltd. · Master Build Package v1.0 · 2026-06-29 · CONSOLIDATION ONLY — no code written.*
