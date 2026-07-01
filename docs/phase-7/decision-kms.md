# Decision Record — KMS / Secret-Management

> ADR-0013 · Phase 7 · **Status: 🔲 NOT DECIDED — OWNER SIGN-OFF REQUIRED.**
> Drafted for owner decision. Claude has NOT made this decision and does not mark ledger row 16 passed.
> Development-only until an owner signs off and (for real PII) the chosen approach is implemented + validated.

## Scope

This record covers two related but distinct concerns behind gate row 16:

1. **Secret custody** — where server-only secrets live (DB password, `SUPABASE_SERVICE_ROLE_KEY`, Stripe keys, webhook secrets, provider tokens) and how they are rotated, accessed, and audited.
2. **PII-at-rest encryption** — how real customer PII will be encrypted when it is eventually stored (envelope encryption + key custody).

## Why this gates real PII

Deferred features will require storing real customer PII/address content that is **not collected anywhere today**:

- Delivery preparation currently stores only an **opaque `delivery_address_ref`** + non-PII scheduling windows — no street, name, phone, postal code, or body.
- Customer profile / **RFC** (Mexican tax ID) / **KYC** / document content are not collected in any schema.

**No real address/PII/RFC/KYC content may be stored until a KMS/secret-management approach is chosen, implemented, and validated.** The current build stays synthetic-only.

## Options

### Option A — Managed platform secrets only (Supabase + Vercel)
- **What:** keep secrets in Supabase project settings + Vercel environment variables + local secrets manager; no application-level envelope encryption of PII.
- **Fit:** acceptable for **development/test only** with synthetic data.
- **Limitation:** **not sufficient for real PII / RFC / KYC / address content.** No customer-managed keys, no per-field encryption, coarse access logging.
- **Verdict:** current dev-only posture; must not be the posture when real PII is introduced.

### Option B — Cloud KMS envelope encryption (recommended before real PII)
- **What:** application-side envelope encryption of PII columns using a cloud KMS (AWS KMS or GCP KMS) — data keys wrapped by a KMS CMK; ciphertext stored in Postgres, plaintext keys never at rest.
- **Requires defining:** key ownership, **rotation** policy (CMK + data-key), **access logging** (KMS audit trail), least-privilege IAM to the encrypt/decrypt operations, and a **break-glass** procedure with dual control.
- **Fit:** **recommended before storing any real PII / RFC / KYC / address data.**
- **Cost/complexity:** moderate; adds a KMS dependency and encryption seams in the data layer.

### Option C — External secrets manager
- **What:** centralize *secret custody* in AWS Secrets Manager / GCP Secret Manager / HashiCorp Vault, injected at deploy/runtime rather than platform env vars.
- **Fit:** useful **if Maralito standardizes secrets across apps** outside Supabase/Vercel, or needs dynamic secrets / fine-grained rotation + audit.
- **Note:** complements — does not replace — Option B. Secret custody (this option) and PII-at-rest encryption (Option B) are separate axes; real PII likely needs **B**, and **C** is an org-level custody choice.

## Recommended decision (for owner ratification)

1. **Development/test:** use **managed platform secrets** (Option A) — current posture — with synthetic data only.
2. **Before any real PII / RFC / KYC / address content:** require a **KMS / envelope-encryption decision (Option B)**, implemented and validated, with key custody + rotation + access logging + break-glass defined. Consider **Option C** at the same time if Maralito wants org-wide secret custody.
3. **Immediate hygiene (independent of the above):** rotate any exposed dev secrets, keep all server-only secrets out of `NEXT_PUBLIC_*`, and define a rotation owner for `SUPABASE_SERVICE_ROLE_KEY`, DB password, and Stripe keys (see `env-secrets-review.md`, row 18).

## Decision (owner completes)

- **Chosen secret-custody approach:** _____________________
- **Chosen PII-at-rest approach (before real PII):** _____________________
- **Key custody + rotation policy:** _____________________
- **Access / audit controls + break-glass:** _____________________
- **Decided by / date:** _____________________

## Status

```
NOT DECIDED — OWNER SIGN-OFF REQUIRED
```

Until an owner completes and signs this record (and, for real PII, the approach is implemented + validated), gate row 16 in `docs/phase-7/gate-ledger.md` stays 🔲 and BorderPass stores **no real address/PII/RFC/KYC** content.
