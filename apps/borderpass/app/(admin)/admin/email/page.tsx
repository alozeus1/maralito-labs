// Deliverability — email delivery status per notification (from the outbox + Resend webhook) and the
// bounce/complaint suppression list. Read-only staff view; addresses are never shown (suppression is
// stored as hashes). Status is always labeled, never colour-only.
import { MailCheck, Send, MailX, ShieldAlert, AlertTriangle, Ban } from 'lucide-react';
import { StatusChip } from '../../../_components/StatusChip';
import { adminEmailOverview } from '../../../actions/admin-email';
import { humanizeStatus, formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

function StatTile({
  icon: Icon,
  value,
  label,
  tone = 'neutral',
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
  tone?: 'neutral' | 'good' | 'active' | 'issue';
}) {
  const accent = {
    neutral: 'text-on-surface',
    good: 'text-tertiary',
    active: 'text-primary',
    issue: 'text-error',
  }[tone];
  const chip = {
    neutral: 'bg-surface-dim text-on-surface-variant',
    good: 'bg-tertiary/10 text-tertiary',
    active: 'bg-primary/10 text-primary',
    issue: 'bg-error/10 text-error',
  }[tone];
  return (
    <div className="bg-surface-container-lowest shadow-level-1 p-md rounded-xl">
      <span className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full ${chip}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className={`font-heading block text-3xl ${accent}`}>{value}</span>
      <span className="text-on-surface-variant text-sm">{label}</span>
    </div>
  );
}

// Delivery status → chip tone. delivered → success; bounced/complained/failed → error; queued/sent/
// sending/delayed → active; anything else neutral.
function emailTone(status: string): 'success' | 'active' | 'neutral' | 'error' {
  if (status === 'delivered') return 'success';
  if (['bounced', 'complained', 'failed'].includes(status)) return 'error';
  if (['queued', 'sending', 'sent', 'delivery_delayed'].includes(status)) return 'active';
  return 'neutral';
}

export default async function AdminEmailPage() {
  const res = await adminEmailOverview();
  const data = res.ok ? res.data : null;
  const c = data?.counts ?? {};

  return (
    <main className="px-margin-mobile md:px-margin-desktop max-w-max-width py-md mx-auto">
      <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg mb-1">
        Deliverability
      </h1>
      <p className="text-on-surface-variant text-body-md mb-md">
        Transactional email status from the outbox and Resend delivery events.
      </p>

      {data === null && (
        <div className="bg-surface-container-lowest shadow-level-1 p-lg rounded-xl text-center">
          <p className="text-on-surface-variant text-body-md">
            Email status isn’t available right now.
          </p>
        </div>
      )}

      {data && (
        <>
          <section className="gap-gutter mb-lg grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <StatTile
              icon={MailCheck}
              value={String(c.delivered ?? 0)}
              label="Delivered"
              tone="good"
            />
            <StatTile
              icon={Send}
              value={String(c.sent ?? 0)}
              label="Sent (accepted)"
              tone="active"
            />
            <StatTile icon={MailX} value={String(c.bounced ?? 0)} label="Bounced" tone="issue" />
            <StatTile
              icon={ShieldAlert}
              value={String(c.complained ?? 0)}
              label="Complaints"
              tone="issue"
            />
            <StatTile
              icon={AlertTriangle}
              value={String(c.failed ?? 0)}
              label="Failed"
              tone="issue"
            />
            <StatTile
              icon={Ban}
              value={String(data.suppressions.count)}
              label="Suppressed"
              tone={data.suppressions.count > 0 ? 'issue' : 'neutral'}
            />
          </section>

          <section className="bg-surface-container-lowest shadow-level-1 rounded-xl">
            <h2 className="font-heading text-headline-md p-md pb-3">Recent notifications</h2>
            {data.recent.length === 0 ? (
              <p className="text-on-surface-variant p-md text-body-md pt-0">Nothing sent yet.</p>
            ) : (
              <ul className="divide-outline/10 divide-y">
                {data.recent.map((r) => (
                  <li key={r.id} className="px-md flex items-center justify-between gap-3 py-3">
                    <span className="min-w-0">
                      <span className="font-heading text-on-surface block truncate">
                        {r.orderRef}
                      </span>
                      <span className="text-on-surface-variant block text-sm">
                        {humanizeStatus(r.templateKey)} ·{' '}
                        {formatDateTime(r.lastEventAt ?? r.createdAt)}
                      </span>
                    </span>
                    <StatusChip tone={emailTone(r.status)}>{humanizeStatus(r.status)}</StatusChip>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {data.suppressions.recent.length > 0 && (
            <section className="bg-surface-container-lowest shadow-level-1 mt-lg rounded-xl">
              <h2 className="font-heading text-headline-md p-md pb-1">Suppression list</h2>
              <p className="text-on-surface-variant px-md pb-3 text-sm">
                Recipients that bounced or complained are not re-mailed. Addresses are stored hashed
                and never shown.
              </p>
              <ul className="divide-outline/10 divide-y">
                {data.suppressions.recent.map((sup, i) => (
                  <li key={i} className="px-md flex items-center justify-between gap-3 py-2.5">
                    <StatusChip tone="error">{humanizeStatus(sup.reason)}</StatusChip>
                    <span className="text-on-surface-variant text-sm">
                      {formatDateTime(sup.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
