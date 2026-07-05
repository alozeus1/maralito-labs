# Phase 7 — Row 11 OTP Smoke — Attempt Log (Goal 3 re-attempt)

- **Timestamp (UTC):** 20260705T031019Z
- **Outcome:** BLOCKED — redirect-URL save still fails during the ongoing Supabase platform incident. Row 11 remains 🔲 UNRUN. OTP smoke not started (per runbook, redirect save is the precondition).
- **BorderPass:** development-only. Phase 8 not started (ADR-0014 PROPOSED).

## Results (yes/no)

| Check | Result |
|---|---|
| Redirect URLs saved | **NO** |
| OTP email received | NOT ATTEMPTED (precondition failed) |
| Sign-in completed | NOT ATTEMPTED |
| Session created | NOT ATTEMPTED |
| Customer area reached | NOT ATTEMPTED |
| Provisioning idempotent | NOT ATTEMPTED |
| Logout/relogin | NOT ATTEMPTED |
| **Conclusion** | **BLOCKED** |

## Detail (redacted)

- Authenticated dashboard session reached project `borderpass-dev-gate` (ref `rupqejwzmwfspvbmkmai`) →
  Authentication → URL Configuration. Site URL verified `http://localhost:3000` (unchanged).
- Entered `http://localhost:3000/**` + `http://localhost:3000/auth/callback`; clicked **Save URLs** twice.
- Failure mode identical to the 20260705T023231Z attempt: CORS preflight
  `OPTIONS https://api.supabase.com/platform/auth/<ref>/config` → 204, but the actual save request fails at
  network level (`TypeError: Failed to fetch (api.supabase.com)`); allow-list still shows "No Redirect URLs".
- Dashboard banner **"We are investigating a technical issue"** active; status.supabase.com incident
  **"Project status change failures in multiple regions"** still unresolved at attempt time.
- No OTP requested, no user created, no secrets/codes/tokens viewed or logged. No partial config left behind.

## Next step (operator)

Retry the redirect-URL save once status.supabase.com shows the incident resolved, then run the full smoke per
`otp-smoke-attempt-20260705T023231Z.md` §Operator steps. Tick Row 11 only on a full PASS with redacted evidence.
