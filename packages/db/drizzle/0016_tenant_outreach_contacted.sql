ALTER TABLE "tenants"
ADD COLUMN IF NOT EXISTS "outreach_contacted_at" timestamp with time zone;
