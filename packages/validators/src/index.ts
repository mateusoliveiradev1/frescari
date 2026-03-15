import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import {
    account,
    orderItems,
    orders,
    productCategories,
    productLots,
    products,
    session,
    tenants,
    type FarmAddress,
    users,
    verification,
} from '@frescari/db';
import { z } from 'zod';

import {
    coercedPositiveNumber,
    moneyFromLocale,
    trimmedString,
} from './coercions';

export * from './coercions';

export const insertTenantSchema = createInsertSchema(tenants);
export const selectTenantSchema = createSelectSchema(tenants);

export const insertUserSchema = createInsertSchema(users).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    emailVerified: true,
});
export const selectUserSchema = createSelectSchema(users);

export const insertSessionSchema = createInsertSchema(session);
export const insertAccountSchema = createInsertSchema(account);
export const insertVerificationSchema = createInsertSchema(verification);

const brazilianPostalCodeRegex = /^\d{5}-?\d{3}$/;
const stateCodeRegex = /^[A-Za-z]{2}$/;

const requiredTrimmedString = (fieldLabel: string, minLength = 2) =>
    trimmedString(fieldLabel, minLength);

const emptyStringToUndefined = (value: unknown) => {
    if (typeof value !== 'string') {
        return value;
    }

    return value.trim().length === 0 ? undefined : value;
};

const optionalTrimmedString = (fieldLabel: string, minLength = 1) =>
    z.preprocess(
        emptyStringToUndefined,
        z.string().trim().min(minLength, `${fieldLabel} invalido.`).optional(),
    );

const nullableOptionalTrimmedString = (fieldLabel: string, minLength = 1) =>
    z.preprocess(
        (value) => {
            if (typeof value !== 'string') {
                return value;
            }

            return value.trim().length === 0 ? null : value;
        },
        z.string().trim().min(minLength, `${fieldLabel} invalido.`).nullable().optional(),
    );

const normalizeBrazilianPostalCode = (value: string) => {
    const digits = value.replace(/\D/g, '');

    if (digits.length !== 8) {
        return value.trim();
    }

    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

const normalizedZipcodeSchema = z.preprocess(
    (value) => (typeof value === 'string' ? normalizeBrazilianPostalCode(value) : value),
    z.string().trim().regex(brazilianPostalCodeRegex, 'CEP invalido (ex: 01234-567).'),
);

const nonNegativeNumberSchema = (fieldLabel: string) =>
    z.preprocess(
        (value) => (typeof value === 'string' ? Number(value) : value),
        z.number().finite().min(0, `${fieldLabel} deve ser zero ou maior.`),
    );

const nonNegativeIntegerSchema = (fieldLabel: string) =>
    z.preprocess(
        (value) => (typeof value === 'string' ? Number(value) : value),
        z.number().int().min(0, `${fieldLabel} deve ser zero ou maior.`),
    );

const parseLocalDateInput = (value: unknown) => {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? undefined : value;
    }

    if (typeof value !== 'string') {
        return value;
    }

    const trimmed = value.trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);

    if (!match) {
        return undefined;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsedDate = new Date(year, month - 1, day, 12, 0, 0, 0);

    if (
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.getFullYear() !== year ||
        parsedDate.getMonth() !== month - 1 ||
        parsedDate.getDate() !== day
    ) {
        return undefined;
    }

    return parsedDate;
};

const lotDateSchema = z.preprocess(
    parseLocalDateInput,
    z.date({
        required_error: 'Data obrigatoria.',
        invalid_type_error: 'Data invalida. Use o formato YYYY-MM-DD.',
    }),
);

const hasValidLotDateRange = (data: {
    harvestDate?: Date;
    expiryDate?: Date;
}) => {
    if (!(data.harvestDate instanceof Date) || !(data.expiryDate instanceof Date)) {
        return true;
    }

    return data.expiryDate.getTime() > data.harvestDate.getTime();
};

export const farmCoordinatesSchema = z.object({
    latitude: z
        .number()
        .finite()
        .min(-90, 'Latitude deve estar entre -90 e 90.')
        .max(90, 'Latitude deve estar entre -90 e 90.'),
    longitude: z
        .number()
        .finite()
        .min(-180, 'Longitude deve estar entre -180 e 180.')
        .max(180, 'Longitude deve estar entre -180 e 180.'),
});

export const farmPointSchema = z.tuple([
    z.number().finite().min(-180).max(180),
    z.number().finite().min(-90).max(90),
]);

export const farmAddressSchema: z.ZodType<FarmAddress> = z
    .object({
        street: requiredTrimmedString('Rua'),
        number: requiredTrimmedString('Numero', 1),
        neighborhood: z.string().trim().min(2, 'Bairro invalido.').optional(),
        city: requiredTrimmedString('Cidade'),
        state: z
            .string()
            .trim()
            .regex(stateCodeRegex, 'Estado deve ter 2 letras (UF).')
            .transform((value) => value.toUpperCase()),
        postalCode: z
            .string()
            .trim()
            .regex(brazilianPostalCodeRegex, 'CEP invalido (ex: 18150-000).'),
        country: z
            .string()
            .trim()
            .length(2, 'Pais deve ter 2 letras.')
            .transform((value) => value.toUpperCase())
            .optional()
            .default('BR'),
        complement: z.string().trim().min(1, 'Complemento invalido.').optional(),
    })
    .strict();

export const insertFarmSchema = z.object({
    tenantId: z.string().uuid(),
    name: requiredTrimmedString('Nome da fazenda'),
    address: farmAddressSchema.nullable().optional(),
    location: farmPointSchema.nullable().optional(),
    deliveryRadiusKm: nonNegativeIntegerSchema('Raio maximo de entrega').optional(),
    pricePerKm: nonNegativeNumberSchema('Taxa de frete por km').optional(),
    minOrderValue: nonNegativeNumberSchema('Valor minimo do pedido').optional(),
    freeShippingThreshold: nonNegativeNumberSchema('Frete gratis a partir de').nullable().optional(),
    certifications: z.array(z.string().trim().min(1)).nullable().optional(),
    createdAt: z.date().optional(),
});

export const selectFarmSchema = z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    name: requiredTrimmedString('Nome da fazenda'),
    address: farmAddressSchema.nullable(),
    location: farmPointSchema.nullable(),
    deliveryRadiusKm: nonNegativeIntegerSchema('Raio maximo de entrega'),
    pricePerKm: nonNegativeNumberSchema('Taxa de frete por km'),
    minOrderValue: nonNegativeNumberSchema('Valor minimo do pedido'),
    freeShippingThreshold: nonNegativeNumberSchema('Frete gratis a partir de').nullable(),
    certifications: z.array(z.string()).nullable().optional(),
    createdAt: z.date(),
});

export const upsertFarmInputSchema = z
    .object({
        name: requiredTrimmedString('Nome da fazenda'),
        address: farmAddressSchema,
        location: farmCoordinatesSchema,
        deliveryRadiusKm: nonNegativeIntegerSchema('Raio maximo de entrega'),
        pricePerKm: nonNegativeNumberSchema('Taxa de frete por km'),
        minOrderValue: nonNegativeNumberSchema('Valor minimo do pedido'),
        freeShippingThreshold: nonNegativeNumberSchema('Frete gratis a partir de').nullable(),
    })
    .strict();

export const saveFarmLocationInputSchema = upsertFarmInputSchema;

export const farmLocationSearchInputSchema = z
    .object({
        query: z
            .string()
            .trim()
            .min(2, 'Informe um CEP ou cidade com ao menos 2 caracteres.'),
    })
    .strict();

export const reverseGeocodeFarmInputSchema = farmCoordinatesSchema;

export const insertProductCategorySchema = createInsertSchema(productCategories);
export const selectProductCategorySchema = createSelectSchema(productCategories);

export const insertProductSchema = createInsertSchema(products).extend({
    images: z.array(z.string().url()).optional().nullable(),
    unitWeightG: z.number().positive().optional().nullable(),
    pricePerUnit: moneyFromLocale('Preco por unidade'),
    minOrderQty: coercedPositiveNumber('Quantidade minima do pedido'),
});
export const selectProductSchema = createSelectSchema(products);

export const insertProductLotSchema = createInsertSchema(productLots).extend({
    harvestDate: lotDateSchema,
    expiryDate: lotDateSchema,
    availableQty: coercedPositiveNumber('Quantidade disponivel'),
    priceOverride: moneyFromLocale('Preco do lote').nullable().optional(),
    freshnessScore: z.number().min(0).max(100).optional(),
});
export const selectProductLotSchema = createSelectSchema(productLots);

export const insertOrderSchema = createInsertSchema(orders);
export const selectOrderSchema = createSelectSchema(orders);

export const insertOrderItemSchema = createInsertSchema(orderItems);
export const selectOrderItemSchema = createSelectSchema(orderItems);

export const createLotInputSchema = insertProductLotSchema
    .omit({
        id: true,
        createdAt: true,
        deletedAt: true,
        isExpired: true,
        reservedQty: true,
        freshnessScore: true,
        tenantId: true,
    })
    .refine(hasValidLotDateRange, {
        message: 'A data de validade deve ser maior que a data de colheita.',
        path: ['expiryDate'],
    });

export const updateLotInputSchema = z
    .object({
        id: z.string().uuid(),
        availableQty: coercedPositiveNumber('Quantidade disponivel').optional(),
        priceOverride: moneyFromLocale('Preco do lote').nullable().optional(),
        expiryDate: lotDateSchema.optional(),
        harvestDate: lotDateSchema.optional(),
        pricingType: z.enum(['UNIT', 'WEIGHT', 'BOX']).optional(),
        unit: optionalTrimmedString('Unidade', 1),
        imageUrl: optionalTrimmedString('Imagem do lote', 1),
    })
    .refine(hasValidLotDateRange, {
        message: 'A data de validade deve ser maior que a data de colheita.',
        path: ['expiryDate'],
    })
    .refine(
        (input) =>
            Object.entries(input).some(
                ([key, value]) => key !== 'id' && value !== undefined,
            ),
        {
            message: 'Informe ao menos um campo para atualizar o lote.',
            path: ['id'],
        },
    );

export const updateLotInventorySchema = z.object({
    lotId: z.string().uuid(),
    newAvailableQty: coercedPositiveNumber('Nova quantidade disponivel'),
});

export const deliveryAddressSchema = z.object({
    street: z.string().min(3, 'Rua e obrigatoria.'),
    number: z.string().min(1, 'Numero e obrigatorio.'),
    cep: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP invalido (ex: 01234-567).'),
    city: z.string().min(2, 'Cidade e obrigatoria.'),
    state: z.string().length(2, 'Estado deve ter 2 letras (UF).'),
});

export const createAddressSchema = z
    .object({
        title: requiredTrimmedString('Titulo do endereco'),
        zipcode: normalizedZipcodeSchema,
        street: requiredTrimmedString('Rua'),
        number: requiredTrimmedString('Numero', 1),
        neighborhood: optionalTrimmedString('Bairro', 2),
        city: requiredTrimmedString('Cidade'),
        state: z
            .string()
            .trim()
            .regex(stateCodeRegex, 'Estado deve ter 2 letras (UF).')
            .transform((value) => value.toUpperCase()),
        country: z
            .string()
            .trim()
            .length(2, 'Pais deve ter 2 letras.')
            .transform((value) => value.toUpperCase())
            .optional()
            .default('BR'),
        complement: optionalTrimmedString('Complemento', 1),
    })
    .strict();

export const updateAddressSchema = z
    .object({
        id: z.string().uuid(),
        title: requiredTrimmedString('Titulo do endereco').optional(),
        zipcode: normalizedZipcodeSchema.optional(),
        street: requiredTrimmedString('Rua').optional(),
        number: requiredTrimmedString('Numero', 1).optional(),
        neighborhood: nullableOptionalTrimmedString('Bairro', 2),
        city: requiredTrimmedString('Cidade').optional(),
        state: z
            .string()
            .trim()
            .regex(stateCodeRegex, 'Estado deve ter 2 letras (UF).')
            .transform((value) => value.toUpperCase())
            .optional(),
        country: z
            .string()
            .trim()
            .length(2, 'Pais deve ter 2 letras.')
            .transform((value) => value.toUpperCase())
            .optional(),
        complement: nullableOptionalTrimmedString('Complemento', 1),
    })
    .strict()
    .refine(
        (input) =>
            Object.entries(input).some(
                ([key, value]) => key !== 'id' && value !== undefined,
            ),
        {
            message: 'Informe ao menos um campo para atualizar o endereco.',
            path: ['id'],
        },
    );

export const deleteAddressSchema = z
    .object({
        id: z.string().uuid(),
    })
    .strict();

export const checkoutOrderSchema = z.object({
    buyerTenantId: z.string().uuid(),
    sellerTenantId: z.string().uuid(),
    items: z.array(
        z.object({
            lotId: z.string().uuid(),
            productId: z.string().uuid(),
            qty: coercedPositiveNumber('Quantidade'),
        }),
    ),
    deliveryAddress: deliveryAddressSchema,
    deliveryFee: moneyFromLocale('Taxa de entrega').default(0),
    deliveryNotes: z.string().optional(),
    deliveryGeo: z.tuple([z.number(), z.number()]).optional(),
});

export const calculateFreightSchema = z
    .object({
        farmId: z.string().uuid(),
        addressId: z.string().uuid(),
        subtotal: nonNegativeNumberSchema('Subtotal do carrinho'),
    })
    .strict();

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

export const registerSchema = z.object({
    email: z.string().email(),
    name: z.string().min(2),
    password: z.string().min(6),
    role: z.enum(['producer', 'buyer']),
});
