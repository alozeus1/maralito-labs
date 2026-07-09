// Stitch Home (Service Hub): hero greeting + Active Delivery (real RLS-scoped order data,
// no PII) + Our Services grid. Reads only existing read models; no session internals rendered.
import Link from 'next/link';
import type { Route } from 'next';
import { PackageOpen, Truck, Building2, MapPin, Flag, CheckCircle2, Package } from 'lucide-react';
import { Hero } from '../_components/Hero';
import { ServiceCard } from '../_components/ServiceCard';
import { StatusChip, statusTone } from '../_components/StatusChip';
import { listMyOrders } from '../actions/orders';
import { getMyProfile } from '../actions/profile';
import { formatDate, humanizeStatus } from '@/lib/format';
import { getLocale } from '@/server/locale';
import { getMessages } from '@/i18n';

export const dynamic = 'force-dynamic';

// Statuses that mean "nothing actively in motion" — excluded from the Active Delivery slot.
const INACTIVE = new Set([
  'draft',
  'delivered',
  'cancelled',
  'rejected',
  'refunded',
  'delivery_failed',
]);

export default async function Home() {
  const [ordersRes, profileRes] = await Promise.all([listMyOrders(), getMyProfile()]);
  const orders = ordersRes.ok ? (ordersRes.data ?? []) : null;
  const displayName = profileRes.ok ? (profileRes.data?.display_name ?? '') : '';
  const firstName =
    displayName && displayName !== 'Customer' ? displayName.split(' ')[0] : undefined;
  const active = orders?.find((o) => !INACTIVE.has(o.status)) ?? null;
  const m = getMessages(await getLocale());

  return (
    <main className="px-margin-mobile md:px-margin-desktop max-w-max-width py-md mx-auto">
      <Hero
        {...(firstName ? { name: firstName } : {})}
        greetingWord={m.home.greeting}
        subtitle={m.home.subtitle}
      />

      {/* Active Delivery */}
      <section className="mb-lg md:mb-xl">
        <h2 className="font-heading text-headline-md mb-md">{m.home.activeDelivery}</h2>
        {active ? (
          <div className="bg-surface-container-lowest shadow-level-1 p-md rounded-xl">
            <div className="gap-md flex flex-col sm:flex-row sm:items-center">
              <div className="bg-surface-dim relative flex h-28 w-full flex-shrink-0 items-center justify-center overflow-hidden rounded-lg sm:h-28 sm:w-28">
                <Package className="text-on-surface-variant/50 h-10 w-10" aria-hidden="true" />
                <div className="absolute right-2 top-2">
                  <StatusChip tone={statusTone(active.status)}>
                    {humanizeStatus(active.status)}
                  </StatusChip>
                </div>
              </div>
              <div className="flex-grow">
                <h3 className="font-heading text-headline-md mb-2">Order #{active.order_ref}</h3>
                <div className="text-on-surface-variant grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <span className="text-body-md flex items-center gap-2">
                    <MapPin className="text-primary h-5 w-5" aria-hidden="true" />
                    Service:{' '}
                    <strong className="text-on-surface font-medium">
                      {humanizeStatus(active.service_type)}
                    </strong>
                  </span>
                  <span className="text-body-md flex items-center gap-2">
                    <Flag className="text-primary h-5 w-5" aria-hidden="true" />
                    Opened:{' '}
                    <strong className="text-on-surface font-medium">
                      {formatDate(active.created_at)}
                    </strong>
                  </span>
                  <span className="text-body-md text-tertiary flex items-center gap-2 font-medium">
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    {humanizeStatus(active.status)}
                  </span>
                </div>
              </div>
              <div className="flex w-full justify-end sm:w-auto">
                <Link
                  href={`/orders/${active.id}/quote` as Route}
                  className="bg-primary text-on-primary btn-tactile text-label-lg hover:bg-primary-container hover:text-on-primary-container focus-visible:ring-primary w-full rounded-full px-6 py-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:w-auto"
                >
                  {m.home.trackDetails}
                </Link>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-1">
              <span className="bg-primary h-2 flex-1 rounded-full" />
              <span className="bg-surface-variant h-2 flex-1 rounded-full" />
            </div>
          </div>
        ) : (
          <div className="bg-surface-container-lowest shadow-level-1 p-lg rounded-xl text-center">
            <div className="bg-surface-dim mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full">
              <Package className="text-on-surface-variant h-7 w-7" aria-hidden="true" />
            </div>
            <p className="font-heading text-headline-md text-on-surface">{m.home.noActive}</p>
            <p className="font-body text-on-surface-variant text-body-md mt-1">
              {orders === null
                ? "We couldn't load your deliveries just now — please try again shortly."
                : m.home.noActiveBody}
            </p>
          </div>
        )}
      </section>

      {/* Our Services */}
      <section>
        <h2 className="font-heading text-headline-md mb-md">{m.home.ourServices}</h2>
        <div className="gap-gutter grid grid-cols-1 md:grid-cols-2">
          <ServiceCard
            href={'/orders/new?service=buy_for_me' as Route}
            title="Shop from USA"
            subtitle="Comprar en USA"
            emoji="🇺🇸"
            tone="sand"
          />
          <ServiceCard
            href={'/orders/new?service=package_reception' as Route}
            title="Receive My Packages"
            subtitle="Recibir mis paquetes"
            icon={PackageOpen}
            tone="secondary"
          />
          <ServiceCard
            href={'/orders/new?service=local_pickup' as Route}
            title="Deliver to Juárez"
            subtitle="Entregar en Juárez"
            icon={Truck}
            tone="primary"
          />
          <ServiceCard
            href={'/orders/new?service=business_delivery' as Route}
            title="Business Orders"
            subtitle="Pedidos empresariales"
            icon={Building2}
            tone="variant"
          />
        </div>
      </section>
    </main>
  );
}
