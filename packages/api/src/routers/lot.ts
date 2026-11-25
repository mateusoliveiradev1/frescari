import {
  buyerProcedure,
  createTRPCRouter,
  producerProcedure,
  publicProcedure,
} from "../trpc";
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
  orderItems,
  orders,
  productCategories,
  productLots,
  products,
  tenants,
} from "@frescari/db";
import { and, desc, eq, inArray, type SQL } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { safeRevalidatePath } from "../cache";
import { calculateLotPriceAndStatus } from "../utils/lot-status";
import { resolveEffectiveSaleUnit } from "../sale-units";
import { isPlatformOnlyStripeMode } from "../stripe-connect-mode";
import { isStripeConnectCatalogEligible } from "../utils/stripe-connect-status";
import {
  describeDeliverySchedule,
  resolveDeliverySchedule,
} from "../delivery-slots";

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
  safeRevalidatePath("/produtor", "layout");
};

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : "Unknown error";
};

const toPositiveNumberOrNull = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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
    sellerSlug?: string | null;
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
    sellerSlug: row.sellerSlug ?? null,
  };
};

type CatalogTx = Parameters<
  Parameters<typeof import("@frescari/db").db.transaction>[0]
>[0];

// The catalog's lot query (lots with product, farm, category and seller).
function selectCatalogLotRows(tx: CatalogTx, extraWhere?: SQL) {
  return tx
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
      sellerSlug: tenants.slug,
      sellerStripeAccountId: tenants.stripeAccountId,
      sellerStripeChargesEnabled: tenants.stripeChargesEnabled,
      sellerStripeDetailsSubmitted: tenants.stripeDetailsSubmitted,
      sellerStripePayoutsEnabled: tenants.stripePayoutsEnabled,
      sellerStripeRequirementsCurrentlyDue:
        tenants.stripeRequirementsCurrentlyDue,
      sellerStripeRequirementsDisabledReason:
        tenants.stripeRequirementsDisabledReason,
      sellerStripeRequirementsEventuallyDue:
        tenants.stripeRequirementsEventuallyDue,
      sellerStripeRequirementsPastDue: tenants.stripeRequirementsPastDue,
      sellerStripeStatusSyncedAt: tenants.stripeStatusSyncedAt,
    })
    .from(productLots)
    .leftJoin(products, eq(productLots.productId, products.id))
    .leftJoin(farms, eq(products.farmId, farms.id))
    .leftJoin(tenants, eq(productLots.tenantId, tenants.id))
    .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
    .where(activeProductLotWhere(extraWhere));
}

type CatalogLotRow = Awaited<ReturnType<typeof selectCatalogLotRows>>[number];

// What a buyer may see and buy: shared by the catalog and "Refazer pedido".
function toVisibleCatalogLots(rows: CatalogLotRow[]) {
  const requiresConnectedProducer = !isPlatformOnlyStripeMode();

  return (
    rows
      .filter((row) =>
        requiresConnectedProducer
          ? isStripeConnectCatalogEligible({
              stripeAccountId: row.sellerStripeAccountId,
              stripeChargesEnabled: row.sellerStripeChargesEnabled,
              stripeDetailsSubmitted: row.sellerStripeDetailsSubmitted,
              stripePayoutsEnabled: row.sellerStripePayoutsEnabled,
              stripeRequirementsCurrentlyDue:
                row.sellerStripeRequirementsCurrentlyDue,
              stripeRequirementsDisabledReason:
                row.sellerStripeRequirementsDisabledReason,
              stripeRequirementsEventuallyDue:
                row.sellerStripeRequirementsEventuallyDue,
              stripeRequirementsPastDue: row.sellerStripeRequirementsPastDue,
              stripeStatusSyncedAt: row.sellerStripeStatusSyncedAt,
            })
          : true,
      )
      .filter((row) => row.product?.isActive !== false)
      // Without a farm location freight cannot be quoted, so the buyer
      // would hit an error at checkout. Keep those lots out of the catalog;
      // the producer dashboard tells the producer why.
      .filter((row) => row.farmLocation != null)
      .map((row) => buildCatalogLot(row))
      .filter(
        (lot) =>
          !lot.isExpired && lot.availableQty > 0 && lot.farmId.length > 0,
      )
  );
}

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

          // The master product stores its category by name; fall back to any
          // category only if that name has no match, so lots land on the
          // right catalog page instead of whichever category comes first.
          const category =
            (await ctx.db.query.productCategories.findFirst({
              where: eq(productCategories.name, masterProduct.category),
            })) ?? (await ctx.db.query.productCategories.findFirst());
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
          return selectCatalogLotRows(
            tx,
            input.productId ? eq(products.id, input.productId) : undefined,
          );
        });

        return toVisibleCatalogLots(results).sort((left, right) =>
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

  // "Refazer pedido": the order's lots that are still for sale, at today's
  // price, with the same visibility rules as the catalog (not expired, in
  // stock, active product, located farm, producer able to receive). The
  // quantity is capped at what is available now.
  getReorderLots: buyerProcedure
    .input(z.object({ orderId: z.string().uuid() }).strict())
    .query(async ({ ctx, input }) => {
      const orderedItems = await ctx.db
        .select({ lotId: orderItems.lotId, qty: orderItems.qty })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(
          and(
            eq(orders.id, input.orderId),
            eq(orders.buyerTenantId, ctx.tenantId),
          ),
        );

      if (orderedItems.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pedido nao encontrado.",
        });
      }

      const qtyByLot = new Map<string, number>();
      for (const item of orderedItems) {
        if (!item.lotId) continue;
        qtyByLot.set(
          item.lotId,
          (qtyByLot.get(item.lotId) ?? 0) + Number(item.qty),
        );
      }

      const lotIds = [...qtyByLot.keys()];
      const rows =
        lotIds.length === 0
          ? []
          : await ctx.db.transaction(async (tx) => {
              await enableProductLotPublicReadContext(tx);
              return selectCatalogLotRows(tx, inArray(productLots.id, lotIds));
            });
      const available = toVisibleCatalogLots(rows);

      return {
        items: available.map((lot) => ({
          lot,
          quantity: Math.min(qtyByLot.get(lot.id) ?? 0, lot.availableQty),
        })),
        unavailableCount: orderedItems.length - available.length,
      };
    }),

  // What still stops this producer's lots from showing in the public catalog.
  // Public profile for the producer storefront (/produtor/[slug]). Only
  // non-sensitive fields: never phone, document or Stripe data.
  getProducerStorefront: publicProcedure
    .input(z.object({ slug: z.string().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        await enableProductLotPublicReadContext(tx);

        const [producer] = await tx
          .select({
            id: tenants.id,
            name: tenants.name,
            slug: tenants.slug,
            photoUrl: tenants.storefrontPhotoUrl,
            bio: tenants.storefrontBio,
          })
          .from(tenants)
          .where(
            and(eq(tenants.slug, input.slug), eq(tenants.type, "PRODUCER")),
          )
          .limit(1);

        if (!producer) {
          return null;
        }

        const [farm] = await tx
          .select({
            name: farms.name,
            address: farms.address,
            certifications: farms.certifications,
            maxDeliveryRadiusKm: farms.maxDeliveryRadiusKm,
            minOrderValue: farms.minOrderValue,
            freeShippingThreshold: farms.freeShippingThreshold,
            baseDeliveryFee: farms.baseDeliveryFee,
            deliveryDays: farms.deliveryDays,
            deliveryPeriods: farms.deliveryPeriods,
            deliveryLeadDays: farms.deliveryLeadDays,
          })
          .from(farms)
          .where(eq(farms.tenantId, producer.id))
          .limit(1);

        return {
          name: producer.name,
          slug: producer.slug,
          photoUrl: producer.photoUrl,
          bio: producer.bio,
          farmName: farm?.name ?? null,
          city: farm?.address?.city ?? null,
          state: farm?.address?.state ?? null,
          // Commercial terms the buyer sees at checkout anyway; shown up front
          // so they know before adding to the cart. Zero means "not set".
          certifications: (farm?.certifications ?? []).filter(Boolean),
          deliveryRadiusKm: toPositiveNumberOrNull(farm?.maxDeliveryRadiusKm),
          minOrderValue: toPositiveNumberOrNull(farm?.minOrderValue),
          freeShippingThreshold: toPositiveNumberOrNull(
            farm?.freeShippingThreshold,
          ),
          baseDeliveryFee: toPositiveNumberOrNull(farm?.baseDeliveryFee),
          deliveryScheduleLabel: farm
            ? describeDeliverySchedule(resolveDeliverySchedule(farm))
            : null,
        };
      });
    }),

  // Mirrors the filters in getAvailableLots, so "visible" here means visible there.
  getPublishReadiness: producerProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.tenantId;

    const [tenant] = await ctx.db
      .select({
        slug: tenants.slug,
        name: tenants.name,
        stripeAccountId: tenants.stripeAccountId,
        stripeChargesEnabled: tenants.stripeChargesEnabled,
        stripeDetailsSubmitted: tenants.stripeDetailsSubmitted,
        stripePayoutsEnabled: tenants.stripePayoutsEnabled,
        stripeRequirementsCurrentlyDue: tenants.stripeRequirementsCurrentlyDue,
        stripeRequirementsDisabledReason:
          tenants.stripeRequirementsDisabledReason,
        stripeRequirementsEventuallyDue:
          tenants.stripeRequirementsEventuallyDue,
        stripeRequirementsPastDue: tenants.stripeRequirementsPastDue,
        stripeStatusSyncedAt: tenants.stripeStatusSyncedAt,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    const farm = await ctx.db.query.farms.findFirst({
      where: eq(farms.tenantId, tenantId),
    });

    const activeLot = await ctx.db.transaction(async (tx) => {
      await enableProductLotTenantContext(tx, tenantId);

      return tx.query.productLots.findFirst({
        where: activeProductLotWhere(eq(productLots.tenantId, tenantId)),
        columns: { id: true },
      });
    });

    const paymentsReady =
      isPlatformOnlyStripeMode() ||
      (tenant ? isStripeConnectCatalogEligible(tenant) : false);
    const paymentsStarted = Boolean(tenant?.stripeAccountId);
    const farmLocated = Boolean(farm?.location);
    const hasActiveLot = Boolean(activeLot);

    return {
      paymentsStarted,
      paymentsReady,
      farmLocated,
      hasActiveLot,
      lotsVisibleInCatalog: paymentsReady && farmLocated,
      storefrontSlug: tenant?.slug ?? null,
      storefrontName: tenant?.name ?? null,
    };
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
