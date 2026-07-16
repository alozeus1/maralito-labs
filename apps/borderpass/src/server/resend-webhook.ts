import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Resend delivery-webhook signature verification. Resend signs webhooks with Svix: an HMAC-SHA256 over
 * `${svix-id}.${svix-timestamp}.${rawBody}`, keyed by the base64 secret after the `whsec_` prefix. The
 * `svix-signature` header carries one or more space-separated `v1,<base64>` signatures. Verification is
 * constant-time and rejects out-of-tolerance timestamps (replay protection). No external Svix SDK.
 */
export interface SvixHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

const TOLERANCE_SEC = 300; // 5-minute clock-skew / replay window

export function verifyResendWebhook(
  payload: string,
  headers: SvixHeaders,
  secret: string,
  nowMs: number = Date.now(),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature || !secret) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(nowMs / 1000 - ts) > TOLERANCE_SEC) return false;

  const b64 = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const key = Buffer.from(b64, 'base64');
  if (key.length === 0) return false;

  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest();

  // The header may list several signatures (e.g. during secret rotation) — any valid one passes.
  for (const part of signature.split(' ')) {
    const comma = part.indexOf(',');
    const sig = comma === -1 ? part : part.slice(comma + 1);
    const provided = Buffer.from(sig, 'base64');
    if (provided.length === expected.length && timingSafeEqual(provided, expected)) return true;
  }
  return false;
}
