import BuyerDashboard from "./buyer-dashboard-client";
import DashboardClient from "./dashboard-client";
import { isAdminRole } from "@/lib/role-routing";
import { getRequestAuthSession } from "@/lib/server-session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
    const session = await getRequestAuthSession();

    if (!session?.user) {
        return redirect("/auth/login");
    }

    if (isAdminRole(session.user.role)) {
        return redirect("/admin");
    }

    if (!session.user.tenantId) {
        return redirect("/onboarding");
    }

    if (session.user.role === "buyer") {
        return <BuyerDashboard user={session.user} />;
    }

    return <DashboardClient user={session.user} />;
}
