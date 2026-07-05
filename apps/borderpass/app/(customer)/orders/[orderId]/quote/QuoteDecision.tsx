'use client';
// Phase 8A.4b: customer quote accept/decline controls. Calls ONLY the existing server actions
// (acceptQuote / declineQuote) — every rule stays server-side (sent_to_customer + unexpired,
// audited invalid attempts, transitions via transitionQuote / transitionOrderPrivileged).
// This component is presentation + optimistic-refresh only; errors get generic copy.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { acceptQuote, declineQuote } from '../../../../actions/quotes';

interface Props {
  quoteId: string;
  /** ISO string when the quote expires; accept is hidden once past (server re-checks anyway). */
  expiresAt: string | null;
}

export function QuoteDecision({ quoteId, expiresAt }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmingDecline, setConfirmingDecline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expired = !!expiresAt && new Date(expiresAt).getTime() <= Date.now();
  if (expired) {
    return (
      <p className="text-on-surface-variant mt-3 text-sm">
        This quote has expired. We&apos;ll be in touch with an updated quote.
      </p>
    );
  }

  function run(kind: 'accept' | 'decline') {
    setError(null);
    startTransition(async () => {
      const res =
        kind === 'accept'
          ? await acceptQuote({ quote_id: quoteId })
          : await declineQuote({ quote_id: quoteId });
      if (!res.ok) {
        // conflict_state usually means the view is stale — refresh to show the current status.
        if (res.error.code === 'conflict_state') router.refresh();
        setError("That didn't work. Please try again.");
        return;
      }
      setConfirmingDecline(false);
      router.refresh();
    });
  }

  return (
    <div className="mt-4" aria-busy={pending || undefined}>
      {!confirmingDecline ? (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => run('accept')}
            className="bg-primary text-on-primary flex-1 rounded-3xl px-4 py-3 font-medium disabled:opacity-60"
          >
            {pending ? 'Working…' : 'Accept quote'}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmingDecline(true)}
            className="border-outline text-on-surface-variant rounded-3xl border px-4 py-3 disabled:opacity-60"
          >
            Decline
          </button>
        </div>
      ) : (
        <div className="border-outline rounded-lg border p-3">
          <p className="text-sm">Decline this quote? This can&apos;t be undone.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => run('decline')}
              className="bg-error text-on-primary rounded-3xl px-4 py-2.5 font-medium disabled:opacity-60"
            >
              {pending ? 'Working…' : 'Yes, decline'}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmingDecline(false)}
              className="text-on-surface-variant rounded-3xl px-4 py-2.5 underline"
            >
              Keep quote
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-error mt-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
