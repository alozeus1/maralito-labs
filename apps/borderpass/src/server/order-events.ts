import 'server-only';
import { getServerEnv } from './env';

/**
 * Order domain-event emitter. Builds the event envelope and, when an n8n webhook is configured,
 * POSTs it so automations (e.g. the post-delivery review-request workflow) can react.
 *
 * PII-light by design: the payload carries only ids + type + timestamp — never customer PII. An
 * automation that needs contact details resolves them via a secured BorderPass API, not this event.
 * Non-blocking and fail-open: a webhook error or timeout never breaks the order transition.
 */
export async function emitOrderEvent(type: string, data: Record<string, unknown>): Promise<void> {
  const envelope = {
    id: `evt_${Date.now()}`,
    type,
    version: 1,
    source: 'borderpass',
    data,
    occurred_at: new Date().toISOString(),
  };

  const env = getServerEnv();
  const url = env.N8N_ORDER_EVENTS_WEBHOOK_URL;
  if (!url) return; // not configured → envelope-shape placeholder only

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(env.N8N_WEBHOOK_SECRET ? { 'x-borderpass-secret': env.N8N_WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify(envelope),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Fail-open: never let webhook delivery failure roll back a completed order transition.
  }
}
