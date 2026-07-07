# Phase 7 — Row 11 OTP Smoke — Attempt Log (owner signed in; ROOT CAUSE identified)

- **Timestamp (UTC):** 20260707T024113Z
- **Outcome:** BLOCKED — but root cause now identified as **client-side (browser extension), not the Supabase backend.** Row 11 remains 🔲 UNRUN.

## What happened

- Owner signed into the Supabase dashboard; agent entered all four redirect URLs and clicked **Save URLs**:
  `http://localhost:3000/**`, `http://localhost:3000/auth/callback`,
  `https://borderpass-a5u9p3z3h-alozeus-projects.vercel.app/**`, `…/auth/callback`.
- Save failed; page reload shows **"No Redirect URLs"** (nothing persisted).

## Root cause (NEW — supersedes the "platform incident" explanation for this failure)

Browser console at save time:
`TypeError: Failed to fetch (api.supabase.com)` originating at
`chrome-extension://bkkbcggnhapdmkeljlodobbkopceiche/injectScriptAdjust.js` — i.e. a **browser extension in
this Chrome profile is wrapping `window.fetch` and the dashboard's save request to `api.supabase.com` fails at
that layer.** The CORS preflight (`OPTIONS …/auth/<ref>/config`) returns 204, but the actual mutating request
never completes. This is consistent across every prior attempt (2026-07-02 → 07-07) and better explains the
persistent failure than the (now-recovered) platform incident does.

## The fix (owner, ~1 minute — pick either)

1. **Save in a clean browser context:** open the URL Configuration page in a browser/profile **without** the
   ad-block / privacy / script-blocking extension (e.g. a fresh Chrome profile, Incognito with extensions off,
   or Safari/Firefox), add the four redirect URLs above, and Save. It should persist immediately.
2. **Or** pause the offending extension for `supabase.com` + `api.supabase.com`, reload, and Save.

Then verify the four URLs remain after a page reload.

## After redirect URLs are saved — run the OTP smoke (synthetic only)

`pnpm --filter borderpass dev` → open `http://localhost:3000` → sign in with a **synthetic** email alias →
complete OTP → verify: session created · customer dashboard loads · provisioning idempotent on re-login ·
logout · second login clean. Record redacted yes/no evidence and tick Row 11 **only on a full PASS**. (Handing
this back to the agent once the redirect URLs are saved is fine — the automation can drive the localhost smoke.)

## Gate status

Row 11: 🔲 UNRUN (unblocks the moment the 4 redirect URLs save in a clean browser) · Row 18: per ledger ·
Row 19: 🟡 conditional Option B · Private testers: **BLOCKED.**
