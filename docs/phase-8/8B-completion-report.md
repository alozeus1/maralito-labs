# Phase 8B — KMS Envelope Encryption — Completion Report

> **Status:** ✅ CODE-COMPLETE (development-only · dev KMS provider · offline-verified). · **Date:** 2026-07-02 · ADR-0017
> The **seam** for protecting real PII is built + verified. **No real PII is stored** — that requires a production
> cloud-KMS provider (AWS/GCP) + validation + owner sign-off (to be done "when we move to production", per owner).

## Increments
| # | Increment | Status |
|---|-----------|--------|
| 8B.1 | `@maralito/crypto` package + KMS provider abstraction (+ local dev provider, fail-closed in prod) | ✅ |
| 8B.2 | Envelope encryption core (AES-256-GCM DEK, provider-wrapped) + PII helpers + tests | ✅ |
| 8B.3 | `encrypted_pii` schema + privileged-only RLS | ✅ |
| 8B.4 | Server-only PII vault seam + delivery-address helpers (synthetic) | ✅ |
| 8B.5 | ADR-0017 + `decision-kms.md` update + this report | ✅ |

## Files
- **New package `@maralito/crypto`** (Node `crypto` only, zero deps): `kms/provider.ts` (interface), `kms/local-provider.ts` (dev KEK; fail-closed in prod), `kms/config.ts` (factory; aws/gcp throw until wired), `envelope.ts` (`EncryptedField`), `pii.ts`, `index.ts`, `tests/crypto.test.ts`. + `package.json`/`tsconfig.json`.
- **Schema/RLS:** `packages/db/src/schema/pii.ts` (`encrypted_pii`), exported in schema index; RLS in `delivery-preparations-policies.sql` (privileged-only); delivery RLS harness updated + asserts.
- **App:** `apps/borderpass/src/server/pii-vault.ts` (store/read encrypted PII + `storeDeliveryAddress`/`readDeliveryAddress`); `@maralito/crypto` added to `apps/borderpass/package.json`.

## Design (security)
- **Envelope encryption:** per-record random 256-bit DEK, AES-256-GCM (authenticated); DEK wrapped by the provider's KEK; ciphertext is a versioned self-describing blob (`{v,alg,keyRef,iv,ct,tag,dek}`). Plaintext keys never persist; KEK never touches data.
- **Provider abstraction:** local dev provider (KEK from `BORDERPASS_KMS_KEY` via scrypt) **refuses to run in production**; AWS/GCP adapters **throw until implemented + configured** (no silent dev-key misuse).
- **Storage:** `encrypted_pii` is **privileged-only** (RLS enabled, no tenant policy) — customers/staff never read ciphertext; decryption happens only in the server-only vault seam. `subject_ref` links to opaque domain refs (e.g. `delivery_address_ref`).

## Verification (offline)
- `@maralito/crypto` **9/9** on emitted code: round-trip, ciphertext hides plaintext, unique DEK/IV, **GCM tamper-reject**, wrong-KEK reject, **prod fail-closed**, aws-not-wired throw, config detection.
- **PII vault E2E 6/6** on PGlite (real migration + `encrypted_pii` RLS + real crypto): encrypt→store→read→decrypt round-trips a synthetic address; `encrypted_pii` unreadable by customer AND staff; customer insert denied.
- db typecheck clean; `check:db-imports` + `check:client-stripe` green.

## Operator follow-ups
1. `pnpm install` to link the new `@maralito/crypto` workspace package.
2. `pnpm --filter @maralito/db db:generate` → review + commit the migration adding `encrypted_pii`.
3. `pnpm typecheck && pnpm test && pnpm build` + CI (incl. the new crypto + RLS tests).

## Explicitly NOT done (gated to production)
- Real cloud-KMS provider (AWS KMS / GCP KMS) adapter + key custody, rotation policy, KMS audit logging, break-glass.
- Storing any REAL PII (address/RFC/KYC/documents) — remains prohibited until the above + validation + owner sign-off.
- Wiring the vault into the live delivery flow (the seam exists; the delivery action still uses the opaque ref only).

Development-only; synthetic data only; no real PII. Phase 8 remaining: **8A** (blocked by Phase-7 rows 11/18/19), **8C** (real notification/courier providers, gated).
