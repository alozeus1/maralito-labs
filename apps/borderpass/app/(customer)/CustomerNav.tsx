'use client';
// Phase 8A.3: customer nav with active-route highlight. Presentation only — static links.
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/orders', label: 'Orders' },
  { href: '/quotes', label: 'Quotes' },
] as const;

export function CustomerNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Customer" className="mx-auto flex max-w-5xl gap-1 px-4 pb-2 sm:px-6">
      {LINKS.map(({ href, label }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'bg-surface-variant rounded-3xl px-4 py-2.5 text-sm font-semibold'
                : 'text-on-surface-variant hover:bg-surface-variant/60 rounded-3xl px-4 py-2.5 text-sm font-medium transition-colors'
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
