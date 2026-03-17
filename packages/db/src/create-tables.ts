import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
config({ path: '../../.env' });

async function main() {
    const sql = neon(process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL!);
    console.log('Creating tables via raw SQL...');
    try {
        // Enums
        await sql`CREATE TYPE "plan" AS ENUM('free', 'pro', 'enterprise');`.catch(() => { });
        await sql`CREATE TYPE "role" AS ENUM('producer', 'distributor', 'buyer', 'admin');`.catch(() => { });
        await sql`CREATE TYPE "sale_unit" AS ENUM('kg', 'g', 'unit', 'box', 'dozen', 'bunch');`.catch(() => { });
        await sql`CREATE TYPE "order_status" AS ENUM('draft', 'confirmed', 'payment_authorized', 'awaiting_weight', 'picking', 'ready_for_dispatch', 'in_transit', 'delivered', 'cancelled');`.catch(() => { });

        // Tables
        await sql`
            CREATE TABLE IF NOT EXISTS "tenants" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "slug" text UNIQUE NOT NULL,
                "name" text NOT NULL,
                "plan" "plan" DEFAULT 'free' NOT NULL,
                "geo_region" geometry(Point, 4326),
                "created_at" timestamp with time zone DEFAULT now() NOT NULL
            );
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS "user" (
                "id" text PRIMARY KEY,
                "tenant_id" uuid REFERENCES "tenants"("id"),
                "name" text NOT NULL,
                "email" text UNIQUE NOT NULL,
                "emailVerified" boolean NOT NULL,
                "image" text,
                "createdAt" timestamp NOT NULL,
                "updatedAt" timestamp NOT NULL,
                "role" "role" DEFAULT 'buyer' NOT NULL
            );
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS "session" (
                "id" text PRIMARY KEY,
                "expiresAt" timestamp NOT NULL,
                "token" text UNIQUE NOT NULL,
                "createdAt" timestamp NOT NULL,
                "updatedAt" timestamp NOT NULL,
                "ipAddress" text,
                "userAgent" text,
                "userId" text NOT NULL REFERENCES "user"("id")
            );
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS "account" (
                "id" text PRIMARY KEY,
                "accountId" text NOT NULL,
                "providerId" text NOT NULL,
                "userId" text NOT NULL REFERENCES "user"("id"),
                "accessToken" text,
                "refreshToken" text,
                "idToken" text,
                "accessTokenExpiresAt" timestamp,
                "refreshTokenExpiresAt" timestamp,
                "scope" text,
                "password" text,
                "createdAt" timestamp NOT NULL,
                "updatedAt" timestamp NOT NULL
            );
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS "verification" (
                "id" text PRIMARY KEY,
                "identifier" text NOT NULL,
                "value" text NOT NULL,
                "expiresAt" timestamp NOT NULL,
                "createdAt" timestamp,
                "updatedAt" timestamp
            );
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS "farms" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
                "name" text NOT NULL,
                "location" geometry(Point, 4326),
                "address" text,
                "certifications" text[],
                "min_order_value" numeric(10, 2) DEFAULT '0' NOT NULL,
                "free_shipping_threshold" numeric(10, 2),
                "created_at" timestamp with time zone DEFAULT now() NOT NULL
            );
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS "product_categories" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "slug" text UNIQUE NOT NULL,
                "name" text NOT NULL,
                "parent_id" uuid,
                "seo_description" text,
                "created_at" timestamp with time zone DEFAULT now() NOT NULL
            );
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS "products" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
                "farm_id" uuid NOT NULL REFERENCES "farms"("id"),
                "category_id" uuid NOT NULL REFERENCES "product_categories"("id"),
                "sku" text,
                "name" text NOT NULL,
                "sale_unit" "sale_unit" NOT NULL,
                "unit_weight_g" integer,
                "price_per_unit" numeric(12, 4) NOT NULL,
                "min_order_qty" numeric(10, 3) NOT NULL,
                "origin_location" geometry(Point, 4326),
                "images" text[],
                "is_active" boolean DEFAULT true NOT NULL,
                "created_at" timestamp with time zone DEFAULT now() NOT NULL
            );
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS "product_lots" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "product_id" uuid NOT NULL REFERENCES "products"("id"),
                "lot_code" text NOT NULL,
                "harvest_date" date NOT NULL,
                "expiry_date" date NOT NULL,
                "available_qty" numeric(12, 3) NOT NULL,
                "reserved_qty" numeric(12, 3) DEFAULT '0' NOT NULL,
                "price_override" numeric(12, 4),
                "freshness_score" integer,
                "storage_location" text,
                "is_expired" boolean DEFAULT false NOT NULL,
                "created_at" timestamp with time zone DEFAULT now() NOT NULL
            );
        `;

        console.log('Tables created successfully!');
    } catch (e) {
        console.error('Failed to create tables:', e);
        process.exit(1);
    }
}

main();
