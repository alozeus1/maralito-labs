// Profile — real account settings (name, language, notification channels) + sign out.
import { redirect } from 'next/navigation';
import { signOut } from '@/server/auth-events';
import { getLocale } from '@/server/locale';
import { getMessages } from '@/i18n';
import { getMyProfile } from '../../actions/profile';
import { ProfileForm } from './ProfileForm';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const res = await getMyProfile();
  const profile = res.ok ? res.data : null;
  const m = getMessages(await getLocale());

  async function signOutAction() {
    'use server';
    await signOut();
    redirect('/login');
  }

  return (
    <main className="px-margin-mobile py-md md:py-lg mx-auto max-w-2xl">
      <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg text-on-surface mb-md">
        {m.profile.title}
      </h1>
      <ProfileForm
        initial={profile ?? { display_name: 'Customer', language: 'es', channels: ['email'] }}
        messages={m.profile}
        signOutLabel={m.nav.signOut}
        signOutAction={signOutAction}
      />
    </main>
  );
}
