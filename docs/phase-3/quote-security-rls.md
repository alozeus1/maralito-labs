# Phase 3 — Quote Security & RLS

`packages/db/src/rls/quotes-policies.sql` (default-deny), after policies.sql + orders-policies.sql.

- **quotes:** customer reads quotes for **own orders**; staff read+write (drafts) in org. **Status transitions run via
  the audited privileged seam** (`transitionQuote`/`transitionOrder`) — customers/finance are NOT granted UPDATE on quotes for status.
- **quote_line_items:** customer sees only `customer_visible = true AND internal_only = false` for own quotes; staff see all.
- **quote_status_history / quote_approvals:** **staff-only** read; writes via privileged seam.
- **`internal_notes`** (a quotes column) is hidden from customers by **app projection** (`customerQuoteView`) — RLS is
  row-level and cannot hide a column. The customer read action never selects internal columns.

All tenant ops use `withTenant`; privileged writes (transitions, approvals) use `withPrivilegedDbAccess` (reason + audit).
Raw client blocked (`check:db-imports`). **Verified on real PGlite (6 scenarios) with the real policy files — NOT the
Supabase deployment (live gate PENDING).**
