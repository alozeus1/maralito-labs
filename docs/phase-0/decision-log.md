# Phase 0 — Decision Log

| # | Decision | Choice | ADR |
|---|----------|--------|-----|
| 1 | App structure | Single app + route groups (discard web/admin split) | 0001 |
| 2 | Monorepo | pnpm + Turborepo; app + granular `packages/*`; docs relocated to `docs/` | 0002 |
| 3 | Security CI | gitleaks + semgrep + osv-scanner + pnpm audit (free OSS; no paid platforms) | 0003 |
| 4 | Durable AI resume | LangGraph PostgresSaver × Inngest waitForEvent; Plan B documented | 0004 |
| 5 | DB / ORM / Storage | Supabase Postgres + Drizzle + Supabase Storage (locked earlier) | — |
| 6 | Engine | Inngest (not Trigger.dev) | — |
| 7 | Env naming | MARALITO_* / BORDERPASS_* / `<PROVIDER>_*` (incl. LANGGRAPH_*, INNGEST_*) | — |
| 8 | @maralito/sdk | Placeholder boundary in Phase 0; surface confirmed before Phase 1 | 0002 |

All choices align with the Master Build Package and Build Readiness Review.
