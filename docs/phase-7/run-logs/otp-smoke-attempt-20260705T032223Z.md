# Phase 7 — Row 11 OTP Smoke — Attempt Log (narrow retry, Goal 5)

- **Timestamp (UTC):** 20260705T032223Z
- **Outcome:** BLOCKED — redirect-URL save still failing (4th distinct attempt window). Row 11 remains 🔲 UNRUN. OTP smoke not started.
- **BorderPass:** development-only. Phase 8 not started (ADR-0014 PROPOSED). Row 19 = conditional owner approval (Option B) — inactive until rows 11 + 18 close.

## Results (yes/no)

| Check | Result |
|---|---|
| Redirect URLs saved | **NO** |
| OTP smoke steps | NOT ATTEMPTED (precondition failed) |
| **Conclusion** | **BLOCKED** |

## Detail (redacted)

- Repo synced (`main` @ `b3f2ecf`) before the attempt.
- Authenticated dashboard → `borderpass-dev-gate` (ref `rupqejwzmwfspvbmkmai`) → Auth → URL Configuration.
- Both localhost URLs entered; **Save URLs** clicked; dialog never completes; page reload confirms
  **"No Redirect URLs"** persists. Failure signature unchanged from the 20260705T031019Z / T031647Z attempts.
- The dashboard incident banner ("We are investigating a technical issue" → status page) was intermittently
  visible again during the attempt — platform incident still unresolved for config writes at attempt time.
- No OTP requested, no user created, no secrets/codes/tokens viewed or logged.

## Next step

Retry after status.supabase.com clears. Full smoke procedure: `otp-smoke-attempt-20260705T023231Z.md`.
When Row 11 passes and Row 18's open action closes, the Row 19 Option B conditional approval activates.
