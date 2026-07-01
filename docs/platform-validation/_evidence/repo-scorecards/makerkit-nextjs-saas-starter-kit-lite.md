# Scorecard: makerkit/nextjs-saas-starter-kit-lite

**Validation status:** Research-based (public sources). NOT cloned, built, or scanned locally.
**Researched:** 2026-06-30 (data approximate, as of early/mid 2026)

## Identity
- **Full name:** makerkit/nextjs-saas-starter-kit-lite
- **URL:** https://github.com/makerkit/nextjs-saas-starter-kit-lite
- **License:** MIT (lite version only)
- **Primary language:** TypeScript (~89%)

## Health & Activity
- **Stars:** ~440 (approx)
- **Forks:** ~155 (approx)
- **Open issues:** ~2 (low — but this is a free "lite" funnel, real support is on the paid product)
- **Last release:** None published
- **Recent activity:** Maintained; backed by a commercial company (Makerkit), so lower abandonment risk than a solo project. Responsiveness on the free repo: **Unverified** (paid customers get priority).

## Tech Stack
- Next.js 15, React (via Next 15), TypeScript
- Supabase (Postgres, PLpgSQL migrations)
- Tailwind CSS v4, shadcn/ui
- Zod, TanStack Query, i18next
- Turborepo monorepo
- Testing: Playwright (E2E)
- ESLint v9, Prettier
- Stripe/Resend: **NOT in lite** (paid kit only)

## Features (lite)
- Auth: Supabase auth flow (yes)
- User management: profile/settings pages (yes)
- Protected routes (yes)
- i18n (yes)
- Billing/subscriptions: **No** (paid kit)
- Teams/organizations: **No** (paid kit)
- Admin dashboard: **No** (paid kit)
- RLS: basic, not emphasized in lite
- Email/mailers: **No** (paid kit)
- Multi-tenancy: **No** (paid kit)
- AI workflow support: No

## Ecosystem note
Makerkit sells full commercial kits (Next.js+Supabase, Next.js+Firebase, Remix, etc.) with billing (Stripe/Lemon Squeezy), teams/orgs, super-admin, RBAC, blog/docs, monitoring (Sentry), and analytics. The lite repo is an **evaluation funnel** toward the paid product. The valuable production patterns are largely behind the paywall.

## Docs / CI / Deploy
- Docs: "still being updated" per README; commercial docs are stronger but gated
- Tests/CI: Playwright present; `.github` actions exist (details Unverified)
- Deploy: Vercel, Cloudflare (edge), Railway

## Scoring (1-5)
| Dimension | Score | Rationale |
|---|---|---|
| Repo health | 3 | Company-backed (good), but free repo is a marketing funnel with thin support |
| Stack freshness | 5 | Next.js 15, Tailwind v4, Turborepo, modern tooling |
| Feature completeness | 2 | Lite by design — no billing/teams/admin/email |
| Security posture (documented) | 3 | Supabase auth; RLS not emphasized in lite |
| Docs quality | 3 | README incomplete; best docs are paywalled |
| Production readiness | 2 | Lite is a prototype base; production features require paid kit |
| Maralito-stack fit | 4 | Same stack family (Next.js+Supabase), monorepo structure aligns |
| License safety | 5 | MIT (lite). Paid kit has its own commercial license — do not assume MIT for paid code |
| **Overall** | **27 / 40** | Good architecture reference, limited free feature surface |

**Best used as:** Monorepo / project-structure reference and Supabase-auth pattern reference. Treat as "evaluate, don't depend." For billing/teams patterns it points to a paid product — license risk if paid code is copied.
