import { createTRPCRouter, producerProcedure, publicProcedure } from "../trpc";
import {
  createLotInputSchema,
  updateLotInputSchema,
  updateLotInventorySchema,
} from "@frescari/validators";
import {
  activeProductLotWhere,
  enableProductLotPublicReadContext,
  enableProductLotTenantContext,
  farms,
  masterProducts,
  productCategories,
  productLots,
  products,
  tenants,
} from "@frescari/db";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { safeRevalidatePath } from "../cache";
import { calculateLotPriceAndStatus } from "../utils/lot-status";
import { resolveEffectiveSaleUnit } from "../sale-units";
import { isPlatformOnlyStripeMode } from "../stripe-connect-mode";

const formatDateOnly = (value: string | Date) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parsedDate = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`Invalid date value: ${String(value)}`);
  }

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const revalidateCatalogPages = () => {
  safeRevalidatePath("/catalogo", "layout");
};

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : "Unknown error";
};

const buildCatalogLot = (
  row: {
    lot: typeof productLots.$inferSelect;
    product: typeof products.$inferSelect | null;
    farmName?: string | null;
    farmAddress?: (typeof farms.$inferSelect)["address"] | null;
    farmLocation?: (typeof farms.$inferSelect)["location"] | null;
    deliveryRadiusKm?:
      | (typeof farms.$inferSelect)["maxDeliveryRadiusKm"]
      | null;
    categorySlug?: string | null;
    categoryName?: string | null;
    categoryDescription?: string | null;
  },
  referenceDate = new Date(),
) => {
  const pricing = calculateLotPriceAndStatus(
    {
      expiryDate: row.lot.expiryDate,
      priceOverride: row.lot.priceOverride,
    },
    row.product?.pricePerUnit ?? 0,
    referenceDate,
  );

  return {
    id: row.lot.id,
    lotCode: row.lot.lotCode,
    farmId: row.product?.farmId ?? "",
    harvestDate: formatDateOnly(row.lot.harvestDate),
    expiryDate: formatDateOnly(row.lot.expiryDate),
    availableQty: Number(row.lot.availableQty),
    freshnessScore: row.lot.freshnessScore,
    productName: row.product?.name ?? "Produto Desconhecido",
    saleUnit: resolveEffectiveSaleUnit(row.product?.saleUnit, row.lot.unit),
    imageUrl: row.lot.imageUrl || row.product?.images?.[0] || null,
    farmName: row.farmName ?? "Produtor Local",
    originalPrice: pricing.originalPrice,
    finalPrice: pricing.finalPrice,
    calculatedPrice: pricing.finalPrice,
    isLastChance: pricing.isLastChance,
    isExpired: pricing.isExpired,
    pricingType: row.lot.pricingType,
    estimatedWeight: row.lot.estimatedWeight
      ? Number(row.lot.estimatedWeight)
      : null,
    unit: row.lot.unit || "un",
    status: pricing.status,
    farmCity: row.farmAddress?.city ?? null,
    farmState: row.farmAddress?.state ?? null,
    farmLatitude: row.farmLocation ? row.farmLocation[1] : null,
    farmLongitude: row.farmLocation ? row.farmLocation[0] : null,
    deliveryRadiusKm:
      row.deliveryRadiusKm === null || row.deliveryRadiusKm === undefined
        ? null
        : Number(row.deliveryRadiusKm),
    categorySlug: row.categorySlug ?? null,
    categoryName: row.categoryName ?? null,
    categoryDescription: row.categoryDescription ?? null,
  };
};

export const lotRouter = createTRPCRouter({
  create: producerProcedure
    .input(createLotInputSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId;

      let product = await ctx.db.query.products.findFirst({
        where: and(
          eq(products.tenantId, tenantId),
          eq(products.masterProductId, input.productId),
        ),
      });

      if (!product) {
        product = await ctx.db.query.products.findFirst({
          where: and(
            eq(products.id, input.productId),
            eq(products.tenantId, tenantId),
          ),
        });
      }

      if (!product) {
        const masterProduct = await ctx.db.query.masterProducts.findFirst({
          where: eq(masterProducts.id, input.productId),
        });

        if (masterProduct) {
          let farm = await ctx.db.query.farms.findFirst({
            where: eq(farms.tenantId, tenantId),
          });

          if (!farm) {
            const [newFarm] = await ctx.db
              .insert(farms)
              .values({
                name: `Farm ${ctx.user.name}`,
                tenantId,
              })
              .returning();

            if (!newFarm) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Nao foi possivel criar a fazenda padrao do produtor.",
              });
            }

            farm = newFarm;
          }

          const category = await ctx.db.query.productCategories.findFirst();
          if (!category) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "No categories found in system.",
            });
          }

          const [newProduct] = await ctx.db
            .insert(products)
            .values({
              tenantId,
              farmId: farm.id,
              categoryId: category.id,
              masterProductId: masterProduct.id,
              name: masterProduct.name,
              saleUnit: resolveEffectiveSaleUnit(undefined, input.unit),
              pricePerUnit: "0",
              minOrderQty: "1",
              images: masterProduct.defaultImageUrl
                ? [masterProduct.defaultImageUrl]
                : [],
              isActive: true,
            })
            .returning();

          product = newProduct;
        }
      }

      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Product not found and not in master catalog.",
        });
      }

      const valuesToInsert: typeof productLots.$inferInsert = {
        ...input,
        productId: product.id,
        tenantId,
        harvestDate: formatDateOnly(input.harvestDate),
        expiryDate: formatDateOnly(input.expiryDate),
        availableQty: input.availableQty.toString(),
        priceOverride:
          input.priceOverride === null || input.priceOverride === undefined
            ? null
            : input.priceOverride.toString(),
        freshnessScore: 100,
        reservedQty: "0",
        isExpired: false,
      };

      const [newLot] = await ctx.db.transaction(async (tx) => {
        await enableProductLotTenantContext(tx, tenantId);

        return tx.insert(productLots).values(valuesToInsert).returning();
      });

      revalidateCatalogPages();

      return newLot;
    }),

  updateInventory: producerProcedure
    .input(updateLotInventorySchema)
    .mutation(async ({ ctx, input }) => {
      const [updatedLot] = await ctx.db.transaction(async (tx) => {
        await enableProductLotTenantContext(tx, ctx.tenantId);

        return tx
          .update(productLots)
          .set({ availableQty: input.newAvailableQty.toString() })
          .where(
            activeProductLotWhere(
              eq(productLots.id, input.lotId),
              eq(productLots.tenantId, ctx.tenantId),
            ),
          )
          .returning();
      });

      if (updatedLot) {
        revalidateCatalogPages();
      }

      return updatedLot;
    }),

  getAvailableLots: publicProcedure
    .input(z.object({ productId: z.string().uuid().optional() }))
    .query(async ({ ctx, input }) => {
      try {
        const results = await ctx.db.transaction(async (tx) => {
          await enableProductLotPublicReadContext(tx);

          const baseQuery = tx
            .select({
              lot: productLots,
              product: products,
              farmName: farms.name,
              farmAddress: farms.address,
              farmLocation: farms.location,
              deliveryRadiusKm: farms.maxDeliveryRadiusKm,
              categorySlug: productCategories.slug,
              categoryName: productCategories.name,
              categoryDescription: productCategories.seoDescription,
              sellerStripeAccountId: tenants.stripeAccountId,
            })
            .from(productLots)
            .leftJoin(products, eq(productLots.productId, products.id))
            .leftJoin(farms, eq(products.farmId, farms.id))
            .leftJoin(tenants, eq(productLots.tenantId, tenants.id))
            .leftJoin(
              productCategories,
              eq(products.categoryId, productCategories.id),
            );

          return input.productId
            ? baseQuery.where(
                activeProductLotWhere(eq(products.id, input.productId)),
              )
            : baseQuery.where(activeProductLotWhere());
        });

        const requiresConnectedProducer = !isPlatformOnlyStripeMode();

        return results
          .filter((row) =>
            requiresConnectedProducer
              ? Boolean(row.sellerStripeAccountId)
              : true,
          )
          .filter((row) => row.product?.isActive !== false)
          .map((row) => buildCatalogLot(row))
          .filter(
            (lot) =>
              !lot.isExpired && lot.availableQty > 0 && lot.farmId.length > 0,
          )
          .sort((left, right) =>
            left.expiryDate.localeCompare(right.expiryDate),
          );
      } catch (error: unknown) {
        console.error("[DB_CATALOG_ERROR]:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: getErrorMessage(error),
        });
      }
    }),

  getDashboardMetrics: producerProcedure.query(async ({ ctx }) => {
    try {
      const tenantId = ctx.tenantId;

      const allLots = await ctx.db.transaction(async (tx) => {
        await enableProductLotTenantContext(tx, tenantId);

        return tx.query.productLots.findMany({
          where: activeProductLotWhere(eq(productLots.tenantId, tenantId)),
          with: { product: true },
        });
      });

      let activeLots = 0;
      let lastChanceQty = 0;
      let totalGramsSaved = 0;

      for (const lot of allLots) {
        const availableQty = Number(lot.availableQty);
        if (availableQty <= 0) {
          continue;
        }

        const pricing = calculateLotPriceAndStatus(
          {
            expiryDate: lot.expiryDate,
            priceOverride: lot.priceOverride,
          },
          lot.product?.pricePerUnit ?? 0,
        );

        if (pricing.isExpired) {
          continue;
        }

        activeLots += 1;

        if (pricing.isLastChance) {
          lastChanceQty += availableQty;
        }

        const weightG = lot.product?.unitWeightG || 1000;
        totalGramsSaved += availableQty * weightG;
      }

      const co2AvoidedKg = (totalGramsSaved / 1000) * 1.2;

      return {
        activeLots,
        lastChanceQty,
        co2AvoidedKg: Number(co2AvoidedKg.toFixed(2)),
      };
    } catch (error: unknown) {
      console.error("[DB_ERROR]: Erro na query getDashboardMetrics:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: getErrorMessage(error),
      });
    }
  }),

  getRecentLots: producerProcedure.query(async ({ ctx }) => {
    try {
      const tenantId = ctx.tenantId;

      const recentLots = await ctx.db.transaction(async (tx) => {
        await enableProductLotTenantContext(tx, tenantId);

        return tx.query.productLots.findMany({
          where: activeProductLotWhere(eq(productLots.tenantId, tenantId)),
          with: {
            product: true,
          },
          orderBy: (lots, { desc: orderByDesc }) => [
            orderByDesc(lots.createdAt),
          ],
          limit: 5,
        });
      });

      return recentLots.map((lot) => {
        const pricing = calculateLotPriceAndStatus(
          {
            expiryDate: lot.expiryDate,
            priceOverride: lot.priceOverride,
          },
          lot.product?.pricePerUnit ?? 0,
        );

        return {
          id: lot.id,
          lotCode: lot.lotCode,
          productName: lot.product?.name ?? "Produto Desconhecido",
          availableQty: Number(lot.availableQty),
          harvestDate: formatDateOnly(lot.harvestDate),
          expiryDate: formatDateOnly(lot.expiryDate),
          freshnessScore: lot.freshnessScore,
          imageUrl: lot.imageUrl || lot.product?.images?.[0] || null,
          priceOverride: lot.priceOverride ? Number(lot.priceOverride) : null,
          calculatedPrice: pricing.finalPrice,
          status: pricing.status,
          isExpired: pricing.isExpired,
          isLastChance: pricing.isLastChance,
        };
      });
    } catch (error: unknown) {
      console.error("[DB_ERROR]: Erro na query getRecentLots:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: getErrorMessage(error),
      });
    }
  }),

  getByProducer: producerProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.tenantId;

    const results = await ctx.db.transaction(async (tx) => {
      await enableProductLotTenantContext(tx, tenantId);

      return tx
        .select({
          lot: productLots,
          product: products,
        })
        .from(productLots)
        .innerJoin(products, eq(productLots.productId, products.id))
        .where(activeProductLotWhere(eq(productLots.tenantId, tenantId)))
        .orderBy(desc(productLots.createdAt));
    });

    return results.map((row) => {
      const pricing = calculateLotPriceAndStatus(
        {
          expiryDate: row.lot.expiryDate,
          priceOverride: row.lot.priceOverride,
        },
        row.product.pricePerUnit,
      );

      return {
        ...row.lot,
        harvestDate: formatDateOnly(row.lot.harvestDate),
        expiryDate: formatDateOnly(row.lot.expiryDate),
        availableQty: Number(row.lot.availableQty),
        priceOverride: row.lot.priceOverride
          ? Number(row.lot.priceOverride)
          : null,
        estimatedWeight: row.lot.estimatedWeight
          ? Number(row.lot.estimatedWeight)
          : null,
        productName: row.product.name,
        imageUrl: row.lot.imageUrl || row.product.images?.[0] || null,
        status: pricing.status,
        isExpired: pricing.isExpired,
        isLastChance: pricing.isLastChance,
        originalPrice: pricing.originalPrice,
        finalPrice: pricing.finalPrice,
        calculatedPrice: pricing.finalPrice,
      };
    });
  }),

  delete: producerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId;

      const [deleted] = await ctx.db.transaction(async (tx) => {
        await enableProductLotTenantContext(tx, tenantId);

        return tx
          .update(productLots)
          .set({ deletedAt: new Date() })
          .where(
            activeProductLotWhere(
              eq(productLots.id, input.id),
              eq(productLots.tenantId, tenantId),
            ),
          )
          .returning();
      });

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Lote nao encontrado ou permissao negada.",
        });
      }

      revalidateCatalogPages();

      return { success: true };
    }),

  update: producerProcedure
    .input(updateLotInputSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId;
      const { id, ...data } = input;

      const existingLot = await ctx.db.transaction(async (tx) => {
        await enableProductLotTenantContext(tx, tenantId);

        return tx.query.productLots.findFirst({
          where: activeProductLotWhere(
            eq(productLots.id, id),
            eq(productLots.tenantId, tenantId),
          ),
        });
      });

      if (!existingLot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Lote nao encontrado ou permissao negada.",
        });
      }

      const nextHarvestDate = data.harvestDate
        ? formatDateOnly(data.harvestDate)
        : formatDateOnly(existingLot.harvestDate);
      const nextExpiryDate = data.expiryDate
        ? formatDateOnly(data.expiryDate)
        : formatDateOnly(existingLot.expiryDate);

      if (nextExpiryDate <= nextHarvestDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A data de validade deve ser maior que a data de colheita.",
        });
      }

      const updateValues: Partial<typeof productLots.$inferInsert> = {};

      if (data.availableQty !== undefined) {
        updateValues.availableQty = data.availableQty.toString();
      }
      if (data.priceOverride !== undefined) {
        updateValues.priceOverride =
          data.priceOverride === null ? null : data.priceOverride.toString();
      }
      if (data.expiryDate !== undefined) {
        updateValues.expiryDate = nextExpiryDate;
      }
      if (data.harvestDate !== undefined) {
        updateValues.harvestDate = nextHarvestDate;
      }
      if (data.pricingType !== undefined) {
        updateValues.pricingType = data.pricingType;
      }
      if (data.unit !== undefined) {
        updateValues.unit = data.unit;
      }
      if (data.imageUrl !== undefined) {
        updateValues.imageUrl = data.imageUrl;
      }

      const [updated] = await ctx.db.transaction(async (tx) => {
        await enableProductLotTenantContext(tx, tenantId);

        return tx
          .update(productLots)
          .set(updateValues)
          .where(
            activeProductLotWhere(
              eq(productLots.id, id),
              eq(productLots.tenantId, tenantId),
            ),
          )
          .returning();
      });

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Lote nao encontrado ou permissao negada.",
        });
      }

      revalidateCatalogPages();

      return updated;
    }),
});
