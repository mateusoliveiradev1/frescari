ALTER TABLE "tenants"
ADD COLUMN IF NOT EXISTS "storefront_photo_url" text,
ADD COLUMN IF NOT EXISTS "storefront_bio" text;
