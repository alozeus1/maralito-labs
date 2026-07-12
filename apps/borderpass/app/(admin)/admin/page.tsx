// Command-center dashboard — headline metrics (stat tiles), the order pipeline (labeled SVG bars),
// and recent orders. All data from staff-scoped aggregates (adminMetrics / adminListOrders).
import Link from 'next/link';
import type { Route } from 'next';
import {
  Users,
  Package,
  Truck,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  ChevronRight,
} from 'lucide-react';
import { StatusChip, statusTone } from '../../_components/StatusChip';
import { adminMetrics } from '../../actions/admin-dashboard';
import { adminListOrders } from '../../actions/admin-orders';
import { formatMoneyMinor, humanizeStatus } from '@/lib/format';

export const dynamic = 'force-dynamic';

function StatTile({
  icon: Icon,
  value,
  label,
  tone = 'neutral',
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
  tone?: 'neutral' | 'good' | 'active' | 'issue';
}) {
  const accent = {
    neutral: 'text-on-surface',
    good: 'text-tertiary',
    active: 'text-primary',
    issue: 'text-error',
  }[tone];
  const chip = {
    neutral: 'bg-surface-dim text-on-surface-variant',
    good: 'bg-tertiary/10 text-tertiary',
    active: 'bg-primary/10 text-primary',
    issue: 'bg-error/10 text-error',
  }[tone];
  return (
    <div className="bg-surface-container-lowest shadow-level-1 p-md rounded-xl">
      <span className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full ${chip}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className={`font-heading block text-3xl ${accent}`}>{value}</span>
      <span className="text-on-surface-variant text-sm">{label}</span>
    </div>
  );
}

// Horizontal bar chart — one series (counts), so magnitude in a single hue with direct value labels
// (no legend needed; the heading names it). Accessible without hover.
function PipelineChart({ data }: { data: { key: string; label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="bg-surface-container-lowest shadow-level-1 p-md rounded-xl">
      <h2 className="font-heading text-headline-md mb-4">Order pipeline</h2>
      <ul className="space-y-2.5" role="img" aria-label="Orders by pipeline stage">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-3">
            <span className="text-on-surface-variant w-28 flex-shrink-0 text-right text-sm">
              {d.label}
            </span>
            <span className="bg-surface-variant/60 relative h-5 flex-grow overflow-hidden rounded-full">
              <span
                className="bg-primary absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${(d.count / max) * 100}%` }}
              />
            </span>
            <span className="text-on-surface w-8 flex-shrink-0 text-sm font-semibold tabular-nums">
              {d.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function AdminDashboard() {
  const [metricsRes, ordersRes] = await Promise.all([adminMetrics(), adminListOrders()]);
  const m = metricsRes.ok ? metricsRes.data : null;
  const orders = ordersRes.ok ? (ordersRes.data ?? []) : [];

  return (
    <main className="px-margin-mobile md:px-margin-desktop max-w-max-width py-md mx-auto">
      <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg mb-md">Dashboard</h1>

      {!m ? (
        <div className="bg-surface-container-lowest shadow-level-1 p-lg rounded-xl text-center">
          <p className="text-on-surface-variant text-body-md">
            Metrics aren’t available right now — please try again shortly.
          </p>
        </div>
      ) : (
        <>
          <div className="gap-gutter mb-lg grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatTile icon={Users} value={String(m.customers)} label="Customers" />
            <StatTile icon={Package} value={String(m.orders)} label="Orders" />
            <StatTile icon={Truck} value={String(m.inProgress)} label="In progress" tone="active" />
            <StatTile
              icon={CheckCircle2}
              value={String(m.delivered)}
              label="Delivered"
              tone="good"
            />
            <StatTile
              icon={AlertTriangle}
              value={String(m.issues)}
              label="Issues"
              tone={m.issues > 0 ? 'issue' : 'neutral'}
            />
            <StatTile
              icon={DollarSign}
              value={formatMoneyMinor(m.incomeMinor, m.currency)}
              label="Income"
              tone="good"
            />
          </div>

          <div className="gap-gutter mb-lg grid grid-cols-1 lg:grid-cols-2">
            <PipelineChart data={m.pipeline} />
            <div className="bg-surface-container-lowest shadow-level-1 p-md rounded-xl">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-heading text-headline-md">Recent orders</h2>
                <Link href={'/admin/orders' as Route} className="text-primary text-sm font-medium">
                  View all →
                </Link>
              </div>
              {orders.length === 0 ? (
                <p className="text-on-surface-variant text-body-md">No orders yet.</p>
              ) : (
                <ul className="space-y-2">
                  {orders.slice(0, 6).map((o) => (
                    <li key={o.id}>
                      <Link
                        href={`/admin/orders/${o.id}/quote` as Route}
                        className="hover:bg-surface-variant/40 flex items-center gap-3 rounded-lg p-2 transition-colors"
                      >
                        <span className="font-heading text-on-surface flex-grow truncate">
                          {o.order_ref}
                        </span>
                        <StatusChip tone={statusTone(o.status)}>
                          {humanizeStatus(o.status)}
                        </StatusChip>
                        <ChevronRight className="text-outline h-4 w-4 flex-shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
