import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
config({ path: '../../.env' });

async function main() {
    const sql = neon(process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL!);
    console.log('Enabling PostGIS extension...');
    try {
        await sql`CREATE EXTENSION IF NOT EXISTS postgis;`;
        console.log('PostGIS extension enabled successfully!');
    } catch (e) {
        console.error('Failed to enable PostGIS:', e);
        process.exit(1);
    }
}

main();
