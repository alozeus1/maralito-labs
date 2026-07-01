# 17 · Metrics & KPIs

Product, business, operations, and AI metrics. Each: definition, why it matters, and an indicative target to ratify with the pilot (targets are starting hypotheses, `⚠️ VERIFY` with real data). Instrumented via Analytics (PostHog) + platform data; AI metrics from the AI/agent layer.

---

## 17.1 Product / activation
| Metric | Definition | Why | Indicative target |
|--------|------------|-----|-------------------|
| **Activation rate** | % of signups who submit a first request | Onboarding→intent works | ≥ 40% pilot |
| **Request completion rate** | % of started requests that reach `submitted` | New Request flow usability | ≥ 70% |
| **Quote acceptance rate** | % of `quote_ready` accepted | Quote trust + pricing fit | ≥ 50% |
| **Payment conversion** | % of accepted quotes that reach `paid` | Checkout friction | ≥ 85% |
| **Repeat purchase rate** | % of customers with ≥ 2 orders (window) | Trust/retention (north star) | ≥ 30% by 90d |

## 17.2 Business / financial
| Metric | Definition | Why | Indicative target |
|--------|------------|-----|-------------------|
| **Average order value (AOV)** | Avg total per order | Revenue sizing | track/segment |
| **Average service fee** | Avg BorderPass fee per order | Core revenue unit (Stitch $15 base) | track |
| **Customer lifetime value (CLV)** | Projected margin per customer | Acquisition economics | grow QoQ |
| **Refund rate** | % orders refunded | Quality + financial leakage | ≤ 5% |
| **Gross margin / order** | Revenue − cost (incl. ops, AI, duties pass-through) | Unit economics | positive at pilot end |

## 17.3 Operations
| Metric | Definition | Why | Indicative target |
|--------|------------|-----|-------------------|
| **Delivery success rate** | % delivered on first/within attempts | Core reliability | ≥ 95% |
| **Inspection failure rate** | % inspections failed | Sourcing/quality + fraud signal | ≤ 5% (monitor) |
| **Border delay frequency** | % orders with a customs/border delay | Experience risk; comms trigger | minimize; track reasons |
| **Avg cycle time** | Submit → delivered duration | Speed promise | establish baseline |
| **Hub throughput** | Packages processed/day | Capacity planning | scale with volume |
| **On-time delivery** | % delivered by promised ETA | Trust on promises | ≥ 90% |

## 17.4 Support / experience
| Metric | Definition | Why | Indicative target |
|--------|------------|-----|-------------------|
| **Support response time** | First response latency | Concierge promise (critical for no-visa) | ≤ 15 min (business hrs) |
| **Resolution time** | Time to resolve a ticket | Issue handling | ≤ 24h standard |
| **CSAT / rating** | Post-delivery + support satisfaction | Trust health | ≥ 4.5/5 |
| **Concierge rating** | Per-concierge rating (Stitch shows ratings) | Service quality | ≥ 4.5/5 |

## 17.5 AI / automation
| Metric | Definition | Why | Indicative target |
|--------|------------|-----|-------------------|
| **AI automation rate** | % steps/decisions handled by agents without human action | Efficiency/scaling | grow over time (MVP low) |
| **Human override rate** | % agent recommendations a human changes/rejects | **Trust + agent quality** (key signal) | ↓ over time |
| **Agent error rate** | % agent runs with errors/incorrect outputs | Safety/quality | ≤ target; alert on spikes |
| **AI cost per order** | Model/agent $ per order | Unit-economics control (A11) | within budget |
| **Eval pass rate** | % agent eval suite passing | Regression guard | 100% on release |
| **Guardrail trigger rate** | % runs hitting guardrails | Safety monitoring | monitor anomalies |

---

## 17.6 KPI framework
- **North-star metric:** **Repeat purchase rate** (trust made measurable) — supported by CSAT, delivery success, and on-time delivery.
- **Funnel view:** signup → activation → request completion → quote acceptance → payment conversion → delivery → repeat. Optimize the weakest stage each cycle.
- **Guardrail metrics:** refund rate, inspection failure rate, border delay frequency, agent error rate — must stay within bounds even as growth metrics rise.
- **AI trust loop:** human-override rate + agent error rate gate how much autonomy we grant (agents earn autonomy by being right).
- **Segmentation:** by service type (buy-for-me/reception/business), persona, channel, and corridor — for targeted improvement and future expansion.
- **Cadence:** weekly ops review (operations + support + AI), monthly business review (financial + retention), continuous alerting on guardrails.

## 17.7 Instrumentation notes
- Product events via PostHog (taxonomy defined with analytics); financial from Payments/ledger; ops from workflow/task data; AI from agent runs + cost ledger.
- Every KPI has an owner, a dashboard tile (16 · Analytics), and (for guardrails) an alert with a runbook.
- `⚠️ VERIFY` all indicative targets against pilot data before treating as commitments.
