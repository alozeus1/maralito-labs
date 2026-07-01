# BorderPass — Build Readiness Review (Go/No-Go)

> **Status:** Final review v1.0 · **Reviewers:** CTO · Principal Product Architect · Engineering Manager · DevSecOps Lead · QA Lead · Security Architect · Technical Delivery Reviewer (Web Forx Technology Ltd.) · **Date:** 2026-06-29
> **Mode:** READINESS REVIEW ONLY — **no code, no files beyond this review, no implementation.** Coding begins only on the explicit command **`START BORDERPASS BUILD`**.

## Documents reviewed (source of truth)

| # | Document | On disk | Lines |
|---|----------|---------|------:|
| 1 | Maralito Platform Architecture | `maralito-platform/docs/01–14` | ✅ |
| 2 | Maralito Automation Platform Architecture | `maralito-platform/automation/*` | ✅ |
| 3 | BorderPass PRD / Product Architecture | `borderpass/docs/01–20` | ✅ |
| 4 | BorderPass Technical Architecture | `borderpass/technical-architecture/docs/01–10` | ✅ |
| 5 | Data Model + API + Event Contracts | `borderpass/contracts/01–05` | ✅ |
| 6 | AI Agent + LangGraph Architecture | `borderpass/ai-architecture/…Blueprint.md` | ✅ 1,563 |
| 7 | Design-to-Frontend Handoff Package | `borderpass/frontend-handoff/…Package.md` | ✅ 951 |
| 8 | Implementation Backlog + Sprint Plan | `borderpass/delivery/…Delivery-Plan.md` | ✅ 770 |
| 9 | **Build Agent Master Prompt** | **— not a standalone doc —** | ⚠️ see note |
| 10 | Approved Stitch design board | `borderpass/design-reference/*` (screens + HTML + `DESIGN.md`) | ✅ |

> **Note on #9:** There is **no discrete "Build Agent Master Prompt" file.** Its intended content exists, but **distributed** across the Implementation Backlog (D13 "Build Agent Input Package") and the **Pre-Build Review** (`delivery/Pre-Build-Review.md`, 15 parts + locked Decision Log). This is a **minor, non-blocking gap**: consolidate into one agent-runnable master prompt before/at Phase 0 kickoff. Flagged in D2.

---

# DELIVERABLE 1 — Executive Readiness Summary

**Overall readiness score: 8.5 / 10.**

**Build readiness decision: ✅ READY TO BUILD AFTER MINOR CLARIFICATIONS.**

**Why.** The specification set is unusually complete and mutually consistent. Across nine architecture/product/design/data documents the team has: a locked MVP scope with explicit MVP/V1/Future boundaries; a 25-status order state machine; 18 fully-specified domain entities (fields, sensitivity, retention, indexing, RLS); a complete server-action + route-handler API catalog with error/validation/event/audit semantics; an event envelope + catalog with idempotency/DLQ; a recommend-only AI design with structural human-approval gates; a Stitch-derived design system with tokens, components, screens, states, a11y and i18n; and a 25-epic backlog with a 5-sprint plan. The two major technical forks (workflow engine; data stack) were **resolved** in the Pre-Build Review Decision Log (**Inngest**; **All-Supabase + Drizzle**). What remains are **clarifications, not redesigns** — initial rules-engine values, SDK surface confirmation, and the consolidation of the master prompt — none of which block Phase 0 (foundation). The one **hard gate is external**: customs/compliance **legal sign-off**, which blocks *real orders*, not the build or internal testing.

**Top blockers (full table D5).**
1. **Customs/compliance legal sign-off** (Critical) — gates real cross-border orders (not the build). Start counsel now.
2. **`@maralito/sdk` surface + exact env-var names** (High) — confirm with platform team before BFF wiring (Phase 0–1).
3. **Initial rules-engine values** — thresholds (high-value, commercial/RFC, approval limits), service fee, duty basis, quote-expiry window (High) — needed by Phase 5 (quote), not Phase 0.
4. **Master prompt consolidation** (Medium) — assemble the single build-agent prompt before kickoff.
5. **Supabase preview-branching strategy** (Medium) — created by the All-Supabase choice; resolve before the preview-CI step (Phase 1).

**Top risks.** Prohibited-item false-clear (controlled by recommend-only + compliance gate + 0-tolerance eval); payment/refund correctness (idempotency + saga + webhook-only confirm); RLS/RBAC isolation (double enforcement + blocking isolation tests); WhatsApp template lead time (launch SMS+email+in-app); platform-MVP readiness in parallel (track as dependency); scope creep into AI/automation depth (assist-only discipline + phase gates).

**Recommended next action.** Resolve the three pre-Phase-0 items (B4 SDK surface, master-prompt consolidation, confirm the locked stack), start the two long-lead items in parallel (legal review, WhatsApp templates), then authorize **Phase 0** (foundation) — which has **no upstream blocker**. Real-order enablement waits on legal sign-off. Then issue `START BORDERPASS BUILD`.

---

# DELIVERABLE 2 — Document Completeness Review

| Doc | Status | Strengths | Missing details | Conflicts | Clarifications | Impact |
|-----|--------|-----------|-----------------|-----------|----------------|--------|
| **1. Maralito Platform** | Complete | Clear S1–S14 services; SDK boundary; thin-app/fat-platform principle | Exact SDK method signatures/env names not enumerated here | none | Confirm SDK surface (B4) | Medium — BFF wiring depends on it |
| **2. Maralito Automation** | Complete | Durable engine model, events, agents, approvals, tasks, saga, DLQ | Engine pick was open → **resolved: Inngest**; checkpointer integration unproven | none | Confirm LangGraph Postgres checkpointer w/ Inngest (spike) | Medium — automation core |
| **3. BorderPass PRD** | Complete | MVP scope, edge cases (15), roadmap, IA, business rules, personas | Some thresholds deferred to rules engine (intentional) | none | Initial threshold values (G6) | Low/Med — needed by Phase 5 |
| **4. Technical Architecture** | Complete | BFF shape, env strategy, CI/CD, monorepo, AI-LangGraph, data arch | Preview branching assumed Neon (now Supabase) | Minor with stack choice (resolved w/ adjustment) | Supabase branching maturity (B-preview) | Medium — CI preview env |
| **5. Data/API/Event/Access contracts** | Complete | 18 entities fully specified; full API catalog; event envelope+catalog; RBAC/RLS; audit | A few read endpoints (KB search) marked V1/GAP | none (self-consistent) | Confirm GAP read endpoints (mostly present) | Low — reads only |
| **6. AI + LangGraph** | Complete | 14 agents→10 canonical; tools; HITL; guardrails; output schemas; MVP assist set | Production prompts intentionally out of scope | none | Final prompts at AI phase (expected) | Low — assist-only MVP |
| **7. Frontend Handoff** | Complete | Tokens (hex-verified), 36 components, 47 screens, states, a11y, i18n, routing | Warning/Info/Gold token hex; production assets; modal/sheet shadow values | none (DESIGN.md authoritative) | Confirm 3 token hexes + assets (G14) | Low — placeholders OK |
| **8. Implementation Backlog** | Complete | 25 epics, 76 stories (11 roles), 5 sprints, risk register, dependency map | — | none | — | Low |
| **9. Build Agent Master Prompt** | **Incomplete (not authored as a file)** | Content exists distributed (Backlog D13 + Pre-Build Review) | A single consolidated agent-runnable prompt | none | **Consolidate before kickoff** | Medium — agent ergonomics |
| **10. Stitch design board** | Complete | Screens + HTML + token file; signature components defined | Production asset exports (icons/illustrations/map) | none | Deliver production assets (G14) | Low — build with placeholders |

**Net:** 8 Complete, 1 Mostly-Complete (Tech Arch — minor preview-branching delta), 1 Incomplete (#9 master prompt — consolidation task, non-blocking). No cross-document contradictions found.

---

# DELIVERABLE 3 — Requirements Consistency Review

Cross-checked the named areas across PRD, contracts, AI, frontend, and backlog. **No contradictions found** that block the build. Findings:

| Area | Consistent? | Notes / flags |
|------|:-----------:|---------------|
| Product scope | ✅ | PRD ↔ backlog ↔ pre-build aligned |
| MVP scope | ✅ | `docs/07` ↔ backlog D2 ↔ pre-build P3 identical intent |
| User roles | ✅ | 9 roles + agent principal consistent across `contracts/05`, PRD `11`, AI, frontend |
| Order statuses | ✅ | 25 statuses single-sourced in `docs/09`/`contracts/04`; API transitions reference them |
| Payment flow | ✅ | Quote→accept→intent→**webhook-only confirm**→paid; idempotent by quote_id — consistent |
| Quote flow | ✅ | AI draft → **finance approves all (MVP)** → send → accept; consistent |
| Inspection flow | ✅ | Checklist+photos+serial/seal; fail→compliance HUMAN-APPROVAL; consistent |
| Delivery flow | ✅ | Crossing→arrived→OFD→delivered (human POD); failed→reschedule(≤N); consistent |
| Border Journey | ✅ | 12-stage projection over 25 statuses; vertical timeline; consistent (PRD `10`, frontend) |
| AI agent scope | ✅ | Recommend-only (`suggest`); MVP assist set identical in AI doc, backlog, pre-build |
| Automation workflows | ✅ | W1–W15 ↔ 18 design workflows mapped; trigger events match `contracts/03` |
| Admin dashboard | ✅ | Surfaces in `contracts/05` ↔ IA `05` ↔ frontend ↔ backlog aligned |
| Customer app | ✅ | IA `05` ↔ frontend screens ↔ backlog screens aligned |
| Notification strategy | ✅ | `docs/14` templates EN/ES ↔ events ↔ channels consistent |
| Security model | ✅ | RBAC+RLS double enforcement, KMS, audit, elevation — consistent across `contracts/05`, tech-arch `06` |
| Design system | ✅ | DESIGN.md tokens ↔ frontend handoff hex-verified |

**Minor inconsistencies to note (non-blocking):**
- **"Messages" vs "Support" nav** — bottom nav lists both; treat **Messages = concierge thread**, **Support = help hub + start chat**. PRD `05` already flags this; confirm.
- **Service-type naming** — `local_pickup`/`business_delivery` exist in the data model but are **concierge-assisted/limited in MVP** (not self-serve). Consistent if treated as limited; ensure UI doesn't expose full self-serve flows.
- **Color role naming** — `product_spec.md` ("primary = navy") vs `DESIGN.md` ("primary = orange"); **DESIGN.md is authoritative** (resolved in frontend handoff).
- **Preview DB branching** — tech-arch assumed Neon branches; All-Supabase requires Supabase branching or ephemeral schemas (resolve before Phase 1 CI).

**Requirements too broad for MVP / should be V1 (already deferred — confirm held):** full AI autonomy; Shopping-Agent auto-resolution; automated duty calc at scale; Local Pickup & full Business self-serve; reorder; saved cards; loyalty; auto RFC invoices; support ticket system; analytics dashboards; push; voice concierge. No MVP requirement found that is over-broad **beyond** these already-deferred items.

---

# DELIVERABLE 4 — MVP Scope Lock

**LOCKED MVP scope** (consistent with `docs/07`, backlog D2, pre-build P3). Changes to this require explicit re-approval.

## Customer MVP
- **Screens to build (22):** Welcome · Language · Login/Signup · Phone/Email OTP · Home · New Request flow · Buy-for-Me · Receive-My-Package · Product details · Receipt/document upload · Border/compliance info · Request review · Quote review · Stripe payment (+success) · Orders list · Order detail · Border Journey · Inspection details · Concierge contact · Notifications · Profile/Settings · About (+ "Powered by Maralito Labs").
- **Features to build:** EN/ES onboarding; 3-step request (Buy-for-Me + Package-Reception); secure upload; transparent quote; Stripe pay; journey tracking; inspection photo view; concierge chat (in-app + WhatsApp); notifications; manual refund/cancel request.
- **Features to exclude:** reorder; saved cards; loyalty; Local Pickup/Business self-serve; push; voice; analytics; marketplace/subscriptions/returns.

## Admin MVP
- **Screens to build (14):** Admin login · Dashboard · Orders list · Order detail · Risk review · Quote creation · Package-received action · Inspection checklist · Inspection photo upload · Status update controls · Customer profile view · Payment/refund visibility · Audit log visibility · Basic concierge workspace.
- **Features to build:** order management; manual risk review + approval gates; quote approve/send; hub receive/match; inspection capture; crossing/delivery status updates; refund approval; audit views; PII masking + audited reveal.
- **Features to exclude:** Finance/Compliance/Support/Analytics full dashboards (V1); rules-engine config UI (V1); support ticketing (V1).

## Backend MVP
- **APIs to build:** auth/profile; orders (draft→submit); files (upload/attach); admin review (risk/advance/hold/missing-info); quote (create/approve/accept); payment (intent + webhook); journey/inspection reads; hub/inspection/crossing/delivery actions; concierge/notifications; refund/cancel; finance/audit reads; automation control + webhooks. (Full order in pre-build P7.)
- **Entities to build (18):** CustomerProfile, StaffProfile, Address, Order, OrderItem, Package, Quote, QuoteLineItem, Document, Receipt, Inspection, InspectionPhoto, RiskReview, Delivery, Driver, ConciergeAssignment, SupportTicket, SupportMessage. (Platform entities — User, Org, Payment, Refund, Notification, AuditLog, AgentRun, WorkflowRun, EventLog, WebhookEvent — referenced by id via SDK, **not** built here.)
- **Events to build:** order lifecycle (`order.created/submitted/missing_information/under_review/risk_assessed/rejected`), quote (`created/sent/accepted`), payment (`succeeded/failed`), fulfilment (`purchased/package.received/inspection.passed|failed`), crossing (`border_documentation_ready/crossing_started/customs_processing/customs.delayed/arrived_juarez`), delivery (`out_for_delivery/completed/failed`), refund (`requested/processed`), support (`message/escalated`), `agent.review_completed`, `workflow.*`.
- **Workflows to build:** W1 intake, W2 missing-info, W3 risk, W4 quote, W6 payment, W8 received, W9 inspection, W10 crossing, W11 delay, W12 delivery, W13 failed-delivery, W14 refund, W15 support; W5 quote-expiry (schedule). (W7 purchase = buy-for-me, ops-assisted.)

## AI MVP
- **AI features to build (assist-only, `suggest`):** product extraction; missing-info detection; risk band recommendation; quote draft; support reply drafts; inspection checklist assistance; order summary; notification drafts; admin-notes summarization.
- **AI features to exclude:** Shopping auto-resolution; Inspection vision/OCR autonomy (MVP = human checklist); Border Journey ETA/narration agent; Finance/Refund auto-eligibility; Ops auto-assignment; any autonomous action.
- **Human approval required:** order accept/reject (compliance); quote send (finance, all); purchase spend (ops/finance); border docs (compliance); inspection-fail resolution (compliance/ops); refund (finance). AI **never** finalizes any of these.

## Automation MVP
- **Workflows to build:** W1–W4, W6, W8–W15 + W5 schedule (above).
- **Workflows to defer (V1):** agent-depth workflows (auto duty estimate, vision inspection, ETA/narration, auto-reconcile/refund-eligibility, auto-assignment); auto-approve low-risk reversible.
- **Manual fallback (MVP):** purchasing (staff buyer + proof); duty estimation (human-confirmed); border docs/customs (staff assemble + compliance approve); crossing/customs status (manual ops updates); driver dispatch (manual); refunds (finance manual).

## Integrations MVP
- **Required real:** Supabase Auth; Supabase Storage; Supabase Postgres; Stripe (intents/webhooks/receipts); Resend (email); AI gateway (recommend-only agents); Inngest (workflows); Audit.
- **Placeholder allowed:** WhatsApp/SMS (Twilio — placeholder or real per credentials; launch SMS+email+in-app); carrier/customs live tracking (manual ops); broker/partner (manual).
- **Deferred to V1:** push notifications; analytics dashboards (basic capture only in MVP); KB/RAG search depth (seed static FAQ); reorder/saved-cards.

---

# DELIVERABLE 5 — Build Blocker List

| Blocker | Category | Severity | Why it matters | Who resolves | Recommended resolution | Code start without it? |
|---------|----------|:--------:|----------------|--------------|------------------------|:----------------------:|
| Customs/import **legal sign-off** (categories, duty, RFC, broker) | Legal/compliance | **Critical** | Real cross-border orders are a legal event; wrong handling = liability | Compliance/Legal + CPO | Engage counsel now; gate **real orders** (not build); seed conservative prohibited list | **Yes** (build + internal test only; not real orders) |
| `@maralito/sdk` **surface + env-var names** | Technical | High | BFF calls every platform service via SDK; can't wire reads/writes without it | Platform team + Lead Eng | Confirm method signatures + env keys before BFF wiring | **Yes** for repo/CI/schema; **No** for BFF integration (Phase 1) |
| Initial **rules-engine values** (thresholds, fee, duty basis, expiry) | Product/Payment | High | Risk/quote/refund logic reads them; quotes can't finalize without | Finance + Compliance | Provide initial values into versioned rules engine | **Yes** (needed by Phase 5, not Phase 0) |
| **Master prompt** not consolidated (#9) | Technical | Medium | Build agent needs one runnable prompt; content is currently distributed | Lead Eng / Delivery | Assemble from Backlog D13 + Pre-Build Review before kickoff | **Yes** (consolidate before Phase 0 kickoff) |
| **Supabase preview-branching** strategy | Deployment | Medium | Tech-arch CI assumed Neon branches; All-Supabase differs | DevSecOps | Use Supabase branching **or** ephemeral per-PR schemas; `⚠️ VERIFY` maturity | **Yes** (resolve before Phase 1 preview-CI) |
| **LangGraph Postgres checkpointer** w/ Inngest | Technical/AI | Medium | Durable agent resume across approvals depends on it | Backend/AI | Sprint-0 spike to prove integration | **Yes** (spike in Phase 0) |
| **WhatsApp templates** pre-approval | Notification | Medium | WA needs pre-approved templates + opt-in; long lead time | Ops | Start approval now; launch SMS+email+in-app; add WA later | **Yes** (start in parallel) |
| Prohibited-item **false-clear** risk | AI/Compliance | High (controlled) | A wrong "clear" on prohibited goods is a compliance failure | Compliance + AI | Recommend-only + compliance gate + 0-tolerance eval; never auto-clear | **Yes** (controlled by design) |
| **Payment/refund correctness** | Payment | High (controlled) | Double charge/refund = financial harm | Backend/Finance | Idempotency keys; saga; webhook-only confirm | **Yes** (controlled by design) |
| **RLS/RBAC isolation** | Security | Critical (controlled) | Cross-tenant/privilege leak = breach | DevSecOps/Backend | Double enforcement; blocking isolation tests; pen-test pre-pilot | **Yes** (controlled by design) |
| **Production brand assets** (icons, illustrations, map) | Design | Low | Final polish; placeholders work meanwhile | Design | Deliver exports during Phases 2–7 | **Yes** |
| Token gaps (warning/info/gold hex; modal/sheet shadows) | Design | Low | Minor visual completeness | Design | Approve 3 hexes + shadow values | **Yes** |
| Platform MVP services readiness (parallel) | Technical | High | BorderPass consumes them; slippage stalls integration | Platform team | Track milestones; stub where safe; align roadmaps | **Yes** (monitor) |
| Hub/ops SOPs + staffing | Operations | Medium | Pilot needs trained inspector/driver + staffed approval queues | Ops | Author SOPs + train in parallel; dry-run before pilot | **Yes** (parallel; needed by pilot) |
| File malware scanner + pen-test | Security | Medium | Upload safety + pre-pilot assurance | DevSecOps | Select scanner; schedule pen-test (Phase 12) | **Yes** |

**Summary:** **0 blockers prevent starting Phase 0.** 1 Critical (legal) gates **real orders** only. 2 High technical items (SDK surface, rules values) gate specific later phases (1 and 5). The rest are parallelizable or controlled-by-design.

---

# DELIVERABLE 6 — Open Questions (final)

| # | Group | Question | Why it matters | Recommended default | Blocks MVP? |
|---|-------|----------|----------------|---------------------|:-----------:|
| Q1 | Product | Messages vs Support nav split? | Two nav items risk overlap | Messages = concierge thread; Support = help hub + start chat | No |
| Q2 | Product | Local Pickup / Business exposure in MVP? | Avoid self-serve scope creep | Concierge-assisted/limited only; hide full self-serve | No |
| Q3 | Operations | Pilot persona + invite mechanism? | Controls demand vs capacity | Invite/waitlist to target personas | No (pilot) |
| Q4 | Operations | Hub SOP owner + inspector/driver staffing? | Pilot can't run without | Assign owner; ≥1 inspector + ≥1 driver trained | No (pilot gate) |
| Q5 | Design | Warning/Info/Gold token hex + modal/sheet shadows? | Visual completeness | Propose amber/navy/gold; confirm AA | No |
| Q6 | Design | Production asset delivery date (icons/illustrations/map)? | Final polish | Placeholders until delivered | No |
| Q7 | Technical | Confirm `@maralito/sdk` surface + env names? | BFF integration depends | Confirm with platform team (B4) | **Phase 1** |
| Q8 | Technical | LangGraph Postgres checkpointer w/ Inngest proven? | Durable agent resume | Sprint-0 spike | Phase 2 (AI) |
| Q9 | Database | Supabase preview branching vs ephemeral schemas? | CI isolation | Supabase branching; fallback ephemeral schemas | Phase 1 CI |
| Q10 | Database | Status-history projection in MVP or rebuild-on-demand? | Timeline perf | Rebuildable from events; add projection if needed | No |
| Q11 | API | Confirm GAP read endpoints (KB search, etc.)? | Avoid inventing APIs | KB search = V1; others present in `contracts/02` | No |
| Q12 | Payments | Service fee + duty-estimate basis + quote expiry window? | Quote correctness | Rules-engine values; finance approves all | **Phase 5** |
| Q13 | Payments | Refund threshold needing compliance co-sign? | SoD on refunds | Set threshold in rules; default finance-only below | Phase 5 |
| Q14 | Notifications | WhatsApp templates approved per language? | WA channel | Launch SMS+email+in-app; add WA later | No |
| Q15 | AI | Confidence thresholds per agent? | Low-confidence escalation | Conservative defaults; tune from pilot | No (assist-only) |
| Q16 | Automation | Inngest vs Trigger.dev? | Engine | **Resolved: Inngest** | No (locked) |
| Q17 | Security | File scanner vendor + pen-test timing? | Upload safety + assurance | Select scanner; pen-test Phase 12 | No (pre-pilot) |
| Q18 | Security | KMS provider for field encryption? | Restricted-field encryption | Supabase/cloud KMS; confirm | Phase 1 |
| Q19 | Legal/compliance | Accepted/prohibited categories + duty + RFC + broker? | Real orders | Counsel sign-off; conservative seed | **Real orders** |
| Q20 | Deployment | Single app (route groups) vs separate admin app? | Repo/shell | **Single app, route groups** | No (locked) |
| Q21 | Deployment | Consent UX for long-term customer memory? | Privacy | MVP = order-scoped memory only | No (V1) |

**Blocking-by-phase:** Q7/Q9/Q18 → Phase 1; Q8 → Phase 2; Q12/Q13 → Phase 5; Q19 → real orders. **None block Phase 0.**

---

# DELIVERABLE 7 — Final Tech Stack Confirmation

Reflects the **locked decisions** (Inngest; All-Supabase + Drizzle) from the Pre-Build Review Decision Log.

| Layer | Recommended | Why | MVP usage | V1 usage | Risk / alternative |
|-------|-------------|-----|-----------|----------|--------------------|
| **Frontend** | Next.js App Router + TypeScript + Tailwind | One stack customer+admin; RSC; Stitch tokens over `@maralito/ui` | full | same | — / Remix (rejected) |
| **Backend** | Next.js BFF (server actions + route handlers) | No separate service in MVP; tenant/RBAC/Zod/idempotency/audit in one seam | full | same | — / dedicated API (later) |
| **Database** | **Supabase Postgres** (+ Drizzle ORM) | Locked; native RLS; pairs with Supabase Auth/Storage | full | same | Preview branching maturity `⚠️` / Neon (rejected) |
| **Auth** | **Supabase Auth** (phone OTP) behind Identity SDK | Locked; OTP for Juárez; session→org_id | full | + MFA admin | — |
| **Storage** | **Supabase Storage** (signed URLs, object ACL) | Locked; pairs with Auth; store `file_id` only | receipts, docs, inspection photos, POD | same | R2 (rejected) |
| **Payments** | Stripe (intents + webhooks) | Standard; idempotent; no raw card data | service + duty charges, refunds | + saved cards | — |
| **Notifications** | Resend (email) + Twilio/WhatsApp (SMS/WA) | Multi-channel EN/ES; fallback | email+SMS+in-app; WA when approved | + push | WA template lead time |
| **Automation** | **Inngest** (durable workflows) | Locked; step durability, sleep, fan-out | W1–W15 + schedule | + depth | checkpointer spike / Trigger.dev (rejected) |
| **AI / LangGraph** | LangGraph via AI gateway (recommend-only) | Governed; no provider keys in app; HITL nodes | Intake/Risk/Quote + drafts | agent depth | LangSmith for eval/trace (optional) |
| **Analytics** | PostHog | Funnel + agent metrics | basic event capture | dashboards | — |
| **Observability** | Sentry + OpenTelemetry | Traces workflow→agent→tool→model | errors + traces + AI cost | + dashboards | — |
| **Hosting** | Vercel | Next.js native; preview envs; progressive | all envs | same | — |
| **CI/CD** | GitHub Actions (security-gated) | SAST/SCA/secret/IaC + isolation tests + e2e | full pipeline | + load/DR | OIDC creds |
| **Testing** | Vitest + Playwright + axe + pseudo-loc | Pyramid; tenant-isolation blocking | full | + visual regression | — |
| **Security tooling** | SAST + SCA + secret + IaC scan + KMS + WAF | Defense-in-depth; CI-gated | full baseline | + pen-test cadence | scanner/pen-test vendor `⚠️` |
| **ORM** | **Drizzle** | Locked; SQL-first, RLS-friendly, light | schema+queries+migrations | same | Prisma (rejected) |
| **Validation** | Zod | Shared client+server schemas from contracts | every boundary | same | — |

**Confirmation:** stack matches the brief's approved list with the two forks resolved. ✅ No stack blockers.

---

# DELIVERABLE 8 — Environment & Credential Readiness

| Account / key | Required for MVP? | Can be mocked? | Setup notes | Security notes |
|---------------|:----------------:|:--------------:|-------------|----------------|
| **Supabase project** (Postgres + Auth + Storage) | **Yes** | No | One project per env (dev/preview/staging/prod); enable RLS; storage buckets w/ ACL | service-role key server-only; never `NEXT_PUBLIC_`; per-env isolation |
| **Vercel project** | **Yes** | No | Customer+admin one app; preview per PR; progressive prod | env scoping per environment; protected prod |
| **Stripe account** | **Yes** | Test mode | Products/prices; webhook endpoint + signing secret; Radar | live vs test keys separated; verify webhook signature |
| **Resend account** | **Yes** | Partially | Verify sender domain (SPF/DKIM/DMARC) | API key server-only; domain auth |
| **Twilio / WhatsApp** | **Yes (SMS)** / WA optional MVP | Yes (WA placeholder) | SMS live; WhatsApp templates pre-approval (lead time) | tokens server-only; verify inbound webhook signature |
| **LLM provider key** | **Yes** | Recorded fixtures in test | **Held by AI gateway, NOT the app** | no provider keys in app code; gateway-only |
| **LangGraph / LangSmith** | LangGraph Yes; LangSmith optional | Yes (LangSmith) | LangGraph in workflows; LangSmith for eval/trace if used | scope keys; PII handling in traces |
| **Inngest** | **Yes** | Dev server local | Event + signing keys; local dev server | signing-key verification on endpoints |
| **PostHog** | **Yes (basic)** | Yes | Capture funnel events; dashboards V1 | minimize PII; stable ids only |
| **Sentry** | **Yes** | Yes | Errors + OTel traces; AI cost spans | scrub PII; trace_id correlation |
| **GitHub repository** | **Yes** | No | Monorepo `apps/borderpass`; protected main; pinned actions | OIDC short-lived creds; secret scanning |
| **Storage bucket** | **Yes** | No | Supabase Storage buckets (receipts/docs/inspection/POD) w/ object ACL | signed URLs short-lived; owner-ACL on inspection photos |
| **Domain / DNS** | **Yes (pilot)** | Yes (vercel.app) | Custom domain for pilot; staging subdomain | HTTPS/HSTS; DNS records for email auth |
| **Email sender domain** | **Yes** | Partially | SPF/DKIM/DMARC for Resend | prevent spoofing; monitor deliverability |
| **KMS key** | **Yes** | Local dev key | Field encryption for Restricted 🔒 fields | permission-gated decrypt; audited reads |

**Readiness:** all MVP-required accounts are standard and obtainable; **no credential is a hard blocker** (WhatsApp is the only long-lead item, with SMS+email+in-app fallback). Provision per-env with **separate keys** and OIDC CI.

---

# DELIVERABLE 9 — Database Readiness Review

| Aspect | Status | Notes |
|--------|:------:|-------|
| **Entities** | ✅ Clear | 18 BorderPass domain entities fully specified (`contracts/01`); 12 platform entities referenced by id via SDK (not built here) |
| **Relationships** | ✅ Clear | FKs explicit: Order→CustomerProfile; OrderItem/Quote/Package/Document/Receipt/Inspection/RiskReview/Delivery→Order; Inspection→Package; InspectionPhoto→Inspection; QuoteLineItem→Quote; Delivery→Address/Driver |
| **State machines** | ✅ Clear | Order (25), Package, Quote, Inspection, Delivery, SupportTicket enums authoritative in `contracts/04`; status mutated only via workflow transitions |
| **Required fields** | ✅ Clear | Per-entity req/opt/system/derived columns specified; submit-time vs draft-time requirements defined |
| **Sensitive fields** | ✅ Clear | Sensitivity classes (Public/Internal/Confidential/Restricted) + `🔒` KMS fields marked (display_name, rfc, kyc_*, address lines, serial, ocr_data, message body, driver PII) |
| **Retention** | 🟡 Mostly | Per-entity retention noted; financial/customs/audit retention durations `⚠️ VERIFY` with counsel (longer than order life) |
| **Indexes** | ✅ Clear | Queue indexes specified (orders/hub/dispatch/risk/finance/support) + indexing summary table |
| **RLS** | ✅ Clear | `org_id` (+owner) on every table; customer owner-scoped; staff role-scoped; set only in BFF from token |
| **Audit logging** | ✅ Clear | Mandatory-audit action list (`contracts/05 §4`); immutable hash-chained; PII reads logged |
| **Migration sequence** | ✅ Clear | Proposed M0–M12 (pre-build P6); RLS ships with each table; forward-only expand→migrate→contract |

**Flags:**
- **Missing entities:** none for MVP. (V1 will add: rules-engine config tables if surfaced in-app, analytics rollups, status-history projection if materialized.)
- **Missing relationships:** none critical. ConciergeAssignment↔order optional; confirm concierge default-assignment rule.
- **Unclear ownership:** none — platform vs BorderPass ownership is explicit (boundary rule in `contracts/01`).
- **MVP simplifications:** status-history as rebuildable projection (not a table); `local_pickup`/`business_delivery` present in enum but limited; KYC metadata over raw docs.
- **V1 improvements:** materialized journey/status projection for timeline perf; analytics plane; richer Driver performance projection.
- **Retention `⚠️ VERIFY`:** confirm financial/tax + customs + audit retention windows with counsel before pilot.

**Verdict:** ✅ Database is build-ready. No SQL written (per instruction).

---

# DELIVERABLE 10 — API Readiness Review

| Aspect | Status | Notes |
|--------|:------:|-------|
| **Customer API groups** | ✅ Clear | auth/session/profile; orders (draft→submit); quotes/payments/files; concierge/notifications/refund (`contracts/02 §5`) |
| **Admin API groups** | ✅ Clear | orders & review; quotes & payments; hub/inspection/crossing; delivery/drivers; concierge/support/config/audit (`§6`) |
| **Automation APIs** | ✅ Clear | runs/signal/resume/retry/cancel/replay/override; events; approvals; agents; DLQ; tasks; rule-eval; schedules (`§7`) |
| **AI / agent APIs** | ✅ Clear | `agents/{key}/run`; `agent-runs/{id}` IS the action log (no separate log endpoint) |
| **Webhooks** | ✅ Clear | Stripe/Twilio/Resend: verify→dedupe→normalize→ack fast; idempotent by provider event id |
| **Error patterns** | ✅ Clear | Canonical error shape + code→HTTP map; no internal leakage; typed action results |
| **Auth requirements** | ✅ Clear | AuthN (session) + AuthZ (`can()`) + RLS; tenant from session never body |
| **Validation** | ✅ Clear | Zod at boundary + domain/state-machine guards; global + domain rules (`§3`) |
| **Events emitted** | ✅ Clear | Per-endpoint events catalogued; audit/event quick index (`§8`) |
| **Audit requirements** | ✅ Clear | Mandatory on sensitive/HUMAN-APPROVAL ops; denials (403) audited |

**Flags:**
- **Missing endpoints:** none blocking. **GAP (confirm, don't invent):** KB/FAQ search (V1; MVP seeds static FAQ); confirm notifications list/mark-read + threads/messages shapes (present in `§5`). 
- **Unclear contracts:** journey projection read shape + realtime transport (poll vs subscribe) — **default polling** for MVP.
- **Security concerns:** none new — pattern is sound (idempotency, approval_required 423, not_found for out-of-tenant, webhook signature verify). Ensure rate limits tighter on auth/payments/AI.
- **MVP simplifications:** reorder/saved-cards endpoints deferred; analytics endpoints basic; support ticketing endpoints minimal (concierge chat focus).

**Verdict:** ✅ API is build-ready. No endpoints implemented (per instruction).

---

# DELIVERABLE 11 — AI & Automation Readiness Review

| Aspect | Status | Notes |
|--------|:------:|-------|
| **Agent list** | ✅ Clear | 14 agents → 10 canonical; MVP build = Intake, Risk, Quote + draft helpers (Support/Notification/Product-Extraction); rest V1 |
| **Agent permissions** | ✅ Clear | 6-tier model; agent = distinct principal ≤ human it assists; tool-scoped, RLS-isolated memory |
| **Tool registry** | ✅ Clear | MVP subset scoped + schema-validated (read_order, recommend_risk_level, estimate_quote, etc.) |
| **Human approval points** | ✅ Clear | Order accept/reject, quote send, purchase, border docs, inspection-fail, refund — structural approval nodes |
| **LangGraph workflows** | ✅ Clear | Manager (route/validate/approval/audit) + worker agents; recommend-only |
| **Automation workflows** | ✅ Clear | W1–W15 + schedule; durable/idempotent/compensable; trigger map matches events |
| **Event triggers** | ✅ Clear | Event→workflow router; correlation_id = order_id |
| **Failure handling** | ✅ Clear | Retry/backoff; saga compensation; DLQ; fail-safe escalate; never auto-clear on uncertainty |
| **AI observability** | ✅ Clear | AgentRun/Step logged; cost ledger; traces; override-rate metric |
| **Safety guardrails** | ✅ Clear | Injection/PII/schema; untrusted=data; egress allowlist; low-confidence→escalate |

**Decisions:**
- **Safe for MVP (assist-only, `suggest`):** product extraction, missing-info detection, risk band recommendation, quote draft, support/notification/admin-note drafts, order summary, inspection checklist assistance.
- **Remain manual (MVP):** purchasing, duty finalization, border docs/customs, crossing/customs updates, driver dispatch, refunds, all risk/compliance/financial decisions.
- **Placeholder only:** WhatsApp send (until templates), Inspection vision/OCR (human checklist in MVP), Border Journey ETA/narration.
- **Must NOT be automated yet:** final order approval/rejection, refund execution, customs declarations, payment edits, marking delivered — each enforced by missing-tool + approval node, not prompt.

**Verdict:** ✅ AI/automation is build-ready as **assist-only**, with one spike (LangGraph Postgres checkpointer × Inngest) in Phase 0.

---

# DELIVERABLE 12 — Design Implementation Readiness

| Aspect | Status | Notes |
|--------|:------:|-------|
| **Stitch completeness** | ✅ | Screens + HTML for Welcome, Home, New Request, Journey, Inspection, Concierge, logo, skyline |
| **Design tokens** | ✅ | `DESIGN.md` authoritative; hex-verified in handoff; Material-3-style naming |
| **Component inventory** | ✅ | 36 components with states/a11y/data deps |
| **Screen inventory** | ✅ | 30 customer + 17 admin with routes/data/events/states |
| **Mobile responsiveness** | ✅ | Mobile-first; breakpoints; safe-area; sticky CTA/nav; targets ≥48px |
| **Admin UI readiness** | ✅ | Tables/kanban/approval modals/masking specified |
| **Empty states** | ✅ | EmptyState component + per-screen |
| **Error states** | ✅ | ErrorState (inline/screen) + canonical error mapping |
| **Loading states** | ✅ | LoadingSkeleton variants per content shape |
| **Accessibility** | ✅ | WCAG AA spec; keyboard/SR/focus/reduced-motion/accessible timeline+modals |
| **Localization** | ✅ | EN/ES parity; no hardcoded strings; format rules; sample labels |
| **Brand rules** | ✅ | "Powered by Maralito Labs" footer/about/settings only; app name BorderPass |

**Flags (all Low, non-blocking):**
- **Missing assets:** production logo lockups, app-icon set (1024+adaptive/maskable/monochrome), empty/error illustrations, map style asset, OG images → build with placeholders, swap on delivery.
- **Missing icons:** Material Symbols cover UI; production brand glyphs pending.
- **Missing copy:** full EN/ES catalog (only notification templates + sample labels exist); error/empty copy; Help/FAQ; legal/ToS; prohibited-items content.
- **Missing screen states:** multi-active-order home carousel; business-order (RFC) variant; some admin DLQ/stuck-run panels.
- **Implementation risks:** Stitch HTML uses Tailwind CDN + Google Fonts CDN → re-implement as theme + self-hosted fonts (reference only); ES expansion (pseudo-loc CI); 3 token hexes (warning/info/gold) + modal/sheet shadows to confirm.

**Verdict:** ✅ Design is build-ready; gaps are placeholders/copy, resolvable during Phases 2–7.

---

# DELIVERABLE 13 — Security & Compliance Readiness

| Control | Status | MVP baseline |
|---------|:------:|--------------|
| **RBAC** | ✅ | `can(role,action,ctx)` on every op; 9 roles + agent principal |
| **Protected routes** | ✅ | session guard (customer) + RBAC layout guard (admin); MFA admin/finance/compliance |
| **File access** | ✅ | signed URLs (short-lived); object ACL; inspection photos owner-only; store `file_id` |
| **Payment security** | ✅ | no raw card data; webhook signature verify; idempotent; confirm via webhook |
| **Webhook verification** | ✅ | Stripe/Twilio/Resend signature verify; dedupe by provider event id |
| **Audit logs** | ✅ | immutable hash-chained; mandatory on sensitive ops; PII reads + 403s logged |
| **Sensitive-data masking** | ✅ | admin masked-by-default; reveal audited; KMS field encryption + permission-gated decrypt |
| **AI data access** | ✅ | recommend-only; org-scoped RLS memory; no cross-tenant; gateway-only model calls |
| **Human approval** | ✅ | structural gates on risk/quote/purchase/border-docs/inspection-fail/refund; SoD |
| **Fraud prevention** | 🟡 | Stripe Radar + fraud rules + KYC step-up specified; tune at pilot |
| **Abuse prevention** | 🟡 | rate limits; abandonment/duplicate rules; velocity checks — confirm thresholds |
| **Backup / recovery** | 🟡 | Supabase backups + migration rollback; **DR drill** to schedule (pre-pilot) `⚠️ VERIFY` |
| **Secret management** | ✅ | secret manager; no secrets in code; OIDC CI; secret scanning |

**Flags:**
- **Critical (must hold):** RLS cross-tenant fail-closed; no raw card data; webhook verification; immutable audit; recommend-only AI; KMS on Restricted fields.
- **MVP minimum baseline:** all ✅ rows above + CI security gates (SAST/SCA/secret/IaC) + tenant-isolation tests + basic fraud rules + signed-URL ACL.
- **V1 improvements:** pen-test cadence; advanced fraud/abuse models; full DR drills; richer KYC; SBOM on release.

**Verdict:** ✅ Security model is clear and sufficient for a pilot baseline; fraud/abuse thresholds and DR drill to finalize pre-pilot.

---

# DELIVERABLE 14 — Operations Readiness

| Workflow | Status | MVP manual steps |
|----------|:------:|------------------|
| **Admin workflows** | ✅ defined | ops runs full order lifecycle from dashboard; manual advance/hold/assign |
| **Concierge workflow** | ✅ defined | AI-draft, **human-sent**; WhatsApp + in-app; assignment for continuity |
| **Inspection workflow** | ✅ defined | inspector checklist + photos + serial/seal; fail→compliance approval (manual judgment) |
| **Package receiving** | ✅ defined | hub scan/register/match; unmatched→staff task |
| **Delivery workflow** | ✅ defined | manual dispatch; driver POD; failed→reschedule(≤N)→concierge |
| **Support workflow** | 🟡 MVP-lite | concierge chat (no ticket system in MVP); escalation by category |
| **Refund workflow** | ✅ defined | finance-approved, idempotent, SoD |
| **Manual fallback** | ✅ defined | purchasing, duty estimate, border docs, crossing/customs updates all manual (MVP) |
| **SOP requirements** | 🟡 to author | hub receiving/inspection, dispatch, approval-queue handling, edge-case runbooks |

**Flags:**
- **Operational gaps:** SOPs not yet authored; approval queues (compliance/finance) need staffing + SLA targets; on-call + DLQ/replay procedures to document.
- **Manual steps needed for MVP:** purchasing (buyer + proof), duty confirmation, border docs/customs, crossing/customs status updates, driver dispatch, refunds — all by design.
- **Training needs:** inspector (checklist/photo/serial/seal), driver (POD/failed), compliance (risk queue + approval semantics + override), finance (quote/refund approval), concierge (AI-draft + human-send).
- **SOPs needed before pilot:** Hub receiving + inspection; dispatch + delivery; approval-queue handling; edge-case runbooks (the 15 cases); incident/on-call; customs-delay comms.

**Verdict:** 🟡 Operations are **defined in the product/automation docs** but **SOP authoring + staffing + training are pilot-gating** (parallelizable with the build).

---

# DELIVERABLE 15 — Final Approved Build Sequence

14 phases. Each: **Goal · Inputs · Outputs · Tests · Acceptance · Dependencies.** Phases 0–2 are foundation (no external blockers); real-order enablement waits on legal sign-off (after Phase 12).

### Phase 0 — Setup & project foundation
- **Goal:** Monorepo app skeleton, envs, security-gated CI, locked-stack wiring, decision spikes.
- **Inputs:** Pre-Build Review (locked stack), repo access, Supabase/Vercel/Inngest accounts, SDK confirmation (B4).
- **Outputs:** `apps/borderpass` boots in dev/preview; CI pipeline green; `.env.example`; Inngest+LangGraph checkpointer spike result; consolidated master prompt.
- **Tests:** CI runs lint/typecheck/unit; SDK health call; pipeline gates active.
- **Acceptance:** app boots all envs; CI security gates block on fail; spike proves durable agent resume.
- **Dependencies:** B4 (SDK surface), stack confirmation.

### Phase 1 — Database, auth, RBAC
- **Goal:** Schema + RLS + Supabase Auth (OTP) + RBAC.
- **Inputs:** `contracts/01,02,05`; migration order P6.
- **Outputs:** Drizzle schema + RLS policies (M0–M11); OTP auth; `can()` policy; MFA for admin/finance/compliance; tenant-context setter.
- **Tests:** migration on Supabase branch; **tenant-isolation (blocking)**; RBAC matrix; OTP e2e.
- **Acceptance:** cross-tenant fails closed; unauthorized→not_found; OTP onboarding works.
- **Dependencies:** Phase 0; Q9 (preview branching), Q18 (KMS).

### Phase 2 — Design system & app shell
- **Goal:** Tokens + base components + customer/admin shells + i18n.
- **Inputs:** Frontend Handoff (tokens/components); Stitch.
- **Outputs:** theme, self-hosted fonts, base components (Storybook), `(customer)`/`(admin)` shells, bottom nav, locale provider, safe-area.
- **Tests:** token snapshot; axe a11y; Storybook states; nav e2e.
- **Acceptance:** tokens match handoff; AA clean; EN/ES switch live.
- **Dependencies:** Phase 0; Q5 (token hexes).

### Phase 3 — Customer onboarding & new request flow
- **Goal:** Welcome→Home + 3-step New Request (Buy-for-Me + Package-Reception).
- **Inputs:** Phases 1–2; order schema; `createOrder`/`updateDraftOrder`/`submitOrder`.
- **Outputs:** onboarding screens; Home; Stepper flow; product/border forms; request summary; draft autosave.
- **Tests:** onboarding e2e (EN/ES); draft autosave; submit validation; `order.created/submitted`.
- **Acceptance:** new user reaches Home; valid request submits → W1; missing-info → W2.
- **Dependencies:** Phases 1–2.

### Phase 4 — Document upload & order submission
- **Goal:** Secure receipt/document upload integrated into submit.
- **Inputs:** Supabase Storage; `getUploadUrl`/`attachReceipt`/`attachDocument`.
- **Outputs:** UploadBox (6 states); signed-URL flow; ACL; missing-info clear on upload.
- **Tests:** upload/retry/invalid; malware reject; ACL; signed-URL expiry.
- **Acceptance:** files attach + ACL-scoped; submit gates on required receipt; `file.uploaded`.
- **Dependencies:** Phase 3; Q17 (scanner).

### Phase 5 — Admin order review & quote creation
- **Goal:** Admin dashboard + risk review (AI band) + approval gate + quote draft + finance approval.
- **Inputs:** admin APIs; Risk + Quote agents; **rules-engine initial values (Q12)**.
- **Outputs:** orders dashboard/detail; RiskReviewCard; HumanApprovalModal; quote create/approve/send.
- **Tests:** risk decision e2e; never-auto-clear; quote approve→send; SoD; audit.
- **Acceptance:** every order human-reviewed; HIGH/BLOCK gated; finance approves all quotes; rejection notified+audited.
- **Dependencies:** Phases 1–4; AI Phase 11 (Intake/Risk/Quote); Q12 (thresholds/fee/duty).

### Phase 6 — Stripe payment
- **Goal:** Pay quote + duties; webhook confirm; receipt.
- **Inputs:** Stripe; `createPaymentIntent`/`payDuties`; webhook handler.
- **Outputs:** payment screen; intent (idempotent by quote_id); webhook→`paid`; receipt; dunning.
- **Tests:** success/decline/3DS; **webhook idempotency**; no double-charge; refund path.
- **Acceptance:** payment advances `paid` via webhook only; never proceed unpaid; receipt issued.
- **Dependencies:** Phase 5.

### Phase 7 — Order tracking & Border Journey
- **Goal:** 25-status engine rendered as vertical Border Journey.
- **Inputs:** durable workflow; journey projection; `GET /journey`.
- **Outputs:** order engine; journey timeline (states/ETA/tracking id/View Photos/concierge card); live update (polling).
- **Tests:** transition→event+audit+notify; accessible timeline; delay/failed states.
- **Acceptance:** journey reflects status; accessible ordered list; updates render.
- **Dependencies:** Phases 5–6; Phase 10 (workflow hooks); Q9 transport.

### Phase 8 — Package receiving & inspection
- **Goal:** Hub receive/match + inspection (checklist/photos/serial/seal) + fail gate + customer view.
- **Inputs:** `markPackageReceived`/`submitInspection`/`resolveInspection`.
- **Outputs:** receiving; inspection center; photo upload; pass/flag; fail→compliance approval; customer Inspection Details.
- **Tests:** receive/match; inspection submit; fail→halt+approval; photos to customer (signed URLs).
- **Acceptance:** `package.received`→`inspection.passed/failed`; photos owner-ACL; fail gated.
- **Dependencies:** Phases 4,7.

### Phase 9 — Notifications
- **Goal:** Multi-channel EN/ES notifications for key events.
- **Inputs:** Resend + Twilio/SMS; templates (`docs/14`).
- **Outputs:** template integration; channel select+fallback; quiet hours; in-app center; idempotent per event.
- **Tests:** language honored; deep links; transactional bypass quiet hours; no double-send.
- **Acceptance:** each key event notifies in customer language; fallback works.
- **Dependencies:** Phases 3,7; Q14 (WhatsApp later).

### Phase 10 — Audit logging & workflow hooks
- **Goal:** Wire durable workflows (W1–W15) + approval nodes + tasks + saga + audit across phases.
- **Inputs:** Inngest; trigger router; Audit S7.
- **Outputs:** W1–W4,W6,W8–W15 + W5 schedule; approval pause/resume; compensation; mandatory audit.
- **Tests:** durability/resume; idempotency; saga compensation (restart/chaos); audit completeness.
- **Acceptance:** human gates enforced; money consistent; every sensitive action audited.
- **Dependencies:** Phases 5–9; engine spike (Phase 0).

### Phase 11 — AI MVP features
- **Goal:** Intake/Risk/Quote agents + draft helpers, recommend-only via gateway.
- **Inputs:** AI gateway; tool registry (MVP subset); RAG seed.
- **Outputs:** Manager + agents; structured outputs+confidence; approval auto-insert; AgentRun/Step logging; guardrails; evals.
- **Tests:** golden sets; schema conformance; **prohibited false-clear=0**; red-team; cost metering.
- **Acceptance:** recommend-only; no provider keys in app; low-confidence→escalate; no autonomous risky action.
- **Dependencies:** Phase 10 (runs as workflow steps); feeds Phase 5.

### Phase 12 — QA, security, deployment
- **Goal:** Edge cases, hardening, observability, deploy pipeline, readiness gate.
- **Inputs:** test plan (backlog D9); security checklist (P13); edge cases (`docs/18`).
- **Outputs:** 15 edge cases covered; security gates green; observability+alerts; deploy+rollback; readiness checklist.
- **Tests:** full pyramid; tenant-isolation; payment/upload/RBAC/workflow/AI/a11y/i18n/security; pen-test.
- **Acceptance:** all CI gates green; no critical bugs; readiness checklist (backlog D10) green.
- **Dependencies:** Phases 1–11; Q17 (pen-test/scanner).

### Phase 13 — Pilot launch
- **Goal:** Controlled pilot in Juárez↔El Paso corridor.
- **Inputs:** **legal sign-off (B1)**; staffed ops/approval queues; SOPs; pilot toggle.
- **Outputs:** invite/waitlist; KPI capture; feedback loop; real orders enabled.
- **Tests:** end-to-end on staging w/ edge cases; ops dry-run; go/no-go review.
- **Acceptance:** readiness green **AND legal cleared**; ops can run full flow; pilot metrics instrumented.
- **Dependencies:** Phase 12; **legal sign-off**; ops staffing/training/SOPs.

---

# DELIVERABLE 16 — Final Readiness Decision

## ✅ READY TO BUILD AFTER MINOR CLARIFICATIONS

**Final reason.** Across all nine source documents the requirements are complete, mutually consistent, and free of blocking contradictions. Database entities/relationships/state-machines, API contracts, event contracts, AI responsibilities, automation workflows, roles/permissions, security model, design system, and integrations are all clear and build-ready. The two major technical forks (workflow engine, data stack) are **resolved and locked** (Inngest; All-Supabase + Drizzle). The remaining items are **clarifications, not redesigns**, and **none block Phase 0 (foundation)**. The only hard gate is **external legal sign-off**, which blocks *real cross-border orders* — not the build or internal testing. Overall readiness **8.5/10**.

**Required clarifications (before the phase that needs each — none block Phase 0):**
1. Confirm `@maralito/sdk` method surface + exact env-var names (Q7) → before Phase 1 BFF wiring.
2. Provide initial rules-engine values: thresholds, service fee, duty basis, quote-expiry window (Q12) → before Phase 5 quote.
3. Choose Supabase preview-branching vs ephemeral schemas (Q9) + KMS provider (Q18) → before Phase 1 CI.
4. Prove LangGraph Postgres checkpointer × Inngest (Q8 spike) → in Phase 0.
5. Consolidate the **Build Agent Master Prompt** (#9) into one runnable file → before kickoff.
6. Start long-lead items now: **customs legal review (B1)** and **WhatsApp template approval (B9)** — parallel.
7. Confirm 3 design token hexes (warning/info/gold) + modal/sheet shadows (Q5) → before/at Phase 2.

**Recommended first implementation task.** **Phase 0 — Setup & project foundation:** scaffold `apps/borderpass` in the monorepo, stand up the security-gated CI pipeline, wire envs for the locked stack (Supabase + Inngest + Vercel), and run the LangGraph-checkpointer × Inngest spike — while legal review and WhatsApp approval proceed in parallel.

**Exact instruction to give when ready to start coding:**

> ## `START BORDERPASS BUILD`

On that exact command — and not before — I will begin **Phase 0** in small, reviewable increments (goal → files to create → implement → explain changes → test steps → remaining issues → await approval before the next major phase). **Real cross-border orders remain disabled until customs/compliance legal sign-off is complete; all build and internal testing proceed on synthetic data until then.**

---

*Reviewers: CTO · Principal Product Architect · Engineering Manager · DevSecOps Lead · QA Lead · Security Architect · Technical Delivery Reviewer — Web Forx Technology Ltd. · 2026-06-29 · READINESS REVIEW ONLY — no code written.*
