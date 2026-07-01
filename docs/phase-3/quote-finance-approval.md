# Phase 3 — Quote Finance Approval

`requiresFinanceApproval(quote, order)` = **true** when: total_minor > `HIGH_VALUE_THRESHOLD_MINOR` ($1,000 placeholder)
OR |discount_minor| > `DISCOUNT_THRESHOLD_MINOR` ($200 placeholder) OR a manual `adjustment` line exists OR order is a
business order (`business_delivery`) OR the staff `requires_approval` flag is set. **Configurable constants** in
`domain/quotes/config.ts` — full rules engine is a later phase (⚠️ VERIFY thresholds with finance).

## Authorized approver roles
`finance_admin`, `operations_manager`, `super_admin` (checked via `isFinance` in the action).

## Actions + records
- `submitQuoteForApproval` — draft → pending_finance_approval (if required) or auto **approved** (system) if not.
- `approveQuote` (finance) — pending → approved; writes `quote_approvals(approve)`.
- `rejectQuote` (finance) — pending → draft; writes `quote_approvals(reject|request_changes)`; **reason required**.
- Separation: **finance approval ≠ customer acceptance** (different roles, different status edges). All audited.
