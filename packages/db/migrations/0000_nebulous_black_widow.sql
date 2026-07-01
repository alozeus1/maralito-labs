CREATE TABLE IF NOT EXISTS "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'customer_tenant' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_identities" (
	"id" text PRIMARY KEY NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"org_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_identities_auth_user_id_unique" UNIQUE("auth_user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"org_id" text NOT NULL,
	"display_name" text NOT NULL,
	"language" text DEFAULT 'es' NOT NULL,
	"notification_prefs" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_profiles_auth_user_id_unique" UNIQUE("auth_user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staff_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"org_id" text NOT NULL,
	"display_name" text NOT NULL,
	"role_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_profiles_auth_user_id_unique" UNIQUE("auth_user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permissions" (
	"key" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_permissions" (
	"role_key" text NOT NULL,
	"permission_key" text NOT NULL,
	CONSTRAINT "role_permissions_role_key_permission_key_pk" PRIMARY KEY("role_key","permission_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roles" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"scope" text DEFAULT 'app' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"org_id" text NOT NULL,
	"role_key" text NOT NULL,
	"assigned_by" uuid,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"actor_user_id" uuid,
	"actor_role" text,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"metadata" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"description" text NOT NULL,
	"product_url" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"variant" text,
	"unit_value" jsonb NOT NULL,
	"category" text,
	"restriction_flags" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"order_ref" text NOT NULL,
	"customer_id" text NOT NULL,
	"org_id" text NOT NULL,
	"service_type" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"purpose" text,
	"declared_value" jsonb,
	"risk_band" text,
	"current_quote_id" text,
	"delivery_address_id" text,
	"hub_address_id" text,
	"correlation_id" text NOT NULL,
	"workflow_run_id" text,
	"submitted_at" timestamp with time zone,
	"cancelled_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quote_approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"quote_id" text NOT NULL,
	"approver_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"reason" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quote_line_items" (
	"id" text PRIMARY KEY NOT NULL,
	"quote_id" text NOT NULL,
	"kind" text NOT NULL,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_amount_minor" integer NOT NULL,
	"total_amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"taxable" boolean DEFAULT false NOT NULL,
	"customer_visible" boolean DEFAULT true NOT NULL,
	"internal_only" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quote_status_history" (
	"id" text PRIMARY KEY NOT NULL,
	"quote_id" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"actor_user_id" uuid,
	"actor_role" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quotes" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"org_id" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"subtotal_minor" integer DEFAULT 0 NOT NULL,
	"service_fee_minor" integer DEFAULT 0 NOT NULL,
	"delivery_fee_minor" integer DEFAULT 0 NOT NULL,
	"estimated_tax_minor" integer DEFAULT 0 NOT NULL,
	"inspection_fee_minor" integer DEFAULT 0 NOT NULL,
	"discount_minor" integer DEFAULT 0 NOT NULL,
	"total_minor" integer DEFAULT 0 NOT NULL,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	"decline_reason" text,
	"internal_notes" text,
	"customer_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_events" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"payment_id" text NOT NULL,
	"order_id" text NOT NULL,
	"quote_id" text NOT NULL,
	"event_type" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"provider" text DEFAULT 'stripe' NOT NULL,
	"provider_event_id" text,
	"payload_summary" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"order_id" text NOT NULL,
	"quote_id" text NOT NULL,
	"provider" text DEFAULT 'stripe' NOT NULL,
	"status" text DEFAULT 'requires_payment' NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"stripe_customer_id" text,
	"stripe_payment_intent_id" text,
	"stripe_checkout_session_id" text,
	"idempotency_key" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refunds" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"payment_id" text NOT NULL,
	"stripe_refund_id" text,
	"amount_minor" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'placeholder' NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stripe_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"stripe_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"api_version" text,
	"livemode" boolean DEFAULT false NOT NULL,
	"processing_status" text DEFAULT 'received' NOT NULL,
	"processed_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"order_id" text NOT NULL,
	"payment_id" text,
	"inspection_id" text,
	"delivery_prep_id" text,
	"channel" text NOT NULL,
	"template_key" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inspection_status_history" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"inspection_id" text NOT NULL,
	"order_id" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"actor_user_id" text,
	"actor_role" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inspections" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"order_id" text NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"result" text,
	"staff_notes" text,
	"customer_summary" text,
	"scheduled_for" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "delivery_prep_status_history" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"delivery_prep_id" text NOT NULL,
	"order_id" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"actor_user_id" text,
	"actor_role" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "delivery_preparations" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"order_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"delivery_address_ref" text,
	"scheduled_window_start" timestamp with time zone,
	"scheduled_window_end" timestamp with time zone,
	"staff_notes" text,
	"customer_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_key_roles_key_fk" FOREIGN KEY ("role_key") REFERENCES "public"."roles"("key") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_key_permissions_key_fk" FOREIGN KEY ("permission_key") REFERENCES "public"."permissions"("key") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_key_roles_key_fk" FOREIGN KEY ("role_key") REFERENCES "public"."roles"("key") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customer_profiles_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_approvals" ADD CONSTRAINT "quote_approvals_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_status_history" ADD CONSTRAINT "quote_status_history_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotes" ADD CONSTRAINT "quotes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_customer_profiles_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotes" ADD CONSTRAINT "quotes_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customer_profiles_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refunds" ADD CONSTRAINT "refunds_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_customer_id_customer_profiles_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_delivery_prep_id_delivery_preparations_id_fk" FOREIGN KEY ("delivery_prep_id") REFERENCES "public"."delivery_preparations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inspection_status_history" ADD CONSTRAINT "inspection_status_history_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inspection_status_history" ADD CONSTRAINT "inspection_status_history_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inspection_status_history" ADD CONSTRAINT "inspection_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inspections" ADD CONSTRAINT "inspections_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inspections" ADD CONSTRAINT "inspections_customer_id_customer_profiles_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inspections" ADD CONSTRAINT "inspections_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delivery_prep_status_history" ADD CONSTRAINT "delivery_prep_status_history_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delivery_prep_status_history" ADD CONSTRAINT "delivery_prep_status_history_delivery_prep_id_delivery_preparations_id_fk" FOREIGN KEY ("delivery_prep_id") REFERENCES "public"."delivery_preparations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delivery_prep_status_history" ADD CONSTRAINT "delivery_prep_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delivery_preparations" ADD CONSTRAINT "delivery_preparations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delivery_preparations" ADD CONSTRAINT "delivery_preparations_customer_id_customer_profiles_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delivery_preparations" ADD CONSTRAINT "delivery_preparations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_identities_org_idx" ON "user_identities" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_profiles_org_idx" ON "customer_profiles" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_profiles_org_idx" ON "staff_profiles" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_profiles_status_idx" ON "staff_profiles" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_role_idx" ON "role_permissions" USING btree ("role_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_perm_idx" ON "role_permissions" USING btree ("permission_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_user_org_role_uq" ON "user_roles" USING btree ("auth_user_id","org_id","role_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_user_idx" ON "user_roles" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_role_idx" ON "user_roles" USING btree ("role_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_org_idx" ON "user_roles" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_actor_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_org_idx" ON "audit_logs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_ref_uq" ON "orders" USING btree ("order_ref");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_customer_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_queue_idx" ON "orders" USING btree ("org_id","status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_correlation_idx" ON "orders" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_risk_idx" ON "orders" USING btree ("org_id","risk_band");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quote_approvals_quote_idx" ON "quote_approvals" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quote_line_items_quote_idx" ON "quote_line_items" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quote_status_history_quote_idx" ON "quote_status_history" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_order_idx" ON "quotes" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_queue_idx" ON "quotes" USING btree ("org_id","status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_customer_idx" ON "quotes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_expires_idx" ON "quotes" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "quotes_order_version_uq" ON "quotes" USING btree ("order_id","version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_events_payment_idx" ON "payment_events" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_events_order_idx" ON "payment_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_org_idx" ON "payments" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_customer_idx" ON "payments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_quote_idx" ON "payments" USING btree ("quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_provider_key_uq" ON "payments" USING btree ("provider","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_intent_uq" ON "payments" USING btree ("stripe_payment_intent_id") WHERE "payments"."stripe_payment_intent_id" is not null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refunds_payment_idx" ON "refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stripe_webhook_events_event_uq" ON "stripe_webhook_events" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_webhook_events_type_idx" ON "stripe_webhook_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_outbox_org_idx" ON "notification_outbox" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_outbox_customer_idx" ON "notification_outbox" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_outbox_order_idx" ON "notification_outbox" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_outbox_payment_idx" ON "notification_outbox" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_outbox_idem_uq" ON "notification_outbox" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inspection_status_history_inspection_idx" ON "inspection_status_history" USING btree ("inspection_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inspections_org_idx" ON "inspections" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inspections_customer_idx" ON "inspections" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inspections_order_idx" ON "inspections" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inspections_queue_idx" ON "inspections" USING btree ("org_id","status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_prep_status_history_prep_idx" ON "delivery_prep_status_history" USING btree ("delivery_prep_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_preparations_org_idx" ON "delivery_preparations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_preparations_customer_idx" ON "delivery_preparations" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_preparations_order_idx" ON "delivery_preparations" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_preparations_queue_idx" ON "delivery_preparations" USING btree ("org_id","status","created_at");