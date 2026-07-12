// Customer relations — staff list of customers with order counts, linking to a per-customer view
// (direct message + their orders). Data from the org-scoped adminListCustomers aggregate.
import Link from 'next/link';
import type { Route } from 'next';
import { User, ChevronRight } from 'lucide-react';
import { adminListCustomers } from '../../../actions/admin-dashboard';

export const dynamic = 'force-dynamic';

export default async function AdminCustomersPage() {
  const res = await adminListCustomers();
  const customers = res.ok ? (res.data ?? []) : null;

  return (
    <main className="px-margin-mobile md:px-margin-desktop max-w-max-width py-md mx-auto">
      <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg mb-md">Customers</h1>

      {customers === null && (
        <div className="bg-surface-container-lowest shadow-level-1 p-lg rounded-xl text-center">
          <p className="text-on-surface-variant text-body-md">
            Customers aren’t available right now.
          </p>
        </div>
      )}
      {customers?.length === 0 && (
        <div className="bg-surface-container-lowest shadow-level-1 p-lg rounded-xl text-center">
          <p className="text-on-surface-variant text-body-md">No customers yet.</p>
        </div>
      )}

      {customers && customers.length > 0 && (
        <ul className="gap-gutter grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {customers.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/customers/${c.id}` as Route}
                className="bg-surface-container-lowest shadow-level-1 hover:shadow-level-2 p-md group flex items-center gap-3 rounded-xl transition-all"
              >
                <span className="bg-surface-dim flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
                  <User className="text-on-surface-variant h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-grow">
                  <span className="font-heading text-on-surface block truncate">
                    {c.display_name}
                  </span>
                  <span className="text-on-surface-variant text-sm">
                    {c.orders} {c.orders === 1 ? 'order' : 'orders'}
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
