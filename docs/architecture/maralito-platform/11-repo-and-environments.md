# 11 · Repo / Folder Structure & Environment Strategy

Covers required outputs **(18)** folder/repo structure and **(19)** environment strategy.

---

## 18 · Repo / folder structure

### 18.1 Monorepo decision

`DECISION:` **Single monorepo** managed with **pnpm workspaces + Turborepo**.
- **Why monorepo:** the platform's value is shared code (SDK, UI kit, types, events). A monorepo gives atomic cross-cutting changes (change a contract + all consumers in one PR), one CI, shared tooling, and easy local dev (**P15**).
- **Why Turborepo + pnpm:** fast, cached task graph; strict, content-addressed installs; good Vercel integration. `⚠️ VERIFY` current Turborepo remote-cache options.
- **Alternative considered — polyrepo:** independent versioning per service, but heavy coordination cost and contract drift; rejected for our team size/stage. We can split a package out later if needed.

### 18.2 Proposed layout

```text
maralito/                         # monorepo root
├─ apps/                          # consuming products (thin layers on the platform)
│  ├─ borderpass/                 # first app
│  │  ├─ app/                     # Next.js App Router
│  │  ├─ src/                     # app domain logic
│  │  ├─ db/                      # BorderPass-OWNED domain schema (Drizzle)
│  │  └─ ...
│  ├─ admin/                      # Maralito internal admin console
│  └─ (future apps...)
│
├─ platform/                      # the platform services (modular monolith)
│  ├─ services/
│  │  ├─ identity/                # S1
│  │  ├─ profile/                 # S2
│  │  ├─ billing/                 # S3
│  │  ├─ notifications/           # S4
│  │  ├─ files/                   # S5
│  │  ├─ ai/                      # S6 (gateway, langgraph, rag, tools)
│  │  ├─ audit/                   # S7
│  │  ├─ analytics/               # S8
│  │  ├─ search/                  # S9
│  │  ├─ api-gateway/             # S10 (gateway, rate limit, versioning, webhooks)
│  │  ├─ localization/            # S11
│  │  ├─ flags/                   # S12
│  │  └─ security/                # S14 (policy, abuse/fraud)
│  ├─ db/                         # PLATFORM schema-per-service (Drizzle migrations)
│  │  ├─ identity/  profile/  billing/  ...   # one schema dir per service
│  └─ events/                     # event definitions + outbox + dispatch
│
├─ packages/                      # shared libraries
│  ├─ sdk/                        # @maralito/sdk — the app↔platform contract
│  ├─ api-client/                 # generated public-API client (OpenAPI)
│  ├─ ui/                         # @maralito/ui — shared React component kit
│  ├─ schemas/                    # @maralito/schemas — Zod schemas (DTOs, events)
│  ├─ types/                      # shared TS types
│  ├─ config/                     # shared tsconfig/eslint/tailwind presets
│  ├─ auth/                       # auth helpers/client wrappers
│  ├─ observability/              # logging/tracing/metrics helpers
│  ├─ i18n/                       # localization runtime
│  └─ testing/                    # test utils, RLS/tenant-isolation harness
│
├─ tooling/
│  ├─ cli/                        # @maralito/cli — scaffolding, codegen, migrations, app registration
│  └─ scripts/                    # repo automation
│
├─ infra/                         # Terraform IaC
│  ├─ modules/                    # reusable modules (db, redis, cdn, dns, secrets)
│  ├─ envs/  ├─ dev/ ├─ staging/ └─ prod/
│  └─ policies/                   # OPA/Conftest policy-as-code
│
├─ docs/                          # this blueprint + ADRs + runbooks
│  ├─ adr/                        # architecture decision records
│  └─ runbooks/                   # incident + DR + rotation runbooks
│
├─ .github/workflows/             # CI/CD pipelines (GitHub Actions)
├─ turbo.json  pnpm-workspace.yaml  package.json
└─ README.md
```

### 18.3 Dependency rules (enforced)

- `apps/*` may depend on `packages/sdk`, `packages/ui`, `packages/schemas`, `packages/i18n`, `packages/types` — **never** on `platform/services/*` internals (**P2**).
- `platform/services/*` may depend on `packages/schemas`, `packages/types`, `packages/observability` — **never** on another service's internals; cross-service interaction is via SDK/events.
- `apps/*` never import another app.
- Enforced by lint rules / import-boundary checks (e.g., dependency-cruiser / ESLint boundaries) in CI `⚠️ VERIFY`.

### 18.4 Shared packages (the reuse engine)

| Package | Purpose |
|---------|---------|
| `@maralito/sdk` | The typed client every app uses to call the platform; injects auth, tenancy, idempotency, tracing, audit |
| `@maralito/schemas` | Zod schemas for DTOs + events — single source of truth for validation & types |
| `@maralito/ui` | Shared React components (theme-able, i18n-aware, accessible) |
| `@maralito/api-client` | Generated client for the public REST API |
| `@maralito/observability` | Logging/tracing/metrics wrappers |
| `@maralito/i18n` | Localization runtime + helpers |
| `@maralito/cli` | Scaffold a new app, register it with the platform, run migrations, codegen |
| `@maralito/testing` | Tenant-isolation + contract test harness |

### 18.5 CLI tooling

`@maralito/cli` accelerates the "new app in < 1 week" goal:
- `maralito new-app <name>` — scaffold an app wired to the SDK with auth/billing/observability defaults.
- `maralito register-app` — create the app record + scoped credentials + enabled-services manifest.
- `maralito db <migrate|branch|reset>` — manage platform/app DB and preview branches.
- `maralito codegen` — regenerate SDK/types/OpenAPI from schemas.
- `maralito gen:service` — scaffold a new platform service module with schema, events, tests, RLS policy stubs.

---

## 19 · Environment strategy

### 19.1 Environments

| Env | Purpose | Data | Lifetime | Deploy trigger |
|-----|---------|------|----------|----------------|
| **Local** | Dev on a laptop | Seeded/synthetic | Per dev | Manual |
| **Preview** | Per-PR validation, review, e2e | Branch DB (synthetic) | Per PR (ephemeral) | On PR |
| **Staging** | Pre-prod integration, smoke/e2e, demos | Prod-like synthetic | Persistent | Merge to `main` |
| **Production** | Real users | Real | Persistent | Gated promotion + progressive |

### 19.2 Local development (P15)

- One command bootstraps the stack: `pnpm dev` brings up Next.js apps + platform via Turborepo.
- **Postgres** locally (Docker) or a personal Neon branch; **Upstash** dev instance or local Redis; provider calls (Stripe/Twilio/Resend/models) use **test modes/sandboxes** behind the gateway, with the option to mock at the SDK boundary.
- Workflow engine local dev server (Inngest/Trigger.dev). AI calls route to cheap/test models or recorded fixtures for deterministic tests.
- `.env` from the secrets manager (no secrets in repo); seed scripts create demo orgs/users.

### 19.3 Preview environments (per PR)

- Vercel preview deployment + **Neon database branch** (instant copy-on-write branch of staging schema) `⚠️ VERIFY` Neon branching limits.
- Migrations + seed run on the branch; e2e (Playwright) runs against the preview URL.
- Each preview is isolated (own DB branch, own flag overrides) and torn down on merge/close.
- This is the backbone of fast, safe review and "ship on day one" (**P15**).

### 19.4 Staging

- Mirrors production topology and config (managed via Terraform variables), with **synthetic data only** (never prod PII).
- Receives every merge to `main` automatically; runs full smoke + e2e + (if AI changed) eval suites.
- Gate before production promotion; also used for demos and partner UAT.

### 19.5 Production

- Promotion from staging is **gated** (required checks + human approval) and **progressive** (canary → percentage → full) via flags.
- Strict secrets, least-privilege access, full observability + alerting + SLOs.
- Separate Terraform state; change management + audit on infra changes.

### 19.6 Environment isolation & config

- **Hard isolation** between environments: separate DBs, secrets, provider accounts/keys (separate Stripe/Twilio/model projects per env) `⚠️ VERIFY` — no shared credentials across envs.
- Config differences are **variables**, not code or manual drift (Terraform + S12 config).
- Promotion path is one-directional (local→preview→staging→prod); no editing prod by hand.

### 19.7 Acceptance criteria (repo & envs)

`ACCEPTANCE:`
- A new engineer can run the full platform locally with one command and seeded data.
- Every PR yields an isolated preview env with its own DB branch and passing e2e.
- Apps cannot import platform service internals (import-boundary check passes).
- Staging never contains production PII; environments use separate provider credentials.
- `maralito new-app` produces an authenticated, billable, observable skeleton.
