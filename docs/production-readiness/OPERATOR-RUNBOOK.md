# BorderPass — Operator Runbook: Wrapping Up for Production

> **Who:** Godwill (owner/operator). **Where:** your Mac + external dashboards.
> **Why this exists:** the agent sandbox cannot run `pnpm`, `drizzle-kit`, `vitest`, or `next`, and has
> no credentials. Everything below is the work that *must* happen on your side.
>
> **Rule for every stage: if a step fails, STOP at that stage.** Do not proceed to the next stage.
> Later stages assume earlier ones passed.

---

## Stage 0 — Get the code committed safely (30–60 min)

Your working tree currently contains **BorderPass production-readiness work mixed with unrelated
projects** (`studio-os/`, `ai-operating-system/`, `packages/aios/`, `apps/studio-os/`,
`alozeus-digital-studio/`, `.ai/`, `.claude/`, `AGENTS.md`, `CLAUDE.md`). **Do not `git add -A`.**

### 0.1 Branch
```bash
cd ~/Desktop/maralito-labs
git status --short                 # look before you leap
git checkout -b feat/phase-9-production-readiness
```

### 0.2 Install (links the new workspace packages)
```bash
pnpm install
```
Expected: resolves `@maralito/crypto` (new) and updates `pnpm-lock.yaml`.

### 0.3 Stage ONLY the BorderPass work
```bash
git add apps/borderpass packages/db packages/crypto packages/observability \
        scripts .github/workflows docs package.json pnpm-lock.yaml
git status --short                 # confirm nothing unrelated is staged
```

### 0.4 Secret scan before committing
```bash
git diff --cached | grep -Ei "sk_live_|whsec_[A-Za-z0-9]{20,}|postgresql://[^ ]*:[^ ]*@|eyJ[A-Za-z0-9_-]{20,}\.|AKIA[0-9A-Z]{16}" || echo "CLEAN"
```
**Expected hits — these are intentional FAKE fixtures in redaction tests** (they exist to prove the
redactor strips them): `packages/observability/src/*.test.ts`, `apps/borderpass/src/server/automation-auth.test.ts`.
Anything **outside those files is a real problem — stop and redact.**

> ⚠️ If CI's gitleaks step flags those fixtures, **allowlist the test files** — do not weaken the tests.

### 0.5 Commit in logical chunks
```bash
git commit -m "fix(db): single-source RLS policy registry, fail-closed (D1)"
# then stage/commit the rest in these groups:
#   fix(security): legacy PII path fails closed in production (D3)
#   fix(build): remove server-only from edge-imported rate-limit + add boundary guard (D4)
#   feat(security): rate limiting + security headers/CSP
#   feat(auth): session tracking, 2-device limit, sign-out revocation (flag-gated OFF)
#   feat(obs): real capture seam, structured logging, health checks
#   feat(legal): terms/privacy pages + consent capture
#   docs: production readiness state, runbooks, plans
```

---

## Stage 1 — Generate the 3 missing migrations (30 min) ⚠️ BLOCKING

Three tables have schema + RLS but **no migration**. Nothing works in a fresh database until these exist.

```bash
pnpm --filter @maralito/db db:generate
```

**Review the generated SQL before committing.** It must contain `encrypted_pii`, `user_sessions`, and
`consents` (plus their indexes). It must be **additive only** — no `DROP`, no `DELETE`, no `TRUNCATE`.

```bash
git add packages/db/migrations && git commit -m "feat(db): migrations for encrypted_pii, user_sessions, consents"
```

---

## Stage 2 — Make the build actually pass (1–3 hours) ⚠️ HIGHEST RISK

```bash
pnpm preflight          # should PASS incl. "RLS policy registry in sync (12 files)"
pnpm check:db-imports
pnpm check:client-stripe
pnpm check:server-only  # NEW guard
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build              # ← the risky one
```

### What is most likely to break, and why

1. **`pnpm build` (edge bundle).** `middleware.ts` now imports `src/server/rate-limit.ts`. I verified
   the `server-only` marker problem and removed it, but I could not run a real Next build. If the
   edge bundle complains about that import, the fix is to move the rate-limit call out of middleware
   into the route handlers/server actions instead. **This is the single most likely failure.**
2. **`pnpm test`** now runs suites that never ran before (crypto, observability, sessions, consents,
   automation routes, kms). Some may need small harness fixes.
3. **CSP breaking Stripe Elements.** If the payment form or 3DS breaks, set
   `BORDERPASS_CSP_REPORT_ONLY=true` temporarily, collect reports, then re-enforce.

Then push and get CI green:
```bash
git push -u origin feat/phase-9-production-readiness
```
Open the PR. **CI must be green before anything below.**

---

## Stage 3 — Re-verify the fixes against the dev-gate project (1 hour)

Your existing `borderpass-dev-gate` project is almost certainly missing RLS on `addresses`,
`messages`, and the email-events tables (that was defect D1).

```bash
set -a; source .env.local; set +a          # never echo these

# Apply ALL 12 policy files in canonical order
for f in $(node packages/db/src/rls/registry.mjs --list); do
  echo "applying $(basename $f)"; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done

pnpm --filter @maralito/db db:migrate
pnpm gate:rls                               # expect "N passed, 0 failed"
```

**Verify D1 is actually closed** — every table should now report `rowsecurity = t`:
```bash
psql "$DATABASE_URL" -c "select tablename, rowsecurity from pg_tables where schemaname='public' and tablename in ('addresses','messages','resend_webhook_events','email_suppressions','encrypted_pii','user_sessions','consents') order by 1;"
```

**Verify D2 live** (replace host; use your real secret from the env, don't paste it anywhere):
```bash
curl -si -X POST https://<preview-host>/api/automation/dispatch-notifications | head -1
# MUST be: HTTP/2 401   ← if you see 307/302 or HTML, D2 has regressed
```

---

## Stage 4 — Stand up production infrastructure (1–2 days, dashboards)

Follow `docs/production-readiness/production-environment-runbook.md`. Order matters:

1. **New Supabase project** — production-only, separate from `borderpass-dev-gate`. Enable PITR/backups.
   Apply migrations → **all 12** RLS files (use `registry.mjs --list`) → grants → `gate:rls`.
   **Do not seed synthetic data.**
2. **Vercel Production** environment + domain. Set `BORDERPASS_ENV=production`.
3. **Upstash Redis** → set `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
   `BORDERPASS_RATE_LIMIT_SALT`. **Until you do this, every rate-limited route returns 429 in
   production — by design (fail-closed).**
4. **Do NOT set `BORDERPASS_KMS_KEY` in Production.** The dev-grade key path now refuses to run there
   anyway (D3 fix), but leaving it unset is the belt-and-braces move.
5. **Sentry** — create the project, set `SENTRY_DSN`, and add an `instrumentation.ts` that calls
   `initObservability()` (it is not called anywhere yet).
6. **Backup/restore drill** — actually restore once, before real customer data exists.

---

## Stage 5 — Turn on session enforcement (30 min, staged)

Full detail in `docs/production-readiness/session-policy.md` §11.

1. Deploy with the flag **unset**. Confirm login still works and `user_sessions` rows appear.
2. Set `BORDERPASS_SESSION_ENFORCEMENT=on` **on staging only**.
3. Verify: login creates a row · **stay logged in >1 hour without being kicked out** (this is the
   critical check — session identity is the JWT `session_id` claim) · a 3rd device evicts the oldest ·
   sign-out revokes.
4. Only then set it in production.
5. **Rollback = unset the variable and restart.** Instant.

---

## Stage 6 — Legal, then PII, then money (owner + counsel)

**This order is deliberate. Do not reorder it.**

1. **Counsel reviews** `/terms` and `/privacy`. They are templates with `[ ... ]` placeholders
   (entity, governing law, liability, prohibited items, retention, ARCO procedure).
   ⚠️ **`/privacy` states PII is encrypted at rest — that is only true after step 2. Do not publish it first.**
2. **AWS KMS** — create the key + IAM + CloudTrail, run gates G1–G4 in
   `docs/production-readiness/kms-production-plan.md`, then migrate `addresses.ts` off the legacy path
   onto `pii-vault.ts`. **Only then may real PII be stored.**
3. **Real notification recipients** — needs #1 (consent) + #2 (PII). Then activate the n8n workflows.
4. **Stripe LIVE (ledger row 15) — LAST.** Work through
   `docs/production-readiness/stripe-live-checklist.md`. Smallest possible real charge, then refund it.

---

## Stage 7 — Go-live gate

Add a Phase-9 section to `docs/phase-7/gate-ledger.md` with a row per production gate, record real
evidence for each, and sign off. Then **soft-launch**: a handful of real orders, watched closely,
before any marketing.

---

## Quick reference — what blocks what

```
Stage 0-2 (commit, migrate, build+CI)   ← do this first, it blocks everything
        ↓
Stage 3 (re-verify D1/D2 on dev-gate)
        ↓
Stage 4 (production infra)  ──→  Stage 5 (session enforcement)
        ↓
Stage 6.1 legal review
        ↓
Stage 6.2 AWS KMS  ──→  real PII allowed
        ↓
Stage 6.3 real notifications
        ↓
Stage 6.4 Stripe LIVE  ← money last
        ↓
Stage 7 sign-off → soft launch
```

**Realistic timeline:** Stages 0–3 in a focused day or two. Stages 4–7 gated mostly by external lead
times (Stripe business verification, counsel review), not by engineering.
