import type { OrderStatus } from './state-machine';

/** Human-facing order ref BP-#### (dev generator; collision-checked at insert by unique index). */
export function orderRef(): string {
  return `BP-${Math.floor(1000 + Math.random() * 9000)}`;
}

export interface OrderForSubmit {
  status: OrderStatus;
  purpose?: string | null;
  declaredValue?: { amount_minor: number; currency: string } | null;
  serviceType: string;
  itemCount: number;
  deliveryAddressId?: string | null;
  hubAddressId?: string | null;
}

/** Submit-rule check (PRD 08 subset). Returns missing-field keys; empty = ok to submit. */
export function submitMissingFields(o: OrderForSubmit): string[] {
  const missing: string[] = [];
  if (o.status !== 'draft' && o.status !== 'missing_information') missing.push('status_not_submittable');
  if (o.itemCount < 1) missing.push('items');
  if (!o.purpose) missing.push('purpose');
  if (!o.declaredValue || o.declaredValue.amount_minor <= 0) missing.push('declared_value');
  if (o.serviceType === 'package_reception' && !o.hubAddressId) missing.push('hub_address');
  if ((o.serviceType === 'buy_for_me' || o.serviceType === 'local_pickup' || o.serviceType === 'business_delivery') && !o.deliveryAddressId)
    missing.push('delivery_address');
  return missing;
}
