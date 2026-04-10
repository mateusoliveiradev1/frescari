import { redirect } from "next/navigation";

import { getHomePathForRole } from "@/lib/role-routing";
import { getRequestAuthSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function BuyerProfilePage() {
  const session = await getRequestAuthSession();

  if (!session?.user) {
    redirect("/auth/login");
  }

  if (!session.user.tenantId) {
    redirect("/onboarding");
  }

  if (session.user.role !== "buyer") {
    redirect(getHomePathForRole(session.user.role));
  }

  redirect("/conta/enderecos");
}
