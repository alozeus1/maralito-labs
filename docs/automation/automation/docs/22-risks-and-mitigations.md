# 22 · Risks & Mitigations

Covers required output **(25)**. Rated **Likelihood × Impact** (L/M/H) with owner + mitigations. Top risks are those that cause data/money corruption, runaway autonomy, or a re-architecture.

---

## Workflow & reliability risks
| # | Risk | L | I | Mitigation | Owner |
|---|------|---|---|------------|-------|
| AR1 | **Partial-failure corruption** (some effects done, process fails → money/inventory inconsistent) | M | H | Saga compensation in reverse; idempotent effects; failed-compensation → P0 remediation task; chaos tests (A9) | Workflow Eng |
| AR2 | **Duplicate side effects** (double charge/notify on retry/redelivery) | M | H | Idempotency keys per run+step+effect; provider idempotency keys; `processed_events` dedupe; tests (A2) | Workflow Eng |
| AR3 | **Stuck/zombie runs** (waiting forever, no escalation) | M | M | Timeouts on every wait + `on_timeout` action; stuck-run dashboard + alerts; SLA escalation | Workflow Eng |
| AR4 | **Workflow version chaos** (changing logic breaks in-flight runs) | M | M | Immutable pinned versions; in-flight runs finish on their version; explicit migration tooling (A8) | Workflow Eng |
| AR5 | **Event loss or phantom events** | L | H | Outbox pattern (transactional); at-least-once + idempotent consumers; DLQ + replay | Platform Eng |
| AR6 | **Engine limits surprise** (max step/run duration, concurrency caps blow up long workflows) | M | H | `⚠️ VERIFY` engine limits before design; spike W9 (multi-day); design long-waits as durable sleeps not held compute | Automation Architect |

## AI / agent risks
| # | Risk | L | I | Mitigation | Owner |
|---|------|---|---|------------|-------|
| AR7 | **Agent overreach** (autonomous agent does irreversible harm — wrong refund, bad customs call) | M | H | Suggest-by-default; autonomy tiers; human approval for irreversible/high-value; delegated tool-scoped tokens (A4/A6) | AI Orchestration Lead |
| AR8 | **Prompt injection via untrusted content** (customer msgs, docs, web) | M | H | Treat untrusted content as data not instructions; guardrails; tool gating + approval; red-team suite | AI Orchestration Lead |
| AR9 | **Runaway agent cost / loops** | M | H | Turn + cost caps per run; per-org budgets + alerts; loop detection; cheap-model routing; caching (A11) | AI Orchestration Lead |
| AR10 | **Agent quality regression / hallucination** affecting decisions | M | M | Eval + red-team gates in CI; online scoring; human-override-rate tracking; gradual rollout behind flags | AI Orchestration Lead |
| AR11 | **Cross-tenant leakage via agent memory/RAG** | L | H | Org-scoped RLS-isolated memory; ACL-filtered retrieval; cross-tenant tests | AI + DevSecOps |
| AR12 | **LangGraph↔engine checkpoint integration fails** for long-waiting agents | M | M | Spike integration early (riskiest); fallback to engine-native waits around agent calls; `⚠️ VERIFY` | AI Orchestration Lead |

## Approval / human-process risks
| # | Risk | L | I | Mitigation | Owner |
|---|------|---|---|------------|-------|
| AR13 | **Approval bottlenecks** (humans become the throughput limit) | H | M | Route only what needs a human (rules); SLAs + escalation; auto-approve low-risk reversible cases; monitor approval volume | Platform PM |
| AR14 | **Bad approvals from poor context** | M | M | Context assembly is part of the step; show AI rationale + docs + history; require comments on overrides | Platform PM |
| AR15 | **Self-approval / segregation failure** | L | H | Enforce requester≠approver; policy-level separation of duties; audit | DevSecOps |

## Security / tenancy risks
| # | Risk | L | I | Mitigation | Owner |
|---|------|---|---|------------|-------|
| AR16 | **Workflow/agent privilege escalation** (acts beyond mandate) | M | H | Declared least-privilege scopes; deny-by-default engine; scoped execution identities; audit (A5) | DevSecOps |
| AR17 | **Secret leakage in definitions/logs** | M | H | Secrets manager refs only; redaction; secret-scan gate | DevSecOps |
| AR18 | **Webhook spoofing / replay floods** | M | M | Signature verification; dedupe; rate limits; IP allowlists | DevSecOps |
| AR19 | **Cross-tenant run data exposure** | L | H | RLS on all tables; gateway-set tenant context; isolation tests | DevSecOps |

## Integration / external risks
| # | Risk | L | I | Mitigation | Owner |
|---|------|---|---|------------|-------|
| AR20 | **Provider outage** (Stripe/Twilio/customs/model down) cascades | M | H | Circuit breakers; durable queue + retry; graceful degradation; runbooks (§11) | Platform Eng |
| AR21 | **External API changes/limits** break integrations | M | M | Integration registry + adapters; `⚠️ VERIFY` limits; contract tests; alerting | Platform Eng |

## Delivery / org risks
| # | Risk | L | I | Mitigation | Owner |
|---|------|---|---|------------|-------|
| AR22 | **Over-engineering before BorderPass ships** (building all 12 + full agents in MVP) | H | M | Strict MVP spine (money path); deferred list; suggest-only AI in MVP | CTO |
| AR23 | **Coupling automation to BorderPass specifics** | M | H | Generic engine/registries; BorderPass as tenant; future-app examples (§15) as design check | Automation Architect |
| AR24 | **Two event/notification stacks** (rebuilding platform services) | M | M | Reuse platform services; automation orchestrates, doesn't re-implement | Automation Architect |
| AR25 | **Observability gaps make async bugs unfindable** | M | H | Tracing + correlation from day one; run history + replay; stuck-run/DLQ alerts | Platform Eng |

---

## Top-5 watchlist (every sprint)
1. **AR7/AR9 — Agent overreach & runaway cost** (newest, least-bounded; suggest-by-default + caps + approvals).
2. **AR1/AR2 — Corruption & duplicate effects** (money-critical; saga + idempotency + chaos tests must stay green).
3. **AR6/AR12 — Engine limits & LangGraph integration** (could force redesign; spike early).
4. **AR13 — Approval bottlenecks** (the most likely *operational* failure; route only what needs humans).
5. **AR22 — Over-engineering vs. shipping BorderPass** (the most likely *delivery* failure).

## Verification debt (`⚠️ VERIFY`)
Resolve every `⚠️ VERIFY` (engine step/run/concurrency limits + pricing, LangGraph checkpointer integration, Upstash/Neon limits, WhatsApp template rules, provider webhook signing, model pricing) into an ADR before depending on it. Unverified third-party assumptions are risk, not fact.
