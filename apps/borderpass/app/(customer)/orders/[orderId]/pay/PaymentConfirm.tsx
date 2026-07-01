'use client';
// Client payment FLOW (Phase 5, ADR-0011). BROWSER-ONLY. Owns the customer payment UX + the
// server-authoritative status refresh. confirmPayment is ADVISORY only: it can NEVER mark the
// payment succeeded or the order paid. After confirm we move to "processing" and POLL the server
// summary (webhook-driven). The success view renders ONLY when the server says `succeeded`.
import { useEffect, useRef, useState } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getBrowserStripe, getStripePublishableKey } from '@/client/stripe';
import { getMyOrderPaymentSummary } from '../../../../actions/payments';
import { paymentStatusCopy } from '@/domain/payments/copy';
import {
  shouldShowPaymentForm, shouldPollPaymentStatus, canRetryPayment, type PaymentDisplayState,
} from '@/domain/payments/display';

interface Props {
  orderId: string;
  initialState: PaymentDisplayState;
  clientSecret: string | null; // present only for form states (ready_to_pay / requires_action)
  amountLabel: string;
  returnPath: string; // Stripe return_url path — comes back to the pay page so polling resumes
  returnHref: string; // "Return to your order" link (customer route)
  paymentsConfigured: boolean; // server-side: Stripe secret configured + intent obtained
}

const POLL_MS = 2500;

export function PaymentConfirm(props: Props) {
  const [state, setState] = useState<PaymentDisplayState>(props.initialState);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Poll the server for the authoritative (webhook-driven) status while processing.
  useEffect(() => {
    if (!shouldPollPaymentStatus(state)) return;
    let active = true;
    const tick = async () => {
      const res = await getMyOrderPaymentSummary(props.orderId);
      if (!active) return;
      if (res.ok && res.data) setState(res.data.display_state);
      if (active && shouldPollPaymentStatus(res.ok && res.data ? res.data.display_state : 'processing')) {
        timer.current = setTimeout(tick, POLL_MS);
      }
    };
    timer.current = setTimeout(tick, POLL_MS);
    return () => { active = false; if (timer.current) clearTimeout(timer.current); };
  }, [state, props.orderId]);

  const copy = paymentStatusCopy(state);

  // Form states: render Elements (or a safe fallback when unconfigured).
  if (shouldShowPaymentForm(state)) {
    if (!props.paymentsConfigured || !props.clientSecret || !getStripePublishableKey()) {
      return <StatusView title="Payment unavailable" body="Payments are not fully configured in this environment yet." returnHref={props.returnHref} />;
    }
    return (
      <div>
        <p className="mt-2 text-on-surface-variant">{copy.body}</p>
        <Elements stripe={getBrowserStripe()} options={{ clientSecret: props.clientSecret, appearance: { theme: 'stripe' } }}>
          <ConfirmForm amountLabel={props.amountLabel} returnPath={props.returnPath} onProcessing={() => setState('processing')} />
        </Elements>
        <ReturnLink href={props.returnHref} />
      </div>
    );
  }

  // Settled / transient non-form states.
  return (
    <StatusView
      title={copy.title}
      body={copy.body}
      returnHref={props.returnHref}
      onRetry={canRetryPayment(state) ? () => setState('ready_to_pay') : undefined}
      busy={state === 'processing'}
    />
  );
}

function ConfirmForm({ amountLabel, returnPath, onProcessing }: { amountLabel: string; returnPath: string; onProcessing: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    // Advisory confirmation. We do NOT treat this result as final success — the webhook does. On a
    // clean confirm we hand off to "processing" and let polling read the authoritative status.
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}${returnPath}` },
      redirect: 'if_required',
    });
    setSubmitting(false);
    if (confirmError) {
      setError(confirmError.message ?? 'Payment could not be completed. Please try again.');
      return;
    }
    onProcessing();
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      <PaymentElement />
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      <button type="submit" disabled={!stripe || submitting} className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-on-primary disabled:opacity-60">
        {submitting ? 'Processing…' : `Pay ${amountLabel}`}
      </button>
    </form>
  );
}

function StatusView({ title, body, returnHref, onRetry, busy }: { title: string; body: string; returnHref: string; onRetry?: () => void; busy?: boolean }) {
  return (
    <div className="mt-3">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-on-surface-variant">{body}</p>
      {busy && <p className="mt-2 text-sm text-on-surface-variant" aria-live="polite">Checking status…</p>}
      <div className="mt-4 flex gap-3">
        {onRetry && <button type="button" onClick={onRetry} className="rounded-lg bg-primary px-4 py-2 font-medium text-on-primary">Try again</button>}
        <ReturnLink href={returnHref} />
      </div>
    </div>
  );
}

function ReturnLink({ href }: { href: string }) {
  return <a href={href} className="inline-block py-2 text-primary underline">Return to your order</a>;
}
