import { TRPCError } from "@trpc/server";
import { tenants } from "@frescari/db";
import { eq } from "drizzle-orm";

import {
  getTenantTypeMismatchMessage,
  isTenantTypeCompatibleWithRole,
} from "../tenant-access";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import {
  accountRegistrationUpdateSchema,
  buildAccountOverviewFlags,
  buildTenantRegistrationUpdate,
  registrationPayloadMatchesRole,
} from "../utils/account-profile";

function mapAccountTenant(tenant: typeof tenants.$inferSelect) {
  return {
    id: tenant.id,
    name: tenant.name,
    producerContactName: tenant.producerContactName ?? null,
    producerDocumentId: tenant.producerDocumentId ?? null,
    producerLegalEntityType: tenant.producerLegalEntityType ?? null,
    producerLegalName: tenant.producerLegalName ?? null,
    producerPhone: tenant.producerPhone ?? null,
    type: tenant.type ?? null,
  };
}

export const accountRouter = createTRPCRouter({
  getOverview: protectedProcedure.query(async ({ ctx }) => {
    const tenant =
      typeof ctx.user.tenantId === "string" && ctx.user.tenantId.length > 0
        ? await ctx.db.query.tenants.findFirst({
            where: eq(tenants.id, ctx.user.tenantId),
          })
        : null;

    return {
      flags: buildAccountOverviewFlags(ctx.user.role, ctx.user.tenantId),
      tenant: tenant ? mapAccountTenant(tenant) : null,
      user: {
        email: ctx.user.email ?? null,
        id: ctx.user.id,
        image: ctx.user.image ?? null,
        name: ctx.user.name ?? null,
        role: ctx.user.role ?? null,
        tenantId: ctx.user.tenantId ?? null,
      },
    };
  }),

  updateRegistration: protectedProcedure
    .input(accountRegistrationUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "buyer" && ctx.user.role !== "producer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Apenas compradores e produtores podem atualizar o cadastro.",
        });
      }

      if (
        typeof ctx.user.tenantId !== "string" ||
        ctx.user.tenantId.length === 0
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "User must belong to a tenant.",
        });
      }

      if (!registrationPayloadMatchesRole(ctx.user.role, input)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "O payload de cadastro nao corresponde ao papel autenticado.",
        });
      }

      const existingTenant = await ctx.db.query.tenants.findFirst({
        where: eq(tenants.id, ctx.user.tenantId),
      });

      if (!existingTenant) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Organizacao do usuario nao encontrada.",
        });
      }

      if (!isTenantTypeCompatibleWithRole(ctx.user.role, existingTenant.type)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: getTenantTypeMismatchMessage(
            ctx.user.role,
            existingTenant.type,
          ),
        });
      }

      const [updatedTenant] = await ctx.db
        .update(tenants)
        .set(buildTenantRegistrationUpdate(input))
        .where(eq(tenants.id, existingTenant.id))
        .returning();

      if (!updatedTenant) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Nao foi possivel atualizar o cadastro da conta.",
        });
      }

      return {
        success: true,
        tenant: mapAccountTenant(updatedTenant),
      };
    }),
});
