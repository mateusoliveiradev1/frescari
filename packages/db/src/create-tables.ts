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
        await sql`CREATE TYPE "notification_type" AS ENUM('lot_expiring_soon', 'lot_expired', 'order_awaiting_weight', 'order_confirmed', 'order_cancelled', 'order_ready_for_dispatch', 'delivery_in_transit', 'delivery_delayed', 'delivery_delivered');`.catch(() => { });
        await sql`CREATE TYPE "notification_scope" AS ENUM('inventory', 'sales', 'orders', 'deliveries', 'platform');`.catch(() => { });
        await sql`CREATE TYPE "notification_severity" AS ENUM('info', 'warning', 'critical');`.catch(() => { });
        await sql`CREATE TYPE "notification_entity_type" AS ENUM('lot', 'order');`.catch(() => { });

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

        await sql`
            CREATE TABLE IF NOT EXISTS "notifications" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
                "user_id" text NOT NULL REFERENCES "user"("id"),
                "recipient_role" "role" NOT NULL,
                "type" "notification_type" NOT NULL,
                "scope" "notification_scope" NOT NULL,
                "severity" "notification_severity" DEFAULT 'info' NOT NULL,
                "entity_type" "notification_entity_type" NOT NULL,
                "entity_id" uuid NOT NULL,
                "title" text NOT NULL,
                "body" text NOT NULL,
                "href" text NOT NULL,
                "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
                "dedupe_key" text NOT NULL,
                "read_at" timestamp with time zone,
                "created_at" timestamp with time zone DEFAULT now() NOT NULL
            );
        `;

        await sql`
            CREATE INDEX IF NOT EXISTS "notifications_user_created_idx"
            ON "notifications" ("user_id", "created_at" DESC);
        `;
        await sql`
            CREATE INDEX IF NOT EXISTS "notifications_user_unread_idx"
            ON "notifications" ("user_id", "read_at", "created_at" DESC);
        `;
        await sql`
            CREATE INDEX IF NOT EXISTS "notifications_tenant_role_created_idx"
            ON "notifications" ("tenant_id", "recipient_role", "created_at" DESC);
        `;
        await sql`
            CREATE UNIQUE INDEX IF NOT EXISTS "notifications_user_dedupe_unique"
            ON "notifications" ("user_id", "dedupe_key");
        `;

        await sql`
            ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
        `.catch(() => { });
        await sql`
            ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;
        `.catch(() => { });

        await sql`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_policies
                    WHERE schemaname = 'public'
                      AND tablename = 'notifications'
                      AND policyname = 'notifications_select_policy'
                ) THEN
                    CREATE POLICY "notifications_select_policy" ON "notifications"
                        FOR SELECT
                        USING (
                            current_setting('app.bypass_rls', true) = 'on'
                            OR (
                                "user_id" = nullif(current_setting('app.current_user', true), '')
                                AND "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                            )
                        );
                END IF;
            END
            $$;
        `;

        await sql`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_policies
                    WHERE schemaname = 'public'
                      AND tablename = 'notifications'
                      AND policyname = 'notifications_insert_policy'
                ) THEN
                    CREATE POLICY "notifications_insert_policy" ON "notifications"
                        FOR INSERT
                        WITH CHECK (
                            current_setting('app.bypass_rls', true) = 'on'
                            OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                        );
                END IF;
            END
            $$;
        `;

        await sql`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_policies
                    WHERE schemaname = 'public'
                      AND tablename = 'notifications'
                      AND policyname = 'notifications_update_policy'
                ) THEN
                    CREATE POLICY "notifications_update_policy" ON "notifications"
                        FOR UPDATE
                        USING (
                            current_setting('app.bypass_rls', true) = 'on'
                            OR (
                                "user_id" = nullif(current_setting('app.current_user', true), '')
                                AND "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                            )
                        )
                        WITH CHECK (
                            current_setting('app.bypass_rls', true) = 'on'
                            OR (
                                "user_id" = nullif(current_setting('app.current_user', true), '')
                                AND "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                            )
                        );
                END IF;
            END
            $$;
        `;

        await sql`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_policies
                    WHERE schemaname = 'public'
                      AND tablename = 'notifications'
                      AND policyname = 'notifications_delete_policy'
                ) THEN
                    CREATE POLICY "notifications_delete_policy" ON "notifications"
                        FOR DELETE
                        USING (current_setting('app.bypass_rls', true) = 'on');
                END IF;
            END
            $$;
        `;

        console.log('Tables created successfully!');
    } catch (e) {
        console.error('Failed to create tables:', e);
        process.exit(1);
    }
}

main();
