import { User } from 'lucide-react';
import { ComingSoon } from '../../_components/ComingSoon';

export default function ProfilePage() {
  return (
    <ComingSoon
      title="Profile"
      blurb="Manage your details, language, and notification preferences. Editing arrives soon."
      icon={User}
    />
  );
}
