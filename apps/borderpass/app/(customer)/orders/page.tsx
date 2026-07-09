// Customer orders list — Stitch concierge cards over the RLS-scoped listMyOrders read model.
// No PII/address/RFC/KYC; status labels are humanized keys.
import Link from 'next/link';
import type { Route } from 'next';
import { Package, ChevronRight } from 'lucide-react';
import { StatusChip, statusTone } from '../../_components/StatusChip';
import { listMyOrders } from '../../actions/orders';
import { formatDate, humanizeStatus } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const res = await listMyOrders();
  const orders = res.ok ? (res.data ?? []) : null;

  return (
    <main className="px-margin-mobile md:px-margin-desktop max-w-max-width py-md mx-auto">
      <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg mb-md">
        Your orders
      </h1>

      {orders === null && (
        <div className="bg-surface-container-lowest shadow-level-1 p-lg rounded-xl text-center">
          <p className="font-body text-on-surface-variant text-body-md">
            Orders aren’t available right now — please try again shortly.
          </p>
        </div>
      )}

      {orders?.length === 0 && (
        <div className="bg-surface-container-lowest shadow-level-1 p-lg rounded-xl text-center">
          <div className="bg-surface-dim mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full">
            <Package className="text-on-surface-variant h-7 w-7" aria-hidden="true" />
          </div>
          <p className="font-heading text-headline-md text-on-surface">No orders yet</p>
          <p className="font-body text-on-surface-variant text-body-md mt-1">
            Start a request from Home and your orders will appear here.
          </p>
        </div>
      )}

      {orders && orders.length > 0 && (
        <ul className="gap-gutter grid grid-cols-1 md:grid-cols-2">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/orders/${o.id}/quote` as Route}
                className="bg-surface-container-lowest shadow-level-1 hover:shadow-level-2 focus-visible:ring-primary p-md group flex h-full items-center gap-4 rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2"
              >
                <span className="bg-surface-dim flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full">
                  <Package className="text-on-surface-variant h-6 w-6" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-grow">
                  <span className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-heading text-on-surface truncate text-lg">
                      {o.order_ref}
                    </span>
                    <StatusChip tone={statusTone(o.status)}>{humanizeStatus(o.status)}</StatusChip>
                  </span>
                  <span className="text-on-surface-variant text-body-md block">
                    {humanizeStatus(o.service_type)} · {formatDate(o.created_at)}
                  </span>
                </span>
                <ChevronRight
                  className="text-outline group-hover:text-primary h-5 w-5 flex-shrink-0 transition-colors"
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
