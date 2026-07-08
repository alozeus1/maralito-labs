// Customer payment page (Phase 5, ADR-0011). Protected by the (customer) layout guard.
// Server component: loads the safe payment summary and, only when the order is ready to pay,
// initiates/reuses the Stripe PaymentIntent. ALL UX states + the server-authoritative status
// refresh live in the PaymentConfirm client component. Success is NEVER decided here — the Stripe
// webhook remains the trusted source for succeeded/paid.
import Link from 'next/link';
import type { Route } from 'next';
import { notFound } from 'next/navigation';
import { PageMain } from '../../../../_components/PageMain';
import { getMyOrderPaymentSummary, initiateQuotePayment } from '../../../../actions/payments';
import { shouldShowPaymentForm } from '@/domain/payments/display';
import { formatMoneyMinor } from '@/lib/format';
import { PaymentConfirm } from './PaymentConfirm';

export const dynamic = 'force-dynamic';

function Shell({
  title,
  backHref,
  children,
}: {
  title: string;
  backHref?: Route;
  children: React.ReactNode;
}) {
  return (
    <PageMain variant="form">
      {backHref && (
        <Link href={backHref} className="text-on-surface-variant py-2 text-sm underline">
          ← Back to order
        </Link>
      )}
      <h1 className="font-heading mt-2 text-2xl">{title}</h1>
      {children}
      <footer className="text-on-surface-variant mt-10 text-xs">Powered by Maralito Labs</footer>
    </PageMain>
  );
}

export default async function PayPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const res = await getMyOrderPaymentSummary(orderId);
  if (!res.ok) {
    if (res.error.code === 'not_found') notFound();
    return (
      <Shell title="Payment">
        <p className="text-on-surface-variant mt-2">
          Payment details aren&apos;t available right now — please try again shortly.
        </p>
      </Shell>
    );
  }
  const s = res.data!;
  const amount = formatMoneyMinor(s.amount_due_minor, s.currency);
  const returnHref = `/orders/${orderId}/quote`;
  const returnPath = `/orders/${orderId}/pay`;

  // Obtain a client_secret only when the order is ready to pay (Phase 4 idempotent initiate/reuse).
  let clientSecret: string | null = null;
  let paymentsConfigured = false;
  if (shouldShowPaymentForm(s.display_state)) {
    const init = await initiateQuotePayment({ quote_id: s.quote.quote_id });
    if (init.ok && init.data?.client_secret) {
      clientSecret = init.data.client_secret;
      paymentsConfigured = true;
    }
  }

  return (
    <Shell title="Payment" backHref={returnHref as Route}>
      {shouldShowPaymentForm(s.display_state) && (
        <p className="text-on-surface-variant mt-1">
          Amount due: <span className="font-semibold">{amount}</span>
        </p>
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
