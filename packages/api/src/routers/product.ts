import { createTRPCRouter, publicProcedure, protectedProcedure } from '../trpc';
import { insertProductSchema } from '@frescari/validators';
import { products, farms, masterProducts } from '@frescari/db';
import { eq, sql, ilike } from 'drizzle-orm';
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

    getProducts: protectedProcedure.query(async ({ ctx }) => {
        const { db, session } = ctx;

        let targetTenantId = session.user.tenantId;

        // Se já tiver tenantId na sessão
        if (!targetTenantId) {
            // Busca o farm do user
            const userFarm = await db.query.farms.findFirst({
                where: eq(farms.id, session.user.id) // Simplificacao para o test
            });
            // targetTenantId = userFarm?.tenantId;
        }

        const allProducts = await db.query.products.findMany({
            with: {
                category: true,
                farm: true
            }
            // where: eq(products.tenantId, targetTenantId)
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
