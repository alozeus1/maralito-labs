import type { LucideIcon } from 'lucide-react';

// Interim placeholder for Stitch tabs whose features land in a later phase (Messages, Support,
// Profile). Keeps the bottom nav faithful without dead 404s, on-brand with a concierge card.
export function ComingSoon({
  title,
  blurb,
  icon: Icon,
}: {
  title: string;
  blurb: string;
  icon: LucideIcon;
}) {
  return (
    <main className="px-margin-mobile md:px-margin-desktop max-w-max-width py-md mx-auto">
      <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg mb-md">{title}</h1>
      <div className="bg-surface-container-lowest shadow-level-1 p-lg rounded-xl text-center">
        <div className="bg-surface-dim mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full">
          <Icon className="text-on-surface-variant h-7 w-7" aria-hidden="true" />
        </div>
        <p className="font-heading text-headline-md text-on-surface">Coming soon</p>
        <p className="font-body text-on-surface-variant text-body-md mx-auto mt-1 max-w-md">
          {blurb}
        </p>
      </div>
    </main>
  );
}
