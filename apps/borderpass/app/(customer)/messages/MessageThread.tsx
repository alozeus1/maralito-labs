'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Loader2 } from 'lucide-react';
import { sendMessage, type MessageView } from '../../actions/messages';

// Real concierge thread: renders the customer's messages and a composer that posts via the
// RLS-scoped sendMessage action. Optimistic append + router.refresh() to reconcile with the server.
export function MessageThread({
  initial,
  labels: t,
}: {
  initial: MessageView[];
  labels: { placeholder: string; send: string; emptyThread: string; sendError: string };
}) {
  const router = useRouter();
  const [items, setItems] = useState<MessageView[]>(initial);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setError('');
    setSending(true);
    const optimistic: MessageView = {
      id: `pending-${items.length}`,
      sender_role: 'customer',
      body: text,
      image_url: null,
      created_at: new Date(0).toISOString(),
    };
    setItems((prev) => [...prev, optimistic]);
    setBody('');
    try {
      const res = await sendMessage({ body: text });
      if (res.ok) {
        router.refresh();
      } else {
        setItems((prev) => prev.filter((m) => m.id !== optimistic.id));
        setError(t.sendError);
        setBody(text);
      }
    } catch {
      setItems((prev) => prev.filter((m) => m.id !== optimistic.id));
      setError(t.sendError);
      setBody(text);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-surface-container-lowest shadow-level-1 mt-md flex flex-col rounded-xl">
      <div className="p-md min-h-[8rem] space-y-3" aria-live="polite">
        {items.length === 0 ? (
          <p className="text-on-surface-variant text-body-md py-6 text-center">{t.emptyThread}</p>
        ) : (
          items.map((mmsg) => {
            const mine = mmsg.sender_role === 'customer';
            return (
              <div
                key={mmsg.id}
                className={`flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}
              >
                {mmsg.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                  <img
                    src={mmsg.image_url}
                    alt="Shared photo"
                    className="max-w-[80%] rounded-2xl object-cover"
                  />
                )}
                {mmsg.body && (
                  <p
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                      mine
                        ? 'bg-primary text-on-primary rounded-br-sm'
                        : 'bg-surface-variant text-on-surface rounded-bl-sm'
                    }`}
                  >
                    {mmsg.body}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {error && (
        <p role="alert" className="text-error px-md text-sm">
          {error}
        </p>
      )}

      <form
        onSubmit={submit}
        className="border-outline-variant/60 flex items-center gap-2 border-t p-3"
      >
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t.placeholder}
          className="bg-surface-variant focus-visible:ring-primary flex-grow rounded-full px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          aria-label={t.send}
          className="bg-primary text-on-primary btn-tactile hover:bg-primary-container hover:text-on-primary-container focus-visible:ring-primary flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </form>
    </div>
  );
}
