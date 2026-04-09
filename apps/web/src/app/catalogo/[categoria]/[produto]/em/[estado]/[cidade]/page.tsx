import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCurrencyBRL } from "@frescari/ui";

import { ProductCardWrapper } from "@/components/ProductCardWrapper";
import {
  getProductRegionPageData,
  getProductRegionStaticParams,
  getSchemaUnitCode,
} from "@/lib/catalog-public";
import {
  buildCategoryRegionPath,
  buildOfferAreaServed,
  buildSupplierRegionPath,
} from "@/lib/catalog-pseo";
import { getSiteUrl, sanitizeText, serializeJsonLd } from "@/lib/catalog-seo";

export const revalidate = 3600;

type ProductRegionPageProps = {
  params: Promise<{
    categoria: string;
    produto: string;
    estado: string;
    cidade: string;
  }>;
};

export async function generateStaticParams(): Promise<
  Array<{ categoria: string; produto: string; estado: string; cidade: string }>
> {
  return getProductRegionStaticParams();
}

export async function generateMetadata({
  params,
}: ProductRegionPageProps): Promise<Metadata> {
  const { categoria, produto, estado, cidade } = await params;
  const data = await getProductRegionPageData(
    categoria,
    produto,
    estado,
    cidade,
  );

  if (!data) {
    return {
      title: "Rota local nao encontrada | Frescari",
    };
  }

  const title = `${sanitizeText(data.region.name)} direto do produtor | Frescari`;
  const description = sanitizeText(data.region.description, 160);
  const canonical = `${getSiteUrl()}${data.region.path}`;

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: data.region.imageUrl
        ? [
            {
              url: data.region.imageUrl,
              alt: data.region.name,
            },
          ]
        : undefined,
    },
  };
}

export default async function ProductRegionPage({
  params,
}: ProductRegionPageProps) {
  const { categoria, produto, estado, cidade } = await params;
  const data = await getProductRegionPageData(
    categoria,
    produto,
    estado,
    cidade,
  );

  if (!data) {
    notFound();
  }

  const canonical = `${getSiteUrl()}${data.region.path}`;
  const categoryRegionPath = buildCategoryRegionPath(
    data.category.slug,
    data.region.stateSlug,
    data.region.citySlug,
  );
  const supplierRegionPath = buildSupplierRegionPath(
    data.region.stateSlug,
    data.region.citySlug,
  );
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
    description: sanitizeText(data.region.description, 200),
    image: data.region.imageUrl ? [data.region.imageUrl] : undefined,
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
            price: data.region.lowestPrice.toFixed(2),
            unitCode: getSchemaUnitCode(data.region.saleUnit),
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
            lowPrice: data.region.lowestPrice.toFixed(2),
            highPrice: data.region.highestPrice.toFixed(2),
            offerCount: data.region.offerCount,
            priceCurrency: "BRL",
            availability: "https://schema.org/InStock",
            areaServed:
              uniqueAreasServed.length > 0 ? uniqueAreasServed : undefined,
            offers: data.lots.slice(0, 10).map((lot) => ({
              "@type": "Offer",
              priceCurrency: "BRL",
              price: lot.finalPrice.toFixed(2),
              unitCode: getSchemaUnitCode(lot.saleUnit),
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
        item: `${getSiteUrl()}${data.product.path}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: sanitizeText(data.region.regionName),
        item: canonical,
      },
    ],
  };

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

      <div className="mx-auto flex max-w-[1400px] flex-col gap-12 px-6 py-16 lg:px-12">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-bark/70">
          <Link
            href="/catalogo"
            className="transition-colors hover:text-forest"
          >
            Catalogo
          </Link>
          <span>/</span>
          <Link
            href={data.category.path}
            className="transition-colors hover:text-forest"
          >
            {data.category.name}
          </Link>
          <span>/</span>
          <Link
            href={data.product.path}
            className="transition-colors hover:text-forest"
          >
            {data.product.name}
          </Link>
          <span>/</span>
          <span className="font-medium text-soil">
            {data.region.regionName}
          </span>
        </nav>

        <header className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)] lg:items-start">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-forest/20 bg-forest/10 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-forest" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-forest">
                Produto + regiao com densidade valida
              </span>
            </div>

            <h1 className="font-display text-5xl font-black tracking-tight text-soil sm:text-6xl">
              {data.region.name}
            </h1>

            <p className="max-w-3xl text-lg leading-relaxed text-bark">
              {data.region.description}
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href={data.product.path}
                className="rounded-full border border-soil/10 bg-white px-3 py-1.5 text-sm text-bark shadow-sm transition-colors hover:text-forest"
              >
                Ver pagina do produto
              </Link>
              <Link
                href={categoryRegionPath}
                className="rounded-full border border-soil/10 bg-white px-3 py-1.5 text-sm text-bark shadow-sm transition-colors hover:text-forest"
              >
                Ver categoria em {data.region.regionName}
              </Link>
              <Link
                href={supplierRegionPath}
                className="rounded-full border border-soil/10 bg-white px-3 py-1.5 text-sm text-bark shadow-sm transition-colors hover:text-forest"
              >
                Ver fornecedores em {data.region.regionName}
              </Link>
            </div>
          </div>

          <aside className="grid gap-4 rounded-[28px] border border-soil/10 bg-white/75 p-6 shadow-sm backdrop-blur">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-bark/60">
                Faixa de preco local
              </p>
              <p className="mt-2 font-display text-4xl font-black text-soil">
                {formatCurrencyBRL(data.region.lowestPrice)}
              </p>
              <p className="mt-1 text-sm text-bark/70">
                ate {formatCurrencyBRL(data.region.highestPrice)}/
                {data.region.saleUnit}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-bark/60">
                  Ofertas
                </p>
                <p className="mt-2 text-2xl font-semibold text-forest">
                  {data.region.offerCount}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-bark/60">
                  Lotes
                </p>
                <p className="mt-2 text-2xl font-semibold text-forest">
                  {data.region.lotCount}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-bark/60">
                  Fazendas
                </p>
                <p className="mt-2 text-2xl font-semibold text-forest">
                  {data.region.farmCount}
                </p>
              </div>
            </div>
          </aside>
        </header>

        <section aria-labelledby="produtores-locais" className="space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-bark/60">
              Malha local
            </p>
            <h2
              id="produtores-locais"
              className="font-display text-3xl font-bold text-soil"
            >
              Produtores ativos nesta rota
            </h2>
          </div>

          <div className="flex flex-wrap gap-3">
            {data.region.farmNames.map((farmName) => (
              <span
                key={farmName}
                className="rounded-full border border-soil/10 bg-white px-3 py-1.5 text-sm text-bark shadow-sm"
              >
                {farmName}
              </span>
            ))}
          </div>
        </section>

        <section aria-labelledby="ofertas-locais" className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-forest/10" />
            <h2
              id="ofertas-locais"
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-bark"
            >
              Lotes ativos desta rota local
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
