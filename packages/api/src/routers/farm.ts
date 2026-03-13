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

function mapFarmResponse(farm: FarmRecord) {
    return {
        ...farm,
        address: farm.address ?? null,
        location: mapFarmLocation(farm.location),
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

            const valuesToPersist = {
                name: input.name,
                address: input.address,
                location: toPointTuple(input.location),
            } as const;

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
