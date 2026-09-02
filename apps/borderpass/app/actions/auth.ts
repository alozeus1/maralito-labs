'use server';
import { headers } from 'next/headers';
import { getServerSupabase } from '@/server/supabase';
import { getServerEnv } from '@/server/env';
import { auditSignIn } from '@/server/auth-events';
import { provisionAuthenticatedUser } from '@/server/provisioning';
import { recordLoginSession } from '@/server/session-guard';

type Result = { ok: true } | { ok: false; error: string };

/**
 * Absolute app origin for the emailed sign-in link (the server has no `location`). Prefers the
 * configured, trusted BORDERPASS_APP_URL — set it in every deployed environment. The forwarded-host
 * fallback only applies when it is unset (local/preview); Supabase's redirect-URL allowlist is the
 * backstop that rejects any host that is not an approved app origin.
 */
async function appOrigin(): Promise<string> {
  const configured = getServerEnv().BORDERPASS_APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

/**
 * Request a sign-in email (6-digit code + magic link). Runs SERVER-SIDE on purpose: as a server
 * action it POSTs back to /login or /sign-up, which is exactly what the middleware `otpLogin`
 * rate-limit rule catches (5 requests / 15 min per client). The previous client-side
 * `signInWithOtp` never traversed the middleware, so OTP requests were unthrottled — an email-cost
 * and abuse vector. The ssr client persists the PKCE verifier cookie, so the emailed link still
 * works in the requesting browser; the code path is device-independent regardless.
 */
export async function requestEmailCode(email: string): Promise<Result> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) return { ok: false, error: 'invalid' };
  try {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: { shouldCreateUser: true, emailRedirectTo: `${await appOrigin()}/auth/callback` },
    });
    if (error) return { ok: false, error: 'send_failed' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'unavailable' };
  }
}

/**
 * Verify a 6-digit email OTP code and establish the session server-side, then provision the user.
 * Device-independent (unlike the PKCE link, which is bound to the browser that requested it): the
 * code is typed into the same app session, so it works even if the email was opened elsewhere.
 */
export async function verifyEmailCode(email: string, code: string): Promise<Result> {
  const cleanEmail = email.trim().toLowerCase();
  const token = code.replace(/\D/g, '');
  if (!cleanEmail || token.length < 6) return { ok: false, error: 'invalid' };
  try {
    const supabase = await getServerSupabase();
    const { data, error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token,
      type: 'email',
    });
    if (error || !data.user) {
      await auditSignIn('unknown', false);
      return { ok: false, error: 'verify_failed' };
    }
    await provisionAuthenticatedUser(data.user.id, data.user.email ?? undefined);
    // Session registry (dark by default). THIS is the primary login path — the 6-digit code typed on
    // /login — so it must register a row or, once the flag is 'on', enforcement would deny every
    // OTP-code user. No-op unless BORDERPASS_SESSION_ENFORCEMENT === 'on'; never rejects, so the
    // surrounding catch can never turn a successful sign-in into a `verify_failed`.
    await recordLoginSession(data.user.id);
    await auditSignIn(data.user.id, true);
    return { ok: true };
  } catch {
    return { ok: false, error: 'unavailable' };
  }
}
