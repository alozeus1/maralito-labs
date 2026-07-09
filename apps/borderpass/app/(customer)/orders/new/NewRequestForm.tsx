'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import {
  ShoppingCart,
  PackageOpen,
  Store,
  Building2,
  Check,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { createOrder } from '../../../actions/orders';
import type { Messages } from '@/i18n';

// Stitch "New Request" flow (draft-first). Creates a DRAFT order — service + items + purpose +
// declared value. No PII/address is collected or stored (real address storage is KMS-gated:
// ADR-0012/0015); the delivery address + final submission come in a later phase.
type ServiceType = 'buy_for_me' | 'package_reception' | 'local_pickup' | 'business_delivery';
type Purpose = 'personal' | 'gift' | 'business' | 'resale';

// Icon + buy-flow flags per service; user-facing title/description come from the localized messages.
const SERVICES: { type: ServiceType; icon: LucideIcon; buy: boolean }[] = [
  { type: 'buy_for_me', icon: ShoppingCart, buy: true },
  { type: 'package_reception', icon: PackageOpen, buy: false },
  { type: 'local_pickup', icon: Store, buy: false },
  { type: 'business_delivery', icon: Building2, buy: false },
];

const PURPOSES: Purpose[] = ['personal', 'gift', 'business', 'resale'];

const isServiceType = (v: string | undefined): v is ServiceType =>
  !!v && SERVICES.some((s) => s.type === v);

export function NewRequestForm({
  messages: t,
  defaultService,
}: {
  messages: Messages['newRequest'];
  defaultService?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [service, setService] = useState<ServiceType | null>(
    isServiceType(defaultService) ? defaultService : null,
  );
  const [description, setDescription] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [value, setValue] = useState('');
  const [purpose, setPurpose] = useState<Purpose | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const svc = SERVICES.find((s) => s.type === service) ?? null;
  const unitMinor = Math.round((parseFloat(value) || 0) * 100);
  const totalMinor = unitMinor * quantity;
  const step2Valid = description.trim().length > 0 && unitMinor > 0 && quantity >= 1;
  const canReview = !!service && step2Valid && !!purpose;

  async function submit() {
    if (!service || !purpose || !step2Valid) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await createOrder({
        service_type: service,
        purpose,
        items: [
          {
            description: description.trim(),
            quantity,
            unit_value: { amount_minor: unitMinor, currency: 'USD' },
            ...(svc?.buy && productUrl.trim() ? { product_url: productUrl.trim() } : {}),
          },
        ],
        declared_value: { amount_minor: totalMinor, currency: 'USD' },
      });
      if (res.ok && res.data) {
        router.push(`/orders/${res.data.order_id}/quote` as Route);
      } else {
        setError(t.error);
        setSubmitting(false);
      }
    } catch {
      setError(t.error);
      setSubmitting(false);
    }
  }

  const fmt = (minor: number) => `$${(minor / 100).toFixed(2)}`;

  return (
    <div className="gap-md grid lg:grid-cols-[1fr_20rem] lg:items-start">
      <div className="space-y-md">
        {/* Step 1 — Choose Service */}
        <Section n={1} title={t.chooseService} step={step} edit={t.edit} onEdit={() => setStep(1)}>
          {step === 1 ? (
            <>
              <div className="mt-2 space-y-3">
                {SERVICES.map((s) => {
                  const active = service === s.type;
                  return (
                    <button
                      key={s.type}
                      type="button"
                      onClick={() => setService(s.type)}
                      aria-pressed={active}
                      className={`focus-visible:ring-primary flex w-full items-start gap-4 rounded-xl border-2 p-4 text-left transition-colors focus-visible:outline-none ${
                        active
                          ? 'border-primary bg-primary/5'
                          : 'bg-surface-container-low hover:bg-surface-variant/50 border-transparent'
                      }`}
                    >
                      <span className="bg-surface-dim text-on-surface flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
                        <s.icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span>
                        <span className="font-heading text-on-surface block">
                          {t.services[s.type].title}
                        </span>
                        <span className="text-on-surface-variant text-body-md block">
                          {t.services[s.type].desc}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <StepButton disabled={!service} onClick={() => setStep(2)}>
                {t.continue}
              </StepButton>
            </>
          ) : (
            svc && (
              <p className="text-on-surface-variant text-body-md">{t.services[svc.type].title}</p>
            )
          )}
        </Section>

        {/* Step 2 — Product Details */}
        <Section
          n={2}
          title={t.productDetails}
          step={step}
          edit={t.edit}
          onEdit={() => service && setStep(2)}
        >
          {step === 2 && (
            <div className="mt-2 space-y-3">
              <Field label={t.whatMoving}>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t.whatMovingPlaceholder}
                  className="bg-surface-variant focus-visible:ring-primary w-full rounded-md p-3 focus-visible:outline-none focus-visible:ring-2"
                />
              </Field>
              {svc?.buy && (
                <Field label={t.productLink}>
                  <input
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                    placeholder="https://…"
                    inputMode="url"
                    className="bg-surface-variant focus-visible:ring-primary w-full rounded-md p-3 focus-visible:outline-none focus-visible:ring-2"
                  />
                </Field>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label={t.quantity}>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="bg-surface-variant focus-visible:ring-primary w-full rounded-md p-3 focus-visible:outline-none focus-visible:ring-2"
                  />
                </Field>
                <Field label={t.itemValueUsd}>
                  <input
                    inputMode="decimal"
                    value={value}
                    onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    className="bg-surface-variant focus-visible:ring-primary w-full rounded-md p-3 focus-visible:outline-none focus-visible:ring-2"
                  />
                </Field>
              </div>
              <StepButton disabled={!step2Valid} onClick={() => setStep(3)}>
                {t.continue}
              </StepButton>
            </div>
          )}
        </Section>

        {/* Step 3 — Border Information */}
        <Section
          n={3}
          title={t.borderInfo}
          step={step}
          edit={t.edit}
          onEdit={() => step2Valid && setStep(3)}
        >
          {step === 3 && (
            <div className="mt-2 space-y-4">
              <Field label={t.purpose}>
                <div className="flex flex-wrap gap-2">
                  {PURPOSES.map((p) => {
                    const active = purpose === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPurpose(p)}
                        aria-pressed={active}
                        className={`focus-visible:ring-primary rounded-full border px-4 py-2 text-sm transition-colors focus-visible:outline-none ${
                          active
                            ? 'border-primary bg-primary text-on-primary'
                            : 'border-outline-variant text-on-surface-variant hover:bg-surface-variant/60'
                        }`}
                      >
                        {t.purposes[p]}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <p className="text-on-surface-variant bg-surface-container-low rounded-lg p-3 text-sm">
                {t.addressNote}
              </p>
              {error && (
                <p role="alert" className="text-error text-sm">
                  {error}
                </p>
              )}
              <button
                type="button"
                disabled={!canReview || submitting}
                onClick={submit}
                className="bg-primary text-on-primary btn-tactile hover:bg-primary-container hover:text-on-primary-container focus-visible:ring-primary flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {submitting ? t.creating : t.review}
              </button>
            </div>
          )}
        </Section>
      </div>

      {/* Summary */}
      <aside className="bg-surface-container-low p-md rounded-xl lg:sticky lg:top-24">
        <h2 className="font-heading text-headline-md text-on-surface">{t.requestSummary}</h2>
        <p className="text-on-surface-variant text-sm">{t.orderPending}</p>
        <dl className="border-outline-variant/60 mt-4 space-y-2 border-t pt-4 text-sm">
          <Row label={t.service} value={svc ? t.services[svc.type].title : '—'} />
          <Row label={t.itemValue} value={totalMinor > 0 ? fmt(totalMinor) : '$TBD'} />
          <Row label={t.estDuties} value={t.pending} muted />
        </dl>
        <div className="border-outline-variant/60 mt-4 flex items-center justify-between border-t pt-4">
          <span className="font-heading text-on-surface">{t.estTotal}</span>
          <span className="font-heading text-primary">
            {totalMinor > 0 ? `${fmt(totalMinor)}+` : '$TBD'}
          </span>
        </div>
      </aside>
    </div>
  );
}

function Section({
  n,
  title,
  step,
  edit,
  onEdit,
  children,
}: {
  n: number;
  title: string;
  step: number;
  edit: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  const done = step > n;
  const active = step === n;
  return (
    <section
      className={`bg-surface-container-lowest shadow-level-1 p-md rounded-xl ${active ? '' : 'opacity-95'}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-sm font-bold ${
              done
                ? 'bg-primary border-primary text-on-primary'
                : active
                  ? 'border-primary text-primary'
                  : 'border-outline-variant text-outline'
            }`}
          >
            {done ? <Check className="h-4 w-4" strokeWidth={3} /> : n}
          </span>
          <h2 className="font-heading text-headline-md text-on-surface">{title}</h2>
        </div>
        {done && (
          <button
            type="button"
            onClick={onEdit}
            className="text-primary text-sm underline underline-offset-2"
          >
            {edit}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function StepButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 flex justify-end">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="bg-primary text-on-primary btn-tactile hover:bg-primary-container hover:text-on-primary-container focus-visible:ring-primary rounded-full px-6 py-2.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {children}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-on-surface-variant mb-1 block text-sm">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className={muted ? 'text-on-surface-variant' : 'text-on-surface'}>{value}</dd>
    </div>
  );
}
