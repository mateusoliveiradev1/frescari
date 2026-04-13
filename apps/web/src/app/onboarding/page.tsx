import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getHomePathForRole, isAdminRole } from "@/lib/role-routing";
import { buildNoIndexMetadata } from "@/lib/seo";
import { getRequestAuthSession } from "@/lib/server-session";

import { OnboardingClient } from "./onboarding-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = buildNoIndexMetadata({
  description: "Cadastro inicial para preparar sua conta Frescari.",
  path: "/onboarding",
  title: "Cadastro inicial | Frescari",
});

export default async function OnboardingPage() {
  const session = await getRequestAuthSession();

  if (!session?.user) {
    redirect("/auth/login");
  }

  if (isAdminRole(session.user.role)) {
    redirect("/admin");
  }

  if (session.user.tenantId) {
    redirect(getHomePathForRole(session.user.role));
  }

  return <OnboardingClient />;
}
