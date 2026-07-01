# Decision Record — KMS / Secret-Management (PENDING)

> ADR-0013 · Phase 7 · **Status: 🔲 NOT DECIDED.** This is a template to be filled by an operator/owner.
> Claude has NOT made this decision.

## Why this gates real PII
Several deferred features require storing real customer PII/address content:
- delivery preparation currently stores only an **opaque `delivery_address_ref`** + non-PII windows;
- customer profile / RFC / KYC / document content are **not** collected anywhere yet.

**No real address/PII may be stored until a KMS/secret-management approach is chosen and implemented.**

## Options to evaluate (fill in)
| Option | Encryption at rest | Key custody | Rotation | Notes |
|--------|--------------------|-------------|----------|-------|
| Supabase Vault / pgsodium | | | | column-level in Postgres |
| Cloud KMS (AWS KMS / GCP KMS) + app-side envelope encryption | | | | keys outside DB |
| Dedicated secrets/PII service | | | | |

## Decision (to complete)
- **Chosen approach:** _____________________
- **Where address/PII is stored + encrypted:** _____________________
- **Key custody + rotation:** _____________________
- **Access/audit controls:** _____________________
- **Decided by / date:** _____________________

## Consequence
Until this record is completed and the approach is implemented + validated, BorderPass stores **no real
address/PII**, and the "KMS/secret-management decision" gate in `docs/phase-7/gate-ledger.md` stays unchecked.
