import { TRPCError } from '@trpc/server';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';

import {
    addresses,
    deliveryDispatchOverrides,
    deliveryDispatchWaveOrders,
    deliveryDispatchWaves,
    enableTenantCatalogReadContext,
    farmVehicles,
    farms,
    orderItems,
    orders,
    productLots,
    products,
    tenants,
} from '@frescari/db';
import { calculateFreightSchema } from '@frescari/validators';

import { buildDispatchControlQueue, getOperationDate } from '../delivery-control';
import {
    normalizeCurrencyValue,
    normalizeNullableCurrencyValue,
    resolveEffectiveDeliveryRadiusKm,
} from '../freight-quote';
import { buyerProcedure, createTRPCRouter, producerProcedure } from '../trpc';

const pendingDeliveryStatuses = ['payment_authorized', 'confirmed', 'picking', 'ready_for_dispatch'] as const;
const deliveryMutationStatuses = ['ready_for_dispatch', 'in_transit', 'delivered'] as const;
const dispatchConfidenceLevels = ['high', 'medium', 'low'] as const;
const fleetVehicleTypes = ['motorcycle', 'car', 'pickup', 'van', 'refrigerated_van', 'truck', 'refrigerated_truck'] as const;
const dispatchOverrideActions = ['pin_to_top', 'delay'] as const;
const dispatchOverrideReasons = ['customer_priority', 'delivery_window', 'vehicle_load', 'address_issue', 'awaiting_picking', 'commercial_decision', 'other'] as const;
export { resolveEffectiveDeliveryRadiusKm } from '../freight-quote';

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
    lotExpiryDate: string | Date | null;
    lotFreshnessScore: number | null | undefined;
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
    deliveryWindowStart: Date | null;
    deliveryWindowEnd: Date | null;
    distanceKm: number | null;
    totalEstimatedWeightKg: number | null;
    minFreshnessScore: number | null;
    nearestExpiryDate: Date | null;
    itemCount: number;
    hasValidRouteCoordinates: boolean;
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

type PendingDeliveryAccumulator = PendingDelivery & {
    totalEstimatedWeightKg: number;
    hasEstimatedWeight: boolean;
};

type DeliveryOverrideRow = {
    id: string;
    orderId: string;
    operationDate: string;
    action: (typeof dispatchOverrideActions)[number];
    reason: (typeof dispatchOverrideReasons)[number];
    reasonNotes: string | null;
    createdAt: Date;
};

type FleetVehicleRow = {
    id: string;
    farmId: string | null;
    label: string;
    vehicleType: (typeof fleetVehicleTypes)[number];
    capacityKg: string;
    refrigeration: boolean;
    availabilityStatus: 'available' | 'in_use' | 'maintenance' | 'offline';
};

type DispatchWaveAssignmentRow = {
    waveId: string;
    orderId: string;
    sequence: number;
    status: 'confirmed' | 'departed' | 'cancelled';
    confidence: (typeof dispatchConfidenceLevels)[number];
    recommendedVehicleType: (typeof fleetVehicleTypes)[number];
    selectedVehicleId: string | null;
    selectedVehicleLabel: string | null;
    confirmedAt: Date;
};

function assertDeliveryTransition(currentStatus: string, nextStatus: DeliveryMutationStatus) {
    const allowedTransitions: Record<string, DeliveryMutationStatus[]> = {
        payment_authorized: ['ready_for_dispatch'],
        confirmed: ['ready_for_dispatch', 'in_transit', 'delivered'],
        picking: ['ready_for_dispatch', 'in_transit', 'delivered'],
        ready_for_dispatch: ['in_transit', 'delivered'],
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
    const deliveriesByOrder = new Map<string, PendingDeliveryAccumulator>();

    for (const row of rows) {
        const existingDelivery = deliveriesByOrder.get(row.orderId);

        const lotExpiryDate =
            row.lotExpiryDate instanceof Date
                ? row.lotExpiryDate
                : row.lotExpiryDate != null
                    ? new Date(row.lotExpiryDate)
                    : null;
        const lotFreshnessScore = row.lotFreshnessScore ?? null;

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
                deliveryWindowStart: row.deliveryWindowStart,
                deliveryWindowEnd: row.deliveryWindowEnd,
                distanceKm: row.distanceKm,
                totalEstimatedWeightKg: 0,
                minFreshnessScore: lotFreshnessScore,
                nearestExpiryDate: lotExpiryDate,
                itemCount: 0,
                hasValidRouteCoordinates:
                    row.farmLatitude !== null
                    && row.farmLongitude !== null
                    && row.deliveryLatitude !== null
                    && row.deliveryLongitude !== null,
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
                hasEstimatedWeight: false,
            });
        }

        const groupedDelivery = deliveriesByOrder.get(row.orderId);

        groupedDelivery?.items.push({
            orderItemId: row.orderItemId,
            productId: row.productId,
            productName: row.productName,
            qty: row.itemQty,
            saleUnit: row.itemSaleUnit,
            productSaleUnit: row.productSaleUnit,
            unitWeightG: row.unitWeightG,
            estimatedWeightKg: row.estimatedWeightKg,
        });

        if (groupedDelivery) {
            groupedDelivery.itemCount += 1;

            if (row.estimatedWeightKg !== null) {
                groupedDelivery.totalEstimatedWeightKg += row.estimatedWeightKg;
                groupedDelivery.hasEstimatedWeight = true;
            }

            if (lotFreshnessScore !== null) {
                groupedDelivery.minFreshnessScore =
                    groupedDelivery.minFreshnessScore === null
                        ? lotFreshnessScore
                        : Math.min(groupedDelivery.minFreshnessScore, lotFreshnessScore);
            }

            if (lotExpiryDate !== null) {
                groupedDelivery.nearestExpiryDate =
                    groupedDelivery.nearestExpiryDate === null || lotExpiryDate < groupedDelivery.nearestExpiryDate
                        ? lotExpiryDate
                        : groupedDelivery.nearestExpiryDate;
            }
        }
    }

    return Array.from(deliveriesByOrder.values()).map(({ hasEstimatedWeight, totalEstimatedWeightKg, ...delivery }) => ({
        ...delivery,
        totalEstimatedWeightKg: hasEstimatedWeight ? Number(totalEstimatedWeightKg.toFixed(3)) : null,
    }));
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
        const now = new Date();
        const operationDate = getOperationDate(now);

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
                lotExpiryDate: productLots.expiryDate,
                lotFreshnessScore: productLots.freshnessScore,
            })
            .from(orders)
            .innerJoin(tenants, eq(orders.buyerTenantId, tenants.id))
            .leftJoin(farms, eq(farms.tenantId, orders.sellerTenantId))
            .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
            .innerJoin(products, eq(orderItems.productId, products.id))
            .innerJoin(productLots, eq(orderItems.lotId, productLots.id))
            .where(
                and(
                    eq(orders.sellerTenantId, ctx.tenantId),
                    inArray(orders.status, pendingDeliveryStatuses),
                ),
            )
            .orderBy(sql`${orders.createdAt} DESC`);

        const groupedDeliveries = groupPendingDeliveryRows(deliveryRows as PendingDeliveryRow[]);
        const orderIds = groupedDeliveries.map((delivery) => delivery.orderId);

        if (groupedDeliveries.length === 0) {
            return buildDispatchControlQueue([], {
                now,
                operationDate,
                overrides: [],
                vehicles: [],
                waveAssignments: [],
            });
        }

        const [overrideRows, vehicleRows, waveAssignments] = await Promise.all([
            ctx.db
                .select({
                    id: deliveryDispatchOverrides.id,
                    orderId: deliveryDispatchOverrides.orderId,
                    operationDate: deliveryDispatchOverrides.operationDate,
                    action: deliveryDispatchOverrides.action,
                    reason: deliveryDispatchOverrides.reason,
                    reasonNotes: deliveryDispatchOverrides.reasonNotes,
                    createdAt: deliveryDispatchOverrides.createdAt,
                })
                .from(deliveryDispatchOverrides)
                .where(
                    and(
                        eq(deliveryDispatchOverrides.tenantId, ctx.tenantId),
                        inArray(deliveryDispatchOverrides.orderId, orderIds),
                        eq(deliveryDispatchOverrides.operationDate, operationDate),
                        isNull(deliveryDispatchOverrides.clearedAt),
                    ),
                ),
            ctx.db
                .select({
                    id: farmVehicles.id,
                    farmId: farmVehicles.farmId,
                    label: farmVehicles.label,
                    vehicleType: farmVehicles.vehicleType,
                    capacityKg: farmVehicles.capacityKg,
                    refrigeration: farmVehicles.refrigeration,
                    availabilityStatus: farmVehicles.availabilityStatus,
                })
                .from(farmVehicles)
                .where(eq(farmVehicles.tenantId, ctx.tenantId)),
            ctx.db
                .select({
                    waveId: deliveryDispatchWaves.id,
                    orderId: deliveryDispatchWaveOrders.orderId,
                    sequence: deliveryDispatchWaveOrders.sequence,
                    status: deliveryDispatchWaves.status,
                    confidence: deliveryDispatchWaves.confidence,
                    recommendedVehicleType: deliveryDispatchWaves.recommendedVehicleType,
                    selectedVehicleId: deliveryDispatchWaves.selectedVehicleId,
                    selectedVehicleLabel: sql<string | null>`COALESCE(${deliveryDispatchWaves.selectedVehicleLabel}, ${farmVehicles.label})`,
                    confirmedAt: deliveryDispatchWaves.confirmedAt,
                })
                .from(deliveryDispatchWaveOrders)
                .innerJoin(deliveryDispatchWaves, eq(deliveryDispatchWaveOrders.waveId, deliveryDispatchWaves.id))
                .leftJoin(farmVehicles, eq(deliveryDispatchWaves.selectedVehicleId, farmVehicles.id))
                .where(
                    and(
                        eq(deliveryDispatchWaves.tenantId, ctx.tenantId),
                        inArray(deliveryDispatchWaveOrders.orderId, orderIds),
                    ),
                ),
        ]);

        return buildDispatchControlQueue(groupedDeliveries, {
            now,
            operationDate,
            overrides: overrideRows as DeliveryOverrideRow[],
            vehicles: (vehicleRows as FleetVehicleRow[]).map((vehicle) => ({
                ...vehicle,
                capacityKg: Number(vehicle.capacityKg),
            })),
            waveAssignments: waveAssignments as DispatchWaveAssignmentRow[],
        });
    }),

    applyDispatchOverride: producerProcedure
        .input(z.object({
            orderId: z.string().uuid(),
            action: z.enum(dispatchOverrideActions),
            reason: z.enum(dispatchOverrideReasons),
            reasonNotes: z.string().trim().max(280).optional().nullable(),
        }))
        .mutation(async ({ ctx, input }) => {
            const now = new Date();
            const operationDate = getOperationDate(now);
            const reasonNotes = input.reasonNotes?.trim() || null;

            if (input.reason === 'other' && !reasonNotes) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Informe um motivo quando a opcao selecionada for "outro".',
                });
            }

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

            if (!pendingDeliveryStatuses.includes(targetOrder.status as (typeof pendingDeliveryStatuses)[number])) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'A ordem manual so pode ser aplicada em pedidos ainda ativos na mesa logistica.',
                });
            }

            await ctx.db
                .update(deliveryDispatchOverrides)
                .set({ clearedAt: now })
                .where(
                    and(
                        eq(deliveryDispatchOverrides.tenantId, ctx.tenantId),
                        eq(deliveryDispatchOverrides.orderId, input.orderId),
                        eq(deliveryDispatchOverrides.operationDate, operationDate),
                        isNull(deliveryDispatchOverrides.clearedAt),
                    ),
                );

            const [override] = await ctx.db
                .insert(deliveryDispatchOverrides)
                .values({
                    tenantId: ctx.tenantId,
                    orderId: input.orderId,
                    operationDate,
                    action: input.action,
                    reason: input.reason,
                    reasonNotes,
                    createdByUserId: ctx.user.id,
                })
                .returning({
                    id: deliveryDispatchOverrides.id,
                });

            return {
                success: true,
                overrideId: override?.id ?? null,
                action: input.action,
            };
        }),

    clearDispatchOverride: producerProcedure
        .input(z.object({
            orderId: z.string().uuid(),
        }))
        .mutation(async ({ ctx, input }) => {
            const now = new Date();
            const operationDate = getOperationDate(now);

            await ctx.db
                .update(deliveryDispatchOverrides)
                .set({ clearedAt: now })
                .where(
                    and(
                        eq(deliveryDispatchOverrides.tenantId, ctx.tenantId),
                        eq(deliveryDispatchOverrides.orderId, input.orderId),
                        eq(deliveryDispatchOverrides.operationDate, operationDate),
                        isNull(deliveryDispatchOverrides.clearedAt),
                    ),
                );

            return {
                success: true,
                orderId: input.orderId,
            };
        }),

    confirmDispatchWave: producerProcedure
        .input(z.object({
            orderIds: z.array(z.string().uuid()).min(1),
            farmId: z.string().uuid().optional(),
            selectedVehicleId: z.string().uuid().optional(),
            confidence: z.enum(dispatchConfidenceLevels),
            recommendedVehicleType: z.enum(fleetVehicleTypes),
            recommendationSummary: z.string().trim().min(8).max(280),
            recommendationSnapshot: z.object({
                priorityScore: z.number().int(),
                urgencyLevel: z.enum(['high', 'medium', 'low']),
                riskLevel: z.enum(['high', 'medium', 'low']),
                confidence: z.enum(dispatchConfidenceLevels),
                suggestedVehicleType: z.enum(fleetVehicleTypes),
                explanation: z.string(),
                reasons: z.array(z.string()),
            }).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const now = new Date();
            const operationDate = getOperationDate(now);

            const targetOrders = await ctx.db
                .select({
                    id: orders.id,
                    status: orders.status,
                })
                .from(orders)
                .where(
                    and(
                        eq(orders.sellerTenantId, ctx.tenantId),
                        inArray(orders.id, input.orderIds),
                    ),
                );

            if (targetOrders.length !== input.orderIds.length) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Nem todos os pedidos informados pertencem a este produtor.',
                });
            }

            for (const targetOrder of targetOrders) {
                assertDeliveryTransition(targetOrder.status, 'ready_for_dispatch');
            }

            let selectedVehicleLabel: string | null = null;

            if (input.selectedVehicleId) {
                const [selectedVehicle] = await ctx.db
                    .select({
                        id: farmVehicles.id,
                        label: farmVehicles.label,
                    })
                    .from(farmVehicles)
                    .where(
                        and(
                            eq(farmVehicles.id, input.selectedVehicleId),
                            eq(farmVehicles.tenantId, ctx.tenantId),
                        ),
                    );

                if (!selectedVehicle) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: 'Veiculo nao encontrado para este produtor.',
                    });
                }

                selectedVehicleLabel = selectedVehicle.label;
            }

            const [wave] = await ctx.db
                .insert(deliveryDispatchWaves)
                .values({
                    tenantId: ctx.tenantId,
                    farmId: input.farmId ?? null,
                    operationDate,
                    confidence: input.confidence,
                    recommendedVehicleType: input.recommendedVehicleType,
                    selectedVehicleId: input.selectedVehicleId ?? null,
                    selectedVehicleLabel,
                    recommendationSummary: input.recommendationSummary,
                    recommendationSnapshot: input.recommendationSnapshot ?? null,
                    confirmedByUserId: ctx.user.id,
                })
                .returning({
                    id: deliveryDispatchWaves.id,
                });

            await ctx.db
                .insert(deliveryDispatchWaveOrders)
                .values(
                    input.orderIds.map((orderId, index) => ({
                        waveId: wave.id,
                        orderId,
                        sequence: index + 1,
                        priorityScore: Math.max(1, input.orderIds.length - index),
                    })),
                );

            await ctx.db
                .update(orders)
                .set({ status: 'ready_for_dispatch' })
                .where(
                    and(
                        eq(orders.sellerTenantId, ctx.tenantId),
                        inArray(orders.id, input.orderIds),
                    ),
                );

            return {
                success: true,
                waveId: wave.id,
                status: 'confirmed' as const,
                updatedOrderCount: input.orderIds.length,
            };
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
