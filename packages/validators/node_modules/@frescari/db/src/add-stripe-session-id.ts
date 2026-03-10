import { client, connectionString } from './index';

async function addStripeSessionId() {
    console.log('[MIGRATION] Connecting to:', connectionString.replace(/:[^:@]+@/, ':***@'));

    try {
        const result = await client.query(`
            ALTER TABLE orders
            ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;
        `);
        console.log('[MIGRATION] ✅ Added stripe_session_id column to orders table', result.command);
    } catch (error) {
        console.error('[MIGRATION] ❌ Failed:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

addStripeSessionId();
