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
} from './schema';

config({ path: '../../.env' });

const queryFn = neon(process.env.DATABASE_URL!);
const db = drizzle(queryFn);

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

/** Returns an ISO date string (YYYY-MM-DD) offset by `days` from today */
function dateOffset(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0]!;
}

const today = dateOffset(0);

// ────────────────────────────────────────────
// Main Seed
// ────────────────────────────────────────────

async function main() {
    console.log('🌱 Starting Frescari Super Seed...\n');

    // --------------------------------------------------------
    // 1. CLEANUP — FK-safe deletion order
    // --------------------------------------------------------
    console.log('🧹 Cleaning old seed data...');

    // Find seed tenants to scope the cleanup
    const seedTenants = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(like(tenants.slug, '%-seed'));

    const seedTenantIds = seedTenants.map((t) => t.id);

    if (seedTenantIds.length > 0) {
        // Delete order items for orders from seed tenants
        const seedOrders = await db
            .select({ id: orders.id })
            .from(orders)
            .where(
                sql`${orders.buyerTenantId} = ANY(${seedTenantIds}) OR ${orders.sellerTenantId} = ANY(${seedTenantIds})`
            );
        for (const o of seedOrders) {
            await db.delete(orderItems).where(eq(orderItems.orderId, o.id));
        }
        for (const o of seedOrders) {
            await db.delete(orders).where(eq(orders.id, o.id));
        }

        // Delete product lots for seed tenants
        const seedProducts = await db
            .select({ id: products.id })
            .from(products)
            .where(
                sql`${products.tenantId} = ANY(${seedTenantIds})`
            );
        for (const p of seedProducts) {
            await db.delete(productLots).where(eq(productLots.productId, p.id));
        }

        // Delete products
        for (const tid of seedTenantIds) {
            await db.delete(products).where(eq(products.tenantId, tid));
        }

        // Delete farms
        for (const tid of seedTenantIds) {
            await db.delete(farms).where(eq(farms.tenantId, tid));
        }

        // Delete seed tenants
        for (const tid of seedTenantIds) {
            await db.delete(tenants).where(eq(tenants.id, tid));
        }
    }

    // Delete seed categories
    const seedCategorySlugs = [
        'frutas-seed',
        'verduras-seed',
        'legumes-seed',
        'temperos-seed',
    ];
    for (const slug of seedCategorySlugs) {
        await db
            .delete(productCategories)
            .where(eq(productCategories.slug, slug));
    }

    console.log('✅ Old seed data cleaned.\n');

    // --------------------------------------------------------
    // 2. TENANTS (one per farm)
    // --------------------------------------------------------
    console.log('🏢 Creating tenants...');

    const [tenantSaoJoao] = await db
        .insert(tenants)
        .values({ name: 'Fazenda São João Ltda', slug: 'fazenda-sao-joao-seed', plan: 'pro' })
        .returning();

    const [tenantValeVerde] = await db
        .insert(tenants)
        .values({ name: 'Hidroponia Vale Verde ME', slug: 'hidroponia-vale-verde-seed', plan: 'pro' })
        .returning();

    const [tenantSitioDolSol] = await db
        .insert(tenants)
        .values({ name: 'Sítio do Sol Orgânicos', slug: 'sitio-do-sol-seed', plan: 'free' })
        .returning();

    // --------------------------------------------------------
    // 3. FARMS
    // --------------------------------------------------------
    console.log('🌾 Creating farms...');

    const [farmSaoJoao] = await db
        .insert(farms)
        .values({
            tenantId: tenantSaoJoao!.id,
            name: 'Fazenda São João',
            address: 'Rodovia BR-153, Km 42 — Anápolis, GO',
            certifications: ['GlobalGAP', 'Selo Orgânico Brasil'],
        })
        .returning();

    const [farmValeVerde] = await db
        .insert(farms)
        .values({
            tenantId: tenantValeVerde!.id,
            name: 'Hidroponia Vale Verde',
            address: 'Estrada Municipal 15, Km 3 — Mogi das Cruzes, SP',
            certifications: ['Hidroponia Sustentável', 'ISO 22000'],
        })
        .returning();

    const [farmSol] = await db
        .insert(farms)
        .values({
            tenantId: tenantSitioDolSol!.id,
            name: 'Sítio do Sol',
            address: 'Lote 12, Núcleo Rural Monjolo — Brazlândia, DF',
            certifications: ['Orgânico MAPA', 'Selo SISORG'],
        })
        .returning();

    // --------------------------------------------------------
    // 4. CATEGORIES
    // --------------------------------------------------------
    console.log('📦 Creating categories...');

    const [catFrutas] = await db
        .insert(productCategories)
        .values({ name: 'Frutas', slug: 'frutas-seed' })
        .returning();

    const [catVerduras] = await db
        .insert(productCategories)
        .values({ name: 'Verduras', slug: 'verduras-seed' })
        .returning();

    const [catLegumes] = await db
        .insert(productCategories)
        .values({ name: 'Legumes', slug: 'legumes-seed' })
        .returning();

    const [catTemperos] = await db
        .insert(productCategories)
        .values({ name: 'Temperos', slug: 'temperos-seed' })
        .returning();

    // --------------------------------------------------------
    // 5. PRODUCTS — Premium Ceasa descriptions
    // --------------------------------------------------------
    console.log('🍅 Creating products...');

    // --- Fazenda São João (5 products) ---
    const saoJoaoProducts = await db
        .insert(products)
        .values([
            {
                tenantId: tenantSaoJoao!.id,
                farmId: farmSaoJoao!.id,
                categoryId: catFrutas!.id,
                name: 'Morango Carmem Selecionado',
                sku: 'FSJ-MOR-001',
                saleUnit: 'box' as const,
                unitWeightG: 300,
                pricePerUnit: '24.90',
                minOrderQty: '10.000',
                images: ['https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=800&q=80'],
                isActive: true,
            },
            {
                tenantId: tenantSaoJoao!.id,
                farmId: farmSaoJoao!.id,
                categoryId: catLegumes!.id,
                name: 'Tomate Carmem Selecionado',
                sku: 'FSJ-TOM-001',
                saleUnit: 'kg' as const,
                unitWeightG: null,
                pricePerUnit: '11.50',
                minOrderQty: '20.000',
                images: ['https://images.unsplash.com/photo-1546470427-0d4db154ceb8?w=800&q=80'],
                isActive: true,
            },
            {
                tenantId: tenantSaoJoao!.id,
                farmId: farmSaoJoao!.id,
                categoryId: catLegumes!.id,
                name: 'Pimentão Vermelho Extra',
                sku: 'FSJ-PIM-001',
                saleUnit: 'kg' as const,
                unitWeightG: null,
                pricePerUnit: '14.80',
                minOrderQty: '10.000',
                images: ['https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=800&q=80'],
                isActive: true,
            },
            {
                tenantId: tenantSaoJoao!.id,
                farmId: farmSaoJoao!.id,
                categoryId: catFrutas!.id,
                name: 'Manga Tommy Premium',
                sku: 'FSJ-MAN-001',
                saleUnit: 'unit' as const,
                unitWeightG: 450,
                pricePerUnit: '6.90',
                minOrderQty: '30.000',
                images: ['https://images.unsplash.com/photo-1553279768-865429fa0078?w=800&q=80'],
                isActive: true,
            },
            {
                tenantId: tenantSaoJoao!.id,
                farmId: farmSaoJoao!.id,
                categoryId: catVerduras!.id,
                name: 'Couve Manteiga Orgânica',
                sku: 'FSJ-COU-001',
                saleUnit: 'bunch' as const,
                unitWeightG: 200,
                pricePerUnit: '4.50',
                minOrderQty: '20.000',
                images: ['https://images.unsplash.com/photo-1524179091875-bf99a9a6af57?w=800&q=80'],
                isActive: true,
            },
        ])
        .returning();

    // --- Hidroponia Vale Verde (4 products) ---
    const valeVerdeProducts = await db
        .insert(products)
        .values([
            {
                tenantId: tenantValeVerde!.id,
                farmId: farmValeVerde!.id,
                categoryId: catVerduras!.id,
                name: 'Alface Crespa Hidropônica',
                sku: 'HVV-ALF-001',
                saleUnit: 'unit' as const,
                unitWeightG: 250,
                pricePerUnit: '5.90',
                minOrderQty: '30.000',
                images: ['https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=800&q=80'],
                isActive: true,
            },
            {
                tenantId: tenantValeVerde!.id,
                farmId: farmValeVerde!.id,
                categoryId: catVerduras!.id,
                name: 'Rúcula Hidropônica Premium',
                sku: 'HVV-RUC-001',
                saleUnit: 'bunch' as const,
                unitWeightG: 150,
                pricePerUnit: '6.50',
                minOrderQty: '20.000',
                images: ['https://images.unsplash.com/photo-1506073881649-4e23be3e9ed0?w=800&q=80'],
                isActive: true,
            },
            {
                tenantId: tenantValeVerde!.id,
                farmId: farmValeVerde!.id,
                categoryId: catTemperos!.id,
                name: 'Manjericão Fresco Hidropônico',
                sku: 'HVV-MAN-001',
                saleUnit: 'bunch' as const,
                unitWeightG: 80,
                pricePerUnit: '7.90',
                minOrderQty: '15.000',
                images: ['https://images.unsplash.com/photo-1618164436241-4473940d1f5c?w=800&q=80'],
                isActive: true,
            },
            {
                tenantId: tenantValeVerde!.id,
                farmId: farmValeVerde!.id,
                categoryId: catFrutas!.id,
                name: 'Morango Hidropônico Premium',
                sku: 'HVV-MOR-001',
                saleUnit: 'box' as const,
                unitWeightG: 250,
                pricePerUnit: '29.90',
                minOrderQty: '8.000',
                images: ['https://images.unsplash.com/photo-1587393855524-087f83d95bc9?w=800&q=80'],
                isActive: true,
            },
        ])
        .returning();

    // --- Sítio do Sol (3 products) ---
    const solProducts = await db
        .insert(products)
        .values([
            {
                tenantId: tenantSitioDolSol!.id,
                farmId: farmSol!.id,
                categoryId: catVerduras!.id,
                name: 'Alface Crespa Orgânica',
                sku: 'SDS-ALF-001',
                saleUnit: 'unit' as const,
                unitWeightG: 280,
                pricePerUnit: '6.50',
                minOrderQty: '20.000',
                images: ['https://images.unsplash.com/photo-1556801712-76c8eb07bbc9?w=800&q=80'],
                isActive: true,
            },
            {
                tenantId: tenantSitioDolSol!.id,
                farmId: farmSol!.id,
                categoryId: catLegumes!.id,
                name: 'Abobrinha Italiana Orgânica',
                sku: 'SDS-ABO-001',
                saleUnit: 'kg' as const,
                unitWeightG: null,
                pricePerUnit: '9.90',
                minOrderQty: '15.000',
                images: ['https://images.unsplash.com/photo-1563252722-6434563a985d?w=800&q=80'],
                isActive: true,
            },
            {
                tenantId: tenantSitioDolSol!.id,
                farmId: farmSol!.id,
                categoryId: catTemperos!.id,
                name: 'Cebolinha Verde Orgânica',
                sku: 'SDS-CEB-001',
                saleUnit: 'bunch' as const,
                unitWeightG: 100,
                pricePerUnit: '3.90',
                minOrderQty: '25.000',
                images: ['https://images.unsplash.com/photo-1591073113125-e46713c829ed?w=800&q=80'],
                isActive: true,
            },
        ])
        .returning();

    // --------------------------------------------------------
    // 6. PRODUCT LOTS — Harvest & Expiry dates
    //    - Some expire in <24h for "Last Chance" testing
    //    - Others expire in 5-10 days (normal shelf life)
    // --------------------------------------------------------
    console.log('📅 Creating product lots...');

    const allProducts = [...saoJoaoProducts, ...valeVerdeProducts, ...solProducts];

    // Lot configurations: [harvestDaysAgo, expiryDaysFromNow, qty, freshnessScore]
    type LotConfig = [number, number, string, number];

    const lotConfigs: Record<string, LotConfig[]> = {
        // Fazenda São João
        'FSJ-MOR-001': [[-3, 0, '80.000', 15], [-1, 5, '200.000', 75]],       // morango — lot 1 expiring TODAY = Last Chance!
        'FSJ-TOM-001': [[-5, 1, '150.000', 25], [-2, 7, '400.000', 85]],      // tomate — lot 1 expiring TOMORROW = Last Chance!
        'FSJ-PIM-001': [[-3, 8, '100.000', 80]],                                // pimentão — normal
        'FSJ-MAN-001': [[-2, 6, '300.000', 70]],                                // manga — normal
        'FSJ-COU-001': [[-1, 2, '150.000', 55], [-0, 7, '250.000', 90]],       // couve — one near-expiry

        // Hidroponia Vale Verde
        'HVV-ALF-001': [[-1, 0, '120.000', 10], [-0, 4, '300.000', 85]],       // alface — lot 1 Last Chance!
        'HVV-RUC-001': [[-2, 5, '200.000', 70]],                                // rúcula — normal
        'HVV-MAN-001': [[-1, 3, '100.000', 60]],                                // manjericão — normal
        'HVV-MOR-001': [[-2, 1, '60.000', 30], [-0, 8, '150.000', 90]],        // morango — lot 1 near-expiry

        // Sítio do Sol
        'SDS-ALF-001': [[-1, 3, '180.000', 65]],                                // alface orgânica
        'SDS-ABO-001': [[-3, 10, '250.000', 85]],                               // abobrinha — long shelf life
        'SDS-CEB-001': [[-1, 1, '200.000', 35], [-0, 6, '300.000', 85]],       // cebolinha — lot 1 near-expiry
    };

    let lotCounter = 0;
    for (const product of allProducts) {
        const sku = product.sku ?? '';
        const configs = lotConfigs[sku];
        if (!configs) continue;

        for (let i = 0; i < configs.length; i++) {
            const [harvestDaysAgo, expiryDays, qty, freshness] = configs[i]!;
            lotCounter++;

            await db.insert(productLots).values({
                tenantId: product.tenantId,
                productId: product.id,
                lotCode: `${sku}-L${String(i + 1).padStart(2, '0')}`,
                harvestDate: dateOffset(harvestDaysAgo),
                expiryDate: dateOffset(expiryDays),
                availableQty: qty,
                freshnessScore: freshness,
                storageLocation: 'Câmara Fria A',
            });
        }
    }

    // --------------------------------------------------------
    // Summary
    // --------------------------------------------------------
    console.log('\n✅ Super Seed completed successfully!');
    console.log(`   🏢 3 tenants`);
    console.log(`   🌾 3 farms`);
    console.log(`   📦 4 categories`);
    console.log(`   🍅 ${allProducts.length} products`);
    console.log(`   📅 ${lotCounter} product lots`);
    console.log(
        `   ⚡ ${Object.values(lotConfigs).flat().filter(([, exp]) => exp <= 1).length} "Last Chance" lots (expiring ≤ 24h)\n`
    );
}

main().catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});
