# ADR 0001 — Single Next.js app with route groups (not separate web/admin apps)

- **Status:** Accepted · **Date:** 2026-06-29 · **Phase:** 0
- **Deciders:** Lead Full-Stack Eng, Principal Platform Eng, Technical Architect (approved by product owner)

## Context
The Phase 0 brief suggested two apps (`apps/web` + `apps/admin`). The earlier locked Master
Build Package and Build Readiness Review specified a **single app with route groups**. We must
reconcile before scaffolding.

## Decision
Build **one Next.js App Router application** (`apps/borderpass`) with route groups:
`(public)`, `(auth)`, `(customer)`, `(admin)`. The two-app `web`/`admin` option is discarded.

## Rationale
- Shared layout, session, middleware, tenant-context, and design system across customer + admin.
- One deploy unit; simpler env/secret management and CI.
- RBAC layout guard isolates `(admin)`; route groups give clean separation without duplication.
- Matches the Technical Architecture (`apps/borderpass`, customer + admin route groups).

## Consequences
- Admin and customer ship together; bundle separation handled via route-group layouts + code-splitting.
- If isolation needs grow (separate scaling/teams), can split later (documented exit).

## Alternatives considered
- **Two apps (web + admin):** more isolation, but duplicated shell/config/auth and heavier ops — rejected for MVP.
