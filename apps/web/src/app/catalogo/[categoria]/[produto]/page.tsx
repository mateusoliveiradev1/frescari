import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductCardWrapper } from "@/components/ProductCardWrapper";
import {
  getProductPageData,
  getProductStaticParams,
  getSchemaUnitCode,
} from "@/lib/catalog-public";
import { getSiteUrl, sanitizeText, serializeJsonLd } from "@/lib/catalog-seo";

export const revalidate = 3600;

type ProductPageProps = {
  params: Promise<{
    categoria: string;
    produto: string;
  }>;
};

function formatPrice(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

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
  const canonical = `${getSiteUrl()}${data.product.path}`;

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
      images: data.product.imageUrl
        ? [
            {
              url: data.product.imageUrl,
              alt: data.product.name,
            },
          ]
        : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { categoria, produto } = await params;
  const data = await getProductPageData(categoria, produto);

  if (!data) {
    notFound();
  }

  const canonical = `${getSiteUrl()}${data.product.path}`;
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
            offers: data.lots.slice(0, 10).map((lot) => ({
              "@type": "Offer",
              priceCurrency: "BRL",
              price: lot.finalPrice.toFixed(2),
              unitCode: getSchemaUnitCode(lot.unit || lot.saleUnit),
              availability: "https://schema.org/InStock",
              seller: {
                "@type": "Organization",
                name: sanitizeText(lot.farmName),
              },
              url: canonical,
            })),
          },
  };

  return (
    <main className="min-h-screen bg-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(productJsonLd) }}
      />

      <div className="mx-auto flex max-w-[1400px] flex-col gap-12 px-6 py-16 lg:px-12">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-bark/70">
          <Link href="/catalogo" className="transition-colors hover:text-forest">
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
                {formatPrice(data.product.lowestPrice)}
              </p>
              <p className="mt-1 text-sm text-bark/70">
                até {formatPrice(data.product.highestPrice)}/{data.product.saleUnit}
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
