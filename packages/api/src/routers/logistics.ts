import { TRPCError } from '@trpc/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import { farms, orderItems, orders, products, tenants } from '@frescari/db';

import { createTRPCRouter, producerProcedure } from '../trpc';

const pendingDeliveryStatuses = ['payment_authorized', 'confirmed', 'picking'] as const;
const deliveryMutationStatuses = ['in_transit', 'delivered'] as const;

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
