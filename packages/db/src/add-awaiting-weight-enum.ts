/**
 * One-shot migration: adds 'awaiting_weight' to the order_status enum.
 *
 * Run with:  npx tsx packages/db/src/add-awaiting-weight-enum.ts
 *
 * PostgreSQL allows adding values to an existing enum with ALTER TYPE.
 * This is idempotent – it won't fail if the value already exists (IF NOT EXISTS).
 */
import { client } from './index';

async function migrate() {
    console.log('[MIGRATION] Adding awaiting_weight to order_status enum…');
    await client.query(
        `ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'awaiting_weight' AFTER 'payment_authorized';`,
    );
    console.log('[MIGRATION] ✅ Done.');
    await client.end();
}

migrate().catch((err) => {
    console.error('[MIGRATION] ❌ Failed:', err);
    process.exit(1);
});
