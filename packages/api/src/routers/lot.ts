import { createTRPCRouter, publicProcedure, protectedProcedure } from '../trpc';
import { createLotInputSchema, updateLotInventorySchema } from '@frescari/validators';
import { productLots, products } from '@frescari/db';
import { eq, and, gt, sql, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

export const lotRouter = createTRPCRouter({

    create: protectedProcedure
        .input(createLotInputSchema)
        .mutation(async ({ ctx, input }) => {
            let tenantId = ctx.tenantId;

            // --- ON-THE-FLY TENANT CREATION (MVP FIX FOR PRODUCERS) ---
            if (!tenantId) {
                if (ctx.user.role === 'producer') {
                    // Try to find if one exists for some reason
                    const existingUser = await ctx.db.query.users.findFirst({
                        where: eq(sql`${ctx.db._.fullSchema.users.id}::text`, ctx.user.id)
                    });

                    if (existingUser?.tenantId) {
                        tenantId = existingUser.tenantId;
                    } else {
                        // Create a default tenant for this new producer
                        const [newTenant] = await ctx.db.insert(ctx.db._.fullSchema.tenants).values({
                            slug: `tenant-${ctx.user.id.substring(0, 8)}`,
                            name: `Fazenda de ${ctx.user.name.split(' ')[0]}`,
                            plan: 'free',
                        }).returning();

                        tenantId = newTenant.id;

                        // Update the user record
                        await ctx.db.update(ctx.db._.fullSchema.users)
                            .set({ tenantId })
                            .where(eq(sql`${ctx.db._.fullSchema.users.id}::text`, ctx.user.id));
                    }
                } else {
                    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User has no tenant and cannot create one.' });
                }
            }

            // Validate product belongs to tenant
            const product = await ctx.db.query.products.findFirst({
                where: eq(sql`${products.id}::text`, input.productId),
            });
            // We removed tenantId restriction from products above, so product can be global.
            if (!product) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found in global catalog.' });
            }

            const valuesToInsert = {
                ...input,
                tenantId,
                // Calculate initial freshness score (mock logic for creation, real logic is via worker)
                freshnessScore: 100,
                reservedQty: '0',
                isExpired: false
            } as typeof productLots.$inferInsert;

            const [newLot] = await ctx.db.insert(productLots).values(valuesToInsert).returning();

            return newLot;
        }),

    updateInventory: protectedProcedure
        .input(updateLotInventorySchema)
        .mutation(async ({ ctx, input }) => {
            const [updatedLot] = await ctx.db.update(productLots)
                .set({ availableQty: input.newAvailableQty.toString() })
                .where(eq(productLots.id, input.lotId))
                .returning();

            return updatedLot;
        }),

    getAvailableLots: publicProcedure
        .input(z.object({ productId: z.string().uuid().optional() }))
        .query(async ({ ctx, input }) => {
            try {
                const results = await ctx.db.select({
                    lot: productLots,
                    product: products
                }).from(productLots)
                    .leftJoin(products, eq(productLots.productId, products.id));

                const now = new Date();
                const twentyFourHours = 24 * 60 * 60 * 1000;

                return results.map((row) => {
                    const lot = row.lot;
                    const product = row.product;
                    const expiryDate = new Date(lot.expiryDate);
                    const timeToExpiry = expiryDate.getTime() - now.getTime();

                    let priceToUse = lot.priceOverride ? Number(lot.priceOverride) :
                        (product ? Number(product.pricePerUnit) : 0);

                    const isExpiringSoon = timeToExpiry <= twentyFourHours;
                    const isFreshnessLow = lot.freshnessScore !== null && lot.freshnessScore < 30;

                    let isLastChance = false;
                    let finalPrice = priceToUse;

                    if (isExpiringSoon || isFreshnessLow) {
                        isLastChance = true;
                        finalPrice = priceToUse * 0.6; // 40% discount
                    }

                    return {
                        ...lot,
                        product,
                        productName: product?.name || "Produto Desconhecido",
                        finalPrice,
                        isLastChance
                    };
                }).sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
            } catch (error: any) {
                console.error('[DB_CATALOG_ERROR]:', error);
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
            }
        }),

    getDashboardMetrics: protectedProcedure
        .query(async ({ ctx }) => {
            try {
                // Defesa rígida contra undefined antes de tocar no banco
                if (!ctx.user?.id) {
                    throw new TRPCError({
                        code: 'UNAUTHORIZED',
                        message: 'Usuário não autenticado.'
                    });
                }

                const tenantId = ctx.tenantId;
                if (!tenantId) return { activeLots: 0, lastChanceQty: 0, co2AvoidedKg: 0 };

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

    getRecentLots: protectedProcedure
        .query(async ({ ctx }) => {
            try {
                // Defesa rígida contra undefined antes de tocar no banco
                if (!ctx.user?.id) {
                    throw new TRPCError({
                        code: 'UNAUTHORIZED',
                        message: 'Usuário não autenticado.'
                    });
                }

                const tenantId = ctx.tenantId;
                if (!tenantId) return [];

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
        })
});
