# Phase Readiness Report — Build / Lint / Typecheck / Test

> **Validated:** 2026-06-30 on darwin · Node v22.22.2 · pnpm 9.12.0 · turbo 2.10.1.
> **Honesty rule applied:** a gate is "PASS" only if the command exited 0. Raw output:
> `_evidence/local-validation.log`.

## Results at a glance
| # | Gate | Command | Result | Exit |
|---|------|---------|:------:|:----:|
| 0 | Install | `pnpm install --frozen-lockfile` | ✅ **PASS** | 0 |
| 1 | Typecheck | `pnpm typecheck` | ❌ **FAIL** | 2 |
| 2 | Lint | `pnpm lint` | ❌ **FAIL** | 1 |
| 3 | Test | `pnpm test` | ❌ **FAIL** (aggregate) | 1 |
| 4 | Build | `pnpm build` | ❌ **FAIL** | 1 |
| 5 | Dep audit | `pnpm audit --audit-level=high` | ❌ **FAIL** (9 vulns) | 1 |
| 6 | DB-import guard | `pnpm check:db-imports` | ✅ **PASS** | 0 |

**Bottom line:** install works and the lockfile is honest, but **4 of 6 quality gates fail on a clean
checkout**. None of the failures are architectural — all are small foundation defects (missing
devDeps, two lint nits, a cross-package type-resolution issue, and dependency CVEs). Estimated total
fix effort: **~2–4 hours.** Until fixed, the repo is **NOT** a "green" golden starter and CI on a
clean branch is red.

---

## 1) Typecheck — FAIL (exit 2)
`4 of 11 packages` typechecked before the run failed.
```
@maralito/observability:typecheck: src/redact.test.ts(1,38):
  error TS2307: Cannot find module 'vitest' or its corresponding type declarations.
```
**Root cause:** `packages/observability` ships a test file (`redact.test.ts`) that imports `vitest`,
but the package has **no `vitest` devDependency** and **no `test` script** (only `lint`, `typecheck`).
The `typecheck` compiles the test file and can't resolve `vitest` types.
**Fix:** add `vitest` to `packages/observability` devDeps **and** a `test` script (so the redact test
actually runs in CI), or exclude `*.test.ts` from that package's `tsconfig`. Prefer the former.

## 2) Lint — FAIL (exit 1)
`7 of 11 packages` clean; 2 errors:
```
@maralito/observability  src/redact.test.ts  6:133  error  Unexpected any  @typescript-eslint/no-explicit-any
@maralito/db             scripts/live-rls-gate.ts  ~14:56  error  Expected an assignment or function call …  @typescript-eslint/no-unused-expressions
```
**Fix:** (a) type the test object instead of `as any` (or add a scoped eslint-disable in the test);
(b) the `live-rls-gate.ts` expression statement should be an assignment/call or get a disable comment.
Both are 1-line changes.

## 3) Test — FAIL aggregate (exit 1), but the meaningful suites PASS
Turbo reported `2 successful, 4 total` and stopped. Re-running each suite directly:
| Suite | Tests | Result |
|-------|:-----:|:------:|
| `@maralito/auth` (RBAC) | 6 | ✅ PASS |
| `@maralito/schemas` | 9 | ✅ PASS |
| `@maralito/db` (RLS isolation + orders-RLS + provisioning) | **17** | ✅ PASS (verified via `pnpm --filter @maralito/db test`) |
| `apps/borderpass` | — | ❌ FAIL |
```
borderpass:test:  MISSING DEPENDENCY  Cannot find dependency 'jsdom'
```
**Root cause:** `apps/borderpass/vitest.config.ts` sets `environment: 'jsdom'` but `jsdom` is **not a
devDependency**. No app tests run at all because the environment can't initialize.
**Fix:** `pnpm --filter borderpass add -D jsdom`. (Also note `borderpass` has only e2e/Playwright +
this jsdom unit config; there are currently no committed unit tests under `tests/unit/**`.)
**Important nuance:** the **tenant-isolation RLS tests pass** — the most security-critical suite is
green. The aggregate failure is purely the missing `jsdom` devDep, not a logic failure.

## 4) Build — FAIL (exit 1)
Only `apps/borderpass` has a `build` script (packages are typecheck/lint only). Next.js **compiles
successfully** (`✓ Compiled successfully in 4.8s`, typed routes generated), then fails in the
type-validation phase:
```
borderpass:build: Type error: Cannot find module 'drizzle-orm' or its corresponding type declarations.
```
**Root cause:** under pnpm's isolated `node_modules`, `borderpass` transitively reaches `drizzle-orm`
**types** (re-exported across the `@maralito/db` boundary) but does **not** directly depend on
`drizzle-orm`, so `next build`'s type-check can't resolve it.
**Fix (pick one, prefer A):**
- **A — tighten the boundary (recommended):** stop leaking Drizzle types across `@maralito/db`'s
  public surface; expose app-facing types from `@maralito/db`/`@maralito/sdk` instead of re-exporting
  ORM types. Keeps the "thin app, fat platform" contract intact.
- **B — quick unblock:** add `drizzle-orm` as a direct dependency of `apps/borderpass`. Faster, but
  leaks the ORM into the app (mild ADR-0006 boundary erosion).

## 5) Dependency audit — FAIL (9 vulnerabilities)
`Severity: 6 moderate | 2 high | 1 critical`. The ones that matter:
| Severity | Package | Installed | Fixed in | Note |
|:--------:|---------|-----------|----------|------|
| 🔴 critical | `vitest` | 2.1.9 | ≥3.2.6 | Dev-only (UI server arbitrary file read/exec, GHSA-5xrq-8626-4rwp). Not shipped, but blocks the `--audit-level=high` gate. |
| 🟠 high | **`drizzle-orm`** | 0.33.0 | ≥0.45.2 | **Production-relevant** — SQL injection via improperly escaped SQL identifiers (CVE-2026-39356 / GHSA-gpj5-g38j-94v9). Fix before production. |
| 🟠 high | `vite` | 5.4.21 | ≥6.4.3 | Dev-only, transitive via vitest. |
| 🟠 high | `lodash` | 4.17.21 | 4.18.0 | Flagged by trivy (CVE-2026-4800, arbitrary code execution). Transitive — run `pnpm why lodash` and override. |
**Fix:** bump `vitest`→`^3` (org-wide; also resolves the vite/lodash transitive chain), bump
`drizzle-orm`→`^0.45.2` (re-run the 17 RLS tests after — minor-version API check), add a pnpm
`overrides` block for any stragglers. Note `drizzle-kit` may need a matching bump.

## 6) DB-import guard — PASS (exit 0)
`scripts/check-db-imports.mjs` confirms no raw DB-client imports leak outside allowed paths — the
ADR-0006 "RLS-aware access only" invariant holds in code. Good.

---

## Phase verdict
- **Phase 0/1/1.5/1.6/2 work products are present and internally consistent** with the docs.
- The repo is **ready to continue to Phase 3** *after* the foundation defects above are fixed and the
  **live Supabase RLS gate** is run (ADR-0007 — currently the gating item, see `RLS_VALIDATION_REPORT.md`).
- Treat the four failing gates as a **"Phase 2.x hardening"** checklist (see `ACTION_PLAN.md`), not a
  redesign.
