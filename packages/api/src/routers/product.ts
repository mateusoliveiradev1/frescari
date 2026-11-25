import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  producerProcedure,
  tenantProcedure,
} from "../trpc";
import { insertProductSchema } from "@frescari/validators";
import {
  enableCatalogPublicReadContext,
  farms,
  products,
  masterProducts,
} from "@frescari/db";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

function foldAccents(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[%_\\]/g, (match) => `\\${match}`);
}

export const productRouter = createTRPCRouter({
  create: producerProcedure
    .input(insertProductSchema)
    .mutation(async ({ ctx, input }) => {
      // The products table's row-level security only checks tenant_id, so
      // the farm is checked here: a product (and its lots) on another
      // producer's farm would sell under their name, location and freight.
      const ownFarm = await ctx.db.query.farms.findFirst({
        columns: { id: true },
        where: and(
          eq(farms.id, input.farmId),
          eq(farms.tenantId, ctx.tenantId),
        ),
      });

      if (!ownFarm) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Fazenda nao encontrada na sua conta.",
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the id is generated, never taken from the client
      const { id: _ignoredId, ...productInput } = input;
      const dataToInsert: typeof products.$inferInsert = {
        ...productInput,
        tenantId: ctx.tenantId, // Force tenantId from context, never trust input
        pricePerUnit: input.pricePerUnit.toString(),
        minOrderQty: input.minOrderQty.toString(),
      };

      const [newProduct] = await ctx.db
        .insert(products)
        .values(dataToInsert)
        .returning();
      return newProduct;
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const product = await ctx.db.transaction(async (tx) => {
        await enableCatalogPublicReadContext(tx);

        return tx.query.products.findFirst({
          where: eq(products.id, input.id),
        });
      });

      return product;
    }),

  list: tenantProcedure.query(async ({ ctx }) => {
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
        farm: true,
      },
    });

    return allProducts;
  }),

  searchMasterProducts: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      // Accent- and case-insensitive: "maca" must find "Maçã Fuji".
      // translate() avoids depending on the unaccent extension.
      const accented = "áàâãäéèêëíìîïóòôõöúùûüçñ";
      const plain = "aaaaaeeeeiiiiooooouuuucn";
      const q = input.query ? `%${foldAccents(input.query)}%` : "%";

      const results = await db.query.masterProducts.findMany({
        where: sql`translate(lower(${masterProducts.name}), ${accented}, ${plain}) like ${q}`,
        orderBy: (fields, { asc }) => [asc(fields.name)],
        limit: 20,
      });

      return results;
    }),
});
