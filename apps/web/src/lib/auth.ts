import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { authDb } from "@frescari/db";
import * as schema from "@frescari/db";

import { getAppUrl, getConfiguredUrl } from "@/lib/app-url";

export const auth = betterAuth({
  secret:
    process.env.BETTER_AUTH_SECRET || "dummy-secret-for-build-time-only-123",
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
});
