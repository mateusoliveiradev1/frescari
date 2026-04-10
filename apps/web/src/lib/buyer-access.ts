"use client";

import { authClient } from "@/lib/auth-client";

type SessionUser = {
  role?: string | null;
};

type ClientSessionResponse = {
  data?: {
    user?: SessionUser | null;
  } | null;
  user?: SessionUser | null;
} | null;

export type BuyerAccessState = "buyer" | "guest" | "forbidden" | "error";

export async function getBuyerAccessState(): Promise<BuyerAccessState> {
  try {
    const response = (await authClient.getSession()) as ClientSessionResponse;
    const role = response?.data?.user?.role ?? response?.user?.role;

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
