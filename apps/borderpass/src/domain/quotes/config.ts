/** Phase 3 placeholder thresholds (configurable constants). Real rules engine = later phase. */
export const HIGH_VALUE_THRESHOLD_MINOR = 100_000; // $1,000.00 — ⚠️ VERIFY w/ finance
export const DISCOUNT_THRESHOLD_MINOR = 20_000;    // $200.00 — ⚠️ VERIFY

export interface ApprovalInput {
  total_minor: number;
  discount_minor: number;
  has_manual_adjustment: boolean;
  service_type: string; // order service_type ('business_delivery' = business order)
  marked_requires_approval: boolean;
}
export function requiresFinanceApproval(q: ApprovalInput): boolean {
  return (
    q.total_minor > HIGH_VALUE_THRESHOLD_MINOR ||
    Math.abs(q.discount_minor) > DISCOUNT_THRESHOLD_MINOR ||
    q.has_manual_adjustment ||
    q.service_type === 'business_delivery' || // "business_order"
    q.marked_requires_approval
  );
}
