import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, like, sql } from 'drizzle-orm';
import { enableProductLotBypassContext } from './product-lot-scope';
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

const seedConnectionString =
    process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL!;
const queryFn = neon(seedConnectionString);
const db = drizzle(queryFn);
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function dateOffset(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0]!;
}

async function withProductLotBypass<T>(callback: (tx: DbTransaction) => Promise<T>) {
    return db.transaction(async (tx) => {
        await enableProductLotBypassContext(tx);
        return callback(tx);
    });
}

async function main() {
    console.log('Starting High-Fidelity Frescari seed...');
    console.log('Cleaning old seed data...');

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

        for (const order of seedOrders) {
            await db.delete(orderItems).where(eq(orderItems.orderId, order.id));
            await db.delete(orders).where(eq(orders.id, order.id));
        }

        const seedProducts = await db
            .select({ id: products.id })
            .from(products)
            .where(sql`${products.tenantId} = ANY(${seedTenantIds})`);

        await withProductLotBypass(async (tx) => {
            for (const product of seedProducts) {
                await tx.delete(productLots).where(eq(productLots.productId, product.id));
            }
        });

        for (const tenantId of seedTenantIds) {
            await db.delete(products).where(eq(products.tenantId, tenantId));
            await db.delete(farms).where(eq(farms.tenantId, tenantId));
            await db.delete(tenants).where(eq(tenants.id, tenantId));
        }
    }

    const seedCategorySlugs = ['hortalicas-seed', 'folhas-seed', 'raizes-seed'];
    for (const slug of seedCategorySlugs) {
        await db.delete(productCategories).where(eq(productCategories.slug, slug));
    }

    console.log('Old seed data cleaned.');

    console.log('Creating test supplier...');

    const [fornecedorTeste] = await db
        .insert(tenants)
        .values({
            name: 'Fornecedor de Teste Hortifruti',
            slug: 'fornecedor-teste-seed',
            plan: 'pro',
            type: 'PRODUCER',
            stripeAccountId: 'acct_1QyABCDEF1234567'
        })
        .returning();

    console.log('Creating farms...');

    const [farmPrincipal] = await db
        .insert(farms)
        .values({
            tenantId: fornecedorTeste!.id,
            name: 'Sitio Central Producao BR',
            address: {
                street: 'Rodovia SP-55',
                number: 'Km 12',
                city: 'Sao Paulo',
                state: 'SP',
                postalCode: '',
                country: 'BR'
            },
            certifications: ['Organico Certificado MAPA', 'GlobalGAP']
        })
        .returning();

    console.log('Creating categories...');

    const [catHortalicas] = await db
        .insert(productCategories)
        .values({ name: 'Hortalicas', slug: 'hortalicas-seed' })
        .returning();
    const [catFolhas] = await db
        .insert(productCategories)
        .values({ name: 'Folhas', slug: 'folhas-seed' })
        .returning();
    const [catRaizes] = await db
        .insert(productCategories)
        .values({ name: 'Raizes', slug: 'raizes-seed' })
        .returning();

    console.log('Creating or refreshing master products...');

    const mpData = [
        {
            name: 'Tomate Carmem',
            category: 'Hortalicas',
            defaultImageUrl: 'https://images.unsplash.com/photo-1546470427-0d4db154ceb8?w=800&q=80',
            pricingType: 'WEIGHT' as const
        },
        {
            name: 'Alface Crespa Hidroponica',
            category: 'Folhas',
            defaultImageUrl: 'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=800&q=80',
            pricingType: 'UNIT' as const
        },
        {
            name: 'Batata Inglesa Lavada',
            category: 'Raizes',
            defaultImageUrl: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&q=80',
            pricingType: 'WEIGHT' as const
        },
        {
            name: 'Cebola Roxa',
            category: 'Hortalicas',
            defaultImageUrl: 'https://images.unsplash.com/photo-1466814314367-45caeebcbddc?w=800&q=80',
            pricingType: 'WEIGHT' as const
        }
    ];

    const masterProductsMap: Record<string, string> = {};

    for (const mp of mpData) {
        await db.delete(masterProducts).where(eq(masterProducts.name, mp.name));

        const [inserted] = await db
            .insert(masterProducts)
            .values({
                name: mp.name,
                category: mp.category,
                defaultImageUrl: mp.defaultImageUrl,
                pricingType: mp.pricingType
            })
            .returning({ id: masterProducts.id });

        masterProductsMap[mp.name] = inserted!.id;
    }

    console.log('Creating realistic products...');

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
                isActive: true
            },
            {
                tenantId: fornecedorTeste!.id,
                farmId: farmPrincipal!.id,
                categoryId: catFolhas!.id,
                masterProductId: masterProductsMap['Alface Crespa Hidroponica'],
                name: 'Alface Crespa Hidroponica (Pe Grande)',
                sku: 'FTE-ALF-001',
                saleUnit: 'unit' as const,
                unitWeightG: 350,
                pricePerUnit: '3.90',
                minOrderQty: '20.000',
                images: ['https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=800&q=80'],
                isActive: true
            },
            {
                tenantId: fornecedorTeste!.id,
                farmId: farmPrincipal!.id,
                categoryId: catRaizes!.id,
                masterProductId: masterProductsMap['Batata Inglesa Lavada'],
                name: 'Batata Inglesa Lisa Lavada - Padrao Exportacao',
                sku: 'FTE-BAT-001',
                saleUnit: 'kg' as const,
                unitWeightG: null,
                pricePerUnit: '6.20',
                minOrderQty: '50.000',
                images: ['https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&q=80'],
                isActive: true
            },
            {
                tenantId: fornecedorTeste!.id,
                farmId: farmPrincipal!.id,
                categoryId: catHortalicas!.id,
                masterProductId: masterProductsMap['Cebola Roxa'],
                name: 'Cebola Roxa Padrao A',
                sku: 'FTE-CEB-001',
                saleUnit: 'kg' as const,
                unitWeightG: null,
                pricePerUnit: '9.80',
                minOrderQty: '15.000',
                images: ['https://images.unsplash.com/photo-1466814314367-45caeebcbddc?w=800&q=80'],
                isActive: true
            }
        ])
        .returning();

    console.log('Creating product lots...');

    type LotConfig = [number, number, string, number, string];

    const lotConfigs: Record<string, LotConfig[]> = {
        'FTE-TOM-001': [
            [-2, 5, '200.000', 85, 'WEIGHT'],
            [-1, 6, '500.000', 95, 'WEIGHT']
        ],
        'FTE-ALF-001': [
            [-1, 3, '150.000', 80, 'UNIT'],
            [0, 4, '300.000', 100, 'UNIT']
        ],
        'FTE-BAT-001': [[-5, 20, '1000.000', 90, 'WEIGHT']],
        'FTE-CEB-001': [[-4, 30, '400.000', 90, 'WEIGHT']]
    };

    let lotCounter = 0;
    await withProductLotBypass(async (tx) => {
        for (const product of createdProducts) {
            const sku = product.sku ?? '';
            const configs = lotConfigs[sku];
            if (!configs) continue;

            for (let i = 0; i < configs.length; i++) {
                const [harvestDaysAgo, expiryDays, qty, freshness, pricingType] = configs[i]!;
                lotCounter++;

                await tx.insert(productLots).values({
                    tenantId: product.tenantId,
                    productId: product.id,
                    lotCode: `${sku}-LOT-${String(i + 1).padStart(2, '0')}`,
                    harvestDate: dateOffset(harvestDaysAgo),
                    expiryDate: dateOffset(expiryDays),
                    availableQty: qty,
                    pricingType: pricingType as 'UNIT' | 'WEIGHT' | 'BOX',
                    freshnessScore: freshness,
                    storageLocation: 'Camara Fria Principal',
                    imageUrl: product.images?.[0]
                });
            }
        }
    });

    console.log('High-Fidelity seed completed successfully.');
    console.log('  1 test supplier (configured with Stripe)');
    console.log('  1 farm');
    console.log('  4 master products');
    console.log('  3 categories');
    console.log(`  ${createdProducts.length} vendor products (linked to master)`);
    console.log(`  ${lotCounter} product lots created`);
}

main().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
});
