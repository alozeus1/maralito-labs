# ADR 0004 — LangGraph Postgres checkpointer × Inngest spike

- **Status:** Accepted (spike to run in Phase 0) · **Date:** 2026-06-29 · **Phase:** 0

## Context
The durable order workflow (Inngest) must run AI **agent steps** (LangGraph) that can **pause at a
human-approval interrupt and resume across process restarts**, with graph state persisted in
Postgres. This is the one integration risk that could affect the automation/AI architecture.

## Decision
Run a **throwaway spike** in `spike/checkpointer-inngest/` inside the monorepo to prove the
pause/resume pattern, then record the recommended integration pattern (or fallback).

- **Primary pattern:** LangGraph graph with `@langchain/langgraph-checkpoint-postgres` (PostgresSaver),
  invoked from an Inngest function; pause via LangGraph `interrupt` + Inngest `step.waitForEvent`;
  resume by rehydrating the checkpoint by `thread_id`.
- **Fallback (Plan B):** drive the approval pause at the **Inngest layer** (durable `waitForEvent`)
  and persist LangGraph state to a checkpoint table manually.

## Success criteria
State survives a simulated restart; the graph resumes mid-flow (not from scratch); no duplicate
side effects.

## Notes / constraints
- Sandbox has **no Postgres/Docker**, so the in-repo spike proves the pattern at the logic level
  (durable wait + checkpoint serialize/restore); the **full Postgres + Inngest-dev-server** run is
  documented for a real dev environment. `⚠️ VERIFY` exact JS checkpointer package name/version on install.

## Results
See `docs/phase-0/spike-results.md` (written when the spike runs).
