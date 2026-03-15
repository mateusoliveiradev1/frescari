import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import BuyerProfilePageClient from "./profile-page-client";

export const dynamic = "force-dynamic";

export default async function BuyerProfilePage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        redirect("/auth/login");
    }

    if (session.user.role !== "buyer") {
        redirect("/dashboard");
    }

    return <BuyerProfilePageClient userName={session.user.name ?? null} />;
}
