# Phase 7 — Row 11 OTP Smoke — Attempt Log

- **Timestamp (UTC):** 20260702T065239Z
- **Outcome:** NOT RUN — operator action required. Row 11 remains 🔲 UNRUN.
- **BorderPass:** development-only. Phase 8 not started. Row 18 rotation deferred by owner but STILL OPEN (blocker before testers).

## Supabase status check (Step 1)
- Source: https://status.supabase.com/api/v2/summary.json
- **Snapshot was stale** (page updated_at = 2026-05-08; ~2 months old) — cannot confirm *current* status from this read.
- In that snapshot: **Auth = operational**; overall "All Systems Operational"; only open incident was **us-east-1** network connectivity.
- Project `borderpass-dev-gate` (ref rupqejwzmwfspvbmkmai) is **us-east-2** → not the region in that incident.
- **Action:** operator should re-check https://status.supabase.com live before retrying the redirect-URL save.

## Why the agent did not run the gate (Steps 2–4)
- Redirect-URL save requires the operator's **authenticated Supabase dashboard** session (not available to the agent sandbox).
- OTP smoke requires the app running locally (`pnpm dev`) + real email delivery + browser sign-in — not runnable in the sandbox (macOS-native node_modules).
- No secrets were printed; no synthetic/real user was created.

## Operator steps to complete Row 11 (synthetic email only)
1. Confirm https://status.supabase.com is green for Auth + us-east-2.
2. Dashboard → Auth → URL configuration → add redirect URLs (real owned origins only):
   `http://localhost:3000/**` and any known controlled test-preview domain. Save.
3. `pnpm dev`; sign in with a **synthetic** email (operator-controlled alias). Receive OTP/magic-link.
4. Verify: OTP delivered → session created → provisioning creates/loads customer role + baseline profile (idempotent on repeat).
5. Record redacted evidence; update gate-ledger Row 11 **only if it actually passes**.

## Gate status after this attempt
- Row 11: 🔲 UNRUN (blocked pending operator dashboard + app run).
- Row 18: OPEN (rotation deferred; still required before private testers).
- Rows 12–14: PASS (unchanged). Row 15: 🔲 UNRUN (LIVE deferred). Row 19: 🔲 (owner sign-off).
- Private testers: BLOCKED.
