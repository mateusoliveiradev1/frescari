import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { authDb } from "@frescari/db";
import * as schema from "@frescari/db";

export const auth = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET || "dummy-secret-for-build-time-only-123",
    baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    database: drizzleAdapter(authDb, {
        provider: "pg",
        usePlural: true,
        schema: {
            ...schema,
            accounts: schema.account,
            sessions: schema.session,
            verifications: schema.verification
        }
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
            }
        }
    },
    emailAndPassword: {
        enabled: true,
    },
});
