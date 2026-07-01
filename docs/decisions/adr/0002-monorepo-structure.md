# ADR 0002 — Monorepo structure (pnpm + Turborepo, app + granular packages)

- **Status:** Accepted · **Date:** 2026-06-29 · **Phase:** 0

## Context
BorderPass is the first app on the shared Maralito Platform; future Maralito apps should reuse
the same shared services. We need a structure that is modular and contract-bounded.

## Decision
Single **pnpm + Turborepo** monorepo at the workspace root:
- `apps/borderpass` — the app (single app, route groups; ADR 0001).
- `packages/*` — shared, reusable: `config, ui, validation, sdk, db, auth, payments, notifications, automation, ai, observability`.
- `docs/*` — all planning/architecture docs (relocated in Phase 0).
- `infra/` (Phase 1+) Terraform; `.github/workflows` CI.

Planning docs were **moved** (not copied) from `borderpass/*` and `maralito-platform/*` into the
`docs/` taxonomy, preserving folder units so same-folder links survive.

## Rationale
- Shared packages let future Maralito apps consume the platform via the same boundaries.
- `@maralito/*` packages enforce a contract-only boundary (lint rule); apps never deep-import platform internals.
- Turborepo caching for build/lint/typecheck/test.

## Consequences
- A few cross-folder doc links may need fixing (tracked in `phase-0/known-gaps.md`).
- `@maralito/sdk` is a typed **placeholder** in Phase 0; real surface confirmed before Phase 1.

## Alternatives considered
- **Separate BorderPass repo:** more isolation, loses shared-code atomicity — rejected for this stage.
