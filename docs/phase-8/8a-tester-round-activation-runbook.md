# Phase 8A — Tester-Round Activation Runbook

> **Status:** ACTIVATION PUNCH-LIST (2026-07-14). **8A dev-only is COMPLETE** (increments 8A.1–8A.8; see
> `8a-final-dev-review.md`). This runbook is the ordered path from *dev-complete* to a **live synthetic private
> tester round**. It is mostly **owner/operator + on-device** work; the agent's part is small and marked.
> BorderPass stays **DEVELOPMENT-ONLY** and **testers remain BLOCKED** until every step here is ✅ with evidence.
> No real PII · no live payments · synthetic accounts only (ADR-0015).

## What changed since the 8A review

- **Row 11 (OTP) → ✅ PASS 2026-07-08** (`docs/phase-7/run-logs/otp-smoke-20260708T045425Z.md`). This clears the
  auth-path blocker on the 8A.7 device dry-run. **Caveat:** the pass was a *programmatic* admin-API smoke. The
  **browser redirect-URL save** for the preview host (a Supabase platform incident on 07-05) must be re-verified —
  see Step 2.

## Preconditions already satisfied (do not redo)

- 8A.1–8A.6 mobile polish + PWA wiring shipped; 8A.8 dev review green (typecheck/lint/build/tests/guards, Stripe
  `stripe:smoke` 5/5 TEST offline).
- Controlled HTTPS preview deployed behind Vercel Deployment Protection (`8a-preview-deployment-evidence.md`).
- Device QA template ready: `8a-device-qa-template.md` (19-row per-device fill-in).

## Activation steps (in order — each gates the next)

| # | Step | Role | Evidence to record |
|---|------|------|--------------------|
| 1 | **Close Phase 7 Row 18** — remove old exposed keys from Supabase *Settings → API → Previously used keys*; set the rotated password on the **Vercel Preview** env `DATABASE_URL`. | Owner | Ledger row 18 → ✅ (note in `docs/phase-7/gate-ledger.md`) |
| 2 | **Save Supabase redirect URLs for the preview** (incident may have cleared). In a clean browser profile / Incognito, add the **stable preview alias** (`https://borderpass-dev.vercel.app/**` + `/auth/callback`) — not per-deploy hosts — and confirm they persist after reload. | Owner | Screenshot/URL list saved; note in `8a-preview-deployment-evidence.md` |
| 3 | **Set preview env vars** (names in `8a-controlled-preview-deployment-plan.md §2`) in Vercel **Preview** scope, server-only. Include `DEV_SYNTHETIC_NOTIFY_EMAIL` only if a notification check is wanted (8C dispatch stays synthetic/dark). | Owner | Env var names present (no values in repo) |
| 4 | **Create the Stripe TEST webhook** for the preview: dashboard (TEST mode) → `https://<preview-host>/api/stripe/webhook`, the 5 `payment_intent.*` events, API version 2024-06-20; store signing secret in Vercel Preview. **Never live keys.** | Owner | Endpoint id + events; teardown reminder |
| 5 | **Confirm Row 19 activation.** With rows 11 + 18 closed, the owner's Option B conditional approval activates — tick it in `deployment-readiness-checklist.md`. | Owner | Ledger row 19 → ✅ |
| 6 | **8A.7 device dry-run** — run `8a-device-qa-template.md` end-to-end on **one iOS + one Android** device against the preview, with **synthetic** accounts: install PWA, OTP login, dashboard/lists, quote accept + decline, **Stripe TEST** payment (webhook-confirmed paid + a failure card), inspection/delivery visibility, logout/relogin, cross-tenant isolation, offline fallback, no-secret check. | Operator (on device) | One filled template per device in `docs/phase-8/run-logs/` |
| 7 | **Owner sign-off for the tester round** (separate from Row 19): confirm the dry-run evidence is clean and invites may go out to the named synthetic testers. | Owner | Signed note in the run-log |
| 8 | **Teardown after the round:** delete the Stripe TEST webhook, rotate/scope the preview access, archive evidence. | Operator | Teardown note |

## Agent-executable follow-up (optional, pre-round)

- **8A.9 (icon swap) — agent, if assets exist:** replace the solid-brand placeholder PWA icons with the
  Stitch-designed set (`docs/design/…`). Pure asset swap, no logic change; verify manifest still serves + Lighthouse
  installability. Contingent on the icon assets being provided — otherwise the round can proceed with placeholders.
- Out of scope for the round (tracked, not blocking): es/en locale toggle, optional decline-reason capture, admin-area
  mobile gaps (from the 8A.1 audit).

## Verification / definition of done

Tester round is "live" only when steps 1–7 are ✅ with evidence, the gate ledger reflects rows 18/19 closed, and at
least one clean iOS + one clean Android device template are filed. Any ⛔/FAIL row in a device template **halts**
the round until fixed.

## What this runbook does NOT do

Authorize real PII (still 8B/KMS-gated) · authorize live payments (Stripe LIVE / Row 15 stays deferred) · move beyond
a private synthetic tester round to staging/pilot/production · change any state machine, schema, or invariant.
