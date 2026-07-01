# BorderPass — Mobile Testing Readiness Plan (Private / Internal Testers)

> **Goal:** a private, production-safe **mobile testing release for trusted internal testers** — NOT a public launch.
> **Status:** PLAN (drafted 2026-07-01). Development-only. Does not start Phase 8. Owner ratified **PWA-first**.
> **Hard guardrails (non-negotiable for this release):**
> - **Synthetic data only.** No real customer PII / RFC / KYC / address until the KMS decision (row 16, Option B) is *implemented + validated*. `decision-kms.md`.
> - **Stripe TEST mode only.** No live charges (rows 12–15 must pass first).
> - **Rotate the exposed dev secrets** before any tester touches the environment (`env-secrets-review.md`, row 18 open action).
> - **OTP must be unblocked** (row 11) before auth testing.
> - Internal testers only; access controlled; not listed publicly.

## 0. Gate preconditions before inviting testers

| Prereq | Ledger | State |
|--------|--------|-------|
| Live DB + migrations + RLS + isolation gate | 6–10 | ✅ PASS |
| PR CI green (SAST/secret-scan/Semgrep/OSV/tests/build) | 5 | ✅ PASS |
| KMS decision (dev posture; KMS before real PII) | 16 | ✅ owner-signed |
| Preview-branching decision (defer) | 17 | ✅ owner-signed |
| Env/secrets review | 18 | ✅ done — **rotation open action must close first** |
| **OTP → provisioning → session smoke** | 11 | 🔲 **blocked (Supabase auth-redirect incident)** — required for mobile auth |
| **Stripe TEST-mode validation** | 12–15 | 🔲 required before payment testing |
| Owner sign-off for testing release | 19 | 🔲 |

**Testers cannot be invited until 11, 12–15, and the row-18 rotation close, plus row-19 sign-off.** Everything below is buildable in parallel now against synthetic data.

## 1. PWA-first vs Expo React Native — decision

**Decision (owner-ratified): PWA-first** — ship the existing Next.js app as an installable PWA for the internal testing round.

| Factor | PWA-first (chosen) | Expo / React Native (deferred) |
|--------|--------------------|-------------------------------|
| Time to a tester build | Fastest — one codebase, no store review | Slower — native project + store setup |
| Auth (Supabase OTP/magic-link) | Works in mobile browser / installed PWA (redirect URLs must be configured) | Works via deep links / `expo-auth-session` |
| Camera / file upload | `<input type=file accept=image/* capture>` — camera + gallery + files | Full native camera/media APIs |
| Push notifications | Web Push on Android; **iOS only for installed PWA (iOS 16.4+)**, limited | Full native push (APNs/FCM) via Expo |
| Distribution to testers | Shareable URL / "Add to Home Screen" | TestFlight (iOS) / Play internal testing |
| Offline / background | Limited (service worker) | Stronger |

**Why PWA-first fits now:** fastest path to exercise the full server-side stack (auth, orders, quotes, Stripe test, RLS, uploads) with real testers, no app-store latency, single codebase. **Revisit native (Expo)** when the product needs reliable iOS push, richer camera/scan UX for inspections, or app-store presence. §11 documents the native path so the switch is low-friction later.

## 2. Mobile auth & redirect requirements

- **Provider:** Supabase email OTP / magic-link (passwordless), same as web. Provisioning creates identity + `customer` role + baseline profile idempotently in the auth callback (ADR-0007).
- **Redirect URL config (Supabase → Auth → URL configuration):** add the mobile testing origins to **Site URL + allowed redirect URLs**, e.g. the deployed PWA origin `https://<preview-or-test-host>/auth/callback` and, for local device testing over LAN, the tunneled origin. **Do not** rely on `localhost` from a phone.
- **BLOCKER (row 11):** the Supabase auth-redirect save failed during a platform incident. Auth testing **cannot proceed** until redirect URLs save successfully and the OTP → provisioning → session smoke passes. This is the critical-path item.
- **Installed-PWA nuance:** magic-link opens the system browser; ensure the callback returns to the installed context (use OTP code entry as a fallback so testers aren't bounced out of the PWA).
- **Session:** Supabase session cookie/localStorage; verify persistence after "Add to Home Screen" and app backgrounding.

## 3. Customer order / request creation

- Exercise all four services (Buy for Me, Receive My Packages, Deliver to Juárez, Business Orders) via the existing customer order actions (`app/actions/orders.ts`, `withTenant` + owner checks).
- Verify status is mutated **only** via `transitionOrder` (no direct writes), audit rows written, and the customer sees only their own orders (RLS).
- Mobile UX checks: form usable one-handed, validation errors legible, network-loss retry safe (idempotent create).

## 4. Document upload from camera / file picker

- **Capture:** `<input type="file" accept="image/*" capture="environment">` for camera; plain file input for gallery/files. Test both on iOS Safari and Android Chrome.
- **Storage:** upload to **Supabase Storage** with a **private bucket** + RLS/path scoping per tenant (owner-only read/write). No public URLs.
- **PII guardrail:** for this testing round, uploads are **synthetic/non-PII only** (test images, dummy docs). Real ID/RFC/KYC/address documents are **prohibited** until KMS envelope encryption (row 16, Option B) is implemented — because Storage objects + any extracted metadata would be real PII at rest.
- Checks: file-type/size limits enforced server-side; oversized/malicious file rejected; upload progress + failure states; EXIF/orientation handled.

## 5. Quote viewing & acceptance

- Customer views quote via the safe projection (internal notes hidden at the app layer; `app/actions/quotes.ts`), accepts/declines.
- Verify accept cascades order `quote_ready → awaiting_payment` via `transitionOrderPrivileged` (only path), and totals are integer minor units (no float drift) on mobile display.
- Checks: currency/format correct for es/en locale; accept is idempotent; declined quote can't be paid.

## 6. Stripe payment testing (TEST mode)

- **Preconditions:** rows 12–15 (offline smoke + live TEST round-trip + API-version validation). `stripe-test-mode-runbook.md`.
- Use **Stripe test cards** (e.g. `4242…`) in the Payment Element on device. Confirm: PaymentIntent client-secret flow works on mobile browsers; 3DS test flow renders; success only when the **webhook** marks the payment succeeded (client confirmation is advisory); retry reuses the same client-secret.
- **No live keys, no real cards.** `stripe:smoke` refuses `sk_live_`.
- Checks: order advances to `paid` only via webhook cascade; receipt enqueued in `notification_outbox` (succeeded-only, idempotent).

## 7. Order tracking timeline

- Customer sees read-only lifecycle: order status + inspection sub-status + delivery-prep sub-status + payment status, driven by the existing read models.
- Verify timeline reflects only legal transitions, updates on refresh, and shows non-PII delivery windows only (opaque `delivery_address_ref`, no address text).
- Mobile UX: timeline legible, states color/á11y-safe, timestamps localized.

## 8. Notifications

- **Current state:** `notification_outbox` enqueues milestone rows (payment receipt, inspection/delivery updates) — **placeholders; no external send provider is wired** (Resend/Twilio deferred).
- **For testing:** validate rows are enqueued idempotently and are org/owner-scoped (RLS). Treat delivery as out-of-scope until a provider is connected.
- **Web Push:** optional; Android PWA can register; **iOS requires installed PWA (16.4+)** and is limited — do not gate testing on push. Revisit with native (Expo) if reliable push is required.

## 9. RLS / tenant isolation testing (on device)

- Use **two synthetic tester accounts (A, B)** in the same org and, ideally, a second org, to confirm on real mobile sessions:
  - A cannot see B's orders/quotes/payments/inspections/delivery/notifications;
  - customer cannot see staff-only history;
  - customer cannot mutate payments (write-deny);
  - signed-out/anon sees nothing.
- This mirrors the automated `gate:rls` (already 13/13 live) but validates it end-to-end through the **mobile auth session + API**, not just SQL.

## 10. Internal QA checklist (per tester, per device)

- [ ] Install PWA ("Add to Home Screen"); launches standalone.
- [ ] OTP sign-in works; session persists across restart/backgrounding.
- [ ] Create each order type; see only own orders.
- [ ] Upload from camera + from files; oversized/invalid rejected; synthetic docs only.
- [ ] View quote; accept + decline paths; totals correct; locale es/en.
- [ ] Pay with Stripe **test** card; success only after webhook; retry safe.
- [ ] Tracking timeline reflects lifecycle; no address text shown.
- [ ] Notifications: outbox rows enqueued (no external send expected).
- [ ] Cross-tenant: second account cannot see first's data.
- [ ] Sign out clears session; anon sees nothing.
- [ ] No console errors leaking secrets; network calls over HTTPS only.
- Devices: at least 1 iOS Safari + 1 Android Chrome; note OS versions.

## 11. Native path (TestFlight / Google Play internal testing) — deferred, documented

If/when the product moves to **Expo React Native**:

- **iOS — TestFlight:** Apple Developer account → App Store Connect app record → Expo EAS Build (iOS) → upload → **TestFlight internal testing** (up to 100 internal testers, no App Review) → invite by email/Apple ID.
- **Android — Play internal testing:** Google Play Console → app → **Internal testing** track → EAS Build (Android `.aab`) → upload → tester email list / opt-in URL.
- **Auth:** deep-link redirect (`expo-auth-session` / `expo-linking`) + Supabase redirect allow-list for the app scheme.
- **Push:** APNs/FCM via Expo push.
- Reuse the same backend, RLS, Stripe test flow, and QA checklist; only the client shell changes.

## 12. Sequencing (recommended)

1. Close **row 18 rotation** + unblock **row 11 OTP** + pass **rows 12–15 Stripe test**.
2. Deploy the PWA to a controlled test host; configure Supabase redirect URLs.
3. Internal QA pass (§10) with synthetic data on iOS + Android.
4. **Owner sign-off (row 19)** for the private testing release.
5. Invite trusted internal testers; keep synthetic-only until KMS (Option B) is implemented for any real-PII round.

> Reminder: this release stays **development-only / private**. Real PII, real payments, and public distribution remain gated on KMS implementation, Stripe live validation, secret rotation, and owner sign-off. This plan does not start Phase 8.
