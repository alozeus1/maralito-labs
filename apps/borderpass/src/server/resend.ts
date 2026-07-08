import 'server-only';

/**
 * Phase 8C — Resend email transport (server-only). Thin wrapper over the Resend REST API. No SDK
 * dependency. Reads `RESEND_API_KEY` + `RESEND_FROM_EMAIL` from the server env. Never logs the body
 * or the recipient. Returns a discriminated result; callers decide retry/mark-failed.
 *
 * NOTE: sending to a REAL customer address is real PII and stays gated on Phase 8B (KMS) — see
 * `notification-dispatch.ts`. This transport itself is provider-agnostic plumbing and is safe to
 * use with synthetic recipients in dev.
 */
export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export type SendEmailResult =
  { ok: true; id: string } | { ok: false; error: string; retryable: boolean };

export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM_EMAIL;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { ok: false, error: 'resend_not_configured', retryable: false };

  let res: Response;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
      }),
    });
  } catch {
    return { ok: false, error: 'network_error', retryable: true };
  }

  if (res.ok) {
    const d = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: d.id ?? 'unknown' };
  }
  // 429 / 5xx are transient → retryable; 4xx (bad request/auth) are not.
  const retryable = res.status === 429 || res.status >= 500;
  return { ok: false, error: `resend_${res.status}`, retryable };
}
