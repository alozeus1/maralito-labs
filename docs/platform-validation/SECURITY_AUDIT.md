# Security Audit — maralito-labs

> **Validated:** 2026-06-30 · Scanners installed via Homebrew and run locally:
> gitleaks 8.18.4, semgrep 1.168.0, trivy 0.72.0, plus `pnpm audit`. Raw output:
> `_evidence/security-scan.log`. Manual code review of auth/RLS/secrets boundaries included.

## Scanner results
| Scanner | Scope | Result |
|---------|-------|--------|
| **gitleaks** `detect --config .gitleaks.toml` | full history + tree | ✅ **No leaks found** |
| **semgrep** `p/typescript p/react p/secrets p/owasp-top-ten` | 547 files, 138 rules | ✅ **0 findings (0 blocking)** |
| **trivy** `fs --scanners vuln,secret,misconfig` (HIGH/CRITICAL) | repo (excl. node_modules) | ⚠️ **2 HIGH vuln, 0 secrets, 0 misconfig** |
| **pnpm audit** `--audit-level=high` | dependency tree | ⚠️ **9 vulns (1 crit / 2 high / 6 mod)** |

### trivy HIGH findings (dependency CVEs)
| Library | CVE | Installed | Fixed | Status |
|---------|-----|-----------|-------|--------|
| `lodash` | CVE-2026-4800 | 4.17.21 | 4.18.0 | transitive — override |
| `drizzle-orm` | CVE-2026-39356 | 0.33.0 | 0.45.2 | **production-relevant**, bump |

Full dependency-CVE breakdown and remediation is in `PHASE_READINESS_REPORT.md §5` and tracked in
`GAP_ANALYSIS.md`. No hardcoded secrets, no IaC misconfigurations detected (there is no IaC yet).

## Manual review — findings
Reviewed against the master checklist. Legend: ✅ good · 🟡 partial/by-design-pending · ⛔ gap ·
🔌 not implemented yet (future phase) · 🔴 live-infra-required.

| Area | Status | Evidence / Notes |
|------|:------:|------------------|
| Committed secrets | ✅ | gitleaks clean; `.env.example` is names-only; `.gitignore` covers env files |
| `.env.example` present + documented | ✅ | root + app-level; 48 keys; server-only vs `NEXT_PUBLIC_*` clearly separated |
| Service-role key exposure | ✅ | `packages/auth/src/supabase/service.ts` + db `withServiceRole` are `import 'server-only'`; key never `NEXT_PUBLIC_*`. `check:db-imports` guard enforces this in CI |
| Supabase anon/service boundary | ✅ | distinct `browser.ts` (anon) vs `server.ts`/`service.ts` clients; documented in `rls-strategy.md` |
| RLS double-enforcement | ✅ (mech.) / 🔴 (live) | `withTenant` (RBAC + `set local role authenticated` + JWT claims) proven on PGlite (17 tests). **Live Supabase pooler verification still required** — see `RLS_VALIDATION_REPORT.md` |
| `withTenant` fail-closed | ✅ | aborts the txn if the `authenticated` role can't be assumed (no silent RLS bypass) |
| Audit logging | ✅ (design+code) | `apps/borderpass/src/server/audit.ts`; policy: append-only / compliance-scoped reads. Append-only enforcement at DB level should be re-verified in the live gate |
| Insecure API routes / admin route protection | 🟡 | route groups `(admin)` + middleware exist; RBAC guards in `@maralito/auth`. **No business API route handlers yet** at this phase — re-audit when added (Phase 3+) |
| Weak RBAC enforcement | ✅ | 9-role model + permission matrix, 6 passing unit tests; enforced app-side, mirrored by RLS |
| Rate limiting | 🔌 | Upstash Redis envs present (`UPSTASH_REDIS_REST_*`) but limiter **not implemented**. Add before public endpoints / auth + webhook routes |
| Webhook signature verification | 🔌 | Stripe (`STRIPE_WEBHOOK_SECRET`) + Twilio (`TWILIO_WEBHOOK_SECRET`) envs reserved; `@maralito/payments` is a placeholder (`phase6`) — **not implemented**. Mandatory before billing is "ready" |
| Unsafe logging of tokens/PII | ✅ | `@maralito/observability.redact()` masks `pass/token/secret/api_key/authorization/cookie/card/cvv/ssn/rfc/kyc/document/file` recursively. Ensure all log sinks route through it |
| Prompt-injection risk (AI) | 🟡 (design) | Blueprint mandates "untrusted content is data, not instructions" + tool-scoping + gateway guardrails. `@maralito/ai` is a placeholder (`phase11`) — **enforce in code when built**; add eval gate (prohibited false-clear = 0) |
| AI tool-permission risk | 🟡 (design) | Least-privilege, agent = principal ≤ the human it assists, human-in-the-loop on risk/payment/refund. Structural (orchestrator inserts `approval` step). Verify when implemented |
| MFA for admin/finance/compliance | 🟡 | Required by security baseline (Phase 1+). Supabase MFA enforcement to confirm in live env |
| KMS field encryption | 🟡 | `MARALITO_KMS_*` envs reserved; encryption-at-field documented, implementation pending |
| CORS | 🟡 | Next.js same-origin BFF default; no permissive CORS found. Re-check when public APIs added |

## CI security posture
`.github/workflows/ci.yml` already runs **gitleaks + semgrep + pnpm audit + osv-scanner** as blocking
jobs — this matches the local scanners and is a strong DevSecOps baseline. Hardening TODOs noted in
the workflow itself: pin actions by commit SHA, protect `main`, require all gates, OIDC short-lived
cloud creds, add IaC scan (checkov/tfsec) once `infra/` exists.

## Security verdict
**Code-level security posture is strong** (clean secret + SAST scans, real RLS mechanism, server-only
service keys, PII redaction, governed-AI design). The open items are: **(1)** dependency CVEs
(esp. `drizzle-orm`), **(2)** rate limiting not yet implemented, **(3)** webhook verification not yet
implemented (placeholder phase), and **(4)** the **live Supabase RLS gate** has not been executed —
so data-isolation safety is *proven in mechanism* but **NOT FULLY VALIDATED — LIVE SUPABASE REQUIRED**.
Do not claim "tenant isolation is production-safe" until that gate runs green.
