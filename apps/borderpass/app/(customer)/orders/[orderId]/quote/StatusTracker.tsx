// Phase 8A.5: tiny read-only step tracker for inspection/delivery cards. Pure presentation —
// renders ONLY the status key against a fixed step list (no staff notes, IDs, or PII).
import { humanizeStatus } from '@/lib/format';

interface Props {
  steps: readonly string[];
  /** Current status key; may be a non-step state (e.g. failed / on_hold) shown as an annotation. */
  current: string;
}

export function StatusTracker({ steps, current }: Props) {
  const idx = steps.indexOf(current);
  return (
    <ol className="mt-3 flex items-center gap-1" aria-label="Progress">
      {steps.map((step, i) => {
        const reached = idx >= 0 && i <= idx;
        return (
          <li key={step} className="flex flex-1 flex-col items-center gap-1">
            <span
              aria-hidden
              className={
                reached
                  ? 'bg-primary h-2 w-full rounded-full'
                  : 'bg-surface-variant h-2 w-full rounded-full'
              }
            />
            <span
              className={
                i === idx
                  ? 'text-center text-[11px] font-semibold'
                  : 'text-on-surface-variant text-center text-[11px]'
              }
            >
              {humanizeStatus(step)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
