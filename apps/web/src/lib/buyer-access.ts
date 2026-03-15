"use client";

import { authClient } from "@/lib/auth-client";

type SessionUser = {
    role?: string | null;
};

export type BuyerAccessState = "buyer" | "guest" | "forbidden" | "error";

export async function getBuyerAccessState(): Promise<BuyerAccessState> {
    try {
        const response = await authClient.getSession();
        const role = (response.data?.user as SessionUser | undefined)?.role;

        if (role === "buyer") {
            return "buyer";
        }

        if (!role) {
            return "guest";
        }

        return "forbidden";
    } catch {
        return "error";
    }
}
