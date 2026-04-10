import { redirect } from "next/navigation";

import { getRequestAuthSession } from "@/lib/server-session";

import {
  canAccessAccountSection,
  getDefaultAccountPathForRole,
} from "../account-sections";
import RegistrationForm from "./registration-form";

export const dynamic = "force-dynamic";

export default async function AccountRegistrationPage() {
  const session = await getRequestAuthSession();

  if (!session?.user) {
    redirect("/auth/login");
  }

  if (!canAccessAccountSection(session.user.role, "cadastro")) {
    redirect(getDefaultAccountPathForRole(session.user.role));
  }

  return <RegistrationForm />;
}
