import 'server-only';
import { timingSafeEqual } from 'node:crypto';

/**
 * Phase 8C — shared fail-closed authentication for automation (n8n) HTTP endpoints.
 *
 * Automation callers (the n8n workflows) authenticate with a single shared secret sent in the
 * `x-borderpass-secret` header, compared against `N8N_WEBHOOK_SECRET`. The comparison is constant-time
 * (`timingSafeEqual`) to avoid leaking the secret via response timing, and it FAILS CLOSED: if no
 * secret is configured on the server, or no header is provided, or the lengths differ, it returns
 * false. Never logs either value.
 *
 * This is the single source of truth for that check so every automation route (dispatch, status
 * callback, review-request) behaves identically and is covered by one unit test.
 */
export function secretOk(
  provided: string | null | undefined,
  expected: string | undefined,
): boolean {
  if (!expected || !provided) return false; // no configured secret or no header → deny
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false; // timingSafeEqual requires equal-length buffers
  return timingSafeEqual(a, b);
}
