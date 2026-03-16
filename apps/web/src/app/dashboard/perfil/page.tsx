import { redirect } from "next/navigation";

import { getRequestAuthSession } from "@/lib/server-session";

import BuyerProfilePageClient from "./profile-page-client";

export const dynamic = "force-dynamic";

export default async function BuyerProfilePage() {
    const session = await getRequestAuthSession();

    if (!session?.user) {
        redirect("/auth/login");
    }

    if (!session.user.tenantId) {
        redirect("/onboarding");
    }

    if (session.user.role !== "buyer") {
        redirect("/dashboard");
    }

    return <BuyerProfilePageClient userName={session.user.name ?? null} />;
}
