# Phase 7 — Row 11 OTP Smoke — Attempt Log (auth PROVEN; provisioning pends DB password)

- **Timestamp (UTC):** 20260708T035313Z
- **Outcome:** Auth half **PASS**; provisioning half **BLOCKED** by a stale `DATABASE_URL` password. Row 11
  not yet fully closed, but the previous external blockers (Supabase incident, email rate limit) are gone.

## Method

Programmatic smoke `packages/db/scripts/row11-otp-smoke.ts` — synthetic-only, no email, no rate limit:
mint a real one-time code via the Supabase **admin API**, verify it with the **anon key** to a real session,
then run the app's **actual** `provisionUserCore` twice through `withPrivilegedDbAccess` and assert idempotency,
relogin, and clean up. Never prints codes/tokens/keys.

## Results

| Check | Result |
|---|---|
| Redirect URLs saved (owner, verified) | ✅ (localhost + preview host) |
| OTP minted via Supabase admin API (no email) | ✅ PASS |
| **OTP verify → real session created** | ✅ PASS (`http_ok=true`) |
| Authenticated user id present | ✅ PASS |
| Provisioning idempotent (identity/role/profile) | ⛔ BLOCKED — `28P01 invalid_password` on `DATABASE_URL` |
| Relogin / cleanup | not reached |

## Root cause of the remaining block

`.env.local` `DATABASE_URL` still carries the **pre-rotation** database password (owner rotated the Supabase
DB password/JWT signing key this session). The Supabase API keys (anon/service_role) are current — hence auth
passes — but the **direct DB connection** the app's provisioning uses fails auth. Also noted: `.env.local` has
**two** `DATABASE_URL` lines (the pooler one, referencing `${SUPABASE_DB_NAME}`, wins) — should be consolidated
to one. No `service_role` REST shortcut exists: those tables are granted to `authenticated` only (least-privilege,
ADR-0013), so provisioning must go through the privileged DB connection.

## What closes Row 11 (owner, ~2 min)

Set a single `DATABASE_URL` in `.env.local` (and Vercel Preview) to the **session pooler** connection string
with the NEW password (host `aws-1-us-east-2.pooler.supabase.com`, port 5432, user
`postgres.rupqejwzmwfspvbmkmai`, db `postgres`). This is also the final propagation step of the Row 18
rotation. Then re-run the smoke; it completes provisioning + idempotency + relogin and Row 11 → PASS.

## Related state

- **PR #6** (React 19 + service-worker fix) — all CI green, review comment addressed + thread resolved; awaits owner merge.
- **Row 18** — DB password + JWT signing key rotated by owner; finishing = `DATABASE_URL` propagation (above) + optionally removing old keys from "Previously used keys" later.
- Reliable email (Resend SMTP) is **no longer on Row 11's critical path** (the programmatic smoke bypasses email); still worth wiring for real tester emails + customer messaging.
