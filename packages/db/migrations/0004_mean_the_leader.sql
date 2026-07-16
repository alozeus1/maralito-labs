CREATE TABLE "email_suppressions" (
	"id" text PRIMARY KEY NOT NULL,
	"email_hash" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resend_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"svix_id" text NOT NULL,
	"event_type" text NOT NULL,
	"provider_message_id" text,
	"processing_status" text DEFAULT 'received' NOT NULL,
	"processed_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD COLUMN "provider_message_id" text;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD COLUMN "last_event_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "email_suppressions_hash_uq" ON "email_suppressions" USING btree ("email_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "resend_webhook_events_svix_uq" ON "resend_webhook_events" USING btree ("svix_id");--> statement-breakpoint
CREATE INDEX "resend_webhook_events_type_idx" ON "resend_webhook_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "resend_webhook_events_provider_idx" ON "resend_webhook_events" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX "notification_outbox_provider_idx" ON "notification_outbox" USING btree ("provider_message_id");