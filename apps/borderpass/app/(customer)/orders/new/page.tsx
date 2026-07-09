// New Request entry (draft-first). Server shell reads the preselected ?service= from the Home
// service cards; the interactive multi-step form is the client component. No PII is collected
// or stored here — real address capture + final submission are KMS-gated (ADR-0012/0015).
import Link from 'next/link';
import type { Route } from 'next';
import { X } from 'lucide-react';
import { NewRequestForm } from './NewRequestForm';

export const dynamic = 'force-dynamic';

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const { service } = await searchParams;

  return (
    <main className="px-margin-mobile md:px-margin-desktop max-w-max-width py-md mx-auto">
      <div className="mb-md flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg text-on-surface">
            New Request
          </h1>
          <p className="font-body text-on-surface-variant text-body-md mt-1">
            Tell us what to bring across and we’ll prepare a quote.
          </p>
        </div>
        <Link
          href={'/' as Route}
          aria-label="Cancel"
          className="text-on-surface-variant hover:bg-surface-variant/50 rounded-full p-2 transition-colors"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>

      <NewRequestForm {...(service ? { defaultService: service } : {})} />
    </main>
  );
}
