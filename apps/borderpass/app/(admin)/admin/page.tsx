// Staff dashboard — live monitoring overview (status tiles + recent orders) from adminListOrders.
import Link from 'next/link';
import type { Route } from 'next';
import { Package, ChevronRight } from 'lucide-react';
import { StatusChip, statusTone } from '../../_components/StatusChip';
import { adminListOrders } from '../../actions/admin-orders';
import { humanizeStatus } from '@/lib/format';

export const dynamic = 'force-dynamic';

const BUCKETS: { key: string; label: string; statuses: string[] }[] = [
  {
    key: 'review',
    label: 'Needs review',
    statuses: ['submitted', 'under_review', 'missing_information', 'quote_ready'],
  },
  { key: 'payment', label: 'Awaiting payment', statuses: ['awaiting_payment'] },
  {
    key: 'transit',
    label: 'In progress',
    statuses: [
      'paid',
      'purchasing',
      'purchased',
      'awaiting_package',
      'received_el_paso',
      'inspection_pending',
      'inspection_passed',
      'border_documentation_ready',
      'ready_for_crossing',
      'border_crossing',
      'customs_processing',
      'arrived_juarez',
      'out_for_delivery',
    ],
  },
  { key: 'delivered', label: 'Delivered', statuses: ['delivered'] },
];

export default async function AdminDashboard() {
  const res = await adminListOrders();
  const orders = res.ok ? (res.data ?? []) : null;
  const count = (b: (typeof BUCKETS)[number]) =>
    orders?.filter((o) => b.statuses.includes(o.status)).length ?? 0;

  return (
    <main className="px-margin-mobile md:px-margin-desktop max-w-max-width py-md mx-auto">
      <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg mb-md">Dashboard</h1>

      {orders === null ? (
        <div className="bg-surface-container-lowest shadow-level-1 p-lg rounded-xl text-center">
          <p className="text-on-surface-variant text-body-md">
            Orders aren’t available right now — please try again shortly.
          </p>
        </div>
      ) : (
        <>
          <div className="gap-gutter mb-lg grid grid-cols-2 lg:grid-cols-5">
            <div className="bg-surface-container-lowest shadow-level-1 p-md rounded-xl">
              <span className="font-heading text-on-surface block text-3xl">{orders.length}</span>
              <span className="text-on-surface-variant text-sm">Total orders</span>
            </div>
            {BUCKETS.map((b) => (
              <div
                key={b.key}
                className="bg-surface-container-lowest shadow-level-1 p-md rounded-xl"
              >
                <span className="font-heading text-on-surface block text-3xl">{count(b)}</span>
                <span className="text-on-surface-variant text-sm">{b.label}</span>
              </div>
            ))}
          </div>

          <div className="mb-md flex items-center justify-between">
            <h2 className="font-heading text-headline-md">Recent orders</h2>
            <Link href={'/admin/orders' as Route} className="text-primary text-sm font-medium">
              View all →
            </Link>
          </div>
          {orders.length === 0 ? (
            <p className="text-on-surface-variant text-body-md">No orders yet.</p>
          ) : (
            <ul className="gap-gutter grid grid-cols-1 md:grid-cols-2">
              {orders.slice(0, 8).map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/admin/orders/${o.id}/quote` as Route}
                    className="bg-surface-container-lowest shadow-level-1 hover:shadow-level-2 p-md group flex items-center gap-3 rounded-xl transition-all"
                  >
                    <span className="bg-surface-dim flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
                      <Package className="text-on-surface-variant h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-grow">
                      <span className="mb-1 flex items-center justify-between gap-2">
                        <span className="font-heading text-on-surface truncate">{o.order_ref}</span>
                        <StatusChip tone={statusTone(o.status)}>
                          {humanizeStatus(o.status)}
                        </StatusChip>
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
        </>
      )}
    </main>
  );
}
