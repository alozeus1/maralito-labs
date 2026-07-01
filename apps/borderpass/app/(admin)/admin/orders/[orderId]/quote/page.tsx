// Protected by (admin) guard. Phase 3 (quote) + Phase 5 READ-ONLY payment + Phase 6 inspection/delivery panels.
// Payment stays read-only (no payment ops). Inspection/delivery are staff read/write via existing actions.
import { getOrderPaymentForStaff } from '../../../../../actions/admin-payments';
import { getOrderInspectionForStaff } from '../../../../../actions/admin-inspections';
import { getOrderDeliveryForStaff } from '../../../../../actions/admin-delivery';
import { paymentStatusLabel } from '@/domain/payments/copy';
import { InspectionPanel } from './InspectionPanel';
import { DeliveryPanel } from './DeliveryPanel';

export const dynamic = 'force-dynamic';

function formatMoney(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

export default async function AdminOrderQuotePage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const res = await getOrderPaymentForStaff(orderId);
  const pay = res.ok ? res.data! : null;
  const inspRes = await getOrderInspectionForStaff(orderId);
  const inspection = inspRes.ok ? (inspRes.data ?? null) : null;
  const delRes = await getOrderDeliveryForStaff(orderId);
  const delivery = delRes.ok ? (delRes.data ?? null) : null;

  return (
    <main className="p-6">
      <h1 className="font-heading text-2xl">Order quote</h1>
      <p className="text-on-surface-variant mt-2">
        Create/edit draft, submit for approval, send (Phase 3 foundation).
      </p>

      <section className="border-outline mt-6 rounded-lg border p-4">
        <h2 className="font-medium">Payment (read-only)</h2>
        {!pay ? (
          <p className="text-on-surface-variant mt-1">
            {res.ok ? 'No payment information.' : 'Payment status unavailable.'}
          </p>
        ) : (
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">Status</dt>
              <dd className="font-medium">{paymentStatusLabel(pay.display_state)}</dd>
            </div>
            {pay.amount_minor != null && pay.currency && (
              <div className="flex justify-between">
                <dt className="text-on-surface-variant">Amount</dt>
                <dd>{formatMoney(pay.amount_minor, pay.currency)}</dd>
              </div>
            )}
            {pay.payment_id && (
              <div className="flex justify-between">
                <dt className="text-on-surface-variant">Payment ref</dt>
                <dd className="font-mono text-xs">{pay.payment_id}</dd>
              </div>
            )}
            {pay.updated_at && (
              <div className="flex justify-between">
                <dt className="text-on-surface-variant">Updated</dt>
                <dd>{new Date(pay.updated_at).toLocaleString()}</dd>
              </div>
            )}
          </dl>
        )}
      </section>

      <InspectionPanel orderId={orderId} inspection={inspection} />
      <DeliveryPanel orderId={orderId} delivery={delivery} />
    </main>
  );
}
