# Current Repo Audit — maralito-labs

> **Validated:** 2026-06-30 · **Method:** local inspection + real toolchain runs on this machine
> (darwin, Node v22.22.2, pnpm 9.12.0, turbo 2.10.1). Raw logs in `_evidence/`.

## Verdict (one line)
A **mature, converged, well-architected monorepo at Phase 2** (orders domain). It is the right basis
for the internal golden platform. It **installs cleanly** but **does not currently pass its own
quality gates on a clean checkout** because of small, fixable foundation defects (see
`PHASE_READINESS_REPORT.md`). Do **not** label it "production-ready" yet.

## Package manager & tooling
| Aspect | Value |
|--------|-------|
| Package manager | **pnpm 9.12.0** (`packageManager` pinned), `pnpm-lock.yaml` committed (281 KB) |
| Monorepo | **Turborepo** (`turbo.json`) + pnpm workspaces (`pnpm-workspace.yaml` → `apps/*`, `packages/*`) |
| Node engine | `>=22 <23` (`.nvmrc` = 22) |
| Language | TypeScript everywhere (`tsconfig.base.json`, strict) |
| Formatting/lint | Prettier 3 + ESLint 9 (flat config `eslint.config.mjs`) |

## Workspace layout
```
apps/borderpass/          # the first app — thin Next.js 15 App Router app
packages/                 # the "fat platform" — 11 shared packages
  auth db schemas(validation) observability   # IMPLEMENTED + tested
  payments notifications ai automation          # PLACEHOLDERS (future phases)
  sdk ui config                                 # contracts / shared config
docs/                     # 100+ planning/architecture/security/AI/RLS docs
docs/decisions/adr/       # 8 ADRs (0001–0008)
spike/checkpointer-inngest/  # runnable LangGraph×Inngest durability proof + reference pattern
.github/workflows/ci.yml  # security-gated CI (quality + secret-scan + sast + deps)
scripts/check-db-imports.mjs  # custom guard: blocks raw DB client imports outside allowed paths
```

## Apps
- **`apps/borderpass`** — single Next.js 15 app using App Router route groups (per ADR-0001:
  `(public)(auth)(customer)(admin)`). Real domain logic present: `src/domain/orders/state-machine.ts`
  (25-state machine + tests), `src/server/{audit,auth,auth-events,order-events,order-transitions,provisioning,roles,env,supabase}.ts`.
  Has `middleware.ts`, i18n `messages/`, Tailwind, Playwright + Vitest configs.

## Shared packages — implementation status
| Package | Status | Evidence |
|---------|:------:|----------|
| `@maralito/auth` | ✅ Implemented | RBAC (`rbac/{roles,permissions}.ts` + 6 passing tests), Supabase `browser/server/service` clients, `session.ts`, `errors.ts` |
| `@maralito/db` | ✅ Implemented | Drizzle schema, `client.ts`, `tenant.ts` (`withTenant`/`withServiceRole`), `provisioning.ts`, `rls/policies.sql` + `rls/orders-policies.sql`, **17 passing isolation tests**, `scripts/live-rls-gate.ts` |
| `@maralito/schemas` (validation) | ✅ Implemented | Zod schemas + 9 passing tests |
| `@maralito/observability` | ✅ Implemented | `redact()` PII/secret masking (pure, recursive). ⚠️ test file missing `vitest` devDep |
| `@maralito/payments` | ⛔ Placeholder | `createStripeConfig()` throws `TODO(phase6)` |
| `@maralito/notifications` | ⛔ Placeholder | Resend/Twilio types only, `TODO(phase9)` |
| `@maralito/ai` | ⛔ Placeholder | `Autonomy`/`AgentVerdict` types only, `TODO(phase11)` |
| `@maralito/automation` | ⛔ Placeholder | Inngest config + step-type union only, `TODO(phase10)` |
| `@maralito/sdk` | 🟡 Typed placeholder | Known gap #3 — platform SDK surface |
| `@maralito/ui`, `@maralito/config` | 🟡 Scaffold | UI primitives + shared eslint/tailwind/tsconfig presets |

> Placeholders are **intentional and correct** — they map to future phases (payments=6, automation=10,
> notifications=9, ai=11). The repo is honestly at Phase 2, not pretending to be further.

## Supabase / DB assets
- **Migrations:** `packages/db/migrations/` (Drizzle) + `packages/db/scripts/{db:generate,db:migrate,db:seed}`.
- **RLS policies (SQL):** `packages/db/src/rls/policies.sql` (base, default-deny on every table) +
  `packages/db/src/rls/orders-policies.sql` (orders domain).
- **RLS tests:** `packages/db/tests/{rls.isolation,orders-rls.isolation,provisioning.integration}.test.ts`
  run on **PGlite** (real Postgres semantics, in-process) — 17 tests, all pass locally.
- **Live gate:** `packages/db/scripts/live-rls-gate.ts` — runs the isolation checks against a **real
  Supabase project** (needs `DATABASE_URL` + applied migrations/policies/seed). **Not yet run** — this
  is a declared blocking gate before Phase 2 production (ADR-0007).

## Inngest / LangGraph assets
- **Spike:** `spike/checkpointer-inngest/proof.mjs` (runnable, zero-dep durability proof across two
  Node processes) + `production-pattern.ts` (reference wiring: LangGraph `PostgresSaver` ×
  Inngest `step.waitForEvent`). The AI/automation **packages are placeholders** — orchestration is
  designed and proven-in-spike, not implemented.
- **AI design:** `docs/ai/AI-Agent-Architecture-and-LangGraph-Blueprint.md` (14-agent design, gateway
  governance, human-in-the-loop, guardrails, evals).

## Env, secrets, deployment
- **`.env.example`** present (root + `apps/borderpass/.env.example`), 48 documented keys, names only,
  clear server-only vs `NEXT_PUBLIC_*` separation. **No secrets committed** (gitleaks clean).
- **`.gitleaks.toml`** present; `.gitignore` covers env files.
- **Deployment files:** **No Dockerfile, no Terraform/`infra/`, no `vercel.json`** present. Deployment
  is documented (Vercel + Cloudflare in platform docs) but **not yet codified as IaC** — expected at
  this phase; CI notes IaC scanning "added in Phase 1 once infra/ Terraform exists."

## CI files
`.github/workflows/ci.yml` — 4 jobs, all blocking: **quality** (typecheck, lint, format:check,
db-imports guard, test, build), **secret-scan** (gitleaks), **sast** (semgrep `p/typescript p/react
p/secrets p/owasp-top-ten`), **deps** (`pnpm audit --audit-level=high` + osv-scanner). Strong posture.
Note: CI runs the same gates that currently fail locally → **CI on a clean branch would be red today.**

## Test files inventory
`packages/auth/src/rbac/rbac.test.ts`, `packages/validation/src/{schemas,orders,index}.test.ts`,
`packages/db/tests/*.test.ts` (3), `packages/observability/src/redact.test.ts`,
`apps/borderpass/src/domain/orders/state-machine.test.ts`, `apps/borderpass/tests/` (Playwright e2e).
