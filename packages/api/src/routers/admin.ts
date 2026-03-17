import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq, gt, gte, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';

import {
    type AppDb,
    enableProductLotBypassContext,
    enableRlsBypassContext,
    farms,
    masterProducts,
    orders,
    productCategories,
    productLots,
    products,
    tenants,
} from '@frescari/db';

import {
    getTenantAddressesPage,
    getTenantOperationDetail,
    getTenantFarmsPage,
    getTenantOrdersAsBuyerPage,
    getTenantOrdersAsSellerPage,
    getTenantProductsPage,
    getTenantLotsPage,
    getTenantOperationsOverview,
    getTenantUsersPage,
    tenantOperationDetailSchema,
    tenantOperationPageSchema,
    tenantOperationsFilterSchema,
} from '../admin/tenant-operations';
import { safeRevalidatePath } from '../cache';
import { createTRPCRouter, protectedProcedure } from '../trpc';

const activeOrderStatuses = [
    'confirmed',
    'payment_authorized',
    'awaiting_weight',
    'picking',
    'ready_for_dispatch',
    'in_transit',
    'delivered',
] as const;

const operationalOrderStatuses = [
    'payment_authorized',
    'awaiting_weight',
    'picking',
    'ready_for_dispatch',
    'in_transit',
] as const;

const dashboardFilterSchema = z.object({
    periodDays: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30),
});

const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
    if (ctx.user.role !== 'admin') {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Apenas administradores podem acessar este recurso.',
        });
    }

    return ctx.db.transaction(async (tx) => {
        await enableRlsBypassContext(tx);

        return next({
            ctx: {
                ...ctx,
                db: tx as AppDb,
            },
        });
    });
});

const categorySchema = z.object({
    name: z.string().trim().min(2, 'Informe um nome de categoria valido.'),
    slug: z
        .string()
        .trim()
        .min(2, 'Informe um slug valido.')
        .regex(/^[a-z0-9-]+$/, 'Use apenas letras minusculas, numeros e hifens no slug.'),
    seoDescription: z.string().trim().max(160).optional(),
});

const masterProductSchema = z.object({
    name: z.string().trim().min(2, 'Informe um nome de produto valido.'),
    categoryId: z.string().uuid('Selecione uma categoria valida.'),
    pricingType: z.enum(['UNIT', 'WEIGHT', 'BOX']),
    defaultImageUrl: z
        .union([z.string().trim().url('Informe uma URL de imagem valida.'), z.literal('')])
        .optional(),
});

function normalizeOptionalText(value?: string) {
    if (!value) {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function isUniqueViolation(error: unknown) {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
    );
}

function toNumber(value: number | string | null | undefined) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
}

function getWindowStart(periodDays: number) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (periodDays - 1));
    return date;
}

function formatDayKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function buildTrendPoints(args: {
    orderRows: Array<{ day: string; orders: string; gmv: string }>;
    periodDays: number;
    producerRows: Array<{ day: string; producers: string }>;
}) {
    const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
    });
    const startDate = getWindowStart(args.periodDays);
    const orderMap = new Map(
        args.orderRows.map((row) => [
            row.day,
            {
                gmv: toNumber(row.gmv),
                orders: toNumber(row.orders),
            },
        ]),
    );
    const producerMap = new Map(
        args.producerRows.map((row) => [row.day, toNumber(row.producers)]),
    );

    return Array.from({ length: args.periodDays }, (_, index) => {
        const pointDate = new Date(startDate);
        pointDate.setDate(startDate.getDate() + index);

        const day = formatDayKey(pointDate);
        const ordersForDay = orderMap.get(day);

        return {
            day,
            gmv: ordersForDay?.gmv ?? 0,
            label: dateFormatter.format(pointDate),
            orders: ordersForDay?.orders ?? 0,
            producers: producerMap.get(day) ?? 0,
        };
    });
}

export const adminRouter = createTRPCRouter({
    getTenantOperationsOverview: adminProcedure
        .input(tenantOperationsFilterSchema)
        .query(async ({ ctx, input }) => getTenantOperationsOverview(ctx.db, input)),

    getTenantOperationDetail: adminProcedure
        .input(tenantOperationDetailSchema)
        .query(async ({ ctx, input }) => {
            const detail = await getTenantOperationDetail(ctx.db, input);

            if (!detail) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Tenant nao encontrado.',
                });
            }

            return detail;
        }),

    getTenantUsersPage: adminProcedure
        .input(tenantOperationPageSchema)
        .query(async ({ ctx, input }) => getTenantUsersPage(ctx.db, input)),

    getTenantFarmsPage: adminProcedure
        .input(tenantOperationPageSchema)
        .query(async ({ ctx, input }) => getTenantFarmsPage(ctx.db, input)),

    getTenantAddressesPage: adminProcedure
        .input(tenantOperationPageSchema)
        .query(async ({ ctx, input }) => getTenantAddressesPage(ctx.db, input)),

    getTenantProductsPage: adminProcedure
        .input(tenantOperationPageSchema)
        .query(async ({ ctx, input }) => getTenantProductsPage(ctx.db, input)),

    getTenantLotsPage: adminProcedure
        .input(tenantOperationPageSchema)
        .query(async ({ ctx, input }) => getTenantLotsPage(ctx.db, input)),

    getTenantOrdersAsBuyerPage: adminProcedure
        .input(tenantOperationPageSchema)
        .query(async ({ ctx, input }) => getTenantOrdersAsBuyerPage(ctx.db, input)),

    getTenantOrdersAsSellerPage: adminProcedure
        .input(tenantOperationPageSchema)
        .query(async ({ ctx, input }) => getTenantOrdersAsSellerPage(ctx.db, input)),

    getDashboardOverview: adminProcedure
        .input(dashboardFilterSchema)
        .query(async ({ ctx, input }) => {
            const windowStart = getWindowStart(input.periodDays);
            const activeLotFilter = and(
                isNull(productLots.deletedAt),
                eq(productLots.isExpired, false),
                gt(productLots.availableQty, '0'),
            );
            const expiredLotFilter = and(
                isNull(productLots.deletedAt),
                eq(productLots.isExpired, true),
                gt(productLots.availableQty, '0'),
            );
            const windowOrdersFilter = and(
                gte(orders.createdAt, windowStart),
                inArray(orders.status, activeOrderStatuses),
            );
            const categoryCount = await ctx.db
                .select({
                    count: sql<string>`count(*)`,
                })
                .from(productCategories);
            const masterProductCount = await ctx.db
                .select({
                    count: sql<string>`count(*)`,
                })
                .from(masterProducts);
            const tenantTotals = await ctx.db
                .select({
                    count: sql<string>`count(*)`,
                    type: tenants.type,
                })
                .from(tenants)
                .groupBy(tenants.type);
            const lotActivity = await ctx.db
                .select({
                    activeLots: sql<string>`count(*)`,
                    activeProducerTenants: sql<string>`count(distinct ${productLots.tenantId})`,
                })
                .from(productLots)
                .where(activeLotFilter);
            const windowOrders = await ctx.db
                .select({
                    gmv: sql<string>`coalesce(sum(${orders.totalAmount}), 0)`,
                    orders: sql<string>`count(*)`,
                })
                .from(orders)
                .where(windowOrdersFilter);
            const activeBuyers = await ctx.db
                .select({
                    count: sql<string>`count(distinct ${orders.buyerTenantId})`,
                })
                .from(orders)
                .where(windowOrdersFilter);
            const newTenants = await ctx.db
                .select({
                    count: sql<string>`count(*)`,
                })
                .from(tenants)
                .where(gte(tenants.createdAt, windowStart));
            const productsWithoutMaster = await ctx.db
                .select({
                    count: sql<string>`count(*)`,
                })
                .from(products)
                .where(and(eq(products.isActive, true), isNull(products.masterProductId)));
            const masterProductsWithoutImage = await ctx.db
                .select({
                    count: sql<string>`count(*)`,
                })
                .from(masterProducts)
                .where(
                    sql`${masterProducts.defaultImageUrl} is null or ${masterProducts.defaultImageUrl} = ''`,
                );
            const expiredLotsWithStock = await ctx.db
                .select({
                    count: sql<string>`count(*)`,
                })
                .from(productLots)
                .where(expiredLotFilter);
            const producersWithoutFarm = await ctx.db
                .select({
                    count: sql<string>`count(*)`,
                })
                .from(tenants)
                .leftJoin(farms, eq(farms.tenantId, tenants.id))
                .where(and(eq(tenants.type, 'PRODUCER'), isNull(farms.id)));
            const operationalOrdersCount = await ctx.db
                .select({
                    count: sql<string>`count(*)`,
                })
                .from(orders)
                .where(inArray(orders.status, operationalOrderStatuses));

            const ordersTrendBucket = sql<string>`date_trunc('day', ${orders.createdAt})::date::text`;
            const producerTrendBucket = sql<string>`date_trunc('day', ${tenants.createdAt})::date::text`;
            const orderTrendRows = await ctx.db
                .select({
                    day: ordersTrendBucket,
                    gmv: sql<string>`coalesce(sum(${orders.totalAmount}), 0)`,
                    orders: sql<string>`count(*)`,
                })
                .from(orders)
                .where(windowOrdersFilter)
                .groupBy(ordersTrendBucket)
                .orderBy(ordersTrendBucket);
            const producerTrendRows = await ctx.db
                .select({
                    day: producerTrendBucket,
                    producers: sql<string>`count(*)`,
                })
                .from(tenants)
                .where(and(eq(tenants.type, 'PRODUCER'), gte(tenants.createdAt, windowStart)))
                .groupBy(producerTrendBucket)
                .orderBy(producerTrendBucket);

            const operationalOrders = await ctx.db
                .select({
                    createdAt: orders.createdAt,
                    id: orders.id,
                    sellerName: tenants.name,
                    status: orders.status,
                    totalAmount: orders.totalAmount,
                })
                .from(orders)
                .innerJoin(tenants, eq(orders.sellerTenantId, tenants.id))
                .where(inArray(orders.status, operationalOrderStatuses))
                .orderBy(desc(orders.createdAt))
                .limit(6);
            const onboardingTenants = await ctx.db
                .select({
                    createdAt: tenants.createdAt,
                    id: tenants.id,
                    name: tenants.name,
                })
                .from(tenants)
                .leftJoin(farms, eq(farms.tenantId, tenants.id))
                .where(and(eq(tenants.type, 'PRODUCER'), isNull(farms.id)))
                .orderBy(desc(tenants.createdAt))
                .limit(6);
            const productsWithoutMasterRows = await ctx.db
                .select({
                    createdAt: products.createdAt,
                    id: products.id,
                    tenantName: tenants.name,
                    title: products.name,
                })
                .from(products)
                .innerJoin(tenants, eq(products.tenantId, tenants.id))
                .where(and(eq(products.isActive, true), isNull(products.masterProductId)))
                .orderBy(desc(products.createdAt))
                .limit(3);
            const masterProductsWithoutImageRows = await ctx.db
                .select({
                    createdAt: masterProducts.createdAt,
                    id: masterProducts.id,
                    subtitle: masterProducts.category,
                    title: masterProducts.name,
                })
                .from(masterProducts)
                .where(
                    sql`${masterProducts.defaultImageUrl} is null or ${masterProducts.defaultImageUrl} = ''`,
                )
                .orderBy(desc(masterProducts.createdAt))
                .limit(3);
            const expiredLotsRows = await ctx.db
                .select({
                    createdAt: productLots.createdAt,
                    id: productLots.id,
                    subtitle: products.name,
                    title: productLots.lotCode,
                })
                .from(productLots)
                .innerJoin(products, eq(productLots.productId, products.id))
                .where(expiredLotFilter)
                .orderBy(desc(productLots.createdAt))
                .limit(3);

            const tenantCountByType = tenantTotals.reduce(
                (accumulator, currentValue) => ({
                    ...accumulator,
                    [currentValue.type ?? 'UNKNOWN']: toNumber(currentValue.count),
                }),
                {} as Record<string, number>,
            );
            const productsWithoutMasterCount = toNumber(productsWithoutMaster[0]?.count);
            const masterProductsWithoutImageCount = toNumber(
                masterProductsWithoutImage[0]?.count,
            );
            const expiredLotsWithStockCount = toNumber(expiredLotsWithStock[0]?.count);
            const catalogAlertCount =
                productsWithoutMasterCount +
                masterProductsWithoutImageCount +
                expiredLotsWithStockCount;

            const catalogIssues = [
                ...productsWithoutMasterRows.map((row) => ({
                    createdAt: row.createdAt,
                    id: row.id,
                    label: 'Produto sem mestre',
                    subtitle: row.tenantName,
                    title: row.title,
                })),
                ...masterProductsWithoutImageRows.map((row) => ({
                    createdAt: row.createdAt,
                    id: row.id,
                    label: 'Mestre sem imagem',
                    subtitle: row.subtitle,
                    title: row.title,
                })),
                ...expiredLotsRows.map((row) => ({
                    createdAt: row.createdAt,
                    id: row.id,
                    label: 'Lote expirado com saldo',
                    subtitle: row.subtitle,
                    title: row.title,
                })),
            ]
                .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
                .slice(0, 6);

            return {
                attention: {
                    catalogAlerts: catalogAlertCount,
                    operationalOrders: toNumber(operationalOrdersCount[0]?.count),
                    producerOnboarding: toNumber(producersWithoutFarm[0]?.count),
                },
                catalogBreakdown: {
                    expiredLotsWithStock: expiredLotsWithStockCount,
                    masterProductsWithoutImage: masterProductsWithoutImageCount,
                    productsWithoutMaster: productsWithoutMasterCount,
                },
                generatedAt: new Date(),
                kpis: {
                    activeBuyersInWindow: toNumber(activeBuyers[0]?.count),
                    activeLots: toNumber(lotActivity[0]?.activeLots),
                    activeProducerTenants: toNumber(lotActivity[0]?.activeProducerTenants),
                    catalogAlerts: catalogAlertCount,
                    gmvInWindow: toNumber(windowOrders[0]?.gmv),
                    newTenantsInWindow: toNumber(newTenants[0]?.count),
                    ordersInWindow: toNumber(windowOrders[0]?.orders),
                },
                periodDays: input.periodDays,
                queues: {
                    catalogIssues,
                    onboardingTenants,
                    operationalOrders,
                },
                totals: {
                    buyerTenants: tenantCountByType.BUYER ?? 0,
                    categories: toNumber(categoryCount[0]?.count),
                    masterProducts: toNumber(masterProductCount[0]?.count),
                    producerTenants: tenantCountByType.PRODUCER ?? 0,
                },
                trend: buildTrendPoints({
                    orderRows: orderTrendRows,
                    periodDays: input.periodDays,
                    producerRows: producerTrendRows,
                }),
            };
        }),

    listCategories: adminProcedure.query(async ({ ctx }) => {
        return ctx.db
            .select({
                createdAt: productCategories.createdAt,
                id: productCategories.id,
                name: productCategories.name,
                seoDescription: productCategories.seoDescription,
                slug: productCategories.slug,
            })
            .from(productCategories)
            .orderBy(asc(productCategories.name));
    }),

    createCategory: adminProcedure
        .input(categorySchema)
        .mutation(async ({ ctx, input }) => {
            try {
                const [createdCategory] = await ctx.db
                    .insert(productCategories)
                    .values({
                        name: input.name,
                        seoDescription: normalizeOptionalText(input.seoDescription),
                        slug: input.slug.toLowerCase(),
                    })
                    .returning();

                return createdCategory;
            } catch (error) {
                if (isUniqueViolation(error)) {
                    throw new TRPCError({
                        code: 'CONFLICT',
                        message: 'Ja existe uma categoria com este slug.',
                    });
                }

                throw error;
            }
        }),

    updateCategory: adminProcedure
        .input(
            categorySchema.extend({
                id: z.string().uuid(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const currentCategory = await ctx.db.query.productCategories.findFirst({
                where: eq(productCategories.id, input.id),
            });

            if (!currentCategory) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Categoria nao encontrada.',
                });
            }

            try {
                const [updatedCategory] = await ctx.db
                    .update(productCategories)
                    .set({
                        name: input.name,
                        seoDescription: normalizeOptionalText(input.seoDescription),
                        slug: input.slug.toLowerCase(),
                    })
                    .where(eq(productCategories.id, input.id))
                    .returning();

                if (currentCategory.name !== input.name) {
                    await ctx.db
                        .update(masterProducts)
                        .set({ category: input.name })
                        .where(eq(masterProducts.category, currentCategory.name));
                }

                return updatedCategory;
            } catch (error) {
                if (isUniqueViolation(error)) {
                    throw new TRPCError({
                        code: 'CONFLICT',
                        message: 'Ja existe uma categoria com este slug.',
                    });
                }

                throw error;
            }
        }),

    listMasterProducts: adminProcedure.query(async ({ ctx }) => {
        const categories = await ctx.db
            .select({
                id: productCategories.id,
                name: productCategories.name,
            })
            .from(productCategories);

        const categoryNameToId = new Map(
            categories.map((category) => [category.name, category.id]),
        );

        const productsList = await ctx.db
            .select({
                category: masterProducts.category,
                createdAt: masterProducts.createdAt,
                defaultImageUrl: masterProducts.defaultImageUrl,
                id: masterProducts.id,
                name: masterProducts.name,
                pricingType: masterProducts.pricingType,
            })
            .from(masterProducts)
            .orderBy(asc(masterProducts.name));

        return productsList.map((product) => ({
            ...product,
            categoryId: categoryNameToId.get(product.category) ?? null,
        }));
    }),

    createMasterProduct: adminProcedure
        .input(masterProductSchema)
        .mutation(async ({ ctx, input }) => {
            const category = await ctx.db.query.productCategories.findFirst({
                where: eq(productCategories.id, input.categoryId),
            });

            if (!category) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Categoria selecionada nao encontrada.',
                });
            }

            const [createdProduct] = await ctx.db
                .insert(masterProducts)
                .values({
                    category: category.name,
                    defaultImageUrl: normalizeOptionalText(input.defaultImageUrl),
                    name: input.name,
                    pricingType: input.pricingType,
                })
                .returning();

            return {
                ...createdProduct,
                categoryId: category.id,
            };
        }),

    updateMasterProduct: adminProcedure
        .input(
            masterProductSchema.extend({
                id: z.string().uuid(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const updatedProduct = await ctx.db.transaction(async (tx) => {
                await enableProductLotBypassContext(tx);

                const [currentProduct] = await tx
                    .select({
                        id: masterProducts.id,
                        name: masterProducts.name,
                    })
                    .from(masterProducts)
                    .where(eq(masterProducts.id, input.id))
                    .limit(1);

                if (!currentProduct) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: 'Produto mestre nao encontrado.',
                    });
                }

                const [category] = await tx
                    .select({
                        id: productCategories.id,
                        name: productCategories.name,
                    })
                    .from(productCategories)
                    .where(eq(productCategories.id, input.categoryId))
                    .limit(1);

                if (!category) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: 'Categoria selecionada nao encontrada.',
                    });
                }

                const linkedProducts = await tx
                    .select({
                        id: products.id,
                    })
                    .from(products)
                    .where(eq(products.masterProductId, input.id));

                const linkedProductIds = linkedProducts.map((product) => product.id);

                const [nextMasterProduct] = await tx
                    .update(masterProducts)
                    .set({
                        category: category.name,
                        defaultImageUrl: normalizeOptionalText(input.defaultImageUrl),
                        name: input.name,
                        pricingType: input.pricingType,
                    })
                    .where(eq(masterProducts.id, input.id))
                    .returning();

                if (linkedProductIds.length > 0) {
                    await tx
                        .update(products)
                        .set({
                            categoryId: category.id,
                            name: input.name,
                        })
                        .where(inArray(products.id, linkedProductIds));

                    if (currentProduct.name !== input.name) {
                        await tx
                            .update(productLots)
                            .set({
                                lotCode: sql<string>`replace(${productLots.lotCode}, ${currentProduct.name}, ${input.name})`,
                            })
                            .where(inArray(productLots.productId, linkedProductIds));
                    }
                }

                return {
                    ...nextMasterProduct,
                    categoryId: category.id,
                };
            });

            safeRevalidatePath('/catalogo', 'layout');

            return updatedProduct;
        }),
});
