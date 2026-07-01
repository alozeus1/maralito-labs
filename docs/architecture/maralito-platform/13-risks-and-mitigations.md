# 13 · Risks & Mitigations

Covers required output **(23)**. Risks are rated **Likelihood × Impact** (L/M/H) with an owner and concrete mitigations. The top risks are the ones that, if mishandled, force a re-architecture or cause a breach.

---

## Risk register

### Architecture & platform-design risks

| # | Risk | L | I | Mitigation | Owner |
|---|------|---|---|------------|-------|
| R1 | **Apps over-couple to platform internals**, making the platform impossible to evolve | M | H | SDK/API/event contracts only (P2); import-boundary lint gates; versioned contracts + deprecation policy; treat platform as a product | Chief Architect |
| R2 | **Premature microservices** add ops/cost/complexity before there's scale to justify | M | H | Modular-monolith-first (P5); schema-per-service so extraction is mechanical; extract only on measured triggers | Chief Architect |
| R3 | **Platform becomes BorderPass-specific**, blocking future apps | M | H | BorderPass is a tenant, not the definition; app-registration model; generalize only proven primitives; review gate: "would a 2nd app need this differently?" | Product Strategist |
| R4 | **Contract churn** breaks app teams repeatedly | M | M | Additive-by-default evolution; semver SDK; deprecation windows + telemetry; codemods/migration notes (P1) | Platform Eng |
| R5 | **Distributed-systems complexity** (eventual consistency) causes subtle bugs | M | M | Outbox pattern, idempotent consumers, DLQ + replay, reconciliation jobs, contract tests; keep sync where simple (P6) | Platform Eng |

### Security, tenancy & compliance risks

| # | Risk | L | I | Mitigation | Owner |
|---|------|---|---|------------|-------|
| R6 | **Cross-tenant data leakage** (the worst-case for a multi-tenant platform) | M | H | Two-layer isolation (RBAC + **RLS**); gateway-only tenant context; **mandatory isolation tests per table** as blocking CI gate; least-privilege service roles | DevSecOps Lead |
| R7 | **Secret leakage** (in repo, logs, client bundles) | M | H | Secrets manager (never in DB/repo/client); secret-scanning gate; log redaction; OIDC short-lived CI creds | DevSecOps Lead |
| R8 | **PII / sensitive-data exposure** (incl. KYC, inspection evidence) | M | H | Data classification + PII minimization; field-level encryption; strict file ACLs + short-lived signed URLs; ACL-filtered RAG; audited data-access | DevSecOps Lead |
| R9 | **Payment fraud / financial errors** | M | H | Stripe Radar + fraud rules + review queue; idempotent webhook processing; append-only reconciled ledger; step-up/approval on high-risk; never store raw card data | DevSecOps + Finance |
| R10 | **Compliance debt** (retrofitting SOC 2/ISO is expensive) | M | M | Build to controls from day one; evidence pipeline in v1; ADRs + audit trails as standing evidence | DevSecOps Lead |
| R11 | **Disaster / data loss** with no tested recovery | L | H | Automated backups + PITR; **tested restore drills**; IaC-reproducible envs; DR runbooks; RPO/RTO targets | DevSecOps Lead |

### AI-specific risks

| # | Risk | L | I | Mitigation | Owner |
|---|------|---|---|------------|-------|
| R12 | **Runaway AI cost** (loops, large contexts, no budgets) | M | H | Central gateway cost ledger; per-org/app budgets + alerts + optional hard caps; loop/anomaly detection; caching; cheap-model routing | AI Infra Architect |
| R13 | **Prompt injection / agent overreach** (agent does harmful writes) | M | H | Untrusted content as data not instructions; delegated, tool-scoped agent tokens (P9); human approval for real-world writes; guardrails + red-team suite | AI Infra Architect |
| R14 | **AI quality regression / hallucination** harms users or trust | M | M | Eval + regression suite in CI; online scoring; RAG grounding/citation checks; gradual rollout behind flags; human-in-the-loop for high stakes | AI Infra Architect |
| R15 | **Model-provider lock-in / outage / pricing change** | M | M | Provider abstraction in gateway; multi-provider routing + fallback; `⚠️ VERIFY` pricing/limits from config not hard-coded | AI Infra Architect |
| R16 | **AI memory/RAG cross-tenant leak** | L | H | Org-scoped, RLS-isolated memory + vectors; ACL filtering before retrieval; cross-tenant retrieval tests | AI Infra + DevSecOps |

### Vendor, cost & operational risks

| # | Risk | L | I | Mitigation | Owner |
|---|------|---|---|------------|-------|
| R17 | **Vendor lock-in** (Vercel/Supabase/Neon/etc.) | M | M | Abstract behind SDK/services; standardize on portable Postgres; keep IaC; periodic exit-cost review; `⚠️ VERIFY` limits before depending on a feature | Chief Architect |
| R18 | **Third-party limit/pricing surprises** (rate limits, execution caps, egress) | M | M | `⚠️ VERIFY` discipline against official docs; load/soak tests; budgets + alerts; design for graceful degradation | Platform Eng |
| R19 | **Cost sprawl** across infra + AI + messaging | M | M | Cost attribution per app/org/feature (P12); FinOps dashboards; budgets; scale-to-zero where possible | Platform Eng |
| R20 | **Provider outage** (Stripe/Twilio/model/Neon down) | L | H | Queue + retry (durable workflows); degrade gracefully; status-aware fallbacks; runbooks; DLQ replay | Platform Eng |

### Delivery & organizational risks

| # | Risk | L | I | Mitigation | Owner |
|---|------|---|---|------------|-------|
| R21 | **Platform vs. BorderPass priority conflict** (platform starved to ship the app) | H | M | Explicit MVP slice that serves both; platform-as-product backlog; guard against app-only shortcuts that erode contracts | CTO |
| R22 | **Scope creep** (building v1/future features in MVP) | H | M | Strict MVP exit criteria; deferred-list discipline; flags to ship dark | CTO |
| R23 | **Small-team key-person dependency** | M | M | ADRs + runbooks + docs as you go; pairing; no undocumented tribal knowledge | CTO |
| R24 | **DX friction slows every app** | M | M | Invest in CLI, preview envs, one-command local (P15); measure onboarding time | Platform Eng |
| R25 | **Inadequate testing of platform core** (auth/billing/RLS) lets costly bugs through | M | H | High coverage on core; tenant-isolation + contract + e2e gates; eval suite for AI | Platform Eng |

---

## Top-5 watchlist (review every sprint)

1. **R6 — Cross-tenant leakage** (catastrophic; isolation tests must always be green).
2. **R12/R13 — AI cost & agent overreach** (the AI tier is the newest, least-bounded risk).
3. **R21/R22 — Platform starved / scope creep** (the most likely *organizational* failure mode).
4. **R7/R8 — Secret & PII exposure** (breach-class).
5. **R18 — Third-party limit surprises** (most likely to cause a late, painful redesign — hence the `⚠️ VERIFY` discipline).

## Verification debt (the `⚠️ VERIFY` list)

A standing task: before depending on any third-party capability/limit/price flagged `⚠️ VERIFY` in this blueprint, confirm against the vendor's **official docs** and record the finding in an ADR. Treat unverified assumptions as risk, not fact (engineering standard: avoid inventing service features/limits/pricing).
