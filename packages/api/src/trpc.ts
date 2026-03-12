import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { db } from '@frescari/db';

export const createTRPCContext = async (opts: { req?: Request, session?: any, user?: any }) => {
    return {
        db,
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

    return next({
        ctx: {
            ...ctx,
            session: ctx.session,
            user: ctx.user,
        },
    });
});

export const tenantProcedure = protectedProcedure.use(({ ctx, next }) => {
    if (!ctx.user.tenantId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'User must belong to a tenant.' });
    }
    return next({
        ctx: {
            ...ctx,
            tenantId: ctx.user.tenantId as string,
        }
    });
});

export const producerProcedure = tenantProcedure.use(({ ctx, next }) => {
    if (ctx.user.role !== 'producer') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas produtores podem realizar esta ação.' });
    }
    return next({ ctx });
});

export const buyerProcedure = tenantProcedure.use(({ ctx, next }) => {
    if (ctx.user.role !== 'buyer') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas compradores podem realizar esta ação.' });
    }
    return next({ ctx });
});
