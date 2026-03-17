/**
 * One-shot migration: adds 'ready_for_dispatch' to the order_status enum.
 *
 * Run with: npx tsx packages/db/src/add-ready-for-dispatch-enum.ts
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

    console.log('[MIGRATION] Adding ready_for_dispatch to order_status enum...');
    await client.query(
        `ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'ready_for_dispatch';`,
    );
    console.log('[MIGRATION] Done.');
    await client.end();
}

migrate().catch((err) => {
    console.error('[MIGRATION] Failed:', err);
    process.exit(1);
});
