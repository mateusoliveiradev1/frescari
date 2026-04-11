import { redirect } from "next/navigation";

import { getRequestAuthSession } from "@/lib/server-session";
import { getAuthedServerTrpc } from "@/trpc/server";

import {
  canAccessAccountSection,
  getDefaultAccountPathForRole,
} from "../account-sections";
import type { RegistrationFormOverview } from "./registration-form";
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

  let initialOverview: RegistrationFormOverview | undefined;

  try {
    const trpc = await getAuthedServerTrpc();
    initialOverview = await trpc.account.getOverview();
  } catch (error) {
    console.error("[account.registration.initialOverview]", error);
  }

  return <RegistrationForm initialOverview={initialOverview} />;
}
