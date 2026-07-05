# Phase 8A.1 — Mobile Route Audit (read-only)

> **Increment:** 8A.1 · **Date:** 2026-07-05 · **Trigger:** `START BORDERPASS PHASE 8 — 8A.1` (owner, in writing)
> **Mode:** DEV-ONLY. BorderPass remains development-only; **private testers remain BLOCKED** (Phase 7 rows 11/18
> open; Row 19 Option B conditional, not active). Synthetic data only · no real PII · **Stripe TEST only** ·
> Stitch/existing UI canonical (no new design system). **No app code was changed in this increment.**

## 1. Route inventory (apps/borderpass/app)

| Route | Group | File | State today |
|---|---|---|---|
| `/welcome` | public | `(public)/welcome/page.tsx` | Real landing shell (`max-w-md`, full-height flex) |
| `/about` | public | `(public)/about/page.tsx` | Simple static page |
| `/login` | auth | `(auth)/login/page.tsx` | **Functional** OTP/magic-link form (client; `emailRedirectTo /auth/callback`) |
| `/sign-up` | auth | `(auth)/sign-up/page.tsx` | Functional form, same shell pattern |
| `/auth/callback` | auth | `app/auth/…` (route) | Session exchange + provisioning (server) |
| `/` (customer home) | customer | `(customer)/page.tsx` | **Phase 0 placeholder** — "Customer shell" text only |
| `/orders` | customer | `(customer)/orders/page.tsx` | **Phase 2 placeholder** — no real list UI |
| `/orders/[id]/quote` | customer | `…/quote/page.tsx` | **Functional read models**: payment status + inspection + delivery cards (+ link to pay) |
| `/orders/[id]/pay` | customer | `…/pay/page.tsx` + `PaymentConfirm.tsx` | **Fully functional** Stripe TEST payment flow (Elements, webhook-polled status) |
| `/quotes` | customer | `(customer)/quotes/page.tsx` | Placeholder |
| `/unauthorized` | — | `unauthorized/page.tsx` | Simple static page |
| `/admin`, `/admin/orders`, `/admin/quotes`, `/admin/quotes/[id]` | admin | `(admin)/…` | Mostly **placeholders** |
| `/admin/orders/[id]/quote` | admin | + `InspectionPanel.tsx`, `DeliveryPanel.tsx` | Staff quote/inspection/delivery ops (Phase 6) |

**Cross-cutting:** `(customer)`/`(admin)` layouts are **auth guards only** — `<div data-shell>` wrappers with
**no navigation, no header, no logout UI**. Root layout has metadata (title/description) but **no `viewport`
export, no `themeColor`, no manifest reference** (Next.js injects only the default viewport meta).
**Zero `loading.tsx` / `error.tsx` / `not-found.tsx` files exist anywhere in `app/`.**
**Zero responsive breakpoint classes (`sm:`/`md:`/`lg:`) exist in `app/` or `src/`** — the UI is a single
fixed-shell design.

## 2. Styling approach

Tailwind (`tailwind.config.ts`, `@tailwind` directives in `globals.css`) with the Stitch-derived design tokens
centralized in `packages/config/tailwind.preset.cjs` (primary `#a33e06`, surface `#fff8f6`, on-surface `#241915`,
Literata headings / DM Sans body, generous radii). Nearly every customer/auth/public page uses the same shell:
`main.mx-auto.max-w-md.p-6`. **Admin pages have no `max-w` constraint** (`main.p-6` full-width). Accessibility
baseline is good: semantic labels, `role="alert"` errors, no hover-only interactions, no absolute/fixed positioning.

## 3. Mobile risk assessment (390 px / 430 px / 768 px)

**Good news:** the `max-w-md` (448 px) single-column shell is effectively mobile-first — at 390/430 px pages
render full-width with `p-6` gutters; at 768 px they center. Forms use `w-full` inputs and `p-3` (≥44 px) tap
targets. **No fixed pixel widths, no wide tables, no multi-column grids, no hover-only interactions found in the
customer/auth surface.** The Stripe Payment Element is width-fluid inside the shell.

**Real risks are gaps, not breakages:**

| # | Risk | Where | Severity |
|---|---|---|---|
| R1 | **No customer navigation/logout anywhere** — testers can't move between home/orders/quotes or sign out without typing URLs | `(customer)/layout.tsx` | HIGH (8A.2) |
| R2 | **Customer home + orders list + quotes list are placeholders** — the "customer dashboard" QA rows have no real UI to test | `(customer)/page.tsx`, `orders/page.tsx`, `quotes/page.tsx` | HIGH (8A.3) |
| R3 | **No loading/error/not-found boundaries** — slow mobile networks show blank screens; errors bubble raw | all of `app/` | MED (8A.2–8A.5) |
| R4 | **No PWA surface at all**: `public/` is empty — no manifest, no icons, no apple-touch meta, no service worker, no themeColor/viewport metadata exports | root layout / `public/` | HIGH (8A.6) |
| R5 | Delivery window renders via `toLocaleString()` — long en-US strings may wrap awkwardly at 390 px; also locale-hardcoded (`en-US` money in `formatMoney`) vs es/en QA row | `orders/[id]/quote/page.tsx:64`, `pay/page.tsx:15` | LOW (8A.4/8A.5) |
| R6 | Magic-link flow bounces installed-PWA users into the system browser; OTP-code fallback (readiness-plan §2) not yet implemented | `(auth)/login/page.tsx` | MED (8A.2/8A.7, needs Row 11 anyway) |
| R7 | Admin area is desktop-assumed and mostly placeholder | `(admin)/…` | OUT OF 8A SCOPE |
| R8 | Admin pages are full-width (no `max-w`); the functional admin quote page's `dl` rows use `flex justify-between` which compresses label/value pairs at 390 px | `(admin)/admin/**` (e.g. `orders/[id]/quote/page.tsx:48–62`) | OUT OF 8A SCOPE (record for a future admin-mobile pass) |
| R9 | Admin `datetime-local` inputs are `px-2 py-1` (~30 px tall) — under the 44 px touch minimum | `DeliveryPanel.tsx:107–119` | OUT OF 8A SCOPE (staff/desktop tooling) |

## 4. What 8A.2–8A.6 should touch (and what they must not)

- **8A.2 (shell/nav):** add the minimal customer nav/header + logout to `(customer)/layout.tsx`; viewport/theme
  metadata; loading/error boundaries for the customer group. *(R1, R3, R6 fallback)*
- **8A.3 (dashboard):** replace the three customer placeholders with the real (already-built) `listMyOrders`-
  style read models — mobile-first cards, empty/loading states. *(R2)*
- **8A.4 (order detail + quote/payment):** polish the quote page cards + pay page; locale-aware money/date
  formatting. **UI layer only — no payment/state-machine changes; webhook stays the only source of `paid`.** *(R5)*
- **8A.5 (inspection/delivery tracker):** timeline presentation of the existing non-PII read models. *(R5)*
- **8A.6 (PWA):** manifest + icons + apple-touch meta + minimal service worker + installability check. *(R4)*
- **Must NOT change:** payment domain/state machine, server actions' auth/RLS semantics, `notification_outbox`
  placeholders, admin ops panels (out of scope), anything storing address/PII (opaque `delivery_address_ref`
  stays).

## 5. Safety notes (standing)

- **Payments:** `/pay` flow is already server-authoritative (client confirm advisory; webhook-polled status —
  verified in `PaymentConfirm.tsx`). 8A work must keep `LEGAL_PAYMENT_TRANSITIONS`, `orderPaidCascadeTarget`,
  and the initiate/webhook seams untouched. **Stripe TEST mode only; Row 15 stays deferred.**
- **PII:** no real PII/address/RFC/KYC/documents anywhere in 8A; delivery shows non-PII windows + opaque ref only.
- **Synthetic only:** all QA/dev uses synthetic accounts/orders per `mobile-private-testing-checklist.md` §4.

## 6. Recommended implementation order (confirms the 8A plan)

`8A.2 → 8A.3 → 8A.4 → 8A.5 → 8A.6 → 8A.7 → 8A.8` — unchanged from
`8a-mobile-pwa-tester-release-plan.md`, with one adjustment recorded there: **8A.3 is "build the dashboard list
UI from existing read models," not merely polish** (the pages are placeholders), and 8A.2 includes adding the
missing customer nav/logout shell. Layout breakage risk is low; the work is completing thin pages + PWA wiring.

## 7. Verification run for this increment (read-only)

`pnpm preflight` ✅ · `typecheck` 13/13 ✅ · `lint` 13/13 ✅ · `build` ✅ (2026-07-05, exit 0 each).
No app code changed. Unsafe-claim grep over `docs/` clean; secret scan of diff clean.

**STOP POINT 8A.1:** audit complete. Next increment (8A.2) starts only on explicit owner approval.
