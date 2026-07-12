// Customer detail (staff) — direct-message thread with the customer. Order-linked threads live on
// each order; this is the general concierge conversation.
import Link from 'next/link';
import type { Route } from 'next';
import { ArrowLeft } from 'lucide-react';
import { listCustomerThread } from '../../../../actions/admin-messages';
import { isMediaConfigured } from '@/server/message-media';
import { DirectMessagePanel } from './DirectMessagePanel';

export const dynamic = 'force-dynamic';

export default async function AdminCustomerPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const res = await listCustomerThread(customerId);
  const thread = res.ok ? (res.data ?? []) : [];

  return (
    <main className="px-margin-mobile py-md md:py-lg mx-auto max-w-2xl">
      <Link
        href={'/admin/customers' as Route}
        className="text-on-surface-variant hover:text-on-surface mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Customers
      </Link>
      <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg mb-md">Customer</h1>
      <DirectMessagePanel
        customerId={customerId}
        initial={thread}
        mediaEnabled={isMediaConfigured()}
      />
    </main>
  );
}
