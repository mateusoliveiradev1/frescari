ALTER TABLE "farms"
ADD COLUMN IF NOT EXISTS "delivery_days" smallint[],
ADD COLUMN IF NOT EXISTS "delivery_periods" text[],
ADD COLUMN IF NOT EXISTS "delivery_lead_days" smallint;
