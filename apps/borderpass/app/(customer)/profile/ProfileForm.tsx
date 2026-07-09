'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Check, LogOut } from 'lucide-react';
import { upsertMyProfile } from '../../actions/profile';

// Real profile editor: display name, language (EN/ES), notification channels. Persists via the
// RLS-scoped upsertMyProfile action. No PII beyond the display name the customer chooses.
type Channel = 'email' | 'sms' | 'whatsapp' | 'in_app';
const CHANNELS: { value: Channel; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' },
  { value: 'in_app', label: 'In-app' },
];

export function ProfileForm({
  initial,
  signOutAction,
}: {
  initial: { display_name: string; language: string; channels: string[] };
  signOutAction: () => Promise<void>;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.display_name === 'Customer' ? '' : initial.display_name);
  const [language, setLanguage] = useState<'en' | 'es'>(initial.language === 'en' ? 'en' : 'es');
  const [channels, setChannels] = useState<Set<Channel>>(
    new Set((initial.channels as Channel[]).filter((c) => CHANNELS.some((x) => x.value === c))),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const toggleChannel = (c: Channel) =>
    setChannels((prev) => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next;
    });

  async function save() {
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      const res = await upsertMyProfile({
        display_name: name.trim() || 'Customer',
        language,
        notification_prefs: { channels: [...channels] },
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError('Couldn’t save your changes. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again shortly.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-md">
      <section className="bg-surface-container-lowest shadow-level-1 p-md rounded-xl">
        <h2 className="font-heading text-headline-md text-on-surface mb-4">Your details</h2>
        <label className="block">
          <span className="text-on-surface-variant mb-1 block text-sm">Name</span>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            placeholder="How should we address you?"
            className="bg-surface-variant focus-visible:ring-primary w-full rounded-md p-3 focus-visible:outline-none focus-visible:ring-2"
          />
        </label>

        <div className="mt-4">
          <span className="text-on-surface-variant mb-1 block text-sm">Language</span>
          <div className="bg-surface-variant inline-flex rounded-full p-1">
            {(['es', 'en'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  setLanguage(l);
                  setSaved(false);
                }}
                aria-pressed={language === l}
                className={`focus-visible:ring-primary rounded-full px-5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                  language === l ? 'bg-secondary text-on-secondary' : 'text-on-surface-variant'
                }`}
              >
                {l === 'es' ? 'Español' : 'English'}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-surface-container-lowest shadow-level-1 p-md rounded-xl">
        <h2 className="font-heading text-headline-md text-on-surface mb-1">Notifications</h2>
        <p className="text-on-surface-variant mb-4 text-sm">
          How should we reach you about orders?
        </p>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((c) => {
            const on = channels.has(c.value);
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  toggleChannel(c.value);
                  setSaved(false);
                }}
                aria-pressed={on}
                className={`focus-visible:ring-primary rounded-full border px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                  on
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-outline-variant text-on-surface-variant hover:bg-surface-variant/60'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </section>

      {error && (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="bg-primary text-on-primary btn-tactile hover:bg-primary-container hover:text-on-primary-container focus-visible:ring-primary inline-flex items-center gap-2 rounded-full px-6 py-3 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {saved && !saving && <Check className="h-4 w-4" aria-hidden="true" />}
          {saved && !saving ? 'Saved' : saving ? 'Saving…' : 'Save changes'}
        </button>
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-on-surface-variant hover:text-on-surface inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm underline underline-offset-2 transition-colors"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
