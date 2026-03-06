import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

config({ path: '../../.env' });

export default defineConfig({
    schema: './src/schema.ts',
    out: './drizzle',
    dialect: 'postgresql',
    tablesFilter: ["!spatial_ref_sys"],
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
});
