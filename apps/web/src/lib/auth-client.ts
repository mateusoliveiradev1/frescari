"use client";
import { createAuthClient } from "better-auth/react"

/**
 * Better Auth client.
 * NEXT_PUBLIC_BETTER_AUTH_URL takes priority (production/staging).
 * Falls back to NEXT_PUBLIC_APP_URL, then localhost for local dev.
 */
export const authClient = createAuthClient({
    baseURL:
        process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "http://localhost:3000",
})
