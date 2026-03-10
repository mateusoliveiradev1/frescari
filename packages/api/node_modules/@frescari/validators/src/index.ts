import { z } from 'zod';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import {
    tenants,
    users,
    farms,
    productCategories,
    products,
    productLots,
    orders,
    orderItems,
    session,
    account,
    verification
} from '@frescari/db';

export const insertTenantSchema = createInsertSchema(tenants);
export const selectTenantSchema = createSelectSchema(tenants);

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true, emailVerified: true });
export const selectUserSchema = createSelectSchema(users);

export const insertSessionSchema = createInsertSchema(session);
export const insertAccountSchema = createInsertSchema(account);
export const insertVerificationSchema = createInsertSchema(verification);

export const insertFarmSchema = createInsertSchema(farms);
export const selectFarmSchema = createSelectSchema(farms);

export const insertProductCategorySchema = createInsertSchema(productCategories);
export const selectProductCategorySchema = createSelectSchema(productCategories);

// Extend Drizzle-Zod generated schema with strict manual checks
export const insertProductSchema = createInsertSchema(products).extend({
    images: z.array(z.string().url()).optional().nullable(),
    unitWeightG: z.number().positive().optional().nullable(),
    pricePerUnit: z.string().or(z.number()),
    minOrderQty: z.string().or(z.number())
});
export const selectProductSchema = createSelectSchema(products);

export const insertProductLotSchema = createInsertSchema(productLots).extend({
    harvestDate: z.coerce.string(),
    expiryDate: z.coerce.string(),
    availableQty: z.string().or(z.number()),
    priceOverride: z.number().min(0),
    freshnessScore: z.number().min(0).max(100).optional()
});
export const selectProductLotSchema = createSelectSchema(productLots);

export const insertOrderSchema = createInsertSchema(orders);
export const selectOrderSchema = createSelectSchema(orders);

export const insertOrderItemSchema = createInsertSchema(orderItems);
export const selectOrderItemSchema = createSelectSchema(orderItems);

// High-level API Schemas
export const createLotInputSchema = insertProductLotSchema.omit({
    id: true,
    createdAt: true,
    isExpired: true,
    reservedQty: true,
    freshnessScore: true, // Calculated backend-side
    tenantId: true, // Inferred from server session
});

export const updateLotInventorySchema = z.object({
    lotId: z.string().uuid(),
    newAvailableQty: z.number().positive()
});

export const deliveryAddressSchema = z.object({
    street: z.string().min(3, "Rua é obrigatória."),
    number: z.string().min(1, "Número é obrigatório."),
    cep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP inválido (ex: 01234-567)."),
    city: z.string().min(2, "Cidade é obrigatória."),
    state: z.string().length(2, "Estado deve ter 2 letras (UF)."),
});

export const checkoutOrderSchema = z.object({
    buyerTenantId: z.string().uuid(),
    sellerTenantId: z.string().uuid(),
    items: z.array(z.object({
        lotId: z.string().uuid(),
        productId: z.string().uuid(),
        qty: z.number().positive(),
    })),
    deliveryAddress: deliveryAddressSchema,
    deliveryFee: z.number().min(0).default(0),
    deliveryNotes: z.string().optional(),
    deliveryGeo: z.tuple([z.number(), z.number()]).optional() // [lat, lng]
});

// Better Auth Action Schemas
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
