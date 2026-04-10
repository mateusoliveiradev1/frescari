import { redirect } from "next/navigation";

import BuyerProfilePageClient from "@/app/dashboard/perfil/profile-page-client";
import { getRequestAuthSession } from "@/lib/server-session";

import {
  canAccessAccountSection,
  getDefaultAccountPathForRole,
} from "../account-sections";

export const dynamic = "force-dynamic";

export default async function AccountAddressesPage() {
  const session = await getRequestAuthSession();

  if (!session?.user) {
    redirect("/auth/login");
  }

  if (!canAccessAccountSection(session.user.role, "enderecos")) {
    redirect(getDefaultAccountPathForRole(session.user.role));
  }

  return <BuyerProfilePageClient />;
}
