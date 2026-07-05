# Phase 8A — Controlled HTTPS Preview Deployment Plan

> **Status:** EXECUTED IN PART (2026-07-05) — project created + preview deployed behind Deployment Protection;
> see `8a-preview-deployment-evidence.md`. **Env vars, Supabase redirects (incident-blocked), and the Stripe
> TEST webhook remain owner actions.** This plan enables the eventual on-device QA dry-run
> (8A.7) — it does **not** invite testers, and it makes no tester/staging/pilot/production readiness claim.
> Development-only · synthetic data only · **no real PII** · **Stripe TEST mode only** · no live payments.

## 1. Recommended host: Vercel preview deployment

- **Why:** already the recommendation in `docs/phase-7/mobile-private-testing-checklist.md` §1; native
  Next.js 15 App Router support; automatic HTTPS (required for PWA install, Supabase auth, Stripe);
  unlisted `*.vercel.app` preview URLs; env vars scoped per-environment in the Vercel secret manager
  (consistent with `env-secrets-review.md` — secrets never in the repo).
- **Setup (owner, dashboard):** create a Vercel project from the GitHub repo with **Root Directory
  `apps/borderpass`**; framework auto-detect (Next.js) + pnpm workspaces + Turborepo are detected from the
  lockfile — **no `vercel.json` is required or committed** (deliberate: dashboard-managed config, nothing to
  drift). Disable production promotion or point "production" at a preview-only branch; we use **preview
  deployments only** — no custom/production domain is claimed.
- **Access control:** enable Vercel **Deployment Protection** (Vercel Authentication or password) so the
  preview is reachable only by the owner/operator until the tester round is actually authorized.
- **Fallback (documented, not preferred):** Netlify with the Next runtime — same env-name list below; only if
  Vercel is unavailable.

## 2. Required environment variables (NAMES ONLY — values live in the host's secret manager)

| Name | Scope |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | public — **must be `pk_test_`** (UI shows the Test-mode badge) |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only |
| `DATABASE_URL` | server-only (dev-gate project pooler) |
| `STRIPE_SECRET_KEY` | server-only — **must be `sk_test_`** |
| `STRIPE_WEBHOOK_SECRET` | server-only (from the Stripe TEST webhook endpoint, §4) |
| `BORDERPASS_ENV` | server — set `preview` |

Point everything at the existing **`borderpass-dev-gate`** Supabase project (ref `rupqejwzmwfspvbmkmai`) —
synthetic data only. **Precondition:** the Row 18 rotation action should be completed when these secrets are
loaded into a new surface, per the ledger.

## 3. Supabase redirect URLs for the preview

Add in Dashboard → Auth → URL Configuration (currently blocked by the platform incident — same blocker as
Row 11): keep `http://localhost:3000/**` + `http://localhost:3000/auth/callback`, and add
`https://<project>-<hash>.vercel.app/**` + `…/auth/callback` for the specific preview URL (or a stable
preview alias — prefer a **stable alias** so the allow-list isn't churned per deployment). Only owner-controlled
origins; no wildcards beyond the app's own domain.

## 4. Stripe TEST webhook for the deployed preview

Local dev uses `stripe listen`; a deployed preview instead needs a **TEST-mode webhook endpoint** in the
Stripe dashboard → `https://<preview-host>/api/stripe/webhook`, events `payment_intent.*` (the 5 handled),
API version pinned 2024-06-20; copy its signing secret into `STRIPE_WEBHOOK_SECRET` (host secret manager only).
The webhook remains the only source of `paid`; delete the endpoint at teardown (§7). **Never** live keys —
the runtime refuses `sk_live_` by design.

## 5. PWA/HTTPS installability on the preview

HTTPS is automatic on Vercel. Verify after first deploy: `/manifest.webmanifest` 200 + linked,
`/icons/*` 200, `/sw.js` served with correct content type, add-to-home-screen launches standalone (iOS Safari
16.4+ + Android Chrome). Note: Vercel Deployment Protection can interfere with installed-PWA session flows —
if it does, use a password-protected preview rather than SSO protection for the QA window.

## 6. Mobile QA flow after deployment (still gated)

1. Owner confirms Row 18 rotation done + Row 11 unblocked (redirect save works, OTP smoke passes → ledger).
2. Deploy preview; verify §5 checks; add preview origin to Supabase redirects (§3).
3. Run `docs/phase-8/8a-device-qa-template.md` on ≥1 iOS Safari + ≥1 Android Chrome device with synthetic
   accounts; file results under `docs/phase-8/run-logs/`.
4. Only after that evidence + Row 19 Option B activation may an actual tester round be considered.

## 7. Rollback / removal

Vercel: delete the deployment(s) or the project (previews are immutable + individually deletable); remove the
preview origin from Supabase redirect URLs; delete the Stripe TEST webhook endpoint; rotate any secret that was
loaded into the host if the project is abandoned. Nothing else persists — the dev-gate DB stays synthetic.

## 8. Explicit tester-release blockers (unchanged by this plan)

Row 11 OTP smoke (external Supabase incident) · Row 18 open action per ledger · Row 19 Option B activation ·
8A.7 device dry-run evidence. Until all close: **no tester invites, no real PII, no live payments.**
