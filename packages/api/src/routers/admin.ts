import { TRPCError } from '@trpc/server';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { masterProducts, productCategories } from '@frescari/db';

import { createTRPCRouter, protectedProcedure } from '../trpc';

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
    if (ctx.user.role !== 'admin') {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Apenas administradores podem acessar este recurso.',
        });
    }

    return next({ ctx });
});

const categorySchema = z.object({
    name: z.string().trim().min(2, 'Informe um nome de categoria válido.'),
    slug: z
        .string()
        .trim()
        .min(2, 'Informe um slug válido.')
        .regex(/^[a-z0-9-]+$/, 'Use apenas letras minúsculas, números e hífens no slug.'),
    seoDescription: z.string().trim().max(160).optional(),
});

const masterProductSchema = z.object({
    name: z.string().trim().min(2, 'Informe um nome de produto válido.'),
    categoryId: z.string().uuid('Selecione uma categoria válida.'),
    pricingType: z.enum(['UNIT', 'WEIGHT', 'BOX']),
    defaultImageUrl: z
        .union([z.string().trim().url('Informe uma URL de imagem válida.'), z.literal('')])
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

export const adminRouter = createTRPCRouter({
    listCategories: adminProcedure.query(async ({ ctx }) => {
        return ctx.db
            .select({
                id: productCategories.id,
                name: productCategories.name,
                slug: productCategories.slug,
                seoDescription: productCategories.seoDescription,
                createdAt: productCategories.createdAt,
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
                        slug: input.slug.toLowerCase(),
                        seoDescription: normalizeOptionalText(input.seoDescription),
                    })
                    .returning();

                return createdCategory;
            } catch (error) {
                if (isUniqueViolation(error)) {
                    throw new TRPCError({
                        code: 'CONFLICT',
                        message: 'Já existe uma categoria com este slug.',
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
                    message: 'Categoria não encontrada.',
                });
            }

            try {
                const [updatedCategory] = await ctx.db
                    .update(productCategories)
                    .set({
                        name: input.name,
                        slug: input.slug.toLowerCase(),
                        seoDescription: normalizeOptionalText(input.seoDescription),
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
                        message: 'Já existe uma categoria com este slug.',
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
                id: masterProducts.id,
                name: masterProducts.name,
                category: masterProducts.category,
                defaultImageUrl: masterProducts.defaultImageUrl,
                pricingType: masterProducts.pricingType,
                createdAt: masterProducts.createdAt,
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
                    message: 'Categoria selecionada não encontrada.',
                });
            }

            const [createdProduct] = await ctx.db
                .insert(masterProducts)
                .values({
                    name: input.name,
                    category: category.name,
                    pricingType: input.pricingType,
                    defaultImageUrl: normalizeOptionalText(input.defaultImageUrl),
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
            const category = await ctx.db.query.productCategories.findFirst({
                where: eq(productCategories.id, input.categoryId),
            });

            if (!category) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Categoria selecionada não encontrada.',
                });
            }

            const [updatedProduct] = await ctx.db
                .update(masterProducts)
                .set({
                    name: input.name,
                    category: category.name,
                    pricingType: input.pricingType,
                    defaultImageUrl: normalizeOptionalText(input.defaultImageUrl),
                })
                .where(eq(masterProducts.id, input.id))
                .returning();

            if (!updatedProduct) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Produto mestre não encontrado.',
                });
            }

            return {
                ...updatedProduct,
                categoryId: category.id,
            };
        }),
});
