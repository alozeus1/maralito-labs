# ADR 0003 — Security-gated CI (gitleaks, semgrep, osv-scanner, pnpm audit)

- **Status:** Accepted · **Date:** 2026-06-29 · **Phase:** 0

## Context
CI must block insecure changes from day one without paid security platforms in MVP.

## Decision
GitHub Actions pipeline with **blocking** gates:
- **Quality:** typecheck → lint → format check → unit (Vitest) → build.
- **Security (free OSS):** **gitleaks** (secret scanning) · **semgrep** (SAST) · **osv-scanner** (dependency vulnerabilities) · **pnpm audit** (dependency audit baseline).
- Phase 1+ adds (wired as stubs now): migration check on Supabase branch, integration + **tenant-isolation** (blocking), e2e (Playwright), AI eval/regression (prohibited false-clear = 0), IaC scan (checkov/tfsec) once `infra/` exists.

## Rationale
- All four tools are free/OSS; no paid security-platform dependency (per Phase 0 constraint).
- Secret scanning + SAST + dependency scanning cover the highest-value MVP risks.
- OIDC short-lived creds; protected `main`; actions to be pinned by SHA (hardening note).

## Consequences
- semgrep `--config auto` / OWASP rulesets may need tuning to reduce noise (Phase 1).
- Tenant-isolation + AI-eval gates are placeholders until those layers exist.

## Alternatives considered
- Paid platforms (Snyk/SonarCloud/etc.): deferred — not needed for MVP baseline.
