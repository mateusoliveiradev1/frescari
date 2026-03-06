import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { InventoryForm } from "./inventory-form";

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
            <main className="max-w-[800px] mx-auto px-6 lg:px-12 py-12 space-y-10">
                <div className="space-y-2 mb-8">
                    <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-bark/70">
                        Gestão de Estoque
                    </p>
                    <h1 className="font-display text-4xl font-black text-soil">
                        Registrar Lote
                    </h1>
                    <p className="font-sans text-sm text-bark max-w-lg">
                        Adicione novos lotes de produtos recém-colhidos. Eles ficarão disponíveis imediatamente no catálogo.
                    </p>
                </div>

                <div className="p-6 md:p-8 bg-cream border border-soil/8 rounded-sm shadow-card max-w-2xl">
                    <InventoryForm />
                </div>
            </main>
        </div>
    );
}
