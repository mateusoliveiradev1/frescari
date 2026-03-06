"use client";

import { useRouter } from "next/navigation";
import { Button } from "@frescari/ui";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function BuyerDashboard({ user }: { user: any }) {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-cream">
            <main className="max-w-[1400px] mx-auto px-6 lg:px-12 py-12 space-y-12">
                {/* ── Page header ── */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                    <div className="space-y-1">
                        <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-bark/70">
                            Painel do Comprador
                        </p>
                        <h1 className="font-display text-4xl font-black text-soil">
                            Bem-vindo,{" "}
                            <span className="italic text-forest">{user.name?.split(" ")[0]}</span>.
                        </h1>
                    </div>
                </div>

                {/* ── Coming soon banner ── */}
                <div className="p-12 border border-dashed border-forest/20 rounded-sm bg-sage/20 flex flex-col items-center justify-center gap-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-sage border border-forest/15 flex items-center justify-center mb-2">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-forest">
                            <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-display text-2xl font-bold text-soil mb-2">
                            Seu feed de compras aparecerá aqui.
                        </h3>
                        <p className="font-sans text-sm text-bark max-w-md mx-auto leading-relaxed">
                            Estamos preparando uma experiência incrível para você explorar o catálogo e fechar negócios direto com os produtores. As novidades chegam em breve!
                        </p>
                    </div>
                    <Button variant="secondary" asChild className="mt-4">
                        <Link href="/catalogo">Ver Catálogo Público</Link>
                    </Button>
                </div>
            </main>
        </div>
    );
}
