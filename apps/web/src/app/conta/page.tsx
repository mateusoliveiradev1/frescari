import { redirect } from "next/navigation";

import { getRequestAuthSession } from "@/lib/server-session";

import { getDefaultAccountPathForRole } from "./account-sections";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getRequestAuthSession();

  if (!session?.user) {
    redirect("/auth/login");
  }

  redirect(getDefaultAccountPathForRole(session.user.role));
}
