# Phase 7 — Row 11 OTP Smoke — Attempt Log

- **Timestamp (UTC):** 20260705T023231Z
- **Outcome:** BLOCKED — Supabase platform incident prevents saving the auth redirect URLs. Row 11 remains 🔲 UNRUN.
- **BorderPass:** development-only. Phase 8 not started (ADR-0014 still PROPOSED). Row 18 rotation still OPEN (blocker before testers).

## What was attempted (agent, on the operator's Mac + authenticated browser)

This attempt progressed further than `otp-smoke-attempt-20260702T065239Z.md`:

1. **Authenticated dashboard reached** — Supabase Dashboard → org `maralito-labs` → project `borderpass-dev-gate`
   (ref `rupqejwzmwfspvbmkmai`) → Authentication → URL Configuration loaded (slowly; page showed skeleton
   loaders ~30s and the banner **"We are investigating a technical issue"** was displayed the whole session).
2. **Site URL verified:** already `http://localhost:3000` (no change needed, not modified).
3. **Redirect URLs:** allow-list was EMPTY ("No Redirect URLs"). Entered `http://localhost:3000/**` and
   `http://localhost:3000/auth/callback` in the Add-new-redirect-URLs dialog.
4. **Save failed 3×:** toast **"Failed to add URL(s): Failed to fetch (api.supabase.com)"**. Network log showed
   the CORS preflight `OPTIONS https://api.supabase.com/platform/auth/rupqejwzmwfspvbmkmai/config` → 204 but the
   actual save request never completed; a dashboard `POST` to `api.supabase.com` was observed returning **503**.
5. **Verified nothing persisted:** page reload → Redirect URLs still empty. No partial config was left behind.
6. **status.supabase.com (live read, this session):** unresolved incident **"Project status change failures in
   multiple regions"** (latest update Jul 04, 2026 22:40 UTC); **Compute capacity: Degraded Performance in all
   listed regions including us-east-2** (this project's region).

## Why the gate stops here

- The runbook/checklist requires "redirect URLs saved" **before** the OTP login attempt; the platform API
  rejects the save, so the precondition cannot be met honestly.
- No OTP was requested, no user was created, no secrets/OTP codes/tokens were viewed or logged.

## Operator steps to complete Row 11 (unchanged)

1. Wait for https://status.supabase.com to show the incident resolved, then re-save the two redirect URLs
   (Dashboard → Auth → URL Configuration): `http://localhost:3000/**` + `http://localhost:3000/auth/callback`.
2. `pnpm dev`; sign in with a **synthetic** operator-controlled email alias; complete OTP.
3. Verify: OTP delivered → session created → provisioning idempotent on re-login → logout/relogin clean.
4. Record redacted evidence in a new `otp-smoke-<timestamp>.md`; tick Row 11 **only if all checks pass**.

## Gate status after this attempt

- Row 11: 🔲 UNRUN (BLOCKED by the live Supabase platform incident — save of redirect URLs fails).
- Row 18: 🟡 PARTIAL (rotation still REQUIRED BEFORE PRIVATE TESTERS).
- Rows 12–14: ✅ PASS (unchanged, TEST mode). Row 15: 🔲 deferred (LIVE). Row 19: 🔲 (owner sign-off).
- Private testers: **BLOCKED**.
