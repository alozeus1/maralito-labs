# Phase 3 — Quote State Machine

9 statuses: draft, pending_finance_approval, approved, sent_to_customer, accepted, declined, expired, cancelled, superseded.
Pure helpers in `apps/borderpass/src/domain/quotes/state-machine.ts`:
`canTransitionQuoteStatus(from,to,actorRole)`, `getNextAllowedQuoteStatuses`, `getCustomerVisibleQuoteStatus`,
`isTerminalQuoteStatus`, `canEditQuote`, `canCustomerAcceptQuote`, `canCustomerDeclineQuote`, `assertQuoteTransition`.

## Role-gated transitions (actor classes: customer / staff / finance / system)
- draft → pending_finance_approval (staff) · approved (finance, skip-approval) · cancelled (staff)
- pending_finance_approval → approved (finance) · draft (finance reject/request_changes) · cancelled (staff/finance)
- approved → sent_to_customer (staff) · cancelled (staff) · superseded (staff)
- sent_to_customer → accepted (customer) · declined (customer) · expired (system) · cancelled (staff) · superseded (staff)
- declined/expired → superseded (staff, re-quote) · accepted/cancelled/superseded → terminal

**Single mutation seam `transitionQuote`** (privileged + audited): asserts legality, updates status + timestamps,
writes `quote_status_history`, emits the matching event placeholder. Authorization checked by the caller first.
Tested: 10 checks (legal/illegal/role gating, helpers, customer accept/decline incl. expired, order-cascade legality).
