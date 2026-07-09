import { Check } from 'lucide-react';
import type { OrderJourney } from '@/domain/orders/journey';

// Stitch border-journey timeline: a vertical connector with milestone nodes. Chronological
// (earliest → latest) for readability; done nodes are filled with a check, the current node is
// highlighted, upcoming nodes are muted. Purely reflects the mapped order status.
// `labels` (key → localized text) + `inProgressLabel` localize the milestone copy; without them
// it falls back to the domain's English labels.
export function JourneyTimeline({
  journey,
  labels,
  inProgressLabel = 'In progress',
}: {
  journey: OrderJourney;
  labels?: Record<string, string>;
  inProgressLabel?: string;
}) {
  return (
    <ol className="relative" aria-label="Order journey">
      {journey.milestones.map((m, i) => {
        const last = i === journey.milestones.length - 1;
        const done = m.state === 'done';
        const current = m.state === 'current';
        return (
          <li key={m.key} className="relative flex gap-4 pb-6 last:pb-0">
            {/* connector */}
            {!last && (
              <span
                aria-hidden="true"
                className={`absolute left-[13px] top-7 h-full w-0.5 ${
                  done ? 'bg-primary' : 'bg-surface-variant'
                }`}
              />
            )}
            {/* node */}
            <span
              aria-hidden="true"
              className={`relative z-10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                done
                  ? 'bg-primary border-primary text-on-primary'
                  : current
                    ? 'border-primary bg-surface text-primary ring-primary/20 ring-4'
                    : 'border-surface-variant bg-surface text-outline'
              }`}
            >
              {done ? (
                <Check className="h-4 w-4" strokeWidth={3} />
              ) : (
                <span
                  className={`h-2 w-2 rounded-full ${current ? 'bg-primary' : 'bg-outline-variant'}`}
                />
              )}
            </span>
            {/* label */}
            <div className="pt-0.5">
              <p
                className={`font-body ${
                  current
                    ? 'text-on-surface font-semibold'
                    : done
                      ? 'text-on-surface'
                      : 'text-on-surface-variant'
                }`}
              >
                {labels?.[m.key] ?? m.label}
              </p>
              {current && (
                <span className="text-primary text-label-md font-bold">{inProgressLabel}</span>
              )}
            </div>
          </li>
        );
      })}
      {journey.halted && (
        <li className="text-error text-body-md mt-1 flex items-center gap-2">
          {journey.halted.label}
        </li>
      )}
    </ol>
  );
}
