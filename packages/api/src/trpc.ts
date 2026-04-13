import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import {
  db,
  enableAuthenticatedRlsContext,
  tenants,
  type AppDb,
} from "@frescari/db";
import { eq } from "drizzle-orm";
import {
  getTenantTypeMismatchMessage,
  isTenantTypeCompatibleWithRole,
} from "./tenant-access";

export type ContextUser = {
  email?: string | null;
  id: string;
  image?: string | null;
  name?: string | null;
  role?: string | null;
  tenantId?: string | null;
};

type CreateTRPCContextOptions = {
  req?: Request;
  session?: unknown;
  user?: ContextUser | null;
};

export const createTRPCContext = async (opts: CreateTRPCContextOptions) => {
  return {
    db: db as AppDb,
    req: opts.req,
    session: opts.session ?? null,
    user: opts.user ?? null,
  };
};

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

function getAuthenticatedRlsInput(user: NonNullable<Context["user"]>) {
  return {
    userId: user.id,
    tenantId: typeof user.tenantId === "string" ? user.tenantId : null,
  };
}

export async function withAuthenticatedTransaction<T>(
  database: AppDb,
  user: NonNullable<Context["user"]>,
  callback: (tx: AppDb) => Promise<T>,
) {
  return database.transaction(async (tx) => {
    await enableAuthenticatedRlsContext(tx, getAuthenticatedRlsInput(user));
    return callback(tx as AppDb);
  });
}

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  const { session, user } = ctx;

  if (!session || !user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Entre na sua conta para continuar.",
    });
  }

  return withAuthenticatedTransaction(ctx.db, user, async (tx) =>
    next({
      ctx: {
        ...ctx,
        db: tx as AppDb,
        session,
        user,
      },
    }),
  );
});

export const protectedProcedureNoTransaction = t.procedure.use(
  ({ ctx, next }) => {
    const { session, user } = ctx;

    if (!session || !user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Entre na sua conta para continuar.",
      });
    }

    return next({
      ctx: {
        ...ctx,
        session,
        user,
      },
    });
  },
);

export const tenantProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user.tenantId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Usuario precisa estar vinculado a uma conta comercial.",
    });
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
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Conta comercial do usuario nao encontrada.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      tenantId: tenant.id,
      tenantType: tenant.type,
    },
  });
});

export const tenantProcedureNoTransaction = protectedProcedureNoTransaction.use(
  async ({ ctx, next }) => {
    if (!ctx.user.tenantId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Usuario precisa estar vinculado a uma conta comercial.",
      });
    }

    const [tenant] = await withAuthenticatedTransaction(
      ctx.db,
      ctx.user,
      async (tx) =>
        tx
          .select({
            id: tenants.id,
            type: tenants.type,
          })
          .from(tenants)
          .where(eq(tenants.id, ctx.user.tenantId as string))
          .limit(1),
    );

    if (!tenant) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Conta comercial do usuario nao encontrada.",
      });
    }

    return next({
      ctx: {
        ...ctx,
        tenantId: tenant.id,
        tenantType: tenant.type,
      },
    });
  },
);

export const producerProcedure = tenantProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "producer") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Apenas produtores podem realizar esta acao.",
    });
  }

  if (!isTenantTypeCompatibleWithRole("producer", ctx.tenantType)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: getTenantTypeMismatchMessage("producer", ctx.tenantType),
    });
  }

  return next({ ctx });
});

export const producerProcedureNoTransaction = tenantProcedureNoTransaction.use(
  ({ ctx, next }) => {
    if (ctx.user.role !== "producer") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Apenas produtores podem realizar esta acao.",
      });
    }

    if (!isTenantTypeCompatibleWithRole("producer", ctx.tenantType)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: getTenantTypeMismatchMessage("producer", ctx.tenantType),
      });
    }

    return next({ ctx });
  },
);

export const buyerProcedure = tenantProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "buyer") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Apenas compradores podem realizar esta acao.",
    });
  }

  if (!isTenantTypeCompatibleWithRole("buyer", ctx.tenantType)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: getTenantTypeMismatchMessage("buyer", ctx.tenantType),
    });
  }

  return next({ ctx });
});
