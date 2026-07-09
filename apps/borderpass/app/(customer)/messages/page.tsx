import { MessageCircle } from 'lucide-react';
import { ComingSoon } from '../../_components/ComingSoon';

export default function MessagesPage() {
  return (
    <ComingSoon
      title="Messages"
      blurb="Chat with your concierge about any order. We’re building secure messaging next."
      icon={MessageCircle}
    />
  );
}
