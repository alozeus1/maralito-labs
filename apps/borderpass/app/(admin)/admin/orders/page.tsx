// Staff order triage — real org order list (adminListOrders), Stitch cards linking to each order.
import Link from 'next/link';
import type { Route } from 'next';
import { Package, ChevronRight } from 'lucide-react';
import { StatusChip, statusTone } from '../../../_components/StatusChip';
import { adminListOrders } from '../../../actions/admin-orders';
import { humanizeStatus } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage() {
  const res = await adminListOrders();
  const orders = res.ok ? (res.data ?? []) : null;

  return (
    <main className="px-margin-mobile md:px-margin-desktop max-w-max-width py-md mx-auto">
      <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg mb-md">Orders</h1>

      {orders === null && (
        <div className="bg-surface-container-lowest shadow-level-1 p-lg rounded-xl text-center">
          <p className="text-on-surface-variant text-body-md">Orders aren’t available right now.</p>
        </div>
      )}
      {orders?.length === 0 && (
        <div className="bg-surface-container-lowest shadow-level-1 p-lg rounded-xl text-center">
          <p className="text-on-surface-variant text-body-md">No orders yet.</p>
        </div>
      )}

      {orders && orders.length > 0 && (
        <ul className="gap-gutter grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/admin/orders/${o.id}/quote` as Route}
                className="bg-surface-container-lowest shadow-level-1 hover:shadow-level-2 p-md group flex h-full items-center gap-3 rounded-xl transition-all"
              >
                <span className="bg-surface-dim flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
                  <Package className="text-on-surface-variant h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-grow">
                  <span className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-heading text-on-surface truncate">{o.order_ref}</span>
                    <StatusChip tone={statusTone(o.status)}>{humanizeStatus(o.status)}</StatusChip>
                  </span>
                  <span className="text-on-surface-variant block text-sm">
                    {humanizeStatus(o.service_type)}
                  </span>
                </span>
                <ChevronRight
                  className="text-outline group-hover:text-primary h-5 w-5 flex-shrink-0"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
