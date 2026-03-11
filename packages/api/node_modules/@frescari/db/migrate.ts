import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(__dirname, '../../.env') });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
    try {
        console.log('Fixing master_product_id uuid cast and adding stripe_account_id...');
        await sql`
            ALTER TABLE order_items ALTER COLUMN master_product_id TYPE uuid USING master_product_id::uuid;
        `.catch(e => console.log('Notice (order_items):', e.message));

        await sql`
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_account_id text;
        `;
        console.log('Database synced successfully.');
    } catch (error) {
        console.error('Failed to add column:', error);
    }
}

main();
