# Scorecard: imbhargav5/nextbase-nextjs-supabase-starter (Nextbase)

**Validation status:** Research-based (public sources). NOT cloned, built, or scanned locally.
**Researched:** 2026-06-30 (data approximate, as of early/mid 2026)

## Identity
- **Full name:** imbhargav5/nextbase-nextjs-supabase-starter
- **URL:** https://github.com/imbhargav5/nextbase-nextjs-supabase-starter
- **License:** MIT (free/OSS starter)
- **Primary language:** TypeScript (~90%)

## Health & Activity
- **Stars:** ~800 (approx)
- **Forks:** ~200 (approx)
- **Open issues:** ~4
- **Last tagged release:** v2.2.0 (Nov 2023) per release page — **but** README advertises Next.js 16 / React 19 / Cache Components, implying the default branch was updated much more recently than the last tag. **Discrepancy flagged — verify locally before trusting "freshness."**
- **Recent activity:** README and changesets suggest ongoing updates; release cadence via tags appears stale. Responsiveness: **Unverified**.

## Tech Stack (per README — Unverified against lockfile)
- Next.js 16+ (App Router, Cache Components), React 19
- Supabase (Auth SSR, Postgres + RLS, Storage)
- next-safe-action + Zod (type-safe server actions)
- shadcn/ui on Radix, Tailwind v4
- TanStack Query + React Suspense
- Testing: Vitest, Testing Library, Playwright
- Turborepo + pnpm; oxlint/oxfmt; Changesets
- ORM: none — direct SQL migrations + generated types
- Stripe/Resend: **NOT in free starter** (premium kit only)

## Features (free starter)
- Auth: SSR-correct Supabase auth, OAuth, multiple methods (strong)
- DB/permissions: RLS policies, timestamped migrations, generated types
- Type-safe server actions (next-safe-action + Zod)
- Caching: Next.js 16 Cache Components, documented strategy
- Multi-tenancy: row-level tenant-isolation patterns documented
- Testing: unit + integration + E2E scaffolding
- Billing/Stripe: **No** (premium)
- Teams/RBAC/admin dashboard: **No** (premium)
- Transactional email (React Email): **No** (premium)
- AI starter kits: **No** (premium)

## Ecosystem note
Nextbase has a commercial line (usenextbase.com) with billing, teams, RBAC, admin, email, and AI kits behind a paid license. Same "free funnel + paid kit" model as Makerkit — don't copy paid code.

## Docs / CI / Deploy
- Docs: Strong — architecture diagrams, dedicated Cache Components guide, troubleshooting
- Tests/CI: GitHub Actions for Playwright + coverage (good signal)
- Deploy: Vercel-ready, Node 22+; local Supabase lifecycle scripts

## Scoring (1-5)
| Dimension | Score | Rationale |
|---|---|---|
| Repo health | 3 | Active README/changesets but stale release tags and solo-author bus factor; Unverified support |
| Stack freshness | 4 | README claims very modern stack (Next 16/React 19/Tailwind v4) — high if accurate, but discrepancy with old tag knocks confidence |
| Feature completeness | 3 | Excellent auth/RLS/testing foundation; no billing/teams/email in free tier |
| Security posture (documented) | 5 | Defense-in-depth: SSR auth + RLS + middleware + Zod validation, explicitly documented |
| Docs quality | 5 | Architecture diagrams, caching + troubleshooting guides |
| Production readiness | 4 | Strong testing/CI and security; missing billing/teams for full SaaS |
| Maralito-stack fit | 5 | Next.js + Supabase + Turborepo + RLS + server actions matches closely |
| License safety | 5 | MIT (free starter). Paid kit is separate license |
| **Overall** | **34 / 40** | Best free OSS reference for Supabase RLS + modern Next.js patterns |

**Best used as:** RLS / SSR-auth / type-safe-server-action pattern reference and multi-tenant isolation reference. Strongest free-tier security model of the SaaS starters reviewed. Verify the claimed Next.js 16 stack against the actual default branch before citing freshness.
