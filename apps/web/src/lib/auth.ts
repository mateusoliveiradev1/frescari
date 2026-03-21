import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { authDb } from "@frescari/db";
import * as schema from "@frescari/db";

import { sanitizeEnvValue } from "@/lib/env";
import { getAppUrl, getConfiguredUrl } from "@/lib/app-url";
import {
  extractIpAddress,
  extractLegalConsentPayload,
  extractUserAgent,
  isEmailPasswordSignUpRequest,
  LEGAL_CONSENT_REQUIRED_CODE,
  LEGAL_VERSION_MISMATCH_CODE,
} from "@/lib/legal-consent";
import { LEGAL_VERSION } from "@/lib/legal-documents";

export const auth = betterAuth({
  secret:
    sanitizeEnvValue(process.env.BETTER_AUTH_SECRET) ||
    "dummy-secret-for-build-time-only-123",
  baseURL:
    getConfiguredUrl(process.env.BETTER_AUTH_URL) ||
    getConfiguredUrl(process.env.NEXT_PUBLIC_BETTER_AUTH_URL) ||
    getConfiguredUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    getAppUrl(),
  database: drizzleAdapter(authDb, {
    provider: "pg",
    usePlural: true,
    schema: {
      ...schema,
      accounts: schema.account,
      sessions: schema.session,
      verifications: schema.verification,
    },
  }),
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "buyer",
      },
      tenantId: {
        type: "string",
        required: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (_user, context) => {
          const requestUrl = context?.request?.url;

          if (!isEmailPasswordSignUpRequest(requestUrl)) {
            return;
          }

          const consent = extractLegalConsentPayload(context?.body);

          if (!consent.acceptedLegal) {
            throw APIError.from("BAD_REQUEST", {
              code: LEGAL_CONSENT_REQUIRED_CODE,
              message:
                "Para criar a conta, aceite os documentos juridicos da Frescari.",
            });
          }

          if (consent.acceptedLegalVersion !== LEGAL_VERSION) {
            throw APIError.from("BAD_REQUEST", {
              code: LEGAL_VERSION_MISMATCH_CODE,
              message:
                "Os documentos juridicos foram atualizados. Recarregue a pagina e confirme novamente.",
            });
          }
        },
        after: async (user, context) => {
          const requestUrl = context?.request?.url;

          if (!isEmailPasswordSignUpRequest(requestUrl)) {
            return;
          }

          const consent = extractLegalConsentPayload(context?.body);

          if (
            !consent.acceptedLegal ||
            consent.acceptedLegalVersion !== LEGAL_VERSION
          ) {
            return;
          }

          try {
            await authDb
              .insert(schema.userLegalAcceptances)
              .values({
                userId: user.id,
                legalVersion: LEGAL_VERSION,
                ipAddress: extractIpAddress(context?.request?.headers),
                userAgent: extractUserAgent(context?.request?.headers),
                source: consent.acceptedLegalSource,
              })
              .onConflictDoNothing();
          } catch (error) {
            context?.context.logger?.error?.(
              "Failed to persist signup legal acceptance audit",
              error,
            );
          }
        },
      },
    },
  },
});
