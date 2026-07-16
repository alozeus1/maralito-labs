import 'server-only';
import { z } from 'zod';

// Public (browser-safe) Supabase config is exposed via NEXT_PUBLIC_*.
// Service role + DB url are server-only and never reach the client bundle.
const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  // Public by design (browser-safe). Phase 5 client confirmation (Stripe Elements). pk_test_ in dev.
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1).optional(),
  // KMS key-encryption key for PII envelope encryption (ADR-0012/0015). 32 bytes, base64 or hex.
  // Optional so dev builds don't break; address/PII code paths fail closed when absent.
  BORDERPASS_KMS_KEY: z.string().min(1).optional(),
  BORDERPASS_APP_URL: z.string().url().optional(),
  // Where the post-delivery review-request email CTA points (e.g. a Google/Trustpilot review page).
  // Optional — falls back to the order page under BORDERPASS_APP_URL when unset.
  BORDERPASS_REVIEW_URL: z.string().url().optional(),
  // n8n automation: order-event webhook (e.g. review-request workflow). Optional — events are a
  // no-op when the URL is absent. The secret is sent as X-BorderPass-Secret for the workflow to check.
  N8N_ORDER_EVENTS_WEBHOOK_URL: z.string().url().optional(),
  N8N_WEBHOOK_SECRET: z.string().min(1).optional(),
  // ---- Resend transactional email (server-only; never NEXT_PUBLIC). All optional so dev builds don't
  // break; the send boundary fails closed when the key/From are absent. See src/server/resend.ts. ----
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().min(1).optional(), // legacy single From (fallback for EMAIL_FROM_DEFAULT)
  RESEND_WEBHOOK_SECRET: z.string().min(1).optional(), // Svix signing secret for /api/webhooks/resend
  // Verified-domain sender registry (notifications.maralito.uk). "Name <addr@domain>".
  EMAIL_FROM_DEFAULT: z.string().min(1).optional(),
  EMAIL_FROM_AUTH: z.string().min(1).optional(),
  EMAIL_FROM_ORDERS: z.string().min(1).optional(),
  EMAIL_FROM_SECURITY: z.string().min(1).optional(),
  EMAIL_FROM_SUPPORT: z.string().min(1).optional(),
  EMAIL_REPLY_TO: z.string().min(1).optional(), // monitored reply address (e.g. support@maralito.uk)
  // 'false' hard-disables sending (default enabled). Set 'false' in Preview/Development.
  EMAIL_DELIVERY_ENABLED: z.enum(['true', 'false']).optional(),
  EMAIL_SAFE_RECIPIENT: z.string().min(1).optional(), // redirect ALL recipients here (preview/dev safety)
  BORDERPASS_ENV: z.enum(['local', 'preview', 'staging', 'production']).default('local'),
  MARALITO_PLATFORM_ENV: z.string().optional(),
  // ---- Stripe (Phase 4, server-only). All optional so dev builds don't break; Stripe code paths
  // fail closed at call time (loadStripeConfig) when required secrets are absent. ----
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_API_VERSION: z.string().optional(),
  STRIPE_PAYMENT_CURRENCY: z.string().optional(),
  STRIPE_SUCCESS_URL: z.string().url().optional(),
  STRIPE_CANCEL_URL: z.string().url().optional(),
});

let cached: z.infer<typeof serverSchema> | null = null;
/** Lazy parse so build doesn't fail when envs are absent; throws clearly at first server use. */
export function getServerEnv() {
  if (!cached) cached = serverSchema.parse(process.env);
  return cached;
}
