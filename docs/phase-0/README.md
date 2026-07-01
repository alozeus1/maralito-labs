# Phase 0 — Technical Foundation

**Goal:** a safe, modular, documented foundation for the BorderPass MVP — no business flows.

## Deliverables (this folder + repo)
- Repo scaffold + monorepo structure (`/`, `apps/borderpass`, `packages/*`) — ADR 0001/0002
- Env template (`/.env.example`, names-only) · security-gated CI (`.github/workflows/ci.yml`) — ADR 0003
- Placeholder shared packages (typed boundaries) incl. `@maralito/sdk` placeholder
- Spike (`spike/checkpointer-inngest/`) + results (`spike-results.md`) — ADR 0004
- Docs: this README · `architecture-notes.md` · `decision-log.md` · `known-gaps.md` · `phase-1-readiness-checklist.md` · `completion-report.md`

## What Phase 0 intentionally does NOT do
No auth flows, no order/quote/payment/admin/AI business logic, no DB schema, no real provider wiring.
