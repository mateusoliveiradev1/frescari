import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { enableRlsBypassContext, tenants, users } from '@frescari/db';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const onboardingRouter = createTRPCRouter({
    setupAccount: protectedProcedure
        .input(
            z.object({
                type: z.enum(['PRODUCER', 'BUYER']),
                companyName: z.string().min(2).max(120),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const { db, user } = ctx;

            // Prevent double-onboarding
            if (user.tenantId) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Usuário já possui uma organização vinculada.',
                });
            }

            // Generate a slug from the company name
            const slug = input.companyName
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '')
                + '-' + Date.now().toString(36);

            try {
                return await db.transaction(async (tx) => {
                    await enableRlsBypassContext(tx);

                    const [newTenant] = await tx.insert(tenants).values({
                        name: input.companyName,
                        slug,
                        type: input.type,
                    }).returning();

                    if (!newTenant) {
                        throw new TRPCError({
                            code: 'INTERNAL_SERVER_ERROR',
                            message: 'Falha ao criar a organizacao inicial.',
                        });
                    }

                    const newRole = input.type === 'PRODUCER' ? 'producer' : 'buyer';
                    await tx.update(users)
                        .set({ tenantId: newTenant.id, role: newRole })
                        .where(eq(users.id, user.id));

                    return { tenantId: newTenant.id, type: newTenant.type };
                });
            } catch (error) {
                console.error("[ERRO_DB_ONBOARDING_DETALHADO]: ", error);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Falha ao configurar a conta. Tente novamente.',
                    cause: error,
                });
            }
        }),
});
