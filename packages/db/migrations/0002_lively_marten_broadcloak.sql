CREATE TABLE "addresses" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"kind" text DEFAULT 'delivery' NOT NULL,
	"label" text,
	"country" text,
	"recipient_enc" text NOT NULL,
	"line1_enc" text NOT NULL,
	"line2_enc" text,
	"city_enc" text NOT NULL,
	"state_enc" text NOT NULL,
	"postal_enc" text NOT NULL,
	"phone_enc" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_customer_id_customer_profiles_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_customer_idx" ON "addresses" USING btree ("customer_id");