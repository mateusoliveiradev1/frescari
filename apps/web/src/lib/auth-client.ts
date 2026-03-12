"use client";
import { createAuthClient } from "better-auth/react"

/**
 * Better Auth client.
 * On the browser, always prefer the current origin to avoid localhost vs 127.0.0.1 mismatches.
 * On the server/build, fall back to configured public URLs, then localhost for local dev.
 */
const getAuthBaseURL = () => {
    if (typeof window !== "undefined") {
        return window.location.origin
    }

    return (
        process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "http://localhost:3000"
    )
}

export const authClient = createAuthClient({
    baseURL: getAuthBaseURL(),
})
