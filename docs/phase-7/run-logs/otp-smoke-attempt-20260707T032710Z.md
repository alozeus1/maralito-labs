# Phase 7 — Row 11 OTP Smoke — Attempt Log (redirects + keys DONE; new blocker: Next15/React18)

- **Timestamp (UTC):** 20260707T032710Z
- **Outcome:** BLOCKED by a pre-existing framework version incompatibility. Row 11 remains 🔲 UNRUN.

## Progress this session (real unblocks)

- ✅ **Redirect URLs saved + verified** in Supabase (owner, clean browser): `http://localhost:3000/**`,
  `http://localhost:3000/auth/callback`, `https://borderpass-a5u9p3z3h-alozeus-projects.vercel.app/**`,
  `…/auth/callback`. "Total URLs: 4". The earlier browser-extension fetch blocker is resolved.
- ✅ **Supabase env wired locally:** `.env.local` (repo root) now has `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (owner pasted; values not shown).
- ✅ Dev server boots and SSR returns `/login` → HTTP 200 with the sourced env.

## New blocker (the real one)

The `/login` page throws in the browser: **`TypeError: Cannot read properties of undefined (reading 'call')`**
from `next/dist/client/components/client-page.js` (webpack module factory). Diagnosis:

- `apps/borderpass/package.json` pins **`next: ^15.0.0`** (resolves to **15.5.19**) with **`react/react-dom: ^18.3.1`**.
- Next.js 15's App Router **client runtime requires React 19**; running it on React 18 produces exactly this error.
- App-resolved versions are react 18.3.1 + react-dom 18.3.1 (correctly paired), so it is **not** a react/react-dom
  mismatch — it is Next 15 ↔ React 18.
- **Why it was hidden:** every prior `pnpm build` hit Turbo's cache (">>> FULL TURBO", "cache hit") and replayed an
  old success; the app was never rendered fresh in a browser until this OTP attempt. `pnpm-lock.yaml` has shown
  modified since session start (a prior install bumped Next to 15.5.19).

Attempts that did NOT fix it (stopped after two, per debugging discipline): clear `.next` (×2), `pnpm install`
reconcile. The error is structural (framework/React version), not cache.

## Not auth, not 8A code

Row 11's auth config is now correct (redirects + keys + env). The 8A app code typechecks/lints clean. This is
purely a dependency-pin incompatibility that predates Phase 8A.

## Fix required (owner decision — changes framework baseline)

- **Option A — upgrade React to 19** (react + react-dom + @types + likely `@stripe/react-stripe-js` → v3).
  Matches Next 15's intended stack; more surface to test.
- **Option B — pin Next to 14.2.x** (keeps React 18 / Stripe v2.9). Smallest change to unblock now; moves off
  the intended Next 15.

Either is a reviewable change to implement on a branch with full verification (typecheck/lint/build/tests + this
OTP smoke) before merge. Row 11 stays 🔲 until then.
