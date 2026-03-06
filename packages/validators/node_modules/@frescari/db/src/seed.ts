import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

config({ path: '../../.env' }); // Load from monorepo root

// Fallback local dev db connection for the seed script
const sql = neon(process.env.DATABASE_URL || "postgres://mock:mock@ep-mock-123456.us-east-2.aws.neon.tech/neondb");
const db = drizzle(sql, { schema });

async function main() {
    console.log('Seeding database...');

    // 1. Insert Tenant (Producer)
    const [tenant] = await db.insert(schema.tenants).values({
        name: 'Fazenda Morada do Sol',
        slug: 'morada-do-sol-seed',
        plan: 'free',
    }).returning();

    // 2. Insert Farm
    const [farm] = await db.insert(schema.farms).values({
        tenantId: tenant.id,
        name: 'Fazenda Principal',
        address: 'Rodovia SP 340, Km 12',
    }).returning();

    // 3. Insert Category
    const [catFrutas, catLegumes] = await db.insert(schema.productCategories).values([
        { name: 'Frutas', slug: 'frutas' },
        { name: 'Legumes', slug: 'legumes' },
    ]).returning();

    // 4. Insert Products
    const [morango, tomate] = await db.insert(schema.products).values([
        {
            tenantId: tenant.id,
            farmId: farm.id,
            categoryId: catFrutas.id,
            name: 'Morango Orgânico',
            saleUnit: 'g',
            unitWeightG: 250,
            pricePerUnit: '15.00',
            minOrderQty: '10.000',
            isActive: true,
        },
        {
            tenantId: tenant.id,
            farmId: farm.id,
            categoryId: catLegumes.id,
            name: 'Tomate Carmem',
            saleUnit: 'kg',
            unitWeightG: 1000,
            pricePerUnit: '8.50',
            minOrderQty: '20.000',
            isActive: true,
        }
    ]).returning();

    // 5. Insert Lots (One expiring < 24h to test Last Chance)
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 23 * 60 * 60 * 1000); // < 24h
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(schema.productLots).values([
        {
            productId: morango.id,
            lotCode: 'MOR-001',
            harvestDate: now.toISOString().split('T')[0] as any,
            expiryDate: tomorrow.toISOString().split('T')[0] as any, // Expiring soon! Should trigger isLastChance
            availableQty: '50',
            priceOverride: '15.00',
        },
        {
            productId: morango.id,
            lotCode: 'MOR-002',
            harvestDate: now.toISOString().split('T')[0] as any,
            expiryDate: nextWeek.toISOString().split('T')[0] as any,
            availableQty: '100',
            priceOverride: '15.00',
        },
        {
            productId: tomate.id,
            lotCode: 'TOM-001',
            harvestDate: now.toISOString().split('T')[0] as any,
            expiryDate: nextWeek.toISOString().split('T')[0] as any,
            availableQty: '200',
            priceOverride: '8.50',
        }
    ]);

    console.log('Database seeded successfully!');
}

main().catch((err) => {
    console.error('Error during seeding:', err);
    process.exit(1);
});
