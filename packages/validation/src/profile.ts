import { z } from 'zod';
import { Locale } from './primitives';

const NotificationPrefs = z.object({
  channels: z.array(z.enum(['email', 'sms', 'whatsapp', 'in_app'])).optional(),
  quietHours: z.object({ start: z.string(), end: z.string(), tz: z.string() }).optional(),
});

export const ProfileCreate = z.object({
  display_name: z.string().trim().min(1).max(120),
  language: Locale.default('es'),
  notification_prefs: NotificationPrefs.optional(),
});
export const ProfileUpdate = ProfileCreate.partial();
export type ProfileCreate = z.infer<typeof ProfileCreate>;
export type ProfileUpdate = z.infer<typeof ProfileUpdate>;
