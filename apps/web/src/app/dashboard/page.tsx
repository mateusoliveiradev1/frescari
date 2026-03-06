import DashboardClient from "./dashboard-client";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

import BuyerDashboard from "./buyer-dashboard-client";

export default async function DashboardPage() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session?.user) {
        return redirect("/auth/login");
    }

    if (session.user.role === "buyer") {
        return <BuyerDashboard user={session.user} />;
    }

    return <DashboardClient user={session.user} />;
}
