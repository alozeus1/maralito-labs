// Customer payment page (Phase 5, ADR-0011). Protected by the (customer) layout guard.
// Server component: loads the safe payment summary and, only when the order is ready to pay,
// initiates/reuses the Stripe PaymentIntent. ALL UX states + the server-authoritative status
// refresh live in the PaymentConfirm client component. Success is NEVER decided here — the Stripe
// webhook remains the trusted source for succeeded/paid.
import { notFound } from 'next/navigation';
import { getMyOrderPaymentSummary, initiateQuotePayment } from '../../../../actions/payments';
import { shouldShowPaymentForm } from '@/domain/payments/display';
import { PaymentConfirm } from './PaymentConfirm';

export const dynamic = 'force-dynamic';

function formatMoney(minor: number, currency: string): string {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100); }
  catch { return `${(minor / 100).toFixed(2)} ${currency}`; }
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="font-heading text-2xl">{title}</h1>
      {children}
      <footer className="mt-10 text-xs text-on-surface-variant">Powered by Maralito Labs</footer>
    </main>
  );
}

export default async function PayPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const res = await getMyOrderPaymentSummary(orderId);
  if (!res.ok) {
    if (res.error.code === 'not_found') notFound();
    return <Shell title="Payment"><p className="mt-2 text-on-surface-variant">{res.error.message}</p></Shell>;
  }
  const s = res.data!;
  const amount = formatMoney(s.amount_due_minor, s.currency);
  const returnHref = `/orders/${orderId}/quote`;
  const returnPath = `/orders/${orderId}/pay`;

  // Obtain a client_secret only when the order is ready to pay (Phase 4 idempotent initiate/reuse).
  let clientSecret: string | null = null;
  let paymentsConfigured = false;
  if (shouldShowPaymentForm(s.display_state)) {
    const init = await initiateQuotePayment({ quote_id: s.quote.quote_id });
    if (init.ok && init.data?.client_secret) { clientSecret = init.data.client_secret; paymentsConfigured = true; }
  }

  return (
    <Shell title="Payment">
      {shouldShowPaymentForm(s.display_state) && (
        <p className="mt-1 text-on-surface-variant">Amount due: <span className="font-semibold">{amount}</span></p>
      )}
      <PaymentConfirm
        orderId={orderId}
        initialState={s.display_state}
        clientSecret={clientSecret}
        amountLabel={amount}
        returnPath={returnPath}
        returnHref={returnHref}
        paymentsConfigured={paymentsConfigured}
      />
    </Shell>
  );
}
