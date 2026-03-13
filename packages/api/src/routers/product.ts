import { createTRPCRouter, publicProcedure, protectedProcedure, producerProcedure, tenantProcedure } from '../trpc';
import { insertProductSchema } from '@frescari/validators';
import { products, farms, masterProducts } from '@frescari/db';
import { eq, sql, ilike } from 'drizzle-orm';
import { z } from 'zod';

export const productRouter = createTRPCRouter({

    create: producerProcedure
        .input(insertProductSchema)
        .mutation(async ({ ctx, input }) => {
            const dataToInsert: typeof products.$inferInsert = {
                ...input,
                tenantId: ctx.tenantId, // Force tenantId from context, never trust input
                pricePerUnit: input.pricePerUnit.toString(),
                minOrderQty: input.minOrderQty.toString(),
            };

            const [newProduct] = await ctx.db.insert(products).values(dataToInsert).returning();
            return newProduct;
        }),

    getById: publicProcedure
        .input(z.object({ id: z.string().uuid() }))
        .query(async ({ ctx, input }) => {
            const product = await ctx.db.query.products.findFirst({
                where: eq(products.id, input.id)
            });
            return product;
        }),

    list: tenantProcedure
        .query(async ({ ctx }) => {
            const tenantProducts = await ctx.db.query.products.findMany({
                where: eq(products.tenantId, ctx.tenantId),
            });
            return tenantProducts;
        }),

    getProducts: tenantProcedure.query(async ({ ctx }) => {
        const { db, tenantId } = ctx;

        const allProducts = await db.query.products.findMany({
            where: eq(products.tenantId, tenantId),
            with: {
                category: true,
                farm: true
            }
        });

        return allProducts;
    }),

    searchMasterProducts: protectedProcedure
        .input(z.object({
            query: z.string().min(1).optional()
        }))
        .query(async ({ ctx, input }) => {
            const { db } = ctx;

            const q = input.query ? `%${input.query}%` : '%';

            const results = await db.query.masterProducts.findMany({
                where: ilike(masterProducts.name, q),
                limit: 20
            });

            return results;
        }),
});
