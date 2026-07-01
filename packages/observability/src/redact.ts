/** Keys whose values must never be persisted (secrets / sensitive doc content). */
const SECRET_KEY = /(pass(word)?|token|secret|api[_-]?key|authorization|cookie|card|cvv|ssn|rfc|kyc|document|file)/i;
const REDACTED = '[REDACTED]';

/** Recursively redact secret-ish values by key name. Pure. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET_KEY.test(k) ? REDACTED : redact(v, depth + 1);
  }
  return out;
}
