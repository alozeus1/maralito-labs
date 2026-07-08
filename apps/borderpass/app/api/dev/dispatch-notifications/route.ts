import { NextResponse } from 'next/server';
import { dispatchQueuedNotifications } from '@/server/notification-dispatch';

export const dynamic = 'force-dynamic';

/**
 * Phase 8C — DEV-ONLY trigger for the notification-outbox dispatcher, using a SYNTHETIC recipient.
 *
 * - Returns 404 in production (never exposed on a real deployment).
 * - Sends ALL queued rows to `DEV_SYNTHETIC_NOTIFY_EMAIL` — a synthetic, operator-controlled address.
 *   It NEVER resolves a real customer's email; real-recipient dispatch stays gated on Phase 8B (KMS),
 *   per the dispatcher's PII gate.
 * - No-op (returns a zeroed summary) unless Resend is configured (`RESEND_API_KEY`+`RESEND_FROM_EMAIL`)
 *   and `BORDERPASS_APP_URL` is set (for absolute email links).
 *
 *   curl -X POST http://localhost:3000/api/dev/dispatch-notifications
 */
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not found', { status: 404 });
  }
  const to = process.env.DEV_SYNTHETIC_NOTIFY_EMAIL;
  if (!to) {
    return NextResponse.json(
      { error: 'Set DEV_SYNTHETIC_NOTIFY_EMAIL to a synthetic address to run a dev dispatch.' },
      { status: 400 },
    );
  }
  const base = process.env.BORDERPASS_APP_URL;
  const summary = await dispatchQueuedNotifications({
    resolveRecipient: async () => to, // SYNTHETIC only — never a real customer address
    ...(base ? { appBaseUrl: base } : {}),
  });
  return NextResponse.json(summary);
}
