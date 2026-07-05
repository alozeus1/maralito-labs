# Phase 8A — Controlled Preview Deployment — Evidence

> **Timestamp:** 2026-07-05 05:00 UTC · **Status:** preview deployed + verified behind Deployment Protection.
> Development-only. **Private testers remain BLOCKED.** No readiness claim of any kind.
> Synthetic data only · no real PII · Stripe TEST only · no live payments.

## Vercel project

| Item | Result |
|---|---|
| Project configured | **YES** — `alozeus-projects/borderpass` (created via authenticated CLI, linked at repo root; `.vercel/` + token files gitignored, nothing committed) |
| Root Directory | `apps/borderpass` (set in dashboard; "include files outside root" enabled — monorepo build works) |
| Framework | Next.js (auto-detected), pnpm via lockfile |
| **Deployment Protection** | **ENABLED — Vercel Authentication ("Standard Protection")**: previews require a logged-in team member. Verified in dashboard. |
| Production domain | **None configured; nothing promoted to production.** A first failed subdirectory deploy was deleted. |

## Preview deployment

| Item | Result |
|---|---|
| Attempted | YES (2 attempts: 1st failed — subdirectory upload broke `workspace:*` deps under npm; root-relink + Root Directory fixed it) |
| Result | **● Ready** (Preview environment, ~1 min build) |
| Hostname | `borderpass-a5u9p3z3h-alozeus-projects.vercel.app` |

## PWA checks on the deployed preview (via authenticated browser session)

HTTPS ✅ · welcome page renders with correct branding ✅ · `/manifest.webmanifest` 200 + `<link rel=manifest>` present ✅ ·
`/icons/icon-192.png` + `icon-512.png` + `apple-touch-icon.png` all 200 ✅ · `/sw.js` 200 ✅ ·
**service worker registered** ✅ · no console errors ✅.

## Environment variables

**NOT configured — deliberately left to the owner.** Entering credential values into external services is outside
what the agent will do; the app builds and serves public pages without them (guarded actions return safe
fallbacks). Owner adds these in Vercel → Settings → Environment Variables, **Preview scope only** (names only):
`NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_test_`)
· `SUPABASE_SERVICE_ROLE_KEY` · `DATABASE_URL` · `STRIPE_SECRET_KEY` (`sk_test_`) · `STRIPE_WEBHOOK_SECRET`
(TEST endpoint) · `BORDERPASS_ENV=preview` — values from the synthetic `borderpass-dev-gate` project only.

## Supabase redirect status

**STILL BLOCKED.** Attempted adding `http://localhost:3000/**`, `http://localhost:3000/auth/callback`, and the
specific preview host `…/​**` + `…/auth/callback`: same platform-incident failure signature (CORS preflight 204,
save request never completes, "No Redirect URLs" persists after reload, incident banner active). Row 11 remains
🔲 blocked. Note: per-deployment hostnames churn — when the incident clears, the owner may prefer allow-listing a
stable preview alias instead of per-deploy hosts.

## Stripe TEST webhook status

**NOT created (plan only).** When env vars are set and a QA window is scheduled: Stripe dashboard (TEST mode) →
endpoint `https://<preview-host>/api/stripe/webhook`, the 5 `payment_intent.*` events, API version 2024-06-20;
store the signing secret in Vercel (Preview scope). Delete the endpoint at teardown. Never live keys.

## Remaining blockers (unchanged)

Row 11 OTP (Supabase incident; also blocks preview redirect allow-listing) · env vars + Stripe TEST webhook
(owner) · Row 18 open action per ledger · Row 19 Option B activation · 8A.7 device dry-run evidence.

**No real PII was used; no live payments were used; no tester has access (Deployment Protection).**
