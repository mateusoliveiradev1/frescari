import { z } from 'zod';
import Stripe from 'stripe';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { tenants, users } from '@frescari/db';
import { eq } from 'drizzle-orm';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
    console.warn(
        '[STRIPE] STRIPE_SECRET_KEY is not set. Connect Onboarding will fail at runtime.',
    );
}

const stripe = new Stripe(stripeSecretKey ?? '');
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const stripeRouter = createTRPCRouter({
    createStripeConnect: protectedProcedure
        .input(z.object({}))
        .mutation(async ({ ctx }) => {
            const { db, user } = ctx;
            const tenantId = user.tenantId as string | undefined;

            if (!tenantId) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'Usuário sem organização vinculada.',
                });
            }

            if (!stripeSecretKey) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Stripe secret key não configurada.',
                });
            }

            try {
                // Busque o tenant de forma idenpotente e obtenha o email e nome do usuário
                const [dbInfo] = await db
                    .select({
                        tenant: tenants,
                        email: users.email,
                        name: users.name,
                    })
                    .from(tenants)
                    .innerJoin(users, eq(users.tenantId, tenants.id))
                    .where(eq(tenants.id, tenantId))
                    .limit(1);

                if (!dbInfo || !dbInfo.tenant) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: 'Organização não encontrada.',
                    });
                }

                const tenant = dbInfo.tenant;
                const userEmail = dbInfo.email;
                const userName = dbInfo.name || '';

                const nameParts = userName.trim().split(' ');
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || firstName;

                if (tenant.type === 'BUYER') {
                    throw new TRPCError({
                        code: 'FORBIDDEN',
                        message: 'Apenas produtores podem configurar recebimentos.',
                    });
                }

                // Se JÁ POSSUIR uma conta conectada
                if (tenant.stripeAccountId) {
                    const loginLink = await stripe.accounts.createLoginLink(tenant.stripeAccountId);
                    return { url: loginLink.url };
                }

                // Se NÃO POSSUIR conta stripe
                const account = await stripe.accounts.create({
                    type: 'express',
                    business_type: 'individual',
                    email: userEmail,
                    capabilities: {
                        // Resgata explicitamente transfers e card_payments necessários para contas BR
                        card_payments: { requested: true },
                        transfers: { requested: true },
                    },
                    individual: {
                        first_name: firstName,
                        last_name: lastName,
                        email: userEmail,
                    },
                    business_profile: {
                        name: tenant.name,
                        url: 'https://frescari.com.br',
                    },
                    metadata: {
                        tenant_id: tenant.id,
                    },
                });

                // Atualize o DB salvando o ID gerado (protegendo a idenpotência para as próximas chamadas)
                await db
                    .update(tenants)
                    .set({ stripeAccountId: account.id })
                    .where(eq(tenants.id, tenantId));

                // Geranado o link de onboarding do fluxo Express
                const accountLink = await stripe.accountLinks.create({
                    account: account.id,
                    refresh_url: `${APP_URL}/dashboard/vendas`, // Local de recarregamento caso vença/invalide
                    return_url: `${APP_URL}/dashboard/vendas`,  // Pode redirecionar para uma page de verificação de conta
                    type: 'account_onboarding',
                });

                return { url: accountLink.url };
            } catch (error) {
                if (error instanceof TRPCError) throw error;

                console.error('[STRIPE_DEBUG]', error);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Falha ao criar conta conectada no Stripe. Verifique os logs.',
                    cause: error,
                });
            }
        }),
});
