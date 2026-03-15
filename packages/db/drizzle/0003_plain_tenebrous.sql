CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"zipcode" text NOT NULL,
	"street" text NOT NULL,
	"number" text NOT NULL,
	"neighborhood" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"country" text DEFAULT 'BR' NOT NULL,
	"complement" text,
	"formatted_address" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"location" geometry(Point, 4326) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "farms" ADD COLUMN "base_delivery_fee" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "farms" ADD COLUMN "price_per_km" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "farms" ADD COLUMN "max_delivery_radius_km" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "sale_unit" text DEFAULT 'unit' NOT NULL;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_tenant_idx" ON "addresses" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "addresses_one_default_per_tenant" ON "addresses" USING btree ("tenant_id") WHERE "addresses"."is_default" = true;--> statement-breakpoint
CREATE INDEX "addresses_location_gist" ON "addresses" USING gist ("location");
