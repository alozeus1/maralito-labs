# Phase 1 — Audit Logging Baseline

**Goal:** an append-only record of sensitive actions, never storing secrets or document contents. This is the BorderPass-local baseline; the platform Audit service (hash-chained, immutable) is the long-term target (ADR-0005).

## Table: `audit_logs`
Fields: `id (aud_…), org_id, actor_user_id, actor_role, action, entity_type, entity_id, before (jsonb), after (jsonb), metadata (jsonb), ip_address, user_agent, created_at`. Append-only (no update/delete path in app code).

## Helper: `writeAudit(input)` (`apps/borderpass/src/server/audit.ts`, server-only)
- Inserts an audit row; **best-effort** — never throws into the caller's request path (failures surface via observability later).
- `before`/`after`/`metadata` pass through **`redact()`** (`@maralito/observability`) which masks keys matching `password|token|secret|api_key|authorization|cookie|card|cvv|ssn|rfc|kyc|document|file`.
- No-op when `DATABASE_URL` is absent (Phase 1 sandbox).

## What Phase 1 logs
`user.created`, `profile.updated`, `role.assigned`, `role.removed`, `access.denied` (admin route), `permission.denied`, sign-in / sign-out (where feasible). Config-change placeholder reserved.

## Redaction (tested)
`redact()` recursively masks secret-ish keys (arrays + nesting), preserving safe fields (e.g. `display_name`, `city`). Unit-tested (2 tests, green). **Never** logs raw card/KYC/RFC/document/file content.

## Example
```ts
await writeAudit({
  action: 'profile.updated', orgId, actorUserId, actorRole: 'customer',
  entityType: 'customer_profile', entityId, before, after,  // before/after auto-redacted
});
```

## Deferred
Hash-chaining + immutability (platform Audit), 403/denial auto-emit middleware, PII-read access logging for staff, audit query/export UI — Phase 2+ and when the platform Audit SDK is wired.

---

## Phase 1.5 update — coverage expanded
Writes now run via **`withServiceRole(db, 'audit:<action>', …)`** (privileged + justified). Wired events:

| Event | Where | Status |
|-------|-------|--------|
| `user.created`, `profile.updated` | profile action | ✅ |
| `role.assigned`, `role.removed` | `src/server/roles.ts` (foundation helpers) | ✅ |
| `access.denied` (admin/customer) | route guards | ✅ |
| `auth.signin`, `auth.signin_failed` | auth callback | ✅ |
| `auth.signout` | sign-out action | ✅ |
| `super_admin.bootstrap` | dev seed | ✅ |
| `permission.denied` | helper exists (`auditPermissionDenied`); wired at action sites in Phase 2 | 🟡 |
| sign-in via password / ip+ua capture | needs request-context plumbing | deferred |

**Never logged:** OTP codes, tokens, secrets, card/KYC/RFC/document content (redaction enforced + tested).
