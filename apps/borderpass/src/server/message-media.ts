import 'server-only';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServerEnv } from './env';

// Message image storage. Objects live in a PRIVATE `message-media` bucket; the app never exposes a
// public URL — it hands out short-lived signed URLs, and only for messages the caller is RLS-allowed
// to read. All IO goes through the service-role client (server-only), guarded by the calling action.
const BUCKET = 'message-media';
const SIGN_TTL = 60 * 30; // 30 minutes
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

/** True when storage credentials are available (fails closed otherwise). */
export function isMediaConfigured(): boolean {
  return !!getServerEnv().SUPABASE_SERVICE_ROLE_KEY;
}

function client(): SupabaseClient {
  const env = getServerEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('media not configured');
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function ensureBucket(sb: SupabaseClient): Promise<void> {
  const { data } = await sb.storage.listBuckets();
  if (!data?.some((b) => b.name === BUCKET)) {
    await sb.storage.createBucket(BUCKET, { public: false });
  }
}

export type UploadResult =
  | { ok: true; path: string }
  | { ok: false; error: 'not_configured' | 'invalid_type' | 'too_large' | 'upload_failed' };

/** Validate + upload an image into the private bucket. Returns the stored object path. */
export async function uploadMessageImage(
  orgId: string,
  customerId: string,
  file: File,
): Promise<UploadResult> {
  if (!isMediaConfigured()) return { ok: false, error: 'not_configured' };
  const ext = EXT[file.type];
  if (!ext) return { ok: false, error: 'invalid_type' };
  if (file.size > MAX_BYTES) return { ok: false, error: 'too_large' };
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length > MAX_BYTES) return { ok: false, error: 'too_large' };
  const path = `${orgId}/${customerId}/${randomUUID()}.${ext}`;
  const sb = client();
  await ensureBucket(sb);
  const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: file.type });
  if (error) return { ok: false, error: 'upload_failed' };
  return { ok: true, path };
}

/** Short-lived signed URL for a stored object path (null if unavailable). */
export async function signMessageImage(path: string | null): Promise<string | null> {
  if (!path || !isMediaConfigured()) return null;
  const { data } = await client().storage.from(BUCKET).createSignedUrl(path, SIGN_TTL);
  return data?.signedUrl ?? null;
}
