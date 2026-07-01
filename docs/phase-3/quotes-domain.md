# Phase 3 — Quotes Domain

## Tables (contracts/01 B7/B8; Phase 3)
- **quotes:** id `qte_`, order_id→orders, customer_id→customer_profiles, org_id, status (9-state), version, currency,
  subtotal/service_fee/delivery_fee/estimated_tax/inspection_fee/discount/total **_minor (integer)**, requires_approval,
  expires_at?, approved_by/at?, sent_at?, accepted_at?, declined_at?, decline_reason?, **internal_notes? (staff-only)**,
  customer_message?, timestamps. Unique(order_id, version). Indexes: order, (org,status,created), customer, expires.
- **quote_line_items:** id `qli_`, quote_id, kind (8), description, quantity, unit_amount_minor, total_amount_minor,
  currency, taxable, **customer_visible / internal_only**, metadata.
- **quote_status_history:** id `qsh_`, quote_id, from/to status, actor, role, reason, created_at.
- **quote_approvals:** id `qap_`, quote_id, approver_id, decision (approve/reject/request_changes), reason, metadata.

## Money
Integer **minor units** only. `calculateQuoteTotals` recomputes category subtotals + `total_minor = Σ customer-visible
non-internal line items`. Currency consistent within a quote (enforced). Negatives only for `discount`/`adjustment`.
