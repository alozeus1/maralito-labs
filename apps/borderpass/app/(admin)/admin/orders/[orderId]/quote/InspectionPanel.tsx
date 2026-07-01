'use client';
// Admin inspection panel (Phase 6, ADR-0012). Staff read/write — calls ONLY the existing
// admin-inspections server actions (no direct DB, no direct order mutation). The order join still
// happens inside transitionInspection → transitionOrder.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createInspection, startInspection, holdInspection, resumeInspection, passInspection, failInspection,
  type StaffInspectionView,
} from '../../../../../actions/admin-inspections';
import { inspectionStatusLabel } from '@/domain/inspections/copy';
import type { InspectionStatus } from '@/domain/inspections/state-machine';

type Action = () => Promise<{ ok: true } | { ok: false; error: { code: string; message: string } } | { ok: true; data?: unknown }>;

export function InspectionPanel({ orderId, inspection }: { orderId: string; inspection: StaffInspectionView | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: Action) {
    setError(null);
    start(async () => {
      const res = await action();
      if (!res.ok) { setError(res.error.message); return; }
      router.refresh();
    });
  }

  const status = (inspection?.status ?? null) as InspectionStatus | null;
  return (
    <section className="mt-6 rounded-lg border border-outline p-4">
      <h2 className="font-medium">Inspection</h2>
      {!inspection ? (
        <div className="mt-2">
          <p className="text-on-surface-variant">No inspection yet.</p>
          <button type="button" disabled={pending} onClick={() => run(() => createInspection({ order_id: orderId }))} className="mt-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary disabled:opacity-60">Create inspection</button>
        </div>
      ) : (
        <div className="mt-2 space-y-2 text-sm">
          <p>Status: <span className="font-medium">{inspectionStatusLabel(inspection.status)}</span></p>
          {inspection.staff_notes && <p className="text-on-surface-variant">Staff note: {inspection.staff_notes}</p>}
          <div className="flex flex-wrap gap-2">
            {status === 'scheduled' && <Btn pending={pending} onClick={() => run(() => startInspection({ inspection_id: inspection.inspection_id }))}>Start</Btn>}
            {status === 'in_progress' && <>
              <Btn pending={pending} onClick={() => run(() => holdInspection({ inspection_id: inspection.inspection_id }))}>Hold</Btn>
              <Btn pending={pending} onClick={() => run(() => passInspection({ inspection_id: inspection.inspection_id }))}>Pass</Btn>
              <Btn pending={pending} onClick={() => run(() => failInspection({ inspection_id: inspection.inspection_id }))}>Fail</Btn>
            </>}
            {status === 'on_hold' && <Btn pending={pending} onClick={() => run(() => resumeInspection({ inspection_id: inspection.inspection_id }))}>Resume</Btn>}
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-error">{error}</p>}
    </section>
  );
}

function Btn({ children, onClick, pending }: { children: React.ReactNode; onClick: () => void; pending: boolean }) {
  return <button type="button" disabled={pending} onClick={onClick} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary disabled:opacity-60">{children}</button>;
}
