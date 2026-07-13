'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@maralito/auth';
import { verifyEmailCode } from '../../actions/auth';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Missing NEXT_PUBLIC_* (e.g. an env not set on the deployment) makes the browser client throw.
  // Surface that as a real message instead of a silently-dead button.
  const client = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) throw new Error('auth-not-configured');
    return createSupabaseBrowserClient(url, anon);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const { error } = await client().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (error) setErr('Could not send the code. Please try again.');
      else setSent(true);
    } catch {
      setErr('Sign-in is unavailable right now. Please try again shortly.');
    } finally {
      setLoading(false);
    }
  }

  // Verify the 6-digit code server-side (works on any device — no PKCE verifier needed, unlike the
  // emailed link which only works in the browser that requested it).
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setVerifying(true);
    try {
      const res = await verifyEmailCode(email, code);
      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        setErr('That code didn’t work. Check it and try again, or resend.');
        setVerifying(false);
      }
    } catch {
      setErr('Sign-in is unavailable right now. Please try again shortly.');
      setVerifying(false);
    }
  }

  async function signInWithGoogle() {
    setErr('');
    try {
      const { error } = await client().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${location.origin}/auth/callback` },
      });
      if (error) setErr('Could not start Google sign-in. Please try again.');
    } catch {
      setErr('Sign-in is unavailable right now. Please try again shortly.');
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12 sm:max-w-sm">
      <h1 className="font-heading text-2xl sm:text-3xl">Sign in</h1>

      {sent ? (
        <>
          <p className="text-on-surface-variant mt-3 text-sm">
            We emailed <span className="text-on-surface font-medium">{email}</span> a 6-digit code
            and a sign-in link. Enter the code below (works on any device), or tap the link in the
            same browser.
          </p>
          <form onSubmit={verify} className="mt-4 space-y-3">
            <label htmlFor="code" className="block text-sm">
              6-digit code
            </label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="bg-surface-variant focus-visible:ring-primary w-full rounded-md p-3 text-center text-2xl tracking-[0.4em] focus-visible:outline-none focus-visible:ring-2"
            />
            <button
              type="submit"
              disabled={verifying || code.length < 6}
              className="bg-primary text-on-primary hover:bg-primary/90 focus-visible:ring-primary w-full rounded-3xl p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {verifying ? 'Verifying…' : 'Verify & sign in'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setCode('');
            }}
            className="text-on-surface-variant mt-3 text-sm underline underline-offset-2"
          >
            Use a different email
          </button>
        </>
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
              className="bg-surface-variant focus-visible:ring-primary w-full rounded-md p-3 focus-visible:outline-none focus-visible:ring-2"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-primary text-on-primary hover:bg-primary/90 focus-visible:ring-primary w-full rounded-3xl p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Sending…' : 'Send code'}
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
            className="border-outline hover:bg-surface-variant/60 focus-visible:ring-primary flex w-full items-center justify-center gap-2 rounded-3xl border p-3 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
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
