# Phase 8A — Synthetic Device QA Template (per tester, per device)

> **Status:** TEMPLATE (2026-07-05). Copy one instance per device run into `docs/phase-8/run-logs/`.
> **Synthetic data only** — synthetic accounts/orders/names; **no real PII/address/RFC/KYC/docs**;
> **Stripe TEST cards only** (`4242 4242 4242 4242`); no live payments. Development-only —
> completing this template does not authorize a tester round.
> **Row 11-dependent rows are ⛔ BLOCKED until the Supabase redirect-URL save succeeds and the OTP smoke passes.**

## Run metadata

| Field | Value |
|---|---|
| Tester (synthetic alias) | |
| Device + OS version | |
| Browser (iOS Safari / Android Chrome) | |
| App origin (controlled HTTPS host or localhost) | |
| Date (UTC) | |

## Checklist (record PASS / FAIL / BLOCKED + one-line note)

| # | Check | Depends on | Result | Note |
|---|---|---|---|---|
| 1 | Open app over HTTPS; no console/security errors | — | | |
| 2 | Add to Home Screen; launches standalone (manifest + icons load) | — | | |
| 3 | OTP/magic-link login completes (synthetic email) | ⛔ Row 11 | | |
| 4 | Session persists across restart + backgrounding | ⛔ Row 11 | | |
| 5 | Customer dashboard shows own counts + quotes-ready prompt | ⛔ Row 11 | | |
| 6 | Orders list: own orders only; cards legible; no horizontal scroll | ⛔ Row 11 | | |
| 7 | Order detail: header, itemized quote, fee breakdown, totals correct | ⛔ Row 11 | | |
| 8 | Quote **decline** path: two-step confirm → declined state (2nd synthetic quote) | ⛔ Row 11 | | |
| 9 | Quote **accept** path: accept → payment CTA appears | ⛔ Row 11 | | |
| 10 | Payment page: amount correct; **Test mode badge visible**; Element renders | ⛔ Row 11 | | |
| 11 | Stripe TEST card payment → "Processing…" → **Paid only after webhook** | ⛔ Row 11 | | |
| 12 | Failure card (`4000 0000 0000 0002`) → failed state; order NOT paid; retry works | ⛔ Row 11 | | |
| 13 | Inspection card: status + tracker + schedule only (no address/staff text) | ⛔ Row 11 | | |
| 14 | Delivery card: status + tracker + non-PII window only | ⛔ Row 11 | | |
| 15 | Logout → login again; provisioning idempotent (no dup profile/roles) | ⛔ Row 11 | | |
| 16 | Cross-tenant: 2nd synthetic account sees NONE of the 1st's data | ⛔ Row 11 | | |
| 17 | Offline: airplane mode + navigate → branded offline note; reconnect recovers | — | | |
| 18 | Responsive: one-handed use OK at 390/430 px; errors legible; tap targets ≥ ~44px | — | | |
| 19 | No secrets/OTP codes/tokens visible in UI, URLs, or console | — | | |

## Sign-off

- Overall: PASS / FAIL / PARTIAL — blockers: ______________________
- Evidence files (redacted screenshots, no PII/secrets): ______________________
