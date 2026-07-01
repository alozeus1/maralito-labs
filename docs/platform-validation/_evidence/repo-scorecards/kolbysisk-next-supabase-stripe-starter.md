# Scorecard: KolbySisk/next-supabase-stripe-starter

**Validation status:** Research-based (public sources). NOT cloned, built, or scanned locally.
**Researched:** 2026-06-30 (data approximate, as of early/mid 2026)

## Identity
- **Full name:** KolbySisk/next-supabase-stripe-starter
- **URL:** https://github.com/KolbySisk/next-supabase-stripe-starter
- **License:** MIT (low risk)
- **Primary language:** TypeScript (~90%)

## Health & Activity
- **Stars:** ~800 (approx)
- **Forks:** ~170 (approx)
- **Open issues:** ~18
- **Last release:** None published (no tagged releases)
- **Recent activity:** Appears maintained; low commit volume (small project). Maintainer support channel is Twitter/X (@kolbysisk) rather than formal issue triage — responsiveness signal: **Unverified**.

## Tech Stack
- Next.js 15, React (version Unverified, likely 18/19), TypeScript
- Supabase (Postgres + Auth + RLS enabled)
- Stripe (checkout, subscriptions, customer portal, webhook sync)
- Resend + React Email (transactional email)
- Tailwind CSS + shadcn/ui
- Package manager: Bun
- ORM: none explicit — direct Supabase client / SQL migrations
- Exact dependency versions: **Unverified** (package.json not inspected)

## Features
- Auth: Supabase auth (providers configurable)
- Billing: Stripe subscriptions + customer portal + webhook -> Supabase sync (strong)
- Teams/orgs: **Not present** (single-user oriented)
- Admin dashboard: **Unverified / likely none**
- RLS: Yes, enabled
- Email: Yes (Resend + React Email)
- Multi-tenancy: No
- AI workflow support: No

## Docs / CI / Deploy
- Docs: Good README with ~9-step setup, feature guides (products, schema, auth, styling, email)
- Tests/CI: No GitHub Actions / test suite mentioned — **weak**
- Deploy: Vercel one-click

## Scoring (1-5)
| Dimension | Score | Rationale |
|---|---|---|
| Repo health | 3 | Maintained but small, no releases, informal support, low bus factor (single author) |
| Stack freshness | 4 | Next.js 15, Supabase, Resend, modern UI; React version unconfirmed |
| Feature completeness | 3 | Solid auth+billing+email, but no teams/admin/multi-tenancy |
| Security posture (documented) | 4 | RLS enabled + Stripe webhook sync done correctly per docs |
| Docs quality | 4 | Clear step-by-step setup and feature guides |
| Production readiness | 3 | Good billing core but no tests/CI; abandonment risk on single maintainer |
| Maralito-stack fit | 5 | Near-exact stack match (Next.js + Supabase + Stripe + Resend + RLS) |
| License safety | 5 | MIT |
| **Overall** | **31 / 40** | Strong, narrowly-scoped billing+RLS reference |

**Best used as:** Billing + Stripe-webhook-to-Supabase sync reference and RLS pattern reference (single-tenant). Not a teams/multi-tenant source.
