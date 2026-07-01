# Security — Index

Security + privacy requirements. Canonical sources:

- Auth / RBAC / security / privacy (TAD) → `../architecture/technical-architecture/docs/06-auth-rbac-security-privacy.md`
- Access control, audit & data requirements → `../architecture/contracts/05-access-control-and-data-requirements.md`
- Platform security architecture → `../architecture/maralito-platform/08-security-architecture.md`

**MVP security baseline** (enforced from Phase 1): RBAC + RLS (double enforcement, cross-tenant
fail-closed), MFA for admin/finance/compliance, signed-URL file ACL, no raw card data + webhook
verify, immutable audit, KMS field encryption, PII masking, recommend-only AI, secret scanning,
per-env isolation. **Phase 0** establishes: gitleaks + semgrep + osv-scanner + pnpm audit in CI.
