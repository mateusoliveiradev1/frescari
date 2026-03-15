import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { db, enableAuthenticatedRlsContext, tenants, type AppDb } from '@frescari/db';
import { eq } from 'drizzle-orm';
import { getTenantTypeMismatchMessage, isTenantTypeCompatibleWithRole } from './tenant-access';

export const createTRPCContext = async (opts: { req?: Request, session?: any, user?: any }) => {
    return {
        db: db as AppDb,
        req: opts.req,
        session: opts.session,
        user: opts.user,
    };
};

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
    transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
    if (!ctx.session || !ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You must be logged in.' });
    }

    return ctx.db.transaction(async (tx) => {
        await enableAuthenticatedRlsContext(tx, {
            userId: ctx.user.id,
            tenantId: typeof ctx.user.tenantId === 'string' ? ctx.user.tenantId : null,
        });

        return next({
            ctx: {
                ...ctx,
                db: tx as AppDb,
                session: ctx.session,
                user: ctx.user,
            },
        });
    });
});

export const tenantProcedure = protectedProcedure.use(async ({ ctx, next }) => {
    if (!ctx.user.tenantId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'User must belong to a tenant.' });
    }

    const [tenant] = await ctx.db
        .select({
            id: tenants.id,
            type: tenants.type,
        })
        .from(tenants)
        .where(eq(tenants.id, ctx.user.tenantId as string))
        .limit(1);

    if (!tenant) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Organização do usuário não encontrada.' });
    }

    return next({
        ctx: {
            ...ctx,
            tenantId: tenant.id,
            tenantType: tenant.type,
        },
    });
});

export const producerProcedure = tenantProcedure.use(({ ctx, next }) => {
    if (ctx.user.role !== 'producer') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas produtores podem realizar esta ação.' });
    }

    if (!isTenantTypeCompatibleWithRole('producer', ctx.tenantType)) {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: getTenantTypeMismatchMessage('producer', ctx.tenantType),
        });
    }

    return next({ ctx });
});

export const buyerProcedure = tenantProcedure.use(({ ctx, next }) => {
    if (ctx.user.role !== 'buyer') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas compradores podem realizar esta ação.' });
    }

    if (!isTenantTypeCompatibleWithRole('buyer', ctx.tenantType)) {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: getTenantTypeMismatchMessage('buyer', ctx.tenantType),
        });
    }

    return next({ ctx });
});
