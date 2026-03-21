import { z } from "zod";
import Stripe from "stripe";
import { createTRPCRouter, producerProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { tenants, users } from "@frescari/db";
import { eq } from "drizzle-orm";
import {
  getStripeConnectOnboardingDisabledMessage,
  isPlatformOnlyStripeMode,
} from "../stripe-connect-mode";
import { sanitizeEnvValue } from "../env";

const stripeSecretKey = sanitizeEnvValue(process.env.STRIPE_SECRET_KEY);

if (!stripeSecretKey) {
  console.warn(
    "[STRIPE] STRIPE_SECRET_KEY is not set. Connect Onboarding will fail at runtime.",
  );
}

let stripeClient: Stripe | null = null;

function getStripeClient() {
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(stripeSecretKey);
  }

  return stripeClient;
}

const APP_URL =
  sanitizeEnvValue(process.env.NEXT_PUBLIC_APP_URL) ?? "http://localhost:3000";

function getStripeBusinessProfileUrl(appUrl: string) {
  try {
    return new URL(appUrl).origin;
  } catch {
    return appUrl;
  }
}

function resolveProducerStripeBusinessType(): "individual" | "company" {
  // TODO(stripe-connect): persist CPF/CNPJ or an explicit legal entity type
  // for producer tenants during onboarding/tenant setup. When that data exists,
  // map CPF => "individual" and CNPJ => "company" here.
  return "individual";
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
    refresh_url: `${APP_URL}/dashboard/vendas`,
    return_url: `${APP_URL}/dashboard/vendas`,
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
  createStripeConnect: producerProcedure
    .input(z.object({}))
    .mutation(async ({ ctx }) => {
      const { db, tenantId } = ctx;

      if (!stripeSecretKey) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe secret key não configurada.",
        });
      }

      if (isPlatformOnlyStripeMode()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: getStripeConnectOnboardingDisabledMessage(),
        });
      }

      try {
        // Busca o tenant de forma idempotente e obtém o email e nome do usuário.
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
            code: "NOT_FOUND",
            message: "Organização não encontrada.",
          });
        }

        const tenant = dbInfo.tenant;
        const userEmail = dbInfo.email;
        const userName = dbInfo.name || "";

        const nameParts = userName.trim().split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || firstName;

        // Se já possuir uma conta conectada
        if (tenant.stripeAccountId) {
          return {
            url: await createStripeResumeUrlForAccount(tenant.stripeAccountId),
          };
        }

        // Se não possuir conta Stripe
        const account = await getStripeClient().accounts.create({
          type: "express",
          business_type: resolveProducerStripeBusinessType(),
          email: userEmail,
          capabilities: {
            // Contas BR precisam de transfers e card_payments explicitamente.
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
            url: getStripeBusinessProfileUrl(APP_URL),
          },
          metadata: {
            tenant_id: tenant.id,
          },
        });

        // Salva o ID gerado para manter a criação idempotente nas próximas chamadas.
        await db
          .update(tenants)
          .set({ stripeAccountId: account.id })
          .where(eq(tenants.id, tenantId));

        const accountLink = await createStripeAccountOnboardingLink(account.id);

        return { url: accountLink.url };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

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
