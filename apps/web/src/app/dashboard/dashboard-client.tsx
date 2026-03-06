"use client";

import { useRouter } from "next/navigation";
import { Button } from "@frescari/ui";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/trpc/react";

function Skeleton({ className }: { className?: string }) {
    return <div className={`animate-pulse bg-soil/10 rounded-sm ${className}`} />;
}

export default function DashboardClient({ user }: { user: any }) {
    const router = useRouter();

    // @ts-expect-error local monorepo trpc generics limit
    const { data: metrics, isLoading: isMetricsLoading } = trpc.lot.getDashboardMetrics.useQuery();
    // @ts-expect-error local monorepo trpc generics limit
    const { data: recentLots, isLoading: isLotsLoading } = trpc.lot.getRecentLots.useQuery();

    return (
        <div className="min-h-screen bg-cream">
            <main className="max-w-[1400px] mx-auto px-6 lg:px-12 py-12 space-y-12">

                {/* ── Page header ── */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                    <div className="space-y-1">
                        <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-bark/70">
                            Painel do Produtor
                        </p>
                        <h1 className="font-display text-4xl font-black text-soil">
                            Visão Geral
                        </h1>
                    </div>
                    <Button variant="primary" asChild className="shrink-0 bg-forest hover:bg-forest/90 text-cream">
                        <Link href="/dashboard/inventario">Criar Novo Lote</Link>
                    </Button>
                </div>

                {/* ── Quick stats row ── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Metric 1 */}
                    <div className="p-6 bg-cream border border-soil/8 rounded-sm shadow-card flex flex-col justify-between min-h-[140px]">
                        <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-bark/60">
                            Lotes Ativos
                        </p>
                        {isMetricsLoading ? (
                            <Skeleton className="h-10 w-20 mt-4" />
                        ) : (
                            <p className="font-display text-4xl font-black text-forest mt-4">
                                {metrics?.activeLots ?? 0}
                            </p>
                        )}
                    </div>

                    {/* Metric 2 */}
                    <div className="p-6 bg-cream border border-soil/8 rounded-sm shadow-card flex flex-col justify-between min-h-[140px]">
                        <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-bark/60">
                            Last Chance (Qty)
                        </p>
                        {isMetricsLoading ? (
                            <Skeleton className="h-10 w-20 mt-4" />
                        ) : (
                            <p className="font-display text-4xl font-black text-orange-600 mt-4">
                                {metrics?.lastChanceQty ?? 0}
                            </p>
                        )}
                    </div>

                    {/* Metric 3 */}
                    <div className="p-6 bg-cream border border-soil/8 rounded-sm shadow-card flex flex-col justify-between min-h-[140px]">
                        <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-bark/60">
                            CO₂ Evitado Estimado
                        </p>
                        {isMetricsLoading ? (
                            <Skeleton className="h-10 w-32 mt-4" />
                        ) : (
                            <p className="font-display text-4xl font-black text-forest mt-4">
                                {metrics?.co2AvoidedKg ?? 0} <span className="text-xl text-bark/60">kg</span>
                            </p>
                        )}
                    </div>
                </div>

                {/* ── Recent Lots Section ── */}
                <div className="space-y-6">
                    <h2 className="font-display text-2xl font-bold text-soil border-b border-soil/10 pb-4">
                        Lotes Recentes
                    </h2>

                    <div className="bg-cream border border-soil/8 shadow-card rounded-sm overflow-hidden">
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-soil/10 bg-cream-dark/30">
                                        <th className="py-4 px-6 font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark/80">Código</th>
                                        <th className="py-4 px-6 font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark/80">Produto</th>
                                        <th className="py-4 px-6 font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark/80 text-right">Qtd Disponível</th>
                                        <th className="py-4 px-6 font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark/80">Validade</th>
                                        <th className="py-4 px-6 font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark/80 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLotsLoading ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <tr key={i} className="border-b border-soil/5">
                                                <td className="py-4 px-6"><Skeleton className="h-4 w-16" /></td>
                                                <td className="py-4 px-6"><Skeleton className="h-4 w-32" /></td>
                                                <td className="py-4 px-6"><Skeleton className="h-4 w-12 ml-auto" /></td>
                                                <td className="py-4 px-6"><Skeleton className="h-4 w-24" /></td>
                                                <td className="py-4 px-6"><Skeleton className="h-6 w-20 mx-auto rounded-full" /></td>
                                            </tr>
                                        ))
                                    ) : recentLots && recentLots.length > 0 ? (
                                        recentLots.map((lot: any) => {
                                            const isLastChance = lot.freshnessScore !== null && lot.freshnessScore < 30 || new Date(lot.expiryDate) <= new Date(Date.now() + 24 * 60 * 60 * 1000);
                                            const statusText = lot.isExpired ? "Expirado" : isLastChance ? "Last Chance" : "Ativo";
                                            const isExpired = lot.isExpired;

                                            return (
                                                <tr key={lot.id} className="border-b border-soil/5 hover:bg-cream-dark/20 transition-colors">
                                                    <td className="py-4 px-6 font-sans text-xs font-semibold text-bark">
                                                        {lot.lotCode}
                                                    </td>
                                                    <td className="py-4 px-6 font-sans text-sm font-medium text-soil">
                                                        {lot.product?.name || "Produto Desconhecido"}
                                                    </td>
                                                    <td className="py-4 px-6 font-sans text-sm font-semibold text-soil text-right">
                                                        {Number(lot.availableQty)}
                                                    </td>
                                                    <td className="py-4 px-6 font-sans text-xs text-bark">
                                                        {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(lot.expiryDate))}
                                                    </td>
                                                    <td className="py-4 px-6 text-center">
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider ${isExpired ? "bg-red-100 text-red-700" :
                                                            isLastChance ? "bg-orange-100 text-orange-600 border border-orange-200" :
                                                                "bg-sage border border-forest/15 text-forest"
                                                            }`}>
                                                            {statusText}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="py-12 px-6 text-center text-bark text-sm font-sans">
                                                Nenhum lote recente encontrado. <Link href="/dashboard/inventario" className="text-forest hover:underline font-semibold">Crie o seu primeiro lote</Link>.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
}
