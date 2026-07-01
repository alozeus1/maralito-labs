# Scorecard: langchain-ai/langgraph

**Validation status:** Research-based (public sources). NOT cloned, built, or scanned locally.
**Researched:** 2026-06-30 (data approximate, as of mid 2026)

## Identity
- **Full name:** langchain-ai/langgraph
- **URL:** https://github.com/langchain-ai/langgraph
- **License:** MIT (low risk)
- **Primary language:** Python (~99%)

## Health & Activity
- **Stars:** ~36k (approx)
- **Forks:** ~6k (approx)
- **Open issues:** ~370 (high volume, but consistent with a large active framework)
- **Latest release:** 1.x line (e.g. ~1.2.x), released as recently as mid-2026 — **very active**
- **Recent activity:** ~7k commits, 550+ releases, company-backed (LangChain Inc). Strong maintenance signal; large issue count reflects scale, not neglect.

## What it is
Low-level orchestration framework for building **stateful, long-running agents** as graphs (nodes/edges + shared state). Foundational layer, not a turnkey app. Python-first; JS/TS equivalent is langgraphjs (see additional-candidates).

## Tech / Features
- Graph-based agent orchestration, explicit state machine control
- Durable execution + automatic failure recovery / checkpointing
- Human-in-the-loop via `interrupt()`
- Short- and long-term memory (Store)
- Deep LangSmith integration (tracing/observability)
- LangGraph Platform / Cloud for managed deployment (commercial, optional)
- Not Next.js/Supabase/Stripe related — this is the **AI workflow engine** layer

## Docs / CI / Deploy
- Docs: Comprehensive — concepts, API refs, quickstarts, LangChain Academy course
- Tests/CI: GitHub Actions present, mature CI
- Deploy: self-host (FastAPI patterns), Docker, or LangGraph Platform/Cloud

## Scoring (1-5)
| Dimension | Score | Rationale |
|---|---|---|
| Repo health | 5 | Company-backed, very high activity, frequent releases |
| Stack freshness | 5 | 1.x stable line, actively iterated in 2026 |
| Feature completeness | 5 | Durable execution, HITL, memory, persistence — comprehensive for agent orchestration |
| Security posture (documented) | 3 | Library-level; security depends on how you deploy/expose it (no app auth out of box) |
| Docs quality | 5 | Among the best in the AI-agent space |
| Production readiness | 5 | Used in production widely; mature persistence + observability |
| Maralito-stack fit | 4 | Ideal AI-workflow engine, but Python (if Maralito's backend is TS, prefer langgraphjs); pairs with FastAPI service layer |
| License safety | 5 | MIT (core). Platform/Cloud is a separate commercial offering |
| **Overall** | **37 / 40** | The reference AI orchestration engine; adopt as the workflow layer |

**Best used as:** AI orchestration / autonomous-workflow engine reference and likely **adopt-reference** for the agent layer. Choose Python (this repo) vs langgraphjs based on Maralito's backend language. Pair with a service layer (see agent-service-toolkit).
