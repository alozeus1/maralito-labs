# Phase 6 — Address Policy

> ADR-0012 · development-only. **No real address PII is stored anywhere in Phase 6.**

## Rule
Delivery preparation stores **only**:
- an **opaque `delivery_address_ref`** — an identifier pointing at a future KMS-gated address record (no content), and
- **non-PII scheduling windows** — `scheduled_window_start` / `scheduled_window_end` timestamps.

## MUST NOT store (anywhere: schema, actions, UI inputs)
Street address, recipient name, phone number, postal/ZIP code, address body/lines, RFC, KYC, document content,
photos, or any sensitive logistics detail.

## Why deferred
Storing real address/recipient PII requires the **KMS / secret-management decision** to be made first — that
is a standing release blocker. Until then, only the opaque reference + non-PII window exist. The customer-safe
delivery summary never returns `delivery_address_ref` (or `staff_notes`); only staff see the opaque ref.

## Enforcement
- Schema review: `delivery_preparations` has no address-content columns (grep-asserted).
- Validation: action inputs accept only `delivery_address_ref` (opaque, ≤200 chars) + ISO scheduling windows.
- UI: the admin delivery panel exposes only two `datetime-local` window inputs — no address fields.
