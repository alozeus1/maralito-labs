'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Loader2, Camera, X } from 'lucide-react';
import { sendStaffMessage } from '../../../../../actions/admin-messages';
import type { MessageView } from '../../../../../actions/messages';

// Staff-side concierge thread for an order: view the conversation and send a message + a photo of
// the package (camera on mobile via capture). Posts through the RLS-scoped sendStaffMessage action.
export function StaffMessagePanel({
  orderId,
  initial,
  mediaEnabled,
}: {
  orderId: string;
  initial: MessageView[];
  mediaEnabled: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const pickFile = (f: File | null) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if ((!body.trim() && !file) || sending) return;
    setError('');
    setSending(true);
    const fd = new FormData();
    fd.set('order_id', orderId);
    fd.set('body', body.trim());
    if (file) fd.set('image', file);
    try {
      const res = await sendStaffMessage(fd);
      if (res.ok) {
        setBody('');
        pickFile(null);
        router.refresh();
      } else {
        setError(res.error.message);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="border-outline mt-6 rounded-lg border p-4">
      <h2 className="font-medium">Message customer</h2>
      <div className="mt-3 max-h-80 space-y-3 overflow-y-auto">
        {initial.length === 0 ? (
          <p className="text-on-surface-variant text-sm">No messages yet.</p>
        ) : (
          initial.map((m) => {
            const mine = m.sender_role === 'staff';
            return (
              <div
                key={m.id}
                className={`flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}
              >
                {m.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                  <img src={m.image_url} alt="Shared photo" className="max-w-[70%] rounded-lg" />
                )}
                {m.body && (
                  <p
                    className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${
                      mine ? 'bg-primary text-on-primary' : 'bg-surface-variant text-on-surface'
                    }`}
                  >
                    {m.body}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {preview && (
        <div className="mt-3 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
          <img src={preview} alt="Selected" className="h-16 w-16 rounded object-cover" />
          <button
            type="button"
            onClick={() => pickFile(null)}
            className="text-on-surface-variant inline-flex items-center gap-1 text-sm underline"
          >
            <X className="h-4 w-4" /> Remove
          </button>
        </div>
      )}
      {error && <p className="text-error mt-2 text-sm">{error}</p>}

      <form onSubmit={submit} className="mt-3 flex items-center gap-2">
        {mediaEnabled && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Add photo"
              className="border-outline text-on-surface hover:bg-surface-variant/60 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border"
            >
              <Camera className="h-5 w-5" />
            </button>
          </>
        )}
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message…"
          className="bg-surface-variant flex-grow rounded-full px-4 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={sending || (!body.trim() && !file)}
          aria-label="Send"
          className="bg-primary text-on-primary flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full disabled:opacity-60"
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </form>
    </section>
  );
}
