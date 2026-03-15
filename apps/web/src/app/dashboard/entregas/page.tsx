import "leaflet/dist/leaflet.css";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

import { DeliveriesPageClient } from "./deliveries-page-client";

export const dynamic = "force-dynamic";

export default async function DeliveriesPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        return redirect("/auth/login");
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
