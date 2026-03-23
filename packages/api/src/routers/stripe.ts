import Stripe from "stripe";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { tenants, users } from "@frescari/db";

import { sanitizeEnvValue } from "../env";
import {
  buildStripeConnectSnapshot,
  buildStripeTenantStatusUpdate,
  getStripeClient,
  syncTenantStripeConnectStatus,
} from "../stripe-connect";
import {
  getStripeConnectOnboardingDisabledMessage,
  isPlatformOnlyStripeMode,
} from "../stripe-connect-mode";
import { createTRPCRouter, producerProcedure } from "../trpc";
import { splitFullName } from "../utils/producer-profile";
import { deriveStripeConnectStatus } from "../utils/stripe-connect-status";

const APP_URL =
  sanitizeEnvValue(process.env.NEXT_PUBLIC_APP_URL) ?? "http://localhost:3000";

function getStripeBusinessProfileUrl(appUrl: string) {
  try {
    return new URL(appUrl).origin;
  } catch {
    return appUrl;
  }
}

function resolveProducerStripeBusinessType(tenant: {
  producerLegalEntityType: "PF" | "PJ" | null;
}): "individual" | "company" {
  return tenant.producerLegalEntityType === "PJ" ? "company" : "individual";
}

function buildStripeAccountProfilePrefill(args: {
  businessType: "individual" | "company";
  fallbackUserName: string;
  tenant: {
    name: string;
    producerContactName: string | null;
    producerLegalName: string | null;
  };
  userEmail: string;
}) {
  if (args.businessType === "company") {
    return {
      company: {
        name: args.tenant.producerLegalName ?? args.tenant.name,
      },
    } satisfies Pick<Stripe.AccountCreateParams, "company">;
  }

  const preferredName =
    args.tenant.producerLegalName ??
    args.tenant.producerContactName ??
    args.fallbackUserName;
  const { firstName, lastName } = splitFullName(preferredName);

  return {
    individual: {
      email: args.userEmail,
      first_name: firstName,
      last_name: lastName,
    },
  } satisfies Pick<Stripe.AccountCreateParams, "individual">;
}

function getStripeConnectSetupErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";

  if (/responsibilities of managing losses/i.test(message)) {
    return "O Stripe Connect da plataforma ainda nao esta liberado no modo live. No Dashboard da Stripe, acesse Configuracoes > Connect > Perfil da plataforma e revise as responsabilidades por perdas antes de tentar novamente.";
  }

  return null;
}

function isIncompleteStripeOnboardingLoginLinkError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";

  return /cannot create a login link for an account that has not completed onboarding/i.test(
    message,
  );
}

async function createStripeAccountOnboardingLink(accountId: string) {
  return getStripeClient().accountLinks.create({
    account: accountId,
    refresh_url: `${APP_URL}/dashboard`,
    return_url: `${APP_URL}/dashboard`,
    type: "account_onboarding",
  });
}

async function createStripeResumeUrlForAccount(accountId: string) {
  try {
    const loginLink =
      await getStripeClient().accounts.createLoginLink(accountId);
    return loginLink.url;
  } catch (error) {
    if (!isIncompleteStripeOnboardingLoginLinkError(error)) {
      throw error;
    }

    const onboardingLink = await createStripeAccountOnboardingLink(accountId);
    return onboardingLink.url;
  }
}

export const stripeRouter = createTRPCRouter({
  getConnectStatus: producerProcedure.query(async ({ ctx }) => {
    const [tenant] = await ctx.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId))
      .limit(1);

    if (!tenant) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Organizacao nao encontrada.",
      });
    }

    if (!tenant.stripeAccountId) {
      return deriveStripeConnectStatus(tenant);
    }

    try {
      const { status } = await syncTenantStripeConnectStatus(ctx.db, {
        accountId: tenant.stripeAccountId,
        tenantId: tenant.id,
      });

      return status;
    } catch (error) {
      console.error("[STRIPE_CONNECT_STATUS_SYNC_ERROR]", error);
      return deriveStripeConnectStatus(tenant);
    }
  }),
  createStripeConnect: producerProcedure
    .input(z.object({}))
    .mutation(async ({ ctx }) => {
      const { db, tenantId } = ctx;

      if (isPlatformOnlyStripeMode()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: getStripeConnectOnboardingDisabledMessage(),
        });
      }

      try {
        const [dbInfo] = await db
          .select({
            email: users.email,
            name: users.name,
            tenant: tenants,
          })
          .from(tenants)
          .innerJoin(users, eq(users.tenantId, tenants.id))
          .where(eq(tenants.id, tenantId))
          .limit(1);

        if (!dbInfo || !dbInfo.tenant) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Organizacao nao encontrada.",
          });
        }

        const tenant = dbInfo.tenant;
        const userEmail = dbInfo.email;
        const userName = dbInfo.name || "";

        if (tenant.stripeAccountId) {
          await syncTenantStripeConnectStatus(db, {
            accountId: tenant.stripeAccountId,
            tenantId: tenant.id,
          });

          return {
            url: await createStripeResumeUrlForAccount(tenant.stripeAccountId),
          };
        }

        const businessType = resolveProducerStripeBusinessType(tenant);
        const accountProfilePrefill = buildStripeAccountProfilePrefill({
          businessType,
          fallbackUserName: userName,
          tenant,
          userEmail,
        });
        const account = await getStripeClient().accounts.create({
          type: "express",
          business_type: businessType,
          email: userEmail,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          ...accountProfilePrefill,
          business_profile: {
            name: tenant.name,
            url: getStripeBusinessProfileUrl(APP_URL),
          },
          metadata: {
            producer_legal_entity_type:
              tenant.producerLegalEntityType ?? "unset",
            tenant_id: tenant.id,
          },
        });

        const stripeStatusUpdate = buildStripeTenantStatusUpdate(account);

        await db
          .update(tenants)
          .set({
            stripeAccountId: account.id,
            ...stripeStatusUpdate,
          })
          .where(eq(tenants.id, tenantId));

        const accountLink = await createStripeAccountOnboardingLink(account.id);

        return {
          status: deriveStripeConnectStatus(
            buildStripeConnectSnapshot(account.id, stripeStatusUpdate),
          ),
          url: accountLink.url,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        const stripeSetupMessage = getStripeConnectSetupErrorMessage(error);
        if (stripeSetupMessage) {
          console.error("[STRIPE_DEBUG]", error);
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: stripeSetupMessage,
            cause: error,
          });
        }

        console.error("[STRIPE_DEBUG]", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Falha ao criar conta conectada no Stripe. Verifique os logs.",
          cause: error,
        });
      }
    }),
});
