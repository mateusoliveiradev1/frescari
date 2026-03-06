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
            tenantId: ctx.user.tenantId, // extracted generically from context
        },
    });
});
