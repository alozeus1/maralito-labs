# Phase 3 — Quotes + Finance Approval Foundation (DEV-ONLY, pre-payment)

> Development-only. **No Stripe / no payment capture.** Live Supabase RLS gate remains a release blocker. ADR-0009.

## Flow
Customer submits order → admin drafts quote → (finance approves if required) → quote sent → customer accepts/declines → **accepted = ready for payment in Phase 4**.

## Built
- **Schema:** `quotes`, `quote_line_items`, `quote_status_history`, `quote_approvals` (+ indexes); `quotes-policies.sql`.
- **State machine:** 9 statuses + role-gated transitions; single seam **`transitionQuote`** (writes status history + audit + event).
- **Money:** `calculateQuoteTotals` — deterministic, integer minor units, single currency, negatives only for discount/adjustment.
- **Finance approval:** `requiresFinanceApproval` (threshold/discount/manual-adjustment/business/flag — configurable constants); `quote_approvals` (approve/reject/request_changes, reason required on reject).
- **Admin/finance actions:** create/update draft, add/remove line item, submit, approve, reject, send, cancel, supersede, history, approvals.
- **Customer actions:** listMyQuotes, getMyOrderQuote (safe projection), acceptQuote, declineQuote.
- **Order integration:** sent → order `quote_ready`; accepted → order `awaiting_payment` — **only via `transitionOrder`** (privileged cascade).
- **Audit + event placeholders + protected route placeholders.**

## NOT in Phase 3
Stripe/payment intents/capture, payment records, real PII/KMS, durable workflow engine, real event bus, full UI, quote PDF, notifications.

**Docs:** quotes-domain · quote-state-machine · quote-finance-approval · quote-security-rls · quote-events · order-integration · phase-3-completion-report · phase-4-readiness-checklist · ADR-0009.
