/**
 * One-shot migration: adds notification persistence models and RLS policies.
 *
 * Run with: npx tsx packages/db/src/add-notification-models.ts
 */
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const envCandidates = [
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(scriptDir, '../../.env'),
    path.resolve(process.cwd(), '.env'),
];

for (const envPath of envCandidates) {
    config({ path: envPath, override: false, quiet: true });
    if (process.env.DATABASE_URL || process.env.DATABASE_ADMIN_URL) {
        break;
    }
}

async function migrate() {
    const { client } = await import('./index');

    console.log('[MIGRATION] Creating notification models...');

    await client.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
                CREATE TYPE notification_type AS ENUM (
                    'lot_expiring_soon',
                    'lot_expired',
                    'order_awaiting_weight',
                    'order_confirmed',
                    'order_cancelled',
                    'order_ready_for_dispatch',
                    'delivery_in_transit',
                    'delivery_delayed',
                    'delivery_delivered'
                );
            END IF;
        END
        $$;
    `);

    await client.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_scope') THEN
                CREATE TYPE notification_scope AS ENUM (
                    'inventory',
                    'sales',
                    'orders',
                    'deliveries',
                    'platform'
                );
            END IF;
        END
        $$;
    `);

    await client.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_severity') THEN
                CREATE TYPE notification_severity AS ENUM ('info', 'warning', 'critical');
            END IF;
        END
        $$;
    `);

    await client.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_entity_type') THEN
                CREATE TYPE notification_entity_type AS ENUM ('lot', 'order');
            END IF;
        END
        $$;
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS notifications (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id uuid NOT NULL REFERENCES tenants(id),
            user_id text NOT NULL REFERENCES "user"(id),
            recipient_role role NOT NULL,
            type notification_type NOT NULL,
            scope notification_scope NOT NULL,
            severity notification_severity NOT NULL DEFAULT 'info',
            entity_type notification_entity_type NOT NULL,
            entity_id uuid NOT NULL,
            title text NOT NULL,
            body text NOT NULL,
            href text NOT NULL,
            metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
            dedupe_key text NOT NULL,
            read_at timestamp with time zone,
            created_at timestamp with time zone NOT NULL DEFAULT now()
        );
    `);

    await client.query(`
        CREATE INDEX IF NOT EXISTS notifications_user_created_idx
        ON notifications (user_id, created_at DESC);
    `);
    await client.query(`
        CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
        ON notifications (user_id, read_at, created_at DESC);
    `);
    await client.query(`
        CREATE INDEX IF NOT EXISTS notifications_tenant_role_created_idx
        ON notifications (tenant_id, recipient_role, created_at DESC);
    `);
    await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedupe_unique
        ON notifications (user_id, dedupe_key);
    `);

    await client.query(`
        ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
    `);
    await client.query(`
        ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
    `);

    await client.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_policies
                WHERE schemaname = 'public'
                  AND tablename = 'notifications'
                  AND policyname = 'notifications_select_policy'
            ) THEN
                CREATE POLICY notifications_select_policy ON notifications
                    FOR SELECT
                    USING (
                        current_setting('app.bypass_rls', true) = 'on'
                        OR (
                            user_id = nullif(current_setting('app.current_user', true), '')
                            AND tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
                        )
                    );
            END IF;
        END
        $$;
    `);

    await client.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_policies
                WHERE schemaname = 'public'
                  AND tablename = 'notifications'
                  AND policyname = 'notifications_insert_policy'
            ) THEN
                CREATE POLICY notifications_insert_policy ON notifications
                    FOR INSERT
                    WITH CHECK (
                        current_setting('app.bypass_rls', true) = 'on'
                        OR tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
                    );
            END IF;
        END
        $$;
    `);

    await client.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_policies
                WHERE schemaname = 'public'
                  AND tablename = 'notifications'
                  AND policyname = 'notifications_update_policy'
            ) THEN
                CREATE POLICY notifications_update_policy ON notifications
                    FOR UPDATE
                    USING (
                        current_setting('app.bypass_rls', true) = 'on'
                        OR (
                            user_id = nullif(current_setting('app.current_user', true), '')
                            AND tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
                        )
                    )
                    WITH CHECK (
                        current_setting('app.bypass_rls', true) = 'on'
                        OR (
                            user_id = nullif(current_setting('app.current_user', true), '')
                            AND tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
                        )
                    );
            END IF;
        END
        $$;
    `);

    await client.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_policies
                WHERE schemaname = 'public'
                  AND tablename = 'notifications'
                  AND policyname = 'notifications_delete_policy'
            ) THEN
                CREATE POLICY notifications_delete_policy ON notifications
                    FOR DELETE
                    USING (current_setting('app.bypass_rls', true) = 'on');
            END IF;
        END
        $$;
    `);

    console.log('[MIGRATION] Done.');
    await client.end();
}

migrate().catch((err) => {
    console.error('[MIGRATION] Failed:', err);
    process.exit(1);
});
