# Phase 2 — Order Domain

## Entities (contracts/01 B4/B5; Phase 2 subset)
**orders:** id `ord_`, order_ref `BP-####` (unique), customer_id→customer_profiles, org_id, service_type
(buy_for_me|package_reception|local_pickup|business_delivery), status (25-state), purpose?, declared_value
(Money jsonb), risk_band?, current_quote_id?, delivery/hub_address_id?, correlation_id (=id), workflow_run_id?,
submitted_at?, cancelled_reason?, timestamps. **No `rfc`/PII column yet (KMS-gated).**
**order_items:** id `itm_`, order_id→orders, description, product_url?, quantity, variant?, unit_value (Money),
category?, restriction_flags?.

## Indexes
orders: unique(order_ref), customer_id, (org_id,status,created_at), correlation_id, (org_id,risk_band).
order_items: order_id.

## Services (BFF, server actions)
Customer (owner, `withTenant`): createOrder, updateDraftOrder (draft/missing_information only), submitOrder
(validate → `transitionOrder` draft→submitted), listMyOrders, getMyOrder.
Admin (role, `withTenant`): adminListOrders, adminGetOrder, advanceOrder (ops_manager/super_admin → seam),
holdOrder (audit-only placeholder).

## Money / events
Money = integer minor units + currency (jsonb). Domain events via `emitOrderEvent` **placeholder** (no bus yet).
