import { Pool } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate as runMigrate } from 'drizzle-orm/neon-serverless/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import path from 'path';

config({ path: path.resolve(__dirname, '../../.env') });

const connectionString =
    process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_ADMIN_URL or DATABASE_URL is required to run database migrations.');
}

const migrationsFolder = path.resolve(__dirname, './drizzle');
const migrationsTable = '__drizzle_migrations';
const migrationsSchema = 'drizzle';
const systemTables = new Set([
    migrationsTable,
    'spatial_ref_sys',
    'geometry_columns',
    'geography_columns',
]);
const pool = new Pool({ connectionString });
const db = drizzle(pool);

type TableRow = {
    table_name: string;
};

type ColumnRow = {
    table_name: string;
    column_name: string;
    data_type: string;
    udt_name: string | null;
};

async function getMigrationEntryCount() {
    const { rows } = await pool.query<TableRow>(
        `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = $1
              AND table_name = $2
            LIMIT 1;
        `,
        [migrationsSchema, migrationsTable],
    );

    if (rows.length === 0) {
        return null;
    }

    const countResult = await pool.query<{ count: string }>(
        `
            SELECT count(*)::text AS count
            FROM "${migrationsSchema}"."${migrationsTable}";
        `,
    );

    return Number(countResult.rows[0]?.count ?? '0');
}

async function getPublicTables() {
    const { rows } = await pool.query<TableRow>(
        `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `,
    );

    return rows.map((row) => row.table_name);
}

async function detectLegacyBaselineIndex() {
    const publicTables = await getPublicTables();
    const appTables = publicTables.filter((table) => !systemTables.has(table));

    if (appTables.length === 0) {
        return null;
    }

    const hasCoreSchema = ['tenants', 'farms', 'products', 'orders'].every((table) =>
        publicTables.includes(table),
    );

    if (!hasCoreSchema) {
        throw new Error(
            'Detected a non-empty database without Drizzle history and without the expected Frescari base tables. Refusing to guess the baseline.',
        );
    }

    const { rows } = await pool.query<ColumnRow>(
        `
            SELECT table_name, column_name, data_type, udt_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND (
                (table_name = 'orders' AND column_name = 'payment_intent_id')
                OR (table_name = 'farms' AND column_name IN ('address', 'location'))
              );
        `,
    );

    const hasPaymentIntentId = rows.some(
        (row) => row.table_name === 'orders' && row.column_name === 'payment_intent_id',
    );
    const farmAddress = rows.find(
        (row) => row.table_name === 'farms' && row.column_name === 'address',
    );
    const farmLocation = rows.find(
        (row) => row.table_name === 'farms' && row.column_name === 'location',
    );
    const hasPostgisFarmShape =
        farmAddress?.data_type === 'jsonb' && farmLocation?.udt_name === 'geometry';

    if (hasPostgisFarmShape) {
        return 2;
    }

    if (hasPaymentIntentId) {
        return 1;
    }

    return 0;
}

async function bootstrapLegacyHistoryIfNeeded() {
    const migrationEntryCount = await getMigrationEntryCount();

    if (migrationEntryCount !== null && migrationEntryCount > 0) {
        return;
    }

    const baselineIndex = await detectLegacyBaselineIndex();

    if (baselineIndex === null) {
        return;
    }

    const migrations = readMigrationFiles({ migrationsFolder });
    const appliedMigrations = migrations.slice(0, baselineIndex + 1);

    await pool.query(`
        CREATE SCHEMA IF NOT EXISTS "${migrationsSchema}";
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS "${migrationsSchema}"."${migrationsTable}" (
            id SERIAL PRIMARY KEY,
            hash text NOT NULL,
            created_at bigint
        );
    `);

    for (const migration of appliedMigrations) {
        await pool.query(
            `
                INSERT INTO "${migrationsSchema}"."${migrationsTable}" ("hash", "created_at")
                SELECT $1, $2
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM "${migrationsSchema}"."${migrationsTable}"
                    WHERE "hash" = $1
                );
            `,
            [migration.hash, migration.folderMillis],
        );
    }

    console.log(
        `Bootstrapped ${appliedMigrations.length} Drizzle migration(s) for a legacy database without ${migrationsTable}.`,
    );
}

async function main() {
    try {
        await bootstrapLegacyHistoryIfNeeded();
        await runMigrate(db, { migrationsFolder, migrationsSchema, migrationsTable });
        console.log('Drizzle migrations applied successfully.');
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
});
