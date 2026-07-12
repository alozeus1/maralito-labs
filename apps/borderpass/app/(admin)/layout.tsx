import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { getAppSession } from '@/server/auth';
import { requireAdminAccess } from '@maralito/auth';
import { auditAccessDenied, signOut } from '@/server/auth-events';

// Staff console shell (Stitch): glass top bar + nav over the admin guard. Session data is never
// rendered. Guarded to staff/admin roles only.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  if (!session) redirect('/login');
  try {
    requireAdminAccess(session);
  } catch {
    await auditAccessDenied(session.sub, session.orgId, 'admin');
    redirect('/unauthorized');
  }

  async function signOutAction() {
    'use server';
    await signOut();
    redirect('/login');
  }

  const nav: { href: Route; label: string }[] = [
    { href: '/admin' as Route, label: 'Dashboard' },
    { href: '/admin/orders' as Route, label: 'Orders' },
  ];

  return (
    <div data-shell="admin" className="min-h-screen">
      <header className="glass-nav shadow-level-1 sticky top-0 z-50 w-full">
        <div className="px-margin-mobile md:px-margin-desktop max-w-max-width mx-auto flex w-full items-center justify-between py-4">
          <Link href={'/admin' as Route} className="flex items-baseline gap-2">
            <span className="font-heading text-primary text-xl font-bold">BorderPass</span>
            <span className="text-on-surface-variant text-label-lg uppercase">Staff</span>
          </Link>
          <nav aria-label="Admin" className="hidden items-center gap-6 sm:flex">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-on-surface-variant hover:text-on-surface"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-on-surface-variant hover:text-on-surface rounded-full px-3 py-2 text-sm underline underline-offset-2"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
