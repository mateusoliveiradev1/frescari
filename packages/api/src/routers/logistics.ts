import { TRPCError } from '@trpc/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import {
    addresses,
    enableTenantCatalogReadContext,
    farms,
    orderItems,
    orders,
    products,
    tenants,
} from '@frescari/db';
import { calculateFreightSchema } from '@frescari/validators';

import { buyerProcedure, createTRPCRouter, producerProcedure } from '../trpc';

const pendingDeliveryStatuses = ['payment_authorized', 'confirmed', 'picking'] as const;
const deliveryMutationStatuses = ['in_transit', 'delivered'] as const;
const GENEROUS_MVP_DELIVERY_RADIUS_KM = 5000;

type DeliveryMutationStatus = (typeof deliveryMutationStatuses)[number];

type PendingDeliveryRow = {
    orderId: string;
    status: string;
    totalAmount: string;
    deliveryFee: string;
    createdAt: Date;
    buyerTenantId: string;
    buyerName: string;
    deliveryStreet: string;
    deliveryNumber: string;
    deliveryCep: string;
    deliveryCity: string;
    deliveryState: string;
    deliveryAddress: string;
    deliveryNotes: string | null;
    deliveryWindowStart: Date | null;
    deliveryWindowEnd: Date | null;
    farmId: string | null;
    farmName: string | null;
    farmLatitude: number | null;
    farmLongitude: number | null;
    deliveryLatitude: number | null;
    deliveryLongitude: number | null;
    distanceKm: number | null;
    orderItemId: string;
    productId: string;
    productName: string;
    itemQty: string;
    itemSaleUnit: string;
    productSaleUnit: string;
    unitWeightG: number | null;
    estimatedWeightKg: number | null;
};

type PendingDeliveryItem = {
    orderItemId: string;
    productId: string;
    productName: string;
    qty: string;
    saleUnit: string;
    productSaleUnit: string;
    unitWeightG: number | null;
    estimatedWeightKg: number | null;
};

type PendingDelivery = {
    orderId: string;
    status: string;
    totalAmount: string;
    deliveryFee: string;
    createdAt: Date;
    buyerTenantId: string;
    buyerName: string;
    deliveryAddress: {
        street: string;
        number: string;
        cep: string;
        city: string;
        state: string;
        label: string;
        notes: string | null;
    };
    deliveryWindow: {
        start: Date | null;
        end: Date | null;
    };
    distanceKm: number | null;
    origin: {
        farmId: string;
        farmName: string;
        latitude: number | null;
        longitude: number | null;
    } | null;
    destination: {
        latitude: number | null;
        longitude: number | null;
    } | null;
    items: PendingDeliveryItem[];
};

export function resolveEffectiveDeliveryRadiusKm(rawRadiusKm: string | number | null | undefined) {
    const parsedRadiusKm =
        typeof rawRadiusKm === 'number' ? rawRadiusKm : Number(rawRadiusKm);

    if (!Number.isFinite(parsedRadiusKm) || parsedRadiusKm <= 0) {
        return GENEROUS_MVP_DELIVERY_RADIUS_KM;
    }

    return parsedRadiusKm;
}

function normalizeCurrencyValue(rawValue: string | number | null | undefined) {
    const parsedValue =
        typeof rawValue === 'number' ? rawValue : Number(rawValue ?? 0);

    if (!Number.isFinite(parsedValue)) {
        return 0;
    }

    return Math.max(0, Number(parsedValue.toFixed(2)));
}

function normalizeNullableCurrencyValue(rawValue: string | number | null | undefined) {
    if (rawValue === null || rawValue === undefined) {
        return null;
    }

    const parsedValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);

    if (!Number.isFinite(parsedValue)) {
        return null;
    }

    return Math.max(0, Number(parsedValue.toFixed(2)));
}

function assertDeliveryTransition(currentStatus: string, nextStatus: DeliveryMutationStatus) {
    const allowedTransitions: Record<string, DeliveryMutationStatus[]> = {
        confirmed: ['in_transit', 'delivered'],
        picking: ['in_transit', 'delivered'],
        in_transit: ['delivered'],
    };

    const allowedNextStatuses = allowedTransitions[currentStatus] ?? [];

    if (!allowedNextStatuses.includes(nextStatus)) {
        throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Nao e possivel avancar um pedido com status "${currentStatus}" para "${nextStatus}".`,
        });
    }
}

function groupPendingDeliveryRows(rows: PendingDeliveryRow[]): PendingDelivery[] {
    const deliveriesByOrder = new Map<string, PendingDelivery>();

    for (const row of rows) {
        const existingDelivery = deliveriesByOrder.get(row.orderId);

        if (!existingDelivery) {
            deliveriesByOrder.set(row.orderId, {
                orderId: row.orderId,
                status: row.status,
                totalAmount: row.totalAmount,
                deliveryFee: row.deliveryFee,
                createdAt: row.createdAt,
                buyerTenantId: row.buyerTenantId,
                buyerName: row.buyerName,
                deliveryAddress: {
                    street: row.deliveryStreet,
                    number: row.deliveryNumber,
                    cep: row.deliveryCep,
                    city: row.deliveryCity,
                    state: row.deliveryState,
                    label: row.deliveryAddress,
                    notes: row.deliveryNotes,
                },
                deliveryWindow: {
                    start: row.deliveryWindowStart,
                    end: row.deliveryWindowEnd,
                },
                distanceKm: row.distanceKm,
                origin: row.farmId !== null && row.farmName !== null
                    ? {
                        farmId: row.farmId,
                        farmName: row.farmName,
                        latitude: row.farmLatitude,
                        longitude: row.farmLongitude,
                    }
                    : null,
                destination: row.deliveryLatitude !== null && row.deliveryLongitude !== null
                    ? {
                        latitude: row.deliveryLatitude,
                        longitude: row.deliveryLongitude,
                    }
                    : null,
                items: [],
            });
        }

        deliveriesByOrder.get(row.orderId)?.items.push({
            orderItemId: row.orderItemId,
            productId: row.productId,
            productName: row.productName,
            qty: row.itemQty,
            saleUnit: row.itemSaleUnit,
            productSaleUnit: row.productSaleUnit,
            unitWeightG: row.unitWeightG,
            estimatedWeightKg: row.estimatedWeightKg,
        });
    }

    return Array.from(deliveriesByOrder.values());
}

export const logisticsRouter = createTRPCRouter({
    calculateFreight: buyerProcedure
        .input(calculateFreightSchema)
        .query(async ({ ctx, input }) => {
            const { addressRecord, distanceRow, farmRecord } = await ctx.db.transaction(async (tx) => {
                await enableTenantCatalogReadContext(tx, {
                    tenantId: ctx.tenantId,
                    userId: ctx.user.id,
                });

                const [addressRecord] = await tx
                    .select({
                        id: addresses.id,
                        tenantId: addresses.tenantId,
                        location: addresses.location,
                    })
                    .from(addresses)
                    .where(eq(addresses.id, input.addressId))
                    .limit(1);

                if (!addressRecord) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: 'Endereço não encontrado.',
                    });
                }

                if (addressRecord.tenantId !== ctx.tenantId) {
                    throw new TRPCError({
                        code: 'FORBIDDEN',
                        message: 'Este endereço não pertence ao tenant autenticado.',
                    });
                }

                const [farmRecord] = await tx
                    .select({
                        id: farms.id,
                        location: farms.location,
                        baseDeliveryFee: farms.baseDeliveryFee,
                        pricePerKm: farms.pricePerKm,
                        maxDeliveryRadiusKm: farms.maxDeliveryRadiusKm,
                        minOrderValue: farms.minOrderValue,
                        freeShippingThreshold: farms.freeShippingThreshold,
                    })
                    .from(farms)
                    .where(eq(farms.id, input.farmId))
                    .limit(1);

                if (!farmRecord) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: 'Fazenda não encontrada.',
                    });
                }

                const [distanceRow] = await tx
                    .select({
                        distanceMeters: sql<number>`
                            CAST(
                                ST_DistanceSphere(${farms.location}, ${addresses.location})
                                AS double precision
                            )
                        `,
                    })
                    .from(farms)
                    .innerJoin(addresses, eq(addresses.id, input.addressId))
                    .where(
                        and(
                            eq(farms.id, input.farmId),
                            eq(addresses.tenantId, ctx.tenantId),
                        ),
                    )
                    .limit(1);

                return {
                    addressRecord,
                    distanceRow,
                    farmRecord,
                };
            });

            if (!farmRecord.location || !addressRecord.location) {
                throw new TRPCError({
                    code: 'PRECONDITION_FAILED',
                    message: 'Não foi possível calcular o frete para esta combinação de origem e destino.',
                });
            }

            const maxDeliveryRadiusKm = resolveEffectiveDeliveryRadiusKm(
                farmRecord.maxDeliveryRadiusKm,
            );

            if (!Number.isFinite(maxDeliveryRadiusKm) || maxDeliveryRadiusKm <= 0) {
                throw new TRPCError({
                    code: 'PRECONDITION_FAILED',
                    message: 'Esta fazenda ainda não possui cobertura de entrega configurada.',
                });
            }

            const rawDistanceKm = (distanceRow?.distanceMeters ?? 0) / 1000;
            const distanceKm = Number(rawDistanceKm.toFixed(2));

            if (rawDistanceKm > maxDeliveryRadiusKm) {
                throw new TRPCError({
                    code: 'PRECONDITION_FAILED',
                    message: 'Endereço fora da área de cobertura desta fazenda.',
                });
            }

            const baseDeliveryFee = Number(farmRecord.baseDeliveryFee);
            const pricePerKm = Number(farmRecord.pricePerKm);
            const subtotal = normalizeCurrencyValue(input.subtotal);
            const minOrderValue = normalizeCurrencyValue(farmRecord.minOrderValue);
            const freeShippingThreshold = normalizeNullableCurrencyValue(
                farmRecord.freeShippingThreshold,
            );
            const hasReachedMinimumOrder = subtotal >= minOrderValue;
            const remainingForMinimumOrder = Number(
                Math.max(0, minOrderValue - subtotal).toFixed(2),
            );
            const baseFreightCost = Number(
                (baseDeliveryFee + (distanceKm * pricePerKm)).toFixed(2),
            );
            const hasReachedFreeShipping =
                freeShippingThreshold !== null && subtotal >= freeShippingThreshold;
            const remainingForFreeShipping =
                freeShippingThreshold !== null
                    ? Number(Math.max(0, freeShippingThreshold - subtotal).toFixed(2))
                    : null;
            const freightCost = hasReachedFreeShipping ? 0 : baseFreightCost;

            return {
                freightCost,
                baseFreightCost,
                distanceKm,
                minOrderValue,
                freeShippingThreshold,
                hasReachedMinimumOrder,
                remainingForMinimumOrder,
                hasReachedFreeShipping,
                remainingForFreeShipping,
            };
        }),

    getPendingDeliveries: producerProcedure.query(async ({ ctx }) => {
        const deliveryRows = await ctx.db
            .select({
                orderId: orders.id,
                status: orders.status,
                totalAmount: orders.totalAmount,
                deliveryFee: orders.deliveryFee,
                createdAt: orders.createdAt,
                buyerTenantId: orders.buyerTenantId,
                buyerName: tenants.name,
                deliveryStreet: orders.deliveryStreet,
                deliveryNumber: orders.deliveryNumber,
                deliveryCep: orders.deliveryCep,
                deliveryCity: orders.deliveryCity,
                deliveryState: orders.deliveryState,
                deliveryAddress: orders.deliveryAddress,
                deliveryNotes: orders.deliveryNotes,
                deliveryWindowStart: orders.deliveryWindowStart,
                deliveryWindowEnd: orders.deliveryWindowEnd,
                farmId: farms.id,
                farmName: farms.name,
                farmLatitude: sql<number | null>`
                    CASE
                        WHEN ${farms.location} IS NOT NULL AND ST_IsValid(${farms.location})
                            THEN CAST(ST_Y(${farms.location}) AS double precision)
                        ELSE NULL
                    END
                `,
                farmLongitude: sql<number | null>`
                    CASE
                        WHEN ${farms.location} IS NOT NULL AND ST_IsValid(${farms.location})
                            THEN CAST(ST_X(${farms.location}) AS double precision)
                        ELSE NULL
                    END
                `,
                deliveryLatitude: sql<number | null>`
                    CASE
                        WHEN ${orders.deliveryPoint} IS NOT NULL AND ST_IsValid(${orders.deliveryPoint})
                            THEN CAST(ST_Y(${orders.deliveryPoint}) AS double precision)
                        ELSE NULL
                    END
                `,
                deliveryLongitude: sql<number | null>`
                    CASE
                        WHEN ${orders.deliveryPoint} IS NOT NULL AND ST_IsValid(${orders.deliveryPoint})
                            THEN CAST(ST_X(${orders.deliveryPoint}) AS double precision)
                        ELSE NULL
                    END
                `,
                distanceKm: sql<number | null>`
                    CASE
                        WHEN ${farms.location} IS NOT NULL
                            AND ${orders.deliveryPoint} IS NOT NULL
                            AND ST_IsValid(${farms.location})
                            AND ST_IsValid(${orders.deliveryPoint})
                            THEN CAST(
                                ROUND(
                                    (ST_Distance(${farms.location}::geography, ${orders.deliveryPoint}::geography) / 1000.0)::numeric,
                                    2
                                ) AS double precision
                            )
                        ELSE NULL
                    END
                `,
                orderItemId: orderItems.id,
                productId: products.id,
                productName: products.name,
                itemQty: orderItems.qty,
                itemSaleUnit: sql<string>`
                    CASE
                        WHEN ${orderItems.saleUnit} IS NOT NULL AND ${orderItems.saleUnit} <> 'unit'
                            THEN ${orderItems.saleUnit}
                        ELSE ${products.saleUnit}::text
                    END
                `,
                productSaleUnit: sql<string>`${products.saleUnit}::text`,
                unitWeightG: products.unitWeightG,
                estimatedWeightKg: sql<number | null>`
                    CASE
                        WHEN ${orderItems.saleUnit} = 'kg'
                            THEN CAST(${orderItems.qty} AS double precision)
                        WHEN ${orderItems.saleUnit} = 'g'
                            THEN CAST(${orderItems.qty} AS double precision) / 1000.0
                        WHEN ${products.saleUnit} = 'kg'
                            THEN CAST(${orderItems.qty} AS double precision)
                        WHEN ${products.saleUnit} = 'g'
                            THEN CAST(${orderItems.qty} AS double precision) / 1000.0
                        WHEN ${products.unitWeightG} IS NOT NULL
                            THEN (CAST(${orderItems.qty} AS double precision) * CAST(${products.unitWeightG} AS double precision)) / 1000.0
                        ELSE NULL
                    END
                `,
            })
            .from(orders)
            .innerJoin(tenants, eq(orders.buyerTenantId, tenants.id))
            .leftJoin(farms, eq(farms.tenantId, orders.sellerTenantId))
            .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
            .innerJoin(products, eq(orderItems.productId, products.id))
            .where(
                and(
                    eq(orders.sellerTenantId, ctx.tenantId),
                    inArray(orders.status, pendingDeliveryStatuses),
                ),
            )
            .orderBy(sql`${orders.createdAt} DESC`);

        return groupPendingDeliveryRows(deliveryRows as PendingDeliveryRow[]);
    }),

    updateDeliveryStatus: producerProcedure
        .input(z.object({
            orderId: z.string().uuid(),
            status: z.enum(deliveryMutationStatuses),
        }))
        .mutation(async ({ ctx, input }) => {
            const targetOrder = await ctx.db.query.orders.findFirst({
                where: and(
                    eq(orders.id, input.orderId),
                    eq(orders.sellerTenantId, ctx.tenantId),
                ),
            });

            if (!targetOrder) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Pedido nao encontrado para este produtor.',
                });
            }

            assertDeliveryTransition(targetOrder.status, input.status);

            await ctx.db
                .update(orders)
                .set({ status: input.status })
                .where(
                    and(
                        eq(orders.id, input.orderId),
                        eq(orders.sellerTenantId, ctx.tenantId),
                    ),
                );

            return {
                success: true,
                status: input.status,
            };
        }),
});

export { assertDeliveryTransition, groupPendingDeliveryRows, pendingDeliveryStatuses };
