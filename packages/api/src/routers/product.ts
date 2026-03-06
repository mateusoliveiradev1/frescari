import { createTRPCRouter, publicProcedure, protectedProcedure } from '../trpc';
import { insertProductSchema } from '@frescari/validators';
import { products } from '@frescari/db';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

export const productRouter = createTRPCRouter({

    create: protectedProcedure
        .input(insertProductSchema)
        .mutation(async ({ ctx, input }) => {
            const [newProduct] = await ctx.db.insert(products).values(input as typeof products.$inferInsert).returning();
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

    list: protectedProcedure
        .query(async ({ ctx }) => {
            const tenantId = ctx.tenantId;
            if (!tenantId) return [];

            const tenantProducts = await ctx.db.query.products.findMany({
                where: eq(sql`${products.tenantId}::text`, tenantId),
            });
            return tenantProducts;
        }),

    getProducts: protectedProcedure
        .query(async ({ ctx }) => {
            const allProducts = await ctx.db.query.products.findMany({
                columns: {
                    id: true,
                    name: true,
                    saleUnit: true,
                }
            });
            return allProducts;
        })
});
