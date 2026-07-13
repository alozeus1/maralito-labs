'use server';
import { getServerSupabase } from '@/server/supabase';
import { auditSignIn } from '@/server/auth-events';
import { provisionAuthenticatedUser } from '@/server/provisioning';

type Result = { ok: true } | { ok: false; error: string };

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
    await auditSignIn(data.user.id, true);
    return { ok: true };
  } catch {
    return { ok: false, error: 'unavailable' };
  }
}
