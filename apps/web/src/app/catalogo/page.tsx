import { getServerTrpc } from '@/trpc/server';
export const dynamic = 'force-dynamic';
import { ProductCardSkeleton } from '@frescari/ui';
import { ProductCardWrapper } from '@/components/ProductCardWrapper';
import { Suspense } from 'react';
import { unstable_noStore as noStore } from 'next/cache';
import { CatalogLot } from '@/store/useCartStore';

// ─────────────────────────────────────────────────────────
// LotsList — async server component
// ─────────────────────────────────────────────────────────
async function LotsList() {
    noStore();
    let lots: CatalogLot[] = [];
    try {
        const serverTrpc = await getServerTrpc();
        lots = await serverTrpc.lot.getAvailableLots({});
    } catch (e) {
        console.error("Failed to fetch lots", e);
    }

    if (!lots || lots.length === 0) {
        return (
            <div className="col-span-full py-32 flex flex-col items-center gap-6 text-center">
                {/* SVG leaf illustration */}
                <svg
                    width="64"
                    height="64"
                    viewBox="0 0 64 64"
                    fill="none"
                    aria-hidden="true"
                >
                    <path
                        d="M32 8 C32 8 10 20 10 38 C10 52 20 58 32 58 C44 58 54 52 54 38 C54 20 32 8 32 8Z"
                        fill="#e8f0e3"
                        stroke="#0d3321"
                        strokeWidth="1.5"
                    />
                    <path
                        d="M32 58 C32 58 32 32 32 20"
                        stroke="#0d3321"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                    />
                    <path
                        d="M32 44 C32 44 20 36 18 26"
                        stroke="#0d3321"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        opacity="0.5"
                    />
                    <path
                        d="M32 38 C32 38 44 30 46 20"
                        stroke="#0d3321"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        opacity="0.5"
                    />
                </svg>
                <div className="space-y-2">
                    <h2 className="font-display text-2xl font-bold text-soil">
                        Nenhum lote disponível
                    </h2>
                    <p className="font-sans text-base text-bark max-w-xs leading-relaxed">
                        Os produtores estão preparando a próxima colheita.
                        Volte em breve.
                    </p>
                </div>
            </div>
        );
    }

    // ── Separate Last Chance from regular lots
    const lastChanceLots = lots.filter((l) => l.isLastChance);
    const regularLots = lots.filter((l) => !l.isLastChance);
    const totalCount = lots.length;

    return (
        <div className="space-y-16">
            {/* ── Summary count ── */}
            <p className="font-sans text-sm text-bark">
                <span className="font-semibold text-soil">{totalCount}</span>{" "}
                {totalCount === 1 ? "lote disponível" : "lotes disponíveis"}
                {lastChanceLots.length > 0 && (
                    <> · <span className="text-ember font-semibold">{lastChanceLots.length}</span> em última chance</>
                )}
            </p>

            {/* ── Last Chance section (if any) ── */}
            {lastChanceLots.length > 0 && (
                <section aria-label="Última Chance" className="space-y-6">
                    {/* Section divider with label */}
                    <div className="flex items-center gap-4">
                        <div className="h-px flex-1 bg-ember/20" />
                        <div className="flex items-center gap-2 px-4 py-1.5 rounded-[3px] bg-ember/10 border border-ember/25">
                            <span className="block h-2 w-2 rounded-full bg-ember animate-[pulse-ember_1.2s_ease-in-out_infinite]" />
                            <span className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-ember">
                                Última Colheita 🔥 — Não Perca
                            </span>
                        </div>
                        <div className="h-px flex-1 bg-ember/20" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {lastChanceLots.map((lot) => (
                            <ProductCardWrapper key={lot.id} lot={lot} isLastChance={true} delay="0ms" />
                        ))}
                    </div>
                </section>
            )}

            {/* ── Regular lots ── */}
            {regularLots.length > 0 && (
                <section aria-label="Lotes disponíveis" className="space-y-6">
                    {lastChanceLots.length > 0 && (
                        <div className="flex items-center gap-4">
                            <div className="h-px flex-1 bg-forest/10" />
                            <span className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-bark">
                                Lotes Frescos
                            </span>
                            <div className="h-px flex-1 bg-forest/10" />
                        </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pb-24">
                        {regularLots.map((lot) => (
                            <ProductCardWrapper key={lot.id} lot={lot} isLastChance={false} />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────
// CatalogPage — hero header + grid
// ─────────────────────────────────────────────────────────
export default function CatalogPage() {
    return (
        <div className="min-h-screen bg-cream">
            <main className="max-w-[1400px] mx-auto py-20 px-6 lg:px-12 space-y-16">

                {/* ── Hero Header ── */}
                <header className="space-y-5 max-w-3xl">
                    {/* Live indicator chip */}
                    <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-forest/10 border border-forest/20">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-forest/50 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-forest" />
                        </span>
                        <span className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-forest">
                            Ofertas direto da horta
                        </span>
                    </div>

                    {/* Display headline */}
                    <h1 className="font-display text-6xl sm:text-7xl lg:text-8xl font-black text-soil leading-none tracking-tight">
                        Catálogo{" "}
                        <span className="italic text-forest">Frescari</span>
                    </h1>

                    {/* Body */}
                    <p className="font-sans text-lg text-bark leading-relaxed max-w-xl">
                        Produtos colhidos hoje em fazendas a menos de{" "}
                        <strong className="text-soil font-semibold">50km</strong> de você.
                        Apoie o produtor local e garanta o máximo de frescor.
                    </p>
                </header>

                {/* ── Product Grid with Suspense ── */}
                <Suspense
                    fallback={
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <ProductCardSkeleton key={i} isLastChance={i < 2} />
                            ))}
                        </div>
                    }
                >
                    <LotsList />
                </Suspense>
            </main>
        </div>
    );
}
