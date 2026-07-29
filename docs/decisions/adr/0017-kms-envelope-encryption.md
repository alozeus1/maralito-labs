# ADR 0017 — KMS Envelope Encryption for PII (Phase 8B)

- **Status:** Accepted (seam + dev provider; **development-only**). Real-PII storage still requires a cloud-KMS
  provider + validation + **owner sign-off**. · **Date:** 2026-07-02 · **Phase:** 8B
- **Numbering:** 0017 = KMS envelope encryption. (0016 = n8n boundary.) Next ADR = 0018. Implements `decision-kms.md` Option B.

## Context

`decision-kms.md` (row 16, owner-signed) requires **Cloud KMS envelope encryption before any real PII**
(address / RFC / KYC / documents). Today BorderPass stores only an opaque `delivery_address_ref` + non-PII
windows; no real PII exists anywhere. Phase 8B builds the encryption **seam** so real PII *can* be stored
safely later — without collecting any real PII now.

## Decision

1. **Envelope encryption, provider-abstracted.** New `@maralito/crypto` package. Per-record random 256-bit
   **DEK** encrypts the payload with **AES-256-GCM** (authenticated); the DEK is **wrapped** by a KMS
   provider's **KEK**. Plaintext keys never persist; the KEK never touches the data. Ciphertext is a
   self-describing, versioned `EncryptedField` JSON blob (`{v,alg,keyRef,iv,ct,tag,dek}`) stored in `jsonb`.
2. **Provider interface** (`KmsProvider.wrapDataKey/unwrapDataKey`). The **local dev provider** derives a KEK
   from `BORDERPASS_KMS_KEY` (scrypt) and is **REFUSED in production** (fail-closed) — a dev secret must never
   protect real prod PII. **AWS/GCP adapters are documented seams that throw until implemented + configured**,
   so a production misconfiguration fails loudly rather than silently using a dev key.
3. **Integrity + rotation.** GCM auth tag rejects any tamper of ciphertext/IV/tag/wrapped-DEK. `keyRef` is
   stored per record to support key rotation and provider selection.
4. **Server-only.** All encrypt/decrypt runs server-side; plaintext PII is never logged and never sent to the
   client. Decryption is reserved to privileged server seams; RLS keeps ciphertext rows out of tenant reach.

## Consequences

- The seam is ready; **no real PII is stored until** (a) a cloud-KMS provider (AWS/GCP) adapter is implemented +
  configured, (b) it is validated, and (c) the owner signs off — each a separate step beyond this ADR.
- New workspace package `@maralito/crypto` (Node `crypto` only, zero external deps). Operator runs `pnpm install`
  to link it. Storage schema (`encrypted_pii`) + the delivery-address seam land in 8B.3–8B.4.

## Verified (offline)

`@maralito/crypto` **9/9** on the emitted package code: round-trip; ciphertext hides plaintext; unique DEK/IV per
encryption; **GCM tamper-reject**; wrong-KEK reject; **local provider fail-closed in production**; AWS/GCP throw
until wired; config detection. Committed Vitest suite mirrors these for CI.

## Non-goals

Collecting/storing real PII before the above sign-offs · a live cloud-KMS integration (adapter stubs only) ·
client-side decryption · anything requiring the open Phase-7 gates. Development-only.
