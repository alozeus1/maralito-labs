# Phase 7 — Row 11 OTP Smoke — Attempt Log (wrap-up pass)

- **Timestamp (UTC):** 20260707T022254Z
- **Outcome:** BLOCKED — but the blocker has CHANGED (see below). Row 11 remains 🔲 UNRUN.

## Status change: the Supabase platform incident has CLEARED

- status.supabase.com (live read): overall **"All Systems Operational"**; the incident
  **"Project status change failures in multiple regions"** is in **Monitoring** (capacity recovered);
  **all 16 compute regions returned to operational on 2026-07-06**, including us-east-2.
- Config writes (the redirect-URL save that failed on 2026-07-02 → 2026-07-05) should now succeed.

## New (small) blocker: dashboard session expired

- Navigating to Auth → URL Configuration now redirects to the Supabase **sign-in page** — the operator's
  dashboard session has expired.
- The agent does not authenticate on the operator's behalf (no passwords/OAuth) — by policy.
- **No config was changed; no credentials were entered.**

## Operator steps (should now take ~10 minutes total)

1. Sign in to the Supabase dashboard (project `borderpass-dev-gate`, ref `rupqejwzmwfspvbmkmai`).
2. Auth → URL Configuration → add + save:
   - `http://localhost:3000/**` and `http://localhost:3000/auth/callback`
   - the current Vercel preview host `/**` + `/auth/callback` (see
     `docs/phase-8/8a-preview-deployment-evidence.md`)
   Verify the entries persist after a page reload.
3. Run the OTP smoke per `otp-smoke-attempt-20260705T023231Z.md` (pnpm dev, synthetic email alias,
   OTP sign-in, session, customer area, idempotent provisioning, logout/relogin).
4. Record redacted evidence (`otp-smoke-<timestamp>.md`, yes/no only) and tick Row 11 **only on full PASS**.

## Gate status after this attempt

Row 11: 🔲 UNRUN (owner sign-in + retry now unblocks it) · Row 18: per ledger · Row 19: 🟡 conditional
Option B (activates when 11 + 18 close) · Private testers: **BLOCKED**.
