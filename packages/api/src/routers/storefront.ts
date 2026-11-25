import { tenants } from "@frescari/db";
import { updateStorefrontProfileSchema } from "@frescari/validators";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import { safeRevalidatePath } from "../cache";
import { createTRPCRouter, producerProcedure } from "../trpc";

// The producer edits the photo and "about" text of their public storefront.
// ctx.db runs under the producer's tenant RLS context, so the update can only
// ever touch their own tenant row.
export const storefrontRouter = createTRPCRouter({
  getMyProfile: producerProcedure.query(async ({ ctx }) => {
    const [tenant] = await ctx.db
      .select({
        name: tenants.name,
        slug: tenants.slug,
        photoUrl: tenants.storefrontPhotoUrl,
        bio: tenants.storefrontBio,
      })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId))
      .limit(1);

    if (!tenant) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Conta comercial nao encontrada.",
      });
    }

    return tenant;
  }),

  updateProfile: producerProcedure
    .input(updateStorefrontProfileSchema)
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(tenants)
        .set({
          storefrontPhotoUrl: input.photoUrl,
          storefrontBio: input.bio,
        })
        .where(eq(tenants.id, ctx.tenantId))
        .returning({
          slug: tenants.slug,
          photoUrl: tenants.storefrontPhotoUrl,
          bio: tenants.storefrontBio,
        });

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Nao foi possivel salvar a vitrine.",
        });
      }

      safeRevalidatePath(`/produtor/${updated.slug}`);

      return updated;
    }),
});
