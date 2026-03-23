import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { authDb } from "@frescari/db";
import * as schema from "@frescari/db";

import { sanitizeEnvValue } from "@/lib/env";
import { getAppUrl, getConfiguredUrl } from "@/lib/app-url";
import { sendAuthVerificationEmail } from "@/lib/auth-email";
import {
  extractIpAddress,
  extractLegalConsentPayload,
  extractUserAgent,
  isEmailPasswordSignUpRequest,
  LEGAL_CONSENT_REQUIRED_CODE,
  LEGAL_VERSION_MISMATCH_CODE,
} from "@/lib/legal-consent";
import { LEGAL_VERSION } from "@/lib/legal-documents";

const isProduction = process.env.NODE_ENV === "production";
const authBaseUrl =
  getConfiguredUrl(process.env.BETTER_AUTH_URL) ||
  getConfiguredUrl(process.env.NEXT_PUBLIC_BETTER_AUTH_URL) ||
  getConfiguredUrl(process.env.NEXT_PUBLIC_APP_URL) ||
  getAppUrl();
const localTrustedOrigins = ["http://localhost:3000", "http://127.0.0.1:3000"];

function toUniqueValues(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function getRequestOrigin(request?: Request): string | null {
  if (!request) {
    return null;
  }

  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}

function getTrustedOrigins(request?: Request) {
  return toUniqueValues([
    authBaseUrl,
    getConfiguredUrl(process.env.BETTER_AUTH_URL),
    getConfiguredUrl(process.env.NEXT_PUBLIC_BETTER_AUTH_URL),
    getConfiguredUrl(process.env.NEXT_PUBLIC_APP_URL),
    getRequestOrigin(request),
    ...(isProduction ? [] : localTrustedOrigins),
  ]);
}

export const auth = betterAuth({
  secret:
    sanitizeEnvValue(process.env.BETTER_AUTH_SECRET) ||
    "dummy-secret-for-build-time-only-123",
  baseURL: authBaseUrl,
  trustedOrigins: (request) => getTrustedOrigins(request),
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
    requireEmailVerification: true,
  },
  emailVerification: {
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendOnSignIn: true,
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendAuthVerificationEmail({
        user: {
          email: user.email,
          name: user.name || "cliente Frescari",
        },
        url,
      });
    },
  },
  rateLimit: {
    enabled: isProduction,
    window: 60,
    max: 30,
    customRules: {
      "/sign-in/email": {
        window: 60,
        max: 5,
      },
      "/sign-up/email": {
        window: 600,
        max: 5,
      },
    },
  },
  advanced: {
    useSecureCookies: isProduction,
  },
  defaultCookieAttributes: {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isProduction,
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
