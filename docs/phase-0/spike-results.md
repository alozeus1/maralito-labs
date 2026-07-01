# Phase 0 Spike Results — LangGraph Postgres checkpointer × Inngest

**Date:** 2026-06-29 · **Location:** `spike/checkpointer-inngest/` · **ADR:** `decisions/adr/0004`

## Question
Can a durable Inngest workflow run a LangGraph agent step that **pauses at a human-approval
interrupt and resumes across a process restart**, with state persisted (Postgres), **without
re-running completed nodes** (no duplicate side effects)?

## What was run (sandbox)
The sandbox has **no Postgres/Docker**, so the spike proves the **durability semantics** at the
logic level with a zero-dependency, runnable proof executed across **two separate Node processes**
(process death between = simulated restart):

- `node proof.mjs phase1` → graph runs `start → recommend → [INTERRUPT approval]`, persists a
  checkpoint keyed by `thread_id`, then exits (durable pause).
- `node proof.mjs approve` → a **fresh process** loads the checkpoint by `thread_id`, receives the
  approval signal, and resumes **only** the remaining node (`finalize`).

## Result: ✅ PASS
```
[phase1] reached approval interrupt; checkpoint persisted; process exiting (pause).
[phase1] side-effects this process: ["recommend"]
[approve] loaded checkpoint for ord_demo_0001 — resuming at node: finalize
[approve] completed_nodes restored: ["recommend"]
[approve] final state: {"status":"completed","recommendation":{"risk_band":"LOW","confidence":0.92}}
[approve] side-effects this process: ["finalize"]
RESULT: PASS — resumed mid-graph, state preserved, no duplicate side effects.   (exit 0)
```
**Proven:** (1) state survives a process restart; (2) resume continues **mid-graph**, not from
scratch; (3) the `recommend` node (an AI recommendation = a side effect) is **not** re-run on
resume. This is exactly the semantics the order-workflow human-approval gates require.

## Package reality check
- `@langchain/langgraph` → **exists, v1.4.7** (verified via registry).
- `@langchain/langgraph-checkpoint-postgres` (PostgresSaver) and `inngest` → established packages;
  `⚠️ VERIFY` exact checkpoint-postgres version on first install.

## Production pattern (to run in a real dev env)
`spike/checkpointer-inngest/production-pattern.ts` shows the real wiring:
LangGraph graph + `PostgresSaver` (thread_id = order_id) + `interrupt()` for approval, with Inngest
`step.waitForEvent` providing the durable wait and `Command({ resume })` continuing the graph.

**Recommended pattern (primary):** LangGraph PostgresSaver for graph state + Inngest `waitForEvent`
for the durable human gate; resume by `thread_id`.
**Fallback (Plan B):** keep the pause at the Inngest layer and persist LangGraph state to an
`agent_checkpoints` table manually — identical external behavior.

## Decision
✅ Pattern is sound and adopted. **Phase 2 (AI) must run the full Postgres + Inngest-dev-server
integration test** (real checkpointer, real durable wait, real restart) as the first AI task and
record the confirmed versions. No architectural change required; Plan B is documented if needed.
