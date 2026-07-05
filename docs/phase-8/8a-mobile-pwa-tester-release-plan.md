# Phase 8A — Mobile PWA Private Tester Release — Increment Plan

> **Status:** **DEV-ONLY IMPLEMENTATION PLAN** (drafted 2026-07-05, owner-directed). This document plans the work;
> it does not start it and it is **not a tester release**. Implementation of any increment begins only on the
> explicit owner trigger **`START BORDERPASS PHASE 8 — 8A`**.
> **Tester release remains BLOCKED** by Row 11 (OTP smoke — Supabase incident) and the remaining activation
> blockers in `docs/phase-7/gate-ledger.md` (Row 18 open action). Row 19 = conditional owner approval (Option B),
> inactive until those close. Companion: ADR-0015 (PROPOSED) · ADR-0014 (PROPOSED) · `docs/phase-8/phase-8-plan.md`.

## Hard guardrails (all increments)

- **Synthetic data only.** No real PII, addresses, RFC, KYC, or documents (real PII is gated on 8B/KMS).
- **Stripe TEST mode only.** No live payments; Row 15 stays deferred/unchecked.
- **No tester invites** and no tester-ready/staging/pilot/production claims at any point in 8A.
- **Design source of truth:** the approved **Stitch** direction + existing BorderPass UI
  (`docs/design/Design-to-Frontend-Handoff-Package.md`). **No new design system.** Claude Design only for
  optional throwaway mockups.
- All Phase 7 invariants hold: state-machine seams only, `withTenant`/privileged access only, server-only
  secrets never in `NEXT_PUBLIC_`, CI security gates stay green, no secrets in code/logs/docs.
- Every increment ends at a **STOP point**: report + verification evidence; next increment starts only on
  explicit owner approval (per-increment approval, as in Phases 2–7).

## Increments

> **8A.1 outcome (2026-07-05):** audit complete — `8a-route-mobile-audit.md`. Key adjustments: the customer
> home/orders/quotes pages are **placeholders**, so 8A.3 is "build the dashboard/list UI from the existing
> read models," not cosmetic polish; and 8A.2 must **add** the missing customer nav/logout shell (the
> `(customer)` layout is an auth guard only) plus viewport/theme metadata and loading/error boundaries.
> Layout-breakage risk is low (consistent `max-w-md` mobile-first shell; no tables/grids/fixed widths).
> Sequencing 8A.2 → 8A.8 unchanged. Admin-area mobile gaps recorded as out-of-8A-scope.

### 8A.1 — Mobile route/readiness audit (read-only)
- **Work:** inventory all customer-facing routes (`app/(public|auth|customer)`) on mobile viewports (375×812 /
  360×800); record per-route defects (layout breaks, tap targets, overflow, missing loading/error states);
  confirm which QA-checklist items are already satisfiable. No code changes.
- **Output:** `docs/phase-8/run-logs/8a1-mobile-audit-<timestamp>.md` defect table, prioritized.
- **STOP:** owner reviews the defect list and approves the 8A.2–8A.5 polish scope drawn from it.

### 8A.2 — Mobile shell/navigation polish
- **Work:** app shell only — header/nav/menu usable one-handed, safe-area insets, viewport meta, focus states,
  es/en toggle reachable. Match existing Stitch-derived styling; no redesign.
- **Verify:** typecheck/lint/build + audited routes re-checked at mobile widths.
- **STOP:** before/after screenshots (synthetic data) + verification results.
- **✅ 8A.2 outcome (2026-07-05, `START … 8A.2` received):** customer shell shipped —
  `(customer)/layout.tsx` now renders a mobile-first header (brand link, audited **Sign out** via the existing
  `signOut` server action + redirect to `/login`) and a Home/Orders/Quotes nav (44px-class tap targets, existing
  tokens, no new design system); new `(customer)/loading.tsx` skeleton + `(customer)/error.tsx` boundary
  (generic copy — never renders error internals); root layout gains an explicit `viewport` export
  (`device-width`, `initial-scale=1`, `viewport-fit=cover`) + `themeColor #fff8f6` (manifest/icons deferred to
  8A.6). Auth guards unchanged; no payment/domain/schema changes. Verified: preflight/typecheck/lint/build all
  green; dev-server render at 375px — unauthenticated `/` redirects to `/login`, viewport + theme-color meta
  emitted, zero console errors. es/en toggle deferred to 8A.3+ (locale plumbing lives with the dashboard work).
  Shell-behind-auth visual QA lands with 8A.7 (needs Row 11).

### 8A.3 — Customer dashboard mobile polish
- **Work:** order list (own orders only) legible and scannable on mobile; empty/loading/error states; status
  chips readable; no horizontal scroll.
- **Verify:** as 8A.2 + RLS-scoped rendering unchanged (no query/data-layer changes).
- **STOP:** report + screenshots.
- **✅ 8A.3 outcome (2026-07-05, `START … 8A.3` received):** the three placeholder pages are now real
  mobile-first UI over the existing RLS-scoped read models only — dashboard (`(customer)/page.tsx`: safe
  order/quote counts, quotes-ready call-to-action, empty/unavailable states), orders list (card list from
  `listMyOrders`: ref, humanized status, service type, created date → links to the order's quote/status page),
  quotes list (card list from `listMyQuotes` safe projection: total, status, validity; "Go to payment" link
  only for `accepted` quotes — all payment rules stay on the existing `/pay` page). Supporting changes:
  `listMyOrders` projection gains non-PII `created_at`; new pure `src/lib/format.ts`
  (runtime-locale `Intl` money/date + status humanizer — not full i18n); nav extracted to a client
  `CustomerNav` with `aria-current` active-route highlight. No auth-guard, payment, state-machine, or schema
  changes. Verified: preflight/typecheck/lint/build green; dev-server check — `/`, `/orders`, `/quotes` all
  still redirect unauthenticated → `/login`, zero console errors. Authenticated visual QA still pends Row 11
  (8A.7).

### 8A.4 — Order detail + quote/payment mobile polish
- **Work:** order detail (status + history), quote view (safe projection; internal notes stay hidden), accepted-
  quote payment page + Stripe **TEST** Payment Element rendering on small screens; retry/return-to-order flows.
- **Guardrail:** no payment-logic changes — UI layer only; webhook remains the sole source of `paid`.
- **Verify:** as 8A.2 + Stripe TEST-mode manual check with test card `4242…` on mobile viewport.
- **STOP:** report + screenshots + TEST-payment evidence (redacted).
- **✅ 8A.4 outcome (2026-07-05, `START … 8A.4` received):** order detail/quote page rebuilt as mobile cards —
  order header (ref, humanized status/service, created date, ← Orders back link), itemized quote card over the
  safe `getMyOrderQuote` projection (line items, non-zero fee breakdown, total, validity, customer message),
  payment card with a prominent "Pay <amount>" CTA rendered only under the existing `shouldShowPaymentForm`
  rule, inspection/delivery cards unchanged in data (windows now via shared `formatDateTime`). Pay page: shared
  runtime-locale `formatMoneyMinor` (drops hardcoded en-US), ← Back-to-order link, generic (non-leaking) error
  copy. `PaymentConfirm`: client-side **Test mode** badge (shown only when the publishable key is `pk_test_`),
  Stripe error messages surfaced only for `card_error`/`validation_error` (else generic copy), aria-busy +
  rounded-3xl button consistency. `format.ts` gains `formatDateTime`. **No payment-flow/state-machine changes**
  (initiate/client_secret/polling untouched; success still webhook-only). Verified: preflight/typecheck/lint/
  build green (a typed-routes `Route` fix was needed for the new back link); payments-domain unit tests 30/30;
  unauthenticated `/orders/[id]/quote|pay` still redirect to `/login`; zero console errors. Authenticated +
  Stripe-test-card visual QA still pends Row 11 (8A.7).

### 8A.4b — Quote accept/decline wiring (added at the 8A.4 stop point)
- **✅ 8A.4b outcome (2026-07-05, `START … 8A.4b` received):** the quote card now renders customer decision
  controls via a new `QuoteDecision` client component that calls ONLY the existing `acceptQuote`/`declineQuote`
  server actions — all rules remain server-side (`sent_to_customer` + unexpired, audited
  `quote.invalid_transition_attempt` on stale attempts, transitions via `transitionQuote` +
  `transitionOrderPrivileged` `quote_ready → awaiting_payment` exactly as before). UI gating is
  presentation-only: controls render only for customer-visible `quote_ready`; client-side expiry check hides
  Accept for expired quotes (server re-checks); Decline uses a two-step confirm; pending state disables buttons
  (`aria-busy`); errors are generic; `conflict_state` triggers a refresh so stale views self-correct. After
  accept, `router.refresh()` re-renders the page and the payment CTA appears through the existing
  `shouldShowPaymentForm` rule — no payment initiation from accept. Declined quotes show a safe declined note.
  Verified: preflight/typecheck/lint/build + `check:db-imports` + `check:client-stripe` all green; quote
  state-machine tests 12/12 (covers the accept/decline rules the UI gates on); unauthenticated quote route
  still redirects to `/login`; zero console errors. Authenticated end-to-end QA pends Row 11 (8A.7).

### 8A.5 — Inspection/delivery tracker mobile polish
- **Work:** customer read-only inspection + delivery-prep visibility on mobile: timeline legibility, non-PII
  scheduling windows only (opaque `delivery_address_ref` — never address text).
- **Verify:** as 8A.2 + confirm no PII-bearing field is introduced.
- **STOP:** report + screenshots.
- **✅ 8A.5 outcome (2026-07-05):** inspection/delivery cards gained a read-only `StatusTracker` step bar
  (fixed happy-path steps; side/terminal states surface via the existing status labels), plus the inspection
  `scheduled_for` timestamp via the shared formatter. Fields rendered are unchanged from the customer-safe
  read models (`InspectionSummaryView`/`DeliverySummaryView` — no staff notes, address refs, or provider data
  exist in them). No action/read-model changes.

### 8A.6 — PWA metadata/installability
- **Work:** web app manifest (name/short_name/icons/theme/display=standalone), apple-touch/home-screen meta,
  icon set, basic service worker for install eligibility + graceful reload only (no offline-first scope creep).
  Note: `apps/borderpass/public/` currently has **no** manifest/icons — this is new wiring.
- **Verify:** Lighthouse/devtools installability pass locally; add-to-home-screen launches standalone on
  iOS Safari + Android Chrome (dev devices, synthetic accounts).
- **STOP:** installability evidence.
- **✅ 8A.6 outcome (2026-07-05):** `app/manifest.ts` (standalone, surface theme, 192/512 any + maskable),
  placeholder solid-brand PNG icons + 180px apple-touch icon under `public/icons/` (replace with the
  Stitch-designed set when available), `appleWebApp` + apple-icon metadata in the root layout, and a
  **deliberately cache-free** service worker (`public/sw.js`): it intercepts ONLY top-level navigations and
  returns a branded offline note on network failure — it never caches or reads API, authenticated, payment,
  or any other responses. Registered via a tiny client component. Verified live on the dev server:
  `/manifest.webmanifest` 200 + linked in head, all icons 200, apple/web-app-capable meta present,
  service worker registered, zero console errors. On-device add-to-home-screen checks land with 8A.7.

### 8A.7 — Synthetic QA script + device checklist
- **Work:** finalize the per-tester, per-device QA script from `docs/phase-7/mobile-private-testing-checklist.md`
  §3 + readiness-plan §10 into a fill-in evidence template (`docs/phase-8/8a-device-qa-template.md`); dry-run it
  end-to-end once on each platform with **synthetic accounts** (requires Row 11 unblocked for the auth steps).
- **STOP:** dry-run evidence; confirm every checklist row is executable.
- **🟡 8A.7 outcome (2026-07-05, PARTIAL):** `8a-device-qa-template.md` created — 19-row per-device fill-in
  covering install, OTP login, dashboard/lists, accept+decline, TEST payment (webhook-only paid + failure
  card), inspection/delivery visibility, logout/relogin, cross-tenant, offline, responsive, and no-secret
  checks; **Row 11-dependent rows are explicitly marked ⛔ BLOCKED**. The on-device dry-run itself cannot run
  until Row 11 clears — this is the one open 8A item.

### 8A.8 — Final dev-only 8A review
- **Work:** full verification suite (typecheck/lint/build/tests/guards), unsafe-claim grep, secret scan, ledger
  cross-check, completion report `docs/phase-8/8a-completion-report.md`.
- **✅ 8A.8 outcome (2026-07-05):** review complete — see `8a-final-dev-review.md` (supersedes the
  `8a-completion-report.md` filename). All checks green; 8A is **dev-complete except the Row 11-gated 8A.7
  device dry-run**. Tester round remains blocked per the STOP-terminal conditions below.
- **STOP (terminal):** 8A is **dev-complete** only. The tester round itself still requires: Row 11 PASS with
  evidence · Row 18 open action closed · Row 19 Option B activation confirmed by the owner · deployment of the
  PWA to a controlled HTTPS preview host with Supabase redirect URLs saved. None of those are part of 8A.8.

## Dependencies / notes

- **Row 11 (OTP)** blocks 8A.7's auth steps and the tester round; it does NOT block 8A.1–8A.6 (local dev-only).
- Deployment to a preview host is deliberately **outside** 8A — it happens at tester-round activation under the
  checklist's §1–§2, after the activation blockers close.
- Money/PII invariants: nothing in 8A touches payment logic, PII storage, notifications, or providers.
