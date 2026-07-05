import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAppSession } from '@/server/auth';
import { requireCustomerAccess } from '@maralito/auth';
import { auditAccessDenied, signOut } from '@/server/auth-events';

// Phase 8A.2: mobile-first customer shell (header + nav + audited sign-out) over the existing
// auth guard. Session data is never rendered; links are static customer routes only.
export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  if (!session) redirect('/login');
  try {
    requireCustomerAccess(session);
  } catch {
    await auditAccessDenied(session.sub, session.orgId, 'customer');
    redirect('/unauthorized');
  }

  async function signOutAction() {
    'use server';
    await signOut();
    redirect('/login');
  }

  return (
    <div data-shell="customer" className="min-h-screen">
      <header className="border-outline/30 border-b">
        <div className="mx-auto flex max-w-md items-center justify-between px-6 py-3">
          <Link href="/" className="font-heading text-primary py-2 text-xl">
            BorderPass
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-on-surface-variant rounded-3xl px-3 py-2 text-sm underline underline-offset-2"
            >
              Sign out
            </button>
          </form>
        </div>
        <nav aria-label="Customer" className="mx-auto flex max-w-md gap-1 px-4 pb-2">
          <Link href="/" className="rounded-3xl px-4 py-2.5 text-sm font-medium">
            Home
          </Link>
          <Link href="/orders" className="rounded-3xl px-4 py-2.5 text-sm font-medium">
            Orders
          </Link>
          <Link href="/quotes" className="rounded-3xl px-4 py-2.5 text-sm font-medium">
            Quotes
          </Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
