/**
 * Egress sanitiser — the single choke point every observability payload passes through before it
 * leaves the process (network transport OR stdout log line).
 *
 * Three independent layers, applied in order, because each catches what the others cannot:
 *
 *  1. KEY layer (this file)   — masks values by *key name* for names `redact.ts` does not cover
 *                               (email/phone/address/OTP/raw bodies/DSNs/connection strings…).
 *  2. VALUE layer (this file) — masks secrets/PII that appear inside *string values* regardless of
 *                               the key (a DB URL inside an error message, a JWT in a stack frame,
 *                               a card PAN in a free-text field). Key-name redaction cannot see these.
 *  3. `redact()` (redact.ts)  — the pre-existing, audit-log-proven gate, applied LAST so it is the
 *                               final authority. Its behaviour is NOT modified here, only consumed.
 *
 * Also enforces hard shape caps (depth / array length / key count / string length) so a raw request
 * body or a giant provider response can never be shipped wholesale.
 *
 * Pure + total: never throws, never mutates its input.
 */
import { redact } from './redact';

export const REDACTED = '[REDACTED]';

/** Hard caps. Deliberately small — observability payloads are signals, not data dumps. */
export const SANITIZE_LIMITS = {
  maxDepth: 6,
  maxStringLength: 512,
  maxArrayItems: 20,
  maxKeys: 40,
} as const;

/* ------------------------------------------------------------------ key layer */

/**
 * Short, ambiguous names matched as WHOLE tokens only (`pin` must not match `shipping`,
 * `raw` must not match `drawer`).
 */
const DENY_TOKENS = new Set([
  'otp',
  'pin',
  'dob',
  'pan',
  'jwt',
  'dsn',
  'raw',
  'ssn',
  'cvv',
  'cvc',
  'iban',
  'clabe',
  'curp',
  'rfc',
  'body',
  'payload',
  'bearer',
  'session',
  'nip',
  'seed',
]);

/** Longer, unambiguous names matched anywhere in the normalised key. */
const DENY_SUBSTRINGS = [
  'email',
  'phone',
  'mobile',
  'whatsapp',
  'address',
  'birth',
  'passport',
  'licen', // licence / license
  'credential',
  'connectionstring',
  'databaseurl',
  'accountnumber',
  'routingnumber',
  'recipient',
  'postal',
  'zipcode',
  'latitude',
  'longitude',
  'fullname',
  'firstname',
  'lastname',
  'givenname',
  'surname',
  'requestbody',
  'rawbody',
] as const;

/**
 * Opaque-identifier escape hatch: `*_id` / `*_ref` are references, not the sensitive value itself
 * (e.g. the ADR-0012 opaque `delivery_address_ref`, or a Resend `email_id`). They skip THIS layer
 * only — `redact()` still runs over them afterwards, so `token_id`, `api_key_id`, etc. stay masked.
 */
const IDENTIFIER_SUFFIX =
  /(_|\b)(id|ids|ref|refs|key_id|count|status|state|valid|ok|enabled|present|configured|reachable|missing|verified)$/i;

function normaliseKey(key: string): string {
  return key.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

function tokenise(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((t) => t.toLowerCase());
}

/** True when this key name must never carry a value off-box (beyond what `redact()` already masks). */
export function isSensitiveKey(key: string): boolean {
  if (IDENTIFIER_SUFFIX.test(key)) return false;
  const normalised = normaliseKey(key);
  if (DENY_SUBSTRINGS.some((term) => normalised.includes(term))) return true;
  return tokenise(key).some((token) => DENY_TOKENS.has(token));
}

/* ---------------------------------------------------------------- value layer */

const LUHN_CANDIDATE = /\b(?:\d[ -]?){12,18}\d\b/g;

/** Luhn check so 13–19 digit runs that are NOT card numbers (ids, timestamps) survive. */
function looksLikeCardNumber(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    const code = digits.charCodeAt(i) - 48;
    if (code < 0 || code > 9) return false;
    let d = code;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * Ordered value-level rules. Order matters: broader credential-bearing URL forms run before the
 * narrower e-mail rule, which would otherwise chew the `user:pass@host` userinfo segment.
 */
const VALUE_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  // Database / broker connection strings (with or without credentials).
  [
    /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|rediss?|amqps?|mssql|clickhouse):\/\/\S+/gi,
    '[REDACTED_DB_URL]',
  ],
  // Any URL carrying userinfo credentials, incl. Sentry DSNs (https://<key>@host/<project>).
  [/\b[a-z][a-z0-9+.-]*:\/\/[^\s/@:]+:[^\s/@]*@\S*/gi, '[REDACTED_URL_CREDENTIALS]'],
  [/\bhttps?:\/\/[A-Za-z0-9]{8,}@[^\s/]+\/\d+\S*/gi, '[REDACTED_DSN]'],
  // JSON Web Tokens (Supabase anon/service-role keys, Stripe/OIDC bearer tokens…).
  [/\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g, '[REDACTED_JWT]'],
  // Provider secret-key prefixes. Deliberately excludes Stripe object ids (pi_/cus_/ch_/evt_…),
  // which are safe and load-bearing for debugging.
  [
    /\b(?:sk|rk|whsec|re|shpss|xox[baprs]|ghp|gho|ghu|ghs|github_pat|glpat)[_-][A-Za-z0-9_-]{8,}/g,
    '[REDACTED_KEY]',
  ],
  [/\b(?:AKIA|ASIA)[0-9A-Z]{12,}\b/g, '[REDACTED_KEY]'],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, 'Bearer [REDACTED]'],
  [/\bBasic\s+[A-Za-z0-9+/=]{8,}/gi, 'Basic [REDACTED]'],
  // Stripe-style webhook signature header, then any long hex digest (HMAC/sha256).
  [/\bt=\d{9,},\s*v1=[a-f0-9]{32,}/gi, '[REDACTED_SIGNATURE]'],
  [/\b[a-f0-9]{40,}\b/gi, '[REDACTED_HEX]'],
  // E.164 phone numbers.
  [/(?<![\w.])\+\d{8,15}\b/g, '[REDACTED_PHONE]'],
  // E-mail addresses (customer PII).
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]'],
];

/** Mask secrets/PII embedded in a free-text string, then truncate. Never throws. */
export function scrubString(
  input: string,
  maxLength: number = SANITIZE_LIMITS.maxStringLength,
): string {
  let out = input;
  try {
    for (const [pattern, replacement] of VALUE_RULES) {
      pattern.lastIndex = 0;
      out = out.replace(pattern, replacement);
    }
    LUHN_CANDIDATE.lastIndex = 0;
    out = out.replace(LUHN_CANDIDATE, (match) =>
      looksLikeCardNumber(match.replace(/[ -]/g, '')) ? '[REDACTED_PAN]' : match,
    );
  } catch {
    return REDACTED; // a pathological input must not take the caller down
  }
  return out.length > maxLength ? `${out.slice(0, maxLength)}…[truncated]` : out;
}

/* ------------------------------------------------------------------- traversal */

function walk(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value ?? null;
  const t = typeof value;
  if (t === 'string') return scrubString(value as string);
  if (t === 'number') return Number.isFinite(value as number) ? value : String(value);
  if (t === 'boolean') return value;
  if (t === 'bigint') return `${(value as bigint).toString()}n`;
  if (t === 'function' || t === 'symbol') return `[${t}]`;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return { name: value.name, message: scrubString(value.message) };
  }
  if (depth >= SANITIZE_LIMITS.maxDepth) return '[max_depth]';

  if (Array.isArray(value)) {
    const items = value.slice(0, SANITIZE_LIMITS.maxArrayItems).map((v) => walk(v, depth + 1));
    if (value.length > SANITIZE_LIMITS.maxArrayItems) items.push('[truncated]');
    return items;
  }

  // Plain-ish object. Anything exotic (Map/Set/class instance) degrades to its own entries.
  const entries = Object.entries(value as Record<string, unknown>);
  const out: Record<string, unknown> = {};
  let n = 0;
  for (const [k, v] of entries) {
    if (n >= SANITIZE_LIMITS.maxKeys) {
      out._truncated_keys = true;
      break;
    }
    // A boolean cannot carry a secret, so presence/health flags (`sentry_dsn_present`,
    // `kms_configured`, `signature_valid`) survive this layer. `redact()` still runs over them.
    const maskByKey = typeof v !== 'boolean' && isSensitiveKey(k);
    out[k] = maskByKey ? REDACTED : walk(v, depth + 1);
    n++;
  }
  return out;
}

/**
 * Sanitise an arbitrary value for egress.
 *
 * FINAL STEP is `redact()` — the existing, audit-proven gate — so nothing can reach a transport
 * without passing through it.
 */
export function sanitize(value: unknown): unknown {
  try {
    return redact(walk(value, 0));
  } catch {
    return REDACTED;
  }
}

/** Sanitise a `Record` and keep the record type (convenience for tags/extra/data bags). */
export function sanitizeRecord(
  value: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!value) return {};
  const out = sanitize(value);
  return out && typeof out === 'object' && !Array.isArray(out)
    ? (out as Record<string, unknown>)
    : {};
}
