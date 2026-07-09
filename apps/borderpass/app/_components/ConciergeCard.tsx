import type { ReactNode } from 'react';

// Stitch concierge card: white surface, 24px padding, ambient Level-1 shadow, optional Literata
// header. The standard container for order/quote/inspection content.
export function ConciergeCard({
  title,
  action,
  children,
  className = '',
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-surface-container-lowest shadow-level-1 p-md rounded-xl ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="font-heading text-headline-md text-on-surface">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
