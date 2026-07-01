import { redirect } from 'next/navigation';
import { getAppSession } from '@/server/auth';
import { requireCustomerAccess } from '@maralito/auth';
import { auditAccessDenied } from '@/server/auth-events';

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  if (!session) redirect('/login');
  try {
    requireCustomerAccess(session);
  } catch {
    await auditAccessDenied(session.sub, session.orgId, 'customer');
    redirect('/unauthorized');
  }
  return <div data-shell="customer">{children}</div>;
}
