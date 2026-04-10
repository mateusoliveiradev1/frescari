import type { Metadata } from "next";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { Suspense } from "react";
import { Leaf, MapPin, Store } from "lucide-react";
import { Button, ProductCardSkeleton } from "@frescari/ui";

import { CatalogReserveNotice } from "@/components/CatalogReserveNotice";
import { ProductCardWrapper } from "@/components/ProductCardWrapper";
import {
  buildCategoryRegionSummaries,
  buildCategorySummaries,
  buildProductRegionSummaries,
  buildSupplierRegionSummaries,
  getAvailableCatalogLots,
  type PublicCatalogLot,
} from "@/lib/catalog-public";
import { getSiteUrl, sanitizeText, serializeJsonLd } from "@/lib/catalog-seo";
import { buildSeoMetadata } from "@/lib/seo";

export const revalidate = 3600;

function disableCatalogStaticRenderingForE2E() {
  if (process.env.PLAYWRIGHT_TEST === "true") {
    noStore();
  }
}

export async function generateMetadata(): Promise<Metadata> {
  disableCatalogStaticRenderingForE2E();

  let lots: PublicCatalogLot[] = [];

  try {
    lots = await getAvailableCatalogLots();
  } catch (error) {
    console.error("Failed to fetch catalog metadata", error);
  }

  const categories = buildCategorySummaries(lots);
  const categoryRegions = buildCategoryRegionSummaries(lots);
  const productRegions = buildProductRegionSummaries(lots);
  const regions = buildSupplierRegionSummaries(lots);
  const title = "Catalogo Frescari | Hortifruti direto do produtor";
  const description = sanitizeText(
    lots.length > 0
      ? `Catalogo Frescari com ${lots.length} lotes ativos em ${categories.length} categorias, ${regions.length} regioes, ${categoryRegions.length} rotas categoria-regiao e ${productRegions.length} rotas produto-regiao com oferta publicada.`
      : "Catalogo Frescari com leitura viva da oferta local, categorias indexaveis e lotes publicados pelos produtores.",
    160,
  );
  return buildSeoMetadata({
    description,
    path: "/catalogo",
    title,
  });
}

async function LotsList() {
  disableCatalogStaticRenderingForE2E();

  let lots: PublicCatalogLot[] = [];

  try {
    lots = await getAvailableCatalogLots();
  } catch (error) {
    console.error("Failed to fetch lots", error);
  }

  if (!lots.length) {
    return (
      <div className="col-span-full">
        <div className="surface-panel mx-auto max-w-2xl rounded-[32px] px-8 py-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sage/60 text-forest">
            <Leaf className="h-8 w-8" />
          </div>
          <p className="field-label mt-6">Atualizacao de oferta</p>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.04em] text-soil">
            Nenhum lote disponivel agora
          </h2>
          <p className="mx-auto mt-4 max-w-xl font-sans text-base leading-7 text-bark/78">
            Os produtores estao fechando a proxima janela de colheita. O
            catalogo continua sendo atualizado ao longo do dia com novos lotes,
            unidade de venda e disponibilidade real.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild variant="primary">
              <Link href="/">Voltar para a apresentacao</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/auth/register">Quero vender na Frescari</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const lastChanceLots = lots.filter((lot) => lot.status === "last_chance");
  const regularLots = lots.filter((lot) => lot.status === "fresco");

  return (
    <div className="space-y-12">
      <div className="grid gap-4 rounded-[28px] border border-forest/10 bg-white px-5 py-5 shadow-[0_18px_40px_-34px_rgba(13,51,33,0.42)] lg:grid-cols-[auto,1fr] lg:items-center">
        <div className="surface-muted inline-flex items-center gap-2 rounded-full px-3 py-2">
          <span className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
            {lots.length} {lots.length === 1 ? "lote ativo" : "lotes ativos"}
          </span>
        </div>
        <p className="font-sans text-sm leading-6 text-bark/78">
          Cada lote mostra fazenda, unidade comercial e disponibilidade real. O
          checkout continua separado por produtor para reduzir friccao logistica
          e dar clareza ao frete.
          {lastChanceLots.length > 0 ? (
            <span className="font-semibold text-ember">
              {" "}
              {lastChanceLots.length} em ultima chamada.
            </span>
          ) : null}
        </p>
      </div>

      {lastChanceLots.length > 0 ? (
        <section aria-label="Ultima chamada" className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-ember/20" />
            <div className="rounded-full border border-ember/20 bg-ember/10 px-4 py-1.5">
              <span className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-ember">
                Ultima chamada
              </span>
            </div>
            <div className="h-px flex-1 bg-ember/20" />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {lastChanceLots.map((lot) => (
              <ProductCardWrapper
                delay="0ms"
                isLastChance
                key={lot.id}
                lot={lot}
              />
            ))}
          </div>
        </section>
      ) : null}

      {regularLots.length > 0 ? (
        <section aria-label="Lotes frescos" className="space-y-6">
          {lastChanceLots.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-forest/10" />
              <span className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-bark/70">
                Lotes frescos
              </span>
              <div className="h-px flex-1 bg-forest/10" />
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-5 pb-24 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {regularLots.map((lot) => (
              <ProductCardWrapper isLastChance={false} key={lot.id} lot={lot} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default function CatalogPage() {
  const siteUrl = getSiteUrl();

  return <CatalogPageContent siteUrl={siteUrl} />;
}

async function CatalogPageContent({ siteUrl }: { siteUrl: string }) {
  disableCatalogStaticRenderingForE2E();

  let lots: PublicCatalogLot[] = [];

  try {
    lots = await getAvailableCatalogLots();
  } catch (error) {
    console.error("Failed to fetch catalog navigation", error);
  }

  const categories = buildCategorySummaries(lots);
  const categoryRegions = buildCategoryRegionSummaries(lots);
  const productRegions = buildProductRegionSummaries(lots);
  const regions = buildSupplierRegionSummaries(lots);
  const catalogJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Catalogo Frescari",
    description: sanitizeText(
      lots.length > 0
        ? `Catalogo Frescari com ${lots.length} lotes ativos, ${categories.length} categorias, ${regions.length} regioes, ${categoryRegions.length} rotas categoria-regiao e ${productRegions.length} rotas produto-regiao.`
        : "Catalogo Frescari com leitura viva da oferta local publicada pelos produtores.",
      200,
    ),
    url: `${siteUrl}/catalogo`,
    hasPart: [
      ...categories.slice(0, 8).map((category) => ({
        "@type": "CollectionPage",
        name: sanitizeText(category.name),
        url: `${siteUrl}${category.path}`,
      })),
      ...regions.slice(0, 8).map((region) => ({
        "@type": "CollectionPage",
        name: sanitizeText(region.name),
        url: `${siteUrl}${region.path}`,
      })),
      ...categoryRegions.slice(0, 8).map((region) => ({
        "@type": "CollectionPage",
        name: sanitizeText(region.name),
        url: `${siteUrl}${region.path}`,
      })),
      ...productRegions.slice(0, 8).map((region) => ({
        "@type": "CollectionPage",
        name: sanitizeText(region.name),
        url: `${siteUrl}${region.path}`,
      })),
    ],
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: lots.length,
      itemListElement: lots.slice(0, 12).map((lot, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: sanitizeText(lot.productName),
        url: `${siteUrl}${lot.productPath}`,
      })),
    },
  };

  return (
    <div className="min-h-screen bg-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(catalogJsonLd) }}
      />

      <main className="max-w-[1400px] mx-auto px-6 py-16 lg:px-12 lg:py-20 space-y-12">
        <header className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr] xl:items-end">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-forest/16 bg-forest/6 px-3.5 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-forest/55 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-forest" />
              </span>
              <span className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-forest">
                Oferta direto da horta
              </span>
            </div>

            <div className="space-y-4">
              <h1 className="font-display text-5xl font-black leading-[0.92] tracking-[-0.05em] text-soil sm:text-6xl lg:text-7xl">
                Catalogo <span className="italic text-forest">Frescari</span>
              </h1>
              <p className="max-w-2xl font-sans text-lg leading-relaxed text-bark/82">
                Descubra lotes publicados pelos produtores com unidade
                comercial, origem local e disponibilidade real. A leitura da
                oferta e o fechamento do pedido foram desenhados para
                abastecimento B2B, nao para vitrine generica.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {[
                "Compra por lote",
                "Checkout por fazenda",
                "Origem local visivel",
              ].map((item) => (
                <span
                  className="rounded-full border border-forest/10 bg-white px-3.5 py-2 font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-bark/78"
                  key={item}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <aside className="surface-panel rounded-[30px] p-6">
            <p className="field-label">O que muda na jornada</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-[22px] border border-forest/10 bg-white px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sage/60 text-forest">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-bark/65">
                      Origem
                    </p>
                    <p className="font-display text-xl font-black text-soil">
                      Mais contexto
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[22px] border border-forest/10 bg-white px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sage/60 text-forest">
                    <Leaf className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-bark/65">
                      Frescor
                    </p>
                    <p className="font-display text-xl font-black text-soil">
                      Leitura rapida
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[22px] border border-forest/10 bg-white px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sage/60 text-forest">
                    <Store className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-bark/65">
                      Operacao
                    </p>
                    <p className="font-display text-xl font-black text-soil">
                      Sem ruido
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </header>

        {categories.length > 0 ||
        regions.length > 0 ||
        categoryRegions.length > 0 ? (
          <section aria-labelledby="atalhos-indexaveis" className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-[28px] border border-soil/10 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="field-label">Malha editorial</p>
                    <h2
                      id="atalhos-indexaveis"
                      className="mt-2 font-display text-3xl font-black tracking-[-0.04em] text-soil"
                    >
                      Explore por categoria
                    </h2>
                  </div>
                  <span className="rounded-full border border-forest/10 bg-sage/35 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
                    {categories.length} categorias
                  </span>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  {categories.slice(0, 12).map((category) => (
                    <Link
                      key={category.path}
                      href={category.path}
                      className="rounded-full border border-soil/10 bg-cream px-3.5 py-2 text-sm font-medium text-bark transition-colors hover:text-forest"
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-soil/10 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="field-label">Cobertura local</p>
                    <h2 className="mt-2 font-display text-3xl font-black tracking-[-0.04em] text-soil">
                      Explore por regiao
                    </h2>
                  </div>
                  <span className="rounded-full border border-forest/10 bg-sage/35 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
                    {regions.length} regioes
                  </span>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {regions.slice(0, 8).map((region) => (
                    <Link
                      key={region.path}
                      href={region.path}
                      className="rounded-[20px] border border-soil/10 bg-cream px-4 py-3 transition-colors hover:border-forest/25"
                    >
                      <p className="text-sm font-semibold text-soil">
                        {region.name}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-bark/72">
                        {region.lotCount} lotes, {region.farmCount} fazendas
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {categoryRegions.length > 0 ? (
              <div className="rounded-[28px] border border-soil/10 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="field-label">Rotas locais</p>
                    <h2 className="mt-2 font-display text-3xl font-black tracking-[-0.04em] text-soil">
                      Categoria + regiao com maior densidade
                    </h2>
                  </div>
                  <span className="rounded-full border border-forest/10 bg-sage/35 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
                    {categoryRegions.length} rotas
                  </span>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {categoryRegions.slice(0, 6).map((region) => (
                    <Link
                      key={region.path}
                      href={region.path}
                      className="rounded-[20px] border border-soil/10 bg-cream px-4 py-3 transition-colors hover:border-forest/25"
                    >
                      <p className="text-sm font-semibold text-soil">
                        {region.name}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-bark/72">
                        {region.lotCount} lotes, {region.farmCount} fazendas, a
                        partir de{" "}
                        {region.lowestPrice.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            {productRegions.length > 0 ? (
              <div className="rounded-[28px] border border-soil/10 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="field-label">Rotas de produto</p>
                    <h2 className="mt-2 font-display text-3xl font-black tracking-[-0.04em] text-soil">
                      Produto + regiao com mais prontidao
                    </h2>
                  </div>
                  <span className="rounded-full border border-forest/10 bg-sage/35 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
                    {productRegions.length} rotas
                  </span>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {productRegions.slice(0, 6).map((region) => (
                    <Link
                      key={region.path}
                      href={region.path}
                      className="rounded-[20px] border border-soil/10 bg-cream px-4 py-3 transition-colors hover:border-forest/25"
                    >
                      <p className="text-sm font-semibold text-soil">
                        {region.name}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-bark/72">
                        {region.offerCount} ofertas, {region.farmCount}{" "}
                        fazendas, a partir de{" "}
                        {region.lowestPrice.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                        /{region.saleUnit}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <p className="field-label">Selecao viva</p>
              <h2 className="font-display text-3xl font-black tracking-[-0.04em] text-soil">
                Lotes publicados hoje
              </h2>
            </div>
            <p className="font-sans text-sm leading-6 text-bark/70">
              Atualizacao automatica a cada hora para manter disponibilidade e
              preco alinhados ao lote.
            </p>
          </div>

          <CatalogReserveNotice />

          <Suspense
            fallback={
              <div
                aria-busy="true"
                className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              >
                {Array.from({ length: 8 }).map((_, index) => (
                  <ProductCardSkeleton isLastChance={index < 2} key={index} />
                ))}
              </div>
            }
          >
            <LotsList />
          </Suspense>
        </section>
      </main>
    </div>
  );
}
