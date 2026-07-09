'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';
import { Bell } from 'lucide-react';

// Stitch glass top app bar. Logo + desktop nav + notifications, sticky with backdrop blur.
// On mobile the primary nav lives in the bottom bar, so the desktop <nav> is hidden below md.
const NAV: { href: Route; label: string }[] = [
  { href: '/' as Route, label: 'Home' },
  { href: '/orders' as Route, label: 'Orders' },
  { href: '/messages' as Route, label: 'Messages' },
  { href: '/support' as Route, label: 'Support' },
];

export function TopBar({ signOutAction }: { signOutAction: () => Promise<void> }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <header className="glass-nav shadow-level-1 sticky top-0 z-50 w-full">
      <div className="px-margin-mobile md:px-margin-desktop max-w-max-width mx-auto flex w-full items-center justify-between py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="font-heading text-headline-lg-mobile md:text-headline-lg text-primary font-bold">
            BorderPass
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {NAV.map(({ href, label }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`pb-1 transition-colors ${
                  active
                    ? 'text-primary border-primary border-b-2 font-bold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Notifications"
            className="text-primary hover:bg-surface-variant/40 focus-visible:ring-primary rounded-full p-2 transition-colors focus-visible:outline-none focus-visible:ring-2"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
          </button>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-on-surface-variant hover:text-on-surface rounded-full px-3 py-2 text-sm underline underline-offset-2 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
