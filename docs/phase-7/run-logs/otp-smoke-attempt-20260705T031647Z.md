# Phase 7 — Row 11 OTP Smoke — Attempt Log (Goal 4 owner-decision pass)

- **Timestamp (UTC):** 20260705T031647Z
- **Outcome:** BLOCKED — redirect-URL save still failing. Row 11 remains 🔲 UNRUN. OTP smoke not started.
- **BorderPass:** development-only. Phase 8 not started (ADR-0014 PROPOSED).

## Results (yes/no)

| Check | Result |
|---|---|
| Redirect URLs saved | **NO** (3rd distinct session attempt: 2026-07-02, 2026-07-05 ×3 saves this session) |
| OTP smoke steps | NOT ATTEMPTED (precondition failed) |
| **Conclusion** | **BLOCKED** |

## Detail (redacted)

- Authenticated dashboard → `borderpass-dev-gate` (ref `rupqejwzmwfspvbmkmai`) → Auth → URL Configuration.
- Both localhost URLs entered; **Save URLs** clicked twice; failure signature unchanged from
  `otp-smoke-attempt-20260705T031019Z.md`: CORS preflight `OPTIONS …/platform/auth/<ref>/config` → 204, actual
  save request never completes; page reload confirms **"No Redirect URLs"** persists.
- The dashboard incident banner ("We are investigating a technical issue") reappeared during the attempt —
  the platform incident is still active at attempt time.
- No OTP requested, no user created, no secrets/codes/tokens viewed or logged.

## Next step

Operator retries after status.supabase.com clears; full smoke steps in `otp-smoke-attempt-20260705T023231Z.md`.
