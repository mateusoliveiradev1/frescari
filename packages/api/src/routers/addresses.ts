import { TRPCError } from '@trpc/server';
import { addresses } from '@frescari/db';
import {
    createAddressSchema,
    deleteAddressSchema,
    updateAddressSchema,
} from '@frescari/validators';
import { and, eq } from 'drizzle-orm';

import { geocodeDeliveryAddress } from '../geocoding';
import { buyerProcedure, createTRPCRouter } from '../trpc';

type NormalizedAddressPayload = {
    title: string;
    zipcode: string;
    street: string;
    number: string;
    neighborhood: string | null;
    city: string;
    state: string;
    country: string;
    complement: string | null;
};

function normalizeZipcode(zipcode: string) {
    const digits = zipcode.replace(/\D/g, '');

    if (digits.length !== 8) {
        return zipcode.trim();
    }

    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function normalizeOptionalField(value: string | null | undefined) {
    if (typeof value !== 'string') {
        return value ?? null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function buildNormalizedAddressPayload(input: {
    title: string;
    zipcode: string;
    street: string;
    number: string;
    neighborhood?: string | null;
    city: string;
    state: string;
    country?: string | null;
    complement?: string | null;
}): NormalizedAddressPayload {
    return {
        title: input.title.trim(),
        zipcode: normalizeZipcode(input.zipcode),
        street: input.street.trim(),
        number: input.number.trim(),
        neighborhood: normalizeOptionalField(input.neighborhood),
        city: input.city.trim(),
        state: input.state.trim().toUpperCase(),
        country: (input.country ?? 'BR').trim().toUpperCase(),
        complement: normalizeOptionalField(input.complement),
    };
}

function buildFormattedAddress(input: NormalizedAddressPayload) {
    return [
        `${input.street}, ${input.number}`,
        input.complement,
        input.neighborhood,
        `${input.city}/${input.state}`,
        `CEP ${input.zipcode}`,
        input.country !== 'BR' ? input.country : null,
    ]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .join(' - ');
}

function needsLocationRefresh(
    current: NormalizedAddressPayload,
    next: NormalizedAddressPayload,
) {
    return (
        current.zipcode !== next.zipcode ||
        current.street !== next.street ||
        current.number !== next.number ||
        current.city !== next.city ||
        current.state !== next.state
    );
}

async function geocodeAddressOrThrow(
    tenantId: string,
    payload: NormalizedAddressPayload,
    operation: 'createAddress' | 'updateAddress',
) {
    const geocodedPoint = await geocodeDeliveryAddress({
        street: payload.street,
        number: payload.number,
        cep: payload.zipcode,
        city: payload.city,
        state: payload.state,
    });

    if (!geocodedPoint) {
        console.warn(`[addresses.${operation}] geocoding failed`, {
            tenantId,
            street: payload.street,
            number: payload.number,
            city: payload.city,
            state: payload.state,
            zipcode: payload.zipcode,
        });

        throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message:
                'Nao foi possivel localizar esse endereco. Revise os dados e tente novamente.',
        });
    }

    return geocodedPoint;
}

function mapAddress(address: typeof addresses.$inferSelect) {
    return {
        ...address,
        location: address.location
            ? {
                  longitude: address.location[0],
                  latitude: address.location[1],
              }
            : null,
    };
}

export const addressesRouter = createTRPCRouter({
    getAddresses: buyerProcedure.query(async ({ ctx }) => {
        const addressRecords = await ctx.db.query.addresses.findMany({
            where: eq(addresses.tenantId, ctx.tenantId),
            orderBy: (table, { desc, asc }) => [desc(table.isDefault), asc(table.createdAt)],
        });

        return addressRecords.map(mapAddress);
    }),

    createAddress: buyerProcedure
        .input(createAddressSchema)
        .mutation(async ({ ctx, input }) => {
            const existingAddress = await ctx.db.query.addresses.findFirst({
                where: eq(addresses.tenantId, ctx.tenantId),
                columns: {
                    id: true,
                },
            });

            const payload = buildNormalizedAddressPayload(input);
            const geocodedPoint = await geocodeAddressOrThrow(
                ctx.tenantId,
                payload,
                'createAddress',
            );

            const [createdAddress] = await ctx.db
                .insert(addresses)
                .values({
                    tenantId: ctx.tenantId,
                    title: payload.title,
                    zipcode: payload.zipcode,
                    street: payload.street,
                    number: payload.number,
                    neighborhood: payload.neighborhood,
                    city: payload.city,
                    state: payload.state,
                    country: payload.country,
                    complement: payload.complement,
                    formattedAddress: buildFormattedAddress(payload),
                    isDefault: !existingAddress,
                    location: [geocodedPoint.longitude, geocodedPoint.latitude],
                })
                .returning();

            if (!createdAddress) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Nao foi possivel salvar o endereco informado.',
                });
            }

            return mapAddress(createdAddress);
        }),

    updateAddress: buyerProcedure
        .input(updateAddressSchema)
        .mutation(async ({ ctx, input }) => {
            const existingAddress = await ctx.db.query.addresses.findFirst({
                where: and(
                    eq(addresses.id, input.id),
                    eq(addresses.tenantId, ctx.tenantId),
                ),
            });

            if (!existingAddress) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Endereco nao encontrado.',
                });
            }

            const currentPayload = buildNormalizedAddressPayload({
                title: existingAddress.title,
                zipcode: existingAddress.zipcode,
                street: existingAddress.street,
                number: existingAddress.number,
                neighborhood: existingAddress.neighborhood,
                city: existingAddress.city,
                state: existingAddress.state,
                country: existingAddress.country,
                complement: existingAddress.complement,
            });

            const nextPayload = buildNormalizedAddressPayload({
                title: input.title ?? existingAddress.title,
                zipcode: input.zipcode ?? existingAddress.zipcode,
                street: input.street ?? existingAddress.street,
                number: input.number ?? existingAddress.number,
                neighborhood:
                    'neighborhood' in input
                        ? input.neighborhood
                        : existingAddress.neighborhood,
                city: input.city ?? existingAddress.city,
                state: input.state ?? existingAddress.state,
                country: input.country ?? existingAddress.country,
                complement:
                    'complement' in input
                        ? input.complement
                        : existingAddress.complement,
            });

            const shouldRefreshLocation =
                !existingAddress.location ||
                needsLocationRefresh(currentPayload, nextPayload);

            const geocodedPoint = shouldRefreshLocation
                ? await geocodeAddressOrThrow(ctx.tenantId, nextPayload, 'updateAddress')
                : null;

            const [updatedAddress] = await ctx.db
                .update(addresses)
                .set({
                    title: nextPayload.title,
                    zipcode: nextPayload.zipcode,
                    street: nextPayload.street,
                    number: nextPayload.number,
                    neighborhood: nextPayload.neighborhood,
                    city: nextPayload.city,
                    state: nextPayload.state,
                    country: nextPayload.country,
                    complement: nextPayload.complement,
                    formattedAddress: buildFormattedAddress(nextPayload),
                    location: geocodedPoint
                        ? [geocodedPoint.longitude, geocodedPoint.latitude]
                        : existingAddress.location,
                    updatedAt: new Date(),
                })
                .where(
                    and(
                        eq(addresses.id, input.id),
                        eq(addresses.tenantId, ctx.tenantId),
                    ),
                )
                .returning();

            if (!updatedAddress) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Nao foi possivel atualizar o endereco informado.',
                });
            }

            return mapAddress(updatedAddress);
        }),

    deleteAddress: buyerProcedure
        .input(deleteAddressSchema)
        .mutation(async ({ ctx, input }) => {
            const existingAddress = await ctx.db.query.addresses.findFirst({
                where: and(
                    eq(addresses.id, input.id),
                    eq(addresses.tenantId, ctx.tenantId),
                ),
                columns: {
                    id: true,
                    isDefault: true,
                },
            });

            if (!existingAddress) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Endereco nao encontrado.',
                });
            }

            await ctx.db
                .delete(addresses)
                .where(
                    and(
                        eq(addresses.id, input.id),
                        eq(addresses.tenantId, ctx.tenantId),
                    ),
                );

            if (existingAddress.isDefault) {
                const nextDefaultAddress = await ctx.db.query.addresses.findFirst({
                    where: eq(addresses.tenantId, ctx.tenantId),
                    orderBy: (table, { asc }) => [asc(table.createdAt)],
                    columns: {
                        id: true,
                    },
                });

                if (nextDefaultAddress) {
                    await ctx.db
                        .update(addresses)
                        .set({
                            isDefault: true,
                            updatedAt: new Date(),
                        })
                        .where(eq(addresses.id, nextDefaultAddress.id));
                }
            }

            return {
                success: true,
                id: input.id,
            };
        }),

    getDefaultAddress: buyerProcedure.query(async ({ ctx }) => {
        const defaultAddress = await ctx.db.query.addresses.findFirst({
            where: and(eq(addresses.tenantId, ctx.tenantId), eq(addresses.isDefault, true)),
        });

        if (defaultAddress) {
            return mapAddress(defaultAddress);
        }

        const firstAddress = await ctx.db.query.addresses.findFirst({
            where: eq(addresses.tenantId, ctx.tenantId),
            orderBy: (table, { asc }) => [asc(table.createdAt)],
        });

        return firstAddress ? mapAddress(firstAddress) : null;
    }),
});
