import { redirect } from "next/navigation";

import { getRequestAuthSession } from "@/lib/server-session";

import {
  canAccessAccountSection,
  getDefaultAccountPathForRole,
} from "../account-sections";
import ProfileForm from "./profile-form";

export const dynamic = "force-dynamic";

export default async function AccountProfilePage() {
  const session = await getRequestAuthSession();

  if (!session?.user) {
    redirect("/auth/login");
  }

  if (!canAccessAccountSection(session.user.role, "perfil")) {
    redirect(getDefaultAccountPathForRole(session.user.role));
  }

  return <ProfileForm />;
}
