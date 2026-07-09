import Link from 'next/link';
import type { Route } from 'next';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

// Stitch "Our Services" bento card: large soft-white surface, tinted icon medallion, EN title
// over ES subtitle, ambient shadow that lifts on hover, arrow revealed on hover.
export function ServiceCard({
  href,
  title,
  subtitle,
  icon: Icon,
  emoji,
  tone = 'sand',
}: {
  href: Route;
  title: string;
  subtitle: string;
  icon?: LucideIcon;
  emoji?: ReactNode;
  tone?: 'sand' | 'secondary' | 'primary' | 'variant';
}) {
  const medallion = {
    sand: 'bg-surface-dim text-on-surface',
    secondary: 'bg-secondary-container text-on-secondary-container',
    primary: 'bg-primary-container text-on-primary-container',
    variant: 'bg-surface-variant text-on-surface-variant',
  }[tone];

  return (
    <Link
      href={href}
      className="bg-surface-container-lowest shadow-level-1 hover:shadow-level-2 focus-visible:ring-primary p-lg hover:border-surface-variant group relative flex flex-col items-start overflow-hidden rounded-xl border border-transparent transition-all focus-visible:outline-none focus-visible:ring-2"
    >
      <div
        className={`mb-6 flex h-14 w-14 items-center justify-center rounded-full transition-transform group-hover:scale-110 ${medallion}`}
      >
        {emoji ? (
          <span className="text-2xl">{emoji}</span>
        ) : Icon ? (
          <Icon className="h-7 w-7" aria-hidden="true" />
        ) : null}
      </div>
      <h3 className="font-heading text-headline-md text-on-surface mb-1">{title}</h3>
      <p className="font-body text-on-surface-variant text-body-md opacity-80">{subtitle}</p>
      <ArrowRight
        className="text-primary absolute bottom-4 right-4 h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden="true"
      />
    </Link>
  );
}
