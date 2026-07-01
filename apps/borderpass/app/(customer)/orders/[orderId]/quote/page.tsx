// Protected by (customer) guard. Phase 3 placeholder (quote view/accept/decline) + Phase 5 READ-ONLY
// payment status (own order only). No payment mutation here — paying happens on the /pay page.
import { getMyOrderPaymentSummary } from '../../../../actions/payments';
import { getMyOrderInspection } from '../../../../actions/inspections';
import { getMyOrderDelivery } from '../../../../actions/delivery';
import { paymentStatusLabel } from '@/domain/payments/copy';
import { shouldShowPaymentForm } from '@/domain/payments/display';
import { inspectionStatusLabel } from '@/domain/inspections/copy';
import { deliveryPrepStatusLabel } from '@/domain/delivery/copy';

export const dynamic = 'force-dynamic';

export default async function CustomerOrderQuotePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const res = await getMyOrderPaymentSummary(orderId);
  const summary = res.ok ? res.data! : null;
  const inspRes = await getMyOrderInspection(orderId);
  const inspection = inspRes.ok ? (inspRes.data ?? null) : null;
  const delRes = await getMyOrderDelivery(orderId);
  const delivery = delRes.ok ? (delRes.data ?? null) : null;

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="font-heading text-2xl">Quote</h1>
      <p className="mt-2 text-on-surface-variant">Itemized quote + accept/decline (Phase 3 foundation).</p>

      {summary && (
        <section className="mt-6 rounded-lg border border-outline p-4">
          <h2 className="font-medium">Payment status</h2>
          <p className="mt-1">{paymentStatusLabel(summary.display_state)}</p>
          {shouldShowPaymentForm(summary.display_state) && (
            <a href={`/orders/${orderId}/pay`} className="mt-3 inline-block text-primary underline">Go to payment</a>
          )}
        </section>
      )}

      {inspection && (
        <section className="mt-4 rounded-lg border border-outline p-4">
          <h2 className="font-medium">Inspection</h2>
          <p className="mt-1">{inspectionStatusLabel(inspection.status)}</p>
          {inspection.customer_summary && <p className="mt-1 text-sm text-on-surface-variant">{inspection.customer_summary}</p>}
        </section>
      )}

      {delivery && (
        <section className="mt-4 rounded-lg border border-outline p-4">
          <h2 className="font-medium">Delivery</h2>
          <p className="mt-1">{deliveryPrepStatusLabel(delivery.status)}</p>
          {delivery.customer_summary && <p className="mt-1 text-sm text-on-surface-variant">{delivery.customer_summary}</p>}
          {delivery.scheduled_window_start && delivery.scheduled_window_end && (
            <p className="mt-1 text-sm text-on-surface-variant">Window: {new Date(delivery.scheduled_window_start).toLocaleString()} – {new Date(delivery.scheduled_window_end).toLocaleString()}</p>
          )}
        </section>
      )}
      <footer className="mt-10 text-xs text-on-surface-variant">Powered by Maralito Labs</footer>
    </main>
  );
}
