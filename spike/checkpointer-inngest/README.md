# Spike: LangGraph Postgres checkpointer × Inngest

**Question:** can a durable Inngest workflow run a LangGraph agent step that **pauses at a
human-approval interrupt and resumes across a process restart**, with state persisted in Postgres,
without re-running completed nodes (no duplicate side effects)?

## What's here
- `proof.mjs` — **runnable**, zero-dependency proof of the durability semantics: a tiny graph with an
  interrupt, a checkpoint store keyed by `thread_id`, run across **two separate Node processes**
  (process death between = simulated restart).
- `production-pattern.ts` — **reference** wiring for the real stack (LangGraph `PostgresSaver` +
  Inngest `step.waitForEvent`). Not run in the sandbox (no Postgres/Docker); run in a real dev env.

## Run the proof
```
node proof.mjs phase1   # runs to the approval interrupt, persists checkpoint, "dies"
node proof.mjs approve  # fresh process: loads checkpoint by thread_id, resumes, finalizes
```
