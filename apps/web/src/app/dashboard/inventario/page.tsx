import { redirect } from "next/navigation";

import { getRequestAuthSession } from "@/lib/server-session";

import { InventoryClient } from "./inventory-client";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
    const session = await getRequestAuthSession();

    if (!session?.user) {
        return redirect("/auth/login");
    }

    if (!session.user.tenantId) {
        return redirect("/onboarding");
    }

    if (session.user.role === "buyer") {
        return redirect("/dashboard");
    }

    return (
        <div className="min-h-screen bg-cream">
            <main className="max-w-7xl mx-auto px-6 lg:px-12 py-12">
                <InventoryClient />
            </main>
        </div>
    );
}
