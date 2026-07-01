/**
 * @maralito/notifications — PLACEHOLDER (Phase 0). Resend (email) + Twilio/WhatsApp (SMS/WA).
 * EN/ES, channel select + fallback (WhatsApp→SMS→email), quiet hours, idempotent per event.
 * TODO(phase9): provider adapters + template rendering. WhatsApp templates pre-approved (parallel workstream).
 */
export type Channel = 'email' | 'sms' | 'whatsapp' | 'in_app';
export interface NotificationProvider {
  readonly channel: Channel;
  readonly _placeholder: true;
}
