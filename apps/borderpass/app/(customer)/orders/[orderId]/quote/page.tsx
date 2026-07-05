// Customer order detail: quote + payment/inspection/delivery status (own order only; RLS-scoped).
// Phase 8A.4 mobile polish: order header, itemized quote card (safe projection — internal notes
// never included), formatted money/dates, back links. READ-ONLY — no payment mutation here; paying
// happens on the /pay page and `paid` remains webhook-driven.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMyOrder } from '../../../../actions/orders';
import { getMyOrderQuote } from '../../../../actions/quotes';
import { getMyOrderPaymentSummary } from '../../../../actions/payments';
import { getMyOrderInspection } from '../../../../actions/inspections';
import { getMyOrderDelivery } from '../../../../actions/delivery';
import { paymentStatusLabel } from '@/domain/payments/copy';
import { shouldShowPaymentForm } from '@/domain/payments/display';
import { inspectionStatusLabel } from '@/domain/inspections/copy';
import { deliveryPrepStatusLabel } from '@/domain/delivery/copy';
import { formatDate, formatDateTime, formatMoneyMinor, humanizeStatus } from '@/lib/format';
import { QuoteDecision } from './QuoteDecision';
import { StatusTracker } from './StatusTracker';

// Fixed happy-path step lists for the read-only trackers (sub-status machines: ADR-0012).
// Terminal/side states (failed, on_hold) surface via the status label, not extra steps.
const INSPECTION_STEPS = ['scheduled', 'in_progress', 'passed'] as const;
const DELIVERY_STEPS = ['pending', 'preparing', 'ready', 'scheduled', 'handed_off'] as const;

export const dynamic = 'force-dynamic';

// Minimal safe views over the untyped read-model results (only non-PII fields are read).
interface OrderHeader {
  order: { orderRef: string; status: string; serviceType: string; createdAt: string | Date };
}
interface QuoteView {
  quote: {
    id: string;
    status: string;
    currency: string;
    total_minor: number;
    subtotal_minor: number;
    service_fee_minor: number;
    delivery_fee_minor: number;
    estimated_tax_minor: number;
    inspection_fee_minor: number;
    discount_minor: number;
    expires_at: string | Date | null;
    customer_message: string | null;
  };
  line_items: {
    kind: string;
    description: string;
    quantity: number;
    total_amount_minor: number;
    currency: string;
  }[];
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-outline mt-4 rounded-lg border p-4">
      <h2 className="font-medium">{title}</h2>
      {children}
    </section>
  );
}

export default async function CustomerOrderQuotePage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const [orderRes, quoteRes, payRes, inspRes, delRes] = await Promise.all([
    getMyOrder(orderId),
    getMyOrderQuote(orderId),
    getMyOrderPaymentSummary(orderId),
    getMyOrderInspection(orderId),
    getMyOrderDelivery(orderId),
  ]);
  const order = orderRes.ok ? (orderRes.data as OrderHeader).order : null;
  if (!order && !orderRes.ok && orderRes.error.code === 'not_found') notFound();
  const quote = quoteRes.ok ? (quoteRes.data as QuoteView) : null;
  const summary = payRes.ok ? payRes.data! : null;
  const inspection = inspRes.ok ? (inspRes.data ?? null) : null;
  const delivery = delRes.ok ? (delRes.data ?? null) : null;

  const fees: [string, number][] = quote
    ? [
        ['Subtotal', quote.quote.subtotal_minor],
        ['Service fee', quote.quote.service_fee_minor],
        ['Delivery fee', quote.quote.delivery_fee_minor],
        ['Estimated tax', quote.quote.estimated_tax_minor],
        ['Inspection fee', quote.quote.inspection_fee_minor],
        ['Discount', quote.quote.discount_minor],
      ]
    : [];

  return (
    <main className="mx-auto max-w-md p-6">
      <Link href="/orders" className="text-on-surface-variant py-2 text-sm underline">
        ← Orders
      </Link>
      <h1 className="font-heading mt-2 text-2xl">{order ? order.orderRef : 'Order'}</h1>
      {order ? (
        <p className="text-on-surface-variant mt-1 text-sm">
          {humanizeStatus(order.status)} · {humanizeStatus(order.serviceType)} · Created{' '}
          {formatDate(order.createdAt)}
        </p>
      ) : (
        <p className="text-on-surface-variant mt-2">
          Order details aren&apos;t available right now.
        </p>
      )}

      {quote && (
        <Card title={`Quote — ${humanizeStatus(quote.quote.status)}`}>
          {quote.line_items.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {quote.line_items.map((l, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="text-on-surface-variant">
                    {l.description}
                    {l.quantity > 1 ? ` × ${l.quantity}` : ''}
                  </span>
                  <span>{formatMoneyMinor(l.total_amount_minor, l.currency)}</span>
                </li>
              ))}
            </ul>
          )}
          <dl className="border-outline/40 mt-3 space-y-1 border-t pt-3 text-sm">
            {fees
              .filter(([, v]) => v !== 0)
              .map(([label, v]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-on-surface-variant">{label}</dt>
                  <dd>{formatMoneyMinor(v, quote.quote.currency)}</dd>
                </div>
              ))}
            <div className="flex justify-between gap-3 pt-1 font-medium">
              <dt>Total</dt>
              <dd>{formatMoneyMinor(quote.quote.total_minor, quote.quote.currency)}</dd>
            </div>
          </dl>
          {quote.quote.expires_at && (
            <p className="text-on-surface-variant mt-2 text-sm">
              Valid until {formatDate(quote.quote.expires_at)}
            </p>
          )}
          {quote.quote.customer_message && (
            <p className="text-on-surface-variant mt-2 text-sm">{quote.quote.customer_message}</p>
          )}
          {quote.quote.status === 'quote_ready' && (
            <QuoteDecision
              quoteId={quote.quote.id}
              expiresAt={
                quote.quote.expires_at ? new Date(quote.quote.expires_at).toISOString() : null
              }
            />
          )}
          {quote.quote.status === 'declined' && (
            <p className="text-on-surface-variant mt-3 text-sm">
              You declined this quote. If anything changes, contact us and we&apos;ll prepare a new
              one.
            </p>
          )}
        </Card>
      )}

      {summary && (
        <Card title="Payment">
          <p className="mt-1">{paymentStatusLabel(summary.display_state)}</p>
          {shouldShowPaymentForm(summary.display_state) && (
            <Link
              href={`/orders/${orderId}/pay`}
              className="bg-primary text-on-primary mt-3 inline-block rounded-3xl px-5 py-2.5 font-medium"
            >
              Pay {formatMoneyMinor(summary.amount_due_minor, summary.currency)}
            </Link>
          )}
        </Card>
      )}

      {inspection && (
        <Card title="Inspection">
          <p className="mt-1">{inspectionStatusLabel(inspection.status)}</p>
          <StatusTracker steps={INSPECTION_STEPS} current={inspection.status} />
          {inspection.scheduled_for && (
            <p className="text-on-surface-variant mt-2 text-sm">
              Scheduled for {formatDateTime(inspection.scheduled_for)}
            </p>
          )}
          {inspection.customer_summary && (
            <p className="text-on-surface-variant mt-1 text-sm">{inspection.customer_summary}</p>
          )}
        </Card>
      )}

      {delivery && (
        <Card title="Delivery">
          <p className="mt-1">{deliveryPrepStatusLabel(delivery.status)}</p>
          <StatusTracker steps={DELIVERY_STEPS} current={delivery.status} />
          {delivery.customer_summary && (
            <p className="text-on-surface-variant mt-1 text-sm">{delivery.customer_summary}</p>
          )}
          {delivery.scheduled_window_start && delivery.scheduled_window_end && (
            <p className="text-on-surface-variant mt-1 text-sm">
              Window: {formatDateTime(delivery.scheduled_window_start)} –{' '}
              {formatDateTime(delivery.scheduled_window_end)}
            </p>
          )}
        </Card>
      )}

      {!quote && !summary && order && (
        <p className="text-on-surface-variant mt-4">
          No quote yet — we&apos;ll prepare one for this order and it will appear here.
        </p>
      )}

      <footer className="text-on-surface-variant mt-10 text-xs">Powered by Maralito Labs</footer>
    </main>
  );
}
