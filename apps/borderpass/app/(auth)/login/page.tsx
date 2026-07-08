'use client';
import { useState } from 'react';
import { createSupabaseBrowserClient } from '@maralito/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  const client = () =>
    createSupabaseBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const { error } = await client().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) setErr('Could not send sign-in link. Please try again.');
    else setSent(true);
  }

  // Google OAuth: redirects to Google, then back to /auth/callback?code=... which the existing
  // callback exchanges for a session + provisions (same path as magic-link). Requires the Google
  // provider to be enabled in Supabase Auth. Provisioning is identical, so no other app change needed.
  async function signInWithGoogle() {
    setErr('');
    const { error } = await client().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) setErr('Could not start Google sign-in. Please try again.');
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="font-heading text-2xl">Sign in</h1>
      {sent ? (
        <p className="text-on-surface-variant mt-3">Check your email for a sign-in link.</p>
      ) : (
        <>
          <form onSubmit={submit} className="mt-4 space-y-3">
            <label htmlFor="email" className="block text-sm">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-surface-variant w-full rounded-md p-3"
            />
            <button type="submit" className="bg-primary text-on-primary w-full rounded-3xl p-3">
              Send link
            </button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <span className="border-outline/40 h-px flex-1 border-t" />
            <span className="text-on-surface-variant text-xs">or</span>
            <span className="border-outline/40 h-px flex-1 border-t" />
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            className="border-outline flex w-full items-center justify-center gap-2 rounded-3xl border p-3 font-medium"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.52 12.27c0-.82-.07-1.6-.2-2.36H12v4.48h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.75Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.29a12 12 0 0 0 0 10.76l3.98-3.1Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.1C6.22 6.86 8.87 4.75 12 4.75Z"
              />
            </svg>
            Continue with Google
          </button>
        </>
      )}
      {err && (
        <p role="alert" className="text-error mt-3 text-sm">
          {err}
        </p>
      )}
    </main>
  );
}
