import { redirect } from 'next/navigation';
import { getAppSession } from '@/server/auth';
import { requireAdminAccess } from '@maralito/auth';
import { auditAccessDenied } from '@/server/auth-events';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  if (!session) redirect('/login');
  try {
    requireAdminAccess(session);
  } catch {
    await auditAccessDenied(session.sub, session.orgId, 'admin');
    redirect('/unauthorized');
  }
  return <div data-shell="admin">{children}</div>;
}
