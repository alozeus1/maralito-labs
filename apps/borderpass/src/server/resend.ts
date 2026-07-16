import 'server-only';

/**
 * Resend email transport (server-only). Thin wrapper over the Resend REST API — no SDK dependency.
 * This is the single send boundary for the app: From always comes from the server-side verified-domain
 * registry (never caller/client input), every message carries a plain-text alternative + Reply-To +
 * tags, and delivery is gated so preview/dev builds can't email real people.
 *
 * Env (all server-only; never NEXT_PUBLIC):
 *   RESEND_API_KEY            provider key (restricted, per-environment).
 *   EMAIL_FROM_DEFAULT|AUTH|ORDERS|SECURITY|SUPPORT   verified `Name <addr@notifications.maralito.uk>`.
 *   RESEND_FROM_EMAIL         legacy single From — used as a fallback so existing config keeps working.
 *   EMAIL_REPLY_TO            monitored reply address (e.g. support@maralito.uk).
 *   EMAIL_DELIVERY_ENABLED    'false' hard-disables sending (default: enabled). Set 'false' in preview/dev.
 *   EMAIL_SAFE_RECIPIENT      if set, ALL recipients are redirected here (preview/dev safety net).
 *
 * Never logs the recipient, subject, or body. Returns the provider message id for audit/correlation.
 * A provider 200 means ACCEPTED, not delivered — delivery/bounce/complaint arrive via the webhook.
 */
export type EmailKind = 'default' | 'auth' | 'orders' | 'security' | 'support';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative. Auto-derived from `html` when omitted (multipart improves deliverability). */
  text?: string;
  /** Selects the verified From address. Defaults to 'default'. */
  kind?: EmailKind;
  /** Overrides EMAIL_REPLY_TO for this message. */
  replyTo?: string;
  /** Extra Resend tags (sanitized). `application` + `kind` are always added. */
  tags?: Record<string, string>;
}

export type SendEmailResult =
  { ok: true; id: string } | { ok: false; error: string; retryable: boolean };

const FROM_ENV: Record<EmailKind, string> = {
  default: 'EMAIL_FROM_DEFAULT',
  auth: 'EMAIL_FROM_AUTH',
  orders: 'EMAIL_FROM_ORDERS',
  security: 'EMAIL_FROM_SECURITY',
  support: 'EMAIL_FROM_SUPPORT',
};

/** Resolve the verified From for a kind. From ONLY ever comes from server env — never caller input.
 *  Falls back to EMAIL_FROM_DEFAULT, then the legacy RESEND_FROM_EMAIL, so existing config still works. */
function resolveFrom(kind: EmailKind): string | undefined {
  return (
    process.env[FROM_ENV[kind]] ||
    process.env.EMAIL_FROM_DEFAULT ||
    process.env.RESEND_FROM_EMAIL ||
    undefined
  );
}

/** Configured when a key + at least one verified From are present. */
export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!resolveFrom('default');
}

/** Sending is enabled unless EMAIL_DELIVERY_ENABLED is exactly 'false' (so prod keeps sending; set
 *  'false' in preview/dev). Exported so callers/tests can branch on it. */
export function isDeliveryEnabled(): boolean {
  return process.env.EMAIL_DELIVERY_ENABLED !== 'false';
}

// Resend tag names/values allow only ASCII letters, digits, `_` and `-` (≤256 chars).
const TAG_RE = /[^A-Za-z0-9_-]/g;
function tagValue(value: string): string {
  return value.replace(TAG_RE, '_').slice(0, 256) || 'na';
}

/** Minimal HTML→text fallback for the plain-text part when a caller doesn't supply one. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const kind = input.kind ?? 'default';
  const from = resolveFrom(kind);
  if (!apiKey || !from) return { ok: false, error: 'resend_not_configured', retryable: false };

  // Global kill-switch — preview/dev set EMAIL_DELIVERY_ENABLED=false so they never email anyone.
  if (!isDeliveryEnabled()) return { ok: false, error: 'delivery_disabled', retryable: false };

  // Preview/dev safety net: redirect every recipient to an operator address when configured, so a
  // non-production build can't reach a real customer even if delivery is turned on for a smoke test.
  const to = process.env.EMAIL_SAFE_RECIPIENT || input.to;
  const replyTo = input.replyTo || process.env.EMAIL_REPLY_TO;
  const text = input.text ?? htmlToText(input.html);
  const tags = [
    { name: 'application', value: 'borderpass' },
    { name: 'kind', value: tagValue(kind) },
    ...Object.entries(input.tags ?? {}).map(([name, value]) => ({
      name: tagValue(name),
      value: tagValue(value),
    })),
  ];

  let res: Response;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject: input.subject,
        html: input.html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
        tags,
      }),
    });
  } catch {
    console.error(JSON.stringify({ event: 'email_send_error', kind, error: 'network_error' }));
    return { ok: false, error: 'network_error', retryable: true };
  }

  if (res.ok) {
    const d = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: d.id ?? 'unknown' };
  }
  // 429 / 5xx are transient → retryable; 4xx (bad request/auth) are not.
  const retryable = res.status === 429 || res.status >= 500;
  console.error(
    JSON.stringify({ event: 'email_send_failed', kind, status: res.status, retryable }),
  );
  return { ok: false, error: `resend_${res.status}`, retryable };
}
