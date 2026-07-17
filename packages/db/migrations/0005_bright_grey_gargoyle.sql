CREATE TABLE "payment_disputes" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"payment_id" text NOT NULL,
	"order_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"stripe_dispute_id" text NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"amount_minor" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund_status_history" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"refund_id" text NOT NULL,
	"payment_id" text NOT NULL,
	"order_id" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"provider_event_id" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "refunds" ALTER COLUMN "status" SET DEFAULT 'requested';--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "order_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "quote_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "customer_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "provider" text DEFAULT 'stripe' NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "idempotency_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "payment_disputes" ADD CONSTRAINT "payment_disputes_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_disputes" ADD CONSTRAINT "payment_disputes_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_disputes" ADD CONSTRAINT "payment_disputes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_disputes" ADD CONSTRAINT "payment_disputes_customer_id_customer_profiles_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_status_history" ADD CONSTRAINT "refund_status_history_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_status_history" ADD CONSTRAINT "refund_status_history_refund_id_refunds_id_fk" FOREIGN KEY ("refund_id") REFERENCES "public"."refunds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_status_history" ADD CONSTRAINT "refund_status_history_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_status_history" ADD CONSTRAINT "refund_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_disputes_org_idx" ON "payment_disputes" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "payment_disputes_payment_idx" ON "payment_disputes" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_disputes_stripe_uq" ON "payment_disputes" USING btree ("stripe_dispute_id");--> statement-breakpoint
CREATE INDEX "refund_status_history_refund_idx" ON "refund_status_history" USING btree ("refund_id");--> statement-breakpoint
CREATE INDEX "refund_status_history_payment_idx" ON "refund_status_history" USING btree ("payment_id");--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_customer_id_customer_profiles_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "refunds_org_idx" ON "refunds" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "refunds_order_idx" ON "refunds" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "refunds_customer_idx" ON "refunds" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_provider_key_uq" ON "refunds" USING btree ("provider","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_stripe_refund_uq" ON "refunds" USING btree ("stripe_refund_id") WHERE "refunds"."stripe_refund_id" is not null;