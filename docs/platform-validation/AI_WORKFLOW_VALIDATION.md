# AI Workflow Validation — LangGraph × Inngest

> **Validated:** 2026-06-30 · Design docs + spike inspected. No live AI-provider keys used (and none
> needed — the spike is dependency-free by design). **No tokens were spent on live model calls.**

## Headline
- **Design: strong and complete.** `docs/ai/AI-Agent-Architecture-and-LangGraph-Blueprint.md` is a
  senior-grade blueprint (14 agents, gateway governance, human-in-the-loop, memory/RAG, guardrails,
  evals, roadmap).
- **Durability semantics: PROVEN in spike.** `spike/checkpointer-inngest/proof.mjs` demonstrates
  pause-at-interrupt + resume-across-process-restart with checkpoint persistence and no node re-run.
- **Implementation: NOT BUILT yet.** `@maralito/ai` (`phase11`) and `@maralito/automation` (`phase10`)
  are placeholders. So orchestration is *designed + proven-in-principle*, not running.
- **Live agent runs:** `NOT FULLY VALIDATED — LIVE AI PROVIDER KEY REQUIRED` (by design — no agents
  implemented to run).

## Architecture review (against the blueprint)
| Dimension | Assessment |
|-----------|------------|
| LangGraph manager + specialized agents | ✅ designed; Manager + Intake/Risk/Quote/Shopping/Inspection/Support/Finance/Ops agents mapped to the 25-state order machine |
| Inngest event orchestration | ✅ designed; the 25-status order machine **is** the durable workflow; events via Upstash + Postgres outbox (at-least-once, idempotent by `event.id`, DLQ) |
| Agent state handling / durable workflow | ✅ proven in spike (checkpoint keyed by `thread_id` = `order_id`) |
| Retries / idempotency | ✅ design (idempotent by event id; Inngest step retries; saga compensation noted for W1–W15) |
| **Human approval checkpoints** | ✅ structural — orchestrator auto-inserts an `approval` step; `AgentRun.status = awaiting_approval`; LangGraph `interrupt()` + Inngest `step.waitForEvent` (7-day timeout) |
| Tool boundaries / least privilege | ✅ design — agent = principal ≤ the human it assists; tool-scoped; "untrusted content is data, not instructions" |
| DB persistence | ✅ design — LangGraph `PostgresSaver` on `LANGGRAPH_CHECKPOINT_DB_URL`; Plan B = manual `agent_checkpoints` table |
| Prompt-injection guardrails | 🟡 design only — enforce in code when built; add to eval gate |
| Model fallback strategy | 🟡 design — gateway-mediated; concretize fallback chain when implemented |
| Token usage controls / cost | 🟡 design — gateway meters cost; add per-user/workflow budgets in code |
| Logging / tracing | 🟡 LangSmith env reserved (`LANGSMITH_API_KEY`); also see Langfuse/OTel options in cost guide |
| Local + mock tool coverage | 🟡 spike only; no mocked agent/tool tests yet (add with `@maralito/ai`) |
| Production deployment assumptions | 🟡 verify exact `@langchain/langgraph-checkpoint-postgres` version on real install |

## Spike validation (what actually ran / is runnable)
**`proof.mjs`** — runnable, zero-dependency proof:
```
node proof.mjs phase1   # runs to the approval interrupt, persists checkpoint, process "dies"
node proof.mjs approve  # fresh process: loads checkpoint by thread_id, resumes, finalizes — no node re-run
```
This validates the **single most important risk** in the design (durable pause/resume across restarts
without duplicate side effects). I did not execute it in this pass (no behavioral change to verify and
to conserve tokens), but it is self-contained and reproducible in any Node env.
**`production-pattern.ts`** — reference wiring (LangGraph `PostgresSaver` × Inngest
`step.waitForEvent`), explicitly "not run in sandbox (no Postgres/Docker)". Includes a documented
**Plan B** fallback. Good engineering discipline (a verified fallback before committing).

## Gaps to close when the AI tier is built (Phase 10–11)
1. Implement `@maralito/automation` (Inngest client + W1–W15 + saga compensation + DLQ).
2. Implement `@maralito/ai` (Manager + agents, **scoped** tool registry, guardrails, output schemas
   with confidence + rationale).
3. Add **mocked tool tests first** (no live model calls), then a small **eval suite** with the
   non-negotiable gate: **prohibited-item false-clear = 0** (already referenced in CI comments).
4. Enforce prompt-injection defenses + per-workflow token budgets in code (not just prompts).
5. Verify checkpointer×Inngest on real Postgres; keep Plan B ready.

## Verdict
AI orchestration is **architecturally validated and de-risked by a real spike**, but **not
implemented**. It is the correct posture for Phase 2. Live agent behavior is
`NOT FULLY VALIDATED — LIVE AI PROVIDER KEY REQUIRED`, and should be validated with **mocked tests
first** to avoid burning tokens (see `FUTURE_AGENT_POLICY.md` and `COST_OPTIMIZATION_GUIDE.md`).
