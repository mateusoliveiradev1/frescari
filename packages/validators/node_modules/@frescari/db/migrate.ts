import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(__dirname, '../../.env') });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
    try {
        console.log('Connecting to database to add tenant_id to product_lots...');
        await sql`
            ALTER TABLE product_lots 
            ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
        `;
        console.log('Column tenant_id added successfully.');
    } catch (error) {
        console.error('Failed to add column:', error);
    }
}

main();
