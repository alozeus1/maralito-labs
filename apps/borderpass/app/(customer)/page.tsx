// Phase 8A.3: mobile-first customer dashboard. Reads ONLY existing RLS-scoped read models
// (listMyOrders / listMyQuotes) — safe counts + links, no PII, no session internals.
import Link from 'next/link';
import { listMyOrders } from '../actions/orders';
import { listMyQuotes } from '../actions/quotes';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [ordersRes, quotesRes] = await Promise.all([listMyOrders(), listMyQuotes()]);
  const orders = ordersRes.ok ? (ordersRes.data ?? []) : null;
  const quotes = quotesRes.ok ? (quotesRes.data ?? []) : null;
  const quotesReady = quotes?.filter((q) => q.status === 'quote_ready').length ?? 0;

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="font-heading text-2xl">Home</h1>

      {orders === null && quotes === null ? (
        <p className="text-on-surface-variant mt-3">
          Your account is ready. Data isn&apos;t available right now — please check back shortly.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link href="/orders" className="border-outline block rounded-lg border p-4">
            <span className="font-heading block text-3xl">{orders?.length ?? '—'}</span>
            <span className="text-on-surface-variant mt-1 block text-sm">Orders</span>
          </Link>
          <Link href="/quotes" className="border-outline block rounded-lg border p-4">
            <span className="font-heading block text-3xl">{quotes?.length ?? '—'}</span>
            <span className="text-on-surface-variant mt-1 block text-sm">Quotes</span>
          </Link>
        </div>
      )}

      {quotesReady > 0 && (
        <Link
          href="/quotes"
          className="bg-primary text-on-primary mt-4 block rounded-lg p-4 font-medium"
        >
          {quotesReady === 1 ? 'A quote is ready for review' : `${quotesReady} quotes are ready`} →
        </Link>
      )}

      {orders !== null && orders.length === 0 && (
        <p className="text-on-surface-variant mt-6">
          No orders yet. Your orders will appear here once created.
        </p>
      )}
    </main>
  );
}
