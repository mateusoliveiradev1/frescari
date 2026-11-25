import { redirect } from "next/navigation";

import { getRequestAuthSession } from "@/lib/server-session";

import {
  canAccessAccountSection,
  getDefaultAccountPathForRole,
} from "../account-sections";
import ChangePasswordForm from "./change-password-form";
import { TwoFactorSection } from "./two-factor-section";

export const dynamic = "force-dynamic";

export default async function AccountSecurityPage() {
  const session = await getRequestAuthSession();

  if (!session?.user) {
    redirect("/auth/login");
  }

  if (!canAccessAccountSection(session.user.role, "seguranca")) {
    redirect(getDefaultAccountPathForRole(session.user.role));
  }

  const user = session.user as {
    role?: string | null;
    twoFactorEnabled?: boolean | null;
  };

  return (
    <div className="space-y-8">
      <TwoFactorSection
        enabled={user.twoFactorEnabled === true}
        required={user.role === "admin"}
      />
      <ChangePasswordForm />
    </div>
  );
}
