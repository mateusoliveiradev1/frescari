import { redirect } from "next/navigation";

import { getRequestAuthSession } from "@/lib/server-session";
import { getAuthedServerTrpc } from "@/trpc/server";

import {
  canAccessAccountSection,
  getDefaultAccountPathForRole,
} from "../account-sections";
import type { ProfileFormOverview } from "./profile-form";
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

  let initialOverview: ProfileFormOverview | undefined;

  try {
    const trpc = await getAuthedServerTrpc();
    initialOverview = await trpc.account.getOverview();
  } catch (error) {
    console.error("[account.profile.initialOverview]", error);
  }

  return <ProfileForm initialOverview={initialOverview} />;
}
