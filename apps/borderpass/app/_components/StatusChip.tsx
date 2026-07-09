import type { ReactNode } from 'react';

// Stitch status chip: soft tinted background + solid text (DESIGN.md: 10% bg, 100% text).
type Tone = 'success' | 'active' | 'neutral' | 'error';

const TONES: Record<Tone, string> = {
  success: 'bg-tertiary/10 text-tertiary',
  active: 'bg-primary/10 text-primary',
  neutral: 'bg-surface-variant text-on-surface-variant',
  error: 'bg-error/10 text-error',
};

export function StatusChip({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`text-label-md inline-flex items-center rounded-full px-3 py-1 font-bold ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

// Map an order status key to a chip tone. Terminal-positive → success, hard-stops → error,
// anything actively moving → active, otherwise neutral.
export function statusTone(status: string): Tone {
  if (['delivered', 'inspection_passed', 'ready_for_crossing', 'arrived_juarez'].includes(status))
    return 'success';
  if (['rejected', 'inspection_failed', 'delivery_failed', 'cancelled'].includes(status))
    return 'error';
  if (['draft', 'refunded'].includes(status)) return 'neutral';
  return 'active';
}
