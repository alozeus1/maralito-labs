# BorderPass — Design-to-Frontend Handoff Package

> **Status:** Draft v0.1 · **Owner:** Principal Frontend Architect / Design Systems Engineer (Web Forx Technology Ltd.) · **Last updated:** 2026-06-29
> **Purpose:** Convert the **approved Stitch design direction** into a precise, implementation-ready frontend specification a coding agent can build without guessing.
> **Non-goals (explicit):** No production code. No React components. No Next.js app build yet. No redesign. This systematizes and standardizes the approved design only.

## Source-of-truth alignment

| # | Source | Path / artifact |
|---|--------|-----------------|
| 1 | **Approved Stitch design board + screenshots + HTML** | `borderpass/design-reference/*/screen.png` + `code.html`, `borderpass_concierge/DESIGN.md`, `borderpass_product_spec.md` |
| 2 | Product Architecture / PRD + IA | `borderpass/docs/01..20` (esp. `05-information-architecture.md`, `06-feature-matrix.md`, `14-notification-strategy.md`) |
| 3 | Technical Architecture (Next.js shape) | `borderpass/technical-architecture/docs/01,02,06` |
| 4 | Data Model + API + Event Contracts | `borderpass/contracts/01..05` |
| 5 | AI Agent + LangGraph Architecture | `borderpass/ai-architecture/AI-Agent-Architecture-and-LangGraph-Blueprint.md` |
| 6 | Maralito Platform Architecture | `maralito-platform/docs/*` |
| 7 | Maralito Automation Platform | `maralito-platform/automation/*` |

**Design authority note.** The **Stitch HTML exports + `DESIGN.md` token file are the canonical visual source of truth** (exact hex, type roles, radii, spacing). Where the older `product_spec.md` and `DESIGN.md` differ on *role naming* (e.g., which color is "primary"), the **`DESIGN.md` token set wins** and is reproduced verbatim in [D3](#deliverable-3--design-tokens). Conventions: `⚠️ VERIFY` = confirm before depending; `GAP` = missing asset/copy/contract to resolve.

---

## Table of contents
1. [Design Handoff Summary](#deliverable-1--design-handoff-summary) · 2. [Visual Identity Spec](#deliverable-2--visual-identity-spec) · 3. [Design Tokens](#deliverable-3--design-tokens) · 4. [Component Inventory](#deliverable-4--component-inventory) · 5. [Screen Inventory](#deliverable-5--screen-inventory) · 6. [Routing Structure](#deliverable-6--routing-structure) · 7. [User Flow → Screen Map](#deliverable-7--user-flow--screen-map) · 8. [Design System States](#deliverable-8--design-system-states) · 9. [Responsive Behavior](#deliverable-9--responsive-behavior) · 10. [Accessibility](#deliverable-10--accessibility-requirements) · 11. [Localization](#deliverable-11--localization-requirements) · 12. [Motion & Microinteractions](#deliverable-12--motion--microinteractions) · 13. [Frontend Data Contract Map](#deliverable-13--frontend-data-contract-map) · 14. [Admin Frontend Requirements](#deliverable-14--admin-frontend-requirements) · 15. [Quality Checklist](#deliverable-15--quality-checklist) · 16. [Implementation Readiness Review](#deliverable-16--implementation-readiness-review) · 17. [Final Format: Matrices, Risks, Open Questions](#deliverable-17--final-output-format)

---

# DELIVERABLE 1 — Design Handoff Summary

| Field | Specification |
|-------|---------------|
| **Product name** | **BorderPass** (parent: Maralito Labs — used only as "Powered by Maralito Labs" in welcome/footer/about/settings). |
| **Design intent** | A premium, warm, human cross-border shopping **concierge** — "Warm Professionalism": the efficiency of a global logistics platform with the personalized care of a luxury travel desk. Trust surfaced, complexity hidden. |
| **Target device** | **Mobile-first web/PWA** (customer), 360–430px primary viewport, installable. Admin/Ops = responsive web, desktop-first (≥1024px) with mobile-friendly field views (inspector/driver). |
| **Primary user** | Customers in Ciudad Juárez shopping from U.S. stores without crossing (incl. low-trust / no-visa personas). Secondary: BorderPass staff (concierge, inspector, driver, ops, finance, compliance, support, admin). |
| **Brand personality** | Warm · Trusted · Local to El Paso/Juárez · Premium · Simple · Human · Bilingual-ready (EN/ES first-class). |
| **Approved design direction** | Stitch board: Sunset Orange + Deep Navy + Emerald on Warm White/Soft Sand; Literata (serif headers) + DM Sans (body); 24px rounded "pill-soft" shapes; ambient multi-layer shadows; signature **El Paso→Bridge→Juárez** motif, **vertical Border Journey timeline**, **Bridge progress bar**, **Trust cards**, **Concierge card**. |
| **Must remain unchanged** | Palette + type pairing; 24px radius language; the El Paso/Juárez bridge motif; vertical Border Journey timeline; bottom nav (Home/Orders/Messages/Support/Profile); bilingual stacked labels; "Warm Professionalism" tone; concierge omnipresence. |
| **May be refined during implementation** | Exact spacing/optical alignment within the token scale; skeleton-loader shapes; micro-timing of motion; empty/error illustration specifics; minor copy; icon weights; responsive breakpoints for admin tables. |
| **Must NOT be changed** | Brand colors/hex, font families, the radius system, the bridge/journey signature components, bottom-nav IA, EN/ES parity, "Powered by Maralito Labs" placement rules, WCAG AA targets, and any HUMAN-APPROVAL/sensitive-data UI gates inherited from the AI/security architecture. |

---

# DELIVERABLE 2 — Visual Identity Spec

The product must feel **warm, trusted, local, premium, simple, human, and bilingual-ready**. Every rule below serves that.

**Logo usage.** Wordmark "BorderPass" in **Literata**, primary Sunset Orange (`#a33e06`) on warm surfaces; an inverse white version on Deep Navy/photographic headers. Minimum clear space = cap-height on all sides. Never recolor outside {primary, on-surface navy, white}, never stretch, never add shadow. Header lockup pairs the BP monogram glyph + wordmark (see `design-reference/borderpass_brand_logo`).

**App icon guidance.** Rounded-square (platform-masked) with the BP monogram on a warm gradient (sunset orange → soft sand); maintain legibility at 48px. Provide maskable + monochrome variants. `GAP:` production icon asset set (1024px + adaptive) not yet exported.

**Brand mark guidance.** The BP monogram may appear alone as an avatar/favicon/loading mark. Keep it within the 24px-radius family; never below 24px effective size with the wordmark.

**"Powered by Maralito Labs" placement.** Only in: Welcome screen footer, About screen, Settings footer, and app/email footers. Style: `label-md`, `on-surface-variant`, centered, never adjacent to a primary CTA, never on transactional/journey screens.

**Color palette.** Sunset Orange = primary action/progress/active; Deep Navy = secondary/navigation/weight/text; Emerald = success/cleared/delivered; Warm White = background; Soft Sand = container layering; Gold = sparing premium/VIP accent. (Exact tokens in D3.) Rationale: warmth avoids sterile "tech" feel; navy anchors institutional trust; emerald celebrates completion + heritage.

**Typography.** **Literata** (serif) for headings/storytelling = premium concierge voice; **DM Sans** for body/UI = clarity + bilingual legibility. Serif-over-sans hierarchy is a brand signature — do not invert. Generous 1.5× body line-height for stacked EN/ES.

**Iconography style.** **Material Symbols Outlined** (variable, weight 100–700, optical fill 0–1) as used across all Stitch screens — rounded, light-to-medium weight, consistent optical size. Icons are functional, never decorative clutter; pair with text labels in nav.

**Illustration style.** Warm, optimistic, editorial — soft gradients, atmospheric El Paso/Juárez skylines + bridge (see `a_warm_optimistic_illustration_of_the_el_paso_and_ciudad_juárez_skylines`). Organic, human, never flat-corporate clip-art; always within 24px media radius.

**Border/bridge visual motif.** The **El Paso → International Bridge → Ciudad Juárez** chip (home header) and the **Bridge progress bar** (package icon sliding USA→Mexico) are the brand's signature device. Reuse consistently for any "crossing" moment; never replace with a generic progress bar.

**Map style.** Muted, warm-tinted basemap with a single high-contrast Sunset Orange route line and a soft pin (journey tracker header). Low chroma background so the route + status read instantly; never a default bright map.

**Motion personality.** Deliberate, smooth, "unrushed premium." Gentle 1.02× tactile press scale; soft ambient shadow elevation on interaction; celebratory confetti only at the border-crossing→driver-assigned moment and on delivery. No bouncy/playful easing; nothing abrupt. Honor `prefers-reduced-motion`.

---

# DELIVERABLE 3 — Design Tokens

Reproduced from the canonical `design-reference/borderpass_concierge/DESIGN.md` + Stitch Tailwind configs. **Implement as CSS variables + a Tailwind theme** over `@maralito/ui`. Token names follow the Material-3-style naming already in the Stitch exports (keep them — the HTML depends on this vocabulary).

## 3.1 Color tokens (authoritative hex)

| Semantic role (requested) | Token | Hex | Usage |
|---------------------------|-------|-----|-------|
| **Primary** | `primary` | `#a33e06` | Primary CTAs, progress, active states (Sunset Orange, deep) |
| Primary container | `primary-container` | `#f47a42` | Lighter orange fills, chips, accent surfaces |
| On primary | `on-primary` | `#ffffff` | Text/icon on primary |
| On primary container | `on-primary-container` | `#5f2000` | Text on primary container |
| **Secondary** | `secondary` | `#565e74` | Navigation, secondary text/weight (Deep Navy family) |
| Secondary container | `secondary-container` | `#dae2fd` | Secondary chips/surfaces |
| On secondary container | `on-secondary-container` | `#5c647a` | Text on secondary container |
| **Accent / Tertiary (Success)** | `tertiary` | `#1b6b51` | Success accent (Emerald) |
| Tertiary container | `tertiary-container` | `#61ab8d` | Success surface |
| On tertiary container | `on-tertiary-container` | `#003d2b` | Text on success surface |
| **Background** | `background` | `#fff8f6` | App background (Warm White) |
| **Surface** | `surface` | `#fff8f6` | Default surface |
| Surface container lowest | `surface-container-lowest` | `#ffffff` | Cards (pure white) |
| Surface container low | `surface-container-low` | `#fff1ec` | Layer 1 |
| Surface container | `surface-container` | `#ffe9e2` | Layer 2 (Soft Sand-ish) |
| Surface container high | `surface-container-high` | `#f9e4dc` | Layer 3 |
| Surface container highest | `surface-container-highest` | `#f3ded7` | Layer 4 (input fill / Soft Sand) |
| Surface variant | `surface-variant` | `#f3ded7` | Muted surface / input fill |
| Surface dim | `surface-dim` | `#ebd6ce` | Dimmed surface |
| **Text** | `on-surface` | `#241915` | Primary text (warm near-black) |
| **Muted text** | `on-surface-variant` | `#57423a` | Secondary/muted text |
| **Success** | `tertiary` / `tertiary-container` | `#1b6b51` / `#61ab8d` | Cleared customs, delivered, verified |
| **Warning** | `warning` ⚠️ VERIFY | `#b3791f` (derive from Gold) | Delays, attention — `GAP:` not in token file; propose amber, confirm contrast |
| **Error** | `error` | `#ba1a1a` | Errors, failed states |
| Error container / on-error-container | `error-container` / `on-error-container` | `#ffdad6` / `#93000a` | Error surface + text |
| **Info** | `info` ⚠️ VERIFY | `#565e74` (use secondary) | Informational — reuse secondary/navy unless a dedicated info token is approved |
| **Border / outline** | `outline` / `outline-variant` | `#8b7268` / `#dec0b5` | Borders, dividers (used sparingly; prefer shadow) |
| **Disabled** | `on-surface` @ 38% / `surface-variant` | `#241915` 38% / `#f3ded7` | Disabled text/fill (Material opacity convention) |
| Inverse surface / on / primary | `inverse-surface` / `inverse-on-surface` / `inverse-primary` | `#3a2e29` / `#ffede7` / `#ffb597` | Snackbars, inverse contexts |
| Surface tint | `surface-tint` | `#a33e06` | Elevation tint |

> **Gold/Premium accent:** referenced in brand prose for VIP badges; `GAP:` no hex in token file — propose `#C8A24A` (warm gold), `⚠️ VERIFY` against AA on warm surfaces before use.

## 3.2 Typography tokens

| Role | Family | Size | Weight | Line height | Letter-spacing |
|------|--------|------|--------|-------------|----------------|
| `display-lg` | Literata | 48px | 700 | 56px | −0.02em |
| `headline-lg` | Literata | 32px | 600 | 40px | — |
| `headline-lg-mobile` | Literata | 28px | 600 | 36px | — |
| `headline-md` | Literata | 24px | 500 | 32px | — |
| `body-lg` | DM Sans | 18px | 400 | 28px | — |
| `body-md` | DM Sans | 16px | 400 | 24px | — |
| `label-lg` (button/label) | DM Sans | 14px | 700 | 20px | 0.05em |
| `label-md` (caption) | DM Sans | 12px | 500 | 16px | — |

- **Heading styles:** `display-lg` (welcome/hero), `headline-lg`/`-mobile` ("Hola Maria.", "Arriving Tomorrow"), `headline-md` (card titles, in-card headers).
- **Body styles:** `body-lg` (lead paragraphs, concierge copy), `body-md` (default UI text, list rows).
- **Caption styles:** `label-md` (timestamps, helper text, "Powered by Maralito Labs").
- **Button styles:** `label-lg` (uppercase-safe only for 1–3 word EN labels; avoid all-caps for long ES).
- **Label styles:** `label-lg` short identifiers; `label-md` field labels + chips.
- **Fonts loaded:** Google Fonts `DM Sans` (400/500/700) + `Literata` (400/500/600/700) + `Material Symbols Outlined`. Self-host in production for performance/privacy `⚠️ VERIFY`.

## 3.3 Spacing tokens (4/8px rhythm)

| Token | Value | Use |
|-------|-------|-----|
| `xs` | 4px | icon gaps, fine adjustments |
| `sm` | 12px | tight stacks, chip padding |
| `base` | 8px | grid unit |
| `md` (default) | 24px | **card padding, container padding** (matches 24px radius) |
| `lg` | 48px | inter-component spacing |
| `xl` | 80px | **major section gaps** (premium "breathing room") |
| `gutter` | 24px | grid gutters |
| `margin-mobile` | 20px | **screen padding (mobile)** |
| `margin-desktop` | 64px | screen padding (desktop) |
| `max-width` | 1280px | content max width |

- **Screen padding:** 20px mobile / 64px desktop. **Card padding:** 24px. **Section spacing:** 80px between major sections, 48px between components. **Form spacing:** 24px between fields, 12px label→input, 8px input→helper.

## 3.4 Radius tokens

| Token | Value | Use |
|-------|-------|-----|
| `sm` | 0.5rem (8px) | tags, tiny nested elements |
| `DEFAULT` | 1rem (16px) | secondary nested elements |
| `md` | 1.5rem (24px) | **standard cards, modals, primary buttons, media** |
| `lg` | 2rem (32px) | large feature cards |
| `xl` | 3rem (48px) | hero/feature surfaces |
| `full` | 9999px | pills, chips, toggles, FAB, avatars |

> Primary radius = **24px** (`md`); inputs/tags = 12px; pills = `full`. Media always follows 24px.

## 3.5 Shadow tokens (ambient, multi-layer)

| Token | Value | Use |
|-------|-------|-----|
| `shadow-card` (Level 1) | `0 4px 20px rgba(15,23,42,0.05)` | **default cards** (soft card shadow) |
| `shadow-elevated` (Level 2) | `0 12px 32px rgba(15,23,42,0.08)` | hover/active/floating button |
| `shadow-modal` | `0 24px 48px rgba(15,23,42,0.12)` ⚠️ VERIFY | modal/dialog (derive from Level 2 scale) |
| `shadow-bottom-sheet` | `0 -8px 32px rgba(15,23,42,0.10)` ⚠️ VERIFY | bottom sheet (upward ambient) |
| Glass nav | `backdrop-blur(12px)` + Warm White @60% + 1px white @20% border | floating/glass navigation |

> Depth via ambient shadow, **not** hard borders. `GAP:` modal/bottom-sheet shadows not explicit in the token file — values proposed; confirm against Stitch.

## 3.6 Z-index tokens

| Layer | Token | Value |
|-------|-------|-------|
| Base content | `z-base` | 0 |
| Sticky header | `z-header` | 100 |
| Bottom nav | `z-bottom-nav` | 200 |
| Sticky CTA bar | `z-sticky-cta` | 250 |
| Modal / dialog | `z-modal` | 1000 |
| Bottom sheet | `z-bottom-sheet` | 1000 |
| Toast / snackbar | `z-toast` | 1100 |
| Tooltip | `z-tooltip` | 1200 |
| Loading overlay | `z-loading` | 1300 |

## 3.7 Motion tokens

| Token | Value | Use |
|-------|-------|-----|
| `duration-fast` | 120ms | button press, toggles |
| `duration-base` | 240ms | cards, toasts, most transitions |
| `duration-slow` | 400ms | page transitions, bottom sheet |
| `duration-celebrate` | 1200ms | confetti / delivered moment |
| `easing-standard` | `cubic-bezier(0.2, 0, 0, 1)` | enter/exit (Material emphasized) |
| `easing-decelerate` | `cubic-bezier(0, 0, 0, 1)` | incoming elements |
| `easing-accelerate` | `cubic-bezier(0.3, 0, 1, 1)` | exiting elements |

- **Page transitions:** 400ms fade + 8px rise, `easing-standard`. **Button interaction:** 1.02× scale + shadow lift over 120ms. **Timeline animation:** node fill + connector draw, 240ms staggered. **Border crossing animation:** package icon slides USA→Mexico along the Bridge bar; confetti on crossing→driver-assigned. All gated by `prefers-reduced-motion`.

---

# DELIVERABLE 4 — Component Inventory

All components built on `@maralito/ui` + BorderPass tokens (D3). Each entry: **Purpose · Props/data · Visual states · Interaction states · Empty · Error · Loading · Accessibility · API/data dependency · Reusability.** Unless noted, every component honors `prefers-reduced-motion`, meets WCAG AA contrast, and supports EN/ES text expansion. Icons = Material Symbols Outlined.

## 4.1 Layout & navigation

### AppShell
- **Purpose:** Root layout wrapper (customer vs admin variants): provides theme, i18n context, header slot, content area, nav slot, toast/modal portals, safe-area insets.
- **Props/data:** `variant: "customer"|"admin"`, `locale`, `user`, `children`. **Visual:** customer (warm, bottom-nav) / admin (sidebar + topbar). **Interaction:** route changes, scroll. **Empty:** n/a. **Error:** global error boundary → ErrorState. **Loading:** route-level Suspense → LoadingSkeleton.
- **A11y:** `lang` attr, skip-to-content link, landmark roles (`header`/`main`/`nav`). **Data:** session/locale from BFF. **Reuse:** every screen.

### MobileHeader
- **Purpose:** Top bar — logo/back, screen title, optional notification bell + language globe.
- **Props:** `title`, `showBack`, `showBell`, `unreadCount`, `onBack`. **Visual:** default / photographic-overlay (home/journey) / scrolled (glass blur). **Interaction:** back tap, bell tap (→Notifications), globe tap (→language). **Empty:** n/a. **Error:** n/a. **Loading:** title skeleton.
- **A11y:** `<header>`, back button `aria-label`, bell `aria-label` + badge announced (`aria-live` polite). **Data:** unread count. **Reuse:** all customer screens.

### BottomNavigation
- **Purpose:** Primary tab bar — **Home · Orders · Messages · Support · Profile** (Material Symbols + labels).
- **Props:** `active`, `badges{messages?,orders?}`. **Visual:** active (primary orange icon+label) / inactive (on-surface-variant) / badge. **Interaction:** tap → route, active-route no-op. **Empty:** n/a. **Error:** n/a. **Loading:** persistent (never skeleton).
- **A11y:** `role="navigation"`, `aria-current="page"`, 48px+ targets, labels not icon-only. **Data:** unread badges. **Reuse:** all customer top-level screens (hidden on full-screen flows like payment).

## 4.2 Home & service

### ServiceCard
- **Purpose:** Service selector (Shop from USA · Receive My Packages · Deliver to Juárez · Business Orders) with bilingual stacked label.
- **Props:** `icon`, `title_en`, `title_es`, `subtitle`, `onPress`, `disabled`. **Visual:** default (white card, 24px radius, Level-1 shadow) / pressed (1.02× + Level-2) / disabled (38% + "coming soon"). **Interaction:** tap → New Request prefilled. **Empty:** n/a. **Error:** n/a. **Loading:** skeleton card.
- **A11y:** `role="button"`, full label (EN+ES) in `aria-label`, 48px+ target. **Data:** static config + feature flag. **Reuse:** home grid, New Request step 1.

### ActiveOrderCard
- **Purpose:** Home "Active Delivery" — product image, order ref, current city, destination, ETA, border status, **In Transit** chip, Track Details CTA + Bridge progress bar.
- **Props:** `order{ref,image,currentCity,destination,eta,borderStatus,statusChip}`, `onTrack`. **Visual:** default / multiple-active (carousel) / terminal (delivered → reorder CTA). **Interaction:** tap card or CTA → Border Journey. **Empty:** EmptyState ("No active orders — start a request"). **Error:** ErrorState inline. **Loading:** LoadingSkeleton (image + 4 lines + bar).
- **A11y:** status chip text not color-only; progress bar `role="progressbar"` + `aria-valuenow`. **Data:** `GET /orders?status=active` + journey projection. **Reuse:** home; compact variant in Orders list.

## 4.3 Journey & status

### BorderJourneyTimeline
- **Purpose:** Signature **vertical** 12-stage timeline (Purchased → Received → Inspection → Docs → Crossing → Customs → Arrived → Out for delivery → Delivered) with node states, in-progress stage card, inline inspection thumbnails, timestamps.
- **Props:** `stages[]{key,label_en,label_es,state,timestamp,detail,photos?}`, `currentStage`, `eta`, `trackingId`. **Visual per node:** completed / current (highlighted + card) / pending (muted) / delayed (warning) / failed (error). **Interaction:** tap stage → detail; "View Photos" → InspectionPhotoGrid. **Empty:** pre-paid (timeline locked w/ hint). **Error:** ErrorState. **Loading:** skeleton timeline.
- **A11y:** ordered list semantics (`<ol>`), each node state in text + `aria-current` for current, not color-only; "accessible timeline" (D10). **Data:** journey projection (order status machine 09/10). **Reuse:** Order Details, Home deep link.

### StatusBadge
- **Purpose:** Status chip for any order state (customer labels EN/ES) + admin queues.
- **Props:** `status`, `tone: success|warning|error|info|neutral|inProgress`, `size`. **Visual:** 10%-opacity tone bg + 100% tone text (sophisticated), pill radius. **Interaction:** static (optional tooltip). **Empty:** n/a. **Error:** n/a. **Loading:** small skeleton pill.
- **A11y:** text label (not color-only), `aria-label` full status. **Data:** order/inspection/payment status enum. **Reuse:** everywhere (lists, cards, journey, admin tables).

### TrustBadge / TrustCard
- **Purpose:** Dismissible trust units — insurance coverage, money-back, "Verified & Sealed", "GPS Tracked".
- **Props:** `type`, `dismissible`, `onDismiss`. **Visual:** default / dismissed (hidden). **Interaction:** dismiss (×). **Empty:** n/a. **Error:** n/a. **Loading:** n/a (static). **A11y:** `role="note"`, dismiss `aria-label`. **Data:** static + order coverage flags. **Reuse:** journey, inspection, quote, home.

## 4.4 Quote & payment

### QuoteSummaryCard
- **Purpose:** Itemized transparent quote — service fee + est. item value + est. duties + total + expiry + accept/decline.
- **Props:** `quote{lineItems[],serviceFee,itemValue,estimatedDuties,total,currency,expiresAt}`, `onAccept`, `onDecline`. **Visual:** default / expiring (warning) / expired (disabled + re-quote) / accepted. **Interaction:** accept → payment, decline. **Empty:** n/a. **Error:** ErrorState. **Loading:** skeleton lines.
- **A11y:** amounts in a description list; currency announced; estimate labeled "estimated". **Data:** `GET /orders/{id}/quote`. **Reuse:** Quote Review, Order Details, admin Quote Builder (read).

### FeeLineItem
- **Purpose:** One labeled amount row (label + value, optional "estimate" tag + info tooltip).
- **Props:** `label`, `amount:Money`, `isEstimate`, `tooltip`. **Visual:** default / estimate (tag) / total (bold). **Interaction:** tooltip on info. **A11y:** `<dt>/<dd>`, tooltip keyboard-accessible. **Data:** quote line item. **Reuse:** QuoteSummaryCard, Request Summary, admin.

### PaymentMethodCard
- **Purpose:** Saved Stripe card display + select/add/default.
- **Props:** `method{brand,last4,exp,isDefault}`, `selected`, `onSelect`, `onSetDefault`. **Visual:** default / selected (navy border) / default badge / expired (warning). **Interaction:** select, set default, add. **Empty:** EmptyState ("Add a payment method"). **Error:** ErrorState. **Loading:** skeleton. **A11y:** radio semantics in a group, `aria-checked`. **Data:** Stripe payment methods via Payments S3. **Reuse:** Payment Methods, checkout.

## 4.5 Forms & inputs

### UploadBox
- **Purpose:** Receipt/invoice/product-photo upload (drag-drop on desktop, tap-to-capture on mobile).
- **Props:** `accept`, `maxSizeMB`, `multiple`, `onUpload`, `files[]`. **Visual states:** empty / drag-over / uploading (progress) / uploaded (thumb + remove) / failed / invalid-file. **Interaction:** select, drag, remove, retry. **Empty:** prompt + allowed types. **Error:** inline error + retry. **Loading:** progress bar.
- **A11y:** real `<input type=file>`, `aria-describedby` for rules, errors announced. **Data:** Files S5 signed-URL upload. **Reuse:** Receipt upload, Border info, inspection (admin), profile receipts.

### FormInput
- **Purpose:** Text/number/textarea field with label, helper, validation (Soft Sand fill, 12px radius, navy focus).
- **Props:** `label`, `value`, `type`, `error`, `helper`, `required`, `disabled`. **Visual:** empty / filled / focused (2px navy) / valid / invalid (error) / disabled. **Interaction:** focus, type, blur-validate. **Error:** message below + `aria-invalid`. **Loading:** disabled+spinner on async. **A11y:** `<label for>`, `aria-describedby`, error `role="alert"`. **Data:** shared Zod schema (contracts). **Reuse:** all forms.

### SelectInput
- **Purpose:** Native-backed select / combobox (service, variant, address, reason).
- **Props:** `options[]`, `value`, `onChange`, `searchable?`. **Visual:** empty/placeholder / filled / focused / invalid / disabled. **Interaction:** open, select, type-ahead. **Empty:** "No options". **Error:** inline. **Loading:** skeleton. **A11y:** `role="combobox"`/native select, keyboard nav, `aria-expanded`. **Data:** option source per field. **Reuse:** forms.

### Toggle
- **Purpose:** Pill switch (notification prefs, default flags) — navy active / sand track.
- **Props:** `checked`, `onChange`, `label`, `disabled`. **Visual:** on / off / disabled. **Interaction:** tap/space. **A11y:** `role="switch"`, `aria-checked`, label. **Data:** pref value. **Reuse:** Settings, forms.

### Stepper
- **Purpose:** Multi-step progress for New Request (Service → Product → Border → Summary).
- **Props:** `steps[]`, `current`, `onStepChange`. **Visual:** completed / current / pending. **Interaction:** next/back, tap completed step. **A11y:** `aria-current="step"`, step names in text. **Data:** none. **Reuse:** New Request, onboarding.

### ProgressIndicator
- **Purpose:** Generic linear/circular progress (uploads, payment processing) + the **Bridge progress bar** variant.
- **Props:** `value`, `indeterminate`, `variant: linear|bridge|circular`. **Visual:** determinate / indeterminate. **A11y:** `role="progressbar"` + values, or `aria-busy`. **Data:** progress source. **Reuse:** many.

## 4.6 Concierge & messaging

### ConciergeCard
- **Purpose:** "Your Concierge, Maria G." — avatar, name, rating, languages, WhatsApp + Live Chat CTAs.
- **Props:** `concierge{name,avatar,rating,languages}`, `onWhatsApp`, `onChat`. **Visual:** default / unassigned (generic). **Interaction:** WhatsApp deep link, open chat. **Empty:** unassigned state. **Error:** ErrorState. **Loading:** skeleton. **A11y:** rating in text, CTA `aria-label`. **Data:** ConciergeAssignment + StaffProfile. **Reuse:** Journey, Order Details, Concierge screen.

### ChatBubble
- **Purpose:** Message bubble (customer/concierge/system) in chat thread.
- **Props:** `message{author,role,text,ts,attachments,channel}`. **Visual:** customer (right, navy) / concierge (left, surface) / system (centered, muted) / WhatsApp tag. **Interaction:** long-press (copy), tap attachment. **Empty:** thread EmptyState. **Error:** send-failed + retry. **Loading:** typing indicator / skeleton. **A11y:** `role="log"` thread, author + time in text, `aria-live` for new. **Data:** SupportMessage. **Reuse:** Concierge chat, admin Concierge Workspace.

### NotificationCard
- **Purpose:** Notification-center row (status update, quote, issue) with deep link.
- **Props:** `notification{type,title,body,ts,read,deepLink}`. **Visual:** unread (dot) / read / by-type icon. **Interaction:** tap → deep link, swipe mark-read. **Empty:** EmptyState. **Error:** ErrorState. **Loading:** skeleton rows. **A11y:** unread state in text, list semantics. **Data:** Notification list. **Reuse:** Notifications screen, admin.

## 4.7 Inspection & package

### InspectionPhotoGrid
- **Purpose:** Grid of inspection photos (signed URLs) with lightbox.
- **Props:** `photos[]{url,caption}`, `onOpen`. **Visual:** default grid / single / lightbox-open. **Interaction:** tap → lightbox, swipe. **Empty:** "No photos yet". **Error:** broken-image fallback. **Loading:** image skeletons. **A11y:** `alt` per photo, lightbox focus-trap + Esc. **Data:** InspectionPhoto signed URLs (permission-checked). **Reuse:** Inspection Details, admin Inspection Center.

### InspectionChecklist
- **Purpose:** Inspection checklist (admin capture / customer read-only summary) — verified contents, serial match, seal.
- **Props:** `items[]{label,state,note}`, `editable`. **Visual:** pass / flag / pending (admin) ; read-only chips (customer). **Interaction:** toggle (admin), notes. **Empty:** n/a. **Error:** save-failed. **Loading:** skeleton. **A11y:** checkbox semantics (admin), state in text. **Data:** Inspection record. **Reuse:** admin Inspection Center, customer Inspection Details (read).

### PackageInfoCard
- **Purpose:** Package summary — tracking #, weight/dims, hub status, photos thumb.
- **Props:** `package{tracking,weight,dims,status,thumb}`. **Visual:** default / unmatched (admin warning). **Interaction:** tap → detail. **Empty:** "Awaiting package". **Error:** ErrorState. **Loading:** skeleton. **A11y:** labeled fields. **Data:** Package record. **Reuse:** Order Details, admin Receiving.

### AddressCard
- **Purpose:** Address display/select (Juárez delivery + El Paso Hub).
- **Props:** `address{type,lines,isDefault}`, `selected`, `onSelect`, `onEdit`. **Visual:** default / selected / default-badge / hub (locked). **Interaction:** select, edit, set default. **Empty:** EmptyState ("Add address"). **Error:** ErrorState. **Loading:** skeleton. **A11y:** radio group semantics, MX address format. **Data:** Address entity. **Reuse:** Profile, checkout, New Request.

## 4.8 Feedback & utility

### EmptyState
- **Purpose:** Friendly empty placeholder (illustration + message + optional CTA).
- **Props:** `illustration`, `title`, `body`, `cta?`. **Visual:** default. **A11y:** heading + descriptive text, CTA labeled. **Data:** none. **Reuse:** lists, journeys, all empties.

### ErrorState
- **Purpose:** Inline/screen error with retry (warm, non-alarming).
- **Props:** `title`, `body`, `onRetry`, `variant: inline|screen`. **Visual:** inline / full-screen. **Interaction:** retry. **A11y:** `role="alert"`, retry focusable. **Data:** error context. **Reuse:** everywhere.

### LoadingSkeleton
- **Purpose:** Shimmer placeholders matching content shape (cards, lists, timeline, map).
- **Props:** `variant`, `count`. **Visual:** shimmer (reduced-motion → static). **A11y:** `aria-busy="true"`, hidden from SR or "Loading". **Data:** none. **Reuse:** all async views.

### Toast
- **Purpose:** Transient feedback (success/error/info) — top or above bottom-nav.
- **Props:** `type`, `message`, `duration`, `action?`. **Visual:** success/error/info, enter/exit. **Interaction:** auto-dismiss, action, swipe. **A11y:** `role="status"`/`alert`, `aria-live`. **Data:** none. **Reuse:** global.

### Modal
- **Purpose:** Centered dialog (confirmations, forms, approvals).
- **Props:** `open`, `title`, `children`, `onClose`, `size`. **Visual:** open/closing, scrim. **Interaction:** close (×/scrim/Esc). **A11y:** `role="dialog"` `aria-modal`, focus-trap, return focus, labelled. **Data:** context. **Reuse:** confirmations, admin approvals.

### BottomSheet
- **Purpose:** Mobile-first sheet (selectors, actions, details) sliding from bottom.
- **Props:** `open`, `snapPoints`, `children`, `onClose`. **Visual:** open/expanded/closing, drag handle. **Interaction:** drag, snap, swipe-down close. **A11y:** dialog semantics, focus-trap, Esc, handle labeled. **Data:** context. **Reuse:** mobile selectors, filters, actions.

### ConfirmationDialog
- **Purpose:** Yes/no decision (cancel order, decline quote, destructive).
- **Props:** `title`, `message`, `confirmLabel`, `tone: default|danger`, `onConfirm`. **Visual:** default / danger (error confirm). **Interaction:** confirm/cancel. **A11y:** dialog, default focus on safe action. **Data:** none. **Reuse:** destructive actions, admin.

## 4.9 Admin components

### AdminDataTable
- **Purpose:** Dense sortable/filterable table (orders, payments, audit, customers) with pagination + row actions.
- **Props:** `columns`, `rows`, `sort`, `filters`, `onSort`, `onFilter`, `bulkActions`, `rowActions`, `selectable`. **Visual:** default / sorted / selected rows / sticky header. **Interaction:** sort, filter, search, select, bulk, paginate, row click. **Empty:** EmptyState. **Error:** ErrorState. **Loading:** skeleton rows. **A11y:** `<table>` semantics, sortable `aria-sort`, keyboard nav, row selection announced. **Data:** list endpoints (orders/payments/audit). **Reuse:** all admin list surfaces.

### AdminOrderCard
- **Purpose:** Order summary card for queues/kanban — ref, customer, status, risk band, value, age/SLA.
- **Props:** `order`, `onOpen`, `slaTimer`. **Visual:** default / risk-flagged / SLA-warning / selected. **Interaction:** open, quick actions. **Empty:** n/a. **Error:** n/a. **Loading:** skeleton. **A11y:** labeled, status not color-only. **Data:** order summary. **Reuse:** Orders dashboard, queues.

### AdminTaskCard
- **Purpose:** Ops/inspection/delivery task card (kanban column item) — task type, assignee, due, status.
- **Props:** `task`, `onAssign`, `onAdvance`. **Visual:** todo / in-progress / blocked / done. **Interaction:** assign, advance, open. **Empty:** column EmptyState. **Error:** ErrorState. **Loading:** skeleton. **A11y:** draggable a11y (keyboard reorder), status in text. **Data:** Task queue. **Reuse:** Inspection Center, Dispatch, Hub.

### RiskReviewCard
- **Purpose:** Compliance review unit — **AI risk band + rationale + matched rules + confidence**, approve/reject/hold.
- **Props:** `review{band,rationale,matchedRules[],confidence,agentRunId}`, `onApprove`, `onReject`, `onHold`. **Visual:** LOW/MED/HIGH/BLOCK tones, low-confidence flag. **Interaction:** approve/reject/hold (→ HumanApprovalModal), view agent trace. **Empty:** queue empty. **Error:** ErrorState. **Loading:** skeleton. **A11y:** band+confidence in text, decision buttons labeled, required justification enforced. **Data:** RiskReview + AgentRun (AI architecture). **Reuse:** Risk Review queue, Order detail.

### AuditLogRow
- **Purpose:** Immutable audit entry row — actor (incl. agent), action, resource, timestamp, justification, before/after hash.
- **Props:** `entry{actor,action,resource,ts,justification,hashes}`. **Visual:** default / agent-actor (badge) / elevated-action (flag). **Interaction:** expand detail, deep link to order/run. **Empty:** EmptyState. **Error:** ErrorState. **Loading:** skeleton. **A11y:** table row semantics, agent vs human distinguished in text. **Data:** Audit S7 (read-only). **Reuse:** Audit Logs, order timeline (admin).

## 4.10 Component reusability matrix (selected)

| Component | Customer | Admin | Shared/base |
|-----------|:--:|:--:|:--:|
| AppShell, Toast, Modal, BottomSheet, ConfirmationDialog, Empty/Error/LoadingSkeleton, StatusBadge, FormInput, SelectInput | ✅ | ✅ | base (`@maralito/ui`) |
| MobileHeader, BottomNavigation, ServiceCard, ActiveOrderCard, BorderJourneyTimeline, TrustCard, QuoteSummaryCard, PaymentMethodCard, ConciergeCard, ChatBubble, NotificationCard, AddressCard | ✅ | read-only reuse | BorderPass-specific |
| InspectionPhotoGrid, InspectionChecklist, PackageInfoCard | ✅ (read) | ✅ (capture) | BorderPass-specific |
| AdminDataTable, AdminOrderCard, AdminTaskCard, RiskReviewCard, AuditLogRow | — | ✅ | admin |

---

# DELIVERABLE 5 — Screen Inventory

Per screen: **Purpose · Role · Route · Primary components · Data · User actions · System actions · Events emitted · Empty/Error/Loading · Responsive · A11y.** Routes use Next.js App Router groups `(customer)` / `(admin)` (TA §1.3). Events reference `contracts/03`. All customer screens are bilingual EN/ES, mobile-first; states default to Empty=EmptyState, Error=ErrorState, Loading=LoadingSkeleton unless noted.

## 5.1 Customer app (30 screens)

| # | Screen · Purpose | Route | Primary components | Data | User actions → Events emitted | Notes (system / responsive / a11y) |
|---|------------------|-------|--------------------|------|-------------------------------|-------------------------------------|
| 1 | **Welcome** — value prop, brand, get started | `/welcome` | AppShell, illustration, language pills, primary CTA, "Powered by Maralito Labs" footer | static | choose language, Get Started | public; full-bleed hero; reduce-motion; skip link |
| 2 | **Language selection** — EN/ES | `/welcome/language` | Toggle/pills, ServiceCard-less | locale | select → set `CustomerProfile.language` | persists pref; large targets; `lang` switch |
| 3 | **Sign up / Login** — phone auth | `/auth/login`, `/auth/signup` | FormInput (phone), primary CTA | none | submit phone → `user.created` (signup) | Identity S1; phone format MX/US; error `role=alert` |
| 4 | **Phone verification** — OTP | `/auth/verify` | OTP input, resend, Stepper | otp session | enter OTP, resend → (auth) | SMS via Notifications; autofill OTP; timeout |
| 5 | **Home** — service hub | `/` (`(customer)`) | MobileHeader, bridge header chip, ActiveOrderCard, ServiceCard grid, BottomNavigation | active orders, profile | tap service → New Request; Track → Journey | RSC fetch; carousel if multi-active; bottom nav `aria-current` |
| 6 | **New request — service selection** (step 1) | `/orders/new` | Stepper, ServiceCard×4 | service config | choose service → `order.created` (draft) | autosave draft; stacked EN/ES labels |
| 7 | **Buy-for-me request** | `/orders/new/buy?step=product` | Stepper, FormInput, UploadBox, ProductExtraction hint | draft order | enter URL/qty/variant/value → draft update | AI extract (assist); low-conf confirm; validation |
| 8 | **Receive-my-package request** | `/orders/new/receive` | Stepper, FormInput, AddressCard (hub) | draft order | enter carrier/tracking → draft update | hub address locked; receipt later |
| 9 | **Deliver-to-Juárez request** | `/orders/new/deliver` | Stepper, AddressCard, FormInput | draft order | enter pickup/delivery → draft update | MX address format; zone hint |
| 10 | **Product details** | `/orders/new/[svc]?step=product` | FormInput, SelectInput (variant), UploadBox (photos) | draft items | add/edit items → draft update | extraction estimate (not final); per-field validation |
| 11 | **Receipt / document upload** | `/orders/new/[svc]?step=docs` | UploadBox, FeeLineItem hint | files | upload receipt/RFC → `file.uploaded` | Files S5 signed URL; type/size validate; invalid-file state |
| 12 | **Border information / compliance** | `/orders/new/[svc]?step=border` | FormInput (purpose, declared value, RFC), UploadBox | draft border info | submit → `order.submitted` | required-field gates; RFC if business; a11y errors |
| 13 | **Request review** (summary) | `/orders/new/[svc]/review` | QuoteSummaryCard (estimate), FeeLineItem, primary CTA | draft + estimate | confirm submit → `order.submitted` | est. duties [AI] labeled; sticky CTA |
| 14 | **Quote review** | `/orders/[id]/quote` | QuoteSummaryCard, FeeLineItem, TrustCard, accept/decline | quote | accept → `quote.accepted`; decline | expiring/expired states; amounts in `<dl>` |
| 15 | **Payment** | `/orders/[id]/pay` | PaymentMethodCard, FeeLineItem, Stripe element, "Approve & Pay Duties" | quote, payment methods | pay → (Stripe) → `payment.succeeded/failed` | Payments S3; processing state; no double-submit; full-screen (nav hidden) |
| 16 | **Payment success** | `/orders/[id]/pay/success` | Success animation, ActiveOrderCard, CTA to Journey | order | continue → Journey | confetti (reduced-motion alt); receipt link |
| 17 | **Orders list** | `/orders` | MobileHeader, ActiveOrderCard (compact), StatusBadge, search/filter | orders | search, filter, reorder, open | infinite scroll; empty = start request |
| 18 | **Order details** | `/orders/[id]` | summary, items, QuoteSummaryCard, PaymentMethodCard, Document list, BorderJourneyTimeline entry, actions | order full | cancel/refund request → `refund.requested`; reorder | deep-linkable; section skeletons |
| 19 | **Border Journey tracking** | `/orders/[id]/journey` | MobileHeader (map overlay), BorderJourneyTimeline, TrustCard, ConciergeCard, View Photos | journey projection | tap stage, view photos, message concierge | live update (poll/sub); accessible timeline (D10) |
| 20 | **Inspection details** | `/orders/[id]/inspection` | InspectionPhotoGrid, InspectionChecklist (read), TrustBadge (serial/seal) | inspection | view photos, contact concierge | signed-URL photos; alt text; lightbox focus-trap |
| 21 | **Delivery confirmation** | `/orders/[id]/delivery` | PackageInfoCard, proof image, Delivered animation, reorder CTA | delivery | confirm receipt, reorder | POD display; success state |
| 22 | **Concierge chat (Messages)** | `/messages/[threadId?]` | ChatBubble thread, ConciergeCard, composer, WhatsApp link | thread | send, attach → `support.message` | WhatsApp continuity; `role=log`; typing indicator |
| 23 | **Notifications** | `/notifications` | NotificationCard list | notifications | tap (deep link), mark read | unread `aria-live`; empty state |
| 24 | **Profile** | `/profile` | header, list rows, BottomNavigation | profile | edit name/language, view history | sections; loyalty (future) hidden flag |
| 25 | **Addresses** | `/profile/addresses` | AddressCard list, add/edit | addresses | add/edit/default → profile update | MX + hub formats; empty state |
| 26 | **Payment methods** | `/profile/payment-methods` | PaymentMethodCard list, add | methods | add/remove/default | Stripe; expired warning |
| 27 | **Receipts / invoices** | `/profile/receipts` | document list, download | receipts | view/download | Files signed URL; empty state |
| 28 | **Help center** | `/support` | search, FAQ accordion, prohibited items, start chat | KB | search, open article, start chat | Support nav; RAG-backed FAQ; bilingual |
| 29 | **Settings** | `/settings` | Toggle (notif prefs, quiet hours), language, legal links, "Powered by Maralito Labs" | prefs | change prefs, language, logout | persists prefs; footer attribution |
| 30 | **About** | `/about` | brand story, "Powered by Maralito Labs", legal/ToS | static | open legal | attribution placement; static |

## 5.2 Admin / operations app (17 screens)

Role-gated via RBAC (9 roles + agent principal, `contracts/05`). Desktop-first; field views (inspector/driver) mobile-optimized. Sensitive data masked by default; PII reveal is audited.

| # | Screen · Purpose | Route | Role(s) | Primary components | Data · Actions → Events |
|---|------------------|-------|---------|--------------------|--------------------------|
| 1 | **Admin login** | `/admin/login` | all staff | FormInput, MFA | auth (MFA for admin/finance/compliance) |
| 2 | **Admin dashboard** | `/admin` | ops_mgr, super_admin | KPI tiles, AdminTaskCard queues, alerts | live ops overview; trigger workflows |
| 3 | **Orders dashboard** | `/admin/orders` | ops, super_admin | AdminDataTable, filters, AdminOrderCard | list/filter/bulk; open → detail |
| 4 | **Order detail** | `/admin/orders/[id]` | role-scoped | timeline, QuoteSummaryCard, RiskReviewCard, AuditLogRow, agent recs | advance/hold, approve gates → status events |
| 5 | **Risk review queue** | `/admin/risk` | compliance_admin | RiskReviewCard list, HumanApprovalModal | approve/reject/hold → `order.risk_assessed`/`rejected`, `agent.review_completed` |
| 6 | **Quote builder** | `/admin/quotes` | finance_admin | QuoteSummaryCard (edit), FeeLineItem, approval | approve/modify/send → `quote.created/sent` |
| 7 | **Package receiving** | `/admin/hub/receiving` | ops, inspector | PackageInfoCard, UploadBox, match | scan/register/match → `package.received` |
| 8 | **Inspection center** | `/admin/inspections` | inspector, compliance(review) | InspectionChecklist, InspectionPhotoGrid, AI flags | capture/pass/flag → `inspection.passed/failed` |
| 9 | **Delivery dispatch** | `/admin/deliveries` | ops_mgr, driver | AdminTaskCard kanban, map, assign | assign/reassign → `delivery.out_for_delivery` |
| 10 | **Concierge workspace** | `/admin/concierge` | concierge, support | ChatBubble thread, AI draft reply, order context | send (AI-draft, human-send) → `support.message.sent` |
| 11 | **Customer profile** | `/admin/customers/[id]` | role-scoped | profile, KYC (masked), history, risk | view (PII audited), flag |
| 12 | **Payments / refunds** | `/admin/finance` | finance_admin | AdminDataTable, RiskReviewCard (refund), HumanApprovalModal | approve refund → `refund.processed` |
| 13 | **Support tickets** | `/admin/support` | support, ops | AdminDataTable, AdminTaskCard, SLA | triage/assign/resolve/escalate |
| 14 | **Notifications (admin)** | `/admin/notifications` | super_admin, ops | template manager, delivery logs | manage templates, manual send |
| 15 | **Analytics** | `/admin/analytics` | leadership, ops, finance | charts, KPI scorecards, export | view/drill/export/set targets |
| 16 | **Audit logs** | `/admin/audit` | compliance, super_admin (scoped) | AdminDataTable, AuditLogRow | filter/search/export (read-only) |
| 17 | **Settings** | `/admin/settings` | super_admin | role/rule/flag config, hub/zones | configure (elevated + audited) |

> **Empty/Error/Loading** for all admin lists = EmptyState / ErrorState / skeleton rows; tables show DLQ/stuck-run + SLA alerts with runbook links (per `contracts/05` admin requirements).

---

# DELIVERABLE 6 — Routing Structure

Next.js **App Router** with route groups, mirroring TA §1.3 (`apps/borderpass`). Auth/role gating in middleware + layout guards; the BFF (server actions + route handlers) is the only place app code calls `@maralito/sdk` and sets tenant context (RLS). **Structure only — no code.**

## 6.1 Customer app routes

| Group | Routes | Guard |
|-------|--------|-------|
| **Public** | `/welcome`, `/welcome/language`, `/about` | none |
| **Auth** | `/auth/login`, `/auth/signup`, `/auth/verify` | redirect if authed |
| **Protected (shell + bottom nav)** | `/` (home), `/notifications`, `/support`, `/settings` | session required |
| **Order routes** | `/orders`, `/orders/new`, `/orders/new/[svc]` (`?step=product\|docs\|border`), `/orders/new/[svc]/review`, `/orders/[id]`, `/orders/[id]/quote`, `/orders/[id]/pay`, `/orders/[id]/pay/success`, `/orders/[id]/journey`, `/orders/[id]/inspection`, `/orders/[id]/delivery` | session + owner-RLS |
| **Profile routes** | `/profile`, `/profile/addresses`, `/profile/payment-methods`, `/profile/receipts` | session + owner |
| **Support routes** | `/support`, `/messages`, `/messages/[threadId]` | session |

## 6.2 Admin app routes

| Group | Routes | Role guard |
|-------|--------|-----------|
| **Admin protected** | `/admin/login`, `/admin` (dashboard) | staff session (+ MFA for admin/finance/compliance) |
| **Operations** | `/admin/orders`, `/admin/orders/[id]`, `/admin/hub/receiving`, `/admin/inspections`, `/admin/deliveries`, `/admin/drivers` | ops_mgr, inspector, driver (scoped) |
| **Finance** | `/admin/finance` (payments/refunds), `/admin/quotes` | finance_admin |
| **Compliance** | `/admin/risk`, `/admin/audit`, `/admin/customers/[id]` (KYC) | compliance_admin |
| **Support** | `/admin/support`, `/admin/concierge` | support, concierge |
| **Analytics** | `/admin/analytics`, `/admin/notifications` | leadership/ops/finance; super_admin |
| **Settings** | `/admin/settings` | super_admin |

## 6.3 Recommended App Router folder structure (structure only)

```
apps/borderpass/app/
├─ (public)/
│  ├─ welcome/            # + language/
│  └─ about/
├─ (auth)/
│  ├─ login/  signup/  verify/
├─ (customer)/            # shell: MobileHeader + BottomNavigation
│  ├─ layout.tsx          # session guard, locale, nav
│  ├─ page.tsx            # Home
│  ├─ orders/
│  │  ├─ page.tsx         # list
│  │  ├─ new/[svc]/       # step flow + review
│  │  └─ [id]/            # detail · quote · pay/(success) · journey · inspection · delivery
│  ├─ messages/[[...threadId]]/
│  ├─ notifications/
│  ├─ support/
│  ├─ profile/            # addresses · payment-methods · receipts
│  └─ settings/
├─ (admin)/               # shell: sidebar + topbar, RBAC layout guard
│  ├─ layout.tsx          # role guard + tenant context
│  ├─ page.tsx            # dashboard
│  ├─ orders/[id]/  risk/  quotes/  finance/
│  ├─ hub/receiving/  inspections/  deliveries/  drivers/
│  ├─ concierge/  support/  customers/[id]/
│  ├─ notifications/  analytics/  audit/  settings/
├─ api/                   # route handlers: webhooks (stripe/twilio/resend), SDK endpoints
└─ actions/               # server actions (the write path)
messages/                 # i18n EN/ES catalogs (ICU)
```

> **Note:** customer and admin can be one app (separate route groups + RBAC) per TA §1.2. `loading.tsx` (skeletons) + `error.tsx` (ErrorState) + `not-found.tsx` per segment. Full-screen flows (`/orders/[id]/pay`) opt out of bottom nav via a nested layout.

---

# DELIVERABLE 7 — User Flow → Screen Map

Per flow: **Step · Screen · User action · Backend/API dependency · Event emitted · Notification triggered · Edge cases.** APIs/events reference `contracts/02,03`; workflows reference the AI/automation blueprint (W1–W15 / WF1–WF18).

## 7.1 First-time onboarding
| Step | Screen | User action | API dep | Event | Notification | Edge cases |
|---|--------|-------------|---------|-------|--------------|-----------|
| 1 | Welcome | Get Started | — | — | — | returning user → skip to Home |
| 2 | Language | select EN/ES | profile.setLocale | — | — | device locale default |
| 3 | Sign up | enter phone | Identity signup | `user.created` | *Account created* | existing number → login |
| 4 | Phone verify | enter OTP | Identity verify (SMS) | (auth session) | OTP SMS | wrong/expired OTP, resend limit |
| 5 | Home | land | `GET /orders` | — | — | empty state (no orders) |

## 7.2 Buy-for-me request
| Step | Screen | User action | API dep | Event | Notification | Edge cases |
|---|--------|-------------|---------|-------|--------------|-----------|
| 1 | New request (service) | choose Buy for Me | `POST /orders` (draft) | `order.created` | — | autosave/resume draft |
| 2 | Product details | paste URL/qty/value | extract (AI assist), draft update | — | — | unsupported URL → manual; low-conf confirm |
| 3 | Receipt/docs | upload (optional) | Files signed URL | `file.uploaded` | — | invalid file type/size |
| 4 | Border info | purpose/declared value/RFC | draft update | — | — | RFC required (business) |
| 5 | Request review | submit | `POST /orders/{id}/submit` | `order.submitted` | *Request submitted* | missing fields → step back |
| 6 | (system) | — | Intake+Risk workflows | `order.under_review` | optional reviewing | missing info → WF5 |

## 7.3 Package reception request
| Step | Screen | User action | API dep | Event | Notification | Edge cases |
|---|--------|-------------|---------|-------|--------------|-----------|
| 1 | New request | choose Receive My Packages | `POST /orders` | `order.created` | — | — |
| 2 | Receive request | carrier/tracking + hub addr | draft update | — | — | hub address fixed |
| 3 | Border info/docs | declared value, receipt | Files, draft | `file.uploaded` | — | missing receipt → WF5 |
| 4 | Review | submit | submit | `order.submitted` | *Request submitted* | — |
| 5 | (system) | — | quote fees | `quote.created` | *Quote ready* | — |

## 7.4 Quote approval and payment
| Step | Screen | User action | API dep | Event | Notification | Edge cases |
|---|--------|-------------|---------|-------|--------------|-----------|
| 1 | Quote review | review itemized | `GET /orders/{id}/quote` | — | *Quote ready* (prior) | expired → re-quote |
| 2 | Quote review | accept | `POST /quotes/{id}/accept` | `quote.accepted` | — | decline → cancel path |
| 3 | Payment | pay / Approve & Pay Duties | Stripe intent (Payments S3) | (intent) | payment prompt | card declined → retry/dunning |
| 4 | (system) | webhook | Stripe webhook → normalize | `payment.succeeded`/`failed` | *Payment received* + receipt | failed → WF dunning |
| 5 | Payment success | continue | — | `order.paid` | — | double-submit guard (idempotent) |

## 7.5 Order tracking
| Step | Screen | User action | API dep | Event | Notification | Edge cases |
|---|--------|-------------|---------|-------|--------------|-----------|
| 1 | Home / Orders | tap Track | `GET /orders/{id}/journey` | — | per-stage | no active order → empty |
| 2 | Border Journey | view timeline/ETA | journey projection (poll/sub) | — | *Crossing started*, etc. | delay → *Customs delay* + new ETA |
| 3 | Journey | View Photos | InspectionPhoto signed URLs | — | *Inspection completed* | photo load fail → fallback |
| 4 | Journey | message concierge | open thread | `support.message` | *Support reply* | concierge unassigned |

## 7.6 Inspection review (customer)
| Step | Screen | User action | API dep | Event | Notification | Edge cases |
|---|--------|-------------|---------|-------|--------------|-----------|
| 1 | Journey | tap Inspection | `GET /orders/{id}/inspection` | — | *Inspection completed* | not yet inspected → pending |
| 2 | Inspection details | view photos/serial/seal | signed URLs | — | — | mismatch → *Issue found* path |
| 3 | Inspection details | contact concierge on issue | open thread | `support.escalated` | *Issue found* | resolution = HUMAN-APPROVAL (admin) |

## 7.7 Delivery confirmation
| Step | Screen | User action | API dep | Event | Notification | Edge cases |
|---|--------|-------------|---------|-------|--------------|-----------|
| 1 | Journey | track out-for-delivery | journey | — | *Out for delivery* + window | — |
| 2 | Delivery confirmation | view proof | `GET /orders/{id}/delivery` | `delivery.completed` (driver) | *Delivered* + proof | failed attempt → reschedule/notify |
| 3 | Delivery confirmation | reorder | `POST /orders` (prefilled) | `order.created` | — | — |

## 7.8 Concierge support
| Step | Screen | User action | API dep | Event | Notification | Edge cases |
|---|--------|-------------|---------|-------|--------------|-----------|
| 1 | Messages/Support | open/start chat | `GET /threads` | — | — | WhatsApp continuity |
| 2 | Concierge chat | send message | `POST /messages` | `support.message` | — | attachment fail → retry |
| 3 | (system) | AI triage + human reply | Support agent (draft), human send | `support.escalated`, `support.message.sent` | *Support reply* | sensitive → specialist (HUMAN-APPROVAL) |

## 7.9 Refund request
| Step | Screen | User action | API dep | Event | Notification | Edge cases |
|---|--------|-------------|---------|-------|--------------|-----------|
| 1 | Order details | request refund | `POST /refunds` | `refund.requested` | — | ineligible by policy |
| 2 | (system) | eligibility + amount | Refund agent (recommend) | (agent run) | — | risk-related → compliance |
| 3 | (admin) | finance approves | HumanApprovalModal | `refund.processed`, `agent.review_completed` | *Refund processed* | never double-refund (idempotent) |

## 7.10 Admin review (risk/compliance)
| Step | Screen | User action | API dep | Event | Notification | Edge cases |
|---|--------|-------------|---------|-------|--------------|-----------|
| 1 | Risk review queue | open review | `GET /admin/risk` | — | — | empty queue |
| 2 | RiskReviewCard | read AI band+rationale+confidence | AgentRun (read) | — | — | low-confidence flag |
| 3 | HumanApprovalModal | approve/reject/hold (justification) | `POST /runs/{id}/signal` | `order.risk_assessed`/`rejected`, `agent.review_completed` | rejection w/ reason | requester≠approver; SLA timeout → escalate |

## 7.11 Package inspection (ops)
| Step | Screen | User action | API dep | Event | Notification | Edge cases |
|---|--------|-------------|---------|-------|--------------|-----------|
| 1 | Receiving | scan/register/match | `POST /packages` | `package.received` | *Package received* | unmatched → staff task |
| 2 | Inspection center | capture photos/serial/seal, checklist | Inspection capture + AI flags | `inspection.started` | — | poor photo/OCR → re-capture |
| 3 | Inspection center | pass / flag | submit | `inspection.passed`/`failed` | *Inspection completed*/*Issue found* | fail → compliance HUMAN-APPROVAL |

## 7.12 Delivery dispatch (ops)
| Step | Screen | User action | API dep | Event | Notification | Edge cases |
|---|--------|-------------|---------|-------|--------------|-----------|
| 1 | Delivery dispatch | view arrived orders | `GET /admin/deliveries` | — | *Arrived in Juárez* | capacity overload alert |
| 2 | Dispatch (kanban) | assign driver/zone (AI suggests) | `POST /tasks` (delivery) | `delivery.out_for_delivery` | *Out for delivery* | driver assign sensitive → confirm |
| 3 | Driver view | capture POD | `POST /deliveries/{id}/proof` | `delivery.completed`/`failed` | *Delivered*/*failed* | failed → reschedule (≤N) → concierge |

---

# DELIVERABLE 8 — Design System States

State tokens reference D3 colors. Each state must be **distinguishable without color alone** (icon/label/shape) for WCAG AA.

## 8.1 Buttons
| State | Visual |
|-------|--------|
| Default | Primary fill `#a33e06`, white text `label-lg`, 24px radius, subtle 2px bottom-weighted inner shadow (tactile) |
| Hover (pointer) | Slight darken + Level-2 shadow lift |
| Pressed | 1.02×→0.98× tactile, inner shadow deepens, 120ms |
| Loading | Spinner + disabled, label → "…", `aria-busy` |
| Disabled | `on-surface` 38% on `surface-variant`, no shadow, no pointer |
| Success | Brief Emerald fill + check icon, then revert |
| Danger | `error` fill `#ba1a1a`, white text, used for destructive confirms |

> Secondary button = navy outline/text on transparent; Tertiary/text button = primary text only.

## 8.2 Forms
| State | Visual |
|-------|--------|
| Empty | Soft Sand fill `#f3ded7`, placeholder `on-surface-variant`, 12px radius |
| Filled | `on-surface` text |
| Focused | 2px `secondary` (navy) border + subtle ring |
| Valid | Emerald check affordance (optional), no error |
| Invalid | `error` border + message + icon, `aria-invalid`, `role="alert"` |
| Disabled | 38% opacity, no interaction |
| Loading | Disabled + inline spinner (async validation/submit) |
| Server error | Form-level ErrorState banner above fields + field-level where mapped |

## 8.3 Cards
| State | Visual |
|-------|--------|
| Default | White `surface-container-lowest`, 24px radius, Level-1 shadow |
| Selected | 2px `secondary` border (or primary for service choice) + Level-2 |
| Active | Primary accent edge/chip (e.g., In Transit) |
| Completed | Emerald accent + check (delivered/cleared) |
| Warning | Amber accent + icon (delay/attention) |
| Error | `error` accent + icon |
| Disabled | 38% opacity, no shadow, no press |

## 8.4 Timeline (Border Journey nodes)
| State | Visual |
|-------|--------|
| Completed | Filled primary/emerald node, solid connector, timestamp, check |
| Current | Highlighted node + expanded stage card + "In Progress" chip + `aria-current` |
| Pending | Muted `on-surface-variant` node, dashed/light connector |
| Delayed | Amber node + delay reason + new ETA |
| Failed | `error` node + icon + resolution affordance |

## 8.5 Uploads
| State | Visual |
|-------|--------|
| Empty | Dashed Soft Sand dropzone + icon + "Tap to upload / allowed types" |
| Drag/drop | Primary dashed border + highlight (desktop) |
| Uploading | Progress bar + % + cancel |
| Uploaded | Thumbnail + filename + remove (×) + check |
| Failed | `error` border + message + retry |
| Invalid file | `error` + "Unsupported type/size" + allowed list |

## 8.6 Payments
| State | Visual |
|-------|--------|
| Ready | "Approve & Pay Duties"/Pay CTA enabled, amount shown |
| Processing | Spinner, CTA disabled, `aria-busy`, no double-submit |
| Succeeded | Success animation + receipt link + continue |
| Failed | `error` banner + reason + retry; dunning copy |
| Refunded | Emerald/neutral "Refunded" badge + amount + timeline |

---

# DELIVERABLE 9 — Responsive Behavior

| Concern | Specification |
|---------|---------------|
| **Mobile-first layout** | Customer app designed at 360–430px; single column; 20px screen padding; 4-col grid. Primary target = phones. |
| **Tablet layout** | 600–1024px: center content, max ~640px reading column for customer; admin gains 2-col panels. |
| **Desktop / admin layout** | ≥1024px: admin sidebar + topbar, multi-column tables/kanban, 64px margins, 1280px max content width. Customer app centers in a phone-like column (max ~480px) on desktop with warm margins. |
| **Max width** | Content `max-width: 1280px` (admin); customer reading column ~480–640px. |
| **Scroll behavior** | Body scroll; sticky header (glass blur on scroll); inner scroll regions for chat/timeline; momentum scroll; scroll-restoration on back. |
| **Sticky CTAs** | New Request / Quote / Payment use a sticky bottom CTA bar (`z-sticky-cta`) above safe-area; never overlaps bottom nav (nav hidden on those full-screen flows). |
| **Sticky bottom nav** | Bottom nav fixed (`z-bottom-nav`), hidden on full-screen flows (pay, OTP) and admin. |
| **Safe-area support** | `env(safe-area-inset-*)` padding on header, bottom nav, sticky CTAs (notch/home-indicator). |
| **Touch target sizes** | ≥48×48px interactive minimum; ≥8px spacing between targets. |
| **Landscape behavior** | Supported; sticky CTA + nav remain reachable; journey timeline scrolls; avoid fixed full-height elements that clip on short landscape heights. |

> **PWA:** installable; field roles (inspector/driver) get resilient capture (queue+retry) where connectivity is poor `⚠️ VERIFY` offline scope. Images responsive (`srcset`), lazy-loaded; skeletons on all map/list/journey views for perceived performance.

---

# DELIVERABLE 10 — Accessibility Requirements

Target: **WCAG 2.1 AA.** Accessibility is a trust feature for the no-visa/low-trust persona — calm, legible, predictable.

| Area | Requirement |
|------|-------------|
| **Color contrast** | Text ≥ 4.5:1 (normal), ≥ 3:1 (large/UI). Verify primary `#a33e06` on warm surfaces and status chips (10% bg + 100% text) — `⚠️ VERIFY` each token pairing in CI (axe + contrast checker). Never convey state by color alone. |
| **Keyboard navigation** | All interactive elements focusable + operable; logical tab order; visible focus ring (2px navy + offset); no keyboard traps; skip-to-content link. |
| **Screen reader labels** | Every icon-only control has `aria-label`; images meaningful `alt` (decorative `alt=""`); status chips, progress, badges have text equivalents; live regions for async updates. |
| **Focus states** | Distinct, high-contrast focus indicator on all controls; focus returned to trigger after modal/sheet close; focus moved to new content on route change where appropriate. |
| **Touch target size** | ≥48×48px; adequate spacing; bottom-nav + CTAs comfortably tappable one-handed. |
| **Error message behavior** | Errors programmatically associated (`aria-describedby`), announced (`role="alert"`), not color-only, with clear recovery guidance; summarize form-level server errors at top. |
| **Form labels** | Visible `<label for>` (no placeholder-as-label); required state in text + `aria-required`; grouped fields use `<fieldset>/<legend>`. |
| **Reduced motion** | `prefers-reduced-motion` disables confetti, large transitions, shimmer → static; keep essential feedback. |
| **Bilingual text support** | Correct `lang` attribute per content language; language switch updates `lang`; layouts tolerate +20–25% ES length without truncation/clipping. |
| **Semantic structure** | Landmark regions (`header/nav/main/footer`), one `<h1>` per screen, ordered heading hierarchy, lists as lists, tables as tables. |
| **Accessible timelines** | Border Journey = ordered list (`<ol>`) with each stage's state in text, `aria-current` on the current stage, timestamps readable; not a purely visual graphic. |
| **Accessible modals/bottom sheets** | `role="dialog"` + `aria-modal="true"`, focus-trap, Esc to close, labelled by title, scrim click closes, return focus on close; bottom sheet drag has a keyboard-accessible close. |

> **Testing:** axe-core in CI + manual screen-reader passes (VoiceOver/TalkBack) on key flows (onboarding, request, quote/pay, journey, concierge); keyboard-only walkthrough of admin approvals.

---

# DELIVERABLE 11 — Localization Requirements

Support **English + Spanish**, ES first-class. **No hardcoded user-facing text** — all copy via i18n catalogs (`messages/en.json`, `messages/es.json`, ICU) keyed by message id.

| Concern | Specification |
|---------|---------------|
| **Language toggle behavior** | Toggle in onboarding, Settings, and header globe. Persists to `CustomerProfile.language`; updates `lang` attr + all copy immediately; notifications honor the stored preference. Default from device locale, overridable. |
| **Text expansion handling** | Design for +20–25% ES length; generous line-height (1.5× body); no fixed-width buttons/labels that truncate; allow 2-line wraps in nav/cards (home shows stacked EN+ES labels by design). |
| **Currency formatting** | `Intl.NumberFormat` with currency (USD for U.S. prices/duties; MXN where applicable); money stored as integer minor units + currency (contracts) — format at the edge; show currency code where ambiguous. |
| **Date/time formatting** | `Intl.DateTimeFormat` per locale + timezone (CST/Juárez); ETAs human-friendly ("Tomorrow", "5:00 PM CST"); no hardcoded date strings. |
| **Address formatting** | Mexican address format for Juárez delivery (calle, número, colonia, CP, ciudad, estado) vs U.S. format for El Paso Hub; format per address `type`. |
| **Phone formatting** | E.164 storage; display formatted MX (+52) / U.S. (+1); validate per country; OTP autofill-friendly. |
| **Notification language** | Sent in customer's `language`; ES templates are peers of EN (see `14-notification-strategy.md`); WhatsApp templates pre-approved per language `⚠️ VERIFY`. |
| **Sample labels (EN / ES)** | Home: "What can we help you bring across today?" / "¿Qué te ayudamos a cruzar hoy?" · Services: "Shop from USA / Comprar en USA", "Receive My Packages / Recibir mis paquetes", "Deliver to Juárez / Entregar en Juárez", "Business Orders / Pedidos empresariales" · Journey: "Arriving Tomorrow / Llega mañana", "Border Crossing / Cruzando la frontera" · CTA: "Track Details / Ver detalles", "Approve & Pay Duties / Aprobar y pagar impuestos". |
| **No hardcoded text rule** | Lint/CI check forbids literal user-facing strings in components; all via `t('key')`; pseudo-localization test in CI to catch hardcoded/clipping strings. |

---

# DELIVERABLE 12 — Motion & Microinteractions

Tasteful, premium, deliberate. All motion respects `prefers-reduced-motion` (→ instant/opacity-only). Tokens in D3.7.

| Interaction | Behavior |
|-------------|----------|
| **Page transitions** | 400ms fade + 8px rise (`easing-standard`); shared-element where natural (card → detail). |
| **Card press** | Scale to 1.02× + Level-1→Level-2 shadow, 120ms; release settles — "haptic-like" visual feedback. |
| **Button press** | 120ms tactile scale + inner-shadow deepen; loading swaps to spinner. |
| **Loading skeleton** | Soft shimmer sweep (1.2s loop) across map/list/journey placeholders; static block under reduced-motion. |
| **Timeline progress** | Node fill + connector "draw" 240ms, staggered top→current; current stage card expands gently. |
| **Border crossing** | Package icon glides USA→Mexico along the Bridge progress bar; on Customs→Driver-Assigned, **confetti** burst (1.2s) on the tracking screen. |
| **Package delivered** | Celebratory check + confetti + "¡Entregado!/Delivered!"; reorder CTA fades in. |
| **Toast entrance/exit** | Slide+fade from top (or above bottom-nav), 240ms in / 200ms out; auto-dismiss with progress. |
| **Modal / bottom sheet** | Modal: scrim fade + 240ms scale-in. Bottom sheet: 400ms slide-up with spring-free decelerate; drag-to-dismiss with rubberband. |
| **Success states** | Brief Emerald wash + check (payment, save); non-blocking. |
| **Error shake / alert** | Subtle 2-cycle horizontal shake (≤6px) on invalid submit + `role="alert"` message; never aggressive; disabled under reduced-motion (message only). |

> **Principle:** motion communicates state and reinforces trust ("unrushed premium"); it never blocks input or delays critical actions. Confetti is the *only* celebratory flourish and is reserved for crossing + delivery moments.

---

# DELIVERABLE 13 — Frontend Data Contract Map

Per major screen: **API needed · Data fields consumed · Mutations · Events emitted · Loading strategy · Error handling · Optimistic updates.** Reads via RSC/BFF (server, tenant-scoped); writes via Server Actions (Zod-validated, idempotency keys). **No new APIs invented** — endpoints reference `contracts/02`; gaps flagged `GAP`.

| Screen | API needed | Fields consumed | Mutations | Events emitted | Loading | Error handling | Optimistic |
|--------|-----------|-----------------|-----------|----------------|---------|----------------|-----------|
| **Home** | `GET /orders?status=active`, `GET /me` | order ref/status/journey stage/ETA, name, locale | — | — | RSC + skeleton card | ErrorState inline; retry | — |
| **New Request** | `POST /orders` (draft), `PATCH /orders/{id}` (autosave), product-extract (AI) | draft items, fees estimate | create/update draft | `order.created` | optimistic draft; debounce autosave | field-level + toast | ✅ draft autosave |
| **Receipt upload** | Files signed-URL (`POST /files/sign`), `POST /orders/{id}/documents` | file meta | upload, attach | `file.uploaded` | progress bar | invalid-file/failed + retry | ✅ thumb pre-confirm |
| **Request review/submit** | `POST /orders/{id}/submit` | summary + estimate | submit | `order.submitted` | button loading | validation → step back | — |
| **Quote review** | `GET /orders/{id}/quote`, `POST /quotes/{id}/accept` | line items, fees, duties, total, expiry | accept/decline | `quote.accepted` | section skeleton | expired → re-quote; ErrorState | — |
| **Payment** | Payments intent (`POST /payments/intent`), Stripe SDK | client secret, amount, methods | confirm payment | `payment.succeeded`/`failed` (webhook) | processing state | declined → retry/dunning; no double-submit | — (never optimistic on money) |
| **Orders list** | `GET /orders` (paginated) | summaries, status | — | — | skeleton rows + infinite scroll | ErrorState; retry | — |
| **Order details** | `GET /orders/{id}` (+ items/quote/payment/docs) | full order | cancel/refund request | `refund.requested` | per-section skeleton | ErrorState | — |
| **Border Journey** | `GET /orders/{id}/journey` (poll/subscribe) | stages, states, ETA, tracking id, location | — | — | skeleton timeline | stale → last-known + retry | — |
| **Inspection details** | `GET /orders/{id}/inspection`, signed photo URLs | photos, serial, seal, contents | — | — | image skeletons | broken-image fallback | — |
| **Delivery confirmation** | `GET /orders/{id}/delivery` | proof, timestamp, recipient | reorder | `order.created` (reorder) | skeleton | ErrorState | — |
| **Concierge chat** | `GET /threads/{id}`, `POST /messages` (poll/subscribe) | messages, concierge profile, channel | send, attach | `support.message` | thread skeleton + typing | send-failed → retry queue | ✅ optimistic send (pending→sent/failed) |
| **Notifications** | `GET /notifications`, `PATCH /notifications/{id}` | type/title/body/ts/read/deepLink | mark read | — | skeleton rows | ErrorState | ✅ mark-read |
| **Profile / Addresses / Methods / Receipts** | `GET/PATCH /me`, `GET/POST /addresses`, Stripe methods, `GET /receipts` | profile, addresses, methods, receipts | edit/add/default | — | skeleton | ErrorState; validation | ✅ pref/default toggle |
| **Help center** | `GET /kb/search` (RAG) | FAQ articles | — | — | skeleton | empty/ErrorState | — |

**Admin (selected):** Risk Review — `GET /admin/risk`, `GET /agent-runs/{id}`, `POST /runs/{id}/signal` (approve/reject; `order.risk_assessed`/`rejected`, `agent.review_completed`). Quote Builder — `GET/POST /quotes`, approve/send (`quote.created/sent`). Inspection — `POST /inspections/{id}` (`inspection.passed/failed`). Finance/Refunds — `GET /admin/finance`, `POST /runs/{id}/signal` (`refund.processed`). Audit — `GET /audit` (read-only).

**`GAP` — API contracts to confirm/add:** journey-projection read shape + realtime channel (poll vs subscribe) `⚠️ VERIFY`; KB/FAQ search endpoint for Help Center; notifications list/mark-read endpoints; thread/message list + attachment-upload endpoints; reorder endpoint (or reuse `POST /orders` with `source_order_id`). Confirm each against `contracts/02` before build; do not invent.

---

# DELIVERABLE 14 — Admin Frontend Requirements

| Requirement | Specification |
|-------------|---------------|
| **Dashboard layout** | Sidebar (role-filtered nav) + topbar (search, user, org) + content; real-time KPI tiles, queues, alert banners with runbook deep links; responsive to tablet for field use. |
| **Data tables** | `AdminDataTable`: server-side pagination, column sort (`aria-sort`), sticky header, density toggle, column visibility, row click → detail, export. |
| **Filters** | Faceted filters per surface (status, service_type, risk_band, date, hub, zone, customer, amount); persisted in URL query for deep-linking. |
| **Search** | Global + per-table search (order id, customer, tracking); debounced; server-backed. |
| **Sort** | Multi-column where useful; default by SLA/age; visible sort state. |
| **Status badges** | `StatusBadge` consistent across queues; tone + text (not color-only); risk bands LOW/MED/HIGH/BLOCK distinctly. |
| **Kanban / task views** | `AdminTaskCard` columns for Inspection, Dispatch, Hub receiving; drag-to-advance with keyboard-accessible reorder; WIP/capacity indicators. |
| **Bulk actions** | Multi-select rows → bulk assign/advance/export with confirm dialog; audited. |
| **Order detail panels** | Tabbed/segmented: summary · items · quote · payments · documents · inspection · journey · audit · agent recommendations. |
| **Human approval modals** | `HumanApprovalModal` (built on Modal): shows agent recommendation + confidence + matched rules, options approve/reject/modify, **required justification**, separation-of-duties enforced (requester≠approver), SLA timer; on submit → `POST /runs/{id}/signal`, emits `agent.review_completed`. |
| **Audit log visibility** | `AuditLogRow` read-only views; per-order timeline + global Audit screen; agent vs human actor distinguished; immutable; export. |
| **Agent recommendation display** | Every AI-assisted surface shows the recommendation, **confidence**, rationale/matched rules, and a link to the agent run trace; clearly labeled as AI recommendation, human decides. |
| **Manual override UI** | Elevated, audited override controls (status override, effectful replay) gated behind confirm + justification; visually distinct (danger tone); super_admin/role-scoped. |
| **Role-based page access** | Routes + nav + actions gated by RBAC (9 roles); unauthorized → `not_found` (never reveal existence); MFA for admin/finance/compliance. |
| **Sensitive data masking** | PII/KYC/RFC/financial masked by default (•••• last4), reveal is an explicit, **audited** action; restricted fields never shown to out-of-scope roles; signed-URL images permission-checked. |

---

# DELIVERABLE 15 — Quality Checklist

Frontend acceptance criteria (each item is a release gate; tie to CI where possible).

- **Visual fidelity to Stitch:** screens match approved Stitch board within token tolerances; colors/type/radii/shadows use D3 tokens (no ad-hoc values); signature components (bridge header, journey timeline, bridge progress bar, concierge card) present and faithful.
- **Mobile responsiveness:** correct at 360/390/430px; tablet + desktop columns per D9; safe-area respected; sticky CTA/nav behavior correct; no horizontal scroll; landscape usable.
- **Form validation:** shared Zod schemas (client+server); inline + form-level errors; required/format/RFC rules; accessible error association.
- **API integration:** reads via RSC/BFF tenant-scoped; writes via server actions with idempotency keys; no client direct DB; events emitted per D7/D13; no invented endpoints (gaps resolved).
- **Auth flows:** phone+OTP onboarding; session persistence; protected-route redirects; admin MFA; logout.
- **Role-based access:** customer owner-RLS; admin RBAC per route/action; unauthorized → not_found; sensitive actions elevated+audited.
- **Accessibility:** WCAG AA (axe clean on key flows); keyboard-only pass; screen-reader pass; focus management; reduced-motion; contrast verified per token pairing.
- **Localization:** EN/ES parity; no hardcoded user-facing strings; ES expansion handled; currency/date/address/phone formatted per locale; notification language honored.
- **Error handling:** every async surface has Empty/Error/Loading; retry paths; no dead ends; server errors surfaced clearly.
- **Loading states:** skeletons match content shape on all map/list/journey/detail views; perceived-performance maintained.
- **Payment UX:** processing/succeeded/failed/refunded states; no double-submit; receipts; never optimistic on money; declined→retry/dunning.
- **Upload UX:** all 6 upload states; type/size validation; progress + retry; signed-URL flow.
- **Timeline UX:** accessible ordered timeline; node states distinct; live updates; delay/failed states; "View Photos".
- **Admin UX:** tables (sort/filter/search/bulk), kanban, approval modals with justification + SoD, audit visibility, agent recommendation + confidence display, masking + reveal-audit.

---

# DELIVERABLE 16 — Implementation Readiness Review

## 16.1 Ready to build
Design tokens (colors/type/spacing/radius/shadow/z/motion — fully specified from Stitch); core IA + bottom-nav; component inventory (36 components) with states; customer screen set (30) with routes; admin screen set (17) with role gates; routing + folder structure; user-flow→screen maps; state matrices; responsive/a11y/i18n/motion specs; the Stitch HTML/screens as visual reference for Home, New Request, Journey, Inspection, Welcome, Concierge.

## 16.2 Still needs clarification
- Messages vs Support nav semantics (IA open question 5.43): treat **Messages = concierge thread**, **Support = help hub + start chat** — confirm.
- Journey realtime transport (poll vs subscribe) + projection read shape. `⚠️ VERIFY`
- Warning/Info color tokens + Gold premium hex (not in token file) — propose + confirm contrast. `⚠️ VERIFY`
- Modal/bottom-sheet shadow values (proposed) vs Stitch.
- PWA/offline scope for inspector/driver field capture. `⚠️ VERIFY`

## 16.3 Missing assets
Production logo lockups (orange/inverse), app icon set (1024 + adaptive/maskable/monochrome), brand illustrations beyond skyline, empty/error-state illustrations, map style asset/config, favicon/monogram exports, OG/social images. `GAP`

## 16.4 Missing copy
Full EN/ES catalog (only notification templates + sample labels exist); error/empty-state copy; Help Center/FAQ articles; legal/ToS/privacy; prohibited-items content; onboarding microcopy. `GAP`

## 16.5 Missing API contracts
Journey projection + realtime; KB/FAQ search; notifications list/mark-read; threads/messages + attachments; reorder; profile/address/method CRUD shapes — confirm against `contracts/02`; list as gaps, do not invent.

## 16.6 Missing design states
Multi-active-order home carousel; business-order (RFC) variant screens; admin empty/error illustrations; some admin edge states (DLQ/stuck-run panels) need visual spec.

## 16.7 Engineering risks
| Risk | Mitigation |
|------|-----------|
| Stitch HTML uses Tailwind CDN + Google Fonts CDN | Re-implement as Tailwind theme + self-hosted fonts; treat HTML as reference, not source. |
| ES text expansion breaking layouts | Pseudo-loc CI test; flexible components; 2-line label support. |
| Realtime journey/admin queues | Decide poll vs subscribe early; skeleton + last-known fallback. |
| Payment edge cases (double-submit, webhooks) | Idempotency keys; never optimistic on money; webhook-driven state. |
| Sensitive-data exposure in admin | Mask-by-default + audited reveal; RBAC route+action gates; signed URLs. |
| Accessibility regressions | axe in CI + manual SR/keyboard passes per release. |

## 16.8 Recommended build order
1. Design system / tokens (theme over `@maralito/ui`)
2. App shell / navigation (customer + admin shells)
3. Auth / onboarding (language, phone, OTP)
4. Customer home
5. New request flow (service → product → docs → border → review)
6. Quote / payment flow
7. Order tracking (Border Journey)
8. Inspection details
9. Concierge chat
10. Admin dashboard
11. Admin order review (risk + approval modals)
12. Inspection center
13. Delivery dispatch
14. Notifications / settings

---

# DELIVERABLE 17 — Final Output Format

## 17.1 Component matrix (summary)

| Category | Components |
|----------|-----------|
| Layout/nav | AppShell, MobileHeader, BottomNavigation |
| Home/service | ServiceCard, ActiveOrderCard |
| Journey/status | BorderJourneyTimeline, StatusBadge, TrustBadge/TrustCard |
| Quote/payment | QuoteSummaryCard, FeeLineItem, PaymentMethodCard |
| Forms | UploadBox, FormInput, SelectInput, Toggle, Stepper, ProgressIndicator |
| Concierge | ConciergeCard, ChatBubble, NotificationCard |
| Inspection/package | InspectionPhotoGrid, InspectionChecklist, PackageInfoCard, AddressCard |
| Feedback/utility | EmptyState, ErrorState, LoadingSkeleton, Toast, Modal, BottomSheet, ConfirmationDialog |
| Admin | AdminDataTable, AdminOrderCard, AdminTaskCard, RiskReviewCard, AuditLogRow |

## 17.2 State matrix (summary)

| Element | States |
|---------|--------|
| Button | default · hover · pressed · loading · disabled · success · danger |
| Form field | empty · filled · focused · valid · invalid · disabled · loading · server-error |
| Card | default · selected · active · completed · warning · error · disabled |
| Timeline node | completed · current · pending · delayed · failed |
| Upload | empty · drag/drop · uploading · uploaded · failed · invalid-file |
| Payment | ready · processing · succeeded · failed · refunded |

## 17.3 Route map (summary)

Customer: `(public)` welcome/about · `(auth)` login/signup/verify · `(customer)` home, orders(+new/[svc], [id]/quote|pay|journey|inspection|delivery), messages, notifications, support, profile(+addresses/payment-methods/receipts), settings.
Admin: `(admin)` dashboard, orders/[id], risk, quotes, finance, hub/receiving, inspections, deliveries, drivers, concierge, support, customers/[id], notifications, analytics, audit, settings.

## 17.4 Risks & mitigations
See [16.7](#167-engineering-risks). Top: treat Stitch HTML as reference (re-theme, self-host fonts); guard ES expansion (pseudo-loc CI); decide realtime transport early; idempotent payment UX; mask-by-default admin PII; a11y in CI.

## 17.5 Open questions
1. Messages vs Support nav semantics — confirm split.
2. Realtime transport (poll vs subscribe) + journey projection shape. `⚠️ VERIFY`
3. Warning/Info/Gold token hex + contrast approval. `⚠️ VERIFY`
4. Modal/bottom-sheet shadow values vs Stitch.
5. PWA/offline scope for field roles. `⚠️ VERIFY`
6. Confirm all `GAP` API endpoints in `contracts/02` (no invention).
7. Single app (route groups) vs separate admin app — confirm deployment shape.
8. WhatsApp template pre-approval per language. `⚠️ VERIFY`

## 17.6 Next recommended document
**`BorderPass Frontend Component Specifications & i18n Copy Deck (Draft)`** — per-component prop/type tables (mapped to shared Zod contracts), the full EN/ES ICU message catalog, and the missing-asset production checklist — produced *after* this handoff is approved and *before* implementation. Companion: **`Frontend Test Plan`** (Playwright e2e per flow + axe a11y + pseudo-loc) to back the D15 gates.

---

## Document close-out

This handoff converts the approved Stitch design into an implementation-ready spec across all 17 deliverables, consistent with the IA (`docs/05`), notification strategy (`docs/14`), the Next.js architecture (`technical-architecture/01`), the data/API/event contracts (`contracts/01–05`), and the AI agent architecture (human-approval + sensitive-data UI gates). It introduces **no production code, no React components, and no app build** — by design. `⚠️ VERIFY` and `GAP` items must be resolved before/at implementation start.

*Owner: Principal Frontend Architect, Web Forx Technology Ltd. · Draft v0.1 · 2026-06-29*
