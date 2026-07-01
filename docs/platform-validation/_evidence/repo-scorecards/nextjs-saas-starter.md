# Scorecard: nextjs/saas-starter (Official Next.js / Vercel SaaS Starter)

**Validation status:** Research-based (public sources). NOT cloned, built, or scanned locally.
**Researched:** 2026-06-30 (data approximate, as of early/mid 2026)

## Identity
- **Full name:** nextjs/saas-starter
- **URL:** https://github.com/nextjs/saas-starter
- **License:** MIT (low risk)
- **Primary language:** TypeScript (~93%)

## Health & Activity
- **Stars:** ~16k (approx) — by far the most popular in this set
- **Forks:** ~2.7k (approx)
- **Open issues:** ~21
- **Last release:** Not tagged / Unverified (template repo, used via clone not versioned releases)
- **Recent activity:** Maintained under the Next.js org / Vercel; strong visibility. Note: this is a **reference template**, not a long-roadmap product — updates can be sporadic.

## Tech Stack
- Next.js (App Router), TypeScript
- Postgres (works well with Neon; Vercel Postgres)
- **Drizzle ORM** (note: NOT Supabase — different DB/data layer than Maralito if Maralito uses Supabase)
- Stripe (checkout + customer portal)
- shadcn/ui
- Auth: **custom email/password with JWT stored in cookies** (no Supabase Auth, no NextAuth)

## Features
- Auth: email/password, self-rolled JWT-in-cookie sessions
- Billing: Stripe subscriptions + customer portal + webhooks
- Teams/orgs: Yes — team support with RBAC (Owner/Member roles)
- Activity logging system
- Dashboard with CRUD
- Middleware route protection
- Marketing + pricing pages
- RLS: N/A (not Supabase; access control is app-layer, not Postgres RLS)
- Email: **Unverified / minimal**
- Multi-tenancy: team-scoped (app-layer)
- AI workflow support: No

## Docs / CI / Deploy
- Docs: README with setup, Stripe webhook config, test cards
- Tests/CI: No explicit test suite / CI mentioned — **weak**
- Deploy: Vercel-first

## Scoring (1-5)
| Dimension | Score | Rationale |
|---|---|---|
| Repo health | 4 | Huge community, official org backing; but template (not roadmap product), Unverified release cadence |
| Stack freshness | 4 | Modern Next.js + Drizzle + Stripe; canonical Vercel patterns |
| Feature completeness | 4 | Auth + Stripe + teams + RBAC + activity log out of the box |
| Security posture (documented) | 3 | Self-rolled JWT-in-cookie auth (correctness depends on impl); app-layer access control, no DB-level RLS |
| Docs quality | 3 | Adequate README; less depth than Nextbase/Makerkit |
| Production readiness | 3 | Good feature core but no tests/CI and hand-rolled auth raise diligence cost |
| Maralito-stack fit | 2 | Drizzle + Postgres + custom JWT auth diverges from a Supabase-based stack; strong fit only if Maralito uses Drizzle/Neon |
| License safety | 5 | MIT |
| **Overall** | **28 / 40** | Canonical teams/RBAC + Stripe reference, but different data/auth layer |

**Best used as:** Teams/RBAC + activity-log + Stripe-in-App-Router reference (Drizzle/Neon idioms). Reference-only for a Supabase stack — the auth and data layers do not transfer to Supabase Auth + RLS.
