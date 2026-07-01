# Scorecard: mickasmt/next-saas-stripe-starter

**Validation status:** Research-based (public sources). NOT cloned, built, or scanned locally.
**Researched:** 2026-06-30 (data approximate, as of early/mid 2026)

## Identity
- **Full name:** mickasmt/next-saas-stripe-starter
- **URL:** https://github.com/mickasmt/next-saas-stripe-starter
- **License:** MIT (low risk)
- **Primary language:** TypeScript (~81%)

## Health & Activity
- **Stars:** ~3k (approx)
- **Forks:** ~625 (approx)
- **Open issues:** ~17
- **Last release:** v1.0.0 (Jun 2024)
- **Recent activity:** ~177 commits; meaningfully maintained historically, but last tagged release ~2 years old and stack pinned to Next.js 14 — **freshness/abandonment risk rising**. Solo maintainer. Responsiveness: **Unverified**.

## Tech Stack
- **Next.js 14** (older — predates App Router maturity changes in 15/16), React 18
- Auth.js v5 (NextAuth) — **not Supabase Auth**
- **Prisma ORM** — **not Supabase client / not Drizzle**
- Neon (serverless Postgres)
- Stripe (subscriptions)
- Resend + React Email
- Contentlayer (MDX blog)
- Tailwind + shadcn/ui

## Features
- Auth: Auth.js v5, role-based access (user/admin)
- Billing: Stripe subscription management
- Admin dashboard: Yes
- Email: Resend + React Email
- Blog: MDX via Contentlayer (note: Contentlayer maintenance has historically been uncertain — dependency risk)
- Teams/orgs: **No / Unverified**
- RLS: N/A (Prisma + Neon, app-layer access control, no Supabase RLS)
- Multi-tenancy: No
- AI workflow support: No

## Docs / CI / Deploy
- Docs: README with install, stack, env example
- Tests/CI: No explicit test suite mentioned — **weak**
- Deploy: Vercel one-click

## Scoring (1-5)
| Dimension | Score | Rationale |
|---|---|---|
| Repo health | 3 | Popular, but last release ~2yr old, solo maintainer, rising staleness |
| Stack freshness | 2 | Next.js 14 + Contentlayer (questionable upkeep); behind the Next 15/16 cohort |
| Feature completeness | 3 | Auth + billing + admin + email + blog; no teams/multi-tenancy |
| Security posture (documented) | 3 | Auth.js v5 is solid; app-layer roles, no DB-level RLS, no documented hardening |
| Docs quality | 3 | Functional README, limited depth |
| Production readiness | 2 | Aging stack, no tests/CI, Contentlayer dependency risk |
| Maralito-stack fit | 2 | Prisma + Neon + Auth.js diverges from Supabase + RLS stack |
| License safety | 5 | MIT |
| **Overall** | **23 / 40** | Useful UI/admin/email reference, but stack is the furthest from Maralito and aging |

**Best used as:** Admin-dashboard UI + Resend/React-Email layout reference and Auth.js v5 example. Reference-only; avoid as a foundation due to Next.js 14 + Contentlayer staleness and non-Supabase data/auth layer.
