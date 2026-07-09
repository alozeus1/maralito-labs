'use client';
import { useRouter } from 'next/navigation';
import { LOCALE_COOKIE, LOCALES, type Locale } from '@/i18n';

// EN/ES switcher. Writes the bp_locale cookie and refreshes so server components re-render in the
// chosen language. Pill-segmented per DESIGN.md (Deep Navy active state).
export function LocaleToggle({ current }: { current: Locale }) {
  const router = useRouter();
  const set = (l: Locale) => {
    if (l === current) return;
    document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };
  return (
    <div
      role="group"
      aria-label="Language"
      className="bg-surface-variant/70 inline-flex rounded-full p-0.5 text-xs font-bold"
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => set(l)}
          aria-pressed={current === l}
          className={`focus-visible:ring-primary rounded-full px-2.5 py-1 uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 ${
            current === l ? 'bg-secondary text-on-secondary' : 'text-on-surface-variant'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
