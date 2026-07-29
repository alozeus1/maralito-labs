# KMS Production Plan — PII at Rest

> **Scope:** closes **B3** of `docs/phase-9/production-readiness-review.md` and the open tail of
> `docs/phase-7/decision-kms.md` / `docs/decisions/adr/0017-kms-envelope-encryption.md`.
> **Status:** the AWS KMS provider is **implemented and offline-verified in this repo**. It is **not wired
> into the provider factory**, **no AWS key exists**, and **no real PII may be stored yet**.
> **Nothing in this document marks a gate passed.** BorderPass remains development-only.

**Legend** — ✅ **DONE** (verified in-repo, offline) · 🟠 **OPERATOR ACTION REQUIRED** (AWS/Vercel console
or the operator's machine) · 🔴 **BLOCKED** (must be fixed before the next step is even safe to attempt).

---

## 0. 🔴 STOP — a second, fail-OPEN PII path exists today

**This is the single most important finding in this document. Read it before doing anything else.**

ADR-0017's guarantee is *"real PII cannot be stored in production, because the local KMS provider is
fail-closed in production."* **That guarantee is currently false.** There are **two** independent PII
encryption paths in the repo, and only one of them is fail-closed:

| Path | Key custodian | Prod refusal? | Used by |
|---|---|---|---|
| `@maralito/crypto` → `kms/config.ts` → `LocalDevKmsProvider` → `encrypted_pii` (jsonb `EncryptedField`) | `BORDERPASS_KMS_KEY` via scrypt | ✅ **throws when `BORDERPASS_ENV=production`** | `apps/borderpass/src/server/pii-vault.ts` |
| `apps/borderpass/src/server/kms.ts` → `apps/borderpass/src/domain/crypto/envelope.ts` (`seal`/`open`, `v1.…` token in `addresses.*Enc` text columns) | `BORDERPASS_KMS_KEY` parsed directly as a raw 32-byte KEK | 🔴 **NO refusal — none whatsoever** | `apps/borderpass/app/actions/addresses.ts` (`createMyAddress`, `listMyAddresses`) |

`createMyAddress` is a live `'use server'` action reachable by **any authenticated customer**. It stores
real `recipient`, `line1`, `line2`, `city`, `state`, `postal`, `phone`. Its only guard is
`isKmsConfigured()`, which merely checks that `BORDERPASS_KMS_KEY` is *present*.

**Consequence:** the moment `BORDERPASS_KMS_KEY` is set in a Vercel **Production** environment, BorderPass
begins collecting and storing **real customer address PII** under an ordinary environment-variable KEK —
no HSM, no CloudTrail, no rotation, no dual control, and **without the owner sign-off that
`decision-kms.md` requires**. Combine that with **D1** of the Phase-9 review (`addresses-policies.sql` is
not in any provisioning path, so `addresses` has **no RLS at all**) and the exposure is: *real PII, under a
dev-grade key, in a table any authenticated user can read.*

### Required before production (all 🔴, none are mine to land — coordinate with the app owner)

| # | Action | File |
|---|---|---|
| K0.1 | Make `sealPii`/`openPii` **fail closed in production** unless an approved cloud provider is active — mirror `LocalDevKmsProvider`'s check. | `apps/borderpass/src/server/kms.ts` |
| K0.2 | Better: **retire the second path.** Migrate `addresses.*Enc` onto `pii-vault.ts` / `@maralito/crypto` so there is exactly one custodian, one ciphertext format, one rotation story. | `app/actions/addresses.ts`, `src/server/kms.ts`, `src/domain/crypto/envelope.ts` |
| K0.3 | Until K0.1/K0.2 land: **do NOT set `BORDERPASS_KMS_KEY` in any Production environment**, and keep `createMyAddress` unreachable in production. | Vercel env |
| K0.4 | Apply `addresses-policies.sql` (and every other policy file) — see `production-environment-runbook.md` §4. | `packages/db/src/rls/` |

> If only one thing from this whole document gets done, make it **K0.3**.

---

## 1. What is DONE in this repo (offline-verified)

| Item | State | Evidence |
|---|---|---|
| Envelope encryption (AES-256-GCM, per-record DEK, versioned `EncryptedField`) | ✅ | `packages/crypto/src/envelope.ts`; ADR-0017 9/9 offline |
| `KmsProvider` abstraction (wrap/unwrap DEK only; never sees plaintext) | ✅ | `packages/crypto/src/kms/provider.ts` |
| Local dev provider, **fail-closed in production** | ✅ | `packages/crypto/src/kms/local-provider.ts` |
| Privileged-only PII vault + `encrypted_pii` table | ✅ | `apps/borderpass/src/server/pii-vault.ts`, `packages/db/src/schema/pii.ts` |
| **AWS KMS provider (`Encrypt`/`Decrypt` over SigV4, zero new npm deps)** | ✅ **NEW** | `packages/crypto/src/kms/aws-provider.ts` |
| **SigV4 + provider regression suite** | ✅ **NEW — 24/24 offline** | `packages/crypto/src/kms/aws-provider.test.ts` |
| AWS provider **selected by `getKmsProvider`** | 🔴 **NO — still throws** | `packages/crypto/src/kms/config.ts` (deliberate; see §5) |
| An actual AWS account / CMK / IAM principal | 🟠 does not exist | — |
| Owner sign-off for real PII | 🟠 not requested | `decision-kms.md` |

### Why hand-rolled SigV4 (and why that is acceptable here)

`@aws-sdk/client-kms` cannot be added: the operator cannot currently run `pnpm install`, and a
lockfile-less dependency addition breaks CI (row 1). KMS `Encrypt`/`Decrypt` is the *simplest* SigV4 case —
`POST /`, no query string, no path escaping, five headers, a JSON body.

The decisive safety argument: **a signing bug is fail-closed, not silently wrong.** AWS validates every
signature, so a defect yields HTTP 403 and an exception — it can never produce wrong-but-accepted
ciphertext or a corrupted DEK. Payload confidentiality still comes from the already-verified
`envelope.ts`; this file is only the KEK custodian.

Verified offline against AWS's own published vectors (`node` + `esbuild`, 24/24):

| Vector | Source | Result |
|---|---|---|
| `get-vanilla` canonical request, string-to-sign, signature, `Authorization` | `aws-sig-v4-test-suite` | ✅ exact match |
| `post-vanilla` signature (the POST path KMS uses) | `aws-sig-v4-test-suite` | ✅ exact match |
| Signing-key derivation `kDate→kRegion→kService→kSigning` | AWS docs example | ✅ exact match |
| Header lower-casing / sorting / whitespace collapsing | — | ✅ |
| Body hashed into the canonical request | — | ✅ |
| Region + service scoping, determinism | — | ✅ |
| Secret key absent from `Authorization` and string-to-sign | — | ✅ |
| Encrypt request shape (`TrentService.Encrypt`, `x-amz-json-1.1`, `KeyId`, `EncryptionContext`) | — | ✅ |
| Decrypt **omits `KeyId`**, sends `EncryptionContext` | — | ✅ |
| `x-amz-security-token` added for STS credentials | — | ✅ |
| Full round-trip through `envelope.ts` with the provider as custodian | — | ✅ |
| 4xx → throw; 4xx **not** retried; 5xx retried then throws; throttle retried then succeeds | — | ✅ |
| Network error → `KmsProviderUnavailableError` with **no** underlying cause text | — | ✅ |
| Empty DEK / empty blob / missing `CiphertextBlob` / tampered blob → throw | — | ✅ |

Typecheck: clean under the repo's exact strict flags (`strict`, `exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`, `verbatimModuleSyntax`).

**Not proven offline, by definition:** that a real AWS endpoint accepts these signatures. That is gate
**G2** in §7 and it is an operator action.

---

## 2. Provider choice — AWS KMS

**Decision: AWS KMS, symmetric customer-managed key (CMK), `ENCRYPT_DECRYPT`, single region.**

| Criterion | AWS KMS | GCP KMS | Rationale |
|---|---|---|---|
| Envelope-encryption fit | ✅ | ✅ | Both wrap/unwrap DEKs |
| Audit trail | CloudTrail (per-call, includes encryption context) | Cloud Audit Logs | Equivalent |
| Access conditions on context | `kms:EncryptionContext:<k>` IAM condition keys | weaker equivalent | **AWS wins** |
| Rotation | automatic annual CMK rotation, transparent to old ciphertext | supported | Equivalent |
| Implementation cost here | one JSON-1.1 POST, SigV4 (done) | JSON+OAuth2 token exchange (more moving parts) | **AWS wins** |
| Existing footprint | Supabase `borderpass-dev-gate` is in `us-east-2` | — | Co-locating in `us-east-2` minimises latency |

> Pricing, request-rate quotas, and regional availability change — **verify current figures in the official
> AWS KMS documentation** before committing. Expect per-key monthly cost plus per-request cost; BorderPass
> issues **one KMS call per PII write and one per PII read**, so throughput is small. If read volume grows,
> add a short-lived in-process DEK cache (**out of scope here — do not add it without a fresh review**).

**GCP KMS remains a valid alternative.** If the owner prefers GCP, the `KmsProvider` interface is unchanged
and only a `gcp-provider.ts` is needed; everything else in this plan carries over.

---

## 3. Key, alias, and policy design 🟠 OPERATOR

### 3.1 Key
| Property | Value |
|---|---|
| Type | Symmetric, `ENCRYPT_DECRYPT`, AWS-managed key material (no BYOK for v1) |
| Region | `us-east-2` (match the production Supabase region) |
| Alias | `alias/borderpass-prod-pii` — **use the ALIAS ARN in `MARALITO_KMS_KEY_ID`**, never a bare key id |
| Description | `BorderPass production customer PII (addresses, RFC, KYC, documents)` |
| Deletion window | **30 days** (maximum) — a shorter window makes an accidental deletion unrecoverable |
| Multi-Region | **No** for v1. Revisit only alongside a DR-region decision |
| Tags | `app=borderpass`, `env=production`, `data=pii`, `owner=<owner>` |

Create a **separate** `alias/borderpass-staging-pii` key if a staging environment is ever stood up.
**Never** share a CMK between environments — that is how a preview deploy ends up able to decrypt
production PII.

### 3.2 Key policy (on the key) — deny-by-default
The key policy is the outer boundary; IAM alone is not enough. Grant exactly:

1. **Key administrators** — the owner's break-glass principal only. May `Describe/Enable/Disable/
   ScheduleKeyDeletion/PutKeyPolicy`, and must **not** have `Encrypt`/`Decrypt`.
2. **Key users** — the `borderpass-prod-kms` application principal only. May `Encrypt`, `Decrypt`,
   `DescribeKey`. Nothing else. Not `ScheduleKeyDeletion`, not `PutKeyPolicy`.
3. **Separation of duty:** the administrator principal cannot read PII; the application principal cannot
   delete or re-policy the key. Neither should be a human's daily-driver user.

### 3.3 IAM policy for the application principal (least privilege)

```jsonc
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "BorderPassPiiEnvelopeOnly",
    "Effect": "Allow",
    "Action": ["kms:Encrypt", "kms:Decrypt", "kms:DescribeKey"],
    "Resource": "arn:aws:kms:us-east-2:<account-id>:key/<key-id>",
    "Condition": {
      "StringEquals": {
        "kms:EncryptionContext:app": "borderpass",
        "kms:EncryptionContext:purpose": "pii",
        "kms:ViaService": "kms.us-east-2.amazonaws.com"
      }
    }
  }]
}
```

The `EncryptionContext` conditions are the point: they bind the principal to the exact context
`AWS_KMS_ENCRYPTION_CONTEXT` sends (`{app:'borderpass', purpose:'pii'}`), so a leaked credential cannot be
used to decrypt anything encrypted for a different purpose, and cannot encrypt data that this app would
later refuse to read.

**No `kms:*`. No `Resource: "*"`. No wildcard actions. Ever.**

### 3.4 Credentials on Vercel
Vercel has no IMDS, so the provider uses static credentials. 🟠 Operator:
- Create IAM user `borderpass-prod-kms` with **no console access** and the policy above attached directly.
- Set `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in the Vercel **Production scope only**.
- **Never** set them in Preview or Development. Preview must stay on the local dev provider with synthetic
  data (see `production-environment-runbook.md` §6).
- Prefer a short-lived STS role if/when the deployment target supports it — the provider already sends
  `x-amz-security-token` when `AWS_SESSION_TOKEN` is set.

---

## 4. Rotation, audit, and break-glass

### 4.1 CMK rotation
- Enable **automatic key rotation** on the CMK (annual). AWS keeps prior key material, so **existing
  ciphertext keeps decrypting with no application change and no re-encryption**. This is the main reason to
  use a CMK rather than an app-held key.
- **Manual rotation to a brand-new CMK** (only after a suspected compromise): create the new key, repoint
  `alias/borderpass-prod-pii`, and **temporarily grant `kms:Decrypt` on BOTH the old and new key ARNs** to
  the app principal so historical rows still open. The provider deliberately **omits `KeyId` on `Decrypt`**
  precisely so alias repointing does not strand old blobs. Re-encrypt in the background, then remove the
  old key from the policy and schedule its deletion.

### 4.2 DEK rotation
Every record already gets a fresh random 256-bit DEK (`envelope.ts`), and `keyRef` is stored per record —
so re-encryption can be driven by querying `encrypted_pii` for rows whose `key_ref` is stale. No schema
change needed. (A re-encryption job is **not built**; write it only when a rotation is actually required.)

### 4.3 Audit 🟠 OPERATOR
- Enable **CloudTrail** in `us-east-2` with a dedicated trail; KMS `Encrypt`/`Decrypt` are management
  events and include the encryption context and the calling principal.
- Ship the trail to an S3 bucket with **object lock / versioning**, retention ≥ 1 year.
- Alarm on: `Decrypt` calls from an unexpected principal · any `ScheduleKeyDeletion` or `PutKeyPolicy` ·
  `AccessDenied` spikes (a signing/IAM regression, or an attack) · `Decrypt` volume anomalies.
  Route to the n8n Notification Router (`IUSMhbApLaEBCVG2`) per `observability-and-alerting.md`.
- App-side, every PII touch already goes through `withPrivilegedDbAccess('pii.store' | 'pii.read')`, which
  is audited. **Do not** add plaintext to those audit rows.

### 4.4 Break-glass (dual control)
Emergency decryption outside the app requires **two people**: the key administrator temporarily adds
`kms:Decrypt` for a named break-glass principal, and a second person performs the decryption. Record the
ticket, the reason, the exact rows, and revert the policy within the same session. CloudTrail is the
evidence. **Never** hand a human the application principal's credentials.

---

## 5. Wire the factory (the deliberate remaining seam) 🔴

`packages/crypto/src/kms/config.ts` is **not owned by this document** and is **deliberately left throwing**
for `MARALITO_KMS_PROVIDER=aws`. Fail-closed beats a half-wired production key path. Landing it is a
one-case change, to be made **only** after G1–G4 in §7 pass:

```ts
// packages/crypto/src/kms/config.ts — inside getKmsProvider's switch
    case 'aws':
      return createAwsKmsProvider();   // import { createAwsKmsProvider } from './aws-provider';
    case 'gcp':
      throw new KmsProviderUnavailableError(/* unchanged */);
```

`isKmsConfigured()` already returns `Boolean(env.keyId)` for `aws`, which is necessary but **not
sufficient** — it does not check credentials. Either tighten it to call `isAwsKmsConfigured()` or accept
that a missing credential fails loudly at first use (it does — `createAwsKmsProvider` throws).

---

## 6. Envelope flow (unchanged contract)

```
WRITE  plaintext PII (server only)
        └─ envelope.ts: DEK = random 256-bit
           ├─ AES-256-GCM(plaintext, DEK)            → ct + iv + tag
           └─ AwsKmsProvider.wrapDataKey(DEK)
              └─ HTTPS POST kms.<region>.amazonaws.com  TrentService.Encrypt
                 { KeyId: alias ARN, Plaintext: b64(DEK), EncryptionContext }
                                                     → CiphertextBlob
        └─ store EncryptedField {v,alg,keyRef,iv,ct,tag,dek} in encrypted_pii.ciphertext (jsonb)

READ   EncryptedField
        └─ AwsKmsProvider.unwrapDataKey(dek)
           └─ TrentService.Decrypt { CiphertextBlob, EncryptionContext }   (no KeyId — see §4.1)
                                                     → DEK
        └─ AES-256-GCM open → plaintext (server only; never logged, never sent to the client)
```

Invariants that must not regress: the CMK never touches payload bytes · plaintext DEKs exist only in
process memory for one call · GCM auth tags reject any tamper · `keyRef` is recorded per record ·
decryption happens only inside privileged server seams; RLS keeps ciphertext rows out of tenant reach.

---

## 7. Gate tests — ALL must pass before ANY real PII is stored

Record each in `docs/phase-7/gate-ledger.md` as a new **Phase 9** row, with date, runner, and evidence.
**No box is ticked until it was actually executed.** Every row below is 🔲 UNRUN today.

| # | Gate | How to run | Pass criterion | State |
|---|---|---|---|---|
| **G0** | **§0 fail-open path closed** | Code review + `pnpm test` | `sealPii` refuses production **or** `addresses` is migrated onto `pii-vault`; no PII write path bypasses the fail-closed provider | 🔲 |
| **G1** | Offline suite green in CI | `pnpm --filter @maralito/crypto test` | `aws-provider.test.ts` + `crypto.test.ts` pass in real Vitest (24 + 9) | 🔲 |
| **G2** | **Live AWS round-trip** | operator script against the real CMK with prod credentials | `wrapDataKey` → `unwrapDataKey` returns the identical 32 bytes; latency recorded | 🔲 |
| **G3** | **Wrong-context rejection** | Call `Decrypt` with a modified `EncryptionContext` | AWS returns `InvalidCiphertextException`; provider throws; **no plaintext** returned | 🔲 |
| **G4** | **Least-privilege proven** | With prod credentials, attempt `kms:ScheduleKeyDeletion` and `Decrypt` on an unrelated key | Both `AccessDenied` | 🔲 |
| **G5** | **Local provider refused in production** | Set `BORDERPASS_ENV=production`, `MARALITO_KMS_PROVIDER=local` in a throwaway prod-like env | `KmsProviderUnavailableError`; no PII written | 🔲 |
| **G6** | **Misconfiguration fails closed** | Unset `AWS_SECRET_ACCESS_KEY` in a prod-like env | PII write throws; the request fails; **nothing is stored in the clear** | 🔲 |
| **G7** | **End-to-end vault round-trip on production infra** | Store + read one **synthetic** address via `pii-vault.ts` against the production Supabase project | Ciphertext in `encrypted_pii`; decrypt matches; **row deleted afterwards** | 🔲 |
| **G8** | **RLS covers the PII tables** | `pnpm gate:rls` with `addresses` + `encrypted_pii` isolation assertions | Cross-tenant read = 0 rows; anon = 0 rows | 🔲 |
| **G9** | **Audit trail visible** | Trigger G7, then read CloudTrail | `Encrypt` + `Decrypt` events present with the right principal and encryption context | 🔲 |
| **G10** | **No plaintext in logs** | Grep Vercel + Sentry output after G7 | Zero occurrences of the synthetic address values | 🔲 |
| **G11** | **Consent + legal live** | `legal-consent.md` counsel review complete; consent recorded at sign-up | A real user cannot submit an address without a versioned consent record | 🔲 |
| **G12** | **Owner sign-off** | Written, referencing G0–G11 | Owner authorises real-PII storage | 🔲 |

**Only after G12 may `EMAIL`/PII-bearing features be enabled for real customers.** G12 is also the
precondition for `notifications-production-plan.md` (real recipients) and for Stripe LIVE.

---

## 8. Rollback

| Scenario | Action | Data impact |
|---|---|---|
| AWS provider misbehaving in production | Set `MARALITO_KMS_PROVIDER` to an unset/unknown value → `getKmsProvider` throws → **all PII writes and reads fail closed**. Feature is down; nothing leaks. | None. Existing ciphertext untouched. |
| Bad deploy after the factory is wired | Vercel **instant rollback** to the previous production deployment. | None — ciphertext format is versioned (`v:1`) and unchanged. |
| Suspected credential compromise | Deactivate the IAM access key immediately (PII paths fail closed), issue a new key, update Vercel Production, then rotate the CMK per §4.1. | None, if CloudTrail shows no unexpected `Decrypt`. |
| Suspected **key** compromise | Manual CMK rotation (§4.1) + background re-encryption + schedule the old key for deletion after re-encryption completes. | Requires re-encryption; old key must stay decryptable until it finishes. |
| Need to abandon AWS KMS | Implement `gcp-provider.ts` against the same `KmsProvider` interface; re-encrypt via a job that reads with the old provider and writes with the new one. `keyRef` identifies which is which. | Re-encryption required; no schema change. |

**Rollback that is NOT available:** deleting the CMK. A deleted key makes every ciphertext permanently
unreadable. Hence the 30-day deletion window and the admin/user separation in §3.2.

---

## 9. Environment variables (NAMES only — never commit values)

| Name | Scope | Required when | Notes |
|---|---|---|---|
| `MARALITO_KMS_PROVIDER` | server, all envs | always | `local` in dev/preview; `aws` in production **only after §5** |
| `MARALITO_KMS_KEY_ID` | server, Production | provider=aws | **Alias ARN** `arn:aws:kms:<region>:<account-id>:alias/borderpass-prod-pii` |
| `MARALITO_KMS_REGION` | server, Production | provider=aws | Optional if the key ARN carries the region; falls back to `AWS_REGION` |
| `MARALITO_KMS_ENDPOINT` | server, Production | optional | VPC / FIPS endpoint override |
| `AWS_ACCESS_KEY_ID` | server, **Production only** | provider=aws | `borderpass-prod-kms` principal |
| `AWS_SECRET_ACCESS_KEY` | server, **Production only** | provider=aws | Never in Preview/Development |
| `AWS_SESSION_TOKEN` | server, Production | STS creds only | Sent as `x-amz-security-token` |
| `BORDERPASS_KMS_KEY` | server, **dev/preview only** | provider=local | 🔴 **Do NOT set in Production** until §0 K0.1/K0.2 land |
| `BORDERPASS_ENV` | server, all envs | always | Must be exactly `production` in prod — it drives the fail-closed check |

---

## 10. Ordered execution plan

1. 🔴 **§0 K0.3** — confirm `BORDERPASS_KMS_KEY` is unset in every Production environment. *Do this first.*
2. 🔴 **§0 K0.1/K0.2** — close or retire the fail-open path (**G0**).
3. 🟠 CI: run `pnpm --filter @maralito/crypto test` on the operator's machine + PR (**G1**).
4. 🟠 AWS: account, CMK, alias, key policy, IAM principal, CloudTrail (**§3, §4.3**).
5. 🟠 Vercel Production: set the §9 variables (still `MARALITO_KMS_PROVIDER=local`? no — leave `aws` unset until step 6).
6. 🟠 Run **G2–G4** with a throwaway script before touching `config.ts`.
7. 🔴 Land the §5 one-case factory change; deploy; run **G5–G10**.
8. 🟠 **G11** legal/consent, then **G12** owner sign-off.
9. Only then: real PII, then real notification recipients, then Stripe LIVE.

---

*Static + offline verification only. No AWS account, key, or credential was accessed or created. No gate
in `docs/phase-7/gate-ledger.md` is changed by this document.*
