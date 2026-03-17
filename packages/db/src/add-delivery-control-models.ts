/**
 * One-shot migration: adds delivery control tower persistence models.
 *
 * Run with: npx tsx packages/db/src/add-delivery-control-models.ts
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

    console.log('[MIGRATION] Creating delivery control tower models...');

    await client.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fleet_vehicle_type') THEN
                CREATE TYPE fleet_vehicle_type AS ENUM (
                    'motorcycle',
                    'car',
                    'pickup',
                    'van',
                    'refrigerated_van',
                    'truck',
                    'refrigerated_truck'
                );
            END IF;
        END
        $$;
    `);

    await client.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fleet_vehicle_status') THEN
                CREATE TYPE fleet_vehicle_status AS ENUM (
                    'available',
                    'in_use',
                    'maintenance',
                    'offline'
                );
            END IF;
        END
        $$;
    `);

    await client.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispatch_confidence') THEN
                CREATE TYPE dispatch_confidence AS ENUM ('high', 'medium', 'low');
            END IF;
        END
        $$;
    `);

    await client.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispatch_override_action') THEN
                CREATE TYPE dispatch_override_action AS ENUM ('pin_to_top', 'delay');
            END IF;
        END
        $$;
    `);

    await client.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispatch_override_reason') THEN
                CREATE TYPE dispatch_override_reason AS ENUM (
                    'customer_priority',
                    'delivery_window',
                    'vehicle_load',
                    'address_issue',
                    'awaiting_picking',
                    'commercial_decision',
                    'other'
                );
            END IF;
        END
        $$;
    `);

    await client.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispatch_wave_status') THEN
                CREATE TYPE dispatch_wave_status AS ENUM ('confirmed', 'departed', 'cancelled');
            END IF;
        END
        $$;
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS farm_vehicles (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id uuid NOT NULL REFERENCES tenants(id),
            farm_id uuid NOT NULL REFERENCES farms(id),
            label text NOT NULL,
            vehicle_type fleet_vehicle_type NOT NULL,
            capacity_kg numeric(10, 3) NOT NULL,
            refrigeration boolean NOT NULL DEFAULT false,
            availability_status fleet_vehicle_status NOT NULL DEFAULT 'available',
            notes text,
            created_at timestamp with time zone NOT NULL DEFAULT now(),
            updated_at timestamp with time zone NOT NULL DEFAULT now()
        );
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS delivery_dispatch_overrides (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id uuid NOT NULL REFERENCES tenants(id),
            order_id uuid NOT NULL REFERENCES orders(id),
            operation_date date NOT NULL,
            action dispatch_override_action NOT NULL,
            reason dispatch_override_reason NOT NULL,
            reason_notes text,
            created_by_user_id text NOT NULL REFERENCES "user"(id),
            created_at timestamp with time zone NOT NULL DEFAULT now(),
            cleared_at timestamp with time zone
        );
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS delivery_dispatch_waves (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id uuid NOT NULL REFERENCES tenants(id),
            farm_id uuid REFERENCES farms(id),
            operation_date date NOT NULL,
            status dispatch_wave_status NOT NULL DEFAULT 'confirmed',
            confidence dispatch_confidence NOT NULL,
            recommended_vehicle_type fleet_vehicle_type NOT NULL,
            selected_vehicle_id uuid REFERENCES farm_vehicles(id),
            selected_vehicle_label text,
            recommendation_summary text NOT NULL,
            recommendation_snapshot jsonb,
            confirmed_by_user_id text NOT NULL REFERENCES "user"(id),
            confirmed_at timestamp with time zone NOT NULL DEFAULT now(),
            departed_at timestamp with time zone,
            cancelled_at timestamp with time zone
        );
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS delivery_dispatch_wave_orders (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            wave_id uuid NOT NULL REFERENCES delivery_dispatch_waves(id),
            order_id uuid NOT NULL REFERENCES orders(id),
            sequence integer NOT NULL,
            priority_score integer NOT NULL,
            created_at timestamp with time zone NOT NULL DEFAULT now()
        );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS farm_vehicles_tenant_idx ON farm_vehicles (tenant_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS farm_vehicles_farm_idx ON farm_vehicles (farm_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS farm_vehicles_status_idx ON farm_vehicles (availability_status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS delivery_dispatch_overrides_tenant_idx ON delivery_dispatch_overrides (tenant_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS delivery_dispatch_overrides_order_idx ON delivery_dispatch_overrides (order_id);`);
    await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS delivery_dispatch_overrides_active_unique
        ON delivery_dispatch_overrides (tenant_id, order_id, operation_date)
        WHERE cleared_at IS NULL;
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS delivery_dispatch_waves_tenant_idx ON delivery_dispatch_waves (tenant_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS delivery_dispatch_waves_farm_idx ON delivery_dispatch_waves (farm_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS delivery_dispatch_waves_operation_idx ON delivery_dispatch_waves (operation_date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS delivery_dispatch_wave_orders_wave_idx ON delivery_dispatch_wave_orders (wave_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS delivery_dispatch_wave_orders_order_idx ON delivery_dispatch_wave_orders (order_id);`);
    await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS delivery_dispatch_wave_orders_wave_order_unique
        ON delivery_dispatch_wave_orders (wave_id, order_id);
    `);

    console.log('[MIGRATION] Done.');
    await client.end();
}

migrate().catch((err) => {
    console.error('[MIGRATION] Failed:', err);
    process.exit(1);
});
