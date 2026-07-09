import { redirect } from 'next/navigation';
import { getAppSession } from '@/server/auth';
import { requireCustomerAccess } from '@maralito/auth';
import { auditAccessDenied, signOut } from '@/server/auth-events';
import { getLocale } from '@/server/locale';
import { getMessages } from '@/i18n';
import { TopBar } from '../_components/TopBar';
import { BottomNav } from '../_components/BottomNav';

// Customer shell (Stitch): glass top bar + mobile bottom tab nav over the auth guard.
// Session data is never rendered; navigation targets are static customer routes only.
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

  const locale = await getLocale();
  const { nav } = getMessages(locale);

  return (
    <div data-shell="customer" className="min-h-screen pb-28 md:pb-0">
      <TopBar signOutAction={signOutAction} locale={locale} nav={nav} />
      {children}
      <BottomNav nav={nav} />
    </div>
  );
}
