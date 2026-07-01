# BorderPass — Implementation Backlog, Epic Breakdown & Build Roadmap

> **Status:** Draft v0.1 · **Owner:** CPO / Principal TPM / Delivery Lead (Web Forx Technology Ltd.) · **Last updated:** 2026-06-29
> **Purpose:** Convert all completed architecture, product, design, data, API, automation, and AI documents into a build-ready backlog — epics, stories, tasks, dependencies, acceptance criteria, and sprint sequencing — that engineering agents can follow.
> **Non-goals (explicit):** No production code. No app scaffolding. No frontend/backend implementation. This is the **delivery blueprint** only.

## Source-of-truth alignment

| # | Source | Path |
|---|--------|------|
| 1 | Maralito Platform Architecture | `maralito-platform/docs/*` |
| 2 | Maralito Automation Platform | `maralito-platform/automation/*` |
| 3 | BorderPass PRD / Product Architecture | `borderpass/docs/01..20` (esp. `07-mvp-scope`, `18-edge-cases`, `19-mvp-roadmap`) |
| 4 | BorderPass Technical Architecture | `borderpass/technical-architecture/docs/01..10` |
| 5 | Data Model + API + Event Contracts | `borderpass/contracts/01..05` |
| 6 | AI Agent + LangGraph Architecture | `borderpass/ai-architecture/AI-Agent-Architecture-and-LangGraph-Blueprint.md` |
| 7 | Design-to-Frontend Handoff Package | `borderpass/frontend-handoff/Design-to-Frontend-Handoff-Package.md` |
| 8 | Approved Stitch design direction | `borderpass/design-reference/*` |

**Conventions:** Phase = `MVP | V1 | V2 | Future`. Priority = `P0` (blocks MVP) … `P3` (nice-to-have). Estimate = `S` (≤1d) · `M` (2–3d) · `L` (4–6d) · `XL` (>1 sprint, split). `⚠️ VERIFY` = external/legal dependency to confirm. `HUMAN-APPROVAL` gates and sensitive-data rules are inherited from sources 5–6 and are non-negotiable.

**Hard gating dependency (carry from `19-mvp-roadmap`):** *customs/import legal review is a hard prerequisite before any real cross-border order.* Treat as a P0 blocker on go-live, parallelizable with build.

## Table of contents
1. [Executive Delivery Summary](#deliverable-1--executive-delivery-summary) · 2. [MVP Release Definition](#deliverable-2--mvp-release-definition) · 3. [Epic Breakdown](#deliverable-3--epic-breakdown) · 4. [User Stories](#deliverable-4--user-stories) · 5. [Build Sequence](#deliverable-5--build-sequence) · 6. [Sprint Plan](#deliverable-6--sprint-plan) · 7. [Technical Task List](#deliverable-7--technical-task-list) · 8. [Acceptance Criteria Matrix](#deliverable-8--acceptance-criteria-matrix) · 9. [Testing Plan](#deliverable-9--testing-plan) · 10. [Release Readiness Checklist](#deliverable-10--release-readiness-checklist) · 11. [Risk Register](#deliverable-11--risk-register) · 12. [Dependency Map](#deliverable-12--dependency-map) · 13. [Build Agent Input Package](#deliverable-13--build-agent-input-package) · 14. [Final Format & Recommendation](#deliverable-14--final-output-format--recommendation)

---

# DELIVERABLE 1 — Executive Delivery Summary

| Field | Summary |
|-------|---------|
| **MVP build objective** | Ship a system where **one Juárez customer completes one trustworthy cross-border order end-to-end** — onboard (EN/ES) → request → human-reviewed quote → Stripe payment → hub receipt + inspection (photos/serial/seal) → Border Journey tracking → delivery with proof — over **polished automation atop mostly-manual ops**, with **humans approving every risky/financial/compliance decision** and every sensitive action audited. |
| **Recommended build strategy** | **Thin app, fat platform**: consume Maralito Platform + Automation services (Identity, Payments, Notifications, Files, Audit, AI gateway, workflow engine) rather than rebuilding. Build the **trust-critical happy path first**; defer automation depth/self-serve breadth to V1. Vertical slices behind the durable order workflow. |
| **Engineering approach** | One TypeScript stack (Next.js App Router, RSC + server actions = BFF) for customer + admin; durable order workflow on the automation engine; shared Zod schemas from `contracts`; AI agents run **recommend-only** via the gateway; RLS + RBAC enforced twice (app + DB); idempotent money/irreversible steps with saga compensation. |
| **Delivery assumptions** | Platform + Automation MVP services are usable/progressing in parallel; Stitch design + data model + contracts are approved; Stripe/WhatsApp/Resend/Twilio accounts available; El Paso Hub has ≥1 inspector + ≥1 driver; small senior full-stack pod (~3–5 eng) + 1 designer + ops/compliance partners; AI used assist-only in MVP. |
| **Timeline assumptions** | ~30-day MVP build (after Phase-0 foundations), 60-day V1, 90-day pilot — relative, **gated by customs/compliance legal sign-off** before real orders. Sprints are 1 week (Sprint 0–4). |
| **Key risks** | (1) Compliance/customs legal unresolved (hard gate); (2) WhatsApp template approval lead time; (3) scope creep into AI/automation depth; (4) payment/refund correctness; (5) Hub/ops process maturity; (6) PII/sensitive-data handling. (Full register in [D11](#deliverable-11--risk-register).) |
| **Critical path** | Repo/env + platform SDK wiring → Auth/RBAC + RLS → order data model + durable order workflow → New Request flow → admin review + risk gate → quote (human-approved) → Stripe payment → hub receipt + inspection → Border Journey + notifications → audit → QA/hardening → pilot. |
| **Recommended first release scope** | The **MVP list in [D2](#deliverable-2--mvp-release-definition)** — Buy-for-Me + Package-Reception services, every order human-reviewed, AI assist-only, manual ops behind an automated customer experience. Local Pickup / full Business / reorder / saved cards / analytics dashboards / push = **deferred to V1**. |

---

# DELIVERABLE 2 — MVP Release Definition

Anchored to `docs/07-mvp-scope.md`. The MVP proves a polished automated **customer experience over mostly-manual operations**, with humans approving every risky/financial/compliance decision.

## 2.1 What MUST ship (MVP)
Customer auth (EN/ES, phone OTP) · onboarding · New Request flow (3 steps; **Buy-for-Me + Package-Reception**) · product URL/details submission · receipt/document upload · border/compliance info form · admin order dashboard + order detail · **manual risk review** (every order) · quote creation (AI-drafted, **human-approved**) · Stripe payment + receipt · order status tracking + **Border Journey** timeline · package-received workflow · inspection checklist · inspection photos (serial/seal, shown to customer) · customer notifications (email + WhatsApp/SMS + in-app) · concierge contact (WhatsApp + in-app) · audit logging · basic role-based access · delivery confirmation with proof · manual refund/cancel (finance-approved).

## 2.2 What MUST NOT ship (deferred)
Full AI autonomy (agents recommend only) · Shopping-Agent auto URL resolution · automated duty calculation at scale · Local Pickup & full Business/freight self-serve · reorder · saved payment methods · loyalty/VIP · auto BorderPass-issued RFC invoices · support ticket system (MVP uses concierge chat) · analytics dashboards (MVP = basic metrics) · push notifications · voice concierge · marketplace/subscriptions/US-returns · multi-user B2B/POs/net-terms.

## 2.3 What can remain MANUAL (humans do it)
All risk/compliance decisions; quote finalization; buy-for-me purchasing (staff buyer + proof); border documentation + customs handling; crossing/customs status updates; driver dispatch + delivery; duty estimation (AI suggests, human confirms); refunds; URL price/availability resolution.

## 2.4 What MUST be AUTOMATED (system/agents)
Onboarding/auth + OTP; notifications for key events; status timeline/Border Journey rendering; intake validation (Intake Agent flags missing info → W2); durable workflow orchestration (statuses/tasks/approvals/compensation); quote draft + risk band **suggestions** (recommend-only); Stripe payment + receipt + idempotent webhooks; audit logging of sensitive actions; task creation for review/inspection/delivery queues.

## 2.5 What MUST have HUMAN-APPROVAL (MVP)
| Decision | Approver |
|----------|----------|
| Accept/reject order (risk/compliance) | compliance_admin (/ops) |
| Finalize/send quote | finance_admin (/ops) |
| Approve purchase (buy-for-me) | ops/finance |
| Border documentation / customs submission | compliance_admin |
| Inspection fail / discrepancy resolution | compliance/ops |
| Refund (any, MVP) | finance_admin |

## 2.6 What can be MOCKED/STUBBED for MVP
Carrier/customs live tracking (manual ops status updates instead) `⚠️ VERIFY`; broker/partner integration (manual) `⚠️ VERIFY`; AI vision inspection (MVP = human checklist + photos; Inspection Assistant vision is V1); automated duty rates (human-confirmed estimate); analytics dashboards (basic event capture only); push notifications; reorder/saved-cards; KB/RAG depth (seed minimal FAQ). Agent **runs** are real (recommend-only) but their *autonomy* is stubbed to `suggest`.

## 2.7 What requires REAL integration from day one
Identity/auth (phone OTP); Stripe payments + webhooks + receipts; Notifications (Resend email + Twilio/WhatsApp SMS) for key events; Files (signed-URL upload for receipts + inspection photos); Audit service (immutable); durable workflow engine (order lifecycle); Postgres + RLS; AI gateway (for recommend-only Intake/Risk/Quote agents). **Legal/compliance sign-off** on initial accepted/prohibited categories before real orders.

`ACCEPTANCE (MVP):` a new Juárez user onboards (EN/ES), submits Buy-for-Me or Package-Reception, is human-reviewed, quoted transparently, pays via Stripe, tracks via Border Journey; package received + inspected with photos/serial/seal; notified at each stage; can reach a concierge; delivery confirmed with proof; refunds/cancels work (finance-approved); every sensitive action audited; ops runs the whole flow from the admin dashboard.

---

# DELIVERABLE 3 — Epic Breakdown

Per epic: **Goal · Description · Roles impacted · Dependencies · Stories (IDs → D4) · Acceptance criteria · Risks · Phase.** Story IDs are referenced in [D4](#deliverable-4--user-stories).

### EPIC-01 · Project Foundation — **MVP / P0**
- **Goal:** A working monorepo app skeleton + environments + CI that any agent can build into.
- **Description:** `apps/borderpass` in the Maralito monorepo; envs (dev/stage/prod); CI/CD with security gates; `@maralito/sdk` wiring; config/flags; Neon Postgres + Upstash provisioning.
- **Roles:** super_admin (setup). **Dependencies:** Platform + Automation MVP; repo access; service accounts.
- **Stories:** S-001..S-006. **AC:** app boots in all envs; CI runs lint+typecheck+test+IaC scan; SDK calls a platform health endpoint; no provider keys in app code.
- **Risks:** platform readiness; env drift. **Phase:** MVP.

### EPIC-02 · Design System & Tokens — **MVP / P0**
- **Goal:** BorderPass theme (tokens + base components) over `@maralito/ui`, faithful to Stitch.
- **Description:** Implement D3 tokens (colors/type/spacing/radius/shadow/z/motion); self-host fonts; base components (Button/Input/Card/Badge/Modal/Sheet/Toast/Skeleton); Storybook.
- **Roles:** all (foundation). **Dependencies:** EPIC-01; Frontend Handoff (D2/D3); Stitch.
- **Stories:** S-010..S-016. **AC:** tokens match handoff hex/type; components pass a11y (axe) + reduced-motion; Storybook renders states.
- **Risks:** Stitch-HTML-as-reference drift; ES expansion. **Phase:** MVP.

### EPIC-03 · Authentication & Authorization — **MVP / P0**
- **Goal:** Phone-OTP auth + RBAC (9 roles + agent) + RLS tenant isolation.
- **Description:** Identity integration (signup/login/verify); session→org_id tenant context; `can(role,action,ctx)`; RLS policies on every table; MFA for admin/finance/compliance; elevation rules.
- **Roles:** all. **Dependencies:** EPIC-01; Identity S1; contracts/05.
- **Stories:** S-020..S-027. **AC:** OTP works; unauthorized → not_found; RLS cross-tenant test fails closed; MFA enforced; 403s audited.
- **Risks:** RLS gaps (critical); OTP deliverability. **Phase:** MVP.

### EPIC-04 · Customer App Shell — **MVP / P0**
- **Goal:** AppShell + MobileHeader + BottomNavigation + routing + i18n runtime.
- **Description:** `(customer)` route group shell; bottom nav (Home/Orders/Messages/Support/Profile); locale provider; safe-area; loading/error/not-found per segment.
- **Roles:** customer. **Dependencies:** EPIC-02, EPIC-03. **Stories:** S-030..S-034.
- **AC:** nav works + `aria-current`; routes guarded; EN/ES switch live; skeletons on async. **Risks:** none major. **Phase:** MVP.

### EPIC-05 · Customer Onboarding — **MVP / P0**
- **Goal:** Welcome → language → signup → OTP → Home.
- **Description:** Welcome (value prop + "Powered by Maralito Labs"), language select (persist), phone signup, OTP verify, profile init.
- **Roles:** customer. **Dependencies:** EPIC-03, EPIC-04. **Stories:** S-040..S-044.
- **AC:** new user reaches Home in EN or ES; `user.created` emitted; *Account created* notification. **Risks:** OTP UX. **Phase:** MVP.

### EPIC-06 · New Order / Request Flow — **MVP / P0**
- **Goal:** 3-step request (Service → Product/Details → Border info → Review/Submit) for Buy-for-Me + Package-Reception.
- **Description:** Stepper flow; service selection; product URL/qty/variant/value; border/compliance form (purpose, declared value, RFC optional, category); request summary with estimate tile; draft autosave; submit.
- **Roles:** customer; Intake/Risk agents (downstream). **Dependencies:** EPIC-04, EPIC-07, order data model, Intake agent.
- **Stories:** S-050..S-058. **AC:** draft autosaves; validation gates submit; `order.created`→`order.submitted`; missing-info routes to W2. **Risks:** extraction quality (assist). **Phase:** MVP (Local Pickup/Business = V1).

### EPIC-07 · Document Upload — **MVP / P0**
- **Goal:** Secure receipt/invoice/photo upload via signed URLs.
- **Description:** UploadBox (6 states); Files S5 signed-URL flow; type/size validation + scan; attach to order; `file.uploaded`.
- **Roles:** customer, inspector (admin). **Dependencies:** EPIC-01, Files S5. **Stories:** S-060..S-063.
- **AC:** upload/retry/invalid states work; files ACL-scoped; signed URLs expire; malicious-file rejected. **Risks:** file scanning vendor `⚠️ VERIFY`. **Phase:** MVP.

### EPIC-08 · Quote & Pricing Flow — **MVP / P0**
- **Goal:** AI-drafted, human-approved itemized quote → customer accept.
- **Description:** Quote draft (service fee + item value + estimated duties) via Quote Agent; finance approval gate (W4/WF8); quote review screen; accept; expiry timer.
- **Roles:** customer, finance_admin; Quote agent. **Dependencies:** EPIC-06, EPIC-14 (risk cleared), pricing rules, AI gateway.
- **Stories:** S-070..S-076. **AC:** quote itemized + duties labeled estimate; **finance approves all (MVP)**; `quote.created/sent/accepted`; expiry handled. **Risks:** duty accuracy (legal/financial). **Phase:** MVP.

### EPIC-09 · Stripe Payment Flow — **MVP / P0**
- **Goal:** Secure payment + receipt + idempotent webhooks.
- **Description:** Payment intent (Payments S3); checkout/"Approve & Pay Duties"; webhook normalize → `payment.succeeded/failed`; receipt; dunning on fail; success screen.
- **Roles:** customer, finance_admin. **Dependencies:** EPIC-08, Stripe, webhook handler. **Stories:** S-080..S-086.
- **AC:** payment advances `paid`; webhook idempotent (dedupe Stripe event id); failed → retry/dunning; never proceed unpaid; receipt issued. **Risks:** payment correctness (high). **Phase:** MVP.

### EPIC-10 · Order Tracking & Border Journey — **MVP / P0**
- **Goal:** Canonical 25-status order machine rendered as the signature Border Journey.
- **Description:** Order status machine (09) as durable workflow; journey projection; vertical timeline (node states, ETA, tracking id, View Photos, concierge card); live updates.
- **Roles:** customer, ops. **Dependencies:** EPIC-06, workflow engine, status machine. **Stories:** S-090..S-096.
- **AC:** every transition emits event + audit + notification; journey accessible (ordered list); delay/failed states render. **Risks:** realtime transport choice `⚠️ VERIFY`. **Phase:** MVP.

### EPIC-11 · Concierge Messaging / Contact — **MVP / P0**
- **Goal:** 1:1 human concierge via WhatsApp + in-app chat.
- **Description:** Messages thread (ChatBubble), ConciergeCard, WhatsApp continuity (inbound→Concierge Workspace), composer + attachments.
- **Roles:** customer, concierge, support_agent. **Dependencies:** EPIC-04, Notifications (WhatsApp), EPIC-18. **Stories:** S-100..S-104.
- **AC:** customer↔concierge messaging works in-app + WhatsApp; sensitive replies human-sent; threads audited. **Risks:** WhatsApp template approval `⚠️ VERIFY`. **Phase:** MVP.

### EPIC-12 · Admin Dashboard Foundation — **MVP / P0**
- **Goal:** `(admin)` shell + RBAC nav + data-table/kanban primitives.
- **Description:** Sidebar+topbar shell; role-filtered nav; AdminDataTable (sort/filter/search/paginate); AdminTaskCard kanban; sensitive-data masking; reuses Automation dashboard themed.
- **Roles:** all staff. **Dependencies:** EPIC-02, EPIC-03. **Stories:** S-110..S-115.
- **AC:** role-gated routes; PII masked-by-default + audited reveal; tables sortable/filterable + a11y. **Risks:** sensitive-data exposure. **Phase:** MVP.

### EPIC-13 · Admin Order Management — **MVP / P0**
- **Goal:** Ops view of all orders + detail + manual advance/hold + workflow controls.
- **Description:** Orders dashboard + order detail panels (summary/items/quote/payment/docs/inspection/journey/audit/agent recs); advance/hold; trigger/resume workflows; DLQ/stuck-run visibility.
- **Roles:** ops_manager, super_admin (+scoped). **Dependencies:** EPIC-12, EPIC-10, EPIC-19. **Stories:** S-120..S-126.
- **AC:** ops can run the full flow from the dashboard; actions audited; deep-linkable; replay/override elevated+audited. **Risks:** ops UX completeness. **Phase:** MVP.

### EPIC-14 · Risk Review Workflow — **MVP / P0**
- **Goal:** Every order human-reviewed; AI risk band + rationale; compliance approve/reject/hold.
- **Description:** Risk-review queue; RiskReviewCard (band/rationale/matched-rules/confidence); HumanApprovalModal (justification, SoD); W3/WF6; rules engine for prohibited/category.
- **Roles:** compliance_admin; Risk agent. **Dependencies:** EPIC-13, AI gateway, rules engine. **Stories:** S-130..S-136.
- **AC:** `order.under_review` for all (MVP); HIGH/BLOCK + decisions require approval; never auto-clear uncertain; `agent.review_completed` records override; rejection notified w/ reason. **Risks:** prohibited false-clear (critical). **Phase:** MVP.

### EPIC-15 · Package Receiving Workflow — **MVP / P0**
- **Goal:** El Paso Hub receipt → match to order → start inspection.
- **Description:** Receiving screen; scan/register (weight/dims/photos); match (agent assist; unmatched→staff task); `package.received`→inspection task (W8).
- **Roles:** ops_manager, inspector. **Dependencies:** EPIC-07, EPIC-10, workflow engine. **Stories:** S-140..S-144.
- **AC:** package registered + matched; `received_el_paso`; *Package received* notification; unmatched handled. **Risks:** Hub process maturity. **Phase:** MVP.

### EPIC-16 · Inspection Workflow — **MVP / P0**
- **Goal:** Structured inspection (checklist + photos + serial/seal) shown to customer.
- **Description:** Inspection Center (checklist, photo capture, serial OCR, seal); pass/flag; **fail → compliance HUMAN-APPROVAL**; customer Inspection Details view (trust chips). MVP = human checklist; vision Assistant = V1.
- **Roles:** inspector, compliance_admin, customer (view). **Dependencies:** EPIC-15, EPIC-07. **Stories:** S-150..S-156.
- **AC:** inspection captured; `inspection.passed/failed`; photos via signed URLs to customer; fail halts crossing + approval. **Risks:** OCR/photo quality. **Phase:** MVP (vision V1).

### EPIC-17 · Delivery Status Workflow — **MVP / P0**
- **Goal:** Crossing → arrived → out-for-delivery → delivered with proof; failed-delivery handling.
- **Description:** Manual ops crossing/customs updates; delivery task + driver POD; `delivered` on human-confirmed proof; failed → reschedule (≤N); border-doc approval gate (compliance).
- **Roles:** ops_manager, driver, compliance_admin, customer. **Dependencies:** EPIC-16, EPIC-10. **Stories:** S-160..S-166.
- **AC:** crossing/customs states update; border docs approved (HUMAN-APPROVAL); POD captured; *Out for delivery*/*Delivered* notified; failed handled. **Risks:** carrier/customs manual gaps `⚠️ VERIFY`. **Phase:** MVP.

### EPIC-18 · Notification System — **MVP / P0**
- **Goal:** Multi-channel EN/ES notifications for key events.
- **Description:** Notifications S4 integration; templates (14) EN/ES; channel select + fallback (WhatsApp→SMS→email); quiet hours; in-app center; idempotent per event; Notification Agent drafts (template-bound).
- **Roles:** customer, all (staff alerts). **Dependencies:** EPIC-01, Notifications S4, templates. **Stories:** S-170..S-175.
- **AC:** each key event notifies in customer's language; deep links; transactional bypass quiet hours; no double-send. **Risks:** WhatsApp approval lead time `⚠️ VERIFY`. **Phase:** MVP.

### EPIC-19 · Automation Platform Integration — **MVP / P0**
- **Goal:** Durable order workflow + event bus + tasks + approvals wired end-to-end.
- **Description:** Order engine as durable workflow (25 states = transitions); trigger router (event→workflow); approval nodes (HITL); task queues; saga compensation; idempotency; webhook ingestion.
- **Roles:** automation workflow, all staff (approvals/tasks). **Dependencies:** EPIC-01, Automation engine, contracts/03. **Stories:** S-180..S-187.
- **AC:** events emitted/consumed idempotently; approvals pause/resume durably; compensation rolls back side effects; unique active run per (def,order). **Risks:** engine choice/checkpointer `⚠️ VERIFY`. **Phase:** MVP.

### EPIC-20 · AI Agent Integration — **MVP (assist) / P0–P1**
- **Goal:** Intake, Risk, Quote agents running recommend-only via the AI gateway.
- **Description:** Agent runs as workflow steps via LangGraph Manager; AI gateway (authz/guardrails/cost/trace); tool registry (MVP subset); structured outputs + confidence; approval auto-insert; agent run/step logging; seed RAG (policies/FAQ).
- **Roles:** AI agent, compliance/finance (consume recs). **Dependencies:** EPIC-19, AI gateway, AI architecture (D4–D6,D11). **Stories:** S-190..S-196.
- **AC:** Intake flags missing info; Risk recommends band+rationale; Quote drafts; all `suggest` autonomy; no provider keys in app; cost metered; guardrails on. **Risks:** AI quality/cost; injection. **Phase:** MVP (assist) → V1 depth.

### EPIC-21 · Audit Logging — **MVP / P0**
- **Goal:** Immutable, hash-chained audit of customer/admin/agent sensitive actions.
- **Description:** Audit S7 integration; auto-emit on sensitive ops (status transitions, risk/quote/refund/border-doc decisions, PII reads, agent recs + human decisions, 403s); admin Audit views; export.
- **Roles:** all (subjects), compliance/super_admin (read). **Dependencies:** EPIC-03, Audit S7. **Stories:** S-200..S-203.
- **AC:** every mandatory action audited (contracts/05 §4); immutable + queryable by order/actor/trace; agent vs human distinguished. **Risks:** missed audit points. **Phase:** MVP.

### EPIC-22 · Analytics & Observability — **MVP (basic) / P1**
- **Goal:** Event capture + tracing + AI cost/quality + basic ops metrics.
- **Description:** PostHog events (funnel transitions); Sentry+OTel traces (workflow→agent→tool→model); AI cost ledger; basic ops/KPI capture (dashboards = V1); alerts (DLQ, stuck runs, override-rate).
- **Roles:** ops, leadership, AI. **Dependencies:** EPIC-19, EPIC-20. **Stories:** S-210..S-214.
- **AC:** funnel-stage timestamps captured; traces correlate by order_id; AI cost attributed; key alerts fire w/ runbook. **Risks:** PII in analytics (must minimize). **Phase:** MVP basic → V1 dashboards.

### EPIC-23 · Security Hardening — **MVP / P0**
- **Goal:** Least-privilege, encryption, secrets, guardrails, threat-model controls.
- **Description:** KMS field-encryption (PII/KYC/RFC/financial); secrets management; egress allowlist; rate limiting; prompt-injection + malicious-upload defenses; STRIDE cross-tenant tests; CI security gates (SAST/IaC/container/secret scan).
- **Roles:** super_admin, DevSecOps. **Dependencies:** EPIC-03, EPIC-07, EPIC-20. **Stories:** S-220..S-226.
- **AC:** restricted fields encrypted + decrypt permission-gated + audited; cross-tenant test fails closed; CI security gates green; injection/upload red-team pass. **Risks:** sensitive-data handling (high). **Phase:** MVP.

### EPIC-24 · QA / Testing — **MVP / P0**
- **Goal:** Test pyramid + e2e of the trust-critical path + edge cases.
- **Description:** Unit/integration (RLS)/e2e (Playwright)/contract (Zod/event)/payment/upload/auth-RBAC/workflow/AI-output/a11y/localization/security/regression; edge-case suite (D9); CI gating.
- **Roles:** QA, all eng. **Dependencies:** all build epics. **Stories:** S-230..S-238.
- **AC:** happy path + 15 edge cases (18) covered; RLS + RBAC + payment-failure + upload-failure + low-confidence + override + cancel + inspection-fail tested; CI blocks on regressions. **Risks:** coverage gaps. **Phase:** MVP.

### EPIC-25 · Deployment & Release — **MVP / P0**
- **Goal:** Repeatable dev/stage/prod deploys + release gates + pilot launch.
- **Description:** GitOps CI/CD (Vercel); env config/secrets; DB migration process; blue/green or preview→prod; rollback; runbooks/on-call; release readiness gate; pilot toggle.
- **Roles:** DevSecOps, ops, super_admin. **Dependencies:** EPIC-01, EPIC-23, EPIC-24. **Stories:** S-240..S-245.
- **AC:** one-command deploy per env; safe rollback; migrations reviewed; readiness checklist (D10) green; legal sign-off gating real orders. **Risks:** env drift; legal gate. **Phase:** MVP.

> **Epic phase summary:** EPIC-01..21, 23, 24, 25 = **MVP/P0**; EPIC-22 = MVP-basic→V1; AI/agent *depth* (Shopping/Inspection-vision/Journey/Support/Finance/Ops agents), self-serve breadth, and analytics dashboards = **V1** (fast-follow ≤60d). Marketplace/subscriptions/returns/B2B = **V2/Future**.

---

# DELIVERABLE 4 — User Stories

Representative build-ready stories covering **all 11 roles** and every MVP epic. Each story carries the full field set. Cross-cutting defaults (apply unless overridden): **Test** = unit + integration + e2e for the slice; **Security** = RBAC+RLS enforced, inputs Zod-validated; **Audit** = per `contracts/05 §4`. Format columns: **ID · Story · P · Phase · Est · Deps · Acceptance (key) · API · Data · Design · Analytics event · Audit / Security note.**

## 4.1 Customer stories

| ID | Story (As a customer, I want…) | P | Phase | Est | Deps | Key acceptance | API | Data | Design | Analytics event | Audit/Security |
|----|--------------------------------|---|-------|-----|------|----------------|-----|------|--------|-----------------|----------------|
| S-040 | …to choose EN/ES and create an account with my phone, so I can start quickly in my language | P0 | MVP | M | EPIC-03 | OTP verifies; locale persisted; lands Home | Identity signup/verify | CustomerProfile | Welcome, Language, Verify | `signup_started/completed` | `user.created` audited; OTP rate-limited |
| S-050 | …to submit a Buy-for-Me request in 3 steps, so BorderPass buys my item | P0 | MVP | L | EPIC-06,07 | Draft autosaves; validation gates submit | `POST /orders`, `/submit` | Order, OrderItem | New Request (Stitch) | `request_started/submitted` | `order.created/submitted` audited |
| S-051 | …to paste a product URL + details, so I don't fill everything manually | P0 | MVP | M | EPIC-20 | Extraction prefills; low-conf flagged; editable | product-extract (assist) | OrderItem draft | Product details | `product_extracted` | extraction source logged |
| S-060 | …to upload my receipt/invoice securely, so my order can proceed | P0 | MVP | M | Files S5 | Upload/retry/invalid states; signed URL | `POST /files/sign`, attach | Document | UploadBox | `document_uploaded` | `file.uploaded`; ACL-scoped |
| S-052 | …to enter border/compliance info (purpose, value, RFC), so customs is handled correctly | P0 | MVP | M | EPIC-06 | Required gates; RFC if business | draft update | Order border fields | Border info step | `border_info_completed` | restricted fields encrypted |
| S-070 | …to review a transparent itemized quote, so I trust the price before paying | P0 | MVP | M | EPIC-08 | Fees+duties itemized; duties labeled estimate; expiry | `GET /orders/{id}/quote` | Quote, QuoteLineItem | Quote review | `quote_viewed` | quote version recorded |
| S-071 | …to accept or decline the quote, so I control whether to proceed | P0 | MVP | S | EPIC-08 | Accept→payment; decline→cancel | `POST /quotes/{id}/accept` | Quote | Quote review | `quote_accepted/declined` | `quote.accepted` audited |
| S-080 | …to pay securely with my card and get a receipt, so my order is funded | P0 | MVP | L | EPIC-09 | Stripe pay; processing/success/fail; receipt | Payments intent + webhook | Payment | Payment, Success | `payment_succeeded/failed` | `payment.*`; no double-submit |
| S-090 | …to track my order on the Border Journey, so I always know where it is | P0 | MVP | L | EPIC-10 | Vertical timeline; states; ETA; tracking id | `GET /orders/{id}/journey` | Journey projection | Border Journey (Stitch) | `journey_viewed` | per-stage transition audited |
| S-150c | …to see inspection photos + serial/seal, so I trust the contents | P0 | MVP | M | EPIC-16 | Photos via signed URLs; trust chips | `GET /orders/{id}/inspection` | Inspection, Photo | Inspection details | `inspection_viewed` | photo reads access-controlled |
| S-100 | …to message a human concierge (in-app/WhatsApp), so I get help fast | P0 | MVP | M | EPIC-11 | Thread works in-app + WhatsApp | `GET/POST /messages` | SupportMessage | Concierge chat | `concierge_message_sent` | thread audited |
| S-161 | …to see delivery confirmed with proof, so I know I received it | P0 | MVP | S | EPIC-17 | POD shown; delivered state | `GET /orders/{id}/delivery` | Delivery | Delivery confirmation | `delivery_confirmed` | `delivery.completed` audited |
| S-205 | …to request a refund/cancel, so I'm protected if something's wrong | P0 | MVP | M | EPIC-14/17 | Request→finance approval; clear status | `POST /refunds` | Refund | Order details | `refund_requested` | `refund.requested`; SoD |

## 4.2 Concierge / Support stories

| ID | Story | P | Phase | Est | Deps | Key acceptance | API | Data | Design | Analytics | Audit/Security |
|----|-------|---|-------|-----|------|----------------|-----|------|--------|-----------|----------------|
| S-101 | As a **concierge**, I want a unified workspace with order context + AI-draft replies, so I respond fast and accurately | P0 | MVP | L | EPIC-11,20 | Thread + context; AI draft; **human-send** | Concierge Workspace APIs | SupportMessage, Order | Concierge Workspace | `concierge_reply_sent` | PII reads audited; sensitive human-sent |
| S-102 | As a **support_agent**, I want to escalate to specialists, so refunds/compliance go to the right role | P1 | MVP | M | EPIC-11 | Escalate routes by category | escalation API | Ticket(min) | Support | `support_escalated` | `support.escalated` audited |

## 4.3 Inspector stories

| ID | Story | P | Phase | Est | Deps | Key acceptance | API | Data | Design | Analytics | Audit/Security |
|----|-------|---|-------|-----|------|----------------|-----|------|--------|-----------|----------------|
| S-150 | As an **inspector**, I want a checklist + photo/serial/seal capture, so inspection is consistent and proven | P0 | MVP | L | EPIC-16 | Checklist+photos+OCR; pass/flag | `POST /inspections/{id}` | Inspection, Photo | Inspection Center | `inspection_submitted` | outcome audited |
| S-151 | As an **inspector**, I want to flag discrepancies for compliance, so fails are resolved by authority | P0 | MVP | M | EPIC-16 | Flag→`inspection_failed`→approval | inspection submit | Inspection flags | Inspection Center | `inspection_flagged` | fail audited; HUMAN-APPROVAL |
| S-140 | As an **inspector/ops**, I want to receive + match inbound packages, so they enter the pipeline | P0 | MVP | M | EPIC-15 | Register+match; unmatched task | `POST /packages` | Package | Receiving | `package_received` | match audited |

## 4.4 Driver stories

| ID | Story | P | Phase | Est | Deps | Key acceptance | API | Data | Design | Analytics | Audit/Security |
|----|-------|---|-------|-----|------|----------------|-----|------|--------|-----------|----------------|
| S-160 | As a **driver**, I want my assigned deliveries + addresses, so I can deliver efficiently | P0 | MVP | M | EPIC-17 | Only assigned tasks (RLS); addresses | `GET /admin/deliveries?driver=me` | Delivery | Driver view (mobile) | `delivery_started` | RLS scope to self |
| S-162 | As a **driver**, I want to capture proof of delivery, so completion is verified | P0 | MVP | S | EPIC-17 | POD photo/sig → `delivered` | `POST /deliveries/{id}/proof` | Delivery, Proof | Driver view | `delivery_completed` | `delivery.completed` audited |
| S-163 | As a **driver**, I want to report a failed attempt, so it reschedules | P0 | MVP | S | EPIC-17 | Failed→reschedule(≤N) | proof/fail API | Delivery attempts | Driver view | `delivery_failed` | attempts audited |

## 4.5 Operations manager stories

| ID | Story | P | Phase | Est | Deps | Key acceptance | API | Data | Design | Analytics | Audit/Security |
|----|-------|---|-------|-----|------|----------------|-----|------|--------|-----------|----------------|
| S-120 | As an **operations_manager**, I want a dashboard of all orders by stage with SLA timers, so I can run operations | P0 | MVP | L | EPIC-13 | Live queues; filters; alerts | `GET /admin/orders` | Order summaries | Ops dashboard | `admin_dashboard_viewed` | actions audited |
| S-121 | As an **operations_manager**, I want to assign inspectors/drivers + advance/hold orders, so work flows | P0 | MVP | M | EPIC-13,17 | Assign/advance/hold; reversible | task/assign APIs | Task, Order | Dispatch/Orders | `order_advanced` | elevated actions audited |
| S-122 | As an **operations_manager**, I want to update crossing/customs status manually, so tracking stays accurate (MVP) | P0 | MVP | M | EPIC-17 | Manual status updates emit events | status update API | Order status | Order detail | `crossing_updated` | transition audited |

## 4.6 Finance admin stories

| ID | Story | P | Phase | Est | Deps | Key acceptance | API | Data | Design | Analytics | Audit/Security |
|----|-------|---|-------|-----|------|----------------|-----|------|--------|-----------|----------------|
| S-072 | As a **finance_admin**, I want to review + approve/modify/send every quote, so pricing+duties are correct | P0 | MVP | M | EPIC-08 | Approve/modify/send; all in MVP | quote approve API | Quote | Quote Builder | `quote_approved` | `quote.created/sent`; SoD |
| S-206 | As a **finance_admin**, I want to approve refunds with justification, so money-out is controlled | P0 | MVP | M | EPIC-14 | Approve→idempotent Stripe refund | `POST /runs/{id}/signal` | Refund, ledger | Finance/Refunds | `refund_processed` | `refund.processed`; SoD; never double |
| S-081 | As a **finance_admin**, I want to see payment reconciliation + disputes, so the ledger is trustworthy | P1 | MVP | M | EPIC-09 | Payments list; mismatch flags | `GET /admin/finance` | Payment, ledger | Finance dashboard | `reconciliation_viewed` | financial reads audited |

## 4.7 Compliance admin stories

| ID | Story | P | Phase | Est | Deps | Key acceptance | API | Data | Design | Analytics | Audit/Security |
|----|-------|---|-------|-----|------|----------------|-----|------|--------|-----------|----------------|
| S-130 | As a **compliance_admin**, I want a risk-review queue with AI band+rationale+confidence, so I decide accurately | P0 | MVP | L | EPIC-14 | Queue; band+rules+confidence shown | `GET /admin/risk`, `/agent-runs/{id}` | RiskReview, AgentRun | Risk dashboard | `risk_review_opened` | decision + rationale audited |
| S-131 | As a **compliance_admin**, I want to approve/reject/hold orders with justification, so prohibited items never pass | P0 | MVP | M | EPIC-14 | Decision req justification; never auto-clear | `POST /runs/{id}/signal` | Order, RiskReview | HumanApprovalModal | `risk_decided` | `order.risk_assessed/rejected`; SoD |
| S-164 | As a **compliance_admin**, I want to approve border documents, so customs submission is legally correct | P0 | MVP | M | EPIC-17 | Docs approved before crossing | borderdocs approve | Document | Order detail | `borderdocs_approved` | `border_documentation_ready` audited |
| S-152 | As a **compliance_admin**, I want to resolve inspection failures, so wrong/damaged/prohibited goods are handled | P0 | MVP | M | EPIC-16 | Fail resolution (refund/return/replace) | resolution API | Inspection, Refund | Inspection (compliance) | `inspection_resolved` | resolution audited |

## 4.8 Super admin stories

| ID | Story | P | Phase | Est | Deps | Key acceptance | API | Data | Design | Analytics | Audit/Security |
|----|-------|---|-------|-----|------|----------------|-----|------|--------|-----------|----------------|
| S-110 | As a **super_admin**, I want role/permission + business-rule + flag config, so I can govern the system | P0 | MVP | L | EPIC-03,12 | Config gated + audited; SoD preserved | settings APIs | Roles, Rules, Flags | Admin Settings | `settings_changed` | elevated + audited |
| S-200a | As a **super_admin**, I want immutable audit views + export, so we can defend decisions | P0 | MVP | M | EPIC-21 | Query by order/actor/trace; export | `GET /audit` | AuditLog | Audit Logs | `audit_viewed` | read-only; access audited |

## 4.9 AI agent & automation workflow stories

| ID | Story | P | Phase | Est | Deps | Key acceptance | API | Data | Design | Analytics | Audit/Security |
|----|-------|---|-------|-----|------|----------------|-----|------|--------|-----------|----------------|
| S-190 | As an **AI agent (Intake)**, I want to validate intake + flag missing info, so orders are complete before review | P0 | MVP | M | EPIC-20 | Flags gaps; routes W2; recommend-only | agent run (gateway) | Order, AgentRun | — | `agent_run` | run/step logged; `suggest` autonomy |
| S-191 | As an **AI agent (Risk)**, I want to recommend a risk band+rationale, so compliance decides faster | P0 | MVP | M | EPIC-20 | Band+rules+confidence; never decides | agent run | RiskReview, AgentRun | — | `agent_run` | recommendation audited; HUMAN-APPROVAL |
| S-192 | As an **AI agent (Quote)**, I want to draft an itemized quote+duty estimate, so finance reviews faster | P0 | MVP | M | EPIC-20 | Draft only; duties labeled estimate | agent run | Quote draft, AgentRun | — | `agent_run` | draft audited; finance approves |
| S-180 | As an **automation workflow**, I want to drive the 25-status order lifecycle durably, so the order never stalls or double-acts | P0 | MVP | XL | EPIC-19 | Durable; idempotent; compensating; resumes | workflow engine | WorkflowRun | — | `workflow.run.*` | every transition audited |
| S-181 | As an **automation workflow**, I want to pause at approval nodes and resume on decision, so human gates are enforced | P0 | MVP | L | EPIC-19 | Pause/resume; SLA timeout→escalate | `/runs/{id}/signal` | Approval | HumanApprovalModal | `approval_*` | approval history immutable |
| S-182 | As an **automation workflow**, I want idempotent webhook + saga compensation, so money is never inconsistent | P0 | MVP | L | EPIC-09,19 | Dedupe by event id; rollback on fail | webhook handler | Payment, Refund | — | `workflow.compensation.*` | compensation audited |

> Full backlog will expand each epic's stories (D3 lists per-epic ID ranges); the above is the **P0 build-critical set** spanning all roles. V1 stories (agent depth, self-serve, dashboards) are enumerated in the V1 roadmap (D6.2).

---

# DELIVERABLE 5 — Build Sequence

Recommended dependency-ordered implementation. Per stage: **Why next · Required inputs · Output/done state · Blocking deps · Validation checklist.**

| # | Stage | Why next | Required inputs | Output / done state | Blocking deps | Validation |
|---|-------|----------|-----------------|---------------------|---------------|-----------|
| 1 | Repo & environment setup | Nothing builds without it | Repo access, platform accounts | App boots dev/stage/prod; CI green | Platform MVP | CI runs lint/type/test/IaC; envs reachable |
| 2 | Database / project foundation | Schema underpins all features | contracts/01 data model | Tables + RLS scaffolding + migrations process | #1 | migrations apply; RLS default-deny |
| 3 | Auth & RBAC | Everything is gated by identity+tenant | Identity S1, contracts/05 | OTP auth; roles; RLS; MFA | #1,#2 | cross-tenant test fails closed; 403 audited |
| 4 | Design system / tokens | UI needs the theme first | Frontend Handoff D3, Stitch | Tokens + base components + Storybook | #1 | tokens match handoff; axe clean |
| 5 | App shell & routing | Container for all screens | EPIC-04 | Customer shell + nav + i18n | #3,#4 | nav a11y; EN/ES switch; guards |
| 6 | Customer onboarding | First user-facing slice | EPIC-05 | Welcome→Home in EN/ES | #5 | new user reaches Home; `user.created` |
| 7 | New request flow | Core value entry | EPIC-06, order model | 3-step request → `submitted` | #2,#5,#6 | draft autosave; submit gates; events |
| 8 | Document upload | Required by request + inspection | Files S5 | Signed-URL upload integrated | #2 | upload/retry/invalid; ACL; scan |
| 9 | Admin order dashboard | Ops must see orders to run them | EPIC-12,13 | Orders list + detail + RBAC | #3,#7 | role-gated; PII masked; audited |
| 10 | Order review workflow | Every order human-reviewed (MVP) | EPIC-14,19,20 | Risk queue + approval gate | #9,#19,#20 | never auto-clear; rejection notified+audited |
| 11 | Quote creation | After risk cleared | EPIC-08 | AI-draft + finance approval | #10 | itemized; finance approves all; events |
| 12 | Stripe checkout | Fund the order | EPIC-09 | Pay + receipt + webhooks | #11 | idempotent; fail→dunning; receipt |
| 13 | Order status tracking | State machine drives everything downstream | EPIC-10,19 | Durable 25-status engine | #7,#19 | transitions emit event+audit+notify |
| 14 | Border Journey timeline | Customer trust surface | EPIC-10, Stitch | Vertical journey view | #13 | accessible timeline; live update |
| 15 | Package receiving | Hub entry to fulfilment | EPIC-15 | Receive+match→inspection task | #8,#13 | matched; `received_el_paso`; notify |
| 16 | Inspection workflow | Proof = trust | EPIC-16 | Checklist+photos+serial/seal; fail gate | #15 | photos to customer; fail→approval |
| 17 | Notifications | Customer informed at each stage | EPIC-18 | Multi-channel EN/ES key events | #6,#13 | language honored; deep links; no double |
| 18 | Audit logging | Compliance/dispute defense | EPIC-21 | Immutable trail of sensitive ops | #3 | mandatory actions audited; queryable |
| 19 | Automation workflow hooks | Wires events↔workflows↔tasks↔approvals | EPIC-19 | Trigger router + tasks + approvals + saga | #2,#13 | idempotent; compensate; resume |
| 20 | AI-assisted workflows | Intake/Risk/Quote recommend-only | EPIC-20 | Agents via gateway; structured outputs | #19 | recommend-only; cost metered; guardrails |
| 21 | Observability | See/operate the system | EPIC-22 | Events + traces + AI cost + alerts | #19,#20 | funnel captured; traces correlate; alerts |
| 22 | QA | Prove the path + edge cases | EPIC-24 | Test pyramid + edge-case suite | all | happy path + 15 edge cases pass; CI gates |
| 23 | Production deployment | Ship the pilot | EPIC-25, D10 | Repeatable deploy + rollback + readiness | #22, legal | readiness green; **legal sign-off gates real orders** |

---

# DELIVERABLE 6 — Sprint Plan

Five 1-week sprints to MVP (Sprint 0–4). Pod: ~3–5 full-stack eng + 1 designer + ops/compliance partners. **Legal/customs review runs in parallel from Sprint 0 and gates go-live.**

## 6.1 Sprint 0 — Project setup & architecture lock
- **Goal:** Repo, envs, CI/CD, platform SDK wiring, data model + contracts locked, design tokens started, **legal review kicked off**.
- **Epics:** 01, 02 (start), 03 (start), 19 (scaffold). **Stories:** S-001..006, S-010..012, S-020..021.
- **Deliverables:** booting app in 3 envs; CI with security gates; migrations process; token theme skeleton; signed-off data model/contracts; legal engagement started.
- **Dependencies:** Platform/Automation MVP; service accounts; Stripe/WhatsApp/Resend/Twilio access requested. **Risks:** platform readiness; WhatsApp lead time (start now).
- **Demo:** CI pipeline green; app boots; SDK health call. **Exit:** envs reachable; contracts locked; tokens approved; legal in progress.

## 6.2 Sprint 1 — Core app foundation
- **Goal:** Auth+RBAC+RLS, design system, app shell, onboarding, document upload.
- **Epics:** 02, 03, 04, 05, 07, 21 (start). **Stories:** S-013..016, S-022..027, S-030..034, S-040..044, S-060..063, S-200a (scaffold).
- **Deliverables:** phone-OTP onboarding EN/ES → Home; RBAC+RLS enforced; base components in Storybook; secure upload.
- **Dependencies:** Sprint 0; Identity, Files. **Risks:** RLS gaps; OTP deliverability.
- **Demo:** new user onboards in EN/ES; uploads a receipt; unauthorized blocked. **Exit:** cross-tenant test fails closed; onboarding e2e green.

## 6.3 Sprint 2 — Customer order flow & admin review
- **Goal:** New Request flow, order model + durable workflow, admin dashboard, risk review + AI assist, quote.
- **Epics:** 06, 10 (engine), 12, 13, 14, 19, 20 (Intake/Risk/Quote). **Stories:** S-050..058, S-090 (engine), S-110, S-120..122, S-130..136, S-180..182, S-190..192, S-070..072.
- **Deliverables:** customer submits request → durable workflow → admin risk queue (AI band) → compliance decision → quote draft → finance approval.
- **Dependencies:** Sprint 1; AI gateway; rules engine; workflow engine. **Risks:** prohibited false-clear; workflow complexity.
- **Demo:** end-to-end intake→risk→quote with human approvals on the admin dashboard. **Exit:** every order human-reviewed; never auto-clears; quote human-approved; all audited.

## 6.4 Sprint 3 — Payments, tracking, inspection, notifications
- **Goal:** Stripe payment, Border Journey, package receiving + inspection, notifications, concierge.
- **Epics:** 08(finish), 09, 10 (journey UI), 11, 15, 16, 17, 18. **Stories:** S-080..086, S-090..096, S-100..104, S-140..144, S-150..156, S-160..166, S-170..175.
- **Deliverables:** pay via Stripe → track Border Journey → hub receive + inspect (photos/serial/seal) → delivery proof; notifications EN/ES at each stage; concierge chat.
- **Dependencies:** Sprint 2; Stripe, Notifications, Hub staff. **Risks:** payment correctness; WhatsApp approval; Hub maturity.
- **Demo:** full order paid → inspected with photos → delivered with proof → customer notified throughout. **Exit:** idempotent payments; journey live; inspection proof shown; key notifications deliver.

## 6.5 Sprint 4 — QA, hardening, deployment, pilot launch
- **Goal:** Edge cases, security hardening, observability, deploy, readiness gate, pilot.
- **Epics:** 21(finish), 22, 23, 24, 25. **Stories:** S-200..203, S-210..214, S-220..226, S-230..238, S-240..245, S-205/206 (refund/cancel).
- **Deliverables:** 15 edge cases handled; refund/cancel; security gates green; observability + alerts; repeatable deploy + rollback; readiness checklist green.
- **Dependencies:** Sprints 1–3; **legal sign-off**; pilot ops staffing. **Risks:** coverage gaps; legal gate; capacity.
- **Demo:** full happy path + key edge cases (payment fail, prohibited item, inspection fail, refund, low-confidence AI) on stage. **Exit:** D10 readiness green; legal cleared for live categories; pilot toggle ready.

## 6.6 60-day V1 roadmap
Agent depth (Shopping URL-resolve, automated duty estimate human-confirmed, Inspection Assistant vision/OCR, Border Journey Agent ETA/narration/delay, Support Agent triage, Finance Agent reconcile+refund-eligibility, Ops Coordinator assignment); self-serve (reorder, saved payment methods, BorderPass RFC invoices, notification prefs depth, push notifications); workflows (quote-expiry reminders, delay notifications, failed-delivery, refund workflow, support tickets); services (full Business/freight, Local Pickup); admin/analytics (Finance/Compliance/Support/Analytics dashboards, rules-engine config UI); raise automation rate (auto-approve low-risk reversible, humans keep risky gates). **Gate V1→Pilot:** agents pass evals+guardrails; analytics live; refund/dispute reliable; pilot capacity.

## 6.7 90-day pilot roadmap
Limited public launch (waitlist/invite) to target personas; operational hardening (capacity, SLAs, on-call, DR/runbooks, fraud rules, abandonment); marketing+trust content (EN/ES); full KPI dashboards + weekly/monthly reviews + guardrail alerts; structured feedback loop iterating the weakest funnel stage + top edge cases. **Targets:** activation ≥40%, payment conversion ≥85%, delivery success ≥95%, CSAT ≥4.5, repeat purchase ≥30%, positive contribution margin, AI override/error trending down.

## 6.8 Post-pilot roadmap
Scale automation autonomy (graduated trust tiers); loyalty/VIP; product-spec V2/V3 (full AI Shopping Assistant, Business Procurement, Marketplace, Subscriptions, US-returns); new corridors/cities; deeper carrier/customs/broker integrations; continuous trust + AI cost/quality optimization.

---

# DELIVERABLE 7 — Technical Task List

Grouped by discipline. Each task: **Name · Description · Owner type · Dependency · Estimate · Acceptance · Test requirement.** Owner types: FE, BE, DB, DevSecOps, QA, AI, Design.

## 7.1 Frontend (FE)
| Task | Description | Owner | Dep | Est | Acceptance | Test |
|------|-------------|-------|-----|-----|------------|------|
| FE-01 Theme + tokens | Tailwind theme + CSS vars from D3; self-host fonts | FE/Design | EPIC-02 | M | tokens match handoff; fonts self-hosted | visual + token snapshot |
| FE-02 Base components | Button/Input/Card/Badge/Modal/Sheet/Toast/Skeleton + states | FE | FE-01 | L | all D8 states; axe clean | Storybook + a11y |
| FE-03 App shell + nav | Customer shell, bottom nav, i18n provider, safe-area | FE | EPIC-04 | M | `aria-current`; EN/ES live | e2e nav |
| FE-04 Onboarding screens | Welcome/Language/Signup/OTP | FE | EPIC-05 | M | reaches Home EN/ES | e2e onboarding |
| FE-05 New Request flow | Stepper + product + border + summary | FE | EPIC-06 | L | autosave; validation | e2e + unit validation |
| FE-06 UploadBox | 6 states + signed-URL client | FE | EPIC-07 | M | retry/invalid handled | unit + e2e |
| FE-07 Quote + Payment | Quote review + Stripe element + success | FE | EPIC-08,09 | L | no double-submit; states | e2e payment |
| FE-08 Border Journey | Vertical timeline + states + ETA | FE | EPIC-10 | L | accessible timeline | a11y + e2e |
| FE-09 Inspection details | Photo grid + trust chips | FE | EPIC-16 | M | signed-URL photos | e2e |
| FE-10 Concierge chat | Thread + composer + WhatsApp link | FE | EPIC-11 | M | optimistic send | e2e |
| FE-11 Admin shell + tables | Sidebar + AdminDataTable + kanban | FE | EPIC-12 | L | sort/filter/search; masking | a11y + e2e |
| FE-12 Approval modals | HumanApprovalModal (justification, SoD) | FE | EPIC-14 | M | required notes; focus-trap | a11y + e2e |

## 7.2 Backend / BFF (BE)
| Task | Description | Owner | Dep | Est | Acceptance | Test |
|------|-------------|-------|-----|-----|------------|------|
| BE-01 BFF seam | Server actions + route handlers; tenant context; Zod; idempotency; audit auto-emit | BE | EPIC-01,03 | L | tenant set from token only; inputs validated | integration |
| BE-02 Order domain | Orders/items/quote/inspection service fns | BE | DB-01 | L | state transitions valid | unit + integration |
| BE-03 Webhook handlers | Stripe/Twilio/Resend verify→normalize→event | BE | EPIC-09,18 | M | signature verified; deduped | contract + integration |
| BE-04 SDK wrappers | Thin wrappers over `@maralito/sdk` | BE | EPIC-01 | M | no provider keys in app | unit |
| BE-05 RAG seed | Ingest policies/FAQ to pgvector (ACL-tagged) | BE/AI | EPIC-20 | M | ACL-filtered retrieval | integration |

## 7.3 Database (DB)
| Task | Description | Owner | Dep | Est | Acceptance | Test |
|------|-------------|-------|-----|-----|------------|------|
| DB-01 Schema | Drizzle schema from contracts/01 | DB | contracts | L | matches contract; FKs | migration test |
| DB-02 RLS policies | org_id (+owner) RLS on every table | DB/DevSecOps | DB-01,EPIC-03 | M | cross-tenant denied | RLS isolation test |
| DB-03 Field encryption | KMS encrypt PII/KYC/RFC/financial | DB/DevSecOps | DB-01 | M | decrypt permission-gated+audited | security test |
| DB-04 Migrations process | Reviewed, reversible migrations | DB | DB-01 | S | apply+rollback clean | CI migration |

## 7.4 API (contract)
| Task | Description | Owner | Dep | Est | Acceptance | Test |
|------|-------------|-------|-----|-----|------------|------|
| API-01 Order endpoints | create/submit/get/list per contracts/02 | BE | DB-01 | M | matches contract | contract test |
| API-02 Quote/payment | quote get/accept; payment intent | BE | EPIC-08,09 | M | matches contract | contract + payment |
| API-03 Event schemas | Zod event producers/consumers (contracts/03) | BE | EPIC-19 | M | envelope valid; versioned | schema test |
| API-04 Gap endpoints | journey projection, KB search, notifications, threads, reorder (confirm vs contracts) | BE | — | M | resolved, not invented | contract test |

## 7.5 Auth
| Task | Description | Owner | Dep | Est | Acceptance | Test |
|------|-------------|-------|-----|-----|------------|------|
| AUTH-01 OTP flow | signup/login/verify via Identity | BE/FE | EPIC-03 | M | OTP works; rate-limited | e2e |
| AUTH-02 RBAC | `can(role,action,ctx)` central policy | BE | EPIC-03 | M | unauthorized→not_found | RBAC test |
| AUTH-03 MFA + elevation | MFA admin/finance/compliance; elevation rules | BE/DevSecOps | AUTH-02 | M | enforced+audited | security test |

## 7.6 Storage
| Task | Description | Owner | Dep | Est | Acceptance | Test |
|------|-------------|-------|-----|-----|------------|------|
| ST-01 Signed-URL upload | mint after permission check; ACL objects | BE | EPIC-07 | M | expiring URLs; ACL | integration |
| ST-02 File scan | type/size validate + malware scan | DevSecOps | ST-01 | M | malicious rejected | security test `⚠️ VERIFY` scanner |

## 7.7 Payment
| Task | Description | Owner | Dep | Est | Acceptance | Test |
|------|-------------|-------|-----|-----|------------|------|
| PAY-01 Intent + checkout | Payments S3 intent; "Approve & Pay Duties" | BE/FE | EPIC-09 | M | advances `paid` | payment test |
| PAY-02 Idempotent webhook | dedupe Stripe event id; reconcile | BE | PAY-01 | M | no double-apply | idempotency test |
| PAY-03 Refund execution | finance-approved, idempotent | BE | EPIC-14 | M | never double-refund; saga | refund test |

## 7.8 Notification
| Task | Description | Owner | Dep | Est | Acceptance | Test |
|------|-------------|-------|-----|-----|------------|------|
| NOT-01 Template integration | EN/ES templates (14); channel select+fallback | BE | EPIC-18 | M | language honored; deep links | integration |
| NOT-02 Quiet hours + idempotency | transactional bypass; no double-send | BE | NOT-01 | S | per-event idempotent | unit |
| NOT-03 WhatsApp templates | pre-approval + opt-in | Ops/BE | NOT-01 | M | approved templates only | manual `⚠️ VERIFY` |

## 7.9 Automation
| Task | Description | Owner | Dep | Est | Acceptance | Test |
|------|-------------|-------|-----|-----|------------|------|
| AUTO-01 Order workflow | 25-status durable workflow | BE | EPIC-19 | XL | durable; resumable | workflow test |
| AUTO-02 Trigger router | event→workflow subscriptions | BE | AUTO-01 | M | correct routing | integration |
| AUTO-03 Approval nodes | pause/resume; SLA timeout→escalate | BE | AUTO-01 | L | gates enforced | workflow test |
| AUTO-04 Saga compensation | reverse side effects on failure | BE | AUTO-01 | L | money consistent | chaos test |

## 7.10 AI
| Task | Description | Owner | Dep | Est | Acceptance | Test |
|------|-------------|-------|-----|-----|------------|------|
| AI-01 Gateway integration | all model calls via gateway | AI/BE | EPIC-20 | M | no direct provider; metered | integration |
| AI-02 Manager + agents | LangGraph Manager + Intake/Risk/Quote nodes | AI | AI-01 | L | recommend-only; structured output | AI-output test |
| AI-03 Tool registry (MVP) | scoped tools subset | AI | AI-02 | M | scope+permission enforced | unit |
| AI-04 Guardrails + evals | injection/PII/schema; golden sets | AI | AI-02 | L | red-team pass; eval gate | eval + red-team |

## 7.11 Admin
| Task | Description | Owner | Dep | Est | Acceptance | Test |
|------|-------------|-------|-----|-----|------------|------|
| ADM-01 Order management | dashboard + detail + advance/hold | FE/BE | EPIC-13 | L | run full flow; audited | e2e |
| ADM-02 Risk queue | RiskReviewCard + agent rec display | FE/BE | EPIC-14 | L | band+confidence shown | e2e |
| ADM-03 Inspection center | checklist+photos+serial/seal | FE/BE | EPIC-16 | L | capture+pass/flag | e2e |
| ADM-04 Masking + reveal | PII masked; audited reveal | FE/BE | EPIC-12 | M | reveal audited | security test |

## 7.12 DevSecOps
| Task | Description | Owner | Dep | Est | Acceptance | Test |
|------|-------------|-------|-----|-----|------------|------|
| DSO-01 CI/CD | lint/type/test + SAST/IaC/container/secret scan + deploy | DevSecOps | EPIC-01 | L | gates block on fail | pipeline test |
| DSO-02 Envs + secrets | dev/stage/prod; secret manager | DevSecOps | EPIC-01 | M | no secrets in code | config test |
| DSO-03 Observability | Sentry+OTel+PostHog+AI cost ledger | DevSecOps | EPIC-22 | M | traces correlate; alerts | smoke |
| DSO-04 Rollback + runbooks | safe rollback; on-call runbooks | DevSecOps | DSO-01 | M | rollback works | DR drill |

## 7.13 QA
| Task | Description | Owner | Dep | Est | Acceptance | Test |
|------|-------------|-------|-----|-----|------------|------|
| QA-01 Test pyramid | unit/integration/e2e harness | QA | EPIC-24 | L | runs in CI | meta |
| QA-02 Edge-case suite | 15 cases (18) automated where feasible | QA | all | L | each case covered | e2e |
| QA-03 A11y + i18n | axe + pseudo-loc + SR passes | QA | EPIC-02 | M | WCAG AA; no hardcoded text | a11y/i18n |
| QA-04 Security/RBAC | RLS + RBAC + injection + upload | QA/DevSecOps | EPIC-23 | M | fail-closed | security |

---

# DELIVERABLE 8 — Acceptance Criteria Matrix

| Area | Acceptance criteria (must all pass) |
|------|--------------------------------------|
| **Auth** | Phone OTP signup/login/verify; session→org_id; unauthorized→not_found; MFA for admin/finance/compliance; 403s audited; OTP rate-limited. |
| **Customer onboarding** | EN/ES selectable + persisted; new user reaches Home; `user.created` + *Account created*; profile initialized. |
| **New request** | 3-step Buy-for-Me/Package-Reception; draft autosave; validation gates submit; `order.created`→`submitted`; missing-info→W2. |
| **Document upload** | Signed-URL upload; 6 states; type/size validation + scan; ACL-scoped; `file.uploaded`; malicious rejected. |
| **Quote review** | Itemized (service+item+duties); duties labeled estimate; **finance approves all (MVP)**; expiry; `quote.created/sent/accepted`. |
| **Payment** | Stripe pay→`paid`; idempotent webhook (dedupe event id); fail→retry/dunning; never proceed unpaid; receipt; no double-charge. |
| **Order tracking** | 25-status durable machine; each transition emits event+audit+notification; forward-only except defined back-transitions; money gates respected. |
| **Border Journey** | Vertical timeline; node states (completed/current/pending/delayed/failed); ETA + tracking id; View Photos; accessible ordered list. |
| **Admin dashboard** | Role-gated routes/nav/actions; PII masked-by-default + audited reveal; tables sort/filter/search; alerts+runbooks; actions audited. |
| **Risk review** | Every order under_review (MVP); AI band+rationale+confidence shown; HIGH/BLOCK+decisions HUMAN-APPROVAL; never auto-clear; rejection notified+audited; `agent.review_completed` records override; SoD. |
| **Inspection** | Checklist+photos+serial/seal; pass/flag; fail→compliance HUMAN-APPROVAL halts crossing; photos to customer via signed URLs; outcome audited. |
| **Notifications** | Each key event notifies in customer language; channel select+fallback; transactional bypass quiet hours; deep links; idempotent (no double-send). |
| **Audit logs** | Every mandatory action (contracts/05 §4) audited; immutable + hash-chained; queryable by order/actor/trace; agent vs human distinguished; PII reads logged. |
| **AI recommendations** | Recommend-only (`suggest`); structured output + confidence + explanation; no provider keys in app; cost metered; guardrails on; low-confidence→escalate; no auto-act on risky. |
| **Automation workflows** | Durable; idempotent (event id); approval nodes pause/resume; SLA timeout→escalate; saga compensation reverses side effects; unique active run per (def,order). |
| **Security** | Restricted fields KMS-encrypted + permission-gated decrypt + audited; cross-tenant test fails closed; CI security gates green; injection/upload red-team pass; least-privilege tools. |
| **Accessibility** | WCAG AA; keyboard operable; SR labels; focus management; reduced-motion; contrast verified per token; accessible timeline + modals. |
| **Localization** | EN/ES parity; no hardcoded user-facing strings; ES +20–25% handled; currency/date/address/phone formatted per locale; notification language honored. |
| **Mobile responsiveness** | Correct at 360/390/430px; safe-area; sticky CTA/nav; ≥48px targets; no horizontal scroll; landscape usable. |
| **Deployment** | Repeatable dev/stage/prod deploy; reviewed/reversible migrations; safe rollback; readiness checklist green; **legal sign-off gates real orders**. |

---

# DELIVERABLE 9 — Testing Plan

## 9.1 Test types & scope
| Type | Scope / tooling |
|------|-----------------|
| **Unit** | Domain logic, validation (shared Zod), pure fns, components (Vitest/RTL). |
| **Integration** | BFF↔SDK↔DB with **RLS** enforced; webhook normalize; workflow steps. |
| **End-to-end** | Trust-critical path (Playwright): onboard→request→quote→pay→journey→inspection→delivery. |
| **API contract** | Endpoints + event envelopes vs `contracts/02,03` (schema/contract tests). |
| **Payment** | Stripe test mode: success/decline/3DS/webhook idempotency/refund. |
| **Upload** | Signed-URL flow; type/size/invalid; malware-scan reject; ACL. |
| **Auth/RBAC** | OTP; role gating; **RLS cross-tenant fail-closed**; MFA; elevation. |
| **Workflow** | Durability, resume-after-approval, idempotency, saga compensation (chaos/restart). |
| **AI output** | Golden sets per agent; schema conformance; confidence calibration; **prohibited false-clear = 0**; red-team (injection/jailbreak/PII/cross-tenant/act-without-approval). |
| **Accessibility** | axe-core CI + manual SR (VoiceOver/TalkBack) + keyboard-only on key flows. |
| **Localization** | Pseudo-loc CI (catch hardcoded/clipping); EN/ES parity; format checks. |
| **Mobile UX** | Device matrix (360/390/430 + tablet); safe-area; touch targets; landscape. |
| **Security** | SAST/IaC/container/secret scans; injection; upload; STRIDE cross-tenant; pen-test pre-pilot `⚠️ VERIFY`. |
| **Regression** | Full suite in CI on every change; eval-gate for AI/prompt changes; visual regression for design fidelity. |

## 9.2 Required test cases
| Category | Cases |
|----------|-------|
| **Happy paths** | Buy-for-Me + Package-Reception end-to-end (submit→delivered); EN and ES; notifications at each stage. |
| **Edge cases (18)** | Prohibited item; missing receipt; wrong item; damaged; lost; payment fail; refund; customer unreachable; border delay; bad address; failed delivery; inspection fail; AI low-confidence; duplicate order; fraud suspicion. |
| **Failure cases** | Provider outage (gateway fallback); workflow step failure→compensation; webhook retry; notification delivery failure→fallback→ops task. |
| **Permission violations** | Customer reads another's order→not_found; staff out-of-scope→denied+audited; agent out-of-scope tool→blocked; cross-tenant→fail-closed. |
| **Payment failure** | Decline→dunning→cancel-if-exhausted; never proceed unpaid; duplicate webhook→no double-charge; refund→no double-refund. |
| **Upload failure** | Oversize/invalid type→rejected with message; malware→rejected+logged; network fail→retry; expired signed URL. |
| **AI low-confidence** | Risky rec below threshold→escalate to human, never auto-act; logged for eval; audit records confidence+decision. |
| **Admin override** | Elevated override requires justification+MFA; audited; SoD enforced (no self-approval); effectful replay audited. |
| **Order cancellation** | Cancel at allowed states→compensation reverses tasks; refund if paid (finance-approved); customer notified. |
| **Inspection failure** | Flag→`inspection_failed`→halt crossing→compliance resolution (refund/return/replace)→customer *Issue found*; audited. |

## 9.3 Quality gates (CI)
No merge if: unit/integration/e2e fail; contract drift; RLS cross-tenant leak; AI eval/red-team regression (esp. prohibited false-clear); a11y violations on key flows; hardcoded user-facing strings; security scan findings above threshold; payment idempotency test fails.

---

# DELIVERABLE 10 — Release Readiness Checklist

Gate to pilot launch. Each item Owner + Status (☐). **Legal/compliance sign-off is a hard gate for real orders.**

| Area | Checklist |
|------|-----------|
| **Product readiness** | ☐ MVP scope (D2) complete · ☐ happy path demoed EN/ES · ☐ edge cases handled · ☐ acceptance criteria (D8) met · ☐ pilot success metrics defined. |
| **Design readiness** | ☐ Stitch fidelity verified · ☐ tokens/components shipped · ☐ all states (D8 handoff) · ☐ a11y AA · ☐ EN/ES parity · ☐ "Powered by Maralito Labs" placement correct. |
| **Engineering readiness** | ☐ all P0 epics done · ☐ contracts honored (no invented APIs) · ☐ durable workflow stable · ☐ idempotent money/irreversible steps · ☐ CI green · ☐ no critical bugs. |
| **Security readiness** | ☐ RLS cross-tenant fail-closed · ☐ RBAC + MFA + elevation · ☐ KMS field encryption · ☐ secrets managed · ☐ SAST/IaC/container/secret scans green · ☐ injection/upload red-team pass · ☐ pen-test `⚠️ VERIFY`. |
| **Compliance readiness** | ☐ **customs/import legal sign-off** on accepted/prohibited categories · ☐ duty handling reviewed · ☐ RFC/invoicing approach · ☐ broker/partner `⚠️ VERIFY` · ☐ audit trail complete · ☐ data-retention + privacy. |
| **Operations readiness** | ☐ Hub receiving/inspection SOPs · ☐ ≥1 inspector + ≥1 driver trained · ☐ approval queues staffed (compliance/finance) · ☐ on-call + runbooks · ☐ DLQ/replay procedures · ☐ capacity for pilot. |
| **Support readiness** | ☐ concierge staffed (EN/ES) · ☐ WhatsApp live · ☐ escalation paths · ☐ help center seeded · ☐ trust comms for issues/delays. |
| **Payment readiness** | ☐ Stripe live config · ☐ webhook idempotency proven · ☐ receipts · ☐ refund flow (finance-approved, idempotent) · ☐ dunning · ☐ reconciliation. |
| **Notification readiness** | ☐ EN/ES templates approved · ☐ **WhatsApp templates pre-approved** `⚠️ VERIFY` · ☐ channel fallback · ☐ quiet hours · ☐ delivery tracking + retry. |
| **AI readiness** | ☐ agents recommend-only (`suggest`) · ☐ gateway metering + guardrails · ☐ evals + red-team pass (prohibited false-clear = 0) · ☐ cost budgets + alerts · ☐ override-rate baseline. |
| **Deployment readiness** | ☐ repeatable deploy 3 envs · ☐ reversible migrations · ☐ rollback drilled · ☐ observability + alerts · ☐ feature flags · ☐ pilot toggle. |
| **Pilot launch readiness** | ☐ waitlist/invite mechanism · ☐ target personas defined · ☐ KPI capture live · ☐ feedback loop · ☐ go/no-go reviewed by product+eng+compliance+ops. |

---

# DELIVERABLE 11 — Risk Register

| ID | Risk | Category | Prob | Impact | Mitigation | Owner | Detection signal | Contingency |
|----|------|----------|:----:|:------:|------------|-------|------------------|-------------|
| RK-01 | Customs/import legal unresolved blocks go-live | Compliance | Med | **Critical** | Engage counsel Sprint 0; gate real orders on sign-off | CPO/Compliance | legal review open at Sprint 4 | delay live orders; internal-only demo until cleared |
| RK-02 | Prohibited-item false-clear | Compliance/AI | Low | **Critical** | Recommend-only + compliance gate; 0-tolerance eval; rules authoritative; never auto-clear | compliance_admin | eval false-clear >0; audit review | block category; manual-only review; demote agent |
| RK-03 | Payment/refund incorrectness (double charge/refund) | Payment | Med | High | Idempotency keys; saga; never optimistic on money; reconciliation | finance_admin/BE | reconciliation mismatch; dispute spike | freeze automated refunds; manual finance ops |
| RK-04 | WhatsApp template approval lead time | Operations | High | Med | Start approval Sprint 0; SMS/email fallback | Ops | templates pending at Sprint 3 | launch with SMS+email+in-app; add WA later |
| RK-05 | Scope creep into AI/automation depth | Delivery | High | Med | Enforce MVP assist-only; defer V1; phase gates | TPM | sprint spillover; AI tasks growing | cut to assist-only; move depth to V1 |
| RK-06 | RLS/RBAC gap → cross-tenant or privilege leak | Security | Low | **Critical** | Double enforcement; CI cross-tenant test fail-closed; pen-test | DevSecOps | isolation test fail; 403 anomalies | hotfix + freeze; rotate; incident runbook |
| RK-07 | Sensitive-data (PII/KYC/RFC) exposure | Security/Compliance | Low | High | KMS encryption; permission-gated decrypt; masked-by-default; audited reads | DevSecOps | unaudited reads; masking miss | revoke access; rotate keys; notify per policy |
| RK-08 | Prompt injection via product pages/files | AI/Security | Med | High | Untrusted=data; egress allowlist; tool scoping; input guardrails; file scan | AI | guardrail triggers; anomalous tool calls | disable external fetch; manual resolve |
| RK-09 | AI cost runaway / loops | AI | Med | Med | Budgets+caps; rate limits; loop detection; cost dashboards | AI/Finance | cost spike alert | hard cap; halt agent; escalate |
| RK-10 | Hub/ops process immaturity | Operations | Med | High | SOPs; train staff; dry-run; manual fallbacks | Ops Manager | inspection/receiving errors | extend internal pilot; add staff/training |
| RK-11 | Duty-estimate inaccuracy (financial/legal) | Compliance/Payment | Med | High | Labeled estimate; finance approves all quotes; rules versioned; counsel review | finance/compliance | quote disputes; margin variance | human-only duty calc; widen review |
| RK-12 | Realtime journey/admin transport choice wrong | Technical | Med | Med | Decide poll vs subscribe early; skeleton + last-known fallback | BE | stale UI; load issues | fall back to polling |
| RK-13 | Demand vs capacity mismatch at pilot | Business/Ops | Med | Med | Invite-only; throttle; capacity plan | Product/Ops | backlog/SLA breach | tighten invites; pause intake |
| RK-14 | Fraud at real volume | Security/Business | Med | High | Fraud rules; Stripe Radar; KYC step-up; velocity checks | compliance/finance | anomaly alerts; chargebacks | hold + manual verify; tighten rules |
| RK-15 | Customs delays denting trust | UX/Operations | Med | Med | Calm proactive delay comms; concierge access; honest ETAs | concierge/ops | delay frequency up; CSAT dip | proactive outreach; compensation policy |
| RK-16 | Accessibility/localization regressions | UX | Med | Med | axe + pseudo-loc in CI; SR passes | QA/FE | CI a11y/i18n fails | block release; fix before pilot |
| RK-17 | Platform/Automation MVP not ready in parallel | Delivery/Technical | Med | High | Track platform deps; stub where safe; align roadmaps | TPM | platform milestones slipping | stub services; sequence around gaps |

---

# DELIVERABLE 12 — Dependency Map

## 12.1 Layered dependency chain (blocking)
```
Product decisions (MVP scope, business rules, compliance categories)
        │ (legal sign-off gates real orders)
        ▼
Designs (Stitch + Frontend Handoff tokens/components/screens)
        │
        ▼
Database schema (contracts/01) ──► RLS + field encryption
        │
        ▼
API contracts (contracts/02) + Event contracts (contracts/03)
        │
        ▼
Auth + RBAC + tenant context (Identity)
        │
        ├──► File storage (signed URLs)         ──► Document upload, Inspection photos
        ├──► Payments (Stripe)                   ──► Quote→Payment→Refund
        ├──► Notifications (Resend/Twilio/WA)    ──► all customer comms
        ▼
Automation workflows (durable order engine + events + tasks + approvals + saga)
        │
        ├──► Admin workflows (review, receiving, inspection, dispatch)
        ├──► AI agents (Intake/Risk/Quote via gateway, recommend-only)
        ▼
Operations SOPs (Hub receiving, inspection, dispatch, approval staffing)
        │
        ▼
Observability + Audit ──► Deployment + Release gates ──► Pilot
```

## 12.2 Dependency matrix (selected)
| Depends on ↓ / Needed by → | Blocks | Notes |
|----------------------------|--------|-------|
| Data model (contracts/01) | everything persisting state | foundational; lock in Sprint 0 |
| Auth/RBAC/RLS | all gated reads/writes | Sprint 1; security-critical |
| Payments (Stripe) | quote→payment→refund | real from day one |
| Notifications | every customer-facing event | WhatsApp templates = lead-time risk |
| Files storage | upload + inspection photos | signed-URL + ACL |
| Automation engine | order lifecycle, approvals, tasks | durable; idempotent |
| AI gateway + agents | Intake/Risk/Quote recommendations | recommend-only; depends on automation |
| Compliance sign-off | **going live with real orders** | hard external gate |
| Operations SOPs + staffing | hub receive/inspect/deliver | parallel to build |

## 12.3 Parallelizable work (no hard inter-block)
- Design system/tokens ∥ DB schema ∥ legal review ∥ WhatsApp template approval ∥ ops SOP authoring.
- After Auth: New Request flow ∥ Admin shell ∥ Notifications integration ∥ Files upload.
- After order engine: Border Journey UI ∥ admin order management ∥ inspection center ∥ AI agent wiring.
- Observability + QA harness can be stood up in parallel from Sprint 1.

---

# DELIVERABLE 13 — Build Agent Input Package

Everything a coding agent must receive **before implementation starts**.

## 13.1 Required documents
PRD + MVP scope (`docs/07`, `18`, `19`); Technical Architecture (`technical-architecture/01..10`); Data/API/Event/Access contracts (`contracts/01..05`); AI Agent + LangGraph Architecture; **Design-to-Frontend Handoff Package**; this Implementation Backlog; Maralito Platform + Automation architecture.

## 13.2 Required screenshots / designs
Stitch screens + HTML (`design-reference/*`): Welcome, Home 1/2, New Request, Border Journey 1/2, Inspection details, Concierge, brand logo, skyline illustration; the `DESIGN.md` token file. `GAP`: production logo lockups, app-icon set, empty/error illustrations, map style, OG images.

## 13.3 Required environment variables (names only — values via secret manager)
`DATABASE_URL` (Neon), `UPSTASH_REDIS_URL/TOKEN`, `MARALITO_SDK_*` (Identity/Payments/Notifications/Files/AI/Audit), `STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `TWILIO_*`/`WHATSAPP_*`, `AI_GATEWAY_*`, `SENTRY_DSN`, `POSTHOG_KEY`, `KMS_KEY_ID`, `NEXT_PUBLIC_*` locale/flags. **No secrets in code; never provider keys in app (AI via gateway).** `⚠️ VERIFY` exact var names against platform SDK.

## 13.4 Required service accounts
Vercel (deploy), Neon (DB), Upstash (Redis), Stripe, Resend, Twilio/WhatsApp Business, model provider(s) (behind gateway), Sentry, PostHog, KMS, GitHub/CI. Role-scoped, least-privilege.

## 13.5 Required API keys
Stripe (test+live), Resend, Twilio/WhatsApp, model provider (gateway-held, not app), PostHog, Sentry. Stored in secret manager; rotated; never committed.

## 13.6 Required third-party setup
Stripe products/webhooks + Radar; **WhatsApp Business templates pre-approved** (per language) `⚠️ VERIFY`; Resend domain verification; Neon project + branches; Upstash; KMS keys; **customs/broker partner** `⚠️ VERIFY`; file malware scanner `⚠️ VERIFY`.

## 13.7 Required brand assets
Logo (orange + inverse), app icon set (1024 + adaptive/maskable/monochrome), favicon/monogram, fonts (Literata + DM Sans, self-host), Material Symbols, illustrations (skyline, empty/error), map style. `GAP`: production exports pending.

## 13.8 Required test data
Seed: test customers (EN/ES), sample products/URLs, sample receipts/photos, prohibited + accepted category fixtures, Stripe test cards (success/decline/3DS), golden datasets per agent (extraction/risk/quote), edge-case fixtures (15), staff users per role.

## 13.9 Required acceptance criteria
The D8 matrix + per-epic AC (D3) + per-story AC (D4); CI quality gates (D9.3); release readiness (D10).

## 13.10 Must be CLARIFIED before implementation
1. **Customs/import legal sign-off** + accepted/prohibited categories + duty handling + RFC/invoicing + broker partner. `⚠️ VERIFY` (P0 gate)
2. Durable engine choice (Inngest vs Trigger.dev) + LangGraph Postgres checkpointer. `⚠️ VERIFY`
3. Realtime transport (poll vs subscribe) + journey projection read shape.
4. Thresholds: high-value, quote/refund approval, confidence per agent, SLA tiers (T1/T2 minutes).
5. `GAP` API endpoints (journey projection, KB search, notifications, threads, reorder) — confirm in contracts, don't invent.
6. Warning/Info/Gold color tokens + contrast approval; modal/bottom-sheet shadows.
7. Single app (route groups) vs separate admin app deployment shape.
8. Consent UX for long-term customer memory; file-scanner vendor; pen-test scope.
9. Messages vs Support nav semantics (confirm split).

---

# DELIVERABLE 14 — Final Output Format & Recommendation

## 14.1 Document structure (this backlog)
Executive summary → MVP definition → 25 epics → user stories (all 11 roles) → build sequence → 5-sprint plan + V1/pilot/post roadmaps → technical task list (13 disciplines) → acceptance-criteria matrix → testing plan → release readiness → risk register (17) → dependency map → build-agent input package → recommendation.

## 14.2 Epic → sprint → phase summary
| Sprint | Epics | Phase focus |
|--------|-------|-------------|
| 0 | 01, 02(start), 03(start), 19(scaffold) | foundation + lock + legal kickoff |
| 1 | 02, 03, 04, 05, 07, 21(start) | auth, design system, shell, onboarding, upload |
| 2 | 06, 10(engine), 12, 13, 14, 19, 20 | request flow, workflow, admin review, AI assist, quote |
| 3 | 08, 09, 10(UI), 11, 15, 16, 17, 18 | payment, journey, receiving, inspection, notifications, concierge |
| 4 | 21, 22, 23, 24, 25 | audit, observability, hardening, QA, deploy, pilot |

## 14.3 Open questions
See [D13.10](#1310-must-be-clarified-before-implementation). Top blockers: **(1) customs/compliance legal sign-off** (gates real orders), (2) durable-engine + checkpointer choice, (3) `GAP` API contracts confirmation, (4) thresholds + WhatsApp templates.

## 14.4 Risks (top 5)
RK-01 legal gate · RK-02 prohibited false-clear · RK-03 payment correctness · RK-06 RLS/RBAC isolation · RK-04 WhatsApp lead time. (Full register D11.)

## 14.5 Recommendation — when to start implementation
**Start Sprint 0 (foundation) immediately** — repo/env/CI, data model + contracts lock, design tokens, and platform SDK wiring have **no blocking external dependency** and de-risk everything downstream. **In parallel, start the customs/compliance legal review and WhatsApp template approval on day one** (longest lead times).

**Begin feature implementation (Sprint 1+) once** these are confirmed: data model + API/event contracts locked; durable-engine choice made; auth/RLS approach validated; design tokens approved; `GAP` API endpoints resolved (not invented). **Do not enable real cross-border orders until customs/compliance legal sign-off is complete** — internal/friendly end-to-end testing can proceed before that gate using test data.

**Net:** the architecture, product, design, data/API, automation, and AI specifications are complete and mutually consistent; the build is ready to begin at the foundation layer now, with feature work gated only on the handful of clarifications in D13.10 and the compliance sign-off gating live orders.

---

## Document close-out
This backlog converts all completed BorderPass specifications into a build-ready delivery plan across 14 deliverables, consistent with the MVP scope (`docs/07`), roadmap (`docs/19`), edge cases (`docs/18`), contracts (`contracts/01–05`), AI architecture, and the Frontend Handoff. It contains **no production code, no app scaffolding, and starts no implementation** — by design. `⚠️ VERIFY`/`GAP`/open questions must be resolved per D13.10 before/at the gates noted.

*Owner: CPO / Principal TPM / Delivery Lead, Web Forx Technology Ltd. · Draft v0.1 · 2026-06-29*
