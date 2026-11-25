import { redirect } from "next/navigation";

import { getHomePathForRole } from "@/lib/role-routing";
import { getRequestAuthSession } from "@/lib/server-session";

import { StorefrontEditorClient } from "./storefront-editor-client";

export const dynamic = "force-dynamic";

export default async function StorefrontEditorPage() {
  const session = await getRequestAuthSession();

  if (!session?.user) {
    redirect("/auth/login");
  }

  if (!session.user.tenantId) {
    redirect("/onboarding");
  }

  if (session.user.role !== "producer") {
    redirect(getHomePathForRole(session.user.role));
  }

  return (
    <div className="min-h-screen bg-cream">
      <main className="mx-auto max-w-[960px] px-6 py-12 lg:px-12">
        <StorefrontEditorClient />
      </main>
    </div>
  );
}
