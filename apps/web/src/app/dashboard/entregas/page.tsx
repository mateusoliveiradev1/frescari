import "leaflet/dist/leaflet.css";

import { redirect } from "next/navigation";

import { getRequestAuthSession } from "@/lib/server-session";

import { DeliveriesPageClient } from "./deliveries-page-client";

export const dynamic = "force-dynamic";

export default async function DeliveriesPage() {
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
            <main className="mx-auto max-w-[1400px] px-6 py-12 lg:px-12">
                <DeliveriesPageClient />
            </main>
        </div>
    );
}
