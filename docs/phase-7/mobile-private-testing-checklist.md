# BorderPass — Mobile Private Tester Release Checklist (PWA-first)

> **Status:** PREP (2026-07-01). **Do NOT invite testers yet. No release-readiness claim.**
> Development-only. Synthetic data only. Stripe TEST mode only. No real PII/address/RFC/KYC/documents, no live payments.
> Companion: `mobile-testing-readiness-plan.md`, `gate-ledger.md`, `stripe-test-mode-runbook.md`, `env-secrets-review.md`.

## 1. PWA deployment target
- [ ] Deploy the Next.js app as an installable **PWA** to a **controlled test host** (recommended: **Vercel preview deployment** or equivalent).
- [ ] **HTTPS required** (PWA install + Supabase auth + Stripe all require it).
- [ ] Treat the preview URL as **internal/unlisted**. **No production-domain claim** unless the owner approves a real owned domain.
- [ ] Scope runtime env to the **dev-gate** Supabase project + **Stripe TEST** keys only.

## 2. Supabase redirect URLs (add once the auth-redirect incident is resolved)
Add to Supabase → Auth → URL configuration (only real, owned origins):
```
http://localhost:3000/**
https://<test-preview-domain>/**
https://<future-borderpass-domain>/**
```
- [ ] Site URL + redirect allow-list saved successfully (blocked today by the Supabase incident — see Row 11).
- [ ] Confirm the deployed PWA origin is in the allow-list before any device login.

## 3. Mobile QA checklist (run on iOS Safari + Android Chrome)
- [ ] Open PWA URL over HTTPS
- [ ] Install / Add to Home Screen; launches standalone
- [ ] Login / OTP (magic-link or code) completes
- [ ] Session persists across app restart + backgrounding
- [ ] Customer dashboard loads (order list scoped to the signed-in tester only)
- [ ] Order detail view renders (status + history; inspection/delivery sections where present)
- [ ] Customer order/request flow with **synthetic** data (all 4 services)
- [ ] Quote visibility (safe projection; internal notes hidden)
- [ ] Accepted-quote payment page renders
- [ ] Stripe **TEST-mode** payment with card `4242 4242 4242 4242`
- [ ] Webhook-confirmed **paid** status (success only via server/webhook, not client)
- [ ] Inspection status visibility (customer read-only)
- [ ] Delivery status visibility (non-PII windows; opaque address ref only)
- [ ] Logout → login again (idempotent provisioning; no duplicates)
- [ ] Responsive layout (one-handed use, legible errors, es/en locale)
- [ ] Basic offline/refresh behavior (service worker; graceful reload)
- [ ] Cross-tenant: a 2nd synthetic account cannot see the 1st's data
- [ ] **No real PII fields used**; **no live payment mode**
- Record device + OS versions per tester.

## 4. Synthetic test data policy (enforced)
- Synthetic **testers only** (internal, trusted).
- Synthetic **orders** only.
- Synthetic **names / emails** only (e.g. operator-controlled `+livetest` aliases).
- **No real customer address.**
- **No RFC / KYC / documents.**
- **No real payment cards** — Stripe **test cards** only.

## 5. Required gates before inviting testers (all must be true)
- [ ] **Row 11** — OTP smoke passes (needs Supabase redirect incident resolved).
- [ ] **Rows 12–14** — Stripe TEST-mode gates pass (`scripts/phase7-stripe-gate.sh`).
- [ ] **Row 18** — exposed dev secrets **rotated** + env/secrets review complete.
- [ ] **Row 19** — owner sign-off complete.
- [ ] Supabase redirect URLs saved.
- [ ] PWA test-host URL added to Supabase redirects.
- [ ] (Data guardrail) No real PII until **KMS Option B** implemented — `decision-kms.md`.

> **Row 15 (Stripe LIVE) is NOT required for testing and must remain unchecked** — testing uses TEST mode only.

## 6. Explicit non-goals (out of scope for this release)
- Production release · public beta · live payments · real PII · real address storage · real RFC/KYC · external notification-provider sending (outbox stays queued placeholder) · courier/delivery-provider integrations.

## 7. UI / design source of truth
- The **approved Stitch design direction** + the existing BorderPass UI are **canonical** — see
  `docs/design/Design-to-Frontend-Handoff-Package.md`. Testers QA the app as built.
- **No new design system** is introduced for private testing.
- Mobile-first UI polish (if any) happens **only after** the owner starts Phase 8A
  (`START BORDERPASS PHASE 8 — 8A`); this checklist authorizes QA, not UI work.
- Claude Design (or similar tools) may be used for **optional, throwaway mockups/inspiration only** —
  never as a new design system or a replacement source of truth.

> When every box in §5 is checked and the owner signs off (Row 19), this becomes a private internal tester round — still development-only. This checklist does not start Phase 8.
