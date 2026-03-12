CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
UPDATE "farms"
SET "address" = jsonb_build_object(
    'street', trim("address"),
    'number', '',
    'city', '',
    'state', '',
    'postalCode', '',
    'country', 'BR'
)::text
WHERE "address" IS NOT NULL
  AND btrim("address") <> ''
  AND left(ltrim("address"), 1) NOT IN ('{', '[');--> statement-breakpoint
ALTER TABLE "farms"
ALTER COLUMN "address" SET DATA TYPE jsonb
USING CASE
    WHEN "address" IS NULL OR btrim("address") = '' THEN NULL
    WHEN left(ltrim("address"), 1) IN ('{', '[') THEN "address"::jsonb
    ELSE jsonb_build_object(
        'street', trim("address"),
        'number', '',
        'city', '',
        'state', '',
        'postalCode', '',
        'country', 'BR'
    )
END;
