"use client";

import { useRouter } from "next/navigation";
import { Button, Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, ProductCardSkeleton } from "@frescari/ui";
import Link from "next/link";
import { trpc } from "@/trpc/react";
import { ProductCardWrapper } from "@/components/ProductCardWrapper";
import Autoplay from "embla-carousel-autoplay";
import React from "react";

// Manual type for Lot to handle unbuilt workspace dependencies
interface DashboardLot {
    id: string;
    lotCode: string;
    productName: string;
    farmName: string;
    harvestDate: string | Date;
    expiryDate: string | Date;
    availableQty: number;
    saleUnit: string;
    unit: string;
    imageUrl: string | null;
    originalPrice: number;
    finalPrice: number;
    status: 'fresco' | 'last_chance' | 'vencido';
    pricingType: 'UNIT' | 'WEIGHT';
    estimatedWeight: number | null;
}

export default function BuyerDashboard({ user }: { user: any }) {
    const router = useRouter();

    const { data: lotsRaw = [], isLoading } = (trpc as any).lot.getAvailableLots.useQuery({});

    // Type assertion to bypass unbuilt package constraints
    const lots = lotsRaw as unknown as DashboardLot[];

    const lastChanceLots = lots.filter(l => l.status === 'last_chance').slice(0, 6);
    const freshLots = lots.filter(l => l.status === 'fresco').slice(0, 8);

    return (
        <div className="min-h-screen bg-cream">
            <main className="max-w-[1400px] mx-auto px-6 lg:px-12 py-12 space-y-16">
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

                {isLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {[...Array(4)].map((_, i) => (
                            <ProductCardSkeleton key={i} />
                        ))}
                    </div>
                ) : (
                    <>
                        {/* ── Hero Carousel: Last Chance ── */}
                        {lastChanceLots.length > 0 && (
                            <section className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="font-display text-2xl font-bold text-soil flex items-center gap-2">
                                        🔥 Oportunidades do Dia <span className="text-ember font-sans text-sm font-semibold uppercase tracking-wider">— Última Colheita</span>
                                    </h2>
                                </div>

                                <Carousel
                                    opts={{
                                        align: "start",
                                        loop: true,
                                    }}
                                    plugins={[
                                        Autoplay({
                                            delay: 5000,
                                            stopOnMouseEnter: true,
                                            stopOnInteraction: false,
                                        }),
                                    ]}
                                    className="w-full relative group"
                                >
                                    <CarouselContent className="-ml-4">
                                        {lastChanceLots.map((lot) => (
                                            <CarouselItem key={lot.id} className="pl-4 basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/4">
                                                <ProductCardWrapper
                                                    lot={lot as any}
                                                    isLastChance={true}
                                                />
                                            </CarouselItem>
                                        ))}
                                    </CarouselContent>
                                    <div className="hidden group-hover:block transition-all">
                                        <CarouselPrevious className="left-4 bg-white/80 backdrop-blur-md border-forest/10 hover:bg-white" />
                                        <CarouselNext className="right-4 bg-white/80 backdrop-blur-md border-forest/10 hover:bg-white" />
                                    </div>
                                </Carousel>
                            </section>
                        )}

                        {/* ── Fresh Lots Grid ── */}
                        {freshLots.length > 0 && (
                            <section className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="font-display text-2xl font-bold text-soil flex items-center gap-2">
                                        🌱 Acabaram de Chegar
                                    </h2>
                                    <Button variant="link" asChild>
                                        <Link href="/catalogo">Ver Tudo</Link>
                                    </Button>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                    {freshLots.map((lot) => (
                                        <ProductCardWrapper
                                            key={lot.id}
                                            lot={lot as any}
                                            isLastChance={false}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}

                        {lots.length === 0 && (
                            <div className="p-12 border border-dashed border-forest/20 rounded-sm bg-sage/20 flex flex-col items-center justify-center gap-6 text-center">
                                <div className="w-16 h-16 rounded-full bg-sage border border-forest/15 flex items-center justify-center mb-2">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-forest">
                                        <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-display text-2xl font-bold text-soil mb-2">
                                        Nada disponível no momento.
                                    </h3>
                                    <p className="font-sans text-sm text-bark max-w-md mx-auto leading-relaxed">
                                        O catálogo está sendo atualizado pelos produtores. Volte em alguns minutos para ver as novidades fresquinhas!
                                    </p>
                                </div>
                                <Button variant="secondary" asChild className="mt-4">
                                    <Link href="/catalogo">Ver Catálogo Público</Link>
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
