import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { deliveryDispatchWaves, farms, farmVehicles } from '@frescari/db';
import {
    farmLocationSearchInputSchema,
    reverseGeocodeFarmInputSchema,
    saveFarmLocationInputSchema,
} from '@frescari/validators';
import { z } from 'zod';

import {
    geocodeFarmLocationQuery,
    reverseGeocodeFarmLocation,
} from '../geocoding';
import { safeRevalidatePath } from '../cache';
import { createTRPCRouter, producerProcedure } from '../trpc';

type FarmRecord = typeof farms.$inferSelect;
type FarmVehicleRecord = typeof farmVehicles.$inferSelect;

const fleetVehicleTypes = [
    'motorcycle',
    'car',
    'pickup',
    'van',
    'refrigerated_van',
    'truck',
    'refrigerated_truck',
] as const;

const fleetVehicleStatuses = ['available', 'in_use', 'maintenance', 'offline'] as const;

const upsertVehicleInputSchema = z.object({
    vehicleId: z.string().uuid().optional(),
    label: z.string().trim().min(2).max(80),
    vehicleType: z.enum(fleetVehicleTypes),
    capacityKg: z.number().positive().max(50000),
    refrigeration: z.boolean(),
    availabilityStatus: z.enum(fleetVehicleStatuses),
    notes: z.string().trim().max(280).optional().nullable(),
});

const deleteVehicleInputSchema = z.object({
    vehicleId: z.string().uuid(),
});

function mapFarmLocation(location: FarmRecord['location']) {
    if (!location) {
        return null;
    }

    return {
        latitude: location[1],
        longitude: location[0],
    };
}

function normalizeNumericField(value: string | number | null | undefined) {
    const parsedValue = typeof value === 'number' ? value : Number(value);

    if (!Number.isFinite(parsedValue)) {
        return 0;
    }

    return parsedValue;
}

function normalizeNullableNumericField(value: string | number | null | undefined) {
    if (value === null || value === undefined) {
        return null;
    }

    const parsedValue = typeof value === 'number' ? value : Number(value);

    if (!Number.isFinite(parsedValue)) {
        return null;
    }

    return parsedValue;
}

function mapFarmResponse(farm: FarmRecord) {
    const deliveryRadiusKm = Math.max(
        0,
        Math.round(normalizeNumericField(farm.maxDeliveryRadiusKm)),
    );
    const pricePerKm = Math.max(0, normalizeNumericField(farm.pricePerKm));
    const minOrderValue = Math.max(0, normalizeNumericField(farm.minOrderValue));
    const freeShippingThreshold = normalizeNullableNumericField(
        farm.freeShippingThreshold,
    );

    return {
        ...farm,
        address: farm.address ?? null,
        location: mapFarmLocation(farm.location),
        maxDeliveryRadiusKm: deliveryRadiusKm,
        deliveryRadiusKm,
        pricePerKm,
        minOrderValue,
        freeShippingThreshold:
            freeShippingThreshold !== null ? Math.max(0, freeShippingThreshold) : null,
    };
}

function mapFarmVehicleResponse(vehicle: FarmVehicleRecord) {
    return {
        ...vehicle,
        capacityKg: Math.max(0, normalizeNumericField(vehicle.capacityKg)),
        notes: vehicle.notes ?? null,
    };
}

function toPointTuple(input: { latitude: number; longitude: number }): [number, number] {
    return [input.longitude, input.latitude];
}

function revalidateCatalogPages() {
    safeRevalidatePath('/catalogo', 'layout');
}

export const farmRouter = createTRPCRouter({
    getCurrent: producerProcedure.query(async ({ ctx }) => {
        const currentFarm = await ctx.db.query.farms.findFirst({
            where: eq(farms.tenantId, ctx.tenantId),
        });

        return currentFarm ? mapFarmResponse(currentFarm) : null;
    }),

    listVehicles: producerProcedure.query(async ({ ctx }) => {
        const vehicles = await ctx.db.query.farmVehicles.findMany({
            where: eq(farmVehicles.tenantId, ctx.tenantId),
            orderBy: (table, { asc }) => [asc(table.label)],
        });

        return vehicles.map(mapFarmVehicleResponse);
    }),

    searchLocation: producerProcedure
        .input(farmLocationSearchInputSchema)
        .mutation(async ({ input }) => {
            const result = await geocodeFarmLocationQuery(input.query);

            if (!result) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message:
                        'Nao encontramos um ponto para esse CEP ou cidade. Revise o termo e tente novamente.',
                });
            }

            return result;
        }),

    reverseGeocodeLocation: producerProcedure
        .input(reverseGeocodeFarmInputSchema)
        .mutation(async ({ input }) => {
            return reverseGeocodeFarmLocation(input);
        }),

    saveLocation: producerProcedure
        .input(saveFarmLocationInputSchema)
        .mutation(async ({ ctx, input }) => {
            const currentFarm = await ctx.db.query.farms.findFirst({
                where: eq(farms.tenantId, ctx.tenantId),
            });

            const valuesToPersist: Pick<
                typeof farms.$inferInsert,
                | 'name'
                | 'address'
                | 'location'
                | 'pricePerKm'
                | 'maxDeliveryRadiusKm'
                | 'minOrderValue'
                | 'freeShippingThreshold'
            > = {
                name: input.name,
                address: input.address,
                location: toPointTuple(input.location),
                pricePerKm: input.pricePerKm.toFixed(2),
                maxDeliveryRadiusKm: input.deliveryRadiusKm.toString(),
                minOrderValue: input.minOrderValue.toFixed(2),
                freeShippingThreshold:
                    input.freeShippingThreshold !== null
                        ? input.freeShippingThreshold.toFixed(2)
                        : null,
            };

            if (currentFarm) {
                const [updatedFarm] = await ctx.db
                    .update(farms)
                    .set(valuesToPersist)
                    .where(and(eq(farms.id, currentFarm.id), eq(farms.tenantId, ctx.tenantId)))
                    .returning();

                if (!updatedFarm) {
                    throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'Nao foi possivel atualizar a fazenda do tenant.',
                    });
                }

                revalidateCatalogPages();

                return mapFarmResponse(updatedFarm);
            }

            const [createdFarm] = await ctx.db
                .insert(farms)
                .values({
                    tenantId: ctx.tenantId,
                    ...valuesToPersist,
                })
                .returning();

            if (!createdFarm) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Nao foi possivel criar a fazenda do tenant.',
                });
            }

            revalidateCatalogPages();

            return mapFarmResponse(createdFarm);
        }),

    upsertVehicle: producerProcedure
        .input(upsertVehicleInputSchema)
        .mutation(async ({ ctx, input }) => {
            const currentFarm = await ctx.db.query.farms.findFirst({
                where: eq(farms.tenantId, ctx.tenantId),
                columns: {
                    id: true,
                },
            });

            if (!currentFarm) {
                throw new TRPCError({
                    code: 'PRECONDITION_FAILED',
                    message:
                        'Salve a localizacao da fazenda antes de cadastrar a frota operacional.',
                });
            }

            const normalizedNotes = input.notes?.trim() || null;
            const payload = {
                label: input.label.trim(),
                vehicleType: input.vehicleType,
                capacityKg: input.capacityKg.toFixed(3),
                refrigeration: input.refrigeration,
                availabilityStatus: input.availabilityStatus,
                notes: normalizedNotes,
                updatedAt: new Date(),
            } as const;

            if (input.vehicleId) {
                const vehicles = await ctx.db.query.farmVehicles.findMany({
                    where: eq(farmVehicles.tenantId, ctx.tenantId),
                });
                const existingVehicle = vehicles.find(
                    (vehicle) =>
                        vehicle.id === input.vehicleId && vehicle.farmId === currentFarm.id,
                );

                if (!existingVehicle) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: 'Veiculo nao encontrado para esta fazenda.',
                    });
                }

                const [updatedVehicle] = await ctx.db
                    .update(farmVehicles)
                    .set(payload)
                    .where(
                        and(
                            eq(farmVehicles.id, input.vehicleId),
                            eq(farmVehicles.tenantId, ctx.tenantId),
                        ),
                    )
                    .returning();

                if (!updatedVehicle) {
                    throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'Nao foi possivel atualizar o veiculo.',
                    });
                }

                return mapFarmVehicleResponse(updatedVehicle);
            }

            const [createdVehicle] = await ctx.db
                .insert(farmVehicles)
                .values({
                    tenantId: ctx.tenantId,
                    farmId: currentFarm.id,
                    label: payload.label,
                    vehicleType: payload.vehicleType,
                    capacityKg: payload.capacityKg,
                    refrigeration: payload.refrigeration,
                    availabilityStatus: payload.availabilityStatus,
                    notes: payload.notes,
                })
                .returning();

            if (!createdVehicle) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Nao foi possivel cadastrar o veiculo.',
                });
            }

            return mapFarmVehicleResponse(createdVehicle);
        }),

    deleteVehicle: producerProcedure
        .input(deleteVehicleInputSchema)
        .mutation(async ({ ctx, input }) => {
            const vehicles = await ctx.db.query.farmVehicles.findMany({
                where: eq(farmVehicles.tenantId, ctx.tenantId),
            });
            const existingVehicle = vehicles.find(
                (vehicle) => vehicle.id === input.vehicleId,
            );

            if (!existingVehicle) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Veiculo nao encontrado para esta fazenda.',
                });
            }

            const registeredDispatch = await ctx.db.query.deliveryDispatchWaves.findFirst({
                where: and(
                    eq(deliveryDispatchWaves.tenantId, ctx.tenantId),
                    eq(deliveryDispatchWaves.selectedVehicleId, input.vehicleId),
                ),
                columns: {
                    id: true,
                },
            });

            if (registeredDispatch) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message:
                        'Este veiculo ja aparece em saidas confirmadas. Marque-o como offline em vez de excluir.',
                });
            }

            const [deletedVehicle] = await ctx.db
                .delete(farmVehicles)
                .where(
                    and(
                        eq(farmVehicles.id, input.vehicleId),
                        eq(farmVehicles.tenantId, ctx.tenantId),
                    ),
                )
                .returning({
                    id: farmVehicles.id,
                });

            if (!deletedVehicle) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Nao foi possivel remover o veiculo.',
                });
            }

            return {
                success: true,
                vehicleId: deletedVehicle.id,
            };
        }),
});
