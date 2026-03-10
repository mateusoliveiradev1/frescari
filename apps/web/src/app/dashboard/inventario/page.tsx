import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { InventoryClient } from "./inventory-client";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session?.user) {
        return redirect("/auth/login");
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
