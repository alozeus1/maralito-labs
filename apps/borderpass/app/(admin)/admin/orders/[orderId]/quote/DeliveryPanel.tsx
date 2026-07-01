'use client';
// Admin delivery-prep panel (Phase 6, ADR-0012). Staff read/write — calls ONLY the existing
// admin-delivery server actions (no direct DB, no direct order mutation). Scheduling UI is NON-PII:
// only window start/end. NO street/name/phone/postal/address-body inputs. The order handoff still
// happens inside transitionDeliveryPrep → transitionOrder.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createDeliveryPrep,
  markPreparing,
  markReady,
  scheduleDelivery,
  markHandedOff,
  type StaffDeliveryView,
} from '../../../../../actions/admin-delivery';
import { deliveryPrepStatusLabel } from '@/domain/delivery/copy';
import type { DeliveryPrepStatus } from '@/domain/delivery/state-machine';

type Res = { ok: true; data?: unknown } | { ok: false; error: { code: string; message: string } };

export function DeliveryPanel({
  orderId,
  delivery,
}: {
  orderId: string;
  delivery: StaffDeliveryView | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [winStart, setWinStart] = useState('');
  const [winEnd, setWinEnd] = useState('');

  function run(action: () => Promise<Res>) {
    setError(null);
    start(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      router.refresh();
    });
  }

  const status = (delivery?.status ?? null) as DeliveryPrepStatus | null;
  return (
    <section className="border-outline mt-6 rounded-lg border p-4">
      <h2 className="font-medium">Delivery preparation</h2>
      {!delivery ? (
        <div className="mt-2">
          <p className="text-on-surface-variant">No delivery preparation yet.</p>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => createDeliveryPrep({ order_id: orderId }))}
            className="bg-primary text-on-primary mt-2 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-60"
          >
            Create delivery prep
          </button>
        </div>
      ) : (
        <div className="mt-2 space-y-2 text-sm">
          <p>
            Status: <span className="font-medium">{deliveryPrepStatusLabel(delivery.status)}</span>
          </p>
          {delivery.staff_notes && (
            <p className="text-on-surface-variant">Staff note: {delivery.staff_notes}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {status === 'pending' && (
              <Btn
                pending={pending}
                onClick={() =>
                  run(() => markPreparing({ delivery_prep_id: delivery.delivery_prep_id }))
                }
              >
                Mark preparing
              </Btn>
            )}
            {status === 'preparing' && (
              <Btn
                pending={pending}
                onClick={() =>
                  run(() => markReady({ delivery_prep_id: delivery.delivery_prep_id }))
                }
              >
                Mark ready
              </Btn>
            )}
            {status === 'scheduled' && (
              <Btn
                pending={pending}
                onClick={() =>
                  run(() => markHandedOff({ delivery_prep_id: delivery.delivery_prep_id }))
                }
              >
                Mark handed off
              </Btn>
            )}
          </div>
          {status === 'ready' && (
            <div className="mt-2 space-y-2">
              <label className="text-on-surface-variant block">Scheduling window (non-PII)</label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="datetime-local"
                  value={winStart}
                  onChange={(e) => setWinStart(e.target.value)}
                  className="border-outline rounded border px-2 py-1"
                  aria-label="window start"
                />
                <span>–</span>
                <input
                  type="datetime-local"
                  value={winEnd}
                  onChange={(e) => setWinEnd(e.target.value)}
                  className="border-outline rounded border px-2 py-1"
                  aria-label="window end"
                />
                <Btn
                  pending={pending || !winStart || !winEnd}
                  onClick={() =>
                    run(() =>
                      scheduleDelivery({
                        delivery_prep_id: delivery.delivery_prep_id,
                        scheduled_window_start: new Date(winStart).toISOString(),
                        scheduled_window_end: new Date(winEnd).toISOString(),
                      }),
                    )
                  }
                >
                  Schedule
                </Btn>
              </div>
            </div>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-error mt-2 text-sm">
          {error}
        </p>
      )}
    </section>
  );
}

function Btn({
  children,
  onClick,
  pending,
}: {
  children: React.ReactNode;
  onClick: () => void;
  pending: boolean;
}) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className="bg-primary text-on-primary rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-60"
    >
      {children}
    </button>
  );
}
