# Session & Device Policy

> Production-readiness hardening (Auth/Session). **Code and tests are in the repo; every LIVE step in
> §7 is operator-run** — nothing here was executed against a real Supabase project.

## 1. What this control does

Supabase issues a JWT with a refresh token that, by default, can be rotated indefinitely. That gives
us neither a fixed session lifetime, nor an idle timeout, nor any cap on how many devices hold a live
session, nor a way to kill sessions after a password reset. This control adds a server-side session
registry (`user_sessions`) that is the authority on whether a request may proceed.

| # | Required behaviour | Where it is enforced |
|---|---|---|
| 1 | Fixed absolute session lifetime | `evaluateSession` → `expired/absolute`; `absolute_expires_at` column |
| 2 | Idle timeout | `evaluateSession` → `expired/idle`; sliding `idle_expires_at` |
| 3 | Max 2 active device sessions; 3rd login revokes the OLDEST | `decideDeviceAdmission` → `registerSession` |
| 4 | Password reset revokes ALL sessions, fresh login required | `revokeAllSessionsOnPasswordReset` |
| 5 | Sign-out revokes the current session | `revokeCurrentSession` |
| 6 | Suspicious / limit events audited | `SESSION_AUDIT_ACTIONS` (§5) |

## 2. Chosen lifetimes and why

| Setting | Default | Env override | Bounds |
|---|---|---|---|
| Absolute lifetime | **12 h** | `SESSION_ABSOLUTE_LIFETIME_SECONDS` | 5 min – 24 h (clamped) |
| Idle timeout | **30 min** | `SESSION_IDLE_TIMEOUT_SECONDS` | 1 min – absolute lifetime (clamped) |
| Max active devices | **2** | `SESSION_MAX_ACTIVE_DEVICES` | 1 – 5 (clamped) |

- **12 h absolute** — one working day. A stolen cookie is dead by the next morning, and staff at the
  Juárez hub are not logged out mid-shift. It is a *fixed* ceiling: activity never extends it.
- **30 min idle** — BorderPass is used on shared/front-desk machines. 30 minutes is the standard
  unattended-workstation window and is short enough that walking away is not a hand-off of the account.
- **2 devices** — phone + laptop is the realistic legitimate maximum for a customer or an ops user.

Config is **fail-closed**: an unparseable value falls back to the *default* (never to "unlimited"),
out-of-range values are clamped, and the idle window can never exceed the absolute window. There is no
configuration that produces a session longer than 24 hours or more than 5 concurrent devices.

## 3. Revoke-oldest: the decision and the alternatives

When a login would take the account past the cap, we **revoke the oldest active session** and admit
the new one. We explicitly did **not** choose "reject the new login":

- Rejecting is a **denial-of-service primitive**: anyone who can trigger logins on an account (or a
  user with two stale sessions on devices they no longer have) locks the legitimate owner out.
- Rejecting trains users and operators to raise or disable the cap, which removes the control.
- Revoke-oldest keeps the invariant hard (never more than N active) while always letting the person
  holding valid credentials in. Every eviction is audited, so an unexpected sign-out is explainable
  and — more importantly — **visible as a signal** when it correlates with a new device.

Implementation details worth knowing:
- "Oldest" is by `issued_at`, ties broken by `id`, so the decision is deterministic and testable.
- Revocation happens **before** the insert, so the cap is never transiently exceeded.
- If drift ever leaves more than N rows active, the next login revokes **all** the excess in one pass
  (self-healing).
- A login from an *already-known* device label at the cap is evicting-but-not-suspicious; a login from
  an *unknown* device label at the cap raises `auth.session_suspicious_new_device`.

## 4. Data stored (and deliberately not stored)

`user_sessions` (`packages/db/src/schema/sessions.ts`) holds **no secrets and no PII**:

- `session_token_hash` — SHA-256 hex of `'bp.session.v1:' || <raw token>`. The raw token/JWT/cookie is
  **never** stored, returned, or logged. Unique index → one token maps to exactly one session row.
- `device_label_hash` — SHA-256 of `'bp.device.v1:' || '<browser>/<os>'`. The label is *coarse by
  construction* (`chrome/macos`, `safari/ios`): version, architecture and every other fingerprinting
  token are discarded before hashing. The raw user-agent is never stored.
- `ip_hash` — SHA-256 of `'bp.ip.v1:' || <ip>`, optional. Lets an operator see "same network" without
  the table holding an IP address.
- Timing columns (`issued_at`, `last_seen_at`, `absolute_expires_at`, `idle_expires_at`, `revoked_at`)
  and `status` / `revoked_reason`.

Domain-separated hash prefixes mean a session digest can never be replayed as a device or IP digest.

**Accepted trade-off:** because the device label is coarse, two different Chrome-on-macOS machines
share a label. The label is therefore used only for audit context and the suspicion signal — it is
*not* used to decide which session to evict (that is purely oldest-first), so a collision cannot
reduce the effective device cap or misdirect an eviction.

## 5. Audit events

All emitted through the existing `writeAudit` privileged path (`apps/borderpass/src/server/audit.ts`),
which redacts secrets. Metadata carries hashes and counts only — never a token, user-agent, or IP.

| Action | When |
|---|---|
| `auth.session_created` | a session row is registered at login |
| `auth.session_revoked_signout` | user signed out (current session revoked) |
| `auth.session_revoked_device_limit` | one row evicted by the cap (emitted per evicted session) |
| `auth.session_device_limit_reached` | a login hit the cap (summary, with `revoked_count`) |
| `auth.session_suspicious_new_device` | an **unknown** device displaced a session at the cap |
| `auth.session_expired_absolute` | fixed lifetime reached; row marked `expired` |
| `auth.session_expired_idle` | idle timeout reached; row marked `expired` |
| **`auth.password_reset_sessions_revoked`** | password reset revoked all sessions (always emitted, even when the count is 0, so the control is provably exercised) |
| `auth.session_denied` | a request presented a token resolving to no usable session |

## 6. RLS and the write boundary

`packages/db/src/rls/sessions-policies.sql`:

- **SELECT: own rows only** — `using (auth_user_id = auth.uid())`. There is deliberately **no** staff
  or admin select policy: staff have no operational need to browse other people's live sessions, and
  security review is served by `audit_logs` (already restricted to `compliance_admin` / `super_admin`)
  plus the privileged server seam.
- **No INSERT / UPDATE / DELETE policy at all.** Session creation, idle-window sliding, expiry marking
  and revocation run only through `apps/borderpass/src/server/session-registry.ts` →
  `withPrivilegedDbAccess`. A client cannot forge a session, extend its expiry, or un-revoke one.
- Grants: `grant select on user_sessions to authenticated;` — select only. `anon` gets no grant and no
  policy, so it is denied outright.

Revoked rows stay readable **by their owner** so the UI can explain "you were signed out because…".

## 7. Operator steps (live, not run here)

None of the following can be executed from the dev sandbox. Never paste secret values into the repo.

### 7.1 Generate and review the migration (offline, no DB)

The `user_sessions` table has **no Drizzle migration yet** — it must be generated by an operator:

```
pnpm --filter @maralito/db db:generate     # writes packages/db/migrations/*.sql from ./src/schema
git add packages/db/migrations && git diff --cached   # REVIEW the CREATE TABLE + indexes
pnpm --filter @maralito/db db:migrate      # apply against the target database
```

### 7.2 Apply the RLS policies

Applied after the table DDL exists, in the same order as the other policy files:

```
psql "$DATABASE_URL" -f packages/db/src/rls/policies.sql
psql "$DATABASE_URL" -f packages/db/src/rls/sessions-policies.sql
```

Then confirm the isolation gate covers the new file:

```
pnpm --filter @maralito/db test:rls        # PGlite suite, offline
pnpm gate:rls                              # non-destructive live isolation gate (all policy files)
```

### 7.3 Supabase dashboard settings

These align Supabase's own token lifetimes with the application policy so the two cannot disagree.
**Dashboard → Authentication → Sessions / Providers:**

1. **Time-box user sessions** → set to **12 hours** (match `SESSION_ABSOLUTE_LIFETIME_SECONDS`).
2. **Inactivity timeout** → set to **30 minutes** (match `SESSION_IDLE_TIMEOUT_SECONDS`).
3. **Access token (JWT) expiry** → **3600** seconds. Keep it well under the absolute lifetime; the
   refresh path is what our registry gates.
4. **Refresh token rotation** → **enabled**, with reuse-detection interval at the default. Rotation
   plus our token-hash uniqueness is what makes a stolen refresh token single-use.

CLI equivalent (`supabase/config.toml`, applied with `supabase db push` / `supabase config push`):

```
[auth]
jwt_expiry = 3600
enable_refresh_token_rotation = true
refresh_token_reuse_interval = 10
```

> Supabase's own inactivity/time-box settings are a **second** line of defence. They do not replace
> the registry: only the registry gives us the device cap, revoke-oldest, and revoke-all-on-reset.

### 7.4 Wire the password-reset hook — **DELIBERATELY UNWIRED, see §12**

BorderPass has **no password today**. Every sign-in path is passwordless (email OTP code, magic-link
`token_hash`, PKCE callback, Google OAuth) — a repo-wide search for `updateUser`,
`resetPasswordForEmail` and `password` finds no password-update route, server action, or UI. There is
therefore nothing to wire `revokeAllSessionsOnPasswordReset` into, and inventing a password-reset
route to hang it off would be adding an auth surface nobody asked for.

§12 records the exact drop-in for whoever adds passwords. Until then the function stays exported and
unit-tested but uncalled, which is the honest state.

Verification once it *is* wired: change a password, then confirm `select count(*) from user_sessions
where auth_user_id = '<uuid>' and status = 'active'` is `0`, and that one
`auth.password_reset_sessions_revoked` row exists in `audit_logs`.

### 7.5 Environment variables

Optional; defaults apply when unset. Set them in Vercel/Supabase env config, not in the repo:

```
SESSION_ABSOLUTE_LIFETIME_SECONDS=43200   # 12h
SESSION_IDLE_TIMEOUT_SECONDS=1800         # 30min
SESSION_MAX_ACTIVE_DEVICES=2
```

## 8. Middleware wiring (coordinator)

`apps/borderpass/middleware.ts` is owned by the coordinator. Two seams are exported:

```ts
// apps/borderpass/src/server/session-registry.ts — authoritative, requires the NODE.JS runtime (DB).
enforceSessionForRequest(ctx: { sessionToken: string | null | undefined; now?: Date | undefined })
  : Promise<SessionVerification>

// apps/borderpass/src/server/session-policy.ts — pure, DB-free, safe on the EDGE runtime.
isWithinAbsoluteLifetime(issuedAtEpochSeconds: number | null | undefined, now: Date, policy?)
  : boolean
```

`SessionVerification` is `{ ok: true; sessionId; authUserId; orgId; idleExpiresAt }` or
`{ ok: false; reason: 'no_token' | 'unknown' | 'revoked' | 'expired_absolute' | 'expired_idle' | 'unavailable' }`.

Contract: **treat any `{ ok: false }` as deny** — clear the auth cookies and redirect to `/login`.
`unavailable` (DB down, env missing) is a *denial*, not a pass-through: this control fails closed.

If middleware stays on the Edge runtime, use `isWithinAbsoluteLifetime(jwt.iat, new Date())` there as
a cheap pre-filter and call `enforceSessionForRequest` from a Node route/layout guard. The pre-filter
can only reject — a `true` still requires the authoritative check.

## 9. Test coverage

| File | What it proves |
|---|---|
| `apps/borderpass/src/server/session-policy.test.ts` | config clamping/fail-closed, absolute + idle expiry boundaries, revoked-beats-expired, corrupt-row denial, revoke-oldest (incl. tie-breaks, drift self-healing, cap never exceeded), revoke-all-on-password-reset, token hashing (known SHA-256 vector, domain separation, never returns input), coarse device labels |
| `apps/borderpass/src/server/session-guard-core.test.ts` | **flag OFF is a true no-op** (token resolver, verifier, registrar, revoker and auditor are each asserted *not called*), flag name + exact-`'on'` matching incl. every near-miss, flag ON denies expired/revoked/unknown/no_token/unavailable and allows valid, fail-closed on a thrown verifier / thrown token resolver / thrown auditor, and **recording never throws** (registrar throws, token resolver throws, even the failure logger throws ⇒ login and sign-out still complete) |
| `packages/db/tests/sessions-rls.isolation.test.ts` | real policy files on real Postgres (PGlite): own-rows-only, same-org peer denied, cross-tenant denied, staff denied, anon denied, no-claims denied, customer cannot insert/impersonate/extend/un-revoke/delete, token-hash uniqueness, privileged revocation still works |

## 10. Wired call sites

`apps/borderpass/src/server/session-guard.ts` is the Node-runtime seam; `session-guard-core.ts` holds
the same logic with every dependency injected, which is what makes "flag OFF calls nothing" testable.

| Call site | What it does | Stance |
|---|---|---|
| `app/actions/auth.ts` → `verifyEmailCode` | `recordLoginSession(userId)` after `verifyOtp` succeeds — **the primary login path** (6-digit code) | best-effort |
| `app/auth/confirm/route.ts` | `recordLoginSession(userId)` after `verifyOtp(token_hash)` | best-effort |
| `app/auth/callback/route.ts` | `recordLoginSession(userId)` after `exchangeCodeForSession` (PKCE / OAuth) | best-effort |
| `src/server/auth-events.ts` → `signOut` | `revokeSessionOnSignOut()` **before** `supabase.auth.signOut()` (after it, the token is gone) | best-effort |
| `app/(customer)/layout.tsx` | `guardSession({ surface: 'customer' })`; non-null ⇒ `redirect('/login?reason=session')` | **fail-closed** |
| `app/(admin)/layout.tsx` | `guardSession({ surface: 'admin' })`; non-null ⇒ `redirect('/login?reason=session')` | **fail-closed** |

`middleware.ts` is untouched — it is Edge runtime and owned by the coordinator (§8).

**Recording is best-effort by design, enforcement is fail-closed by design.** A user must never be
unable to sign in or out because session bookkeeping failed; bookkeeping is not the authentication
control. The authentication control is `guardSession`, and it denies anything it cannot verify.

**Which token identifies a session.** We register and look up by the Supabase **`session_id` JWT
claim**, not the access token and not the refresh token. Supabase rotates the access token roughly
hourly and rotates the refresh token on every refresh (§7.3 mandates rotation), so a hash of either
would stop matching after the first rotation and — with enforcement on — deny every user within the
hour. `session_id` is stable across refreshes and changes only on a real new login, which is exactly
the unit the device cap counts and sign-out revokes. It is still SHA-256 hashed before storage and is
never logged or returned. If the claim is absent the resolver returns `null`, which is a `no_token`
**denial** under enforcement — which is why rollout step 4 below is mandatory.

## 11. Rollout: enforcement ships DARK

`BORDERPASS_SESSION_ENFORCEMENT` is the only switch. Enforcement is active **only** when it is
*exactly* the string `'on'` — not `'ON'`, not `'true'`, not `'1'`. Unset ⇒ **off**.

| Flag state | Behaviour |
|---|---|
| unset / anything ≠ `'on'` (**default**) | Byte-for-byte today's behaviour. No new denials, no new request-path DB reads, no `user_sessions` writes, no new audit rows. `guardSession` returns `null` before it resolves a token or touches the database. |
| `'on'` | Full fail-closed enforcement on the customer + admin shells; logins register rows; sign-out revokes; the 2-device cap and revoke-oldest become live. |

**This ordering is not optional.** `enforceSessionForRequest` fails closed, so turning the flag on
before the table exists denies every request from every user — a total lockout.

1. **Generate and apply the migration** (§7.1). `pnpm --filter @maralito/db db:generate`, review the
   `CREATE TABLE user_sessions` diff, then `db:migrate`. Confirm: `select count(*) from user_sessions;`
   returns `0` rather than an error.
2. **Apply the RLS policies** (§7.2): `psql "$DATABASE_URL" -f packages/db/src/rls/sessions-policies.sql`,
   then `pnpm --filter @maralito/db test:rls` and `pnpm gate:rls`.
3. **Deploy with the flag OFF** (leave `BORDERPASS_SESSION_ENFORCEMENT` unset). Verify normal login,
   navigation and sign-out are unchanged, and that `select count(*) from user_sessions;` is still `0` —
   proof the dark path really is inert.
4. **Turn recording on and verify rows appear — the gate before enforcement.** Set the flag to `'on'`
   on **one preview/staging deployment only**, then, as a real user:
   - sign in → `select id, status, issued_at, absolute_expires_at from user_sessions where auth_user_id = '<uuid>';`
     shows exactly one `active` row, and `audit_logs` has one `auth.session_created`;
   - keep browsing for **more than one access-token lifetime (> 1 h, §7.3)** and confirm you are **not**
     signed out — this is the check that the `session_id` claim is present and stable. If you *are*
     signed out, set the flag back to unset immediately and fix token resolution before going further;
   - sign in on a 3rd device → oldest session flips to `revoked` / `device_limit`, and
     `auth.session_revoked_device_limit` + `auth.session_device_limit_reached` appear;
   - sign out → that row flips to `revoked` / `signed_out` with `auth.session_revoked_signout`.
5. **Flip the flag in production**: set `BORDERPASS_SESSION_ENFORCEMENT=on` and redeploy/restart.
6. **Verify in production**: repeat the step-4 checks, plus confirm a revoked session is bounced to
   `/login?reason=session` on its next navigation and that `audit_logs` shows the denial.

**Instant rollback — no code change, no redeploy of logic:** set `BORDERPASS_SESSION_ENFORCEMENT` to
anything other than `'on'` (or delete it) and restart. The flag is read from `process.env` on every
call, so the next request is back to today's behaviour: no denials, no session-registry DB reads.
Rows already in `user_sessions` are simply ignored while the flag is off; nothing needs cleaning up.

## 12. Known gaps / follow-ups

- **Password reset is unwired because BorderPass has no password** (§7.4). When one is added, call
  `revokeAllSessionsOnPasswordReset` in **both** places, immediately after Supabase confirms the
  change and *before* returning success:

  ```ts
  // 1. The app's own password-update route or server action, e.g. app/actions/password.ts
  //    (after `supabase.auth.updateUser({ password })` returns without an error):
  import { revokeAllSessionsOnPasswordReset } from '@/server/session-registry';
  import { getAppSession } from '@/server/auth';

  const session = await getAppSession();
  if (session) {
    await revokeAllSessionsOnPasswordReset({
      authUserId: session.sub,
      orgId: session.orgId,
    });
  }
  // The user is now signed out everywhere INCLUDING here — redirect to /login, do not keep them in.
  ```

  ```ts
  // 2. A privileged server route for resets completed OUTSIDE the app UI (Supabase dashboard,
  //    Auth Hook, or a Database Webhook on auth.users UPDATE where encrypted_password changed).
  //    It MUST authenticate the caller with a shared secret first, exactly like the /api/automation
  //    routes do — an unauthenticated caller could otherwise revoke anyone's sessions.
  await revokeAllSessionsOnPasswordReset({ authUserId: payload.record.id });
  ```

  Note this call is deliberately **not** flag-gated: it is an explicit security action, not
  request-path enforcement, and it is safe with the table absent (it returns `0` and still audits).
- Enforcement is gated on the flag, so until step 5 of §11 the registry proves nothing in production.
  Nothing in `docs/phase-7/gate-ledger.md` may be marked passed on the strength of the code alone.
- Expiry is enforced lazily (on the next request). A background sweep of
  `status='active' and absolute_expires_at < now()` would keep the table tidy; the `user_sessions_expiry_idx`
  index exists for it.
- `guardSession` redirects but does not clear the auth cookies — cookie writes are ignored during a
  Server Component render. The stale cookie is harmless (every guarded request re-denies it), but
  clearing it belongs to the Edge middleware, which the coordinator owns.
- Guards cover the customer and admin **shells**. Route handlers under `app/api/*` are not guarded by
  a layout; they remain protected by the middleware auth gate and their own checks.
- No user-facing "your active devices" screen yet. The self-select RLS policy already permits it.
