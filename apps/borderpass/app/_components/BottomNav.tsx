'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';
import { Home, Package2, MessageCircle, LifeBuoy, User, type LucideIcon } from 'lucide-react';
import type { Messages } from '@/i18n';

// Stitch mobile bottom tab bar (Home / Orders / Messages / Support / Profile). Hidden on md+
// where the top bar carries navigation. Active state derives from the current path.
export function BottomNav({ nav }: { nav: Messages['nav'] }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  const tabs: { href: Route; label: string; icon: LucideIcon }[] = [
    { href: '/' as Route, label: nav.home, icon: Home },
    { href: '/orders' as Route, label: nav.orders, icon: Package2 },
    { href: '/messages' as Route, label: nav.messages, icon: MessageCircle },
    { href: '/support' as Route, label: nav.support, icon: LifeBuoy },
    { href: '/profile' as Route, label: nav.profile, icon: User },
  ];

  return (
    <nav
      aria-label="Primary"
      className="shadow-nav-top bg-surface fixed bottom-0 left-0 z-50 flex w-full items-center justify-around rounded-t-lg px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:hidden"
    >
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`focus-visible:ring-primary flex flex-col items-center justify-center rounded-xl px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 ${
              active
                ? 'bg-primary-container/20 text-on-primary-container'
                : 'text-on-surface-variant hover:bg-surface-variant/50'
            }`}
          >
            <Icon className="mb-1 h-6 w-6" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
            <span className="text-label-md">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
