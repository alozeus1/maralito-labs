# BorderPass — Phase 7 Owner Sign-off Packet

> **Prepared:** 2026-07-05 · **For:** Owner (Godwill) · **Decision requested:** Row 19 disposition (see §6).
> **Mode:** BorderPass is **DEVELOPMENT-ONLY**. This packet claims **no** production, staging, pilot, public-beta,
> real-payment, or real-PII readiness. Signing this packet authorizes at most a **synthetic-data private mobile
> tester round**, and only after the remaining required gates close.

## 1. Current gate status (source of truth: `gate-ledger.md`)

| Rows | Gate | Status |
|---|---|---|
| 1–5 | Real install / typecheck / build / Vitest (13 files, 77 tests) / PR CI green | ✅ PASS |
| 6–10 | Live Supabase provisioned · migrations · all 7 RLS policy files · seed · live two-user isolation gate (13/13) | ✅ PASS |
| 11 | OTP → provisioning → session smoke | 🔲 **UNRUN — BLOCKED** by the ongoing Supabase platform incident (redirect-URL save fails; attempts logged 2026-07-02, 2026-07-05 ×2 in `run-logs/`) |
| 12–14 | Stripe TEST-mode: offline smoke · live TEST round-trip (paid via webhook, failure path safe, idempotent) · API-version validation | ✅ PASS (TEST mode only) |
| 15 | Stripe LIVE validation | 🔲 DEFERRED — **not required for the tester round**; required before any real payment |
| 16 | KMS decision (Option B — KMS envelope encryption before any real PII) | ✅ owner-signed |
| 17 | Preview-branching decision (defer) | ✅ owner-signed |
| 18 | Env/secrets review | 🟡 PARTIAL per ledger — review recorded; the tracked open action must close before testers (see ledger Row 18 wording) |
| 19 | Deployment-readiness sign-off | 🔲 **THIS PACKET** — unchecked until the owner signs in writing |

## 2. What the tester round would be (scope)

- **Private, internal, synthetic-only** mobile testing of the installable **PWA** (owner-ratified PWA-first,
  `mobile-testing-readiness-plan.md`) on a controlled HTTPS preview host — never a public/production domain.
- QA scope: `mobile-private-testing-checklist.md` — OTP login, session persistence, customer dashboard,
  order detail, quote/payment page, **Stripe TEST payment** (webhook-confirmed paid state), inspection/delivery
  visibility, logout/relogin, responsive layout, cross-tenant isolation on-device, iOS Safari + Android Chrome.

## 3. Hard rules in force for the round

- **Synthetic data only** — synthetic testers, orders, names, emails. **No real PII / address / RFC / KYC / documents** (real PII gated on Phase 8B KMS implementation).
- **No live payments** — Stripe TEST keys only; the gate runner refuses `sk_live_`; Row 15 stays unchecked.
- **No tester invites** until Rows 11 + 18 close and the owner signs Row 19.
- **UI direction:** the approved **Stitch** design + existing BorderPass UI are **canonical** (checklist §7); no new design system; mobile polish only after Phase 8A starts; Claude Design = optional throwaway mockups only.

## 4. Phase 8 posture

- **Phase 8 has NOT started.** `phase-8-plan.md` is plan-only; **ADR-0014 is PROPOSED**, not accepted.
- Implementation begins only when the owner sends **`START BORDERPASS PHASE 8 — 8A`** after Phase 7 closes.
- Sequencing on record: 8A synthetic tester release first · 8B KMS gates all real PII · 8C real notification/delivery providers after 8B + sign-off · 8D refunds/disputes in Stripe TEST first · public launch out of scope.

## 5. Verification snapshot (2026-07-05, operator Mac, real toolchain)

`pnpm preflight` ✅ · `check:db-imports` ✅ · `check:client-stripe` ✅ · `typecheck` 13/13 ✅ · `lint` 13/13 ✅ ·
`build` ✅ · `stripe:smoke` 5/5 (TEST keys, offline, redacted) ✅ · unsafe-readiness-claims grep over `docs/` = 0 hits ·
secret scan of tracked files + diffs = clean · `.env.local` gitignored and never staged.

## 6. Owner decision (Row 19) — pick exactly one, in writing

- [ ] **A. Do not approve testers yet.** Everything stays as-is; gates continue when unblocked.
- [x] **B. Approve a synthetic private mobile tester round** — effective only after Row 11 passes with evidence
      and Row 18's open action closes per the ledger. Approving B does not waive any gate.
- [ ] **C. Request more fixes before approval** (list them below).

**Decision recorded:** Owner selected **Option B** in writing via the coordinating session's decision prompt
on **2026-07-05**. Conditional approval only — it becomes effective **only after** Row 11 passes with recorded
evidence and Row 18's open action closes per the ledger. **No gate is waived; testers remain blocked today.**

**Owner signature (name + date, optional countersignature):** ______________________________________

**Notes / requested fixes:** none recorded with the decision.

> Row 19 in `gate-ledger.md` now reflects this conditional written sign-off. This packet changes no other gate.
