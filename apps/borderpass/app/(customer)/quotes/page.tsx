// Phase 8A.3: customer quotes list — mobile card list over the existing RLS-scoped
// listMyQuotes safe projection (customer-visible status; internal notes never included).
// The pay link only points at the existing /pay page — all payment rules stay server-side there.
import Link from 'next/link';
import { PageMain } from '../../_components/PageMain';
import { listMyQuotes } from '../../actions/quotes';
import { formatDate, formatMoneyMinor, humanizeStatus } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function QuotesPage() {
  const res = await listMyQuotes();
  const quotes = res.ok ? (res.data ?? []) : null;

  return (
    <PageMain variant="wide">
      <h1 className="font-heading text-2xl sm:text-3xl">Your quotes</h1>

      {quotes === null && (
        <p className="text-on-surface-variant mt-3">
          Quotes aren&apos;t available right now — please try again shortly.
        </p>
      )}

      {quotes?.length === 0 && (
        <p className="text-on-surface-variant mt-3">
          No quotes yet. When we prepare a quote for one of your orders, it will appear here.
        </p>
      )}

      <ul className="mt-4 grid gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {quotes?.map((q) => (
          <li key={q.id} className="border-outline flex h-full flex-col rounded-lg border p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">{formatMoneyMinor(q.total_minor, q.currency)}</span>
              <span className="text-on-surface-variant text-sm">{humanizeStatus(q.status)}</span>
            </div>
            {q.expires_at && (
              <p className="text-on-surface-variant mt-1 text-sm">
                Valid until {formatDate(q.expires_at)}
              </p>
            )}
            <div className="mt-auto flex flex-wrap gap-x-4 gap-y-2 pt-3">
              <Link
                href={`/orders/${q.order_id}/quote`}
                className="text-primary py-1 text-sm underline underline-offset-2"
              >
                View details
              </Link>
              {q.status === 'accepted' && (
                <Link
                  href={`/orders/${q.order_id}/pay`}
                  className="text-primary py-1 text-sm font-medium underline underline-offset-2"
                >
                  Go to payment
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </PageMain>
  );
}
