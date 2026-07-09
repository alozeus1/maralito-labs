'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Lock } from 'lucide-react';
import { createMyAddress } from '../../../../actions/addresses';
import { updateDraftOrder, submitOrder } from '../../../../actions/orders';

// Completes a draft order: collects a delivery/hub address (sealed via KMS in createMyAddress),
// attaches it to the order, then submits. Rendered only for draft/missing_information orders.
// When KMS isn't configured, the form is replaced by a clear "unavailable" notice (fail-closed).
export function SubmitRequest({
  orderId,
  serviceType,
  kmsConfigured,
}: {
  orderId: string;
  serviceType: string;
  kmsConfigured: boolean;
}) {
  const router = useRouter();
  const isHub = serviceType === 'package_reception';
  const [f, setF] = useState({
    recipient: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postal: '',
    phone: '',
    country: 'MX' as 'MX' | 'US',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const valid = f.recipient && f.line1 && f.city && f.state && f.postal;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setError('');
    setBusy(true);
    try {
      const addr = await createMyAddress({
        recipient: f.recipient,
        line1: f.line1,
        line2: f.line2 || undefined,
        city: f.city,
        state: f.state,
        postal: f.postal,
        phone: f.phone || undefined,
        country: f.country,
        kind: isHub ? 'hub' : 'delivery',
      });
      if (!addr.ok || !addr.data) {
        setError('We couldn’t save your address securely. Please try again.');
        setBusy(false);
        return;
      }
      const patch = isHub
        ? { hub_address_id: addr.data.id }
        : { delivery_address_id: addr.data.id };
      const upd = await updateDraftOrder({ order_id: orderId, patch });
      if (!upd.ok) {
        setError('We couldn’t attach your address. Please try again.');
        setBusy(false);
        return;
      }
      const sub = await submitOrder({ order_id: orderId });
      if (!sub.ok) {
        setError('Some details are still missing — please review and try again.');
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again shortly.');
      setBusy(false);
    }
  }

  if (!kmsConfigured) {
    return (
      <div className="bg-surface-container-lowest shadow-level-1 p-md rounded-xl">
        <div className="text-on-surface-variant flex items-start gap-3">
          <Lock className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
          <p className="text-body-md">
            Secure address storage isn’t enabled in this environment yet, so this request can’t be
            submitted here. Your draft is saved.
          </p>
        </div>
      </div>
    );
  }

  const input =
    'bg-surface-variant focus-visible:ring-primary w-full rounded-md p-3 focus-visible:outline-none focus-visible:ring-2';

  return (
    <form onSubmit={submit} className="bg-surface-container-lowest shadow-level-1 p-md rounded-xl">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-heading text-headline-md text-on-surface">
          {isHub ? 'Hub address' : 'Delivery address'}
        </h2>
        <span className="text-tertiary inline-flex items-center gap-1 text-xs font-medium">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Encrypted
        </span>
      </div>
      <div className="space-y-3">
        <input
          className={input}
          placeholder="Recipient name"
          value={f.recipient}
          onChange={set('recipient')}
        />
        <input
          className={input}
          placeholder="Street address"
          value={f.line1}
          onChange={set('line1')}
        />
        <input
          className={input}
          placeholder="Apt, suite (optional)"
          value={f.line2}
          onChange={set('line2')}
        />
        <div className="grid grid-cols-2 gap-3">
          <input className={input} placeholder="City" value={f.city} onChange={set('city')} />
          <input className={input} placeholder="State" value={f.state} onChange={set('state')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input
            className={input}
            placeholder="Postal code"
            value={f.postal}
            onChange={set('postal')}
          />
          <select className={input} value={f.country} onChange={set('country')}>
            <option value="MX">Mexico</option>
            <option value="US">United States</option>
          </select>
        </div>
        <input
          className={input}
          placeholder="Phone (optional)"
          value={f.phone}
          onChange={set('phone')}
          inputMode="tel"
        />
      </div>
      {error && (
        <p role="alert" className="text-error mt-3 text-sm">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!valid || busy}
        className="bg-primary text-on-primary btn-tactile hover:bg-primary-container hover:text-on-primary-container focus-visible:ring-primary mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {busy ? 'Submitting…' : 'Submit request'}
      </button>
    </form>
  );
}
