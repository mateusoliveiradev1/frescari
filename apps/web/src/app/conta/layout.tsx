import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { isAdminRole } from "@/lib/role-routing";
import { getRequestAuthSession } from "@/lib/server-session";

import { AccountShellClient } from "./account-shell-client";

export const dynamic = "force-dynamic";

export default async function AccountLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const session = await getRequestAuthSession();

  if (!session?.user) {
    redirect("/auth/login");
  }

  if (!isAdminRole(session.user.role) && !session.user.tenantId) {
    redirect("/onboarding");
  }

  return (
    <AccountShellClient
      role={session.user.role}
      userName={session.user.name ?? null}
    >
      {children}
    </AccountShellClient>
  );
}
