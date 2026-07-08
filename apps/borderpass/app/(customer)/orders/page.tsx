// Phase 8A.3: customer orders list — mobile card list over the existing RLS-scoped
// listMyOrders read model. No PII/address/RFC/KYC; status labels are humanized keys.
import Link from 'next/link';
import { PageMain } from '../../_components/PageMain';
import { listMyOrders } from '../../actions/orders';
import { formatDate, humanizeStatus } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const res = await listMyOrders();
  const orders = res.ok ? (res.data ?? []) : null;

  return (
    <PageMain variant="wide">
      <h1 className="font-heading text-2xl sm:text-3xl">Your orders</h1>

      {orders === null && (
        <p className="text-on-surface-variant mt-3">
          Orders aren&apos;t available right now — please try again shortly.
        </p>
      )}

      {orders?.length === 0 && (
        <p className="text-on-surface-variant mt-3">
          No orders yet. Your orders will appear here once created.
        </p>
      )}

      <ul className="mt-4 grid gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {orders?.map((o) => (
          <li key={o.id}>
            <Link
              href={`/orders/${o.id}/quote`}
              className="border-outline hover:border-primary/60 focus-visible:ring-primary block h-full rounded-lg border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{o.order_ref}</span>
                <span className="text-on-surface-variant text-sm">{formatDate(o.created_at)}</span>
              </div>
              <p className="text-on-surface-variant mt-1 text-sm">
                {humanizeStatus(o.status)} · {humanizeStatus(o.service_type)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </PageMain>
  );
}
