import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCurrencyBRL } from "@frescari/ui";

import { CatalogCommercialSection } from "@/components/CatalogCommercialSection";
import { ProductCardWrapper } from "@/components/ProductCardWrapper";
import {
  buildFaqPageJsonLd,
  buildProductCommercialSnapshot,
} from "@/lib/catalog-commercial";
import {
  getProductPageData,
  getProductStaticParams,
  getSchemaUnitCode,
} from "@/lib/catalog-public";
import { buildOfferAreaServed } from "@/lib/catalog-pseo";
import { getSiteUrl, sanitizeText, serializeJsonLd } from "@/lib/catalog-seo";
import { buildSeoMetadata } from "@/lib/seo";

export const revalidate = 3600;

type ProductPageProps = {
  params: Promise<{
    categoria: string;
    produto: string;
  }>;
};

export async function generateStaticParams(): Promise<
  Array<{ categoria: string; produto: string }>
> {
  return getProductStaticParams();
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { categoria, produto } = await params;
  const data = await getProductPageData(categoria, produto);

  if (!data) {
    return {
      title: "Produto não encontrado | Frescari",
    };
  }

  const title = `${sanitizeText(data.product.name)} em ${sanitizeText(data.category.name)} | Frescari`;
  const description = sanitizeText(data.product.description, 160);
  return buildSeoMetadata({
    description,
    images: data.product.imageUrl
      ? [
          {
            alt: sanitizeText(data.product.name),
            url: data.product.imageUrl,
          },
        ]
      : undefined,
    path: data.product.path,
    title,
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { categoria, produto } = await params;
  const data = await getProductPageData(categoria, produto);

  if (!data) {
    notFound();
  }

  const canonical = `${getSiteUrl()}${data.product.path}`;
  const uniqueAreasServed = Array.from(
    new Map(
      data.lots
        .map((lot) => buildOfferAreaServed(lot))
        .filter((value) => value !== undefined)
        .map((value) => [JSON.stringify(value), value]),
    ).values(),
  );
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: sanitizeText(data.product.name),
    category: sanitizeText(data.category.name),
    description: sanitizeText(data.product.description, 200),
    image: data.product.imageUrl ? [data.product.imageUrl] : undefined,
    url: canonical,
    brand: {
      "@type": "Brand",
      name: "Frescari",
    },
    offers:
      data.lots.length === 1
        ? {
            "@type": "Offer",
            priceCurrency: "BRL",
            price: data.product.lowestPrice.toFixed(2),
            unitCode: getSchemaUnitCode(data.product.saleUnit),
            availability: "https://schema.org/InStock",
            priceValidUntil: data.lots[0]?.expiryDate,
            areaServed:
              uniqueAreasServed.length <= 1
                ? uniqueAreasServed[0]
                : uniqueAreasServed,
            seller: {
              "@type": "Organization",
              name: sanitizeText(data.lots[0]?.farmName),
            },
            url: canonical,
          }
        : {
            "@type": "AggregateOffer",
            lowPrice: data.product.lowestPrice.toFixed(2),
            highPrice: data.product.highestPrice.toFixed(2),
            offerCount: data.product.offerCount,
            priceCurrency: "BRL",
            availability: "https://schema.org/InStock",
            areaServed:
              uniqueAreasServed.length > 0 ? uniqueAreasServed : undefined,
            offers: data.lots.slice(0, 10).map((lot) => ({
              "@type": "Offer",
              priceCurrency: "BRL",
              price: lot.finalPrice.toFixed(2),
              unitCode: getSchemaUnitCode(lot.unit || lot.saleUnit),
              availability: "https://schema.org/InStock",
              areaServed: buildOfferAreaServed(lot),
              seller: {
                "@type": "Organization",
                name: sanitizeText(lot.farmName),
              },
              url: canonical,
            })),
          },
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Catalogo",
        item: `${getSiteUrl()}/catalogo`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: sanitizeText(data.category.name),
        item: `${getSiteUrl()}${data.category.path}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: sanitizeText(data.product.name),
        item: canonical,
      },
    ],
  };
  const commercialSnapshot = buildProductCommercialSnapshot(data.lots, {
    productName: data.product.name,
  });
  const faqJsonLd = buildFaqPageJsonLd(commercialSnapshot.faqItems);

  return (
    <main className="min-h-screen bg-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }}
      />

      <div className="mx-auto flex max-w-[1400px] flex-col gap-12 px-6 py-16 lg:px-12">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-bark/70">
          <Link
            href="/catalogo"
            className="transition-colors hover:text-forest"
          >
            Catálogo
          </Link>
          <span>/</span>
          <Link
            href={data.category.path}
            className="transition-colors hover:text-forest"
          >
            {data.category.name}
          </Link>
          <span>/</span>
          <span className="font-medium text-soil">{data.product.name}</span>
        </nav>

        <header className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)] lg:items-start">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-forest/20 bg-forest/10 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-forest" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-forest">
                Produto com metadata dinâmica
              </span>
            </div>

            <h1 className="font-display text-5xl font-black tracking-tight text-soil sm:text-6xl">
              {data.product.name}
            </h1>

            <p className="max-w-3xl text-lg leading-relaxed text-bark">
              {data.product.description}
            </p>

            <div className="flex flex-wrap gap-3">
              {data.product.farmNames.map((farmName) => (
                <span
                  key={farmName}
                  className="rounded-full border border-soil/10 bg-white px-3 py-1.5 text-sm text-bark shadow-sm"
                >
                  {farmName}
                </span>
              ))}
            </div>
          </div>

          <aside className="grid gap-4 rounded-[28px] border border-soil/10 bg-white/75 p-6 shadow-sm backdrop-blur">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-bark/60">
                Faixa de preço
              </p>
              <p className="mt-2 font-display text-4xl font-black text-soil">
                {formatCurrencyBRL(data.product.lowestPrice)}
              </p>
              <p className="mt-1 text-sm text-bark/70">
                até {formatCurrencyBRL(data.product.highestPrice)}/
                {data.product.saleUnit}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-bark/60">
                  Ofertas ativas
                </p>
                <p className="mt-2 text-2xl font-semibold text-forest">
                  {data.product.offerCount}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-bark/60">
                  Produtores
                </p>
                <p className="mt-2 text-2xl font-semibold text-forest">
                  {data.product.farmNames.length}
                </p>
              </div>
            </div>
          </aside>
        </header>

        <CatalogCommercialSection
          eyebrow="Intencao comercial"
          faqItems={commercialSnapshot.faqItems}
          intro={commercialSnapshot.intro}
          metrics={commercialSnapshot.metrics}
          title={`Leitura comercial de ${data.product.name}`}
        />

        {data.productRegions.length > 0 ? (
          <section
            aria-labelledby="rotas-locais-do-produto"
            className="space-y-5"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-bark/60">
                Densidade local
              </p>
              <h2
                id="rotas-locais-do-produto"
                className="font-display text-3xl font-bold text-soil"
              >
                Onde {data.product.name.toLowerCase()} esta mais forte
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.productRegions.slice(0, 9).map((region) => (
                <Link
                  key={region.path}
                  href={region.path}
                  className="group rounded-[28px] border border-soil/10 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-forest/30 hover:shadow-lg"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-bark/60">
                    {region.regionName}
                  </p>
                  <h3 className="mt-3 font-display text-2xl font-bold text-soil transition-colors group-hover:text-forest">
                    {region.offerCount} oferta
                    {region.offerCount === 1 ? "" : "s"} locais
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-bark">
                    {region.farmCount} fazendas com{" "}
                    {data.product.name.toLowerCase()} ativo nesta rota local.
                  </p>
                  <div className="mt-5 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-bark/60">
                        A partir de
                      </p>
                      <p className="mt-1 text-xl font-semibold text-forest">
                        {formatCurrencyBRL(region.lowestPrice)}/
                        {region.saleUnit}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-soil">
                      Ver rota local
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section aria-labelledby="ofertas-do-produto" className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-forest/10" />
            <h2
              id="ofertas-do-produto"
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-bark"
            >
              Lotes disponíveis deste produto
            </h2>
            <div className="h-px flex-1 bg-forest/10" />
          </div>

          <div className="grid grid-cols-1 gap-5 pb-24 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.lots.map((lot, index) => (
              <ProductCardWrapper
                key={lot.id}
                lot={lot}
                isLastChance={lot.status === "last_chance"}
                priority={index < 4}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
