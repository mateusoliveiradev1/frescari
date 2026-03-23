DO $$
BEGIN
    CREATE TYPE "public"."producer_legal_entity_type" AS ENUM('PF', 'PJ');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "tenants"
ADD COLUMN "producer_legal_entity_type" "producer_legal_entity_type";
--> statement-breakpoint

ALTER TABLE "tenants"
ADD COLUMN "producer_document_id" text;
--> statement-breakpoint

ALTER TABLE "tenants"
ADD COLUMN "producer_legal_name" text;
--> statement-breakpoint

ALTER TABLE "tenants"
ADD COLUMN "producer_contact_name" text;
--> statement-breakpoint

ALTER TABLE "tenants"
ADD COLUMN "producer_phone" text;
--> statement-breakpoint

ALTER TABLE "tenants"
ADD COLUMN "producer_profile_completed_at" timestamp with time zone;
