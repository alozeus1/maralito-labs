// Issues — orders in a problem state (rejected / inspection failed / delivery failed / cancelled /
// refunded), so staff can jump straight to the order and act.
import Link from 'next/link';
import type { Route } from 'next';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { StatusChip, statusTone } from '../../../_components/StatusChip';
import { adminListIssues } from '../../../actions/admin-dashboard';
import { humanizeStatus } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AdminIssuesPage() {
  const res = await adminListIssues();
  const issues = res.ok ? (res.data ?? []) : null;

  return (
    <main className="px-margin-mobile md:px-margin-desktop max-w-max-width py-md mx-auto">
      <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg mb-md">Issues</h1>

      {issues === null && (
        <div className="bg-surface-container-lowest shadow-level-1 p-lg rounded-xl text-center">
          <p className="text-on-surface-variant text-body-md">Issues aren’t available right now.</p>
        </div>
      )}
      {issues?.length === 0 && (
        <div className="bg-surface-container-lowest shadow-level-1 p-lg rounded-xl text-center">
          <div className="bg-tertiary/10 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full">
            <AlertTriangle className="text-tertiary h-7 w-7" aria-hidden="true" />
          </div>
          <p className="font-heading text-headline-md text-on-surface">All clear</p>
          <p className="text-on-surface-variant text-body-md mt-1">No orders need attention.</p>
        </div>
      )}

      {issues && issues.length > 0 && (
        <ul className="gap-gutter grid grid-cols-1 md:grid-cols-2">
          {issues.map((o) => (
            <li key={o.id}>
              <Link
                href={`/admin/orders/${o.id}/quote` as Route}
                className="bg-surface-container-lowest shadow-level-1 hover:shadow-level-2 p-md group flex items-center gap-3 rounded-xl transition-all"
              >
                <span className="bg-error/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
                  <AlertTriangle className="text-error h-5 w-5" aria-hidden="true" />
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
