import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { farms } from '@frescari/db';
import {
    farmLocationSearchInputSchema,
    reverseGeocodeFarmInputSchema,
    saveFarmLocationInputSchema,
} from '@frescari/validators';

import {
    geocodeFarmLocationQuery,
    reverseGeocodeFarmLocation,
} from '../geocoding';
import { createTRPCRouter, producerProcedure } from '../trpc';

type FarmRecord = typeof farms.$inferSelect;

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

function toPointTuple(input: { latitude: number; longitude: number }): [number, number] {
    return [input.longitude, input.latitude];
}

export const farmRouter = createTRPCRouter({
    getCurrent: producerProcedure.query(async ({ ctx }) => {
        const currentFarm = await ctx.db.query.farms.findFirst({
            where: eq(farms.tenantId, ctx.tenantId),
        });

        return currentFarm ? mapFarmResponse(currentFarm) : null;
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

            return mapFarmResponse(createdFarm);
        }),
});
