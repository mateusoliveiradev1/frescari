import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { enableRlsBypassContext, tenants, users } from "@frescari/db";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { onboardingSetupSchema } from "../utils/producer-profile";

export const onboardingRouter = createTRPCRouter({
  setupAccount: protectedProcedure
    .input(onboardingSetupSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      if (user.tenantId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Usuario ja possui uma organizacao vinculada.",
        });
      }

      const publicName =
        input.type === "BUYER" ? input.companyName : input.publicName;

      const slug =
        publicName
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") +
        "-" +
        Date.now().toString(36);

      try {
        return await db.transaction(async (tx) => {
          await enableRlsBypassContext(tx);

          const [newTenant] =
            input.type === "BUYER"
              ? await tx
                  .insert(tenants)
                  .values({
                    name: input.companyName,
                    slug,
                    type: input.type,
                  })
                  .returning()
              : await tx
                  .insert(tenants)
                  .values({
                    name: input.publicName,
                    slug,
                    type: input.type,
                    producerContactName: input.contactName,
                    producerDocumentId: input.documentId,
                    producerLegalEntityType: input.legalEntityType,
                    producerLegalName: input.legalName,
                    producerPhone: input.phone,
                    producerProfileCompletedAt: new Date(),
                  })
                  .returning();

          if (!newTenant) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Falha ao criar a organizacao inicial.",
            });
          }

          const newRole = input.type === "PRODUCER" ? "producer" : "buyer";

          await tx
            .update(users)
            .set({ tenantId: newTenant.id, role: newRole })
            .where(eq(users.id, user.id));

          return { tenantId: newTenant.id, type: newTenant.type };
        });
      } catch (error) {
        console.error("[ERRO_DB_ONBOARDING_DETALHADO]: ", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao configurar a conta. Tente novamente.",
          cause: error,
        });
      }
    }),
});
