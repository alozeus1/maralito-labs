'use client';
import { useState } from 'react';
import { requestEmailCode } from '../../actions/auth';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  // Requested through a server action (not the browser Supabase client) so the request POSTs to
  // /sign-up and is rate-limited by the middleware `otpLogin` policy. See actions/auth.ts.
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const res = await requestEmailCode(email);
      if (res.ok) setSent(true);
      else setErr('Could not start sign-up. Please try again.');
    } catch {
      setErr('Sign-up is unavailable right now. Please try again shortly.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="font-heading text-2xl">Create your account</h1>
      {sent ? (
        <p className="text-on-surface-variant mt-3">Check your email to finish signing up.</p>
      ) : (
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
          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-on-primary w-full rounded-3xl p-3 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Sending…' : 'Continue'}
          </button>
          {err && (
            <p role="alert" className="text-error text-sm">
              {err}
            </p>
          )}
        </form>
      )}
    </main>
  );
}
