ALTER TABLE "tenants"
ADD COLUMN IF NOT EXISTS "stripe_details_submitted" boolean,
ADD COLUMN IF NOT EXISTS "stripe_charges_enabled" boolean,
ADD COLUMN IF NOT EXISTS "stripe_payouts_enabled" boolean,
ADD COLUMN IF NOT EXISTS "stripe_requirements_currently_due" text[],
ADD COLUMN IF NOT EXISTS "stripe_requirements_eventually_due" text[],
ADD COLUMN IF NOT EXISTS "stripe_requirements_past_due" text[],
ADD COLUMN IF NOT EXISTS "stripe_requirements_disabled_reason" text,
ADD COLUMN IF NOT EXISTS "stripe_status_synced_at" timestamp with time zone;
