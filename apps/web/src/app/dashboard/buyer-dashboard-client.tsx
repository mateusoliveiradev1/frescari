"use client";

import Link from "next/link";

import Autoplay from "embla-carousel-autoplay";
import {
    Button,
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
    ProductCardSkeleton,
} from "@frescari/ui";

import { ProductCardWrapper } from "@/components/ProductCardWrapper";
import { type CatalogLot } from "@/store/useCartStore";
import { trpc } from "@/trpc/react";

type BuyerDashboardProps = {
    user: {
        name?: string | null;
    };
};

export default function BuyerDashboard({ user }: BuyerDashboardProps) {
    const { data: lots = [], isLoading } = trpc.lot.getAvailableLots.useQuery({});

    const catalogLots = lots as CatalogLot[];
    const firstName = user.name?.split(" ")[0] ?? "Comprador";
    const lastChanceLots = catalogLots
        .filter((lot) => lot.status === "last_chance")
        .slice(0, 6);
    const freshLots = catalogLots
        .filter((lot) => lot.status === "fresco")
        .slice(0, 8);

    return (
        <div className="min-h-screen bg-cream">
            <main className="max-w-[1400px] mx-auto px-6 lg:px-12 py-12 space-y-16">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                    <div className="space-y-1">
                        <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-bark/70">
                            Painel do Comprador
                        </p>
                        <h1 className="font-display text-4xl font-black text-soil">
                            Bem-vindo,{" "}
                            <span className="italic text-forest">{firstName}</span>.
                        </h1>
                    </div>
                    <Button variant="secondary" asChild>
                        <Link href="/dashboard/perfil">Gerenciar Enderecos</Link>
                    </Button>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <ProductCardSkeleton key={index} />
                        ))}
                    </div>
                ) : (
                    <>
                        {lastChanceLots.length > 0 ? (
                            <section className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="font-display text-2xl font-bold text-soil flex items-center gap-2">
                                        Oportunidades do Dia
                                        <span className="text-ember font-sans text-sm font-semibold uppercase tracking-wider">
                                            Ultima Colheita
                                        </span>
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
                                        {lastChanceLots.map((lot, index) => (
                                            <CarouselItem
                                                key={lot.id}
                                                className="pl-4 basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/4"
                                            >
                                                <div className="p-1">
                                                    <ProductCardWrapper
                                                        lot={lot}
                                                        isLastChance
                                                        priority={index < 2}
                                                    />
                                                </div>
                                            </CarouselItem>
                                        ))}
                                    </CarouselContent>
                                    <div className="hidden group-hover:block transition-all">
                                        <CarouselPrevious className="left-4 bg-white/80 backdrop-blur-md border-forest/10 hover:bg-white" />
                                        <CarouselNext className="right-4 bg-white/80 backdrop-blur-md border-forest/10 hover:bg-white" />
                                    </div>
                                </Carousel>
                            </section>
                        ) : null}

                        {freshLots.length > 0 ? (
                            <section className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="font-display text-2xl font-bold text-soil">
                                        Acabaram de Chegar
                                    </h2>
                                    <Button variant="link" asChild>
                                        <Link href="/catalogo">Ver Tudo</Link>
                                    </Button>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                    {freshLots.map((lot, index) => (
                                        <ProductCardWrapper
                                            key={lot.id}
                                            lot={lot}
                                            isLastChance={false}
                                            priority={index < 2}
                                        />
                                    ))}
                                </div>
                            </section>
                        ) : null}

                        {catalogLots.length === 0 ? (
                            <div className="p-12 border border-dashed border-forest/20 rounded-sm bg-sage/20 flex flex-col items-center justify-center gap-6 text-center">
                                <div className="w-16 h-16 rounded-full bg-sage border border-forest/15 flex items-center justify-center mb-2">
                                    <svg
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        aria-hidden="true"
                                        className="text-forest"
                                    >
                                        <path
                                            d="M12 3v18M3 12h18"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-display text-2xl font-bold text-soil mb-2">
                                        Nada disponivel no momento.
                                    </h3>
                                    <p className="font-sans text-sm text-bark max-w-md mx-auto leading-relaxed">
                                        O catalogo esta sendo atualizado pelos produtores.
                                        Volte em alguns minutos para ver as novidades.
                                    </p>
                                </div>
                                <Button variant="secondary" asChild className="mt-4">
                                    <Link href="/catalogo">Ver Catalogo Publico</Link>
                                </Button>
                            </div>
                        ) : null}
                    </>
                )}
            </main>
        </div>
    );
}
