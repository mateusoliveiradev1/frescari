import { createTRPCRouter, publicProcedure, protectedProcedure, producerProcedure } from '../trpc';
import { createLotInputSchema, updateLotInventorySchema } from '@frescari/validators';
import { productLots, products, masterProducts, farms } from '@frescari/db';
import { eq, and, gt, sql, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { calculateLotStatus } from '../utils/lot-status';
import { z } from 'zod';

export const lotRouter = createTRPCRouter({

    create: producerProcedure
        .input(createLotInputSchema)
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.tenantId;

            // 1. Resolve Product: Check if the tenant already has this master product registered
            let product = await ctx.db.query.products.findFirst({
                where: and(
                    eq(products.tenantId, tenantId),
                    eq(products.masterProductId, input.productId)
                ),
            });

            // 2. If not found by masterProductId, maybe input.productId IS the local productId (legacy)
            if (!product) {
                product = await ctx.db.query.products.findFirst({
                    where: eq(products.id, input.productId),
                });
            }

            // 3. If STILL not found, check if it's a valid Master Product and create the link
            if (!product) {
                const masterProduct = await ctx.db.query.masterProducts.findFirst({
                    where: eq(masterProducts.id, input.productId)
                });

                if (masterProduct) {
                    // Find or create a farm for this tenant
                    let farm = await ctx.db.query.farms.findFirst({
                        where: eq(farms.tenantId, tenantId)
                    });

                    if (!farm) {
                        // Create a default farm if none exists
                        const [newFarm] = await ctx.db.insert(farms).values({
                            name: `Farm ${ctx.user.name}`,
                            tenantId,
                        }).returning();
                        farm = newFarm;
                    }

                    // Get a category ID (or use a default one)
                    const category = await ctx.db.query.productCategories.findFirst();
                    if (!category) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'No categories found in system.' });

                    // Auto-create the tenant product
                    const [newProduct] = await ctx.db.insert(products).values({
                        tenantId,
                        farmId: farm!.id,
                        categoryId: category.id,
                        masterProductId: masterProduct.id,
                        name: masterProduct.name,
                        saleUnit: 'unit', // Default
                        pricePerUnit: '0', // Must be updated later
                        minOrderQty: '1',
                        images: masterProduct.defaultImageUrl ? [masterProduct.defaultImageUrl] : [],
                        isActive: true
                    }).returning();

                    product = newProduct;
                }
            }

            if (!product) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found and not in master catalog.' });
            }

            const valuesToInsert = {
                ...input,
                productId: product.id, // Use the local product ID
                tenantId,
                availableQty: input.availableQty.toString(),
                priceOverride: input.priceOverride.toString(),
                // Calculate initial freshness score (mock logic for creation, real logic is via worker)
                freshnessScore: 100,
                reservedQty: '0',
                isExpired: false
            } as typeof productLots.$inferInsert;

            const [newLot] = await ctx.db.insert(productLots).values(valuesToInsert).returning();

            return newLot;
        }),

    updateInventory: producerProcedure
        .input(updateLotInventorySchema)
        .mutation(async ({ ctx, input }) => {
            const [updatedLot] = await ctx.db.update(productLots)
                .set({ availableQty: input.newAvailableQty.toString() })
                .where(and(
                    eq(productLots.id, input.lotId),
                    eq(productLots.tenantId, ctx.tenantId)
                ))
                .returning();

            return updatedLot;
        }),

    getAvailableLots: publicProcedure
        .input(z.object({ productId: z.string().uuid().optional() }))
        .query(async ({ ctx, input }) => {
            try {
                const { farms } = ctx.db._.fullSchema;

                const results = await ctx.db.select({
                    lot: productLots,
                    product: products,
                    farmName: farms.name,
                }).from(productLots)
                    .leftJoin(products, eq(productLots.productId, products.id))
                    .leftJoin(farms, eq(products.farmId, farms.id));

                const now = new Date();
                return results
                    .map((row) => {
                        const lot = row.lot;
                        const product = row.product;
                        const status = calculateLotStatus(lot.expiryDate);

                        const originalPrice = lot.priceOverride ? Number(lot.priceOverride) :
                            (product ? Number(product.pricePerUnit) : 0);

                        // Price logic follows SSOT status
                        const isLastChance = status === 'last_chance';
                        let finalPrice = originalPrice;

                        if (isLastChance) {
                            finalPrice = originalPrice * 0.6; // 40% discount
                        }

                        return {
                            id: lot.id,
                            lotCode: lot.lotCode,
                            farmId: product?.farmId ?? '',
                            harvestDate: lot.harvestDate,
                            expiryDate: lot.expiryDate,
                            availableQty: Number(lot.availableQty),
                            freshnessScore: lot.freshnessScore,
                            productName: product?.name || "Produto Desconhecido",
                            saleUnit: product?.saleUnit || "unit",
                            imageUrl: lot.imageUrl || product?.images?.[0] || null,
                            farmName: row.farmName || "Produtor Local",
                            originalPrice,
                            finalPrice,
                            isLastChance,
                            pricingType: lot.pricingType || 'UNIT',
                            estimatedWeight: lot.estimatedWeight ? Number(lot.estimatedWeight) : null,
                            unit: lot.unit || 'un',
                            status,
                        };
                    })
                    // Filter out expired (SSOT) or out-of-stock lots for the public catalog
                    .filter((lot) => lot.status !== 'vencido' && lot.availableQty > 0 && lot.farmId.length > 0)
                    .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
            } catch (error: any) {
                console.error('[DB_CATALOG_ERROR]:', error);
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
            }
        }),

    getDashboardMetrics: producerProcedure
        .query(async ({ ctx }) => {
            try {
                const tenantId = ctx.tenantId;

                const allLots = await ctx.db.query.productLots.findMany({
                    where: eq(productLots.tenantId, tenantId),
                    with: { product: true }
                });

                const now = new Date();
                const twentyFourHours = 24 * 60 * 60 * 1000;

                let activeLots = 0;
                let lastChanceQty = 0;
                let totalGramsSaved = 0;

                for (const lot of allLots) {
                    if (lot.isExpired || Number(lot.availableQty) <= 0) continue;

                    activeLots++;

                    const expiryDate = new Date(lot.expiryDate);
                    const timeToExpiry = expiryDate.getTime() - now.getTime();
                    const isExpiringSoon = timeToExpiry <= twentyFourHours;
                    const isFreshnessLow = lot.freshnessScore !== null && lot.freshnessScore < 30;

                    const qty = Number(lot.availableQty);
                    if (isExpiringSoon || isFreshnessLow) {
                        lastChanceQty += qty;
                    }

                    // Calculate CO2 avoided: let's assume 1.2kg CO2 per kg of food saved
                    const weightG = lot.product?.unitWeightG || 1000;
                    totalGramsSaved += (qty * weightG);
                }

                const co2AvoidedKg = (totalGramsSaved / 1000) * 1.2;

                return {
                    activeLots,
                    lastChanceQty,
                    co2AvoidedKg: Number(co2AvoidedKg.toFixed(2))
                };
            } catch (error: any) {
                console.error('[DB_ERROR]: Erro na query getDashboardMetrics:', error);
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
            }
        }),

    getRecentLots: producerProcedure
        .query(async ({ ctx }) => {
            try {
                const tenantId = ctx.tenantId;

                const recentLots = await ctx.db.query.productLots.findMany({
                    where: eq(productLots.tenantId, tenantId),
                    with: {
                        product: true
                    },
                    orderBy: (lots, { desc }) => [desc(lots.createdAt)],
                    limit: 5
                });

                return recentLots;
            } catch (error: any) {
                console.error('[DB_ERROR]: Erro na query getRecentLots:', error);
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
            }
        }),

    getByProducer: producerProcedure
        .query(async ({ ctx }) => {
            const tenantId = ctx.tenantId;

            const results = await ctx.db.select({
                lot: productLots,
                product: products,
            }).from(productLots)
                .innerJoin(products, eq(productLots.productId, products.id))
                .where(eq(productLots.tenantId, tenantId))
                .orderBy(sql`${productLots.createdAt} DESC`);

            return results.map(row => ({
                ...row.lot,
                productName: row.product.name,
                imageUrl: row.lot.imageUrl || row.product.images?.[0] || null,
                status: calculateLotStatus(row.lot.expiryDate),
            }));
        }),

    delete: producerProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.tenantId;

            const [deleted] = await ctx.db.delete(productLots)
                .where(and(
                    eq(productLots.id, input.id),
                    eq(productLots.tenantId, tenantId)
                ))
                .returning();

            if (!deleted) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lote não encontrado ou permissão negada.' });

            return { success: true };
        }),

    update: producerProcedure
        .input(z.object({
            id: z.string().uuid(),
            availableQty: z.number().optional(),
            priceOverride: z.number().optional(),
            expiryDate: z.string().optional(),
            harvestDate: z.string().optional(),
            pricingType: z.enum(['UNIT', 'WEIGHT', 'BOX']).optional(),
            unit: z.string().optional(),
            imageUrl: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const tenantId = ctx.tenantId;

            const { id, ...data } = input;

            const updateValues: Record<string, any> = {};
            if (data.availableQty !== undefined) updateValues.availableQty = data.availableQty.toString();
            if (data.priceOverride !== undefined) updateValues.priceOverride = data.priceOverride.toString();
            if (data.expiryDate !== undefined) updateValues.expiryDate = data.expiryDate;
            if (data.harvestDate !== undefined) updateValues.harvestDate = data.harvestDate;
            if (data.pricingType !== undefined) updateValues.pricingType = data.pricingType;
            if (data.unit !== undefined) updateValues.unit = data.unit;
            if (data.imageUrl !== undefined) updateValues.imageUrl = data.imageUrl;

            const [updated] = await ctx.db.update(productLots)
                .set(updateValues)
                .where(and(
                    eq(productLots.id, id),
                    eq(productLots.tenantId, tenantId)
                ))
                .returning();

            if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lote não encontrado ou permissão negada.' });

            return updated;
        }),
});
