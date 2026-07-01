# Gap Analysis — maralito-labs

> **Validated:** 2026-06-30. Grouped by severity. Every item is evidence-backed (see sibling reports).
> Effort: S = <1h, M = 1–4h, L = 1–3d.

## 🔴 Critical Blockers (block production / Phase 3)
| # | Issue | Affected files | Risk | Fix | Effort | Owner | Validation |
|---|-------|----------------|------|-----|:------:|-------|-----------|
| C1 | **Build fails** — `borderpass` build can't resolve `drizzle-orm` types | `apps/borderpass`, `packages/db` boundary | No deployable artifact; CI red; Vercel deploy blocked | Stop leaking Drizzle types across `@maralito/db` surface (A) or add `drizzle-orm` dep to app (B) | M | Platform Eng | `pnpm build` exit 0 |
| C2 | **Live Supabase RLS gate not run** | `packages/db/scripts/live-rls-gate.ts` | Tenant isolation unproven on real pooler → data-leak risk if assumed safe | Run gate vs real Supabase + pooler (see `RLS_VALIDATION_REPORT.md`) | M (needs live) | DB/Sec | gate 15/15 green |
| C3 | **`drizzle-orm` SQL-injection CVE** (0.33.0) | `packages/db` | HIGH CVE-2026-39356 in the data layer | Bump `drizzle-orm`→`^0.45.2` (+ `drizzle-kit`); re-run 17 RLS tests | M | DB Eng | `pnpm audit` no high in drizzle; tests green |

## 🟠 High Priority (fix before real users)
| # | Issue | Affected files | Risk | Fix | Effort | Owner | Validation |
|---|-------|----------------|------|-----|:------:|-------|-----------|
| H1 | **Typecheck fails** — observability test imports `vitest` (no devDep) | `packages/observability` | CI red; type safety gate broken | Add `vitest` devDep + `test` script (so `redact` test runs) | S | Platform Eng | `pnpm typecheck` exit 0 |
| H2 | **Tests fail** — `borderpass` missing `jsdom` | `apps/borderpass` | App unit tests never run | `pnpm --filter borderpass add -D jsdom` | S | App Eng | `pnpm test` exit 0 |
| H3 | **Lint fails** — 2 errors | `packages/observability/src/redact.test.ts`, `packages/db/scripts/live-rls-gate.ts` | CI red | Fix `no-explicit-any` + `no-unused-expressions` | S | Platform Eng | `pnpm lint` exit 0 |
| H4 | **Dev-dep CVEs** — vitest (critical) + vite/lodash (high) | root/workspace | `pnpm audit` gate red | Bump `vitest`→`^3` org-wide; add `pnpm.overrides` for lodash | M | Platform Eng | `pnpm audit --audit-level=high` exit 0 |
| H5 | **Rate limiting not implemented** | (Upstash envs only) | Abuse / brute-force on future auth + webhook routes | Implement Upstash limiter middleware before public endpoints | M | Platform Eng | limiter unit test + 429 on burst |

## 🟡 Medium Priority (important, not blocking now)
| # | Issue | Affected files | Risk | Fix | Effort | Owner |
|---|-------|----------------|------|-----|:------:|-------|
| M1 | Audit-log append-only not yet confirmed at DB level | `server/audit.ts`, policies | Tamperable audit trail | Add DB constraint/trigger; verify in live gate | M | DB/Sec |
| M2 | No CI action SHA-pinning / `main` protection | `.github/workflows/ci.yml` | Supply-chain / unreviewed merges | Pin actions by SHA; protect `main`; require gates | S | DevSecOps |
| M3 | `@maralito/sdk` is a typed placeholder (known gap #3) | `packages/sdk` | Blocks clean app↔platform contract | Confirm + flesh out SDK surface | M | Platform Eng |
| M4 | No `vercel.json` / env mapping codified | repo root | Deploy drift | Add Vercel config + env mapping doc | S | DevSecOps |
| M5 | semgrep `--config auto` may be noisy in CI | `ci.yml` | CI noise | Tune ruleset (known gap #8) | S | DevSecOps |
| M6 | No IaC scanning (checkov/tfsec) | — | Future infra misconfig | Add when `infra/` exists | S | DevSecOps |

## 🟢 Low Priority (cleanup / polish)
| # | Issue | Fix | Effort |
|---|-------|-----|:------:|
| L1 | Empty leftover dirs (`borderpass/`, `maralito-platform/`) couldn't be deleted in sandbox (known gap #1) | delete on host | S |
| L2 | Cross-folder doc links may break post-relocation (known gap #2) | link-fix pass | S |
| L3 | Design token gaps (warning/info/gold hex, modal shadows) (known gap #6) | confirm tokens | S |
| L4 | Caret-ranged deps (now lockfile-pinned) | optionally pin majors | S |

## Future-phase work (not gaps — planned)
Payments (`phase6`), Notifications (`phase9`), Automation/Inngest (`phase10`), AI agents (`phase11`)
are **intentional placeholders**. Track them as roadmap, not defects. Each must pass its own
validation (webhook verify, email delivery, mocked AI evals) before being called "ready".

## Net assessment
- **Architecture: healthy.** No critical design gaps; no external starter needed.
- **Foundation: defective but trivially fixable** — 3 critical + 5 high items, ~1–2 days total, restore
  all gates to green.
- **Biggest real risk:** C2 (live RLS gate) — it's the difference between "isolation proven in
  mechanism" and "isolation proven in production".
