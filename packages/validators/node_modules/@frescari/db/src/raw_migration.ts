import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import path from 'path';

// Load directly from the root project dir
config({ path: '../../.env' });

const sql = neon(process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL!);

async function main() {
    console.log('Running raw SQL migration...');

    try {
        await sql`
      CREATE TABLE IF NOT EXISTS "master_products" (
        "id" text PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "category" text,
        "default_image_url" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `;
        console.log('Created master_products table.');

        await sql`
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "master_product_id" text;
    `;
        console.log('Added master_product_id to products table.');

        await sql`
      DO $$ BEGIN
        ALTER TABLE "products" ADD CONSTRAINT "products_master_product_id_master_products_id_fk" FOREIGN KEY ("master_product_id") REFERENCES "public"."master_products"("id") ON DELETE restrict ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
        console.log('Added foreign key correctly.');

        console.log('Migration successful.');
    } catch (error) {
        console.error('Migration failed:', error);
    }
}

main();
