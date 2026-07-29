# Automation API (`/api/automation/*`) — Defect D2 Verification

> Production-readiness verification for defect **D2**. **Code and tests are in the repo; every LIVE
> step in §7 is operator-run** — nothing here was executed against a deployed BorderPass, a real n8n
> instance, Supabase, or Stripe.

## 1. The defect

`/api/automation/*` is the HTTP surface the external n8n workflows call. Those callers hold **no
session cookie** — they authenticate with a single shared secret in the `x-borderpass-secret` header,
compared constant-time against `N8N_WEBHOOK_SECRET`.

`apps/borderpass/middleware.ts` redirects any unauthenticated request whose path is not in
`PUBLIC_PREFIXES` to `/login`. `/api/automation` was **not** in that list. Consequence:

1. n8n POSTs to `/api/automation/dispatch-notifications`.
2. The middleware sees no Supabase user, matches no public prefix, and returns
   **302 → `/login?next=/api/automation/dispatch-notifications`**.
3. The route handler — and therefore the shared-secret check — **never runs**.
4. n8n follows the redirect, gets **200 + an HTML login page**, and treats the workflow step as a
   success. Notifications are never dispatched, delivery statuses are never recorded, review requests
   are never sent, and **nothing errors**. A silent, permanent no-op.

This is a *availability/correctness* failure, not a privilege escalation — the redirect fails safe.
But it fails safe *silently*, which is why it survived.

## 2. The fix

`'/api/automation'` was added to `PUBLIC_PREFIXES` in `apps/borderpass/middleware.ts`, alongside the
two integrations with the identical shape (`/api/stripe/webhook`, `/api/webhooks/resend`). "Public"
here means *no session gate* — **not** unauthenticated: authentication moves into the handler, where
it belongs for a machine caller.

## 3. Verification performed

### 3.1 The middleware predicate is safe

```ts
const isPublic = (p: string) => PUBLIC_PREFIXES.some((x) => p === x || p.startsWith(x + '/'));
```

Reviewed specifically for `startsWith` foot-guns. **No bug found.** The `x + '/'` boundary is the
important detail: a bare `p.startsWith(x)` would have made `/api/automationXYZ`,
`/api/automation-internal` and `/api/automations/...` public too, and — because the same predicate
serves every prefix — would also have leaked `/authXYZ`, `/loginXYZ`, `/api/healthz`, and anything
else sharing a prefix string. The `p === x` arm covers the bare prefix with no trailing slash.

Path traversal was checked as well: `req.nextUrl.pathname` is WHATWG-URL normalised before the
predicate sees it, so `/api/automation/../orders` and `/api/automation/%2e%2e/orders` both collapse to
`/api/orders`, which is **not** public. `/api/automation/..%2forders` stays literal, is classified
public, and then 404s — it cannot resolve to a protected route. Matching is case-sensitive, so
`/API/AUTOMATION/...` is *not* public (fails in the safe direction).

**Conclusion: the bypass is exactly one path segment wide and exposes nothing else.**

### 3.2 Every route under the prefix fails closed, before doing any work

| Route | Auth gate | On failure | Work reached on failure |
|---|---|---|---|
| `POST /api/automation/dispatch-notifications` | `secretOk(...)` line 29 | `401 {"error":"unauthorized"}` | none — body not read, dispatcher not called, no audit row |
| `POST /api/automation/notification-status` | `secretOk(...)` line 25 | `401 {"error":"unauthorized"}` | none — no `withPrivilegedDbAccess`, no audit row |
| `POST /api/automation/review-request` | `secretOk(...)` line 19 | `401 {"error":"unauthorized"}` | none — no email send |

All three call `secretOk` as the first statement after `getServerEnv()`, before `req.json()` /
`req.text()`, and all three pin `runtime = 'nodejs'` (required: `timingSafeEqual` is Node crypto, not
edge). `secretOk` (`src/server/automation-auth.ts`) denies when the header is absent, when
`N8N_WEBHOOK_SECRET` is unset (fail closed), and when byte lengths differ — the length guard sits
*before* `timingSafeEqual`, which throws on unequal buffers.

### 3.3 Responses are JSON, never HTML, and never echo a secret

Every rejection is `NextResponse.json({ error: 'unauthorized' }, { status: 401 })`:
`content-type: application/json`, no `Location` header, no `<html>`. No automation route contains a
`console.*` call, no route contains `NextResponse.redirect`, and each route references
`x-borderpass-secret` and `N8N_WEBHOOK_SECRET` exactly once each in code — as the two arguments to
`secretOk`. Neither value reaches a response body, a response header, or an audit payload.

## 4. Tests added

| File | What it locks in |
|---|---|
| `apps/borderpass/tests/unit/middleware-public-prefixes.test.ts` | The **real** `PUBLIC_PREFIXES` literal and the **real** `isPublic` expression are extracted from `middleware.ts` and evaluated verbatim — nothing is re-implemented. Asserts `/api/automation` is listed, that every automation route dir *on disk* classifies public, the segment-boundary property for **every** prefix, that `/orders` and `/admin` stay protected, and the dot-segment normalisation above. |
| `apps/borderpass/tests/unit/automation-routes-auth.test.ts` | Drives the **real** handlers with collaborators replaced by recorders. Per route: no secret / equal-length wrong secret / different-length wrong secret / empty header / server secret unset → JSON 401 with the sentinel collaborator **never called** and `req.bodyUsed === false`; valid secret → the route proceeds; no response echoes any secret. |
| `apps/borderpass/tests/unit/automation-route-contract.test.ts` | Walks `app/api/automation/*` on disk, so a **new** route added later is covered automatically: it must import `secretOk`, gate before any body read or collaborator call, return a JSON 401, pin the nodejs runtime, and never log or echo the secret. |
| `apps/borderpass/src/server/automation-auth.test.ts` (extended) | Prefix/superstring, whitespace-padded, case-shifted and final-byte near-miss rejections, plus multibyte input (UTF-8 byte length ≠ string length) not throwing. |
| `apps/borderpass/tests/fakes/automation/*` | Recording stand-ins for `@/server/env`, `@/server/audit`, `@/server/review-request`, `@/server/notification-dispatch`, `@maralito/db`. Not test files — vitest's `include` does not collect them. `@/server/automation-auth` is **never** faked. |

Secrets in tests are obvious fakes (`test_fake_n8n_shared_secret_do_not_use_0001`).

## 5. Results observed

`pnpm`/`vitest` could not be executed in the verification environment (macOS `node_modules` on Linux).
The `*.test.ts` files were therefore transpiled with `esbuild` and executed under plain Node 22 with a
vitest-compatible harness plus a module-resolution loader that applies the same substitutions the
`vi.mock` calls declare. **The sources under test — `middleware.ts`, the three route handlers,
`automation-auth.ts`, `notification-status.ts` — were the real, unmodified repo files.**

| Suite | Result |
|---|---|
| `middleware-public-prefixes.test.ts` | **11 passed / 0 failed** |
| `automation-routes-auth.test.ts` | **28 passed / 0 failed** |
| `automation-route-contract.test.ts` | **18 passed / 0 failed** |
| `automation-auth.test.ts` | **10 passed / 0 failed** |
| **Total** | **67 passed / 0 failed** |

`tsc --noEmit -p apps/borderpass/tsconfig.json` reports **zero errors in any of these files** (the
only repo-wide error is the pre-existing, unrelated `src/server/pii-vault.ts` →
`Cannot find module '@maralito/crypto'`, an unbuilt workspace package).

### 5.1 Mutation checks — the tests actually detect the defect

Applied to throwaway copies in `/tmp`; the repo was never modified.

| Mutation | Detected |
|---|---|
| Remove `'/api/automation'` from `PUBLIC_PREFIXES` (i.e. reintroduce D2) | **3 failures** in `middleware-public-prefixes.test.ts` |
| Weaken the predicate to `p.startsWith(x)` (drop the segment boundary) | **3 failures** in `middleware-public-prefixes.test.ts` |
| Delete the `secretOk` gate from `review-request/route.ts` | **7 failures** in `automation-routes-auth.test.ts` + **4** in `automation-route-contract.test.ts` |

## 6. Verdict

**D2: VERIFIED FIXED (offline).** The middleware bypass is present, correctly scoped to a single path
segment, and every handler behind it fails closed on the shared secret before performing any work,
returning JSON 401 with no secret material in the response. No security bug was found in the prefix
matching, so `middleware.ts` was **not** modified by this verification.

Residual notes (not defects):

- On a public path the middleware still performs `supabase.auth.getUser()` before `isPublic` is
  consulted — a wasted network round-trip on every automation call. Latency only; no correctness or
  security impact. Moving the `isPublic` check above the Supabase client construction would remove it.
- `getServerEnv()` runs before `secretOk`. If the server env is misconfigured, the zod parse throws and
  the caller gets a generic 500 instead of a 401. Fail-closed and leaks nothing (zod reports paths, not
  values), but it means "500 from an automation route" should be read as *env misconfiguration*, not
  *auth failure*.

## 7. LIVE re-test required from the operator

None of the following was or could be executed here. Record outcomes in
`docs/phase-7/gate-ledger.md`.

1. **Deployed 401** — against the deployed app, `curl -i -X POST https://<host>/api/automation/dispatch-notifications -H 'content-type: application/json' -d '{}'` with **no** secret header. Expect `HTTP/1.1 401`, `content-type: application/json`, body `{"error":"unauthorized"}`. **Any 3xx, or any `text/html`, means D2 is still live in that environment.** Repeat for `/api/automation/notification-status` and `/api/automation/review-request`.
2. **Deployed 401 with a wrong secret** — same call with `x-borderpass-secret: definitely-wrong`. Expect the same 401.
3. **Deployed 200 with the real secret** — from the n8n instance (or with the provisioned secret), expect a non-401 JSON response and a corresponding `notifications.dispatch` audit row.
4. **Vercel/CDN layer** — confirm no platform-level redirect, auth wall (e.g. Vercel deployment protection on preview URLs), or WAF rule re-introduces a 302 in front of `/api/automation/*`. Deployment protection on Preview will produce exactly the D2 symptom again.
5. **`N8N_WEBHOOK_SECRET` provisioned** in every environment n8n targets, and matching the value configured in the n8n credential. Unset → every call 401s (correct, but the workflows are dark).
6. **n8n workflow config** — the workflows must **not** follow redirects and must **treat non-2xx as a failure**; otherwise a future regression is silent again. Add an explicit status-code assertion in the n8n HTTP Request node.
7. **`pnpm --filter borderpass test`** on a real install, to confirm the four suites pass under actual vitest (they were executed here under an esbuild + Node harness, not vitest).
8. **`pnpm --filter borderpass typecheck`** after `@maralito/crypto` is built, to clear the one pre-existing unrelated error.
