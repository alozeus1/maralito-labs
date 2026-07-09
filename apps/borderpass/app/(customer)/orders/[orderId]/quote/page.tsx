// Customer order detail: journey + quote + payment/inspection/delivery status (own order only;
// RLS-scoped). Stitch concierge styling. READ-ONLY — no payment mutation here; paying happens on
// the /pay page and `paid` remains webhook-driven. Internal notes are never projected.
import Link from 'next/link';
import type { Route } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ConciergeCard } from '../../../../_components/ConciergeCard';
import { StatusChip, statusTone } from '../../../../_components/StatusChip';
import { JourneyTimeline } from '../../../../_components/JourneyTimeline';
import { getMyOrder } from '../../../../actions/orders';
import { getMyOrderQuote } from '../../../../actions/quotes';
import { getMyOrderPaymentSummary } from '../../../../actions/payments';
import { getMyOrderInspection } from '../../../../actions/inspections';
import { getMyOrderDelivery } from '../../../../actions/delivery';
import { paymentStatusLabel } from '@/domain/payments/copy';
import { shouldShowPaymentForm } from '@/domain/payments/display';
import { inspectionStatusLabel } from '@/domain/inspections/copy';
import { deliveryPrepStatusLabel } from '@/domain/delivery/copy';
import { orderJourney } from '@/domain/orders/journey';
import { formatDate, formatDateTime, formatMoneyMinor, humanizeStatus } from '@/lib/format';
import { getLocale } from '@/server/locale';
import { getMessages } from '@/i18n';
import { isKmsConfigured } from '@/server/kms';
import { SubmitRequest } from './SubmitRequest';
import { QuoteDecision } from './QuoteDecision';
import { StatusTracker } from './StatusTracker';

// Fixed happy-path step lists for the read-only sub-trackers (sub-status machines: ADR-0012).
const INSPECTION_STEPS = ['scheduled', 'in_progress', 'passed'] as const;
const DELIVERY_STEPS = ['pending', 'preparing', 'ready', 'scheduled', 'handed_off'] as const;

export const dynamic = 'force-dynamic';

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
  const M = getMessages(await getLocale());
  const m = M.orderDetail;

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
    <main className="px-margin-mobile py-md md:py-lg mx-auto max-w-2xl">
      <Link
        href={'/orders' as Route}
        className="text-on-surface-variant hover:text-on-surface mb-4 inline-flex items-center gap-1 text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {M.nav.orders}
      </Link>

      <div className="mb-md">
        <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg text-on-surface">
          {order ? order.orderRef : 'Order'}
        </h1>
        {order ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusChip tone={statusTone(order.status)}>{humanizeStatus(order.status)}</StatusChip>
            <span className="text-on-surface-variant text-body-md">
              {humanizeStatus(order.serviceType)} · {m.opened} {formatDate(order.createdAt)}
            </span>
          </div>
        ) : (
          <p className="text-on-surface-variant text-body-md mt-2">
            Order details aren’t available right now.
          </p>
        )}
      </div>

      <div className="space-y-md">
        {order && (
          <ConciergeCard title={m.journey}>
            <JourneyTimeline
              journey={orderJourney(order.status)}
              labels={m.milestones}
              inProgressLabel={m.inProgress}
            />
          </ConciergeCard>
        )}

        {order && (order.status === 'draft' || order.status === 'missing_information') && (
          <SubmitRequest
            orderId={orderId}
            serviceType={order.serviceType}
            kmsConfigured={isKmsConfigured()}
          />
        )}

        {quote && (
          <ConciergeCard
            title={m.quote}
            action={
              <StatusChip tone={quote.quote.status === 'declined' ? 'error' : 'active'}>
                {humanizeStatus(quote.quote.status)}
              </StatusChip>
            }
          >
            {quote.line_items.length > 0 && (
              <ul className="text-body-md space-y-1">
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
            <dl className="border-outline-variant/60 text-body-md mt-3 space-y-1 border-t pt-3">
              {fees
                .filter(([, v]) => v !== 0)
                .map(([label, v]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-on-surface-variant">{label}</dt>
                    <dd>{formatMoneyMinor(v, quote.quote.currency)}</dd>
                  </div>
                ))}
              <div className="text-on-surface flex justify-between gap-3 pt-1 font-semibold">
                <dt>{m.total}</dt>
                <dd>{formatMoneyMinor(quote.quote.total_minor, quote.quote.currency)}</dd>
              </div>
            </dl>
            {quote.quote.expires_at && (
              <p className="text-on-surface-variant mt-2 text-sm">
                {m.validUntil} {formatDate(quote.quote.expires_at)}
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
              <p className="text-on-surface-variant mt-3 text-sm">{m.declined}</p>
            )}
          </ConciergeCard>
        )}

        {summary && (
          <ConciergeCard title={m.payment}>
            <p className="text-body-md">{paymentStatusLabel(summary.display_state)}</p>
            {shouldShowPaymentForm(summary.display_state) && (
              <Link
                href={`/orders/${orderId}/pay` as Route}
                className="bg-primary text-on-primary btn-tactile hover:bg-primary-container hover:text-on-primary-container focus-visible:ring-primary mt-3 inline-block rounded-full px-6 py-3 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                {m.pay} {formatMoneyMinor(summary.amount_due_minor, summary.currency)}
              </Link>
            )}
          </ConciergeCard>
        )}

        {inspection && (
          <ConciergeCard title={m.inspection}>
            <p className="text-body-md">{inspectionStatusLabel(inspection.status)}</p>
            <StatusTracker steps={INSPECTION_STEPS} current={inspection.status} />
            {inspection.scheduled_for && (
              <p className="text-on-surface-variant mt-2 text-sm">
                Scheduled for {formatDateTime(inspection.scheduled_for)}
              </p>
            )}
            {inspection.customer_summary && (
              <p className="text-on-surface-variant mt-1 text-sm">{inspection.customer_summary}</p>
            )}
          </ConciergeCard>
        )}

        {delivery && (
          <ConciergeCard title={m.delivery}>
            <p className="text-body-md">{deliveryPrepStatusLabel(delivery.status)}</p>
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
          </ConciergeCard>
        )}

        {!quote && !summary && order && (
          <ConciergeCard>
            <p className="text-on-surface-variant text-body-md">{m.noQuote}</p>
          </ConciergeCard>
        )}
      </div>

      <footer className="text-on-surface-variant mt-10 text-xs">Powered by Maralito Labs</footer>
    </main>
  );
}
