import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getServerEnv } from '@/server/env';
import { sendOrderReviewRequest } from '@/server/review-request';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Supabase admin API + node crypto — never the edge runtime

/**
 * Automation endpoint: send a post-delivery review-request email for one order. Called by the n8n
 * "Post-Delivery Review Request" workflow after its 1-day wait. FAIL CLOSED on the shared secret
 * (constant-time compare); no secret configured or a mismatch → 401. The order is re-checked to be
 * `delivered` server-side, so a spoofed order_id for a non-delivered order sends nothing.
 */
function secretOk(provided: string | null, expected: string | undefined): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false; // timingSafeEqual requires equal lengths
  return timingSafeEqual(a, b);
}

export async function POST(req: Request): Promise<Response> {
  const env = getServerEnv();
  if (!secretOk(req.headers.get('x-borderpass-secret'), env.N8N_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { order_id?: unknown };
  try {
    body = (await req.json()) as { order_id?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const orderId = typeof body.order_id === 'string' ? body.order_id.trim() : '';
  if (!orderId) return NextResponse.json({ error: 'missing_order_id' }, { status: 400 });

  try {
    const result = await sendOrderReviewRequest(orderId);
    switch (result.status) {
      case 'sent':
        return NextResponse.json({ status: 'sent' }, { status: 200 });
      case 'skipped':
        return NextResponse.json({ status: 'skipped', reason: result.reason }, { status: 200 });
      case 'not_found':
        return NextResponse.json({ status: 'not_found' }, { status: 404 });
      case 'not_deliverable':
        return NextResponse.json({ status: 'not_deliverable' }, { status: 409 });
      case 'send_failed':
        // Retryable transient failure → 503 so n8n retries; permanent → 502.
        return NextResponse.json(
          { status: 'send_failed' },
          { status: result.retryable ? 503 : 502 },
        );
    }
    // Unreachable: the switch above is exhaustive over ReviewRequestResult.
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  } catch {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
