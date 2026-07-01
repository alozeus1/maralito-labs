# BorderPass — Pre-Build Review & Readiness Assessment

> **Status:** Draft v0.1 · **Owner:** Lead Full-Stack Engineer / Technical Delivery Agent (Web Forx Technology Ltd.) · **Last updated:** 2026-06-29
> **Mode:** PLANNING / REVIEW ONLY — **no code written.** Implementation begins only on the explicit command **`START BORDERPASS BUILD`**.
> **Purpose:** Confirm readiness, surface gaps, and lock the build sequence before any file is created.

## Source-of-truth documents reviewed

| # | Document | Key items extracted |
|---|----------|---------------------|
| 1 | Maralito Platform Architecture | thin-app/fat-platform; S1–S14 services; SDK boundary |
| 2 | Maralito Automation Platform | durable engine (Inngest/Trigger.dev `⚠️`), events, agents, approvals, tasks, saga |
| 3 | BorderPass PRD (`docs/01–20`) | MVP scope (`07`), edge cases (`18`), roadmap (`19`), IA (`05`), notifications (`14`) |
| 4 | Technical Architecture (`tech-arch/01–10`) | BFF shape, env strategy (`09`), CI/CD, monorepo, AI-LangGraph (`05`) |
| 5 | Data/API/Event/Access contracts (`contracts/01–05`) | 18 domain entities, server-action+route-handler catalog, 25-status machine, RBAC/RLS, audit |
| 6 | AI Agent + LangGraph Architecture | Manager + 14 agents, tool registry, HITL, guardrails, MVP assist-only set |
| 7 | Design-to-Frontend Handoff | tokens, 36 components, 30+17 screens, routing, a11y/i18n |
| 8 | Implementation Backlog + Sprint Plan | 25 epics, stories, 5-sprint plan, risk register |
| 9 | Approved Stitch design board | screens + HTML + `DESIGN.md` token file (canonical visual SoT) |

**Verdict up front:** the documentation set is **complete, internally consistent, and build-ready at the foundation layer.** Feature implementation is gated only on a short list of clarifications (Part 2) and the **customs/compliance legal sign-off** that gates *real* cross-border orders (not the build itself). Recommendation in [Part 15](#part-15--final-build-sequence).

---

# PART 1 — Build Readiness Assessment

| Domain | Ready? | Evidence / notes |
|--------|:------:|------------------|
| **Product scope** | ✅ Ready | MVP scope authoritatively defined (`docs/07`); MVP/V1/Future boundaries clear; edge cases enumerated (`docs/18`). |
| **Design** | ✅ Ready | Stitch tokens (`DESIGN.md`) + screens + HTML; Frontend Handoff systematizes into components/screens/states. Minor `GAP`: warning/info/gold token hexes, production assets. |
| **Data model** | ✅ Ready | 18 domain entities fully specified (fields, req/opt, sensitivity, retention, indexing, RLS) in `contracts/01`. Enums authoritative in `04`. |
| **API contracts** | ✅ Ready | Full server-action + route-handler catalog with validation, errors, events, audit (`contracts/02`). A few read endpoints flagged `GAP` (journey projection shape, KB search) — confirm vs platform. |
| **Event contracts** | ✅ Ready | Envelope + catalog + idempotency + DLQ (`contracts/03`); workflow/agent run contracts defined. |
| **Auth / RBAC / RLS** | ✅ Ready | 9 roles + agent principal; permission matrix; double enforcement (RBAC+RLS); elevation rules (`contracts/05`). |
| **Automation** | 🟡 Mostly | Workflows W1–W15 + trigger map defined; **engine choice (Inngest vs Trigger.dev) + LangGraph Postgres checkpointer not finalized** `⚠️ VERIFY`. |
| **AI** | ✅ Ready (assist) | Manager + Intake/Risk/Quote (MVP assist-only); gateway, tools, guardrails, output schemas specified; autonomy = `suggest`. |
| **Infra / env / CI** | ✅ Ready | Env strategy (Local/Preview/Staging/Prod), Neon branching, GitHub Actions security-gated pipeline, monorepo structure (`tech-arch/09`). |
| **Platform dependency** | 🟡 Parallel | BorderPass consumes Identity/Payments/Notifications/Files/Audit/AI/Automation via `@maralito/sdk`; **assumes platform MVP services usable/progressing** — track as external dependency. |
| **Legal / compliance** | 🔴 Gating (orders) | **Customs/import legal sign-off** on accepted/prohibited categories, duty handling, RFC/invoicing, broker partner is a **hard gate for real orders** (not for build/internal testing). |
| **Operations** | 🟡 Parallel | Hub receiving/inspection SOPs + ≥1 inspector + ≥1 driver + staffed approval queues needed before pilot; can mature alongside build. |

**Overall:** 🟢 **Cleared to begin foundation build** (repo/env/CI, schema, design system, SDK wiring). 🟡 **Feature build** starts after Part 2 clarifications. 🔴 **Real orders** wait on legal sign-off.

---

# PART 2 — Missing Information List (must clarify before/at the relevant gate)

> Per instruction: I do **not** guess these. Each has an owner and the gate it blocks.

| # | Gap / question | Blocks | Owner | Proposed default (pending confirmation) |
|---|----------------|--------|-------|------------------------------------------|
| G1 | **Customs/import legal sign-off**: accepted/prohibited categories, duty-rate source, RFC/invoicing rules, broker/partner | **Real orders** (P0 gate) | Compliance/Legal + CPO | internal testing only until cleared; seed conservative prohibited list |
| G2 | **Durable engine: Inngest vs Trigger.dev** + LangGraph **Postgres checkpointer** integration | Automation + AI build (Sprint 0–2) | Backend Architect | recommend **Inngest** (step durability + sleep + fan-out); confirm via spike |
| G3 | **DB: Supabase Postgres vs Neon** (stack lists both) | Schema + migrations (Sprint 0) | Backend Architect | recommend **Neon** (matches `tech-arch/09` branching + CI); Supabase for Auth+Storage |
| G4 | **Storage: Supabase Storage vs R2** (`contracts/01` says R2 or Supabase `⚠️`) | File upload (Sprint 1) | DevSecOps | recommend **Supabase Storage** (pairs with Supabase Auth) OR R2 — confirm |
| G5 | **ORM: Drizzle vs Prisma** | Schema (Sprint 0) | Backend Architect | recommend **Drizzle** (matches `tech-arch` references; lighter, SQL-first, RLS-friendly) |
| G6 | **Thresholds**: high-value, commercial (RFC), quote/refund approval, agent confidence, SLA T1/T2, quote expiry window | Risk/Quote/Refund logic (Sprint 2–3) | Finance + Compliance | from versioned **rules engine**, not code; need initial values |
| G7 | **Service fee + duty-estimate basis** (`Quote.service_fee` ~$15 `⚠️`, duty basis) | Quote (Sprint 2) | Finance + Compliance | placeholder in rules engine; finance approves all quotes anyway |
| G8 | **WhatsApp Business templates** pre-approval per language | Notifications (Sprint 3) | Ops | launch with **Resend email + Twilio SMS + in-app**; add WhatsApp when approved |
| G9 | **Realtime transport** for journey/admin (poll vs subscribe) + journey projection read shape | Journey UI (Sprint 3) | Frontend + Backend | recommend **polling + last-known fallback** for MVP; subscribe later |
| G10 | **`GAP` API endpoints**: KB/FAQ search, notifications list/mark-read, threads/messages, reorder | confirm vs `contracts/02` (mostly present) | Backend | use `contracts/02` shapes; KB search = V1 (seed static FAQ in MVP) |
| G11 | **Maralito SDK surface + env var names** (exact method names, auth) | BFF wiring (Sprint 0–1) | Platform team | confirm `@maralito/sdk` API + env keys before wiring |
| G12 | **App deployment shape**: single app (route groups) vs separate admin app | Repo/shell (Sprint 0–1) | Lead Eng | recommend **single app, `(customer)`/`(admin)` route groups** (`tech-arch/09`) |
| G13 | **File malware scanner** vendor/approach; **pen-test** scope/timing | Security hardening (Sprint 4) | DevSecOps | confirm scanner; schedule pen-test pre-pilot |
| G14 | **Brand assets**: production logo lockups, app icon set, empty/error illustrations, map style | Polish (Sprint 1–3) | Design | build with token placeholders; swap when delivered |
| G15 | **Consent UX** for long-term customer memory/preference profiles | AI memory (V1, not MVP) | Legal + Product | MVP = order-scoped memory only (no consent needed) |

> **None of G1–G15 block starting the foundation (Sprint 0).** G2–G5, G11, G12 should be answered before/at Sprint 0 kickoff; the rest by the sprint that needs them.

---

# PART 3 — Final MVP Scope Confirmation

**Confirmed against `docs/07-mvp-scope` and the build-scope list in the brief — consistent, no conflicts.** Building:

**Customer app (22 screens):** Welcome · Language · Login/Signup · Phone/Email auth (OTP) · Home · New Request flow · Buy-for-Me · Receive-My-Package · Product details · Receipt/document upload · Border/compliance info · Request review · Quote review · Stripe payment (+ success) · Orders list · Order detail · Border Journey · Inspection details · Concierge contact · Notifications · Profile/Settings · About (+ "Powered by Maralito Labs").

**Admin app (14 surfaces):** Admin login · Dashboard · Orders list · Order detail · Risk review · Quote creation · Package received action · Inspection checklist · Inspection photo upload · Status update controls · Customer profile view · Payment/refund visibility · Audit log visibility · Basic concierge workspace.

**Backend (BFF) domains:** Auth integration · RBAC · Orders · OrderItems · Quotes · Payments (refs) · Documents · Inspections · Notifications · Audit logs · AgentRuns · WorkflowRuns · EventLogs.

**Integrations:** Supabase Auth · Storage (Supabase/R2 `G4`) · Postgres (Neon `G3`) · Stripe (checkout/intents/webhooks) · Resend (email) · WhatsApp/SMS (Twilio — placeholder/real per credentials `G8`) · LangGraph workflow skeleton · automation workflow skeleton.

**AI (assist-only, autonomy = `suggest`):** product detail extraction · missing-info detection · risk classification recommendation · quote draft · support response drafts · inspection checklist assistance · order summary · notification draft · admin-notes summarization. **AI must NOT:** final-approve high-risk orders, reject customers without human review, process refunds automatically, make customs declarations independently, edit payment records, or mark delivered without human confirmation.

**Explicitly OUT of MVP (defer to V1+):** full AI autonomy / Shopping-Agent auto-resolution / automated duty calc at scale; Local Pickup & full Business self-serve; reorder; saved payment methods; loyalty; auto RFC invoices; support ticket system (MVP = concierge chat); analytics dashboards; push notifications; voice concierge; marketplace/subscriptions/returns; B2B multi-user.

**Human-approval gates (MVP, structural):** order accept/reject (compliance) · quote send (finance, all) · purchase spend (ops/finance) · border docs (compliance) · inspection-fail resolution (compliance/ops) · refund (finance). 

**Confirmation:** ✅ scope matches source-of-truth; no over-engineering of V1 into MVP detected. Awaiting your sign-off on the Part 2 defaults.

---

# PART 4 — Proposed Repository Structure

Per `tech-arch/09 §31` — BorderPass lives **inside the Maralito monorepo** (pnpm + Turborepo), single app with route groups (`G12`).

```
maralito/ (monorepo — pnpm + Turborepo)
├─ apps/
│  └─ borderpass/
│     ├─ app/
│     │  ├─ (public)/          # welcome, about
│     │  ├─ (auth)/            # login, signup, otp verify
│     │  ├─ (customer)/        # shell: MobileHeader + BottomNav; home, orders/*, messages, notifications, support, profile, settings
│     │  ├─ (admin)/           # shell: sidebar + topbar (RBAC); dashboard, orders, risk, quotes, hub, inspections, deliveries, concierge, customers, finance, audit, settings
│     │  ├─ api/               # route handlers: webhooks (stripe/twilio/resend), reads, OTP
│     │  └─ actions/           # server actions (the mutation/write path)
│     ├─ src/
│     │  ├─ domain/            # orders, quotes, inspections, payments — pure + service fns (state-machine guards)
│     │  ├─ workflows/         # LangGraph + automation workflow definitions (W1–W15 skeletons)
│     │  ├─ agents/            # agent configs/tool refs (Intake/Risk/Quote) — run via AI gateway
│     │  ├─ db/                # Drizzle schema + queries + RLS policies (G5)
│     │  ├─ sdk/              # thin wrappers over @maralito/sdk
│     │  ├─ events/            # Zod event producers/consumers (contracts/03)
│     │  └─ ui/               # screens composed from @maralito/ui + BorderPass tokens
│     ├─ messages/            # i18n EN/ES ICU catalogs
│     └─ tests/               # unit, integration (RLS), e2e (Playwright), workflow, a11y, i18n
├─ packages/
│  ├─ sdk/                    # @maralito/sdk (platform-owned)
│  ├─ ui/                     # @maralito/ui (BorderPass themes Stitch tokens over this)
│  ├─ schemas/                # @maralito/schemas (Zod) — BorderPass adds domain schemas
│  ├─ automation/             # workflow authoring SDK
│  └─ config/                 # tsconfig / eslint / tailwind presets
├─ infra/                     # Terraform (envs, modules, policies)
└─ .github/workflows/         # CI/CD (security-gated)
```

**Boundary rules (lint-enforced):** `apps/borderpass` depends on `packages/*` only (never platform service internals — contract-only); tenant context set **only** in the BFF; `Order.status` mutated **only** via workflow transitions; no provider SDKs in app code (all via `@maralito/sdk`/gateway).

---

# PART 5 — Proposed Environment Variable List

Names only — **values via secret manager; never committed; separate per env; separate provider accounts/keys for test vs live** (`tech-arch/09`). Exact names to confirm vs SDK (`G11`).

| Group | Variables |
|-------|-----------|
| **Core/app** | `NODE_ENV`, `APP_ENV` (local/preview/staging/prod), `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_DEFAULT_LOCALE`, `NEXT_PUBLIC_FLAGS_*` |
| **Database (Neon `G3`)** | `DATABASE_URL`, `DATABASE_DIRECT_URL` (migrations), `NEON_BRANCH` (preview) |
| **Cache/idempotency** | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| **Maralito SDK** | `MARALITO_SDK_BASE_URL`, `MARALITO_SDK_KEY`/`MARALITO_SERVICE_TOKEN`, `MARALITO_APP_ID=borderpass`, per-service keys (Identity/Payments/Notifications/Files/Audit/AI/Automation) — confirm `G11` |
| **Auth (Supabase)** | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `SUPABASE_JWT_SECRET` |
| **Storage (`G4`)** | `SUPABASE_STORAGE_BUCKET` **or** `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET` |
| **Payments (Stripe)** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| **Notifications** | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`; `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `TWILIO_WHATSAPP_FROM`, `TWILIO_WEBHOOK_SECRET` |
| **AI (via gateway only)** | `AI_GATEWAY_URL`, `AI_GATEWAY_KEY` — **no model-provider keys in app** |
| **Automation engine (`G2`)** | `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` **or** `TRIGGER_API_KEY` |
| **Observability** | `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` |
| **Security** | `KMS_KEY_ID`/`KMS_PROVIDER` (field encryption), `RATE_LIMIT_*`, `CRON_SECRET` |

> **Rules:** secrets server-side only (no `NEXT_PUBLIC_` on secrets); OIDC short-lived creds in CI (no static cloud keys); `.env.example` documents names with empty values; secret scanning blocks commits.

---

# PART 6 — Proposed Database Migration Order

Forward-only, expand→migrate→contract, validated on a Neon branch in CI (`tech-arch/09`). **RLS enabled + default-deny on every table from creation.** Platform-owned entities (User, Org, Payment, Refund, Notification, AuditLog, AgentRun, WorkflowRun, EventLog, WebhookEvent) are **not** created here — referenced by id via SDK. Order follows FK dependencies.

| Step | Migration | Tables / changes | Depends on |
|------|-----------|------------------|-----------|
| M0 | Extensions + helpers | `pgcrypto`/`pgvector` (if local), `set_config` tenant helper, updated_at trigger, ULID gen | — |
| M1 | RLS scaffolding | `app.org_id` session GUC; default-deny policy template; audit-emit helper | M0 |
| M2 | Customer + staff identity (BP-side) | `CustomerProfile`, `StaffProfile`, `Address` | M1 |
| M3 | Order aggregate | `Order`, `OrderItem` (FK→CustomerProfile) | M2 |
| M4 | Quote | `Quote`, `QuoteLineItem` (FK→Order/OrderItem) | M3 |
| M5 | Files-referencing rows | `Document`, `Receipt` (FK→Order; store `file_id` only) | M3 |
| M6 | Hub + inspection | `Package`, `Inspection`, `InspectionPhoto` (FK→Order/Package) | M3 |
| M7 | Risk | `RiskReview` (1-1 Order) | M3 |
| M8 | Delivery | `Driver`, `Delivery` (FK→Order/Address/Driver) | M3, M2 |
| M9 | Concierge/support | `ConciergeAssignment`, `SupportTicket`, `SupportMessage` | M2, M3 |
| M10 | Indexes + projections | queue indexes (per `contracts/01` indexing summary); optional status-history projection (rebuildable) | M3–M9 |
| M11 | Field encryption | KMS wrappers/policies for Restricted 🔒 fields (display_name, rfc, kyc_*, address lines, serial, ocr_data, message body, driver PII) | M2–M9 |
| M12 | Seed (non-prod) | roles fixtures, prohibited/accepted category seed, test customers/staff, sample products | M1–M11 |

**Rules:** each table ships with its RLS policy in the same migration; `org_id` + owner predicates per `contracts/01`/`05`; money = integer minor units; enums exactly as `04-state-machines.md`; no destructive ops (expand/contract two-phase); migrations reviewed + isolation-tested on changed tables in CI.

---

# PART 7 — Proposed API Implementation Order

BFF = Next.js **Server Actions (mutations) + Route Handlers (reads/webhooks)** via `withAction({permission, schema, audit})` wrapper; tenant context + RBAC + Zod + idempotency + audit applied centrally (`contracts/02`). Build in dependency order; each endpoint ships with its Zod schema, error mapping, and audit/event emission.

| Phase | Endpoints (SA = server action, RH = route handler) | Notes |
|-------|---------------------------------------------------|-------|
| A. Foundation | `withAction` wrapper; error shape; idempotency middleware; tenant-context setter; audit emitter | underpins everything |
| B. Auth/profile | `POST /api/auth/otp/start` (RH), `/verify` (RH); `GET /api/me` (RH); `updateProfile` (SA); address CRUD (SA) | Supabase Auth + Identity SDK |
| C. Orders (draft→submit) | `createOrder` (SA), `updateDraftOrder` (SA), `submitOrder` (SA); `GET /api/orders` + `/{id}` (RH) | `submitOrder` starts W1 |
| D. Files | `getUploadUrl` (SA), `attachReceipt`/`attachDocument` (SA); `GET /receipts` (RH) | signed URLs; ACL; may clear missing_info |
| E. Admin review | `GET /api/admin/orders` + `/{id}` (RH); `decideRiskReview` (SA, HUMAN-APPROVAL); `requestMissingInfo` (SA); `advanceOrder`/`holdOrder` (SA); `addOrderNote` (SA) | risk gate; PII reads audited |
| F. Quote | `createQuote`/`updateQuote` (SA); `approveQuote` (SA, HUMAN-APPROVAL); `GET /api/orders/{id}/quote` (RH); `acceptQuote`/`declineQuote` (SA) | finance approves all (MVP) |
| G. Payment | `createPaymentIntent`/`payDuties` (SA); `POST /api/webhooks/stripe` (RH) → `payment.succeeded/failed` | confirm via webhook only; idempotent by quote_id |
| H. Journey/inspection (read) | `GET /api/orders/{id}/journey` (RH); `GET /api/orders/{id}/inspection` (RH, signed photo URLs) | projection over status |
| I. Hub/inspection (admin) | `markPackageReceived` (SA); `assignInspector` (SA); `submitInspection` (SA); `resolveInspection` (SA, HUMAN-APPROVAL) | photos to customer; fail→approval |
| J. Crossing/delivery (admin) | `approveBorderDocs` (SA, HUMAN-APPROVAL); `updateCrossingState` (SA); `recordCustomsDelay` (SA); `assignDelivery`/`dispatchDelivery`/`completeDelivery`/`failDelivery` (SA) | `delivered` only on human-confirmed proof |
| K. Concierge/notifications | `GET /api/messages` (RH); `sendConciergeMessage` (SA); `sendStaffMessage` (SA); `GET /api/notifications` (RH); `markNotificationRead` (SA) | sensitive replies human-sent |
| L. Refund/cancel | `requestRefund` (SA); `cancelOrder` (SA); `processRefund` (SA, HUMAN-APPROVAL) | idempotent; SoD (approver≠requester) |
| M. Finance/audit/config | `GET /api/admin/payments` (RH); `reconcilePayment` (SA); `GET /api/admin/audit` (RH); `upsertRuleSet`/`upsertTemplate`/`setFeatureFlag` (SA, elevated); `assignRole`/`revokeRole` (SA, MFA) | governance |
| N. Automation/webhooks | `POST /api/webhooks/{stripe,twilio,resend}` (RH, verify→dedupe→normalize); automation control via SDK (`/runs/{id}/signal`, etc.) | ack fast; process async |

**Cross-cutting per endpoint:** tenant from session (never body); Zod validate before side effects; state transitions re-checked vs `04`; `approval_required` (423) when gate unmet; `not_found` for out-of-tenant; mandatory audit on sensitive ops.

---

# PART 8 — Proposed Frontend Implementation Order

Mobile-first, Stitch-faithful, EN/ES, built on `@maralito/ui` + BorderPass tokens. Per Frontend Handoff build order; each screen ships with empty/error/loading states + a11y + i18n keys (no hardcoded strings).

| Phase | Build | Depends on |
|-------|-------|-----------|
| 1 | **Design system / tokens** — theme, self-hosted fonts, base components (Button/Input/Card/Badge/Modal/Sheet/Toast/Skeleton) + Storybook | API-A, tokens |
| 2 | **App shell + routing + i18n** — `(customer)` shell, MobileHeader, BottomNavigation, locale provider, safe-area, loading/error per segment | P1 |
| 3 | **Onboarding** — Welcome (+Powered by Maralito Labs), Language, Signup, OTP verify | API-B |
| 4 | **Home** — bridge header, ActiveOrderCard, ServiceCard grid | API-C |
| 5 | **New Request flow** — Stepper, Product details, UploadBox, Border info, Request summary | API-C, D |
| 6 | **Quote + Payment** — QuoteSummaryCard, Quote review, Stripe element, Payment success | API-F, G |
| 7 | **Orders + Order detail** — list, detail panels | API-C |
| 8 | **Border Journey** — vertical timeline, ETA, View Photos, ConciergeCard | API-H |
| 9 | **Inspection details** — InspectionPhotoGrid, trust chips | API-H |
| 10 | **Concierge chat** — thread, composer, WhatsApp link | API-K |
| 11 | **Notifications + Profile/Settings/About** — NotificationCard, prefs, addresses, "Powered by Maralito Labs" | API-B, K |
| 12 | **Admin shell + tables** — sidebar, AdminDataTable, kanban, masking | API-E |
| 13 | **Admin order mgmt + Risk review** — order detail, RiskReviewCard, HumanApprovalModal | API-E |
| 14 | **Admin quote / inspection / status / payments / audit / concierge** | API-F,I,J,M,K |

**Standards (all screens):** strict TS; Zod-validated forms (shared schemas); ≥48px targets; WCAG AA; reduced-motion; EN/ES parity (~+25% ES); sticky CTA/nav; signature components (bridge header, journey timeline, bridge progress bar, concierge card) faithful to Stitch.

---

# PART 9 — Proposed Automation Implementation Order

Durable workflows on the engine (`G2`); 25-status order machine = the durable workflow; events idempotent by `event.id`; approvals pause/resume; saga compensation on money/irreversible steps. Build skeleton first, then wire per feature.

| Phase | Build | Depends on |
|-------|-------|-----------|
| AUT-0 | **Engine + event bus skeleton** — choose engine (`G2`); trigger router; outbox; idempotency store (Upstash + `processed_events`); DLQ | env, DB |
| AUT-1 | **WorkflowRun + step model** — `function\|agent\|approval\|task\|wait\|signal\|effect\|subworkflow`; Postgres checkpointer; unique active run per (def,order) | AUT-0 |
| AUT-2 | **W1 Intake + W2 Missing-info** — validate→enrich→AI intake→branch | API-C, AI |
| AUT-3 | **W3 Risk review** — rules eval→Risk agent→**compliance approval node** | AUT-2, AI, rules |
| AUT-4 | **W4 Quote** — pricing→Quote agent draft→**finance approval**→PDF→notify | AUT-3 |
| AUT-5 | **W6 Payment** — intent→await Stripe webhook→`paid`→fulfilment branch; dunning | API-G |
| AUT-6 | **W8 Package received + W9 Inspection** — receive/match→inspection→pass/fail (**compliance gate on fail**) | API-I |
| AUT-7 | **W10 Crossing + W11 Delay** — border-doc approval→crossing/customs states→delay notify (ops-confirm) | API-J |
| AUT-8 | **W12 Delivery + W13 Failed** — dispatch→POD→delivered; reschedule(≤N) | API-J |
| AUT-9 | **W14 Refund** — eligibility→**finance approval**→idempotent Stripe refund→compensation | API-L |
| AUT-10 | **W15 Support escalation** + **W5 quote-expiry schedule** | API-K |
| AUT-11 | **Saga/compensation + DLQ replay + override** — reverse side effects; P0 on failed compensation; elevated replay/override (audited) | all |

**Guarantees:** every step emits event + audit; every customer-relevant transition fires a notification; money/irreversible steps idempotent + compensable; human gates at W3/W4/W7/W9-fail/W10/W14; never auto-clear on uncertainty.

---

# PART 10 — Proposed AI Implementation Order

Assist-only (autonomy = `suggest`); all calls via the AI gateway (no provider keys in app); agents run as workflow `agent` steps via the LangGraph Manager; structured outputs + confidence; approval auto-inserted for risky actions; runs/steps logged (`AgentRun`/`AgentStep`).

| Phase | Build | Depends on |
|-------|-------|-----------|
| AI-0 | **Gateway integration + Manager skeleton** — authz/scope, model router, in/out guardrails, cost ledger, tracing; LangGraph Manager (route/validate/approval/audit) | AUT-1 |
| AI-1 | **Tool registry (MVP subset)** — `read_order`, `read_customer_profile`, `request_missing_information`, `extract_product_details_from_url`, `estimate_quote`, `create_quote_draft`, `recommend_risk_level`, `search_knowledge_base`, `create_support_message_draft`, `log_audit_event`, `emit_workflow_event` (scoped, schema-validated) | AI-0 |
| AI-2 | **Intake Agent** — validate + missing-info detection (recommend) → W1/W2 | AI-1, AUT-2 |
| AI-3 | **Product Extraction** — URL/text→draft items + per-field confidence (assist; price = estimate) | AI-1 |
| AI-4 | **Risk Agent** — band + rationale + matched rules + confidence (recommend-only; never clears) → W3 | AI-1, AUT-3, rules |
| AI-5 | **Quote Agent** — itemized draft + duty **estimate** (labeled) → W4 (finance approves) | AI-1, AUT-4 |
| AI-6 | **Support / Concierge drafts** — triage + EN/ES reply draft (human-sent); admin-notes + order summary + notification drafts | AI-1 |
| AI-7 | **RAG seed + guardrails + evals** — ingest policies/FAQ/templates (ACL-tagged pgvector); injection/PII/schema guardrails; golden sets (extraction/risk/quote) + red-team; **prohibited false-clear = 0** gate | AI-2..6 |

**Hard rules (enforced structurally, not by prompt):** AI never final-approves high-risk orders, rejects customers, processes refunds, makes customs declarations, edits payments, or marks delivered — each is a missing tool + an approval node. Low-confidence on risky → escalate. Cost metered + budgeted; guardrail hits audited.

---

# PART 11 — Testing Strategy

Test pyramid wired into CI (`tech-arch/09`); **tenant-isolation tests are a blocking gate.** No merge on regression.

| Layer | Scope / tooling | Gate |
|-------|-----------------|------|
| **Unit** (Vitest) | domain logic, state-machine guards, Zod schemas, components (RTL) | block on fail |
| **Integration** | BFF↔SDK↔DB with **RLS enforced**; server actions; webhook normalize | block |
| **Tenant-isolation** | cross-tenant read/write attempts → `not_found`/denied | **blocking** |
| **Contract** | endpoints + event envelopes vs `contracts/02,03` | block |
| **E2E** (Playwright on preview) | trust-critical path: onboard→request→quote→pay→journey→inspection→delivery; EN + ES | block on critical |
| **Payment** | Stripe test mode: success/decline/3DS/webhook idempotency/refund (no double) | block |
| **Upload** | signed-URL; type/size/invalid; malware reject; ACL | block |
| **Auth/RBAC** | OTP; role gating; MFA; elevation; 403 audited | block |
| **Workflow** | durability, resume-after-approval, idempotency, saga compensation (restart/chaos) | block |
| **AI output** | golden sets; schema conformance; confidence calibration; **prohibited false-clear=0**; red-team (injection/jailbreak/PII/cross-tenant/act-without-approval) | block (AI changes) |
| **Accessibility** | axe-core CI + manual SR/keyboard on key flows | block on key flows |
| **Localization** | pseudo-loc (hardcoded/clipping); EN/ES parity; format checks | block |
| **Mobile UX** | device matrix 360/390/430 + tablet; safe-area; targets; landscape | review |
| **Security** | SAST/SCA/secret/IaC scans; injection; upload; STRIDE cross-tenant; pen-test pre-pilot `G13` | block (scans) |
| **Regression/visual** | full suite each change; visual regression for design fidelity | block |

**Required case families:** happy paths (both services, EN/ES); 15 edge cases (`docs/18`: prohibited item, missing receipt, wrong/damaged/lost, payment fail, refund, unreachable, border delay, bad address, failed delivery, inspection fail, AI low-confidence, duplicate, fraud); failure/permission/payment-fail/upload-fail/low-confidence/override/cancel/inspection-fail (per backlog D9). Seed golden datasets + fixtures before feature tests.

---

# PART 12 — Deployment Strategy

Per `tech-arch/09` — Vercel + Neon branching, GitOps, progressive delivery, instant rollback.

| Env | Trigger | Data | Gates |
|-----|---------|------|-------|
| **Local** | `pnpm dev` | seeded synthetic | — |
| **Preview** | per PR | Neon branch (synthetic) | CI pipeline + e2e on preview |
| **Staging** | merge to main | prod-like synthetic (no prod PII) | smoke/e2e + AI evals (if changed) |
| **Production** | gated promotion | real | approval + progressive (canary→%→full) + flags |

**Pipeline (blocking gates):** install → lint+typecheck → unit → SAST → SCA/license → secret scan → IaC scan → build → **migration check on Neon branch** → integration + **tenant-isolation** → e2e (Playwright) → AI eval (if agents changed) → deploy preview/staging → gated promote → production (progressive).

**Properties:** OIDC short-lived CI creds (no static keys); forward-only expand→migrate→contract migrations; feature flags decouple deploy from release; **instant rollback** (flag kill or redeploy); separate provider accounts/keys per env; SBOM on release `⚠️ VERIFY`. **Pilot launch = flag-gated** behind readiness checklist + **legal sign-off for real orders**.

---

# PART 13 — Security Checklist

| Control | Implementation |
|---------|----------------|
| **RBAC** | `can(role, action, ctx)` at BFF on every mutation/read; 9 roles + agent principal; permission strings per `contracts/05`. |
| **RLS** | `org_id` (+owner) policy on every table; tenant context set **only** in BFF from validated token; cross-tenant → `not_found`; isolation tests blocking. |
| **Protected routes** | middleware session guard (customer) + RBAC layout guard (admin); unauthorized → not_found; MFA for admin/finance/compliance. |
| **Server-side validation** | Zod at every boundary before side effects; state-machine guards re-check transitions; reject floats/foreign-tenant ids. |
| **Secure storage** | direct-to-storage signed URLs (short-lived); object-level ACL; store `file_id` only; inspection photos owner-ACL; no public buckets. |
| **Audit logs** | immutable hash-chained (Audit S7); auto-emit on sensitive ops (status transitions, risk/quote/refund/border-doc decisions, PII reads, agent recs+decisions, 403s); justification on elevated. |
| **Payment webhook verification** | verify Stripe signature; dedupe by provider event id; never process inline; confirm payment via webhook only; idempotent by quote_id/refund key. |
| **Rate limiting** | per key/org/route (tighter on auth/payments/AI); `429` + `Retry-After`; budget caps on AI. |
| **Safe file upload** | content-type + size validation; malware scan `G13`; sandboxed parse; reject executables; MIME allowlist. |
| **Sensitive-data masking** | PII/KYC/RFC/financial masked-by-default in admin UI; reveal is an explicit **audited** action; restricted fields KMS field-encrypted + permission-gated decrypt. |
| **No secrets committed** | secret scanning blocks; `.env.example` only; secrets in manager; no `NEXT_PUBLIC_` secrets; OIDC in CI. |
| **Environment separation** | hard isolation: separate DBs/secrets/provider accounts per env; no prod PII in lower envs. |
| **Error handling** | canonical error shape; no stack/SQL/provider leakage; `trace_id` for correlation; localized customer-facing messages. |
| **AI safety** | recommend-only; untrusted content = data; egress allowlist; tool scoping; injection/PII guardrails; low-confidence→escalate; no money/customs/delivery autonomy. |
| **Prompt-injection / tool misuse** | gateway input guardrails; least-privilege tools; schema-validated args; denied calls audited. |

---

# PART 14 — Risks & Blockers

| ID | Risk / blocker | Sev | Type | Mitigation | Status |
|----|----------------|:---:|------|------------|--------|
| B1 | **Customs/compliance legal sign-off** unresolved | 🔴 Critical | Blocker (orders) | Engage counsel now; gate real orders; build + internal test proceed | open — start immediately |
| B2 | **Engine choice (Inngest/Trigger.dev) + checkpointer** | 🟠 High | Blocker (automation) | Confirm LangGraph Postgres checkpointer works with Inngest | ✅ RESOLVED: Inngest |
| B3 | **DB/Storage/ORM choices** (Neon vs Supabase; Drizzle vs Prisma; Supabase Storage vs R2) | 🟠 High | Blocker (schema) | Locked: Supabase Postgres+Auth+Storage + Drizzle | ✅ RESOLVED |
| B4 | **Maralito SDK surface + env names** not confirmed | 🟠 High | Dependency | Confirm `@maralito/sdk` API + keys with platform team | open — Sprint 0 |
| B5 | Platform MVP services not ready in parallel | 🟠 High | Dependency | Track milestones; stub where safe; align roadmaps | monitor |
| B6 | Prohibited-item false-clear | 🔴 Critical | AI/Compliance | Recommend-only + compliance gate; 0-tolerance eval; never auto-clear | controlled by design |
| B7 | Payment/refund correctness (double charge/refund) | 🟠 High | Payment | Idempotency keys; saga; webhook-only confirm; never optimistic | controlled by design |
| B8 | RLS/RBAC isolation gap | 🔴 Critical | Security | Double enforcement; blocking isolation tests; pen-test | controlled by design |
| B9 | WhatsApp template approval lead time | 🟡 Med | Ops | Start now; launch SMS+email+in-app; add WA later | open — start Sprint 0 |
| B10 | Duty-estimate accuracy | 🟠 High | Compliance/Finance | Labeled estimate; finance approves all quotes; rules versioned | controlled |
| B11 | Thresholds/service fee/expiry undefined | 🟡 Med | Product/Finance | From rules engine; need initial values (G6/G7) | open |
| B12 | Hub/ops process maturity | 🟡 Med | Operations | SOPs + train + dry-run; manual fallbacks | parallel |
| B13 | Brand assets / copy gaps | 🟡 Med | Design/Content | Build with placeholders; swap on delivery | parallel |
| B14 | Scope creep (AI/automation depth into MVP) | 🟡 Med | Delivery | Enforce assist-only; phase gates; defer to V1 | governance |

**Hard blockers to resolve before/at Sprint 0:** B2, B3, B4 (technical decisions) + start B1, B9 (long lead times). **B1 gates real orders only**, not the build.

---

# PART 15 — Final Build Sequence

The dependency-ordered master sequence (consolidates Parts 6–10). Sprints per backlog D6.

```
SPRINT 0 — Foundation & decision lock
  Repo/Turborepo + envs + CI (security-gated) → resolve B2/B3/B4 decisions →
  DB extensions + RLS scaffolding (M0–M1) → @maralito/sdk wiring →
  design tokens skeleton → [parallel: start B1 legal review, B9 WhatsApp templates]

SPRINT 1 — Core foundation
  Auth + RBAC + RLS (M2, API-B) → design system + base components (FE P1) →
  app shell + routing + i18n (FE P2) → onboarding (FE P3) → document upload (M5, API-D) →
  audit logging scaffold (EPIC-21)

SPRINT 2 — Order flow & admin review
  Order schema (M3) + New Request flow (FE P4–5, API-C) → durable workflow + engine (AUT-0/1) →
  Intake/Risk agents via gateway (AI-0..4) → admin shell + orders (FE P12, API-E) →
  risk review + approval gate (AUT-3, FE P13) → quote draft + finance approval (M4, AUT-4, API-F)

SPRINT 3 — Payments, tracking, inspection, notifications
  Stripe payment + webhooks (API-G, AUT-5) → Border Journey (M-proj, API-H, FE P8) →
  package receiving + inspection (M6, AUT-6, API-I, FE P9) → crossing/delivery (AUT-7/8, API-J) →
  notifications EN/ES (EPIC-18) → concierge chat (M9, API-K, FE P10)

SPRINT 4 — QA, hardening, deploy, pilot
  Refund/cancel (M, AUT-9, API-L) → edge-case suite (15) → security hardening (M11, Part 13) →
  observability + alerts (EPIC-22) → RAG seed + guardrails + evals (AI-7) →
  deploy pipeline + rollback (Part 12) → release-readiness gate → [legal sign-off → real orders] → pilot
```

**Validation checklist at each gate:** CI green (incl. tenant-isolation + AI evals); acceptance criteria met (backlog D8); no critical bugs; security scans clean; a11y/i18n pass; demo of the sprint's slice on staging. **Go-live gate:** readiness checklist (backlog D10) green **AND** customs/compliance legal sign-off complete.

---

## Recommendation — when to start implementation

**Start Sprint 0 (foundation) as soon as the three technical decisions (B2 engine, B3 DB/ORM/storage, B4 SDK surface) are confirmed** — these have no upstream blocker and the rest of the build depends on them. My recommended defaults (Inngest · Neon + Drizzle · Supabase Auth/Storage · single app with route groups) are in Part 2; confirm or override them and I proceed.

**In parallel, kick off the two longest-lead items on day one:** the customs/compliance legal review (B1 — gates real orders) and WhatsApp template approval (B9).

**Feature implementation (Sprint 1+)** follows once Sprint 0 foundations are in place. **Real cross-border orders stay disabled until legal sign-off** — internal/friendly end-to-end testing runs on synthetic data before that gate.

**The architecture, product, design, data, API, automation, and AI specifications are complete and mutually consistent. I am ready to build.** Awaiting:
1. Your confirmation (or override) of the Part 2 defaults — especially **B2/B3/B4**.
2. The explicit command **`START BORDERPASS BUILD`**.

Until that exact command is given, I remain in planning/review mode and will write no code.

---

*Owner: Lead Full-Stack Engineer / Technical Delivery Agent, Web Forx Technology Ltd. · Draft v0.1 · 2026-06-29 · PLANNING MODE — no code written.*

---

# DECISION LOG — locked 2026-06-29 (supersedes "recommended default" language above)

| # | Decision | Choice | Downstream impact |
|---|----------|--------|-------------------|
| **B2 · Engine** | Durable workflow engine | ✅ **Inngest** (+ LangGraph Postgres checkpointer) | `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY`; AUT-0 wires Inngest; confirm checkpointer integration in Sprint-0 spike. |
| **B3 · Data stack** | DB + ORM + Auth + Storage | ✅ **All-Supabase (Postgres + Auth + Storage) + Drizzle ORM** | Single vendor for DB/Auth/Storage. See adjustments below. |

**Adjustments from the All-Supabase + Inngest choice (the only deltas to Parts 4–6, 12):**

1. **Env vars (Part 5):** `DATABASE_URL` = **Supabase Postgres** (pooled + `DATABASE_DIRECT_URL` for migrations); drop Neon vars; storage = `SUPABASE_STORAGE_BUCKET` (drop R2 vars); add `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` (drop Trigger.dev). Keep `SUPABASE_URL`/`ANON_KEY`/`SERVICE_ROLE_KEY`/`JWT_SECRET`.
2. **Files (G4):** **Supabase Storage** with object-level RLS/ACL + short-lived signed URLs; BorderPass stores only `file_id`. (R2 dropped.)
3. **Auth:** Supabase Auth phone OTP is the credential layer behind the platform Identity SDK boundary; session → `org_id` for RLS unchanged.
4. **RLS:** Supabase Postgres RLS is native — policies authored directly (Part 6 M1–M11 unchanged); Drizzle for schema/queries, RLS via SQL policies in the same migrations.
5. **Preview DB branching (Part 12):** `tech-arch/09` assumed Neon per-PR branches. With Supabase, use **Supabase branching** (preview branches) *or* ephemeral per-PR schemas/projects for CI isolation — **`⚠️ VERIFY` Supabase branching maturity** for the preview pipeline; this is the one open item created by the DB choice (does not block Sprint 0; resolve before the preview-CI step in Sprint 1).
6. **ORM:** **Drizzle** for schema + queries + migrations (SQL-first, RLS-friendly); migration order in Part 6 unchanged.

**Remaining decisions still needed before/at Sprint 0:** B4 (confirm `@maralito/sdk` surface + exact env-var names with the platform team), G6/G7 (initial rules-engine thresholds + service fee/duty basis — needed by Sprint 2), and starting the long-lead items B1 (customs legal) + B9 (WhatsApp templates) now.

**Status:** PLANNING MODE — holding. No code will be written until the explicit command **`START BORDERPASS BUILD`**.
