import { redirect } from "next/navigation";

import { getRequestAuthSession } from "@/lib/server-session";

import {
  canAccessAccountSection,
  getDefaultAccountPathForRole,
} from "../account-sections";
import ChangePasswordForm from "./change-password-form";

export const dynamic = "force-dynamic";

export default async function AccountSecurityPage() {
  const session = await getRequestAuthSession();

  if (!session?.user) {
    redirect("/auth/login");
  }

  if (!canAccessAccountSection(session.user.role, "seguranca")) {
    redirect(getDefaultAccountPathForRole(session.user.role));
  }

  return <ChangePasswordForm />;
}
