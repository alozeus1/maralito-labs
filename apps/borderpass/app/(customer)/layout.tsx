import { redirect } from 'next/navigation';
import { getAppSession } from '@/server/auth';
import { requireCustomerAccess } from '@maralito/auth';
import { auditAccessDenied, signOut } from '@/server/auth-events';
import { guardSession } from '@/server/session-guard';
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

  // Session registry gate (Node runtime — middleware.ts is Edge and cannot reach the database).
  // Returns null and does NO work unless BORDERPASS_SESSION_ENFORCEMENT === 'on'; once on it is
  // fail-closed, so expired / revoked / device-limit-evicted / unverifiable sessions are denied.
  // The precise reason is in the audit log; the URL carries only a coarse marker.
  // NOTE: `redirect()` throws a Next control-flow signal — it must stay outside any try/catch.
  if (await guardSession({ surface: 'customer', authUserId: session.sub, orgId: session.orgId })) {
    redirect('/login?reason=session');
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
