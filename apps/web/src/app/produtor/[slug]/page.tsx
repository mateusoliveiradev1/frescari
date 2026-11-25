import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCurrencyBRL } from "@frescari/ui";

import { ProductCardWrapper } from "@/components/ProductCardWrapper";
import { StorefrontShareButtons } from "@/components/StorefrontShareButtons";
import { getProducerStorefrontPageData } from "@/lib/catalog-public";
import { getSiteUrl, sanitizeText, serializeJsonLd } from "@/lib/catalog-seo";
import {
  buildProducerStorefrontPath,
  pickStorefrontHighlights,
} from "@/lib/producer-storefront";
import { buildSeoMetadata } from "@/lib/seo";

export const revalidate = 3600;

type ProducerStorefrontPageProps = {
  params: Promise<{ slug: string }>;
};

function formatPlace(city: string | null, state: string | null) {
  return [city, state].filter(Boolean).join(" - ");
}

function joinProductNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`;
}

export async function generateMetadata({
  params,
}: ProducerStorefrontPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProducerStorefrontPageData(slug);

  if (!data) {
    return { title: "Produtor nao encontrado | Frescari" };
  }

  const name = sanitizeText(data.producer.name);
  const place = formatPlace(data.producer.city, data.producer.state);
  const { highlights } = pickStorefrontHighlights(
    data.lots,
    formatCurrencyBRL,
    3,
  );
  const productNames = joinProductNames(highlights.map((item) => item.name));
  // Product names and the town in the description are what people search
  // for ("tomate direto do produtor em Pirangi").
  const description = sanitizeText(
    productNames
      ? `${productNames} direto de ${name}${place ? `, ${place}` : ""}. Compre online, direto do produtor, com entrega pela propria fazenda.`
      : `Produtos frescos de ${name}${place ? ` (${place})` : ""}, direto do produtor, com entrega pela propria fazenda.`,
    160,
  );

  return buildSeoMetadata({
    description,
    // An empty storefront is a thin page: keep it out of search results
    // until the producer has something to sell.
    index: data.lots.length > 0,
    // The storefront's own card (producer, town, prices) is what WhatsApp
    // shows when the link is pasted, instead of the generic site image.
    images: [
      {
        alt: `Vitrine de ${name} na Frescari`,
        url: `${buildProducerStorefrontPath(data.producer.slug)}/opengraph-image`,
      },
    ],
    path: buildProducerStorefrontPath(data.producer.slug),
    title: `${name} | Frescari`,
  });
}

export default async function ProducerStorefrontPage({
  params,
}: ProducerStorefrontPageProps) {
  const { slug } = await params;
  const data = await getProducerStorefrontPageData(slug);

  if (!data) {
    notFound();
  }

  const { producer, lots } = data;
  const place = formatPlace(producer.city, producer.state);
  const url = `${getSiteUrl()}${buildProducerStorefrontPath(producer.slug)}`;
  const showFarmName =
    producer.farmName !== null && producer.farmName !== producer.name;
  const { highlights, productCount } = pickStorefrontHighlights(
    lots,
    formatCurrencyBRL,
  );

  const storeJsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${url}#produtor`,
    name: sanitizeText(producer.name),
    url,
    ...(producer.city || producer.state
      ? {
          address: {
            "@type": "PostalAddress",
            ...(producer.city ? { addressLocality: producer.city } : {}),
            ...(producer.state ? { addressRegion: producer.state } : {}),
            addressCountry: "BR",
          },
        }
      : {}),
    ...(lots.length > 0
      ? {
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: `Ofertas de ${sanitizeText(producer.name)}`,
            itemListElement: lots.slice(0, 50).map((lot) => ({
              "@type": "Offer",
              price: lot.finalPrice.toFixed(2),
              priceCurrency: "BRL",
              availability: "https://schema.org/InStock",
              itemOffered: {
                "@type": "Product",
                name: sanitizeText(lot.productName),
                category: sanitizeText(lot.categoryName),
                ...(lot.imageUrl ? { image: lot.imageUrl } : {}),
              },
            })),
          },
        }
      : {}),
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
        name: sanitizeText(producer.name),
        item: url,
      },
    ],
  };

  return (
    <main className="min-h-screen bg-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(storeJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
      <div className="mx-auto flex max-w-[1400px] flex-col gap-10 px-6 py-16 lg:px-12">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-bark/70">
          <Link
            href="/catalogo"
            className="transition-colors hover:text-forest"
          >
            Catalogo
          </Link>
          <span>/</span>
          <span className="font-medium text-soil">{producer.name}</span>
        </nav>

        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-forest/20 bg-forest/10 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-forest" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-forest">
              Vitrine do produtor
            </span>
          </div>

          <h1 className="font-display text-5xl font-black tracking-tight text-soil sm:text-6xl">
            {producer.name}
          </h1>

          {showFarmName || place ? (
            <p className="text-lg text-bark">
              {[showFarmName ? producer.farmName : null, place]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}

          <p className="max-w-3xl text-base leading-relaxed text-bark">
            Compre direto de quem produz. O pagamento e feito pela Frescari e a
            entrega e combinada com o produtor.
          </p>

          <StorefrontShareButtons
            producerName={producer.name}
            place={place || null}
            highlights={highlights}
            productCount={productCount}
            url={url}
          />
        </header>

        {lots.length > 0 ? (
          <section aria-labelledby="ofertas-do-produtor" className="space-y-6">
            <h2
              id="ofertas-do-produtor"
              className="font-display text-3xl font-bold text-soil"
            >
              Ofertas disponiveis ({lots.length})
            </h2>
            <div className="grid grid-cols-1 gap-5 pb-24 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {lots.map((lot, index) => (
                <ProductCardWrapper
                  key={lot.id}
                  lot={lot}
                  isLastChance={lot.status === "last_chance"}
                  priority={index < 4}
                />
              ))}
            </div>
          </section>
        ) : (
          <section className="rounded-[28px] border border-soil/10 bg-white p-8 shadow-sm">
            <h2 className="font-display text-2xl font-bold text-soil">
              Sem ofertas no momento
            </h2>
            <p className="mt-2 text-bark">
              Este produtor ainda nao tem lotes disponiveis. Veja o que outros
              produtores estao oferecendo no catalogo.
            </p>
            <Link
              href="/catalogo"
              className="mt-4 inline-block font-semibold text-forest hover:underline"
            >
              Ver catalogo →
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
