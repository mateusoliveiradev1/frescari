"use client";

import { authClient } from "@/lib/auth-client";

export type BuyerAccessState = "buyer" | "guest" | "forbidden" | "error";

export async function getBuyerAccessState(): Promise<BuyerAccessState> {
    try {
        const response = await authClient.getSession();
        const role = response.data?.user?.role;

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
