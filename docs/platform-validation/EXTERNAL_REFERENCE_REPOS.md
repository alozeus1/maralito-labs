# External Reference Repos — References Only

> **Validated:** 2026-06-30 · Research-based (public GitHub/docs), **not cloned, built, or scanned**.
> Star/issue counts are approximate ranges as of early 2026. Detailed scorecards:
> `_evidence/repo-scorecards/`.

## Governing rule
`maralito-labs` is the source of truth. **Do not adopt any external repo as a base, and do not copy
code without proving the current repo lacks the capability.** Every repo below is a *reference* — a
place to borrow a pattern, not a replacement. None addresses a gap the Maralito platform can't fix
itself.

## SaaS / app starters
| Repo | Score /40 | What it does well | Does Maralito already cover it? | Verdict |
|------|:---------:|-------------------|:-------------------------------:|---------|
| **KolbySisk/next-supabase-stripe-starter** | 31 | Near-exact stack (Next+Supabase+Stripe+Resend); clean **Stripe-webhook→Supabase** sync + RLS (single-tenant) | ✅ stack; 🟡 Stripe sync (phase6 placeholder) | **Reference** for the Stripe-webhook→DB sync pattern when building `@maralito/payments`. Solo author, no tests/CI → don't adopt |
| **imbhargav5/nextbase** | 34 | Best **free OSS** for Supabase **RLS + SSR auth + multi-tenant** patterns | ✅ RLS + SSR auth already deeper here (withTenant, 17 tests) | **Reference** for multi-tenant org/team UI patterns. ⚠️ README claims Next 16 but last tag ~2023 — verify freshness. Don't adopt |
| **nextjs/saas-starter** (Vercel) | 28 | Canonical **teams/RBAC + activity log + Stripe**; official | 🟡 teams model is lighter here (org=tenant); activity-log ≈ audit-log | **Reference** for the teams/activity-log shape. Uses Drizzle/Neon + self-rolled JWT auth → diverges from Supabase. Don't adopt |
| **makerkit/nextjs-saas-starter-kit-lite** | 27 | Monorepo + Supabase-auth structure | ✅ monorepo + auth already stronger | **Reference (light).** "Lite" is a funnel; billing/teams/email are **paywalled** → **license risk if paid code is copied**. Don't adopt |
| **mickasmt/next-saas-stripe-starter** | 23 | Nice admin/email UI | 🟡 admin UI not built yet | **Reference (UI only).** Next 14 + Contentlayer aging; Prisma/Neon/Auth.js — furthest from Maralito. Lean avoid as base |

## AI / LangGraph
| Repo | Score /40 | What it does well | Maralito coverage | Verdict |
|------|:---------:|-------------------|:-----------------:|---------|
| **langchain-ai/langgraph** | 37 | The AI orchestration engine (Python); checkpointers, interrupts, durable graphs | ✅ already the chosen engine (ADR-0004) | **Adopt-reference** — it *is* the engine. Mirror its checkpointer/interrupt patterns |
| **JoshuaC215/agent-service-toolkit** | 33 | Best **FastAPI+LangGraph service-layer** blueprint (streaming, threads, feedback) | 🟡 Maralito runs AI via gateway + Inngest, not a separate FastAPI service (yet) | **Reference** for service-layer shape *if* a Python AI service is ever split out. Add API auth before any prod use |

## Better / newer alternatives discovered (`additional-candidates.md`)
| Repo | Why it matters for Maralito |
|------|------------------------------|
| **langchain-ai/langgraphjs** | **Top pick if the AI tier stays TypeScript** — keeps agents in *this* monorepo instead of a separate Python service. Strongly consider for `@maralito/ai` so the platform stays single-language (matches the "TypeScript everywhere" principle) |
| **assistant-ui** | **Top pick for the agent chat frontend** — LangGraph + Vercel AI SDK adapters, clean repo. Reference when building the customer/admin agent chat UI |
| **CopilotKit** | Heavier shared-state / generative-UI alternative — reference only if generative UI is needed |
| **langchain-ai/react-agent** | Minimal official ReAct template — reference for a first agent skeleton |

## Capability coverage matrix (current repo vs "do we need an external repo?")
| Capability | Maralito status | Need external base? |
|------------|-----------------|:-------------------:|
| Next.js App Router + route groups | ✅ implemented | No |
| Supabase auth + RBAC | ✅ implemented + tested | No |
| RLS + multi-tenant isolation | ✅ mechanism proven (17 tests) | No (Nextbase = pattern reference only) |
| Stripe billing | 🔌 phase6 placeholder | No — **borrow** KolbySisk webhook→DB pattern |
| Resend email | 🔌 phase9 placeholder | No — standard Resend SDK |
| Teams/orgs + admin | 🟡 org model + admin route group | No — **borrow** nextjs/saas-starter teams/activity-log shape |
| LangGraph orchestration | 🔌 phase10/11, spike proven | No — **mirror** langgraph(js) patterns |
| Agent chat UI | not started | No — **reference** assistant-ui when needed |

## Conclusion
**No external repo should be adopted as a foundation.** The one genuinely strategic decision they
surface is **TypeScript (`langgraphjs`) vs Python (`langgraph` + agent-service-toolkit)** for the AI
tier — recommend **langgraphjs** to keep the platform single-language and in-monorepo, unless a
Python-only library forces a split. Everything else is pattern-borrowing, not adoption.
