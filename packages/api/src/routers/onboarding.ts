import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { tenants, users } from '@frescari/db';
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
                // 1. Create the Tenant
                const [newTenant] = await db.insert(tenants).values({
                    name: input.companyName,
                    slug,
                    type: input.type,
                }).returning();

                // 2. Update the User with the new tenantId
                await db.update(users)
                    .set({ tenantId: newTenant.id })
                    .where(eq(users.id, user.id));

                return { tenantId: newTenant.id, type: newTenant.type };
            } catch (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Falha ao configurar a conta. Tente novamente.',
                    cause: error,
                });
            }
        }),
});
