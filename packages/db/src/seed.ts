import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, like, sql } from 'drizzle-orm';
import {
    tenants,
    farms,
    products,
    productLots,
    productCategories,
    orderItems,
    orders,
    masterProducts
} from './schema';

config({ path: '../../.env' });

const queryFn = neon(process.env.DATABASE_URL!);
const db = drizzle(queryFn);

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

function dateOffset(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0]!;
}

// ────────────────────────────────────────────
// Main Seed
// ────────────────────────────────────────────

async function main() {
    console.log('🌱 Starting High-Fidelity Frescari Seed...\n');

    console.log('🧹 Cleaning old seed data...');

    const seedTenants = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(like(tenants.slug, '%-seed'));

    const seedTenantIds = seedTenants.map((t) => t.id);

    if (seedTenantIds.length > 0) {
        const seedOrders = await db
            .select({ id: orders.id })
            .from(orders)
            .where(
                sql`${orders.buyerTenantId} = ANY(${seedTenantIds}) OR ${orders.sellerTenantId} = ANY(${seedTenantIds})`
            );
        for (const o of seedOrders) {
            await db.delete(orderItems).where(eq(orderItems.orderId, o.id));
            await db.delete(orders).where(eq(orders.id, o.id));
        }

        const seedProducts = await db
            .select({ id: products.id })
            .from(products)
            .where(sql`${products.tenantId} = ANY(${seedTenantIds})`);

        for (const p of seedProducts) {
            await db.delete(productLots).where(eq(productLots.productId, p.id));
        }

        for (const tid of seedTenantIds) {
            await db.delete(products).where(eq(products.tenantId, tid));
            await db.delete(farms).where(eq(farms.tenantId, tid));
            await db.delete(tenants).where(eq(tenants.id, tid));
        }
    }

    const seedCategorySlugs = ['hortalicas-seed', 'folhas-seed', 'raizes-seed'];
    for (const slug of seedCategorySlugs) {
        await db.delete(productCategories).where(eq(productCategories.slug, slug));
    }

    console.log('✅ Old seed data cleaned.\n');

    // --------------------------------------------------------
    // 1. TENANT (Fornecedor de Teste com Stripe Válida)
    // --------------------------------------------------------
    console.log('🏢 Creating Test Supplier (Producer)...');

    const [fornecedorTeste] = await db
        .insert(tenants)
        .values({
            name: 'Fornecedor de Teste Hortifruti',
            slug: 'fornecedor-teste-seed',
            plan: 'pro',
            type: 'PRODUCER',
            stripeAccountId: 'acct_1QyABCDEF1234567' // Realistic looking Stripe ID pattern
        })
        .returning();

    // --------------------------------------------------------
    // 2. FARMS
    // --------------------------------------------------------
    console.log('🌾 Creating Farms...');

    const [farmPrincipal] = await db
        .insert(farms)
        .values({
            tenantId: fornecedorTeste!.id,
            name: 'Sítio Central Produção Br',
            address: {
                street: 'Rodovia SP-55',
                number: 'Km 12',
                city: 'São Paulo',
                state: 'SP',
                postalCode: '',
                country: 'BR',
            },
            certifications: ['Orgânico Certificado MAPA', 'GlobalGAP'],
        })
        .returning();

    // --------------------------------------------------------
    // 3. CATEGORIES
    // --------------------------------------------------------
    console.log('📦 Creating Categories...');

    const [catHortalicas] = await db.insert(productCategories).values({ name: 'Hortaliças', slug: 'hortalicas-seed' }).returning();
    const [catFolhas] = await db.insert(productCategories).values({ name: 'Folhas', slug: 'folhas-seed' }).returning();
    const [catRaizes] = await db.insert(productCategories).values({ name: 'Raízes', slug: 'raizes-seed' }).returning();

    // --------------------------------------------------------
    // 4. MASTER PRODUCTS
    // --------------------------------------------------------
    console.log('📚 Creating/Fetching Master Products...');

    const mpData = [
        { name: 'Tomate Carmem', category: 'Hortaliças', defaultImageUrl: 'https://images.unsplash.com/photo-1546470427-0d4db154ceb8?w=800&q=80', pricingType: 'WEIGHT' as const },
        { name: 'Alface Crespa Hidropônica', category: 'Folhas', defaultImageUrl: 'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=800&q=80', pricingType: 'UNIT' as const },
        { name: 'Batata Inglesa Lavada', category: 'Raízes', defaultImageUrl: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&q=80', pricingType: 'WEIGHT' as const },
        { name: 'Cebola Roxa', category: 'Hortaliças', defaultImageUrl: 'https://images.unsplash.com/photo-1466814314367-45caeebcbddc?w=800&q=80', pricingType: 'WEIGHT' as const },
    ];

    const masterProductsMap: Record<string, string> = {};

    for (const mp of mpData) {
        // Insert and return id, on conflict we just use the name to fetch later or update.
        // Drizzle PG handles ON CONFLICT differently depending on constraints, assuming we don't have unique constraint on name, we just insert.
        // Actually, just for safety, let's insert them fresh as it's a seed script, maybe delete old ones if they match by name.

        await db.delete(masterProducts).where(eq(masterProducts.name, mp.name));

        const [inserted] = await db.insert(masterProducts).values({
            name: mp.name,
            category: mp.category,
            defaultImageUrl: mp.defaultImageUrl,
            pricingType: mp.pricingType
        }).returning({ id: masterProducts.id });

        masterProductsMap[mp.name] = inserted!.id;
    }

    // --------------------------------------------------------
    // 5. PRODUCTS — Linkados ao Master Product
    // --------------------------------------------------------
    console.log('🍅 Creating realistic Products...');

    const createdProducts = await db
        .insert(products)
        .values([
            {
                tenantId: fornecedorTeste!.id,
                farmId: farmPrincipal!.id,
                categoryId: catHortalicas!.id,
                masterProductId: masterProductsMap['Tomate Carmem'],
                name: 'Tomate Carmem Extra Especial',
                sku: 'FTE-TOM-001',
                saleUnit: 'kg' as const,
                unitWeightG: null,
                pricePerUnit: '8.50',
                minOrderQty: '10.000',
                images: ['https://images.unsplash.com/photo-1546470427-0d4db154ceb8?w=800&q=80'],
                isActive: true,
            },
            {
                tenantId: fornecedorTeste!.id,
                farmId: farmPrincipal!.id,
                categoryId: catFolhas!.id,
                masterProductId: masterProductsMap['Alface Crespa Hidropônica'],
                name: 'Alface Crespa Hidropônica (Pé Grande)',
                sku: 'FTE-ALF-001',
                saleUnit: 'unit' as const,
                unitWeightG: 350,
                pricePerUnit: '3.90',
                minOrderQty: '20.000',
                images: ['https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=800&q=80'],
                isActive: true,
            },
            {
                tenantId: fornecedorTeste!.id,
                farmId: farmPrincipal!.id,
                categoryId: catRaizes!.id,
                masterProductId: masterProductsMap['Batata Inglesa Lavada'],
                name: 'Batata Inglesa Lisa Lavada - Padrão Exportação',
                sku: 'FTE-BAT-001',
                saleUnit: 'kg' as const,
                unitWeightG: null,
                pricePerUnit: '6.20',
                minOrderQty: '50.000',
                images: ['https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&q=80'],
                isActive: true,
            },
            {
                tenantId: fornecedorTeste!.id,
                farmId: farmPrincipal!.id,
                categoryId: catHortalicas!.id,
                masterProductId: masterProductsMap['Cebola Roxa'],
                name: 'Cebola Roxa Padrão A',
                sku: 'FTE-CEB-001',
                saleUnit: 'kg' as const,
                unitWeightG: null,
                pricePerUnit: '9.80',
                minOrderQty: '15.000',
                images: ['https://images.unsplash.com/photo-1466814314367-45caeebcbddc?w=800&q=80'],
                isActive: true,
            }
        ])
        .returning();

    // --------------------------------------------------------
    // 6. PRODUCT LOTS
    // --------------------------------------------------------
    console.log('📅 Creating Product Lots...');

    type LotConfig = [number, number, string, number, string]; // [harvestDaysAgo, expiryDays, qty, freshness, pricingType]

    const lotConfigs: Record<string, LotConfig[]> = {
        'FTE-TOM-001': [[-2, 5, '200.000', 85, 'WEIGHT'], [-1, 6, '500.000', 95, 'WEIGHT']],
        'FTE-ALF-001': [[-1, 3, '150.000', 80, 'UNIT'], [0, 4, '300.000', 100, 'UNIT']],
        'FTE-BAT-001': [[-5, 20, '1000.000', 90, 'WEIGHT']],
        'FTE-CEB-001': [[-4, 30, '400.000', 90, 'WEIGHT']],
    };

    let lotCounter = 0;
    for (const product of createdProducts) {
        const sku = product.sku ?? '';
        const configs = lotConfigs[sku];
        if (!configs) continue;

        for (let i = 0; i < configs.length; i++) {
            const [harvestDaysAgo, expiryDays, qty, freshness, lpt] = configs[i]!;
            lotCounter++;

            await db.insert(productLots).values({
                tenantId: product.tenantId,
                productId: product.id,
                lotCode: `${sku}-LOT-${String(i + 1).padStart(2, '0')}`,
                harvestDate: dateOffset(harvestDaysAgo),
                expiryDate: dateOffset(expiryDays),
                availableQty: qty,
                pricingType: lpt as 'UNIT' | 'WEIGHT' | 'BOX',
                freshnessScore: freshness,
                storageLocation: 'Câmara Fria Principal',
                imageUrl: product.images?.[0]
            });
        }
    }

    // --------------------------------------------------------
    // Summary
    // --------------------------------------------------------
    console.log('\n✅ High-Fidelity Seed completed successfully!');
    console.log(`   🏢 1 Test Supplier (Configured with Stripe)`);
    console.log(`   🌾 1 Farm`);
    console.log(`   📚 4 Master Products`);
    console.log(`   📦 3 Categories`);
    console.log(`   🍅 ${createdProducts.length} Vendor Products (linked to Master)`);
    console.log(`   📅 ${lotCounter} Product Lots created\n`);
}

main().catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});
